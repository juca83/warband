// ===================================================================
// Warband Arena - table ambience: weather and particles, light (tint, vignette, rays),
// a moving background and the table's own music. Set per table in the Table workshop.
// ===================================================================
(function (root) {
  "use strict";
  const W = 1280, H = 760;
  // particle looks: n = how many at density 1, c = default colour, glow = drawn additively
  const FX = {
    rain: { n: 150, c: "#a9c8ff", label: ["Rain", "Pluie"] },
    snow: { n: 90, c: "#ffffff", label: ["Snow", "Neige"] },
    embers: { n: 70, c: "#ff9a3a", glow: true, label: ["Embers", "Braises"] },
    bubbles: { n: 45, c: "#8fe3ff", label: ["Bubbles", "Bulles"] },
    fireflies: { n: 35, c: "#d8ff6a", glow: true, label: ["Fireflies", "Lucioles"] },
    leaves: { n: 28, c: "#d98b3a", label: ["Falling leaves", "Feuilles"] },
    petals: { n: 32, c: "#ffb3cf", label: ["Petals", "Pétales"] },
    dust: { n: 70, c: "#ffe7b0", glow: true, label: ["Floating dust", "Poussière"] },
    sparkles: { n: 50, c: "#fff3b0", glow: true, label: ["Sparkles", "Étincelles"] },
    fog: { n: 14, c: "#c9d2ff", label: ["Fog", "Brume"] },
    ash: { n: 60, c: "#9a9aa8", label: ["Ash", "Cendres"] },
  };
  const MOTIONS = { none: ["Still", "Immobile"], drift: ["Slow drift", "Dérive lente"], breathe: ["Breathing", "Respiration"], sway: ["Sway", "Balancement"] };
  const DEF = { fx: "none", density: 1, speed: 1, color: "", front: false, tint: "#000000", tintA: 0, vignette: 0, rays: 0, raysColor: "#fff1c4", motion: "none", music: null, musicVol: 0.5 };
  let cfg = Object.assign({}, DEF), parts = [], raf = 0, last = 0, cvB = null, cvF = null, box = null, tintEl = null, vigEl = null, raysEl = null;
  let music = null, musicSrc = null, musicKey = null, unlocked = false, muted = false;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const reduce = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

  function layers() {
    const stage = document.getElementById("stage"); if (!stage) return false;
    const sr = stage.querySelector(".shake-root") || stage;
    if (!box) {
      box = document.createElement("div"); box.id = "ambBack"; box.className = "amb-layer";
      box.innerHTML = `<div class="amb-tint"></div><div class="amb-rays"><i></i><i></i><i></i></div><canvas width="${W}" height="${H}"></canvas><div class="amb-vig"></div>`;
      const bg = sr.querySelector(".table-bg"); sr.insertBefore(box, bg ? bg.nextSibling : sr.firstChild);
      tintEl = box.querySelector(".amb-tint"); raysEl = box.querySelector(".amb-rays"); vigEl = box.querySelector(".amb-vig"); cvB = box.querySelector("canvas");
      cvF = document.createElement("canvas"); cvF.id = "ambFront"; cvF.className = "amb-front"; cvF.width = W; cvF.height = H;
      const bn = document.getElementById("banner"); if (bn && bn.parentNode) bn.parentNode.insertBefore(cvF, bn); else sr.appendChild(cvF);
    }
    return true;
  }
  function hexA(hex, a) { const h = String(hex || "#000").replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h.slice(0, 6), 16) || 0; return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

  function spawn(fx, init) {
    const p = { x: rnd(0, W), y: init ? rnd(0, H) : 0, t: rnd(0, 1000), s: rnd(0.6, 1.4), r: rnd(0, Math.PI * 2), life: rnd(0.4, 1) };
    switch (fx) {
      case "rain": p.y = init ? p.y : rnd(-60, -5); p.vx = -1.2; p.vy = rnd(9, 13); p.len = rnd(10, 22); break;
      case "snow": p.y = init ? p.y : -6; p.vx = rnd(-0.3, 0.3); p.vy = rnd(0.5, 1.3); p.size = rnd(1.2, 3.4); break;
      case "ash": p.y = init ? p.y : -6; p.vx = rnd(-0.5, 0.2); p.vy = rnd(0.3, 0.9); p.size = rnd(1, 2.6); break;
      case "embers": p.y = init ? p.y : H + 6; p.vx = rnd(-0.4, 0.4); p.vy = -rnd(0.6, 1.8); p.size = rnd(1.2, 3); break;
      case "bubbles": p.y = init ? p.y : H + 10; p.vx = 0; p.vy = -rnd(0.5, 1.4); p.size = rnd(3, 9); break;
      case "fireflies": p.vx = rnd(-0.4, 0.4); p.vy = rnd(-0.4, 0.4); p.size = rnd(1.6, 3.2); break;
      case "leaves": case "petals": p.y = init ? p.y : -12; p.vx = rnd(-0.6, 0.6); p.vy = rnd(0.6, 1.4); p.size = rnd(fx === "leaves" ? 5 : 4, fx === "leaves" ? 9 : 7); p.vr = rnd(-0.05, 0.05); break;
      case "dust": p.vx = rnd(-0.15, 0.15); p.vy = rnd(-0.12, 0.12); p.size = rnd(0.8, 2.2); break;
      case "sparkles": p.size = rnd(1.5, 4); p.life = rnd(0.5, 1.6); p.age = init ? rnd(0, p.life) : 0; break;
      case "fog": p.x = init ? rnd(-200, W) : -320; p.y = rnd(H * 0.2, H * 0.95); p.vx = rnd(0.15, 0.4); p.vy = 0; p.size = rnd(160, 300); break;
    }
    return p;
  }
  function step(dt) {
    const fx = cfg.fx, sp = cfg.speed || 1, k = dt / 16.7 * sp;
    const ctxs = [cvB, cvF].map((c) => c && c.getContext("2d"));
    for (const c of ctxs) if (c) c.clearRect(0, 0, W, H);
    const g = (cfg.front ? cvF : cvB).getContext("2d"), col = cfg.color || (FX[fx] && FX[fx].c) || "#fff";
    g.save(); if (FX[fx] && FX[fx].glow) g.globalCompositeOperation = "lighter";
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]; p.t += dt;
      switch (fx) {
        case "rain": p.x += p.vx * k; p.y += p.vy * k; g.strokeStyle = hexA(col, 0.42); g.lineWidth = 1.2; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + p.vx * p.len * 0.25, p.y - p.len); g.stroke(); break;
        case "snow": case "ash": p.x += (p.vx + Math.sin(p.t / 900 + p.r) * 0.35) * k; p.y += p.vy * k; g.fillStyle = hexA(col, fx === "ash" ? 0.55 : 0.85); g.beginPath(); g.arc(p.x, p.y, p.size, 0, 6.3); g.fill(); break;
        case "embers": { p.x += (p.vx + Math.sin(p.t / 400 + p.r) * 0.3) * k; p.y += p.vy * k; const a = 0.5 + 0.5 * Math.sin(p.t / 120 + p.r); g.fillStyle = hexA(col, 0.35 + 0.5 * a); g.beginPath(); g.arc(p.x, p.y, p.size, 0, 6.3); g.fill(); g.fillStyle = hexA(col, 0.12); g.beginPath(); g.arc(p.x, p.y, p.size * 3, 0, 6.3); g.fill(); break; }
        case "bubbles": p.x += Math.sin(p.t / 500 + p.r) * 0.4 * k; p.y += p.vy * k; g.strokeStyle = hexA(col, 0.55); g.lineWidth = 1.2; g.beginPath(); g.arc(p.x, p.y, p.size, 0, 6.3); g.stroke(); g.fillStyle = hexA("#ffffff", 0.35); g.beginPath(); g.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.22, 0, 6.3); g.fill(); break;
        case "fireflies": { p.vx += rnd(-0.05, 0.05); p.vy += rnd(-0.05, 0.05); p.vx = Math.max(-0.6, Math.min(0.6, p.vx)); p.vy = Math.max(-0.6, Math.min(0.6, p.vy)); p.x += p.vx * k; p.y += p.vy * k; const a = Math.max(0, Math.sin(p.t / 700 + p.r)); g.fillStyle = hexA(col, 0.9 * a); g.beginPath(); g.arc(p.x, p.y, p.size, 0, 6.3); g.fill(); g.fillStyle = hexA(col, 0.18 * a); g.beginPath(); g.arc(p.x, p.y, p.size * 5, 0, 6.3); g.fill(); break; }
        case "leaves": case "petals": p.x += (p.vx + Math.sin(p.t / 700 + p.r) * 0.8) * k; p.y += p.vy * k; p.r += (p.vr || 0) * k; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = hexA(col, 0.85); g.beginPath(); g.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, 6.3); g.fill(); g.restore(); break;
        case "dust": { p.x += (p.vx + Math.sin(p.t / 1500 + p.r) * 0.1) * k; p.y += (p.vy + Math.cos(p.t / 1700 + p.r) * 0.1) * k; const a = 0.3 + 0.3 * Math.sin(p.t / 900 + p.r); g.fillStyle = hexA(col, a); g.beginPath(); g.arc(p.x, p.y, p.size, 0, 6.3); g.fill(); break; }
        case "sparkles": { p.age = (p.age || 0) + dt / 1000 * sp; const a = Math.sin(Math.PI * Math.min(1, p.age / p.life)); g.fillStyle = hexA(col, a); const s = p.size * (0.6 + a * 0.6); g.beginPath(); g.moveTo(p.x, p.y - s * 2); g.lineTo(p.x + s * 0.5, p.y); g.lineTo(p.x, p.y + s * 2); g.lineTo(p.x - s * 0.5, p.y); g.closePath(); g.fill(); g.beginPath(); g.moveTo(p.x - s * 2, p.y); g.lineTo(p.x, p.y + s * 0.5); g.lineTo(p.x + s * 2, p.y); g.lineTo(p.x, p.y - s * 0.5); g.closePath(); g.fill(); break; }
        case "fog": { p.x += p.vx * k; const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size); gr.addColorStop(0, hexA(col, 0.12)); gr.addColorStop(1, hexA(col, 0)); g.fillStyle = gr; g.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2); break; }
      }
      const out = p.y > H + 40 || p.y < -60 || p.x < -340 || p.x > W + 340 || (fx === "sparkles" && p.age > p.life);
      if (out) parts[i] = spawn(fx, fx === "fireflies" || fx === "dust" || fx === "sparkles");
      else if ((fx === "fireflies" || fx === "dust") && (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20)) parts[i] = spawn(fx, true);
    }
    g.restore();
  }
  function loop(ts) {
    raf = 0;
    if (!cfg.fx || cfg.fx === "none" || !FX[cfg.fx]) return;
    const dt = last ? Math.min(50, ts - last) : 16; last = ts;
    if (!document.hidden) step(dt);
    raf = requestAnimationFrame(loop);
  }
  function clearCanvases() { for (const c of [cvB, cvF]) if (c) c.getContext("2d").clearRect(0, 0, W, H); }

  // ---- music: the table's own loop, through a plain <audio> element
  // the meta's music (Workshop > Sounds): one track per moment; a table's own loop wins in the tavern and in fights
  let tracks = {}, tracksVol = 0.5, phase = "menu";
  function applyMusic() {
    const own = phase !== "menu" && cfg.music, src = own ? cfg.music : tracks[phase] || (phase === "combat" ? tracks.tavern : null) || null, key = src ? (typeof src === "string" ? src.slice(0, 64) + src.length : "blob" + src.size + src.type) : null;
    if (key !== musicKey) {
      musicKey = key;
      if (music) { music.pause(); music.removeAttribute("src"); music.load(); }
      if (musicSrc && musicSrc.startsWith("blob:")) URL.revokeObjectURL(musicSrc);
      musicSrc = null;
      if (src) { if (!music) { music = new Audio(); music.loop = true; } musicSrc = typeof src === "string" ? src : URL.createObjectURL(src); music.src = musicSrc; }
    }
    if (music) { music.volume = Math.max(0, Math.min(1, own ? (cfg.musicVol == null ? 0.5 : cfg.musicVol) : tracksVol)); if (src && unlocked && !muted) music.play().catch(() => {}); else music.pause(); }
  }

  function apply(c) {
    cfg = Object.assign({}, DEF, c || {});
    if (!layers()) return;
    const stage = document.getElementById("stage");
    tintEl.style.background = cfg.tintA > 0 ? hexA(cfg.tint, Math.min(0.8, cfg.tintA)) : "";
    vigEl.style.opacity = String(Math.min(1, cfg.vignette || 0));
    raysEl.style.opacity = String(Math.min(1, cfg.rays || 0)); raysEl.style.setProperty("--rc", cfg.raysColor || DEF.raysColor);
    const bg = stage.querySelector(".table-bg");
    if (bg) { for (const m of Object.keys(MOTIONS)) bg.classList.toggle("amb-" + m, cfg.motion === m && m !== "none"); }
    const fx = FX[cfg.fx] ? cfg.fx : "none";
    const n = fx === "none" ? 0 : Math.round(FX[fx].n * Math.max(0.1, Math.min(3, cfg.density || 1)) * (reduce() ? 0.3 : 1));
    parts = []; for (let i = 0; i < n; i++) parts.push(spawn(fx, true));
    clearCanvases();
    cvF.style.display = cfg.front ? "" : "none";
    if (n && !raf) { last = 0; raf = requestAnimationFrame(loop); }
    if (!n && raf) { cancelAnimationFrame(raf); raf = 0; }
    applyMusic();
  }
  function unlock() { if (unlocked) return; unlocked = true; applyMusic(); }
  function setMuted(m) { muted = !!m; applyMusic(); }
  function setTracks(t, vol) { tracks = Object.assign({}, t || {}); tracksVol = vol == null ? 0.5 : Math.max(0, Math.min(1, +vol)); applyMusic(); }
  function setPhase(p) { if (p === phase) return; phase = p; applyMusic(); }
  root.WA_AMB = { apply, unlock, setMuted, setTracks, setPhase, get phase() { return phase; }, FX, MOTIONS, DEF, get muted() { return muted; }, get playing() { return !!(music && !music.paused); }, get cfg() { return Object.assign({}, cfg); } };
})(typeof window !== "undefined" ? window : globalThis);
