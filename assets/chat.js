/* ADVY chat assistant: the gold button in the corner and its chat window.
   On the live site it talks to /api/chat (a Netlify Function that holds the AI key).
   Inside a Claude preview it asks Claude directly, so the assistant can be tried before going live. */
(function(){
  if (window.__advyChat) return; window.__advyChat = true;
  const IG = 'https://www.instagram.com/Advy_fragrances/';
  // the ADVY Google script (free Gemini AI) that answers the chat
  const CHAT_URL = 'https://script.google.com/macros/s/AKfycbybSk-12o7f0VyzAHBuXj86wBHWHRreHdZzWpcg_bGD1IRF_z2rn2-UU_ZxuT_RDYGr/exec';
  const GREETING = "Welcome to ADVY. I can help you find a fragrance you'll love, tell you about our notes, remakes and samples, or explain how ordering works. What are you looking for today?";
  const SUGGEST = ['Help me choose a scent', 'Something for evenings', 'What are your remakes?', 'How do I order?'];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const css = `
  .ac-btn{position:fixed;--ac-base:64px;right:max(18px,env(safe-area-inset-right));bottom:calc(max(18px,env(safe-area-inset-bottom)) + var(--ac-lift,0px) + var(--ac-base,64px));z-index:45;display:flex;align-items:center;gap:10px;
    height:52px;padding:0 20px 0 16px;border:1px solid #c8b08a;border-radius:26px;cursor:pointer;color:#16120c;font:500 11px/1 Jost,"Helvetica Neue",Arial,sans-serif;letter-spacing:.24em;text-transform:uppercase;
    background:linear-gradient(100deg,#b8995f,#e9d3a4 50%,#b8995f);background-size:200% 100%;box-shadow:0 10px 30px rgba(0,0,0,.45),0 0 22px rgba(232,196,120,.18);
    transition:transform .2s cubic-bezier(.23,1,.32,1),background-position .6s ease,opacity .3s ease}
  .ac-btn:hover{background-position:100% 0}.ac-btn:active{transform:scale(.96)}
  .ac-btn svg{width:20px;height:20px;fill:none;stroke:#16120c;stroke-width:1.4}
  .ac-btn.hide{opacity:0;pointer-events:none;transform:translateY(10px)}
  .ac-pan{padding:0;margin:0;box-sizing:border-box;position:fixed;right:max(18px,env(safe-area-inset-right));bottom:calc(max(18px,env(safe-area-inset-bottom)) + var(--ac-lift,0px) + var(--ac-base,64px));z-index:46;width:min(400px,calc(100vw - 36px));height:min(620px,calc(100vh - 170px));
    display:flex;flex-direction:column;background:#100e0c;border:1px solid #2a2622;box-shadow:0 30px 80px rgba(0,0,0,.6);color:#efe8dc;font:300 15px/1.6 Jost,"Helvetica Neue",Arial,sans-serif;
    opacity:0;visibility:hidden;transform:translateY(14px) scale(.98);transform-origin:100% 100%;transition:opacity .3s ease,transform .35s cubic-bezier(.23,1,.32,1),visibility 0s linear .35s}
  .ac-pan.on{opacity:1;visibility:visible;transform:none;transition:opacity .3s ease,transform .35s cubic-bezier(.23,1,.32,1)}
  .ac-hd{display:flex;align-items:center;gap:12px;padding:16px 16px 14px 20px;border-bottom:1px solid #1f1c19;background:linear-gradient(180deg,#17130f,#100e0c)}
  .ac-hd .t{font-family:"Cormorant Garamond",Georgia,serif;font-size:22px;font-weight:500;line-height:1.1}
  .ac-hd .s{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#c8b08a;display:flex;align-items:center;gap:7px;margin-top:3px}
  .ac-hd .s::before{content:"";width:6px;height:6px;border-radius:50%;background:#8fc98a;box-shadow:0 0 8px #8fc98a}
  .ac-x{margin-left:auto;width:36px;height:36px;border:1px solid #2a2622;background:none;color:#c9c1b4;cursor:pointer;display:grid;place-items:center}
  .ac-x:hover{border-color:#c8b08a;color:#c8b08a}.ac-x svg{width:12px;height:12px;stroke:currentColor;stroke-width:1.6}
  .ac-log{flex:1;overflow-y:auto;padding:18px 16px 8px;display:flex;flex-direction:column;gap:12px;overscroll-behavior:contain}
  .ac-m{max-width:86%;padding:11px 14px;white-space:pre-wrap;word-wrap:break-word;animation:acIn .35s cubic-bezier(.23,1,.32,1)}
  @keyframes acIn{from{opacity:0;transform:translateY(6px)}}
  .ac-m.b{align-self:flex-start;background:#191613;border:1px solid #241f1b;border-radius:2px 14px 14px 14px}
  .ac-m.u{align-self:flex-end;background:#c8b08a;color:#16120c;border-radius:14px 2px 14px 14px;font-weight:400}
  .ac-m a{color:#e3c98f}.ac-m.u a{color:#16120c}
  .ac-m.err{border-color:#4a2a2a;color:#d9b3a8}
  .ac-dots{display:flex;gap:5px;padding:4px 2px}.ac-dots i{width:6px;height:6px;border-radius:50%;background:#c8b08a;opacity:.3;animation:acDot 1.2s infinite}
  .ac-dots i:nth-child(2){animation-delay:.15s}.ac-dots i:nth-child(3){animation-delay:.3s}
  @keyframes acDot{30%{opacity:1;transform:translateY(-3px)}}
  .ac-sug{display:flex;flex-wrap:wrap;gap:8px;padding:2px 16px 12px}
  .ac-sug button{border:1px solid #2a2622;background:#141210;color:#c9c1b4;font:inherit;font-size:13px;padding:7px 12px;border-radius:16px;cursor:pointer}
  .ac-sug button:hover{border-color:#c8b08a;color:#efe8dc}
  .ac-f{display:flex;gap:8px;padding:12px;border-top:1px solid #1f1c19}
  .ac-f textarea{flex:1;resize:none;overflow:hidden;scrollbar-width:none;height:44px;max-height:120px;background:#141210;border:1px solid #2a2622;color:#efe8dc;font:inherit;font-size:15px;padding:10px 12px;border-radius:0}
  .ac-f textarea:focus{outline:none;border-color:#c8b08a}
  .ac-f button{width:46px;flex:none;border:0;background:#c8b08a;color:#16120c;cursor:pointer;display:grid;place-items:center}
  .ac-f button:disabled{opacity:.4;cursor:default}.ac-f button svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.6}
  .ac-ft{font-size:10px;letter-spacing:.12em;color:#6f685e;text-align:center;padding:0 12px 10px}
  @media (max-width:560px){.ac-pan{right:0;left:0;bottom:0;width:auto;height:calc(100dvh - 60px);border-left:0;border-right:0;border-bottom:0}
    .ac-btn{height:48px;padding:0 16px 0 14px}.ac-btn span{display:none}.ac-btn{width:52px;height:52px;padding:0;justify-content:center}}
  @media (prefers-reduced-motion:reduce){.ac-pan,.ac-btn,.ac-m{transition:none;animation:none}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const btn = document.createElement('button'); btn.className = 'ac-btn'; btn.type = 'button'; btn.setAttribute('aria-label', 'Chat with ADVY');
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg><span>Ask ADVY</span>';
  const pan = document.createElement('div'); pan.className = 'ac-pan'; pan.setAttribute('role', 'dialog'); pan.setAttribute('aria-label', 'ADVY assistant'); pan.setAttribute('aria-hidden', 'true');
  pan.innerHTML = `<div class="ac-hd"><div><div class="t">ADVY Assistant</div><div class="s">Here to help</div></div>
      <button class="ac-x" type="button" aria-label="Close chat"><svg viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11"/></svg></button></div>
    <div class="ac-log" role="log" aria-live="polite"></div>
    <div class="ac-sug"></div>
    <form class="ac-f"><textarea rows="1" placeholder="Ask about a scent, notes, samples…" aria-label="Your message" maxlength="800"></textarea>
      <button type="submit" aria-label="Send"><svg viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6"/></svg></button></form>
    <div class="ac-ft">An AI assistant · it can make mistakes · orders via <a href="${IG}" target="_blank" rel="noopener" style="color:inherit">Instagram</a></div>`;
  document.body.append(btn, pan);
  // only show the chat once it can answer: inside a Claude preview, or on the live site once the AI key is set in Netlify
  btn.style.display = 'none';
  (window.claude ? Promise.resolve(true) : (/^https:/.test(CHAT_URL) ? fetch(CHAT_URL + '?chat=1').then(r => r.ok ? r.json() : {}).then(j => !!j.ready).catch(() => false) : Promise.resolve(false)))
    .then(ok => { if (ok) btn.style.display = ''; });
  // on the homepage, wait until the opening animation has finished
  if (document.getElementById('curtain')){ btn.classList.add('hide');
    const mo = new MutationObserver(() => { if (!document.getElementById('curtain')){ mo.disconnect(); btn.classList.remove('hide'); } }); mo.observe(document.body, {childList:true}); }
  const log = pan.querySelector('.ac-log'), sug = pan.querySelector('.ac-sug'), form = pan.querySelector('form'), ta = form.querySelector('textarea'), send = form.querySelector('button');

  // on the custom order page on phones, sit above the blend bar
  const peek = document.getElementById('peek');
  const lift = () => { const v = peek && !peek.classList.contains('hide') && !peek.classList.contains('none') && innerWidth <= 900 ? 74 : 0; document.documentElement.style.setProperty('--ac-lift', v + 'px'); };
  if (peek){ new MutationObserver(lift).observe(peek, {attributes:true, attributeFilter:['class']}); addEventListener('resize', lift); lift(); }

  // conversation, kept for this browser tab
  let turns = []; try { turns = JSON.parse(sessionStorage.getItem('advyChat') || '[]'); } catch (e) {}
  const keep = () => { try { sessionStorage.setItem('advyChat', JSON.stringify(turns.slice(-20))); } catch (e) {} };

  const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const linkify = s => esc(s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#+\s*/gm, ''))
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[^\w/])@Advy_fragrances\b/gi, `$1<a href="${IG}" target="_blank" rel="noopener">@Advy_fragrances</a>`)
    .replace(/\b(Custom Order page|custom-order\.html)\b/gi, '<a href="custom-order.html">$1</a>');
  function bubble(role, text, cls){ const d = document.createElement('div'); d.className = 'ac-m ' + (role === 'user' ? 'u' : 'b') + (cls ? ' ' + cls : '');
    if (text != null) d.innerHTML = linkify(text); log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
  function renderAll(){ log.innerHTML = ''; bubble('assistant', GREETING); turns.forEach(t => bubble(t.role, t.content));
    sug.innerHTML = ''; if (!turns.length) SUGGEST.forEach(q => { const b = document.createElement('button'); b.type = 'button'; b.textContent = q; b.onclick = () => ask(q); sug.appendChild(b); }); }

  // where the answer comes from: Claude inside a preview, otherwise the site's own /api/chat
  const sampleP = (window.claude && typeof window.claude.use === 'function') ? window.claude.use('sample').catch(() => null) : Promise.resolve(null);
  let promptP = null;
  const SCRIPT_SRC = document.currentScript && document.currentScript.src;
  async function answer(history, onText){
    const sample = window.claude ? await sampleP : null;
    if (sample){
      if (!promptP) promptP = new Promise(res => { if (window.ADVY_CHAT_PROMPT) return res(window.ADVY_CHAT_PROMPT);
        const s = document.createElement('script'); s.src = (SCRIPT_SRC || 'assets/chat.js').replace(/chat\.js(\?.*)?$/, 'chat-prompt.js');
        s.onload = () => res(window.ADVY_CHAT_PROMPT || ''); s.onerror = () => res(''); document.head.appendChild(s); });
      const rules = await promptP;
      const { text } = await sample([{role:'user', content: rules + '\n\nThe conversation with the visitor follows. Reply as the assistant to their latest message.'}, ...history.slice(-12)],
        { modelTier:'quick', cache:false, onText: ({text}) => onText(text) });
      return text;
    }
    const r = await fetch(CHAT_URL, {method:'POST', body: JSON.stringify({type:'chat', messages: history.slice(-12)})});   // plain text body: no CORS preflight
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.reply) throw {code: j.error || ('http_' + r.status)};
    return j.reply;
  }

  let busy = false;
  async function ask(q){
    q = String(q || '').trim(); if (!q || busy) return;
    busy = true; send.disabled = true; sug.innerHTML = ''; ta.value = ''; ta.style.height = '';
    turns.push({role:'user', content:q.slice(0, 800)}); bubble('user', q); keep();
    const b = bubble('assistant', null); b.innerHTML = '<div class="ac-dots"><i></i><i></i><i></i></div>';
    try {
      const text = await answer(turns, t => { b.innerHTML = linkify(t); log.scrollTop = log.scrollHeight; });
      b.innerHTML = linkify(text); turns.push({role:'assistant', content:text}); keep();
    } catch (e) {
      const code = e && e.code;
      b.classList.add('err');
      b.innerHTML = linkify(code === 'rate_limited' || code === 'http_429' ? "You've sent a lot of messages in a short time. Please wait a few minutes, or message us on Instagram at @Advy_fragrances."
        : "Sorry, I can't answer right now. Please try again in a moment, or message us on Instagram at @Advy_fragrances.");
      turns.pop(); keep();
    }
    busy = false; send.disabled = false; log.scrollTop = log.scrollHeight;
    if (matchMedia('(hover:hover)').matches) ta.focus();
  }

  function open(v){ pan.classList.toggle('on', v); pan.setAttribute('aria-hidden', !v); btn.classList.toggle('hide', v);
    if (v){ if (!log.children.length) renderAll(); setTimeout(() => { log.scrollTop = log.scrollHeight; if (matchMedia('(hover:hover)').matches) ta.focus(); }, reduce ? 0 : 200); } else btn.focus(); }
  btn.addEventListener('click', () => open(true));
  pan.querySelector('.ac-x').addEventListener('click', () => open(false));
  addEventListener('keydown', e => { if (e.key === 'Escape' && pan.classList.contains('on')) open(false); });
  form.addEventListener('submit', e => { e.preventDefault(); ask(ta.value); });
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); ask(ta.value); } });
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
  // stop wheel/touch scrolling inside the chat from moving the page behind it
  log.addEventListener('wheel', e => e.stopPropagation(), {passive:true});
})();
