// 123 Baby Box — live Parent Panel (Focus Group)
// Vercel Node serverless function. Reads a brief, asks Gemini 2.5 Flash to react
// AS the three core-customer personas, returns { reactions: [{key,score,line,share}] }.
//
// Deploy: set GEMINI_API_KEY in the Vercel project's Environment Variables.
// (Optional: PANEL_MODEL to override the model, default gemini-2.5-flash.)
// Until the key is set, the engine falls back to the modeled read automatically.

const MODEL = process.env.PANEL_MODEL || "gemini-2.5-flash";

// The focus group = the three core customers, one per channel.
const PERSONAS = [
  { key: "gail", name: "Gifting Grandma Gail", channel: "Facebook",
    bio: "Buys for the grandkids on Facebook — the gift-buyer. Wants the 'right,' expert-backed thing and to look thoughtful giving it. Trusts credentials + a clear reason it matters; shares warm, reassuring content with her friends. Rewards expert credibility + gift framing." },
  { key: "mia", name: "Millennial-Mom Mia", channel: "Instagram",
    bio: "The core subscriber, on Instagram. Aspirational-but-real, milestone-driven, saves everything. Wants development made plain (and a little beautiful) and to feel capable, never behind. Rewards clear value, credibility, and reassurance; allergic to shame and empty product shots." },
  { key: "zoe", name: "Gen-Z-Mom Zoe", channel: "TikTok",
    bio: "Younger mom on TikTok, discovering brands on the FYP. Trend-native, budget-tight, allergic to anything polished or salesy. Rewards authenticity, humor, and a genuinely useful free hack; bounces off ads, upsells, and anything that feels corporate." },
];

const SYSTEM =
`You are a synthetic focus group for 123 Baby Box, a DTC subscription of age-tailored Montessori/developmental toys for babies 0-3. Brand voice is warm, mom-to-mom, reassuring, plain-language-expert; its #1 rule is REASSURE, NEVER SHAME.
You role-play the brand's THREE core customers — one per channel: Gifting Grandma Gail (Facebook), Millennial-Mom Mia (Instagram), and Gen-Z-Mom Zoe (TikTok). Stay ruthlessly in each point of view — they react differently, and each is judging the post partly through her own channel's lens. Be honest: if a brief is weak, shaming/anxiety-farming, a bare product dump with no developmental 'why', or not for them, say so and score it low. Do not be a cheerleader. Reward: developmental value made plain, reassurance (never shame), budget honesty, baby-independent watchability, expert credibility, humor/authenticity (esp. for Zoe), and content that makes the age-stage personalization visible. Penalize: fear/shame, 'AI-powered' tech-brag, bare unboxings with no payoff, and anything that reads as an upsell.
For each customer return:
- score: 0-100, how likely THIS customer is to stop, save/share, and (for Gail) gift based on THIS post.
- line: 1-2 sentences in her own first-person voice reacting to the post (specific to the brief, not generic).
- share: one of "would share", "would save", "would gift", or "would scroll past".
Return ONLY valid JSON, no prose, in exactly this shape:
{"reactions":[{"key":"gail","score":0,"line":"","share":""},{"key":"mia","score":0,"line":"","share":""},{"key":"zoe","score":0,"line":"","share":""}]}`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) { res.status(500).json({ error: "GEMINI_API_KEY not set" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const { concept = "", hooks = [], caption = "", pillar = "", dna = "" } = body || {};

  const user =
`PROPOSED POST
Concept: ${concept}
Content pillar: ${pillar}  ·  Format: ${dna}
Hook options: ${(hooks || []).join("  /  ")}
Caption: ${caption}

THE THREE CUSTOMERS (one per channel)
${PERSONAS.map(p => `- ${p.key} (${p.name} · ${p.channel}): ${p.bio}`).join("\n")}

React as all three. Return ONLY the JSON.`;

  try {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(MODEL) + ":generateContent?key=" + encodeURIComponent(key);
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.9,
          // JSON output: force JSON, disable thinking, and give ample tokens so it
          // doesn't truncate mid-string (see feedback_gemini_thinking_budget).
          responseMimeType: "application/json",
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    if (!r.ok) { const t = await r.text(); res.status(502).json({ error: "gemini " + r.status, detail: t.slice(0, 400) }); return; }
    const j = await r.json();
    const txt = (j.candidates && j.candidates[0] && j.candidates[0].content &&
      j.candidates[0].content.parts && j.candidates[0].content.parts.map(p => p && p.text || "").join("")) || "";
    const m = txt.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : txt);
    res.status(200).json({ reactions: parsed.reactions || [] });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
