// ===================================================================
// Warband Arena - table workshop: move and resize the table's elements, and dress the table with
// 2D sprites that react when clicked (bounce, swing, spin... with particles and a sound).
// Works on the live table; saved per meta in WA_STORE.tableDesign.
// ===================================================================
(function (root) {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fr = () => root.WA_I18N && root.WA_I18N.lang === "fr";
  const t = (en, f) => (fr() ? f : en);
  const U = () => root.WA_UI;

  let D = null, el = null, layer = null, sel = null, dirty = false, snap = true, onClose = null, undo = [];
  const IDLE = () => [["none", t("Still", "Immobile")], ["float", t("Float", "Flotter")], ["bob", t("Bob", "Tanguer")], ["sway", t("Sway (from the bottom)", "Se balancer (par le bas)")], ["hang", t("Hang (from the top)", "Suspendu (par le haut)")], ["breathe", t("Breathe", "Respirer")], ["flicker", t("Flicker (a flame)", "Vaciller (une flamme)")], ["glow", t("Glow", "Luire")], ["spin", t("Turn slowly", "Tourner lentement")]];
  const REACT = () => [["none", t("Nothing", "Rien")], ["bounce", t("Bounce", "Rebond")], ["jump", t("Jump", "Saut")], ["shake", t("Shake", "Secousse")], ["swing", t("Swing (pendulum)", "Balancier (pendule)")], ["squash", t("Squash", "Écrasement")], ["wobble", t("Wobble (jelly)", "Gelée")], ["spin", t("Spin", "Tourbillon")], ["flip", t("Flip", "Retournement")], ["pulse", t("Pulse", "Pulsation")], ["glow", t("Light up", "S'illuminer")]];
  const FX = () => [["none", t("None", "Aucune")], ["sparkle", t("Sparkles", "Étincelles")], ["magic", t("Magic dust", "Poussière magique")], ["smoke", t("Smoke", "Fumée")], ["leaves", t("Leaves", "Feuilles")], ["petals", t("Petals", "Pétales")], ["coins", t("Coins", "Pièces")], ["hearts", t("Hearts", "Cœurs")], ["bubbles", t("Bubbles", "Bulles")], ["flames", t("Flames", "Flammes")], ["stars", t("Stars", "Étoiles")], ["notes", t("Music notes", "Notes de musique")], ["snow", t("Snow", "Neige")]];
  const SOUND = () => [["none", t("Silent", "Silencieux")], ["pop", "Pop"], ["drop", t("Thump", "Bruit sourd")], ["wood", t("Wood", "Bois")], ["chime", t("Chime", "Carillon")], ["bell", t("Bells", "Cloches")], ["coin", t("Coin", "Pièce")], ["magic", t("Magic", "Magie")], ["whoosh", t("Whoosh", "Souffle")], ["water", t("Water", "Eau")], ["fire", t("Fire", "Feu")], ["thud", t("Heavy thud", "Choc lourd")]];

  const clone = (d) => ({ id: (d && d.id) || nid(), name: (d && d.name) || t("New table", "Nouvelle table"), offered: d ? !!d.offered : false, saved: !!(d && d.id), layout: JSON.parse(JSON.stringify((d && d.layout) || {})), props: ((d && d.props) || []).map((p) => Object.assign({}, p)), slots: ((d && d.slots) || []).map((p) => Object.assign({}, p)), objects: ((d && d.objects) || []).map((p) => Object.assign({}, p)), ambience: d && d.ambience ? Object.assign({}, d.ambience) : null });
  const nid = () => "p" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const stage = () => document.getElementById("stage");
  function pt(e) { return U().toStage(e.clientX, e.clientY); }
  function rectOf(x) { return U().rectOf(x); }
  function snapV(v) { return snap ? Math.round(v / 5) * 5 : Math.round(v); }

  // ---------------------------------------------------------------- open / close
  let prevPhase = null;
  function open(cb) {
    onClose = cb || null;
    prevPhase = root.WA_AMB ? root.WA_AMB.phase : null; if (root.WA_AMB) root.WA_AMB.setPhase("tavern"); // the table's own music is heard while editing it
    const S = root.WA_STORE, list = S && S.tables ? S.tables : [];
    load(list.find((x) => x.id === (S && S.tablePick)) || list[0] || null);
    U().tableEditing = true; root.WA_TABLE.testing = false;
    stage().classList.add("tedit");
    const sz = $("#sellZone"); if (sz) sz.dataset.tlabel = t("Sell zone", "Zone de revente");
    // the duo portal only exists in duos: shown here so it can be placed
    const po = $("#portal"); if (po && po.hidden) { po.hidden = false; po.dataset.teditShown = "1"; po._key = null; if (!po.innerHTML.trim()) po.innerHTML = `<div class="pt-ring"><i></i><i></i></div><div class="pt-lbl"><b>${t("Partner", "Partenaire")}</b><span>${t("Duo portal", "Portail du duo")}</span></div>`; }
    const eh = $("#ehero"); if (eh && eh.hidden) { eh.hidden = false; eh.dataset.teditShown = "1"; if (!eh.innerHTML.trim()) eh.innerHTML = `<div class="crest" style="background:hsl(0 50% 35%)">?</div><div class="hp-gem">30</div><div class="hname">${t("Opponent", "Adversaire")}</div>`; }
    layer = document.createElement("div"); layer.id = "teditLayer";
    el = document.createElement("div"); el.id = "teditPanel"; el.className = "tp";
    stage().appendChild(layer); stage().appendChild(el);
    el.addEventListener("input", onInput); el.addEventListener("change", onInput); el.addEventListener("click", onClick);
    layer.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    apply(); render();
  }
  function close(force) {
    if (!el) return;
    if (dirty && !force) { const b = $('[data-a="close"]', el); if (b && !b.dataset.sure) { b.dataset.sure = "1"; b.textContent = t("Close without saving?", "Fermer sans enregistrer ?"); return; } }
    window.removeEventListener("keydown", onKey);
    el.remove(); layer.remove(); el = layer = null;
    if (root.WA_AMB && prevPhase) root.WA_AMB.setPhase(prevPhase);
    stage().classList.remove("tedit", "ttest");
    const eh = $("#ehero"); if (eh && eh.dataset.teditShown) { eh.hidden = true; delete eh.dataset.teditShown; }
    const po = $("#portal"); if (po && po.dataset.teditShown) { po.hidden = true; delete po.dataset.teditShown; po.innerHTML = ""; po._key = null; }
    U().tableEditing = false; root.WA_TABLE.testing = false;
    U().applyTableDesign(); // back to what is saved
    if (onClose) onClose();
  }
  // the table being edited (one of the meta's saved tables, or a new one); the collection objects are shared by all of them
  function load(tbl) {
    const S = root.WA_STORE;
    D = clone(tbl); D.saved = !!tbl; if (!tbl && !tableList().length) D.offered = true; // the very first table is offered right away
    D.objects = ((S && S.tableObjects) || []).map((p) => Object.assign({}, p));
    sel = null; dirty = false; undo = [];
  }
  const tableList = () => (root.WA_STORE && root.WA_STORE.tables) || [];
  async function save(asNew) {
    const S = root.WA_STORE;
    if (!S || !S.saveTable) { status(t("No storage in this browser.", "Pas de stockage dans ce navigateur."), "err"); return; }
    if (asNew) { D.id = nid(); D.name = (D.name || t("Table", "Table")).replace(/( \(\d+\))?$/, "") + " (" + (tableList().length + 1) + ")"; }
    await S.saveTable(D); await S.saveTableObjects(D.objects); D.saved = true; dirty = false;
    render();
    status(asNew ? t("Saved as a new table.", "Enregistrée comme nouvelle table.") : D.offered ? t("Saved. Players can pick it in their Collection.", "Enregistrée. Les joueurs peuvent la choisir dans leur Collection.") : t("Saved (not offered to players yet).", "Enregistrée (pas encore proposée aux joueurs)."), "ok");
  }
  async function switchTo(id) {
    if (dirty) { render(); status(t("Save or undo your changes first.", "Enregistrez ou annulez vos changements d'abord."), "err"); return; }
    load(id === "__new" ? null : tableList().find((x) => x.id === id) || null);
    if (id === "__new") { D.layout = {}; D.props = []; D.slots = []; }
    apply(); render();
  }
  async function deleteTable() {
    const S = root.WA_STORE; if (!D.saved) { switchTo(tableList()[0] ? tableList()[0].id : "__new"); return; }
    await S.deleteTable(D.id); dirty = false; load(tableList()[0] || null); apply(); render();
    status(t("Table deleted.", "Table supprimée."), "ok");
  }
  const IMGS = new Map(); // id -> image Blob, kept out of the undo snapshots
  function touch(push = true) { if (push) { for (const p of D.props.concat(D.objects)) IMGS.set(p.id, p.img); if (D.ambience && D.ambience.music) IMGS.set("amb:music", D.ambience.music); undo.push(JSON.stringify({ ambience: D.ambience ? Object.assign({}, D.ambience, { music: D.ambience.music ? "amb:music" : null }) : null, layout: D.layout, props: D.props.map((p) => Object.assign({}, p, { img: null })), slots: D.slots, objects: D.objects.map((p) => Object.assign({}, p, { img: null })) })); if (undo.length > 60) undo.shift(); } dirty = true; apply(); renderHead(); }
  function doUndo() {
    const last = undo.pop(); if (!last) return;
    const o = JSON.parse(last), back = (l) => l.map((p) => Object.assign(p, { img: IMGS.get(p.id) || null })).filter((p) => p.img);
    D.layout = o.layout; D.ambience = o.ambience ? Object.assign({}, o.ambience, { music: o.ambience.music ? IMGS.get("amb:music") || null : null }) : null; D.props = back(o.props); D.slots = o.slots || []; D.objects = back(o.objects || []);
    dirty = true; apply(); render();
  }
  function apply() { U().applyTableDesign(D); requestAnimationFrame(drawBoxes); }
  function status(msg, cls = "") { const s = $("#tpStatus", el); if (s) { s.textContent = msg; s.className = "tp-status " + cls; } }

  // ---------------------------------------------------------------- the boxes over the table
  function items() {
    const out = [];
    for (const [k, s, en, f] of U().TABLE_EL) { const e = $(s); if (!e || e.hidden || getComputedStyle(e).display === "none") continue; out.push({ kind: "el", key: k, e, name: fr() ? f : en }); }
    for (const p of D.props) { const e = document.querySelector(`.props-layer .prop[data-id="${p.id}"]`); if (e) out.push({ kind: "prop", key: p.id, e, name: p.name || t("Sprite", "Sprite") }); }
    for (const sl of D.slots) { const e = document.querySelector(`.slot-ph[data-slot="${sl.id}"]`); if (e) out.push({ kind: "slot", key: sl.id, e, name: "▢ " + (sl.name || t("Placeholder", "Emplacement")) }); }
    return out;
  }
  function drawBoxes() {
    if (!layer) return;
    if (stage().classList.contains("ttest")) { layer.innerHTML = ""; return; }
    // big boxes first, so the small ones lying on them stay clickable
    layer.innerHTML = items().map((it) => Object.assign(it, { r: rectOf(it.e) })).sort((a, b) => b.r.w * b.r.h - a.r.w * a.r.h).map((it) => {
      const r = it.r, on = sel && sel.kind === it.kind && sel.key === it.key;
      const hidden = it.kind === "el" && D.layout[it.key] && D.layout[it.key].hide;
      return `<div class="tbox ${it.kind}${on ? " on" : ""}${hidden ? " ghost" : ""}" data-kind="${it.kind}" data-key="${esc(it.key)}" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px">
        <span class="tlab">${esc(it.name)}</span><i class="th scale" data-h="scale"></i>${it.kind !== "el" ? `<i class="th rot" data-h="rot"></i>` : ""}</div>`;
    }).join("");
  }

  function itemOf(kind, key) { return (kind === "slot" ? D.slots : kind === "obj" ? D.objects : D.props).find((x) => x.id === key); }
  // ---------------------------------------------------------------- dragging: move, resize, rotate
  let op = null;
  function onDown(e) {
    const box = e.target.closest(".tbox"); if (!box) { sel = null; drawBoxes(); render(); return; }
    e.preventDefault();
    const kind = box.dataset.kind, key = box.dataset.key, h = e.target.dataset.h || "move";
    sel = { kind, key }; render(); drawBoxes();
    const p0 = pt(e), r = rectOf(box);
    touch(true); dirty = true;
    if (kind === "el") { const o = D.layout[key] || (D.layout[key] = {}); op = { kind, key, h, p0, dx: o.dx || 0, dy: o.dy || 0, s: o.s || 1, w: r.w, hgt: r.h }; }
    else { const pr = itemOf(kind, key); op = { kind, key, h, p0, x: pr.x, y: pr.y, w: pr.w, hh: pr.h, rot: pr.rot || 0, cx: r.cx, cy: r.cy }; }
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp, { once: true });
  }
  function onMove(e) {
    if (!op) return;
    const p = pt(e), dx = p.x - op.p0.x, dy = p.y - op.p0.y;
    if (op.kind === "el") {
      const o = D.layout[op.key];
      if (op.h === "scale" && op.key === "sell") { o.w = Math.max(120, snapV(op.w + dx)); o.h = Math.max(80, snapV(op.hgt + dy)); } // stretched freely
      else if (op.h === "scale") o.s = Math.max(0.4, Math.min(2.5, Math.round(op.s * (1 + (dx + dy) / (op.w + op.hgt)) * 100) / 100));
      else { o.dx = snapV(op.dx + dx); o.dy = snapV(op.dy + dy); }
    } else {
      const pr = itemOf(op.kind, op.key); if (!pr) return;
      if (op.h === "scale" && op.kind === "slot") { pr.w = Math.max(16, snapV(op.w + dx)); pr.h = Math.max(16, snapV(op.hh + dy)); } // a placeholder stretches freely
      else if (op.h === "scale") { const k = Math.max(0.1, 1 + (dx + dy) / (op.w + op.hh)); pr.w = Math.max(12, Math.round(op.w * k)); pr.h = Math.max(12, Math.round(op.hh * k)); }
      else if (op.h === "rot") { const a = Math.atan2(p.y - op.cy, p.x - op.cx) * 180 / Math.PI + 90; pr.rot = snap ? Math.round(a / 5) * 5 : Math.round(a); }
      else { pr.x = snapV(op.x + dx); pr.y = snapV(op.y + dy); }
    }
    dirty = true; U().applyTableDesign(D); drawBoxes(); renderProps();
  }
  function onUp() { window.removeEventListener("pointermove", onMove); op = null; apply(); render(); }
  function onKey(e) {
    if (!el || !sel || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || "")) { if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); doUndo(); } return; }
    const n = e.shiftKey ? 10 : 1;
    const mv = { ArrowLeft: [-n, 0], ArrowRight: [n, 0], ArrowUp: [0, -n], ArrowDown: [0, n] }[e.key];
    if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); doUndo(); return; }
    if (mv) {
      e.preventDefault(); touch(true);
      if (sel.kind === "el") { const o = D.layout[sel.key] || (D.layout[sel.key] = {}); o.dx = (o.dx || 0) + mv[0]; o.dy = (o.dy || 0) + mv[1]; }
      else { const pr = itemOf(sel.kind, sel.key); if (pr && pr.x != null) { pr.x += mv[0]; pr.y += mv[1]; } }
      apply(); render(); return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && sel.kind !== "el") { e.preventDefault(); removeProp(sel.key); }
  }

  // ---------------------------------------------------------------- the panel
  function render() { if (!el) return; el.innerHTML = `<header class="tp-head"></header><div class="tp-body"></div>`; renderHead(); renderBody(); }
  function renderHead() {
    const h = $(".tp-head", el); if (!h) return;
    // only the title changes in place: rebuilding the buttons while a field loses focus would swallow the click on Save
    const title = `<b>${t("Table workshop", "Atelier de table")}</b><span class="tp-tname">${esc(D.name)}${D.offered ? " ★" : ""}</span>${dirty ? `<i>${t("unsaved", "non enregistré")}</i>` : ""}`;
    const ti = $(".tp-title", h), tb = $('[data-a="test"]', h), cb = $('[data-a="collapse"]', h);
    if (ti && tb && cb) { ti.innerHTML = title; const on = stage().classList.contains("ttest"); tb.classList.toggle("on", on); tb.textContent = on ? t("Back to editing", "Retour à l'édition") : t("Try the clicks", "Tester les clics"); cb.textContent = el.classList.contains("folded") ? "◀" : "▶"; return; }
    h.innerHTML = `<div class="tp-title"><b>${t("Table workshop", "Atelier de table")}</b><span class="tp-tname">${esc(D.name)}${D.offered ? " ★" : ""}</span>${dirty ? `<i>${t("unsaved", "non enregistré")}</i>` : ""}</div>
      <div class="tp-tools"><button class="pill small${stage().classList.contains("ttest") ? " on" : ""}" data-a="test" title="${esc(t("Play with the sprites as a player would", "Jouer avec les sprites comme un joueur"))}">${stage().classList.contains("ttest") ? t("Back to editing", "Retour à l'édition") : t("Try the clicks", "Tester les clics")}</button>
      <label class="tp-chk"><input type="checkbox" data-a="snap" ${snap ? "checked" : ""}> ${t("Snap", "Magnétisme")}</label><button class="pill small" data-a="undo" title="Ctrl+Z">↶</button>
      <button class="pill small" data-a="dock" title="${esc(t("Move the panel to the other side", "Mettre le panneau de l'autre côté"))}">⇄</button><button class="pill small" data-a="collapse" title="${esc(t("Fold the panel", "Replier le panneau"))}">${el.classList.contains("folded") ? "◀" : "▶"}</button></div>
      <div class="tp-actions"><span id="tpStatus" class="tp-status"></span><button class="pill big" data-a="save">${t("Save", "Enregistrer")}</button><button class="pill" data-a="close">${t("Close", "Fermer")}</button></div>`;
  }
  const num = (k, v, min, max, label, step = 1) => `<label class="tp-f"><span>${esc(label)}</span><input type="number" data-k="${k}" value="${v}" min="${min}" max="${max}" step="${step}"></label>`;
  const rng = (k, v, min, max, step, label, fmt = (x) => x) => `<label class="tp-f wide"><span>${esc(label)} <b>${fmt(v)}</b></span><input type="range" data-k="${k}" value="${v}" min="${min}" max="${max}" step="${step}"></label>`;
  const pick = (k, v, pairs, label) => `<label class="tp-f wide"><span>${esc(label)}</span><select data-k="${k}">${pairs.map(([a, b]) => `<option value="${esc(a)}"${a === v ? " selected" : ""}>${esc(b)}</option>`).join("")}</select></label>`;
  function renderBody() {
    const b = $(".tp-body", el); if (!b) return;
    const tl = tableList();
    let h = `<section class="tp-sec tp-tables"><h4>${t("Tables", "Tables")} (${tl.length})</h4>
      <label class="tp-f wide"><span>${t("Editing", "Table en cours")}</span><select data-a="tsel">${tl.map((x) => `<option value="${esc(x.id)}"${x.id === D.id ? " selected" : ""}>${esc(x.name)}${x.offered ? " ★" : ""}</option>`).join("")}${D.saved ? "" : `<option value="${esc(D.id)}" selected>${esc(D.name)} (${t("not saved", "non enregistrée")})</option>`}<option value="__new">＋ ${t("New empty table", "Nouvelle table vide")}</option></select></label>
      <label class="tp-f wide"><span>${t("Name", "Nom")}</span><input type="text" data-a="tname" value="${esc(D.name)}" maxlength="40"></label>
      <label class="tp-chk"><input type="checkbox" data-a="offered" ${D.offered ? "checked" : ""}> ★ ${t("Offered to players (they pick it in their Collection)", "Proposée aux joueurs (ils la choisissent dans leur Collection)")}</label>
      <div class="tp-row"><button class="pill small" data-a="saveas" title="${esc(t("Keep this one and save a copy under a new name", "Garder celle-ci et enregistrer une copie sous un nouveau nom"))}">${t("Save as a new table", "Enregistrer comme nouvelle table")}</button><button class="pill small danger" data-a="deltable">${t("Delete this table", "Supprimer cette table")}</button></div></section>`;
    h += `<p class="tp-hint">${t("Drag any outlined element to move it, its corner to resize it. Arrow keys nudge (Shift: 10 px).", "Glissez un élément encadré pour le déplacer, son coin pour le redimensionner. Les flèches le décalent (Maj : 10 px).")}</p>`;
    if (sel && sel.kind === "el") {
      const it = U().TABLE_EL.find((x) => x[0] === sel.key), o = D.layout[sel.key] || {};
      h += `<section class="tp-sec"><h4>${esc(fr() ? it[3] : it[2])}</h4><div class="tp-grid">${num("dx", o.dx || 0, -1400, 1400, "X")}${num("dy", o.dy || 0, -800, 800, "Y")}</div>
        ${sel.key === "sell" ? `<div class="tp-grid">${num("w", o.w || Math.round(rectOf($("#sellZone")).w), 120, 1400, t("Width", "Largeur"))}${num("h", o.h || Math.round(rectOf($("#sellZone")).h), 80, 800, t("Height", "Hauteur"))}</div>
        <p class="tp-hint">${t("While a minion from your warband is dragged, dropping it inside this zone sells it (except over the warband itself).", "Pendant qu'on traîne un serviteur de sa troupe, le lâcher dans cette zone le vend (sauf au-dessus de la troupe elle-même).")}</p>` : rng("s", o.s || 1, 0.4, 2.5, 0.05, t("Size", "Taille"), (x) => Math.round(x * 100) + "%")}
        ${["rank", "sound", "players", "keeper", "aff1", "aff2", "pressure"].includes(sel.key) ? `<label class="tp-chk"><input type="checkbox" data-k="hide" ${o.hide ? "checked" : ""}> ${t("Hide it", "Le masquer")}</label>` : ""}
        ${sel.key === "pressure" ? `<p class="tp-hint">${t("The Steam ring fills with Pressure. Players see it as soon as they have a Steam minion.", "L'anneau à vapeur se remplit de Pression. Les joueurs le voient dès qu'ils ont un serviteur Vapeur.")}</p>` : ""}
        ${sel.key === "aff1" || sel.key === "aff2" ? `${pick("frame", o.frame || "shell", [["shell", t("Shell frame", "Cadre coquillage")], ["none", t("No frame (icon only)", "Sans cadre (icône seule)")]], t("Frame", "Cadre"))}
        <p class="tp-hint">${t("Shows the player's strongest affinities (slot 1: the strongest, slot 2: the next one), their count and the state of their mechanic.", "Affiche les affinités les plus fortes du joueur (emplacement 1 : la plus forte, emplacement 2 : la suivante), leur nombre et l'état de leur mécanique.")}</p>` : ""}
        <div class="tp-row"><button class="pill small" data-a="resetel">${t("Put it back", "Remettre en place")}</button></div></section>`;
    } else if (sel && sel.kind === "prop") {
      const pr = D.props.find((x) => x.id === sel.key);
      if (pr) h += `<section class="tp-sec"><h4>${t("Sprite", "Sprite")}</h4>
        <label class="tp-f wide"><span>${t("Name", "Nom")}</span><input type="text" data-k="name" value="${esc(pr.name || "")}" maxlength="30"></label>
        <div class="tp-grid">${num("x", pr.x, -400, 1600, "X")}${num("y", pr.y, -400, 1000, "Y")}${num("w", pr.w, 8, 1600, t("Width", "Largeur"))}${num("h", pr.h, 8, 1200, t("Height", "Hauteur"))}</div>
        ${rng("rot", pr.rot || 0, -180, 180, 1, t("Rotation", "Rotation"), (x) => x + "°")}${rng("opacity", pr.opacity == null ? 1 : pr.opacity, 0.1, 1, 0.05, t("Opacity", "Opacité"), (x) => Math.round(x * 100) + "%")}
        <div class="tp-grid">${pick("layer", pr.layer || "back", [["back", t("Behind the minions", "Derrière les serviteurs")], ["front", t("In front of the table", "Devant la table")]], t("Layer", "Couche"))}</div>
        <label class="tp-chk"><input type="checkbox" data-k="flip" ${pr.flip ? "checked" : ""}> ${t("Mirror it", "En miroir")}</label>
        <h4>${t("Alive", "Vivant")}</h4>
        ${pick("idle", pr.idle || "none", IDLE(), t("At rest", "Au repos"))}
        ${pick("react", pr.react || "none", REACT(), t("When clicked", "Au clic"))}${pick("fx", pr.fx || "none", FX(), t("Particles", "Particules"))}${pick("sound", pr.sound || "none", SOUND(), t("Sound", "Son"))}
        ${rng("power", pr.power || 1, 0.3, 2.5, 0.1, t("Strength", "Intensité"), (x) => "×" + (+x).toFixed(1))}${rng("speed", pr.speed || 1, 0.3, 2.5, 0.1, t("Speed", "Vitesse"), (x) => "×" + (+x).toFixed(1))}
        <div class="tp-row"><button class="pill small" data-a="tryprop">${t("Try it", "Essayer")}</button><button class="pill small" data-a="up">${t("Forward", "Avancer")}</button><button class="pill small" data-a="down">${t("Backward", "Reculer")}</button><button class="pill small" data-a="dup">${t("Duplicate", "Dupliquer")}</button><button class="pill small danger" data-a="delprop">${t("Delete", "Supprimer")}</button></div></section>`;
    } else if (sel && sel.kind === "slot") {
      const sl = itemOf("slot", sel.key), dec = U().decor;
      if (sl) h += `<section class="tp-sec"><h4>▢ ${t("Placeholder", "Emplacement")}</h4>
        <p class="tp-hint">${t("An empty spot on the table: players fill it with one of their objects from the Collection. It stays invisible while empty.", "Une place vide sur la table : le joueur y pose un de ses objets depuis la Collection. Invisible tant qu'elle est vide.")}</p>
        <label class="tp-f wide"><span>${t("Name", "Nom")}</span><input type="text" data-k="name" value="${esc(sl.name || "")}" maxlength="30"></label>
        <div class="tp-grid">${num("x", sl.x, -400, 1600, "X")}${num("y", sl.y, -400, 1000, "Y")}${num("w", sl.w, 16, 1600, t("Width", "Largeur"))}${num("h", sl.h, 16, 1200, t("Height", "Hauteur"))}</div>
        ${rng("rot", sl.rot || 0, -180, 180, 1, t("Rotation", "Rotation"), (x) => x + "°")}
        ${pick("layer", sl.layer || "back", [["back", t("Behind the minions", "Derrière les serviteurs")], ["front", t("In front of the table", "Devant la table")]], t("Layer", "Couche"))}
        ${pick("preview", dec[sl.id] || "", [["", t("Empty", "Vide")], ...D.objects.map((o) => [o.id, o.name || t("Object", "Objet")])], t("Preview with (your own Collection choice)", "Aperçu avec (votre propre choix de Collection)"))}
        <div class="tp-row"><button class="pill small" data-a="dup">${t("Duplicate", "Dupliquer")}</button><button class="pill small danger" data-a="delprop">${t("Delete", "Supprimer")}</button></div></section>`;
    } else if (sel && sel.kind === "obj") {
      const pr = itemOf("obj", sel.key);
      if (pr) h += `<section class="tp-sec"><h4>🎁 ${t("Collection object", "Objet de collection")}</h4>
        <p class="tp-hint">${t("Players can put it in any placeholder. Its size follows the placeholder.", "Les joueurs peuvent le poser dans n'importe quel emplacement. Sa taille suit celle de l'emplacement.")}</p>
        <label class="tp-f wide"><span>${t("Name", "Nom")}</span><input type="text" data-k="name" value="${esc(pr.name || "")}" maxlength="30"></label>
        ${pick("idle", pr.idle || "none", IDLE(), t("At rest", "Au repos"))}${pick("react", pr.react || "none", REACT(), t("When clicked", "Au clic"))}${pick("fx", pr.fx || "none", FX(), t("Particles", "Particules"))}${pick("sound", pr.sound || "none", SOUND(), t("Sound", "Son"))}
        ${rng("power", pr.power || 1, 0.3, 2.5, 0.1, t("Strength", "Intensité"), (x) => "×" + (+x).toFixed(1))}${rng("speed", pr.speed || 1, 0.3, 2.5, 0.1, t("Speed", "Vitesse"), (x) => "×" + (+x).toFixed(1))}
        <label class="tp-chk"><input type="checkbox" data-k="flip" ${pr.flip ? "checked" : ""}> ${t("Mirror it", "En miroir")}</label>
        <div class="tp-row"><button class="pill small danger" data-a="delprop">${t("Delete", "Supprimer")}</button></div></section>`;
    } else h += `<p class="tp-hint">${t("Click an element or a sprite to tune it.", "Cliquez un élément ou un sprite pour le régler.")}</p>`;
    h += ambHTML();
    h += `<section class="tp-sec"><h4>${t("Sprites", "Sprites")} (${D.props.length})</h4>
      <div class="tp-sprites">${D.props.map((p) => `<button class="tp-sp${sel && sel.key === p.id ? " on" : ""}" data-a="selprop" data-id="${p.id}" title="${esc(p.name || "")}"><img src="${esc(spriteUrl(p))}" alt=""></button>`).join("")}
      <label class="tp-add" title="${esc(t("Add a sprite (PNG with transparency works best)", "Ajouter un sprite (un PNG transparent rend le mieux)"))}">＋<input type="file" accept="image/*" multiple data-a="addfile" hidden></label></div>
      <p class="tp-hint">${t("PNG or WebP with a transparent background. Animated GIFs play too.", "PNG ou WebP à fond transparent. Les GIF animés fonctionnent aussi.")}</p></section>
      <section class="tp-sec"><h4>▢ ${t("Placeholders", "Emplacements")} (${D.slots.length})</h4>
      <div class="tp-sprites">${D.slots.map((sl) => `<button class="tp-sp slot${sel && sel.key === sl.id ? " on" : ""}" data-a="selslot" data-id="${sl.id}" title="${esc(sl.name || "")}">▢<small>${esc((sl.name || "").slice(0, 8))}</small></button>`).join("")}<button class="tp-add" data-a="addslot" title="${esc(t("Add a placeholder", "Ajouter un emplacement"))}">＋</button></div></section>
      <section class="tp-sec"><h4>🎁 ${t("Collection objects", "Objets de collection")} (${D.objects.length})</h4>
      <div class="tp-sprites">${D.objects.map((o) => `<button class="tp-sp${sel && sel.key === o.id ? " on" : ""}" data-a="selobj" data-id="${o.id}" title="${esc(o.name || "")}"><img src="${esc(spriteUrl(o))}" alt=""></button>`).join("")}
      <label class="tp-add" title="${esc(t("Add objects players can place", "Ajouter des objets que les joueurs pourront poser"))}">＋<input type="file" accept="image/*" multiple data-a="addobj" hidden></label></div>
      <p class="tp-hint">${t("For now every player owns all of them; how they are earned will come later.", "Pour l'instant chaque joueur les possède tous ; la façon de les gagner viendra plus tard.")}</p></section>
      <section class="tp-sec"><div class="tp-row"><button class="pill small" data-a="resetall">${t("Put every element back", "Remettre tous les éléments en place")}</button><button class="pill small danger" data-a="clearprops">${t("Remove all sprites", "Retirer tous les sprites")}</button></div></section>`;
    b.innerHTML = h;
  }
  const URLS = new Map();
  function spriteUrl(p) { if (typeof p.img === "string") return p.img; let u = URLS.get(p.img); if (!u && p.img) { u = URL.createObjectURL(p.img); URLS.set(p.img, u); } return u || ""; }
  function renderProps() { /* numbers in the panel follow the drag */ if (!sel || sel.kind !== "prop") return; const pr = D.props.find((x) => x.id === sel.key); if (!pr) return; for (const k of ["x", "y", "w", "h"]) { const i = $(`input[data-k="${k}"]`, el); if (i && document.activeElement !== i) i.value = pr[k]; } }


  // ---------------------------------------------------------------- ambience: weather, light, motion, music
  function ambHTML() {
    const A = Object.assign({}, root.WA_AMB ? root.WA_AMB.DEF : {}, D.ambience || {}), FX = root.WA_AMB ? root.WA_AMB.FX : {}, MO = root.WA_AMB ? root.WA_AMB.MOTIONS : {};
    const L = (pair) => (fr() ? pair[1] : pair[0]);
    const ar = (k, v, min, max, step, label, fmt) => `<label class="tp-f wide"><span>${esc(label)} <b>${fmt(v)}</b></span><input type="range" data-amb="${k}" value="${v}" min="${min}" max="${max}" step="${step}"></label>`;
    const col = (k, v, label) => `<label class="tp-f"><span>${esc(label)}</span><input type="color" data-amb="${k}" value="${esc(v)}"></label>`;
    const pct = (x) => Math.round(x * 100) + "%", times = (x) => "×" + (+x).toFixed(1);
    const fxOn = A.fx && A.fx !== "none";
    return `<section class="tp-sec tp-amb"><h4>✨ ${t("Ambience", "Ambiance")}</h4>
      <label class="tp-f wide"><span>${t("Weather & particles", "Météo & particules")}</span><select data-amb="fx"><option value="none">${t("None", "Aucune")}</option>${Object.keys(FX).map((k) => `<option value="${k}"${A.fx === k ? " selected" : ""}>${esc(L(FX[k].label))}</option>`).join("")}</select></label>
      ${fxOn ? `${ar("density", A.density, 0.2, 3, 0.1, t("Density", "Densité"), times)}${ar("speed", A.speed, 0.2, 3, 0.1, t("Speed", "Vitesse"), times)}
      <div class="tp-grid">${col("color", A.color || FX[A.fx].c, t("Colour", "Couleur"))}<label class="tp-chk"><input type="checkbox" data-amb="front" ${A.front ? "checked" : ""}> ${t("In front of the cards", "Devant les cartes")}</label></div>` : ""}
      <div class="tp-grid">${col("tint", A.tint, t("Tint", "Teinte"))}</div>
      ${ar("tintA", A.tintA, 0, 0.8, 0.02, t("Tint strength", "Force de la teinte"), pct)}
      ${ar("vignette", A.vignette, 0, 1, 0.05, t("Vignette", "Vignettage"), pct)}
      ${ar("rays", A.rays, 0, 1, 0.05, t("Light rays", "Rayons de lumière"), pct)}
      ${A.rays > 0 ? `<div class="tp-grid">${col("raysColor", A.raysColor, t("Ray colour", "Couleur des rayons"))}</div>` : ""}
      <label class="tp-f wide"><span>${t("Background motion", "Mouvement du fond")}</span><select data-amb="motion">${Object.keys(MO).map((k) => `<option value="${k}"${A.motion === k ? " selected" : ""}>${esc(L(MO[k]))}</option>`).join("")}</select></label>
      <div class="tp-amb-music"><span>🎵 ${t("Music", "Musique")}</span>${A.music ? `<small>${t("a loop is set", "une boucle est définie")}</small><button class="pill small" data-a="ambplay">${t("Listen", "Écouter")}</button><button class="pill small danger" data-a="ambnomusic">${t("Remove", "Retirer")}</button>` : `<label class="pill small">${t("Add a loop (MP3, OGG)", "Ajouter une boucle (MP3, OGG)")}<input type="file" accept="audio/*" data-a="ambmusic" hidden></label>`}</div>
      ${A.music ? ar("musicVol", A.musicVol, 0, 1, 0.05, t("Volume", "Volume"), pct) : ""}
      <p class="tp-hint">${t("The music loops during games on this table, and stays silent while the sound is off.", "La musique tourne en boucle pendant les parties sur cette table, et se tait quand le son est coupé.")}</p>
      <div class="tp-row"><button class="pill small" data-a="ambreset">${t("No ambience", "Aucune ambiance")}</button></div></section>`;
  }
  function onAmb(e) {
    const tg = e.target, k = tg.dataset.amb; if (!k) return false;
    let v = tg.type === "checkbox" ? tg.checked : tg.type === "range" ? +tg.value : tg.value;
    if (!tg._pushed) { touch(true); tg._pushed = true; setTimeout(() => (tg._pushed = false), 400); }
    const A = D.ambience = Object.assign({}, root.WA_AMB ? root.WA_AMB.DEF : {}, D.ambience || {});
    if (k === "fx" && v !== A.fx) A.color = "";
    A[k] = v; dirty = true; apply(); renderHead();
    if (tg.type === "range") { const b = tg.parentElement.querySelector("b"); if (b) b.textContent = /density|speed/.test(k) ? "×" + v.toFixed(1) : Math.round(v * 100) + "%"; }
    if (e.type === "change" && (tg.tagName === "SELECT" || k === "rays")) renderBody();
    return true;
  }
  async function addMusic(file) {
    if (!file || !/^audio\//.test(file.type)) { status(t("That is not an audio file.", "Ce n'est pas un fichier audio."), "err"); return; }
    if (file.size > 5e6) { status(t("That music is too big (5 MB max).", "Musique trop lourde (5 Mo max)."), "err"); return; }
    touch(true); D.ambience = Object.assign({}, root.WA_AMB ? root.WA_AMB.DEF : {}, D.ambience || {}, { music: file.slice(0, file.size, file.type) });
    apply(); render(); if (root.WA_AMB) root.WA_AMB.unlock();
    status(t("Music added: it plays in a loop on this table.", "Musique ajoutée : elle tourne en boucle sur cette table."), "ok");
  }
  function onInput(e) {
    const tg = e.target, k = tg.dataset.k;
    if (tg.dataset.a === "ambmusic") { if (e.type === "change") addMusic(tg.files && tg.files[0]); return; }
    if (tg.dataset.amb) { onAmb(e); return; }
    if (tg.dataset.a === "addfile") { if (e.type === "change") addFiles(tg.files); return; }
    if (tg.dataset.a === "addobj") { if (e.type === "change") addFiles(tg.files, true); return; }
    if (k === "preview" && sel && sel.kind === "slot") { if (e.type === "change") { U().setDecor(sel.key, tg.value); requestAnimationFrame(drawBoxes); } return; }
    if (tg.dataset.a === "snap") { snap = tg.checked; return; }
    if (tg.dataset.a === "tsel") { if (e.type === "change") switchTo(tg.value); return; }
    if (tg.dataset.a === "tname") { D.name = tg.value.slice(0, 40); dirty = true; renderHead(); return; }
    if (tg.dataset.a === "offered") { if (e.type === "change") { D.offered = tg.checked; dirty = true; renderHead(); } return; }
    if (!k || !sel) return;
    let v = tg.type === "checkbox" ? tg.checked : tg.type === "number" || tg.type === "range" ? +tg.value : tg.value;
    if (e.type === "change" || tg.type === "range") { if (!tg._pushed) { touch(true); tg._pushed = true; setTimeout(() => (tg._pushed = false), 400); } }
    if (sel.kind === "el") { const o = D.layout[sel.key] || (D.layout[sel.key] = {}); o[k] = v; if (k === "s" && v === 1) delete o.s; }
    else { const pr = itemOf(sel.kind, sel.key); if (!pr) return; if (k === "w" && pr.w && sel.kind === "prop") { const r = pr.h / pr.w; pr.w = v; pr.h = Math.round(v * r); } else pr[k] = v; }
    dirty = true; apply(); renderHead();
    if (tg.type === "range") { const b = tg.parentElement.querySelector("b"); if (b) b.textContent = k === "rot" ? v + "°" : k === "s" || k === "opacity" ? Math.round(v * 100) + "%" : "×" + v.toFixed(1); }
    if (e.type === "change" && (tg.tagName === "SELECT" || tg.type === "checkbox" || k === "w")) renderBody();
    if (e.type === "change" && tg.tagName === "SELECT" && k === "react" && sel.kind === "prop") { const pr = D.props.find((x) => x.id === sel.key); setTimeout(() => tryProp(pr), 60); }
  }
  function onClick(e) {
    const b = e.target.closest("[data-a]"); if (!b || b.tagName === "INPUT") return;
    const a = b.dataset.a;
    switch (a) {
      case "save": save(); return;
      case "saveas": save(true); return;
      case "deltable": if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = t("Delete it? Click again", "La supprimer ? Cliquez encore"); return; } deleteTable(); return;
      case "close": close(); return;
      case "undo": doUndo(); return;
      case "collapse": el.classList.toggle("folded"); renderHead(); return;
      case "dock": el.classList.toggle("left"); return;
      case "test": stage().classList.toggle("ttest"); root.WA_TABLE.testing = stage().classList.contains("ttest"); drawBoxes(); renderHead(); return;
      case "resetel": touch(true); delete D.layout[sel.key]; apply(); render(); return;
      case "resetall": if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = t("Sure? Click again", "Sûr ? Cliquez encore"); return; } touch(true); D.layout = {}; apply(); render(); return;
      case "clearprops": if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = t("Sure? Click again", "Sûr ? Cliquez encore"); return; } touch(true); D.props = []; sel = null; apply(); render(); return;
      case "selprop": sel = { kind: "prop", key: b.dataset.id }; render(); drawBoxes(); return;
      case "selslot": sel = { kind: "slot", key: b.dataset.id }; render(); drawBoxes(); return;
      case "selobj": sel = { kind: "obj", key: b.dataset.id }; render(); drawBoxes(); return;
      case "addslot": { touch(true); const sl = { id: nid(), name: t("Placeholder", "Emplacement") + " " + (D.slots.length + 1), x: 560, y: 320, w: 140, h: 140, layer: "back" }; D.slots.push(sl); sel = { kind: "slot", key: sl.id }; apply(); render(); return; }
      case "delprop": removeProp(sel.key); return;
      case "dup": { const pr = itemOf(sel.kind, sel.key); if (!pr) return; touch(true); const c = Object.assign({}, pr, { id: nid(), x: pr.x + 24, y: pr.y + 24 }); (sel.kind === "slot" ? D.slots : D.props).push(c); sel = { kind: sel.kind, key: c.id }; apply(); render(); return; }
      case "up": case "down": { const pr = D.props.find((x) => x.id === sel.key); if (!pr) return; touch(true); pr.z = (pr.z || 0) + (a === "up" ? 1 : -1); apply(); render(); return; }
      case "ambnomusic": touch(true); D.ambience = Object.assign({}, D.ambience, { music: null }); apply(); render(); return;
      case "ambreset": touch(true); D.ambience = null; apply(); render(); return;
      case "ambplay": if (root.WA_AMB) { root.WA_AMB.unlock(); if (root.WA_AMB.muted) status(t("The sound is off: turn it on to hear the music.", "Le son est coupé : activez-le pour entendre la musique."), "err"); } return;
      case "tryprop": tryProp(D.props.find((x) => x.id === sel.key)); return;
    }
  }
  function tryProp(pr) { if (!pr) return; const w = document.querySelector(`.prop[data-id="${pr.id}"]`); if (w) U().reactProp(pr, w); }
  function removeProp(id) { touch(true); D.props = D.props.filter((p) => p.id !== id); D.slots = D.slots.filter((p) => p.id !== id); D.objects = D.objects.filter((p) => p.id !== id); sel = null; apply(); render(); }
  async function addFiles(files, asObject) {
    const list = [...(files || [])].filter((f) => /^image\//.test(f.type)); if (!list.length) return;
    touch(true);
    for (const [i, f] of list.entries()) {
      if (f.size > 6e6) { status(t("That picture is too big (6 MB max).", "Image trop lourde (6 Mo max)."), "err"); continue; }
      const blob = f.slice(0, f.size, f.type);
      const dim = await new Promise((res) => { const im = new Image(); im.onload = () => res([im.naturalWidth, im.naturalHeight]); im.onerror = () => res([200, 200]); im.src = URL.createObjectURL(blob); });
      const k = Math.min(1, 180 / Math.max(dim[0], dim[1])), w = Math.max(16, Math.round(dim[0] * k)), h = Math.max(16, Math.round(dim[1] * k));
      const pr = { id: nid(), name: f.name.replace(/\.[^.]+$/, "").slice(0, 30), img: blob, x: 600 - w / 2 + i * 30, y: 360 - h / 2 + i * 30, w, h, rot: 0, layer: "back", idle: "none", react: "bounce", fx: "sparkle", sound: "pop", power: 1, speed: 1 };
      if (asObject) { const o = { id: nid(), name: pr.name, img: blob, idle: "float", react: "bounce", fx: "sparkle", sound: "pop", power: 1, speed: 1 }; D.objects.push(o); sel = { kind: "obj", key: o.id }; }
      else { D.props.push(pr); sel = { kind: "prop", key: pr.id }; }
    }
    apply(); render();
    status(t("Sprite added: drag it into place.", "Sprite ajouté : glissez-le à sa place."), "ok");
  }

  root.WA_TABLE = { open, close, testing: false, get data() { return D; } };
})(typeof window !== "undefined" ? window : globalThis);
