// ===================================================================
// Warband Arena - canvas effect engine. Particles, glowing trails,
// bolts and beams drawn on one canvas over the table, only while
// something is alive on it.
// ===================================================================
(function (root) {
  "use strict";
  const W = 1280, H = 760, MAX = 900;
  let cv = null, ctx = null, q = 1, running = false, last = 0;
  let parts = [], items = [], flash = { a: 0, c: "#ffffff" };
  let speed = () => 1;

  function ensure(host) {
    if (cv && cv.isConnected) return true;
    host = host || document.querySelector("#stage .shake-root") || document.getElementById("stage");
    if (!host) return false;
    cv = document.createElement("canvas");
    cv.id = "fxCanvas";
    q = Math.min(2, root.devicePixelRatio || 1);
    cv.width = W * q; cv.height = H * q;
    host.appendChild(cv);
    ctx = cv.getContext("2d");
    return true;
  }

  // soft round sprites, one per colour
  const sprites = new Map();
  function glowSprite(color) {
    let s = sprites.get(color);
    if (s) return s;
    s = document.createElement("canvas"); s.width = s.height = 64;
    const g = s.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, color); gr.addColorStop(0.35, color); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    // white-hot centre
    const c2 = g.createRadialGradient(32, 32, 0, 32, 32, 12); c2.addColorStop(0, "rgba(255,255,255,.55)"); c2.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = c2; g.fillRect(0, 0, 64, 64);
    sprites.set(color, s);
    return s;
  }
  const softSprites = new Map();
  function softSprite(color) {
    let s = softSprites.get(color);
    if (s) return s;
    s = document.createElement("canvas"); s.width = s.height = 64;
    const g = s.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, color); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    softSprites.set(color, s);
    return s;
  }

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  // p: { x, y, vx, vy, g, drag, life, size, size2, color, alpha, type, rot, vr, add, w }
  // pictures the person brings (data URLs): loaded once, drawn once ready
  const IMG = new Map();
  function imgOf(src) { if (!src) return null; let im = IMG.get(src); if (!im) { im = new Image(); im.src = src; IMG.set(src, im); } return im.complete && im.naturalWidth ? im : null; }
  function drawImg(src, x, y, size, rot, alpha) { const im = imgOf(src); if (!im) return false; const k = im.naturalHeight / im.naturalWidth, w = size, h = size * k; ctx.save(); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = alpha == null ? ctx.globalAlpha : alpha; ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore(); return true; }
  function emit(p) {
    if (parts.length >= MAX) parts.shift();
    p.t = 0; p.alpha = p.alpha == null ? 1 : p.alpha; p.size2 = p.size2 == null ? p.size * 0.2 : p.size2;
    p.drag = p.drag || 0; p.g = p.g || 0; p.rot = p.rot || 0; p.vr = p.vr || 0; p.add = p.add !== false;
    parts.push(p); start();
  }
  function burst(b, n, o) {
    for (let i = 0; i < n; i++) {
      const ang = o.ang != null ? o.ang + rnd(-o.spread || 0, o.spread || 0) : rnd(0, Math.PI * 2), sp = rnd(o.sp[0], o.sp[1]);
      emit({ x: b.x + rnd(-(o.jit || 0), o.jit || 0), y: b.y + rnd(-(o.jit || 0), o.jit || 0), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp + (o.vy || 0), g: o.g, drag: o.drag, life: rnd(o.life[0], o.life[1]),
        size: rnd(o.size[0], o.size[1]), size2: o.size2, color: pick(o.colors), alpha: o.alpha, type: o.type || "glow", add: o.add, vr: o.vr ? rnd(-o.vr, o.vr) : 0, rot: rnd(0, 6.28), w: o.w, img: o.img });
    }
  }
  function add(it) { it.t = 0; items.push(it); start(); return it; }
  function start() {
    if (running || !ensure()) return;
    running = true; last = performance.now();
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- drawables
  function jagged(a, b, rough, n) {
    const pts = [[a.x, a.y]], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    for (let i = 1; i < n; i++) { const t = i / n, off = rnd(-rough, rough) * Math.sin(Math.PI * t); pts.push([a.x + dx * t + nx * off, a.y + dy * t + ny * off]); }
    pts.push([b.x, b.y]);
    return pts;
  }
  function strokePts(pts, w, color, alpha) {
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
  }
  function bolt(a, b, color, life = 0.3) {
    let main = null, branches = [], next = 0;
    return add({ life, add: true,
      draw(t) {
        if (t >= next) {
          next = t + 0.045;
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          main = jagged(a, b, Math.min(42, len * 0.12), Math.max(6, (len / 26) | 0));
          branches = [];
          for (let i = 0; i < 3; i++) { const k = 2 + ((Math.random() * (main.length - 4)) | 0), p = main[k]; const ang = Math.atan2(b.y - a.y, b.x - a.x) + rnd(-1.1, 1.1), l = rnd(30, 70);
            branches.push(jagged({ x: p[0], y: p[1] }, { x: p[0] + Math.cos(ang) * l, y: p[1] + Math.sin(ang) * l }, 10, 4)); }
        }
        const fade = 1 - t / life, fl = 0.6 + Math.random() * 0.4;
        strokePts(main, 18, color, 0.16 * fade * fl); strokePts(main, 8, color, 0.5 * fade * fl); strokePts(main, 3, "#ffffff", fade * fl);
        for (const br of branches) { strokePts(br, 5, color, 0.35 * fade); strokePts(br, 1.6, "#ffffff", 0.8 * fade); }
      } });
  }
  function ring(b, color, r1, life, o = {}) {
    return add({ life, add: true, draw(t) {
      const u = Math.max(0, Math.min(1, t / life)), e = 1 - Math.pow(1 - u, 3), r = Math.max(0.5, o.inward ? r1 * (1 - e) + 4 : 6 + r1 * e);
      ctx.globalAlpha = (1 - u) * (o.alpha || 0.9); ctx.strokeStyle = color; ctx.lineWidth = (o.w || 5) * (1 - u) + 1;
      ctx.beginPath(); ctx.ellipse(b.x, b.y, r, r * (o.flat || 1), 0, 0, Math.PI * 2); ctx.stroke();
    } });
  }
  function beam(b, color, life, top = 0) {
    return add({ life, add: true, draw(t) {
      const u = t / life, wv = 64 * Math.sin(Math.PI * Math.min(1, u * 1.4)) + 4, h = b.y + 50 - top;
      const g = ctx.createLinearGradient(b.x - wv, 0, b.x + wv, 0);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.35, color); g.addColorStop(0.5, "#ffffff"); g.addColorStop(0.65, color); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = (1 - u) * 0.9; ctx.fillStyle = g; ctx.fillRect(b.x - wv, top, wv * 2, h);
      ctx.globalAlpha = (1 - u) * 0.6; ctx.drawImage(glowSprite(color), b.x - 70, b.y - 50, 140, 100);
    } });
  }
  function rays(b, color, life, n = 12, len = 110) {
    const off = Math.random() * 6;
    return add({ life, add: true, draw(t) {
      const u = t / life;
      ctx.globalAlpha = (1 - u) * 0.8; ctx.strokeStyle = color; ctx.lineCap = "round";
      for (let i = 0; i < n; i++) { const ang = off + (i / n) * Math.PI * 2 + u * 0.6, r0 = 18 + u * 20, r1 = r0 + len * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, u * 1.6)));
        ctx.lineWidth = 4 * (1 - u) + 1; ctx.beginPath(); ctx.moveTo(b.x + Math.cos(ang) * r0, b.y + Math.sin(ang) * r0); ctx.lineTo(b.x + Math.cos(ang) * r1, b.y + Math.sin(ang) * r1); ctx.stroke(); }
    } });
  }
  function slash(b, delay, flip) {
    const ang = (flip ? -1 : 1) * 0.9 + rnd(-0.15, 0.15), off = rnd(-14, 14);
    return add({ life: 0.42 + delay, add: true, draw(t) {
      const u = (t - delay) / 0.42; if (u < 0) return;
      const sweep = Math.min(1, u * 2.4), fade = u < 0.45 ? 1 : 1 - (u - 0.45) / 0.55;
      ctx.save(); ctx.translate(b.x + off, b.y); ctx.rotate(ang);
      for (const [w, c, a] of [[14, "#ffb0b0", 0.25], [6, "#ffe6e6", 0.6], [2.5, "#ffffff", 1]]) {
        ctx.globalAlpha = a * fade; ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(0, 70, 92, -Math.PI / 2 - 0.75, -Math.PI / 2 - 0.75 + 1.5 * sweep); ctx.stroke();
      }
      ctx.restore();
    } });
  }
  // a projectile on a curved path; draw(x, y, ang, t) and trail(x, y, dt) are called each frame
  function projectile(a, b, dur, arc, draw, trail) {
    return new Promise((res) => {
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2 - arc;
      let px = a.x, py = a.y;
      add({ life: dur, add: true, onEnd: res, draw(t, dt) {
        const u0 = Math.min(1, t / dur), u = u0 * (0.75 + 0.25 * u0);
        const x = (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * cx + u * u * b.x, y = (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * cy + u * u * b.y;
        const ang = Math.atan2(y - py, x - px);
        if (trail && dt > 0) trail(x, y, dt, ang);
        draw(x, y, ang, t);
        px = x; py = y;
      } });
    });
  }
  const wait = (s) => new Promise((r) => add({ life: s, add: true, onEnd: r, draw() {} }));
  // painted sprites (ui-art/), loaded once
  const IMGS = {};
  function sprite(name) { if (!IMGS[name]) { const i = new Image(); i.src = "ui-art/" + name; IMGS[name] = i; } return IMGS[name].complete && IMGS[name].naturalWidth ? IMGS[name] : null; }
  if (typeof Image !== "undefined") setTimeout(() => { sprite("fx-arrow.png"); sprite("fx-meat.png"); }, 0);
  function drawSprite(name, x, y, size, rot, alpha = 1) { const im = sprite(name); if (!im) return false; ctx.save(); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot); const k = size / Math.max(im.naturalWidth, im.naturalHeight); ctx.drawImage(im, -im.naturalWidth * k / 2, -im.naturalHeight * k / 2, im.naturalWidth * k, im.naturalHeight * k); ctx.restore(); ctx.globalCompositeOperation = "lighter"; return true; }

  // ---- smooth toolkit: easing, shapes and a ribbon trail. Everything moves every frame (no flipbooks).
  const clamp01 = (t) => Math.max(0, Math.min(1, t));
  const eOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
  const eBack = (t, k = 1.9) => { t = clamp01(t) - 1; return Math.max(0, 1 + (k + 1) * t * t * t + k * t * t); };
  const eInOut = (t) => { t = clamp01(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  const bell = (t) => Math.sin(Math.PI * clamp01(t)); // 0 -> 1 -> 0
  const GROUND = 58; // from a minion's centre to the table under it
  function solid(fn) { ctx.save(); ctx.globalCompositeOperation = "source-over"; fn(); ctx.restore(); }
  // shapes
  function star4(x, y, r, rot, color, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const ang = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.28 : r; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function teardrop(x, y, vx, vy, s, color, a) { // stretched along its velocity
    const sp = Math.hypot(vx, vy), ang = Math.atan2(vy, vx), st = 1 + Math.min(2.4, sp / 220);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(s * st, 0); ctx.quadraticCurveTo(0, s, -s * 0.9, 0); ctx.quadraticCurveTo(0, -s, s * st, 0); ctx.fill(); ctx.restore();
  }
  function leaf(x, y, s, rot, color, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(-s, 0); ctx.quadraticCurveTo(0, -s * 0.7, s, 0); ctx.quadraticCurveTo(0, s * 0.7, -s, 0); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-s * 0.8, 0); ctx.lineTo(s * 0.8, 0); ctx.stroke(); ctx.restore();
  }
  function flake(x, y, s, rot, color, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, s * 0.18); ctx.lineCap = "round"; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const ang = i * Math.PI / 3, c = Math.cos(ang), d = Math.sin(ang); ctx.moveTo(0, 0); ctx.lineTo(c * s, d * s); ctx.moveTo(c * s * 0.55 + d * s * 0.22, d * s * 0.55 - c * s * 0.22); ctx.lineTo(c * s * 0.75, d * s * 0.75); }
    ctx.stroke(); ctx.restore();
  }
  function flower(x, y, s, color, heart, a, rot = 0) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) { ctx.rotate(Math.PI * 2 / 5); ctx.beginPath(); ctx.ellipse(0, -s * 0.55, s * 0.36, s * 0.55, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = heart; ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function blob(x, y, r, t, wob, color, a, flat = 1) { // a jelly circle that wobbles
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i <= 28; i++) { const ang = (i / 28) * Math.PI * 2, rr = r * (1 + wob * (Math.sin(ang * 3 + t * 9) * 0.6 + Math.sin(ang * 5 - t * 13) * 0.4)); ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * flat); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // a tapered ribbon following a moving point
  function ribbon(n = 14) {
    const pts = [];
    return {
      push(x, y) { pts.unshift([x, y]); if (pts.length > n) pts.pop(); },
      draw(w, c1, c2, a = 1) {
        if (pts.length < 2) return;
        for (let i = 0; i < pts.length - 1; i++) { const u = i / (pts.length - 1); ctx.globalAlpha = a * (1 - u); ctx.strokeStyle = u < 0.35 ? c1 : c2; ctx.lineWidth = Math.max(0.5, w * (1 - u)); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke(); }
      } };
  }
  // a projectile with a ribbon: core(x, y, ang, t, u) draws the head
  function comet(a, b, dur, arc, core, o = {}) {
    const rb = ribbon(o.len || 14);
    return projectile(a, b, dur, arc, (x, y, ang, t) => { rb.push(x, y); if (o.ribbon !== false) rb.draw(o.w || 16, o.c1 || "#ffffff", o.c2 || "#ffd25a", o.ra || 0.8); core(x, y, ang, t, clamp01(t / dur)); }, o.trail);
  }

  // ---------------------------------------------------------------- styles
  const glow = (x, y, color, size, alpha = 1) => { ctx.globalAlpha = alpha; const s = glowSprite(color); ctx.drawImage(s, x - size, y - size, size * 2, size * 2); };
  const S = {
    // ---- the looks a card can pick: drawn live, smooth and a bit cartoonish; plus the arrow and the meat
    fire: {
      travel: (a, b) => comet(a, b, 0.42, 46, (x, y, ang, t) => {
        for (let i = 0; i < 5; i++) { const k = i / 5, an = t * 22 + i * 1.3; glow(x - Math.cos(ang) * (8 + k * 18) + Math.cos(an) * 5, y - Math.sin(ang) * (8 + k * 18) + Math.sin(an) * 5, i % 2 ? "#ff7a2a" : "#ffb02a", 18 - k * 9, 0.85); }
        glow(x, y, "#ff7a2a", 30, 0.9); glow(x, y, "#fff2b0", 13, 1);
      }, { w: 20, c1: "#ffd25a", c2: "#ff5a2a", len: 12, trail: (x, y) => emit({ x: x + rnd(-5, 5), y: y + rnd(-5, 5), vx: rnd(-20, 20), vy: rnd(-70, -30), life: rnd(0.35, 0.6), size: rnd(3, 5), size2: 1, color: pick(["#ffd25a", "#ff9a3a"]), drag: 1.5, wob: 10, wf: 14 }) }),
      impact: (b) => {
        flash.a = Math.max(flash.a, 0.12); flash.c = "#ffb24a";
        add({ life: 0.5, add: true, draw(t) { const u = t / 0.5, r = 52 * eBack(u * 2.2) * (1 - eOut((u - 0.4) / 0.6) * 0.6); ctx.globalAlpha = 1 - eOut(u); ctx.drawImage(glowSprite("#ff9a3a"), b.x - r * 1.6, b.y - r * 1.6, r * 3.2, r * 3.2); ctx.globalAlpha = (1 - u) * 0.9; ctx.drawImage(glowSprite("#fff2b0"), b.x - r * 0.7, b.y - r * 0.7, r * 1.4, r * 1.4); } });
        for (let i = 0; i < 10; i++) { const ang = (i / 10) * Math.PI * 2 + rnd(-0.15, 0.15), sp = rnd(220, 300); emit({ x: b.x, y: b.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 40, drag: 4.5, life: rnd(0.42, 0.55), size: rnd(10, 14), size2: 3, color: pick(["#ffb02a", "#ff7a2a", "#ffd25a"]), type: "drop" }); }
        ring({ x: b.x, y: b.y + GROUND - 10 }, "#ffb24a", 96, 0.5, { w: 6, flat: 0.32 });
        for (let i = 0; i < 16; i++) emit({ x: b.x + rnd(-26, 26), y: b.y + rnd(-10, 20), vx: rnd(-30, 30), vy: rnd(-150, -70), drag: 1.2, life: rnd(0.7, 1.2), size: rnd(2.5, 4.5), size2: 1, color: pick(["#ffd25a", "#ffb02a", "#ffffff"]), wob: 14, wf: rnd(8, 14) });
        for (let i = 0; i < 6; i++) emit({ x: b.x + rnd(-24, 24), y: b.y + rnd(-6, 14), vx: rnd(-25, 25), vy: rnd(-60, -30), drag: 0.8, life: rnd(0.8, 1.2), size: rnd(12, 18), size2: rnd(34, 46), color: "rgba(70,55,60,.9)", alpha: 0.42, add: false, type: "smoke" });
      } },
    lightning: {
      travel: async (a, b) => {
        bolt(a, b, "#7fa8ff", 0.3); flash.a = Math.max(flash.a, 0.12); flash.c = "#cfe0ff";
        await comet(a, b, 0.14, 0, (x, y) => { glow(x, y, "#7fa8ff", 26, 1); glow(x, y, "#ffffff", 10, 1); }, { w: 10, c1: "#ffffff", c2: "#7fa8ff", len: 8 });
      },
      impact: (b) => {
        flash.a = Math.max(flash.a, 0.16); flash.c = "#bcd2ff";
        let arcs = [], next = 0;
        add({ life: 0.6, add: true, draw(t) {
          const u = t / 0.6, R = 26 + 34 * eOut(u * 1.8), fade = 1 - eInOut(u);
          if (t >= next) { next = t + 0.04; arcs = []; for (let i = 0; i < 5; i++) { const a0 = rnd(0, 6.28), a1 = a0 + rnd(0.8, 1.8); arcs.push(jagged({ x: b.x + Math.cos(a0) * R, y: b.y + Math.sin(a0) * R }, { x: b.x + Math.cos(a1) * R, y: b.y + Math.sin(a1) * R }, 12, 6)); } }
          ctx.globalAlpha = fade * 0.9; ctx.drawImage(glowSprite("#5a8aff"), b.x - R * 1.5, b.y - R * 1.5, R * 3, R * 3);
          for (const p of arcs) { strokePts(p, 6, "#7fa8ff", 0.45 * fade); strokePts(p, 2, "#ffffff", fade); }
          glow(b.x, b.y, "#ffffff", 12 * (1 - u) + 4, fade);
        } });
        ring(b, "#bcd2ff", 80, 0.35, { w: 5 }); ring(b, "#7fa8ff", 120, 0.55, { w: 3 });
        burst(b, 18, { sp: [240, 520], life: [0.18, 0.32], size: [2, 3], colors: ["#ffffff", "#bcd2ff"], type: "line", w: 2, drag: 5 });
        for (let i = 0; i < 6; i++) emit({ x: b.x + rnd(-40, 40), y: b.y + rnd(-40, 30), vx: rnd(-20, 20), vy: rnd(-40, 10), life: rnd(0.4, 0.7), size: rnd(7, 11), size2: 1, color: pick(["#ffffff", "#bcd2ff"]), type: "star", vr: rnd(-6, 6) });
      } },
    frost: {
      travel: (a, b) => comet(a, b, 0.38, 24, (x, y, ang, t) => {
        glow(x, y, "#8fd3ff", 24, 0.6);
        solid(() => { ctx.translate(x, y); ctx.rotate(ang + t * 10); const g = ctx.createLinearGradient(-16, -16, 16, 16); g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#5ab0f0"); ctx.fillStyle = g; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(9, 0); ctx.lineTo(0, 17); ctx.lineTo(-9, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); });
      }, { w: 10, c1: "#ffffff", c2: "#8fd3ff", len: 10, trail: (x, y) => { if (Math.random() < 0.5) emit({ x, y, vx: rnd(-20, 20), vy: rnd(-10, 30), life: rnd(0.5, 0.8), size: rnd(4, 7), size2: 2, color: "#e8f8ff", type: "flake", vr: rnd(-4, 4), drag: 1.5 }); } }),
      impact: (b) => {
        const g0 = { x: b.x, y: b.y + GROUND - 6 }, spikes = [];
        for (let i = 0; i < 7; i++) spikes.push({ ang: -Math.PI / 2 + (i - 3) * 0.32 + rnd(-0.08, 0.08), len: (i === 3 ? 92 : 70 - Math.abs(i - 3) * 8) + rnd(-6, 6), w: rnd(9, 13), d: Math.abs(i - 3) * 0.035 });
        add({ life: 0.95, add: false, draw(t) {
          const u = t / 0.95;
          solid(() => { for (const sp of spikes) {
            const g = eBack((t - sp.d) / 0.22, 2.4), shatter = clamp01((u - 0.62) / 0.2); if (g <= 0) continue;
            const L = sp.len * g, c = Math.cos(sp.ang), s2 = Math.sin(sp.ang), nx = -s2, ny = c;
            ctx.globalAlpha = 1 - shatter; const gr = ctx.createLinearGradient(g0.x, g0.y, g0.x + c * L, g0.y + s2 * L); gr.addColorStop(0, "#5ab0f0"); gr.addColorStop(0.6, "#bfeaff"); gr.addColorStop(1, "#ffffff");
            ctx.fillStyle = gr; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(g0.x + nx * sp.w, g0.y + ny * sp.w); ctx.lineTo(g0.x + c * L, g0.y + s2 * L); ctx.lineTo(g0.x - nx * sp.w, g0.y - ny * sp.w); ctx.closePath(); ctx.fill(); ctx.stroke();
            if (!sp.broke && u > 0.62) { sp.broke = true; for (let k = 0; k < 4; k++) { const f = rnd(0.2, 1); emit({ x: g0.x + c * L * f, y: g0.y + s2 * L * f, vx: rnd(-160, 160), vy: rnd(-220, -60), g: 900, life: rnd(0.5, 0.8), size: rnd(4, 7), size2: 3, color: pick(["#ffffff", "#bfeaff", "#8fd3ff"]), type: "shard", vr: rnd(-12, 12), add: false }); } }
          } });
        } });
        ring(g0, "#d8f4ff", 90, 0.6, { w: 5, flat: 0.32 });
        for (let i = 0; i < 10; i++) emit({ x: b.x + rnd(-50, 50), y: b.y + rnd(-60, 0), vx: rnd(-15, 15), vy: rnd(20, 50), life: rnd(0.9, 1.3), size: rnd(5, 9), size2: 3, color: "#ffffff", type: "flake", vr: rnd(-3, 3), wob: 8, wf: 5 });
        for (let i = 0; i < 6; i++) emit({ x: g0.x + rnd(-40, 40), y: g0.y + rnd(-10, 0), vx: rnd(-40, 40), vy: rnd(-20, -5), life: rnd(0.8, 1.2), size: rnd(14, 20), size2: 40, color: "rgba(210,240,255,.9)", alpha: 0.35, add: false, type: "smoke", drag: 1 });
      } },
    water: {
      travel: (a, b) => comet(a, b, 0.44, 60, (x, y, ang, t) => {
        glow(x, y, "#2a78d0", 26, 0.5);
        solid(() => { blob(x, y, 14, t, 0.12, "#3a90e8", 0.95); blob(x - 3, y - 4, 6, t, 0.1, "#cfefff", 0.85); });
      }, { ribbon: false, trail: (x, y) => { if (Math.random() < 0.6) emit({ x, y, vx: rnd(-30, 30), vy: rnd(-40, 0), g: 700, life: rnd(0.35, 0.55), size: rnd(3, 5), size2: 2, color: pick(["#8fd3ff", "#cfefff"]), type: "drop", add: false }); } }),
      impact: (b) => {
        const g0 = { x: b.x, y: b.y + GROUND - 8 };
        add({ life: 0.55, add: false, draw(t) { const u = t / 0.55, h = 70 * bell(u * 1.1), w = 16 * (1 - u * 0.5); solid(() => { ctx.globalAlpha = 0.9 * (1 - u); const gr = ctx.createLinearGradient(0, g0.y - h, 0, g0.y); gr.addColorStop(0, "#ffffff"); gr.addColorStop(1, "#3a90e8"); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(g0.x, g0.y - h / 2, w, h / 2 + 2, 0, 0, Math.PI * 2); ctx.fill(); }); } });
        for (let i = 0; i < 18; i++) { const ang = -Math.PI / 2 + rnd(-1.1, 1.1), sp = rnd(220, 420); emit({ x: g0.x + rnd(-10, 10), y: g0.y - 6, vx: Math.cos(ang) * sp * 0.8, vy: Math.sin(ang) * sp, g: 1100, life: rnd(0.5, 0.8), size: rnd(4, 7), size2: 3, color: pick(["#5ab8ff", "#8fd3ff", "#ffffff"]), type: "drop", add: false }); }
        for (let i = 0; i < 3; i++) ring({ x: g0.x, y: g0.y }, i ? "#8fd3ff" : "#ffffff", 70 + i * 26, 0.6 + i * 0.15, { w: 4 - i, flat: 0.3 });
      } },
    shadow: {
      travel: (a, b) => comet(a, b, 0.5, 80, (x, y, ang, t) => {
        glow(x, y, "#8a5cff", 28, 0.7);
        solid(() => { blob(x, y, 13, t, 0.16, "#1a0b33", 1); ctx.globalAlpha = 0.9; ctx.fillStyle = "#c9a6ff"; ctx.beginPath(); ctx.arc(x - 4, y - 2, 2.2, 0, 7); ctx.arc(x + 4, y - 2, 2.2, 0, 7); ctx.fill(); });
      }, { w: 12, c1: "#3a1a6a", c2: "#8a5cff", len: 16, ra: 0.7 }),
      impact: (b) => {
        const lobes = Array.from({ length: 9 }, () => rnd(0.75, 1.3));
        add({ life: 1.0, add: false, draw(t) {
          const u = t / 1.0, r = 46 * eBack(u * 2.6, 1.4) * (1 - eOut((u - 0.6) / 0.4));
          if (r <= 0.5) return;
          solid(() => { ctx.globalAlpha = 0.92; ctx.fillStyle = "#1a0b33"; ctx.beginPath(); for (let i = 0; i <= 36; i++) { const ang = (i / 36) * Math.PI * 2, L = lobes[Math.floor((i / 36) * 9) % 9], rr = r * (0.8 + 0.25 * L + 0.05 * Math.sin(ang * 4 + t * 8)); ctx.lineTo(b.x + Math.cos(ang) * rr, b.y + Math.sin(ang) * rr * 0.8); } ctx.closePath(); ctx.fill();
            const blink = u > 0.3 && u < 0.36 ? 0.15 : 1; ctx.fillStyle = "#e0c8ff"; ctx.globalAlpha = clamp01((u - 0.12) * 5) * (1 - clamp01((u - 0.7) * 4));
            for (const sx of [-10, 10]) { ctx.beginPath(); ctx.ellipse(b.x + sx, b.y - 4, 4, 5 * blink, 0, 0, Math.PI * 2); ctx.fill(); } });
          ctx.globalAlpha = (1 - u) * 0.7; ctx.drawImage(glowSprite("#6a3cc8"), b.x - r * 1.8, b.y - r * 1.6, r * 3.6, r * 3.2);
        } });
        for (let i = 0; i < 8; i++) emit({ x: b.x + rnd(-36, 36), y: b.y + rnd(0, 26), vx: 0, vy: rnd(60, 140), g: 300, life: rnd(0.5, 0.8), size: rnd(4, 7), size2: 2, color: "#2a1050", type: "drop", add: false });
        for (let i = 0; i < 12; i++) emit({ x: b.x + rnd(-30, 30), y: b.y + rnd(-10, 20), vx: rnd(-15, 15), vy: rnd(-110, -60), life: rnd(0.7, 1.1), size: rnd(8, 13), size2: 2, color: pick(["#8a5cff", "#b07cff"]), wob: 12, wf: rnd(6, 10), drag: 0.6 });
      } },
    poison: {
      travel: (a, b) => comet(a, b, 0.55, 120, (x, y, ang, t) => {
        glow(x, y, "#7ed04a", 22, 0.5);
        solid(() => { blob(x, y, 13, t, 0.18, "#7ed04a", 1); blob(x - 4, y - 4, 4, t, 0.1, "#e8ffc8", 0.9); });
      }, { ribbon: false, trail: (x, y) => { if (Math.random() < 0.5) emit({ x, y, vx: rnd(-10, 10), vy: rnd(-20, 10), life: rnd(0.4, 0.7), size: rnd(3, 6), size2: 5, color: "#c8ff8a", type: "bubble" }); } }),
      impact: (b) => {
        const g0 = { x: b.x, y: b.y + GROUND - 8 };
        add({ life: 1.1, add: false, draw(t) { const u = t / 1.1, r = 54 * eBack(u * 3, 1.2); solid(() => blob(g0.x, g0.y, r, t, 0.08, "#5aa82a", 0.85 * (1 - clamp01((u - 0.6) / 0.4)), 0.3)); solid(() => blob(g0.x, g0.y - 2, r * 0.6, t, 0.1, "#9be05a", 0.7 * (1 - clamp01((u - 0.6) / 0.4)), 0.25)); } });
        for (let i = 0; i < 14; i++) emit({ x: g0.x + rnd(-40, 40), y: g0.y + rnd(-8, 2), vx: rnd(-10, 10), vy: rnd(-90, -40), life: rnd(0.6, 1.1), size: rnd(4, 9), size2: rnd(8, 14), color: pick(["#c8ff8a", "#9be05a"]), type: "popb", wob: 6, wf: 8 });
        for (let i = 0; i < 8; i++) emit({ x: b.x + rnd(-30, 30), y: b.y + rnd(0, 30), vx: rnd(-30, 30), vy: rnd(-40, -15), drag: 0.6, life: rnd(0.9, 1.3), size: rnd(14, 20), size2: rnd(40, 54), color: pick(["rgba(130,220,70,.9)", "rgba(90,170,40,.9)"]), alpha: 0.35, add: false, type: "smoke" });
      } },
    nature: {
      travel: (a, b) => comet(a, b, 0.5, 40, (x, y, ang, t) => {
        glow(x, y, "#7ed06a", 20, 0.45);
        for (let i = 0; i < 5; i++) { const an = t * 9 + i * 1.256, r = 14; leaf(x + Math.cos(an) * r, y + Math.sin(an) * r * 0.8, 7, an + 1.57, i % 2 ? "#6ac04a" : "#9be05a", 1); }
      }, { ribbon: false }),
      impact: (b) => {
        const g0 = { x: b.x, y: b.y + GROUND - 4 }, vines = [];
        for (let i = 0; i < 5; i++) { const side = i - 2; vines.push({ x0: g0.x + side * 12, cx: g0.x + side * 30, cy: g0.y - 60 - rnd(0, 20), x1: g0.x + side * 22 + rnd(-6, 6), y1: g0.y - 70 - rnd(0, 30) + Math.abs(side) * 18, d: Math.abs(side) * 0.05 }); }
        const flowers = Array.from({ length: 6 }, (_, i) => ({ x: b.x + rnd(-46, 46), y: b.y + rnd(-50, 30), s: rnd(7, 11), c: pick(["#ff8ab0", "#ffd25a", "#ffffff", "#ffb0d0"]), d: 0.25 + i * 0.05, r: rnd(0, 6) }));
        add({ life: 1.15, add: false, draw(t) {
          const u = t / 1.15, fade = 1 - clamp01((u - 0.75) / 0.25);
          solid(() => {
            for (const v of vines) { const g = eOut((t - v.d) / 0.4); if (g <= 0) continue; ctx.globalAlpha = fade; ctx.strokeStyle = "#3a8a2a"; ctx.lineCap = "round";
              const N = 14, k = Math.max(1, Math.round(N * g)); let px = v.x0, py = g0.y;
              for (let i = 1; i <= k; i++) { const s2 = i / N, x = (1 - s2) * (1 - s2) * v.x0 + 2 * (1 - s2) * s2 * v.cx + s2 * s2 * v.x1, y = (1 - s2) * (1 - s2) * g0.y + 2 * (1 - s2) * s2 * v.cy + s2 * s2 * v.y1; ctx.lineWidth = 5 * (1 - s2) + 1.5; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke(); px = x; py = y; }
              leaf(px, py, 8 * eBack((t - v.d - 0.3) / 0.25), t * 2 + v.x0, "#7ed06a", fade); }
            for (const f of flowers) { const s2 = f.s * eBack((t - f.d) / 0.25, 2.6); if (s2 > 0.3) flower(f.x, f.y, s2, f.c, "#ffd25a", fade, f.r + t); }
          });
        } });
        for (let i = 0; i < 12; i++) emit({ x: b.x + rnd(-40, 40), y: b.y + rnd(-10, 40), vx: rnd(-20, 20), vy: rnd(-90, -50), life: rnd(0.7, 1.1), size: rnd(2, 4), size2: 1, color: pick(["#fff6b0", "#c8ff8a"]), wob: 10, wf: 7 });
        for (let i = 0; i < 6; i++) emit({ x: b.x, y: b.y, vx: rnd(-160, 160), vy: rnd(-200, -60), g: 260, drag: 1.4, life: rnd(0.8, 1.2), size: rnd(5, 8), size2: 5, color: pick(["#6ac04a", "#9be05a"]), type: "leaf", vr: rnd(-8, 8), add: false });
      } },
    holy: {
      impact: (b) => {
        flash.a = Math.max(flash.a, 0.12); flash.c = "#fff2b8";
        add({ life: 0.9, add: true, draw(t) { const u = t / 0.9, w = 46 * bell(u * 1.15) + 2, h = b.y + GROUND; const g = ctx.createLinearGradient(b.x - w, 0, b.x + w, 0); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.3, "#ffe08a"); g.addColorStop(0.5, "#ffffff"); g.addColorStop(0.7, "#ffe08a"); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.globalAlpha = 0.85 * (1 - eInOut((u - 0.5) * 2)); ctx.fillStyle = g; ctx.fillRect(b.x - w, 0, w * 2, h); } });
        add({ life: 1.0, add: true, draw(t) { const u = t / 1.0, s2 = eBack(u * 3); ctx.globalAlpha = 1 - clamp01((u - 0.6) / 0.4); ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(b.x, b.y - 66, 30 * s2, 8 * s2, 0, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.stroke(); } });
        ring({ x: b.x, y: b.y + GROUND - 8 }, "#ffe08a", 90, 0.7, { w: 5, flat: 0.3 });
        for (let i = 0; i < 10; i++) emit({ x: b.x + rnd(-54, 54), y: b.y + rnd(-60, 40), vx: 0, vy: rnd(-30, -10), life: rnd(0.6, 1.0), size: rnd(7, 13), size2: 1, color: pick(["#ffffff", "#ffe08a", "#fff2b8"]), type: "star", vr: rnd(-3, 3) });
        for (let i = 0; i < 14; i++) emit({ x: b.x + rnd(-36, 36), y: b.y + rnd(10, 50), vx: rnd(-8, 8), vy: rnd(-140, -70), life: rnd(0.7, 1.1), size: rnd(3, 5), size2: 1, color: pick(["#fff2b8", "#ffe08a"]), drag: 0.8 });
      } },
    void: {
      travel: (a, b) => comet(a, b, 0.46, 30, (x, y, ang, t) => {
        glow(x, y, "#b45cff", 26, 0.7);
        solid(() => { ctx.globalAlpha = 1; ctx.fillStyle = "#0c0418"; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill(); });
        for (let i = 0; i < 4; i++) { const an = t * 16 + i * 1.57; glow(x + Math.cos(an) * 17, y + Math.sin(an) * 17, "#d39bff", 7, 1); }
      }, { w: 12, c1: "#d39bff", c2: "#6a1fb0", len: 14 }),
      impact: (b) => {
        const motes = Array.from({ length: 34 }, () => ({ a: rnd(0, 6.28), r: rnd(60, 110), s: rnd(3, 6), c: pick(["#d39bff", "#b45cff", "#ffffff"]) }));
        add({ life: 0.85, add: true, draw(t) {
          const u = t / 0.85, pull = eInOut(clamp01(u / 0.65)), core = 22 * eBack(u * 2.5) * (1 - eOut((u - 0.62) / 0.15));
          for (const m of motes) { const r = m.r * (1 - pull), ang = m.a + pull * 5; if (u < 0.65) glow(b.x + Math.cos(ang) * r, b.y + Math.sin(ang) * r * 0.85, m.c, m.s * (1 - pull * 0.5), 0.95); }
          ctx.globalAlpha = 0.8 * (1 - clamp01((u - 0.6) / 0.3)); ctx.drawImage(glowSprite("#7a2ad0"), b.x - core * 2.6, b.y - core * 2.6, core * 5.2, core * 5.2);
          if (core > 0.5) solid(() => { ctx.globalAlpha = 1; ctx.fillStyle = "#0c0418"; ctx.beginPath(); ctx.arc(b.x, b.y, core, 0, 7); ctx.fill(); ctx.strokeStyle = "#d39bff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, core + 2, t * 9, t * 9 + 4.2); ctx.stroke(); });
          if (u > 0.72 && !this.popped) { this.popped = true; ring(b, "#d39bff", 100, 0.4, { w: 6 }); burst(b, 20, { sp: [160, 360], life: [0.25, 0.45], size: [2, 3], colors: ["#ffffff", "#d39bff"], type: "line", w: 2, drag: 4 }); flash.a = Math.max(flash.a, 0.12); flash.c = "#8a3ad0"; }
        } });
      } },
    wind: {
      travel: async (a, b) => {
        const ang = Math.atan2(b.y - a.y, b.x - a.x), nx = -Math.sin(ang), ny = Math.cos(ang);
        for (let i = 0; i < 3; i++) add({ life: 0.42, add: true, draw(t) {
          const u = eInOut(t / 0.42), off = (i - 1) * 16, cx = a.x + (b.x - a.x) * u + nx * off, cy = a.y + (b.y - a.y) * u + ny * off;
          ctx.globalAlpha = bell(t / 0.42) * 0.9; ctx.strokeStyle = i === 1 ? "#ffffff" : "#cfeaff"; ctx.lineWidth = 3; ctx.lineCap = "round";
          ctx.beginPath(); ctx.arc(cx - Math.cos(ang) * 14, cy - Math.sin(ang) * 14, 14, ang + 0.6 + t * 20, ang + 3.6 + t * 20); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx - Math.cos(ang) * 44, cy - Math.sin(ang) * 44); ctx.lineTo(cx, cy); ctx.stroke();
        } });
        for (let i = 0; i < 3; i++) emit({ x: a.x, y: a.y, vx: Math.cos(ang) * rnd(500, 700), vy: Math.sin(ang) * rnd(500, 700) + rnd(-40, 40), drag: 2.5, life: 0.45, size: 6, size2: 5, color: pick(["#9be05a", "#c8a070"]), type: "leaf", vr: 12, add: false });
        await wait(0.36);
      },
      impact: (b) => {
        const g0 = { x: b.x, y: b.y + GROUND - 4 };
        add({ life: 0.95, add: true, draw(t) {
          const u = t / 0.95, grow = eBack(u * 2.5, 1.2), fade = 1 - clamp01((u - 0.7) / 0.3);
          for (let i = 0; i < 8; i++) { const k = i / 7, y = g0.y - k * 110 * grow, rx = (12 + k * 44) * grow, sway = Math.sin(t * 7 + k * 2.5) * 10 * k;
            ctx.globalAlpha = fade * (0.55 + 0.4 * (1 - k)); ctx.strokeStyle = i % 2 ? "#ffffff" : "#cfeaff"; ctx.lineWidth = 3 - k; ctx.beginPath(); ctx.ellipse(g0.x + sway, y, rx, rx * 0.26, 0, t * 14 + i, t * 14 + i + 4.4); ctx.stroke(); }
        } });
        for (let i = 0; i < 6; i++) { const ph = rnd(0, 6.28), hh = rnd(20, 90); add({ life: 0.9, add: false, draw(t) { const an = ph + t * 11, r = 18 + hh * 0.4; solid(() => leaf(g0.x + Math.cos(an) * r, g0.y - hh - t * 30, 6, an * 2, pick(["#9be05a"]), 1 - t / 0.9)); } }); }
        for (let i = 0; i < 6; i++) emit({ x: g0.x + rnd(-30, 30), y: g0.y, vx: rnd(-90, 90), vy: rnd(-30, -5), drag: 2, life: rnd(0.6, 0.9), size: rnd(10, 16), size2: 30, color: "rgba(200,190,170,.9)", alpha: 0.3, add: false, type: "smoke" });
      } },
    dust: {
      impact: (b) => {
        const g0 = { x: b.x, y: b.y + GROUND - 6 };
        add({ life: 0.75, add: false, draw(t) { const u = t / 0.75; solid(() => { for (let i = 0; i < 9; i++) { const ang = (i / 9) * Math.PI * 2 + 0.3, d = 20 + 46 * eOut(u * 1.4), r = (16 + (i % 3) * 5) * eBack(u * 3, 1.5) * (1 - 0.35 * u); if (r <= 0) continue; ctx.globalAlpha = 0.85 * (1 - clamp01((u - 0.45) / 0.55)); ctx.fillStyle = i % 2 ? "#c9ad84" : "#e2cba6"; ctx.beginPath(); ctx.arc(g0.x + Math.cos(ang) * d, g0.y - 8 + Math.sin(ang) * d * 0.32 - r * 0.4, r, 0, 7); ctx.fill(); ctx.fillStyle = "rgba(255,245,225,.6)"; ctx.beginPath(); ctx.arc(g0.x + Math.cos(ang) * d - r * 0.3, g0.y - 8 + Math.sin(ang) * d * 0.32 - r * 0.7, r * 0.4, 0, 7); ctx.fill(); } }); } });
        for (let i = 0; i < 10; i++) { const ang = (i / 10) * Math.PI * 2; emit({ x: g0.x + Math.cos(ang) * 10, y: g0.y + Math.sin(ang) * 4, vx: Math.cos(ang) * rnd(120, 180), vy: Math.sin(ang) * rnd(30, 50) - 30, drag: 2.5, life: rnd(0.8, 1.1), size: rnd(18, 24), size2: rnd(44, 56), color: pick(["rgba(205,180,140,.95)", "rgba(175,150,115,.95)"]), alpha: 0.7, add: false, type: "smoke" }); }
        for (let i = 0; i < 11; i++) emit({ x: g0.x + rnd(-12, 12), y: g0.y - 8, vx: rnd(-170, 170), vy: rnd(-320, -160), g: 1100, life: rnd(0.8, 1.1), size: rnd(5, 8), size2: 5, color: pick(["#8a6a4a", "#a88a68", "#5a4a3a"]), type: "chunk", vr: rnd(-10, 10), add: false, floor: g0.y + rnd(-4, 6) });
        ring(g0, "#d8c8a0", 90, 0.5, { w: 5, flat: 0.32, alpha: 0.8 });
        burst(b, 1, { sp: [0, 0], life: [0.12, 0.12], size: [40, 40], size2: 70, colors: ["#fff2d8"], alpha: 0.5 });
      } },
    arrow: {
      travel: (a, b) => projectile(a, b, 0.26, 10, (x, y, ang) => {
        glow(x, y, "#ffe0b0", 12, 0.35);
        if (!drawSprite("fx-arrow.png", x, y, 96, ang + Math.PI / 4)) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = "#c8a070"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(18, 0); ctx.stroke(); ctx.restore(); ctx.globalCompositeOperation = "lighter"; }
      }, (x, y, dt, ang) => emit({ x, y, vx: -Math.cos(ang) * 60, vy: -Math.sin(ang) * 60, life: 0.18, size: 2, size2: 1, color: "#ffffff", type: "line", w: 1.5, alpha: 0.6 })),
      impact: (b) => {
        burst(b, 10, { sp: [120, 300], g: 700, life: [0.3, 0.55], size: [3, 4], colors: ["#c8a070", "#f0dcc0"], type: "line", w: 2, add: false });
        burst(b, 8, { sp: [40, 140], life: [0.2, 0.4], size: [4, 7], colors: ["#ffffff", "#ffe0b0"], drag: 3 });
      } },
    meat: {
      travel: (a, b) => projectile(a, b, 0.95, 150, (x, y, ang, t) => {
        if (!drawSprite("fx-meat.png", x, y, 74, t * 6)) glow(x, y, "#e2602a", 24, 0.9);
        glow(x, y, "#ffb24a", 10, 0.25);
      }, (x, y, dt) => { if (Math.random() < 0.5) emit({ x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: rnd(-10, 10), vy: rnd(20, 60), g: 300, life: rnd(0.3, 0.5), size: rnd(3, 5), size2: 2, color: pick(["#e2602a", "#ffb24a"]), add: false }); }),
      impact: (b) => {
        burst(b, 18, { sp: [60, 240], vy: -80, g: 900, life: [0.4, 0.7], size: [4, 8], size2: 2, colors: ["#e2602a", "#ff9a3a", "#8a2a10"], add: false, drag: 0.8 });
        burst(b, 8, { sp: [10, 40], vy: -30, life: [0.5, 0.8], size: [14, 22], size2: 50, colors: ["rgba(120,50,20,.9)"], alpha: 0.4, add: false, type: "smoke" });
        ring({ x: b.x, y: b.y + 26 }, "#ffb24a", 56, 0.4, { w: 4, flat: 0.4 });
        add({ life: 0.5, draw(t) { const s = 74 * (1 - t * 0.4); drawSprite("fx-meat.png", b.x, b.y + t * 30, s, 0.6 + t, 1 - t); } });
      } },
    // ---- table moments (not pickable as a card look): plain melee hits, deaths, buffs, shields, summons, hero damage
    // Hits and deaths take a "flavor" (the minion's tribe) so every tribe fights with its own look.
    melee: {
      impact: (b, o = {}) => {
        const ang = Math.atan2(o.dy || 0, o.dx || 1), f = FLAVOR[o.flavor] || FLAVOR.plain, heavy = !!o.heavy;
        flash.a = Math.max(flash.a, heavy ? 0.12 : 0.05); flash.c = f.flash;
        ring(b, f.ring, heavy ? 64 : 44, heavy ? 0.3 : 0.22, { w: heavy ? 6 : 4 });
        burst(b, heavy ? 28 : 18, { ang, spread: 1.2, sp: [200, heavy ? 700 : 560], life: [0.15, 0.32], size: [2, 3], colors: f.sparks, type: "line", w: 2.2, drag: 4, g: 350 });
        burst(b, 6, { sp: [10, 50], life: [0.3, 0.5], size: [12, 20], size2: 40, colors: [f.smoke], alpha: 0.3, add: false, type: "smoke", vy: -10 });
        burst(b, 1, { sp: [0, 0], life: [0.12, 0.12], size: [46, 46], size2: 70, colors: [f.flash], alpha: 0.55 });
        if (f.hit) f.hit(b, ang, heavy);
        if (heavy) burst(b, 10, { sp: [120, 320], vy: -120, g: 900, life: [0.5, 0.8], size: [4, 7], size2: 3, colors: f.debris, type: "chunk", vr: 10, add: false });
      } },
    death: {
      impact: (b, o = {}) => {
        const f = FLAVOR[o.flavor] || FLAVOR.plain;
        burst(b, 12, { sp: [10, 60], vy: -40, life: [0.7, 1.2], size: [14, 24], size2: 50, colors: [f.smoke, "rgba(60,50,60,.9)"], alpha: 0.5, add: false, type: "smoke", drag: 1.2 });
        burst(b, 14, { sp: [60, 200], vy: -80, g: 500, life: [0.5, 0.9], size: [3, 6], size2: 3, colors: f.debris, type: "chunk", vr: 8, add: false, drag: 0.5 });
        if (f.die) f.die(b);
        for (let i = 0; i < 5; i++) emit({ x: b.x + rnd(-20, 20), y: b.y + rnd(-10, 10), vx: rnd(-15, 15), vy: rnd(-70, -40), life: rnd(0.8, 1.3), size: rnd(6, 10), size2: 2, color: pick(["#bfe4ff", "#e8f4ff"]), alpha: 0.8, drag: 0.5 });
        ring({ x: b.x, y: b.y + 30 }, "#8a7a9a", 50, 0.4, { w: 3, flat: 0.45, alpha: 0.5 });
      } },
    sparkle: {
      impact: (b, o = {}) => {
        const c = o.color || "#7ff06a";
        for (let i = 0; i < 12; i++) emit({ x: b.x + rnd(-30, 30), y: b.y + rnd(10, 40), vx: rnd(-10, 10), vy: rnd(-120, -60), life: rnd(0.5, 0.9), size: rnd(4, 8), size2: 1, color: pick([c, "#ffffff"]), drag: 1 });
        ring({ x: b.x, y: b.y + 36 }, c, 50, 0.5, { w: 3, flat: 0.4, alpha: 0.7 });
        burst(b, 1, { sp: [0, 0], life: [0.3, 0.3], size: [60, 60], size2: 80, colors: [c], alpha: 0.22 });
      } },
    shieldpop: {
      impact: (b) => {
        burst(b, 16, { sp: [120, 320], g: 500, life: [0.4, 0.7], size: [5, 10], size2: 3, colors: ["#fff6c8", "#ffc83a", "#ffffff"], type: "shard", vr: 12, drag: 1.2, add: false });
        ring(b, "#ffe08a", 70, 0.4, { w: 5 });
        burst(b, 1, { sp: [0, 0], life: [0.2, 0.2], size: [55, 55], size2: 75, colors: ["#ffe08a"], alpha: 0.5 });
        flash.a = Math.max(flash.a, 0.05); flash.c = "#fff2b8";
      } },
    summonfx: {
      impact: (b, o = {}) => {
        const c = o.color || "#ffe08a";
        beam({ x: b.x, y: b.y }, c, 0.5, b.y - 110);
        ring({ x: b.x, y: b.y + 40 }, c, 60, 0.5, { w: 4, flat: 0.4 });
        burst(b, 14, { sp: [20, 90], vy: -60, life: [0.5, 0.9], size: [4, 8], colors: [c, "#ffffff"], drag: 1.5 });
      } },
    herohit: {
      impact: (b) => {
        flash.a = Math.max(flash.a, 0.22); flash.c = "#ff5a3a";
        ring(b, "#ff7a4a", 160, 0.6, { w: 10 }); ring(b, "#ffffff", 90, 0.35, { w: 4 });
        burst(b, 40, { sp: [150, 520], life: [0.3, 0.7], size: [3, 7], colors: ["#ff9a3a", "#ffd25a", "#ffffff"], drag: 2, g: 300 });
        burst(b, 12, { sp: [20, 80], vy: -30, life: [0.6, 1], size: [20, 34], size2: 70, colors: ["rgba(60,20,20,.9)"], alpha: 0.45, add: false, type: "smoke" });
      } },
  };
  // per-tribe look of hits and deaths
  const FLAVOR = {
    plain: { flash: "#ffffff", ring: "#ffffff", sparks: ["#ffffff", "#ffe08a", "#ff9a3a"], smoke: "rgba(90,70,60,.8)", debris: ["#8a7a6a", "#5a4a40", "#3a3030"] },
    Beast: { flash: "#ffe8c8", ring: "#ffd9a0", sparks: ["#ffffff", "#ffd9a0", "#ff8a5a"], smoke: "rgba(110,80,50,.8)", debris: ["#a0785a", "#6a4a30", "#d0a070"],
      hit: (b, ang) => { for (let i = -1; i <= 1; i++) { const o = { x: b.x + Math.cos(ang + 1.57) * i * 14, y: b.y + Math.sin(ang + 1.57) * i * 14 }; add({ life: 0.26, add: false, draw(t) { ctx.globalAlpha = 1 - t; ctx.strokeStyle = "#ff6a4a"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(o.x - Math.cos(ang) * 22, o.y - Math.sin(ang) * 22); ctx.lineTo(o.x + Math.cos(ang) * 22 * Math.min(1, t * 3), o.y + Math.sin(ang) * 22 * Math.min(1, t * 3)); ctx.stroke(); } }); } },
      die: (b) => burst(b, 10, { sp: [30, 120], vy: -60, life: [0.6, 1], size: [4, 7], size2: 2, colors: ["#d0a070", "#a0785a"], type: "shard", vr: 10, add: false, drag: 1 }) },
    Construct: { flash: "#dff0ff", ring: "#bfe4ff", sparks: ["#ffffff", "#ffe08a", "#7fc4ff"], smoke: "rgba(60,70,90,.8)", debris: ["#9aa8c0", "#5a6a80", "#c8d0e0"],
      hit: (b) => { for (let i = 0; i < 2; i++) { const a = rnd(0, 6.28), l = rnd(20, 40); bolt(b, { x: b.x + Math.cos(a) * l, y: b.y + Math.sin(a) * l }, "#ffe08a", 0.14); } },
      die: (b) => { burst(b, 12, { sp: [80, 260], vy: -150, g: 900, life: [0.6, 1], size: [5, 9], size2: 4, colors: ["#9aa8c0", "#5a6a80", "#ffe08a"], type: "chunk", vr: 14, add: false }); for (let i = 0; i < 3; i++) { const a = rnd(0, 6.28), l = rnd(30, 60); bolt(b, { x: b.x + Math.cos(a) * l, y: b.y + Math.sin(a) * l }, "#7fc4ff", 0.22); } } },
    Spirit: { flash: "#e8e0ff", ring: "#c8b8ff", sparks: ["#ffffff", "#c8b8ff", "#8f6cff"], smoke: "rgba(60,40,90,.8)", debris: ["#8f6cff", "#c8b8ff", "#5a3ab0"],
      hit: (b) => burst(b, 8, { sp: [10, 40], vy: -60, life: [0.5, 0.9], size: [6, 10], colors: ["#c8b8ff", "#ffffff"], drag: 1, jit: 16 }),
      die: (b) => { for (let i = 0; i < 10; i++) emit({ x: b.x + rnd(-24, 24), y: b.y + rnd(-10, 20), vx: rnd(-20, 20), vy: rnd(-110, -60), life: rnd(0.9, 1.5), size: rnd(8, 14), size2: 2, color: pick(["#c8b8ff", "#e8e0ff", "#8f6cff"]), drag: 1 }); ring(b, "#c8b8ff", 60, 0.6, { w: 3, inward: true }); } },
    Corsair: { flash: "#fff2c8", ring: "#ffd25a", sparks: ["#ffffff", "#ffd25a", "#ffb02a"], smoke: "rgba(80,60,30,.8)", debris: ["#ffd25a", "#8a6a2a", "#c8a070"],
      hit: (b) => burst(b, 6, { sp: [80, 220], vy: -140, g: 900, life: [0.5, 0.8], size: [4, 6], size2: 4, colors: ["#ffd25a", "#fff2c8"], type: "chunk", vr: 12, add: false }),
      die: (b) => burst(b, 14, { sp: [60, 240], vy: -200, g: 1000, life: [0.7, 1.1], size: [4, 7], size2: 4, colors: ["#ffd25a", "#fff2c8", "#c8a070"], type: "chunk", vr: 12, add: false }) },
    Elemental: { flash: "#ffd9a0", ring: "#ff9a3a", sparks: ["#ffffff", "#ffb02a", "#ff7a2a"], smoke: "rgba(90,40,20,.8)", debris: ["#ff7a2a", "#e2412a", "#ffd25a"],
      hit: (b) => burst(b, 10, { sp: [20, 90], vy: -60, life: [0.4, 0.7], size: [10, 18], size2: 2, colors: ["#ff7a2a", "#ffb02a"], drag: 2 }),
      die: (b) => { burst(b, 20, { sp: [40, 200], vy: -40, life: [0.4, 0.8], size: [12, 22], size2: 2, colors: ["#ffd25a", "#ff7a2a", "#e2412a"], drag: 3 }); ring(b, "#ffb24a", 70, 0.4, { w: 5 }); } },
    Dragon: { flash: "#ffe0b0", ring: "#ff9a3a", sparks: ["#ffffff", "#ffd25a", "#ff7a2a"], smoke: "rgba(80,30,20,.85)", debris: ["#c0402a", "#ffb02a", "#5a2a1a"],
      hit: (b, ang) => burst(b, 12, { ang, spread: 0.6, sp: [120, 320], life: [0.3, 0.6], size: [10, 18], size2: 2, colors: ["#ff7a2a", "#ffd25a", "#e2412a"], drag: 3 }),
      die: (b) => { burst(b, 16, { sp: [30, 160], vy: -90, life: [0.6, 1.1], size: [10, 18], size2: 2, colors: ["#ff7a2a", "#ffd25a"], drag: 2 }); burst(b, 8, { sp: [10, 50], vy: -30, life: [0.8, 1.2], size: [18, 26], size2: 70, colors: ["rgba(50,20,20,.9)"], alpha: 0.5, add: false, type: "smoke" }); } },
    Tidekin: { flash: "#d8f4ff", ring: "#5ab8ff", sparks: ["#ffffff", "#bfe9ff", "#5ab8ff"], smoke: "rgba(40,80,120,.8)", debris: ["#5ab8ff", "#bfe9ff", "#2a78d0"],
      hit: (b) => burst(b, 14, { sp: [60, 220], vy: -140, g: 900, life: [0.4, 0.8], size: [3, 6], colors: ["#bfe9ff", "#5ab8ff", "#ffffff"], drag: 0.6 }),
      die: (b) => { burst(b, 24, { sp: [60, 260], vy: -160, g: 900, life: [0.5, 0.9], size: [4, 8], colors: ["#bfe9ff", "#5ab8ff", "#ffffff"], drag: 0.6 }); ring({ x: b.x, y: b.y + 30 }, "#8fd3ff", 80, 0.6, { w: 4, flat: 0.35 }); } },
    Infernal: { flash: "#ffb0a0", ring: "#ff4a3a", sparks: ["#ffffff", "#ff6a4a", "#8a2aff"], smoke: "rgba(40,10,30,.9)", debris: ["#6a1a2a", "#ff4a3a", "#2a0a30"],
      hit: (b) => burst(b, 8, { sp: [10, 60], vy: -50, life: [0.5, 0.9], size: [12, 20], size2: 2, colors: ["#ff4a3a", "#8a2aff", "#2a0a30"], drag: 2 }),
      die: (b) => { for (let i = 0; i < 20; i++) { const a = rnd(0, 6.28), r = rnd(50, 80); emit({ x: b.x + Math.cos(a) * r, y: b.y + Math.sin(a) * r, vx: -Math.cos(a) * r * 2.4, vy: -Math.sin(a) * r * 2.4, life: 0.4, size: rnd(6, 10), size2: 1, color: pick(["#ff4a3a", "#8a2aff"]) }); } ring(b, "#ff4a3a", 70, 0.5, { inward: true, w: 6 }); } },
  };
  // keyword gains in combat: each keyword has its own little moment
  const KW_FX = {
    taunt: (b) => { ring({ x: b.x, y: b.y + 36 }, "#d8b890", 60, 0.5, { w: 6, flat: 0.4 }); burst(b, 10, { sp: [40, 120], vy: -100, g: 700, life: [0.5, 0.8], size: [5, 8], size2: 4, colors: ["#c8a070", "#8a6a4a"], type: "chunk", vr: 8, add: false }); },
    shield: (b) => { ring(b, "#ffe08a", 64, 0.5, { w: 5, inward: true }); rays(b, "#fff2b8", 0.4, 8, 70); },
    reborn: (b) => { beam(b, "#9fdcff", 0.6, b.y - 110); burst(b, 10, { sp: [10, 40], vy: -80, life: [0.6, 1], size: [5, 8], colors: ["#9fdcff", "#ffffff"], drag: 1 }); },
    windfury: (b) => { for (let i = 0; i < 2; i++) add({ life: 0.5, draw(t) { ctx.globalAlpha = (1 - t) * 0.9; ctx.strokeStyle = "#dff3ff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, 30 + i * 18 + t * 40, t * 9 + i * 3, t * 9 + i * 3 + 2.2); ctx.stroke(); } }); burst(b, 10, { sp: [80, 220], life: [0.3, 0.5], size: [2, 3], colors: ["#ffffff", "#dff3ff"], type: "line", w: 2, drag: 2 }); },
    venomous: (b) => { burst(b, 10, { sp: [5, 25], vy: -60, life: [0.7, 1.1], size: [5, 9], colors: ["#c8ff8a", "#9be05a"], type: "bubble", jit: 24 }); burst(b, 8, { sp: [20, 80], g: 500, life: [0.5, 0.8], size: [4, 7], colors: ["#9be05a"], drag: 1 }); },
    cleave: (b) => { slash({ x: b.x - 16, y: b.y }, 0, false); slash({ x: b.x + 16, y: b.y }, 0.08, false); },
    stealth: (b) => burst(b, 12, { sp: [10, 50], life: [0.6, 1], size: [14, 22], size2: 50, colors: ["rgba(40,40,70,.9)"], alpha: 0.5, add: false, type: "smoke", vy: -20 }),
    rally: (b) => { rays(b, "#ffd25a", 0.5, 10, 80); burst({ x: b.x, y: b.y + 20 }, 12, { sp: [5, 30], vy: -120, life: [0.6, 1], size: [4, 7], colors: ["#ffd25a", "#ffffff"], jit: 30 }); },
    tough: (b) => { ring(b, "#a98462", 60, 0.4, { w: 8 }); burst(b, 8, { sp: [40, 120], g: 600, life: [0.5, 0.8], size: [4, 7], size2: 4, colors: ["#a98462", "#4a3626"], type: "chunk", vr: 8, add: false }); },
    stats: (b, c) => { for (let i = 0; i < 12; i++) emit({ x: b.x + rnd(-30, 30), y: b.y + rnd(10, 40), vx: rnd(-10, 10), vy: rnd(-120, -60), life: rnd(0.5, 0.9), size: rnd(4, 8), size2: 1, color: pick([c, "#ffffff"]), drag: 1 }); ring({ x: b.x, y: b.y + 36 }, c, 50, 0.5, { w: 3, flat: 0.4, alpha: 0.7 }); },
    empower: (b) => { for (let i = 0; i < 6; i++) emit({ x: b.x + rnd(-26, 26), y: b.y + rnd(0, 30), vx: 0, vy: rnd(-90, -50), life: rnd(0.9, 1.3), size: rnd(14, 18), size2: 12, color: "#d39bff", type: "plus" }); ring(b, "#b45cff", 60, 0.5, { w: 4, inward: true }); },
  };
  // looks from earlier versions keep working on old cards: they play the closest painted one
  const ALIAS = { heal: "nature", rock: "dust", slash: "dust", thorns: "nature", blood: "shadow", meteor: "fire", prism: "holy" };
  for (const [k, v] of Object.entries(ALIAS)) S[k] = S[v];
  S.keyword = { impact: (b, o = {}) => { const f = KW_FX[o.kw]; if (f) f(b, o.color || "#7ff06a"); else KW_FX.stats(b, o.color || "#7ff06a"); } };
  // Evolve: a golden flare, rays and a shell of sparks
  S.evolve = { impact: (b) => {
    flash.a = Math.max(flash.a, 0.16); flash.c = "#ffe08a";
    rays(b, "#ffe9a8", 0.5, 12, 90);
    ring(b, "#ffffff", 70, 0.35, { w: 5 }); ring(b, "#ffb24a", 110, 0.6, { w: 6 });
    burst(b, 34, { sp: [60, 260], life: [0.5, 1], size: [4, 9], colors: ["#ffe08a", "#ffffff", "#ff9a3a"], drag: 2, g: 150 });
    for (let i = 0; i < 8; i++) emit({ x: b.x + rnd(-30, 30), y: b.y + rnd(0, 30), vx: 0, vy: rnd(-120, -70), life: rnd(0.8, 1.2), size: rnd(12, 18), size2: 10, color: "#ffe08a", type: "plus" });
  } };
  // a card landing on the board: dust on the ground, a shock ring, a few sparks
  S.land = { impact: (b, o = {}) => {
    const g = { x: b.x, y: b.y + (o.h || 60) * 0.42 };
    ring(g, "#d8c8a0", o.big ? 110 : 80, 0.45, { w: 5, flat: 0.32, alpha: 0.7 });
    burst(g, 14, { sp: [40, 150], vy: -20, life: [0.5, 0.9], size: [14, 24], size2: 60, colors: ["rgba(150,130,100,.9)", "rgba(110,95,80,.9)"], alpha: 0.4, add: false, type: "smoke", drag: 2 });
    burst(g, 10, { sp: [80, 240], vy: -140, g: 900, life: [0.4, 0.7], size: [3, 5], colors: ["#ffe08a", "#ffffff"], drag: 1 });
    flash.a = Math.max(flash.a, 0.04); flash.c = "#fff2d8";
  } };
  // spells: the cast (a burst of arcane motes where the card was) and the hit on a minion
  S.spellcast = { impact: (b, o = {}) => {
    const c = o.color || "#c8a8ff";
    ring(b, c, 60, 0.4, { w: 4 });
    burst(b, 24, { sp: [30, 160], vy: -60, life: [0.5, 0.9], size: [4, 8], colors: [c, "#ffffff", "#9fdcff"], drag: 1.5 });
    for (let i = 0; i < 4; i++) emit({ x: b.x + rnd(-20, 20), y: b.y, vx: rnd(-30, 30), vy: rnd(-160, -90), life: rnd(0.6, 1), size: rnd(10, 16), size2: 2, color: c, type: "glow", drag: 1 });
  } };
  S.spellhit = { impact: (b, o = {}) => {
    const c = o.color || "#c8a8ff";
    flash.a = Math.max(flash.a, 0.08); flash.c = c;
    rays(b, c, 0.3, 6, 50);
    ring(b, "#ffffff", 46, 0.28, { w: 3 }); ring(b, c, 80, 0.45, { w: 4, inward: true });
    burst(b, 26, { sp: [40, 220], life: [0.4, 0.8], size: [4, 9], colors: [c, "#ffffff"], drag: 2 });
  } };
  // a short afterimage along a lunge, so melee attacks read as motion
  function trail(a, b, color = "#ffd9a0", n = 7) {
    if (!ensure()) return;
    for (let i = 0; i < n; i++) { const u = i / n; emit({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, vx: 0, vy: 0, life: 0.14 + u * 0.1, size: 26 - u * 10, size2: 4, color, alpha: 0.35 }); }
  }

  // ---------------------------------------------------------------- loop
  function loop(now) {
    if (!ctx) { running = false; return; }
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)) * speed(); last = now; // rAF's timestamp can trail performance.now() by a frame
    ctx.setTransform(q, 0, 0, q, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // particles: smoke and solid pieces first, glowing ones on top
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalCompositeOperation = pass === 0 ? "source-over" : "lighter";
      for (const p of parts) {
        if ((pass === 1) !== p.add) continue;
        const u = p.t / p.life, s = p.size + (p.size2 - p.size) * u, a = p.alpha * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85);
        const wx = p.wob ? Math.sin(p.t * (p.wf || 8) + (p.ph || 0)) * p.wob * u : 0; if (wx) p.x += wx - (p.lastW || 0); p.lastW = wx;
        ctx.globalAlpha = Math.max(0, a);
        switch (p.type) {
          case "glow": { const sp = glowSprite(p.color); ctx.drawImage(sp, p.x - s, p.y - s, s * 2, s * 2); break; }
          case "smoke": { const sp = softSprite(p.color); ctx.drawImage(sp, p.x - s, p.y - s, s * 2, s * 2); break; }
          case "bubble": { ctx.strokeStyle = p.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x + Math.sin(p.t * 9) * 3, p.y, s, 0, 6.28); ctx.stroke(); break; }
          case "line": { const k = 0.05; ctx.strokeStyle = p.color; ctx.lineWidth = p.w || 2; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * k, p.y - p.vy * k); ctx.stroke(); break; }
          case "shard": case "chunk": {
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.beginPath();
            if (p.type === "shard") { ctx.moveTo(0, -s * 1.6); ctx.lineTo(s * 0.6, 0); ctx.lineTo(0, s * 1.6); ctx.lineTo(-s * 0.6, 0); }
            else { ctx.moveTo(s, 0); ctx.lineTo(s * 0.3, s * 0.9); ctx.lineTo(-s * 0.8, s * 0.6); ctx.lineTo(-s, -s * 0.4); ctx.lineTo(0, -s); }
            ctx.closePath(); ctx.fill(); ctx.restore(); break;
          }
          case "star": star4(p.x, p.y, s, p.rot, p.color, ctx.globalAlpha * (0.6 + 0.4 * Math.sin(p.t * 22))); break;
          case "drop": teardrop(p.x, p.y, p.vx, p.vy, s, p.color, ctx.globalAlpha); break;
          case "leaf": leaf(p.x, p.y, s, p.rot, p.color, ctx.globalAlpha); break;
          case "flake": flake(p.x, p.y, s, p.rot, p.color, ctx.globalAlpha); break;
          case "popb": { if (u < 0.85) { ctx.strokeStyle = p.color; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, 6.28); ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.beginPath(); ctx.arc(p.x - s * 0.35, p.y - s * 0.35, s * 0.22, 0, 6.28); ctx.fill(); } else { const k = (u - 0.85) / 0.15; ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.color; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const an = i * 1.047; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(an) * s * (1 + k * 0.5), p.y + Math.sin(an) * s * (1 + k * 0.5)); ctx.lineTo(p.x + Math.cos(an) * s * (1.3 + k), p.y + Math.sin(an) * s * (1.3 + k)); ctx.stroke(); } } break; }
          case "img": { const im = imgOf(p.img); if (im) { const k = im.naturalHeight / im.naturalWidth; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.drawImage(im, -s, -s * k, s * 2, s * 2 * k); ctx.restore(); } break; }
          case "plus": { ctx.fillStyle = p.color; ctx.font = `800 ${s}px Manrope, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowColor = p.color; ctx.shadowBlur = 10; ctx.fillText("+", p.x, p.y); ctx.shadowBlur = 0; break; }
        }
      }
    }
    ctx.globalCompositeOperation = "lighter";
    for (const it of items) { ctx.globalAlpha = 1; it.draw(it.t, dt); }
    if (flash.a > 0.005) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = flash.a; ctx.fillStyle = flash.c; ctx.fillRect(0, 0, W, H); flash.a *= Math.pow(0.0005, dt); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    // advance
    for (const p of parts) { p.t += dt; p.vx *= 1 - Math.min(1, p.drag * dt); p.vy *= 1 - Math.min(1, p.drag * dt); p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.floor != null && p.y > p.floor && p.vy > 0) { p.y = p.floor; p.vy *= -0.42; p.vx *= 0.7; p.vr *= 0.6; } }
    parts = parts.filter((p) => p.t < p.life);
    const done = [];
    for (const it of items) { it.t += dt; if (it.t >= it.life) done.push(it); }
    if (done.length) { items = items.filter((it) => it.t < it.life); for (const it of done) if (it.onEnd) it.onEnd(); }
    if (parts.length || items.length || flash.a > 0.005) requestAnimationFrame(loop);
    else { ctx.clearRect(0, 0, W, H); running = false; }
  }


  // ---------------------------------------------------------------- effects designed in the workshop: a spec (data) becomes a style
  const FX_DEF = { c1: "#ff9a3a", c2: "#ffd25a", c3: "#ffffff", travel: "orb", speed: 0.4, arc: 30, size: 14, ribbon: true, trail: "sparks",
    glow: 40, flash: 0.08, rings: 1, ringSize: 90, rays: 0, beam: false, shape: "glow", count: 22, pspeed: 220, gravity: 0, psize: 6, life: 0.6, spread: "all", smoke: 0, shake: 0 };
  const FX_SHAPES = ["glow", "star", "shard", "chunk", "drop", "bubble", "flake", "leaf", "line", "plus", "smoke", "popb", "image"];
  const FX_TRAVELS = ["none", "orb", "comet", "bolt", "arrow", "spin", "sky"];
  const FX_TRAILS = ["none", "sparks", "embers", "smoke", "bubbles", "flakes", "leaves", "stars"];
  const num = (v, lo, hi, d) => (isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : d);
  function fxSpec(spec) {
    const o = Object.assign({}, FX_DEF, spec || {});
    o.travel = FX_TRAVELS.includes(o.travel) ? o.travel : "orb"; o.trail = FX_TRAILS.includes(o.trail) ? o.trail : "none"; o.shape = FX_SHAPES.includes(o.shape) ? o.shape : "glow";
    o.speed = num(o.speed, 0.1, 1.2, 0.4); o.arc = num(o.arc, -120, 160, 30); o.size = num(o.size, 4, 40, 14); o.glow = num(o.glow, 0, 140, 40); o.flash = num(o.flash, 0, 0.4, 0.08);
    o.rings = num(o.rings, 0, 4, 1) | 0; o.ringSize = num(o.ringSize, 30, 220, 90); o.rays = num(o.rays, 0, 24, 0) | 0; o.count = num(o.count, 0, 80, 22) | 0; o.pspeed = num(o.pspeed, 20, 700, 220);
    o.gravity = num(o.gravity, -600, 1200, 0); o.psize = num(o.psize, 1, 30, 6); o.life = num(o.life, 0.15, 2, 0.6); o.smoke = num(o.smoke, 0, 30, 0) | 0; o.shake = num(o.shake, 0, 14, 0);
    o.spread = ["all", "up", "down", "fan"].includes(o.spread) ? o.spread : "all";
    // your own pictures: the projectile, a picture at the impact, the particles
    for (const k of ["projImg", "impactImg", "partImg"]) if (!(typeof o[k] === "string" && /^data:image\//.test(o[k]))) delete o[k];
    o.projRot = ["none", "aim", "spin"].includes(o.projRot) ? o.projRot : "aim"; o.projSize = num(o.projSize, 12, 240, 48);
    o.impSize = num(o.impSize, 30, 500, 150); o.impLife = num(o.impLife, 0.2, 2, 0.55); o.impSpin = !!o.impSpin;
    if (o.shape === "image" && !o.partImg) o.shape = "glow";
    return o;
  }
  function trailOf(o) {
    const c = [o.c1, o.c2, o.c3];
    switch (o.trail) {
      case "sparks": return (x, y) => emit({ x, y, vx: rnd(-30, 30), vy: rnd(-30, 30), life: rnd(0.25, 0.45), size: rnd(2, 4), size2: 1, color: pick(c), drag: 2 });
      case "embers": return (x, y) => emit({ x: x + rnd(-5, 5), y: y + rnd(-5, 5), vx: rnd(-20, 20), vy: rnd(-70, -30), life: rnd(0.35, 0.6), size: rnd(3, 5), size2: 1, color: pick(c), drag: 1.5, wob: 10, wf: 14 });
      case "smoke": return (x, y) => { if (Math.random() < 0.6) emit({ x, y, vx: rnd(-10, 10), vy: rnd(-30, -10), life: rnd(0.5, 0.8), size: rnd(8, 12), size2: 26, color: "rgba(80,70,80,.85)", alpha: 0.35, add: false, type: "smoke", drag: 1 }); };
      case "bubbles": return (x, y) => { if (Math.random() < 0.5) emit({ x, y, vx: rnd(-15, 15), vy: rnd(-40, -10), life: rnd(0.5, 0.8), size: rnd(3, 6), size2: 5, color: o.c1, type: "bubble" }); };
      case "flakes": return (x, y) => { if (Math.random() < 0.5) emit({ x, y, vx: rnd(-20, 20), vy: rnd(-10, 30), life: rnd(0.5, 0.8), size: rnd(4, 7), size2: 2, color: o.c3, type: "flake", vr: rnd(-4, 4), drag: 1.5 }); };
      case "leaves": return (x, y) => { if (Math.random() < 0.4) emit({ x, y, vx: rnd(-30, 30), vy: rnd(-20, 40), life: rnd(0.6, 0.9), size: rnd(5, 8), size2: 4, color: pick(c), type: "leaf", vr: rnd(-6, 6), drag: 1, add: false }); };
      case "stars": return (x, y) => { if (Math.random() < 0.5) emit({ x, y, vx: rnd(-20, 20), vy: rnd(-20, 20), life: rnd(0.3, 0.6), size: rnd(4, 7), size2: 1, color: pick(c), type: "star", vr: rnd(-6, 6) }); };
    }
    return null;
  }
  function compileFx(spec) {
    const o = fxSpec(spec), tr = trailOf(o);
    for (const k of ["projImg", "impactImg", "partImg"]) if (o[k]) imgOf(o[k]); // start loading now
    const head0 = (x, y) => { glow(x, y, o.c1, o.size * 2, 0.85); glow(x, y, o.c3, o.size * 0.75, 1); };
    // with a projectile picture, the picture flies (aimed, spinning or still), with a soft glow behind it
    const head = o.projImg ? (x, y, ang, t) => { glow(x, y, o.c1, o.projSize * 0.7, 0.55); if (!drawImg(o.projImg, x, y, o.projSize, o.projRot === "aim" ? ang || 0 : o.projRot === "spin" ? (t || 0) * 14 : 0, 1)) head0(x, y); } : head0;
    let travel = null;
    if (o.travel !== "none") travel = async (a, b) => {
      if (o.projImg && o.travel !== "bolt" && o.travel !== "sky") return comet(a, b, o.speed, o.arc, head, { w: o.size, c1: o.c3, c2: o.c1, len: 12, ribbon: o.ribbon, trail: tr });
      switch (o.travel) {
        case "bolt": bolt(a, b, o.c1, 0.3); flash.a = Math.max(flash.a, o.flash); flash.c = o.c2; return comet(a, b, Math.min(o.speed, 0.2), 0, head, { w: o.size * 0.6, c1: o.c3, c2: o.c1, len: 8, ribbon: o.ribbon });
        case "sky": beam(b, o.c1, 0.5, Math.max(0, b.y - 300)); return wait(Math.min(0.35, o.speed));
        case "arrow": return projectile(a, b, o.speed, o.arc, (x, y, ang) => solid(() => {
          ctx.translate(x, y); ctx.rotate(ang); ctx.strokeStyle = o.c2; ctx.lineWidth = Math.max(2, o.size * 0.18); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-o.size * 1.7, 0); ctx.lineTo(o.size * 0.5, 0); ctx.stroke();
          ctx.fillStyle = o.c1; ctx.beginPath(); ctx.moveTo(o.size * 1.1, 0); ctx.lineTo(0, -o.size * 0.5); ctx.lineTo(0, o.size * 0.5); ctx.closePath(); ctx.fill(); }), tr);
        case "spin": return comet(a, b, o.speed, o.arc, (x, y, ang, t) => { glow(x, y, o.c1, o.size * 1.6, 0.7); star4(x, y, o.size * 1.2, t * 14, o.c2, 1); star4(x, y, o.size * 0.6, -t * 10, o.c3, 1); }, { w: o.size * 0.8, c1: o.c3, c2: o.c1, len: 10, ribbon: o.ribbon, trail: tr });
        case "comet": return comet(a, b, o.speed, o.arc, (x, y, ang, t) => { for (let i = 0; i < 4; i++) { const k = i / 4; glow(x - Math.cos(ang) * (6 + k * 16), y - Math.sin(ang) * (6 + k * 16), i % 2 ? o.c1 : o.c2, o.size * 1.3 - k * o.size * 0.6, 0.8); } head(x, y); }, { w: o.size * 1.3, c1: o.c2, c2: o.c1, len: 14, ribbon: o.ribbon, trail: tr });
        default: return comet(a, b, o.speed, o.arc, head, { w: o.size, c1: o.c3, c2: o.c1, len: 12, ribbon: o.ribbon, trail: tr });
      }
    };
    const impact = (b) => {
      if (o.flash > 0) { flash.a = Math.max(flash.a, o.flash); flash.c = o.c2; }
      if (o.glow > 0) add({ life: 0.5, add: true, draw(t) { const u = t / 0.5, r = o.glow * eBack(u * 2.2) * (1 - eOut((u - 0.4) / 0.6) * 0.6); ctx.globalAlpha = 1 - eOut(u); ctx.drawImage(glowSprite(o.c1), b.x - r * 1.5, b.y - r * 1.5, r * 3, r * 3); ctx.globalAlpha = (1 - u) * 0.9; ctx.drawImage(glowSprite(o.c3), b.x - r * 0.6, b.y - r * 0.6, r * 1.2, r * 1.2); } });
      for (let i = 0; i < o.rings; i++) ring(b, i % 2 ? o.c2 : o.c1, o.ringSize * (1 + i * 0.35), 0.45 + i * 0.1, { w: 5 - i });
      if (o.rays > 0) rays(b, o.c2, 0.45, o.rays, o.ringSize * 0.9);
      if (o.beam) beam(b, o.c1, 0.6, Math.max(0, b.y - 260));
      if (o.count > 0) {
        const solidShape = o.shape === "smoke" || o.shape === "chunk" || o.shape === "leaf";
        burst(b, o.count, { sp: [o.pspeed * 0.4, o.pspeed], life: [o.life * 0.6, o.life], size: [o.psize * 0.6, o.psize], size2: o.shape === "smoke" ? o.psize * 4 : o.shape === "bubble" || o.shape === "flake" ? o.psize * 0.8 : o.psize * 0.25,
          colors: o.shape === "smoke" ? ["rgba(80,70,80,.9)"] : [o.c1, o.c2, o.c3], type: o.shape === "image" ? "img" : o.shape, img: o.partImg, g: o.gravity, drag: 1.5, vr: 8, add: !solidShape && o.shape !== "image", alpha: o.shape === "smoke" ? 0.45 : 1,
          ang: o.spread === "up" ? -Math.PI / 2 : o.spread === "down" ? Math.PI / 2 : o.spread === "fan" ? -Math.PI / 2 : null, spread: o.spread === "fan" ? 1.2 : o.spread === "all" ? 0 : 0.6 });
      }
      if (o.impactImg) add({ life: o.impLife, add: false, draw(t) { const u = clamp01(t / o.impLife), sc = 0.45 + eBack(Math.min(1, u * 2.4)) * 0.55, a = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4; drawImg(o.impactImg, b.x, b.y, o.impSize * sc, o.impSpin ? u * 3 : 0, Math.max(0, a)); } });
      if (o.smoke > 0) burst(b, o.smoke, { sp: [10, 60], vy: -20, life: [0.7, 1.1], size: [12, 18], size2: 44, colors: ["rgba(70,60,70,.9)"], alpha: 0.4, add: false, type: "smoke", drag: 1 });
    };
    return { travel, impact, shake: o.shake, sound: o.sound || "", ranged: !!travel, color: o.c1 };
  }
  const CUSTOM = {};
  function define(id, spec) {
    if (!id) return null;
    if (!spec) { delete S[id]; delete CUSTOM[id]; return null; }
    const c = compileFx(spec); S[id] = { travel: c.travel, impact: c.impact }; CUSTOM[id] = c; return c;
  }
  // table moments a meta can restyle with one of its effects
  const MOMENT_KEYS = ["land", "death", "spellcast", "spellhit", "evolve", "shieldpop", "summonfx", "herohit", "triple", "upgrade", "buy", "sell"];
  let MOMENTS = {};
  function setMoments(m) { MOMENTS = {}; for (const k of MOMENT_KEYS) if (m && m[k] && S[m[k]]) MOMENTS[k] = m[k]; }
  // ---------------------------------------------------------------- api
  async function play(kind, a, b) {
    const st = S[kind]; if (!st || !b || !ensure()) return;
    if (a && st.travel) await st.travel(a, b);
    else if (kind === "lightning" && st.travel) await st.travel(a || { x: b.x, y: 0 }, b);
    st.impact(b);
  }
  function travel(kind, a, b) { const st = S[kind]; return st && st.travel && ensure() ? st.travel(a, b) : Promise.resolve(); }
  function impact(kind, b, o) { const k = MOMENTS[kind] && S[MOMENTS[kind]] ? MOMENTS[kind] : kind, st = S[k]; if (st && ensure()) st.impact(b, o || {}); }
  const hasMoment = (k) => !!(MOMENTS[k] && S[MOMENTS[k]]);
  function clear() { parts = []; items.forEach((it) => it.onEnd && it.onEnd()); items = []; flash.a = 0; if (ctx) ctx.clearRect(0, 0, W, H); }
  root.WA_FXE = { play, travel, impact, trail, clear, define, compileFx, fxSpec, setMoments, hasMoment, FX_DEF, FX_SHAPES, FX_TRAVELS, FX_TRAILS, MOMENT_KEYS, get CUSTOM() { return CUSTOM; }, setSpeed(fn) { speed = fn; }, ensure, get busy() { return running; },
    // the looks a card can pick; the table moments above are internal
    LOOKS: ["fire", "lightning", "frost", "water", "shadow", "poison", "nature", "holy", "void", "wind", "dust", "arrow", "meat"], ALIAS };
})(typeof window !== "undefined" ? window : globalThis);
