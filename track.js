// Anonymous visit reporting for humbledefence.com — no cookies, nothing stored on the visitor's device.
// Sends: personal-link tag (?r=), referrer site, language, screen size, active time, max scroll,
// sections reached, demo video seconds watched, email clicks. The server adds network/city/device.
(() => {
  const END = 'https://humble-visits.humbledefence.workers.dev/hit';
  // owner opt-out: open humbledefence.com/?me once on your devices
  try {
    if (new URLSearchParams(location.search).has('me')) localStorage.setItem('hd-me', '1');
    if (localStorage.getItem('hd-me')) return;
  } catch (e) {}
  if (navigator.webdriver) return;

  const q = new URLSearchParams(location.search);
  const ref = (() => { try { const h = new URL(document.referrer).hostname; return h && h !== location.hostname ? h : ''; } catch (e) { return ''; } })();
  const st = {
    v: Math.random().toString(36).slice(2, 10),
    r: (q.get('r') || q.get('utm_source') || '').slice(0, 40),
    ref, lang: navigator.language || '', scr: `${screen.width}×${screen.height}`,
    act: 0, sc: 0, sec: [], vid: { p: false, w: 0, d: 0, e: false }, mail: false,
  };

  // active time: only while the tab is visible
  let since = document.visibilityState === 'visible' ? performance.now() : null;
  const activeNow = () => Math.round(st.act + (since !== null ? (performance.now() - since) / 1000 : 0));

  // scroll depth
  const onScroll = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    if (h > 0) st.sc = Math.max(st.sc, Math.min(100, Math.round(100 * scrollY / h)));
  };
  addEventListener('scroll', onScroll, { passive: true });

  // sections reached (whichever of these are visible in the current layout)
  const SECTIONS = { cover: '.p-ocover', integracja: '.p-omid', demo: '#demo', specs: '.p-iright', scene: '.duo', contact: '.contact-m, .foot' };
  const seen = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting && !st.sec.includes(e.target.dataset.sec)) st.sec.push(e.target.dataset.sec);
  }), { threshold: 0.25 });
  for (const [name, sel] of Object.entries(SECTIONS)) {
    document.querySelectorAll(sel).forEach(el => { el.dataset.sec = name; seen.observe(el); });
  }

  // demo video: seconds actually watched (seeking does not count)
  const video = document.querySelector('#demo video');
  if (video) {
    let lastT = null;
    video.addEventListener('play', () => { st.vid.p = true; lastT = video.currentTime; send('update'); });
    video.addEventListener('timeupdate', () => {
      if (lastT !== null && !video.paused) {
        const dt = video.currentTime - lastT;
        if (dt > 0 && dt < 1.5) st.vid.w += dt;
      }
      lastT = video.currentTime;
      st.vid.d = video.duration || st.vid.d;
    });
    video.addEventListener('seeking', () => { lastT = null; });
    video.addEventListener('ended', () => { st.vid.e = true; send('update'); });
  }

  // email clicks
  document.addEventListener('click', e => {
    if (e.target.closest('a[href^="mailto:"]')) { st.mail = true; send('update'); }
  }, true);

  // sending
  let lastSent = '';
  const payload = ev => JSON.stringify({ ...st, ev, act: activeNow(), vid: { ...st.vid, w: Math.round(st.vid.w) } });
  const send = (ev, beacon) => {
    const body = payload(ev);
    if (ev !== 'start' && body.replace(/"ev":"\w+",/, '') === lastSent) return;
    lastSent = body.replace(/"ev":"\w+",/, '');
    try {
      if (beacon && navigator.sendBeacon) navigator.sendBeacon(END, new Blob([body], { type: 'text/plain' }));
      else fetch(END, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
    } catch (e) {}
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (since !== null) { st.act += (performance.now() - since) / 1000; since = null; }
      send('end', true);
    } else {
      since = performance.now();
    }
  });
  addEventListener('pagehide', () => send('end', true));

  onScroll();
  setTimeout(() => send('start'), 1500);             // after the first second, not on bounce-free noise
  setInterval(() => { if (document.visibilityState === 'visible') send('update'); }, 20000);
})();
