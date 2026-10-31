// Spinning objects as "packed alpha" video: each MP4 frame holds the colour image (left half) and a
// black/white transparency mask (right half). WebGL recombines them on a <canvas>, so the object floats
// over any background on every browser (iPhone included) at a fraction of the size of WebM/WebP.
// Videos are fetched whole before the page loader lifts (window.HD_SPINS_READY), then autoplay muted
// and looped like any other page animation. The still poster stays if WebGL or autoplay is unavailable.
(() => {
  const canvases = [...document.querySelectorAll('canvas[data-spin]')];
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HOVER = matchMedia('(hover: hover) and (pointer: fine)').matches;   // desktop with a mouse
  const ready = [];

  const VS = 'attribute vec2 p;varying vec2 uv;void main(){uv=vec2((p.x+1.)*.5,(1.-p.y)*.5);gl_Position=vec4(p,0.,1.);}';
  const FS = 'precision mediump float;varying vec2 uv;uniform sampler2D t;uniform float e;' +
    'void main(){vec2 q=vec2(min(uv.x*.5,.5-e),uv.y);vec3 c=texture2D(t,q).rgb;' +
    'float a=texture2D(t,vec2(.5+max(uv.x*.5,e),uv.y)).r;gl_FragColor=vec4(c*a,a);}';

  const players = [];
  canvases.forEach(canvas => {
    const box = canvas.parentElement;
    const gl = !REDUCED && canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return;                                   // poster image stays

    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const eLoc = gl.getUniformLocation(prog, 'e');

    // hidden but rendered video element (iOS only decodes frames for videos in the document)
    const video = document.createElement('video');
    video.muted = true; video.loop = true; video.playsInline = true;
    video.setAttribute('muted', ''); video.setAttribute('playsinline', ''); video.setAttribute('aria-hidden', 'true');
    video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0;pointer-events:none';   // full size: browsers throttle tiny/offscreen videos
    box.appendChild(video);

    let visible = false, live = false, wanted = true;
    const draw = () => {
      if (video.readyState < 2) return;
      if (canvas.width !== video.videoWidth / 2) {
        canvas.width = video.videoWidth / 2; canvas.height = video.videoHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform1f(eLoc, 0.5 / video.videoWidth);
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // swap poster → canvas only once real frames are flowing (a paused, never-played video may hand over an empty frame)
      if (!live && !video.paused && video.currentTime > 0) { live = true; box.classList.add('live'); }
    };
    // draw on every screen refresh while playing (rVFC is throttled for hidden source videos)
    let running = false, lastT = -1;
    const tick = () => {
      if (video.currentTime !== lastT) { lastT = video.currentTime; draw(); }
      if (video.paused) { running = false; return; }
      requestAnimationFrame(tick);
    };
    const loop = () => { if (!running) { running = true; tick(); } };
    // one full turn per trigger, then rest on frame 1 (= the still image)
    //  mouse devices: a turn each time the pointer enters the tile
    //  touch devices: a turn each time the video's middle crosses the middle of the screen, max once per 5 s
    const spinOnce = () => {
      if (!video.paused || video.readyState < 2) return false;
      video.loop = false;
      const p = video.play(); if (p) p.catch(() => {});
      return true;
    };
    video.addEventListener('ended', () => { video.playbackRate = 1; video.currentTime = 0; });
    video.addEventListener('seeked', draw);
    const ALWAYS = 'loop' in canvas.dataset;            // background loops: play continuously while on screen
    const play = ALWAYS ? () => { if (!visible || video.readyState < 2) return; video.loop = true; const p = video.play(); if (p) p.catch(() => {}); } : () => {};
    if (ALWAYS) {
      // no triggers: plays whenever visible (see setVisible)
    } else if (HOVER) {
      const item = box.closest('.alt') || box;
      // mouse leaves mid-turn: speed up smoothly until the turn closes, then rest at normal speed
      let ramp = 0;
      const accelerate = () => {
        if (video.paused) { video.playbackRate = 1; ramp = 0; return; }
        video.playbackRate = Math.min(6, video.playbackRate * 1.07 + 0.02);
        ramp = requestAnimationFrame(accelerate);
      };
      item.addEventListener('pointerenter', () => {
        // back in while the turn is speeding to its end: keep accelerating (no slow-down), the turn just finishes
        spinOnce();
      });
      item.addEventListener('pointerleave', () => { if (!video.paused && !ramp) ramp = requestAnimationFrame(accelerate); });
    } else {
      let lastSide = 0, lastSpin = -Infinity;
      const check = () => {
        const r = box.getBoundingClientRect();
        if (!r.height) return;
        const side = Math.sign((r.top + r.height / 2) - innerHeight / 2) || lastSide;
        if (lastSide && side !== lastSide && performance.now() - lastSpin >= 5000 && spinOnce()) lastSpin = performance.now();
        lastSide = side;
      };
      let queued = false;
      addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; check(); }); } }, { passive: true });
      addEventListener('resize', check);
      check();
    }
    video.addEventListener('playing', loop);

    // fetch the whole file first, so playback never stalls while the visitor scrolls
    ready.push(fetch(canvas.dataset.spin).then(r => r.blob()).then(blob => new Promise(res => {
      video.src = URL.createObjectURL(blob);
      video.addEventListener('loadeddata', () => { play(); res(); }, { once: true });   // already on screen (e.g. reload mid-page): start now
      video.addEventListener('error', res, { once: true });
      video.load();
    })).catch(() => {}));

    players.push({ box, video, play, setVisible: v => { visible = v; if (v) play(); else if (!video.paused) { video.pause(); if (!ALWAYS) video.currentTime = 0; } } });
  });

  // play while on screen, pause (invisibly) when scrolled away
  const io = new IntersectionObserver(es => es.forEach(e => {
    const pl = players.find(p => p.box === e.target);
    if (pl) pl.setVisible(e.isIntersecting);
  }), { rootMargin: '10% 0px' });
  players.forEach(p => io.observe(p.box));

  // iOS Low Power Mode blocks autoplay until the first interaction: retry then
  const retry = () => players.forEach(p => p.play());   // only plays the ones on screen
  ['touchstart', 'pointerdown', 'scroll', 'keydown'].forEach(ev => addEventListener(ev, retry, { passive: true, once: true }));

  window.HD_SPINS_READY = Promise.all(ready);
})();
