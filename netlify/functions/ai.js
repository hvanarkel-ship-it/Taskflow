const { ok, err, json, requireAuth, checkRate, parseBody, safeErr } = require('./shared/db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
  if (!checkRate(event)) return err(429, 'Te veel verzoeken');
  if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');

  try {
    requireAuth(event);
    const { message, context } = parseBody(event);
    if (!message?.trim()) return err(400, 'Bericht vereist');
    if (message.length > 2000) return err(400, 'Bericht te lang');

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      console.error('FATAL: ANTHROPIC_API_KEY not set');
      return err(503, 'AI niet geconfigureerd');
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
        system: `Je bent een Nederlandse sales assistent voor DPM CRM. Analyseer de pipeline, geef concreet advies met namen en bedragen. Max 300 woorden.\n\n${context || ''}`,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      console.error('Anthropic API error:', response.status);
      if (response.status === 429) return err(429, 'AI rate limit — probeer later');
      return err(502, 'AI tijdelijk niet beschikbaar');
    }

    const data = await response.json();
    const text = data.content?.[0]?.text;
    if (!text) return err(502, 'Geen antwoord van AI');
    return ok({ text });
  } catch (e) {
    return safeErr(e);
  }
};
