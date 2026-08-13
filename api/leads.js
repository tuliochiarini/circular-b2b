import { callAppsScript, requireInternalKey } from './_circular.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  if (!requireInternalKey(req, res)) return;

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!body.empresa) return res.status(400).json({ success: false, error: 'empresa is required' });

    const lead = {
      action: 'lead',
      origem: body.origem || 'prospeccao',
      statusLead: body.statusLead || 'novo',
      empresa: String(body.empresa).trim(),
      responsavel: String(body.responsavel || '').trim(),
      whatsapp: String(body.whatsapp || '').trim(),
      email: String(body.email || '').trim(),
      site: String(body.site || '').trim(),
      cidadeUF: String(body.cidadeUF || '').trim(),
      materiais: Array.isArray(body.materiais) ? body.materiais : [],
      observacoes: String(body.observacoes || '').trim(),
      fonte: String(body.fonte || '').trim(),
      proximaAcao: String(body.proximaAcao || '').trim()
    };

    const data = await callAppsScript(lead);
    return res.status(200).json({ success: true, lead, upstream: data });
  } catch (error) {
    console.error('Circular leads error:', error);
    return res.status(502).json({ success: false, error: 'Não foi possível registrar o lead.' });
  }
}
