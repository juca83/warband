// ===================================================================
// Warband Arena - presentation: rendering, drag and drop, animation, sound.
// ===================================================================
(function () {
  "use strict";
  const { Game, def, KEYWORD_INFO, BOARD_MAX, HAND_MAX, MAX_TIER, BUY, ROLL, TRIBES, TRIBE_BLURB, mmrDelta, rankOf, KW_LIST, KW_TEXT } = window.WA;
  const ARTMOD = window.WA_ART;
  const TN = (t) => window.WA.tribeName(t);
  const T = (s) => (window.WA_I18N ? window.WA_I18N.t(s) : s);
  const { art, spellArt, tribeIcon } = ARTMOD;
  const $ = (s) => document.querySelector(s);
  const stage = $("#stage");

  let scale = 1, game = null, you = null, busy = false, speed = 1, skipping = false;
  // "snappy": when actions come fast (APM play), animations shorten and tooltips and quips stay out of the way
  let lastAct = 0, snappy = false, tipQuiet = 0, goldDelay = 0, lastGold = null; const quietAt = { x: -99, y: -99 };
  window.addEventListener("pointermove", (e) => { ptrNow.x = e.clientX; ptrNow.y = e.clientY; }, { passive: true, capture: true }); const ptrNow = { x: -99, y: -99 };
  const S = (ms) => (snappy ? Math.round(ms * 0.45) : ms);

  // ---------------------------------------------------------------- profile
  const profile = { mmr: 3000, games: 0, best: 8, wins: 0, top4: 0, timer: true, history: [], mode: "normal", duo: false, name: "", netMode: "peer", pace: "normal" };
  try { Object.assign(profile, JSON.parse(localStorage.getItem("wa-profile") || "{}")); } catch (e) {}
  function saveProfile() { try { localStorage.setItem("wa-profile", JSON.stringify(profile)); } catch (e) {} }

  // ---------------------------------------------------------------- utils
  const realWait = (ms) => new Promise((r) => setTimeout(r, ms));
  const wait = (ms) => realWait(ms / speed);
  const D = (ms) => ms / speed;
  function fit() {
    const app = $("#app"), cs = getComputedStyle(app);
    const pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight), pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom);
    const w = app.clientWidth - pl - pr, h = app.clientHeight - pt - pb;
    scale = Math.max(0.1, Math.min(w / 1280, h / 760));
    stage.style.transform = `scale(${scale})`;
    stage.style.left = pl + (w - 1280 * scale) / 2 + "px";
    stage.style.top = pt + (h - 760 * scale) / 2 + "px";
  }
  function toStage(cx, cy) { const r = stage.getBoundingClientRect(); return { x: (cx - r.left) / scale, y: (cy - r.top) / scale }; }
  function rectOf(el) {
    const s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    const x = (r.left - s.left) / scale, y = (r.top - s.top) / scale, w = r.width / scale, h = r.height / scale;
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  }
  function anim(el, frames, opts) { return el.animate(frames, opts).finished.catch(() => {}); }

  // ---------------------------------------------------------------- icons
  const ICON = {
    target: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2" fill="#fff"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/></svg>`,
    star: `<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7z" fill="#ffd25a" stroke="#5a3a08" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="#ffd25a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/></svg>`,
    snow: `<svg viewBox="0 0 24 24" fill="none" stroke="#9fdcff" stroke-width="2.2" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9 4l3 3 3-3M9 20l3-3 3 3M3.5 10.5l4-1-1-4M20.5 13.5l-4 1 1 4M3.5 13.5l4 1-1 4M20.5 10.5l-4-1 1-4"/></svg>`,
    up: `<svg viewBox="0 0 24 24" fill="none" stroke="#ffd25a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V6M5 12l7-7 7 7"/><path d="M5 20h14"/></svg>`,
    skull: `<svg viewBox="0 0 24 24"><path d="M12 2.5c-4.7 0-8 3.2-8 7.6 0 2.6 1.2 4.3 3 5.3V19h10v-3.6c1.8-1 3-2.7 3-5.3 0-4.4-3.3-7.6-8-7.6z" fill="#efe6d2"/><circle cx="8.8" cy="10.5" r="2" fill="#1b120c"/><circle cx="15.2" cy="10.5" r="2" fill="#1b120c"/><path d="M12 13l-1.2 2h2.4z" fill="#1b120c"/></svg>`,
    venom: `<svg viewBox="0 0 24 30"><path d="M12 1C9 8 3 13 3 19.5A9 9 0 0 0 21 19.5C21 13 15 8 12 1z" fill="#8ee05a" stroke="#1b4a0a" stroke-width="2"/><ellipse cx="9" cy="18" rx="2.2" ry="3" fill="#e8ffc0" opacity=".8"/></svg>`,
    wind: `<svg viewBox="0 0 100 100" fill="none" stroke="#dff3ff" stroke-width="3" stroke-linecap="round"><path d="M50 6a44 44 0 0 1 40 26"/><path d="M94 50a44 44 0 0 1-26 40"/><path d="M50 94a44 44 0 0 1-40-26"/><path d="M6 50a44 44 0 0 1 26-40"/></svg>`,
    sound: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>`,
    mute: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>`,
  };
  const stars = (n) => `<i class="star"></i>`.repeat(n);
  const icon = (k) => ICON[k] || "";
  const KW_NAMES = KW_TEXT;
  // escape anything that came from the editor or an import before it goes into innerHTML
  const escH = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------------------------------------------------------------- sound
  // Everything is synthesised: a small graph (compressor, a soft echo bus) and layered voices with
  // real envelopes and pitch sweeps, with a little random variation so repeats never sound identical.
  let sfxVol = 1; // the meta's sound volume (Workshop > Sounds)
  const audio = {
    ctx: null, on: true, bus: null, echo: null,
    // the graph: voices -> bus (volume) -> warmth (soft saturation) -> glue compressor -> limiter -> out, and a send to a real room reverb
    build(c) {
      this.ctx = c; this.noiseBuf = null;
      const lim = c.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
      const glue = c.createDynamicsCompressor(); glue.threshold.value = -16; glue.knee.value = 12; glue.ratio.value = 3.5; glue.attack.value = 0.006; glue.release.value = 0.16;
      const warm = c.createWaveShaper(); warm.curve = this.curve(1.6); warm.oversample = "2x";
      const low = c.createBiquadFilter(); low.type = "lowshelf"; low.frequency.value = 110; low.gain.value = 3.5;
      const air = c.createBiquadFilter(); air.type = "highshelf"; air.frequency.value = 7000; air.gain.value = 2;
      this.bus = c.createGain(); this.bus.gain.value = 0.55 * sfxVol;
      this.bus.connect(low).connect(warm).connect(air).connect(glue).connect(lim).connect(c.destination);
      // room: a convolution reverb with a generated stereo tail (dark, about 1.3 s)
      const verb = c.createConvolver(); verb.buffer = this.room(c, 1.3, 2.8); const vlp = c.createBiquadFilter(); vlp.type = "lowpass"; vlp.frequency.value = 5200; const vret = c.createGain(); vret.gain.value = 0.55;
      this.echo = c.createGain(); this.echo.gain.value = 1;
      const pre = c.createDelay(0.1); pre.delayTime.value = 0.018;
      this.echo.connect(pre).connect(verb).connect(vlp).connect(vret).connect(this.bus);
    },
    curve(k) { const n = 2048, a = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; a[i] = Math.tanh(k * x) / Math.tanh(k); } return a; },
    room(c, secs, decay) {
      const len = Math.floor(c.sampleRate * secs), b = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { const t = i / len; lp = lp * 0.55 + (Math.random() * 2 - 1) * 0.45; d[i] = lp * Math.pow(1 - t, decay) * (i < c.sampleRate * 0.004 ? i / (c.sampleRate * 0.004) : 1); } }
      return b;
    },
    unlock() {
      if (!this.ctx) { try { this.build(new (window.AudioContext || window.webkitAudioContext)()); } catch (e) { this.ctx = null; return; } }
      if (this.ctx.state === "suspended") this.ctx.resume();
      if (window.WA_AMB) { window.WA_AMB.setMuted(!this.on); window.WA_AMB.unlock(); }
    },
    now() { return this.ctx.currentTime; },
    // route a voice: optional stereo position (-1..1) and a share sent to the room
    out(g, send, pan) {
      let n = g;
      if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); n.connect(p); n = p; }
      n.connect(this.bus); if (send) { const e = this.ctx.createGain(); e.gain.value = send; n.connect(e).connect(this.echo); }
    },
    env(g, t, vol, a, dur, r) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + a); if (r != null) g.gain.setValueAtTime(vol, t + Math.max(a, dur - r)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); },
    // o: { f, f2, type, dur, vol, a, r, delay, detune, send, curve, pan, drive, lp }
    osc(o) {
      if (!this.on || !this.ctx) return;
      const c = this.ctx, t = c.currentTime + (o.delay || 0), dur = o.dur || 0.2, a = o.a == null ? 0.004 : o.a;
      const x = c.createOscillator(), g = c.createGain();
      x.type = o.type || "sine"; x.frequency.setValueAtTime(o.f, t); if (o.detune) x.detune.value = o.detune;
      if (o.f2) x.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + dur * (o.curve || 1));
      this.env(g, t, o.vol || 0.1, a, dur, o.r == null ? null : o.r);
      let n = x;
      if (o.lp) { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(o.lp, t); if (o.lp2) f.frequency.exponentialRampToValueAtTime(o.lp2, t + dur); f.Q.value = o.q || 0.7; n.connect(f); n = f; }
      if (o.drive) { const w = c.createWaveShaper(); w.curve = this.curve(o.drive); n.connect(w); n = w; }
      n.connect(g); this.out(g, o.send, o.pan); x.start(t); x.stop(t + dur + 0.05);
    },
    // a struck metal / glass voice: inharmonic partials, each with its own decay (coins, ice, bells)
    metal(f, o = {}) {
      if (!this.on || !this.ctx) return;
      const parts = o.parts || [1, 2.32, 4.25, 6.63, 9.1], c = this.ctx, t = c.currentTime + (o.delay || 0), dur = o.dur || 0.5, vol = o.vol || 0.05;
      parts.forEach((p, i) => { const x = c.createOscillator(), g = c.createGain(); x.frequency.value = f * p * (1 + (Math.random() - 0.5) * 0.004); this.env(g, t, vol / (1 + i * 0.55), 0.0015, dur / (1 + i * 0.45)); x.connect(g); this.out(g, o.send == null ? 0.35 : o.send, o.pan); x.start(t); x.stop(t + dur + 0.05); });
    },
    // bell-like FM voice (kept for melodic stingers)
    bell(f, dur, vol, delay = 0, ratio = 2.76, send = 0.5, pan = 0) {
      if (!this.on || !this.ctx) return;
      const c = this.ctx, t = c.currentTime + delay;
      const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
      car.frequency.value = f; mod.frequency.value = f * ratio; mg.gain.setValueAtTime(f * 1.4, t); mg.gain.exponentialRampToValueAtTime(f * 0.04, t + dur * 0.5);
      mod.connect(mg).connect(car.frequency);
      this.env(g, t, vol, 0.003, dur); car.connect(g); this.out(g, send, pan); car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
    },
    // o: { dur, vol, type (filter), f, f2, q, delay, send, a, pan, drive, rev (a swell: rises then cuts) }
    noise(o) {
      if (!this.on || !this.ctx) return;
      const c = this.ctx, t = c.currentTime + (o.delay || 0), dur = o.dur || 0.2;
      if (!this.noiseBuf) { const len = c.sampleRate * 2; this.noiseBuf = c.createBuffer(1, len, c.sampleRate); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; }
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.noiseBuf; f.type = o.type || "bandpass"; f.Q.value = o.q || 0.8; f.frequency.setValueAtTime(o.f || 1000, t);
      if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
      if (o.rev) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + dur * 0.92); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
      else this.env(g, t, o.vol || 0.2, o.a == null ? 0.002 : o.a, dur);
      let n = src.connect(f);
      if (o.drive) { const w = c.createWaveShaper(); w.curve = this.curve(o.drive); n.connect(w); n = w; }
      n.connect(g); this.out(g, o.send, o.pan); src.start(t, Math.random() * 1.5, dur + 0.05);
    },
    // an impact: a click for the attack, a pitched sub drop for the weight, a crunchy body, a short room
    impact(o = {}) {
      const s = o.size || 1, d = o.delay || 0, p = o.pan || 0;
      this.noise({ dur: 0.012, vol: 0.22 * (o.click == null ? 1 : o.click), type: "bandpass", f: 4200, q: 0.6, delay: d, pan: p });
      this.osc({ f: (o.f0 || 150) * rv(1, 0.04), f2: o.f1 || 42, type: "sine", dur: 0.28 * s, vol: 0.62 * (o.sub == null ? 1 : o.sub), curve: 0.45, delay: d, drive: 1.8 });
      this.noise({ dur: 0.16 * s, vol: 0.32 * (o.body == null ? 1 : o.body), type: "lowpass", f: o.bodyF || 1800, f2: 160, q: 0.9, delay: d, drive: 2.2, send: o.send == null ? 0.25 : o.send, pan: p });
    },
    // a sustained chord: detuned saws through a moving low-pass (for stingers)
    pad(freqs, o = {}) {
      freqs.forEach((f, i) => [-7, 7].forEach((dt) => this.osc({ f, type: "sawtooth", detune: dt, dur: o.dur || 0.7, vol: (o.vol || 0.035) / freqs.length * 2, a: o.a || 0.03, lp: o.lp || 900, lp2: o.lp2 || 2600, delay: (o.delay || 0) + i * (o.spread || 0), send: o.send == null ? 0.5 : o.send, pan: dt / 20 })));
    },
  };
  // legacy helpers kept for any caller: tone(freq, dur, type, vol, slide, delay)
  audio.tone = (f, dur, type = "sine", vol = 0.15, slide = 0, delay = 0) => audio.osc({ f, f2: slide ? f * slide : 0, type, dur, vol, delay });
  const rv = (v, k = 0.06) => v * (1 + (Math.random() * 2 - 1) * k); // a little variation so repeats never sound identical
  const rp = (k = 0.25) => (Math.random() * 2 - 1) * k;                // a little stereo spread
  const sfx = {
    // gold: two real coins touching (inharmonic metal), a tiny tick, a little room
    // the damage count: a bright tick that climbs with each tier added
    tally(k = 0) { const f = 784 * Math.pow(2, Math.min(k, 16) / 12), p = rp(0.25); audio.metal(f, { dur: 0.22, vol: 0.07, pan: p, send: 0.25 }); audio.osc({ f: f / 2, f2: f / 2.2, dur: 0.07, vol: 0.05 }); },
    coin() { const f = rv(2350, 0.04), p = rp(0.3); audio.noise({ dur: 0.008, vol: 0.3, type: "highpass", f: 6000, pan: p }); audio.metal(f, { dur: 0.42, vol: 0.12, pan: p, send: 0.3 }); audio.metal(f * 1.19, { dur: 0.32, vol: 0.085, delay: 0.055, pan: p + 0.1, send: 0.3 }); audio.osc({ f: 180, f2: 90, dur: 0.05, vol: 0.06 }); },
    // a card taken up: a quick swish of card stock and a soft lift
    pick() { audio.noise({ dur: 0.09, vol: 0.95, type: "bandpass", f: 1800, f2: 5200, q: 0.9, a: 0.01, pan: rp(0.2) }); audio.osc({ f: rv(320), f2: 520, type: "sine", dur: 0.07, vol: 0.3 }); },
    // set down: a soft cardboard slap on wood
    drop() { audio.noise({ dur: 0.05, vol: 0.34, type: "bandpass", f: 2400, q: 1.1, pan: rp(0.2) }); audio.osc({ f: 140, f2: 55, dur: 0.14, vol: 0.38, curve: 0.5, drive: 1.5 }); audio.noise({ dur: 0.1, vol: 0.14, type: "lowpass", f: 900, f2: 200, send: 0.15 }); },
    // refresh: a riffle of cards and a whoosh
    roll() { for (let i = 0; i < 9; i++) audio.noise({ dur: 0.022, vol: 0.09 + i * 0.006, type: "bandpass", f: rv(3200, 0.25), q: 1.4, delay: i * 0.018, pan: -0.3 + i * 0.07 }); audio.noise({ dur: 0.24, vol: 0.12, type: "bandpass", f: 500, f2: 3000, q: 0.6, a: 0.05, send: 0.2 }); audio.osc({ f: 90, f2: 60, dur: 0.12, vol: 0.18, delay: 0.17 }); },
    // freeze: a crystalline crack, glassy partials ringing in the room
    freeze() { audio.noise({ dur: 0.02, vol: 0.4, type: "highpass", f: 4500 }); audio.metal(rv(1900, 0.02), { parts: [1, 1.51, 2.93, 4.12, 5.7], dur: 1.1, vol: 0.08, send: 0.8, pan: -0.2 }); audio.metal(rv(2650, 0.02), { parts: [1, 1.71, 3.2], dur: 0.9, vol: 0.035, delay: 0.05, send: 0.8, pan: 0.25 }); for (let i = 0; i < 6; i++) audio.noise({ dur: 0.015, vol: 0.12, type: "highpass", f: 7000, delay: 0.04 + i * 0.03 + Math.random() * 0.02, pan: rp(0.6) }); audio.noise({ dur: 0.6, vol: 0.05, type: "highpass", f: 6000, f2: 9000, send: 0.6 }); },
    // tavern upgrade: a rising power chord with a sub swell and sparkles
    upgrade() { audio.noise({ dur: 0.35, vol: 0.12, type: "bandpass", f: 400, f2: 4000, q: 0.7, rev: true, send: 0.3 }); audio.osc({ f: 55, f2: 110, dur: 0.6, vol: 0.3, a: 0.05, delay: 0.3 }); audio.pad([262, 330, 392, 523], { dur: 0.9, vol: 0.06, delay: 0.33, lp: 700, lp2: 3800 }); [1047, 1319, 1568, 2093].forEach((f, i) => audio.metal(f, { parts: [1, 2.01, 3.02], dur: 0.6, vol: 0.022, delay: 0.36 + i * 0.05, send: 0.6, pan: -0.4 + i * 0.27 })); audio.impact({ delay: 0.33, size: 0.8, sub: 0.6, body: 0.4 }); },
    // refused: a dull double knock on wood
    error() { [0, 0.09].forEach((d, i) => { audio.osc({ f: 230 - i * 40, f2: 120, type: "triangle", dur: 0.09, vol: 0.14, delay: d, lp: 1200 }); audio.noise({ dur: 0.03, vol: 0.1, type: "bandpass", f: 900, q: 2, delay: d }); }); },
    whoosh() { const p = rp(0.4); audio.noise({ dur: 0.26, vol: 0.32, type: "bandpass", f: 300, f2: 3200, q: 0.6, a: 0.06, pan: p, send: 0.15 }); audio.noise({ dur: 0.2, vol: 0.06, type: "highpass", f: 4000, f2: 7000, a: 0.05, pan: -p }); },
    // a blow in combat
    hit() { audio.impact({ f0: rv(170, 0.08), f1: 45, pan: rp(0.3) }); audio.noise({ dur: 0.05, vol: 0.12, type: "bandpass", f: rv(2800, 0.2), q: 2, delay: 0.005 }); },
    ping() { const f = rv(2093, 0.02); audio.metal(f, { parts: [1, 2.0, 3.01, 4.2], dur: 0.5, vol: 0.11, send: 0.5, pan: rp(0.2) }); audio.noise({ dur: 0.01, vol: 0.2, type: "highpass", f: 6000 }); },
    // a minion dies: it cracks, crumbles and falls
    death() { audio.impact({ f0: 120, f1: 35, size: 1.2, sub: 0.7, body: 0.7, bodyF: 1200, send: 0.35 }); for (let i = 0; i < 7; i++) audio.noise({ dur: 0.03 + Math.random() * 0.03, vol: 0.08, type: "bandpass", f: rv(1300, 0.5), q: 2.5, delay: 0.06 + i * 0.035, pan: rp(0.5) }); audio.osc({ f: 300, f2: 70, type: "triangle", dur: 0.35, vol: 0.05, lp: 1500, lp2: 300, delay: 0.02 }); },
    // summoned: a rising swell of air that blooms into a soft chime
    summon() { audio.noise({ dur: 0.3, vol: 0.11, type: "bandpass", f: 600, f2: 3500, q: 0.7, rev: true, send: 0.4 }); audio.osc({ f: 65, f2: 98, dur: 0.4, vol: 0.18, a: 0.03, delay: 0.25 }); [784, 1175].forEach((f, i) => audio.metal(f, { parts: [1, 2.0, 3.0], dur: 0.6, vol: 0.03, delay: 0.27 + i * 0.05, send: 0.6, pan: i ? 0.3 : -0.3 })); },
    // stats gained: a bright lift
    buff() { const f = rv(988, 0.02); audio.osc({ f: f * 0.5, f2: f, type: "sine", dur: 0.12, vol: 0.15 }); audio.metal(f, { parts: [1, 2.0, 3.0], dur: 0.35, vol: 0.08, delay: 0.06, send: 0.4, pan: rp(0.3) }); },
    // a minion lands on the board: weight, a slap of wood and dust
    thud() { audio.impact({ f0: 130, f1: 38, size: 1.1, click: 0.6, body: 0.8, bodyF: 1100, send: 0.3 }); audio.noise({ dur: 0.25, vol: 0.06, type: "highpass", f: 2500, f2: 1200, a: 0.02, delay: 0.03, send: 0.3 }); },
    // a tavern spell: an inward rush, then a glittering burst
    spell() { audio.noise({ dur: 0.28, vol: 0.13, type: "bandpass", f: 500, f2: 4500, q: 0.8, rev: true, send: 0.4 }); [1319, 1760, 2349, 2637].forEach((f, i) => audio.metal(rv(f, 0.01), { parts: [1, 2.0, 3.0], dur: 0.6, vol: 0.026, delay: 0.27 + i * 0.04, send: 0.6, pan: -0.45 + i * 0.3 })); audio.osc({ f: 110, f2: 55, dur: 0.3, vol: 0.2, delay: 0.27 }); },
    // a hero is struck: a heavy, roomy blow
    hero() { audio.impact({ f0: 110, f1: 30, size: 1.6, sub: 1, body: 0.9, bodyF: 1400, send: 0.45 }); audio.noise({ dur: 0.5, vol: 0.08, type: "lowpass", f: 600, f2: 120, a: 0.02, delay: 0.05, send: 0.5 }); },
    // fight won / lost / back to the tavern: short stingers with a soft pad
    win() { audio.pad([392, 494, 587], { dur: 0.7, vol: 0.08, lp: 900, lp2: 3200 }); [784, 988, 1175].forEach((f, i) => audio.bell(f, 0.5, 0.06, 0.05 + i * 0.07, 2, 0.5, -0.3 + i * 0.3)); audio.osc({ f: 98, f2: 98, dur: 0.5, vol: 0.12, a: 0.02 }); },
    lose() { audio.pad([220, 262, 330], { dur: 0.9, vol: 0.05, lp: 1400, lp2: 400 }); audio.osc({ f: 110, f2: 73, dur: 0.8, vol: 0.14, a: 0.03, curve: 0.8 }); },
    tavern() { audio.pad([262, 330, 392], { dur: 0.6, vol: 0.08, lp: 800, lp2: 2000 }); audio.bell(784, 0.4, 0.07, 0.08, 2, 0.5); },
    // attack styles
    zap() { for (let i = 0; i < 5; i++) audio.noise({ dur: 0.04, vol: 0.2, type: "highpass", f: rv(3500, 0.3), delay: i * 0.03, pan: rp(0.5), drive: 3 }); audio.osc({ f: 2400, f2: 160, type: "sawtooth", dur: 0.22, vol: 0.07, drive: 3, lp: 5000 }); audio.impact({ delay: 0.03, size: 0.7, sub: 0.6, body: 0.5, bodyF: 3000 }); },
    fire() { audio.noise({ dur: 0.45, vol: 0.2, type: "lowpass", f: 300, f2: 2400, a: 0.06, drive: 2.5, send: 0.3 }); for (let i = 0; i < 8; i++) audio.noise({ dur: rv(0.04, 0.4), vol: 0.09, type: "bandpass", f: rv(1600, 0.5), q: 3, delay: 0.05 + i * 0.045, pan: rp(0.5) }); audio.impact({ delay: 0.12, size: 0.9, sub: 0.7, body: 0.6 }); },
    frost() { audio.metal(rv(2200, 0.02), { parts: [1, 1.51, 2.93, 4.12], dur: 0.7, vol: 0.045, send: 0.7 }); for (let i = 0; i < 5; i++) audio.noise({ dur: 0.02, vol: 0.11, type: "highpass", f: 7000, delay: 0.04 + i * 0.04, pan: rp(0.6) }); audio.impact({ size: 0.6, sub: 0.5, body: 0.4, bodyF: 4000, click: 1.2 }); },
    heal() { audio.pad([523, 659, 784], { dur: 0.8, vol: 0.08, a: 0.12, lp: 1200, lp2: 4000, send: 0.8 }); [1568, 2093].forEach((f, i) => audio.metal(f, { parts: [1, 2.0, 3.0], dur: 0.8, vol: 0.025, delay: 0.15 + i * 0.08, send: 0.8 })); },
    poison() { for (let i = 0; i < 6; i++) audio.osc({ f: rv(240, 0.4), f2: rv(520, 0.3), type: "sine", dur: 0.08, vol: 0.12, delay: i * 0.05, pan: rp(0.5) }); audio.noise({ dur: 0.4, vol: 0.09, type: "bandpass", f: 700, q: 3, a: 0.05, drive: 2 }); audio.osc({ f: 70, f2: 50, dur: 0.3, vol: 0.15 }); },
    holy() { audio.noise({ dur: 0.3, vol: 0.08, type: "highpass", f: 3000, f2: 8000, rev: true, send: 0.7 }); audio.pad([523, 659, 784, 1047], { dur: 1, vol: 0.06, a: 0.05, lp: 2000, lp2: 6000, send: 0.9, delay: 0.25 }); audio.impact({ delay: 0.27, size: 0.8, sub: 0.6, body: 0.3, bodyF: 5000 }); },
    shadow() { audio.osc({ f: 98, f2: 55, type: "sawtooth", dur: 0.6, vol: 0.07, detune: -12, lp: 600, lp2: 200, drive: 2 }); audio.osc({ f: 100, f2: 57, type: "sawtooth", dur: 0.6, vol: 0.07, detune: 12, lp: 600, lp2: 200, drive: 2 }); audio.noise({ dur: 0.5, vol: 0.09, type: "bandpass", f: 400, f2: 150, q: 1.5, a: 0.08, send: 0.6 }); audio.impact({ delay: 0.1, size: 1, sub: 0.8, body: 0.5, bodyF: 700 }); },
    arrow() { audio.noise({ dur: 0.13, vol: 0.18, type: "highpass", f: 2500, f2: 6000, a: 0.01, pan: rp(0.4) }); audio.noise({ dur: 0.02, vol: 0.25, type: "bandpass", f: 2000, q: 2, delay: 0.12 }); audio.osc({ f: 260, f2: 120, type: "triangle", dur: 0.08, vol: 0.12, delay: 0.12 }); },
    water() { audio.noise({ dur: 0.35, vol: 0.32, type: "bandpass", f: 500, f2: 2600, q: 0.9, send: 0.3 }); for (let i = 0; i < 6; i++) audio.osc({ f: rv(450, 0.3), f2: rv(1500, 0.3), type: "sine", dur: 0.05, vol: 0.06, delay: 0.06 + i * 0.045, pan: rp(0.6) }); audio.osc({ f: 90, f2: 50, dur: 0.2, vol: 0.2 }); },
    rock() { audio.impact({ f0: 90, f1: 26, size: 1.6, sub: 1, body: 1, bodyF: 700, send: 0.4 }); for (let i = 0; i < 7; i++) audio.noise({ dur: 0.03, vol: 0.12, type: "bandpass", f: rv(900, 0.5), q: 3, delay: 0.05 + i * 0.04, pan: rp(0.6) }); },
    slash() { audio.noise({ dur: 0.11, vol: 0.25, type: "highpass", f: 2200, f2: 6000, pan: -0.3 }); audio.noise({ dur: 0.1, vol: 0.2, type: "highpass", f: 1800, f2: 5200, delay: 0.07, pan: 0.3 }); audio.metal(rv(3100, 0.03), { parts: [1, 1.43, 2.6], dur: 0.25, vol: 0.02, delay: 0.02 }); audio.impact({ delay: 0.05, size: 0.6, sub: 0.5, body: 0.5, bodyF: 2500 }); },
    // a golden minion: the big one
    triple() { audio.noise({ dur: 0.45, vol: 0.14, type: "bandpass", f: 300, f2: 5000, q: 0.6, rev: true, send: 0.5 }); audio.impact({ delay: 0.44, size: 1.4, sub: 1, body: 0.6, send: 0.5 }); audio.pad([392, 494, 587, 784], { dur: 1.2, vol: 0.07, delay: 0.44, lp: 900, lp2: 5000 }); [1568, 1976, 2349, 3136].forEach((f, i) => audio.metal(f, { parts: [1, 2.0, 3.0], dur: 0.9, vol: 0.025, delay: 0.46 + i * 0.06, send: 0.7, pan: -0.45 + i * 0.3 })); },
    // a die on the table: a few quick rattles, then a bright note (made it) or a dull one (missed)
    dice(ok) { for (let i = 0; i < 4; i++) audio.noise({ dur: 0.02, vol: 0.35, type: "bandpass", f: rv(2600, 0.3), q: 3, delay: i * 0.045 + Math.random() * 0.015, pan: rp(0.4) }); audio.osc({ f: 160, f2: 90, dur: 0.06, vol: 0.2, delay: 0.19 });
      if (ok) audio.metal(rv(1568, 0.02), { parts: [1, 2.0, 3.0], dur: 0.45, vol: 0.1, delay: 0.22, send: 0.4 }); else audio.osc({ f: 220, f2: 150, type: "triangle", dur: 0.16, vol: 0.12, delay: 0.22, lp: 900 }); },
    miss() { audio.noise({ dur: 0.18, vol: 0.95, type: "bandpass", f: 1200, f2: 300, a: 0.02, pan: rp(0.4) }); },
    stone() { audio.noise({ dur: 0.06, vol: 0.45, type: "bandpass", f: rv(1200, 0.2), q: 3, drive: 2 }); audio.osc({ f: 160, f2: 80, dur: 0.1, vol: 0.4 }); },
  };

  // ---------------------------------------------------------------- minion elements
  function tokenHTML(d, tier) {
    return `<div class="mn-taunt"></div><div class="mn-fly" aria-hidden="true"><svg viewBox="0 0 40 24"><path d="M20 20C14 8 6 4 0 4c4 3 6 7 6 11 4-1 9 0 14 5z"/></svg><svg viewBox="0 0 40 24"><path d="M20 20C14 8 6 4 0 4c4 3 6 7 6 11 4-1 9 0 14 5z"/></svg></div><div class="mn-body"><div class="mn-px"></div></div><div class="mn-aura"></div><div class="mn-bubble"></div>
      <div class="mn-wind">${icon("wind")}</div><div class="mn-venom">${icon("venom")}</div><div class="mn-badge b-dr">${icon("skull")}</div>
      ${tier ? `<div class="mn-tier">${stars(d.tier)}</div>` : ""}${d.rarity && d.rarity !== "common" ? `<i class="rarity ${d.rarity} on-token"></i>` : ""}
      <div class="mn-gem atk"><span></span></div><div class="mn-gem hp"><span></span></div><div class="mn-frost"></div><button type="button" class="mn-act" hidden></button><div class="mn-evo" hidden><i class="ev0"></i><i class="ev1"></i><i class="evl"></i></div>`;
  }
  function makeToken(d, opts = {}) {
    const el = document.createElement("div");
    el.className = "mn" + (opts.static ? " static" : "") + (opts.board ? " mine" : "");
    el.dataset.uid = d.uid; el.dataset.tribe = d.tribe;
    el.innerHTML = tokenHTML(d, opts.tier);
    updateToken(el, d);
    bindTip(el); bindEvoTip(el);
    return el;
  }
  function updateToken(el, d) {
    const prev = el._d; el._d = d;
    if (el.dataset.tribe !== (d.tribe || "")) el.dataset.tribe = d.tribe || "";
    const key = d.cardId + d.name + (d.golden ? "g" : "") + (d.taunt ? "t" : "") + (window.WA_STORE ? ":" + window.WA_STORE.version : "");
    if (el._pxKey !== key) {
      el._pxKey = key;
      const px = el.querySelector(".mn-px");
      px.style.backgroundImage = `url("${ARTMOD.token(d)}")`;
      px.classList.toggle("photo", ARTMOD.hasPhoto(d.cardId));
    }
    el.classList.toggle("golden", d.golden);
    for (const k of KW_LIST) el.classList.toggle(k, !!d[k]);
    el.classList.toggle("silenced", !!d.silenced);
    el.classList.toggle("dr", !!d.deathrattle);
    const ab = el.querySelector(".mn-act");
    if (ab) { const on = !!d.activate && el.classList.contains("mine"); ab.hidden = !on; if (!on) el.classList.remove("can-act"); if (on) { const used = game && d.actTurn === game.turn; ab.textContent = (d.activate.work ? "⚒" : "⚡") + d.activate.cost + (d.activate.work ? ` · ${d.activate.done}/${d.activate.work}` : ""); ab.classList.toggle("used", used); el.classList.toggle("can-act", !used); ab.title = used ? T("Already activated this turn.") : (d.activate.work ? T("Work") : T("Activate")) + ` (${d.activate.cost} ${T("gold")})`; } }
    setGem(el.querySelector(".mn-gem.atk"), d.attack, d.attack > d.baseAttack ? "buffed" : "", prev && prev.attack !== d.attack);
    setGem(el.querySelector(".mn-gem.hp"), Math.max(d.health, 0), d.health < d.maxHealth ? "hurt" : d.maxHealth > d.baseHealth ? "buffed" : "", prev && prev.health !== d.health);
    setEvo(el, d, prev); setWounds(el, d); setAffs(el, d); setVars(el, d, prev); setMarkers(el, d, prev); el.classList.toggle("is-token", !!d.token); { const tg = el.querySelector(":scope > .mn-toktag"); if (d.token && !tg && !el.classList.contains("spell-tok")) el.insertAdjacentHTML("beforeend", `<div class="mn-toktag">${T("Token")}</div>`); else if (!d.token && tg) tg.remove(); } el.classList.toggle("iced", !!d.ice); el.classList.toggle("chilled", (d.chill || 0) > 0); if (!el.querySelector(":scope > .mn-hit")) el.insertAdjacentHTML("afterbegin", '<i class="mn-hit" aria-hidden="true"></i>');
    el.classList.toggle("mired", (d.mired || 0) > 0); applyLook(el, d); applyFrame(el, d);
    if (d.mired && !(prev && prev.mired >= d.mired)) anim(el, [{ filter: "brightness(1)" }, { filter: "brightness(.45) sepia(1) hue-rotate(-20deg)" }, { filter: "brightness(1)" }], { duration: 520 });
  }
  // ---- affinities: the little round icons on a minion or a card
  const AFF_IMG = (a) => WA.affIcon(a);
  const AFF_FRAMES = { steam: "ui-art/aff/aff-frame-steam.webp", shell: "ui-art/aff/aff-frame-shell.webp" };
  // badges: one per affinity, framed and placed as the meta's badge settings say (Card editor > Tribes & affinities)
  function affBadgeCSS() {
    const B = WA.AFF_BADGE, key = JSON.stringify(B);
    let st = document.getElementById("affBadgeCSS");
    if (st && st._key === key) return;
    if (!st) { st = document.createElement("style"); st.id = "affBadgeCSS"; document.head.appendChild(st); }
    st._key = key;
    const place = (sel, o, w, h) => {
      // inside the card or the minion by default (a badge sticking out would slide under the next card); the nudges move it out
      const z = o.size, off = -3, dx = o.dx || 0, dy = o.dy || 0;
      const P = { tl: `left:${-off + dx}px;top:${-off + dy}px`, tr: `right:${-off - dx}px;top:${-off + dy}px`, bl: `left:${-off + dx}px;bottom:${-off - dy}px`, br: `right:${-off - dx}px;bottom:${-off - dy}px`,
        left: `left:${-off + dx}px;top:calc(50% + ${dy}px);transform:translateY(-50%)`, right: `right:${-off - dx}px;top:calc(50% + ${dy}px);transform:translateY(-50%)`,
        top: `left:calc(50% + ${dx}px);top:${-off + dy}px;transform:translateX(-50%)`, bottom: `left:calc(50% + ${dx}px);bottom:${-off - dy}px;transform:translateX(-50%)`,
        name: `left:calc(50% + ${dx}px);top:calc(${Math.round(h * 0.5)}px + ${dy}px);transform:translate(-50%,-100%)` }[o.pos] || "";
      return `${sel} .mn-affs{left:auto;right:auto;top:auto;bottom:auto;transform:none;${P};grid-auto-flow:${o.dir === "row" ? "column" : "row"};gap:${Math.max(1, Math.round(z * 0.06))}px;--afs:${z}px}`;
    };
    st.textContent = place(".mn:not(.card)", B.token, 108, 138) + place(".card", B.card, 124, 178)
      + `.mn:not(.card) .afb{--fr:${B.token.frame}}` + (B.token.glow ? "" : `.mn:not(.card) .afb{filter:drop-shadow(0 1px 2px rgba(0,0,0,.85))}`) + (B.card.glow ? "" : `.card .afb{filter:drop-shadow(0 1px 2px rgba(0,0,0,.85))}`)
      + `.mn:not(.card) .afb{} .card .afb{}`;
    st.dataset.tf = B.token.frame; st.dataset.cf = B.card.frame;
  }
  function setAffs(el, d) {
    affBadgeCSS();
    const list = d.aff || [], B = WA.AFF_BADGE, fr = el.classList.contains("card") ? B.card.frame : B.token.frame;
    const key = list.map((a) => a + (WA.AFF[a] ? WA.AFF[a].color + WA.AFF[a].fx + AFF_IMG(a).length + AFF_IMG(a).slice(-24) : "")).join(",") + fr;
    let box = el.querySelector(".mn-affs");
    if (el._affKey === key) return; el._affKey = key;
    if (!list.length) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement("div"); box.className = "mn-affs"; el.appendChild(box); }
    box.innerHTML = list.map((a) => { const A = WA.AFF[a] || {}; return `<i class="afb f-${fr}${A.fx ? " fx-" + A.fx : ""}" style="--ac:${escH(A.color || "#c9a24a")}"><img src="${AFF_IMG(a)}" alt="${escH(WA.affName(a))}" title="${escH(WA.affName(a))}"></i>`; }).join("");
  }
  function setWounds(el, d) {
    let w = el.querySelector(".mn-wound");
    if (!d.wounds) { if (w) w.remove(); return; }
    if (!w) { w = document.createElement("div"); w.className = "mn-wound"; el.appendChild(w); }
    w.textContent = "✚".repeat(Math.min(3, d.wounds)); w.title = (isFr() ? `Blessé ${d.wounds} fois : -${d.wounds}/-${d.wounds}. ` : `Wounded ${d.wounds} time(s): -${d.wounds}/-${d.wounds}. `) + T("Rest it a whole step in your hand, or visit a camp.");
  }
  // ---- the Evolution crystal: fills from the bottom as it charges; hover it to read the charge
  function setEvo(el, d, prev) {
    const c = el.querySelector(".mn-evo"); if (!c) return;
    const g = d.gauge && !d.gauge.none ? d.gauge : null;
    c.hidden = !g; if (!g) return;
    const p = g.done ? 1 : Math.max(0, Math.min(1, g.have / g.need));
    c.style.setProperty("--p", p.toFixed(3));
    c.classList.toggle("full", p >= 1); c.classList.toggle("done", !!g.done && !g.rep);
    c.querySelector(".evl").textContent = g.done && !g.rep ? "" : `${g.have}/${g.need}`;
    const pg = prev && prev.gauge, before = pg ? (pg.done ? pg.need : pg.have) + (pg.lv || 0) * 100 : null, now = (g.done ? g.need : g.have) + (g.lv || 0) * 100;
    if (before != null && now > before && c.animate) {
      c.animate([{ transform: "translateX(-50%) scale(1)" }, { transform: "translateX(-50%) scale(1.45)", filter: "brightness(1.8) drop-shadow(0 0 10px #6cf)" }, { transform: "translateX(-50%) scale(1)" }], { duration: 520, easing: "cubic-bezier(.3,1.6,.5,1)" });
    }
  }
  function evoTipHTML(d) {
    const g = d.gauge; if (!g) return "";
    const p = g.done ? 1 : g.have / g.need;
    return `<div class="evo-tip"><div class="evo-head"><i class="evo-mini" style="--p:${p.toFixed(3)}"><i class="ev0"></i><i class="ev1"></i></i><div><b>${T("Evolution")}</b><span>${g.done && !g.rep ? T("Fully evolved") : g.have >= g.need ? T("Ready!") : `${g.have} / ${g.need} ${T("charges")}`}</span></div></div>
      ${g.done && !g.rep ? "" : `<div class="evo-bar"><i style="width:${Math.round(p * 100)}%"></i></div>`}
      ${g.how.length ? `<div class="kw"><b>${T("Charges")}:</b> ${g.how.map(escH).join(" · ")}</div>` : g.none ? "" : `<div class="kw"><b>${T("Charges")}:</b> ${T("only from other effects")}</div>`}
      ${g.what.length && !(g.done && !g.rep) ? `<div class="kw"><b>${T("When full")}:</b> ${escH(g.what.join(" "))}</div>` : ""}
      ${g.what.some((w) => /becomes|devient/i.test(w)) && !(g.done && !g.rep) ? `<div class="kw evo-note">${T("A new form keeps the stats it gained, its keywords and its mutations.")}</div>` : ""}
      ${g.lv ? `<div class="kw"><b>${T("Evolved")}:</b> ${g.lv}×</div>` : ""}
      ${g.muts.length ? `<div class="kw"><b>${T("Mutations")}:</b> ${g.muts.map(escH).join(", ")}</div>` : ""}</div>`;
  }
  function bindEvoTip(el) {
    const c = el.querySelector(".mn-evo"); if (!c) return;
    c.addEventListener("pointerenter", (e) => { if (e.pointerType !== "mouse" || drag) return; setTimeout(() => { clearTimeout(tipTimer); const d = el._d; if (!d || !d.gauge || !c.isConnected) return; const tip = $("#tip"); tip.classList.remove("big", "nosi"); tip.innerHTML = evoTipHTML(d); placeTip(c); }, 0); });
    c.addEventListener("pointerleave", (e) => { e.stopPropagation(); hideTip(); });
  }
  function setGem(g, v, cls, changed) {
    g.firstChild.textContent = v;
    g.classList.toggle("buffed", cls === "buffed"); g.classList.toggle("hurt", cls === "hurt");
    if (changed) g.animate([{ transform: "scale(1.7)" }, { transform: "scale(1)" }], { duration: 360, easing: "cubic-bezier(.3,1.7,.5,1)" });
  }

  // ---- a card's own look, set in the Card editor (Look): aura, foil, name colour, frame, entrance, sounds
  const lookOf = (d) => { if (!d) return null; const c = d.isSpell ? WA.SPELLS[d.spellId] : WA.CARDS[d.cardId] || (WA.TOKENS && WA.TOKENS[d.cardId]); return (c && c.look) || null; };
  function cardSkinById(id) { const st = window.WA_STORE; if (!st || !st.skinList) return null; return st.skinList("card").find((x) => x && x.id === id) || null; }
  function applyLook(el, d) {
    const L = lookOf(d), key = L ? [L.aura, L.auraStyle, L.foil, L.frame, L.nameColor, window.WA_STORE ? window.WA_STORE.version : ""].join("|") : "";
    if (el._lookKey === key) return; el._lookKey = key;
    for (const c of [...el.classList]) if (c.startsWith("lk-")) el.classList.remove(c);
    for (const v of ["--look", "--look-name", "--card-skin", "--card-skin-golden", "--card-skin-spell"]) el.style.removeProperty(v);
    for (const x of el.querySelectorAll(":scope > .lk-glow, :scope > .lk-foilfx")) x.remove();
    if (!L) return;
    if (L.aura) { el.style.setProperty("--look", L.aura); el.classList.add("lk-aura", "lk-a-" + (L.auraStyle || "glow")); const g = document.createElement("i"); g.className = "lk-glow"; el.insertBefore(g, el.firstChild); }
    if (L.foil) { el.classList.add("lk-foil", "lk-f-" + L.foil); const f = document.createElement("i"); f.className = "lk-foilfx"; el.appendChild(f); }
    if (L.nameColor) { el.style.setProperty("--look-name", L.nameColor); el.classList.add("lk-name"); }
    if (L.frame && el.classList.contains("card")) { const sk = cardSkinById(L.frame); if (sk && sk.normal) { el.style.setProperty("--card-skin", `url("${sk.normal}")`); el.style.setProperty("--card-skin-golden", `url("${sk.golden || sk.normal}")`); el.style.setProperty("--card-skin-spell", `url("${sk.spell || sk.normal}")`); el.classList.add("lk-frame"); } }
  }
  // a card's own sound for play / attack / death: a built-in sound or a short uploaded clip. true when the card has one.
  function lookSound(d, kind) {
    const L = lookOf(d), s = L && L.sfx && L.sfx[kind]; if (!s) return false;
    if (!audio.on) return true;
    audio.unlock();
    if (s.startsWith("data:")) { try { const a = new Audio(s); a.volume = 0.85; a.play().catch(() => {}); } catch (e) {} }
    else if (typeof sfx[s] === "function") sfx[s]();
    return true;
  }
  // the meta's frames by tribe and rarity (Workshop > Frames), unless the card has its own
  function tokenSkinById(id) { const st = window.WA_STORE; if (!st || !st.skinList) return null; return st.skinList("token").find((x) => x && x.id === id) || null; }
  function applyFrame(el, d) {
    if (!d || d.isSpell) return;
    const fr = STY().frames || {}, L = lookOf(d), card = el.classList.contains("card");
    const id = L && L.frame && card ? "" : card ? ((fr.rarity || {})[d.rarity] || (fr.tribe || {})[d.tribe] || "") : ((fr.tokenTribe || {})[d.tribe] || "");
    const key = id + "|" + (el._lookKey || "") + "|" + (window.WA_STORE ? window.WA_STORE.version : "");
    if (el._frKey === key) return; el._frKey = key;
    if (card) {
      if (L && L.frame) return;
      for (const v of ["--card-skin", "--card-skin-golden", "--card-skin-spell"]) el.style.removeProperty(v);
      const sk = id && cardSkinById(id); if (sk && sk.normal) { el.style.setProperty("--card-skin", `url("${sk.normal}")`); el.style.setProperty("--card-skin-golden", `url("${sk.golden || sk.normal}")`); }
    } else {
      el.classList.remove("lk-tokframe"); el.style.removeProperty("--token-skin"); el.style.removeProperty("--token-skin-golden");
      const sk = id && tokenSkinById(id); if (sk && sk.normal) { el.classList.add("lk-tokframe"); el.style.setProperty("--token-skin", `url("${sk.normal}")`); el.style.setProperty("--token-skin-golden", `url("${sk.golden || sk.normal}")`); }
    }
  }
  // the entrance when a minion lands on the board
  function enterFx(el, L) {
    const r = rectOf(el), c = L.aura || "#ffe08a", K = { duration: S(560), easing: "cubic-bezier(.2,.8,.2,1)" };
    switch (L.enter) {
      case "slam": anim(el, [{ transform: "translateY(-150px) scale(1.35)", opacity: 0 }, { transform: "translateY(0) scale(1.1)", opacity: 1, offset: .55 }, { transform: "scale(1.12, .8)", offset: .7 }, { transform: "none" }], { duration: S(520), easing: "ease-in" }); setTimeout(() => { shakeStage(9); burst(r.cx, r.cy + r.h * 0.35, 22, [c, "#fff", "#c8b8a0"], 110); if (window.WA_FXE) window.WA_FXE.impact("land", { x: r.cx, y: r.cy }, { h: r.h, big: true }); }, S(290)); break;
      case "spin": anim(el, [{ transform: "perspective(500px) rotateY(-720deg) scale(.3)", opacity: 0 }, { transform: "none", opacity: 1 }], Object.assign({}, K, { duration: S(720) })); setTimeout(() => ring(r.cx, r.cy, c, 8), S(600)); break;
      case "rise": anim(el, [{ transform: "translateY(70px) scale(.6)", opacity: 0, filter: "brightness(2.4)" }, { transform: "none", opacity: 1, filter: "brightness(1)" }], Object.assign({}, K, { duration: S(700) })); ring(r.cx, r.cy + r.h * 0.4, c, 9); burst(r.cx, r.cy + r.h * 0.4, 18, [c, "#fff"], 60); break;
      case "flash": anim(el, [{ filter: "brightness(4) saturate(0)", transform: "scale(1.25)" }, { filter: "brightness(1)", transform: "none" }], K); ring(r.cx, r.cy, c, 12); ring(r.cx, r.cy, "#fff", 6); break;
      case "shadow": anim(el, [{ filter: "brightness(0) blur(8px)", opacity: 0, transform: "scale(1.3)" }, { filter: "brightness(.3) blur(2px)", opacity: 1, offset: .6 }, { filter: "none", transform: "none" }], Object.assign({}, K, { duration: S(820) })); burst(r.cx, r.cy, 20, ["#1b1030", "#3a2560", c], 80); break;
      case "bounce": el.style.transformOrigin = "50% 100%"; anim(el, [{ transform: "translateY(-90px)" }, { transform: "translateY(0) scale(1.1,.85)", offset: .35 }, { transform: "translateY(-34px)", offset: .55 }, { transform: "translateY(0) scale(1.05,.92)", offset: .75 }, { transform: "translateY(-10px)", offset: .87 }, { transform: "none" }], { duration: S(760), easing: "ease-in-out" }).then(() => (el.style.transformOrigin = "")); break;
      case "portal": anim(el, [{ transform: "scale(0) rotate(-200deg)", opacity: 0 }, { transform: "scale(1.12) rotate(10deg)", opacity: 1, offset: .7 }, { transform: "none" }], Object.assign({}, K, { duration: S(700) })); ring(r.cx, r.cy, c, 14); ring(r.cx, r.cy, "#b58cff", 9); break;
      default: return false;
    }
    return true;
  }
  // **bold**, *italic*, [red]colour[/] or [#e33]colour[/] in a card's text (the text is escaped first)
  const RICH_C = { red: "#ff6b5e", gold: "#ffd36a", green: "#7fe08a", blue: "#7ab8ff", purple: "#c59bff", grey: "#a9adc4", gray: "#a9adc4", orange: "#ffa64d", pink: "#ff9ad5", white: "#ffffff" };
  const rich = (h) => String(h).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<i>$2</i>")
    .replace(/\[(#[0-9a-fA-F]{3,6}|[a-z]+)\](.*?)\[\/\]/g, (m, c, x) => (RICH_C[c] || c[0] === "#" ? `<span class="rt-c" style="color:${RICH_C[c] || c}">${x}</span>` : m));
  function cardText(d) {
    const kws = d.keywords.map((k) => `<b>${KW_NAMES[k]}</b>`).concat((d.ckw || []).map((k) => `<b class="ckw" style="color:${escH(k.color)}">${escH(k.name)}</b>`)).join(", ");
    const t = rich(escH(d.text || "")).replace(/^(Deathrattle|Battlecry|Start of Combat|In combat|End of turn|At the end of your turn)/, "<b>$1</b>").replace(/\bDevour\b/, "<b>Devour</b>");
    return [kws, t].filter(Boolean).join(kws && t ? ". " : "");
  }
  // Text size steps so every card's text fills its panel without being cut.
  const textSize = (html) => { const n = html.replace(/<[^>]+>/g, "").length; return n <= 26 ? "t1" : n <= 48 ? "t2" : n <= 72 ? "t3" : n <= 98 ? "t4" : "t5"; };
  const nameSize = (name) => (name.length <= 12 ? "n1" : name.length <= 16 ? "n2" : name.length <= 20 ? "n3" : "n4");
  const rarityGem = (r) => (r && r !== "common" ? `<i class="rarity ${r}" title="${r[0].toUpperCase() + r.slice(1)}"></i>` : `<i class="rarity common" title="Common"></i>`);
  // Shrink the name and the text until they fit their plates (measured once, when the card is shown).
  function fitCard(el) {
    if (!el.isConnected) return;
    const name = el.querySelector(".card-name"), box = el.querySelector(".card-text"), span = box && box.querySelector("span");
    if (name) { let f = 12.5; name.style.fontSize = f + "px"; while (name.scrollWidth > name.clientWidth + 1 && f > 7.6) { f -= 0.4; name.style.fontSize = f + "px"; } }
    if (span) {
      let f = 11.6; span.style.fontSize = f + "px";
      const room = box.clientHeight - 6;
      while (span.scrollHeight > room && f > 7.2) { f -= 0.35; span.style.fontSize = f + "px"; }
    }
  }
  const fitSoon = (el) => requestAnimationFrame(() => fitCard(el));
  function makeCard(d) {
    if (d.isSpell) return makeSpellCard(d);
    const el = document.createElement("div");
    el.className = "card r-" + (d.rarity || "common"); el.dataset.uid = d.uid; el.dataset.tribe = d.tribe;
    const txt = cardText(d);
    el.innerHTML = `<div class="mn-tier">${stars(d.tier)}</div><div class="card-art">${art(d.cardId)}</div>
      <div class="card-name ${nameSize(d.name)}">${escH(d.name)}</div><div class="card-text ${textSize(txt)}"><span>${txt}</span></div>
      <div class="tier-gem">${d.tier}</div><div class="card-tribe${d.allTribes ? " all" : (d.tribes || []).length > 1 ? " multi" : ""}">${rarityGem(d.rarity)}${d.allTribes ? `<span class="t-all">All tribes</span>` : d.tribe ? "<span>" + escH(d.tribeLabel || TN(d.tribe)) + "</span>" : "<span>Neutral</span>"}</div><div class="mn-gem atk"><span></span></div><div class="mn-gem hp"><span></span></div>`;
    el.insertAdjacentHTML("beforeend", '<div class="mn-evo" hidden><i class="ev0"></i><i class="ev1"></i><i class="evl"></i></div>');
    updateCard(el, d);
    bindTip(el); bindEvoTip(el);
    fitSoon(el);
    return el;
  }
  // tavern spells sit in the shop as round tokens, like minions; they become cards in your hand
  // the price on a tavern spell (in green when an aura makes it cheaper)
  function spellCostTag(el, d) { const c = el.querySelector(".cost"); if (!c) return; if (c.textContent !== String(d.cost)) c.textContent = d.cost; c.classList.toggle("cheaper", !!d.cheaper); }
  function makeSpellToken(d) {
    const el = document.createElement("div");
    el.className = "mn spell-tok"; el.dataset.uid = d.uid;
    el.innerHTML = `<div class="sp-ring"></div><div class="mn-body sp-body">${ARTMOD.spellArt(d.spellId)}</div><span class="cost">${d.cost}</span>
      <div class="sp-name">${escH(d.name)}</div>`;
    spellCostTag(el, d);
    el.setAttribute("aria-label", d.name);
    el._d = d;
    bindTip(el);
    return el;
  }
  function makeSpellCard(d) {
    const el = document.createElement("div");
    el.className = "card spell"; el.dataset.uid = d.uid;
    el.innerHTML = `<div class="spell-art">${spellArt(d.spellId)}</div><span class="cost">${d.cost}</span>
      <div class="card-name ${nameSize(d.name)}">${escH(d.name)}</div><div class="card-text ${textSize(d.text || "")}"><span>${rich(escH(d.text))}</span></div><div class="spell-tag">${d.target ? "Drag onto a minion" : "Tavern spell"}</div>`;
    el._d = d; applyLook(el, d);
    bindTip(el);
    fitSoon(el);
    return el;
  }
  function updateCard(el, d) {
    if (d.isSpell) { el._d = d; applyLook(el, d); return; }
    applyLook(el, d); applyFrame(el, d);
    const prev = el._d; el._d = d;
    el.classList.toggle("golden", d.golden);
    setGem(el.querySelector(".mn-gem.atk"), d.attack, d.attack > d.baseAttack ? "buffed" : "", prev && prev.attack !== d.attack);
    setGem(el.querySelector(".mn-gem.hp"), d.health, d.health > d.baseHealth ? "buffed" : "", prev && prev.health !== d.health);
    setEvo(el, d, prev); setWounds(el, d); setAffs(el, d); setVars(el, d, prev); setMarkers(el, d, prev); el.classList.toggle("iced", !!d.ice); el.classList.toggle("chilled", (d.chill || 0) > 0); if (!el.querySelector(":scope > .mn-hit")) el.insertAdjacentHTML("afterbegin", '<i class="mn-hit" aria-hidden="true"></i>');
    el.classList.toggle("is-token", !!d.token);
    let tt = el.querySelector(":scope > .card-tokentag"); if (d.token && !tt) el.insertAdjacentHTML("beforeend", `<div class="card-tokentag">${T("Token")}</div>`); else if (!d.token && tt) tt.remove();
  }

  // Keyed render with FLIP. Moves nodes only when order changes so running
  // animations survive. Returns newly created elements.
  function reconcile(container, list, make, update, opts = {}) {
    const before = new Map();
    const existing = new Map();
    for (const el of container.children) if (el.dataset.uid && !el.classList.contains("ph")) { existing.set(el.dataset.uid, el); before.set(el.dataset.uid, el.getBoundingClientRect()); }
    // minions that slid aside for a drag: measured where they are seen, then released so the FLIP starts there
    for (const el of existing.values()) if (el._room) { el.style.transition = "none"; el.style.transform = ""; el._room = false; requestAnimationFrame(() => (el.style.transition = "")); }
    for (const g of container.querySelectorAll(".slot-glow")) g.remove();
    const order = [], created = [];
    for (const d of list) {
      const key = String(d.uid);
      let el = existing.get(key);
      if (el) { update(el, d); existing.delete(key); }
      else { el = make(d); created.push(el); el._new = true; }
      order.push(el);
    }
    for (const el of existing.values()) el.remove();
    for (const el of [...container.children]) if (!el.dataset.uid) el.remove();
    order.forEach((el, i) => { if (container.children[i] !== el) container.insertBefore(el, container.children[i] || null); });
    if (!list.length && opts.empty) container.insertAdjacentHTML("beforeend", `<div class="empty-hint">${opts.empty}</div>`);
    if (opts.after) opts.after(order);
    for (const el of order) {
      const b = before.get(el.dataset.uid);
      if (!b || !b.width) continue;
      const a = el.getBoundingClientRect();
      const dx = (b.left - a.left) / scale, dy = (b.top - a.top) / scale;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1)
        el.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0px 0px" }], { duration: opts.flipMs || S(280), easing: "cubic-bezier(.2,.8,.2,1)" });
    }
    return created;
  }

  // ---------------------------------------------------------------- tooltip & toast
  let tipTimer = 0;
  function bindTip(el) {
    el.addEventListener("pointerenter", (e) => { if (e.pointerType !== "mouse" || drag) return; const now = performance.now();
      if (now < tipQuiet && Math.hypot(e.clientX - quietAt.x, e.clientY - quietAt.y) < 4) { el._tipSkip = true; return; } // the table changed under a still pointer: no tip until it moves
      el._tipSkip = false; clearTimeout(tipTimer); tipTimer = setTimeout(() => showTip(el), Math.max(snappy ? 650 : 250, tipQuiet - now)); });
    el.addEventListener("pointermove", (e) => { if (!el._tipSkip || e.pointerType !== "mouse" || drag || Math.hypot(e.clientX - quietAt.x, e.clientY - quietAt.y) < 4) return; el._tipSkip = false; clearTimeout(tipTimer); tipTimer = setTimeout(() => showTip(el), Math.max(250, tipQuiet - performance.now())); });
    el.addEventListener("pointerleave", () => { el._tipSkip = false; hideTip(); });
  }
  function showTip(el) {
    const d = el._d;
    if (!d || drag || !el.isConnected) return;
    const tip = $("#tip"); tip.classList.remove("big", "nosi", "handtip");
    if (d.isSpell) {
      tip.innerHTML = `<h3>${escH(d.name)}</h3><div class="tt-sub">Tavern spell · Tier ${d.tier} · ${d.cost} gold</div><p>${rich(escH(d.text))}</p>
        <div class="kw">${d.target ? "Drag it from your hand onto one of your minions." : "Drag it up from your hand, or click it, to cast it."}</div>`;
      placeTip(el); return;
    }
    const kws = [...d.keywords, ...(/Devour/.test(d.text || "") ? ["devour"] : [])].map((k) => `<div class="kw">${KEYWORD_INFO[k].replace(/^(\w+):/, "<b>$1:</b>")}</div>`).join("");
    let tribesHtml = (d.allTribes ? [] : d.tribes || (d.tribe ? [d.tribe] : [])).filter((t) => TRIBE_BLURB[t]).map((t) => `<div class="kw tt-tribe">${tribeIcon(t)}<span><b>${escH(TN(t))}s:</b> ${escH(TRIBE_BLURB[t])}</span></div>`).join("") + (d.allTribes ? `<div class="kw tt-tribe"><span><b>All tribes:</b> counts as every tribe in the lobby.</span></div>` : "");
    const ckwHtml = (d.ckw || []).map((k) => `<div class="kw tt-aff">${k.icon ? `<img src="${escH(k.icon)}" alt="">` : ""}<span><b style="color:${escH(k.color)}">${escH(k.name)}:</b> ${escH(k.tip)}</span></div>`).join("");
    const affHtml = ckwHtml + (d.aff || []).map((a) => `<div class="kw tt-aff"><img src="${AFF_IMG(a)}" alt=""><span><b>${escH(WA.affName(a))} · ${escH(WA.affMech(a))}:</b> ${WA.AFF[a] && WA.AFF[a].descOnly ? rich(escH(WA.affDesc(a))) : escH(WA.AFF[a] && WA.AFF[a].kind === "none" ? "" : WA.affBlurb(a))}${WA.affEffectsText(a).map((x) => ` <i>${T("Level")} ${x.lv}:</i> ${escH(x.text)}`).join("")}${WA.affCarryText(a).map((x) => ` <i>${T("Carried")} · ${T("Level")} ${x.lv}:</i> ${escH(x.text)}`).join("")}</span></div>`).join("");
    tribesHtml += affHtml;
    if (el.classList.contains("mn")) {
      // a token on the table: the full card, big, with the keyword and tribe explanations beside it (like Hearthstone)
      const extra = [...(d.evolve ? [`<div class="kw"><b>Evolve:</b> ${d.evolve.stat === "health" ? "at " + d.evolve.at + " Health" : d.evolve.stat === "attack" ? "at " + d.evolve.at + " Attack" : "at " + d.evolve.at + " Attack or Health"}${d.evolve.into && (window.WA.CARDS[d.evolve.into] || window.WA.TOKENS[d.evolve.into]) ? " → " + escH((window.WA.CARDS[d.evolve.into] || window.WA.TOKENS[d.evolve.into]).name) : ""} (now ${d.attack}/${Math.max(0, d.health)}).</div>`] : []),
        ...(d.gauge ? [evoTipHTML(d)] : []),
        ...(d.vars ? [`<div class="kw"><b>${T("Counters")}:</b> ${Object.entries(d.vars).map(([k, n]) => `${escH(k)} ${n}`).join(" · ")}</div>`] : []),
        ...(d.activate ? [`<div class="kw"><b>${d.activate.work ? "Work" : "Activate"}:</b> click it on your board for ${d.activate.cost} gold, once per turn.${d.activate.work ? ` ${d.activate.done}/${d.activate.work} activations.` : ""}</div>`] : []),
        ...(d.mk ? [`<div class="kw tt-mk"><b>${T("Markers")}:</b> ${escH(markersText(d.mk))}. ${T("They stay on this minion, even after combat, until something moves them.")}</div>`] : []),
        ...(d.silenced ? [`<div class="kw"><b>Silenced:</b> keeps its stats, nothing else.</div>`] : []), ...(d.token ? [`<div class="kw"><b>${T("Token")}:</b> ${T("never offered in the tavern: only effects make it. Selling it pays as usual.")}</div>`] : []),
        ...(d.rarity && d.rarity !== "common" ? [`<div class="kw"><span class="tt-r ${d.rarity}">${d.rarity[0].toUpperCase() + d.rarity.slice(1)}</span></div>`] : [])];
      tip.innerHTML = `<div class="tt-card"></div><div class="tt-side">${kws}${extra.join("")}${tribesHtml}</div>`;
      tip.classList.add("big"); tip.classList.toggle("nosi", !tip.querySelector(".tt-side").children.length);
      const c = makeCard(d); c.classList.add("static"); tip.querySelector(".tt-card").appendChild(c); if (window.WA_FIT_CARDS) window.WA_FIT_CARDS(tip);
      placeTip(el); return;
    }
    if (el.closest && el.closest("#hand")) {
      // a card in your hand is already shown big by the hover: only its keyword and tribe notes go beside it
      const side = kws + tribesHtml + (d.gauge ? evoTipHTML(d) : "");
      if (!side) { hideTip(); return; }
      tip.classList.add("big", "handtip"); tip.innerHTML = `<div class="tt-side">${side}</div>`;
      placeTip(el); return;
    }
    tip.classList.remove("big", "nosi", "handtip");
    tip.innerHTML = `<h3 class="${d.golden ? "g" : ""}">${d.golden ? "Golden " : ""}${escH(d.name)}</h3>
      <div class="tt-sub">Tier ${d.tier}${d.allTribes ? " · All tribes" : d.tribe ? " · " + escH(d.tribeLabel || TN(d.tribe)) : ""}${d.token ? " · Token" : d.rarity && d.rarity !== "common" ? ` · <span class="tt-r ${d.rarity}">${d.rarity[0].toUpperCase() + d.rarity.slice(1)}</span>` : ""}</div>
      <div class="tt-stats"><span class="a">${d.attack} Attack</span><span class="h">${Math.max(0, d.health)} Health</span></div>
      ${d.silenced ? `<p><i>Silenced</i></p>` : d.text ? `<p>${rich(escH(d.text))}</p>` : ""}${kws}${(d.allTribes ? [] : d.tribes || (d.tribe ? [d.tribe] : [])).filter((t) => TRIBE_BLURB[t]).map((t) => `<div class="kw tt-tribe">${tribeIcon(t)}<span><b>${escH(TN(t))}s:</b> ${escH(TRIBE_BLURB[t])}</span></div>`).join("")}${d.allTribes ? `<div class="kw tt-tribe"><span><b>All tribes:</b> counts as every tribe in the lobby.</span></div>` : ""}`;
    placeTip(el);
  }
  function placeTip(el) {
    const tip = $("#tip");
    const r = rectOf(el), w = tip.classList.contains("big") ? tip.offsetWidth : 214;
    let x = r.x + r.w + 14;
    if (x + w > 1270) x = r.x - w - 10;
    let y = Math.max(8, Math.min(r.y - 10, 760 - tip.offsetHeight - 8));
    tip.style.left = x + "px"; tip.style.top = y + "px";
    tip.classList.add("on");
  }
  function hideTip() { clearTimeout(tipTimer); $("#tip").classList.remove("on"); }
  let toastTimer = 0;
  function toast(msg, ms = 1800) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), ms);
  }

  // ---------------------------------------------------------------- fx primitives
  const fxLayer = () => $("#fx");
  function fxEl(cls, x, y, html = "") {
    const e = document.createElement("div"); e.className = cls; e.style.left = x + "px"; e.style.top = y + "px"; e.innerHTML = html;
    fxLayer().appendChild(e); return e;
  }
  function splat(el, text, venom) {
    const r = rectOf(el);
    const s = fxEl("splat" + (venom ? " venom" : ""), r.cx, r.cy - 6, text);
    anim(s, [{ transform: "scale(.2) rotate(-20deg)", opacity: 1 }, { transform: "scale(1.15) rotate(0)", opacity: 1, offset: .25 }, { transform: "scale(1)", opacity: 1, offset: .75 }, { transform: "scale(.9) translateY(-10px)", opacity: 0 }],
      { duration: D(900), easing: "ease-out" }).then(() => s.remove());
  }
  // a chance from the lab that came through: a tiny tag in the minion's corner, gone in a blink (misses show nothing)
  function diceFx(el, d) {
    if (!el || !el.isConnected || !d || !d.ok) return;
    const r = rectOf(el), tag = fxEl("luck-pop", r.x + r.w - 6, r.y + 8, `${d.pct}%`);
    anim(tag, [{ transform: "translate(-50%,-50%) scale(.7)", opacity: 0 }, { transform: "translate(-50%,-70%) scale(1)", opacity: 1, offset: .2 }, { transform: "translate(-50%,-90%) scale(1)", opacity: 1, offset: .7 }, { transform: "translate(-50%,-110%) scale(.95)", opacity: 0 }], { duration: D(520), easing: "ease-out" }).then(() => tag.remove());
  }
  function floatText(el, text, color) {
    const r = rectOf(el);
    const f = fxEl("float", r.cx, r.y + 10, text);
    if (color) f.style.color = color;
    anim(f, [{ transform: "translate(-50%,-50%) scale(.6)", opacity: 0 }, { transform: "translate(-50%,-90%) scale(1.15)", opacity: 1, offset: .25 }, { transform: "translate(-50%,-180%) scale(1)", opacity: 0 }],
      { duration: D(1100), easing: "ease-out" }).then(() => f.remove());
  }
  function burst(x, y, n, colors, spread = 70, cls = "particle") {
    n = Math.ceil(n * 0.55);
    for (let i = 0; i < n; i++) {
      const p = fxEl(cls, x, y);
      p.style.background = colors[i % colors.length];
      const a = Math.random() * Math.PI * 2, dist = spread * (0.5 + Math.random() * 0.7);
      anim(p, [{ transform: "translate(0,0) scale(1) rotate(0)", opacity: 1 }, { transform: `translate(${Math.cos(a) * dist}px,${Math.sin(a) * dist}px) scale(.3) rotate(${Math.random() * 360}deg)`, opacity: 0 }],
        { duration: D(500 + Math.random() * 400), easing: "cubic-bezier(.2,.8,.3,1)" }).then(() => p.remove());
    }
  }
  function ring(x, y, color = "#ffe08a", size = 7) {
    const r = fxEl("ring", x, y);
    r.style.borderColor = color;
    anim(r, [{ transform: "scale(.4)", opacity: 1 }, { transform: `scale(${size})`, opacity: 0 }], { duration: D(600), easing: "ease-out" }).then(() => r.remove());
  }
  function glow(el, color = "#ffd25a") {
    if (!el || !el.isConnected) return;
    const h = document.createElement("div");
    h.className = "halo"; h.style.setProperty("--c", color);
    el.appendChild(h);
    anim(h, [{ opacity: 0, transform: "scale(.8)" }, { opacity: 1, transform: "scale(1.05)", offset: .35 }, { opacity: 0, transform: "scale(1.2)" }], { duration: D(650), easing: "ease-out" }).then(() => h.remove());
  }
  // A glowing bolt from one point to another. Resolves on arrival.
  function bolt(x1, y1, x2, y2, color = "#ff9a3a", ms = 420, arc = 50) {
    const o = fxEl("orb", x1, y1);
    o.style.background = `radial-gradient(circle, #fff, ${color} 45%, transparent 72%)`;
    o.style.boxShadow = `0 0 18px 6px ${color}`;
    return anim(o, [{ transform: "translate(0,0) scale(.6)" }, { transform: `translate(${(x2 - x1) * .5}px, ${(y2 - y1) * .5 - arc}px) scale(1.1)`, offset: .5 }, { transform: `translate(${x2 - x1}px, ${y2 - y1}px) scale(.8)` }],
      { duration: D(ms), easing: "ease-in" }).then(() => o.remove());
  }
  function sparkleTo(from, el, color = "#9fdcff") {
    if (!el) return;
    const r = rectOf(el);
    bolt(from.cx, from.cy, r.cx, r.cy, color, 380, 40).then(() => { ring(r.cx, r.cy, color, 5); burst(r.cx, r.cy, 14, [color, "#ffffff"], 60); glow(el, color); });
  }
  // ---------------------------------------------------------------- effect styles
  // Each style has an optional "travel" (source to target, resolves on arrival) and an "impact" at the target.
  // `L` is the layer to draw in (the table's fx layer, or the card editor's preview).
  const pt = (r) => ({ x: r.cx, y: r.cy });
  function tint(el, color) {
    if (!el || !el.isConnected) return;
    const body = el.querySelector(".mn-body") || el;
    anim(body, [{ filter: "none" }, { filter: `drop-shadow(0 0 10px ${color}) brightness(1.25)`, offset: .3 }, { filter: "none" }], { duration: D(700) });
  }
  // Looks live in the canvas engine (fxengine.js); this table adds names, colours and sounds.
  const FX_META = [["fire", "Fireball", "#ff8a3a", "fire", true], ["lightning", "Lightning", "#9fb8ff", "zap", true], ["frost", "Ice spikes", "#a8e6ff", "frost", true],
    ["water", "Splash", "#5ab8ff", "water", true], ["shadow", "Shadow ooze", "#b07cff", "shadow", true], ["poison", "Poison gas", "#9be05a", "poison", true],
    ["nature", "Wild growth", "#7ed06a", "heal", true], ["holy", "Holy light", "#ffe08a", "holy", true], ["void", "Void vortex", "#b45cff", "shadow", true],
    ["wind", "Tornado", "#dff3ff", "whoosh", true], ["dust", "Dust cloud", "#c8a070", "rock", true], ["arrow", "Arrow", "#ffe0b0", "arrow", true], ["meat", "Meat", "#e2602a", "rock", true]];
  // looks of earlier versions: still played (as the closest painted one), no longer offered in the editor
  const FX_ALIAS = { heal: "nature", rock: "dust", slash: "dust", thorns: "nature", blood: "shadow", meteor: "fire", prism: "holy" };
  const FX = {};
  for (const [k, name, color, sound, ranged] of FX_META) FX[k] = { name, color, sound, ranged,
    travel: ranged ? (L, a, b) => window.WA_FXE.travel(k, a, b) : null,
    impact: (L, b) => { window.WA_FXE.impact(k, b); if (k === "dust" || k === "meat") shakeStage(4); } };
  for (const [old, k] of Object.entries(FX_ALIAS)) Object.defineProperty(FX, old, { value: Object.assign({}, FX[k], { hidden: true }), enumerable: false });
  if (window.WA_FXE) window.WA_FXE.setSpeed(() => speed);
  // Play a style from one element to another. Resolves when it lands.
  async function playFx(kind, fromEl, toEl, layer) {
    const st = FX[kind], L = layer || fxLayer();
    if (!st || !toEl || !toEl.isConnected) return;
    const b = pt(rectOf(toEl)), a = fromEl && fromEl !== toEl && fromEl.isConnected ? pt(rectOf(fromEl)) : null;
    if (st.sound && /^data:/.test(st.sound)) playSound(st.sound); else (sfx[st.sound] || sfx.whoosh)();
    if (a && st.travel) await st.travel(L, a, b);
    else if (kind === "holy" && st.travel) await st.travel(L, a || b, b);
    st.impact(L, b);
    tint(toEl, st.color);
  }
  window.WA_FX = { FX, play: playFx };
  window.WA_SND = { audio, sfx };

  // ---------------------------------------------------------------- the meta's look (Workshop): sounds, effects, texts, screens, frames
  const SFX0 = Object.assign({}, sfx);
  const clipCache = new Map();
  function playClip(url, vol = 1) {
    if (!audio.on || !url) return;
    try { let a = clipCache.get(url); if (!a) { a = new Audio(url); clipCache.set(url, a); } const c = a.paused ? a : a.cloneNode(); c.volume = Math.max(0, Math.min(1, vol * sfxVol)); c.currentTime = 0; c.play().catch(() => {}); } catch (e) {}
  }
  // a sound by name: a built-in one, or a clip (data URL)
  function playSound(k) { if (!k) return; if (/^data:audio\//.test(k)) playClip(k); else if (typeof sfx[k] === "function") sfx[k](); }
  const MOMENT_SND = {};
  function applySounds(S) {
    S = S || {};
    sfxVol = S.sfxVol == null ? 1 : Math.max(0, Math.min(1, +S.sfxVol));
    if (audio.bus) audio.bus.gain.value = 0.55 * sfxVol;
    for (const k of Object.keys(SFX0)) sfx[k] = SFX0[k];
    for (const [k, v] of Object.entries(S.overrides || {})) {
      if (!SFX0[k] || !v) continue;
      if (v === "-") sfx[k] = () => {};
      else if (/^data:audio\//.test(v)) sfx[k] = () => playClip(v);
      else if (SFX0[v]) sfx[k] = SFX0[v];
    }
    if (window.WA_AMB && window.WA_AMB.setTracks) window.WA_AMB.setTracks(S.music || {}, S.musicVol == null ? 0.5 : +S.musicVol);
  }
  // effects made in the workshop join the attack styles a card can pick
  const CUSTOM_FX = new Set();
  function applyFxStyles(list) {
    for (const k of CUSTOM_FX) delete FX[k]; CUSTOM_FX.clear();
    const E = window.WA_FXE; if (!E) return;
    for (const f of list || []) {
      const c = E.CUSTOM[f.id]; if (!c) continue;
      FX[f.id] = { name: (f.name || "Effect").slice(0, 24), color: c.color, sound: c.sound || "whoosh", ranged: c.ranged, custom: true,
        travel: c.ranged ? (L, a, b) => E.travel(f.id, a, b) : null, impact: (L, b) => { E.impact(f.id, b); if (c.shake) shakeStage(c.shake); } };
      CUSTOM_FX.add(f.id);
    }
  }
  // a restyled table moment (buy, sell, triple, upgrade) on an element
  function momentAt(kind, el) { const E = window.WA_FXE; if (!E || !E.hasMoment(kind) || !el || !el.isConnected) return; const r = rectOf(el); E.impact(kind, { x: r.cx, y: r.cy }); }
  const STY = () => (window.WA_STYLE ? window.WA_STYLE.cfg : {}) || {};
  const SCR = () => STY().screens || {};
  // the bartender's lines: the meta's own, else the built-in ones
  function quipLine(k) { const own = ((STY().texts || {}).quips || {})[k]; const l = Array.isArray(own) && own.filter((x) => x && x.trim()).length ? own.filter((x) => x && x.trim()) : QUIPS[k] || [""]; return pick(l); }
  // a line and its voice: with as many voices as lines of your own, line N speaks with voice N; otherwise a random voice of the moment
  // how often the bartender speaks up at each moment (%), unless the meta sets its own
  const QUIP_CHANCE = { turn: 50, upgrade: 100, tier6: 100, triple: 100, roll: 33, spell: 100, sell: 35, winStreak: 100, loseStreak: 100, low: 100 };
  function quipChance(k) { const c = ((STY().texts || {}).chance || {})[k]; return c != null && isFinite(+c) ? Math.max(0, Math.min(100, +c)) : QUIP_CHANCE[k] == null ? 100 : QUIP_CHANCE[k]; }
  function sayQuip(k, force) {
    if (!force && Math.random() * 100 >= quipChance(k)) return;
    const T = STY().texts || {}, own = (((T.quips || {})[k]) || []).filter((x) => x && x.trim()), lines = own.length ? own : QUIPS[k] || [""];
    const i = Math.floor(Math.random() * lines.length), voices = ((T.voices || {})[k] || []).filter((v) => /^data:audio\//.test(v || ""));
    const voice = !voices.length ? null : own.length && own.length === voices.length ? voices[i] : pick(voices);
    quip(lines[i], voice, k);
  }
  let voiceEl = null;
  function speak(url) {
    if (voiceEl) { try { voiceEl.pause(); } catch (e) {} voiceEl = null; }
    if (!url || !audio.on) return null;
    const T = STY().texts || {}, vv = T.voiceVol == null ? 1 : Math.max(0, Math.min(1, +T.voiceVol));
    try { voiceEl = new Audio(url); voiceEl.volume = Math.max(0, Math.min(1, vv * sfxVol)); voiceEl.play().catch(() => {}); } catch (e) { voiceEl = null; }
    return voiceEl;
  }
  function applyStyleNow(cfg) {
    applySounds(cfg.sounds); applyFxStyles(cfg.fx);
    const fr = cfg.frames || {}, st = document.getElementById("waFrameCSS") || (() => { const e = document.createElement("style"); e.id = "waFrameCSS"; document.body.appendChild(e); return e; })();
    const sc = cfg.screens || {};
    st.textContent = (fr.back ? `.card-back-face { background-image: url("${fr.back}"); }` : "")
      + (sc.menuBg ? `#modal:has(> .mbox.menu) { background: linear-gradient(rgba(8,9,22,${Math.max(0, Math.min(0.9, sc.menuDim == null ? 0.4 : +sc.menuDim))}), rgba(8,9,22,${Math.max(0, Math.min(0.9, sc.menuDim == null ? 0.4 : +sc.menuDim))})), center / cover no-repeat url("${sc.menuBg}"); }` : "");
    if (game && you) { try { renderTavern(); } catch (e) {} }
  }

  let quipTimer = 0;
  function quip(text, voice, k) {
    const talk = (STY().texts || {}).talk; if (talk != null && Math.random() >= +talk) return; // a quieter (or silent) bartender
    if (snappy) return;
    const q = $("#quip");
    q.textContent = text; q.hidden = false; q.classList.toggle("voiced", !!voice);
    anim(q, [{ transform: "translateY(8px) scale(.8)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 220, easing: "ease-out" });
    const hide = (ms) => { clearTimeout(quipTimer); quipTimer = setTimeout(() => anim(q, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).then(() => { q.hidden = true; q.classList.remove("voiced"); }), ms); };
    hide(2600);
    lastQuip = { k: k || "", text, voice: voice || null };
    // the bubble stays up while the bartender speaks
    const v = voice ? speak(voice) : null;
    if (v) v.addEventListener("loadedmetadata", () => { if (isFinite(v.duration) && v.duration * 1000 + 400 > 2600) hide(Math.min(12000, v.duration * 1000 + 400)); }, { once: true });
  }
  let lastQuip = null;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const QUIPS = {
    turn: ["Fresh faces at the counter today.", "Coin talks. Spend it.", "Who's buying?", "Mind the bar, it's sticky.", "I've a good feeling about this lot."],
    upgrade: ["Better stock, better company.", "Now we're getting somewhere.", "Up we go!"],
    tier6: ["The finest the tavern has to offer."],
    triple: ["Three of a kind! Golden!", "Now that's a shine.", "Ooh, polished up nicely."],
    roll: ["Next!", "Not your type? Fair.", "Shuffling the regulars."],
    spell: ["A bit of magic never hurt.", "Careful with that.", "Fizzy!"],
    winStreak: ["They can't stop you!", "Another round on the house? No."],
    loseStreak: ["Rough nights happen. Rally!", "Shake it off. Buy something tough."],
    low: ["You're running on fumes, friend.", "Last orders might be soon."],
    sell: ["I'll find them a new home.", "Back to the bench with you."],
  };

  function shakeStage(power = 5) {
    anim(stage.querySelector(".shake-root"), [0, 1, 2, 3, 4, 5].map((i) => ({ transform: i === 5 ? "none" : `translate(${(Math.random() - .5) * power * 2}px,${(Math.random() - .5) * power * 2}px)` })), { duration: D(260) });
  }

  // ---------------------------------------------------------------- rendering: tavern
  const HERO = (p) => (p && p.hero ? window.WA.HEROES[p.hero] : null);
  const heroPic = (id) => { const st = window.WA_STORE; const r = st && st.IMAGES["hero:" + id]; return r ? r.card : ""; };
  function heroCrest(p, big) {
    if (p && p.icon) return `<div class="crest enemy-crest">${p.icon}</div>`;
    const name = p ? p.name : "Ghost";
    const h = p ? p.hue : 0;
    const sat = p ? 62 : 0;
    const hero = HERO(p), pic = hero ? heroPic(hero.id) : "";
    if (pic) return `<div class="crest photo" style="background: center / cover no-repeat url('${pic}')" title="${escH(hero.name)}"></div>`;
    const letter = hero ? hero.name[0] : name === "You" ? "Y" : name[0];
    return `<div class="crest" style="background: hsl(${h} ${sat}% 38%)"${hero ? ` title="${escH(hero.name)}"` : ""}>${escH(letter)}</div>`;
  }
  // ---------------------------------------------------------------- anomalies
  function anomalyCard(id, picOverride) {
    const a = window.WA.ANOMALIES[id], st = window.WA_STORE;
    const pic = picOverride !== undefined ? picOverride : st && st.IMAGES["anomaly:" + id] ? st.IMAGES["anomaly:" + id].card : "";
    const el = document.createElement("div"); el.className = "anom-card";
    el.innerHTML = `<div class="an-art"${pic ? ` style="background-image:url('${pic}')"` : ""}>${pic ? "" : "<span>✦</span>"}</div>
      <div class="an-body"><div class="an-kicker">Anomaly</div><div class="an-name">${escH(a ? a.name : "Anomaly")}</div><p>${escH(window.WA.anomalyText(id)) || "<i>No rule yet</i>"}</p>${a && a.banHeroes.length ? `<div class="an-bans">Banned heroes: ${a.banHeroes.map((h) => window.WA.HEROES[h] ? escH(window.WA.HEROES[h].name) : "").filter(Boolean).join(", ") || "none in this meta"}</div>` : ""}</div>`;
    return el;
  }
  function renderAnomChip() {
    let c = $("#anomChip");
    if (!c) {
      c = document.createElement("button"); c.id = "anomChip"; c.className = "anom-chip"; c.type = "button";
      $(".shake-root").appendChild(c);
      c.addEventListener("pointerenter", () => { if (!game.anomaly) return; const tip = $("#tip"); tip.classList.remove("big", "nosi"); tip.innerHTML = `<h3>${escH(game.anomaly.name)}</h3><div class="tt-sub">Anomaly: this game's rules</div><p>${escH(window.WA.anomalyText(game.anomaly.id))}</p>`; placeTip(c); });
      c.addEventListener("pointerleave", hideTip);
      c.addEventListener("click", () => { if (game.anomaly && $("#modal").hidden && !busy) showAnomaly(() => {}); });
    }
    c.hidden = !game.anomaly;
    if (game.anomaly) c.innerHTML = `<span class="an-star">✦</span><span>${escH(game.anomaly.name)}</span>`;
  }
  function showAnomaly(then) {
    const m = modal(`<h2>This game's anomaly</h2><p>The rules below apply to every player.</p><div class="anom-reveal"></div><div class="intro-actions"><button class="pill big" id="btnAnomGo">Let's go</button></div>`);
    m.querySelector(".anom-reveal").appendChild(anomalyCard(game.anomaly.id));
    m.querySelector("#btnAnomGo").addEventListener("click", () => { closeModal(); then(); });
  }
  // a minion's tribe picked by the player
  function showTribePick() {
    if (!you.tribePick.length || !$("#modal").hidden || busy) return;
    busy = true; renderTop(); renderGold(); $("#toast").classList.remove("on");
    const pick = you.tribePick[0];
    const names = [...you.board, ...you.hand].filter((m) => pick.uids.includes(m.uid)).map((m) => m.name);
    const m = modal(`<h2>Choose a tribe</h2><p>${names.length ? escH(names.join(", ")) + (names.length === 1 ? " becomes" : " become") + " the tribe you pick." : "Pick a tribe."}</p><div class="tribe-picks"></div>`);
    const box = m.querySelector(".tribe-picks");
    for (const t of game.tribes) {
      const b = document.createElement("button"); b.type = "button"; b.className = "tribe-pick"; b.dataset.tribe = t;
      b.innerHTML = `<span class="tp-icon">${tribeIcon(t)}</span><b>${escH(TN(t))}</b>${TRIBE_BLURB[t] ? `<small>${escH(TRIBE_BLURB[t])}</small>` : ""}`;
      b.addEventListener("click", () => {
        closeModal(); busy = false;
        act(() => game.chooseTribe(you, t));
        sfx.upgrade();
        if (you.tribePick.length) setTimeout(showTribePick, 300);
      });
      box.appendChild(b);
    }
  }
  // Anomaly: you pick a minion for every player
  function showSharedPick() {
    const sp = game.sharedPick;
    if (!sp || sp.chooser !== you.id || !$("#modal").hidden) return;
    busy = true; renderTop(); renderGold();
    const m = modal(`<h2>Pick a minion for everyone</h2><p>Every player, you included, gets a copy of the one you choose.</p><div class="choices"></div>`);
    const box = m.querySelector(".choices");
    sp.options.forEach((o, i) => {
      const c = makeCard(shownMinion(o.id, o.golden).dict());
      c.addEventListener("click", () => {
        closeModal(); busy = false;
        act(() => { const e = game.chooseShared(i); if (!e && online) netSend({ t: "act", m: "chooseShared", a: { i }, n: ++online.sent, turn: game.turn }); return e; });
        toast(`Everyone gets ${o.golden ? "a golden " : ""}${WA.CARDS[o.id].name}.`);
        renderPlayers();
      });
      box.appendChild(c);
    });
  }
  function afterTurnStart() {
    const sf = you.startFx;
    if (sf && sf.turn === game.turn) {
      you.startFx = null;
      const notes = sf.effects.filter((e) => !e.uids.length && e.label).map((e) => e.label);
      if (notes.length) setTimeout(() => toast(notes.join(" · ")), 1200);
      setTimeout(() => playEffects(sf.effects, null), 900);
    }
    pullInbox();
    if (game.sharedPick && game.sharedPick.chooser === you.id) return setTimeout(showSharedPick, 650);
    if (game.sharedPick && online) { busy = true; renderTop(); renderGold(); toast(`${game.players[game.sharedPick.chooser].name} is picking a minion for everyone...`); return; }
    if ((you.picks || []).length) setTimeout(showPick, 900);
    else if (you.discover.length) setTimeout(showDiscover, 1300);
    else if ((you.evolveChoices || []).length) setTimeout(showEvolveChoice, 1300);
    const ls = game.lastShared;
    if (ls && ls.turn === game.turn && ls.byId !== you.id) setTimeout(() => toast(`${ls.by} picked ${ls.golden ? "a golden " : ""}${WA.CARDS[ls.id].name}: everyone gets a copy.`), 900);
    if (you.tribePick.length) setTimeout(showTribePick, 700);
  }

  // ---------------------------------------------------------------- Duos: the portal to your partner
  function renderPortal() {
    const el = $("#portal");
    stage.classList.toggle("duo", !!game.duo);
    if (!game.duo) { el.hidden = true; return; }
    const mate = game.mateOf(you);
    el.hidden = false;
    const can = !busy && mate && mate.alive && you.gold >= WA.PASS_COST;
    const key = [mate.id, mate.hero, can].join("|");
    if (el._key === key) return;
    el._key = key;
    el.classList.toggle("ready", can);
    el.innerHTML = `<div class="pt-ring"><i></i><i></i>${heroCrest(mate)}</div><div class="pt-lbl"><b>${escH(mate.name)}</b><span>Send · ${WA.PASS_COST} gold</span></div>`;
  }
  function portalTip() {
    const mate = game.mateOf(you); if (!mate) return;
    const tip = $("#tip");
    const rows = mate.board.map((m) => `<li><span class="pt-st">${m.attack}/${m.health}</span>${m.golden ? "★ " : ""}${escH(m.name)}${m.tribe ? ` <small>${escH(TN(m.tribe))}</small>` : ""}</li>`).join("");
    tip.classList.remove("big", "nosi"); tip.innerHTML = `<h3>${escH(mate.name)}, your partner</h3><div class="tt-sub">Tier ${mate.tier} · ${mate.hand.length} in hand${HERO(mate) ? " · " + escH(HERO(mate).name) : ""}</div>
      ${rows ? `<ul class="pt-board">${rows}</ul>` : "<p>No minions yet.</p>"}<p class="pt-help">Drag a card from your hand or warband onto the portal to send it to ${escH(mate.name)} for ${WA.PASS_COST} gold.</p>`;
    placeTip($("#portal"));
  }
  const overPortal = (p) => {
    if (!game.duo) return false;
    const r = rectOf($("#portal"));
    return p.x >= r.x - 18 && p.x <= r.x + r.w + 18 && p.y >= r.y - 18 && p.y <= r.y + r.h + 18;
  };
  function sendFx(ghost) {
    const r = rectOf($("#portal .pt-ring"));
    const g = ghost.getBoundingClientRect();
    sfx.whoosh();
    ring(r.cx, r.cy, "#b58cff", 7); burst(r.cx, r.cy, 22, ["#d6b8ff", "#8f6cff", "#ffffff"], 80);
    const k = rectOf(ghost);
    anim(ghost, [{ transform: ghost.style.transform, opacity: 1 }, { transform: `translate3d(${r.cx - k.w / 2}px, ${r.cy - k.h / 2}px, 0) rotate(260deg) scale(.08)`, opacity: .2 }], { duration: 460, easing: "cubic-bezier(.5,0,.8,.6)" }).then(() => ghost.remove());
    anim($("#portal .pt-ring"), [{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 520, delay: 300, easing: "ease-out" });
  }
  function partnerNews() {
    if (!game.duo) return;
    const got = (game.passLog || []).filter((x) => x.to === you.id && x.turn === game.turn && !x.seen);
    if (!got.length) return;
    got.forEach((x) => (x.seen = true));
    const from = game.players[got[0].from];
    setTimeout(() => {
      toast(`${from.name} sent you ${got.map((x) => x.name).join(", ")}.`);
      for (const x of got) { const el = document.querySelector(`#hand [data-uid="${x.uid}"]`); if (el) glow(el, "#b58cff"); }
    }, 1300);
  }

  // ---------------------------------------------------------------- aiming arrow (targeted spells, hero powers)
  // A curved dashed arrow from the card or power to the pointer; it snaps onto a minion with a reticle.
  function aimShow(from, to, locked) {
    const svg = $("#aimArrow"); if (!svg) return;
    svg.classList.add("on"); svg.classList.toggle("locked", !!locked);
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
    // bend sideways a little, more for longer arrows
    const bend = Math.min(90, len * 0.22) * (dx >= 0 ? -1 : 1);
    const mx = (from.x + to.x) / 2 - (dy / len) * bend, my = (from.y + to.y) / 2 + (dx / len) * bend;
    // stop the line short of the tip so the head sits on the end
    const t = Math.max(0, 1 - 22 / len);
    const ex = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * mx + t * t * to.x, ey = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * my + t * t * to.y;
    svg.querySelector(".aim-line").setAttribute("d", `M${from.x.toFixed(1)},${from.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`);
    const ang = Math.atan2(to.y - my, to.x - mx) * 180 / Math.PI;
    svg.querySelector(".aim-head").setAttribute("transform", `translate(${to.x.toFixed(1)},${to.y.toFixed(1)}) rotate(${ang.toFixed(1)})`);
    const ret = svg.querySelector(".aim-ret");
    ret.setAttribute("transform", `translate(${to.x.toFixed(1)},${to.y.toFixed(1)})`);
    svg.querySelector(".aim-dot").setAttribute("cx", from.x.toFixed(1)); svg.querySelector(".aim-dot").setAttribute("cy", from.y.toFixed(1));
  }
  function aimHide() { const svg = $("#aimArrow"); if (svg) svg.classList.remove("on", "locked"); }
  // hero power aiming follows the pointer over the table
  let aimEl = null;
  function aimMove(e) {
    if (!aiming) return;
    const p = toStage(e.clientX, e.clientY), from = rectOf($("#heroPower .hp-orb") || $("#heroPower"));
    let hit = null;
    for (const c of $("#board").children) { if (!c.dataset.uid) continue; const r = rectOf(c); if (p.x >= r.x - 6 && p.x <= r.x + r.w + 6 && p.y >= r.y - 6 && p.y <= r.y + r.h + 6) { hit = c; break; } }
    if (hit !== aimEl) { if (aimEl) aimEl.classList.remove("spell-target"); if (hit) hit.classList.add("spell-target"); aimEl = hit; }
    const r = hit ? rectOf(hit) : null;
    aimShow({ x: from.cx, y: from.cy }, r ? { x: r.cx, y: r.cy } : p, !!hit);
  }
  function startAim() { aiming = true; stage.classList.add("aiming"); window.addEventListener("pointermove", aimMove); }
  function stopAim() {
    aiming = false; stage.classList.remove("aiming"); window.removeEventListener("pointermove", aimMove);
    if (aimEl) aimEl.classList.remove("spell-target"); aimEl = null; aimHide();
  }

  // ---------------------------------------------------------------- hero power
  let aiming = false;
  function renderPower() {
    const el = $("#heroPower"), hero = HERO(you);
    if (!hero) { el.hidden = true; return; }
    el.hidden = false;
    const pw = hero.power, active = pw.type === "active";
    const spent = game.powerSpent(you);
    const can = active && !spent && !you.powerUsed && you.gold >= pw.cost && !busy;
    const key = [hero.id, pw.cost, you.powerUsed, can, aiming, spent].join("|");
    if (el._key !== key) {
      el._key = key;
      el.className = "hero-power" + (active ? "" : " passive") + (you.powerUsed || spent ? " used" : "") + (can ? " ready" : "") + (aiming ? " aiming" : "");
      el.innerHTML = `<div class="hp-orb">${pw.abilities.some((ab) => ab.fx) ? "" : ""}<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${active ? '<path d="M13.5 2L4 13.5h6.5L9 22l11-12.5h-6.8z"/>' : '<path d="M12 2l2.6 6.4 6.9.5-5.3 4.4 1.7 6.7L12 16.3 6.1 20l1.7-6.7-5.3-4.4 6.9-.5z"/>'}</svg></div>
        ${active ? `<span class="cost">${pw.cost}</span>` : `<span class="hp-tag">Passive</span>`}<div class="hp-name">${escH(pw.name)}</div>`;
    }
  }
  function powerTip() {
    const hero = HERO(you); if (!hero) return;
    const tip = $("#tip"), pw = hero.power;
    tip.classList.remove("big", "nosi"); tip.innerHTML = `<h3>${escH(pw.name)}</h3><div class="tt-sub">${escH(hero.name)} · ${pw.type === "active" ? `Hero power · ${pw.cost} gold, once per turn` : "Passive hero power"}</div><p>${escH(window.WA.heroPowerText(hero.id)) || "No effect yet."}</p>`;
    placeTip($("#heroPower"));
  }
  function onPower() {
    const hero = HERO(you); if (!hero || busy) return;
    const pw = hero.power;
    if (pw.type !== "active") { powerTip(); return; }
    audio.unlock();
    if (aiming) { stopAim(); renderPower(); return; }
    if (pw.abilities.some((ab) => ab.target === "chosen")) {
      if (you.powerUsed || you.gold < pw.cost || game.powerSpent(you)) { const e = game.usePower(you, -1); toast(e); sfx.error(); return; }
      if (!you.board.length) { toast("You need a minion on the board for that."); sfx.error(); return; }
      startAim(); renderPower(); toast(`Click one of your minions for ${pw.name}.`);
      const r = rectOf($("#heroPower .hp-orb") || $("#heroPower")); aimShow({ x: r.cx, y: r.cy }, { x: r.cx + 40, y: r.cy - 120 }, false);
      return;
    }
    firePower(-1);
  }
  function firePower(target) {
    stopAim();
    const r = rectOf($("#heroPower"));
    if (act(() => game.usePower(you, target), { ghostRect: r, uid: -1 })) { sfx.ping(); ring(r.cx, r.cy, "#ffe08a", 6); burst(r.cx, r.cy, 18, ["#ffe08a", "#ffffff"], 70); }
    renderPower();
  }
  function renderHero(el, p, hp) {
    const st = p && Math.abs(p.streak) >= 2 ? `<div class="streak ${p.streak > 0 ? "hot" : "cold"}">${p.streak > 0 ? p.streak + " wins" : -p.streak + " losses"}</div>` : "";
    el.classList.toggle("out", !p || !p.alive);
    el.innerHTML = `${heroCrest(p)}<div class="hp-gem">${hp}</div>${p && p.armor ? `<div class="armor-gem" title="Armor: absorbs damage before Health">${p.armor}</div>` : ""}${p ? `<div class="htier">${p.tier}</div>` : ""}<div class="hname">${p ? escH(p.name) : "Ghost"}</div>${st}`;
  }
  const viewOf = (p) => ({ team: p.team, id: p.id, name: p.name, isBot: p.isBot, hue: p.hue, health: p.health, armor: p.armor || 0, hero: p.hero, alive: p.alive, placement: p.placement, tier: p.tier, lastResult: p.lastResult, streak: p.streak });
  function renderPlayers(vsId = -2, view = null) {
    const list = (view || game.players.map(viewOf)).sort((a, b) => (a.alive !== b.alive ? (a.alive ? -1 : 1) : a.alive ? b.health - a.health || (a.team || 0) - (b.team || 0) : a.placement - b.placement || (a.team || 0) - (b.team || 0)) || a.id - b.id);
    const box = $("#plist");
    const nextId = vsId === -2 && game.nextPairs ? (game.nextOpponentOf(you) || { id: -9 }).id : -9;
    reconcile(box, list.map((p) => ({ uid: "p" + p.id, p })), ({ p }) => {
      const e = document.createElement("div"); e.className = "pchip"; e.dataset.uid = "p" + p.id; fillChip(e, p, vsId, nextId);
      e.addEventListener("pointerenter", () => showPlayerTip(e, p.id));
      e.addEventListener("pointerleave", hideTip);
      return e;
    }, (e, { p }) => fillChip(e, p, vsId, nextId), { flipMs: 450 });
  }
  function showPlayerTip(el, id) {
    const p = game.players[id];
    if (!p || drag) return;
    const tip = $("#tip");
    const board = p.lastBoard || [];
    tip.classList.remove("big", "nosi"); tip.innerHTML = `<h3>${escH(p.name)}</h3><div class="tt-sub">${p.alive ? `${p.health} Health · Tier ${p.tier}` : `Out · #${p.placement}`}${p.isBot ? ` · ${p.mmr} MMR` : ""}</div>
      ${board.length ? `<div class="kw">Last warband seen:</div><div class="mini-board">${board.map((d) => `<span class="mini" data-tribe="${escH(d.tribe)}" title="${escH(d.name)}">${art(d.cardId)}<i>${d.attack}/${d.health}</i></span>`).join("")}</div>` : `<div class="kw">No fights yet.</div>`}`;
    placeTip(el);
  }
  const TEAM_COLORS = ["#ffc94a", "#5ec8ff", "#ff7aa8", "#7ee08a"];
  function fillChip(e, p, vsId, nextId = -9) {
    e.classList.toggle("me", !p.isBot); e.classList.toggle("out", !p.alive);
    if (game.duo) { e.dataset.team = p.team; e.classList.toggle("mate", p.team === you.team && p.id !== you.id); e.style.setProperty("--team", TEAM_COLORS[p.team % TEAM_COLORS.length]); }
    else { delete e.dataset.team; e.classList.remove("mate"); e.style.removeProperty("--team"); } e.classList.toggle("vs", p.id === vsId); e.classList.toggle("next", p.id === nextId);
    const res = p.alive && p.lastResult ? `<span class="res ${p.lastResult}">${{ win: "W", loss: "L", draw: "D" }[p.lastResult]}</span>` : "";
    const html = `${p.id === nextId ? `<span class="next-tag">Next</span>` : ""}${heroCrest(p)}<div><div class="pname">${escH(p.name)}</div><div class="pmeta">${p.alive ? `<span class="php">${p.health} HP${p.armor ? ` <i class="parm">+${p.armor}</i>` : ""}</span><span>Tier ${p.tier}</span>` : `<span>Out · #${p.placement}</span>`}</div></div>${res}`;
    if (e._html !== html) { e.innerHTML = html; e._html = html; }
  }
  function renderTop() {
    $("#keeper").classList.toggle("off", !!busy);
    for (const t of document.querySelectorAll("#shop .spell-tok")) t.classList.toggle("off", !t._d || you.gold < t._d.cost);
    const up = $("#btnUpgrade");
    if (you.tier >= MAX_TIER) { up.querySelector(".cost").hidden = true; up.querySelector(".lbl").textContent = "Max tier"; up.disabled = true; }
    else { up.querySelector(".cost").hidden = false; up.querySelector(".cost").textContent = you.upgradeCost; up.querySelector(".lbl").textContent = "Upgrade"; up.disabled = busy || you.gold < you.upgradeCost; }
    $("#btnRoll").disabled = busy || you.gold < game.rollCost(you);
    $("#btnRoll").querySelector(".cost").textContent = game.rollCost(you);
    $("#btnRoll").classList.toggle("free", you.freeRolls > 0 || game.bargainLeft(you) > 0);
    $("#btnFreeze").classList.toggle("frozen", you.frozen);
    $("#btnFreeze").setAttribute("aria-pressed", you.frozen);
    $("#btnFreeze").querySelector(".lbl").textContent = you.frozen ? "Frozen" : "Freeze";
    $("#keeperStars").innerHTML = stars(you.tier);
    $("#keeperPlate").textContent = `Tavern Tier ${you.tier}`;
  }
  function renderGold() {
    let h = `<div class="gold-num">${you.gold}/${you.maxGold} gold</div>`;
    for (let i = 0; i < 10; i++) h += `<div class="coin ${i >= Math.max(you.maxGold, you.gold) ? "locked" : i >= you.gold ? "spent" : ""}"></div>`;
    if (you.nextGold) h += `<div class="gold-next">+${you.nextGold} gold next turn</div>`;
    { const pv = you.vars ? Object.entries(you.vars).filter(([, n]) => n) : []; if (pv.length) h += `<div class="gold-vars">${pv.slice(0, 4).map(([k, n]) => `<span><i>${escH(k)}</i>${n}</span>`).join("")}</div>`; }
    $("#gold").innerHTML = h;
    animateGold();
    $("#btnEnd").disabled = busy;
    $("#btnEnd").classList.toggle("pulse", !busy && you.gold < Math.max(1, game.rollCost(you)));
  }
  function animateGold() {
    const g = you.gold, prev = lastGold; lastGold = g; const delay = goldDelay; goldDelay = 0;
    if (prev == null || prev === g) return;
    const coins = [...$("#gold").querySelectorAll(".coin")], num = $("#gold .gold-num");
    if (g < prev) coins.slice(g, prev).forEach((c, i) => anim(c, [{ filter: "none", transform: "scale(1.45)", boxShadow: "0 0 10px 3px rgba(255,210,90,.9)" }, { filter: "grayscale(1) brightness(.45)", transform: "scale(.85)", boxShadow: "0 0 0 1px rgba(0,0,0,.4)" }], { duration: 300, delay: i * 45, easing: "ease-out", fill: "backwards" }));
    else coins.slice(prev, g).forEach((c, i) => anim(c, [{ filter: "grayscale(1) brightness(.45)", transform: "scale(.85)" }, { filter: "brightness(1.6)", transform: "scale(1.5)", offset: .45 }, { filter: "none", transform: "scale(1)" }], { duration: 360, delay: delay + i * 60, easing: "cubic-bezier(.3,1.5,.5,1)", fill: "backwards" }));
    if (num && g > prev && delay) { const txt = num.textContent; num.textContent = txt.replace(/^\d+/, String(prev)); setTimeout(() => { if (num.isConnected) num.textContent = txt; }, delay); }
    if (num) { num.classList.remove("tick-up", "tick-down"); void num.offsetWidth; num.style.animationDelay = (g > prev ? delay : 0) + "ms"; num.classList.add(g > prev ? "tick-up" : "tick-down"); }
  }
  // coins flying between two points (paying the tavern, or the bartender paying you)
  function coinFlight(from, to, n, opts = {}) {
    for (let i = 0; i < n; i++) {
      const c = fxEl("coin fly-coin", from.x, from.y); c.style.position = "absolute"; c.style.width = c.style.height = (opts.size || 16) + "px"; c.style.margin = `-${(opts.size || 16) / 2}px 0 0 -${(opts.size || 16) / 2}px`;
      const dx = to.x - from.x, dy = to.y - from.y, side = (Math.random() - .5) * 70, lift = -50 - Math.random() * 40;
      anim(c, [{ transform: "translate(0,0) scale(.6)", opacity: 0 }, { transform: `translate(${dx * .45 + side}px, ${dy * .45 + lift}px) scale(1.15)`, opacity: 1, offset: .45 }, { transform: `translate(${dx}px, ${dy}px) scale(.8)`, opacity: .9 }],
        { duration: opts.ms || 520, delay: (opts.delay || 0) + i * 55, easing: "cubic-bezier(.4,0,.6,1)", fill: "backwards" }).then(() => c.remove());
    }
  }
  const goldPoint = () => { const cs = [...$("#gold").querySelectorAll(".coin:not(.locked)")], i = Math.max(0, Math.min(cs.length - 1, you.gold - 1)), c = cs[i]; if (c) { const r = rectOf(c); return { x: r.cx, y: r.cy }; } const r = rectOf($("#gold")); return { x: r.cx, y: r.cy }; };
  // a bought minion arcs from the tavern into the hand: lifted, turning, landing with a little bounce
  function buyFlight(created, cap) {
    const done = [];
    for (const el of created) {
      if (!el.closest("#hand")) continue; const c = cap.get(el.dataset.uid); if (!c) continue;
      const n = rectOf(el), dx = c.rect.x - n.x, dy = c.rect.y - n.y, sc = c.rect.w / n.w;
      el.style.transformOrigin = "0 0"; el.style.zIndex = 80;
      // only transforms and opacity move (the graphics card does those); the golden glow is a halo that fades, not a filter repainted every frame
      const halo = document.createElement("i"); halo.className = "fly-glow"; el.appendChild(halo);
      anim(halo, [{ opacity: 1 }, { opacity: .55, offset: .45 }, { opacity: 0 }], { duration: S(460), easing: "ease-out" }).then(() => halo.remove());
      anim(el, [{ translate: `${dx}px ${dy}px`, scale: `${sc}`, rotate: "0deg" },
        { translate: `${dx * .45}px ${dy * .45 - 70}px`, scale: `${(sc + 1) / 2 * 1.12}`, rotate: "-5deg", offset: .45 },
        { translate: "0px -10px", scale: "1.05", rotate: "1.5deg", offset: .8 },
        { translate: "0px 0px", scale: "1", rotate: "0deg" }],
        { duration: S(460), easing: "cubic-bezier(.3,.7,.3,1)" }).then(() => { el.style.transformOrigin = ""; el.style.zIndex = el._z || el.style.zIndex; layoutHand([...$("#hand").children].filter((x) => x.dataset.uid)); });
      coinFlight(goldPoint(), { x: c.rect.cx, y: c.rect.cy }, 3, { ms: 300, size: 14 });
      done.push(el);
    }
    return done;
  }
  // a sold minion is tossed to the bartender, who flips coins back into your purse
  function sellFlight(ghost, r) {
    const k = rectOf($("#keeper")), keeper = $("#keeper");
    if (ghost) { const t = ghost.style.transform || "";
      anim(ghost, [{ transform: t, opacity: 1 }, { transform: `translate3d(${(r.x + k.cx) / 2 - r.w / 2}px, ${Math.min(r.y, k.y) - 60}px, 0) rotate(-14deg) scale(.75)`, opacity: 1, offset: .5 }, { transform: `translate3d(${k.cx - r.w / 2}px, ${k.cy - r.h / 2}px, 0) rotate(-30deg) scale(.2)`, opacity: 0 }],
        { duration: S(380), easing: "cubic-bezier(.4,0,.7,1)" }).then(() => ghost.remove()); }
    setTimeout(() => { if (keeper) anim(keeper, [{ transform: "none" }, { transform: "translateY(-8px) scale(1.07)", offset: .35 }, { transform: "none" }], { duration: 300, easing: "cubic-bezier(.3,1.6,.5,1)" }); }, S(330));
    const v = Math.max(1, WA.SELL + ((you.mods && you.mods.sell) || 0));
    setTimeout(() => coinFlight({ x: k.cx, y: k.cy }, goldPoint(), Math.min(6, v + 2), { ms: 480 }), S(330));
  }
  // hovering a card or a minion tilts it toward the pointer
  function bindTilt(el, max) {
    // one update per frame at most (a fast mouse sends several moves per frame): read the box once, then write
    let pend = null, raf = 0;
    const step = () => { raf = 0; const e = pend; pend = null; if (!e || drag || busy || el.classList.contains("lifted") || !el.isConnected) return;
      const r = el.getBoundingClientRect(), nx = (e.x - r.left) / r.width - .5, ny = (e.y - r.top) / r.height - .5, len = Math.hypot(nx, ny);
      if (!len) return;
      el.style.rotate = `${(-ny / len).toFixed(3)} ${(nx / len).toFixed(3)} 0 ${(Math.min(1, len * 1.6) * max).toFixed(2)}deg`;
      if (!el._glare) { el.insertAdjacentHTML("beforeend", '<i class="tilt-glare"></i>'); el._glare = true; }
      el.style.setProperty("--gx", ((nx + .5) * 100).toFixed(1) + "%"); el.style.setProperty("--gy", ((ny + .5) * 100).toFixed(1) + "%"); if (!el.classList.contains("tilting")) el.classList.add("tilting"); };
    el.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || drag || busy || el.classList.contains("lifted")) return;
      pend = { x: e.clientX, y: e.clientY }; if (!raf) raf = requestAnimationFrame(step);
    });
    el.addEventListener("pointerleave", () => { pend = null; if (raf) { cancelAnimationFrame(raf); raf = 0; } el.style.rotate = ""; el.classList.remove("tilting"); });
  }
  // counters of your own (Rage, Souls…): a small plate under the minion
  // ---- markers (v78): +1/+1 markers and keyword markers sit on the minion as small chips
  const MK_GLYPH = { taunt: "⛨", shield: "◈", reborn: "✚", windfury: "≋", venomous: "☠", cleave: "⚔", stealth: "◐", rally: "⚑", tough: "▣", flying: "➶" };
  const mkStList = (mk) => Object.entries((mk && mk.st) || {}).filter(([, n]) => n > 0).map(([k, n]) => { const [a, h] = k.split("/"); return { z: `+${a}/+${h}`, n, one: k === "1/1" }; });
  function markersText(mk) { if (!mk) return ""; return [...mkStList(mk).map((x) => `${x.n} × ${x.z}`), ...(mk.kw || []).map((k) => KW_TEXT[k] || k)].filter(Boolean).join(" · "); }
  function setMarkers(el, d, prev) {
    let box = el.querySelector(":scope > .mn-mk"); const mk = d.mk, key = mk ? JSON.stringify(mk.st || {}) + ":" + (mk.kw || []).join(",") : "";
    if (!key) { if (box) box.remove(); el._mkKey = ""; return; }
    if (el._mkKey === key && box) return;
    const grew = prev && el._mkKey !== undefined && el._mkKey !== key; el._mkKey = key;
    if (!box) { box = document.createElement("div"); box.className = "mn-mk"; el.appendChild(box); }
    box.title = T("Markers") + ": " + markersText(mk);
    box.innerHTML = mkStList(mk).map((x) => `<span class="mk-p">${x.one ? "+" + x.n : (x.n > 1 ? x.n + "×" : "") + x.z}</span>`).join("") + (mk.kw || []).map((k) => `<span class="mk-k k-${k}" title="${escH((KW_TEXT[k] || k) + " " + T("marker"))}">${MK_GLYPH[k] || "◆"}</span>`).join("");
    if (grew) anim(box, [{ transform: "scale(1.5)", filter: "brightness(1.8)" }, { transform: "none", filter: "none" }], { duration: 420, easing: "cubic-bezier(.3,1.6,.5,1)" });
  }
  function setVars(el, d, prev) {
    let v = el.querySelector(":scope > .mn-vars"); const list = d.vars ? Object.entries(d.vars).filter(([, n]) => n) : [];
    if (!list.length) { if (v) v.remove(); return; }
    if (!v) { v = document.createElement("div"); v.className = "mn-vars"; el.appendChild(v); }
    v.innerHTML = list.slice(0, 2).map(([k, n]) => `<span><i>${escH(k)}</i>${n}</span>`).join("");
    if (prev && JSON.stringify(prev.vars || {}) !== JSON.stringify(d.vars || {})) anim(v, [{ transform: "scale(1.35)", filter: "brightness(1.6)" }, { transform: "none", filter: "none" }], { duration: 380, easing: "cubic-bezier(.3,1.6,.5,1)" });
  }
  function layoutHand(order) {
    // a lifted card keeps hold of the pointer down to where it rested (else it bounces up and down under it)
    for (const el of order) if (el.classList && el.classList.contains("card") && !el.querySelector(":scope > .hit-pad")) el.insertAdjacentHTML("beforeend", '<i class="hit-pad" aria-hidden="true"></i>');
    const n = order.length, w = 140, avail = 705; // in card pixels: a full hand stays between your gold and End Turn
    const overlap = n > 1 && n * (w + 8) > avail ? (n * w - avail) / (n - 1) : -8;
    order.forEach((el, i) => {
      const c = i - (n - 1) / 2;
      el.style.marginLeft = i === 0 ? "0" : -overlap + "px";
      el.style.setProperty("--rot", c * 3 + "deg");
      el.style.setProperty("--ty", Math.abs(c) * Math.abs(c) * 1.3 + "px");
      el.style.zIndex = i + 1;
    });
  }
  // Shrink a card's text until the whole of it fits its panel (the painted panels are small).
  function fitCardText(card) {
    const box = card.querySelector(".card-text"), span = box && box.firstElementChild; if (!span) return;
    // already fitted for this text in this box: nothing to measure again
    const key = span.textContent + "|" + box.clientWidth + "x" + box.clientHeight + "|" + getComputedStyle(box).fontSize + "|" + getComputedStyle(box).fontFamily;
    if (card._fitKey === key) return;
    card._fitKey = key;
    span.style.fontSize = ""; box.classList.remove("overflow");
    let fs = parseFloat(getComputedStyle(box).fontSize), n = 0;
    while (n++ < 14 && fs > 5.5 && span.scrollHeight > box.clientHeight + 1) { fs -= 0.5; span.style.fontSize = fs + "px"; }
    if (span.scrollHeight > box.clientHeight + 1) box.classList.add("overflow"); // still too long: show it from the top
  }
  function fitAllCards(root) { for (const c of (root || document).querySelectorAll(".card")) fitCardText(c); }
  window.WA_FIT_CARDS = fitAllCards;
  function renderTavern() {
    renderTop(); renderGold();
    renderHero($("#myhero"), you, you.health);
    renderPower(); renderPortal();
    const created = [];
    const shopList = you.shop.map((m) => m.dict());
    if (you.shopSpell) { const sd = you.shopSpell.dict(); if (game.spellCost) { const c = game.spellCost(you, you.shopSpell); if (c !== sd.cost) { sd.cost = c; sd.cheaper = true; } } shopList.push(sd); }
    created.push(...reconcile($("#shop"), shopList, (d) => { const e = d.isSpell ? makeSpellToken(d) : makeToken(d, { tier: true }); bindDrag(e, "shop"); return e; }, (el, d) => (d.isSpell ? ((el._d = d), spellCostTag(el, d)) : updateToken(el, d)),
      { empty: you.frozen ? "" : "The tavern is empty. Refresh for new minions." }));
    $("#shop").classList.toggle("frozen-row", you.frozen);
    created.push(...reconcile($("#board"), you.board.map((m) => m.dict()), (d) => { const e = makeToken(d, { board: true }); bindDrag(e, "board"); e.querySelector(".mn-act").addEventListener("pointerdown", (ev) => ev.stopPropagation()); e.querySelector(".mn-act").addEventListener("click", (ev) => { ev.stopPropagation(); if (busy || drag) return; activateEl(e); }); return e; }, updateToken,
      { empty: "Drag minions here from your hand. Your leftmost minion attacks first." }));
    created.push(...reconcile($("#hand"), you.hand.map((m) => m.dict()), (d) => { const e = makeCard(d); bindDrag(e, "hand"); return e; }, updateCard,
      { empty: `Drag a minion from the tavern down here to buy it for ${game.buyCost(you)} gold.`, after: layoutHand }));
    renderPlayers();
    renderAff(); decorateBoard();
    requestAnimationFrame(() => { fitAllCards($("#hand")); fitAllCards($("#shop")); });
    return created;
  }
  // ---------------------------------------------------------------- affinities on the table
  // The two affinity slots show your two strongest affinities: icon in its frame, count, level and the mechanic's state.
  function affRank(board) {
    const st = WA.affState(board);
    return WA.AFFS.filter((a) => st[a].n > 0).sort((x, y) => st[y].lv - st[x].lv || st[y].n - st[x].n || WA.AFFS.indexOf(x) - WA.AFFS.indexOf(y)).map((a) => Object.assign({ a }, st[a]));
  }
  function affStateText(it) {
    const A = WA.AFF[it.a], fr = isFr();
    if (it.lv < 1) return fr ? `${A.t1 - it.n} de plus pour l'activer` : `${A.t1 - it.n} more to wake it`;
    const v = WA.affVal(it.a, it.lv);
    switch (A.kind) {
      case "gauge": return `${(you.gauges || {})[it.a] || 0} / ${v}`;
      case "ebb": return `${game.refluxLeft ? game.refluxLeft(you) : 0} / ${v} ${fr ? "ce tour" : "this turn"}`;
      case "found": return `${(you.found || []).reduce((a, b) => a + b, 0)} · max ${v}/${fr ? "empl." : "slot"}`;
      case "mire": return `−${v} ${fr ? "ATQ" : "Atk"}`;
      case "pulse": return it.lv >= 2 ? (fr ? "toute la chaîne" : "whole chain") : (fr ? "adjacents" : "adjacent");
      case "bonus": return `+${v}/+${v} ${fr ? "en combat" : "in combat"}`;
      case "growth": return `+${v}/+${v} ${fr ? "fin de tour" : "end of turn"}`;
      case "echo": return `+${v}/+${v} ${fr ? "en héritage" : "legacy"}`;
      case "ward": return `${v} × ${WA.kwName(A.kw)}`;
      case "unity": return `+${v} ${fr ? "ATQ par autre" : "Atk per other"}`;
      case "strike": return `${v} ${fr ? "dégâts" : "damage"}`;
      case "wealth": return `+${v} ${fr ? "or par tour" : "gold a turn"}`;
      case "none": { const n = (A.effects || []).filter((ab) => (ab.alv || 1) <= it.lv).length; return `${n} ${fr ? "effet" + (n > 1 ? "s" : "") : "effect" + (n > 1 ? "s" : "")}`; }
    }
    return "";
  }
  function renderAff() {
    if (!you || !game) return;
    renderPressure();
    // affinities are a rule of the meta: when it is off, their slots leave the table
    const on = WA.affOn();
    for (const sel of ["#affSlot1", "#affSlot2"]) { const e = $(sel); if (e && e.hidden === on) e.hidden = !on; }
    if (!on) return;
    const list = affRank(you.board);
    ["#affSlot1", "#affSlot2"].forEach((sel, i) => {
      const el = $(sel); if (!el) return;
      const it = list[i] || null, frame = el.dataset.frame || "shell";
      const key = JSON.stringify([it, frame, it ? affStateText(it) : "", list.length, isFr()]);
      if (el._key === key) return;
      const before = el._aff; el._key = key; el._aff = it;
      el.className = "aff-slot" + (it ? " has lv" + it.lv + " a-" + it.a : " empty") + (frame === "none" ? " noframe" : ""); el.style.setProperty("--ac", it ? WA.AFF[it.a].color || "#c9a24a" : "");
      const A = it && WA.AFF[it.a], max = it ? WA.affMaxLv(it.a) : 2, next = it && it.lv < max ? WA.affThreshold(it.a, it.lv + 1) : 0;
      el.innerHTML = `${frame !== "none" ? `<img class="af-frame" src="${AFF_FRAMES[frame] || AFF_FRAMES.shell}" alt="">` : ""}${it ? `<img class="af-icon" src="${AFF_IMG(it.a)}" alt="">` : ""}
        ${it ? `<div class="af-count">${it.n}${next ? `<small>/${next}</small>` : `<small>★</small>`}</div><div class="af-pips">${Array.from({ length: max }, (_, k) => `<i class="${it.lv > k ? "on" : ""}"></i>`).join("")}</div>
        <div class="af-info"><b>${escH(WA.affMech(it.a))}</b><span>${escH(affStateText(it))}</span></div>` : ""}${i === 1 && list.length > 2 ? `<div class="af-more">+${list.length - 2}</div>` : ""}`;
      if (it && before && before.a === it.a && it.lv > before.lv) { anim(el, [{ transform: "scale(1)", filter: "brightness(1)" }, { transform: "scale(1.25)", filter: "brightness(1.8) drop-shadow(0 0 18px #fff3b0)" }, { transform: "scale(1)", filter: "brightness(1)" }], { duration: 700, easing: "cubic-bezier(.3,1.5,.5,1)" }); sfx.triple(); }
    });
  }
  // Steam: the Pressure gauge, a ring that fills up with steam as Pressure builds
  function gaugeAff() {
    const list = WA.affsOfKind("gauge"); if (!list.length) return "";
    return list.reduce((best, a) => { const n = WA.affCount(you.board, a) * 100 + ((you.gauges || {})[a] || 0); return n > best[1] ? [a, n] : best; }, [list[0], -1])[0];
  }
  function renderPressure() {
    const el = $("#pressureGauge"); if (!el || !you || !game) return;
    const a = gaugeAff();
    const n = a ? WA.affCount(you.board, a) : 0, lv = a ? WA.affLevel(you.board, a) : 0, have = a ? (you.gauges || {})[a] || 0 : 0;
    const max = a ? WA.affVal(a, Math.max(1, lv)) : 5, show = WA.affOn() && !!a && (tableEditing || n > 0 || have > 0);
    if (el.hidden === show) el.hidden = !show;
    if (!show) return;
    const p = Math.max(0, Math.min(1, max ? have / max : 0)), key = [a, have, max, lv, isFr()].join("|");
    if (el._key === key) return;
    const before = el._have; el._key = key; el._have = have; el._aff = a;
    el.classList.toggle("off", lv < 1); el.classList.toggle("full", have >= max && lv >= 1);
    if (!el.firstChild) el.innerHTML = `<div class="pg-fill"><div class="pg-liquid"><i></i><i></i><i></i></div></div><img class="pg-ring" src="${AFF_FRAMES.steam}" alt=""><div class="pg-num"></div><div class="pg-lbl"></div>`;
    el.style.setProperty("--p", p.toFixed(3)); el.style.setProperty("--gc", WA.AFF[a].color || "#b88cff");
    el.querySelector(".pg-num").innerHTML = `${have}<small>/${max}</small>`;
    el.querySelector(".pg-lbl").textContent = lv < 1 ? `${WA.affMech(a)} · ${WA.AFF[a].t1 - n} ${isFr() ? "de plus" : "more"}` : WA.affMech(a);
    if (before != null && have !== before) anim(el, [{ transform: "scale(1)" }, { transform: `scale(${have > before ? 1.14 : 0.9})`, filter: "brightness(1.5)" }, { transform: "scale(1)" }], { duration: 480, easing: "cubic-bezier(.3,1.6,.5,1)" });
  }
  function pressureTip(el) {
    const tip = $("#tip"); tip.classList.remove("big", "nosi", "handtip");
    const a = el._aff || gaugeAff(); if (!a) return;
    const lv = you ? WA.affLevel(you.board, a) : 0, max = WA.affVal(a, Math.max(1, lv));
    tip.innerHTML = `<h3>${escH(WA.affName(a))} — ${escH(WA.affMech(a))}</h3><div class="tt-sub">${you ? (you.gauges || {})[a] || 0 : 0} / ${max} · ${T("Level")} ${lv}</div><p>${escH(WA.affBlurb(a))}</p>`;
    placeTip(el);
  }
  const affSteps = (a) => { const A = WA.AFF[a]; return [A.t1, A.t2].concat(A.t3 ? [A.t3] : []).join(" / "); };
  // an affinity's own effects, level by level, locked ones greyed
  function affFxHTML(a, lv) {
    const l = WA.affEffectsText(a); if (!l.length && !WA.affCarryText(a).length) return "";
    const c = WA.affCarryText(a).map((x) => Object.assign({ carry: true }, x));
    return `<div class="tt-afx">${l.concat(c).map((x) => `<div class="kw${x.lv > lv ? " locked" : ""}"><b>${x.carry ? T("Carried") + " · " : ""}${T("Level")} ${x.lv}${x.lv > lv ? " 🔒" : ""}:</b> ${escH(x.text)}</div>`).join("")}</div>`;
  }
  function affTip(el) {
    const tip = $("#tip"); tip.classList.remove("big", "nosi", "handtip");
    const list = affRank(you ? you.board : []), it = el._aff;
    const row = (x) => `<div class="kw tt-aff${x === it ? " cur" : ""}"><img src="${AFF_IMG(x.a)}" alt=""><span><b>${escH(WA.affName(x.a))} · ${escH(WA.affMech(x.a))}</b> — ${x.n} (${affSteps(x.a)}) · ${T("level")} ${x.lv}<br>${escH(affStateText(x))}</span></div>`;
    tip.innerHTML = it ? `<h3>${escH(WA.affName(it.a))} — ${escH(WA.affMech(it.a))}</h3><div class="tt-sub">${T("Level")} ${it.lv} · ${it.n} ${T("minions")} (${affSteps(it.a)})</div>${WA.affDesc(it.a) ? `<p class="tt-lore">${rich(escH(WA.affDesc(it.a)))}</p>` : ""}${WA.AFF[it.a].kind !== "none" && !WA.AFF[it.a].descOnly ? `<p>${escH(WA.affBlurb(it.a))}</p>` : ""}${affFxHTML(it.a, it.lv)}
        ${WA.AFF[it.a].kind === "found" ? `<div class="kw">${T("Foundations by slot")}: ${(you.found || []).map((n) => n || "·").join(" ")}</div>` : ""}${WA.AFF[it.a].kind === "ebb" && it.lv >= 1 ? `<div class="kw">${isFr() ? `Glissez un serviteur ${escH(WA.affName(it.a))} de votre troupe vers votre main.` : `Drag a ${escH(WA.affName(it.a))} minion from your warband to your hand.`}</div>` : ""}
        ${list.length > 1 ? `<div class="kw"><b>${T("Your affinities")}:</b></div>` + list.map(row).join("") : ""}`
      : `<h3>${T("Affinity slot")}</h3><p>${T("Play minions that share an affinity (Coral, Steam, Tar, Water, Earth) to wake its mechanic. Your two strongest show here.")}</p>`;
    placeTip(el);
  }
  // Coral: a Pulse runs along the chain, left to right
  function animatePulse(uids) {
    uids.forEach((uid, i) => setTimeout(() => {
      const el = document.querySelector(`#board [data-uid="${uid}"]`); if (!el) return;
      const r = rectOf(el); ring(r.cx, r.cy, "#ff8fb8", 7); burst(r.cx, r.cy, 10, ["#ff8fb8", "#7fe0ff", "#fff"], 60);
      anim(el, [{ filter: "brightness(1)" }, { filter: "brightness(1.7) drop-shadow(0 0 14px #ff8fb8)", transform: "translateY(-6px)" }, { filter: "brightness(1)" }], { duration: 420, easing: "ease-out" });
      const ln = el.querySelector(".mn-link"); if (ln) anim(ln, [{ opacity: 1, filter: "brightness(1)" }, { filter: "brightness(2.2)" }, { filter: "brightness(1)" }], { duration: 300, delay: 120 });
      if (i === 0) sfx.whoosh();
    }, D(i * 170)));
  }
  // board: Foundations under each slot, the Coral reef, Water minions that can Ebb
  function decorateBoard() {
    if (!you || !game) return;
    const els = [...$("#board").children].filter((e) => e.dataset.uid);
    const pulses = WA.affsOfKind("pulse").filter((a) => WA.affLevel(you.board, a) >= 1);
    const ebb = game.refluxLeft ? game.refluxLeft(you) > 0 : false;
    els.forEach((e, i) => {
      const m = you.board[i], n = (you.found || [])[i] || 0;
      let f = e.querySelector(".mn-found");
      if (n > 0) { if (!f) { f = document.createElement("div"); f.className = "mn-found"; e.appendChild(f); } f.innerHTML = "<i></i>".repeat(Math.min(3, n)) + (n > 3 ? `<b>${n}</b>` : ""); f.title = (isFr() ? "Fondations sous cet emplacement : " : "Foundations under this slot: ") + n; }
      else if (f) f.remove();
      // Coral: the reef is awake; adjacent Corals are linked (the Pulse runs along the links)
      const nx = you.board[i + 1], reef = m && pulses.some((a) => WA.hasAff(m, a));
      e.classList.toggle("colony", !!reef);
      const link = reef && nx && pulses.some((a) => WA.hasAff(m, a) && WA.hasAff(nx, a)); let l = e.querySelector(".mn-link");
      if (link && !l) { l = document.createElement("div"); l.className = "mn-link"; e.appendChild(l); } else if (!link && l) l.remove();
      e.classList.toggle("can-ebb", !!(m && ebb && game.refluxLeft(you, m) > 0 && !game.canReflux(you, i)));
    });
  }

  // Elements that changed zone fly in from where they were.
  function captureAll() {
    const m = new Map();
    // element refs, not outerHTML: serialising cards with picture data URLs cost a megabyte of string work per click
    for (const el of document.querySelectorAll("#shop [data-uid], #board [data-uid], #hand [data-uid]")) m.set(el.dataset.uid, { rect: rectOf(el), el });
    return m;
  }
  // a throwaway copy of a captured element, for triple / devour animations
  function ghostFrom(c) {
    if (c.el) return c.el.cloneNode(true);
    if (!c.html) return null;
    const h = document.createElement("div"); h.innerHTML = c.html; return h.firstElementChild;
  }
  function crossFlip(created, cap) {
    for (const el of created) {
      const c = cap.get(el.dataset.uid);
      if (!c) continue;
      const n = rectOf(el);
      el.style.transformOrigin = "0 0";
      anim(el, [{ translate: `${c.rect.x - n.x}px ${c.rect.y - n.y}px`, scale: `${c.rect.w / n.w}` }, { translate: "0px 0px", scale: "1" }],
        { duration: S(340), easing: "cubic-bezier(.2,.8,.2,1)" }).then(() => (el.style.transformOrigin = ""));
    }
  }

  // Run a tavern action with its animations.
  function act(fn, opts = {}) {
    const now = performance.now(); snappy = now - lastAct < 700; lastAct = now; tipQuiet = now + 650; quietAt.x = ptrNow.x; quietAt.y = ptrNow.y; clearTimeout(tipTimer);
    const cap = captureAll();
    if (opts.ghostRect) cap.set(String(opts.uid), { rect: opts.ghostRect, html: opts.ghostHTML });
    game.lastTriple = []; game.lastEffects = []; game.lastDevour = []; game.lastPulse = [];
    const err = fn();
    if (err) { goldDelay = 0; toast(err); sfx.error(); return false; }
    const created = renderTavern();
    const flown = opts.buy ? buyFlight(created, cap) : [];
    crossFlip(created.filter((e) => !flown.includes(e)), cap);
    if (opts.ghostRect && !opts.buy) {
      const el = document.querySelector(`#board [data-uid="${opts.uid}"], #hand [data-uid="${opts.uid}"]`);
      if (el && !created.includes(el)) crossFlip([el], cap);
    }
    if (opts.land != null) landFx(opts.land, !!opts.big);
    if (game.lastTriple.length) animateTriple(game.lastTriple, cap);
    if (game.lastDevour && game.lastDevour.length) { animateDevour(game.lastDevour, cap); game.lastDevour = []; }
    if (game.lastPulse && game.lastPulse.length) { animatePulse(game.lastPulse); game.lastPulse = []; }
    const from = opts.ghostRect || null;
    // effects with nothing to point at (gold, pickpocket...) show as a toast
    const notes = (game.lastEffects || []).filter((e) => !e.uids.length && e.label).map((e) => e.label);
    if (notes.length) toast(notes.join(" · "));
    playEffects(game.lastEffects || [], from);
    if ((you.picks || []).length) setTimeout(showPick, 350);
    else if (you.discover.length) setTimeout(showDiscover, game.lastTriple.length ? 900 : 160);
    else if ((you.evolveChoices || []).length) setTimeout(showEvolveChoice, 700);
    else if (you.tribePick.length) setTimeout(showTribePick, 220);
    return true;
  }
  // "You choose" effects: the candidates light up on the table; click one (or Skip)
  let picking = false;
  function showPick() {
    const q = you.picks || []; if (!q.length || picking || !$("#modal").hidden) return;
    const pk = q[0];
    picking = true; busy = true; hideTip(); if (drag) onCancel(); renderTop(); renderGold();
    stage.classList.add("picking");
    const els = pk.cands.map((uid) => document.querySelector(`#board [data-uid="${uid}"], #shop [data-uid="${uid}"], #hand [data-uid="${uid}"]`)).filter(Boolean);
    els.forEach((el) => el.classList.add("pickable"));
    const src = pk.uid !== -1 && document.querySelector(`#board [data-uid="${pk.uid}"]`); if (src) src.classList.add("pick-src");
    let bar = $("#pickBar"); if (!bar) { bar = document.createElement("div"); bar.id = "pickBar"; stage.appendChild(bar); }
    bar.innerHTML = `<b>${T("Choose a target")}</b><span>${escH(pk.text)}</span><button type="button" class="pill" id="pickSkip">${T("Skip")}</button>`; bar.hidden = false;
    bar.querySelector("#pickSkip").addEventListener("click", () => resolvePick(-1));
    sfx.bell ? 0 : 0;
  }
  function endPick() {
    picking = false; busy = false; stage.classList.remove("picking");
    for (const el of document.querySelectorAll(".pickable, .pick-src")) el.classList.remove("pickable", "pick-src");
    const bar = $("#pickBar"); if (bar) bar.hidden = true;
    renderTop(); renderGold();
  }
  function resolvePick(i) {
    if (!picking) return; endPick();
    act(() => game.choosePick(you, i));
    sfx.drop();
  }
  document.addEventListener("click", (e) => {
    if (!picking) return;
    const el = e.target.closest(".pickable"); if (!el) return;
    e.preventDefault(); e.stopPropagation();
    const pk = (you.picks || [])[0]; if (!pk) { endPick(); return; }
    const i = pk.cands.indexOf(+el.dataset.uid); resolvePick(i < 0 ? -1 : i);
  }, true);
  // glows, floating numbers and look effects for a list of engine effects
  function playEffects(list, from) {
    for (const e of list) if (e.dice) diceFx(document.querySelector(`#board [data-uid="${e.uids[0]}"], #hand [data-uid="${e.uids[0]}"], #shop [data-uid="${e.uids[0]}"]`), e.dice);
    list = list.filter((e) => !e.dice);
    list.forEach((e, k) => {
      setTimeout(() => {
        if (e.dice) { diceFx(document.querySelector(`#board [data-uid="${e.uids[0]}"], #hand [data-uid="${e.uids[0]}"], #shop [data-uid="${e.uids[0]}"]`), e.dice); return; }
        const src = document.querySelector(`#board [data-uid="${e.source}"]`);
        glow(src);
        for (const u of e.uids) {
          const tgt = document.querySelector(`#board [data-uid="${u}"], #shop [data-uid="${u}"], #hand [data-uid="${u}"]`);
          if (!tgt) {
            // the target left the table (a sold minion's own effect, a devoured one...): show the result where it makes sense
            const txt = buffLabel(e.a, e.h, e.label); if (!txt) continue;
            const anchor = /gold|or\b|Armor|Armure|Health|PV/i.test(e.label || "") ? $("#gold") : from ? null : $("#keeper");
            if (anchor) floatText(anchor, txt, "#ffd25a"); else if (from) { const f = fxEl("float", from.cx, from.cy, txt); f.style.color = "#ffd25a"; anim(f, [{ transform: "translate(-50%,-50%) scale(.6)", opacity: 0 }, { transform: "translate(-50%,-120%) scale(1.1)", opacity: 1, offset: .3 }, { transform: "translate(-50%,-220%)", opacity: 0 }], { duration: D(1100), easing: "ease-out" }).then(() => f.remove()); }
            continue;
          }
          if (FX[e.fx]) playFx(e.fx, src, tgt);
          else if (from && e.source === -1) sparkleTo(from, tgt, "#9fdcff");
          else { glow(tgt, "#7ff06a"); kwMoment(tgt, e.label, "#7ff06a"); }
          floatText(tgt, buffLabel(e.a, e.h, e.label));
        }
        sfx.buff();
      }, S(300) + k * S(160));
    });
  }

  // A tavern minion is dragged into the eater's maw.
  function animateDevour(list, cap) {
    list.forEach((dv, k) => {
      const c = cap.get(String(dv.from));
      const eater = document.querySelector(`#board [data-uid="${dv.into}"]`);
      const ghost = c && eater ? ghostFrom(c) : null;
      if (!ghost) return;
      ghost.classList.remove("lifted");
      ghost.style.cssText = `position:absolute;left:${c.rect.x}px;top:${c.rect.y}px;margin:0;z-index:6`;
      fxLayer().appendChild(ghost);
      const e = rectOf(eater);
      setTimeout(() => {
        sfx.death();
        anim(ghost, [{ transform: "none", opacity: 1 }, { transform: `translate(${(e.cx - c.rect.cx) * .4}px, ${(e.cy - c.rect.cy) * .4 - 40}px) rotate(-14deg) scale(.9)`, opacity: 1, offset: .45 },
          { transform: `translate(${e.cx - c.rect.cx}px, ${e.cy - c.rect.cy}px) rotate(30deg) scale(.15)`, opacity: .2 }], { duration: 520, easing: "cubic-bezier(.5,0,.6,1)" })
          .then(() => { ghost.remove(); burst(e.cx, e.cy, 16, ["#c63c5a", "#f27a86", "#2a0510"], 70); glow(eater, "#f27a86");
            anim(eater, [{ transform: "none" }, { transform: "scale(1.18,0.86)" }, { transform: "scale(.94,1.08)" }, { transform: "none" }], { duration: 360 }); });
      }, k * 220);
    });
  }

  function buffLabel(a, h, label) {
    const stats = a && h ? `+${a}/+${h}` : a ? `+${a} Attack` : h ? `+${h} Health` : "";
    return [stats, label].filter(Boolean).join(" ");
  }

  // Triple: the three copies fly together, spin into one, flash, and the golden card pops out big before dropping into place.
  function animateTriple(info, cap) {
    sayQuip("triple");
    info.forEach((t, n) => setTimeout(() => tripleOne(t, cap), n * 300));
  }
  function tripleOne(t, cap) {
    const g = document.querySelector(`[data-uid="${t.golden}"]`);
    if (!g) return;
    g.style.opacity = "0";
    const gr = rectOf(g), M = { x: 640, y: 380 }; // where they meet: the middle of the table
    const ghosts = t.removed.map((uid) => cap.get(String(uid))).filter(Boolean).map((c) => {
      const ghost = ghostFrom(c); if (!ghost) return null;
      ghost.classList.remove("lifted", "aim-src");
      // natural card size, scaled with a transform: hand cards are shrunk with CSS zoom, which a copy outside the hand loses
      ghost.style.cssText = `position:absolute;left:0;top:0;margin:0;z-index:40;--rot:0deg;--ty:0px;transition:none;`;
      fxLayer().appendChild(ghost);
      const nw = ghost.offsetWidth || c.rect.w, nh = ghost.offsetHeight || c.rect.h;
      ghost.style.left = c.rect.cx - nw / 2 + "px"; ghost.style.top = c.rect.cy - nh / 2 + "px";
      return { ghost, r: c.rect, k: c.rect.w / nw };
    }).filter(Boolean);
    sfx.whoosh();
    // 1. gather in a fan, 2. spin together into the middle
    ghosts.forEach(({ ghost, r, k: z }, i) => {
      const k = i - (ghosts.length - 1) / 2, fx = M.x + k * 78 - r.cx, fy = M.y - Math.abs(k) * 10 - r.cy;
      anim(ghost, [{ transform: `translate(0,0) scale(${z}) rotate(0)`, filter: "brightness(1)" },
        { transform: `translate(${fx}px,${fy}px) scale(${z * 1.15}) rotate(${k * 12}deg)`, filter: "brightness(1.25) drop-shadow(0 0 10px #ffd25a)", offset: 0.55 },
        { transform: `translate(${M.x - r.cx}px,${M.y - r.cy}px) scale(${z * .55}) rotate(${k * 200 + 180}deg)`, filter: "brightness(2.2) drop-shadow(0 0 22px #ffd25a)", opacity: 0.2 }],
        { duration: D(620), delay: D(i * 45), easing: "cubic-bezier(.5,0,.25,1)", fill: "forwards" }).then(() => ghost.remove());
    });
    setTimeout(() => {
      // 3. the flash, and the golden card pops out big
      ring(M.x, M.y, "#ffd25a", 12); ring(M.x, M.y, "#fff3b0", 7); burst(M.x, M.y, 40, ["#ffd25a", "#fff3b0", "#ff9a3a", "#ffffff"], 150);
      sfx.triple(); shakeStage(4);
      const big = g.cloneNode(true); big.classList.remove("lifted", "aim-src");
      big.style.cssText = `position:absolute;left:0;top:0;margin:0;z-index:41;opacity:1;--rot:0deg;--ty:0px;transition:none;pointer-events:none;`;
      big.classList.add("triple-pop"); fxLayer().appendChild(big);
      const nw = big.offsetWidth || gr.w, nh = big.offsetHeight || gr.h, z = gr.w / nw;
      big.style.left = M.x - nw / 2 + "px"; big.style.top = M.y - nh / 2 + "px";
      anim(big, [{ transform: `scale(${z * .2}) rotate(-12deg)`, filter: "brightness(3)" }, { transform: `scale(${z * 1.75}) rotate(3deg)`, filter: "brightness(1.4) drop-shadow(0 0 26px #ffd25a)", offset: 0.25 },
        { transform: `scale(${z * 1.6}) rotate(0)`, filter: "brightness(1.15) drop-shadow(0 0 20px #ffd25a)", offset: 0.6 },
        { transform: `translate(${gr.cx - M.x}px,${gr.cy - M.y}px) scale(${z}) rotate(0)`, filter: "brightness(1) drop-shadow(0 0 6px #ffd25a)" }],
        { duration: D(1000), easing: "cubic-bezier(.3,.9,.3,1)", fill: "forwards" }).then(() => {
          big.remove(); g.style.opacity = "";
          anim(g, [{ transform: "translateY(-14px) scale(1.08)" }, { transform: "none" }], { duration: 260, easing: "cubic-bezier(.3,1.6,.5,1)" });
          glow(g, "#ffd25a"); sfx.drop();
        });
    }, D(640));
  }

  // ---------------------------------------------------------------- drag & drop
  // The held card follows the pointer every frame with a little swing, like a real card in the hand.
  // Board slots are computed from the row geometry (no DOM reads while dragging), and minions make
  // room with a GPU transform, so nothing reflows until the drop.
  let drag = null;
  // (drop areas are measured from the zones at the start of each drag: see updateTarget)
  const TOKEN_W = 108, ROW_GAP = 14;

  // Right-click is the fast lane: tavern -> buy, hand -> play (on the right), warband -> sell.
  function quickAction(el, zone) {
    if (busy || drag || aiming) return;
    audio.unlock(); hideTip();
    const uid = +el.dataset.uid, d = el._d, idx = (arr) => arr.findIndex((m) => m.uid === uid);
    const r = rectOf(el);
    if (zone === "shop") { if (act(() => (d && d.isSpell ? game.buySpell(you) : game.buy(you, idx(you.shop))), { ghostRect: r, uid, buy: !(d && d.isSpell) })) { sfx.coin(); momentAt("buy", $("#hand").lastElementChild); } }
    else if (zone === "hand") {
      if (d && d.isSpell && d.target) { toast(`Drag ${d.name} onto one of your minions.`); sfx.error(); return; }
      if (act(() => (d && d.isSpell ? game.cast(you, idx(you.hand)) : game.play(you, idx(you.hand))), { ghostRect: r, uid, land: d && d.isSpell ? null : uid, big: !!(d && (d.golden || d.tier >= 5)) })) { if (d && d.isSpell) castFx(null, r); }
    } else if (zone === "board") {
      const g = el.cloneNode(true); g.classList.add("ghost"); g.style.cssText = `position:absolute;left:0;top:0;margin:0;transform:translate3d(${r.x}px,${r.y}px,0)`; $("#drag").appendChild(g);
      goldDelay = S(330) + 480;
      if (act(() => game.sell(you, idx(you.board)), { ghostRect: r, uid: -1 })) { sfx.coin(); momentAt("sell", $("#keeper")); sellFlight(g, r); } else g.remove();
    }
  }
  function bindDrag(el, zone) {
    bindTilt(el, zone === "hand" ? 9 : 11);
    el.addEventListener("contextmenu", (e) => { e.preventDefault(); if (el._pt !== "touch") quickAction(el, zone); }); // a long touch is not a right-click
    el.addEventListener("pointerdown", (e) => {
      el._pt = e.pointerType;
      if (aiming) { e.preventDefault(); if (zone === "board") firePower(you.board.findIndex((m) => m.uid === +el.dataset.uid)); return; }
      if (drag) onCancel();            // a drag that never got its release: drop it
      if (busy || e.button > 0) return;
      e.preventDefault(); hideTip(); audio.unlock();
      const p = toStage(e.clientX, e.clientY), r = rectOf(el);
      drag = { el, zone, uid: +el.dataset.uid, pid: e.pointerId, start: p, p, off: { x: p.x - r.x, y: p.y - r.y }, w: r.w, h: r.h,
        moved: false, ghost: null, target: null, index: -2, prev: p, ang: 0, angV: 0, tiltY: 0, lift: 1, t: performance.now() };
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    });
  }

  function onMove(e) {
    if (!drag) return;
    if (e.buttons === 0 && e.pointerType === "mouse") { onUp(); return; } // released outside the frame
    const p = toStage(e.clientX, e.clientY);
    drag.p = p;
    if (!drag.moved) {
      if (Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < 4) return;
      startDrag();
    }
    if (drag.ghost) placeGhost(); // move right away; the frame loop only adds the swing
  }
  function renderSellZone() {
    const v = Math.max(0, WA.SELL + ((you.mods && you.mods.sell) || 0));
    $("#sellZone").innerHTML = `<div class="sz-in"><div class="sz-coin">+${v}</div><div><b>Sell</b><span>Drop anywhere up here for ${v} gold</span></div></div>`;
  }
  function startDrag() {
    drag.moved = true;
    if (drag.zone === "board") renderSellZone();
    const g = drag.el.cloneNode(true);
    g.classList.remove("lifted", "drag-hidden"); g.classList.add("ghost");
    g.style.cssText = `margin:0;--rot:0deg;--ty:0px;transform-origin:${drag.off.x}px ${Math.min(drag.off.y, drag.h * 0.35)}px`;
    if (drag.zone === "board") { const v = Math.max(0, WA.SELL + ((you.mods && you.mods.sell) || 0)); g.insertAdjacentHTML("beforeend", `<i class="sell-tag">+${v}</i>`); }
    $("#drag").appendChild(g);
    drag.ghost = g;
    stage.classList.add("dragging");
    // the board model: row centre and the minions that may need to make room
    const board = $("#board");
    const br = rectOf(board); drag.rowX = br.cx; drag.boardX = br.x + (board.clientLeft || 0); drag.boardY = br.y + (board.clientTop || 0);
    drag.items = [...board.children].filter((c) => c.dataset.uid && !c.classList.contains("ph"));
    drag.aim = drag.zone === "hand" && drag.el._d && drag.el._d.isSpell && drag.el._d.target;
    if (drag.aim) { const r = rectOf(drag.el); drag.aimFrom = { x: r.cx, y: r.y + 26 }; drag.el.classList.add("aim-src"); g.classList.add("aim-ghost"); }
    else if (drag.zone === "board") { drag.el.classList.add("drag-hidden"); stage.classList.add("drag-board"); }
    else if (drag.zone === "hand") { drag.el.style.display = "none"; layoutHand([...$("#hand").children].filter((c) => c.dataset.uid && c !== drag.el)); }
    else drag.el.classList.add("lifted");
    drag.others = drag.items.filter((c) => c !== drag.el);
    // the row as it really stands (tokens can be zoomed, gaps vary with the table): measured, not assumed
    // measured flat: the hover tilt and zoom of the minion under the pointer must not count
    for (const c of drag.items) { c._tr = c.style.transition; c.style.transition = "none"; c.style.rotate = ""; c.style.scale = "1"; c.classList.remove("tilting"); }
    void board.offsetWidth;
    const rs = drag.items.map((c) => rectOf(c)), cxs = rs.map((r) => r.cx);
    for (const c of drag.items) { c.style.scale = ""; const tr = c._tr || ""; requestAnimationFrame(() => { c.style.transition = tr; }); }
    const med = (l) => l.slice().sort((x, y) => x - y)[Math.floor(l.length / 2)];
    drag.tw = rs.length ? med(rs.map((r) => r.w)) : TOKEN_W * 0.9; drag.th = rs.length ? med(rs.map((r) => r.h)) : 124; drag.ty = rs.length ? med(rs.map((r) => r.y)) : br.cy - drag.th / 2;
    drag.pitch = cxs.length >= 2 ? (cxs[cxs.length - 1] - cxs[0]) / (cxs.length - 1) : drag.tw + ROW_GAP * 0.85;
    if (cxs.length) drag.rowX = (cxs[0] + cxs[cxs.length - 1]) / 2;
    drag.zoom = drag.items[0] ? parseFloat(getComputedStyle(drag.items[0]).zoom) || 1 : 1;
    drag.natural = new Map(drag.items.map((c, j) => [c, cxs[j]]));
    drag.spellRects = drag.others.map((c) => ({ c, r: rectOf(c) }));
    sfx.pick();
    placeGhost();
    drag.raf = requestAnimationFrame(dragFrame);
  }
  const slotX = (k, j) => drag.rowX + (j - (k - 1) / 2) * drag.pitch;
  function placeGhost() {
    const p = drag.p;
    drag.ghost.style.transform = `translate3d(${(p.x - drag.off.x).toFixed(1)}px, ${(p.y - drag.off.y).toFixed(1)}px, 0) perspective(700px) rotateX(${drag.tiltY.toFixed(1)}deg) rotate(${drag.ang.toFixed(2)}deg) scale(${drag.lift.toFixed(3)})`;
  }
  // Frame loop: spring swing from horizontal speed, a slight lean from vertical speed, the pick-up lift.
  function dragFrame(now) {
    if (!drag || !drag.ghost) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - drag.t) / 1000)); drag.t = now;
    const vx = (drag.p.x - drag.prev.x) / dt, vy = (drag.p.y - drag.prev.y) / dt; drag.prev = drag.p;
    const target = Math.max(-22, Math.min(22, vx * 0.022));
    drag.angV += ((target - drag.ang) * 170 - drag.angV * 17) * dt;
    drag.ang += drag.angV * dt;
    drag.tiltY += (Math.max(-14, Math.min(14, -vy * 0.012)) - drag.tiltY) * Math.min(1, dt * 14);
    drag.lift += ((drag.el.classList.contains("card") ? 1.1 : 1.08) - drag.lift) * Math.min(1, dt * 18);
    placeGhost();
    updateTarget(drag.p);
    drag.raf = requestAnimationFrame(dragFrame);
  }

  function minionAt(p) {
    for (const { c, r } of drag.spellRects) if (p.x >= r.x - 8 && p.x <= r.x + r.w + 8 && p.y >= r.y - 8 && p.y <= r.y + r.h + 8) return c;
    return null;
  }
  function updateTarget(p) {
    let target = null;
    const z = drag.zone;
    const port = (z === "hand" || z === "board") && overPortal(p);
    $("#portal").classList.toggle("hot", !!port);
    if (port) {
      drag.target = "portal";
      if (drag.spellEl) { drag.spellEl.classList.remove("spell-target"); drag.spellEl = null; }
      setZones(false, false); makeRoom(-1);
      return;
    }
    const isSpell = drag.el._d && drag.el._d.isSpell;
    // the zones are measured where they are (the table can be rearranged)
    const ZN = drag.zones || (drag.zones = { shop: rectOf($("#shopZone")), board: rectOf($("#boardZone")), hand: rectOf($("#hand")), left: rectOf($("#players")), sell: rectOf($("#sellZone")) });
    const inR = (r, pad) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
    const SB = ZN.shop.y + ZN.shop.h, BB = ZN.board.y + ZN.board.h;
    if (isSpell) {
      let st = null;
      if (z === "shop") { if (!inR(ZN.shop, 6) && (p.y > SB || inR(ZN.board, 20) || inR(ZN.hand, 30))) target = "hand"; }
      else if (drag.el._d.target) {
        st = minionAt(p); if (st) target = "spell";
        if (drag.aim) { const r = st ? rectOf(st) : null; aimShow(drag.aimFrom, r ? { x: r.cx, y: r.cy } : p, !!st); }
      }
      else if (inR(ZN.board, 30) || inR(ZN.shop, 30) || p.y < BB + 10 && !inR(ZN.hand, 10)) target = "cast";
      if (st !== drag.spellEl) { if (drag.spellEl) drag.spellEl.classList.remove("spell-target"); if (st) st.classList.add("spell-target"); drag.spellEl = st; }
      drag.spellTarget = st ? +st.dataset.uid : null;
      setZones(target === "hand" || target === "cast", false);
      drag.target = target;
      return;
    }
    if (z === "shop") {
      if (!inR(ZN.shop, 6) && (p.y > SB || inR(ZN.board, 20) || inR(ZN.hand, 30))) target = "hand"; // the tavern only sells to your hand; the board is played from there
    } else if (z === "hand") {
      if ((inR(ZN.board, 40) || inR(ZN.shop, 10)) && you.board.length < BOARD_MAX) target = "board";
    } else if (z === "board") {
      if (inR(ZN.sell, 0) && !inR(ZN.board, 0)) target = "sell"; // the sell zone can be moved and stretched in the Table workshop
      else if (inR(ZN.board, 60) && !inR(ZN.hand, 0)) target = "board";
      else if ((inR(ZN.hand, 30) || p.y >= BB + 60) && game.canReflux && !game.canReflux(you, you.board.findIndex((m) => String(m.uid) === drag.el.dataset.uid))) target = "reflux";
    }
    drag.target = target;
    setZones(target === "board" || (z === "shop" && target === "hand"), target === "sell");
    $("#hand").classList.toggle("drop-ebb", target === "reflux");
    makeRoom(target === "board" ? slotIndexAt(p.x) : -1);
  }
  let zonesState = "";
  function setZones(ok, sell) {
    const k = (ok ? 1 : 0) + (sell ? 2 : 0) + "";
    if (k === zonesState) return;
    zonesState = k;
    $("#boardZone").classList.toggle("drop-ok", ok);
    $("#shopZone").classList.toggle("drop-sell", sell);
    $("#sellZone").classList.toggle("hot", sell);
    if (drag && drag.ghost) drag.ghost.classList.toggle("selling", !!sell);
  }
  // which gap the pointer is over, in a row that will hold one more minion (or the same number when moving)
  function slotIndexAt(x) {
    const m = drag.others.length, k = m + 1;
    let best = 0, bd = 1e9;
    for (let j = 0; j < k; j++) { const d = Math.abs(x - slotX(k, j)); if (d < bd) { bd = d; best = j; } }
    // a little stickiness: the slot only changes once the pointer is clearly past the middle, so it doesn't flicker
    if (drag.index >= 0 && drag.index < k && best !== drag.index && Math.abs(x - slotX(k, drag.index)) - bd < drag.pitch * 0.18) best = drag.index;
    return best;
  }
  // slide the other minions into place; i = -1 closes the gap
  function makeRoom(i) {
    if (!drag || drag.index === i) return;
    drag.index = i;
    const m = drag.others.length, k = i >= 0 ? m + 1 : m;
    drag.others.forEach((c, o) => {
      const want = slotX(k, i >= 0 && o >= i ? o + 1 : o);
      c.style.transform = `translateX(${((want - drag.natural.get(c)) / drag.zoom).toFixed(1)}px)`;
      c._room = true;
    });
    const board = $("#board");
    let glow = board.querySelector(".slot-glow");
    if (i >= 0) {
      const place = (g) => { g.style.left = (slotX(k, i) - drag.tw / 2 - drag.boardX).toFixed(1) + "px"; g.style.top = (drag.ty - drag.boardY).toFixed(1) + "px"; g.style.width = drag.tw.toFixed(1) + "px"; g.style.height = drag.th.toFixed(1) + "px"; };
      if (!glow) { glow = document.createElement("div"); glow.className = "slot-glow"; board.appendChild(glow); place(glow); requestAnimationFrame(() => glow && glow.classList.add("on")); }
      place(glow);
      board.querySelectorAll(".empty-hint").forEach((x) => (x.style.visibility = "hidden"));
    } else {
      if (glow) glow.remove();
      board.querySelectorAll(".empty-hint").forEach((x) => (x.style.visibility = ""));
    }
  }
  function clearRoom(animated) {
    for (const c of $("#board").children) {
      if (!c._room) continue;
      if (!animated) { c.style.transition = "none"; requestAnimationFrame(() => (c.style.transition = "")); }
      c.style.transform = ""; c._room = false;
    }
    $("#board").querySelectorAll(".slot-glow").forEach((x) => x.remove());
    $("#board").querySelectorAll(".empty-hint").forEach((x) => (x.style.visibility = ""));
  }

  function endDrag() {
    if (drag && drag.raf) cancelAnimationFrame(drag.raf);
    tipQuiet = performance.now() + 650; quietAt.x = ptrNow.x; quietAt.y = ptrNow.y; clearTimeout(tipTimer);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    if (drag && drag.spellEl) drag.spellEl.classList.remove("spell-target");
    zonesState = ""; $("#hand").classList.remove("drop-ebb"); $("#boardZone").classList.remove("drop-ok"); $("#shopZone").classList.remove("drop-sell"); $("#portal").classList.remove("hot");
    stage.classList.remove("dragging", "drag-board"); $("#sellZone").classList.remove("hot"); aimHide();
    if (drag && drag.aim) drag.el.classList.remove("aim-src");
    const d = drag; drag = null;
    return d;
  }
  // put the dragged element back where it was
  function restoreSource(d) {
    d.el.classList.remove("lifted", "drag-hidden");
    if (d.el.style.display === "none") { d.el.style.display = ""; layoutHand([...$("#hand").children].filter((c) => c.dataset.uid)); }
  }

  function onCancel() {
    const d = endDrag();
    if (!d) return;
    clearRoom(true);
    if (d.ghost) snapBack(d); else restoreSource(d);
  }

  function onUp() {
    const d = endDrag();
    if (!d) return;
    try { d.el.releasePointerCapture(d.pid); } catch (err) {}
    if (!d.el.isConnected && d.ghost) { d.ghost.remove(); clearRoom(false); return; }
    if (!d.moved) { onTap(d); return; }
    const ghostRect = rectOf(d.ghost);
    const ghostHTML = d.el.outerHTML;
    const uidKey = String(d.uid);
    const idx = (arr) => arr.findIndex((m) => m.uid === d.uid);
    let ok = false;
    const opts = { uid: d.uid, ghostRect, ghostHTML };
    const isSpell = d.el._d && d.el._d.isSpell;
    if (d.target === "portal") {
      const list = d.zone === "board" ? you.board : you.hand, name = d.el._d ? d.el._d.name : "it";
      const mate = game.mateOf(you);
      ok = act(() => game.pass(you, d.zone, idx(list)), opts);
      if (ok) { sendFx(d.ghost); d.ghost = null; toast(`Sent ${name} to ${mate.name}.`); }
    } else if (isSpell && d.zone === "shop" && d.target === "hand") {
      ok = act(() => game.buySpell(you), opts); if (ok) sfx.coin();
    } else if (isSpell && d.zone === "hand" && (d.target === "spell" || d.target === "cast")) {
      const ti = d.target === "spell" ? you.board.findIndex((m) => m.uid === d.spellTarget) : -1;
      const tEl = d.target === "spell" ? document.querySelector(`#board [data-uid="${d.spellTarget}"]`) : null;
      ok = act(() => game.cast(you, idx(you.hand), ti), opts);
      if (ok) { castFx(d.ghost, ghostRect, tEl); d.ghost = null; }
    } else if (isSpell) {
      ok = false;
    } else if (d.target === "board" && d.zone === "shop") {
      ok = act(() => {
        const e = game.buy(you, idx(you.shop)); if (e) return e;
        const hi = idx(you.hand);
        if (hi >= 0 && !game.lastTriple.length) return game.play(you, hi, d.index);
        return "";
      }, opts);
      if (ok) sfx.coin();
    } else if (d.target === "hand" && d.zone === "shop") {
      ok = act(() => game.buy(you, idx(you.shop)), Object.assign({ buy: true }, opts)); if (ok) { sfx.coin(); momentAt("buy", $("#hand").lastElementChild); }
    } else if (d.target === "board" && d.zone === "hand") {
      ok = act(() => game.play(you, idx(you.hand), d.index), Object.assign({ land: d.uid, big: !!(d.el._d && (d.el._d.golden || d.el._d.tier >= 5)) }, opts));
    } else if (d.target === "reflux" && d.zone === "board") {
      ok = act(() => game.reflux(you, idx(you.board)), opts); if (ok) sfx.whoosh();
    } else if (d.target === "board" && d.zone === "board") {
      const from = idx(you.board);
      d.el.classList.remove("drag-hidden");
      ok = act(() => game.move(you, from, d.index), opts);
    } else if (d.target === "sell") {
      const r = ghostRect;
      goldDelay = S(330) + 480;
      ok = act(() => game.sell(you, idx(you.board)), opts);
      if (ok) {
        sfx.coin(); momentAt("sell", $("#keeper"));
        sayQuip("sell");
        const g = d.ghost; d.ghost = null; sellFlight(g, r);
      }
    }
    if (d.ghost) {
      if (ok) { d.ghost.remove(); if (d.target !== "sell" && !(d.target === "board" && d.zone === "hand")) sfx.drop(); clearRoom(false); }
      else { clearRoom(true); snapBack(d); return; }
    }
    if (d.el.isConnected) { d.el.classList.remove("lifted", "drag-hidden"); d.el.style.display = ""; }
  }

  // a refused drop flies back home
  function snapBack(d) {
    const g = d.ghost;
    restoreSource(d);
    d.el.classList.add("drag-hidden");
    const r = rectOf(d.el);
    const rot = d.el.classList.contains("card") ? getComputedStyle(d.el).getPropertyValue("--rot") || "0deg" : "0deg";
    anim(g, [{ transform: g.style.transform }, { transform: `translate3d(${r.x}px, ${r.y}px, 0) rotate(${rot}) scale(1)` }], { duration: S(200), easing: "cubic-bezier(.2,.8,.2,1)" })
      .then(() => { g.remove(); d.el.classList.remove("drag-hidden"); });
  }

  // Tap / click: shop -> buy, hand -> play on the right, board -> show details.
  // which keyword a buff label stands for (labels are shown in the current language)
  function kwOfLabel(label) { if (!label) return ""; if (/^Effects \+|^Effets \+/.test(label)) return "empower"; for (const k of KW_LIST) if (KW_NAMES[k] === label) return k; return label === "Rally" || label === "Ralliement" ? "rally" : ""; }
  function kwMoment(el, label, color) {
    if (!window.WA_FXE || !el) return false;
    const r = rectOf(el), kw = kwOfLabel(label);
    window.WA_FXE.impact("keyword", { x: r.cx, y: r.cy }, { kw: kw || "stats", color });
    return true;
  }
  // A card arriving on the board has weight: it squashes on landing, kicks up dust, nudges its neighbours.
  function landFx(uid, big) {
    const el = document.querySelector(`#board [data-uid="${uid}"]`); if (!el) return;
    setTimeout(() => {
      if (!el.isConnected) return;
      const r = rectOf(el);
      const L = lookOf(el._d), own = lookSound(el._d, "play");
      if (L && L.enter && enterFx(el, L)) { if (!own) sfx.thud(); return; }
      el.style.transformOrigin = "50% 100%";
      anim(el, [{ transform: "scale(1.06, 0.78)" }, { transform: "scale(0.94, 1.1)", offset: .45 }, { transform: "scale(1.02, 0.97)", offset: .75 }, { transform: "none" }], { duration: S(360), easing: "ease-out" }).then(() => (el.style.transformOrigin = ""));
      if (window.WA_FXE) window.WA_FXE.impact("land", { x: r.cx, y: r.cy }, { h: r.h, big });
      shakeStage(big ? 5 : 3); if (!own) sfx.thud();
      const sib = [el.previousElementSibling, el.nextElementSibling];
      sib.forEach((s, i) => { if (s && s.dataset.uid) anim(s, [{ transform: "none" }, { transform: `translateX(${i ? 9 : -9}px) rotate(${i ? 3 : -3}deg)`, offset: .3 }, { transform: "none" }], { duration: S(380), easing: "cubic-bezier(.2,.8,.2,1)" }); });
    }, S(300));
  }
  // A spell: the card dives into its target (or bursts in place), then the arcane hit.
  function castFx(ghost, r, targetEl) {
    sfx.spell(); sayQuip("spell");
    const color = "#c8a8ff";
    if (targetEl && targetEl.isConnected) {
      const t = rectOf(targetEl);
      const fly = ghost ? anim(ghost, [{ transform: ghost.style.transform, opacity: 1 }, { transform: `translate3d(${t.cx - 62}px, ${t.cy - 98}px, 0) scale(.25) rotate(18deg)`, opacity: 0.2 }], { duration: S(260), easing: "cubic-bezier(.5,0,1,.6)" }).then(() => ghost.remove()) : Promise.resolve();
      if (window.WA_FXE) window.WA_FXE.trail({ x: r.cx, y: r.cy }, { x: t.cx, y: t.cy }, color, 9);
      fly.then(() => { if (window.WA_FXE) window.WA_FXE.impact("spellhit", { x: t.cx, y: t.cy }, { color }); else { ring(t.cx, t.cy, color, 6); burst(t.cx, t.cy, 22, [color, "#ffffff"], 90); } glow(targetEl, color); anim(targetEl, [{ transform: "none" }, { transform: "scale(1.18)", offset: .3 }, { transform: "none" }], { duration: S(380), easing: "ease-out" }); sfx.ping(); });
    } else {
      if (window.WA_FXE) window.WA_FXE.impact("spellcast", { x: r.cx, y: r.cy }, { color }); else { ring(r.cx, r.cy, "#9fdcff", 6); burst(r.cx, r.cy, 22, ["#9fdcff", "#ffffff", "#c8a8ff"], 90); }
      if (ghost) anim(ghost, [{ transform: ghost.style.transform, opacity: 1 }, { transform: ghost.style.transform + " translateY(-40px) scale(1.25)", opacity: 0 }], { duration: S(320), easing: "ease-out" }).then(() => ghost.remove());
    }
  }
  // Activate: the little button, or a click anywhere on the minion
  function activateEl(e) {
    audio.unlock(); hideTip();
    const i = you.board.findIndex((m) => m.uid === +e.dataset.uid), r = rectOf(e);
    if (act(() => game.activate(you, i), { ghostRect: r, uid: -1 })) { sfx.ping(); ring(r.cx, r.cy, "#ffe08a", 6); const ne = document.querySelector(`#board [data-uid="${e.dataset.uid}"]`) || e; anim(ne, [{ transform: "none" }, { transform: "translateY(-10px) scale(1.08)", offset: .35 }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(.3,1.6,.5,1)" }); return true; }
    return false;
  }
  function onTap(d) {
    d.el.classList.remove("lifted"); d.el.style.display = "";
    const idx = (arr) => arr.findIndex((m) => m.uid === d.uid);
    const sp = d.el._d && d.el._d.isSpell;
    if (sp && d.zone === "shop") { if (act(() => game.buySpell(you))) sfx.coin(); return; }
    if (sp && d.zone === "hand") {
      if (d.el._d.target) { toast(`Drag ${d.el._d.name} onto one of your minions.`); return; }
      const r = rectOf(d.el);
      if (act(() => game.cast(you, idx(you.hand)), { ghostRect: r, uid: d.uid })) castFx(null, r);
      return;
    }
    if (d.zone === "shop") { if (act(() => game.buy(you, idx(you.shop)), { buy: true })) { sfx.coin(); momentAt("buy", $("#hand").lastElementChild); } }
    else if (d.zone === "hand") { act(() => game.play(you, idx(you.hand)), { land: d.uid, big: !!(d.el._d && (d.el._d.golden || d.el._d.tier >= 5)) }); }
    else if (d.zone === "board" && d.el.classList.contains("can-act")) activateEl(d.el);
    else showTip(d.el);
  }

  // ---------------------------------------------------------------- tavern buttons
  let rolls = 0;
  function onRoll() {
    if (busy) return;
    audio.unlock();
    const olds = [...$("#shop").children].filter((c) => c.dataset.uid).map((c) => ({ r: rectOf(c), html: c.outerHTML }));
    if (!act(() => game.roll(you))) return;
    sfx.roll();
    rolls++;
    sayQuip("roll");
    anim($("#btnRoll svg"), [{ transform: "rotate(0)" }, { transform: "rotate(360deg)" }], { duration: 500, easing: "ease-out" });
    for (const o of olds) {
      const h = document.createElement("div"); h.innerHTML = o.html;
      const e = h.firstElementChild; e.style.cssText = `position:absolute;left:${o.r.x}px;top:${o.r.y}px;margin:0`;
      fxLayer().appendChild(e);
      anim(e, [{ transform: "none", opacity: 1 }, { transform: "translateY(-60px) scale(.6) rotate(-12deg)", opacity: 0 }], { duration: 260, easing: "ease-in" }).then(() => e.remove());
    }
    dropInShop(160);
  }
  function dropInShop(delay = 0) {
    [...$("#shop").children].filter((c) => c.dataset.uid).forEach((c, i) => {
      anim(c, [{ transform: "translateY(-90px) scale(.7)", opacity: 0 }, { transform: "translateY(8px) scale(1.04)", opacity: 1, offset: .7 }, { transform: "none", opacity: 1 }],
        { duration: S(420), delay: S(delay) + i * S(70), easing: "ease-out", fill: "backwards" });
    });
  }
  function onFreeze() {
    if (busy) return;
    audio.unlock();
    act(() => game.toggleFreeze(you));
    if (you.frozen) {
      sfx.freeze();
      const r = rectOf($("#shop"));
      for (let i = 0; i < 14; i++) burst(r.x + 200 + Math.random() * (r.w - 400), r.cy + (Math.random() - .5) * 100, 2, ["#dff3ff", "#9fdcff"], 40);
    }
  }
  function onUpgrade() {
    if (busy) return;
    audio.unlock();
    if (!act(() => game.upgrade(you))) return;
    sfx.upgrade(); momentAt("upgrade", $("#keeper"));
    const k = rectOf($("#keeper"));
    ring(k.cx, k.cy, "#ffd25a", 8); burst(k.cx, k.cy, 30, ["#ffd25a", "#fff3b0", "#ff8a3a"], 120);
    anim($("#keeper"), [{ transform: "scale(1)" }, { transform: "scale(1.18)", offset: .4 }, { transform: "scale(1)" }], { duration: 500, easing: "ease-out" });
    sayQuip(you.tier === MAX_TIER ? "tier6" : "upgrade");
    toast(`Tavern Tier ${you.tier}: stronger minions now appear.`);
  }

  // ---------------------------------------------------------------- modals
  function modal(html) { const m = $("#modal"); m.innerHTML = `<div class="mbox">${html}</div>`; m.hidden = false; anim(m.firstElementChild, [{ transform: "scale(.85)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 260, easing: "ease-out" }); return m; }
  function heroCard(id) {
    const h = window.WA.HEROES[id], pic = heroPic(id);
    const el = document.createElement("button");
    el.className = "hero-pick"; el.type = "button";
    el.innerHTML = `<div class="hp-portrait"${pic ? ` style="background-image:url('${pic}')"` : ""}>${pic ? "" : `<span>${h.name[0]}</span>`}</div>
      <div class="hp-hname">${escH(h.name)}</div><div class="hp-life">${h.health} Health</div>
      <div class="hp-box"><b>${escH(h.power.name)}</b><small>${h.power.type === "active" ? `${h.power.cost} gold · once per turn` : "Passive"}</small><p>${escH(window.WA.heroPowerText(id))}</p></div>`;
    return el;
  }
  function chooseHero() {
    const m = modal(`<h2>Choose your hero</h2><p>Each hero has its own Health and hero power.</p>${game.anomaly ? `<div class="anom-line"></div>` : ""}<div class="hero-choices"></div>`);
    if (game.anomaly) m.querySelector(".anom-line").appendChild(anomalyCard(game.anomaly.id));
    const box = m.querySelector(".hero-choices");
    for (const id of you.heroChoices) {
      const c = heroCard(id);
      c.addEventListener("click", () => { game.confirmHero(you, id); closeModal(); sfx.upgrade(); startTurnUI(); });
      box.appendChild(c);
    }
  }
  function closeModal() { $("#modal").hidden = true; $("#modal").innerHTML = ""; }

  // Evolve with a choice: the next form is picked from the options, like a Discover
  function showEvolveChoice() {
    const q = you.evolveChoices || []; if (!q.length || !$("#modal").hidden) return;
    const c = q[0], m = you.board.find((x) => x.uid === c.uid); if (!m) { game.chooseEvolve(you, 0); return; }
    busy = true; renderTop(); renderGold();
    const mut = c.kind === "mut";
    const md = modal(mut ? `<h2>${escH(m.name)} mutates</h2><p>Pick a mutation. It keeps it for good.</p><div class="choices muts"></div>` : `<h2>${escH(m.name)} evolves</h2><p>Pick its next form. It keeps what it gained.</p><div class="choices"></div>`);
    const box = md.querySelector(".choices");
    c.options.forEach((id, i) => {
      const card = mut ? mutCard(id, m.golden) : makeCard(shownMinion(id, m.golden).dict());
      card.addEventListener("click", () => {
        closeModal(); busy = false; game.lastEffects = []; game.lastTriple = [];
        const cap = captureAll();
        game.chooseEvolve(you, i);
        renderTavern(); playEffects(game.lastEffects || [], cap);
        if (game.lastTriple.length) animateTriple(game.lastTriple, captureAll());
        sfx.drop();
        if ((you.evolveChoices || []).length) setTimeout(showEvolveChoice, 500);
      });
      box.appendChild(card);
      anim(card, [{ transform: "scale(1.25) rotateY(90deg)", opacity: 0 }, { transform: "scale(1.25) rotateY(0)", opacity: 1 }], { duration: 420, delay: 120 + i * 120, easing: "ease-out", fill: "backwards" });
    });
  }
  // a mutation offered by an Evolve: name, stats, keyword and extra effect
  function mutCard(o, golden) {
    const d = o && o.lib ? (WA.MUT_LIB.find((x) => x.id === o.lib) || {}) : o || {}, k = golden ? 2 : 1, fr = WA.getLang && WA.getLang() === "fr";
    const el = document.createElement("div"); el.className = "mut-card" + (golden ? " golden" : "");
    const a = (d.a || 0) * k, h = (d.h || 0) * k;
    el.innerHTML = `<i class="evo-mini" style="--p:1"><i class="ev0"></i><i class="ev1"></i></i><b class="mut-name">${escH(fr && d.fr ? d.fr : d.name || "Mutation")}</b>
      ${a || h ? `<div class="mut-stats"><span class="a">+${a}</span><span class="h">+${h}</span></div>` : ""}${d.kw ? `<div class="mut-kw">${escH(T(KW_NAMES[d.kw] || d.kw))}</div>` : ""}${d.grant ? `<p>${escH(WA.abilityText(d.grant, false))}</p>` : ""}`;
    return el;
  }
  function showDiscover() {
    if (!you.discover.length || !$("#modal").hidden) return;
    busy = true; renderTop(); renderGold();
    const gold = !!you.discoverGolden, more = (you.discoverQ || []).length;
    const m = modal(`<h2>${gold ? T("Discover a golden minion") : "Discover a minion"}</h2><p>Pick one to add to your hand.${more ? ` <b class="disc-more">+${more} ${T("more to come")}</b>` : ""}</p><div class="choices"></div>`);
    const box = m.querySelector(".choices");
    const back = (STY().frames || {}).back;
    you.discover.forEach((id, i) => {
      const d = shownMinion(id, gold).dict();
      const c = makeCard(d);
      if (back) { const f = document.createElement("i"); f.className = "card-back-face"; c.appendChild(f); setTimeout(() => { if (!c.isConnected) return; anim(c, [{ scale: "1 1" }, { scale: "0 1" }], { duration: 160, easing: "ease-in" }).then(() => { f.remove(); return anim(c, [{ scale: "0 1" }, { scale: "1 1" }], { duration: 180, easing: "ease-out" }); }); }, 350 + i * 220); }
      c.addEventListener("click", () => {
        const r = rectOf(c);
        closeModal(); busy = false;
        game.lastTriple = [];
        game.chooseDiscover(you, i);
        const created = renderTavern();
        const nu = you.hand[you.hand.length - 1];
        const ne = nu && document.querySelector(`#hand [data-uid="${nu.uid}"]`);
        if (ne) { const n = rectOf(ne); ne.style.transformOrigin = "0 0"; anim(ne, [{ translate: `${r.x - n.x}px ${r.y - n.y}px`, scale: "1.25" }, { translate: "0px 0px", scale: "1" }], { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" }); }
        if (game.lastTriple.length) animateTriple(game.lastTriple, captureAll());
        sfx.drop();
        if (you.discover.length) setTimeout(showDiscover, game.lastTriple.length ? 1700 : 480); // the next Discover of the same effect
      });
      box.appendChild(c);
      anim(c, [{ transform: "scale(1.25) rotateY(90deg)", opacity: 0 }, { transform: "scale(1.25) rotateY(0)", opacity: 1 }], { duration: 420, delay: 120 + i * 120, easing: "ease-out", fill: "backwards" });
    });
  }

  function rankBadge(mmr) {
    const r = rankOf(mmr);
    return `<span class="rank r${r.index}"><b>${r.name}</b> ${mmr.toLocaleString("en-US")}</span>`;
  }
  function renderRankChip() { $("#rankChip").innerHTML = rankBadge(profile.mmr); }
  function tribeChips(list) { return list.map((t) => `<span class="tchip" data-tribe="${escH(t)}">${tribeIcon(t)}${escH(TN(t))}</span>`).join(""); }

  // Card sets ("metas") the player built in the editor; the lobby is dealt from the chosen one.
  function metaPicker() {
    const st = window.WA_STORE;
    if (!st || st.metas.length < 2) return "";
    return `<label class="meta-pick">Meta <select id="metaSelect">${st.metas.map((x) => `<option value="${x.id}"${x.id === st.active ? " selected" : ""}>${x.name.replace(/</g, "&lt;")}</option>`).join("")}</select></label>`;
  }
  // Collection: the skin library, equipped per meta (cards, tokens, End Turn button, table, bartender)
  const COLL_KINDS = [["card", "Cards", "the built-in frame"], ["token", "Tokens", "the built-in frame"], ["endturn", "End Turn button", "the built-in button"], ["table", "Table", "the default table"], ["bartender", "Bartender", "the default mug"]];
  const slotsCount = (st) => { const td = st && st.tableDesign; return td && td.slots ? td.slots.length : 0; };
  function showCollection() {
    const st = window.WA_STORE, eq = (st && st.equipped) || {};
    const thumb = (e) => e.kind === "bartender" ? `<span class="coll-pic round" style="background-image:url('${e.src}')"></span>` : e.kind === "table" ? `<span class="coll-pic wide" style="background-image:url('${e.src}')"></span>` : `<span class="coll-pic k-${e.kind}" style="background-image:url('${e.normal}')"></span>`;
    const tile = (kind, id, label, inner) => { const on = (eq[kind] || "") === id; return `<button type="button" class="coll-tile${on ? " on" : ""}" data-coll-kind="${kind}" data-coll-id="${escH(id)}" aria-pressed="${on}">${inner}<b>${escH(label)}</b>${on ? `<i>Equipped</i>` : ""}</button>`; };
    const rows = COLL_KINDS.map(([kind, label, builtin]) => { const list = st ? st.skinList(kind) : [];
      return `<section class="coll-row"><h3>${label} <small>${list.length ? `${list.length} skin${list.length > 1 ? "s" : ""}` : "no skins yet"}</small></h3><div class="coll-grid">
        ${tile(kind, "", "Built-in", `<span class="coll-pic builtin k-${kind}"${kind === "bartender" || kind === "table" ? "" : ` style="background-image:url('ui-art/${kind}-skin.png')"`}>${kind === "bartender" ? ARTMOD.INNKEEPER : kind === "table" ? "▦" : ""}</span>`)}
        ${list.map((e) => tile(kind, e.id, e.name || label, thumb(e))).join("")}
        ${kind === "bartender" && list.length > 1 ? tile(kind, "random", "Random each game", `<span class="coll-pic builtin rnd">?</span>`) : ""}
      </div></section>`; }).join("");
    // the boards: the plain table, or one of the tables an admin offered in the Table workshop
    const offered = st && st.tables ? st.tables.filter((x) => x.offered) : [], pickId = st && st.tablePick ? st.tablePick : "";
    const boardPic = (x) => { const p = (x.props || []).find((q) => q.img); return p ? `<span class="coll-pic wide board" style="background-image:url('${propUrl(p)}')"></span>` : `<span class="coll-pic builtin wide">▦</span>`; };
    const boardTile = (id, name, pic, sub) => `<button type="button" class="coll-tile${pickId === id ? " on" : ""}" data-board="${escH(id)}" aria-pressed="${pickId === id}">${pic}<b>${escH(name)}</b>${sub ? `<small>${sub}</small>` : ""}${pickId === id ? `<i>${T("Chosen")}</i>` : ""}</button>`;
    const boards = `<section class="coll-row coll-boards"><h3>${T("Boards")} <small>${offered.length + 1} ${T("boards to pick")}</small>${slotsCount(st) ? "" : `<button type="button" class="pill small" id="btnBoardPeek">👁 ${T("See the table")}</button>`}</h3><div class="coll-grid">
      ${boardTile("", T("Classic table"), `<span class="coll-pic builtin wide">▦</span>`, "")}
      ${offered.map((x) => boardTile(x.id, x.name, boardPic(x), `${(x.props || []).length} sprite${(x.props || []).length > 1 ? "s" : ""} · ${(x.slots || []).length} ▢`)).join("")}
      </div>${offered.length ? "" : `<p class="coll-hint">${T("No other board yet: an admin creates them in the Table workshop.")}</p>`}</section>`;
    // the table's placeholders: each one takes an object the player owns
    const td = st && st.tableDesign, slots = (td && td.slots) || [], objs = (td && td.objects) || [], dec = decorOf();
    const objUrl = (o) => propUrl(o);
    const decor = slots.length ? `<section class="coll-row coll-decor"><h3>${T("Table decor")} <small>${slots.length} ${T("placeholders")} · ${objs.length} ${T("objects")}</small><button type="button" class="pill small" id="btnDecorPeek">👁 ${T("See the table")}</button></h3>
      ${slots.map((sl) => `<div class="decor-slot" data-slot="${escH(sl.id)}"><b>▢ ${escH(sl.name || "")}</b><div class="coll-grid">
        <button type="button" class="coll-tile small${!dec[sl.id] ? " on" : ""}" data-decor="${escH(sl.id)}" data-obj=""><span class="coll-pic builtin">∅</span><b>${T("Empty")}</b></button>
        ${objs.map((o) => `<button type="button" class="coll-tile small${dec[sl.id] === o.id ? " on" : ""}" data-decor="${escH(sl.id)}" data-obj="${escH(o.id)}"><span class="coll-pic obj" style="background-image:url('${objUrl(o)}')"></span><b>${escH(o.name || "")}</b></button>`).join("")}
      </div></div>`).join("")}${objs.length ? "" : `<p class="coll-hint">${T("No objects yet: an admin adds them in the Table workshop.")}</p>`}</section>` : "";
    const m = modal(`<h2 class="menu-title">Collection</h2>
      <p class="coll-hint">Skins for <b>${escH(st ? st.meta.name : "this meta")}</b>${st && st.metas.length > 1 ? " — change the meta on the main menu to dress another one" : ""}. Paint new ones in the card editor, under <b>Skins</b>.</p>
      <div class="coll-body">${boards}${decor}${rows}</div>
      <div class="intro-actions"><button class="pill big" id="btnCollBack">Back</button></div>`);
    m.firstElementChild.classList.add("coll-modal");
    m.querySelector("#btnCollBack").addEventListener("click", () => { closeModal(); showIntro(); });
    m.querySelectorAll("[data-decor]").forEach((b) => b.addEventListener("click", () => {
      setDecor(b.dataset.decor, b.dataset.obj || "");
      m.querySelectorAll(`[data-decor="${b.dataset.decor}"]`).forEach((x) => x.classList.toggle("on", x === b));
      audio.unlock(); sfx.drop();
    }));
    m.querySelectorAll("[data-board]").forEach((b) => b.addEventListener("click", async () => {
      if (!st || !st.pickTable) return; await st.pickTable(b.dataset.board || ""); applyTableDesign(); audio.unlock(); sfx.coin();
      const sc = m.querySelector(".coll-body") ? m.querySelector(".coll-body").scrollTop : 0; closeModal(); showCollection();
      const nb = document.querySelector(".coll-body"); if (nb) nb.scrollTop = sc;
    }));
    for (const peek of m.querySelectorAll("#btnDecorPeek, #btnBoardPeek")) peek.addEventListener("click", () => {
      closeModal(); stage.classList.add("decorating");
      const back = document.createElement("button"); back.className = "pill big decor-back"; back.textContent = T("Back to the Collection"); stage.appendChild(back);
      back.addEventListener("click", () => { back.remove(); stage.classList.remove("decorating"); showCollection(); });
    });
    m.querySelectorAll("[data-coll-kind]").forEach((b) => b.addEventListener("click", async () => {
      if (!st) return; const kind = b.dataset.collKind, id = b.dataset.collId || null;
      await st.equipSkin(kind, id); applySkins();
      m.querySelectorAll(`[data-coll-kind="${kind}"]`).forEach((x) => { const on = (x.dataset.collId || "") === (id || ""); x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); const i = x.querySelector("i"); if (on && !i) x.insertAdjacentHTML("beforeend", "<i>Equipped</i>"); else if (!on && i) i.remove(); });
      audio.unlock(); sfx.coin();
    }));
  }
  function showIntro() {
    if (window.WA_AMB && window.WA_AMB.setPhase) window.WA_AMB.setPhase("menu");
    const r = rankOf(profile.mmr), st = window.WA_STORE;
    const hist = (profile.history || []).slice(0, 8);
    const ICON = { friend: '<svg viewBox="0 0 24 24"><path d="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3.3 2.7-6 6-6s6 2.7 6 6v1H2v-1zm13 1v-1c0-1.9-.7-3.6-1.8-4.9A4.5 4.5 0 0 1 22 19v2h-7z"/></svg>', collection: '<svg viewBox="0 0 24 24"><path d="M4 3h9l3 3v15H4V3zm2 2v14h8V7h-2V5H6zm12-1h2v16h-2V4z"/></svg>', editor: '<svg viewBox="0 0 24 24"><path d="M3 17.3V21h3.7L17.8 9.9l-3.7-3.7L3 17.3zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.7 3.7L20.7 7z"/></svg>', how: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-1-5h2v2h-2v-2zm2.6-3.4c-.6.5-.6.8-.6 1.4h-2c0-1.2.3-1.9 1.2-2.6.6-.5 1-.8 1-1.4 0-.7-.5-1-1.2-1-.8 0-1.3.5-1.4 1.3H8.5C8.6 7.5 10 6 12.1 6c2 0 3.4 1.2 3.4 3 0 1.2-.6 1.9-1.9 2.6z"/></svg>', lang: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 9h-2.6a15 15 0 0 0-1.2-5.1A8 8 0 0 1 18.9 11zM12 4c.9 1.2 1.9 3.5 2.2 7H9.8C10.1 7.5 11.1 5.2 12 4zM4.3 13h2.6c.1 1.9.5 3.6 1.2 5.1A8 8 0 0 1 4.3 13zm2.6-2H4.3a8 8 0 0 1 4.6-5.1C8.2 7.4 7.8 9.1 7.7 11H6.9zM12 20c-.9-1.2-1.9-3.5-2.2-7h4.4c-.3 3.5-1.3 5.8-2.2 7zm3.1-1.9c.7-1.5 1.1-3.2 1.2-5.1h2.6a8 8 0 0 1-3.8 5.1z"/></svg>' };
    const rec = profile.games ? `${profile.games} ${profile.games > 1 ? "games" : "game"} · ${profile.wins} ${profile.wins > 1 ? "wins" : "win"} · top 4: ${profile.top4} · best: #${profile.best === Infinity || !profile.best ? "–" : profile.best}` : "No game played yet";
    const m = modal(`${SCR().embers === false ? "" : `<div class="mm-embers" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div>`}
      <header class="mm-title">${SCR().logo ? `<img class="mm-logo" src="${escH(SCR().logo)}" alt="">` : ""}<span class="mm-eyebrow">${SCR().eyebrow != null && SCR().eyebrow !== "" ? escH(SCR().eyebrow) : "◆ &nbsp; Tavern autobattler &nbsp; ◆"}</span>${SCR().hideTitle && SCR().logo ? "" : `<h2 class="menu-title">${escH(SCR().title || "Warband Arena")}</h2>`}<span class="mm-rule"><i></i><b>❖</b><i></i></span></header>
      <div class="mm-cols">
        <section class="mm-panel mm-play">
          <h3>Next game</h3>
          <div class="mm-row"><span class="mm-lab">Mode</span><div class="mode-pick" role="radiogroup">
            <button type="button" class="mode-btn${game.duo || game.coop ? "" : " on"}" data-duo="0" role="radio" aria-checked="${!(game.duo || game.coop)}">Solo</button>
            <button type="button" class="mode-btn duo${game.duo || game.coop ? " on" : ""}" data-duo="1" role="radio" aria-checked="${!!(game.duo || game.coop)}">Duo</button></div></div>
          <div class="mm-row"><span class="mm-lab">Rules</span><div class="mode-pick" role="radiogroup">
            <button type="button" class="mode-btn${game.anomaly ? "" : " on"}" data-mode="normal" role="radio" aria-checked="${!game.anomaly}">Normal</button>
            <button type="button" class="mode-btn${game.anomaly ? " on" : ""}" data-mode="anomaly" role="radio" aria-checked="${!!game.anomaly}"${window.WA.ANOMALY_LIST.length ? "" : ` disabled title="This meta has no anomalies. Make one in the card editor."`}>Anomalies</button></div></div>
          <div class="mm-row"><span class="mm-lab">Pace</span><div class="mode-pick" role="radiogroup" title="Damage cap per lost fight: how fast a game can end">
            ${[["normal", "Quick"], ["long", "Long"], ["epic", "Epic"]].map(([k, l]) => `<button type="button" class="mode-btn${(profile.pace || "normal") === k ? " on" : ""}" data-pace="${k}" role="radio" aria-checked="${(profile.pace || "normal") === k}">${l}</button>`).join("")}</div></div>
          <div class="mm-row"><span class="mm-lab">Options</span><div class="mm-opts"><label class="opt"><input type="checkbox" id="optTimer" ${profile.timer ? "checked" : ""}> Timer</label>${metaPicker()}</div></div>
          ${game.anomaly ? `<div class="menu-anom">✦ <b>${escH(game.anomaly.name)}</b> <span>${escH(window.WA.anomalyText(game.anomaly.id))}</span></div>` : ""}
          <div class="mm-tribes"><span class="mm-lab">Tribes</span><div class="tchips">${tribeChips(game.tribes)}</div></div>
          <div class="intro-actions"><button class="pill big mm-cta" id="btnStart"><span>Open the tavern</span></button></div>
        </section>
        <aside class="mm-panel mm-profile">
          <h3>${escH(profile.name || "Your record")}</h3>
          <div class="mm-rank"><div class="mm-rankring r${r.index}"><span>${r.index + 1}</span></div><div class="mm-rankinfo">${rankBadge(profile.mmr)}<div class="rank-bar"><i style="width:${Math.round(r.progress * 100)}%"></i></div><small>${r.next ? `${r.next - profile.mmr} MMR to ${r.nextName || "the next rank"}` : "Top rank"}</small></div></div>
          <div class="mm-stats">${rec}</div>
          ${hist.length ? `<div class="mm-hist"><span class="mm-lab">Last games</span>${hist.map((x) => `<b class="p${Math.min(x, 8)}">#${x}</b>`).join("")}</div>` : ""}
          <div class="mm-meta"><span class="mm-lab">Meta</span><b>${escH(st ? st.meta.name : "Classic")}</b><small>${st ? `${st.cards.filter((c) => !c.kind || c.kind === "minion").length} custom minions · ${(st.tribes || window.WA.TRIBES).length} tribes` : ""}</small></div>
        </aside>
      </div>
      <nav class="mm-tiles menu-links">
        <button class="mm-tile" id="btnFriend">${ICON.friend}<span>Play with a friend</span></button>
        <button class="mm-tile" id="btnCollection">${ICON.collection}<span>Collection</span></button>
        <button class="mm-tile quiet" id="btnHow">${ICON.how}<span>How to play</span></button>
        <button class="mm-tile quiet" id="btnLang" title="Language">${ICON.lang}<span>${window.WA_I18N && window.WA_I18N.lang === "fr" ? "English" : "Français"}</span></button>
        ${profile.admin ? `<button class="mm-tile quiet" id="btnPlayerMode">${ICON.friend}<span>${T("Player mode")}</span></button>` : `<button class="mm-tile quiet" id="btnAdmin">${ICON.editor}<span>${T("Admin mode")}</span></button>`}
      </nav>
      ${profile.admin ? `<section class="mm-admin"><h3><span class="adm-badge">ADMIN</span> ${T("Creation")}</h3><nav class="mm-tiles">
        <button class="mm-tile" id="btnEditor">${ICON.editor}<span>Card editor</span></button>
        <button class="mm-tile" id="btnSkins">${ICON.collection}<span>${T("Skins")}</span></button>
        <button class="mm-tile" id="btnTable">${ICON.collection}<span>${T("Table workshop")}</span></button>
        <button class="mm-tile" id="btnBuildTogether">${ICON.friend}<span>${T("Build together")}</span></button>
      </nav></section>` : ""}
      <div class="mm-version">v${window.WA.VERSION}</div>`);
    m.firstElementChild.classList.add("menu");
    m.querySelector("#btnFriend").addEventListener("click", () => { audio.unlock(); closeModal(); showOnlineLobby(); });
    m.querySelector("#btnHow").addEventListener("click", () => { closeModal(); showHowTo(); });
    m.querySelector("#btnCollection").addEventListener("click", () => { closeModal(); showCollection(); });
    const ms = m.querySelector("#metaSelect");
    if (ms) ms.addEventListener("change", async (e) => {
      await window.WA_STORE.setActive(e.target.value);
      for (const id of ["#shop", "#board", "#hand"]) $(id).innerHTML = "";
      newGame(); closeModal(); showIntro(); warmSprites();
    });
    m.querySelector("#optTimer").addEventListener("change", (e) => { profile.timer = e.target.checked; saveProfile(); });
    for (const b of m.querySelectorAll("[data-pace]")) b.addEventListener("click", () => { if (profile.pace === b.dataset.pace) return; profile.pace = b.dataset.pace; saveProfile(); game.pace = profile.pace; for (const x of m.querySelectorAll("[data-pace]")) { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); } });
    for (const b of m.querySelectorAll(".mode-btn")) b.addEventListener("click", () => {
      if (b.disabled) return;
      if (b.dataset.duo != null) { if ((b.dataset.duo === "1") === !!(game.duo || game.coop)) return; profile.duo = b.dataset.duo === "1"; }
      else { if ((b.dataset.mode === "anomaly") === !!game.anomaly) return; profile.mode = b.dataset.mode; }
      saveProfile();
      for (const id of ["#shop", "#board", "#hand"]) $(id).innerHTML = "";
      newGame(); closeModal(); showIntro();
    });
    m.querySelector("#btnStart").addEventListener("click", () => {
      const why = window.WA_STORE ? window.WA_STORE.playable() : "";
      if (why) { toast(why + " Add cards in the card editor."); sfx.error(); return; }
      audio.unlock(); closeModal();
      if (you.heroChoices && you.heroChoices.length > 1 && game.turn <= 1) chooseHero();
      else if (game.anomaly) showAnomaly(startTurnUI);
      else startTurnUI();
    });
    const on = (id, fn) => { const b = m.querySelector(id); if (b) b.addEventListener("click", fn); };
    on("#btnAdmin", () => { audio.unlock(); askEditorCode(() => { profile.admin = true; saveProfile(); showIntro(); }); });
    on("#btnPlayerMode", () => { profile.admin = false; saveProfile(); showIntro(); });
    on("#btnEditor", () => { audio.unlock(); closeModal(); openEditor(); });
    on("#btnSkins", () => { audio.unlock(); closeModal(); openEditor(); setTimeout(() => { const b = document.querySelector('[data-meta-act="skins"]'); if (b) b.click(); }, 60); });
    on("#btnBuildTogether", () => { audio.unlock(); profile.roomFor = "edit"; saveProfile(); closeModal(); showOnlineLobby(); });
    if (m.querySelector("#btnTable")) m.querySelector("#btnTable").addEventListener("click", () => { audio.unlock(); if (!window.WA_TABLE) return; closeModal(); window.WA_TABLE.open(() => showIntro()); });
    m.querySelector("#btnLang").addEventListener("click", () => window.WA_I18N.set(window.WA_I18N.lang === "fr" ? "en" : "fr"));
  }

  function showHowTo() {
    const m = modal(`<h2>How to play</h2>
      <div class="rules">
        <div><b>Drag down</b> a tavern minion to buy it for ${game.buyCost(you)} gold.</div>
        <div><b>Drag a card</b> from your hand onto the mat to play it.</div>
        <div><b>Drag up</b> one of your minions to sell it.</div>
        <div><b>Tavern spells</b> sit on the right of the shop. Drag them onto a minion.</div>
        <div><b>Three copies</b> merge into a golden minion with double stats.</div>
        <div><b>Fights</b> play out on their own: your leftmost minion attacks first.</div>
        <div><b>Top four</b> gains MMR, bottom four loses it. In Duo, top two.</div>
        <div><b>Duo:</b> the portal under your hero sends a card to your partner for ${WA.PASS_COST} gold; you share one Health pool.</div>
        <div><b>Fast lane:</b> right-click buys, plays or sells. Keys <kbd>1</kbd>–<kbd>7</kbd> buy, <kbd>R</kbd> refresh, <kbd>F</kbd> freeze, <kbd>U</kbd> upgrade, <kbd>H</kbd> hero power, <kbd>Space</kbd> ends the turn, <kbd>Esc</kbd> cancels a drag.</div>
        <div><b>Rivals</b> get sharper as your rating climbs. Lobby average: ${game.lobbyAvg.toLocaleString("en-US")} MMR.</div>
      </div>
      <div class="intro-actions"><button class="pill big" id="btnHowBack">Back</button></div>`);
    m.querySelector("#btnHowBack").addEventListener("click", () => { closeModal(); showIntro(); });
  }
  // The asset editor sits above the table; afterwards everything is redrawn with the new art.
  // The editor is only reachable before a game starts, so closing it deals a fresh game with the saved cards.
  function openEditor() {
    window.WA_EDITOR.open(() => {
      coopStop();
      for (const id of ["#shop", "#board", "#hand"]) $(id).innerHTML = "";
      newGame();
      showIntro();
      warmSprites();
    }, { makeCard, makeToken, anomalyCard });
  }

  // ---------------------------------------------------------------- in-game menu: resume, concede, quit
  const inGame = () => !!(game && you && you.alive && !game.isOver());
  function showGameMenu() {
    if (!inGame() || !$("#modal").hidden || stage.classList.contains("decorating")) return;
    const fight = busy;
    const m = modal(`<h2 class="menu-title">Game menu</h2>
      <div class="game-menu">
        <button class="pill big" id="gmResume">Resume</button>
        <button class="pill big danger" id="gmConcede"${fight ? " disabled" : ""}>Concede</button>
        <button class="pill" id="gmQuit"${fight ? " disabled" : ""}>Quit to the main menu</button>
      </div>
      <p class="game-menu-hint">${fight ? "Wait for the end of the fight to concede." : online ? "Conceding ends the game for your duo, for your friend too." : "Conceding ends the game at your current place."}</p>`);
    m.querySelector("#gmResume").addEventListener("click", closeModal);
    m.querySelector("#gmConcede").addEventListener("click", () => { if (busy) return; closeModal(); concede(false); });
    m.querySelector("#gmQuit").addEventListener("click", () => { if (busy) return; closeModal(); concede(true); });
  }
  // the player (or the duo) leaves now: placed last among those still standing, rated like any other finish
  function concedeMark() {
    const alive = game.duo ? game.teams.filter((t) => t.alive).length : game.alive().length;
    if (game.duo) { const t = game.teamOf(you); t.alive = false; t.placement = alive; for (const p of t.members) { p.alive = false; p.placement = alive; } }
    else { you.alive = false; you.placement = alive; }
  }
  function concede(quit) {
    if (!inGame()) return;
    if (online) netSend({ t: "concede" });
    concedeMark(); stopTimer(); hideTip();
    showGameOver(false);
    if (quit) { const b = $("#btnAgain"); if (b) b.click(); }
  }
  // the friend conceded for the duo: the game ends here too (once any fight on screen is over)
  function friendConceded() {
    if (!inGame()) return;
    const name = online ? online.friendName : "Your friend";
    const fin = () => { if (busy) { setTimeout(fin, 250); return; } if (!inGame()) return; concedeMark(); stopTimer(); showGameOver(false); toast(`${name} conceded the game.`); };
    fin();
  }
  function showGameOver(won) {
    busy = true; const wasOnline = !!online || guestPlayed;
    stopTimer();
    sfx.tavern();
    const place = you.placement || 1;
    const before = profile.mmr;
    // a duo finishes 1st to 4th: rated like 1st, 3rd, 6th and 8th of a solo lobby
    const delta = mmrDelta(game.duo ? [1, 3, 6, 8][place - 1] || 8 : place, before, game.lobbyAvg);
    const after = Math.max(0, before + delta);
    const rb = rankOf(before), ra = rankOf(after);
    profile.mmr = after; profile.games++; profile.best = Math.min(profile.best, place);
    if (place === 1) profile.wins++; if (place <= 4) profile.top4++;
    profile.history = [place, ...(profile.history || [])].slice(0, 10);
    saveProfile();
    const mateName = game.duo ? game.mateOf(you).name : "";
    const m = modal((game.duo ? `<h2>${won ? "Champions of the Arena" : `Your duo placed #${place}`}</h2>
      <p>${won ? `You and ${escH(mateName)} outlasted three other duos.` : place <= 2 ? `A top-two finish with ${escH(mateName)}.` : "The tavern will be open again in a moment."} You lasted ${game.turn} turns.</p>`
      : `${SCR().endImg ? `<img class="end-img" src="${escH(SCR().endImg)}" alt="">` : ""}<h2>${won ? escH(SCR().winTitle || "") || "Champion of the Arena" : place <= 4 ? (SCR().topTitle ? escH(SCR().topTitle.replace(/\{n\}/g, place)) : `You placed #${place}`) : (SCR().loseTitle ? escH(SCR().loseTitle.replace(/\{n\}/g, place)) : `Knocked out at #${place}`)}</h2>
      <p>${won ? (SCR().winText ? escH(SCR().winText) : "Seven rivals fell before your warband.") : place <= 4 ? (SCR().topText ? escH(SCR().topText) : "A top-four finish. The tavern salutes you.") : (SCR().loseText ? escH(SCR().loseText) : "The tavern will be open again in a moment.")} You lasted ${game.turn} turns.</p>`) + `
      <div class="mmr-box">
        <div class="mmr-delta ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "+" : ""}<span id="mmrDelta">0</span> MMR</div>
        <div class="lobby-rank"><span class="rank r${ra.index}"><b>${ra.name}</b> <span id="mmrNow">${before.toLocaleString("en-US")}</span></span>
          <div class="rank-bar"><i id="mmrBar" style="width:${Math.round(rb.progress * 100)}%"></i></div>
          ${ra.index !== rb.index ? `<small class="${ra.index > rb.index ? "promo" : "demo"}">${ra.index > rb.index ? "Promoted to " : "Dropped to "}${ra.name}</small>` : `<small>Last games: ${profile.history.map((x) => "#" + x).join(" ")}</small>`}</div>
      </div>
      ${sharedMeta && !sharedMeta.kept ? `<button class="pill" id="btnKeepMeta2">💾 Keep the meta of ${escH(sharedMeta.from)}</button>` : ""}
      <button class="pill big" id="btnAgain">Play again</button>`);
    const km = m.querySelector("#btnKeepMeta2"); if (km) km.addEventListener("click", async () => { km.disabled = true; await keepSharedMeta(); km.textContent = "✓ Kept"; });
    (async () => {
      for (let k = 1; k <= 30; k++) {
        await realWait(28);
        const v = Math.round(delta * k / 30);
        const n = $("#mmrDelta"); if (!n) return;
        n.textContent = Math.abs(v);
        $("#mmrNow").textContent = (before + v).toLocaleString("en-US");
      }
      const bar = $("#mmrBar"); if (bar) bar.style.width = Math.round(ra.progress * 100) + "%";
      if (ra.index > rb.index) { const r = rectOf($("#mmrBar")); burst(r.cx, r.cy, 30, ["#ffd25a", "#fff3b0", "#7ff06a"], 120); sfx.triple(); }
      renderRankChip();
    })();
    m.querySelector("#btnAgain").addEventListener("click", async () => { if (online) { netSend({ t: "bye" }); try { online.link.close(); } catch (e) {} online = null; } if (wasOnline) await ownMetaBack(); closeModal(); newGame(); showIntro(); });
  }

  // ---------------------------------------------------------------- turn timer
  // The bar shrinks with a CSS animation (runs on the compositor); a 4 Hz
  // interval only updates the seconds label and fires the timeout.
  let timerId = 0, timerEnd = 0, timerTotal = 0;
  function startTimer() {
    stopTimer();
    const rope = $("#rope");
    if (!profile.timer) { rope.hidden = true; return; }
    timerTotal = Math.min(45 + game.turn * 5, 90) * 1000 + (online && online.role === "guest" ? 2500 : 0);
    timerEnd = performance.now() + timerTotal;
    rope.hidden = false;
    rope.classList.remove("burning");
    const bar = rope.querySelector("i"), label = rope.querySelector("span");
    bar.style.animation = "none";
    void bar.offsetWidth;
    bar.style.animation = `ropeRun ${timerTotal}ms linear forwards`;
    let lastSec = -1;
    const tick = () => {
      const left = timerEnd - performance.now();
      const sec = Math.ceil(Math.max(0, left) / 1000);
      if (sec !== lastSec) { label.textContent = sec + "s"; lastSec = sec; }
      if (left < 15000 && !rope.classList.contains("burning")) rope.classList.add("burning");
      if (left <= 0) {
        stopTimer();
        if (drag) onCancel();
        if (!$("#modal").hidden && you.discover.length) closeModal();
        busy = false;
        toast("Time's up!");
        endTurn();
      }
    };
    tick();
    timerId = setInterval(tick, 250);
  }
  function stopTimer() { clearInterval(timerId); timerId = 0; }

  // ---------------------------------------------------------------- turn flow
  // the meta's table picture, if it has one
  // ================================================================ table design: moved / resized elements and clickable sprites
  // Elements move with the CSS `translate` / `scale` properties, so their own transforms and animations stay untouched.
  const TABLE_EL = [
    ["players", "#players", "Players panel", "Panneau des joueurs"], ["keeper", "#keeperWrap", "Bartender", "Tavernier"], ["upgrade", "#btnUpgrade", "Upgrade", "Améliorer"],
    ["roll", "#btnRoll", "Refresh", "Rafraîchir"], ["freeze", "#btnFreeze", "Freeze", "Geler"], ["shop", "#shopZone", "Tavern row", "Rangée de la taverne"],
    ["board", "#boardZone", "Your warband", "Votre troupe"], ["hero", "#myhero", "Your hero", "Votre héros"], ["power", "#heroPower", "Hero power", "Pouvoir héroïque"],
    ["gold", "#gold", "Gold", "Or"], ["hand", "#hand", "Hand", "Main"], ["end", "#btnEnd", "End turn", "Fin du tour"], ["ehero", "#ehero", "Enemy hero (fights)", "Héros ennemi (combats)"],
    ["rank", "#rankChip", "Rank", "Rang"], ["sound", "#btnSound", "Sound button", "Bouton du son"],
    ["aff1", "#affSlot1", "Affinity slot 1", "Emplacement d'affinité 1"], ["aff2", "#affSlot2", "Affinity slot 2", "Emplacement d'affinité 2"], ["pressure", "#pressureGauge", "Pressure gauge (Steam)", "Jauge de Pression (Vapeur)"],
    ["portal", "#portal", "Duo portal (send a card to your partner)", "Portail du duo (envoyer une carte au partenaire)"],
    ["sell", "#sellZone", "Sell zone (drop a minion there to sell it)", "Zone de revente (on y lâche un serviteur pour le vendre)"],
  ];
  const PROP_URLS = new Map();
  function propUrl(pr) {
    if (!pr || !pr.img) return "";
    if (typeof pr.img === "string") return pr.img;
    let u = PROP_URLS.get(pr.img); if (!u) { u = URL.createObjectURL(pr.img); PROP_URLS.set(pr.img, u); }
    return u;
  }
  let tableEditing = false;
  function applyTableDesign(design) {
    const d = design !== undefined ? design : window.WA_STORE ? window.WA_STORE.tableDesign : null;
    const L = (d && d.layout) || {};
    for (const [k, sel] of TABLE_EL) {
      const el = $(sel); if (!el) continue; const o = L[k];
      el.style.translate = o && (o.dx || o.dy) ? `${o.dx || 0}px ${o.dy || 0}px` : "";
      if (k === "sell") { el.style.width = o && o.w ? o.w + "px" : ""; el.style.height = o && o.h ? o.h + "px" : ""; } // the sell zone is stretched, not scaled
      else el.style.scale = o && o.s && o.s !== 1 ? String(o.s) : "";
      el.classList.toggle("td-hidden", !!(o && o.hide));
      if (k === "aff1" || k === "aff2") { const fr = o && o.frame && o.frame !== "steam" ? o.frame : "shell"; if (el.dataset.frame !== fr) { el.dataset.frame = fr; el._key = null; } }
    }
    if (you && game) renderAff();
    // placeholders: filled with the objects the player picked in the Collection
    const decor = decorOf(), objs = new Map(((d && d.objects) || []).map((o) => [o.id, o]));
    const filled = ((d && d.slots) || []).map((sl) => { const o = objs.get(decor[sl.id]); return o ? Object.assign({}, o, { id: "slot:" + sl.id, slot: sl.id, x: sl.x, y: sl.y, w: sl.w, h: sl.h, rot: sl.rot || 0, layer: sl.layer || "back", z: sl.z || 0 }) : null; }).filter(Boolean);
    renderProps(((d && d.props) || []).concat(filled), (d && d.slots) || []);
    if (window.WA_AMB) { try { window.WA_AMB.apply((d && d.ambience) || null); } catch (e) { report(e); } }
  }
  function decorOf() { const st = window.WA_STORE, k = st ? st.active : "classic"; return ((profile.decor || {})[k]) || {}; }
  function setDecor(slotId, objId) { const st = window.WA_STORE, k = st ? st.active : "classic"; profile.decor = profile.decor || {}; const m = profile.decor[k] = profile.decor[k] || {}; if (objId) m[slotId] = objId; else delete m[slotId]; saveProfile(); applyTableDesign(); }
  function propLayer(which) {
    let box = $("#props-" + which); if (box) return box;
    box = document.createElement("div"); box.id = "props-" + which; box.className = "props-layer " + which;
    const root = $(".shake-root");
    if (which === "back") root.insertBefore(box, $(".candle") ? $(".candle").nextSibling : root.firstChild);
    else root.insertBefore(box, $("#sellZone"));
    return box;
  }
  function renderProps(props, slots = []) {
    const boxes = { back: propLayer("back"), front: propLayer("front") };
    for (const b of Object.values(boxes)) b.innerHTML = "";
    // empty placeholders only show while the table is being designed or decorated
    for (const sl of slots) {
      const e = document.createElement("div"); e.className = "slot-ph"; e.dataset.slot = sl.id;
      Object.assign(e.style, { left: sl.x + "px", top: sl.y + "px", width: sl.w + "px", height: sl.h + "px", rotate: (sl.rot || 0) + "deg" });
      e.innerHTML = `<span>${escH(sl.name || "")}</span>`;
      boxes[sl.layer === "front" ? "front" : "back"].appendChild(e);
    }
    for (const pr of props) {
      const w = document.createElement("div"); w.className = "prop"; w.dataset.id = pr.id;
      Object.assign(w.style, { left: (pr.x || 0) + "px", top: (pr.y || 0) + "px", width: (pr.w || 120) + "px", height: (pr.h || 120) + "px", rotate: (pr.rot || 0) + "deg", opacity: pr.opacity == null ? 1 : pr.opacity, zIndex: pr.z || 0 });
      w.style.setProperty("--pw", pr.power || 1); w.style.setProperty("--sp", pr.speed || 1);
      w.innerHTML = `<div class="prop-idle idle-${pr.idle || "none"}"><img class="prop-img${pr.flip ? " flip" : ""}" draggable="false" alt="" src="${propUrl(pr)}"></div>`;
      if (pr.react && pr.react !== "none" || pr.fx && pr.fx !== "none" || pr.sound && pr.sound !== "none") w.classList.add("clickable");
      w.addEventListener("pointerdown", (e) => { if (tableEditing && !window.WA_TABLE.testing) return; e.stopPropagation(); audio.unlock(); reactProp(pr, w); });
      boxes[pr.layer === "front" ? "front" : "back"].appendChild(w);
    }
  }
  const PROP_FX = { sparkle: ["✨", ["#fff3b0", "#ffd25a", "#ffffff"]], leaves: ["🍃"], smoke: ["", ["#9a94a8", "#6c6878", "#bdb7c8"]], coins: ["🪙"], hearts: ["❤️"], bubbles: ["🫧"], flames: ["🔥"], stars: ["⭐"], notes: ["🎵"], snow: ["❄️"], petals: ["🌸"], magic: ["", ["#b58cff", "#8fd3ff", "#ffffff"]] };
  const PROP_SOUND = { pop: () => sfx.pick(), drop: () => sfx.drop(), chime: () => sfx.ping(), coin: () => sfx.coin(), magic: () => sfx.buff(), whoosh: () => sfx.whoosh(), thud: () => sfx.thud(), bell: () => sfx.holy(), water: () => sfx.water(), fire: () => sfx.fire(), wood: () => sfx.stone() };
  function emojiBurst(x, y, ch, n, spread) {
    for (let i = 0; i < n; i++) {
      const p = fxEl("emoji-p", x, y, ch); const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, dist = spread * (0.5 + Math.random() * 0.8);
      anim(p, [{ transform: "translate(-50%,-50%) scale(.4)", opacity: 0 }, { transform: `translate(calc(-50% + ${Math.cos(a) * dist * 0.5}px), calc(-50% + ${Math.sin(a) * dist * 0.5}px)) scale(1.1)`, opacity: 1, offset: 0.35 }, { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist + 30}px)) scale(.8) rotate(${(Math.random() - 0.5) * 180}deg)`, opacity: 0 }],
        { duration: 700 + Math.random() * 500, easing: "cubic-bezier(.2,.8,.3,1)" }).then(() => p.remove());
    }
  }
  function reactProp(pr, w) {
    const img = w.querySelector(".prop-img"), P = pr.power || 1, ms = 700 / (pr.speed || 1);
    const R = {
      bounce: [{ transform: "none" }, { transform: `translateY(${-18 * P}px)`, offset: 0.3 }, { transform: "none", offset: 0.6 }, { transform: `translateY(${-6 * P}px)`, offset: 0.8 }, { transform: "none" }],
      jump: [{ transform: "none" }, { transform: `scale(${1 + 0.15 * P}, ${1 - 0.15 * P})`, offset: 0.12 }, { transform: `translateY(${-40 * P}px) scale(.95, 1.08)`, offset: 0.45 }, { transform: `scale(${1 + 0.12 * P}, ${1 - 0.12 * P})`, offset: 0.8 }, { transform: "none" }],
      shake: [{ transform: "none" }, ...[1, -1, 1, -1, 0.5, -0.5].map((s, i) => ({ transform: `translateX(${8 * P * s}px) rotate(${3 * P * s}deg)`, offset: (i + 1) / 7 })), { transform: "none" }],
      spin: [{ transform: "rotate(0)" }, { transform: `rotate(${360 * Math.max(1, Math.round(P))}deg)` }],
      swing: [{ transform: "rotate(0)" }, { transform: `rotate(${18 * P}deg)`, offset: 0.2 }, { transform: `rotate(${-14 * P}deg)`, offset: 0.45 }, { transform: `rotate(${9 * P}deg)`, offset: 0.65 }, { transform: `rotate(${-4 * P}deg)`, offset: 0.85 }, { transform: "rotate(0)" }],
      squash: [{ transform: "none" }, { transform: `scale(${1 + 0.22 * P}, ${1 - 0.22 * P})`, offset: 0.25 }, { transform: `scale(${1 - 0.1 * P}, ${1 + 0.12 * P})`, offset: 0.55 }, { transform: `scale(${1 + 0.04 * P}, ${1 - 0.04 * P})`, offset: 0.8 }, { transform: "none" }],
      pulse: [{ transform: "scale(1)", filter: "brightness(1)" }, { transform: `scale(${1 + 0.18 * P})`, filter: "brightness(1.5)", offset: 0.35 }, { transform: "scale(1)", filter: "brightness(1)" }],
      flip: [{ transform: "perspective(600px) rotateY(0)" }, { transform: "perspective(600px) rotateY(360deg)" }],
      wobble: [{ transform: "none" }, ...[1, -1, 0.6, -0.6, 0.3].map((s, i) => ({ transform: `skewX(${12 * P * s}deg)`, offset: (i + 1) / 6 })), { transform: "none" }],
      glow: [{ filter: "brightness(1) drop-shadow(0 0 0 transparent)" }, { filter: `brightness(${1 + 0.6 * P}) drop-shadow(0 0 ${18 * P}px #ffe08a)`, offset: 0.3 }, { filter: "brightness(1) drop-shadow(0 0 0 transparent)" }],
    }[pr.react];
    if (R && img) { img.style.transformOrigin = pr.react === "swing" ? "50% 0%" : pr.react === "jump" || pr.react === "squash" ? "50% 100%" : "50% 50%"; img.animate(R, { duration: pr.react === "spin" || pr.react === "flip" ? ms * 1.2 : ms, easing: "cubic-bezier(.3,1.3,.5,1)" }); }
    const r = rectOf(w), f = PROP_FX[pr.fx];
    if (f) { const n = Math.round(8 * (pr.power || 1)) + 4; if (f[0]) emojiBurst(r.cx, r.y + r.h * 0.35, f[0], Math.ceil(n * 0.6), 60 + 30 * P); if (f[1]) burst(r.cx, r.cy, n * 2, f[1], 60 + 30 * P); }
    const snd = PROP_SOUND[pr.sound]; if (snd) try { snd(); } catch (e) {}
  }

  function applyTableBg() {
    const st = window.WA_STORE, bg = st && st.tableBg, el = $(".table-bg");
    if (!el) return;
    if (bg && bg.src) {
      const d = Math.max(0, Math.min(0.9, bg.dim == null ? 0.35 : bg.dim));
      el.style.background = `linear-gradient(rgba(8,9,22,${d}), rgba(8,9,22,${d})), radial-gradient(ellipse 90% 80% at 56% 50%, transparent 45%, rgba(4,5,14,${(0.25 + d * 0.5).toFixed(2)})), center / cover no-repeat url("${bg.src}")`;
      stage.classList.add("has-bg");
    } else { el.style.background = ""; stage.classList.remove("has-bg"); }
    try { applyTableDesign(); } catch (e) { report(e); }
  }
  // read-only handle for automated tests
  window.__wa = { get game() { return game; }, get you() { return you; }, get sharedMeta() { return sharedMeta; }, render: () => renderTavern() };
  // the bartender's skin for this game (the meta can pick one, or a random one each game)
  function applyKeeper() {
    const st = window.WA_STORE, bt = st && st.bartender, art = $("#keeperArt"), k = $("#keeper");
    let skin = null;
    if (bt && bt.skins && bt.skins.length) {
      if (bt.active === "random") skin = bt.skins[Math.floor(Math.random() * bt.skins.length)];
      else skin = bt.skins.find((x) => x.id === bt.active) || null;
    }
    if (skin) { art.innerHTML = `<div class="keeper-skin" style="background-image:url('${skin.src}')" role="img" aria-label="${escH(skin.name || "Bartender")}"></div>`; k.classList.add("has-skin"); }
    else { art.innerHTML = ARTMOD.INNKEEPER; k.classList.remove("has-skin"); }
  }
  // A painted card skin: an image that maps onto the card box, plus a layout saying where (in the image's own
  // pixels) the picture, name, text, tribe line, gems and stars go. The game ships with one; the editor can replace it.
  const DEFAULT_CARD_SKIN = { normal: "ui-art/card-skin.png", golden: null, spell: null, w: 996, h: 1580,
    layout: { art: [134, 140, 734, 664], radius: 12, name: [178, 815, 648, 133], text: [150, 972, 698, 262], tribe: [315, 1311, 365, 60], atk: [145, 1360, 150], hp: [868, 1368, 150], tier: [112, 132, 130], stars: [330, 34, 335, 68], nameColor: "#2a1800", textColor: "#f0e6d2", tribeColor: "#cfe0ff" } };
  // the template's own layout (card box with an 8px bleed), for skins painted on it; values in template pixels (560 x 848)
  const TEMPLATE_LAYOUT = { art: [52, 52, 456, 448], radius: 40, name: [36, 448, 488, 104], text: [68, 560, 424, 152], tribe: [112, 752, 336, 40], atk: [60, 788, 136], hp: [500, 788, 136], tier: [60, 60, 104], stars: [168, 24, 224, 72], nameColor: "#f7e9c8", textColor: "#f0e6d2", tribeColor: "#d9a65a" };
  // Tokens (minions on the board / in the tavern, 108 x 138 with an 8px bleed -> template 496 x 616) and the End Turn button
  // (156 x 90 with an 8px bleed -> template 688 x 424). Zones in template pixels, 4 per table pixel.
  const TOKEN_TEMPLATE = { w: 496, h: 616, layout: { art: [68, 56, 360, 472], radius: 184, radiusBottom: 80, atk: [96, 516, 152], hp: [400, 516, 152], stars: [140, 0, 216, 52] } };
  const END_TEMPLATE = { w: 688, h: 424, layout: { label: [32, 32, 624, 360], labelColor: "#2a1800", labelSize: 108 } };
  // the painted token frame and End Turn button that ship with the game (measured on the PNGs in ui-art/)
  const DEFAULT_TOKEN_SKIN = { normal: "ui-art/token-skin.png", golden: null, w: 1125, h: 1398, layout: { art: [165, 150, 795, 1026], radius: 300, radiusBottom: 70, atk: [180, 1171, 176], hp: [944, 1171, 176], stars: [330, 40, 465, 88], gemFill: "#1b1310" } };
  const DEFAULT_END_SKIN = { normal: "ui-art/endturn-skin.png", w: 1554, h: 641, layout: { label: [174, 107, 1207, 421], labelColor: "#f3e6c8", labelSize: 180, size: [222, 82] } };
  window.WA_CARD_LAYOUTS = { DEFAULT: DEFAULT_CARD_SKIN, TEMPLATE: TEMPLATE_LAYOUT, TOKEN: TOKEN_TEMPLATE, END: END_TEMPLATE, TOKEN_DEFAULT: DEFAULT_TOKEN_SKIN, END_DEFAULT: DEFAULT_END_SKIN };
  // token gems painted apart (attack, health, a plate behind the stars), their numbers' size, colour and font
  function tokenGemCSS(sk) {
    const L = sk.layout || TOKEN_TEMPLATE.layout, k = (108 + 16) / (sk.w || TOKEN_TEMPLATE.w), n = (L.gemNum == null ? 100 : +L.gemNum) / 100, T = "#stage.tokenskin .mn:not(.spell-tok)";
    let c = "";
    for (const [key, z] of [["gemAtk", "atk"], ["gemHp", "hp"]]) if (sk[key] && L[z]) c += `${T} .mn-gem.${z} { background: url("${sk[key]}") center / contain no-repeat !important; border-radius: 0 !important; box-shadow: none !important; }\n`;
    if (sk.gemTier && L.stars) c += `${T} .mn-tier { background: url("${sk.gemTier}") center / 100% 100% no-repeat; }\n`;
    if (n !== 1) for (const z of ["atk", "hp"]) if (L[z]) c += `${T} .mn-gem.${z} { font-size: ${(L[z][2] * k * 0.72 * n).toFixed(2)}px; }\n`;
    if (L.numDy) c += `${T} .mn-gem > span { position: relative; translate: 0 ${(L.numDy * k).toFixed(2)}px; }\n`;
    if (L.numColor) c += `${T} .mn-gem:not(.buffed):not(.hurt) > span { color: ${L.numColor}; }\n`;
    if (L.numFont && window.WA_STYLE) c += `${T} .mn-gem, ${T} .mn-gem > span { font-family: ${window.WA_STYLE.fontStack(L.numFont)}; }\n`;
    return c;
  }
  function tokenCSS(sk) { return tokenCSSBase(sk) + "\n" + tokenGemCSS(sk) + (sk.layout && sk.layout.artBehind ? "\n#stage.tokenskin .mn:not(.spell-tok)::after { z-index: 1; } #stage.tokenskin .mn:not(.spell-tok) .mn-body { z-index: 0; border-radius: 0; } #stage.tokenskin .mn:not(.spell-tok) .mn-aura, #stage.tokenskin .mn:not(.spell-tok) .mn-gem, #stage.tokenskin .mn:not(.spell-tok) .mn-tier { z-index: 3; }" : ""); }
  function tokenCSSBase(sk) {
    const L = sk.layout || TOKEN_TEMPLATE.layout, B = 8, k = (108 + 2 * B) / (sk.w || TOKEN_TEMPLATE.w), kh = (138 + 2 * B) / ((sk.h || TOKEN_TEMPLATE.h) * k), f = (v) => (v * k).toFixed(2);
    const box = ([l, t, w, h]) => `left:${(l * k - B).toFixed(2)}px;top:${(t * k * kh - B).toFixed(2)}px;width:${f(w)}px;height:${f(h * kh)}px;right:auto;bottom:auto;`;
    const gem = ([cx, cy, d]) => `left:${((cx - d / 2) * k - B).toFixed(2)}px;top:${((cy - d / 2) * k * kh - B).toFixed(2)}px;width:${f(d)}px;height:${f(d)}px;right:auto;bottom:auto;margin:0;font-size:${f(d * 0.72)}px;`;
    const rt = f(L.radius || 0), rb = f(L.radiusBottom == null ? L.radius || 0 : L.radiusBottom);
    return `#stage.tokenskin .mn:not(.spell-tok) .mn-body { ${box(L.art)} border-radius: ${rt}px ${rt}px ${rb}px ${rb}px; }
#stage.tokenskin .mn:not(.spell-tok) .mn-aura { ${box([L.art[0] - 4 / k, L.art[1] - 4 / k, L.art[2] + 8 / k, L.art[3] + 8 / k])} border-radius: ${(+rt + 4).toFixed(1)}px ${(+rt + 4).toFixed(1)}px ${(+rb + 4).toFixed(1)}px ${(+rb + 4).toFixed(1)}px; }
#stage.tokenskin .mn:not(.spell-tok) .mn-gem { background: ${L.gemFill || "none"}; border-radius: 50%; box-shadow: none; }
#stage.tokenskin .mn:not(.spell-tok) .mn-gem.atk { ${gem(L.atk)} } #stage.tokenskin .mn:not(.spell-tok) .mn-gem.hp { ${gem(L.hp)} }
#stage.tokenskin .mn:not(.spell-tok) .mn-tier { ${box(L.stars)} transform: none; display: flex; justify-content: center; align-items: center; gap: 1px; }
#stage.tokenskin .mn:not(.spell-tok) .mn-tier .star { width: ${Math.min(14, L.stars[3] * k * kh * 1.05).toFixed(1)}px; height: ${Math.min(14, L.stars[3] * k * kh * 1.05).toFixed(1)}px; filter: drop-shadow(0 0 1px rgba(0,0,0,.9)) drop-shadow(0 1px 1px rgba(0,0,0,.6)); }`;
  }
  function endCSS(sk) {
    const L = sk.layout || END_TEMPLATE.layout, B = 8, [BW, BH] = L.size || [156, 90], k = (BW + 2 * B) / (sk.w || END_TEMPLATE.w), kh = (BH + 2 * B) / ((sk.h || END_TEMPLATE.h) * k);
    const [x, y, w, h] = L.label, pl = x * k - B, pt = y * k * kh - B;
    return `#stage.endturnskin .endturn { width: ${BW}px; height: ${BH}px; border-radius: ${(BH / 2).toFixed(0)}px; padding: ${pt.toFixed(1)}px ${(BW - pl - w * k).toFixed(1)}px ${(BH - pt - h * k * kh).toFixed(1)}px ${pl.toFixed(1)}px; color: ${L.labelColor || "#2a1800"}; font-size: ${((L.labelSize || 108) * k).toFixed(1)}px; ${h <= 0 ? "color: transparent; text-shadow: none;" : ""} }`;
  }
  function applySkin(kind, sk) {
    const on = !!sk;
    stage.classList.toggle(kind + "skin", on);
    stage.style.setProperty("--" + kind + "-skin", on ? `url("${sk.normal}")` : "none");
    if (kind === "token") stage.style.setProperty("--token-skin-golden", on ? `url("${sk.golden || sk.normal}")` : "none");
    let el = document.getElementById(kind + "SkinLayout");
    if (!el) { el = document.createElement("style"); el.id = kind + "SkinLayout"; document.body.appendChild(el); }
    el.textContent = on ? (kind === "token" ? tokenCSS(sk) : endCSS(sk)) : "";
  }
  function skinCSS(sk) {
    const L = sk.layout || TEMPLATE_LAYOUT, k = 124 / (sk.w || 560), kh = 196 / ((sk.h || 848) * k), f = (v) => (v * k).toFixed(2);
    const box = ([l, t, w, h]) => `left:${f(l)}px;top:${f(t * kh)}px;width:${f(w)}px;height:${f(h * kh)}px;right:auto;bottom:auto;`;
    const gem = ([cx, cy, d]) => `left:${f(cx - d / 2)}px;top:${f((cy - d / 2) * kh)}px;width:${f(d)}px;height:${f(d)}px;right:auto;bottom:auto;font-size:${f(d * 0.74)}px;`;
    return `#stage.cardskin .card-art, #stage.cardskin .card.spell .spell-art { ${box(L.art)} border-radius: ${f(L.radius || 0)}px; }
#stage.cardskin .card-name { ${box(L.name)} min-height: 0; max-height: none; padding: 0 4px; font-size: ${Math.min(12.5, L.name[3] * k * kh * 0.6).toFixed(1)}px; color: ${L.nameColor || "#f7e9c8"}; }
#stage.cardskin .card-text { ${box(L.text)} --ct: ${Math.min(11.5, L.text[3] * k * kh * 0.3).toFixed(1)}px; font-size: var(--ct); line-height: 1.15; color: ${L.textColor || "#f0e6d2"}; padding: 1px 3px; }
#stage.cardskin .card-text.t2 { font-size: calc(var(--ct) * .93); } #stage.cardskin .card-text.t3 { font-size: calc(var(--ct) * .86); } #stage.cardskin .card-text.t4 { font-size: calc(var(--ct) * .78); line-height: 1.1; } #stage.cardskin .card-text.t5 { font-size: calc(var(--ct) * .7); line-height: 1.08; }
#stage.cardskin .card-text > span { -webkit-line-clamp: 8; color: inherit; }${L.kwColor ? `\n#stage.cardskin .card-text b { color: ${L.kwColor}; }` : ""}
#stage.cardskin .card-tribe, #stage.cardskin .card.spell .spell-tag { ${box(L.tribe)} font-size: ${Math.min(9.5, L.tribe[3] * k * kh * 0.8).toFixed(1)}px; line-height: ${f(L.tribe[3] * kh)}px; color: ${L.tribeColor || "#d9a65a"}; display: flex; justify-content: center; align-items: center; overflow: hidden; }
#stage.cardskin .card .mn-gem { background: none; box-shadow: none; }
#stage.cardskin .card .mn-gem.atk { ${gem(L.atk)} } #stage.cardskin .card .mn-gem.hp { ${gem(L.hp)} }
#stage.cardskin .card .tier-gem, #stage.cardskin .card.spell .cost { ${gem(L.tier)} display: grid; place-items: center; }
#stage.cardskin .card .mn-tier { ${box(L.stars)} transform: none; padding: 0; margin: 0; background: none; box-shadow: none; display: flex; justify-content: center; align-items: center; gap: 1px; }
#stage.cardskin .card .mn-tier .star { width: ${Math.min(11, L.stars[3] * k * kh * 0.85).toFixed(1)}px; height: ${Math.min(11, L.stars[3] * k * kh * 0.85).toFixed(1)}px; }
${gemCSS(sk, L, f, kh)}
${L.artBehind ? "#stage.cardskin .card::after, #stage.cardskin .card.r-legendary::after { z-index: 2; } #stage.cardskin .card-art, #stage.cardskin .card.spell .spell-art { z-index: 1; border-radius: 0; }" : ""}
${artShapeCSS(sk, L, f)}${numColorCSS(L)}${fontCSS(L)}`;
  }
  // the shape of the picture window: a preset, or a mask (white / opaque = shown), so the illustration never spills out of the frame
  const ART_SHAPES = { rect: "", oval: "clip-path: ellipse(50% 50% at 50% 50%);", circle: "clip-path: circle(closest-side at 50% 50%);",
    arch: "border-radius: 50% 50% var(--rb, 0px) var(--rb, 0px) / 32% 32% var(--rb, 0px) var(--rb, 0px) !important;", hexagon: "clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);",
    octagon: "clip-path: polygon(29% 0, 71% 0, 100% 29%, 100% 71%, 71% 100%, 29% 100%, 0 71%, 0 29%);", shield: "clip-path: polygon(0 0, 100% 0, 100% 64%, 50% 100%, 0 64%);",
    diamond: "clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);", mask: "-webkit-mask: var(--art-mask) center / 100% 100% no-repeat; mask: var(--art-mask) center / 100% 100% no-repeat;" };
  window.WA_ART_SHAPES = ART_SHAPES;
  function artShapeCSS(sk, L, f) {
    const sh = L.artShape || "rect"; if (sh === "rect" || !ART_SHAPES[sh] || (sh === "mask" && !sk.artMask)) return "";
    return `#stage.cardskin .card-art, #stage.cardskin .card.spell .spell-art { overflow: hidden; --rb: ${f(L.radius || 0)}px; ${sh === "arch" ? "" : "border-radius: 0 !important;"} ${ART_SHAPES[sh]} }\n`;
  }
  // fonts of a card skin: name (and tribe line), card text, numbers
  function fontCSS(L) {
    const S = window.WA_STYLE; if (!S) return ""; let c = "";
    if (L.nameFont) c += `#stage.cardskin .card-name, #stage.cardskin .card-name svg.cv text, #stage.cardskin .card-tribe { font-family: ${S.fontStack(L.nameFont)}; }\n`;
    if (L.textFont) c += `#stage.cardskin .card-text, #stage.cardskin .card-text b { font-family: ${S.fontStack(L.textFont, true)}; }\n`;
    if (L.numFont) c += `#stage.cardskin .card .mn-gem, #stage.cardskin .card .mn-gem > span, #stage.cardskin .card .tier-gem, #stage.cardskin .card.spell .cost { font-family: ${S.fontStack(L.numFont)}; }\n`;
    return c;
  }
  // text colours: numbers on the gems (buffed / hurt keep their colours)
  function numColorCSS(L) {
    if (!L.numColor) return "";
    return `#stage.cardskin .card .mn-gem:not(.buffed):not(.hurt) > span, #stage.cardskin .card .tier-gem, #stage.cardskin .card.spell .cost { color: ${L.numColor}; }\n`;
  }
  // gems painted apart from the frame: each picture fills its gem zone, the number sits on it
  function gemCSS(sk, L, f, kh) {
    const n = (L.gemNum == null ? 100 : +L.gemNum) / 100, num = ([, , d]) => `font-size:${f(d * 0.74 * n)}px;`;
    let c = "";
    const one = (key, sel, z) => { if (!sk[key] || !L[z]) return; c += `#stage.cardskin ${sel} { background: var(--${key === "gemAtk" ? "gem-atk" : key === "gemHp" ? "gem-hp" : "gem-tier"}) center / contain no-repeat !important; border-radius: 0 !important; box-shadow: none !important; ${num(L[z])} }\n`; };
    one("gemAtk", ".card .mn-gem.atk", "atk"); one("gemHp", ".card .mn-gem.hp", "hp"); one("gemTier", ".card .tier-gem, #stage.cardskin .card.spell .cost", "tier");
    if (L.numDy) c += `#stage.cardskin .card .mn-gem > span, #stage.cardskin .card .tier-gem, #stage.cardskin .card.spell .cost { position: relative; translate: 0 ${(L.numDy * (124 / (sk.w || 560)) * kh).toFixed(2)}px; }\n`;
    return c;
  }
  // ---- curved text: the name (and the tribe line) follow an arc; amount in % of the plate height, + bends up, - bends down
  let curve = null; // { name, tribe, nw, nh, tw, th }
  const SVGNS = "http://www.w3.org/2000/svg";
  function curveOne(el, amt, W, H) {
    const txt = el.__cvSrc != null && el.querySelector(":scope > svg.cv") ? el.__cvSrc : el.textContent.replace(/\s+/g, " ").trim();
    el.__cvSrc = txt;
    const fs = parseFloat(getComputedStyle(el).fontSize) || Math.min(12.5, H * 0.6), s = (amt / 100) * H * 0.75, y0 = H / 2 + fs * 0.34 + s / 2, pad = 3;
    const id = "cv" + (curveOne.n = (curveOne.n || 0) + 1);
    const svg = document.createElementNS(SVGNS, "svg"); svg.setAttribute("class", "cv"); svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("aria-label", txt);
    const path = document.createElementNS(SVGNS, "path"); path.setAttribute("id", id); path.setAttribute("d", `M ${pad} ${y0.toFixed(2)} Q ${(W / 2).toFixed(2)} ${(y0 - 2 * s).toFixed(2)} ${(W - pad).toFixed(2)} ${y0.toFixed(2)}`); path.setAttribute("fill", "none");
    const text = document.createElementNS(SVGNS, "text"), tp = document.createElementNS(SVGNS, "textPath");
    tp.setAttribute("href", "#" + id); tp.setAttribute("startOffset", "50%"); tp.setAttribute("text-anchor", "middle"); tp.textContent = txt;
    text.appendChild(tp); svg.appendChild(path); svg.appendChild(text);
    el.textContent = ""; el.appendChild(svg); el.classList.add("curved"); el.__cvDone = txt;
    const room = Math.hypot(W / 2 - pad, s) * 2 * 0.96, fit = () => { try { const len = text.getComputedTextLength(); if (len > room) { text.setAttribute("textLength", room.toFixed(1)); text.setAttribute("lengthAdjust", "spacingAndGlyphs"); } } catch (e) {} };
    if (txt.length * fs * 0.56 > room) { text.setAttribute("textLength", room.toFixed(1)); text.setAttribute("lengthAdjust", "spacingAndGlyphs"); }
    requestAnimationFrame(() => { if (text.isConnected) { text.removeAttribute("textLength"); fit(); } });
  }
  function curveIn(rootEl) {
    if (!curve || !rootEl || !rootEl.querySelectorAll) return;
    const list = [];
    if (curve.name) { if (rootEl.matches && rootEl.matches(".card-name")) list.push([rootEl, "n"]); rootEl.querySelectorAll(".card-name").forEach((e) => list.push([e, "n"])); }
    if (curve.tribe) { const q = ".card-tribe > span:not(.t-all), .card.spell .spell-tag"; if (rootEl.matches && rootEl.matches(q)) list.push([rootEl, "t"]); rootEl.querySelectorAll(q).forEach((e) => list.push([e, "t"])); }
    for (const [e, k] of list) {
      if (!e.closest("#stage") || e.closest(".ce-ws")) continue;
      const svg = e.querySelector(":scope > svg.cv");
      if (svg && e.__cvDone === (svg.textContent || "").trim() && svg.getAttribute("data-k") === curve.key) continue;
      if (svg) e.__cvSrc = (svg.textContent || "").trim();
      k === "n" ? curveOne(e, curve.name, curve.nw, curve.nh) : curveOne(e, curve.tribe, curve.tw, curve.th);
      const s2 = e.querySelector(":scope > svg.cv"); if (s2) s2.setAttribute("data-k", curve.key);
    }
  }
  let curveObs = null;
  function setCurve(sk) {
    const L = sk.layout || TEMPLATE_LAYOUT, k = 124 / (sk.w || 560), kh = 196 / ((sk.h || 848) * k);
    const nc = +L.nameCurve || 0, tc = +L.tribeCurve || 0;
    const prev = curve;
    curve = nc || tc ? { name: nc, tribe: tc, nw: +(L.name[2] * k).toFixed(2), nh: +(L.name[3] * k * kh).toFixed(2), tw: +(L.tribe[2] * k).toFixed(2), th: +(L.tribe[3] * k * kh).toFixed(2) } : null;
    if (curve) curve.key = [nc, tc, curve.nw, curve.nh, curve.tw, curve.th].join(",");
    if (prev && (!curve || prev.key !== curve.key)) document.querySelectorAll("#stage svg.cv").forEach((v) => { const e = v.parentElement; const t = e.__cvSrc || v.textContent; e.classList.remove("curved"); e.textContent = t; });
    if (curve && !curveObs) {
      const inCv = (n) => !!(n && (n.nodeType === 1 ? n : n.parentElement) && (n.nodeType === 1 ? n : n.parentElement).closest("svg.cv"));
      curveObs = new MutationObserver((ms) => { if (!curve) return; const todo = new Set();
        for (const m of ms) {
          if (inCv(m.target)) continue;
          if (m.type === "characterData") { if (m.target.parentElement) todo.add(m.target.parentElement); continue; }
          m.addedNodes.forEach((nd) => { if (nd.nodeType === 1) { if (!inCv(nd)) todo.add(nd); } else if (nd.nodeType === 3) todo.add(m.target); });
        }
        for (const e of todo) if (e.isConnected) { const host = e.closest(".card-name, .card-tribe > span, .spell-tag"); curveIn(host || e); } });
      curveObs.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    if (curve) curveIn(stage);
  }
  window.WA_CURVE_ONE = curveOne;
  let previewSkin = null; // { kind, sk }: the editor looks at one library entry without equipping it
  function applyCardSkin() {
    const pv = (k) => (previewSkin && previewSkin.kind === k ? previewSkin.sk : null);
    let sk = pv("card") || (window.WA_STORE && window.WA_STORE.cardSkin) || DEFAULT_CARD_SKIN;
    if (sk !== DEFAULT_CARD_SKIN && sk.w === DEFAULT_CARD_SKIN.w && sk.h === DEFAULT_CARD_SKIN.h && sk.layout && sk.layout.art && sk.layout.art[1] < 120) sk = Object.assign({}, sk, { layout: DEFAULT_CARD_SKIN.layout }); // the template layout on the painted frame hides the gems: use the frame's own
    const st = window.WA_STORE;
    stage.classList.add("cardskin");
    stage.style.setProperty("--card-skin", `url("${sk.normal}")`);
    stage.style.setProperty("--card-skin-golden", `url("${sk.golden || sk.normal}")`);
    stage.style.setProperty("--card-skin-spell", `url("${sk.spell || sk.normal}")`);
    stage.style.setProperty("--art-mask", sk.artMask ? `url("${sk.artMask}")` : "none");
    for (const [key, v] of [["gemAtk", "gem-atk"], ["gemHp", "gem-hp"], ["gemTier", "gem-tier"]]) stage.style.setProperty("--" + v, sk[key] ? `url("${sk[key]}")` : "none");
    let el = document.getElementById("cardSkinLayout");
    if (!el) { el = document.createElement("style"); el.id = "cardSkinLayout"; document.body.appendChild(el); } // after style.css in cascade order
    el.textContent = skinCSS(sk);
    if (window.WA_STYLE && window.WA_STYLE.ensureFonts) { const tk = pv("token") || (st && st.skinOf && st.skinOf("token")) || null, Lc = sk.layout || {}, Lt = (tk && tk.layout) || {}; window.WA_STYLE.ensureFonts([Lc.nameFont, Lc.textFont, Lc.numFont, Lt.numFont]); }
    setCurve(sk);
    applySkin("token", pv("token") || (st && st.skinOf && st.skinOf("token")) || DEFAULT_TOKEN_SKIN); applySkin("endturn", pv("endturn") || (st && st.skinOf && st.skinOf("endturn")) || DEFAULT_END_SKIN);
  }
  window.WA_APPLY_CARD_SKIN = applyCardSkin;
  function applySkins() { previewSkin = null; applyTableBg(); applyKeeper(); applyCardSkin(); }
  window.WA_APPLY_SKINS = applySkins;
  window.WA_PREVIEW_SKIN = (kind, sk) => { previewSkin = kind && sk ? { kind, sk } : null; applyCardSkin(); };
  // a minion made only to be shown (a choice card): numbered apart, so both ends of an online game keep the same counters
  const shownMinion = (id, golden) => WA.withUids({ uidBase: 900000000, uidN: 0 }, () => new WA.Minion(id, golden));
  const isFr = () => window.WA_I18N && window.WA_I18N.lang === "fr";

  function newGame() {
    if (!online && window.WA_STORE && window.WA_STORE.borrowing) window.WA_STORE.unborrow(); // never keep a friend's look in your own games
    applyTableBg(); applyKeeper(); applyCardSkin();
    const AL = window.WA.ANOMALY_LIST;
    const anomaly = profile.mode === "anomaly" && AL.length ? AL[Math.floor(Math.random() * AL.length)] : null;
    const st = window.WA_STORE;
    game = new Game(8, null, true, { mmr: profile.mmr, anomaly, duo: !!profile.duo, pace: profile.pace });
    you = game.human();
    $("#shop").dataset.mode = "";
    online = null;
    renderAnomChip();
    renderTribeList();
    busy = false;
    game.startTurn();
    stage.classList.remove("combat");
    renderTavern();
  }

  function renderTribeList() {
    $("#tribeList").innerHTML = `<div class="lobby-label">Tribes</div><div class="tribe-icons">${game.tribes.map((t) => `<span data-tribe="${escH(t)}" title="${escH(TN(t) + (TRIBE_BLURB[t] ? ": " + TRIBE_BLURB[t] : ""))}">${tribeIcon(t)}</span>`).join("")}</div>`;
  }

  function banner(html, cls = "", ms = 900) {
    const b = $("#banner");
    b.innerHTML = `<div class="b ${cls}">${html}</div>`;
    const el = b.firstElementChild;
    return anim(el, [{ transform: "scale(.6)", opacity: 0 }, { transform: "scale(1.06)", opacity: 1, offset: .2 }, { transform: "scale(1)", opacity: 1, offset: .8 }, { transform: "scale(1.04)", opacity: 0 }],
      { duration: D(ms), easing: "ease-out" }).then(() => el.remove());
  }

  function startTurnUI() {
    busy = false; if (window.WA_AMB && window.WA_AMB.setPhase) window.WA_AMB.setPhase("tavern");
    stage.classList.remove("combat");
    $("#shop").hidden = false; $("#enemyRow").hidden = true; $("#board").hidden = false; $("#cmine").hidden = true; $("#ehero").hidden = true;
    $("#combatCtrl").hidden = true;
    renderTavern();
    dropInShop(150);
    const coins = [...document.querySelectorAll("#gold .coin:not(.locked)")];
    coins.forEach((c, i) => anim(c, [{ transform: "scale(0)" }, { transform: "scale(1.3)", offset: .7 }, { transform: "scale(1)" }], { duration: 300, delay: 200 + i * 40, fill: "backwards" }));
    speed = 1;
    banner(`Turn ${game.turn}<small>${you.gold} gold to spend</small>`, "", 1100);
    startTimer();
    afterTurnStart();
    partnerNews();
    setTimeout(() => {
      if (you.streak >= 3) sayQuip("winStreak");
      else if (you.streak <= -3) sayQuip("loseStreak");
      else if (you.health <= 10) sayQuip("low");
      else sayQuip("turn");
    }, 900);
  }

  async function endTurn() {
    if (busy) return;
    audio.unlock();
    if (online) {
      // both people must be done before the fight: say so, then wait for the friend (and all their actions)
      busy = true; hideTip(); stopTimer(); $("#rope").hidden = true; if (drag) onCancel(); if (!$("#modal").hidden) closeModal();
      while (you.discover.length) act(() => game.chooseDiscover(you, 0));
      if (picking) endPick();
      while ((you.picks || []).length) act(() => game.choosePick(you, game.bestPick(you)));
      while ((you.evolveChoices || []).length) act(() => game.chooseEvolve(you, 0));
      while (you.tribePick.length) act(() => game.chooseTribe(you, game.bestTribe(you)));
      online.meReady = true; netSend({ t: "ready", n: online.sent, turn: game.turn });
      renderTop(); renderGold();
      banner(`Waiting for ${escH(online.friendName)}<small>they are still shopping</small>`, "", 1400);
      tryAdvance();
      return;
    }
    busy = true; hideTip(); stopTimer();
    await endTurnNow();
  }
  async function endTurnNow() {
    $("#rope").hidden = true;
    if (!$("#modal").hidden) closeModal();
    renderTop(); renderGold();
    if (picking) endPick();
    if (!online) { while (you.discover.length) game.chooseDiscover(you, 0); while ((you.picks || []).length) game.choosePick(you, game.bestPick(you)); while ((you.evolveChoices || []).length) game.chooseEvolve(you, 0); }
    const capEnd = captureAll();
    const fx = game.endOfTurnEffects();
    try {
    renderTavern(); renderTop(); renderGold();
    if (fx.length) {
      await realWait(200);
      for (const f of fx) {
        if (f.dice) { diceFx(document.querySelector(`#board [data-uid="${f.uids[0]}"]`), f.dice); continue; }
        if (f.devour) { animateDevour(f.devour, capEnd); await realWait(650); }
        glow(document.querySelector(`#board [data-uid="${f.source}"]`));
        for (const u of f.uids) {
          const t = document.querySelector(`#board [data-uid="${u}"]`);
          if (t) { glow(t, f.devour ? "#f27a86" : "#7ff06a"); floatText(t, buffLabel(f.a, f.h, f.label)); }
        }
        sfx.buff();
        await realWait(350);
      }
      await realWait(350);
    }
    } catch (err) { report(err); }
    const preView = game.players.map(viewOf);
    const res = game.combatPhase();
    if (res.human) {
      try { await playCombat(res.human, preView); }
      catch (err) { report(err); leaveCombat(); }
    }
    renderPlayers();
    if (!you.alive) return showGameOver(false);
    if (game.isOver()) return showGameOver(true);
    game.startTurn();
    if (online) { online.sent = 0; online.applied = 0; online.meReady = false; online.peerReady = null; online.queue = []; netSend({ t: "fp", turn: game.turn, fp: game.fingerprint() }); }
    startTurnUI();
    // what the friend already did in this new turn while this browser was still showing the fight
    if (online && online.later.length) { const later = online.later; online.later = []; for (const m of later) onNet(m); }
  }

  // ---------------------------------------------------------------- combat playback
  let mySide = 0;
  const cel = (uid) => document.querySelector(`#cmine [data-uid="${uid}"], #enemyRow [data-uid="${uid}"]`);
  function renderCombat(boards) {
    const a = reconcile($("#cmine"), boards[mySide], (d) => makeToken(d, { static: true }), updateToken, { flipMs: D(320), empty: "No minions" });
    const b = reconcile($("#enemyRow"), boards[1 - mySide], (d) => makeToken(d, { static: true }), updateToken, { flipMs: D(320), empty: "No minions" });
    return [...a, ...b];
  }

  let continueResolve = null;
  let combatOpp = -2;
  async function playCombat(f, preView) {
    if (window.WA_AMB && window.WA_AMB.setPhase) window.WA_AMB.setPhase("combat");
    mySide = f.duo ? (f.order[0].includes(you.id) ? 0 : 1) : f.a === you.id ? 0 : 1;
    // Duos: who is fighting right now on each side
    const cur = f.duo ? [f.order[0][0], f.order[1][0]] : null;
    const pOf = (id) => (id != null && id >= 0 ? game.players[id] : null);
    const oppId = f.duo ? (cur[1 - mySide] != null ? cur[1 - mySide] : -1) : mySide === 0 ? f.b : f.a;
    const opp = oppId >= 0 ? game.players[oppId] : f.oppObj || null;
    const myHpBefore = f.hpBefore[mySide], oppHpBefore = f.hpBefore[1 - mySide];
    speed = profile.fast ? 2.2 : 1; skipping = false;
    $("#btnSpeed").textContent = profile.fast ? "Speed 2x" : "Speed 1x";
    $("#btnSkip").hidden = false; $("#btnContinue").hidden = true; $("#combatCtrl").hidden = false;

    stage.classList.add("combat");
    combatOpp = oppId;
    renderPlayers(oppId, preView);
    $("#shop").hidden = true; $("#board").hidden = true;
    $("#cmine").innerHTML = ""; $("#enemyRow").innerHTML = "";
    $("#enemyRow").hidden = false; $("#cmine").hidden = false;
    const eh = $("#ehero"); eh.hidden = false;
    renderHero(eh, opp, opp ? oppHpBefore : "?");
    renderHero($("#myhero"), f.duo ? pOf(cur[mySide]) || you : you, myHpBefore);

    const evs = f.events;
    renderCombat(evs[0].boards);
    anim(eh, [{ transform: "translate(-50%,-140px)", opacity: 0 }, { transform: "translate(-50%,0)", opacity: 1 }], { duration: D(450), easing: "ease-out" });
    [...$("#enemyRow").children].forEach((c, i) => anim(c, [{ transform: "translateY(-160px) scale(.6)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: D(420), delay: D(i * 60), easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }));
    sfx.whoosh();
    await wait(420);
    const firstMine = evs[0].first === mySide;
    if (f.duo) {
      const mine = pOf(cur[mySide]);
      await banner(`${escH(SCR().fight || "Fight!")}<small>${mine === you ? "Your warband goes first" : (mine ? mine.name : "Your partner") + "'s warband goes first"}${game.damageCap() < 99 ? ` · ${T("damage cap")} ${game.damageCap()}` : ""}</small>`, "", 900);
    } else await banner(`${escH(SCR().fight || "Fight!")}<small>${firstMine ? "You attack first" : (opp ? opp.name : "The ghost") + " attacks first"}${game.damageCap() < 99 ? ` · ${T("damage cap")} ${game.damageCap()}` : ""}</small>`, "", 780);

    let attacks = 0;
    for (let i = 1; i < evs.length; i++) {
      const ev = evs[i];
      try {
      switch (ev.kind) {
        case "attack": {
          attacks++;
          // Long fights speed themselves up so a late-game brawl never drags.
          if (!skipping) speed = (profile.fast ? 2.2 : 1) * (attacks > 24 ? 2.6 : attacks > 12 ? 1.6 : 1);
          let h = i + 1;
          while (h < evs.length && evs[h].kind !== "hit") h++;
          if (h < evs.length) { await doAttack(ev, evs[h]); i = h; } else renderCombat(ev.boards);
          break;
        }
        case "windup": await doWindup(ev); break;
        case "roll": diceFx(cel(ev.uid), ev); break;
        case "deaths": await doDeaths(ev); break;
        case "relay": {
          cur[ev.side] = f.order[ev.side][1] != null ? f.order[ev.side][1] : -1;
          const who = pOf(cur[ev.side]) || (ev.side !== mySide && f.oppObj ? f.oppObj : null), box = ev.side === mySide ? $("#myhero") : $("#ehero");
          const hpNow = box.querySelector(".hp-gem") ? box.querySelector(".hp-gem").textContent : "";
          renderHero(box, who, hpNow);
          const created = renderCombat(ev.boards);
          sfx.summon();
          const r0 = rectOf(box.querySelector(".crest") || box);
          ring(r0.cx, r0.cy, "#b58cff", 8); burst(r0.cx, r0.cy, 20, ["#d6b8ff", "#8f6cff", "#fff"], 80);
          created.forEach((el, k) => anim(el, [{ transform: `translateY(${ev.side === mySide ? 140 : -140}px) scale(.6)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: D(420), delay: D(k * 60), easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }));
          const nm = who ? (who === you ? "Your warband" : who.name + "'s warband") : (f.names[ev.side][1] || "The ghost") + "'s warband";
          await banner(`${nm} steps in!`, "", 900);
          break;
        }
        case "removed": renderCombat(ev.boards); await wait(170); break;
        case "summon": {
          const created = renderCombat(ev.boards);
          sfx.summon();
          if (FX[ev.fx]) for (const el of created) FX[ev.fx].impact(fxLayer(), pt(rectOf(el)));
          for (const el of created) {
            const r = rectOf(el);
            if (window.WA_FXE && !FX[ev.fx]) window.WA_FXE.impact("summonfx", { x: r.cx, y: r.cy }, { color: ev.label === "Stolen" ? "#b58cff" : ev.label === "Resurrected" ? "#9fdcff" : "#ffe08a" });
            else { ring(r.cx, r.cy, "#ffe08a", 5); burst(r.cx, r.cy, 12, ["#ffe08a", "#fff"], 60); }
            anim(el, [{ transform: "scale(.1)", opacity: 0 }, { transform: "scale(1.2)", opacity: 1, offset: .65 }, { transform: "scale(1)" }], { duration: D(450), easing: "ease-out" });
          }
          await wait(330); break;
        }
        case "reborn": {
          const created = renderCombat(ev.boards);
          sfx.summon();
          for (const el of created) {
            const r = rectOf(el);
            if (window.WA_FXE) window.WA_FXE.impact("summonfx", { x: r.cx, y: r.cy }, { color: "#9fdcff" }); else { ring(r.cx, r.cy, "#9fdcff", 6); burst(r.cx, r.cy, 14, ["#9fdcff", "#ffffff"], 60); }
            anim(el, [{ opacity: 0, transform: "translateY(20px) scale(.8)" }, { opacity: 1, transform: "none" }], { duration: D(420), easing: "ease-out" });
            glow(el, "#9fdcff");
          }
          await wait(400); break;
        }
        case "buff": {
          const src = cel(ev.source) || (ev.hero != null ? heroOf(ev.hero) : null);
          glow(src);
          if (FX[ev.fx]) await Promise.all(ev.uids.map((u, k) => wait(k * 90).then(() => playFx(ev.fx, src, cel(u)))));
          if (src && ev.soc) { await anim(src, [{ transform: "none" }, { transform: "translateY(-14px) scale(1.12)" }, { transform: "none" }], { duration: D(260), easing: "ease-out" }); }
          renderCombat(ev.boards);
          for (const u of ev.uids) { const el = cel(u); if (el) { const col = FX[ev.fx] ? FX[ev.fx].color : ev.label === "Shield" ? "#ffe08a" : ev.label === "Reborn" ? "#9fdcff" : "#7ff06a"; glow(el, col); if (window.WA_FXE && !FX[ev.fx] && (ev.a || ev.h || ev.label)) kwMoment(el, ev.label, col); floatText(el, buffLabel(ev.a, ev.h, ev.label), /Health$/.test(ev.label || "") ? "#8ff5c4" : null); } }
          sfx.buff();
          await wait(ev.quick ? 170 : ev.soc ? 420 : 300); break;
        }
        case "shoot": await doShoot(ev); break;
        case "chill": {
          // Frozen: frost flies to them; they will skip their next attack
          const src = cel(ev.source); glow(src, "#9fdcff");
          await Promise.all(ev.uids.map((u, k) => wait(k * 90).then(() => (FX.frost && src && cel(u) ? playFx("frost", src, cel(u)) : null))));
          renderCombat(ev.boards); sfx.frost();
          for (const u of ev.uids) { const el = cel(u); if (el) { floatText(el, isFr() ? "❄ Gelé" : "❄ Frozen", "#bfe8ff"); anim(el, [{ filter: "brightness(1.8) saturate(.4)" }, { filter: "none" }], { duration: D(420) }); } }
          await wait(380); break;
        }
        case "thaw": {
          // a Frozen minion's turn: it shivers, skips its attack and thaws
          const el = cel(ev.uids[0]);
          if (el) { anim(el, [{ transform: "none" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(-3px)" }, { transform: "none" }], { duration: D(320) }); floatText(el, isFr() ? "❄ passe son tour" : "❄ skips its attack", "#bfe8ff"); }
          sfx.frost(); await wait(360); renderCombat(ev.boards);
          if (el) { const r = rectOf(el); burst(r.cx, r.cy, 10, ["#dff4ff", "#9fdcff"], 50); }
          await wait(200); break;
        }
        case "end": releaseHeld(); await doEnd(ev, f, opp, myHpBefore, oppHpBefore); break;
      }
      } catch (err) { report(err); try { renderCombat(ev.boards); } catch (e2) {} }
    }
    // Damage is dealt: head back to the tavern on our own after a short beat.
    $("#btnSkip").hidden = true;
    await Promise.race([realWait(skipping ? 250 : 700), new Promise((r) => (continueResolve = r))]);
    leaveCombat();
  }
  function leaveCombat() {
    continueResolve = null;
    $("#combatCtrl").hidden = true;
    $("#cmine").innerHTML = ""; $("#enemyRow").innerHTML = "";
    $("#fx").innerHTML = ""; $("#banner").innerHTML = "";
  }
  // Errors are logged and the game carries on instead of freezing.
  function report(err) { try { console.error("[Warband Arena]", err); } catch (e) {} }

  // "Whenever this attacks": the attacker sets off, freezes mid-swing while its effects play, then strikes
  let held = null; // { uid, el, pose }
  function releaseHeld() { if (!held) return; const h = held; held = null; if (h.el && h.el.isConnected) { h.el.classList.remove("mid-attack"); for (const x of h.el.getAnimations()) x.cancel(); anim(h.el, [{ transform: h.pose }, { transform: "none" }], { duration: D(180), easing: "ease-out" }); h.el.style.zIndex = ""; } }
  async function doWindup(ev) {
    releaseHeld();
    renderCombat(ev.boards);
    const a = cel(ev.attacker), t = cel(ev.target); if (!a || !t) return;
    const ra = rectOf(a), rt = rectOf(t), dx = rt.cx - ra.cx, dy = rt.cy - ra.cy, style = FX[ev.fx];
    a.style.zIndex = 30;
    const back = `translate(${-dx * 0.07}px, ${-dy * 0.07}px) scale(1.14)`;
    const pose = style && style.ranged ? `translate(${-dx * 0.05}px, ${-dy * 0.05}px) scale(1.14)` : `translate(${dx * 0.36}px, ${dy * 0.36}px) scale(1.12) rotate(${dx > 0 ? 4 : -4}deg)`;
    await anim(a, [{ transform: "none" }, { transform: back }], { duration: D(ev.second ? 90 : 150), easing: "ease-out", fill: "forwards" });
    if (!(style && style.ranged)) sfx.whoosh();
    await anim(a, [{ transform: back }, { transform: pose }], { duration: D(150), easing: "cubic-bezier(.3,0,.3,1)", fill: "forwards" });
    held = { uid: ev.attacker, el: a, pose };
    a.classList.add("mid-attack");
    await wait(110); // a beat of hit-stop before its effects
  }
  async function doAttack(ev, hit) {
    renderCombat(ev.boards);
    const a = cel(ev.attacker), t = cel(ev.target);
    const fromMid = held && held.uid === ev.attacker && held.el === a ? held.pose : null;
    if (held && !fromMid) releaseHeld(); else if (fromMid) { held = null; a.classList.remove("mid-attack"); }
    if (!a || !t) return;
    lookSound(a._d, "attack");
    const ra = rectOf(a), rt = rectOf(t);
    const dx = rt.cx - ra.cx, dy = rt.cy - ra.cy;
    a.style.zIndex = 30;
    const back = `translate(${-dx * 0.07}px, ${-dy * 0.07}px) scale(1.14)`;
    const strike = `translate(${dx * 0.72}px, ${dy * 0.72}px) scale(1.06)`;
    const style = FX[ev.fx];
    try {
    if (style && style.ranged) {
      // Ranged attackers stay home: a small wind-up, then the effect flies.
      const pose = `translate(${-dx * 0.05}px, ${-dy * 0.05}px) scale(1.12)`;
      if (fromMid) { for (const x of a.getAnimations()) x.cancel(); await anim(a, [{ transform: fromMid }, { transform: pose }], { duration: D(80), easing: "ease-out", fill: "forwards" }); }
      else await anim(a, [{ transform: "none" }, { transform: pose }], { duration: D(ev.second ? 90 : 150), easing: "ease-out", fill: "forwards" });
      if (/^data:/.test(style.sound || "")) playSound(style.sound); else (sfx[style.sound] || sfx.whoosh)();
      // every enemy this attack hits (cleave included) gets its own bolt
      const L = fxLayer(), ta = pt(ra);
      const victims = hit.hits.map((h) => cel(h.uid)).filter((e) => e && e !== a);
      if (!victims.includes(t)) victims.unshift(t);
      await Promise.all(victims.map((v, k) => wait(k * 70).then(() => style.travel(L, ta, pt(rectOf(v)))).then(() => { if (v.isConnected) { style.impact(L, pt(rectOf(v))); tint(v, style.color); } })));
      sfx.hit();
      renderCombat(hit.boards);
      impactHits(hit, a, dx, dy);
      await anim(a, [{ transform: pose }, { transform: "none" }], { duration: D(180), easing: "ease-out", fill: "forwards" });
      return;
    }
    if (fromMid) {
      // its effects are done: the frozen swing lands
      for (const x of a.getAnimations()) x.cancel();
      if (window.WA_FXE) window.WA_FXE.trail(pt(ra), { x: ra.cx + dx * 0.72, y: ra.cy + dy * 0.72 }, a.classList.contains("golden") ? "#ffe08a" : "#ffd9a0");
      await anim(a, [{ transform: fromMid }, { transform: strike }], { duration: D(95), easing: "cubic-bezier(.7,0,1,.6)", fill: "forwards" });
    } else {
    await anim(a, [{ transform: "none" }, { transform: back }], { duration: D(ev.second ? 90 : 160), easing: "ease-out", fill: "forwards" });
    sfx.whoosh();
    if (window.WA_FXE) window.WA_FXE.trail(pt(ra), { x: ra.cx + dx * 0.72, y: ra.cy + dy * 0.72 }, a.classList.contains("golden") ? "#ffe08a" : "#ffd9a0");
    await anim(a, [{ transform: back }, { transform: strike }], { duration: D(115), easing: "cubic-bezier(.7,0,1,.6)", fill: "forwards" });
    }
    if (style) {
      if (/^data:/.test(style.sound || "")) playSound(style.sound); else (sfx[style.sound] || (() => {}))();
      const victims = hit.hits.map((h) => cel(h.uid)).filter((e) => e && e !== a);
      for (const v of victims.length ? victims : [t]) { style.impact(fxLayer(), pt(rectOf(v))); tint(v, style.color); }
    } else if (window.WA_FXE && !hit.hits.every((h) => h.dodged)) {
      const victims = hit.hits.map((h) => cel(h.uid)).filter((e) => e && e !== a);
      for (const v of victims.length ? victims : [t]) window.WA_FXE.impact("melee", pt(rectOf(v)), { dx, dy, heavy: hit.hits.some((h) => h.dmg >= 6 || h.venom) });
    }
    // impact
    sfx.hit();
    renderCombat(hit.boards);
    impactHits(hit, a, dx, dy);
    const rtn = a.animate([{ transform: strike }, { transform: "none" }], { duration: D(210), easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    await rtn.finished.catch(() => {});
    } finally {
      // Never leave an attacker stuck mid-lunge, whatever happened above.
      for (const x of a.getAnimations()) if (x.effect && x.effect.getKeyframes().some((k) => k.transform && k.transform !== "none")) x.cancel();
      a.style.zIndex = "";
    }
    await wait(60);
  }

  function impactHits(hit, a, dx, dy) {
    if (hit.hits.some((h) => h.dmg >= 6)) shakeStage(5);
    for (const h of hit.hits) {
      const el = cel(h.uid);
      if (!el) continue;
      const r = rectOf(el);
      if (h.popped) {
        sfx.ping();
        if (window.WA_FXE) window.WA_FXE.impact("shieldpop", { x: r.cx, y: r.cy }); else { burst(r.cx, r.cy, 14, ["#fff6c8", "#ffc83a"], 80, "shard"); ring(r.cx, r.cy, "#ffe08a", 5); }
      } else if (h.dodged) {
        sfx.miss();
        floatText(el, "Miss!", "#dff3ff");
        anim(el, [{ transform: "none" }, { transform: `translate(${dx > 0 ? -22 : 22}px, -8px) rotate(${dx > 0 ? -8 : 8}deg)`, offset: .4 }, { transform: "none" }], { duration: D(320), easing: "ease-out" });
        continue;
      } else if (h.tough && !h.dmg) {
        sfx.stone();
        floatText(el, "Tough", "#d8b890");
        burst(r.cx, r.cy, 8, ["#c8a070", "#8a6a4a"], 50);
      } else {
        splat(el, h.venom ? "☠" : "-" + h.dmg, h.venom);
        burst(r.cx, r.cy, 8, h.venom ? ["#8ee05a", "#c8ff8a"] : ["#ff6a4a", "#ffd25a"], 50);
      }
      if (el !== a) anim(el, [{ transform: "none" }, { transform: `translate(${dx * 0.06}px, ${dy * 0.06}px) rotate(${dx > 0 ? 6 : -6}deg)`, offset: .3 }, { transform: "none" }], { duration: D(300) });
    }
  }
  const heroOf = (side) => (side === mySide ? $("#myhero .crest") : $("#ehero .crest"));
  async function doShoot(ev) {
    const src = cel(ev.source) || (ev.hero != null ? heroOf(ev.hero) : null);
    if (!src) { renderCombat(ev.boards); return; }
    const r0 = rectOf(src);
    glow(src, "#ff9a3a");
    await anim(src, [{ transform: "none" }, { transform: `translateY(${ev.side === mySide ? -16 : 16}px) scale(1.15)` }], { duration: D(180), easing: "ease-out", fill: "forwards" });
    sfx.whoosh();
    if (ev.breath) {
      const row = rectOf($("#enemyRow").children.length && ev.side === mySide ? $("#enemyRow") : $("#cmine"));
      const wave = fxEl("breath", row.x, r0.cy);
      wave.style.width = row.w + "px";
      const dy = (row.cy - r0.cy);
      anim(wave, [{ transform: `translateY(0) scaleY(.2)`, opacity: 0 }, { transform: `translateY(${dy * .7}px) scaleY(1)`, opacity: 1, offset: .5 }, { transform: `translateY(${dy}px) scaleY(1.3)`, opacity: 0 }], { duration: D(600), easing: "ease-in" }).then(() => wave.remove());
      await wait(380);
    } else if (FX[ev.fx]) {
      const st = FX[ev.fx];
      (sfx[st.sound] || sfx.whoosh)();
      await Promise.all(ev.hits.map((h, i) => { const t = cel(h.uid); if (!t) return Promise.resolve(); return wait(i * 110).then(() => st.travel ? st.travel(fxLayer(), pt(r0), pt(rectOf(t))) : null).then(() => { if (t.isConnected) { st.impact(fxLayer(), pt(rectOf(t))); tint(t, st.color); } }); }));
    } else {
      await Promise.all(ev.hits.map((h, i) => { const t = cel(h.uid); if (!t) return Promise.resolve(); const r = rectOf(t); return wait(i * 120).then(() => bolt(r0.cx, r0.cy, r.cx, r.cy, "#ff7a2a", 380, 70)); }));
    }
    sfx.hit(); if (ev.breath) shakeStage(6);
    renderCombat(ev.boards);
    for (const h of ev.hits) {
      const el = cel(h.uid); if (!el) continue;
      const r = rectOf(el);
      if (h.popped) { sfx.ping(); burst(r.cx, r.cy, 14, ["#fff6c8", "#ffc83a"], 80, "shard"); ring(r.cx, r.cy, "#ffe08a", 5); }
      else if (h.tough && !h.dmg) { floatText(el, "Tough", "#d8b890"); burst(r.cx, r.cy, 8, ["#c8a070", "#8a6a4a"], 50); }
      else { splat(el, "-" + h.dmg); burst(r.cx, r.cy, 10, ["#ff7a2a", "#ffd25a"], 60); }
    }
    src.getAnimations().forEach((a) => a.cancel());
    await wait(280);
  }

  async function doDeaths(ev) {
    sfx.death();
    const ps = [];
    for (const u of ev.uids) {
      const el = cel(u);
      if (!el) continue;
      lookSound(el._d, "death");
      el.classList.add("dying");
      const r = rectOf(el);
      ps.push(anim(el, [{ transform: "none", opacity: 1 },
        { transform: "translateX(-4px) rotate(-4deg)", opacity: 1, offset: .2 },
        { transform: "translateX(4px) rotate(4deg)", opacity: 1, offset: .4 },
        { transform: "scale(.4) translateY(30px)", opacity: 0 }],
        { duration: D(380), easing: "ease-in", fill: "forwards" }));
      setTimeout(() => { if (window.WA_FXE) window.WA_FXE.impact("death", { x: r.cx, y: r.cy }); else burst(r.cx, r.cy + 20, 16, ["#8a7a6a", "#5a4a40", "#c8b8a0"], 70); }, D(200));
    }
    await Promise.all(ps);
  }

  // the end-of-combat count: a tier badge pops on the winning hero and on each survivor, then flies into a counter that
  // adds it up (the damage the losing hero takes); a damage cap shows as "max"
  async function damageTally(ev, row, iWon, h) {
    const toks = [...row.children].filter((c) => c.dataset.uid && (!ev.survivors || ev.survivors.includes(+c.dataset.uid)));
    const tiers = toks.map((c, i) => (c._d && c._d.tier) || (ev.tiers && ev.tiers[i]) || 1);
    const heroTier = ev.heroTier != null ? ev.heroTier : Math.max(0, ev.damage - tiers.reduce((t, n) => t + n, 0));
    const rr = rectOf(row), fromHero = rectOf(iWon ? $("#myhero .crest") : $("#ehero .crest"));
    const x = rr.cx, y = iWon ? rr.y - 34 : rr.y + rr.h + 34;
    const box = fxEl("dmg-tally", Math.max(120, Math.min(innerWidth - 120, x)), y, `<b>0</b><small>${isFr() ? "dégâts" : "damage"}</small>`);
    const num = box.querySelector("b"); box.classList.toggle("lose", !iWon);
    anim(box, [{ transform: "translate(-50%,-50%) scale(.3)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1 }], { duration: D(220), easing: "cubic-bezier(.3,1.5,.5,1)", fill: "forwards" });
    let total = 0, k = 0; const bx = parseFloat(box.style.left), by = parseFloat(box.style.top);
    const one = (r, n, cls) => new Promise(async (res) => {
      const b = fxEl("tier-pop " + cls, r.cx, r.y + r.h * 0.28, `<i>★</i>${n}`);
      await anim(b, [{ transform: "translate(-50%,-50%) scale(.2)", opacity: 0 }, { transform: "translate(-50%,-80%) scale(1.3)", opacity: 1, offset: .55 }, { transform: "translate(-50%,-70%) scale(1)", opacity: 1 }], { duration: D(260), easing: "ease-out", fill: "forwards" });
      await wait(D(140));
      await anim(b, [{ transform: "translate(-50%,-70%) scale(1)" }, { transform: `translate(calc(-50% + ${bx - r.cx}px), calc(-50% + ${by - (r.y + r.h * 0.28)}px)) scale(.55)`, opacity: .9 }], { duration: D(300), easing: "cubic-bezier(.5,0,.9,.7)", fill: "forwards" });
      b.remove();
      total += n; num.textContent = ev.capped ? Math.min(total, ev.damage) : total; sfx.tally(k++);
      anim(num, [{ transform: "scale(1.45)" }, { transform: "scale(1)" }], { duration: D(200), easing: "ease-out" });
      res();
    });
    await one(fromHero, heroTier, "hero");
    const jobs = toks.map((c, i) => wait(D(150) * i).then(() => { glow(c, "#ffd25a"); return one(rectOf(c), tiers[i], ""); }));
    await Promise.all(jobs);
    num.textContent = ev.damage;
    if (ev.capped) { box.insertAdjacentHTML("beforeend", `<em>max</em>`); anim(box, [{ filter: "brightness(1.8)" }, { filter: "none" }], { duration: D(300) }); }
    await wait(D(380));
    return box;
  }
  async function doEnd(ev, f, opp, myHp, oppHp) {
    await wait(300);
    if (ev.winner === -1) {
      renderPlayers(combatOpp);
      await banner("Draw<small>Nobody takes damage</small>", "", 1500);
      return;
    }
    const iWon = ev.winner === mySide;
    const row = iWon ? $("#cmine") : $("#enemyRow");
    const heroEl = iWon ? $("#ehero .crest") : $("#myhero .crest");
    const h = rectOf(heroEl);
    // the damage count: the winner's tavern tier, then each survivor's tier pops up on it and flies into a counter
    const tally = await damageTally(ev, row, iWon, h);
    await anim(tally, [{ transform: "translate(-50%,-50%) scale(1)" }, { transform: `translate(calc(-50% + ${(h.cx - parseFloat(tally.style.left)) * .45}px), calc(-50% + ${(h.cy - parseFloat(tally.style.top)) * .45 - 40}px)) scale(1.25)`, offset: .45 },
      { transform: `translate(calc(-50% + ${h.cx - parseFloat(tally.style.left)}px), calc(-50% + ${h.cy - parseFloat(tally.style.top)}px)) scale(.7)` }], { duration: D(420), easing: "cubic-bezier(.5,0,.8,.6)", fill: "forwards" });
    tally.remove();
    burst(h.cx, h.cy, 18, ["#ff9a3a", "#ffd25a"], 80); sfx.hit();
    anim(heroEl, [{ transform: "none" }, { transform: "translate(6px,-4px) rotate(6deg)" }, { transform: "none" }], { duration: D(240) });
    sfx.hero(); shakeStage(ev.damage >= 10 ? 14 : 9);
    if (window.WA_FXE) window.WA_FXE.impact("herohit", { x: h.cx, y: h.cy });
    const heroBox = iWon ? $("#ehero") : $("#myhero");
    const s = fxEl("splat", h.cx, h.cy, "-" + ev.damage);
    s.style.width = s.style.height = "92px"; s.style.margin = "-46px 0 0 -46px"; s.style.fontSize = "34px";
    anim(s, [{ transform: "scale(.2)", opacity: 1 }, { transform: "scale(1.2)", opacity: 1, offset: .2 }, { transform: "scale(1)", opacity: 1, offset: .8 }, { transform: "scale(1)", opacity: 0 }], { duration: D(1400) }).then(() => s.remove());
    const gem = heroBox.querySelector(".hp-gem");
    const from = iWon ? oppHp : myHp, to = from - ev.damage;
    if (gem && typeof from === "number") {
      for (let k = 1; k <= 10; k++) { await wait(30); gem.textContent = Math.round(from + (to - from) * (k / 10)); }
      anim(gem, [{ transform: "scale(1.5)" }, { transform: "scale(1)" }], { duration: 300 });
    }
    renderPlayers(combatOpp);
    iWon ? sfx.win() : sfx.lose();
    await banner(iWon ? `${escH(SCR().victory || "Victory")}<small>${opp ? opp.name : "The ghost"} takes ${ev.damage} damage</small>` : `${escH(SCR().defeat || "Defeat")}<small>You take ${ev.damage} damage</small>`, iWon ? "win" : "lose", 1400);
  }

  // Draw every lobby sprite ahead of time, a few per frame, so no fight stutters on a new face.
  // every picture of the meta (cards, tokens, skins, table, bartender) decoded once at start, so nothing pops in during play
  const keptPics = [];
  async function preloadPictures() {
    const st = window.WA_STORE; if (!st) return;
    const urls = new Set(), ok = (v) => typeof v === "string" && /^(blob:|data:image)/.test(v);
    const add = (v, depth = 0) => { if (ok(v)) urls.add(v); else if (v && typeof v === "object" && depth < 2) for (const x of Object.values(v)) add(x, depth + 1); };
    try {
      for (const r of Object.values(st.IMAGES || {})) add(r);
      for (const k of st.SKIN_KINDS || []) add(st.skinOf(k));
      add(st.tableBg); const b = st.bartender; if (b) add(b.skins);
    } catch (e) { report(e); }
    const list = [...urls]; if (!list.length) return;
    let shown = null, done = 0;
    const showAt = setTimeout(() => { shown = document.createElement("div"); shown.id = "bootLoad"; shown.innerHTML = `<b>${isFr() ? "Chargement des images" : "Loading the pictures"}</b><span></span><i><em></em></i>`; document.body.appendChild(shown); upd(); }, 350);
    const upd = () => { if (!shown) return; shown.querySelector("span").textContent = done + " / " + list.length; shown.querySelector("em").style.width = Math.round((done / list.length) * 100) + "%"; };
    let at = 0;
    const worker = async () => { while (at < list.length) { const u = list[at++]; const im = new Image(); im.src = u; keptPics.push(im); try { await im.decode(); } catch (e) {} done++; upd(); } };
    await Promise.race([Promise.all(Array.from({ length: 6 }, worker)), new Promise((r) => setTimeout(r, 20000))]);
    clearTimeout(showAt); if (shown) shown.remove();
  }
  function warmSprites() {
    const ids = Object.keys(game.pool).concat(["pup", "cub"]);
    const jobs = [];
    for (const id of ids) { const d = def(id); jobs.push({ cardId: id, tribe: d.tribe, golden: false, taunt: !!d.taunt }); jobs.push({ cardId: id, tribe: d.tribe, golden: true, taunt: !!d.taunt }); }
    const step = () => { const t0 = performance.now(); while (jobs.length && performance.now() - t0 < 6) { const j = jobs.shift(); ARTMOD.token(j); } if (jobs.length) setTimeout(step, 16); };
    setTimeout(step, 50);
  }

  // ---------------------------------------------------------------- boot
  function build() {
    ARTMOD.installTheme();
    applyKeeper();
    // painted tavern buttons: preload every state so hover and press never flash
    for (const b of ["upgrade", "refresh", "freeze"]) { const im = new Image(); im.src = `buttons/${b}-normal.png`; }
    for (const b of ["bartender", "ehero", "hero", "spell"]) { const im = new Image(); im.src = `ui-art/${b}-normal.png`; }
    for (const b of ["rank", "anomaly", "timer"]) { const im = new Image(); im.src = `ui-art/${b}.png`; }
    stage.classList.add("framed");
    for (const id of ["#btnUpgrade", "#btnRoll", "#btnFreeze"]) $(id).classList.add("skin");
    $("#btnRoll").addEventListener("click", onRoll);
    $("#btnFreeze").addEventListener("click", onFreeze);
    $("#btnUpgrade").addEventListener("click", onUpgrade);
    $("#btnEnd").addEventListener("click", endTurn);
    $("#btnSpeed").addEventListener("click", () => {
      profile.fast = !profile.fast; saveProfile();
      if (!skipping) speed = profile.fast ? 2.2 : 1;
      $("#btnSpeed").textContent = profile.fast ? "Speed 2x" : "Speed 1x";
    });
    $("#btnSkip").addEventListener("click", () => { speed = 14; skipping = true; });
    $("#btnContinue").addEventListener("click", () => continueResolve && continueResolve());
    $("#heroPower").addEventListener("click", onPower);
    $("#heroPower").addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse" && !drag) powerTip(); });
    $("#heroPower").addEventListener("pointerleave", hideTip);
    { const pgEl = $("#pressureGauge"); if (pgEl) { pgEl.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse" && !drag && !tableEditing) pressureTip(pgEl); }); pgEl.addEventListener("pointerleave", hideTip); } }
    for (const sel of ["#affSlot1", "#affSlot2"]) { const el = $(sel); if (!el) continue; el.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse" && !drag && !tableEditing) affTip(el); }); el.addEventListener("pointerleave", hideTip); el.addEventListener("click", () => { if (!drag && !tableEditing) affTip(el); }); }
    $("#portal").addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse" && !drag) portalTip(); });
    $("#portal").addEventListener("pointerleave", hideTip);
    $("#portal").addEventListener("click", () => { if (!drag) portalTip(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (aiming) { stopAim(); renderPower(); } else if (drag) onCancel(); else if ($("#modal").hidden) showGameMenu(); else if (document.querySelector("#gmResume")) closeModal(); } });
    // keyboard: R refresh · F freeze · U upgrade · H hero power · 1-7 buy that tavern slot (or pick a choice in a dialog) · Space / Enter end turn
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (document.activeElement || {}).tagName; if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if (!game || !you) return;
      const k = e.key.toLowerCase(), modal = $("#modal");
      if (tag === "BUTTON" && (k === "enter" || k === " ")) return; // Enter on a focused button clicks it, nothing more
      if ($("#cardEditor")) return; // the creator mode has its own keys
      if (!modal.hidden && !/^[1-9]$/.test(k)) return; // a dialog is open: only the number keys pick a choice
      if (/^[1-9]$/.test(k)) {
        const n = +k - 1;
        if (!modal.hidden) { const c = modal.querySelectorAll(".choices .card, .hero-choices .hero-pick, .tribe-picks .tribe-pick")[n]; if (c) { e.preventDefault(); c.click(); } return; }
        if (busy) return;
        const el = [...$("#shop").children].filter((c) => c.dataset.uid)[n];
        if (el) { e.preventDefault(); quickAction(el, "shop"); }
        return;
      }
      if (!modal.hidden || busy) return;
      if (k === "r") { e.preventDefault(); onRoll(); }
      else if (k === "f") { e.preventDefault(); onFreeze(); }
      else if (k === "u") { e.preventDefault(); onUpgrade(); }
      else if (k === "h") { e.preventDefault(); onPower(); }
      else if ((k === " " || k === "enter") && !continueResolve) { e.preventDefault(); if (drag) onCancel(); endTurn(); }
    });
    $("#btnMenu").addEventListener("click", () => { audio.unlock(); showGameMenu(); });
    $("#btnKeepMeta").addEventListener("click", async (e) => { const b = e.currentTarget; b.disabled = true; await keepSharedMeta(); b.disabled = false; });
    const snd = $("#btnSound");
    const paintSnd = () => { snd.innerHTML = (audio.on ? ICON.sound : ICON.mute) + `<span>${audio.on ? "Sound on" : "Sound off"}</span>`; };
    snd.addEventListener("click", () => { audio.on = !audio.on; audio.unlock(); if (window.WA_AMB) window.WA_AMB.setMuted(!audio.on); paintSnd(); try { localStorage.setItem("wa-sound", audio.on ? "1" : "0"); } catch (e) {} });
    try { if (localStorage.getItem("wa-sound") === "0") audio.on = false; } catch (e) {}
    if (window.WA_AMB) window.WA_AMB.setMuted(!audio.on);
    paintSnd();
    document.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && continueResolve) { e.preventDefault(); continueResolve(); }
    });
    window.addEventListener("resize", fit);
    window.addEventListener("blur", () => { if (drag) onCancel(); });
    window.addEventListener("error", (e) => report(e.error || e.message));
    window.addEventListener("unhandledrejection", (e) => report(e.reason));
    fit();
    renderRankChip();
    if (window.WA_STYLE) window.WA_STYLE.onApply(applyStyleNow); // the meta's sounds, effects, texts, screens, frames
    // Player-made cards and pictures load before the first game is dealt.
    const fontsReady = document.fonts ? Promise.race([document.fonts.load("700 20px Fraunces"), new Promise((r) => setTimeout(r, 2500))]).catch(() => {}) : null;
    let bundled = null;
    const loadAll = async () => { const st = window.WA_STORE; if (!st) return; try { await st.load(); } catch (e) { report(e); }
      // a meta shipped next to the game (ma-meta.js): installed and picked on the first launch, updated when a newer file comes
      if (st.installBundled) { try { bundled = await st.installBundled(); } catch (e) { report(e); } }
      window.WA_BUNDLED_META = null; }; // installed (or already there): its megabytes of text are not needed any more
    const ready = Promise.all([loadAll(), fontsReady]).then(() => preloadPictures());
    ready.then(() => { newGame(); showIntro(); warmSprites();
      if (bundled) setTimeout(() => toast(isFr() ? `Méta « ${bundled.name} »${bundled.from ? " de " + bundled.from : ""} ${bundled.updated ? "mise à jour" : "installée"} : elle est sélectionnée.` : `Meta "${bundled.name}"${bundled.from ? " from " + bundled.from : ""} ${bundled.updated ? "updated" : "installed"}: it is selected.`, 6000), 600);
      // a browser that will not keep the game's data when it is opened from a file (some Firefox and Safari settings)
      const st = window.WA_STORE; if (st && st.storageMode === "fallback" && location.protocol === "file:") setTimeout(() => toast(isFr() ? "Ce navigateur garde mal les données d'un jeu ouvert depuis un fichier : tes créations et ta méta risquent de ne pas rester. Ouvre plutôt index.html avec Chrome ou Edge." : "This browser keeps little data for a game opened from a file: your creations and meta may not stay. Open index.html with Chrome or Edge instead.", 8000), bundled ? 6800 : 900);
    });
  }

  // ---------------------------------------------------------------- playing with a friend (online duo)
  // Both browsers run the same deterministic game; only actions travel. See net.js for the links.
  let online = null;
  const NET_ACTS = ["buy", "buySpell", "cast", "play", "sell", "roll", "toggleFreeze", "upgrade", "move", "chooseDiscover", "chooseEvolve", "choosePick", "chooseTribe", "pass", "usePower", "confirmHero", "takeInbox", "activate", "reflux"];
  const uidAt = (list, i) => (list[i] ? list[i].uid : null), at = (list, uid) => list.findIndex((x) => x.uid === uid);
  // an action by me, described by card ids rather than positions (the friend's copy may hold them elsewhere)
  function encodeAct(m, p, args) {
    switch (m) {
      case "buy": return { uid: uidAt(p.shop, args[0]) };
      case "cast": return { uid: uidAt(p.hand, args[0]), tuid: args[1] >= 0 ? uidAt(p.board, args[1]) : null };
      case "play": return { uid: uidAt(p.hand, args[0]), pos: args[1] == null ? -1 : args[1] };
      case "sell": case "activate": return { uid: uidAt(p.board, args[0]) };
      case "move": return { from: args[0], to: args[1] };
      case "chooseDiscover": case "chooseEvolve": case "choosePick": return { i: args[0] };
      case "reflux": return { uid: uidAt(p.board, args[0]) };
      case "chooseTribe": return { tribe: args[0] };
      case "pass": return { zone: args[0], uid: uidAt(p[args[0]], args[1]) };
      case "usePower": return { tuid: args[0] >= 0 ? uidAt(p.board, args[0]) : null };
      case "confirmHero": return { id: args[0] };
      default: return {};
    }
  }
  function decodeAct(m, p, a) {
    switch (m) {
      case "buy": return [at(p.shop, a.uid)];
      case "cast": return [at(p.hand, a.uid), a.tuid != null ? at(p.board, a.tuid) : -1];
      case "play": return [at(p.hand, a.uid), a.pos];
      case "sell": case "activate": return [at(p.board, a.uid)];
      case "move": return [a.from, a.to];
      case "chooseDiscover": case "chooseEvolve": case "choosePick": return [a.i];
      case "reflux": return [at(p.board, a.uid)];
      case "chooseTribe": return [a.tribe];
      case "pass": return [a.zone, at(p[a.zone], a.uid)];
      case "usePower": return [a.tuid != null ? at(p.board, a.tuid) : -1];
      case "confirmHero": return [a.id];
      default: return [];
    }
  }
  function netSend(o) { if (online && online.link && online.link.open) online.link.send(o); }
  // my own successful actions go out; the friend's arrive through onNet
  function hookActions(g) {
    for (const m of NET_ACTS) {
      const orig = g[m];
      g[m] = function (p, ...args) {
        const enc = p === you ? encodeAct(m, p, args) : null;
        const err = orig.call(this, p, ...args);
        if (!err && enc && online) netSend({ t: "act", m, a: enc, n: ++online.sent, turn: game.turn });
        return err;
      };
    }
  }
  function friend() { return online ? game.players[online.friendSeat] : null; }
  function onNet(msg) {
    if (!online || !msg || !msg.t) return;
    try {
      if (msg.t === "mpack") { onMetaSlice(msg); return; }
      if (msg.t === "mimg") { onMetaImage(msg); return; }
      // the friend may already be in the next turn while this browser still plays the fight: keep those for later
      if ((msg.t === "act" || msg.t === "ready" || msg.t === "fp") && msg.turn != null && msg.turn > game.turn) { online.later.push(msg); return; }
      if (msg.t === "act") {
        // actions must land in order; buffer anything early
        online.queue.push(msg); online.queue.sort((x, y) => x.n - y.n);
        while (online.queue.length && online.queue[0].n === online.applied + 1) {
          const a = online.queue.shift();
          const p = friend();
          const err = a.m === "chooseShared" ? game.chooseShared(a.a.i) : game[a.m](p, ...decodeAct(a.m, p, a.a));
          online.applied++;
          if (err) report(new Error(`friend's ${a.m} failed: ${err}`));
          if (a.m === "chooseShared" && busy && $("#modal").hidden && $("#combatCtrl").hidden) { busy = false; renderTavern(); toast(`${p.name} picked ${game.lastShared ? WA.CARDS[game.lastShared.id].name : "a minion"} for everyone.`); afterTurnStart(); }
        }
        if (!busy && !drag) { renderTavern(); pullInbox(); partnerNews(); } else { renderPlayers(); renderPortal(); }
        tryAdvance();
      } else if (msg.t === "ready") {
        online.peerReady = msg.n;
        if (msg.force && !online.meReady && !busy) { toast("Time's up!"); endTurn(); }
        tryAdvance();
      } else if (msg.t === "fp") {
        if (msg.turn === game.turn && msg.fp !== game.fingerprint()) { online.desync = (online.desync || 0) + 1; toast("The two games drifted apart. Results may differ from your friend's screen."); }
      } else if (msg.t === "concede") { friendConceded(); }
      else if (msg.t === "bye") { friendLeft(); }
    } catch (e) { report(e); }
  }
  // the fight starts once both said "done" and every action of the friend has been applied
  function tryAdvance() {
    if (!online || !online.meReady || online.peerReady == null) return;
    if (online.applied < online.peerReady) return;
    online.meReady = false; online.peerReady = null;
    endTurnNow();
  }
  function pullInbox() {
    if (!you || !you.inbox || !you.inbox.length || drag || busy) return;
    const names = you.inbox.map((m) => m.name);
    if (act(() => game.takeInbox(you))) for (const m of you.hand) { const el = document.querySelector(`#hand [data-uid="${m.uid}"]`); if (el && names.includes(m.name)) glow(el, "#b58cff"); }
  }
  function friendLeft() {
    if (!online) return;
    const f = friend(); const name = online.friendName, waiting = online.meReady;
    try { online.link.close(); } catch (e) {}
    f.isBot = true; f.skill = 0.6;
    online = null;
    toast(`${name} left: a bot takes over their warband.`);
    banner(`${escH(name)} ${T("is gone")}<small>${T("The connection was lost: a bot now plays their warband.")}</small>`, "", 3200);
    if (waiting) endTurnNow();
  }
  // ---- lobby
  // the creator mode is behind a little door
  const EDITOR_CODE = "00";
  function askEditorCode(then) {
    const m = modal(`<h2>Je sais que tu veux aller là</h2>
      <div class="net-join code-gate"><input id="editorCode" type="password" maxlength="12" placeholder="…" autocomplete="off" autofocus><button class="pill big" id="editorGo">Entrer</button></div>
      <div id="editorCodeMsg" class="net-status"></div>
      <div class="intro-actions"><button class="pill" id="editorBack">${T("Back")}</button></div>`);
    const inp = m.querySelector("#editorCode");
    const go = () => { if (inp.value.trim() === EDITOR_CODE) { closeModal(); if (then) then(); else openEditor(); } else { m.querySelector("#editorCodeMsg").textContent = T("Nope."); inp.value = ""; inp.focus(); m.querySelector(".mbox").animate([{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "translateX(0)" }], { duration: 220 }); } };
    m.querySelector("#editorGo").addEventListener("click", go);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    m.querySelector("#editorBack").addEventListener("click", showIntro);
    setTimeout(() => inp.focus(), 50);
  }
  function showOnlineLobby() {
    const m = modal(`<h2>Play with a friend</h2>
      <p>You and your friend form one duo against three bot duos. One of you hosts and shares a room code; the other joins. The game then runs in both browsers at once.</p>
      <div class="lobby-net">
        <label class="ce-sel">Your name<input id="netName" maxlength="14" value="${escH(profile.name || "")}" placeholder="How your friend sees you"></label>
        <div class="mode-pick" role="radiogroup"><button type="button" class="mode-btn${profile.netMode !== "local" ? " on" : ""}" data-net="peer">Over the internet</button><button type="button" class="mode-btn${profile.netMode === "local" ? " on" : ""}" data-net="local">Same computer, two windows</button></div>
        <div class="mode-pick" role="radiogroup" title="What the room is for"><button type="button" class="mode-btn${profile.roomFor !== "edit" ? " on" : ""}" data-room="play">Play a game</button>${profile.admin ? `<button type="button" class="mode-btn${profile.roomFor === "edit" ? " on" : ""}" data-room="edit">Build cards together</button>` : ""}</div>
        <p class="net-hint" id="netHint">${profile.roomFor === "edit" ? "The host's meta is copied to the friend, then both open the card editor on it: every save appears on the other screen." : "You and your friend form one duo against three bot duos."}</p>
        <div class="net-cols">
          <div class="net-col"><b>Host a game</b><small>You pick the meta and the mode; your friend gets your card set for this game.</small><button class="pill big" id="netHost">Create a room</button><div id="netCode" class="net-code" hidden></div></div>
          <div class="net-col"><b>Join a friend</b><small>Type the 5-character code your friend sent you.</small><div class="net-join"><input id="netJoinCode" maxlength="5" placeholder="ABCDE" autocomplete="off" spellcheck="false"><button class="pill big" id="netJoin">Join</button></div></div>
        </div>
        <div id="netStatus" class="net-status"></div>
      </div>
      <div class="intro-actions"><button class="pill" id="netBack">Back</button></div>`);
    const status = (t, cls = "") => { const el = m.querySelector("#netStatus"); el.textContent = t; el.className = "net-status " + cls; };
    const nameOf = () => { const v = (m.querySelector("#netName").value || "").trim().slice(0, 14); profile.name = v; saveProfile(); return v || (profile.netMode === "local" ? "Player" : "Friend"); };
    for (const b of m.querySelectorAll("[data-net]")) b.addEventListener("click", () => { profile.netMode = b.dataset.net; saveProfile(); for (const x of m.querySelectorAll("[data-net]")) x.classList.toggle("on", x === b); });
    for (const b of m.querySelectorAll("[data-room]")) b.addEventListener("click", () => { profile.roomFor = b.dataset.room; saveProfile(); for (const x of m.querySelectorAll("[data-room]")) x.classList.toggle("on", x === b); m.querySelector("#netHint").textContent = b.dataset.room === "edit" ? "The host's meta is copied to the friend, then both open the card editor on it: every save appears on the other screen." : "You and your friend form one duo against three bot duos."; });
    let room = null;
    m.querySelector("#netBack").addEventListener("click", () => { if (room) room.cancel(); closeModal(); showIntro(); });
    m.querySelector("#netHost").addEventListener("click", async () => {
      const myName = nameOf() || "Host";
      status("Creating the room...");
      // the meta's list of pieces is made while the friend types the code (packing every picture takes a moment)
      const stP = window.WA_STORE, prep = profile.roomFor !== "edit" && stP && stP.metaPrint ? stP.metaPrint().catch((e) => { report(e); return null; }) : null;
      try {
        room = await window.WA_NET.host(profile.netMode, (link) => {
          status(`Connected! Starting...`, "ok");
          let done = false;
          link.onMessage(async function first(msg) {
            if (msg && msg.t === "hello" && !done) {
              if ((msg.v || "?") !== window.WA.VERSION) { link.send({ t: "vmismatch", v: window.WA.VERSION }); status(versionMsg(msg.v), "err"); return; }
              done = true;
              if (profile.roomFor === "edit" && profile.admin) { link.send({ t: "wsetup", name: myName }); coopStart(link, myName, msg.name || "Friend", "host"); streamMeta(link, myName).then(() => link.send({ t: "wready" })); return; }
              // the whole meta is in place on both sides before the first card is dealt: the friend already has it
              // (same fingerprint: nothing to send), or it travels now, once, and stays in their game for next time
              const friendName = msg.name || "Friend"; let started = false;
              const go = () => { if (started) return; started = true; const setup = makeSetup(myName, friendName); link.send(Object.assign({ t: "setup" }, setup)); beginOnline(link, setup, "host"); };
              status("Getting your meta ready...", "ok");
              const st = window.WA_STORE; let mp = null;
              try { mp = prep ? await prep : st && st.metaPrint ? await st.metaPrint() : null; } catch (e) { report(e); }
              if (!mp) { go(); return; }
              link.onMessage((r) => {
                if (!r || started) return;
                if (r.t === "mhave") go();
                if (r.t === "mneed") sendMetaPack(link, mp.pack, r.need || null, myName, (pct) => status(`Sending your meta to ${friendName}: ${pct}%`, "ok"));
              });
              link.send({ t: "mman", man: mp.man, from: myName, name: mp.pack.name });
            }
          });
          link.send({ t: "who", v: window.WA.VERSION });
        });
        m.querySelector("#netCode").hidden = false;
        m.querySelector("#netCode").innerHTML = `<span>Room code</span><b>${room.code}</b><small>${profile.netMode === "local" ? "Open this page in a second window and join with this code." : "Send it to your friend. Keep this window open."}</small>`;
        m.querySelector("#netHost").disabled = true;
        status("Waiting for your friend to join...");
      } catch (e) { status(e.message || String(e), "err"); }
    });
    const doJoin = async () => {
      const myName = nameOf() || "Guest";
      status("Connecting...");
      try {
        const link = await window.WA_NET.join(profile.netMode, m.querySelector("#netJoinCode").value);
        status("Connected! Waiting for the host to deal...", "ok");
        let done = false;
        link.onMessage(function first(msg) {
          if (msg && msg.t === "who") { if ((msg.v || "?") !== window.WA.VERSION) { status(versionMsg(msg.v), "err"); return; } link.send({ t: "hello", name: myName, v: window.WA.VERSION }); }
          if (msg && msg.t === "vmismatch") status(versionMsg(msg.v), "err");
          if (msg && msg.t === "mman" && !done) guestMeta(link, msg, status);
          if (msg && (msg.t === "mimg" || msg.t === "mpack") && !done && metaIn) guestMetaPiece(link, msg, status);
          if (msg && msg.t === "setup" && !done) { done = true; sharedMeta = null; beginOnline(link, msg, "guest"); }
          if (msg && msg.t === "wsetup" && !done) { done = true; status(`Receiving ${msg.name}'s meta...`, "ok"); metaRx = null; coopStart(link, myName, msg.name || "Friend", "guest"); }
        });
        link.send({ t: "hello", name: myName, v: window.WA.VERSION });
      } catch (e) { status(e.message || String(e), "err"); }
    };
    m.querySelector("#netJoin").addEventListener("click", doJoin);
    m.querySelector("#netJoinCode").addEventListener("keydown", (e) => { if (e.key === "Enter") doJoin(); });
    m.querySelector("#netJoinCode").addEventListener("input", (e) => { e.target.value = window.WA_NET.norm(e.target.value); });
  }
  const versionMsg = (theirs) => `Different game versions: you run v${window.WA.VERSION}, your friend v${theirs || "?"}. Both of you need the same zip to play together.`;
  // the host's whole meta (pictures and skins included) follows the deal, in slices, so the guest can keep it
  // pictures first, one card at a time (they show up on the friend's cards as they arrive), then the rest of the meta.
  // It waits for the connection to drain between pieces, so the game's own messages never queue behind megabytes of pictures.
  async function streamMeta(link, from) {
    try {
      const st = window.WA_STORE; if (!st || !st.packMeta) return;
      const pack = await st.packMeta(), imgs = pack.images || {}; pack.images = {};
      const drain = async () => { for (let k = 0; k < 600 && link.open && link.buffered && link.buffered() > 96000; k++) await realWait(40); };
      const keys = Object.keys(imgs);
      for (let j = 0; j < keys.length; j++) { if (!link.open) return; await drain(); link.send({ t: "mimg", from, k: keys[j], r: imgs[keys[j]], j, of: keys.length }); }
      const text = JSON.stringify(pack), SZ = 48000, n = Math.ceil(text.length / SZ);
      for (let i = 0; i < n; i++) { if (!link.open) return; await drain(); link.send({ t: "mpack", i, n, from, s: text.slice(i * SZ, (i + 1) * SZ) }); }
    } catch (e) { report(e); }
  }
  // host: the pieces of the meta the friend lacks (all of them when need is null), before the deal
  async function sendMetaPack(link, pack, need, from, onPct) {
    try {
      const imgs = pack.images || {}, keys = need ? need.imgs.filter((k) => k in imgs) : Object.keys(imgs);
      const rest = {}; if (!need || need.core) { rest.core = Object.assign({}, pack); delete rest.core.images; delete rest.core.skins; delete rest.core.style; }
      if (!need || need.style) rest.style = pack.style || null;
      rest.skins = {}; for (const k of need ? need.skins : Object.keys(pack.skins || {})) if (pack.skins[k]) rest.skins[k] = pack.skins[k];
      const text = JSON.stringify(rest), SZ = 48000, n = Math.max(1, Math.ceil(text.length / SZ)), tot = keys.length + n;
      const drain = async () => { for (let k = 0; k < 1500 && link.open && link.buffered && link.buffered() > 96000; k++) await realWait(40); };
      let sent = 0, last = -1; const tick = () => { sent++; const p = Math.floor((sent / tot) * 100); if (p !== last) { last = p; onPct(p); } };
      for (let j = 0; j < keys.length; j++) { if (!link.open) return; await drain(); link.send({ t: "mimg", from, k: keys[j], r: imgs[keys[j]], j, of: keys.length, tot }); tick(); }
      for (let i = 0; i < n; i++) { if (!link.open) return; await drain(); link.send({ t: "mpack", i, n, from, s: text.slice(i * SZ, (i + 1) * SZ), tot }); tick(); }
    } catch (e) { report(e); }
  }
  // guest: the host's meta, used for the game (and kept: next time only what changed travels)
  let metaIn = null, prevActive = null, guestLocal = false;
  async function useMetaForGame(id) {
    const st = window.WA_STORE; if (!st) return;
    if (prevActive == null) prevActive = st.active;
    if (st.active !== id) await st.setActive(id);
    guestLocal = true; applySkins(); applyTableDesign();
  }
  async function guestMeta(link, msg, status) {
    const st = window.WA_STORE, man = msg.man;
    let copy = null; try { copy = await st.localCopy(man.id); } catch (e) { report(e); }
    const need = st.missing(man, copy && copy.parts);
    if (copy && st.nothingMissing(need)) { status(`You already have ${msg.from || "your friend"}'s meta: starting...`, "ok"); await useMetaForGame(copy.id); link.send({ t: "mhave" }); return; }
    metaIn = { man, need, copy, from: msg.from || "Friend", imgs: {}, parts: [], got: 0, n: 0 };
    status(`Receiving ${metaIn.from}'s meta: 0%`, "ok");
    link.send({ t: "mneed", need: copy ? need : null });
  }
  async function guestMetaPiece(link, msg, status) {
    const M = metaIn; if (!M) return;
    if (msg.t === "mimg") { if (!(msg.k in M.imgs)) { M.imgs[msg.k] = msg.r; M.got++; } }
    else { M.n = msg.n; if (M.parts[msg.i] == null) { M.parts[msg.i] = msg.s; M.got++; } }
    status(`Receiving ${M.from}'s meta: ${Math.min(99, Math.floor((M.got / (msg.tot || 1)) * 100))}%`, "ok");
    if (msg.t !== "mpack" || M.parts.filter((x) => x != null).length < M.n) return;
    metaIn = null;
    try {
      const rest = JSON.parse(M.parts.join("")), st = window.WA_STORE;
      status(`Installing ${M.from}'s meta...`, "ok");
      let id;
      if (M.copy) id = await st.patchMeta(M.copy.id, { core: rest.core, style: rest.style, images: M.imgs, skins: rest.skins }, M.man, M.need);
      else id = await st.importMeta(Object.assign({}, rest.core, { style: rest.style || null, images: M.imgs, skins: rest.skins || {} }), M.from, M.man);
      await useMetaForGame(id);
    } catch (e) { report(e); }
    link.send({ t: "mhave" });
  }
  let metaImgs = {}; // the friend's pictures received so far (guest side)
  let imgRedraw = 0;
  function onMetaImage(msg) {
    if (!msg.k || !msg.r) return;
    if (msg.j === 0) metaImgs = {};
    metaImgs[msg.k] = msg.r;
    const st = window.WA_STORE;
    if (online && st && st.preview && msg.r.tok && msg.r.card) { st.preview(msg.k, msg.r); if (!imgRedraw) imgRedraw = setTimeout(() => { imgRedraw = 0; if (!busy && !drag) renderTavern(); }, 250); }
  }
  let guestPlayed = false; // this browser played with the host's card set: its own meta must be registered again afterwards
  async function ownMetaBack() { guestPlayed = false; const st = window.WA_STORE; if (st && st.unborrow) st.unborrow();
    const back = prevActive; prevActive = null; guestLocal = false;
    try { if (st && back && st.active !== back && st.metas.some((m) => m.id === back)) await st.setActive(back); else if (st && st.load) await st.load(); } catch (e) { report(e); }
    applySkins(); applyTableDesign(); }
  let sharedMeta = null; // { from, pack, kept } once the host's meta has fully arrived (guest side)
  let metaRx = null; // slices of a meta on their way in
  function onMetaSlice(msg) {
    const mp = metaRx || (metaRx = { parts: [], got: 0, n: msg.n });
    if (!mp.parts[msg.i]) { mp.parts[msg.i] = msg.s; mp.got++; }
    if (mp.got < mp.n) return;
    try {
      const pack = JSON.parse(mp.parts.join("")); metaRx = null;
      pack.images = Object.assign({}, pack.images || {}, metaImgs); metaImgs = {};
      if (coop && coop.role === "guest" && !coop.ready) { coopGuestReady(pack); return; }
      if (!online) return;
      sharedMeta = { from: msg.from || online.friendName || "your friend", pack, kept: false };
      // the host's look: card frames, tokens, End Turn button, table, bartender, table design
      const stB = window.WA_STORE; if (online.role === "guest" && stB && stB.borrow) { stB.borrow(pack); applySkins(); applyTableDesign(); }
      // their pictures for this game
      const st = window.WA_STORE; if (st && st.preview) for (const [k, r] of Object.entries(pack.images || {})) if (r && r.tok && r.card) st.preview(k, r);
      renderTavern(); showKeepMeta();
      toast(`${sharedMeta.from}'s meta "${pack.name}" arrived. Keep it from the button at the top right.`);
    } catch (e) { report(e); }
  }
  function showKeepMeta() { const b = $("#btnKeepMeta"); if (!b) return; const on = !!(sharedMeta && !sharedMeta.kept); b.hidden = !on; if (on) b.textContent = `💾 ${T("Keep the meta of")} ${sharedMeta.from}`; }
  async function keepSharedMeta() {
    if (!sharedMeta || sharedMeta.kept) return;
    try { const st = window.WA_STORE; await st.importMeta(sharedMeta.pack, sharedMeta.from); sharedMeta.kept = true; showKeepMeta(); toast(`Meta "${sharedMeta.pack.name}" kept: pick it from the meta list on the main menu. It updates every time you keep it again.`); }
    catch (e) { report(e); toast("Could not keep the meta: " + (e.message || e)); }
  }
  // ---------------------------------------------------------------- building cards together
  // Two editors on one meta: the host's meta is copied to the friend first, then every save on either side
  // (cards, pictures, tribes, heroes, anomalies, skins) is sent to the other and applied there. Last save wins.
  let coop = null; // { link, me, friend, role, ready, applying, snap }
  const ST_WRAPPED = { done: false };
  function cardKey(r) { return (r.kind || "minion") + "|" + r.id; }
  function wrapStoreForCoop() {
    if (ST_WRAPPED.done || !window.WA_STORE) return; ST_WRAPPED.done = true;
    const ST = window.WA_STORE;
    const send = (op) => { if (coop && coop.link.open) coop.link.send(Object.assign({ t: "wop", from: coop.me }, op)); };
    const wrap = (name, before, after) => { const o = ST[name]; ST[name] = async function (...a) { const pre = coop && !coop.applying && before ? before(a) : null; const r = await o.apply(ST, a); if (coop && !coop.applying && after) { try { await after(a, r, pre); } catch (e) { report(e); } } return r; }; };
    const refOf = (id) => { const org = ST.skinOrigin(id); if (!org) return { from: coop.me, id }; const i = org.indexOf(":"); return { from: org.slice(0, i), id: org.slice(i + 1) }; };
    wrap("saveCards", null, async ([list]) => {
      const now = new Map(list.map((r) => [cardKey(r), JSON.stringify(r)])), was = coop.snap || new Map();
      for (const [k, j] of now) if (was.get(k) !== j) send({ op: "card", rec: JSON.parse(j) });
      for (const k of was.keys()) if (!now.has(k)) send({ op: "delCard", key: k });
      coop.snap = now;
    });
    wrap("saveImage", null, async ([key]) => send({ op: "img", key, rec: await ST.imageData(key) }));
    wrap("saveTribes", null, async ([list]) => send({ op: "tribes", list }));
    wrap("saveHeroes", null, async ([list]) => send({ op: "heroes", list }));
    wrap("saveAnomalies", null, async ([list]) => send({ op: "anomalies", list }));
    wrap("saveAffinities", null, async ([cfg]) => send({ op: "affinities", cfg: cfg || null }));
    wrap("saveKeywords", null, async ([list]) => send({ op: "keywords", list: list || null }));
    wrap("addSkin", null, async (a, id) => send({ op: "skin", ref: refOf(id), data: await ST.skinData(id) }));
    wrap("updateSkin", null, async ([id]) => send({ op: "skin", ref: refOf(id), data: await ST.skinData(id) }));
    wrap("renameSkin", null, async ([id]) => send({ op: "skin", ref: refOf(id), data: await ST.skinData(id) }));
    wrap("deleteSkin", ([id]) => refOf(id), async (a, r, ref) => send({ op: "delSkin", ref }));
    wrap("equipSkin", null, async ([kind, id]) => send({ op: "equip", kind, ref: !id ? null : id === "random" ? "random" : refOf(id) }));
  }
  function coopStart(link, me, friend, role) {
    wrapStoreForCoop();
    coop = { link, me, friend, role, ready: role === "host", applying: false, snap: new Map((window.WA_STORE.cards || []).map((r) => [cardKey(r), JSON.stringify(r)])) };
    link.onMessage(onCoop);
    link.onClose(() => { if (coop && coop.link === link) { coop = null; toast(`${friend} left the workshop. Your copy stays as it is.`); if (window.WA_EDITOR.setCoop) window.WA_EDITOR.setCoop(null); } });
    if (role === "host") coopOpenEditor();
  }
  async function coopGuestReady(pack) {
    try {
      const st = window.WA_STORE; const id = await st.importMeta(pack, coop.friend); await st.setActive(id);
      coop.ready = true; coop.snap = new Map((st.cards || []).map((r) => [cardKey(r), JSON.stringify(r)]));
      coopOpenEditor();
    } catch (e) { report(e); toast("Could not open the shared workshop: " + (e.message || e)); }
  }
  function coopOpenEditor() {
    closeModal();
    for (const id of ["#shop", "#board", "#hand"]) $(id).innerHTML = "";
    openEditor();
    if (window.WA_EDITOR.setCoop) window.WA_EDITOR.setCoop(coop.friend);
    toast(`Workshop with ${coop.friend}: every save shows up on both screens.`);
  }
  function coopStop() { if (!coop) return; const c = coop; coop = null; try { c.link.send({ t: "bye" }); c.link.close(); } catch (e) {} }
  const resolveRef = (ref) => { const st = window.WA_STORE; if (!ref || ref === "random") return ref; return ref.from === coop.me ? ref.id : st.findSkinByOrigin(ref.from + ":" + ref.id); };
  async function onCoop(msg) {
    if (!coop || !msg || !msg.t) return;
    if (msg.t === "mpack") { onMetaSlice(msg); return; }
    if (msg.t === "mimg") { onMetaImage(msg); return; }
    if (msg.t === "bye") { const f = coop.friend; coop = null; toast(`${f} closed the workshop. Your copy stays as it is.`); if (window.WA_EDITOR.setCoop) window.WA_EDITOR.setCoop(null); return; }
    if (msg.t !== "wop") return;
    const st = window.WA_STORE; coop.applying = true;
    try {
      let what = "";
      switch (msg.op) {
        case "card": { const k = cardKey(msg.rec); await st.saveCards(st.cards.filter((r) => cardKey(r) !== k).concat([msg.rec])); coop.snap.set(k, JSON.stringify(msg.rec)); what = `saved “${msg.rec.name || "a card"}”`; break; }
        case "delCard": { await st.saveCards(st.cards.filter((r) => cardKey(r) !== msg.key)); coop.snap.delete(msg.key); what = "deleted " + msg.key.split("|")[1]; break; }
        case "img": { await st.saveImage(msg.key, msg.rec); what = "a picture"; break; }
        case "tribes": { await st.saveTribes(msg.list); what = "the tribes"; break; }
        case "heroes": { await st.saveHeroes(msg.list); what = "the heroes"; break; }
        case "anomalies": { await st.saveAnomalies(msg.list); what = "the anomalies"; break; }
        case "affinities": { await st.saveAffinities(msg.cfg); what = "the affinities"; break; }
        case "keywords": { await st.saveKeywords(msg.list); what = "the keywords"; break; }
        case "skin": { const id = resolveRef(msg.ref); if (id) { await st.updateSkin(id, msg.data); await st.renameSkin(id, msg.data.name); } else await st.addSkin(msg.data.kind, msg.data.name, msg.data, msg.ref.from + ":" + msg.ref.id); what = "a skin"; break; }
        case "delSkin": { const id = resolveRef(msg.ref); if (id) await st.deleteSkin(id); what = "deleted a skin"; break; }
        case "equip": { await st.equipSkin(msg.kind, resolveRef(msg.ref)); applySkins(); what = "the equipped skins"; break; }
      }
      if (window.WA_EDITOR.refresh) window.WA_EDITOR.refresh(msg);
      if (what) toast(`${msg.from}: ${what}.`);
    } catch (e) { report(e); }
    coop.applying = false;
  }
  // everything the guest needs to deal the very same game
  function makeSetup(hostName, guestName) {
    const st = window.WA_STORE, AL = window.WA.ANOMALY_LIST;
    const anomaly = profile.mode === "anomaly" && AL.length ? AL[Math.floor(Math.random() * AL.length)] : null;
    return { seed: Math.floor(Math.random() * 1e9), mmr: profile.mmr, anomaly, pace: profile.pace || "normal", names: { 0: hostName, 1: guestName },
      meta: st ? { cards: st.cards, tribes: st.tribes || null, heroes: st.heroes || null, anomalies: st.anomalies || null, affinities: st.affinities || null, keywords: st.keywords || null, blank: !!(st.meta && st.meta.blank) } : null };
  }
  function beginOnline(link, setup, role) {
    closeModal();
    if (role === "guest" && setup.meta) guestPlayed = true;
    if (role === "guest" && setup.meta) window.WA.registerCustom(setup.meta.cards || [], { tribes: setup.meta.tribes || undefined, heroes: setup.meta.heroes || undefined, anomalies: setup.meta.anomalies || undefined, affinities: setup.meta.affinities || undefined, keywords: setup.meta.keywords || undefined, blank: setup.meta.blank });
    if (role === "guest" && !guestLocal) {
      // the host's game: none of this browser's own pictures, skins or table until the game is over (the host's arrive in a moment)
      const st = window.WA_STORE;
      if (st) { for (const k of Object.keys(st.IMAGES || {})) delete st.IMAGES[k]; if (st.borrow) st.borrow({}); }
      metaImgs = {}; metaRx = null;
    }
    applyTableBg(); applyKeeper(); applyCardSkin(); applyTableDesign();
    const seat = role === "host" ? 0 : 1;
    game = new Game(8, setup.seed, true, { mmr: setup.mmr, anomaly: setup.anomaly, duo: true, humans: [0, 1], names: setup.names, pace: setup.pace });
    you = game.players[seat];
    $("#shop").dataset.mode = "";
    online = { role, seat, friendSeat: 1 - seat, friendName: setup.names[1 - seat], link, sent: 0, applied: 0, queue: [], later: [], meReady: false, peerReady: null };
    hookActions(game);
    link.onMessage(onNet);
    link.onClose(() => friendLeft());
    renderAnomChip(); renderTribeList(); busy = false;
    game.startTurn();
    netSend({ t: "fp", turn: game.turn, fp: game.fingerprint() });
    stage.classList.remove("combat");
    renderTavern();
    toast(`Playing with ${online.friendName}. You share one Health pool.`);
    if (you.heroChoices && you.heroChoices.length > 1) chooseHero();
    else if (game.anomaly) showAnomaly(startTurnUI);
    else startTurnUI();
  }
  window.addEventListener("beforeunload", () => { if (online) netSend({ t: "bye" }); });

  // The card editor's "watch it fight": your board vs. a sparring partner, played on the real table.
  async function previewFight(o) {
    if (busy || !game || !you) return "The table is busy.";
    const W = window.WA;
    const c = new W.Combat();
    const r = c.simulate(o.mine, o.theirs, o.tier || 1, o.tier || 1, W.makeRng(o.seed || Math.floor(Math.random() * 1e9)), 99, [null, null], null, { turn: (o.tier || 1) + 2, health: [30, 30] });
    const oppObj = { id: -1, name: o.oppName || "Trainer", hue: 200, hero: "", alive: true, armor: 0, tier: o.tier || 1, streak: 0, isBot: true };
    const f = { a: you.id, b: -1, bName: oppObj.name, oppObj, winner: r.winner, damage: r.damage, events: r.events, hpBefore: [you.health, 30] };
    busy = true; hideTip(); stopTimer();
    const wasModal = !$("#modal").hidden; if (wasModal) $("#modal").hidden = true;
    const preView = game.players.map(viewOf);
    try { await playCombat(f, preView); } catch (err) { report(err); leaveCombat(); }
    // back to the tavern layout, quietly (no banner, no timer), then whoever called us takes over
    busy = false;
    stage.classList.remove("combat");
    $("#shop").hidden = false; $("#enemyRow").hidden = true; $("#board").hidden = false; $("#cmine").hidden = true; $("#ehero").hidden = true; $("#combatCtrl").hidden = true;
    renderTavern();
    if (wasModal) $("#modal").hidden = false;
    return r.winner === 0 ? "win" : r.winner === 1 ? "loss" : "draw";
  }

  // Exposed for automated tests.
  { const h = document.getElementById("hand"); if (h) { h.addEventListener("pointerenter", () => stage.classList.add("hand-hover")); h.addEventListener("pointerleave", () => stage.classList.remove("hand-hover")); } }
  window.WA_UI = { get profileName() { return profile.name || ""; }, sayQuip, QUIP_CHANCE, get lastQuip() { return lastQuip; }, previewFight, lookSound, enterFx, rich, playSound, get sfxNames() { return Object.keys(sfx).filter((k) => typeof sfx[k] === "function"); }, get game() { return game; }, get you() { return you; }, endTurn, get busy() { return busy; }, toStage, rectOf, profile, renderTavern, showEvolveChoice, applyTableDesign, reactProp, TABLE_EL, setDecor, get decor() { return decorOf(); }, get scale() { return scale; }, set tableEditing(v) { tableEditing = !!v; const g = document.getElementById("pressureGauge"); if (g) g._key = null; if (you && game) renderPressure(); }, get tableEditing() { return tableEditing; }, newGame, startTurnUI, get stageEl() { return stage; } };
  build();
})();
