import { callAppsScript, requireInternalKey } from './_circular.js';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  if (!requireInternalKey(req, res)) return;

  try {
    const body = req.method === 'POST'
      ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}))
      : {};
    const data = await callAppsScript({ action: 'matches', ...body });
    return res.status(200).json({ success: true, matches: data?.matches || data || [] });
  } catch (error) {
    console.error('Circular matches error:', error);
    return res.status(502).json({ success: false, error: 'Não foi possível calcular os matches.' });
  }
}
