// HUMBLE site: phone crops of the booklet art, responsive image loading, in-view animation triggers.
(() => {
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // available widths per image (see build_assets.py)
  const IMG = { scene: [1280, 1920, 2560], backcover: [480, 970], net: [640, 1734], drone: [400, 800, 1200] };

  const avif = new Promise(res => {
    const i = new Image();
    i.onload = () => res(i.width > 0);
    i.onerror = () => res(false);
    i.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';
  });

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

  // fit each crop to its box: keep the focus point, widen the view on wider boxes instead of shrinking
  const fitBoxes = () => document.querySelectorAll('.m-visual[data-fit]').forEach(box => {
    const r = box.getBoundingClientRect();
    if (!r.width || !r.height) return;
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
  });
  fitBoxes();

  // phone pinned scene: net + drone + target only, camera driven by scroll
  const VB1 = [310, 355, 230, 190], VB2 = [125, 190, 440, 405];
  const duo = document.querySelector('.duo');
  const scene = document.querySelector('.duo-scene');
  const cam = document.createElement('div');
  cam.className = 'duo-cam';
  scene.appendChild(cam);
  // two layers (net below, drone+target above), rendered once at full sharpness; scrolling only moves/scales them
  const layer = (kind) => {
    const s = document.getElementById('art-inside').cloneNode(true);
    s.removeAttribute('id');
    s.setAttribute('class', `art-m duo-mode duo-${kind}`);
    s.setAttribute('viewBox', VB2.join(' '));
    s.setAttribute('preserveAspectRatio', 'none');
    s.querySelectorAll('.bc, defs').forEach(el => el.remove());
    s.querySelectorAll(kind === 'net' ? '.drone-rise, .tgt-in' : '.net-in').forEach(el => el.remove());
    cam.appendChild(s);
    return s;
  };
  const netSvg = layer('net'), droneSvg = layer('drone');

  // full-width swoosh behind each phone screen (and the demo section)
  const SW = '<svg class="m-swoosh" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
    '<path d="M0 72 C30 66 65 40 100 26 L100 38 C66 50 32 76 0 84 Z" fill="#2A4674" opacity=".1"/>' +
    '<path d="M0 91 C35 83 68 56 100 45" fill="none" stroke="#2A4674" stroke-width="1.2" vector-effect="non-scaling-stroke" opacity=".3"/></svg>';
  document.querySelectorAll('[data-swoosh]').forEach(el => el.insertAdjacentHTML('afterbegin', SW));

  if (REDUCED) document.querySelectorAll('animateTransform').forEach(a => a.remove());

  // 2) images: pick the smallest file that is sharp for the rendered size
  const loadImages = async svg => {
    const r = svg.getBoundingClientRect();
    if (!r.width) return false;                       // hidden in this layout
    const vb = svg.viewBox.baseVal;
    const scale = Math.max(r.width / vb.width, r.height / vb.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ext = (await avif) ? 'avif' : 'webp';
    svg.querySelectorAll('image[data-img]').forEach(im => {
      const need = im.width.baseVal.value * scale * dpr;
      const ws = IMG[im.dataset.img];
      const w = ws.find(x => x >= need) || ws[ws.length - 1];
      const url = `assets/img/${im.dataset.img}-${w}.${ext}`;
      const cur = im.getAttribute('href');
      const curW = cur ? +cur.match(/-(\d+)\./)[1] : 0;
      if (w > curW) im.setAttribute('href', url);      // only ever upgrade
    });
    return true;
  };

  const arts = [...document.querySelectorAll('.art, .art-m')];
  const loader = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) loadImages(e.target); }), { rootMargin: '120% 0px' });
  const trigger = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); trigger.unobserve(e.target); }
  }), { threshold: 0.3 });
  arts.forEach(s => { loader.observe(s); trigger.observe(s); });
  let t;
  addEventListener('resize', () => { clearTimeout(t); fitBoxes(); t = setTimeout(() => arts.forEach(s => {
    const r = s.getBoundingClientRect();
    if (r.bottom > -innerHeight && r.top < innerHeight * 2) loadImages(s);
  }), 200); });

  // 3) cover target drifts ±20 units around the drone (smooth, never repeats exactly)
  if (!REDUCED) {
    const drifts = [...document.querySelectorAll('.drift')];
    const tick = now => {
      const s = now / 1000;
      drifts.forEach((g, i) => {
        const x = 20 * (0.62 * Math.sin(s * 0.41 + i) + 0.38 * Math.sin(s * 0.97 + 2.1 * i));
        const y = 20 * (0.62 * Math.sin(s * 0.33 + 1.3 + i) + 0.38 * Math.sin(s * 0.79 + 3.7 * i));
        g.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // 4) phone pinned scene: text swipes right, camera pulls back, net flies in — all tied to scroll
  const DESK = matchMedia('(min-width: 1100px) and (orientation: landscape)');
  const imid = document.querySelector('.duo .p-imid'), ileft = document.querySelector('.duo .p-ileft');
  const duoText = document.querySelector('.duo-text');
  let lastW = 0, b = 1, W = 0, H = 0;
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
    [netSvg, droneSvg].forEach(s => { s.style.width = VB2[2] * b + 'px'; s.style.height = VB2[3] * b + 'px'; });
  };
  const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
  const lerp = (a, c, t) => a + (c - a) * t;
  let lastT = -1;
  const onDuo = () => {
    if (DESK.matches) {
      if (lastT !== -1) { [imid, ileft].forEach(p => { p.style.transform = ''; p.style.opacity = ''; }); lastT = -1; }
      return;
    }
    const r = duo.getBoundingClientRect();
    const p = -r.top / Math.max(1, r.height - innerHeight);
    const t = ease((p - 0.3) / 0.4);
    if (t === lastT) return;
    lastT = t;
    imid.style.transform = `translate3d(${t * 105}%,0,0)`; imid.style.opacity = 1 - t;
    ileft.style.transform = `translate3d(${(t - 1) * 105}%,0,0)`; ileft.style.opacity = t;
    // camera: fit the interpolated view into the scene box, expressed as one transform on the layers
    const vb = VB1.map((v, i) => lerp(v, VB2[i], t));
    const sc = Math.min(W / vb[2], H / vb[3]);
    const tx = (VB2[0] - vb[0]) * sc + (W - vb[2] * sc) / 2;
    const ty = (VB2[1] - vb[1]) * sc + (H - vb[3] * sc) / 2;
    cam.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) scale(${(sc / b).toFixed(4)})`;
    netSvg.style.transform = `translate3d(${((1 - t) * -520 * b).toFixed(1)}px,0,0)`;
    netSvg.style.opacity = Math.min(1, t * 2.5);
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

  // 5) floating email appears once the visitor starts scrolling
  const mail = document.querySelector('.mail');
  const onScroll = () => mail.classList.toggle('show', scrollY > innerHeight * 0.35);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
