// Intro splash — scattered particles swirl inward and assemble into
// the actual "kiukukim" letterforms (sampled from real glyph shapes,
// not a blob), hold for a beat while the crisp wordmark snaps into
// focus over them, then everything bursts outward and fades to reveal
// the real page. Plays on every load/refresh. No-ops entirely on pages
// without a `.intro-splash` (only the home page has one).
(function () {
  var splash = document.querySelector('.intro-splash');
  if (!splash) return;

  var canvas = splash.querySelector('canvas');
  var ctx = canvas && canvas.getContext('2d');
  document.documentElement.classList.add('intro-lock');

  function finishInstantly() {
    splash.classList.add('intro-mark-visible', 'intro-done');
    document.documentElement.classList.remove('intro-lock');
    setTimeout(function () { splash.remove(); }, 550);
  }

  if (!ctx) { finishInstantly(); return; }

  var w = (canvas.width = window.innerWidth);
  var h = (canvas.height = window.innerHeight);

  // sample points from inside the wordmark's own glyph shapes (drawn
  // off-screen) so particles assemble into the real letterforms
  function sampleTextPoints(text) {
    var off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    var octx = off.getContext('2d');
    var fontSize = Math.min(w * 0.15, h * 0.32, 170);
    octx.fillStyle = '#000';
    octx.font = '800 ' + fontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    octx.fillText(text, w / 2, h / 2);
    var data = octx.getImageData(0, 0, w, h).data;
    var step = Math.max(3, Math.round(fontSize / 42));
    var pts = [];
    for (var y = 0; y < h; y += step) {
      for (var x = 0; x < w; x += step) {
        if (data[(y * w + x) * 4 + 3] > 120) pts.push({ x: x, y: y });
      }
    }
    return pts;
  }

  var targets = sampleTextPoints('kiukukim');
  if (!targets.length) { finishInstantly(); return; }

  // left-to-right sweep — particles destined for the left side of the
  // wordmark start converging first, right side lags slightly, so the
  // whole word reads as sweeping into formation
  var MAX_DELAY = 450;
  var particles = targets.map(function (pt) {
    var angle = Math.random() * Math.PI * 2;
    var dist = Math.random() * Math.max(w, h) * 0.7 + 120;
    return {
      x0: w / 2 + Math.cos(angle) * dist,
      y0: h / 2 + Math.sin(angle) * dist,
      tx: pt.x,
      ty: pt.y,
      curl: (Math.random() - 0.5) * 70,
      size: Math.random() * 1.6 + 1,
      phase: Math.random() * Math.PI * 2,
      delay: (pt.x / w) * MAX_DELAY + Math.random() * 80,
      vx: 0,
      vy: 0,
    };
  });

  var start = performance.now();
  // stretched out to a ~5s sequence with a proper build-up: rings
  // appear first over quiet scattered particles, then a longer swirl
  // into formation, a longer hold so the wordmark (and tagline) can
  // actually be read, then the burst reveal
  var PRELUDE_MS = 500;
  var CONVERGE_MS = 1700;
  var HOLD_MS = 1900;
  var BURST_MS = 900;
  var CONVERGE_SPAN = CONVERGE_MS - MAX_DELAY;
  var HOLD_FADE_MS = 380; // how fast the particle silhouette clears once the crisp mark appears
  var ringsShown = false;
  var markShown = false;
  var markShownAt = 0;
  var burstArmed = false;
  var done = false;

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  function draw(now) {
    var elapsed = now - start;

    if (!ringsShown) {
      ringsShown = true;
      splash.classList.add('intro-rings-visible');
    }

    if (elapsed < PRELUDE_MS) {
      // prelude — particles sit scattered with a faint idle shimmer
      // while the rings fade in behind them, building anticipation
      // before the swirl-in starts
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#0a0a0a';
      particles.forEach(function (p) {
        var jx = Math.sin(now * 0.003 + p.phase) * 3;
        var jy = Math.cos(now * 0.0026 + p.phase) * 3;
        ctx.globalAlpha = 0.18 + Math.sin(now * 0.004 + p.phase) * 0.08;
        ctx.beginPath();
        ctx.arc(p.x0 + jx, p.y0 + jy, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    } else if (elapsed < PRELUDE_MS + CONVERGE_MS) {
      // converge phase — a soft trail (translucent fill instead of a
      // hard clear) so the swirling motion leaves faint streaks,
      // reading as fluid simulation rather than static dots
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0a0a0a';

      var since = elapsed - PRELUDE_MS;
      particles.forEach(function (p) {
        var localElapsed = since - p.delay;
        var t = clamp01(localElapsed / CONVERGE_SPAN);
        var e = ease(t);
        var wobble = Math.sin(t * Math.PI);
        var dx = p.tx - p.x0, dy = p.ty - p.y0;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var px = -dy / len, py = dx / len;
        var x = p.x0 + dx * e + px * p.curl * wobble;
        var y = p.y0 + dy * e + py * p.curl * wobble;
        ctx.globalAlpha = (localElapsed < 0 ? 0.18 : 0.35 + e * 0.65);
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    } else if (elapsed < PRELUDE_MS + CONVERGE_MS + HOLD_MS) {
      // hold phase — the crisp DOM wordmark snaps into focus with an
      // overshoot bounce, followed shortly by the tagline. The canvas
      // silhouette quickly fades out of the way as it appears so the
      // two never sit on top of each other at full strength (they use
      // different font stacks and don't align glyph-for-glyph, so
      // overlapping them read as illegible ghosting)
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#0a0a0a';
      if (!markShown) {
        markShown = true;
        markShownAt = now;
        splash.classList.add('intro-mark-visible');
      }
      var fadeOut = clamp01((now - markShownAt) / HOLD_FADE_MS);
      var pAlpha = 1 - ease(fadeOut);
      if (pAlpha > 0.01) {
        ctx.globalAlpha = pAlpha;
        particles.forEach(function (p) {
          var jx = Math.sin(now * 0.006 + p.phase) * 0.6;
          var jy = Math.cos(now * 0.005 + p.phase) * 0.6;
          ctx.beginPath();
          ctx.arc(p.tx + jx, p.ty + jy, p.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      }
    } else {
      // burst phase — soft trail again as particles scatter outward
      // and fade, revealing the real page as the splash fades via CSS
      if (!burstArmed) {
        burstArmed = true;
        particles.forEach(function (p) {
          var angle = Math.random() * Math.PI * 2;
          var speed = Math.random() * 5 + 2;
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed;
        });
      }
      if (!done) {
        done = true;
        splash.classList.add('intro-done');
        document.documentElement.classList.remove('intro-lock');
        setTimeout(function () { splash.remove(); }, BURST_MS);
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0a0a0a';
      var bt = (elapsed - PRELUDE_MS - CONVERGE_MS - HOLD_MS) / BURST_MS;
      ctx.globalAlpha = Math.max(0, 1 - bt);
      particles.forEach(function (p) {
        p.tx += p.vx;
        p.ty += p.vy;
        p.vx *= 1.02;
        p.vy *= 1.02;
        ctx.beginPath();
        ctx.arc(p.tx, p.ty, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    if (elapsed < PRELUDE_MS + CONVERGE_MS + HOLD_MS + BURST_MS) {
      requestAnimationFrame(draw);
    }
  }
  requestAnimationFrame(draw);
})();

// Generative flow-field background — thin bright sweeping strands
// traced through a simple noise-like vector field, plus a scatter of
// glowing colored particles that ride the same field, for a fuller
// media-art / simulation feel (echoing the artist's own Houdini
// particle work) rather than just plain background lines. Redraws on
// resize; runs on requestAnimationFrame so the drift stays smooth.
(function () {
  const canvas = document.getElementById('flow-bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, phase = 0;
  let particles = [];

  const COLORS = ['#000000', '#2a2a2a', '#555555', '#000000'];

  function angleAt(x, y, t) {
    return (
      Math.sin(x * 0.0022 + y * 0.0012 + t) * 1.4 +
      Math.cos(y * 0.0026 - x * 0.0009 + t * 0.6) * 1.1
    );
  }

  function spawnParticle() {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      size: Math.random() * 1.7 + 0.9,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: Math.random() * 0.5 + 0.4,
    };
  }

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    const count = Math.min(120, Math.floor((w * h) / 13000));
    particles = Array.from({ length: count }, spawnParticle);
  }

  function drawStrands() {
    ctx.lineCap = 'round';
    const lines = 42;
    for (let i = 0; i < lines; i++) {
      // seeds spread along a wide diagonal band, echoing a sweeping
      // wave/dune composition rather than an even grid
      const seedX = (i / lines) * w * 1.6 - w * 0.3;
      const seedY = h * 0.1 + ((i * 37) % 100) / 100 * h * 0.7;

      let x = seedX, y = seedY;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = 100;
      for (let s = 0; s < steps; s++) {
        const a = angleAt(x, y, phase);
        x += Math.cos(a) * 9;
        y += Math.sin(a) * 9 + 1.1;
        ctx.lineTo(x, y);
        if (x < -120 || x > w + 120 || y > h + 120) break;
      }
      const alpha = 0.05 + (i % 5) * 0.018;
      ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      // ride the same vector field the strands are traced from, so
      // the particles feel like they belong to the same simulation
      const a = angleAt(p.x, p.y, phase);
      p.x += Math.cos(a) * 1.1;
      p.y += Math.sin(a) * 1.1 + 0.3;

      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      if (p.y < -20) p.y = h + 20;
      if (p.y > h + 20) p.y = -20;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    drawStrands();
    drawParticles();
  }

  window.addEventListener('resize', resize);
  resize();

  function loop() {
    phase += 0.0017;
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();

// Lightweight particle background — nod to Houdini particle sims.
// Particles gently drift, then scatter away from the cursor for a
// hands-on, simulation-like feel.
(function () {
  const canvas = document.getElementById('particle-bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, particles;
  let trail = [];
  const mouse = { x: -9999, y: -9999, active: false };
  const isHome = document.body.classList.contains('home-page');
  let lastSpawn = 0;

  const COLORS = ['#000000', '#333333', '#666666'];

  // spawns a few short-lived particles at the cursor position — the
  // "simulation" reacting to your hand, home page only
  function spawnBurst(x, y) {
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 1.6 + 0.4;
      trail.push({
        x, y,
        r: Math.random() * 2.2 + 1,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: 42,
        maxLife: 42,
      });
    }
  }

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function initParticles() {
    const count = Math.min(90, Math.floor((w * h) / 18000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.8 + 0.4,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: Math.random() * 0.5 + 0.2,
    }));
  }

  function step() {
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      // drift
      p.x += p.vx;
      p.y += p.vy;

      // cursor repulsion — particles scatter, then ease back to drift
      if (mouse.active) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const distSq = dx * dx + dy * dy;
        const radius = 140;
        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq) || 1;
          const force = (1 - dist / radius) * 1.8;
          p.x += (dx / dist) * force;
          p.y += (dy / dist) * force;
        }
      }

      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // mouse-trail burst particles (home page only) — spawned on
    // mousemove, drift outward from the cursor and fade away
    for (let i = trail.length - 1; i >= 0; i--) {
      const t = trail[i];
      t.x += t.vx;
      t.y += t.vy;
      t.vx *= 0.96;
      t.vy *= 0.96;
      t.life--;
      if (t.life <= 0) {
        trail.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fillStyle = t.color;
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife) * 0.9;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // faint connecting lines for nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(step);
  }

  window.addEventListener('resize', () => {
    resize();
    initParticles();
  });

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;

    if (isHome) {
      const now = performance.now();
      if (now - lastSpawn > 16) {
        spawnBurst(e.clientX, e.clientY);
        lastSpawn = now;
      }
    }
  });

  window.addEventListener('mouseleave', () => {
    mouse.active = false;
  });

  resize();
  initParticles();
  step();

  // expose the burst spawner so other scripts (e.g. the scroll-driven
  // home intro) can trigger a one-off particle poof at any coordinate
  window.__particleBurst = spawnBurst;
})();

// Custom cursor — a small dot with a lagging ring, grows over anything
// clickable. Skipped on touch devices.
(function () {
  if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

  const dot = document.createElement('div');
  const ring = document.createElement('div');
  dot.className = 'cursor-dot';
  ring.className = 'cursor-ring';
  document.body.appendChild(dot);
  document.body.appendChild(ring);
  document.documentElement.classList.add('has-custom-cursor');

  let mx = -100, my = -100;
  let rx = -100, ry = -100;

  window.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px)`;
    dot.style.opacity = '1';
    ring.style.opacity = '1';
  });

  document.addEventListener('mouseleave', () => {
    dot.style.opacity = '0';
    ring.style.opacity = '0';
  });

  function ease() {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    requestAnimationFrame(ease);
  }
  ease();

  const hoverables = 'a, button, .card, input, textarea, .tab-btn';
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(hoverables)) {
      ring.classList.add('cursor-ring--active');
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest(hoverables)) {
      ring.classList.remove('cursor-ring--active');
    }
  });
})();

// Scroll reveal — sections and cards fade/rise into place as they enter
// the viewport, applied automatically so every page benefits.
(function () {
  function setup() {
    const targets = document.querySelectorAll(
      '.hero, .section-head, .stat-card, .card, .about-grid, .contact-box, .coming-soon'
    );
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('in-view'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );

    // stagger by position within each grid row (3 columns) so a whole
    // row spins/settles in as a little cascade, not all at once
    const perContainer = new Map();
    targets.forEach((el) => {
      const parent = el.parentElement;
      const n = perContainer.get(parent) || 0;
      perContainer.set(parent, n + 1);
      el.classList.add('reveal');
      el.style.setProperty('--reveal-delay', ((n % 3) * 0.1) + 's');
      io.observe(el);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();

// Playful home intro — a short phrase greets you on load, grows large
// as you scroll, then transitions solid-filled -> outline-only ->
// blurred/scattered (reusing the particle-sim background for a burst
// right as it dissolves), while the kiukukim wordmark fades in behind
// it. Entirely scroll-scrubbed: position, not time, drives the motion.
(function () {
  var hero = document.querySelector('.kiukukim-hero');
  var pin = document.querySelector('.hero-pin');
  var phrase = document.querySelector('.intro-phrase');
  var fillEl = document.querySelector('.phrase-fill');
  var outlineEl = document.querySelector('.phrase-outline');
  var mark = document.querySelector('.kiukukim-mark');
  if (!hero || !pin || !phrase || !fillEl || !outlineEl || !mark) return;

  var burstFired = false;
  var ticking = false;

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function fireBurst() {
    var burst = window.__particleBurst;
    if (typeof burst !== 'function') return;
    var r = phrase.getBoundingClientRect();
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;
    var i = 0;
    var timer = setInterval(function () {
      burst(cx + (Math.random() - 0.5) * 180, cy + (Math.random() - 0.5) * 70);
      i++;
      if (i >= 14) clearInterval(timer);
    }, 22);
  }

  function update() {
    ticking = false;
    var scrollable = hero.offsetHeight - window.innerHeight;
    var rect = hero.getBoundingClientRect();
    var progress = scrollable > 0 ? clamp01(-rect.top / scrollable) : 0;

    // the whole line keeps growing through the first half of the runway
    var growth = Math.min(1, progress / 0.55);
    var scale = 1 + growth * 1.5;
    phrase.style.transform = 'scale(' + scale.toFixed(2) + ')';

    // stage 1 (0 - .22): solid filled text, fully opaque
    // stage 2 (.22 - .38): crossfades from filled to outline-only
    // stage 3 (.48 - .64): outline blurs + spreads apart and dissolves
    var fillOpacity = 1 - clamp01((progress - 0.22) / 0.16);
    var outlineRise = clamp01((progress - 0.22) / 0.16);
    var outlineFall = 1 - clamp01((progress - 0.48) / 0.16);
    var dissolve = clamp01((progress - 0.48) / 0.16);

    fillEl.style.opacity = fillOpacity.toFixed(2);
    outlineEl.style.opacity = (outlineRise * outlineFall).toFixed(2);
    outlineEl.style.filter = 'blur(' + (dissolve * 6).toFixed(1) + 'px)';
    outlineEl.style.letterSpacing = (dissolve * 10).toFixed(1) + 'px';

    // wordmark fades/scales in once the phrase has mostly dissolved
    var reveal = clamp01((progress - 0.55) / 0.35);
    mark.style.opacity = reveal.toFixed(2);
    mark.style.transform = 'scale(' + (0.85 + reveal * 0.15).toFixed(2) + ')';

    // one-shot particle burst right as the outline starts scattering
    if (!burstFired && progress > 0.5) {
      burstFired = true;
      fireBurst();
    }
    if (progress < 0.3) burstFired = false; // re-armed if scrolled back up
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
})();

// Interlude beats — short lines from the artist statement further down
// the home page, each its own scene with slow rings behind it. A
// gradient wipe flashes through as each one scrolls into view (like
// passing through a ring into the next scene), then its text or CTA
// settles into place. This replays every time — scrolling back up and
// down again re-triggers the wipe + reveal, rather than only once.
(function () {
  // animates a count element from 0 up to its data-count-to value,
  // re-armed every time its scene scrolls back into view
  function animateCount(el) {
    var target = parseInt(el.getAttribute('data-count-to'), 10) || 0;
    var duration = 900;
    var start = performance.now();
    if (el.__countRAF) cancelAnimationFrame(el.__countRAF);

    function tick(now) {
      var t = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(eased * target);
      if (t < 1) {
        el.__countRAF = requestAnimationFrame(tick);
      } else {
        el.textContent = target;
        el.__countRAF = null;
      }
    }
    el.__countRAF = requestAnimationFrame(tick);
  }

  function setup() {
    var scenes = document.querySelectorAll('.interlude');
    if (!scenes.length) return;

    if (!('IntersectionObserver' in window)) {
      scenes.forEach(function (el) { el.classList.add('in-view'); });
      document.querySelectorAll('[data-count-to]').forEach(function (el) {
        el.textContent = el.getAttribute('data-count-to');
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          entry.target.classList.toggle('in-view', entry.isIntersecting);
          if (entry.isIntersecting) {
            var countEls = entry.target.querySelectorAll('[data-count-to]');
            countEls.forEach(function (countEl) { animateCount(countEl); });
          }
        });
      },
      { threshold: 0.35 }
    );

    scenes.forEach(function (el) { io.observe(el); });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();

// Card tilt — a subtle 3D tilt that follows the cursor, artistic
// parallax feel without being distracting. Skipped on touch devices.
(function () {
  if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

  function setup() {
    document.querySelectorAll('.card').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          `perspective(700px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateY(-4px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();

// Page fade-in on load.
(function () {
  function setup() {
    document.documentElement.classList.add('page-ready');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();

// Only one gallery-card <video> plays at a time — starting one (via
// hover or its native controls) pauses whichever other one was
// playing. Ambient/background videos (e.g. the home page floating
// tiles) are excluded and just loop freely on their own.
(function () {
  function setup() {
    var videos = Array.prototype.slice.call(document.querySelectorAll('.card video'));
    if (!videos.length) return;

    videos.forEach(function (v) {
      v.muted = false;
      v.loop = true;
      v.playsInline = true;
    });

    var current = null;

    function setActive(v) {
      if (v === current) return;
      if (current) {
        current.pause();
        var prevCard = current.closest('.card');
        if (prevCard) prevCard.classList.remove('is-playing');
      }
      current = v;
      if (current) {
        var card = current.closest('.card');
        if (card) card.classList.add('is-playing');
      }
    }

    videos.forEach(function (v) {
      v.addEventListener('play', function () { setActive(v); });
      v.addEventListener('pause', function () {
        if (v === current) {
          current = null;
          var card = v.closest('.card');
          if (card) card.classList.remove('is-playing');
        }
      });
    });

    // Hovering a card plays its video (desktop only); leaving pauses it
    // — but ONLY if hover was what started it. If the person explicitly
    // pressed the native play button, moving the mouse away must not
    // yank playback out from under them.
    var hoverStarted = new WeakSet();

    if (!window.matchMedia('(hover: none), (pointer: coarse)').matches) {
      videos.forEach(function (v) {
        var card = v.closest('.card');
        if (!card) return;

        card.addEventListener('mouseenter', function () {
          if (!v.paused) return; // already playing (e.g. user pressed play) — leave it alone
          v.muted = false;
          var playPromise = v.play();
          if (playPromise && playPromise.catch) {
            playPromise.catch(function () {
              // browser blocked unmuted autoplay (no user gesture yet on
              // this page/session) — fall back to muted so it still
              // plays; once the person clicks anywhere, later hovers
              // will be allowed to play with sound
              v.muted = true;
              v.play().catch(function () {});
            });
          }
          hoverStarted.add(v);
        });

        card.addEventListener('mouseleave', function () {
          if (hoverStarted.has(v)) {
            hoverStarted.delete(v);
            v.pause();
          }
        });

        // a manual pause/seek via the native controls means hover no
        // longer "owns" this video's playback state
        v.addEventListener('pause', function () { hoverStarted.delete(v); });
      });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();

// Magnetic nav links / CTA — while hovering, the element leans toward
// the cursor within its own bounds, then springs back on mouseleave.
// Skipped on touch devices where there's no hover to react to.
(function () {
  if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

  function setup() {
    var targets = document.querySelectorAll('nav.links a, .interlude-cta-inner');
    var strength = 0.35;

    targets.forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * strength;
        var y = (e.clientY - r.top - r.height / 2) * strength;
        el.style.transition = 'transform 0.15s ease-out';
        el.style.transform = 'translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px)';
      });
      el.addEventListener('mouseleave', function () {
        el.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        el.style.transform = 'translate(0, 0)';
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();

// Draggable orbit rings — the ambient rings behind the hero/interlude
// text keep auto-spinning, but can also be grabbed and turned by hand
// like a real dial. Rotation is driven entirely from JS (not the CSS
// keyframe) so a drag offset and the auto-spin share one running
// angle — releasing continues smoothly from wherever it was left,
// with no jump back to where the keyframe loop "expected" to be.
// Skipped on touch devices so it doesn't fight page scrolling.
(function () {
  if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

  function setup() {
    var groups = document.querySelectorAll('.hero-orbit');
    if (!groups.length) return;

    var SPEED_A = 360 / 42000; // deg/ms — matches the original 42s loop
    var SPEED_B = -360 / 30000; // reverse — matches the original 30s loop

    groups.forEach(function (group) {
      var ringA = group.querySelector('.orbit-ring--a');
      var ringB = group.querySelector('.orbit-ring--b');
      if (!ringA || !ringB) return;

      // hand rotation over to JS entirely
      ringA.style.animation = 'none';
      ringB.style.animation = 'none';
      group.style.pointerEvents = 'auto';
      group.style.cursor = 'grab';

      var angleA = 0;
      var angleB = 0;
      var dragging = false;
      var lastAngle = 0;
      var lastTime = performance.now();

      function pointerAngle(clientX, clientY) {
        var r = group.getBoundingClientRect();
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height / 2;
        return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
      }

      function loop(now) {
        var dt = now - lastTime;
        lastTime = now;
        if (!dragging) {
          angleA += SPEED_A * dt;
          angleB += SPEED_B * dt;
        }
        ringA.style.transform = 'rotate(' + angleA.toFixed(2) + 'deg)';
        ringB.style.transform = 'rotate(' + angleB.toFixed(2) + 'deg)';
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);

      group.addEventListener('pointerdown', function (e) {
        dragging = true;
        group.style.cursor = 'grabbing';
        lastAngle = pointerAngle(e.clientX, e.clientY);
        if (group.setPointerCapture) group.setPointerCapture(e.pointerId);
      });

      group.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var a = pointerAngle(e.clientX, e.clientY);
        var delta = a - lastAngle;
        if (delta > 180) delta -= 360; // shortest-path wrap around
        if (delta < -180) delta += 360;
        angleA += delta;
        angleB += delta;
        lastAngle = a;
      });

      function release() {
        dragging = false;
        group.style.cursor = 'grab';
      }
      group.addEventListener('pointerup', release);
      group.addEventListener('pointercancel', release);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();

// Scroll progress line — a thin bar pinned to the top of every page,
// filling left-to-right as you scroll through the document. Injected
// entirely from JS so every page gets it without touching each HTML
// file's markup.
(function () {
  var bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  var fill = document.createElement('div');
  fill.className = 'scroll-progress-fill';
  bar.appendChild(fill);
  document.body.appendChild(bar);

  function update() {
    var doc = document.documentElement;
    var scrollTop = window.scrollY || doc.scrollTop || 0;
    var height = doc.scrollHeight - doc.clientHeight;
    var progress = height > 0 ? Math.min(1, scrollTop / height) : 0;
    fill.style.transform = 'scaleX(' + progress.toFixed(4) + ')';
  }
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

// Logo easter egg — click the wordmark five times in quick succession
// to set off a small particle celebration at its position, reusing
// the same burst spawner the hero's scroll-dissolve uses. Navigation
// is only suppressed on the triggering click so the fireworks are
// actually visible before the link takes you anywhere.
(function () {
  var logo = document.querySelector('.logo');
  if (!logo) return;

  var clicks = 0;
  var resetTimer = null;

  logo.addEventListener('click', function (e) {
    clicks++;
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(function () { clicks = 0; }, 1200);

    if (clicks < 5) return;
    clicks = 0;
    e.preventDefault();

    var burst = window.__particleBurst;
    if (typeof burst !== 'function') return;
    var r = logo.getBoundingClientRect();
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;
    var i = 0;
    var timer = setInterval(function () {
      burst(cx + (Math.random() - 0.5) * 220, cy + (Math.random() - 0.5) * 140);
      i++;
      if (i >= 24) clearInterval(timer);
    }, 16);
  });
})();

// VEX/wrangle-style code texture — a faint, fixed backdrop of
// original sample particle-sim code (not copied from any real
// project), line-numbered like an editor, tiled behind every page to
// nod at the tooling behind the actual work.
(function () {
  var LINES = [
    'float freq = chf("frequency");',
    'vector pos = @P * freq;',
    'vector n = curlnoise(pos + @Time * chf("speed"));',
    '@accel += n * chf("strength");',
    'v@v += @accel * @TimeInc;',
    '@P += v@v * @TimeInc;',
    'float age = @age / @life;',
    '@Cd = chramp("color_ramp", age);',
    '@pscale = fit(age, 0, 1, chf("size_start"), chf("size_end"));',
    'if (@age > @life) removepoint(0, @ptnum);',
    'vector up = {0, 1, 0};',
    'matrix3 xf = maketransform(up, normalize(v@v));',
    '@orient = quaternion(xf);',
    'int nearpts[] = nearpoints(0, @P, chf("radius"), 8);',
    'foreach (int pt; nearpts) {',
    '    vector d = @P - point(0, "P", pt);',
    '    @force += normalize(d) / max(length(d), 0.01);',
    '}',
    '@P += @force * chf("repulsion") * @TimeInc;',
    '// simulate — kiukukim / houdini particle system',
  ];

  // single-pass token match so the injected <span> markup from one
  // match is never re-scanned by a later alternative in the same regex
  var TOKEN_RE = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(@[A-Za-z_][A-Za-z0-9_]*)|\b(if|else|foreach|while|return|float|vector|matrix3|int)\b/gm;

  function highlight(line) {
    return line.replace(TOKEN_RE, function (match, comment, str, attr, kw) {
      if (comment) return '<span class="tok-comment">' + comment + '</span>';
      if (str) return '<span class="tok-str">' + str + '</span>';
      if (attr) return '<span class="tok-attr">' + attr + '</span>';
      if (kw) return '<span class="tok-kw">' + kw + '</span>';
      return match;
    });
  }

  // each row is its own element (not just a line of text joined by
  // "\n") so it can be typed into view individually — a clip-path wipe
  // staggered by row index, reading as the whole block being written
  // out line by line rather than appearing all at once
  function buildBlock(rowCount, startLine) {
    var out = [];
    for (var i = 0; i < rowCount; i++) {
      var n = String(startLine + i + 1);
      while (n.length < 3) n = '0' + n;
      var lineHtml = '<span class="tok-num">' + n + '</span>  ' + highlight(LINES[(startLine + i) % LINES.length]);
      out.push('<div class="code-row" style="--i:' + i + '">' + lineHtml + '</div>');
    }
    return out.join('');
  }

  var el = document.createElement('div');
  el.className = 'code-texture';
  el.setAttribute('aria-hidden', 'true');

  var inner = document.createElement('div');
  inner.className = 'code-texture-inner';
  el.appendChild(inner);
  document.body.insertBefore(el, document.body.firstChild);

  // as the page scrolls, the code feed scrolls past underneath it
  // (slower than the real content, for a parallax depth-of-field feel)
  // with line numbers climbing continuously — `inner` always holds two
  // blocks' worth of *sequential* lines starting at the current cycle,
  // and gets re-rendered one block further exactly when the transform
  // wraps back to 0, so the swap lands on an identical-looking frame
  // and never visibly jumps or resets
  var lineHeight = 20.6;
  var blockRows = Math.max(40, Math.ceil(window.innerHeight / lineHeight) + 14);
  var blockHeight = blockRows * lineHeight;
  var lastCycle = -1;
  var ticking = false;

  function rebuild(fromLine) {
    inner.innerHTML = buildBlock(blockRows * 2, fromLine);
  }

  function update() {
    ticking = false;
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    var scaledY = y * 0.4;
    var cycle = Math.floor(scaledY / blockHeight);
    if (cycle !== lastCycle) {
      lastCycle = cycle;
      rebuild(cycle * blockRows);
    }
    var offset = scaledY - cycle * blockHeight;
    inner.style.transform = 'translateY(-' + offset.toFixed(1) + 'px)';
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

// Side scene index — a fixed vertical strip of numbers on the home
// page (desktop only), mirroring the giant background numerals on
// each interlude. Highlights the current scene while scrolling and
// jumps to any scene on click. No-ops on pages without numbered
// scenes (every page but the home page).
(function () {
  var scenes = document.querySelectorAll('.interlude[data-scene]');
  if (!scenes.length) return;
  if (window.matchMedia('(max-width: 900px)').matches) return;

  var nav = document.createElement('div');
  nav.className = 'scene-index';
  nav.setAttribute('aria-hidden', 'true');

  var entries = [];
  scenes.forEach(function (scene) {
    var btn = document.createElement('button');
    btn.className = 'scene-index-dot';
    btn.type = 'button';
    btn.textContent = scene.getAttribute('data-scene');
    btn.addEventListener('click', function () {
      scene.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    nav.appendChild(btn);
    entries.push({ el: scene, btn: btn });
  });
  document.body.appendChild(nav);

  if (!('IntersectionObserver' in window)) return;

  var io = new IntersectionObserver(
    function (observed) {
      observed.forEach(function (entry) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].el === entry.target) {
            entries[i].btn.classList.toggle('active', entry.isIntersecting);
            break;
          }
        }
      });
    },
    { threshold: 0.5 }
  );
  scenes.forEach(function (s) { io.observe(s); });
})();

// Header height tracking — the nav links are always visible (styled
// as pill tabs on mobile, a plain row on desktop), and wrap onto a
// second line once the header gets too narrow to fit them inline.
// That makes the header's real height vary by viewport, so it's
// measured here and published as --header-h for every sticky offset
// (hero pin, work tabs) that needs to sit flush beneath it, instead
// of every one of them guessing a fixed pixel value.
(function () {
  var header = document.querySelector('header.nav');
  if (!header) return;

  function update() {
    document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
  }

  update();
  window.addEventListener('resize', update);
  // Pretendard loads async and can shift text metrics slightly once
  // it's ready, which can change header height by a few px
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(update);
  }
})();
