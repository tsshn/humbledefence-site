// Three versions of one page, picked by the address:
//   /        Polish first, English below (default)
//   /en-f    English first, Polish below
// Every Polish/English pair in the markup (a Polish element followed by its lang="en" partner) swaps its
// contents in place, so the English text takes the primary styling. Single texts with no partner carry their English in data-en (plain) or data-en-html.
// On GitHub Pages /en and /en-f are served by 404.html, which hands over to /?lang=… and this script
// puts the clean address back.
(() => {
  const MODES = ['pl', 'en-f'];
  const PROD = /(^|\.)humbledefence\.com$/.test(location.hostname);
  const html = document.documentElement;

  const fromUrl = () => {
    const q = new URLSearchParams(location.search).get('lang');
    const p = location.pathname.replace(/\/+$/, '');
    const m = q === 'en' || p === '/en' ? 'en-f' : q || (p === '/en-f' ? 'en-f' : 'pl');   // old /en links land on English first
    return MODES.includes(m) ? m : 'pl';
  };
  const urlFor = m => {
    const keep = new URLSearchParams(location.search);
    keep.delete('lang');
    if (!PROD && m !== 'pl') keep.set('lang', m);       // local preview has no 404 fallback: use ?lang=
    const qs = keep.toString();
    return (PROD ? (m === 'pl' ? '/' : '/' + m) : location.pathname) + (qs ? '?' + qs : '') + location.hash;
  };

  // pairs: [polish element, english element, polish html, english html]
  const SKIP = el => el.matches('.sep, br, .vn-dot');
  const pairs = [];
  document.querySelectorAll('[lang="en"]').forEach(en => {
    let pl = en.previousElementSibling;
    while (pl && SKIP(pl)) pl = pl.previousElementSibling;
    if (pl && !pl.hasAttribute('lang')) pairs.push([pl, en, pl.innerHTML, en.innerHTML]);
  });
  const singles = [...document.querySelectorAll('[data-en], [data-en-html]')].map(el => [el, el.innerHTML]);
  const TITLE = document.title;

  let cur = null;
  const apply = m => {
    if (m === cur) return;
    cur = m;
    const en = m !== 'pl';
    pairs.forEach(([pl, e, a, b]) => { pl.innerHTML = en ? b : a; e.innerHTML = en ? a : b; });
    singles.forEach(([el, orig]) => {
      if (!en) el.innerHTML = orig;
      else if (el.dataset.enHtml != null) el.innerHTML = el.dataset.enHtml;
      else el.textContent = el.dataset.en;
    });
    html.lang = en ? 'en' : 'pl';
    html.classList.remove('l-pl', 'l-enf');
    html.classList.add(m === 'en-f' ? 'l-enf' : 'l-pl');
    document.title = en ? 'HUMBLE — Short-range UAS detection' : TITLE;
    document.querySelectorAll('.lang a').forEach(a => a.setAttribute('aria-current', String(a.dataset.lang === m)));
    window.HD_LANG = m;
  };

  apply(fromUrl());
  // came in through the 404 hand-over (or an old ?lang= link): show the clean address
  if (PROD && new URLSearchParams(location.search).has('lang')) history.replaceState(null, '', urlFor(cur));

  const change = m => {
    if (m === cur) return;
    apply(m);
    history.pushState(null, '', urlFor(m));
    dispatchEvent(new CustomEvent('hd:lang', { detail: m }));
    dispatchEvent(new Event('resize'));                  // let layout code re-measure the new text
  };
  document.querySelectorAll('.lang a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); change(a.dataset.lang); }));
  addEventListener('popstate', () => {
    const m = fromUrl();
    if (m !== cur) { apply(m); dispatchEvent(new CustomEvent('hd:lang', { detail: m })); dispatchEvent(new Event('resize')); }
  });
})();
