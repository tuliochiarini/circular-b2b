import { createHash } from 'node:crypto';
import { requireInternalKey } from '../_circular.js';

const MAX_MESSAGES = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_FROM = 'Circular B2B <comercial@circularb2b.eco.br>';
const DEFAULT_REPLY_TO = 'comercial.circularb2b@gmail.com';

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'Informe pelo menos uma mensagem.';
  }
  if (messages.length > MAX_MESSAGES) {
    return `O limite por requisição é ${MAX_MESSAGES} mensagens.`;
  }

  const seen = new Set();
  for (const message of messages) {
    if (!EMAIL_PATTERN.test(message?.to || '')) return 'Há um e-mail de destino inválido.';
    if (!message?.subject?.trim()) return 'Todas as mensagens precisam de assunto.';
    if (!message?.text?.trim()) return 'Todas as mensagens precisam de conteúdo em texto.';
    if (!message?.externalId?.trim()) return 'Todas as mensagens precisam de externalId.';

    const normalizedEmail = message.to.trim().toLowerCase();
    if (seen.has(normalizedEmail)) return 'Há destinatários duplicados na mesma requisição.';
    seen.add(normalizedEmail);
  }
  return null;
}

function withOptOut(text) {
  return `${text.trim()}\n\nSe não quiser receber novos contatos da Circular B2B, responda a este e-mail com “remover”.`;
}

async function sendMessage(message, campaignId) {
  const idempotencyKey = createHash('sha256')
    .update(`circular:${campaignId}:${message.externalId.trim()}`)
    .digest('hex');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || DEFAULT_FROM,
      reply_to: process.env.RESEND_REPLY_TO || DEFAULT_REPLY_TO,
      to: [message.to.trim()],
      subject: message.subject.trim(),
      text: withOptOut(message.text),
      tags: [
        { name: 'campaign', value: campaignId },
        { name: 'lead', value: message.externalId.trim().replace(/[^a-z0-9_-]/gi, '_').slice(0, 256) },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  return response.ok
    ? { externalId: message.externalId, status: 'sent', resendId: payload.id }
    : { externalId: message.externalId, status: 'failed', error: payload.message || `HTTP ${response.status}` };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ error: 'Integração ainda não configurada.' });
  }
  if (!requireInternalKey(req, res)) return;

  const { campaignId, messages, dryRun = false } = req.body || {};
  if (!/^[a-z0-9_-]{3,50}$/i.test(campaignId || '')) {
    return res.status(400).json({ error: 'campaignId inválido.' });
  }

  const validationError = validateMessages(messages);
  if (validationError) return res.status(400).json({ error: validationError });

  if (dryRun) {
    return res.status(200).json({ dryRun: true, campaignId, count: messages.length });
  }

  const results = [];
  for (const message of messages) {
    results.push(await sendMessage(message, campaignId));
  }

  const failed = results.filter((result) => result.status === 'failed').length;
  return res.status(failed ? 207 : 200).json({
    campaignId,
    sent: results.length - failed,
    failed,
    results,
  });
}
