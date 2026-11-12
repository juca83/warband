// ===================================================================
// Warband Arena - the "Look" part of the creation studio: visual effects, interface theme,
// bartender and texts, sounds and music, menus and screens, frames by tribe, card back, rules.
// Everything is one object per meta (WA_STORE.style, saved with saveStyle) applied live by style.js.
// Labels are English; i18n.js shows them in French.
// ===================================================================
(function (root) {
  "use strict";
  let A = null; // the studio api from editor.js: { W, ST, esc, status, helpers, root, el, ... }
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o || {}));
  const getStyle = () => clone(A.ST.ownStyle || {});
  let saveT = 0, pendingCfg = null;
  // saves at once (on change) or a moment later (while a slider moves)
  function save(cfg, later) {
    pendingCfg = cfg;
    clearTimeout(saveT);
    const go = async () => { const c = pendingCfg; pendingCfg = null; try { await A.ST.saveStyle(c); } catch (e) { A.status("Could not save: " + (e.message || e), "err"); } };
    if (later) saveT = setTimeout(go, 280); else return go();
  }
  const fileData = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
  // a picture, shrunk to max px on its long side, as WebP
  function picData(f, max) {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)); const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k)); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(im.src); res(c.toDataURL("image/webp", 0.88)); }; im.onerror = rej; im.src = URL.createObjectURL(f); });
  }
  async function audioData(f, maxBytes) {
    if (!f || !/^audio\//.test(f.type)) { A.status("That is not an audio file.", "err"); return null; }
    if (f.size > maxBytes) { A.status(`That file is too big (${Math.round(maxBytes / 1e5) / 10} MB max).`, "err"); return null; }
    return fileData(f);
  }
  const rng = (k, v, min, max, step, label, fmt) => `<label class="st-f"><span>${esc(label)} <b>${fmt ? fmt(v) : v}</b></span><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${v}"></label>`;
  const col = (k, v, label) => `<label class="st-col"><input type="color" data-k="${k}" value="${esc(v)}"><span>${esc(label)}</span></label>`;
  const sel = (k, pairs, v, label) => `<label class="st-f"><span>${esc(label)}</span><select data-k="${k}">${pairs.map(([x, l]) => `<option value="${esc(x)}"${String(x) === String(v) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
  const txt = (k, v, label, ph, max = 60) => `<label class="st-f wide"><span>${esc(label)}</span><input type="text" data-k="${k}" value="${esc(v || "")}" placeholder="${esc(ph || "")}" maxlength="${max}"></label>`;
  const chk = (k, v, label) => `<label class="ce-check"><input type="checkbox" data-k="${k}" ${v ? "checked" : ""}> ${esc(label)}</label>`;
  const pct = (v) => Math.round(v * 100) + "%";
  const valOf = (t) => (t.type === "checkbox" ? t.checked : t.type === "range" || t.type === "number" ? +t.value : t.value);
  const fr = () => !!(root.WA_I18N && root.WA_I18N.lang === "fr");

  // ---------------------------------------------------------------- visual effects
  const FX_PRESETS = {
    fire: { name: "Fireball", c1: "#ff7a2a", c2: "#ffd25a", c3: "#fff2b0", travel: "comet", trail: "embers", shape: "drop", count: 18, gravity: 200, rings: 1, smoke: 6, shake: 2 },
    frost: { name: "Ice shard", c1: "#8fd3ff", c2: "#e3f6ff", c3: "#ffffff", travel: "spin", trail: "flakes", shape: "shard", count: 22, rings: 2, ringSize: 70 },
    storm: { name: "Storm", c1: "#7fa8ff", c2: "#bcd2ff", c3: "#ffffff", travel: "bolt", trail: "none", shape: "line", count: 26, pspeed: 480, flash: 0.18, rings: 2, shake: 3 },
    arcane: { name: "Arcane", c1: "#b45cff", c2: "#ff8af0", c3: "#ffffff", travel: "orb", trail: "stars", shape: "star", count: 24, rays: 10, rings: 1 },
    poison: { name: "Venom", c1: "#9be05a", c2: "#c8ff8a", c3: "#ffffff", travel: "orb", trail: "bubbles", shape: "bubble", count: 18, gravity: -60, smoke: 4 },
    holy: { name: "Sunlight", c1: "#ffe08a", c2: "#fff6c8", c3: "#ffffff", travel: "sky", shape: "star", count: 20, rays: 14, beam: true, flash: 0.12 },
    shadow: { name: "Shadow", c1: "#6a3ab0", c2: "#2a1550", c3: "#d6b8ff", travel: "comet", trail: "smoke", shape: "smoke", count: 14, smoke: 10, glow: 60 },
    rock: { name: "Boulder", c1: "#a98462", c2: "#6a4a30", c3: "#e0c8a0", travel: "orb", arc: 90, size: 18, ribbon: false, trail: "smoke", shape: "chunk", count: 16, gravity: 800, shake: 7, rings: 1 },
    nature: { name: "Thorns", c1: "#4fbf5a", c2: "#a6e870", c3: "#ffffff", travel: "arrow", trail: "leaves", shape: "leaf", count: 16, gravity: 300 },
  };
  const MOMENTS = [["land", "A minion lands on the board"], ["death", "A minion dies"], ["summonfx", "A minion is summoned in combat"], ["spellcast", "A spell is cast"], ["spellhit", "A spell hits a minion"], ["evolve", "Evolution"], ["shieldpop", "A Shield breaks"], ["herohit", "A hero is hit"], ["triple", "A golden minion is made"], ["upgrade", "The tavern is upgraded"], ["buy", "A minion is bought"], ["sell", "A minion is sold"]];
  const SHAPE_NAME = { image: "Your picture", glow: "Glow", star: "Stars", shard: "Shards", chunk: "Rocks", drop: "Drops", bubble: "Bubbles", flake: "Snowflakes", leaf: "Leaves", line: "Sparks", plus: "Plus signs", smoke: "Smoke", popb: "Popping bubbles" };
  const TRAVEL_NAME = { none: "No travel (hits on the spot)", orb: "Orb", comet: "Comet", bolt: "Lightning bolt", arrow: "Arrow", spin: "Spinning star", sky: "Beam from the sky" };
  const TRAIL_NAME = { none: "No trail", sparks: "Sparks", embers: "Embers", smoke: "Smoke", bubbles: "Bubbles", flakes: "Snowflakes", leaves: "Leaves", stars: "Stars" };
  let fxSel = null;
  function soundPairs() { const ks = root.WA_UI && root.WA_UI.sfxNames ? root.WA_UI.sfxNames : []; return [["", "The style's whoosh"], ...ks.map((k) => [k, k])]; }
  function renderFx(host) {
    const cfg = getStyle(), list = cfg.fx || [];
    if (fxSel && !list.some((f) => f.id === fxSel)) fxSel = null;
    if (!fxSel && list.length) fxSel = list[0].id;
    const f = list.find((x) => x.id === fxSel), o = f ? root.WA_FXE.fxSpec(f) : null;
    const ids = list.map((x) => [x.id, x.name || "Effect"]);
    host.innerHTML = `<div class="st-head"><h3>Visual effects</h3><p class="ce-hint">Design your own effects. Pick them as a card's <b>Attack style</b>, as the <b>Look</b> of an effect, or for the table moments below.</p></div>
      <div class="st-fx">
        <aside class="st-fxlist">
          ${list.map((x) => `<button type="button" class="st-fxitem${x.id === fxSel ? " on" : ""}" data-fx="${esc(x.id)}"><i style="background:linear-gradient(135deg, ${esc(x.c1 || "#ff9a3a")}, ${esc(x.c2 || "#ffd25a")})"></i>${esc(x.name || "Effect")}</button>`).join("") || `<p class="ce-hint">No effect of your own yet.</p>`}
          <div class="st-sub">New effect from</div>
          <div class="st-presets">${Object.entries(FX_PRESETS).map(([k, p]) => `<button type="button" class="st-preset" data-fxnew="${k}" style="--a:${p.c1};--b:${p.c2}">${esc(p.name)}</button>`).join("")}</div>
        </aside>
        <section class="st-fxform">${o ? fxForm(o) : `<div class="ce-sec"><p class="ce-hint">Start from one of the models on the left: every part can be changed afterwards.</p></div>`}</section>
        <aside class="st-fxpv"><div class="st-fxstage" id="stFxStage"></div>
          <div class="ce-row"><button type="button" class="pill big" id="stFxPlay"${o ? "" : " disabled"}>▶ Play</button></div>
          <p class="ce-hint">The effect flies from the left minion to the right one.</p></aside>
      </div>
      <div class="ce-sec st-moments"><h3>Table moments</h3><p class="ce-hint">Replace the built-in effect of a moment of the game with one of yours.</p>
        <div class="st-momgrid">${MOMENTS.map(([k, l]) => `<div class="st-mom"><span>${esc(l)}</span>${sel("mom:" + k, [["", "Built-in"], ...ids], (cfg.moments || {})[k] || "", "")}<button type="button" class="ce-mini play" data-momplay="${k}" title="Preview">▶</button></div>`).join("")}</div></div>`;
    // the two minions of the preview
    const stg = $("#stFxStage", host), ids2 = Object.keys(A.W.CARDS).filter((k) => A.W.CARDS[k].inPool !== false).slice(0, 2);
    if (A.helpers.makeToken && ids2.length === 2) for (const id of ids2) { const t = A.helpers.makeToken(A.W.Minion.preview ? A.W.Minion.preview(id).dict() : new A.W.Minion(id).dict(), { static: true }); stg.appendChild(t); }
    host.onclick = async (e) => {
      const t = e.target, b = t.closest("button"); if (!b) return;
      if (b.dataset.fx) { fxSel = b.dataset.fx; renderFx(host); return; }
      if (b.dataset.fxnew) { const c = getStyle(), id = "fx" + Date.now().toString(36), p = Object.assign({}, FX_PRESETS[b.dataset.fxnew]); p.id = id; p.name = (fr() ? { fire: "Boule de feu", frost: "Éclat de glace", storm: "Tempête", arcane: "Arcanes", poison: "Venin", holy: "Lumière solaire", shadow: "Ombre", rock: "Rocher", nature: "Épines" }[b.dataset.fxnew] : p.name) || p.name; c.fx = (c.fx || []).concat([p]); fxSel = id; await save(c); renderFx(host); playSel(); A.status("Effect created: change it on the right, it saves by itself."); return; }
      if (b.id === "stFxPlay") { playSel(); return; }
      if (b.id === "stFxDup" && fxSel) { const c = getStyle(), src = (c.fx || []).find((x) => x.id === fxSel); if (!src) return; const n = Object.assign({}, src, { id: "fx" + Date.now().toString(36), name: (src.name + " 2").slice(0, 24) }); c.fx.push(n); fxSel = n.id; await save(c); renderFx(host); return; }
      if (b.id === "stFxDel" && fxSel) { if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = fr() ? "Supprimer ? Cliquez encore" : "Delete? Click again"; return; } const c = getStyle(); c.fx = (c.fx || []).filter((x) => x.id !== fxSel); for (const k of Object.keys(c.moments || {})) if (c.moments[k] === fxSel) delete c.moments[k]; fxSel = null; await save(c); renderFx(host); return; }
      if (b.dataset.momplay) { const tok = stg.querySelectorAll(".mn")[1]; if (!tok || !root.WA_FXE) return; root.WA_FXE.impact(b.dataset.momplay, rect(tok), { h: 120 }); return; }
      if (b.dataset.imgdel) { const c = getStyle(), x = (c.fx || []).find((y) => y.id === fxSel); if (x) { delete x[b.dataset.imgdel]; if (b.dataset.imgdel === "partImg" && x.shape === "image") x.shape = "glow"; root.WA_FXE.define(x.id, x); await save(c); renderFx(host); } return; }
      if (b.dataset.sndclear) { const c = getStyle(), x = (c.fx || []).find((y) => y.id === fxSel); if (x) { delete x.sound; await save(c); renderFx(host); } }
    };
    host.oninput = host.onchange = async (e) => {
      const t = e.target;
      if (t.dataset && t.dataset.img) { if (e.type !== "change" || !t.files[0]) return; const which = t.dataset.img; let d; try { d = await picData(t.files[0], which === "impactImg" ? 512 : 256); } catch (x) { A.status("That picture could not be read.", "err"); return; }
        const c = getStyle(), x = (c.fx || []).find((y) => y.id === fxSel); if (!x) return; x[which] = d; if (which === "partImg") x.shape = "image"; root.WA_FXE.define(x.id, x); await save(c); renderFx(host); setTimeout(playSel, 150); return; }
      const k = t.dataset && t.dataset.k; if (!k) return;
      if (t.type === "file") { if (e.type !== "change") return; const d = await audioData(t.files[0], 2000000); if (!d) return; const c = getStyle(), x = (c.fx || []).find((y) => y.id === fxSel); if (x) { x.sound = d; await save(c); renderFx(host); } return; }
      const c = getStyle();
      if (k.startsWith("mom:")) { if (e.type !== "change") return; c.moments = c.moments || {}; if (t.value) c.moments[k.slice(4)] = t.value; else delete c.moments[k.slice(4)]; await save(c); return; }
      const x = (c.fx || []).find((y) => y.id === fxSel); if (!x) return;
      x[k] = valOf(t);
      if (t.type === "range") { const lb = t.parentElement.querySelector("b"); if (lb) lb.textContent = fmtFx(k, x[k]); }
      root.WA_FXE.define(x.id, x); // live, before the save lands
      await save(c, e.type === "input");
      if (e.type === "change" && (t.tagName === "SELECT" || t.type === "checkbox" || k === "name")) { if (k === "name") { const it = host.querySelector(`.st-fxitem[data-fx="${fxSel}"]`); if (it) it.lastChild.textContent = x.name; } else { renderFx(host); } }
      if (e.type === "change" && k !== "name") playSel();
    };
    function playSel() { if (!fxSel || !root.WA_FX) return; const ts = stg.querySelectorAll(".mn"); if (ts.length < 2) return; const c = getStyle(), x = (c.fx || []).find((y) => y.id === fxSel); if (x) root.WA_FXE.define(x.id, x); if (root.WA_FX.FX[fxSel] || x) { const st = root.WA_FX.FX[fxSel]; if (st) root.WA_FX.play(fxSel, ts[0], ts[1]); else root.WA_FXE.play(fxSel, rect(ts[0]), rect(ts[1])); } }
  }
  // a rectangle in table coordinates (the stage is scaled to the window)
  function rect(e) { const st = document.getElementById("stage"), s = st.getBoundingClientRect(), k = s.width / 1280, r = e.getBoundingClientRect(); return { x: (r.left + r.width / 2 - s.left) / k, y: (r.top + r.height / 2 - s.top) / k }; }
  const fmtFx = (k, v) => (["speed", "life"].includes(k) ? (+v).toFixed(2) + " s" : k === "flash" ? pct(v) : String(Math.round(v)));
  function fxForm(o) {
    const T = root.WA_FXE;
    return `<div class="ce-sec"><h3>${esc(o.name || "Effect")}</h3>
        <div class="st-grid2">${txt("name", o.name, "Name", "", 24)}<div class="st-cols">${col("c1", o.c1, "Main")}${col("c2", o.c2, "Second")}${col("c3", o.c3, "Core")}</div></div>
        <div class="ce-row"><button type="button" class="pill small" id="stFxDup">Duplicate</button><button type="button" class="pill small danger" id="stFxDel">Delete</button></div></div>
      <div class="ce-sec"><h3>Travel</h3><div class="st-grid2">
        ${sel("travel", T.FX_TRAVELS.map((x) => [x, TRAVEL_NAME[x]]), o.travel, "How it flies")}${sel("trail", T.FX_TRAILS.map((x) => [x, TRAIL_NAME[x]]), o.trail, "Trail")}
        ${rng("speed", o.speed, 0.1, 1.2, 0.01, "Travel time", (v) => (+v).toFixed(2) + " s")}${rng("arc", o.arc, -120, 160, 1, "Curve")}
        ${rng("size", o.size, 4, 40, 1, "Size")}${chk("ribbon", o.ribbon, "Light ribbon behind it")}</div></div>
      <div class="ce-sec"><h3>Impact</h3><div class="st-grid2">
        ${rng("glow", o.glow, 0, 140, 1, "Glow")}${rng("flash", o.flash, 0, 0.4, 0.01, "Screen flash", pct)}
        ${rng("rings", o.rings, 0, 4, 1, "Shock rings")}${rng("ringSize", o.ringSize, 30, 220, 1, "Ring size")}
        ${rng("rays", o.rays, 0, 24, 1, "Light rays")}${chk("beam", o.beam, "Pillar of light")}
        ${rng("shake", o.shake, 0, 14, 1, "Table shake")}</div></div>
      <div class="ce-sec"><h3>Particles</h3>
        <div class="ce-chips">${T.FX_SHAPES.map((x) => `<label class="ce-chip"><input type="radio" name="stShape" data-k="shape" value="${x}" ${o.shape === x ? "checked" : ""}><span>${esc(SHAPE_NAME[x] || x)}</span></label>`).join("")}</div>
        <div class="st-grid2">${rng("count", o.count, 0, 80, 1, "How many")}${rng("pspeed", o.pspeed, 20, 700, 5, "Speed")}
        ${rng("psize", o.psize, 1, 30, 1, "Size")}${rng("life", o.life, 0.15, 2, 0.05, "Lifetime", (v) => (+v).toFixed(2) + " s")}
        ${rng("gravity", o.gravity, -600, 1200, 10, "Gravity (− floats up)")}${sel("spread", [["all", "All around"], ["up", "Upwards"], ["down", "Downwards"], ["fan", "A fan upwards"]], o.spread, "Direction")}
        ${rng("smoke", o.smoke, 0, 30, 1, "Smoke puffs")}</div></div>
      <div class="ce-sec st-fximgs"><h3>Your pictures</h3><p class="ce-hint">PNG with transparency (or any picture). The projectile flies instead of the glowing orb, the impact picture bursts where it hits, the particle picture replaces the particle shape. Leave a slot empty to keep the drawn effect.</p>
        <div class="st-imgslots">${[["projImg", "Projectile"], ["impactImg", "Impact"], ["partImg", "Particles"]].map(([k, l]) => `<div class="st-imgslot"><b>${l}</b><div class="st-imgpv"${o[k] ? ` style="background-image:url('${o[k]}')"` : ""}>${o[k] ? "" : "—"}</div>
          <div class="ce-row"><label class="pill small st-up">${o[k] ? "Replace" : "Import"}<input type="file" accept="image/*" data-img="${k}" hidden></label>${o[k] ? `<button type="button" class="pill small danger" data-imgdel="${k}">Remove</button>` : ""}</div></div>`).join("")}</div>
        <div class="st-grid2">${o.projImg ? sel("projRot", [["aim", "Points where it flies"], ["spin", "Spins"], ["none", "Stays upright"]], o.projRot, "Projectile") + rng("projSize", o.projSize, 12, 240, 1, "Projectile size") : ""}
        ${o.impactImg ? rng("impSize", o.impSize, 30, 500, 1, "Impact size") + rng("impLife", o.impLife, 0.2, 2, 0.05, "Impact time", (v) => (+v).toFixed(2) + " s") + chk("impSpin", o.impSpin, "The impact picture turns") : ""}
        ${o.partImg ? `<p class="ce-hint">Pick the <b>Your picture</b> shape in Particles to use it.</p>` : ""}</div></div>
      <div class="ce-sec"><h3>Sound</h3><div class="st-grid2">${o.sound && /^data:/.test(o.sound) ? `<p class="ce-hint">Your clip plays with it. <button type="button" class="pill small" data-sndclear="1">Remove</button></p>` : sel("sound", soundPairs(), o.sound || "", "Sound")}
        <label class="pill small st-up">Import a clip (2 MB max)<input type="file" accept="audio/*" data-k="soundfile" hidden></label></div></div>`;
  }

  // ---------------------------------------------------------------- interface theme
  const THEME_LABEL = { bg: "Background", surface: "Panels", surface2: "Raised panels", text: "Text", mist: "Soft text", accent: "Accent", accentHi: "Accent light", accentDk: "Accent dark", danger: "Danger", tableTop: "Table, top", tableMid: "Table, middle", tableBot: "Table, bottom", tableGlow: "Table light" };
  function renderTheme(host) {
    const S = root.WA_STYLE, cfg = getStyle(), th = cfg.theme || {}, cur = S.themeOf(th), P = S.PRESETS;
    host.innerHTML = `<div class="st-head"><h3>Interface theme</h3><p class="ce-hint">Colours, fonts and buttons of the whole game for this meta. Everything around you changes as you edit: the studio is the preview.</p></div>
      <div class="ce-sec"><h3>Starting point</h3><div class="st-themes">${Object.entries(P).map(([k, p]) => { const t = Object.assign({}, S.THEME_DEF, p.t); return `<button type="button" class="st-theme${(th.preset || "classic") === k ? " on" : ""}" data-preset="${k}" style="--bg:${t.bg};--sf:${t.surface};--ac:${t.accent};--tx:${t.text}"><i><b></b><em></em></i><span>${esc(p.name[fr() ? 1 : 0])}</span></button>`; }).join("")}</div></div>
      <div class="ce-sec"><h3>Colours</h3><div class="st-cols wrap">${Object.keys(THEME_LABEL).map((k) => col("c:" + k, cur[k], THEME_LABEL[k])).join("")}</div></div>
      <div class="ce-sec"><h3>Fonts</h3><div class="st-grid2">
        ${sel("fontDisplay", [...S.FONTS_DISPLAY.map((f) => [f, f]), ...(th.font && th.font.data ? [["__upload", "Your font"]] : [])], th.font && th.font.data && th.font.use === "display" ? "__upload" : cur.fontDisplay, "Titles")}
        ${sel("fontBody", [...S.FONTS_BODY.map((f) => [f, f]), ...(th.font && th.font.data ? [["__upload", "Your font"]] : [])], th.font && th.font.data && th.font.use === "body" ? "__upload" : cur.fontBody, "Text")}
        <div class="st-fontpv"><b style="font-family:${esc(th.font && th.font.use === "display" && th.font.data ? "WA Custom Font" : cur.fontDisplay)}, serif">The Tavern</b><span style="font-family:${esc(th.font && th.font.use === "body" && th.font.data ? "WA Custom Font" : cur.fontBody)}, sans-serif">Buy, play, fight.</span></div>
        <div><label class="pill small st-up">Import a font (TTF, OTF, WOFF2 · 800 KB max)<input type="file" accept=".ttf,.otf,.woff,.woff2,font/*" data-k="fontfile" hidden></label>${th.font && th.font.data ? ` <button type="button" class="pill small" id="stFontDel">Remove my font</button>` : ""}</div>
      </div><p class="ce-hint">The listed fonts come from Google Fonts and need an internet connection the first time.</p></div>
      <div class="ce-sec"><h3>Buttons and corners</h3><div class="ce-chips">${[["solid", "Solid"], ["glass", "Glass"], ["outline", "Outline"]].map(([v, l]) => `<label class="ce-chip"><input type="radio" name="stBtn" data-k="buttons" value="${v}" ${cur.buttons === v ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>
        <div class="ce-chips">${[["round", "Round"], ["soft", "Soft"], ["sharp", "Sharp"]].map(([v, l]) => `<label class="ce-chip"><input type="radio" name="stCorner" data-k="corners" value="${v}" ${cur.corners === v ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>
        <div class="st-btnpv"><button type="button" class="pill big">Open the tavern</button><button type="button" class="pill">Collection</button></div></div>
      <div class="ce-row"><button type="button" class="pill" id="stThemeReset">Back to the built-in look</button></div>`;
    host.onclick = async (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.preset) { const c = getStyle(); c.theme = { preset: b.dataset.preset, font: (c.theme || {}).font }; await save(c); renderTheme(host); return; }
      if (b.id === "stThemeReset") { const c = getStyle(); delete c.theme; await save(c); renderTheme(host); return; }
      if (b.id === "stFontDel") { const c = getStyle(); if (c.theme) delete c.theme.font; await save(c); renderTheme(host); }
    };
    host.oninput = host.onchange = async (e) => {
      const t = e.target, k = t.dataset && t.dataset.k; if (!k) return;
      const c = getStyle(); c.theme = c.theme || {}; c.theme.custom = c.theme.custom || {};
      if (k === "fontfile") { if (e.type !== "change" || !t.files[0]) return; if (t.files[0].size > 800000) { A.status("That font is too big (800 KB max).", "err"); return; } c.theme.font = { data: await fileData(t.files[0]), name: t.files[0].name, use: "display" }; await save(c); renderTheme(host); A.status("Font imported: it is used for the titles. Pick it for the text too if you like."); return; }
      if (k.startsWith("c:")) { c.theme.custom[k.slice(2)] = t.value; await save(c, e.type === "input"); return; }
      if (t.type === "radio" && !t.checked) return;
      if (k === "fontDisplay" || k === "fontBody") { if (t.value === "__upload") { if (c.theme.font) c.theme.font.use = k === "fontDisplay" ? "display" : "body"; } else { c.theme.custom[k] = t.value; if (c.theme.font && c.theme.font.use === (k === "fontDisplay" ? "display" : "body")) c.theme.font.use = k === "fontDisplay" ? "body" : "display"; } await save(c); renderTheme(host); return; }
      c.theme.custom[k] = t.value; await save(c);
    };
  }

  // ---------------------------------------------------------------- bartender and texts
  const QUIP_CATS = [["turn", "A new turn"], ["upgrade", "You upgrade the tavern"], ["tier6", "Tavern tier 6"], ["triple", "A golden minion"], ["roll", "You refresh"], ["spell", "You cast a spell"], ["sell", "You sell"], ["winStreak", "Win streak"], ["loseStreak", "Losing streak"], ["low", "Low Health"]];
  const QUIP_DEF = { turn: "Fresh faces at the counter today.\nCoin talks. Spend it.\nWho's buying?", upgrade: "Better stock, better company.\nUp we go!", tier6: "The finest the tavern has to offer.", triple: "Three of a kind! Golden!", roll: "Next!\nNot your type? Fair.", spell: "A bit of magic never hurt.", sell: "I'll find them a new home.", winStreak: "They can't stop you!", loseStreak: "Rough nights happen. Rally!", low: "You're running on fumes, friend." };
  let txtQuery = "";
  const VOICE_MAX = 8;
  function renderTexts(host) {
    const cfg = getStyle(), T = cfg.texts || {}, q = T.quips || {}, ov = T.overrides || {}, vo = T.voices || {};
    const voiceRow = (k) => { const l = vo[k] || [], own = (q[k] || []).length, match = l.length && own === l.length;
      return `<div class="st-voices"><span class="st-vlab">🎙 ${esc(fr() ? "Voix" : "Voice")}</span>${l.map((v, i) => `<span class="st-voice"><button type="button" class="ce-mini play" data-vplay="${k}:${i}" title="${esc(fr() ? "Écouter" : "Listen")}">▶ ${i + 1}</button><button type="button" class="ce-mini del" data-vdel="${k}:${i}" title="${esc(fr() ? "Retirer" : "Remove")}">✕</button></span>`).join("")}
        ${l.length < VOICE_MAX ? `<label class="pill small">${esc(fr() ? "+ Importer" : "+ Import")}<input type="file" accept="audio/*" multiple data-vfile="${k}" hidden></label>` : ""}
        ${l.length > 1 ? `<small class="st-vnote">${esc(match ? (fr() ? "une voix par réplique, dans l'ordre" : "one voice per line, in order") : (fr() ? "une voix au hasard" : "a random voice"))}</small>` : ""}</div>`; };
    const ch = T.chance || {}, defCh = (root.WA_UI && root.WA_UI.QUIP_CHANCE) || {};
    const chanceRow = (k) => { const v = ch[k] != null ? +ch[k] : defCh[k] != null ? defCh[k] : 100;
      return `<label class="st-chance"><span>${esc(fr() ? "Chance de parler" : "Chance to speak")} <b>${v}%</b>${ch[k] != null && ch[k] !== defCh[k] ? "" : ` <small>${esc(fr() ? "(par défaut)" : "(default)")}</small>`}</span><input type="range" data-k="ch:${k}" min="0" max="100" step="5" value="${v}"></label>`; };
    const dict = root.WA_I18N ? root.WA_I18N.DICT : {};
    const hits = txtQuery.length >= 2 ? Object.keys(dict).filter((k) => (k + " " + dict[k]).toLowerCase().includes(txtQuery.toLowerCase())).slice(0, 14) : [];
    host.innerHTML = `<div class="st-head"><h3>Bartender and texts</h3><p class="ce-hint">What the bartender says, and any text of the interface rewritten your way.</p></div>
      <div class="ce-sec"><h3>The bartender</h3>
        ${rng("talk", T.talk == null ? 1 : T.talk, 0, 1, 0.05, "Talks", (v) => (+v === 0 ? (fr() ? "jamais" : "never") : pct(v)))}
        <div class="ce-row"><button type="button" class="pill small" id="stKeeperSkins">Bartender pictures…</button></div>
        <p class="ce-hint">One line per sentence; a random one is picked. Empty = the built-in lines.</p>
        <p class="ce-hint">“Chance to speak”: how often the bartender says something at that moment (0% = never). “Talks” above applies on top of it, to every moment.</p>
        <p class="ce-hint">Voices: import recordings (MP3, OGG, WAV · 2 MB max each, ${VOICE_MAX} per moment). When the bartender talks, one plays. With as many voices as lines of your own, line 1 speaks with voice 1, line 2 with voice 2… otherwise a random voice of that moment plays. The bubble stays up while the voice speaks.</p>
        ${rng("voiceVol", T.voiceVol == null ? 1 : T.voiceVol, 0, 1, 0.05, "Voice volume", pct)}
        <div class="st-quips">${QUIP_CATS.map(([k, l]) => `<div class="st-quip"><label class="st-f"><span>${esc(l)}</span><textarea data-k="q:${k}" rows="3" placeholder="${esc(QUIP_DEF[k] || "")}">${esc((q[k] || []).join("\n"))}</textarea></label>${chanceRow(k)}${voiceRow(k)}</div>`).join("")}</div></div>
      <div class="ce-sec"><h3>Rewrite a text</h3>
        <p class="ce-hint">Search a text of the game (in English or French), then type yours. It replaces it everywhere for this meta.</p>
        <input type="search" id="stTxtSearch" placeholder="${esc(fr() ? "ex. Fin du tour, Taverne, Or…" : "e.g. End Turn, Tavern, gold…")}" value="${esc(txtQuery)}">
        <div class="st-hits">${hits.map((k) => `<button type="button" class="st-hit" data-ovadd="${esc(k)}"><b>${esc(fr() ? dict[k] : k)}</b>${fr() ? `<small>${esc(k)}</small>` : ""}</button>`).join("")}</div>
        <div class="st-ovs">${Object.entries(ov).map(([k, v]) => `<div class="st-ov"><span title="${esc(k)}">${esc(fr() && dict[k] ? dict[k] : k)}</span><b>→</b><input type="text" data-ov="${esc(k)}" value="${esc(v)}" maxlength="120"><button type="button" class="ce-mini del" data-ovdel="${esc(k)}">✕</button></div>`).join("") || `<p class="ce-hint">No text rewritten yet.</p>`}</div>
        <div class="st-ov new"><input type="text" id="stOvFrom" placeholder="${esc(fr() ? "Texte exact affiché" : "Exact text shown")}"><b>→</b><input type="text" id="stOvTo" placeholder="${esc(fr() ? "Votre texte" : "Your text")}"><button type="button" class="pill small" id="stOvAdd">Add</button></div></div>`;
    const sb = $("#stTxtSearch", host);
    sb.addEventListener("input", () => { txtQuery = sb.value; const pos = sb.selectionStart; renderTexts(host); const n = $("#stTxtSearch", host); n.focus(); n.setSelectionRange(pos, pos); });
    sb.addEventListener("keydown", (e) => e.stopPropagation());
    host.onclick = async (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.id === "stKeeperSkins") { A.goSkins("bartender"); return; }
      if (b.dataset.vplay) { const [k, i] = b.dataset.vplay.split(":"), v = (((getStyle().texts || {}).voices || {})[k] || [])[+i]; if (v && root.WA_UI && root.WA_UI.playSound) root.WA_UI.playSound(v); return; }
      if (b.dataset.vdel) { const [k, i] = b.dataset.vdel.split(":"), c = getStyle(); c.texts = c.texts || {}; const vs = Object.assign({}, c.texts.voices); vs[k] = (vs[k] || []).filter((_, j) => j !== +i); if (!vs[k].length) delete vs[k]; c.texts.voices = vs; await save(c); renderTexts(host); return; }
      if (b.dataset.ovadd) { const c = getStyle(); c.texts = c.texts || {}; c.texts.overrides = c.texts.overrides || {}; if (c.texts.overrides[b.dataset.ovadd] == null) c.texts.overrides[b.dataset.ovadd] = fr() && dict[b.dataset.ovadd] ? dict[b.dataset.ovadd] : b.dataset.ovadd; await save(c); txtQuery = ""; renderTexts(host); const inp = host.querySelector(`[data-ov="${CSS.escape(b.dataset.ovadd)}"]`); if (inp) { inp.focus(); inp.select(); } return; }
      if (b.dataset.ovdel) { const c = getStyle(); delete ((c.texts || {}).overrides || {})[b.dataset.ovdel]; await save(c); renderTexts(host); return; }
      if (b.id === "stOvAdd") { const f = $("#stOvFrom", host).value.trim(), to = $("#stOvTo", host).value.trim(); if (!f || !to) return; const c = getStyle(); c.texts = c.texts || {}; c.texts.overrides = Object.assign({}, c.texts.overrides, { [f]: to }); await save(c); renderTexts(host); }
    };
    host.oninput = host.onchange = async (e) => {
      const t = e.target; if (t.id === "stTxtSearch" || t.id === "stOvFrom" || t.id === "stOvTo") return;
      const c = getStyle(); c.texts = c.texts || {};
      if (t.dataset.ov) { c.texts.overrides = c.texts.overrides || {}; c.texts.overrides[t.dataset.ov] = t.value; await save(c, e.type === "input"); return; }
      if (t.dataset.vfile) { if (e.type !== "change") return; const k = t.dataset.vfile, fs = [...t.files]; t.value = ""; const got = [];
        for (const f of fs) { const d = await audioData(f, 2000000); if (d) got.push(d); }
        if (!got.length) return;
        c.texts.voices = Object.assign({}, c.texts.voices); c.texts.voices[k] = (c.texts.voices[k] || []).concat(got).slice(0, VOICE_MAX);
        await save(c); renderTexts(host); A.status(fr() ? `${got.length} voix importée${got.length > 1 ? "s" : ""}.` : `${got.length} voice${got.length > 1 ? "s" : ""} imported.`); return; }
      const k = t.dataset.k; if (!k) return;
      if (k.startsWith("ch:")) { c.texts.chance = Object.assign({}, c.texts.chance, { [k.slice(3)]: +t.value }); const lb = t.parentElement.querySelector("b"); if (lb) lb.textContent = t.value + "%"; const sm = t.parentElement.querySelector("small"); if (sm) sm.remove(); await save(c, e.type === "input"); return; }
      if (k === "voiceVol") { c.texts.voiceVol = +t.value; const lb = t.parentElement.querySelector("b"); if (lb) lb.textContent = pct(+t.value); await save(c, e.type === "input"); return; }
      if (k.startsWith("q:")) { c.texts.quips = c.texts.quips || {}; const l = t.value.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 20); if (l.length) c.texts.quips[k.slice(2)] = l; else delete c.texts.quips[k.slice(2)]; await save(c, e.type === "input"); return; }
      if (k === "talk") { c.texts.talk = +t.value; const lb = t.parentElement.querySelector("b"); if (lb) lb.textContent = +t.value === 0 ? (fr() ? "jamais" : "never") : pct(+t.value); await save(c, e.type === "input"); }
    };
  }

  // ---------------------------------------------------------------- sounds and music
  const SND_GROUPS = [["In the tavern", [["coin", "Gold, buying, selling"], ["pick", "Pick up a card"], ["drop", "Put a card down"], ["thud", "A minion lands"], ["roll", "Refresh"], ["freeze", "Freeze"], ["upgrade", "Upgrade"], ["triple", "Golden minion"], ["spell", "Spell"], ["buff", "Stats gained"], ["ping", "Activate"], ["error", "Not allowed"]]],
    ["In combat", [["whoosh", "Attack"], ["hit", "Hit"], ["death", "Death"], ["summon", "Summon"], ["hero", "Hero hit"], ["win", "Fight won"], ["lose", "Fight lost"], ["tavern", "Back to the tavern"]]],
    ["Attack styles", [["zap", "Lightning"], ["fire", "Fire"], ["frost", "Frost"], ["heal", "Healing"], ["poison", "Poison"], ["holy", "Holy"], ["shadow", "Shadow"], ["arrow", "Arrow"], ["water", "Water"], ["rock", "Boulder"], ["slash", "Claw"], ["miss", "Miss"], ["stone", "Stone"]]]];
  function renderSounds(host) {
    const cfg = getStyle(), S = cfg.sounds || {}, ov = S.overrides || {}, mus = S.music || {};
    const names = root.WA_UI && root.WA_UI.sfxNames ? root.WA_UI.sfxNames : [];
    host.innerHTML = `<div class="st-head"><h3>Sounds and music</h3><p class="ce-hint">Replace any sound of the game with another one, your own clip, or silence; and give the menu, the tavern and the fights their music.</p></div>
      <div class="ce-sec"><h3>Volume</h3><div class="st-grid2">${rng("sfxVol", S.sfxVol == null ? 1 : S.sfxVol, 0, 1, 0.05, "Sounds", pct)}${rng("musicVol", S.musicVol == null ? 0.5 : S.musicVol, 0, 1, 0.05, "Music", pct)}</div></div>
      <div class="ce-sec"><h3>Music</h3><p class="ce-hint">Loops (MP3, OGG, 5 MB max). A table with its own music keeps it in the tavern and in fights.</p>
        <div class="st-music">${[["menu", "Main menu"], ["tavern", "Tavern"], ["combat", "Fights"]].map(([k, l]) => `<div class="st-track"><span>${esc(l)}</span>${mus[k] ? `<button type="button" class="ce-mini play" data-mplay="${k}">▶</button><button type="button" class="pill small danger" data-mdel="${k}">Remove</button>` : `<label class="pill small st-up">Import<input type="file" accept="audio/*" data-mfile="${k}" hidden></label>`}</div>`).join("")}</div></div>
      ${SND_GROUPS.map(([g, list]) => `<div class="ce-sec"><h3>${esc(g)}</h3><div class="st-snds">${list.map(([k, l]) => { const v = ov[k] || "", up = /^data:/.test(v); return `<div class="st-snd"><span>${esc(l)}</span><select data-snd="${k}"><option value="">Built-in</option><option value="-"${v === "-" ? " selected" : ""}>Silence</option>${up ? `<option value="${esc(v)}" selected>Your clip</option>` : ""}${names.filter((n) => n !== k).map((n) => `<option value="${n}"${v === n ? " selected" : ""}>= ${esc(n)}</option>`).join("")}</select><label class="pill small st-up" title="Import a clip (2 MB max)">Clip<input type="file" accept="audio/*" data-sndfile="${k}" hidden></label><button type="button" class="ce-mini play" data-sndplay="${k}" title="Listen">▶</button></div>`; }).join("")}</div></div>`).join("")}`;
    let musicEl = null;
    host.onclick = async (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.sndplay) { if (root.WA_UI && root.WA_UI.playSound) root.WA_UI.playSound(b.dataset.sndplay); return; }
      if (b.dataset.mplay) { const c = getStyle(), src = ((c.sounds || {}).music || {})[b.dataset.mplay]; if (musicEl) { musicEl.pause(); musicEl = null; b.textContent = "▶"; return; } if (src) { musicEl = new Audio(src); musicEl.volume = 0.6; musicEl.play().catch(() => {}); b.textContent = "■"; } return; }
      if (b.dataset.mdel) { const c = getStyle(); c.sounds = c.sounds || {}; c.sounds.music = Object.assign({}, c.sounds.music); delete c.sounds.music[b.dataset.mdel]; await save(c); renderSounds(host); }
    };
    host.oninput = host.onchange = async (e) => {
      const t = e.target, c = getStyle(); c.sounds = c.sounds || {};
      if (t.dataset.mfile) { if (e.type !== "change") return; const d = await audioData(t.files[0], 5e6); if (!d) return; c.sounds.music = Object.assign({}, c.sounds.music, { [t.dataset.mfile]: d }); await save(c); renderSounds(host); A.status("Music saved."); return; }
      if (t.dataset.sndfile) { if (e.type !== "change") return; const d = await audioData(t.files[0], 2000000); if (!d) return; c.sounds.overrides = Object.assign({}, c.sounds.overrides, { [t.dataset.sndfile]: d }); await save(c); renderSounds(host); if (root.WA_UI && root.WA_UI.playSound) root.WA_UI.playSound(t.dataset.sndfile); return; }
      if (t.dataset.snd) { if (e.type !== "change") return; c.sounds.overrides = Object.assign({}, c.sounds.overrides); if (t.value) c.sounds.overrides[t.dataset.snd] = t.value; else delete c.sounds.overrides[t.dataset.snd]; await save(c); if (root.WA_UI && root.WA_UI.playSound) root.WA_UI.playSound(t.dataset.snd); return; }
      const k = t.dataset.k; if (k === "sfxVol" || k === "musicVol") { c.sounds[k] = +t.value; const lb = t.parentElement.querySelector("b"); if (lb) lb.textContent = pct(+t.value); await save(c, e.type === "input"); }
    };
  }

  // ---------------------------------------------------------------- menus and screens
  function renderScreens(host) {
    const cfg = getStyle(), S = cfg.screens || {};
    const pic = (k, label, hint) => `<div class="st-pic"><span>${esc(label)}</span>${S[k] ? `<img src="${esc(S[k])}" alt=""><button type="button" class="pill small danger" data-picdel="${k}">Remove</button>` : `<label class="pill small st-up">Import a picture<input type="file" accept="image/*" data-pic="${k}" hidden></label>`}${hint ? `<small>${esc(hint)}</small>` : ""}</div>`;
    host.innerHTML = `<div class="st-head"><h3>Menus and screens</h3><p class="ce-hint">The name of your game, its main menu, the end-of-game screen and the fight banners.</p></div>
      <div class="ce-sec"><h3>Main menu</h3>
        <div class="st-titlepv">${S.logo ? `<img src="${esc(S.logo)}" alt="">` : ""}<small>${esc(S.eyebrow || (fr() ? "◆ Autobattler de taverne ◆" : "◆ Tavern autobattler ◆"))}</small>${S.hideTitle && S.logo ? "" : `<b>${esc(S.title || "Warband Arena")}</b>`}</div>
        <div class="st-grid2">${txt("title", S.title, "Game name", "Warband Arena", 32)}${txt("eyebrow", S.eyebrow, "Line above it", fr() ? "◆ Autobattler de taverne ◆" : "◆ Tavern autobattler ◆", 48)}</div>
        <div class="st-grid2">${pic("logo", "Logo", "Shown above the name (PNG with transparency works best).")}${pic("menuBg", "Menu background", "Fills the screen behind the menu.")}</div>
        <div class="st-grid2">${chk("hideTitle", S.hideTitle, "Only the logo (hide the name)")}${chk("embers", S.embers !== false, "Floating embers")}${rng("menuDim", S.menuDim == null ? 0.4 : S.menuDim, 0, 0.9, 0.05, "Background darkness", pct)}</div></div>
      <div class="ce-sec"><h3>End of the game</h3><p class="ce-hint">{n} is replaced by the place.</p>
        <div class="st-grid2">${txt("winTitle", S.winTitle, "Title, 1st place", "Champion of the Arena", 48)}${txt("winText", S.winText, "Text, 1st place", "Seven rivals fell before your warband.", 120)}
        ${txt("topTitle", S.topTitle, "Title, top 4", "You placed #{n}", 48)}${txt("topText", S.topText, "Text, top 4", "A top-four finish. The tavern salutes you.", 120)}
        ${txt("loseTitle", S.loseTitle, "Title, out", "Knocked out at #{n}", 48)}${txt("loseText", S.loseText, "Text, out", "The tavern will be open again in a moment.", 120)}</div>
        ${pic("endImg", "Picture on the end screen", "")}</div>
      <div class="ce-sec"><h3>Fight banners</h3><div class="st-grid2">${txt("fight", S.fight, "Before a fight", "Fight!", 24)}${txt("victory", S.victory, "Fight won", "Victory", 24)}${txt("defeat", S.defeat, "Fight lost", "Defeat", 24)}</div></div>`;
    host.onclick = async (e) => { const b = e.target.closest("[data-picdel]"); if (!b) return; const c = getStyle(); c.screens = c.screens || {}; delete c.screens[b.dataset.picdel]; await save(c); renderScreens(host); };
    host.oninput = host.onchange = async (e) => {
      const t = e.target, c = getStyle(); c.screens = c.screens || {};
      if (t.dataset.pic) { if (e.type !== "change" || !t.files[0]) return; try { c.screens[t.dataset.pic] = await picData(t.files[0], t.dataset.pic === "menuBg" ? 1600 : 700); } catch (x) { A.status("That picture could not be read.", "err"); return; } await save(c); renderScreens(host); return; }
      const k = t.dataset.k; if (!k) return;
      const v = valOf(t);
      if (t.type === "text") { if (v.trim()) c.screens[k] = v; else delete c.screens[k]; } else c.screens[k] = v;
      if (t.type === "range") { const lb = t.parentElement.querySelector("b"); if (lb) lb.textContent = pct(v); }
      await save(c, e.type === "input");
      if (e.type === "change" && t.type !== "range") { const pv = $(".st-titlepv", host); if (pv) { const S2 = c.screens; pv.innerHTML = `${S2.logo ? `<img src="${esc(S2.logo)}" alt="">` : ""}<small>${esc(S2.eyebrow || "◆ Tavern autobattler ◆")}</small>${S2.hideTitle && S2.logo ? "" : `<b>${esc(S2.title || "Warband Arena")}</b>`}`; } }
    };
  }

  // ---------------------------------------------------------------- rules of the meta
  function renderRules(host) {
    const on = A.W.affOn(), cfg = JSON.parse(JSON.stringify(A.ST.affinities || {}));
    host.innerHTML = `<div class="st-head"><h3>Rules of the meta</h3><p class="ce-hint">Optional systems you can switch on or off for this meta.</p></div>
      <div class="ce-sec st-rule${on ? " on" : ""}"><h3>Affinities</h3>
        <label class="st-switch"><input type="checkbox" id="stAffOn" ${on ? "checked" : ""}><i></i><span>${on ? "On" : "Off"}</span></label>
        <p class="ce-hint">Elemental affinities on top of tribes (Coral, Steam, Tar, Water, Earth and yours): levels, mechanics, badges and table slots. Off keeps the game simpler: minions still keep them for later, and the cards built only for them leave the tavern.</p>
        ${on ? `<p class="ce-hint">Design them in <b>Affinities</b> (left), and their badges in <b>Tribes</b>.</p>` : ""}</div>
      <div class="ce-sec st-rule${cfg.noHeroStart ? " on" : ""}"><h3>Heroes won by affinity</h3>
        <label class="st-switch"><input type="checkbox" id="stNoHero" ${cfg.noHeroStart ? "checked" : ""}><i></i><span>${cfg.noHeroStart ? "On" : "Off"}</span></label>
        <p class="ce-hint">Every player starts without a hero: no hero choice, no power, only their Health. An affinity that gives a hero (its <b>Hero</b> part) hands it over when a player reaches its level; it stays until another affinity gives another one.</p>
        ${cfg.noHeroStart && !on ? `<p class="ce-hint ce-banned">Affinities are off: no one can win a hero.</p>` : ""}</div>`;
    $("#stNoHero", host).addEventListener("change", async (e) => {
      const c = JSON.parse(JSON.stringify(A.ST.affinities || {})); if (e.target.checked) c.noHeroStart = true; else delete c.noHeroStart;
      await A.ST.saveAffinities(c);
      A.status(e.target.checked ? "Players start without a hero in this meta." : "Players pick a hero at the start again.");
      A.reopen();
    });
    $("#stAffOn", host).addEventListener("change", async (e) => {
      const c = JSON.parse(JSON.stringify(A.ST.affinities || {})); c.enabled = e.target.checked;
      await A.ST.saveAffinities(c); A.applySkins();
      A.status(e.target.checked ? "Affinities are on for this meta." : "Affinities are off for this meta.");
      A.reopen();
    });
    void cfg;
  }

  // ---------------------------------------------------------------- frames by tribe and rarity, card back (in the Skins view)
  function framesExtra(kind, host, api) {
    A = api;
    if (kind === "table") {
      const b = document.createElement("div"); b.className = "ce-sec st-tablews";
      b.innerHTML = `<h3>Table workshop</h3><p class="ce-hint">Place every zone of the table yourself (board, hand, shop, heroes, buttons) on your picture.</p><button type="button" class="pill big" id="stOpenTable">Open the table workshop</button>`;
      host.prepend(b); b.querySelector("#stOpenTable").onclick = () => A.openTable(); return;
    }
    if (kind !== "card" && kind !== "token") return;
    const cfg = getStyle(), F = cfg.frames || {}, skins = (A.ST.skinList(kind) || []).filter(Boolean), tribes = A.W.TRIBES.slice();
    const opts = (v) => `<option value="">${fr() ? "Le cadre équipé" : "The equipped frame"}</option>${skins.map((s) => `<option value="${esc(s.id)}"${v === s.id ? " selected" : ""}>${esc(s.name || s.id)}</option>`).join("")}`;
    const TN = (t) => (A.W.tribeName ? A.W.tribeName(t) : t);
    const box = document.createElement("div");
    box.innerHTML = `<div class="ce-sec st-frames"><h3>${kind === "card" ? "Frames by tribe, unique and rarity" : "Token frames by tribe"}</h3>
      ${skins.length ? `<p class="ce-hint">Dress each tribe${kind === "card" ? ", the unique cards or each rarity" : ""} in one of your ${kind === "card" ? "hand" : "board"} skins. A card's own frame (Look) wins over these.</p>
      <div class="st-frgrid">${tribes.map((t) => `<label class="st-f"><span>${esc(TN(t))}</span><select data-frame="${kind === "card" ? "tribe" : "tokenTribe"}:${esc(t)}">${opts(((kind === "card" ? F.tribe : F.tokenTribe) || {})[t] || "")}</select></label>`).join("")}
      ${kind === "card" ? `<label class="st-f"><span>◆ ${fr() ? "Cartes uniques" : "Unique cards"}</span><select data-frame="unique:card">${opts((F.unique || {}).card || "")}</select></label>` : ""}
      ${kind === "card" ? Object.keys(A.W.RARITY).filter((r) => r !== "common").map((r) => `<label class="st-f"><span>${esc(A.W.RARITY[r].name)}</span><select data-frame="rarity:${r}">${opts((F.rarity || {})[r] || "")}</select></label>`).join("") : ""}</div>`
      : `<p class="ce-hint">Add a few ${kind === "card" ? "hand" : "board"} skins above first, then give each tribe its own.</p>`}</div>
      ${kind === "card" ? `<div class="ce-sec st-frames"><h3>Card back</h3><p class="ce-hint">Shown when cards are revealed (Discover).</p>
        <div class="st-back">${F.back ? `<i style="background-image:url('${esc(F.back)}')"></i><button type="button" class="pill small danger" id="stBackDel">Remove</button>` : `<i class="none"></i>`}<label class="pill small st-up">Import a card back<input type="file" accept="image/*" id="stBackFile" hidden></label></div></div>` : ""}`;
    host.appendChild(box);
    box.addEventListener("change", async (e) => {
      const t = e.target, c = getStyle(); c.frames = c.frames || {};
      if (t.dataset.frame) { const [g, k] = t.dataset.frame.split(":"); c.frames[g] = Object.assign({}, c.frames[g]); if (t.value) c.frames[g][k] = t.value; else delete c.frames[g][k]; await save(c); A.status("Saved: it shows on the cards right away."); return; }
      if (t.id === "stBackFile" && t.files[0]) { try { c.frames.back = await picData(t.files[0], 420); } catch (x) { A.status("That picture could not be read.", "err"); return; } await save(c); box.remove(); framesExtra(kind, host, api); }
    });
    box.addEventListener("click", async (e) => { if (e.target.id !== "stBackDel") return; const c = getStyle(); if (c.frames) delete c.frames.back; await save(c); box.remove(); framesExtra(kind, host, api); });
  }

  // ---------------------------------------------------------------- markers layout (v82): where each marker sits on a minion of the board
  const MK_NAMES = { "1/1": "+1/+1", "2/2": "+2/+2", "1/3": "+1/+3", "3/1": "+3/+1", other: "Other stat sizes" };
  function renderMarkers(host) {
    const ML = root.WA_MK_LAYOUT; if (!ML) { host.innerHTML = "<p>Not available.</p>"; return; }
    const c0 = getStyle(), cur = c0.markers || {}, pos = Object.assign({}, ML.DEF, cur.pos || {}); let size = cur.size || 20, sel = ML.SLOTS[0];
    const label = (k) => MK_NAMES[k] || (A.W.KW_TEXT[k] || k) + " marker";
    const glyph = { taunt: "⛨", shield: "◈", reborn: "✚", windfury: "≋", venomous: "☠", cleave: "⚔", stealth: "◐", rally: "⚑", tough: "▣", flying: "➶" };
    host.innerHTML = `<div class="st-head"><h3>Markers layout</h3><p class="ce-hint">Each kind of marker always sits at the same spot on a minion of the board, so you can tell them apart at a glance. Drag them on the minion, or type the position (in % of the minion: 0 = left / top edge, 100 = right / bottom edge; a little outside works too).</p></div>
      <div class="ce-sec"><div class="st-mkpv"><div class="st-mkpiece" id="stMkPiece" style="--mks:${size * 2}px">${ML.SLOTS.map((k) => `<span class="st-mk ${glyph[k] ? "kw" : "st"}" data-mk="${k}" title="${esc(label(k))}">${glyph[k] || (k === "other" ? "+x" : "+" + k.replace("/", "/+"))}</span>`).join("")}</div>
        <div><label class="ce-sel">Marker size<input type="range" id="stMkSize" min="12" max="34" step="1" value="${size}"></label>
          <div class="st-mklist">${ML.SLOTS.map((k) => `<div class="st-mkrow" data-row="${k}"><b>${esc(label(k))}</b>X <input type="number" data-x="${k}" step="1" min="-30" max="130" value="${Math.round(pos[k][0])}"> Y <input type="number" data-y="${k}" step="1" min="-30" max="130" value="${Math.round(pos[k][1])}"></div>`).join("")}</div>
          <div class="ce-row" style="margin-top:10px"><button type="button" class="pill" id="stMkReset">Back to the default spots</button></div></div></div></div>`;
    const piece = $("#stMkPiece", host);
    const place = () => { piece.style.setProperty("--mks", size * 2 + "px"); for (const s of piece.querySelectorAll("[data-mk]")) { const p = pos[s.dataset.mk]; s.style.left = p[0] + "%"; s.style.top = p[1] + "%"; s.classList.toggle("on", s.dataset.mk === sel); } host.querySelectorAll("[data-row]").forEach((r) => r.classList.toggle("on", r.dataset.row === sel)); };
    const store = (later) => { const c = getStyle(); c.markers = { pos: Object.assign({}, pos), size }; save(c, later); };
    const syncInputs = (k) => { const x = host.querySelector(`[data-x="${k}"]`), y = host.querySelector(`[data-y="${k}"]`); if (x) x.value = Math.round(pos[k][0]); if (y) y.value = Math.round(pos[k][1]); };
    piece.addEventListener("pointerdown", (e) => {
      const s = e.target.closest("[data-mk]"); if (!s) return; e.preventDefault(); sel = s.dataset.mk; place(); s.setPointerCapture(e.pointerId);
      const r = piece.getBoundingClientRect();
      const mv = (ev) => { pos[sel] = [Math.max(-30, Math.min(130, ((ev.clientX - r.left) / r.width) * 100)), Math.max(-30, Math.min(130, ((ev.clientY - r.top) / r.height) * 100))]; place(); syncInputs(sel); };
      const up = () => { s.removeEventListener("pointermove", mv); s.removeEventListener("pointerup", up); store(); A.status("Saved: the minions on the board show it right away."); };
      s.addEventListener("pointermove", mv); s.addEventListener("pointerup", up);
    });
    host.oninput = (e) => {
      const t = e.target;
      if (t.id === "stMkSize") { size = +t.value; place(); store(true); return; }
      const k = t.dataset.x || t.dataset.y; if (!k || t.value === "") return;
      pos[k] = t.dataset.x ? [+t.value, pos[k][1]] : [pos[k][0], +t.value]; sel = k; place(); store(true);
    };
    host.onclick = (e) => {
      const r = e.target.closest("[data-row]"); if (r && e.target.tagName !== "INPUT") { sel = r.dataset.row; place(); }
      if (e.target.id === "stMkReset") { for (const k of ML.SLOTS) pos[k] = ML.DEF[k].slice(); size = 20; $("#stMkSize", host).value = 20; for (const k of ML.SLOTS) syncInputs(k); place(); store(); A.status("Back to the default spots."); }
    };
    place();
  }
  // ---------------------------------------------------------------- v127 Laboratory: try a card in a real game, and bot games with stats
  let labRes = null, labRun = null; // the last results (kept while the game runs), the run in progress
  const labPick = { card: "", copies: 1, tier: 1, gold: 0, games: 25 };
  function renderLab(host) {
    const W = A.W, TN = (t) => (W.tribeName ? W.tribeName(t) : t);
    const mins = Object.keys(W.CARDS).filter((id) => { const d = W.CARDS[id]; return d && !d.retired && !d.affOnly; });
    const groups = {};
    for (const id of mins) { const d = W.CARDS[id], t = d.allTribes ? "*all" : (W.tribesOf(d)[0] || ""); (groups[t] = groups[t] || []).push(id); }
    const nm = (id) => String((W.CARDS[id] || W.SPELLS[id] || {}).name || id);
    const byTier = (a, b) => ((W.CARDS[a] || W.SPELLS[a]).tier || 0) - ((W.CARDS[b] || W.SPELLS[b]).tier || 0) || nm(a).localeCompare(nm(b));
    const gl = Object.keys(groups).sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a === "*all" ? 1 : b === "*all" ? -1 : TN(a).localeCompare(TN(b))));
    const spells = Object.keys(W.SPELLS).sort(byTier);
    if (!labPick.card || !(W.CARDS[labPick.card] || W.SPELLS[labPick.card])) labPick.card = (groups[gl[0]] || [])[0] || spells[0] || "";
    const o = (id) => `<option value="${esc(id)}"${id === labPick.card ? " selected" : ""}>${esc(nm(id))} · ${fr() ? "niv." : "tier"} ${(W.CARDS[id] || W.SPELLS[id]).tier || 0}${W.CARDS[id] && W.CARDS[id].inPool === false ? (fr() ? " (jeton)" : " (token)") : ""}</option>`;
    const cardSel = gl.map((t) => `<optgroup label="${esc(t === "" ? "Neutral" : t === "*all" ? "All tribes" : TN(t))}">${groups[t].sort(byTier).map(o).join("")}</optgroup>`).join("")
      + (spells.length ? `<optgroup label="${esc(fr() ? "Sorts" : "Spells")}">${spells.map(o).join("")}</optgroup>` : "");
    host.innerHTML = `<div class="st-head"><h3>Laboratory</h3><p class="ce-hint">Try your cards in real conditions, and let the bots play whole games to see how each card and each tribe does.</p></div>
      <div class="ce-sec st-lab"><h3>Test a card in a game</h3>
        <p class="ce-hint">A normal game against 7 bots with this card in your hand from the first turn. Its tribe is always one of the lobby's.</p>
        <div class="st-frgrid"><label class="st-f wide"><span>Card</span><select id="labCard">${cardSel}</select></label>
          <label class="st-f"><span>Copies in hand</span><input type="number" id="labCopies" min="1" max="3" value="${labPick.copies}"></label>
          <label class="st-f"><span>Tavern tier at the start</span><input type="number" id="labTier" min="1" max="6" value="${labPick.tier}"></label>
          <label class="st-f"><span>Extra gold, first turn</span><input type="number" id="labGold" min="0" max="30" value="${labPick.gold}"></label></div>
        <div class="ce-row"><button type="button" class="pill big" id="labPlay">▶ Play a test game</button></div></div>
      <div class="ce-sec st-lab"><h3>Bot games</h3>
        <p class="ce-hint">8 bots play whole games with this meta (tribes drawn as usual, Hidden tribes left out). Placement: 1 is the winner, 8 the first one out. A card counts for a player when it was on their last board.</p>
        <div class="ce-row"><label class="st-f"><span>Games</span><select id="labGames">${[10, 25, 50, 100, 200].map((n) => `<option value="${n}"${n === labPick.games ? " selected" : ""}>${n}</option>`).join("")}</select></label>
          <button type="button" class="pill big" id="labGo"${labRun ? " disabled" : ""}>Run the bots</button><button type="button" class="pill" id="labStop"${labRun ? "" : " hidden"}>Stop</button></div>
        <div class="st-labbar"${labRun ? "" : " hidden"}><i id="labBar" style="width:${labRun ? Math.round((labRun.done / labRun.n) * 100) : 0}%"></i><span id="labTxt"></span></div>
        <div id="labOut">${labRes ? labHTML(labRes) : ""}</div></div>`;
    const num = (id, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+$(id, host).value) || lo));
    $("#labCard", host).onchange = (e) => { labPick.card = e.target.value; };
    $("#labPlay", host).onclick = () => {
      labPick.copies = num("#labCopies", 1, 3); labPick.tier = num("#labTier", 1, 6); labPick.gold = num("#labGold", 0, 30); labPick.card = $("#labCard", host).value;
      if (!labPick.card) return;
      if (A.playTest) A.playTest(Object.assign({}, labPick));
    };
    $("#labGames", host).onchange = (e) => { labPick.games = +e.target.value; };
    $("#labGo", host).onclick = () => labStart(host);
    $("#labStop", host).onclick = () => { if (labRun) labRun.stop = true; };
    host.onclick = (e) => { const th = e.target.closest("[data-labsort]"); if (!th || !labRes) return; const [tb, k] = th.dataset.labsort.split(":"); labRes.sort[tb] = labRes.sort[tb] === k ? "-" + k : k; $("#labOut", host).innerHTML = labHTML(labRes); };
    host.oninput = (e) => { if (e.target.id === "labFilter" && labRes) { labRes.filter = e.target.value; const tb = $("#labCards", host); if (tb) tb.outerHTML = labCardsHTML(labRes); } };
    if (labRun) labRun.host = host;
  }
  function labStart(host) {
    const W = A.W, n = labPick.games;
    const R = { games: 0, turns: 0, cards: {}, tribes: {}, heroes: {}, sort: { cards: "place", tribes: "place" }, filter: "", n };
    labRun = { n, done: 0, stop: false, host, R };
    renderLab(host);
    const one = () => {
      const g = new W.Game(8, null, false, {});
      const bought = {}, last = {};
      g.buy = function (p, i) { const id = p.shop[i] && p.shop[i].cardId; const r = W.Game.prototype.buy.call(this, p, i); if (!r && id) bought[id] = (bought[id] || 0) + 1; return r; };
      for (const t of g.tribes) (R.tribes[t] = R.tribes[t] || { lobbies: 0, players: 0, place: 0, wins: 0, top4: 0 }).lobbies++;
      return { g, bought, last, t: 0 };
    };
    let cur = null;
    const finish = (c) => {
      const g = c.g;
      for (const p of g.players) {
        const place = p.alive ? 1 : p.placement || 8, b = c.last[p.id] || [];
        const tc = {}; for (const m of b) for (const t of m.tribes) tc[t] = (tc[t] || 0) + 1;
        const main = Object.keys(tc).sort((a, b2) => tc[b2] - tc[a])[0];
        if (main && tc[main] >= 3 && R.tribes[main]) { const T = R.tribes[main]; T.players++; T.place += place; if (place === 1) T.wins++; if (place <= 4) T.top4++; }
        for (const id of new Set(b.map((m) => m.id))) { const C = R.cards[id] = R.cards[id] || { bought: 0, boards: 0, place: 0, wins: 0 }; C.boards++; C.place += place; if (place === 1) C.wins++; }
        if (p.hero) { const H = R.heroes[p.hero] = R.heroes[p.hero] || { players: 0, place: 0, wins: 0 }; H.players++; H.place += place; if (place === 1) H.wins++; }
      }
      for (const id in c.bought) { const C = R.cards[id] = R.cards[id] || { bought: 0, boards: 0, place: 0, wins: 0 }; C.bought += c.bought[id]; }
      R.games++;
    };
    const step = () => {
      const run = labRun; if (!run) return;
      const t0 = performance.now();
      try {
        while (performance.now() - t0 < 40) {
          if (run.stop || run.done >= run.n) break;
          if (!cur) cur = one();
          const g = cur.g;
          if (g.isOver() || cur.t >= 40) { finish(cur); cur = null; run.done++; continue; }
          g.startTurn(); g.botTurns(); g.endOfTurnEffects();
          for (const p of g.alive()) cur.last[p.id] = p.board.map((m) => ({ id: m.cardId, tribes: m.allTribes ? [] : W.tribesOf(m).filter(Boolean) }));
          g.combatPhase(); cur.t++; R.turns++;
        }
      } catch (e) { cur = null; run.done++; R.errors = (R.errors || 0) + 1; R.lastError = String(e && e.message || e); }
      const h = run.host, bar = h && h.isConnected ? $("#labBar", h) : null;
      if (bar) { bar.style.width = Math.round((run.done / run.n) * 100) + "%"; const tx = $("#labTxt", h); if (tx) tx.textContent = `${run.done} / ${run.n}`; }
      if (run.stop || run.done >= run.n) {
        labRun = null; labRes = R;
        if (h && h.isConnected && $("#labOut", h)) renderLab(h);
        A.status(fr() ? `Laboratoire : ${R.games} parties jouées.` : `Laboratory: ${R.games} games played.`);
        return;
      }
      setTimeout(step, 0);
    };
    setTimeout(step, 0);
  }
  const avgP = (x, n) => (n ? (x / n).toFixed(2) : "–");
  const pc = (x, n) => (n ? Math.round((x / n) * 100) + "%" : "–");
  function sorter(sort, get) { const k = sort.replace(/^-/, ""), dir = sort[0] === "-" ? -1 : 1; return (a, b) => { const x = get(a, k), y = get(b, k); return (x < y ? -1 : x > y ? 1 : 0) * dir; }; }
  function labCardsHTML(R) {
    const W = A.W, TN = (t) => (W.tribeName ? W.tribeName(t) : t), q = (R.filter || "").trim().toLowerCase();
    const nm = (id) => String((W.CARDS[id] || W.TOKENS[id] || {}).name || id);
    let ids = Object.keys(R.cards).filter((id) => W.CARDS[id] || W.TOKENS[id]);
    if (q) ids = ids.filter((id) => nm(id).toLowerCase().includes(q) || W.tribesOf(W.CARDS[id] || W.TOKENS[id]).some((t) => TN(t).toLowerCase().includes(q)));
    const get = (id, k) => { const C = R.cards[id]; return k === "name" ? nm(id) : k === "tier" ? (W.CARDS[id] || W.TOKENS[id]).tier || 0 : k === "place" ? (C.boards ? C.place / C.boards : 99) : k === "wins" ? (C.boards ? -C.wins / C.boards : 0) : -C[k]; };
    ids.sort(sorter(R.sort.cards, get));
    const th = (k, l) => `<th data-labsort="cards:${k}" class="${R.sort.cards.replace(/^-/, "") === k ? "on" : ""}">${esc(l)}</th>`;
    return `<div class="st-labtab" id="labCards"><table><thead><tr>${th("name", fr() ? "Carte" : "Card")}${th("tier", fr() ? "Niv." : "Tier")}<th>${fr() ? "Tribu" : "Tribe"}</th>${th("bought", fr() ? "Achetée" : "Bought")}${th("boards", fr() ? "Plateaux finaux" : "Last boards")}${th("place", fr() ? "Place moy." : "Avg place")}${th("wins", fr() ? "1re place" : "1st place")}</tr></thead><tbody>
      ${ids.map((id) => { const C = R.cards[id], d = W.CARDS[id] || W.TOKENS[id]; return `<tr${id === labPick.card ? ` class="mine"` : ""}><td>${esc(nm(id))}</td><td>${d.tier || 0}</td><td>${esc(d.allTribes ? "All" : W.tribesOf(d).filter(Boolean).map(TN).join(", ") || "–")}</td><td>${C.bought}</td><td>${C.boards}</td><td>${avgP(C.place, C.boards)}</td><td>${pc(C.wins, C.boards)}</td></tr>`; }).join("")}</tbody></table></div>`;
  }
  function labHTML(R) {
    const W = A.W, TN = (t) => (W.tribeName ? W.tribeName(t) : t);
    const tl = Object.keys(R.tribes).sort(sorter(R.sort.tribes, (t, k) => { const T = R.tribes[t]; return k === "name" ? TN(t) : k === "place" ? (T.players ? T.place / T.players : 99) : k === "wins" ? (T.players ? -T.wins / T.players : 0) : k === "top4" ? (T.players ? -T.top4 / T.players : 0) : -T[k]; }));
    const th = (k, l) => `<th data-labsort="tribes:${k}" class="${R.sort.tribes.replace(/^-/, "") === k ? "on" : ""}">${esc(l)}</th>`;
    const hl = Object.keys(R.heroes).filter((h) => W.HEROES[h]).sort((a, b) => R.heroes[a].place / R.heroes[a].players - R.heroes[b].place / R.heroes[b].players);
    return `<p class="ce-hint"><b>${R.games}</b> ${fr() ? "parties" : "games"} · ${R.turns} ${fr() ? "tours" : "turns"}${R.errors ? ` · <span class="ce-banned">${R.errors} ${fr() ? "partie(s) en erreur" : "game(s) with an error"}: ${esc(R.lastError)}</span>` : ""}. ${fr() ? "Cliquez un titre de colonne pour trier." : "Click a column title to sort."}</p>
      <h4>${fr() ? "Tribus" : "Tribes"}</h4><p class="ce-hint">${fr() ? "Une tribu compte pour un joueur quand au moins 3 serviteurs de son dernier plateau en sont." : "A tribe counts for a player when at least 3 minions of their last board belong to it."}</p>
      <div class="st-labtab"><table><thead><tr>${th("name", fr() ? "Tribu" : "Tribe")}${th("lobbies", fr() ? "Lobbies" : "Lobbies")}${th("players", fr() ? "Joueurs" : "Players")}${th("place", fr() ? "Place moy." : "Avg place")}${th("wins", fr() ? "1re place" : "1st place")}${th("top4", "Top 4")}</tr></thead><tbody>
      ${tl.map((t) => { const T = R.tribes[t]; return `<tr><td><span class="st-labdot" data-tribe="${esc(t)}"></span>${esc(TN(t))}</td><td>${T.lobbies}</td><td>${T.players}</td><td>${avgP(T.place, T.players)}</td><td>${pc(T.wins, T.players)}</td><td>${pc(T.top4, T.players)}</td></tr>`; }).join("")}</tbody></table></div>
      ${hl.length ? `<h4>${fr() ? "Héros" : "Heroes"}</h4><div class="st-labtab"><table><thead><tr><th>${fr() ? "Héros" : "Hero"}</th><th>${fr() ? "Joueurs" : "Players"}</th><th>${fr() ? "Place moy." : "Avg place"}</th><th>${fr() ? "1re place" : "1st place"}</th></tr></thead><tbody>${hl.map((h) => { const H = R.heroes[h]; return `<tr><td>${esc(W.HEROES[h].name)}</td><td>${H.players}</td><td>${avgP(H.place, H.players)}</td><td>${pc(H.wins, H.players)}</td></tr>`; }).join("")}</tbody></table></div>` : ""}
      <h4>${fr() ? "Cartes" : "Cards"}</h4><input type="search" id="labFilter" class="st-labfilter" placeholder="${fr() ? "Filtrer (nom ou tribu)" : "Filter (name or tribe)"}" value="${esc(R.filter || "")}">${labCardsHTML(R)}`;
  }

  // ---------------------------------------------------------------- v130 text colours: [name]text[/] in card, hero, spell and affinity texts
  function renderColors(host) {
    const base = (root.WA_UI && root.WA_UI.RICH_C) || {}, cfg = getStyle(), own = Object.assign({}, cfg.colors || {});
    const names = [...new Set(Object.keys(base).filter((k) => k !== "gray").concat(Object.keys(own)))];
    const sample = fr() ? "Texte d'exemple" : "Sample text";
    host.innerHTML = `<div class="st-head"><h3>Text colours</h3><p class="ce-hint">Write [name]some text[/] in any text of a card, a hero, a spell or an affinity to colour it. Change a colour here, or add your own with its name.</p></div>
      <div class="ce-sec"><div class="st-cols">${names.map((n) => { const v = own[n] || base[n], mine = !(n in base), changed = !mine && own[n] && own[n] !== base[n];
        return `<div class="st-colrow"><input type="color" data-col="${esc(n)}" value="${esc(v)}"><code>[${esc(n)}]…[/]</code><b style="color:${esc(v)}">${sample}</b>
          ${mine ? `<button type="button" class="ce-mini del" data-coldel="${esc(n)}" title="Delete this colour">✕</button>` : changed ? `<button type="button" class="ce-mini" data-colreset="${esc(n)}" title="Back to the built-in colour">⟲</button>` : "<span></span>"}</div>`; }).join("")}</div>
        <div class="ce-row st-coladd"><label class="st-f"><span>New colour: its name</span><input type="text" id="stColName" maxlength="24" placeholder="${fr() ? "ex. loup" : "e.g. wolf"}"></label><input type="color" id="stColVal" value="#e0a040"><button type="button" class="pill" id="stColAdd">+ Add the colour</button></div></div>`;
    const store = async (c) => { await save(c); renderColors(host); A.status(fr() ? "Couleurs enregistrées : les textes les montrent tout de suite." : "Colours saved: texts show them right away."); };
    host.oninput = (e) => { const t = e.target; if (!t.dataset.col) return; const b = t.parentElement.querySelector("b"); if (b) b.style.color = t.value; };
    host.onchange = async (e) => { const t = e.target; if (!t.dataset.col) return; const c = getStyle(); c.colors = Object.assign({}, c.colors, { [t.dataset.col]: t.value }); await store(c); };
    host.onclick = async (e) => {
      const t = e.target, c = getStyle(); c.colors = Object.assign({}, c.colors);
      if (t.dataset.coldel || t.dataset.colreset) { delete c.colors[t.dataset.coldel || t.dataset.colreset]; await store(c); return; }
      if (t.id === "stColAdd") {
        const n = ($("#stColName", host).value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
        if (!n || !/^[a-z]/.test(n)) { A.status(fr() ? "Donnez-lui un nom qui commence par une lettre (lettres, chiffres, - et _)." : "Give it a name starting with a letter (letters, digits, - and _).", "warn"); return; }
        if (n in base || n in c.colors) { A.status(fr() ? "Ce nom existe déjà : changez sa couleur dans la liste." : "That name exists already: change its colour in the list.", "warn"); return; }
        c.colors[n] = $("#stColVal", host).value; await store(c);
      }
    };
  }
  function render(sec, host, api) {
    A = api;
    host.onclick = host.oninput = host.onchange = null;
    host.classList.add("st-host");
    ({ fx: renderFx, theme: renderTheme, texts: renderTexts, sounds: renderSounds, screens: renderScreens, rules: renderRules, markers: renderMarkers, lab: renderLab, colors: renderColors }[sec] || renderRules)(host);
  }
  root.WA_STUDIO = { render, framesExtra, FX_PRESETS, MOMENTS, QUIP_CATS, SND_GROUPS };
})(typeof window !== "undefined" ? window : globalThis);
