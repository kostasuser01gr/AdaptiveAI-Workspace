const Anthropic = require('@anthropic-ai/sdk');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ fallback: true, reason: 'no_api_key' });
  }

  const { query, role } = req.body || {};
  if (!query) return res.status(400).json({ error: 'Missing query' });

  try {
    const client = new Anthropic();
    const roleCtx = role ? `User role: ${role}.` : '';

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `You are a dashboard surface generator for AdaptiveAI Workspace, a fleet/automotive SaaS.
${roleCtx}
Generate a JSON response for this dashboard query: "${query}"

Return ONLY valid JSON with this structure:
{
  "title": "Surface title (max 30 chars)",
  "tag": "Category tag (max 10 chars)",
  "key": "surface_key_snake_case",
  "html": "Complete HTML for the surface content (use inline styles, dark theme vars like var(--text), var(--muted), var(--accent), var(--surface), var(--border))"
}

The HTML should be a rich, data-filled dashboard surface with realistic fake data relevant to the query.
Use tables, cards, KPIs, or charts as appropriate. Keep it concise but informative.`
      }]
    });

    const text = msg.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(200).json({ fallback: true, reason: 'parse_error' });

    const result = JSON.parse(jsonMatch[0]);
    return res.status(200).json(result);
  } catch (e) {
    console.error('[api/generate] Error:', e.message);
    return res.status(200).json({ fallback: true, reason: 'api_error', error: e.message });
  }
};
