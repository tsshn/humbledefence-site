// Anonymous visit reporting for humbledefence.com — no cookies, no identity, nothing stored about the visitor.
// One report stream per tab: source (?r= tag / referring site), language, screen size, open + active time,
// max scroll %, demo video seconds watched, email clicks. The server adds network / city / device.
(() => {
  const END = 'https://humble-visits.humbledefence.workers.dev/hit';
  // owner opt-out: open humbledefence.com/?me once on your own devices
  try {
    if (new URLSearchParams(location.search).has('me')) localStorage.setItem('hd-me', '1');
    if (localStorage.getItem('hd-me')) return;
  } catch (e) {}
  if (navigator.webdriver) return;

  const q = new URLSearchParams(location.search);
  const ref = (() => { try { const h = new URL(document.referrer).hostname; return h && h !== location.hostname ? h : ''; } catch (e) { return ''; } })();
  const t0 = Date.now();
  const st = {
    v: (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 16),
    r: (q.get('r') || q.get('utm_source') || '').slice(0, 40),
    ref, lang: navigator.language || '', scr: `${screen.width}×${screen.height}`,
    act: 0, sc: 0, vw: 0, mail: false,
  };

  // active time: only while the tab is visible
  let since = document.visibilityState === 'visible' ? performance.now() : null;
  const activeNow = () => Math.round(st.act + (since !== null ? (performance.now() - since) / 1000 : 0));

  // scroll depth (max %)
  const onScroll = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    if (h > 0) st.sc = Math.max(st.sc, Math.min(100, Math.round(100 * scrollY / h)));
  };
  addEventListener('scroll', onScroll, { passive: true });

  // demo video: seconds actually watched (seeking does not count)
  const video = document.querySelector('#demo video');
  if (video) {
    let lastT = null;
    video.addEventListener('play', () => { lastT = video.currentTime; });
    video.addEventListener('timeupdate', () => {
      if (lastT !== null && !video.paused) {
        const dt = video.currentTime - lastT;
        if (dt > 0 && dt < 1.5) st.vw += dt;
      }
      lastT = video.currentTime;
    });
    video.addEventListener('seeking', () => { lastT = null; });
    video.addEventListener('pause', () => send('update'));
    video.addEventListener('ended', () => send('update'));
  }

  // email clicks
  document.addEventListener('click', e => {
    if (e.target.closest('a[href^="mailto:"]')) { st.mail = true; send('update', true); }
  }, true);

  // sending: every 3 s if something changed, every 10 s regardless, and a final report when hidden/closed
  const snapshot = () => ({ ...st, open: Math.round((Date.now() - t0) / 1000), act: activeNow(), vw: Math.round(st.vw) });
  const sig = s => `${s.sc}|${s.vw}|${s.mail}`;            // a "change" = scroll, video or email; time rides the 10 s beat
  let lastSig = '', lastSend = 0;
  const send = (ev, beacon) => {
    const s = snapshot();
    lastSig = sig(s); lastSend = Date.now();
    const body = JSON.stringify({ ...s, ev });
    try {
      if (beacon && navigator.sendBeacon && navigator.sendBeacon(END, new Blob([body], { type: 'text/plain' }))) return;
      fetch(END, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
    } catch (e) {}
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (since !== null) { st.act += (performance.now() - since) / 1000; since = null; }
      send('end', true);
    } else {
      since = performance.now();
      send('update');
    }
  });
  addEventListener('pagehide', () => send('end', true));

  onScroll();
  send('start');
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    const changed = sig(snapshot()) !== lastSig;
    if (changed || Date.now() - lastSend >= 10000) send(changed ? 'update' : 'beat');
  }, 3000);
})();
