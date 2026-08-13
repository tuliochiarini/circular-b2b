import { callAppsScript, requireInternalKey } from './_circular.js';

const clean = value => String(value ?? '').trim();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  if (!requireInternalKey(req, res)) return;

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!body.empresa) return res.status(400).json({ success: false, error: 'empresa is required' });

    const materiais = Array.isArray(body.materiais)
      ? body.materiais.filter(item => item && clean(item.material))
      : [];

    const lead = {
      action: 'lead',
      origem: clean(body.origem) || 'prospeccao',
      fonte: clean(body.fonte),
      statusLead: clean(body.statusLead) || 'novo',
      empresa: clean(body.empresa),
      responsavel: clean(body.responsavel),
      whatsapp: clean(body.whatsapp),
      email: clean(body.email),
      site: clean(body.site),
      cidadeUF: clean(body.cidadeUF),
      segmento: clean(body.segmento),
      tipo: clean(body.tipo || body.tipoPrincipal),
      materiais,
      logistica: clean(body.logistica),
      restricoes: clean(body.restricoes),
      observacoes: clean(body.observacoes),
      ultimaInteracao: clean(body.ultimaInteracao),
      proximaAcao: clean(body.proximaAcao),
      dataProximaAcao: clean(body.dataProximaAcao)
    };

    if (!lead.whatsapp && !lead.email && !lead.site) {
      return res.status(400).json({
        success: false,
        error: 'lead requires at least whatsapp, email or site'
      });
    }

    const data = await callAppsScript(lead);
    if (data && data.success === false) {
      return res.status(422).json({ success: false, error: data.message || 'Lead rejected by Circular', upstream: data });
    }

    return res.status(200).json({
      success: true,
      leadId: data?.lead_id || null,
      conversion: data?.conversion || null,
      lead
    });
  } catch (error) {
    console.error('Circular leads error:', error);
    return res.status(502).json({ success: false, error: 'Não foi possível registrar o lead.' });
  }
}
