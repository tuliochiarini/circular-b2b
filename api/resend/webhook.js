import { createHmac, timingSafeEqual } from 'node:crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_CLOCK_SKEW_SECONDS = 5 * 60;
const EMAIL_EVENT_PATTERN = /^email\./;

async function readRawBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Payload muito grande.');
      error.status = 413;
      throw error;
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString('utf8');
}

function getHeader(req, name) {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function decodeWebhookSecret(secret) {
  const encoded = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  return Buffer.from(encoded, 'base64');
}

function isFreshTimestamp(timestamp) {
  if (!/^\d+$/.test(timestamp || '')) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  return Number.isFinite(age) && age <= MAX_CLOCK_SKEW_SECONDS;
}

function verifySignature({ rawBody, id, timestamp, signature, secret }) {
  if (!id || !timestamp || !signature || !secret || !isFreshTimestamp(timestamp)) {
    return false;
  }

  const expected = createHmac('sha256', decodeWebhookSecret(secret))
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest();

  return signature
    .split(' ')
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith('v1,'))
    .some((entry) => {
      try {
        const actual = Buffer.from(entry.slice(3), 'base64');
        return actual.length === expected.length && timingSafeEqual(actual, expected);
      } catch {
        return false;
      }
    });
}

function normalizeEvent(event, svixId) {
  const data = event?.data || {};
  return {
    source: 'resend',
    svixId,
    eventType: event?.type || null,
    createdAt: event?.created_at || null,
    emailId: data.email_id || null,
    recipients: Array.isArray(data.to) ? data.to : [],
    subject: data.subject || null,
    tags: data.tags && typeof data.tags === 'object' ? data.tags : {},
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  if (!process.env.RESEND_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Webhook ainda não configurado.' });
  }

  try {
    const rawBody = await readRawBody(req);
    const svixId = getHeader(req, 'svix-id');
    const timestamp = getHeader(req, 'svix-timestamp');
    const signature = getHeader(req, 'svix-signature');

    if (!verifySignature({
      rawBody,
      id: svixId,
      timestamp,
      signature,
      secret: process.env.RESEND_WEBHOOK_SECRET,
    })) {
      return res.status(401).json({ error: 'Assinatura inválida.' });
    }

    const event = JSON.parse(rawBody);
    if (!EMAIL_EVENT_PATTERN.test(event?.type || '')) {
      return res.status(200).json({ received: true, ignored: true });
    }

    console.log(JSON.stringify({
      kind: 'resend_email_event',
      ...normalizeEvent(event, svixId),
    }));

    return res.status(200).json({ received: true, eventId: svixId });
  } catch (error) {
    const status = Number(error?.status) || (error instanceof SyntaxError ? 400 : 500);
    console.error(JSON.stringify({
      kind: 'resend_webhook_error',
      status,
      message: error?.message || 'Erro desconhecido.',
    }));
    return res.status(status).json({
      error: status === 500 ? 'Falha ao processar webhook.' : error.message,
    });
  }
}
