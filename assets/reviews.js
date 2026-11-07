/* ADVY reviews: loads the published customer reviews and draws them.
   Reviews are sent from reviews.html to Netlify Forms (form "review").
   The ADVY Google script reads them back from Netlify and serves them here, without emails.
   A review the owner deletes in the Owner Desk disappears from the site within a few minutes. */
(function(){
  const URL = 'https://script.google.com/macros/s/AKfycbybSk-12o7f0VyzAHBuXj86wBHWHRreHdZzWpcg_bGD1IRF_z2rn2-UU_ZxuT_RDYGr/exec';
  const preview = !!window.claude || !/(^|\.)advy-perfumes\.com$|\.netlify\.app$/.test(location.hostname);
  const css = `
  .rv-stars{display:inline-flex;gap:3px;line-height:0}
  .rv-stars i{width:15px;height:15px;display:block}
  .rv-stars svg{width:100%;height:100%;fill:#3a332c;stroke:none}
  .rv-stars i.on svg{fill:#d9bd84}
  .rv-stars.lg i{width:22px;height:22px}
  .rv-card{position:relative;border:1px solid #2a2622;background:linear-gradient(180deg,#15120f,#100e0c);padding:24px 24px 20px;display:flex;flex-direction:column;gap:14px;min-width:0}
  .rv-card::before{content:"\\201C";position:absolute;right:18px;top:2px;font:400 72px/1 "Cormorant Garamond",Georgia,serif;color:#2a2622;pointer-events:none}
  .rv-card.pending{border-color:#4a4030}
  .rv-top{display:flex;align-items:center;gap:10px}
  .rv-ex{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#16120c;background:#8f877b;padding:2px 7px}
  .rv-card.pending .rv-ex{background:#c8b08a}
  .rv-text{font-family:"Cormorant Garamond",Georgia,serif;font-size:20px;line-height:1.45;color:#efe8dc;margin:0;white-space:pre-line;overflow-wrap:anywhere;flex:1}
  .rv-by{display:flex;align-items:baseline;justify-content:space-between;gap:8px 14px;flex-wrap:wrap;font-size:13px;letter-spacing:.04em;color:#c9c1b4;border-top:1px solid #1f1c19;padding-top:12px}
  .rv-name span{color:#8f877b}
  .rv-scent{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#c8b08a}
  .rv-when{font-size:11px;letter-spacing:.12em;color:#6f685e}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.75 5.9 6.45.75-4.8 4.4 1.3 6.4L12 17.05 6.3 20.25l1.3-6.4-4.8-4.4 6.45-.75z"/></svg>';
  const stars = (n, cls) => `<span class="rv-stars${cls ? ' ' + cls : ''}" role="img" aria-label="${n} out of 5 stars">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= Math.round(n) ? 'on' : ''}">${STAR}</i>`).join('')}</span>`;
  const when = iso => { const d = new Date(iso); if (isNaN(d)) return ''; const days = Math.floor((Date.now() - d) / 864e5);
    if (days < 1) return 'Today'; if (days < 2) return 'Yesterday'; if (days < 7) return days + ' days ago';
    return d.toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}); };

  // one example card for previews only (never on the live site)
  const EXAMPLE = [{id:'example', name:'Example customer', country:'UAE', rating:5, scent:'Nocturne', text:'This is an example review. On advy-perfumes.com, the reviews your customers send appear here.', at:new Date().toISOString(), example:true}];

  // reviews sent from this browser show straight away, before the list refreshes
  const mine = () => { try { return JSON.parse(localStorage.getItem('advyMyReviews') || '[]'); } catch (e) { return []; } };
  function remember(r){ try { const m = mine().filter(x => x.id !== r.id); m.unshift(r); localStorage.setItem('advyMyReviews', JSON.stringify(m.slice(0, 5))); } catch (e) {} }

  let cache = null;
  function load(){
    if (cache) return cache;
    cache = (preview ? Promise.resolve({reviews:EXAMPLE})
      : fetch(URL + '?reviews=1', {cache:'no-store'}).then(r => r.ok ? r.json() : {}).catch(() => ({})))
      .then(j => {
        let list = Array.isArray(j.reviews) ? j.reviews : [];
        const ids = new Set(list.map(r => r.id));
        // keep my own review visible until it shows up in the published list (up to 2 days)
        const own = mine().filter(r => !ids.has(r.id) && !list.some(x => x.text === r.text) && Date.now() - new Date(r.at) < 2*864e5).map(r => ({...r, pending:true}));
        list = [...own, ...list];
        return {reviews:list, ok:Array.isArray(j.reviews) || preview};
      });
    return cache;
  }
  function card(r){
    return `<article class="rv-card${r.pending ? ' pending' : ''}">
      <div class="rv-top">${stars(r.rating)}${r.example ? '<span class="rv-ex">Example</span>' : r.pending ? '<span class="rv-ex">Just sent</span>' : ''}</div>
      <p class="rv-text">${esc(r.text)}</p>
      <div class="rv-by"><span class="rv-name">${esc(r.name || 'ADVY customer')}${r.country ? ` <span>· ${esc(r.country)}</span>` : ''}</span>${r.scent ? `<span class="rv-scent">${esc(r.scent)}</span>` : ''}</div>
      <time class="rv-when" datetime="${esc(r.at)}">${esc(when(r.at))}</time>
    </article>`;
  }
  function summary(list){
    const n = list.filter(r => !r.example).length, real = list.filter(r => !r.example);
    const avg = real.length ? real.reduce((a, r) => a + (+r.rating || 0), 0) / real.length : 0;
    const dist = [5, 4, 3, 2, 1].map(s => ({s, c:real.filter(r => Math.round(r.rating) === s).length}));
    return {n, avg, dist};
  }
  window.advyReviews = {load, card, stars, summary, remember, esc, preview};
})();
