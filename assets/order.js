/* ADVY ordering: every "Order" button opens a sheet with two ways to order —
   on the website (sent to Netlify Forms as "order") or via Instagram. */
(function(){
  const sheet = document.getElementById('orderSheet'); if (!sheet) return;
  const form = document.getElementById('orderForm'), itemsEl = document.getElementById('osItems');
  const live = /(^|\.)advy-perfumes\.com$|\.netlify\.app$/.test(location.hostname);
  const SIG = (typeof FRAGRANCES !== 'undefined' ? FRAGRANCES : []).map(f => f.name);
  const REM = (typeof REMAKES !== 'undefined' ? REMAKES : []).map(r => r.name + ' (remake)');
  const SIZES = ['50 ml bottle', '20 ml sample'], PRICE = {'50 ml bottle':75, '20 ml sample':12};
  const norm = z => /sample/i.test(z || '') ? SIZES[1] : SIZES[0];
  let lines = [], last = null;

  const options = sel => `<option value="">Choose a perfume</option><optgroup label="Signature collection">${SIG.map(n => `<option${n === sel ? ' selected' : ''}>${n}</option>`).join('')}</optgroup>`
    + `<optgroup label="Remakes">${REM.map(n => `<option${n === sel ? ' selected' : ''}>${n}</option>`).join('')}</optgroup>`;
  function draw(){
    itemsEl.innerHTML = lines.map((l, i) => `<div class="os-line" data-i="${i}">
      <select aria-label="Perfume ${i + 1}">${options(l.p)}</select>
      <div class="os-seg" role="group" aria-label="Size">${SIZES.map(s => `<button type="button" data-size="${s}" aria-pressed="${l.s === s}">${s === SIZES[1] ? 'Sample · 12' : '50 ml · 75'}</button>`).join('')}</div>
      <div class="os-qty"><button type="button" data-q="-1" aria-label="One less">−</button><span aria-label="Quantity">${l.q}</span><button type="button" data-q="1" aria-label="One more">+</button></div>
      <button class="os-rm" type="button" aria-label="Remove" ${lines.length < 2 ? 'hidden' : ''}><svg viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11"/></svg></button></div>`).join('');
    document.getElementById('osAdd').hidden = lines.length >= 8;
    document.getElementById('osTotal').textContent = 'AED ' + total();
  }
  itemsEl.addEventListener('change', e => { const row = e.target.closest('.os-line'); if (row && e.target.tagName === 'SELECT'){ lines[+row.dataset.i].p = e.target.value; e.target.style.borderColor = ''; document.getElementById('osTotal').textContent = 'AED ' + total(); } });
  itemsEl.addEventListener('click', e => { const row = e.target.closest('.os-line'); if (!row) return; const l = lines[+row.dataset.i];
    const sz = e.target.closest('[data-size]'), q = e.target.closest('[data-q]');
    if (sz) l.s = sz.dataset.size; else if (q) l.q = Math.max(1, Math.min(10, l.q + +q.dataset.q)); else if (e.target.closest('.os-rm')) lines.splice(+row.dataset.i, 1); else return;
    draw(); });
  document.getElementById('osAdd').addEventListener('click', () => { lines.push({p:'', s:SIZES[0], q:1}); draw(); itemsEl.lastElementChild.querySelector('select').focus(); });

  function step(name){ sheet.querySelectorAll('[data-step]').forEach(s => s.hidden = s.dataset.step !== name);
    sheet.querySelector('.os-card').scrollTop = 0; const f = sheet.querySelector(`[data-step="${name}"] select, [data-step="${name}"] .os-way, [data-step="${name}"] .os-go`); if (f && matchMedia('(hover:hover)').matches) f.focus({preventScroll:true}); }
  function open(item, size){
    last = document.activeElement;
    if (!lines.length || item){ lines = [{p:item || '', s:norm(size), q:1}]; }
    const smp = norm(size) === SIZES[1];
    document.getElementById('osPick').textContent = item ? `You chose ${item.replace(' (remake)', '')}${smp ? ' as a 20 ml sample' : ''}. 50 ml bottles are AED 75 and 20 ml samples AED 12. We deliver in India and the UAE.`
      : smp ? '20 ml samples of every fragrance, AED 12 each. We deliver in India and the UAE.' : '50 ml bottles at AED 75 and 20 ml samples at AED 12, for every fragrance. We deliver in India and the UAE.';
    draw(); step('choose');
    sheet.classList.add('on'); sheet.setAttribute('aria-hidden', 'false'); document.body.classList.add('os-lock');
  }
  function close(){ sheet.classList.remove('on'); sheet.setAttribute('aria-hidden', 'true'); document.body.classList.remove('os-lock');
    if (!sheet.querySelector('[data-step="done"]').hidden){ lines = []; form.reset(); }
    if (last && last.focus) last.focus({preventScroll:true}); }
  window.advyOrder = {open, close};

  sheet.addEventListener('click', e => { if (e.target === sheet || e.target.closest('[data-os-close]')) close(); const g = e.target.closest('[data-os-go]'); if (g) step(g.dataset.osGo); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && sheet.classList.contains('on')) close(); });

  // every Order button on the page opens the sheet; a button inside a card orders that perfume
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-p]'); if (!a || a.hasAttribute('data-ig')) return;
    e.preventDefault(); e.stopPropagation();
    let item = a.dataset.item || '';
    if (!item){ const card = a.closest('.card, .rm-card, .res'); const h = card && card.querySelector('h3'); if (h) item = h.textContent.trim() + (card.classList.contains('rm-card') ? ' (remake)' : ''); }
    if (item && !SIG.includes(item) && !REM.includes(item)) item = REM.includes(item + ' (remake)') ? item + ' (remake)' : '';
    open(item, a.dataset.size || '');
  }, true);

  const total = () => lines.filter(l => l.p).reduce((a, l) => a + l.q*PRICE[l.s], 0);
  const summary = () => lines.filter(l => l.p).map(l => `${l.q} × ${l.p} · ${l.s} · AED ${l.q*PRICE[l.s]}`).join('\n') + `\nTotal: AED ${total()} (plus delivery)`;
  form.addEventListener('submit', async e => {
    e.preventDefault(); const st = document.getElementById('osStatus'); let bad = null;
    itemsEl.querySelectorAll('select').forEach((s, i) => { const ok = !!lines[i].p; s.classList.toggle('bad', !ok); s.style.borderColor = ok ? '' : '#c96a6a'; if (!ok && !bad) bad = s; });
    [['osName'], ['osCountry']].forEach(([id]) => { const f = document.getElementById(id), ok = f.value.trim() !== ''; f.closest('.os-f').classList.toggle('bad', !ok); if (!ok && !bad) bad = f; });
    const em = document.getElementById('osEmail'), ig = document.getElementById('osInsta');
    const emOk = !em.value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value.trim()), any = em.value.trim() || ig.value.trim();
    em.closest('.os-f').classList.toggle('bad', !emOk || !any); ig.closest('.os-f').classList.toggle('bad', !any);
    if ((!emOk || !any) && !bad) bad = em;
    if (bad){ st.textContent = !any ? 'Please leave your email or Instagram so we can reach you.' : !emOk ? 'Please check your email address.' : 'Please fill in the highlighted details.'; bad.focus(); return; }
    const ref = 'ADVY-' + Date.now().toString(36).slice(-4).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();
    form.elements.reference.value = ref; form.elements.items.value = summary();
    const btn = document.getElementById('osSend'); btn.disabled = true; st.textContent = 'Sending your order…';
    try {
      if (live){ const r = await fetch('/', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams(new FormData(form)).toString()}); if (!r.ok) throw new Error(r.status); }
      else await new Promise(r => setTimeout(r, 600));
      document.getElementById('osRef').textContent = ref;
      document.getElementById('osSum').textContent = summary() + '\n\nFor ' + document.getElementById('osName').value.trim() + ', ' + document.getElementById('osCountry').value
        + (live ? '' : '\n\n(Preview only: on advy-perfumes.com this order goes to your Netlify Forms.)');
      st.textContent = ''; step('done');
    } catch (err) { st.textContent = "Your order didn't send. Please try again, or order via Instagram."; }
    finally { btn.disabled = false; }
  });
  form.addEventListener('input', e => { const f = e.target.closest('.os-f'); if (f) f.classList.remove('bad');
    if (e.target.id === 'osEmail' || e.target.id === 'osInsta') ['osEmail', 'osInsta'].forEach(id => document.getElementById(id).closest('.os-f').classList.remove('bad')); });
})();
