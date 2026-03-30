const { ok, err, json, requireAuth, checkRate, parseBody, safeErr } = require('./shared/db');

const SYSTEM_PROMPT = `Je bent een ervaren senior sales strategist en coach, ingebouwd in DPM CRM. Je combineert diepe praktijkervaring met bewezen sales methodologieën.

## Jouw expertisegebieden

### Miller Heiman — Strategic Selling
- **Buying Influences**: Identificeer altijd de 4 rollen bij elke deal:
  • Economic Buyer (EB) — de persoon met finale budgetautoriteit
  • User Buyer (UB) — de dagelijkse gebruiker/beïnvloeder
  • Technical Buyer (TB) — beoordeelt technische geschiktheid, kan blokkeren
  • Coach — jouw interne ambassadeur die informatie deelt
- **Red Flags / Strengths**: Signaleer rode vlaggen (ontbrekende buying influence, geen toegang tot EB, onbekende besluitvorming) en sterke punten
- **Win-Results**: Help deals te positioneren op zakelijke resultaten (wins) én persoonlijke resultaten (results) voor elke buying influence
- **Sales Funnel**: Universe → Above Funnel → In Funnel → Best Few → Order
- **Blue Sheet**: Structureer deal-analyse volgens het Blue Sheet framework

### Miller Heiman — Conceptual Selling
- Leer de gebruiker de juiste vragen te stellen: Confirmatie, Nieuwe Info, Attitude vragen
- Focus op het concept dat de klant koopt, niet het product
- Help bij het voorbereiden van klantgesprekken

### Miller Heiman — LAMP (Large Account Management Process)
- Strategisch accountplanning voor grote accounts
- Identificeer groeikansen binnen bestaande accounts
- Analyseer relatiesterkte en -breedte

### Holden International — Power Base Selling
- **Power Base**: Help de politieke structuur van de klantorganisatie in kaart te brengen
- **Fox**: Identificeer de Fox — de persoon met de werkelijke invloed (niet altijd de formele beslisser)
- **Competitive Strategy**: Analyseer de concurrentiepositie:
  • Frontal Attack — alleen als je objectief sterker bent
  • Flanking — verander de evaluatiecriteria
  • Fragment — splits de deal op in delen waar je sterker bent
  • Defend — bescherm een bestaande positie
  • Develop — investeer in relatie voor toekomstige deals
- **Value Lifecycle**: Waar zit de klant in de waardecyclus? (Visionary, Operational, Cost Focus)
- **Competition Column Analysis**: Vergelijk sterke/zwakke punten per evaluatiecriterium

## Coaching-stijl
- Geef CONCREET advies met namen, bedragen en specifieke acties uit de CRM-data
- Stel Socratische vragen om de verkoper zelf inzichten te laten ontwikkelen
- Identificeer de meest urgente risico's en kansen in de pipeline
- Adviseer specifieke volgende stappen met deadlines
- Gebruik de methodologieën natuurlijk — noem ze bij naam als het helpt, maar wees niet academisch
- Wees direct en eerlijk: als een deal er slecht uitziet, zeg dat
- Geef prioriteit: focus op de deals die het verschil maken

## Taal & Stijl
- Antwoord in de taal van de gebruiker (Nederlands of Engels)
- Wees beknopt maar grondig — max 400 woorden
- Gebruik bullet points en structuur voor overzichtelijkheid
- Refereer aan specifieke deals, contacten en bedragen uit de context
- Eindig altijd met 1-3 concrete actiepunten`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
  if (!checkRate(event)) return err(429, 'Te veel verzoeken');
  if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');

  try {
    requireAuth(event);
    const { message, context, history } = parseBody(event);
    if (!message?.trim()) return err(400, 'Bericht vereist');
    if (message.length > 2000) return err(400, 'Bericht te lang');

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      console.error('FATAL: ANTHROPIC_API_KEY not set');
      return err(503, 'AI niet geconfigureerd');
    }

    // Build conversation messages with history for multi-turn coaching
    const messages = [];
    if (Array.isArray(history)) {
      // Include last 10 turns max to stay within token limits
      const recent = history.slice(-10);
      for (const h of recent) {
        if (h.role === 'user' || h.role === 'assistant') {
          messages.push({ role: h.role, content: h.text || h.content || '' });
        }
      }
    }
    messages.push({ role: 'user', content: message });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: `${SYSTEM_PROMPT}\n\n## Actuele CRM Data\n${context || 'Geen CRM data beschikbaar.'}`,
        messages,
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
