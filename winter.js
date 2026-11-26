/* Winter theme: aurora, snow, fir trees, string lights and music.
   Everything is drawn or played by this file. To remove the theme, delete the
   winter.css and winter.js lines from the HTML pages. */
(() => {
  // Optional background video. Leave '' to use the built-in aurora.
  // Only add someone else's video if they have given you permission,
  // and fill in the credit so it shows on screen. Example:
  //   const AURORA_VIDEO = 'media/aurora.mp4';
  //   const VIDEO_CREDIT = 'Aurora: @dwcminh.ascii';
  const AURORA_VIDEO = '';
  const VIDEO_CREDIT = '';

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} }
  };
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
    const d = Math.min(devicePixelRatio || 1, 2);
    const newW = innerWidth, newH = innerHeight;
    const widthChanged = newW !== W;
    W = newW; H = newH;
    for (const c of [sky, front]) {
      c.width = W * d; c.height = H * d;
      c.getContext('2d').setTransform(d, 0, 0, d, 0, 0);
    }
    // Phones resize when the address bar hides; keep the scene unless width changes.
    if (widthChanged) {
      stars = Array.from({ length: Math.min(180, W / 6) }, () =>
        ({ x: rand(0, W), y: Math.random(), r: rand(0.4, 1.3), p: rand(0, 6.3) }));
      flakes = Array.from({ length: Math.min(140, W / 9) }, () =>
        ({ x: rand(0, W), y: rand(0, H), r: rand(0.8, 2.8), p: rand(0, 6.3) }));
      trees = [];
      for (let x = -10; x < W + 20; x += rand(16, 38)) trees.push({ x, h: rand(34, 105) });
    }
    draw();
  }

  const RIBBONS = [
    { y: 0.42, h: 0.34, color: '80,255,170', speed: 0.20, wave: 3.1, a: 0.36 },
    { y: 0.34, h: 0.26, color: '70,200,255', speed: -0.14, wave: 4.3, a: 0.24 },
    { y: 0.52, h: 0.22, color: '170,110,255', speed: 0.11, wave: 2.3, a: 0.22 }
  ];

  let t = 0;
  function drawSky() {
    s.clearRect(0, 0, W, H);
    if (!video) {
      const bg = s.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#040a1c');
      bg.addColorStop(1, '#0d2440');
      s.fillStyle = bg;
      s.fillRect(0, 0, W, H);

      for (const st of stars) {
        s.fillStyle = `rgba(230,240,255,${0.35 + 0.3 * Math.sin(t * 1.5 + st.p)})`;
        s.fillRect(st.x, st.y * H * 0.8, st.r, st.r);
      }

      s.globalCompositeOperation = 'lighter';
      const step = 6;
      for (const r of RIBBONS) {
        for (let x = 0; x < W + step; x += step) {
          const u = x / Math.max(W, 700);
          const base = H * (r.y + 0.07 * Math.sin(u * r.wave * 2 + t * r.speed * 2)
                                + 0.035 * Math.sin(u * r.wave * 5 - t * r.speed * 3));
          const tall = H * r.h * (0.75 + 0.25 * Math.sin(u * 17 + t * r.speed * 4));
          const light = r.a * (0.65 + 0.2 * Math.sin(u * 41 - t * 0.7) + 0.15 * Math.sin(u * 97 + t * 0.4));
          const g = s.createLinearGradient(0, base - tall, 0, base + 14);
          g.addColorStop(0, `rgba(${r.color},0)`);
          g.addColorStop(0.82, `rgba(${r.color},${light})`);
          g.addColorStop(1, `rgba(${r.color},0)`);
          s.fillStyle = g;
          s.fillRect(x, base - tall, step, tall + 14);
        }
      }
      s.globalCompositeOperation = 'source-over';
    }

    // snowy ground and fir trees
    s.fillStyle = '#06131f';
    for (const tr of trees) {
      const y = H - 18;
      for (let i = 0; i < 3; i++) {
        const top = y - tr.h + i * tr.h * 0.24;
        const half = tr.h * (0.14 + i * 0.06);
        s.beginPath();
        s.moveTo(tr.x, top);
        s.lineTo(tr.x + half, top + tr.h * 0.44);
        s.lineTo(tr.x - half, top + tr.h * 0.44);
        s.fill();
      }
    }
    s.fillStyle = '#b9d3ea';
    s.beginPath();
    s.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 20) s.lineTo(x, H - 18 - 6 * Math.sin(x / 90));
    s.lineTo(W, H);
    s.fill();
  }

  function drawSnow(dt) {
    f.clearRect(0, 0, W, H);
    f.fillStyle = 'rgba(240,248,255,0.75)';
    for (const k of flakes) {
      k.y += (14 + k.r * 16) * dt;
      k.x += Math.sin(t + k.p) * 12 * dt;
      if (k.y > H + 4) { k.y = -4; k.x = rand(0, W); }
      f.beginPath();
      f.arc(k.x, k.y, k.r, 0, 6.3);
      f.fill();
    }
  }

  function draw() { drawSky(); drawSnow(0); }

  let last = 0, skyLast = 0, raf = 0;
  function frame(now) {
    const dt = Math.min((now - last) / 1000 || 0, 0.05);
    last = now;
    t += dt;
    if (now - skyLast > 40) { drawSky(); skyLast = now; } // 25 fps is plenty
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
    for (let i = 0; i < 60; i++) lights.append(document.createElement('i'));
    header.append(lights);
  }

  /* ---------- music: Jingle Bells (James Pierpont, 1857, public domain) ---------- */
  const NOTE = { C: 523.25, D: 587.33, E: 659.25, F: 698.46, G: 783.99 };
  // [note, length in beats]
  const TUNE = ('E1 E1 E2 E1 E1 E2 E1 G1 C1.5 D.5 E4 ' +
                'F1 F1 F1.5 F.5 F1 E1 E1 E.5 E.5 E1 D1 D1 E1 D2 G2 ' +
                'E1 E1 E2 E1 E1 E2 E1 G1 C1.5 D.5 E4 ' +
                'F1 F1 F1.5 F.5 F1 E1 E1 E.5 E.5 G1 G1 F1 D1 C4')
    .split(' ').map(n => [NOTE[n[0]], parseFloat(n.slice(1))]);
  const BEAT = 0.3;

  let ac = null, out = null, timer = 0, idx = 0, when = 0;

  function bell(freq, at, len) {
    for (const [mult, vol] of [[1, 0.12], [2.01, 0.035]]) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = freq * mult;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.25);
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + len + 0.3);
    }
  }
  function schedule() {
    if (ac.state !== 'running') return;
    if (when < ac.currentTime) when = ac.currentTime + 0.05;
    while (when < ac.currentTime + 1.2) {
      const [freq, beats] = TUNE[idx];
      bell(freq, when, beats * BEAT);
      when += beats * BEAT;
      idx = (idx + 1) % TUNE.length;
      if (idx === 0) when += 2; // short rest before it repeats
    }
  }

  const btn = el('button', 'winter-music');
  btn.type = 'button';
  let playing = false;
  const label = () => {
    btn.textContent = playing ? '🔔 Music on' : '🔕 Play music';
    btn.setAttribute('aria-pressed', String(playing));
  };
  function start() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    out = ac.createGain();
    out.gain.value = 0.7;
    out.connect(ac.destination);
    idx = 0; when = 0; playing = true;
    ac.resume().then(() => ac && schedule());
    timer = setInterval(schedule, 250);
    label();
  }
  function stop() {
    clearInterval(timer);
    if (ac) ac.close();
    ac = null; playing = false;
    label();
  }
  btn.addEventListener('click', () => {
    if (playing) { stop(); store.set('winter-music', 'off'); }
    else { start(); store.set('winter-music', 'on'); }
  });
  label();
  document.body.append(btn);

  // Browsers block sound until the visitor touches the page. If they turned music
  // on before, resume it on their first tap or key press on the next page.
  if (store.get('winter-music') === 'on') {
    const resume = e => {
      removeEventListener('pointerdown', resume);
      removeEventListener('keydown', resume);
      if (!playing && e.target !== btn) start();
    };
    addEventListener('pointerdown', resume);
    addEventListener('keydown', resume);
  }
})();
