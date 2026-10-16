// Optional test-host observation, run only inside run-demo's environment.
// Retain fixed diagnostics and request paths; never bodies, cookies or headers.
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (account !== 'b20c0ca9cab0c2b70e13d7cf724b89bd') throw Error('wrong-account');
const { project } = JSON.parse(readFileSync('deploy.json', 'utf8'));
const worker = `${project.split('/').at(-1)}-demo-test--demo`;
const base = `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${worker}/tails`;
const headers = { authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' };
const directory = 'demo-observation';
mkdirSync(directory, { recursive: true });
const row = value => appendFileSync(`${directory}/tail.jsonl`, JSON.stringify(value) + '\n');
async function open() {
  const response = await fetch(base, { method: 'POST', headers, body: '{}' });
  const result = await response.json();
  if (!response.ok || !result.success) throw Error(`tail-create-${response.status}`);
  return result.result;
}
let tail, socket, timer, stopping = false, fail;
const failure = new Promise((_, reject) => { fail = reject; });
async function connect() {
  tail = await open();
  socket = new WebSocket(tail.url, 'trace-v1');
  socket.binaryType = 'arraybuffer';
  const fields = ['event', 'correlation', 'at', 'elapsedMs', 'agent', 'network', 'error', 'status', 'heldId', 'releasedId'];
  socket.addEventListener('message', message => {
    try {
      const event = JSON.parse(typeof message.data === 'string' ? message.data : new TextDecoder().decode(message.data));
      const request = event.event?.request;
      const logs = (event.logs ?? []).flatMap(log => (log.message ?? []).flatMap(part => {
        try {
          const value = typeof part === 'string' ? JSON.parse(part) : part;
          return /^demo_[a-z_-]+$/.test(value?.event) ? [Object.fromEntries(fields.filter(key => value[key] !== undefined).map(key => [key, value[key]]))] : [];
        } catch { return []; }
      }));
      row({ at: new Date().toISOString(), ts: event.eventTimestamp, path: request?.url ? new URL(request.url).pathname : undefined, method: request?.method, status: event.event?.response?.status, outcome: event.outcome, logs });
    } catch { row({ at: new Date().toISOString(), event: 'parse-error' }); }
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(Error('tail-connect-failed')), { once: true });
  });
  socket.addEventListener('close', async event => {
    if (stopping) return;
    row({ at: new Date().toISOString(), event: 'tail-reconnecting', code: event.code });
    try {
      await fetch(`${base}/${tail.id}`, { method: 'DELETE', headers });
      await connect();
    } catch { fail(Error('tail-reconnect-failed')); }
  });
  socket.addEventListener('error', () => { if (!stopping) fail(Error('tail-error')); });
  row({ at: new Date().toISOString(), event: 'tail-ready', worker });
}
try {
  await connect();
  console.log('Test-host tail connected. Quiet-window artifact follows in 15 minutes.');
  await Promise.race([failure, new Promise(resolve => {
    timer = setTimeout(resolve, 25 * 60 * 1000);
    process.once('SIGTERM', resolve);
    process.once('SIGINT', resolve);
  })]);
} finally {
  stopping = true;
  clearTimeout(timer);
  socket?.close();
  if (!tail) throw Error('tail-not-created');
  const removed = await fetch(`${base}/${tail.id}`, { method: 'DELETE', headers });
  row({ at: new Date().toISOString(), event: 'tail-removed', status: removed.status });
  if (!removed.ok) throw Error(`tail-remove-${removed.status}`);
}
