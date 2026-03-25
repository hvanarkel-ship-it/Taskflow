// ═══════════════════════════════════════════════════════
// /api/ai — Claude AI Sales Assistant (server-side proxy)
// POST { message, context }
//
// WHY THIS EXISTS:
// The Anthropic API key must NEVER be in the browser.
// This function runs on Netlify's servers, reads the key
// from environment variables, and proxies requests safely.
// ═══════════════════════════════════════════════════════
const { ok, err, json, requireAuth, checkRate, parseBody, safeErr } = require('./shared/db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
  if (!checkRate(event)) return err(429, 'Te veel verzoeken');
  if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');

  try {
    // Require login — no anonymous AI calls (protects your API costs)
    requireAuth(event);

    const { message, context } = parseBody(event);
    if (!message?.trim()) return err(400, 'Bericht vereist');
    if (message.length > 2000) return err(400, 'Bericht te lang');

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      console.error('FATAL: ANTHROPIC_API_KEY not set in Netlify env vars');
      return err(503, 'AI niet geconfigureerd — voeg ANTHROPIC_API_KEY toe als Netlify env var');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: `Je bent een Nederlandse sales assistent voor een persoonlijk CRM systeem (DPM CRM). Je analyseert de pipeline, geeft proactief advies over deals, contactstrategie en opvolging. Wees concreet, noem namen en bedragen. Geef actiegerichte adviezen. Wees beknopt — max 300 woorden per antwoord.\n\n${context || ''}`,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('Anthropic API error:', response.status, errData);
      if (response.status === 429) return err(429, 'AI rate limit bereikt — probeer over een moment opnieuw');
      return err(502, 'AI tijdelijk niet beschikbaar');
    }

    const data = await response.json();
    const text = data.content?.[0]?.text;
    if (!text) return err(502, 'Geen antwoord van AI');

    return ok({ text });
  } catch (e) {
    console.error('AI function error:', e);
    return safeErr(e);
  }
};
