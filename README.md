# 123 Baby Box — Content Engine

Single-file React engine (`index.html`) + two Vercel serverless functions:
- `api/panel.js` — live Focus Group (3 core customers: Grandma/FB, Millennial mom/IG, Gen Z mom/TikTok)
- `api/studio.js` — The Strategist (streaming chat)

Live features require env var `ANTHROPIC_API_KEY` in the Vercel project (Settings → Environment Variables).
Optional: `PANEL_MODEL`, `STUDIO_MODEL` (default `claude-sonnet-5`). Until the key is set, both fall back gracefully.
