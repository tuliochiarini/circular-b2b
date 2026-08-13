const DEFAULT_UPSTREAM = 'https://script.google.com/macros/s/AKfycbyeoQwrWQD4TmxZNpIIZVU5X3jWZXj0cPW3E7J6sQQTtHr9wtCZ9cdtMx4xjAsbxyFy/exec';

export function getUpstream() {
  return process.env.CIRCULAR_APPS_SCRIPT_URL || DEFAULT_UPSTREAM;
}

export function requireInternalKey(req, res) {
  const expected = process.env.CIRCULAR_INTERNAL_API_KEY;
  if (!expected) {
    res.status(503).json({ success: false, error: 'Internal API is not configured' });
    return false;
  }
  const supplied = req.headers['x-circular-key'];
  if (supplied !== expected) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return false;
  }
  return true;
}

export async function callAppsScript(payload) {
  const response = await fetch(getUpstream(), {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8', Accept: 'application/json,text/plain,*/*' },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = { raw: text }; }
  if (!response.ok) {
    const error = new Error('Circular upstream request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}
