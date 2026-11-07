// ADVY chat assistant: the website sends the conversation here, this asks Claude and sends the reply back.
// The API key stays on Netlify (Site configuration > Environment variables > ANTHROPIC_API_KEY), never in the page.
import { SYSTEM_PROMPT } from './prompt.mjs';

const MODEL = 'claude-haiku-5-5';        // fast and inexpensive; change here if you ever want a different model
const MAX_TURNS = 12;                    // how much of the conversation is sent each time
const MAX_CHARS = 800;                   // longest visitor message accepted
const LIMIT = 30, WINDOW_MS = 10 * 60 * 1000;   // at most 30 messages per visitor every 10 minutes
const hits = new Map();

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default async (req, context) => {
  const key = (globalThis.Netlify && Netlify.env.get('ANTHROPIC_API_KEY')) || process.env.ANTHROPIC_API_KEY;
  if (req.method === 'GET') return json({ ready: !!key });          // the site asks this before showing the chat button
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!key) return json({ error: 'not_configured' }, 503);

  // only answer requests coming from the ADVY website
  const origin = req.headers.get('origin') || '';
  if (origin && !/^https:\/\/([a-z0-9-]+\.)*(advy-perfumes\.com|netlify\.app)$|^http:\/\/localhost(:\d+)?$/.test(origin)) return json({ error: 'origin' }, 403);

  // gentle per-visitor limit
  const ip = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || 'anon', now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (list.length >= LIMIT) return json({ error: 'rate_limited' }, 429);
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();

  let body; try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }
  let msgs = Array.isArray(body && body.messages) ? body.messages : [];
  msgs = msgs.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, m.role === 'user' ? MAX_CHARS : 2000) }))
    .slice(-MAX_TURNS);
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  // merge back-to-back turns from the same side
  msgs = msgs.reduce((a, m) => { const l = a[a.length - 1]; if (l && l.role === m.role) l.content += '\n\n' + m.content; else a.push({ ...m }); return a; }, []);
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return json({ error: 'bad_request' }, 400);

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 500, system: SYSTEM_PROMPT, messages: msgs })
    });
    if (!r.ok) { console.error('anthropic', r.status, (await r.text()).slice(0, 300)); return json({ error: 'upstream' }, 502); }
    const data = await r.json();
    const reply = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
    return reply ? json({ reply }) : json({ error: 'empty' }, 502);
  } catch (e) {
    console.error(e); return json({ error: 'upstream' }, 502);
  }
};

export const config = { path: '/api/chat' };
