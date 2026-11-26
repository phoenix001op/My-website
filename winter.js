/* Winter theme: aurora, snow, fir trees and string lights.
   Everything is drawn by this file. To remove the theme, delete the
   winter.css and winter.js lines from the HTML pages. */
(() => {
  // Optional background video. Leave '' to use the built-in aurora.
  // Only add someone else's video if they have given you permission,
  // and fill in the credit so it shows on screen. Example:
  //   const AURORA_VIDEO = 'media/aurora.mp4';
  //   const VIDEO_CREDIT = 'Aurora: @dwcminh.ascii';
  const AURORA_VIDEO = '';
  const VIDEO_CREDIT = '';

  const el = (tag, cls) => {
    const e = document.createElement(tag);
    e.className = cls;
    return e;
  };
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- background ---------- */
  const sky = el('canvas', 'winter-layer');
  const front = el('canvas', 'winter-layer winter-front');
  sky.setAttribute('aria-hidden', 'true');
  front.setAttribute('aria-hidden', 'true');
  document.body.prepend(sky);
  document.body.append(front);
  const s = sky.getContext('2d');
  const f = front.getContext('2d');

  let video = null;
  if (AURORA_VIDEO) {
    video = el('video', 'winter-layer winter-video');
    Object.assign(video, { src: AURORA_VIDEO, muted: true, loop: true, playsInline: true, autoplay: !still.matches });
    video.addEventListener('error', () => { video.remove(); video = null; draw(); });
    document.body.prepend(video);
    if (VIDEO_CREDIT) {
      const c = el('div', 'winter-credit');
      c.textContent = VIDEO_CREDIT;
      document.body.append(c);
    }
  }

  let W = 0, H = 0, stars = [], flakes = [], trees = [];
  const rand = (a, b) => a + Math.random() * (b - a);

  function resize() {
    const d = Math.min(devicePixelRatio || 1, 1.5);
    const newW = innerWidth, newH = innerHeight;
    const widthChanged = newW !== W;
    W = newW; H = newH;
    for (const c of [sky, front]) {
      c.width = W * d; c.height = H * d;
      c.getContext('2d').setTransform(d, 0, 0, d, 0, 0);
    }
    glow.width = Math.ceil(W * SMALL); glow.height = Math.ceil(H * SMALL);
    bg = s.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#040a1c');
    bg.addColorStop(1, '#0d2440');
    // Phones resize when the address bar hides; keep the scene unless width changes.
    if (widthChanged) {
      stars = Array.from({ length: Math.min(180, W / 6) }, () =>
        ({ x: rand(0, W), y: Math.random(), r: rand(0.4, 1.3), p: rand(0, 6.3) }));
      flakes = Array.from({ length: Math.min(140, W / 9) }, () =>
        ({ x: rand(0, W), y: rand(0, H), r: rand(0.8, 2.8), p: rand(0, 6.3) }));
      trees = [];
      for (let x = -10; x < W + 20; x += rand(16, 38)) trees.push({ x, h: rand(34, 105) });
    }
    paintScene(d);
    draw();
  }

  const RIBBONS = [
    { y: 0.42, h: 0.34, color: '80,255,170', speed: 0.20, wave: 3.1, a: 0.36 },
    { y: 0.34, h: 0.26, color: '70,200,255', speed: -0.14, wave: 4.3, a: 0.24 },
    { y: 0.52, h: 0.22, color: '170,110,255', speed: 0.11, wave: 2.3, a: 0.22 }
  ];

  // The aurora is soft, so it is painted at quarter size and stretched.
  // Its gradients, the stars, trees and snowflake are each painted only once.
  const SMALL = 0.25, STEP = 8;
  const glow = document.createElement('canvas');
  const scene = document.createElement('canvas'); // fir trees and ground
  const a = glow.getContext('2d');

  const strips = RIBBONS.map(r => {
    const c = document.createElement('canvas');
    c.width = 1; c.height = 128;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, `rgba(${r.color},0)`);
    g.addColorStop(0.82, `rgba(${r.color},1)`);
    g.addColorStop(1, `rgba(${r.color},0)`);
    x.fillStyle = g;
    x.fillRect(0, 0, 1, 128);
    return c;
  });

  const flake = document.createElement('canvas');
  flake.width = flake.height = 16;
  {
    const x = flake.getContext('2d');
    x.fillStyle = 'rgba(240,248,255,0.75)';
    x.beginPath();
    x.arc(8, 8, 8, 0, 6.3);
    x.fill();
  }

  function paintScene(d) {
    scene.width = W * d; scene.height = 140 * d;
    const x = scene.getContext('2d');
    x.setTransform(d, 0, 0, d, 0, 0);
    x.fillStyle = '#06131f';
    for (const tr of trees) {
      for (let i = 0; i < 3; i++) {
        const top = 122 - tr.h + i * tr.h * 0.24;
        const half = tr.h * (0.14 + i * 0.06);
        x.beginPath();
        x.moveTo(tr.x, top);
        x.lineTo(tr.x + half, top + tr.h * 0.44);
        x.lineTo(tr.x - half, top + tr.h * 0.44);
        x.fill();
      }
    }
    x.fillStyle = '#b9d3ea';
    x.beginPath();
    x.moveTo(0, 140);
    for (let i = 0; i <= W + 20; i += 20) x.lineTo(i, 122 - 6 * Math.sin(i / 90));
    x.lineTo(W, 140);
    x.fill();
  }

  let t = 0, bg = null;
  function drawSky() {
    if (video) {
      s.clearRect(0, 0, W, H);
    } else {
      s.fillStyle = bg;
      s.fillRect(0, 0, W, H);

      s.fillStyle = '#e6f0ff';
      for (const st of stars) {
        s.globalAlpha = 0.35 + 0.3 * Math.sin(t * 1.5 + st.p);
        s.fillRect(st.x, st.y * H * 0.8, st.r, st.r);
      }

      a.clearRect(0, 0, W * SMALL, H * SMALL);
      a.globalCompositeOperation = 'lighter';
      RIBBONS.forEach((r, n) => {
        for (let x = 0; x < W + STEP; x += STEP) {
          const u = x / Math.max(W, 700);
          const base = H * (r.y + 0.07 * Math.sin(u * r.wave * 2 + t * r.speed * 2)
                                + 0.035 * Math.sin(u * r.wave * 5 - t * r.speed * 3));
          const tall = H * r.h * (0.75 + 0.25 * Math.sin(u * 17 + t * r.speed * 4));
          a.globalAlpha = r.a * (0.65 + 0.2 * Math.sin(u * 41 - t * 0.7) + 0.15 * Math.sin(u * 97 + t * 0.4));
          a.drawImage(strips[n], x * SMALL, (base - tall) * SMALL, STEP * SMALL, (tall + 14) * SMALL);
        }
      });

      s.globalAlpha = 1;
      s.globalCompositeOperation = 'lighter';
      s.drawImage(glow, 0, 0, W, H);
      s.globalCompositeOperation = 'source-over';
    }
    s.drawImage(scene, 0, H - 140, W, 140);
  }

  function drawSnow(dt) {
    f.clearRect(0, 0, W, H);
    for (const k of flakes) {
      k.y += (14 + k.r * 16) * dt;
      k.x += Math.sin(t + k.p) * 12 * dt;
      if (k.y > H + 4) { k.y = -4; k.x = rand(0, W); }
      f.drawImage(flake, k.x - k.r, k.y - k.r, k.r * 2, k.r * 2);
    }
  }

  function draw() { drawSky(); drawSnow(0); }

  let last = 0, raf = 0;
  function frame(now) {
    const dt = Math.min((now - last) / 1000 || 0, 0.05);
    last = now;
    t += dt;
    drawSky(); // every frame, so the aurora moves smoothly
    drawSnow(dt);
    raf = requestAnimationFrame(frame);
  }
  function setMotion() {
    cancelAnimationFrame(raf);
    last = 0;
    if (video) still.matches ? video.pause() : video.play().catch(() => {});
    if (still.matches) draw(); else raf = requestAnimationFrame(frame);
  }
  addEventListener('resize', resize);
  still.addEventListener('change', setMotion);
  resize();
  setMotion();

  /* ---------- string lights under the header ---------- */
  const header = document.querySelector('header');
  if (header) {
    const lights = el('div', 'winter-lights');
    lights.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 80; i++) lights.append(document.createElement('i'));
    header.append(lights);
  }
})();
