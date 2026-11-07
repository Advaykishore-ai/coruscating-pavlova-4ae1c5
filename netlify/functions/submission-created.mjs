// ADVY automatic emails. Netlify runs this the moment any website form is submitted:
//  - an order or custom order: the customer gets a "thank you, your order is confirmed" email (if they gave an email),
//    and you get an instant "new order" alert with all the details;
//  - an Inner Circle signup: the new member gets a welcome email, and you get an alert.
// Emails are sent from your Gmail account. Set these in Netlify (Site configuration > Environment variables):
//   GMAIL_USER          the Gmail address to send from (optional; already set to advy.perfumes@gmail.com)
//   GMAIL_APP_PASSWORD  a Google "App password" for that account (16 letters), not your normal password
//   OWNER_EMAIL         where your alerts go (optional; defaults to GMAIL_USER; several allowed, comma separated)
//   ANTHROPIC_API_KEY   optional: lets the AI write a short personal opening line for each customer
import tls from 'node:tls';
import net from 'node:net';

const env = k => (globalThis.Netlify && Netlify.env.get(k)) || process.env[k] || '';
const SITE = 'https://advy-perfumes.com', IG = 'https://www.instagram.com/Advy_fragrances/';
const PRICE = { bottle: 75, sample: 12 };

/* ---------------- entry point ---------------- */
export default async (req) => {
  let body = {}; try { body = await req.json(); } catch { return new Response('bad request', { status: 400 }); }
  const p = body.payload || body;
  const form = p.form_name || (p.data && p.data['form-name']) || '';
  const d = p.data || {};
  if (d['bot-field']) return new Response('ignored');                 // spam trap
  const user = env('GMAIL_USER') || 'advy.perfumes@gmail.com', pass = env('GMAIL_APP_PASSWORD').replace(/\s+/g, '');
  if (!pass) { console.error('GMAIL_APP_PASSWORD not set'); return new Response('mail not configured', { status: 200 }); }
  const owner = (env('OWNER_EMAIL') || user).split(',').map(s => s.trim()).filter(Boolean);

  const jobs = [];
  try {
    if (form === 'order' || form === 'custom-order') {
      const o = describeOrder(form, d, p.created_at);
      if (validEmail(d.email)) {
        const opener = await personalLine(o);
        jobs.push({ to: [d.email.trim()], subject: `Your ADVY order ${o.ref} is confirmed`, ...customerOrderEmail(o, opener), replyTo: user });
      }
      jobs.push({ to: owner, subject: `New ${o.kind === 'custom' ? 'custom blend' : 'order'} ${o.ref} · ${o.name} · AED ${o.total}`, ...ownerOrderEmail(o), replyTo: validEmail(d.email) ? d.email.trim() : user });
    } else if (form === 'inner-circle') {
      if (validEmail(d.email)) jobs.push({ to: [d.email.trim()], subject: 'Welcome to the ADVY Inner Circle', ...welcomeEmail(), replyTo: user });
      jobs.push({ to: owner, subject: `New Inner Circle member · ${d.email || 'no email'}`, ...ownerSignupEmail(d), replyTo: user });
    } else {
      jobs.push({ to: owner, subject: `New website form: ${form || 'unknown'}`, ...plain('A form was submitted on advy-perfumes.com.\n\n' + Object.entries(d).map(([k, v]) => `${k}: ${v}`).join('\n')) });
    }
    await sendAll(user, pass, jobs.map(j => ({ from: `ADVY Perfumes <${user}>`, ...j })));
    return new Response('sent ' + jobs.length);
  } catch (e) {
    console.error('email failed', e && e.message);
    return new Response('email failed', { status: 200 });            // never block the customer's submission
  }
};

/* ---------------- order details ---------------- */
function describeOrder(form, d, at) {
  const kind = form === 'custom-order' ? 'custom' : 'shop';
  let lines = [], total = 0;
  if (kind === 'shop') {
    lines = String(d.items || '').split('\n').map(s => s.trim()).filter(l => l && !/^Total:/i.test(l));
    const t = String(d.items || '').match(/Total:\s*AED\s*(\d+)/i);
    total = t ? +t[1] : lines.reduce((a, l) => { const m = l.match(/AED\s*(\d+)\s*$/); return a + (m ? +m[1] : 0); }, 0);
  } else {
    const size = d.size || '50 ml bottle';
    total = /sample/i.test(size) ? PRICE.sample : PRICE.bottle;
    lines = String(d.blend || '').split('\n').filter(l => /^(Top|Heart|Base) notes:/i.test(l));
    lines.unshift(`${d['blend-name'] ? '"' + d['blend-name'] + '" · ' : ''}${size} · AED ${total}`);
  }
  return { kind, ref: d.reference || 'ADVY-' + Date.now().toString(36).toUpperCase().slice(-6), name: (d.name || 'there').trim(), first: (d.name || '').trim().split(/\s+/)[0] || 'there',
    country: d.country || '', email: d.email || '', instagram: d.instagram || d.contact || '', message: d.message || '', lines, total, at: at || new Date().toISOString() };
}

/* ---------------- the AI's personal line (optional, falls back gracefully) ---------------- */
async function personalLine(o) {
  const fallback = o.kind === 'custom' ? `Your own blend is in our hands now, and we can't wait to bring it to life for you.` : `We're so glad you chose ADVY, and we can't wait for you to wear it.`;
  const key = env('ANTHROPIC_API_KEY'); if (!key) return fallback;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: AbortSignal.timeout(6000),
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 120,
        system: 'You write one or two short, warm, elegant sentences to open a thank-you email from ADVY, a family perfume house. Mention something specific about what they ordered or wrote. No greeting, no sign-off, no prices, no dates, no promises about delivery, no emojis. Plain text only.',
        messages: [{ role: 'user', content: `Customer first name: ${o.first}\nOrder type: ${o.kind === 'custom' ? 'a custom blend they composed themselves' : 'perfumes from the collection'}\nOrder: ${o.lines.join('; ')}\nTheir note: ${o.message || '(none)'}` }] })
    });
    if (!r.ok) return fallback;
    const j = await r.json(); const t = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join(' ').replace(/\s+/g, ' ').trim();
    return t && t.length < 400 ? t : fallback;
  } catch { return fallback; }
}

/* ---------------- email content ---------------- */
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
const plain = text => ({ text, html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${esc(text)}</pre>` });
function frame(title, inner) {
  return `<!doctype html><html><body style="margin:0;background:#0d0b0a;padding:24px 12px;font-family:Georgia,'Times New Roman',serif;color:#efe8dc">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#15110f;border:1px solid #2b2521">
<tr><td style="padding:30px 32px 8px;text-align:center"><div style="font-size:26px;letter-spacing:10px;color:#e9d3a4">ADVY</div>
<div style="font-family:Arial,sans-serif;font-size:10px;letter-spacing:4px;color:#8f877b;margin-top:6px">PERFUMES</div></td></tr>
<tr><td style="padding:14px 32px 4px;text-align:center"><div style="font-size:26px;line-height:1.25;color:#efe8dc">${title}</div></td></tr>
<tr><td style="padding:10px 32px 30px;font-family:Arial,sans-serif;font-size:15px;line-height:1.65;color:#c9c1b4">${inner}</td></tr>
<tr><td style="padding:18px 32px 26px;border-top:1px solid #2b2521;text-align:center;font-family:Arial,sans-serif;font-size:12px;color:#8f877b">
ADVY Perfumes · <a href="${SITE}" style="color:#c8b08a">advy-perfumes.com</a> · <a href="${IG}" style="color:#c8b08a">@Advy_fragrances</a><br>advy.perfumes@gmail.com · Delivering in India and the UAE</td></tr>
</table></td></tr></table></body></html>`;
}
const rows = lines => lines.map(l => `<tr><td style="padding:8px 0;border-bottom:1px solid #241f1b;color:#efe8dc">${esc(l)}</td></tr>`).join('');

function customerOrderEmail(o, opener) {
  const what = o.kind === 'custom' ? 'your custom blend' : 'your perfume';
  const text = `Dear ${o.first},

Thank you for ordering at ADVY Perfumes. Your order ${o.ref} is confirmed.

${opener}

Your order:
${o.lines.map(l => '- ' + l).join('\n')}
Total: AED ${o.total} (plus delivery)
${o.message ? '\nYour note: ' + o.message + '\n' : ''}
What happens next: we'll be in touch to confirm delivery to ${o.country || 'you'}, and once ${what} is ready we will email you or message you on Instagram.

If anything needs changing, simply reply to this email or message us on Instagram at @Advy_fragrances.

With love,
ADVY Perfumes
${SITE}`;
  const html = frame(`Thank you for your order, ${esc(o.first)}`, `
<p style="margin:0 0 14px">Thank you for ordering at ADVY Perfumes. Your order <b style="color:#e9d3a4">${esc(o.ref)}</b> is confirmed.</p>
<p style="margin:0 0 18px;font-family:Georgia,serif;font-style:italic;font-size:17px;color:#efe8dc">${esc(opener)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px">${rows(o.lines)}
<tr><td style="padding:12px 0 0;text-align:right;color:#e9d3a4;font-size:16px">Total AED ${o.total} <span style="color:#8f877b;font-size:12px">plus delivery</span></td></tr></table>
${o.message ? `<p style="margin:14px 0 0;color:#8f877b">Your note: “${esc(o.message)}”</p>` : ''}
<p style="margin:20px 0 0">We'll be in touch to confirm delivery${o.country ? ' to ' + esc(o.country) : ''}, and <b style="color:#efe8dc">once ${what} is ready we will email you or message you on Instagram.</b></p>
<p style="margin:14px 0 0">If anything needs changing, simply reply to this email or message us at <a href="${IG}" style="color:#c8b08a">@Advy_fragrances</a>.</p>
<p style="margin:22px 0 0;font-family:Georgia,serif;font-size:17px;color:#efe8dc">With love,<br>ADVY Perfumes</p>`);
  return { text, html };
}
function welcomeEmail() {
  const text = `Welcome to the ADVY Inner Circle.

Thank you for joining us. You'll be the first to hear about new fragrances, limited editions and offers for our circle.

While you wait, every ADVY fragrance comes as a 20 ml sample for AED 12, the easiest way to find the one that feels like yours: ${SITE}

With love,
ADVY Perfumes`;
  const html = frame('Welcome to the Inner Circle', `
<p style="margin:0 0 14px">Thank you for joining us. You'll be the first to hear about new fragrances, limited editions and offers for our circle.</p>
<p style="margin:0 0 20px">While you wait, every ADVY fragrance comes as a 20 ml sample for AED 12, the easiest way to find the one that feels like yours.</p>
<p style="margin:0;text-align:center"><a href="${SITE}" style="display:inline-block;background:#c8b08a;color:#16120c;text-decoration:none;padding:13px 24px;font-size:12px;letter-spacing:3px">DISCOVER THE COLLECTION</a></p>
<p style="margin:24px 0 0;font-family:Georgia,serif;font-size:17px;color:#efe8dc">With love,<br>ADVY Perfumes</p>`);
  return { text, html };
}
function ownerOrderEmail(o) {
  const contact = [o.email && 'Email: ' + o.email, o.instagram && 'Instagram: ' + o.instagram].filter(Boolean).join('\n');
  const text = `New ${o.kind === 'custom' ? 'CUSTOM BLEND' : 'ORDER'} ${o.ref}

${o.name} · ${o.country}
${contact}

${o.lines.join('\n')}
Total: AED ${o.total} (plus delivery)
${o.message ? '\nNote: ' + o.message : ''}

${validEmail(o.email) ? 'A confirmation email has been sent to the customer.' : 'No email given: reply to them on Instagram.'}
Received ${new Date(o.at).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })} (UAE time)`;
  const html = frame(`New ${o.kind === 'custom' ? 'custom blend' : 'order'} · AED ${o.total}`, `
<p style="margin:0 0 4px;color:#e9d3a4;letter-spacing:2px">${esc(o.ref)}</p>
<p style="margin:0 0 14px;font-size:18px;color:#efe8dc">${esc(o.name)} · ${esc(o.country)}</p>
<p style="margin:0 0 16px">${o.email ? `Email: <a href="mailto:${esc(o.email)}" style="color:#c8b08a">${esc(o.email)}</a><br>` : ''}${o.instagram ? `Instagram: <b style="color:#efe8dc">${esc(o.instagram)}</b>` : ''}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows(o.lines)}<tr><td style="padding:12px 0 0;text-align:right;color:#e9d3a4">Total AED ${o.total} <span style="color:#8f877b;font-size:12px">plus delivery</span></td></tr></table>
${o.message ? `<p style="margin:14px 0 0">Note: “${esc(o.message)}”</p>` : ''}
<p style="margin:18px 0 0;color:#8f877b">${validEmail(o.email) ? 'A confirmation email has been sent to the customer.' : 'No email given: reply to them on Instagram.'}<br>Received ${esc(new Date(o.at).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' }))} (UAE time)</p>`);
  return { text, html };
}
function ownerSignupEmail(d) {
  const text = `New Inner Circle member: ${d.email || '(no email)'}\n\nA welcome email has been sent to them.`;
  return { text, html: frame('New Inner Circle member', `<p style="margin:0;text-align:center;font-size:18px;color:#efe8dc">${esc(d.email || '(no email)')}</p><p style="margin:14px 0 0;text-align:center;color:#8f877b">A welcome email has been sent to them.</p>`) };
}

/* ---------------- sending through Gmail (SMTP, no extra packages) ---------------- */
const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const wrap = s => s.replace(/.{1,76}/g, '$&\r\n');
const encWord = s => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;
function message(m) {
  const id = Math.random().toString(36).slice(2), host = (m.from.match(/@([^>]+)>?$/) || [, 'gmail.com'])[1];
  const fromName = m.from.replace(/\s*<.*$/, ''), fromAddr = (m.from.match(/<([^>]+)>/) || [, m.from])[1];
  return [`From: ${encWord(fromName)} <${fromAddr}>`, `To: ${m.to.join(', ')}`, m.replyTo ? `Reply-To: ${m.replyTo}` : '', `Subject: ${encWord(m.subject)}`,
    `Date: ${new Date().toUTCString()}`, `Message-ID: <${Date.now()}.${id}@${host}>`, 'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="b${id}"`, '',
    `--b${id}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(b64(m.text)),
    `--b${id}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(b64(m.html)), `--b${id}--`, ''].filter((l, i) => l !== '' || i > 4).join('\r\n');
}
async function sendAll(user, pass, mails) {
  const host = env('SMTP_HOST') || 'smtp.gmail.com', port = +(env('SMTP_PORT') || 465), plainConn = env('SMTP_PLAIN') === '1';   // the last two are only for testing
  const sock = plainConn ? net.connect(port, host) : tls.connect({ host, port, servername: host });
  sock.setTimeout(15000, () => sock.destroy(new Error('SMTP timeout')));
  let buf = '', waiting = null;
  const take = () => { const lines = buf.split('\r\n'); for (let i = 0; i < lines.length - 1; i++) { if (/^\d{3} /.test(lines[i])) { const res = lines.slice(0, i + 1).join('\n'); buf = lines.slice(i + 1).join('\r\n'); const w = waiting; waiting = null; w.res(res); return; } } };
  sock.on('data', c => { buf += c.toString('utf8'); if (waiting) take(); });
  sock.on('error', e => { if (waiting) { const w = waiting; waiting = null; w.rej(e); } });
  const read = () => new Promise((res, rej) => { waiting = { res, rej }; take(); });
  const cmd = async (line, ok) => { if (line != null) sock.write(line + '\r\n'); const r = await read(); if (!ok.test(r)) throw new Error(`SMTP said: ${r.split('\n').pop()} (after ${String(line).split(' ')[0]})`); return r; };
  try {
    await cmd(null, /^220/);
    await cmd('EHLO advy-perfumes.com', /^250/m);
    await cmd('AUTH LOGIN', /^334/); await cmd(b64(user), /^334/); await cmd(b64(pass), /^235/);
    for (const m of mails) {
      if (!m.to.length) continue;
      await cmd(`MAIL FROM:<${user}>`, /^250/);
      for (const t of m.to) await cmd(`RCPT TO:<${t}>`, /^25[01]/);
      await cmd('DATA', /^354/);
      await cmd(message(m).replace(/\r\n\./g, '\r\n..') + '\r\n.', /^250/);
    }
    sock.write('QUIT\r\n');
  } finally { setTimeout(() => sock.destroy(), 200); }
}


