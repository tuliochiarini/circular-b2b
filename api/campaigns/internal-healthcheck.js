export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ success: false, error: 'Resend not configured' });
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'circular-resend-production-healthcheck-v1'
    },
    body: JSON.stringify({
      from: 'Circular B2B <comercial@circularb2b.eco.br>',
      reply_to: 'comercial.circularb2b@gmail.com',
      to: ['comercial.circularb2b@gmail.com'],
      subject: 'Circular B2B — integração de e-mail validada',
      text: 'Teste interno concluído. O domínio circularb2b.eco.br e a integração segura com o Resend estão operacionais.'
    })
  });

  const payload = await response.json().catch(() => ({}));
  return res.status(response.ok ? 200 : response.status).json({
    success: response.ok,
    resendId: payload.id || null,
    error: response.ok ? null : (payload.message || 'Resend request failed')
  });
}
