// HUMBLE site: phone crops of the booklet art, responsive image loading, in-view animation triggers.
(() => {
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // available widths per image (see build_assets.py)
  const IMG = { scene: [1280, 1920, 2560], backcover: [480, 970], net: [640, 1734], drone: [400, 800, 1200] };
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const pickW = (name, needPx) => { const ws = IMG[name]; return ws.find(x => x >= needPx) || ws[ws.length - 1]; };

  const avif = new Promise(res => {
    const i = new Image();
    i.onload = () => res(i.width > 0);
    i.onerror = () => res(false);
    i.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';
  });
  const ext = async () => ((await avif) ? 'avif' : 'webp');

  // 1) phone crops: clone the spread art into each panel with its own viewBox
  let n = 0;
  document.querySelectorAll('.m-visual').forEach(box => {
    const svg = document.getElementById(box.dataset.art).cloneNode(true);
    const suffix = '-m' + (n++);
    svg.removeAttribute('id');
    svg.setAttribute('class', 'art-m');
    svg.setAttribute('viewBox', box.dataset.view);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    (box.dataset.hide || '').split(',').filter(Boolean).forEach(sel => svg.querySelectorAll(sel).forEach(el => el.remove()));
    // make gradient / clip ids unique per clone
    svg.querySelectorAll('[id]').forEach(el => {
      const old = el.id; el.id = old + suffix;
      svg.querySelectorAll('*').forEach(u => {
        for (const a of ['fill', 'clip-path', 'href']) {
          const v = u.getAttribute(a);
          if (v && (v === `url(#${old})` || v === `#${old}`)) u.setAttribute(a, v.replace(old, old + suffix));
        }
      });
    });
    const [, , w, h] = box.dataset.view.split(/\s+/).map(Number);
    box.style.setProperty('--ar', `${w} / ${h}`);
    box.appendChild(svg);
  });

  // fit a crop to its box: keep the focus point, widen the view on wider boxes instead of shrinking
  const fitBox = box => {
    const r = box.getBoundingClientRect();
    if (!r.width || !r.height || !box.dataset.fit) return;
    const parts = box.dataset.fit.split(',');
    let [cx, y, h, minX, maxX] = parts.map(Number);
    const pad = parts[5] === 'pad';
    const aspect = r.width / r.height;
    let w = h * aspect;
    const svg = box.firstElementChild;
    // box wider than the allowed area: show the whole area centred, plain background at the sides
    const wide = w > maxX - minX;
    if (wide) { w = maxX - minX; if (!pad) { const h2 = w / aspect; y += (h - h2) / 2; h = h2; } }
    const x = Math.min(Math.max(cx - w / 2, minX), maxX - w);
    svg.setAttribute('preserveAspectRatio', wide && pad ? 'xMidYMid meet' : 'xMidYMid slice');
    svg.setAttribute('viewBox', [x, y, w, h].map(v => v.toFixed(2)).join(' '));
  };

  // full-width swoosh behind each phone screen (and the demo section)
  const SW = '<svg class="m-swoosh" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
    '<path d="M0 72 C30 66 65 40 100 26 L100 38 C66 50 32 76 0 84 Z" fill="#2A4674" opacity=".1"/>' +
    '<path d="M0 91 C35 83 68 56 100 45" fill="none" stroke="#2A4674" stroke-width="1.2" vector-effect="non-scaling-stroke" opacity=".3"/></svg>';
  document.querySelectorAll('[data-swoosh]').forEach(el => el.insertAdjacentHTML('afterbegin', SW));

  if (REDUCED) document.querySelectorAll('animateTransform').forEach(a => a.remove());

  // 2) SVG images: pick the smallest file that is sharp for the rendered size; resolves when decoded
  const loadImages = async svg => {
    const r = svg.getBoundingClientRect();
    if (!r.width) return false;                       // hidden in this layout
    const vb = svg.viewBox.baseVal;
    const scale = Math.max(r.width / vb.width, r.height / vb.height);
    const e = await ext();
    const waits = [];
    svg.querySelectorAll('image[data-img]').forEach(im => {
      const w = pickW(im.dataset.img, im.width.baseVal.value * scale * DPR);
      const cur = im.getAttribute('href');
      const curW = cur ? +cur.match(/-(\d+)\./)[1] : 0;
      if (w > curW) {                                  // only ever upgrade
        const url = `assets/img/${im.dataset.img}-${w}.${e}`;
        im.setAttribute('href', url);
        const pre = new Image(); pre.src = url;
        waits.push(pre.decode().catch(() => {}));
      }
    });
    return Promise.all(waits);
  };

  const arts = [...document.querySelectorAll('.art, .art-m')];
  const loader = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) loadImages(e.target); }), { rootMargin: '120% 0px' });
  const trigger = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); trigger.unobserve(e.target); }
  }), { threshold: 0.3 });
  // pause everything that is off screen (iPhone Safari repaints whole SVGs for every animated frame)
  const vis = new IntersectionObserver(es => es.forEach(e => {
    const s = e.target, on = e.isIntersecting;
    s.classList.toggle('off', !on);
    if (s.pauseAnimations) on ? s.unpauseAnimations() : s.pauseAnimations();
  }), { rootMargin: '5% 0px' });
  arts.forEach(s => { loader.observe(s); vis.observe(s); });
  // re-fit phone crops whenever their box really changes size (fonts, iOS toolbars, rotation)
  const ro = new ResizeObserver(es => es.forEach(e => { fitBox(e.target); loadImages(e.target.firstElementChild); }));
  document.querySelectorAll('.m-visual[data-fit]').forEach(box => { fitBox(box); ro.observe(box); });

  // 3) cover target drifts ±20 units around the drone (smooth, never repeats exactly)
  let driftFrozen = false;
  if (!REDUCED) {
    const drifts = [...document.querySelectorAll('.drift')].map(g => ({ g, svg: g.ownerSVGElement }));
    let last = null, clock = 0;
    const tick = now => {
      if (last !== null && !driftFrozen) clock += (now - last) / 1000;
      last = now;
      const s = clock;
      drifts.forEach(({ g, svg }, i) => {
        if (svg.classList.contains('off')) return;
        const x = 20 * (0.62 * Math.sin(s * 0.41 + i) + 0.38 * Math.sin(s * 0.97 + 2.1 * i));
        const y = 20 * (0.62 * Math.sin(s * 0.33 + 1.3 + i) + 0.38 * Math.sin(s * 0.79 + 3.7 * i));
        g.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // 4) phone pinned scene built from plain images (GPU-scaled, never redrawn):
  //    text swipes right, camera pulls back, net flies in — all tied to scroll
  const DESK = matchMedia('(min-width: 1100px) and (orientation: landscape)');
  const VB1 = [310, 355, 230, 190], VB2 = [125, 190, 440, 405];
  const duo = document.querySelector('.duo');
  const scene = document.querySelector('.duo-scene');
  const cam = document.createElement('div');
  cam.className = 'duo-cam';
  cam.innerHTML = '<img class="duo-net" alt="" decoding="async">' +
    '<div class="duo-drone"><img alt="" decoding="async">' +
    '<svg class="duo-tgt" viewBox="-56 -56 112 112" aria-hidden="true"><g class="duo-blink">' +
    '<circle r="44" class="ring"/><circle r="16" class="ring dash"/><circle r="1.8" class="dot"/>' +
    '<path class="tick" d="M0 -56V-34M0 34V56M-56 0H-34M34 0H56"/></g></svg></div>';
  scene.appendChild(cam);
  const netImg = cam.querySelector('.duo-net'), droneBox = cam.querySelector('.duo-drone');
  const droneImg = droneBox.querySelector('img'), tgt = droneBox.querySelector('.duo-tgt');
  // positions in booklet units, relative to the wide view VB2
  const place = (el, x, y, w, h, b) => Object.assign(el.style, { left: x * b + 'px', top: y * b + 'px', width: w * b + 'px', height: h * b + 'px' });
  const setImg = async (img, name, unitsW, b) => {
    const w = pickW(name, unitsW * b * DPR);
    if (w <= (+img.dataset.w || 0)) return;
    img.dataset.w = w;
    img.src = `assets/img/${name}-${w}.${await ext()}`;
    return img.decode().catch(() => {});
  };

  const imid = document.querySelector('.duo .p-imid'), ileft = document.querySelector('.duo .p-ileft');
  const duoText = document.querySelector('.duo-text');
  let lastW = 0, b = 1, W = 0, H = 0, duoImgs = Promise.resolve();
  const measure = () => {
    if (DESK.matches) { duoText.style.removeProperty('--th'); return; }
    if (innerWidth === lastW) return;                 // iOS toolbar resizes only change height
    lastW = innerWidth;
    duoText.style.setProperty('--th', Math.max(imid.offsetHeight, ileft.offsetHeight) + 'px');
  };
  const layout = () => {
    const r = scene.getBoundingClientRect();
    if (!r.width || !r.height) return;
    W = r.width; H = r.height;
    b = Math.min(W / VB1[2], H / VB1[3]);             // base scale = closest shot, so it stays sharp
    cam.style.width = VB2[2] * b + 'px'; cam.style.height = VB2[3] * b + 'px';
    place(netImg, 14, 8.7, 414.9, 396.3, b);
    place(droneBox, 205, 180.7, 194, 160, b);
    place(tgt, 35, 18, 112, 112, b);
    duoImgs = Promise.all([setImg(netImg, 'net', 414.9, b), setImg(droneImg, 'drone', 194, b)]);
  };
  const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
  const lerp = (a, c, t) => a + (c - a) * t;
  let lastT = -1, duoIn = false;
  const duoHead = imid.querySelector('h2');
  const onDuo = () => {
    if (DESK.matches) {
      if (lastT !== -1) { [imid, ileft].forEach(p => { p.style.transform = ''; p.style.opacity = ''; }); lastT = -1; }
      return;
    }
    if (!duoIn && !document.documentElement.classList.contains('loading') &&
        duoHead.getBoundingClientRect().top < innerHeight * 0.5) {
      duoIn = true;
      scene.classList.add('duo-in');
    }
    const r = duo.getBoundingClientRect();
    const p = -r.top / Math.max(1, r.height - innerHeight);
    const t = ease((p - 0.3) / 0.4);
    if (t === lastT) return;
    lastT = t;
    imid.style.transform = `translate3d(${t * 105}%,0,0)`; imid.style.opacity = 1 - t;
    ileft.style.transform = `translate3d(${(t - 1) * 105}%,0,0)`; ileft.style.opacity = t;
    // camera: fit the interpolated view into the scene box, as one transform on the layer stack
    const vb = VB1.map((v, i) => lerp(v, VB2[i], t));
    const sc = Math.min(W / vb[2], H / vb[3]);
    const tx = (VB2[0] - vb[0]) * sc + (W - vb[2] * sc) / 2;
    const ty = (VB2[1] - vb[1]) * sc + (H - vb[3] * sc) / 2;
    cam.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) scale(${(sc / b).toFixed(4)})`;
    netImg.style.transform = `translate3d(${((1 - t) * -520 * b).toFixed(1)}px,0,0)`;
    netImg.style.opacity = Math.min(1, t * 2.5);
  };
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; onDuo(); });
  }, { passive: true });
  const relayout = () => { measure(); layout(); lastT = -2; onDuo(); };
  addEventListener('resize', relayout);
  DESK.addEventListener('change', () => { lastW = 0; relayout(); });
  relayout();
  if (document.fonts) document.fonts.ready.then(() => { lastW = 0; relayout(); });

  // 5) loader: at least one full cycle, never cut a cycle short, then fly onto the drone
  const loaderEl = document.querySelector('.loader');
  const cycleEl = loaderEl && loaderEl.querySelector('.ld-blink');
  let assetsReady = false, cycles = 0, handing = false;
  const finish = () => {
    document.documentElement.classList.remove('loading', 'handoff');
    if (loaderEl) loaderEl.remove();
    driftFrozen = false;
    lastT = -2; onDuo();
    arts.forEach(s => trigger.observe(s));
  };
  const handoff = () => {
    if (handing) return;
    handing = true;
    if (!loaderEl) return finish();
    loaderEl.classList.add('stop');                     // cycle just ended: every transform is back at rest
    document.documentElement.classList.remove('loading');
    const dest = [...document.querySelectorAll('.drift')].map(g => g.getBoundingClientRect())
      .find(r => r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth);
    if (!dest || REDUCED) { loaderEl.classList.add('done'); setTimeout(finish, 500); return; }
    driftFrozen = true;                                  // hold the page target still while we land on it
    const svg = loaderEl.querySelector('svg');
    const r = svg.getBoundingClientRect();
    const s = dest.width / (r.width * 112 / 120);        // ticks span 112 of the loader's 120 units
    const dx = dest.left + dest.width / 2 - (r.left + r.width / 2);
    const dy = dest.top + dest.height / 2 - (r.top + r.height / 2);
    document.documentElement.classList.add('handoff');
    loaderEl.classList.add('fly');
    requestAnimationFrame(() => { svg.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`; });
    setTimeout(finish, 950);
  };
  const tryHandoff = () => { if (assetsReady && (cycles >= 1 || REDUCED)) handoff(); };
  if (cycleEl) cycleEl.addEventListener('animationiteration', () => { cycles++; tryHandoff(); });
  const ready = [document.fonts ? document.fonts.ready : Promise.resolve(), duoImgs, ...arts.map(s => loadImages(s))];
  Promise.race([Promise.all(ready), new Promise(r => setTimeout(r, 12000))]).then(() => {
    // final fit once fonts and layout have settled (fixes the first-load crop on iPhone)
    document.querySelectorAll('.m-visual[data-fit]').forEach(fitBox);
    assetsReady = true;
    tryHandoff();
    setTimeout(() => { cycles = Math.max(cycles, 1); tryHandoff(); }, 3000);   // if the tab throttled animations
  });

  // 6) floating email appears once the visitor starts scrolling
  const mail = document.querySelector('.mail');
  const onScroll = () => mail.classList.toggle('show', scrollY > innerHeight * 0.35);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
