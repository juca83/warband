// ===================================================================
// Warband Arena - card editor. Create minions and tavern spells or change
// the built-in ones: full-resolution image, stats, keywords and effects
// built from menus that the game engine really runs.
// ===================================================================
(function (root) {
  "use strict";
  const W = root.WA, ST = root.WA_STORE, ART = root.WA_ART;
  const { TRIGGERS, ACTIONS, KW_TEXT } = W;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const TN = (t) => W.tribeName(t);
  const regOpts = () => ST.regOpts();
  const tribeOpts = () => [["", "Neutral"], ...W.TRIBES.map((t) => [t, TN(t)])];
  const SOURCE_TRIGGERS = new Set(["onSummonT", "onBuyFrozen", "onFreezeFoe", "onBuy", "onPlayOther", "onSummonAlly", "onShieldLost", "onTriple", "onRebornAlly", "onPlayBattlecry", "onFriendlyAttack", "onDevoured", "onDiscover", "onEnemySummon", "afterDevour", "onAttacked", "afterReflux", "afterFoundation"]);
  // triggers whose minion is already dead: only a copy of it makes sense
  const DEAD_SOURCE = new Set(["onAllyDeath", "onEnemyDeath", "onDeathrattleFriend", "onKill", "onOverkill", "onMiredDeath"]);

  let el = null, helpers = null, onDone = null;
  // list view preferences, kept per browser
  let kindTab = "all", tierF = 0, closedGroups = new Set();
  try { const pr = JSON.parse(localStorage.getItem("wa-editor-prefs") || "{}"); kindTab = pr.kindTab || "all"; closedGroups = new Set(pr.closed || []); } catch (e) {}
  const savePrefs = () => { try { localStorage.setItem("wa-editor-prefs", JSON.stringify({ kindTab, closed: [...closedGroups] })); } catch (e) {} };
  let work = [], cur = null, curKey = "", dirty = false, query = "", golden = false;
  // undo history of the card being edited (Ctrl+Z / Ctrl+Y); pictures are not part of it
  let hist = [], redo = [], lastSnap = "";
  const snap = () => JSON.stringify(cur);
  function histReset() { hist = []; redo = []; lastSnap = cur ? snap() : ""; }
  function histPush() { const now = snap(); if (now === lastSnap) return; hist.push(lastSnap); if (hist.length > 60) hist.shift(); redo = []; lastSnap = now; }
  function undoRedo(back) {
    const from = back ? hist : redo, to = back ? redo : hist;
    if (!from.length || !cur) return;
    to.push(snap()); cur = JSON.parse(from.pop()); lastSnap = snap();
    dirty = true; pending = null; rerenderKeep();
    status(back ? `Undid the last change${hist.length ? ` (${hist.length} more)` : ""}.` : "Redid the change.", "warn");
  }
  let img = null; // draft image: { src, crop, tok, card, changed, removed }

  // ---------------------------------------------------------------- data helpers
  const isSpell = (r) => r && r.kind === "spell";
  const kindOf = (r) => r.kind || "minion";
  const isHero = (r) => r && r.kind === "hero";
  const isAnom = (r) => r && r.kind === "anomaly";
  const isKw = (r) => r && r.kind === "keyword";
  // custom keywords of the meta
  const kwList = () => JSON.parse(JSON.stringify(ST.keywords || []));
  const flatKw = (k) => ({ id: k.id, kind: "keyword", name: k.name, color: k.color || "#c9a24a", icon: k.icon || "", tip: k.tip || "", abilities: JSON.parse(JSON.stringify(k.abilities || [])) });
  const packKw = (r) => ({ id: r.id, name: (r.name || "").trim().slice(0, 20), color: r.color || "#c9a24a", icon: r.icon || "", tip: (r.tip || "").slice(0, 200), abilities: JSON.parse(JSON.stringify(r.abilities || [])) });
  const kwsWith = (r) => { const l = kwList().filter((k) => k.id !== r.id); l.push(packKw(r)); return l; };
  // affinities of the meta, edited like cards: the stored settings (cfg) flattened into a record, and back
  const isAff = (r) => r && r.kind === "affinity";
  const carryRec = (r) => ({ kind: "minion", id: r.id, name: r.name, abilities: r.abilities, carryOf: r.id });
  const recOf = (ab) => (isAff(cur) && ab && ab.carry ? carryRec(cur) : cur);
  const affCfgNow = () => JSON.parse(JSON.stringify(ST.affinities || {}));
  function flatAff(id) {
    const A = W.AFF[id], c = (ST.affinities || {})[id] || {}, B = W.AFF_BASE[id] || {};
    const d = A || Object.assign({ id, kind: "bonus", color: "#c9a24a", t1: 3, t2: 5, v1: 1, v2: 2, t3: 0, v3: 2, mech: "Bonus", name: id, effects: [] }, B, c);
    return { id, kind: "affinity", builtIn: !!W.AFF_BASE[id], hidden: !!c.deleted, name: c.name || W.affName(id) || d.name, mech: c.mech || W.affMech(id) || d.mech, tpl: d.kind, color: (d.color || "#c9a24a").slice(0, 7), color2: c.color2 || "", shape: c.shape || "round", glyph: c.glyph || "", art: c.art || "", fx: c.fx || "", icon: c.icon || "",
      t1: d.t1, t2: d.t2, t3: d.t3 || 0, v1: d.v1, v2: d.v2, v3: d.v3 != null ? d.v3 : d.v2, kw: d.kw || "shield", desc: c.desc || "", descOnly: !!c.descOnly, stat: c.stat || d.stat || "both", abilities: JSON.parse(JSON.stringify(c.effects || d.effects || [])).concat(JSON.parse(JSON.stringify(c.carry || d.carry || [])).map((ab) => Object.assign(ab, { carry: true }))) };
  }
  function packAff(r) {
    const o = { name: (r.name || "").trim().slice(0, 18), mech: (r.mech || "").trim().slice(0, 18), kind: r.tpl, color: r.color, color2: r.color2 || "", shape: r.shape, glyph: r.glyph || "", art: r.art || "", fx: r.fx || "", t1: r.t1, t2: r.t2, t3: r.t3 || 0, v1: r.v1, v2: r.v2, v3: r.v3, kw: r.kw, stat: r.stat || "both", desc: (r.desc || "").slice(0, 240), descOnly: !!r.descOnly, effects: JSON.parse(JSON.stringify((r.abilities || []).filter((ab) => !ab.carry))), carry: JSON.parse(JSON.stringify((r.abilities || []).filter((ab) => ab.carry))).map((ab) => { delete ab.carry; return ab; }) };
    if (r.icon) o.icon = r.icon;
    if (!r.builtIn) o.custom = true;
    return o;
  }
  function affCfgWith(r) {
    const cfg = affCfgNow(), was = cfg[r.id] || {};
    cfg[r.id] = Object.assign(packAff(r), was.deleted ? { deleted: true } : {});
    const order = Array.isArray(cfg.order) && cfg.order.some((k) => W.AFF_BASE[k]) ? cfg.order.slice() : W.AFFS.slice();
    if (!order.includes(r.id)) order.push(r.id);
    cfg.order = order;
    return cfg;
  }
  // every affinity of the meta, hidden built-ins last
  const affIds = () => W.AFFS.concat(W.AFF_BUILTIN.filter((k) => !W.AFFS.includes(k)));
  const powerLike = (r) => isHero(r) || isAnom(r) || isAff(r); // heroes, anomalies and affinities: no "this minion", can use game rules
  const spellLike = (r) => isSpell(r) || (isHero(r) && r.powerType !== "passive"); // effects that fire once, when cast or used
  const heroPassive = (r) => (isHero(r) && r.powerType === "passive") || isAnom(r) || isAff(r);
  const imgKey = (r) => (isSpell(r) ? "spell:" + r.id : isHero(r) ? "hero:" + r.id : isAnom(r) ? "anomaly:" + r.id : r.id);
  // names shown in the language of the game (the engine localizes the built-in ones)
  const anomList = () => JSON.parse(JSON.stringify(ST.anomalies || W.DEFAULT_ANOMALIES)).map((a) => { const L = W.ANOMALIES[a.id], D = W.DEFAULT_ANOMALIES.find((x) => x.id === a.id); if (L && D && a.name === D.name) a.name = L.name; return a; });
  const flatAnom = (a) => ({ id: a.id, kind: "anomaly", name: a.name, abilities: JSON.parse(JSON.stringify(a.abilities || [])), customText: a.text || "", banHeroes: (a.banHeroes || []).slice() });
  const packAnom = (r) => ({ id: r.id, name: r.name, abilities: r.abilities, text: r.customText || "", banHeroes: (r.banHeroes || []).slice() });
  const anomsWith = (r) => { const l = anomList().filter((a) => a.id !== r.id); l.push(packAnom(r)); return l; };
  // heroes are stored as { id, name, health, power: { name, type, cost, abilities, text } }; edited flat
  const heroList = () => JSON.parse(JSON.stringify(ST.heroes || W.DEFAULT_HEROES)).map((h) => { const L = W.HEROES[h.id], D = W.DEFAULT_HEROES.find((x) => x.id === h.id); if (L && D) { if (h.name === D.name) h.name = L.name; if (h.power && D.power && h.power.name === D.power.name) h.power.name = L.power.name; } return h; });
  const flatHero = (h) => ({ id: h.id, kind: "hero", name: h.name, health: h.health || 30, powerName: (h.power || {}).name || "Hero power", powerType: (h.power || {}).type === "passive" ? "passive" : "active",
    powerCost: (h.power || {}).cost | 0, abilities: JSON.parse(JSON.stringify((h.power || {}).abilities || [])), customText: (h.power || {}).text || "" });
  const packHero = (r) => ({ id: r.id, name: r.name, health: r.health, power: { name: r.powerName, type: r.powerType, cost: r.powerType === "active" ? r.powerCost : 0, abilities: r.abilities, text: r.customText || "" } });
  const heroesWith = (r) => { const l = heroList().filter((h) => h.id !== r.id); l.push(packHero(r)); return l; };
  // a built-in spell with a fixed effect (not made of abilities): only its picture can change
  const fixedSpell = (r) => !!(r && isSpell(r) && r.builtIn && W.SPELLS[r.id] && !W.SPELLS[r.id].abilities);
  const builtInMinion = (id) => W.ORIGINAL[id] || (W.CARDS[id] && !W.CARDS[id].custom ? W.CARDS[id] : null) || W.TOKENS[id] || null;
  const isTokenRec = (r) => r && kindOf(r) === "minion" && r.inPool === false && !(W.CARDS[r.id] && (W.CARDS[r.id].affOnly || W.CARDS[r.id].retired));
  function recordFor(key) {
    const [kind, id] = key.split("|");
    const have = work.find((r) => r.id === id && kindOf(r) === kind);
    if (have) return clone(have);
    if (kind === "hero") { const h = heroList().find((x) => x.id === id); return flatHero(h || { id, name: "Hero" }); }
    if (kind === "anomaly") { const a = anomList().find((x) => x.id === id); return flatAnom(a || { id, name: "Anomaly" }); }
    if (kind === "keyword") { const k = kwList().find((x) => x.id === id); return flatKw(k || { id, name: "Keyword" }); }
    if (kind === "affinity") return flatAff(id);
    if (kind === "spell") { const s = W.SPELLS[id]; return { id, kind: "spell", name: s.name, tier: s.tier, cost: s.cost, target: s.target, abilities: clone(s.abilities || []), customText: s.customText || "", builtIn: true }; }
    const d = builtInMinion(id);
    return { id, kind: "minion", name: d.name, tribe: d.tribe, tier: d.tier, attack: d.attack, health: d.health,
      taunt: !!d.taunt, shield: !!d.shield, reborn: !!d.reborn, windfury: !!d.windfury, venomous: !!d.venomous, cleave: !!d.cleave, stealth: !!d.stealth, magnetic: !!d.magnetic, rally: !!d.rally, tough: !!d.tough,
      tribes: d.tribes ? d.tribes.slice() : d.tribe ? [d.tribe] : [], allTribes: !!d.allTribes, aff: (d.aff || []).slice(),
      abilities: clone(d.abilities || []), noBuiltIn: false, customText: d.customText || "", inPool: d.inPool !== false && !d.token, builtIn: true, attackFx: d.attackFx || "", rarity: d.rarity || "common",
      flying: !!d.flying, mk: d.mk ? clone(d.mk) : null, gold: d.gold ? clone(d.gold) : null };
  }
  const newId = (p) => p + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  const defaultAbility = (r) => (isAff(r) ? { trigger: "endOfTurn", action: "buff", target: "allFriends", taff: r.id, a: 1, h: 1, alv: 1 } : isAnom(r) ? { trigger: "gameStart", action: "ruleShop", n: 1 } : spellLike(r) ? { trigger: "cast", action: "buff", target: "chosen", a: 2, h: 2 } : heroPassive(r) ? { trigger: "endOfTurn", action: "buff", target: "randomFriend", a: 1, h: 1, count: 1 } : { trigger: "battlecry", action: "buff", target: "randomFriend", a: 1, h: 1, count: 1 });
  const builtInText = (id) => { const d = builtInMinion(id); return d ? (d.text || "").replace(/\{n\}/g, String(d.n || 0)) : ""; };
  const autoText = () => (cur.abilities || []).map((ab) => W.abilityText(ab, false)).join(" ");

  // Apply the saved set plus the card being edited to the engine, so previews and tests use it.
  function applyDraft() {
    const list = work.filter((r) => !(cur && r.id === cur.id && kindOf(r) === kindOf(cur)));
    if (cur && !powerLike(cur) && !isKw(cur) && !isAff(cur) && !fixedSpell(cur)) list.push(plainRec(cur));
    const o = regOpts();
    if (isKw(cur)) o.keywords = kwsWith(cur);
    if (isAff(cur)) { o.affinities = affCfgWith(cur); list.push({ id: "__affprev", name: (cur.name || "?") + " adept", tier: 3, tribe: "", attack: 3, health: 4, aff: [cur.id], abilities: [], inPool: false }); }
    if (isHero(cur)) o.heroes = heroesWith(cur);
    if (isAnom(cur)) o.anomalies = anomsWith(cur);
    W.registerCustom(list, o);
  }

  // ---------------------------------------------------------------- open / close
  function open(cb, h) {
    onDone = cb; helpers = h || {};
    work = clone(ST.cards || []);
    setTimeout(() => setCoop(coopName), 0);
    el = document.createElement("div");
    el.id = "cardEditor";
    el.innerHTML = `
      <div class="ce-head"><div class="ce-brand"><span class="ce-eyebrow">◆ Workshop ◆</span><h2>Creation studio</h2></div>
        <div class="ce-note"><span class="ce-note-short">Each meta is its own card set; the one picked on the main menu is the one you play.</span><button type="button" class="ce-info" id="ceInfo" title="Each meta is its own card set. Classic holds the built-in cards and your changes; a blank meta starts empty. The meta you pick in the main menu is the one you play. Everything is saved in this browser." aria-label="More about metas">?</button></div>
        <button class="pill" id="ceClose">Close</button></div>
      <nav class="ce-metas" id="ceMetas" aria-label="Metas"></nav>
      <div class="ce-body">
        <nav class="ce-rail" id="ceRail" aria-label="Workshop sections"></nav>
        <aside class="ce-list"><div class="ce-new"><button class="pill" id="ceNewMinion">+ New minion</button><button class="pill" id="ceNewToken">+ New token</button><button class="pill" id="ceNewSpell">+ New spell</button><button class="pill" id="ceNewHero">+ New hero</button><button class="pill" id="ceNewAnom">+ New anomaly</button><button class="pill" id="ceNewKw">+ New keyword</button><button class="pill" id="ceNewAff">+ New affinity</button><button class="pill forge" id="ceForge" title="Deal three random drafts and pick one">✦ Forge</button></div>
          <div class="ce-kinds" id="ceKinds" role="tablist"></div>
          <input id="ceSearch" placeholder="Search names, tribes or effects" autocomplete="off"><div class="ce-tierf" id="ceTierF"></div><div id="ceItems"></div>
          <div class="ce-io"><button class="pill" id="ceFriendPack" title="Saves ma-meta.js: put it next to index.html in the game folder you send. Your friend's game installs this meta by itself.">For a friend</button><button class="pill" id="ceExport">Export</button><button class="pill" id="ceImport">Import</button><label class="pill" id="ceImportFile">File<input type="file" accept=".json,application/json" hidden></label></div>
          <textarea id="ceIO" hidden spellcheck="false"></textarea></aside>
        <section class="ce-form" id="ceForm"></section>
        <aside class="ce-side">
          <div class="ce-preview"><div id="cePvCard"></div><div id="cePvTok"></div></div>
          <label class="ce-check"><input type="checkbox" id="ceGolden"> Show the golden version</label>
          <div class="ce-text" id="ceText"></div>
          <div class="ce-meter" id="ceMeter"></div>
          <div class="ce-actions"><button class="pill big" id="ceSave">Save card</button>
            <div class="ce-row ce-main2"><button class="pill" id="ceTest">Test it</button><button class="pill fight" id="ceFight" title="Play a real fight on the table with this card in your warband">⚔ Fight!</button></div>
            <div class="ce-row ce-minor"><button class="pill small" id="ceDup">Duplicate</button><button class="pill small" id="ceShare" title="Copy this card as text you can paste into another browser's Import">Share</button><button class="pill danger" id="ceDelete">Delete</button></div>
            <div class="ce-row ce-undo"><button class="pill" id="ceUndo" title="Ctrl+Z">↶ Undo</button><button class="pill" id="ceRedo" title="Ctrl+Y">↷ Redo</button></div></div>
          <div class="ce-status" id="ceStatus"></div>
          <div class="ce-test" id="ceTestOut"></div>
        </aside>
      </div>`;
    $("#stage").appendChild(el); $("#stage").classList.add("ce-open");
    { const head = $(".ce-head", el), mt = $("#ceMetas", el); head.insertBefore(mt, $(".ce-note", el)); }
    $("#ceClose", el).addEventListener("click", close);
    $("#ceNewMinion", el).addEventListener("click", () => guard("newMinion", () => startNew("minion")));
    $("#ceNewToken", el).addEventListener("click", () => guard("newMinion", () => { startNew("minion"); if (!cur) return; Object.assign(cur, { inPool: false, name: "New token", tier: 1, attack: 1, health: 1, abilities: [] }); renderList(); renderForm(); preview(); status("New token: never offered in the tavern. Name it, then make it appear with a Summon effect on another card.", "warn"); }));
    $("#ceNewSpell", el).addEventListener("click", () => guard("newSpell", () => startNew("spell")));
    $("#ceNewHero", el).addEventListener("click", () => guard("newHero", () => startNew("hero")));
    $("#ceNewAnom", el).addEventListener("click", () => guard("newAnom", () => startNew("anomaly")));
    $("#ceNewKw", el).addEventListener("click", () => guard("newKw", () => startNew("keyword")));
    $("#ceNewAff", el).addEventListener("click", () => guard("newAff", () => startNew("affinity")));
    let searchT = 0;
    $("#ceSearch", el).addEventListener("input", (e) => { query = e.target.value.toLowerCase(); clearTimeout(searchT); searchT = setTimeout(renderList, 120); });
    $("#ceKinds", el).addEventListener("click", (e) => { const b = e.target.closest("[data-kind]"); if (!b) return; kindTab = b.dataset.kind; if (kindTab !== "minion") tierF = 0; savePrefs(); renderList(); $("#ceItems", el).scrollTop = 0; });
    $("#ceTierF", el).addEventListener("click", (e) => { const b = e.target.closest("[data-tier]"); if (!b) return; tierF = tierF === +b.dataset.tier ? 0 : +b.dataset.tier; renderList(); });
    $("#ceItems", el).addEventListener("click", (e) => { const g = e.target.closest("[data-group]"); if (!g) return; const k = g.dataset.group; if (closedGroups.has(k)) closedGroups.delete(k); else closedGroups.add(k); savePrefs(); renderList(); });
    $("#ceItems", el).addEventListener("click", (e) => { const b = e.target.closest("[data-key]"); if (b) guard("sel" + b.dataset.key, () => select(b.dataset.key)); });
    $("#ceGolden", el).addEventListener("change", (e) => { golden = e.target.checked; preview(); });
    $("#ceSave", el).addEventListener("click", save);
    $("#ceDelete", el).addEventListener("click", remove);
    $("#ceTest", el).addEventListener("click", runTest);
    $("#ceDup", el).addEventListener("click", () => guard("dup", duplicate));
    $("#ceShare", el).addEventListener("click", shareCard);
    $("#ceFight", el).addEventListener("click", watchFight);
    $("#ceForge", el).addEventListener("click", () => guard("forge", openForge));
    $("#ceUndo", el).addEventListener("click", () => undoRedo(true));
    $("#ceRedo", el).addEventListener("click", () => undoRedo(false));
    $("#ceExport", el).addEventListener("click", exportAll);
    $("#ceFriendPack", el).addEventListener("click", friendPack);
    $("#ceImport", el).addEventListener("click", importText);
    $("#ceImportFile input", el).addEventListener("change", importFile);
    const form = $("#ceForm", el);
    form.addEventListener("input", onField);
    form.addEventListener("change", onField);
    form.addEventListener("click", onFormClick);
    bindCombos(el);
    for (const t of [form, el]) {
      t.addEventListener("dragover", (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); form.classList.add("drop"); } });
    }
    el.addEventListener("dragleave", (e) => { if (!el.contains(e.relatedTarget)) form.classList.remove("drop"); });
    el.addEventListener("drop", (e) => { e.preventDefault(); form.classList.remove("drop"); const f = e.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) useFile(f); });
    $("#ceMetas", el).addEventListener("click", onMetaClick);
    $("#ceRail", el).addEventListener("click", onRailClick);
    document.addEventListener("keydown", onKey, true);
    renderMetas();
    renderList();
    startNew("minion", true);
  }
  function onKey(e) {
    if (!el) return;
    if (e.key.startsWith("Arrow") && document.activeElement && document.activeElement.classList.contains("ce-ws-stage")) return; // the workshop nudges its layers
    e.stopPropagation();
    if (e.key === "Escape") close();
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(), typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName) && document.activeElement.type !== "checkbox" && document.activeElement.type !== "radio" && document.activeElement.type !== "range";
    if (mod && k === "s") { e.preventDefault(); save(); }
    else if (mod && !typing && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); undoRedo(false); }
    else if (mod && !typing && k === "z") { e.preventDefault(); undoRedo(true); }
  }
  let pending = null;
  function guard(tag, fn) {
    if (!dirty || pending === tag) { pending = null; return fn(); }
    pending = tag;
    status("You have unsaved changes. Click again to discard them, or Save card first.", "warn");
  }
  async function close() {
    if (dirty && pending !== "close") { pending = "close"; status("You have unsaved changes. Click Close again to discard them.", "warn"); return; }
    document.removeEventListener("keydown", onKey, true);
    await ST.load(); // back to what is saved: engine cards and images
    el.remove(); el = null; $("#stage").classList.remove("ce-open");
    if (onDone) onDone();
  }

  // ---------------------------------------------------------------- metas
  let metaForm = null; // null | "new" | "rename"
  function renderMetas() {
    if (el) { el.classList.toggle("skins-view", view === "skins"); el.classList.toggle("studio-view", view === "studio"); el.classList.toggle("tribes-view", view === "tribes");
      if (view !== "studio") { const f = $("#ceForm", el); if (f && f.classList.contains("st-host")) { f.onclick = f.oninput = f.onchange = null; f.classList.remove("st-host"); } } }
    const nav = $("#ceMetas", el);
    const tabs = ST.metas.map((m) => {
      const on = m.id === ST.active;
      if (on && metaForm === "rename") return `<span class="ce-newmeta"><input type="text" id="ceMetaName" value="${esc(m.name)}" maxlength="24"><button class="pill" data-meta-act="renameOk">Rename</button><button class="pill" data-meta-act="cancel">Cancel</button></span>`;
      return `<button class="ce-tab${on ? " on" : ""}" data-meta="${m.id}">${esc(m.name)} <small>${m.blank ? "blank" : "classic cards"}</small></button>` +
        (on ? `<button class="ce-tab-act" data-meta-act="rename" title="Rename this meta">✎</button>${m.id !== "classic" ? `<button class="ce-tab-act" data-meta-act="delete" title="Delete this meta">✕</button>` : ""}` : "");
    }).join("");
    const form = metaForm === "new"
      ? `<span class="ce-newmeta"><input type="text" id="ceMetaName" placeholder="Meta name" maxlength="24"><select id="ceMetaMode"><option value="blank">No cards, the 8 standard tribes</option><option value="empty">No cards, no tribes</option><option value="copy">Copy of ${esc(ST.meta.name)}</option></select>
         <button class="pill" data-meta-act="create">Create</button><button class="pill" data-meta-act="cancel">Cancel</button></span>`
      : `<button class="pill" data-meta-act="new">+ New meta</button>`;
    nav.innerHTML = tabs + form;
    renderRail();
    const inp = $("#ceMetaName", el); if (inp) { inp.focus(); inp.select(); inp.addEventListener("keydown", (e) => { if (e.key === "Enter") nav.querySelector("[data-meta-act=create],[data-meta-act=renameOk]").click(); }); }
  }
  async function switchMeta(fn) {
    await fn();
    view = "card"; tdraft = null;
    work = clone(ST.cards); query = ""; $("#ceSearch", el).value = "";
    metaForm = null; dirty = false; pending = null;
    renderMetas(); renderList(); startNew("minion", true);
  }
  function onMetaClick(e) {
    const tab = e.target.closest("[data-meta]"), act = e.target.closest("[data-meta-act]");
    if (tab && tab.dataset.meta !== ST.active) { guard("meta" + tab.dataset.meta, () => switchMeta(() => ST.setActive(tab.dataset.meta)).then(() => status(`Now editing ${ST.meta.name}.`))); return; }
    if (!act) return;
    const a = act.dataset.metaAct;
    if (a === "skins" || a === "table" || a === "bartender") { guard("skins", () => { view = view === "skins" ? "card" : "skins"; dirty = false; crop = null; if (a === "bartender") skinKind = "bartender"; if (a === "table") skinKind = "table"; renderMetas(); if (view === "skins") renderSkins(); else startNew("minion", true); }); return; }
    if (a === "tribes") { guard("tribes", () => { view = view === "tribes" ? "card" : "tribes"; dirty = false; renderMetas(); if (view === "tribes") { tdraft = null; renderTribes(); } else startNew("minion", true); }); return; }
    if (a === "forge") { guard("forge", openForge); return; }
    if (a === "new") { metaForm = "new"; renderMetas(); }
    else if (a === "rename") { metaForm = "rename"; renderMetas(); }
    else if (a === "cancel") { metaForm = null; renderMetas(); }
    else if (a === "create") {
      const name = ($("#ceMetaName", el).value || "").trim() || "New meta", mode = $("#ceMetaMode", el).value;
      guard("create", () => switchMeta(() => ST.createMeta(name, mode)).then(() => status(mode !== "copy" ? `${name} is empty. Add minions with + New minion: a game needs at least 3, one of them at tier 1.` : `${name} starts as a copy. Changes here don't touch the original.`, "warn")));
    } else if (a === "renameOk") {
      const name = ($("#ceMetaName", el).value || "").trim();
      ST.renameMeta(ST.active, name).then(() => { metaForm = null; renderMetas(); });
    } else if (a === "delete") {
      if (pending !== "delmeta") { pending = "delmeta"; status(`Click ✕ again to delete the meta "${ST.meta.name}" and all its cards and pictures.`, "warn"); return; }
      const name = ST.meta.name;
      switchMeta(() => ST.deleteMeta(ST.active)).then(() => status(`Deleted ${name}.`));
    }
  }


  // ---------------------------------------------------------------- the rail: every part of the meta, content first, then its look
  let studioSec = "";
  const RAIL = () => [
    ["Content", [["cards", "🃏", "Cards", { kind: "all" }], ["heroes", "👑", "Heroes", { kind: "hero" }], ["anomalies", "🌀", "Anomalies", { kind: "anomaly" }], ["keywords", "🏷", "Keywords", { kind: "keyword" }], ["tribes", "🛡", "Tribes", { act: "tribes" }], ...(W.affOn() ? [["affinities", "💠", "Affinities", { kind: "affinity" }]] : [])]],
    ["Look", [["fx", "✨", "Visual effects", { sec: "fx" }], ["theme", "🎨", "Interface theme", { sec: "theme" }], ["markers", "◆", "Markers layout", { sec: "markers" }], ["frames", "🖼", "Frames and card backs", { act: "skins", skin: "card" }], ["table", "🪵", "Table", { act: "skins", skin: "table" }], ["tavern", "🍺", "Bartender and texts", { sec: "texts" }], ["sounds", "🔊", "Sounds and music", { sec: "sounds" }], ["screens", "🏰", "Menus and screens", { sec: "screens" }]]],
    ["Meta", [["rules", "⚙", "Rules", { sec: "rules" }]]],
  ];
  function railCurrent() {
    if (view === "studio") return { fx: "fx", theme: "theme", texts: "tavern", sounds: "sounds", screens: "screens", rules: "rules", markers: "markers" }[studioSec] || "";
    if (view === "tribes") return "tribes";
    if (view === "skins") return skinKind === "table" ? "table" : skinKind === "bartender" ? "tavern" : "frames";
    return { hero: "heroes", anomaly: "anomalies", keyword: "keywords", affinity: "affinities" }[kindTab] || "cards";
  }
  function renderRail() {
    const r = $("#ceRail", el); if (!r) return;
    const on = railCurrent();
    r.innerHTML = RAIL().map(([g, items]) => `<div class="ce-railg"><small>${g}</small>${items.map(([id, ic, label, o]) => `<button type="button" class="ce-railbtn${on === id ? " on" : ""}" data-rail="${id}"${o.kind ? ` data-kind="${o.kind}"` : ""}${o.act ? ` data-meta-act="${o.act}"` : ""}${o.skin ? ` data-rail-skin="${o.skin}"` : ""}${o.sec ? ` data-studio="${o.sec}"` : ""}><i>${ic}</i><span>${label}</span></button>`).join("")}</div>`).join("");
    if (el) el.dataset.sec = on;
  }
  function onRailClick(e) {
    const b = e.target.closest("[data-rail]"); if (!b) return;
    if (b.dataset.kind) {
      const k = b.dataset.kind;
      guard("rail" + k, () => {
        const was = view; view = "card"; crop = null; kindTab = k; tierF = 0; savePrefs(); renderMetas();
        const curSec = cur ? ({ minion: "all", spell: "all" }[kindOf(cur)] || kindOf(cur)) : "";
        if (was !== "card" || curSec !== k) emptyForm(k);
        renderList(); $("#ceItems", el).scrollTop = 0;
      });
      return;
    }
    status("");
    if (b.dataset.studio) { guard("studio" + b.dataset.studio, () => openStudio(b.dataset.studio)); return; }
    if (b.dataset.metaAct === "skins") {
      const k = b.dataset.railSkin || "card";
      guard("skins" + k, () => { view = "skins"; dirty = false; crop = null; skinKind = k; skinSel = null; renderMetas(); renderSkins(); });
      return;
    }
    if (b.dataset.metaAct === "tribes") { guard("tribes", () => { view = "tribes"; dirty = false; renderMetas(); tdraft = null; renderTribes(); }); return; }
  }
  // a section with nothing open yet: what to do there
  function emptyForm(k) {
    cur = null; curKey = ""; img = null; dirty = false; quickOpen = false;
    const what = { all: ["card", "+ New minion or + New spell"], hero: ["hero", "+ New hero"], anomaly: ["anomaly", "+ New anomaly"], keyword: ["keyword", "+ New keyword"], affinity: ["affinity", "+ New affinity"] }[k] || ["card", "+ New"];
    $("#ceForm", el).innerHTML = `<div class="ce-sec ce-emptysec"><h3>${{ all: "Cards", hero: "Heroes", anomaly: "Anomalies", keyword: "Keywords", affinity: "Affinities" }[k] || "Cards"}</h3><p class="ce-hint">Pick one on the left to change it, or create one with ${what[1]}.</p></div>`;
    $("#cePvCard", el).innerHTML = ""; $("#cePvTok", el).innerHTML = ""; $("#ceText", el).innerHTML = ""; $("#ceMeter", el).hidden = true; $("#ceTestOut", el).innerHTML = "";
    status(""); el.classList.add("no-cur");
  }
  // the look of the meta: panels drawn by studio.js
  function openStudio(sec) {
    view = "studio"; studioSec = sec; cur = null; curKey = ""; dirty = false; crop = null;
    renderMetas(); renderList();
    const host = $("#ceForm", el);
    $("#cePvCard", el).innerHTML = ""; $("#cePvTok", el).innerHTML = ""; $("#ceText", el).innerHTML = "";
    if (root.WA_STUDIO) root.WA_STUDIO.render(sec, host, studioApi());
    else host.innerHTML = `<div class="ce-sec"><p class="ce-hint">The studio is not loaded.</p></div>`;
    host.scrollTop = 0;
  }
  const studioApi = () => ({ W, ST, esc, status, helpers, root, el, applySkins: () => applySkins(), reopen: () => openStudio(studioSec), goSkins: (k) => { view = "skins"; skinKind = k; skinSel = null; renderMetas(); renderSkins(); }, openTable: () => { if (root.WA_EDITOR && root.WA_EDITOR.openTable) root.WA_EDITOR.openTable(); } });

  // ---------------------------------------------------------------- list
  function thumb(r) {
    if (isAff(r)) return `<img class="photo aff-thumb${r.hidden ? " off" : ""}" src="${esc(W.AFF[r.id] ? W.affIcon(r.id) : W.affIconSVG({ color: r.color, color2: r.color2, shape: r.shape, glyph: r.glyph, name: r.name }, r.id))}" alt="">`;
    if (isKw(r)) return `<span class="hero-thumb kw-thumb" style="--kc:${esc(r.color || "#c9a24a")}${r.icon ? `;background-image:url('${esc(r.icon)}')` : ""}">${r.icon ? "" : esc((r.name || "?")[0])}</span>`;
    const ph = ST.IMAGES[imgKey(r)];
    if (ph && !powerLike(r)) return `<img class="photo" src="${ph.card}" alt="">`;
    if (isAnom(r)) { const pic = ST.IMAGES[imgKey(r)]; return `<span class="hero-thumb anom-thumb"${pic ? ` style="background-image:url('${pic.card}')"` : ""}>${pic ? "" : "✦"}</span>`; }
    if (isHero(r)) { const pic = ST.IMAGES[imgKey(r)]; return `<span class="hero-thumb"${pic ? ` style="background-image:url('${pic.card}')"` : ""}>${pic ? "" : esc((r.name || "?")[0])}</span>`; }
    return isSpell(r) ? ART.spellArt(r.id) : ART.art(r.id);
  }
  function renderList() {
    const q = query;
    const textOf = (r) => { try {
      if (isAnom(r)) return (r.customText || "") + " " + (r.abilities || []).map((ab) => W.abilityText(ab, false)).join(" ");
      if (isHero(r)) return r.powerName + " " + (r.customText || "") + " " + (r.abilities || []).map((ab) => W.abilityText(ab, false)).join(" ");
      if (isSpell(r)) return W.SPELLS[r.id] ? new W.Spell(r.id).text : "";
      return W.CARDS[r.id] ? W.cardText(r.id) : (r.abilities || []).map((ab) => W.abilityText(ab, false)).join(" ");
    } catch (e) { return ""; } };
    const match = (r) => !q || (r.name || "").toLowerCase().includes(q) || TN(r.tribe || "").toLowerCase().includes(q) || textOf(r).toLowerCase().includes(q);
    const item = (r, tag) => `<button class="ce-item${curKey === kindOf(r) + "|" + r.id ? " on" + (dirty ? " dirty" : "") : ""}" data-key="${kindOf(r)}|${r.id}">
      ${thumb(r)}<span>${esc(r.name)}<i>${isAff(r) ? `${esc(r.mech)} · ${r.hidden ? "hidden" : r.t3 ? "3 levels" : "2 levels"}${(r.abilities || []).length ? " · " + r.abilities.length + " effects" : ""}` : isKw(r) ? `Keyword · ${r.abilities.length} ${r.abilities.length === 1 ? "effect" : "effects"}` : isAnom(r) ? `Anomaly · ${r.abilities.length} ${r.abilities.length === 1 ? "rule" : "rules"}` : isHero(r) ? `${r.health} Health · ${r.powerType === "passive" ? "Passive" : r.powerCost + " gold"}` : isSpell(r) ? `Spell · ${r.cost} gold` : `Tier ${r.tier}${r.rarity && r.rarity !== "common" ? " · " + W.RARITY[r.rarity].name : ""}`}</i></span>${tag ? `<b>${tag}</b>` : ""}</button>`;
    const edited = new Set(work.filter((r) => r.builtIn).map((r) => kindOf(r) + "|" + r.id));
    const pics = new Set(Object.keys(ST.IMAGES));
    const known = new Set(W.TRIBES);
    // every minion of this meta, sorted into its tribe: yours, edited built-ins and untouched built-ins together
    const minions = work.filter((r) => kindOf(r) === "minion" && !r.builtIn).map((r) => ({ r, tag: "YOURS" }));
    const allIds = [...new Set(Object.keys(W.ORIGINAL).concat(Object.keys(W.CARDS), Object.keys(W.TOKENS)))].filter((id) => builtInMinion(id) && !(W.CARDS[id] && W.CARDS[id].retired));
    for (const id of allIds) minions.push({ r: recordFor("minion|" + id), tag: edited.has("minion|" + id) ? "EDITED" : pics.has(id) ? "PICTURE" : "" });
    let html = "";
    const show = (k) => kindTab === k || (kindTab === "all" && (k === "minion" || k === "spell"));
    // a group header folds its list; searching opens everything
    const group = (key, cls, inner, count, body) => {
      const shut = closedGroups.has(key) && !q;
      return `<button type="button" class="ce-group ${cls}${shut ? " shut" : ""}" data-group="${esc(key)}" aria-expanded="${!shut}"${cls === "tribe" ? ` data-tribe="${esc(key.slice(6))}"` : ""}><i class="ce-caret"></i>${inner}<em>${count}</em></button>` + (shut ? "" : body);
    };
    const heroes = heroList().map(flatHero).filter(match);
    const anoms = anomList().map(flatAnom).filter(match);
    const minionRows = minions.filter(({ r }) => match(r) && (!tierF || r.tier === tierF));
    const spellRows = work.filter((r) => isSpell(r) && !r.builtIn).map((r) => ({ r, tag: "YOURS" }))
      .concat(Object.keys(W.SPELLS).filter((id) => !W.SPELLS[id].custom || (W.BASE_SPELLS && W.BASE_SPELLS[id])).map((id) => ({ r: recordFor("spell|" + id), tag: pics.has("spell:" + id) ? "PICTURE" : "" }))).filter(({ r }) => match(r));
    const kws = kwList().map(flatKw).filter(match);
    const affs = affIds().map(flatAff).filter(match);
    const counts = { all: heroes.length + anoms.length + minionRows.length + spellRows.length + kws.length + affs.length, minion: minionRows.length, spell: spellRows.length, hero: heroes.length, anomaly: anoms.length, keyword: kws.length, affinity: affs.length };
    counts.all = minionRows.length + spellRows.length;
    $("#ceKinds", el).innerHTML = (["all", "minion", "spell"].includes(kindTab) ? [["all", "All"], ["minion", "Minions"], ["spell", "Spells"]] : [])
      .map(([k, l]) => `<button type="button" role="tab" aria-selected="${kindTab === k}" class="ce-kind${kindTab === k ? " on" : ""}" data-kind="${k}">${l}<em>${counts[k]}</em></button>`).join("");
    $("#ceTierF", el).innerHTML = show("minion") ? `<span>Tier</span>${[1, 2, 3, 4, 5, 6].map((n) => `<button type="button" class="${tierF === n ? "on" : ""}" data-tier="${n}">${n}</button>`).join("")}` : "";
    if (show("affinity") && (affs.length || kindTab === "affinity")) html += group("affinities", "affinities", "<span>Affinities</span>", affs.length, affs.length ? affs.map((r) => item(r, r.hidden ? "HIDDEN" : r.builtIn ? "" : "YOURS")).join("") : `<div class="ce-empty small">${q ? "No match." : "No affinities: + New affinity."}</div>`);
    if (show("keyword") && (kws.length || kindTab === "keyword")) html += group("keywords", "keywords", "<span>Keywords</span>", kws.length, kws.length ? kws.map((r) => item(r, "")).join("") : `<div class="ce-empty small">${q ? "No match." : "No keywords of your own yet: + New keyword."}</div>`);
    if (show("hero")) html += group("heroes", "heroes", "<span>Heroes</span>", heroes.length, heroes.length ? heroes.map((r) => item(r, "")).join("") : `<div class="ce-empty small">${q ? "No match." : "No heroes: games are played without hero powers."}</div>`);
    if (show("anomaly")) html += group("anomalies", "anomalies", "<span>Anomalies</span>", anoms.length, anoms.length ? anoms.map((r) => item(r, (r.banHeroes || []).length ? (r.banHeroes.length + " BAN" + (r.banHeroes.length > 1 ? "S" : "")) : "")).join("") : `<div class="ce-empty small">${q ? "No match." : "No anomalies: Anomaly mode plays like a normal game."}</div>`);
    if (show("minion")) {
      // tokens first, in their own group: cards never offered in the tavern (only effects make them)
      const toks = minionRows.filter(({ r }) => isTokenRec(r)).sort((a, b) => a.r.tier - b.r.tier || a.r.name.localeCompare(b.r.name));
      html += group("tokens", "tokens", "<span>Tokens</span>", toks.length, toks.length ? toks.map(({ r, tag }) => item(r, tag)).join("") : `<div class="ce-empty small">No tokens yet: + New token.</div>`);
    }
    if (show("minion")) for (const t of [...W.TRIBES, ""]) {
      const rows = minionRows.filter(({ r }) => !isTokenRec(r) && (known.has(r.tribe) ? r.tribe : "") === t).sort((a, b) => a.r.tier - b.r.tier || a.r.name.localeCompare(b.r.name));
      if (!rows.length && (q || tierF || !t)) continue;
      html += group("tribe:" + t, "tribe", `${t ? ART.tribeIcon(t) : ""}<span>${esc(TN(t) || "Neutral")}</span>`, rows.length,
        rows.length ? rows.map(({ r, tag }) => item(r, tag)).join("") : `<div class="ce-empty small">No ${esc(TN(t))} cards yet.</div>`);
    }
    if (show("minion") && !minions.length && !q) html += `<div class="ce-empty">${q ? "No match." : ST.meta.blank ? "This meta is empty. Add tribes with the Tribes button, then cards with + New minion. A game needs at least 3 minions, one of them at tier 1." : "Nothing yet."}</div>`;
    if (show("spell") && spellRows.length) html += group("spells", "spells", "<span>Tavern spells</span>", spellRows.length, spellRows.map(({ r, tag }) => item(r, tag)).join(""));
    if (!html) html = `<div class="ce-empty">${q ? `Nothing matches “${esc(query)}”.` : "Nothing here yet."}</div>`;
    $("#ceItems", el).innerHTML = html;
  }

  // ---------------------------------------------------------------- tribes
  let view = "card";
  let forge = null; // { kind, tribe, tier, theme, drafts: [] }
  const PALETTE = ["#4fa34a", "#7c8fa6", "#9a6cf0", "#3c7be0", "#f07a2e", "#d8393e", "#1fb5a8", "#c2306e", "#d6a419", "#5d6bd8", "#2f9e7a", "#b0563a"];
  function tribeList() {
    return (ST.tribes || W.BASE_TRIBES.map((id) => ({ id, name: id, color: "", icon: "", blurb: "" }))).map((t) => ({ ...t }));
  }
  const cardsOfTribe = (id) => work.filter((r) => W.hasTribe(r, id)).length + Object.keys(W.CARDS).filter((k) => !W.CARDS[k].custom && W.hasTribe(W.CARDS[k], id)).length;
  let tdraft = null; // the tribe list being edited (saved in the background)
  // ---------------------------------------------------------------- table background
  // The table is 1280 x 760 (it scales to the window). Pictures are cropped to fill it and stored at 2560 x 1520.
  const TABLE_W = 1280, TABLE_H = 760;
  // [name, x, y, w, h, colour, kind]: kind "area" (a region), "box", "round", "combat" (only during fights), "duo" (Duo mode only), "sometimes"
  const TABLE_ZONES = [
    ["Players", 12, 12, 150, 736, "#7fb3ff", "area"], ["Tribes", 19, 650, 136, 88, "#7fb3ff", "box", "in"],
    ["Tavern minions / enemy warband", 280, 144, 980, 172, "#ff9a6a", "area"], ["Your warband", 280, 322, 980, 172, "#7ee08a", "area"],
    ["Hand", 470, 604, 620, 150, "#c9a8ff", "area"],
    ["Upgrade", 180, 162, 92, 84, "#ffd25a", "box", "in"], ["Refresh", 180, 270, 92, 84, "#ffd25a", "box", "in"], ["Freeze", 180, 378, 92, 84, "#ffd25a", "box", "in"],
    ["Bartender", 714, 6, 112, 128, "#ffd25a", "round", "right"], ["Tavern tier plate", 719, 103, 102, 24, "#ffd25a", "box", "right"], ["Bartender's quips", 468, 20, 230, 44, "#ffd25a", "sometimes", "in"],
    ["Rank", 1016, 14, 122, 53, "#9fdcff", "box", "in"], ["Sound", 1150, 14, 116, 36, "#9fdcff", "box", "in"], ["Anomaly", 1138, 70, 128, 28, "#c9a8ff", "sometimes", "below"],
    ["Hero", 714, 467, 112, 128, "#ff7aa8", "round", "left"], ["Hero name", 748, 585, 44, 22, "#ff7aa8", "box", "left"], ["Hero power", 840, 510, 54, 54, "#ff7aa8", "round", "right"],
    ["Partner portal", 664, 517, 66, 66, "#b58cff", "duo", "left"],
    ["Gold", 280, 646, 170, 64, "#ffd25a", "box", "in"], ["Timer", 1104, 546, 156, 16, "#9fdcff", "box", "left"], ["End turn", 1104, 578, 156, 90, "#ffd25a", "box", "in"],
    ["Enemy hero", 715, 7, 110, 136, "#ff6b6b", "combat", "left"]];
  // where minions stand (7 per row, the tavern spell takes an 8th spot on the right) and where hand cards sit, drawn faintly on the template
  const TABLE_SLOTS = (() => { const out = [], w = 108, gap = 12, row = (y, n) => { const x0 = 770 - (n * w + (n - 1) * gap) / 2; for (let i = 0; i < n; i++) out.push([x0 + i * (w + gap), y, w, 138]); };
    row(161, 7); row(339, 7);
    return out; })();
  let showGuide = true;
  // ---------------------------------------------------------------- card skin
  // Card geometry in table pixels (1x). The skin is painted at 4x with an 8px bleed: 560 x 848.
  const CARD = { w: 124, h: 196, bleed: 8, radius: 18, art: [5, 5, 114, 112], name: [1, 104, 122, 26], text: [9, 132, 106, 38], tribe: [20, 180, 84, 10], atk: [-10, 172, 34, 34], hp: [100, 172, 34, 34], stars: [34, -10, 56, 18], cost: [-10, -10, 26, 26] };
  const skinKinds = [["normal", "Minions", "Every minion card. Required."], ["golden", "Golden", "Golden minions. Falls back to the minion skin."], ["spell", "Spells", "Tavern spells in hand. Falls back to the minion skin."]];
  // keep the picture as painted (at most 1200px wide), transparency included; returns { src, w, h }
  function skinPicture(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => { const k = Math.min(1, 1200 / im.naturalWidth), c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob((b) => res({ src: ST.urlOf(b), w: c.width, h: c.height }), "image/png"); };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error("not an image")); };
      im.src = url;
    });
  }
  // a gem painted apart: cropped to what is painted; when it was exported on a canvas the size of the frame, where it sits there is kept
  const GEM_KEYS = [["gemAtk", "atk", "Attack gem", /att|atk|atq|sword|epee|épée|power|force/i], ["gemHp", "hp", "Health gem", /health|hp|vie|pv|life|heart|coeur|cœur|sant/i], ["gemTier", "tier", "Tier / cost gem", /tier|cost|cout|coût|mana|niv|level|rang|rank|star|gold|or\b/i]];
  function gemPicture(file, fw, fh, natW) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => { URL.revokeObjectURL(url);
        const W = im.naturalWidth, H = im.naturalHeight, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"); g.drawImage(im, 0, 0);
        let x0 = W, y0 = H, x1 = -1, y1 = -1; try { const d = g.getImageData(0, 0, W, H).data; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } } catch (e) { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1; }
        if (x1 < 0) { rej(new Error("the picture is empty")); return; }
        const bw = x1 - x0 + 1, bh = y1 - y0 + 1, k = Math.min(1, 512 / Math.max(bw, bh)), o = document.createElement("canvas"); o.width = Math.max(1, Math.round(bw * k)); o.height = Math.max(1, Math.round(bh * k)); const og = o.getContext("2d"); og.imageSmoothingQuality = "high"; og.drawImage(c, x0, y0, bw, bh, 0, 0, o.width, o.height);
        // same canvas as the frame (its own pixels, before the frame was scaled): keep the spot
        let at = null; const r = natW ? fw / natW : 1;
        if (natW && Math.abs(W - natW) <= 2 && Math.abs(H * r - fh) <= 3) at = [Math.round((x0 + bw / 2) * r), Math.round((y0 + bh / 2) * r), Math.round(Math.max(bw, bh) * r)];
        else if (Math.abs(W - fw) <= 2 && Math.abs(H - fh) <= 2) at = [Math.round(x0 + bw / 2), Math.round(y0 + bh / 2), Math.round(Math.max(bw, bh))];
        o.toBlob((b) => res({ src: ST.urlOf(b), at }), "image/png"); };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error("not an image")); };
      im.src = url;
    });
  }
  const natWidth = (file) => new Promise((res) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im.naturalWidth); }; im.onerror = () => { URL.revokeObjectURL(u); res(0); }; im.src = u; });
  // which gem a file is, by its name; null when the name says nothing
  const gemOfName = (n) => { const b = n.replace(/\.[^.]+$/, ""); const hit = GEM_KEYS.filter(([, , , re]) => re.test(b)); return hit.length === 1 ? hit[0][0] : null; };
  // several files: the frame and its gems. The frame is the file named frame/card/cadre/carte, or the one that is no gem, or the biggest
  async function sortCardFiles(files) {
    const list = [...files], gems = {}; let frame = list.find((f) => /frame|card|cadre|carte|bord|skin|fond/i.test(f.name) && !gemOfName(f.name));
    if (!frame) { const nog = list.filter((f) => !gemOfName(f.name)); frame = nog.length === 1 ? nog[0] : null; }
    if (!frame) { let best = 0; for (const f of list) if (f.size > best) { best = f.size; frame = f; } }
    const rest = list.filter((f) => f !== frame), free = [];
    for (const f of rest) { const g = gemOfName(f.name); if (g && !gems[g]) gems[g] = f; else free.push(f); }
    for (const [g] of GEM_KEYS) if (!gems[g] && free.length) gems[g] = free.shift();
    return { frame, gems };
  }
  async function applyGemFiles(skId, gems, frameFile) {
    const sk = ST.skinList("card").concat(ST.skinList("token")).find((e) => e.id === skId); if (!sk) return 0;
    const natW = frameFile ? await natWidth(frameFile) : sk.natW || 0, L = Object.assign({}, sk.layout || {}), patch = {}; let n = 0;
    for (const [key, zone] of GEM_KEYS) { const f = gems[key]; if (!f) continue; const g = await gemPicture(f, sk.w, sk.h, natW); patch[key] = g.src; if (g.at && !(sk.kind === "token" && zone === "tier")) L[zone] = g.at; n++; }
    patch.layout = L; if (natW) patch.natW = natW;
    await ST.updateSkin(skId, patch); return n;
  }
  // a layout scaled from one picture size to another
  const scaleLayout = (L, fw, fh, tw, th) => { const kx = tw / fw, ky = th / fh, o = {}; for (const [k, v] of Object.entries(L)) o[k] = k === "size" ? v.slice() : Array.isArray(v) ? (v.length === 3 ? [Math.round(v[0] * kx), Math.round(v[1] * ky), Math.round(v[2] * kx)] : [Math.round(v[0] * kx), Math.round(v[1] * ky), Math.round(v[2] * kx), Math.round(v[3] * ky)]) : typeof v === "number" ? Math.round(v * kx) : v; return o; };
  const ZONES = [["art", "Picture", 4], ["name", "Name plate", 4], ["text", "Text panel", 4], ["tribe", "Tribe line", 4], ["stars", "Tier stars", 4], ["atk", "Attack gem (centre x, y, size)", 3], ["hp", "Health gem (centre x, y, size)", 3], ["tier", "Tier / cost gem (centre x, y, size)", 3]];
  const TOKEN_ZONES = [["art", "Picture", 4], ["stars", "Tier stars", 4], ["atk", "Attack gem (centre x, y, size)", 3], ["hp", "Health gem (centre x, y, size)", 3]];
  const END_ZONES = [["label", "Label box (height 0 = no text, paint it yourself)", 4], ["size", "Button size on the table (w, h)", 2]];
  // ---- the workshop: the skin as layers on a live mock-up; drag a layer to move it, pull its handle to resize it
  const WS_LAYERS = {
    card: [["art", "Illustration", "rect"], ["frame", "Frame", "frame"], ["name", "Name plate", "rect"], ["text", "Text panel", "rect"], ["tribe", "Tribe line", "rect"], ["stars", "Tier stars", "rect"], ["atk", "Attack gem", "circle"], ["hp", "Health gem", "circle"], ["tier", "Tier / cost gem", "circle"]],
    token: [["art", "Portrait", "rect"], ["frame", "Frame", "frame"], ["stars", "Tier stars", "rect"], ["atk", "Attack gem", "circle"], ["hp", "Health gem", "circle"]],
    endturn: [["frame", "Button", "frame"], ["label", "Label box", "rect"]],
  };
  const WS_SAMPLE = { name: "Primal Adventurer", text: "Battlecry: Give a friendly minion +1/+1.", tribe: "◆ ORCS", atk: "2", hp: "2", tier: "1", label: "End Turn", stars: "★★★" };
  function renderWorkshop(box, sk, K, L, save) {
    const layers = WS_LAYERS[skinKind], S = Math.min(1, 380 / sk.w, 540 / sk.h), W = Math.round(sk.w * S), H = Math.round(sk.h * S);
    const hasArt = layers.some(([k]) => k === "art");
    let sel = null, hidden = new Set(), timer = 0;
    const pic = (() => { const e = Object.values(ST.IMAGES || {}).find((x) => x && x.card); return e ? e.card : ""; })();
    const wrap = document.createElement("div"); wrap.className = "ce-ws";
    wrap.innerHTML = `<div class="ce-ws-stage" tabindex="0" style="width:${W}px;height:${H}px" aria-label="Workshop: drag the layers">
        ${layers.map(([k, label, kind]) => kind === "frame" ? `<img class="ce-ws-frame" src="${sk.normal}" alt="" draggable="false">`
          : `<div class="ce-ws-zone ${kind} z-${k}" data-z="${k}" title="${label}"><span class="lbl">${label}</span><span class="smp">${k === "art" ? (pic ? "" : label) : esc(WS_SAMPLE[k] || "")}</span><i class="h" title="Resize"></i></div>`).join("")}
      </div>
      <div class="ce-ws-side">
        <b>Layers</b><p class="ce-hint">Top layer first. Click one to select it, drag it on the card, pull the corner to resize; arrow keys nudge by 1 px (Shift: 10). The eye only hides it here.</p>
        <ol class="ce-ws-layers">${layers.slice().reverse().map(([k, label, kind]) => `<li data-layer="${k}"><button type="button" class="ce-ws-pick" data-pick="${k}"${kind === "frame" ? " disabled" : ""}>${label}</button>${kind === "frame" ? "" : `<label class="ce-ws-eye" title="Show / hide here"><input type="checkbox" data-eye="${k}" checked> 👁</label>`}</li>`).join("")}</ol>
        ${hasArt ? `<label class="ce-check small"><input type="checkbox" id="ceWsBehind" ${L.artBehind ? "checked" : ""}> Illustration behind the frame (the frame's window must be transparent)</label>` : ""}
        <div class="ce-ws-info" id="ceWsInfo">Nothing selected.</div>
      </div>`;
    box.appendChild(wrap);
    const stage = wrap.querySelector(".ce-ws-stage"), frame = wrap.querySelector(".ce-ws-frame"), zoneEl = (k) => wrap.querySelector(`.ce-ws-zone[data-z="${k}"]`);
    const isCircle = (k) => layers.find(([x]) => x === k)[2] === "circle";
    const place = () => {
      frame.style.zIndex = L.artBehind ? 2 : 1;
      for (const [k, , kind] of layers) {
        if (kind === "frame") continue; const z = zoneEl(k), v = L[k]; if (!v) { z.style.display = "none"; continue; }
        z.style.display = hidden.has(k) ? "none" : "";
        if (kind === "circle") { z.style.left = (v[0] - v[2] / 2) * S + "px"; z.style.top = (v[1] - v[2] / 2) * S + "px"; z.style.width = z.style.height = v[2] * S + "px"; }
        else { z.style.left = v[0] * S + "px"; z.style.top = v[1] * S + "px"; z.style.width = v[2] * S + "px"; z.style.height = v[3] * S + "px"; }
        if (kind === "circle") { const gk = { atk: "gemAtk", hp: "gemHp", tier: "gemTier" }[k], src = gk && sk[gk]; z.style.backgroundImage = src ? `url('${src}')` : ""; z.classList.toggle("has-gem", !!src); }
        if ((k === "name" || k === "tribe") && root.WA_CURVE_ONE) { const sp = z.querySelector(".smp"), amt = +(L[k + "Curve"] || 0); if (sp.__cvSrc != null && sp.querySelector("svg")) { sp.textContent = sp.__cvSrc; sp.classList.remove("curved"); } if (amt) root.WA_CURVE_ONE(sp, amt, v[2] * S, v[3] * S); }
        if (k === "art") { const sh = L.artShape || "rect", SH = root.WA_ART_SHAPES || {}, cp = /clip-path:\s*([^;]+);/.exec(SH[sh] || ""); z.style.clipPath = cp ? cp[1] : ""; const mu = sh === "mask" && sk.artMask ? `url('${sk.artMask}') center / 100% 100% no-repeat` : ""; z.style.webkitMask = mu; z.style.mask = mu; z.classList.toggle("shaped", sh !== "rect"); }
        if (k === "art") { const rt = (L.radius || 0) * S, rb = (L.radiusBottom == null ? L.radius || 0 : L.radiusBottom) * S; z.style.borderRadius = (L.artShape || "rect") === "arch" ? `50% 50% ${rb}px ${rb}px / 32% 32% ${rb}px ${rb}px` : ["rect", "mask"].includes(L.artShape || "rect") ? `${rt}px ${rt}px ${rb}px ${rb}px` : "0"; z.style.zIndex = L.artBehind ? 0 : 1.5; z.style.backgroundImage = pic ? `url('${pic}')` : ""; }
        else z.style.zIndex = 3;
        z.classList.toggle("sel", sel === k);
        if (k === "name") z.style.color = L.nameColor || ""; if (k === "text") z.style.color = L.textColor || ""; if (k === "tribe") z.style.color = L.tribeColor || ""; if (k === "label") z.style.color = L.labelColor || ""; if (kind === "circle") z.style.color = L.numColor || "";
      }
      wrap.querySelectorAll("[data-pick]").forEach((b) => b.classList.toggle("on", b.dataset.pick === sel));
      const info = wrap.querySelector("#ceWsInfo"), v = sel && L[sel];
      info.textContent = v ? (isCircle(sel) ? `${layers.find(([x]) => x === sel)[1]} · centre ${v[0]}, ${v[1]} · size ${v[2]}` : `${layers.find(([x]) => x === sel)[1]} · x ${v[0]}, y ${v[1]} · ${v[2]} × ${v[3]}`) : "Nothing selected.";
    };
    const inputs = () => { box.querySelectorAll("[data-lz]").forEach((i) => { const v = L[i.dataset.lz]; if (v) i.value = v[+i.dataset.li]; }); };
    const commit = () => { clearTimeout(timer); timer = setTimeout(() => { save(L); inputs(); if (box._syncGems) box._syncGems(); }, 150); };
    const select = (k) => { sel = k; place(); };
    stage.addEventListener("pointerdown", (e) => {
      const z = e.target.closest(".ce-ws-zone"); if (!z) { select(null); return; }
      const k = z.dataset.z, v = L[k], resize = !!e.target.closest(".h"), circle = isCircle(k), start = v.slice(), sx = e.clientX, sy = e.clientY;
      select(k); stage.focus({ preventScroll: true }); e.preventDefault(); stage.setPointerCapture(e.pointerId);
      const mv = (ev) => { const dx = (ev.clientX - sx) / S, dy = (ev.clientY - sy) / S;
        if (resize) { if (circle) v[2] = Math.max(8, Math.round(start[2] + Math.max(dx, dy))); else { v[2] = Math.max(4, Math.round(start[2] + dx)); v[3] = Math.max(4, Math.round(start[3] + dy)); } }
        else { v[0] = Math.round(start[0] + dx); v[1] = Math.round(start[1] + dy); }
        place(); commit(); };
      const up = () => { stage.removeEventListener("pointermove", mv); stage.removeEventListener("pointerup", up); stage.removeEventListener("pointercancel", up); };
      stage.addEventListener("pointermove", mv); stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
    });
    stage.addEventListener("keydown", (e) => {
      if (!sel || !L[sel]) return; const d = e.shiftKey ? 10 : 1, v = L[sel]; let used = true;
      if (e.key === "ArrowLeft") v[0] -= d; else if (e.key === "ArrowRight") v[0] += d; else if (e.key === "ArrowUp") v[1] -= d; else if (e.key === "ArrowDown") v[1] += d; else used = false;
      if (used) { e.preventDefault(); place(); commit(); }
    });
    wrap.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => { select(b.dataset.pick); stage.focus({ preventScroll: true }); }));
    wrap.querySelectorAll("[data-eye]").forEach((c) => c.addEventListener("change", () => { if (c.checked) hidden.delete(c.dataset.eye); else hidden.add(c.dataset.eye); place(); }));
    const behind = wrap.querySelector("#ceWsBehind"); if (behind) behind.addEventListener("change", () => { L.artBehind = behind.checked; place(); save(L); });
    place();
    return { refresh: place, inputs };
  }
  // does the frame leave its picture window see-through? (sampled at the window's centre)
  function windowIsClear(src, L) {
    return new Promise((res) => { const im = new Image(); im.onload = () => { try { const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext("2d"); g.drawImage(im, 0, 0);
      const a = L.art, pts = [[a[0] + a[2] / 2, a[1] + a[3] / 2], [a[0] + a[2] * 0.3, a[1] + a[3] * 0.3], [a[0] + a[2] * 0.7, a[1] + a[3] * 0.7]]; let clear = 0;
      for (const [x, y] of pts) { const d = g.getImageData(Math.round(x), Math.round(y), 1, 1).data; if (d[3] < 40) clear++; } res(clear >= 2); } catch (e) { res(false); } }; im.onerror = () => res(false); im.src = src; });
  }
  // generic zone editor. spec: { zones, numbers: [[key,label]], colours: [[key,label,default]], resets: [[label, () => layout]] }
  function renderLayoutFields(box, sk, L, spec, save) {
    const row = (k, label, n) => { if (!L[k]) L[k] = n === 2 ? [156, 90] : n === 3 ? [0, 0, 0] : [0, 0, 0, 0]; return `<div class="ce-layrow"><span>${label}</span>${(n === 2 ? ["w", "h"] : ["x", "y", n === 3 ? "size" : "w", "h"]).slice(0, n).map((lbl, i) => `<label>${lbl}<input type="number" data-lz="${k}" data-li="${i}" value="${L[k][i]}" step="1"></label>`).join("")}</div>`; };
    box.insertAdjacentHTML("beforeend", `<details class="ce-more ce-layout"><summary>Numbers: layout of the zones on this skin (in the picture's pixels, ${sk.w} × ${sk.h})</summary>
      <p class="ce-hint">Where the game draws each part over your picture. Numbers are pixels of your picture; the preview updates as you type.${(spec.numbers || []).map(([k, l]) => ` ${l}: <input type="number" data-ln="${k}" value="${L[k] == null ? "" : L[k]}" style="width:64px">`).join("")}</p>
      ${spec.zones.map(([k, l, n]) => row(k, l, n)).join("")}
      ${spec.colours && spec.colours.length ? `<div class="ce-layrow"><span>Colours</span>${spec.colours.map(([k, l, d]) => `<label>${l}<input type="color" data-lc="${k}" value="${L[k] || d}"></label>`).join("")}</div>` : ""}
      <div class="ce-row">${spec.resets.map(([l], i) => `<button type="button" class="pill" data-layreset="${i}">${l}</button>`).join("")}</div></details>`);
    let t = 0;
    box.addEventListener("input", (e) => { const i = e.target; if (i.dataset.ln) L[i.dataset.ln] = i.value === "" ? null : +i.value; else if (i.dataset.lz) L[i.dataset.lz][+i.dataset.li] = +i.value || 0; else if (i.dataset.lc) L[i.dataset.lc] = i.value; else return; clearTimeout(t); t = setTimeout(() => save(L), 200); });
    box.addEventListener("click", async (e) => { const b = e.target.closest("[data-layreset]"); if (!b) return; for (const k of Object.keys(L)) delete L[k]; Object.assign(L, spec.resets[+b.dataset.layreset][1]()); await save(L); renderSkins(); });
  }
  // a template PNG with every zone of a token or the End Turn button marked
  function downloadZoneTemplate(kind) {
    const T = root.WA_CARD_LAYOUTS[kind === "token" ? "TOKEN" : "END"], L = T.layout, c = document.createElement("canvas"); c.width = T.w; c.height = T.h; const g = c.getContext("2d"), B = 32;
    g.fillStyle = "rgba(255,255,255,.06)"; g.fillRect(0, 0, T.w, T.h);
    const rr = (x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
    if (kind === "token") { rr(B, B, T.w - 2 * B, T.h - 2 * B, 40); } else rr(B, B, T.w - 2 * B, T.h - 2 * B, 180);
    g.fillStyle = "#1c1410"; g.fill(); g.strokeStyle = "#d9a65a"; g.lineWidth = 6; g.stroke();
    const zone = (name, z, col, round, radii) => { g.beginPath(); if (round) g.ellipse(z[0], z[1], z[2] / 2, z[2] / 2, 0, 0, Math.PI * 2); else if (g.roundRect) g.roundRect(z[0], z[1], z[2], z[3], radii || 16); else g.rect(z[0], z[1], z[2], z[3]);
      g.fillStyle = col + "33"; g.fill(); g.strokeStyle = col; g.lineWidth = 4; g.setLineDash([12, 12]); g.stroke(); g.setLineDash([]);
      const cx = round ? z[0] : z[0] + z[2] / 2, cy = round ? z[1] : z[1] + z[3] / 2; g.fillStyle = "#fff"; g.font = "700 24px sans-serif"; g.textAlign = "center"; g.fillText(name, cx, cy + 8); g.font = "500 18px sans-serif"; g.fillStyle = "rgba(255,255,255,.75)"; g.fillText(round ? `centre ${z[0]},${z[1]} · ø${z[2]}` : `${z[0]},${z[1]} · ${z[2]}×${z[3]}`, cx, cy + 32); };
    if (kind === "token") { zone("Portrait", L.art, "#7fb3ff", false, [L.radius, L.radius, L.radiusBottom, L.radiusBottom]); zone("Attack", L.atk, "#ffd25a", true); zone("Health", L.hp, "#ff7a8a", true); zone("Tier stars", L.stars, "#ffd25a"); }
    else zone("End Turn label", L.label, "#ffd25a");
    g.fillStyle = "rgba(255,255,255,.7)"; g.font = "600 18px sans-serif"; g.textAlign = "left"; g.fillText(`${kind === "token" ? "token 108×138" : "button 156×90"}, bleed 8 · ${T.w}×${T.h} PNG (4×)`, 8, T.h - 8);
    const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = `warband-${kind}-template.png`; document.body.appendChild(a); a.click(); a.remove();
    status(`Template downloaded: ${T.w} × ${T.h} with every zone marked.`);
  }
  // a live card with the skin, next to the fields
  function skinPreview(sk) {
    const pc = $("#cePvCard", el); if (!pc) return; pc.innerHTML = "";
    if (sk && root.WA_PREVIEW_SKIN) root.WA_PREVIEW_SKIN(skinKind, sk); else if (root.WA_PREVIEW_SKIN) root.WA_PREVIEW_SKIN(null);
    const ids = Object.keys(W.CARDS).filter((k) => W.CARDS[k].inPool !== false); if (!ids.length) return;
    const m = new W.Minion(ids[Math.floor(ids.length / 2)]); const c = helpers.makeCard(m.dict ? m.dict() : m); c.classList.add("static"); pc.appendChild(c); if (root.WA_FIT_CARDS) root.WA_FIT_CARDS(pc);
    const pt = $("#cePvTok", el); pt.innerHTML = "";
    if (helpers.makeToken) { const t = helpers.makeToken(m.dict ? m.dict() : m, { static: true, tier: true }); t.classList.add("static"); pt.appendChild(t); }
    const bt = document.createElement("button"); bt.type = "button"; bt.className = "endturn pv-end"; bt.textContent = "End Turn"; pt.appendChild(bt);
    $("#ceText", el).innerHTML = sk ? `<b>Preview:</b> ${esc(sk.name)}` : "<b>Preview:</b> what this meta equips";
  }
  function downloadCardTemplate() {
    const S = 4, B = CARD.bleed, c = document.createElement("canvas"); c.width = (CARD.w + 2 * B) * S; c.height = (CARD.h + 2 * B) * S;
    const g = c.getContext("2d"); g.scale(S, S); g.translate(B, B);
    // bleed area, then the card body
    g.fillStyle = "rgba(255,255,255,.06)"; g.fillRect(-B, -B, CARD.w + 2 * B, CARD.h + 2 * B);
    const rr = (x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
    rr(0, 0, CARD.w, CARD.h, CARD.radius); g.fillStyle = "#1c1410"; g.fill(); g.strokeStyle = "#d9a65a"; g.lineWidth = 1.5; g.stroke();
    const zone = (name, [x, y, w, h], col, round) => { if (round) { g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); } else rr(x, y, w, h, 4); g.fillStyle = col + "33"; g.fill(); g.strokeStyle = col; g.lineWidth = 1; g.setLineDash([3, 3]); g.stroke(); g.setLineDash([]);
      g.fillStyle = "#fff"; g.font = "700 6px sans-serif"; g.textAlign = "center"; g.fillText(name, x + w / 2, y + h / 2 + 2); g.font = "500 4.5px sans-serif"; g.fillStyle = "rgba(255,255,255,.75)"; g.fillText(`${x},${y} · ${w}×${h}`, x + w / 2, y + h / 2 + 8); };
    zone("Picture (4:3.9)", CARD.art, "#7fb3ff"); zone("Name ribbon", CARD.name, "#ffd25a"); zone("Card text", CARD.text, "#7ee08a"); zone("Tribe / rarity", CARD.tribe, "#c9a8ff");
    zone("Attack", CARD.atk, "#ffd25a", true); zone("Health", CARD.hp, "#ff7a8a", true); zone("Tier stars", CARD.stars, "#ffd25a"); zone("Cost (spells)", CARD.cost, "#9fdcff", true);
    g.fillStyle = "rgba(255,255,255,.7)"; g.font = "600 4.5px sans-serif"; g.textAlign = "left"; g.fillText(`card ${CARD.w}×${CARD.h}, radius ${CARD.radius}, bleed ${B} · export ${c.width}×${c.height} PNG`, 2, CARD.h + B - 2);
    const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "warband-card-template.png"; document.body.appendChild(a); a.click(); a.remove();
    status("Card template downloaded: 560 × 848 with every zone marked.");
  }
  // crop to fill 2560 x 1520 and store as a JPEG
  function tablePicture(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        const W2 = TABLE_W * 2, H2 = TABLE_H * 2, c = document.createElement("canvas"); c.width = W2; c.height = H2;
        const sc = Math.max(W2 / im.naturalWidth, H2 / im.naturalHeight), w = im.naturalWidth * sc, h = im.naturalHeight * sc;
        const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(im, (W2 - w) / 2, (H2 - h) / 2, w, h);
        URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.86));
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error("not an image")); };
      im.src = url;
    });
  }
  // a 2560 x 1520 PNG with the zones drawn, to paint over
  function downloadTemplate() {
    const c = document.createElement("canvas"); c.width = TABLE_W * 2; c.height = TABLE_H * 2;
    const g = c.getContext("2d"); g.scale(2, 2);
    g.fillStyle = "#151834"; g.fillRect(0, 0, TABLE_W, TABLE_H);
    g.strokeStyle = "rgba(255,255,255,.08)"; g.lineWidth = 1;
    for (let x = 0; x <= TABLE_W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, TABLE_H); g.stroke(); }
    for (let y = 0; y <= TABLE_H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(TABLE_W, y); g.stroke(); }
    const shape = (x, y, w, h, round) => { g.beginPath(); if (round) g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); else if (g.roundRect) g.roundRect(x, y, w, h, Math.min(14, h / 3)); else g.rect(x, y, w, h); };
    // regions first, then the pieces on top
    // minion spots
    g.strokeStyle = "rgba(255,255,255,.16)"; g.lineWidth = 1.5; g.setLineDash([3, 4]);
    for (const [x, y, w, h] of TABLE_SLOTS) { g.beginPath(); g.moveTo(x + 9, y + h - 14); g.lineTo(x + 9, y + 50); g.arc(x + w / 2, y + 52, w / 2 - 9, Math.PI, 0); g.lineTo(x + w - 9, y + h - 14); g.closePath(); g.stroke(); }
    g.setLineDash([]);
    g.font = "600 10px sans-serif"; g.fillStyle = "rgba(255,255,255,.32)"; g.textAlign = "center";
    for (const [x, y, w, h] of TABLE_SLOTS) g.fillText(y < 300 ? "Shop minion" : "Your minion", x + w / 2, y + h - 22);
    g.textAlign = "left";
    for (const pass of ["area", "pieces"]) for (const [n, x, y, w, h, col, kind, pos] of TABLE_ZONES) {
      if ((kind === "area") !== (pass === "area")) continue;
      const round = kind === "round" || kind === "combat" || kind === "duo";
      shape(x + 1, y + 1, w - 2, h - 2, round);
      g.fillStyle = col + (kind === "area" ? "1c" : kind === "sometimes" || kind === "combat" || kind === "duo" ? "22" : "55"); g.fill();
      g.strokeStyle = col; g.lineWidth = kind === "area" ? 2 : 2.5; g.setLineDash(kind === "area" ? [8, 6] : kind === "box" || kind === "round" ? [] : [4, 4]); g.stroke(); g.setLineDash([]);
      const note = kind === "combat" ? " (in combat)" : kind === "duo" ? " (Duo)" : kind === "sometimes" ? " (sometimes)" : "";
      g.fillStyle = col;
      if (kind === "area") {
        g.font = "700 14px sans-serif"; g.fillText(n, x + 8, y + 20);
        g.font = "500 11px sans-serif"; g.fillText(`x ${x}, y ${y} · ${w} × ${h}`, x + 8, y + 35);
      } else {
        // label inside, below, left or right of the piece
        const p = pos || "below";
        let lx = x + w / 2, ly = y + h + 13, al = "center";
        if (p === "in") ly = y + h / 2 - 2;
        else if (p === "left") { lx = x - 8; ly = y + h / 2 - 2; al = "right"; }
        else if (p === "right") { lx = x + w + 8; ly = y + h / 2 - 2; al = "left"; }
        g.textAlign = al;
        g.font = "700 11.5px sans-serif"; g.fillStyle = p === "in" ? "#fff" : col; g.fillText(n + note, lx, ly);
        g.font = "500 9.5px sans-serif"; g.fillStyle = "rgba(255,255,255,.75)"; g.fillText(`${x}, ${y} · ${w}×${h}`, lx, ly + 11);
        g.textAlign = "left";
      }
    }
    g.fillStyle = "#fff"; g.font = "700 15px sans-serif"; g.fillText("Warband Arena table", 182, 500);
    g.font = "500 12px sans-serif"; g.fillStyle = "rgba(255,255,255,.8)"; g.fillText("1280 × 760, export at 2560 × 1520", 182, 518);
    g.fillText("Solid: always shown · dashed: sometimes", 182, 535); g.fillText("Faint arches: where minions stand", 182, 551); g.fillText("Rows are centred on x = 770", 182, 567);
    const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "warband-table-template.png"; document.body.appendChild(a); a.click(); a.remove();
    status("Template downloaded: 2560 × 1520 with the zones marked.");
  }
  // ---------------------------------------------------------------- the Skins tab: one library of painted assets, equipped per meta
  let skinKind = "card", skinSel = null; // which kind is open, which entry is selected (null = none)
  const KIND_INFO = {
    card: { label: "Hand", one: "hand card skin", hint: "Paint your own card frame as a PNG with transparency; any size with a card-like shape works (the built-in one is 996 × 1580). The picture is stretched onto the card box and the <b>layout</b> says where the picture window, name plate, text panel, tribe line, gems and stars sit on it, in your picture's own pixels. The game draws the frame <b>under</b> those parts, so paint the panels and leave their insides plain.", builtin: "the built-in painted frame (ui-art/card-skin.png)",
      variants: [["normal", "Minions", "Every minion card. Required."], ["golden", "Golden", "Golden minions. Falls back to the minion skin."], ["spell", "Spells", "Tavern spells in hand. Falls back to the minion skin."]], zones: ZONES, numbers: [["radius", "Corner radius of the picture window"]], colours: [["nameColor", "name", "#f7e9c8"], ["textColor", "text", "#f0e6d2"], ["tribeColor", "tribe", "#d9a65a"]],
      tplLayout: (w, h) => scaleLayout(root.WA_CARD_LAYOUTS.TEMPLATE, 560, 848, w, h), defLayout: (w, h) => { const D = root.WA_CARD_LAYOUTS.DEFAULT; return scaleLayout(D.layout, D.w, D.h, w, h); },
      firstLayout: (w, h) => Math.abs(w / h - 560 / 848) < 0.01 ? KIND_INFO.card.tplLayout(w, h) : KIND_INFO.card.defLayout(w, h), template: () => downloadCardTemplate(), tplName: "card template (560 × 848)" },
    token: { label: "Board", one: "board skin", hint: "A minion on the board (and in the tavern) is <b>108 × 138</b> table pixels; the skin covers it plus an <b>8px bleed</b> on every side, so the template is <b>496 × 616</b> (4×). Paint the frame and leave the picture window, the two gems and the star strip plain: the game draws the portrait, numbers and stars over your picture. Taunt, Divine Shield and Reborn are drawn just outside the picture window.", builtin: "the built-in token frame (ui-art/token-skin.png)",
      variants: [["normal", "Minions", "Every minion on the board and in the tavern. Required."], ["golden", "Golden", "Golden minions. Falls back to the minion skin."]], zones: TOKEN_ZONES, numbers: [["radius", "Picture corner radius, top"], ["radiusBottom", "bottom"]], colours: [["gemFill", "disc behind the numbers", "#1b1310"]],
      tplLayout: (w, h) => { const T = root.WA_CARD_LAYOUTS.TOKEN; return scaleLayout(T.layout, T.w, T.h, w, h); }, defLayout: (w, h) => { const D = root.WA_CARD_LAYOUTS.TOKEN_DEFAULT; return scaleLayout(D.layout, D.w, D.h, w, h); }, firstLayout: (w, h) => KIND_INFO.token.tplLayout(w, h), template: () => downloadZoneTemplate("token"), tplName: "board template (496 × 616)" },
    endturn: { label: "End Turn button", one: "button skin", hint: "The button is <b>156 × 90</b> table pixels; with the 8px bleed the template is <b>688 × 424</b> (4×). Paint the whole button. Either leave room for the words (the game writes “End Turn” in the label box) or paint the words yourself and set the label box height to 0.", builtin: "the built-in button (ui-art/endturn-skin.png)",
      variants: [["normal", "Button", "The End Turn button at rest. The game dims it while you wait and makes it glow when you are out of gold."]], zones: END_ZONES, numbers: [["labelSize", "Label size (px of your picture)"]], colours: [["labelColor", "label", "#2a1800"]],
      tplLayout: (w, h) => { const T = root.WA_CARD_LAYOUTS.END; return scaleLayout(T.layout, T.w, T.h, w, h); }, defLayout: (w, h) => { const D = root.WA_CARD_LAYOUTS.END_DEFAULT; return scaleLayout(D.layout, D.w, D.h, w, h); }, firstLayout: (w, h) => KIND_INFO.endturn.tplLayout(w, h), template: () => downloadZoneTemplate("endturn"), tplName: "button template (688 × 424)" },
    table: { label: "Tables", one: "table background", hint: `The table is <b>${TABLE_W} × ${TABLE_H}</b> pixels (a 32:19 shape) and scales to fit the window. For a sharp picture, make it <b>2560 × 1520</b>. Other sizes are cropped to fill, so keep the important part near the middle. The coloured shapes show where the game draws its parts (* only some of the time; hover one for its exact position); busy detail under the warbands makes minions harder to read.`, builtin: "the default table colours", template: () => downloadTemplate(), tplName: "table template (2560 × 1520)" },
    bartender: { label: "Bartenders", one: "bartender skin", hint: "Skins only change how the tavern keeper looks at the top of the table. The picture is shown in a circle; square pictures of 512 × 512 or more work best.", builtin: "the default mug" },
  };
  function applySkins() { if (root.WA_APPLY_SKINS) root.WA_APPLY_SKINS(); else if (root.WA_APPLY_CARD_SKIN) root.WA_APPLY_CARD_SKIN(); }
  const skinThumb = (e) => e.kind === "bartender" ? `<span class="ce-skin-pic" style="background-image:url('${e.src}')"></span>` : e.kind === "table" ? `<span class="ce-skin-pic wide" style="background-image:url('${e.src}')"></span>` : `<span class="ce-skin-pic k-${e.kind} fit" style="background-image:url('${e.normal}')"></span>`;
  function renderSkins() {
    cur = null; curKey = ""; renderList();
    const K = KIND_INFO[skinKind], list = ST.skinList(skinKind), eq = ST.equipped[skinKind] || null, sel = skinSel && list.find((e) => e.id === skinSel) || null;
    if (skinSel && !sel) skinSel = null;
    const tile = (id, label, inner, extra) => `<div class="ce-skin-wrap${sel && sel.id === id ? " sel" : ""}"><button type="button" class="ce-skin${eq === id || (!eq && !id) ? " on" : ""}" data-skin-pick="${esc(id || "")}" title="${eq === id || (!eq && !id) ? "Equipped for " + esc(ST.meta.name) : "Click to open"}">${inner}<b>${esc(label)}</b>${eq === id || (!eq && !id) ? `<i class="ce-eq">✓ ${esc(ST.meta.name)}</i>` : ""}</button>${extra || ""}</div>`;
    const grid = `<div class="ce-skins">
      ${tile("", "Built-in", skinKind === "bartender" || skinKind === "table" ? `<span class="ce-skin-pic mug">${skinKind === "bartender" ? ART.INNKEEPER : "▦"}</span>` : `<span class="ce-skin-pic k-${skinKind} fit" style="background-image:url('ui-art/${skinKind}-skin.png')"></span>`)}
      ${list.map((e) => tile(e.id, e.name || K.one, skinThumb(e), `<button type="button" class="ce-skin-del" data-skin-del="${esc(e.id)}" title="Delete this skin" aria-label="Delete ${esc(e.name || "skin")}">✕</button>`)).join("")}
      ${skinKind === "bartender" && list.length > 1 ? tile("random", "Random each game", `<span class="ce-skin-pic rnd">?</span>`) : ""}
      <label class="ce-skin add"><span class="ce-skin-pic plus">+</span><b>Add a ${K.one}</b><input type="file" id="ceSkinFile" accept="${skinKind === "card" || skinKind === "token" || skinKind === "endturn" ? "image/png,image/webp" : "image/*"}"${skinKind === "card" ? " multiple" : ""} hidden></label>
    </div>`;
    $("#ceForm", el).innerHTML = `<div class="ce-sec ce-skinlib${sel ? " compact" : ""}">
      <div class="ce-skinkinds">${ST.SKIN_KINDS.map((k) => `<button type="button" class="pill${k === skinKind ? " on" : ""}" data-skin-kind="${k}">${KIND_INFO[k].label}${ST.skinList(k).length ? ` (${ST.skinList(k).length})` : ""}</button>`).join("")}</div>
      <div class="ce-row ce-skinhelp">${K.template ? `<button type="button" class="pill small" id="ceSkinTpl">Download ${K.tplName}</button>` : ""}<details class="ce-more"><summary>How skins work</summary>
        <p class="ce-hint">One library for every painted asset, whatever the meta. Each meta <b>equips</b> one skin per kind (the one with the ✓), so a frame painted once can dress several metas; players also pick them from <b>Collection</b> on the main menu. Metas and cards are untouched by what you do here.</p>
        <p class="ce-hint">${K.hint}</p></details></div>
      ${grid}
      ${crop ? "" : sel ? "" : `<p class="ce-hint">No skin equipped means ${K.builtin}. Click a skin to open it; <b>Equip</b> uses it for <b>${esc(ST.meta.name)}</b>.</p>`}
    </div>
    ${crop ? `<div class="ce-sec ce-cropsec"><h3>Frame the new skin</h3>
        <div class="ce-cropbox"><div class="ce-crop-circle" id="ceSkinCrop" style="width:${CROP}px;height:${CROP}px"><img src="${crop.src}" alt="" draggable="false" id="ceSkinImg"></div>
          <div class="ce-cropctl"><label class="ce-sel wide">Name<input id="ceSkinName" value="${esc(crop.name)}" maxlength="24"></label>
            <label class="ce-sel wide">Zoom<input type="range" id="ceSkinZoom" min="1" max="4" step="0.01" value="${crop.z}"></label>
            <p class="ce-hint">Drag the picture to move it, scroll to zoom.</p>
            <div class="ce-row"><button type="button" class="pill big" id="ceSkinSave">Save skin</button><button type="button" class="pill" id="ceSkinCancel">Cancel</button></div></div>
          <div class="ce-cropprev">${keeperPreview("")}</div></div></div>` : ""}`;
    const form = $("#ceForm", el);
    if (root.WA_STUDIO && !crop && (!sel || skinKind === "table")) root.WA_STUDIO.framesExtra(skinKind, form, studioApi());
    form.querySelectorAll("[data-skin-kind]").forEach((b) => b.addEventListener("click", () => { skinKind = b.dataset.skinKind; skinSel = null; crop = null; renderSkins(); }));
    const tpl = $("#ceSkinTpl", el); if (tpl) tpl.addEventListener("click", K.template);
    form.querySelectorAll("[data-skin-pick]").forEach((b) => b.addEventListener("click", async () => {
      const id = b.dataset.skinPick;
      if (!id || id === "random") { await ST.equipSkin(skinKind, id || null); applySkins(); skinSel = null; renderMetas(); renderSkins(); status(id ? "A random bartender each game for this meta." : `${ST.meta.name} now uses ${K.builtin}.`); return; }
      skinSel = id; renderSkins();
    }));
    form.querySelectorAll("[data-skin-del]").forEach((x) => x.addEventListener("click", async () => {
      if (pending !== "skin" + x.dataset.skinDel) { pending = "skin" + x.dataset.skinDel; status("Click ✕ again to delete this skin from the library (every meta that uses it goes back to the built-in look).", "warn"); return; }
      pending = null; await ST.deleteSkin(x.dataset.skinDel); if (skinSel === x.dataset.skinDel) skinSel = null; applySkins(); renderMetas(); renderSkins(); status("Skin deleted.");
    }));
    $("#ceSkinFile", el).addEventListener("change", (e) => { const fs = [...e.target.files]; e.target.value = ""; if (fs.length > 1 && skinKind === "card") addCardFiles(fs); else if (fs[0]) addSkinFile(fs[0]); });
    if (crop) bindSkinCrop();
    if (sel) renderSkinDetail(sel, K);
    // preview column
    $("#cePvTok", el).innerHTML = "";
    if (skinKind === "bartender") { const b = ST.bartender, act = sel || (eq && eq !== "random" ? ST.skinOf("bartender") : null); $("#cePvCard", el).innerHTML = crop ? "" : keeperPreview(act ? act.src : eq === "random" && b ? b.skins[0].src : ""); $("#ceText", el).innerHTML = crop ? "" : `<b>In game:</b> ${eq === "random" ? "a random skin each game" : eq ? esc((ST.skinOf("bartender") || {}).name || "") : "the default mug"}`; }
    else if (skinKind === "table") { $("#cePvCard", el).innerHTML = ""; $("#ceText", el).innerHTML = ""; }
    else skinPreview(sel);
  }
  // one entry opened: rename, equip, variants, layout (card/token/endturn) or dim slider (table)
  function renderSkinDetail(sk, K) {
    const box = document.createElement("div"); box.className = "ce-sec ce-skindetail"; box.dataset.tab = "Frame"; const eq = ST.equipped[skinKind] === sk.id;
    box.innerHTML = `<h3><input class="ce-rename" id="ceSkinRename" value="${esc(sk.name)}" maxlength="32" aria-label="Skin name"></h3>
      ${eq || skinKind === "table" || skinKind === "bartender" ? "" : `<p class="ce-warnline">This skin is not equipped: the game still uses another look. Equip it to see your changes in play.</p>`}
      <div class="ce-row"><button type="button" class="pill big${eq ? " on" : ""}" id="ceSkinEquip">${eq ? "Equipped for " + esc(ST.meta.name) : "Equip for " + esc(ST.meta.name)}</button>${eq ? `<button type="button" class="pill" id="ceSkinUnequip">Back to built-in</button>` : ""}<button type="button" class="pill" id="ceSkinClose">Close</button></div>
      ${K.variants ? `<div class="ce-cardskins">${K.variants.map(([k, label, hint]) => `<div class="ce-cardskin k-${skinKind}"><b>${label}</b><div class="pv" ${sk[k] ? `style="background-image:url('${sk[k]}')"` : ""}>${sk[k] ? "" : "No picture"}</div>
        <label class="pill">${sk[k] ? "Replace" : "Upload"}<input type="file" data-skin-var="${k}" accept="image/png,image/webp" hidden></label>${sk[k] && k !== "normal" ? `<button type="button" class="pill danger" data-skin-var-rm="${k}">Remove</button>` : ""}<small class="ce-hint">${hint}</small></div>`).join("")}</div>` : ""}
      ${skinKind === "table" ? `<div class="ce-tablepv" style="--bg:url('${sk.src}');--dim:${sk.dim}">${showGuide ? TABLE_ZONES.map(([n, x, y, w, h, c, kind]) => `<div class="ce-zone k-${kind}${kind === "round" || kind === "combat" || (kind === "duo") ? " round" : ""}" style="left:${x * 0.5}px;top:${y * 0.5}px;width:${w * 0.5}px;height:${h * 0.5}px;--zc:${c}" title="${n}: x ${x}, y ${y}, ${w} × ${h}"><span>${n}</span></div>`).join("") : ""}</div>
        <div class="ce-tablectl"><label class="pill">Replace picture<input type="file" id="ceBgFile" accept="image/*" hidden></label><label class="ce-check small"><input type="checkbox" id="ceBgGuide" ${showGuide ? "checked" : ""}> Show the layout guide</label></div>
        <label class="ce-sel wide">Darken it so cards stay readable: <b id="ceBgDimV">${Math.round(sk.dim * 100)}%</b><input type="range" id="ceBgDim" min="0" max="80" step="5" value="${Math.round(sk.dim * 100)}"></label>` : ""}
      ${skinKind === "bartender" ? `<div class="ce-row">${keeperPreview(sk.src)}</div>` : ""}`;
    $("#ceForm", el).appendChild(box);
    let rt = 0; $("#ceSkinRename", el).addEventListener("input", (e) => { clearTimeout(rt); rt = setTimeout(async () => { await ST.renameSkin(sk.id, e.target.value); renderMetas(); form_names(); }, 300); });
    const form_names = () => { $("#ceForm", el).querySelectorAll(`[data-skin-pick="${sk.id}"] b`).forEach((b) => (b.textContent = ST.skinList(skinKind).find((e) => e.id === sk.id).name)); };
    $("#ceSkinEquip", el).addEventListener("click", async () => { await ST.equipSkin(skinKind, sk.id); applySkins(); renderMetas(); renderSkins(); status(`Equipped for ${ST.meta.name}. It shows in the next game.`); });
    const un = $("#ceSkinUnequip", el); if (un) un.addEventListener("click", async () => { await ST.equipSkin(skinKind, null); applySkins(); renderMetas(); renderSkins(); status(`${ST.meta.name} is back to ${K.builtin}.`); });
    $("#ceSkinClose", el).addEventListener("click", () => { skinSel = null; renderSkins(); });
    box.querySelectorAll("[data-skin-var]").forEach((inp) => inp.addEventListener("change", async (e) => {
      const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      try {
        const pic = await skinPicture(f), patch = { [inp.dataset.skinVar]: pic.src };
        if (inp.dataset.skinVar === "normal") { patch.layout = Object.assign({}, sk.layout && sk.w === pic.w && sk.h === pic.h ? sk.layout : K.firstLayout(pic.w, pic.h)); if (patch.layout.art) patch.layout.artBehind = await windowIsClear(pic.src, patch.layout); patch.w = pic.w; patch.h = pic.h; patch.natW = await natWidth(f); }
        await ST.updateSkin(sk.id, patch); applySkins(); renderSkins(); status("Picture saved. Check the preview and adjust the layout numbers if needed.");
      } catch (err) { status("Could not use that picture: " + (err.message || err), "err"); }
    }));
    box.querySelectorAll("[data-skin-var-rm]").forEach((b) => b.addEventListener("click", async () => { await ST.updateSkin(sk.id, { [b.dataset.skinVarRm]: null }); applySkins(); renderSkins(); status("Picture removed."); }));
    if (K.variants) {
      const L = sk.layout || K.tplLayout(sk.w || 560, sk.h || 848);
      const saveL = async (L2) => { await ST.updateSkin(sk.id, { layout: Object.assign({}, L2) }); applySkins(); skinPreview(ST.skinList(skinKind).find((e) => e.id === sk.id)); };
      if (L.art && L.artBehind == null) windowIsClear(sk.normal, L).then((clear) => { if (clear) { L.artBehind = true; saveL(L); const c = box.querySelector("#ceWsBehind"); if (c) c.checked = true; ws.refresh(); } }); // skins from before the workshop: detect once
      const form = $("#ceForm", el), wsSec = document.createElement("div"); wsSec.className = "ce-sec ce-wssec"; wsSec.dataset.tab = "Layout"; wsSec.innerHTML = `<h3>Layout</h3>`; form.appendChild(wsSec);
      const ws = renderWorkshop(wsSec, sk, K, L, saveL);
      if (skinKind === "token") { const tmp = document.createElement("div"); tmp.innerHTML = tokenGemsHTML(sk); for (const x of [...tmp.children]) { x.dataset.tab = "Gems"; form.appendChild(x); } wsSec._syncGems = bindGems(form, sk, L, saveL, ws); }
      if (skinKind === "card") { const tmp = document.createElement("div"); tmp.innerHTML = gemsHTML(sk); const tabs = { "ce-artsec": "Illustration", "ce-gemsec": "Gems", "ce-curvesec": "Text" }; for (const x of [...tmp.children]) { for (const [c, n] of Object.entries(tabs)) if (x.classList.contains(c)) x.dataset.tab = n; form.appendChild(x); } wsSec._syncGems = bindGems(form, sk, L, saveL, ws); }
      renderLayoutFields(wsSec, sk, L, { zones: K.zones, numbers: K.numbers, colours: K.colours, resets: [["Reset: template layout", () => K.tplLayout(sk.w, sk.h)], ["Reset: built-in frame layout", () => K.defLayout(sk.w, sk.h)]] },
        async (L2) => { await saveL(L2); ws.refresh(); });
      ws.inputs();
      tabify(form, "skin:" + skinKind);
    }
    if (skinKind === "table") {
      $("#ceBgFile", el).addEventListener("change", async (e) => { const f = e.target.files[0]; e.target.value = ""; if (!f) return;
        try { status("Loading picture..."); await ST.updateSkin(sk.id, { src: await tablePicture(f) }); applySkins(); renderSkins(); status("Picture replaced."); } catch (err) { status("Could not use that picture: " + (err.message || err), "err"); } });
      $("#ceBgGuide", el).addEventListener("change", (e) => { showGuide = e.target.checked; renderSkins(); });
      const sl = $("#ceBgDim", el); let t = 0;
      sl.addEventListener("input", () => { const d = +sl.value / 100; $("#ceBgDimV", el).textContent = sl.value + "%"; $(".ce-tablepv", el).style.setProperty("--dim", d); clearTimeout(t); t = setTimeout(async () => { await ST.updateSkin(sk.id, { dim: d }); applySkins(); }, 250); });
    }
  }
  const SHAPES = [["rect", "Rectangle", "▭"], ["arch", "Arch", "⌓"], ["oval", "Oval", "⬭"], ["circle", "Circle", "◯"], ["hexagon", "Hexagon", "⬡"], ["octagon", "Octagon", "⯃"], ["shield", "Shield", "⛉"], ["diamond", "Diamond", "◇"], ["mask", "Mask", "✂"]];
  // a font picker for skins: the interface font, the listed fonts (shown in their own face) or your imported one
  function fontSel(k, label, L, body) {
    const S = root.WA_STYLE, th = (S && S.cfg && S.cfg.theme) || {}, cur = L[k] || "";
    if (S && S.ensureFonts) S.ensureFonts([cur]);
    const list = S ? (body ? S.FONTS_BODY.concat(S.FONTS_DISPLAY) : S.FONTS_DISPLAY.concat(S.FONTS_BODY)) : [];
    const opts = [["", body ? "Interface text font" : "Interface title font"], ...(th.font && th.font.data ? [["__upload", "Your imported font"]] : []), ...[...new Set(list)].map((f) => [f, f])];
    return `<label class="ce-sel wide">${label}<select data-gf="${k}">${opts.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}${v && v !== "__upload" ? ` style="font-family:'${esc(v)}'"` : ""}>${esc(l)}</option>`).join("")}</select></label>`;
  }
  // tokens: attack and health gems painted apart, a plate behind the tier stars, the numbers' size, colour and font
  const TOKEN_GEMS = [["gemAtk", "atk", "Attack gem"], ["gemHp", "hp", "Health gem"], ["gemTier", "stars", "Plate behind the tier stars"]];
  function tokenGemsHTML(sk) {
    const L = sk.layout || {}, rng = (k, label, min, max, def, unit) => `<label class="ce-sel wide">${label} <b data-gv="${k}">${L[k] == null ? def : L[k]}${unit}</b><input type="range" data-gr="${k}" min="${min}" max="${max}" step="1" value="${L[k] == null ? def : L[k]}"></label>`;
    const gmax = Math.round(Math.max(sk.w || 496, 200) * 0.5);
    return `<div class="ce-sec ce-gemsec"><h3>Gems</h3>
      <p class="ce-hint">Paint the gems apart from the frame (PNG with transparency): the attack and health gems, and a plate the tier stars sit on. Place the two gems with the sliders, or drag them on the token in the Layout tab; the plate takes the place of the star strip. A gem exported on a canvas the size of the frame keeps its spot; empty edges are cut away.</p>
      <div class="ce-gems">${TOKEN_GEMS.map(([key, zone, label]) => `<div class="ce-gem"><b>${label}</b><div class="gpv"${sk[key] ? ` style="background-image:url('${sk[key]}')"` : ""}>${sk[key] ? "" : "Painted on the frame"}</div>
        ${zone === "stars" ? "" : [["2", "Size", 10, gmax], ["0", "Left ↔ right", 0, sk.w || 496], ["1", "Up ↕ down", 0, sk.h || 616]].map(([i, lab, mn, mx]) => `<label class="ce-sel wide">${lab} <b data-gsv="${zone}:${i}">${(L[zone] || [0, 0, 0])[+i]}</b><input type="range" data-gsz="${zone}:${i}" min="${mn}" max="${mx}" step="1" value="${(L[zone] || [0, 0, 0])[+i]}"></label>`).join("")}
        <div class="ce-row"><label class="pill small">${sk[key] ? "Replace" : "Import"}<input type="file" data-gem="${key}" accept="image/png,image/webp" hidden></label>${sk[key] ? `<button type="button" class="pill small danger" data-gem-rm="${key}">Remove</button>` : ""}</div></div>`).join("")}</div>
      <div class="ce-row"><label class="pill">Import the gems at once<input type="file" id="ceGemsAll" accept="image/png,image/webp" multiple hidden></label><small class="ce-hint">Named attack / health / tier (or atk, hp, star, attaque, vie, niveau…), otherwise in that order.</small></div>
      <div class="st-grid2">${rng("gemNum", "Size of the numbers", 40, 180, 100, "%")}${rng("numDy", "Move the numbers up / down", -80, 80, 0, " px")}</div>
      <div class="st-cols ce-textcols"><label class="st-col"><input type="color" data-gc="numColor" value="${esc(L.numColor || "#ffffff")}"><span>Numbers</span></label></div>
      <div class="st-grid2 ce-fonts">${fontSel("numFont", "Font of the numbers", L)}</div></div>`;
  }
  function gemsHTML(sk) {
    const L = sk.layout || {}, rng = (k, label, min, max, def, unit) => `<label class="ce-sel wide">${label} <b data-gv="${k}">${L[k] == null ? def : L[k]}${unit}</b><input type="range" data-gr="${k}" min="${min}" max="${max}" step="1" value="${L[k] == null ? def : L[k]}"></label>`;
    const gmax = Math.round(Math.max(sk.w || 560, 200) * 0.45), col = (k, label, def) => `<label class="st-col"><input type="color" data-gc="${k}" value="${esc(L[k] || def)}"><span>${label}</span></label>`;
    const shape = L.artShape || "rect";
    return `<div class="ce-sec ce-artsec"><h3>Illustration</h3>
      <p class="ce-hint">The shape of the picture window, so the illustration never spills out of the frame. Best: <b>cut it out from the frame</b> (the window of your frame must be transparent), or import your own mask (white or opaque = shown).</p>
      <div class="ce-shapes">${SHAPES.map(([k, label, ic]) => `<button type="button" class="ce-shape${shape === k ? " on" : ""}" data-shape="${k}"${k === "mask" && !sk.artMask ? " disabled" : ""}><i>${ic}</i><span>${label}</span></button>`).join("")}</div>
      <div class="ce-row"><button type="button" class="pill" id="ceArtCut">✂ Cut it out from the frame</button><label class="pill">Import a mask<input type="file" id="ceArtMask" accept="image/png,image/webp" hidden></label>${sk.artMask ? `<button type="button" class="pill danger" id="ceArtMaskRm">Remove the mask</button>` : ""}</div>
      <div class="st-grid2">${rng("radius", "Rounded corners", 0, Math.round((sk.w || 560) * 0.3), 0, " px")}<label class="ce-check"><input type="checkbox" id="ceArtBehind2" ${L.artBehind ? "checked" : ""}> Illustration behind the frame</label></div></div>
      <div class="ce-sec ce-gemsec"><h3>Gems</h3>
      <p class="ce-hint">Paint the three gems apart from the frame (PNG with transparency). Place them with the sliders, or drag them on the card in the workshop below. A gem exported on a canvas the size of the frame keeps its spot; empty edges are cut away.</p>
      <div class="ce-gems">${GEM_KEYS.map(([key, zone, label]) => `<div class="ce-gem"><b>${label}</b><div class="gpv"${sk[key] ? ` style="background-image:url('${sk[key]}')"` : ""}>${sk[key] ? "" : "Painted on the frame"}</div>
        ${[["2", "Size", 16, gmax], ["0", "Left ↔ right", 0, sk.w || 560], ["1", "Up ↕ down", 0, sk.h || 848]].map(([i, lab, mn, mx]) => `<label class="ce-sel wide">${lab} <b data-gsv="${zone}:${i}">${(L[zone] || [0, 0, 0])[+i]}</b><input type="range" data-gsz="${zone}:${i}" min="${mn}" max="${mx}" step="1" value="${(L[zone] || [0, 0, 0])[+i]}"></label>`).join("")}
        <div class="ce-row"><label class="pill small">${sk[key] ? "Replace" : "Import"}<input type="file" data-gem="${key}" accept="image/png,image/webp" hidden></label>${sk[key] ? `<button type="button" class="pill small danger" data-gem-rm="${key}">Remove</button>` : ""}</div></div>`).join("")}</div>
      <div class="ce-row"><label class="pill">Import the 3 gems at once<input type="file" id="ceGemsAll" accept="image/png,image/webp" multiple hidden></label><small class="ce-hint">Named attack / health / tier (or atk, hp, cost, attaque, vie, coût…), otherwise in that order.</small></div>
      <div class="st-grid2">${rng("gemNum", "Size of the numbers", 40, 180, 100, "%")}${rng("numDy", "Move the numbers up / down", -80, 80, 0, " px")}</div></div>
      <div class="ce-sec ce-curvesec"><h3>Text</h3>
      <div class="st-cols ce-textcols">${col("nameColor", "Name", "#f7e9c8")}${col("textColor", "Card text", "#f0e6d2")}${col("tribeColor", "Tribe line", "#d9a65a")}${col("kwColor", "Keywords", "#ffd98a")}${col("numColor", "Numbers", "#ffffff")}</div>
      <div class="st-grid2 ce-fonts">${fontSel("nameFont", "Font of the name and tribe line", L)}${fontSel("textFont", "Font of the card text", L, true)}${fontSel("numFont", "Font of the numbers", L)}</div>
      <p class="ce-hint">Bend the name and the tribe line along an arc, to follow a curved plate. Right bends up, left bends down.</p>
      <div class="st-grid2">${rng("nameCurve", "Name curve", -100, 100, 0, "")}${rng("tribeCurve", "Tribe line curve", -100, 100, 0, "")}</div></div>`;
  }
  // canvas helpers for masks
  const loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("not an image")); im.src = src; });
  const canvasBlob = (c) => new Promise((res) => c.toBlob((b) => res(ST.urlOf(b)), "image/png"));
  // the frame's transparent window, filled from the picture's centre: the mask of the illustration (a little larger, so it tucks under the frame's edge)
  async function frameWindowMask(sk, L) {
    const im = await loadImg(sk.normal), W = sk.w, H = sk.h, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"); g.drawImage(im, 0, 0, W, H);
    const A = g.getImageData(0, 0, W, H).data, open = (i) => A[i * 4 + 3] < 128, mark = new Uint8Array(W * H);
    const a = L.art || [W / 4, H / 4, W / 2, H / 2]; let sx = Math.round(a[0] + a[2] / 2), sy = Math.round(a[1] + a[3] / 2);
    if (!open(sy * W + sx)) { let found = false; for (let r = 4; r < Math.min(W, H) / 4 && !found; r += 4) for (let t = 0; t < 16 && !found; t++) { const x = Math.round(sx + Math.cos(t * Math.PI / 8) * r), y = Math.round(sy + Math.sin(t * Math.PI / 8) * r); if (x > 0 && y > 0 && x < W && y < H && open(y * W + x)) { sx = x; sy = y; found = true; } } if (!found) return { err: "closed" }; }
    const st = new Int32Array(W * H); let n = 0, leak = false; st[n++] = sy * W + sx; mark[sy * W + sx] = 1;
    while (n) { const i = st[--n], x = i % W, y = (i - x) / W; if (x === 0 || y === 0 || x === W - 1 || y === H - 1) leak = true;
      if (x > 0 && !mark[i - 1] && open(i - 1)) { mark[i - 1] = 1; st[n++] = i - 1; } if (x < W - 1 && !mark[i + 1] && open(i + 1)) { mark[i + 1] = 1; st[n++] = i + 1; }
      if (y > 0 && !mark[i - W] && open(i - W)) { mark[i - W] = 1; st[n++] = i - W; } if (y < H - 1 && !mark[i + W] && open(i + W)) { mark[i + W] = 1; st[n++] = i + W; } }
    if (leak) return { err: "leak" };
    // grow it a little (separable square dilation)
    const R = Math.max(2, Math.round(W * 0.01)), tmp = new Uint8Array(W * H), out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) { let run = -1e9; for (let x = 0; x < W; x++) { if (mark[y * W + x]) run = x; if (x - run <= R) tmp[y * W + x] = 1; } run = 1e9; for (let x = W - 1; x >= 0; x--) { if (mark[y * W + x]) run = x; if (run - x <= R) tmp[y * W + x] = 1; } }
    for (let x = 0; x < W; x++) { let run = -1e9; for (let y = 0; y < H; y++) { if (tmp[y * W + x]) run = y; if (y - run <= R) out[y * W + x] = 1; } run = 1e9; for (let y = H - 1; y >= 0; y--) { if (tmp[y * W + x]) run = y; if (run - y <= R) out[y * W + x] = 1; } }
    let x0 = W, y0 = H, x1 = -1, y1 = -1; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (out[y * W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, m = document.createElement("canvas"); m.width = bw; m.height = bh; const mg = m.getContext("2d"), md = mg.createImageData(bw, bh);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const o = (y * bw + x) * 4; md.data[o] = md.data[o + 1] = md.data[o + 2] = 255; md.data[o + 3] = out[(y + y0) * W + x + x0] ? 255 : 0; }
    mg.putImageData(md, 0, 0);
    const k = Math.min(1, 600 / Math.max(bw, bh)), s2 = document.createElement("canvas"); s2.width = Math.max(1, Math.round(bw * k)); s2.height = Math.max(1, Math.round(bh * k)); s2.getContext("2d").drawImage(m, 0, 0, s2.width, s2.height);
    return { src: await canvasBlob(s2), box: [x0, y0, bw, bh] };
  }
  // a mask the person painted: transparency, or black and white when it has none; cropped; placed when it is the frame's size
  async function maskPicture(file, sk) {
    const u = URL.createObjectURL(file), im = await loadImg(u); URL.revokeObjectURL(u);
    const W = im.naturalWidth, H = im.naturalHeight, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, W, H), p = d.data; let opaque = true; for (let i = 3; i < p.length; i += 4) if (p[i] < 250) { opaque = false; break; }
    for (let i = 0; i < p.length; i += 4) { const a = opaque ? Math.round(p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) : p[i + 3]; p[i] = p[i + 1] = p[i + 2] = 255; p[i + 3] = a; }
    g.putImageData(d, 0, 0);
    let x0 = W, y0 = H, x1 = -1, y1 = -1; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (p[(y * W + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) throw new Error("the mask is empty");
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, k = Math.min(1, 600 / Math.max(bw, bh)), o = document.createElement("canvas"); o.width = Math.max(1, Math.round(bw * k)); o.height = Math.max(1, Math.round(bh * k)); o.getContext("2d").drawImage(c, x0, y0, bw, bh, 0, 0, o.width, o.height);
    const nat = sk.natW || 0, r = nat ? sk.w / nat : 1; let box = null;
    if (nat && Math.abs(W - nat) <= 2) box = [Math.round(x0 * r), Math.round(y0 * r), Math.round(bw * r), Math.round(bh * r)];
    else if (Math.abs(W - sk.w) <= 2 && Math.abs(H - sk.h) <= 2) box = [x0, y0, bw, bh];
    return { src: await canvasBlob(o), box };
  }
  function bindGems(box, sk, L, saveL, ws) {
    let t = 0; const later = () => { ws.refresh(); clearTimeout(t); t = setTimeout(() => saveL(L), 120); };
    box.querySelectorAll("[data-gr]").forEach((r) => r.addEventListener("input", () => { const k = r.dataset.gr, unit = k === "gemNum" ? "%" : k === "numDy" || k === "radius" ? " px" : ""; L[k] = +r.value; box.querySelector(`[data-gv="${k}"]`).textContent = r.value + unit; later(); }));
    box.querySelectorAll("[data-gsz]").forEach((r) => r.addEventListener("input", () => { const [z, i] = r.dataset.gsz.split(":"); if (!L[z]) return; L[z][+i] = +r.value; box.querySelector(`[data-gsv="${z}:${i}"]`).textContent = r.value; later(); }));
    const sync = () => box.querySelectorAll("[data-gsz]").forEach((r) => { const [z, i] = r.dataset.gsz.split(":"); if (!L[z]) return; r.value = L[z][+i]; const b = box.querySelector(`[data-gsv="${z}:${i}"]`); if (b) b.textContent = L[z][+i]; });
    box.querySelectorAll("[data-gc]").forEach((c) => c.addEventListener("input", () => { const k = c.dataset.gc; L[k] = c.value;
      if (k === "kwColor") L.kwOwn = true;
      if (k === "textColor" && !L.kwOwn) { L.kwColor = c.value; const kc = box.querySelector('[data-gc="kwColor"]'); if (kc) kc.value = c.value; }
      later(); }));
    box.querySelectorAll("[data-gf]").forEach((c) => c.addEventListener("change", () => { const k = c.dataset.gf; if (c.value) L[k] = c.value; else delete L[k]; if (root.WA_STYLE && root.WA_STYLE.ensureFonts) root.WA_STYLE.ensureFonts([c.value]); c.style.fontFamily = c.value && c.value !== "__upload" ? `'${c.value}'` : ""; later(); }));
    box.querySelectorAll("[data-shape]").forEach((b) => b.addEventListener("click", () => { L.artShape = b.dataset.shape; box.querySelectorAll("[data-shape]").forEach((x) => x.classList.toggle("on", x === b)); later(); }));
    const bh = box.querySelector("#ceArtBehind2"); if (bh) bh.addEventListener("change", () => { L.artBehind = bh.checked; const o = box.querySelector("#ceWsBehind"); if (o) o.checked = bh.checked; later(); });
    const cut = box.querySelector("#ceArtCut"); if (cut) cut.addEventListener("click", async () => {
      status("Looking for the frame's window...");
      try { const r = await frameWindowMask(sk, L);
        if (r.err) { status(r.err === "leak" ? "The window of this frame is open to the outside: close it, or pick a shape or import a mask." : "The picture window of this frame is not transparent: make it transparent, or pick a shape or import a mask.", "warn"); return; }
        L.art = r.box; L.artShape = "mask"; L.artBehind = true; await saveL(L); await ST.updateSkin(sk.id, { artMask: r.src }); applySkins(); renderSkins(); status("Cut out: the illustration now follows the frame's window.");
      } catch (err) { status("Could not read the frame: " + (err.message || err), "err"); } });
    const mk = box.querySelector("#ceArtMask"); if (mk) mk.addEventListener("change", async (e) => { const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      try { const r = await maskPicture(f, sk); if (r.box) L.art = r.box; L.artShape = "mask"; await saveL(L); await ST.updateSkin(sk.id, { artMask: r.src }); applySkins(); renderSkins(); status(r.box ? "Mask imported and placed." : "Mask imported: it takes the size of the picture zone; move or resize the illustration layer to fit."); }
      catch (err) { status("Could not use that picture: " + (err.message || err), "err"); } });
    const mr = box.querySelector("#ceArtMaskRm"); if (mr) mr.addEventListener("click", async () => { if (L.artShape === "mask") L.artShape = "rect"; await saveL(L); await ST.updateSkin(sk.id, { artMask: null }); applySkins(); renderSkins(); status("Mask removed."); });
    const after = (n) => { applySkins(); renderSkins(); status(n ? `${n} gem${n > 1 ? "s" : ""} imported: move ${n > 1 ? "them" : "it"} in the workshop if needed.` : "No gem imported.", n ? "" : "warn"); };
    box.querySelectorAll("[data-gem]").forEach((inp) => inp.addEventListener("change", async (e) => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; try { await saveL(L); after(await applyGemFiles(sk.id, { [inp.dataset.gem]: f })); } catch (err) { status("Could not use that picture: " + (err.message || err), "err"); } }));
    const all = box.querySelector("#ceGemsAll"); if (all) all.addEventListener("change", async (e) => { const fs = [...e.target.files]; e.target.value = ""; if (!fs.length) return; const gems = {}, free = [];
      for (const f of fs) { const g = gemOfName(f.name); if (g && !gems[g]) gems[g] = f; else free.push(f); } for (const [g] of GEM_KEYS) if (!gems[g] && free.length) gems[g] = free.shift();
      try { await saveL(L); after(await applyGemFiles(sk.id, gems)); } catch (err) { status("Could not use that picture: " + (err.message || err), "err"); } });
    box.querySelectorAll("[data-gem-rm]").forEach((b) => b.addEventListener("click", async () => { await saveL(L); await ST.updateSkin(sk.id, { [b.dataset.gemRm]: null }); applySkins(); renderSkins(); status("Gem removed: the frame's own painting shows again."); }));
    return sync;
  }
  // a new file for the open kind: tables are cropped to fill, frames keep their pixels, bartenders go through the circle crop
  async function addSkinFile(f) {
    const K = KIND_INFO[skinKind], name = f.name.replace(/\.[^.]+$/, "").slice(0, 24) || K.one;
    try {
      if (skinKind === "bartender") {
        const url = URL.createObjectURL(f), im = new Image();
        im.onload = () => { const c = document.createElement("canvas"), m = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)); c.width = Math.round(im.naturalWidth * m); c.height = Math.round(im.naturalHeight * m); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
          crop = { src: c.toDataURL("image/png"), w: c.width, h: c.height, z: 1, x: 0, y: 0, name }; skinSel = null; renderSkins(); };
        im.onerror = () => { URL.revokeObjectURL(url); status("That file is not a picture.", "err"); };
        im.src = url; return;
      }
      status("Loading picture...");
      let id;
      if (skinKind === "table") id = await ST.addSkin("table", name, { src: await tablePicture(f), dim: 0.35 });
      else { const pic = await skinPicture(f), layout = K.firstLayout(pic.w, pic.h); if (layout.art) layout.artBehind = await windowIsClear(pic.src, layout); id = await ST.addSkin(skinKind, name, { normal: pic.src, w: pic.w, h: pic.h, natW: await natWidth(f), layout }); }
      await ST.equipSkin(skinKind, id); applySkins(); skinSel = id; renderMetas(); renderSkins(); status(`Skin added and equipped for ${ST.meta.name}.`);
    } catch (err) { status("Could not use that picture: " + (err.message || err), "err"); }
  }
  // the frame and its gems picked together
  async function addCardFiles(fs) {
    const { frame, gems } = await sortCardFiles(fs);
    await addSkinFile(frame); const id = skinSel; if (!id) return;
    try { const n = await applyGemFiles(id, gems, frame); applySkins(); renderSkins(); status(`Frame and ${n} gem${n > 1 ? "s" : ""} added and equipped for ${ST.meta.name}. Move the gems in the workshop if needed.`); }
    catch (err) { status("Could not use a gem picture: " + (err.message || err), "err"); }
  }
  // ---------------------------------------------------------------- bartender skins (looks only)
  let crop = null; // picture being framed: { src, w, h, z, x, y, name }
  const CROP = 220;
  function keeperPreview(src) {
    return `<div class="ce-keeper"><div class="keeper${src ? " has-skin" : ""}">${src ? `<div class="keeper-skin" style="background-image:url('${src}')"></div>` : ART.INNKEEPER}</div><div class="keeper-plate">Tavern Tier 1</div></div>`;
  }
  function placeSkin() {
    const im = $("#ceSkinImg", el); if (!im) return;
    const base = Math.max(CROP / crop.w, CROP / crop.h) * crop.z, w = crop.w * base, h = crop.h * base;
    crop.x = Math.min(0, Math.max(CROP - w, crop.x)); crop.y = Math.min(0, Math.max(CROP - h, crop.y));
    im.style.width = w + "px"; im.style.height = h + "px"; im.style.transform = `translate(${crop.x}px, ${crop.y}px)`;
    const pv = el.querySelector(".ce-cropprev .keeper");
    if (pv) { pv.classList.add("has-skin"); const k = 104 / CROP; pv.innerHTML = `<div class="keeper-skin" style="background-image:url('${crop.src}');background-size:${w * k}px ${h * k}px;background-position:${crop.x * k}px ${crop.y * k}px"></div>`; }
  }
  function bindSkinCrop() {
    const box = $("#ceSkinCrop", el), zoom = $("#ceSkinZoom", el);
    // first time: centre the picture
    if (crop.x === 0 && crop.y === 0) { const base = Math.max(CROP / crop.w, CROP / crop.h); crop.x = (CROP - crop.w * base) / 2; crop.y = (CROP - crop.h * base) / 2; }
    placeSkin();
    const zoomTo = (z) => { const old = Math.max(CROP / crop.w, CROP / crop.h) * crop.z, nz = Math.max(1, Math.min(4, z)), nw = Math.max(CROP / crop.w, CROP / crop.h) * nz;
      // keep the centre of the circle fixed
      const cx = (CROP / 2 - crop.x) / old, cy = (CROP / 2 - crop.y) / old; crop.z = nz; crop.x = CROP / 2 - cx * nw; crop.y = CROP / 2 - cy * nw; zoom.value = nz; placeSkin(); };
    zoom.addEventListener("input", () => zoomTo(+zoom.value));
    box.addEventListener("wheel", (e) => { e.preventDefault(); zoomTo(crop.z * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); }, { passive: false });
    box.addEventListener("pointerdown", (e) => {
      e.preventDefault(); box.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY, ox = crop.x, oy = crop.y, sc = box.getBoundingClientRect().width / CROP;
      const mv = (ev) => { crop.x = ox + (ev.clientX - sx) / sc; crop.y = oy + (ev.clientY - sy) / sc; placeSkin(); };
      const up = () => { box.removeEventListener("pointermove", mv); box.removeEventListener("pointerup", up); box.removeEventListener("pointercancel", up); };
      box.addEventListener("pointermove", mv); box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up);
    });
    $("#ceSkinName", el).addEventListener("input", (e) => (crop.name = e.target.value));
    $("#ceSkinCancel", el).addEventListener("click", () => { crop = null; renderSkins(); });
    $("#ceSkinSave", el).addEventListener("click", async () => {
      const N = 512, k = N / CROP, base = Math.max(CROP / crop.w, CROP / crop.h) * crop.z;
      const c = document.createElement("canvas"); c.width = c.height = N;
      const im = new Image(); im.src = crop.src; await im.decode();
      const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(im, crop.x * k, crop.y * k, crop.w * base * k, crop.h * base * k);
      const id = await ST.addSkin("bartender", (crop.name || "Bartender").trim().slice(0, 24), { src: c.toDataURL("image/jpeg", 0.9) });
      await ST.equipSkin("bartender", id); crop = null; applySkins();
      renderMetas(); renderSkins(); status("Skin saved and equipped for this meta.");
    });
  }
  // ---- affinities of the meta: the stored settings (cfg) and the rows of the panel
  const affCfg = () => JSON.parse(JSON.stringify(ST.affinities || {}));
  const affHidden = () => W.AFF_BUILTIN.filter((k) => (ST.affinities || {})[k] && ST.affinities[k].deleted);
  // ---- the affinities overview (Tribes & affinities): their order, and how badges sit on cards and minions
  const POS_NAME = { tl: "Top left", tr: "Top right", bl: "Bottom left", br: "Bottom right", left: "Left side", right: "Right side", top: "Top", bottom: "Bottom", name: "Above the name" };
  const FRAME_NAME = { none: "No frame", ring: "Coloured ring", gold: "Gold", silver: "Silver", gem: "Gem", shield: "Shield" };
  function badgeHTML(w) {
    const B = W.AFF_BADGE[w], g = [["tl", "top", "tr"], ["left", "name", "right"], ["bl", "bottom", "br"]];
    return `<div class="ce-badgeset" data-bw="${w}"><h4>${w === "card" ? "On cards (hand, tavern tooltip)" : "On minions (board and tavern)"}</h4>
      <div class="ce-badgegrid"><div class="ce-posgrid ${w}">${g.flat().map((p) => `<button type="button" class="${B.pos === p ? "on" : ""}" data-bpos="${p}" title="${POS_NAME[p]}"><i></i></button>`).join("")}</div>
      <div class="ce-badgectl">
        <label class="ce-f wide"><span>Size <b>${B.size}px</b></span><input type="range" data-bd="size" min="14" max="72" step="1" value="${B.size}"></label>
        <div class="ce-chips">${W.BADGE_FRAMES.map((f) => `<label class="ce-chip"><input type="radio" name="ceBdFrame_${w}" data-bd="frame" value="${f}" ${B.frame === f ? "checked" : ""}><span>${FRAME_NAME[f]}</span></label>`).join("")}</div>
        <div class="ce-chips"><label class="ce-chip"><input type="radio" name="ceBdDir_${w}" data-bd="dir" value="col" ${B.dir !== "row" ? "checked" : ""}><span>Stacked</span></label><label class="ce-chip"><input type="radio" name="ceBdDir_${w}" data-bd="dir" value="row" ${B.dir === "row" ? "checked" : ""}><span>Side by side</span></label><label class="ce-check small"><input type="checkbox" data-bd="glow" ${B.glow ? "checked" : ""}> Coloured glow</label></div>
        <div class="ce-grid"><label class="ce-f"><span>Nudge ↔ <b>${B.dx}</b></span><input type="range" data-bd="dx" min="-40" max="40" value="${B.dx}"></label><label class="ce-f"><span>Nudge ↕ <b>${B.dy}</b></span><input type="range" data-bd="dy" min="-40" max="40" value="${B.dy}"></label></div>
      </div></div></div>`;
  }
  function affOverviewHTML() {
    const hidden = W.AFF_BUILTIN.filter((k) => (ST.affinities || {})[k] && ST.affinities[k].deleted);
    return `<div class="ce-sec ce-affset"><h3>Affinities in ${esc(ST.meta.name)}</h3>
      <p class="ce-hint">A minion carries up to two affinities, on top of its tribe. Click one to open it in the affinity studio (name, badge, levels, mechanic, level effects). Drag them to change their order.</p>
      <div class="ce-afforder">${W.AFFS.map((a, i) => `<button type="button" class="ce-affchip" draggable="true" data-aid="${esc(a)}" style="--ac:${esc(W.AFF[a].color || "#c9a24a")}"><em>${i + 1}</em><img src="${esc(W.affIcon(a))}" alt=""><span><b>${esc(W.affName(a))}</b><small>${esc(W.affMech(a))}</small></span></button>`).join("")}</div>
      <div class="ce-row"><button type="button" class="pill" id="ceAffAdd">+ New affinity</button><button type="button" class="pill" id="ceAffReset">Back to the defaults</button><span class="ce-hint" id="ceAffMsg"></span></div>
      ${hidden.length ? `<p class="ce-hint">Hidden: ${hidden.map((k) => `<button type="button" class="ce-mini" data-aff-restore="${k}">${esc(W.AFF_BASE[k].name)} ↺</button>`).join(" ")}</p>` : ""}</div>
      <div class="ce-sec ce-affset"><h3>Affinity badges</h3>
      <p class="ce-hint">How the affinity badges show on cards and on minions, for the whole meta. The preview on the right follows your changes.</p>
      ${badgeHTML("card")}${badgeHTML("token")}
      <div class="ce-row"><button type="button" class="pill small" id="ceBadgeReset">Default badges</button></div></div>`;
  }
  // a minion with two affinities, to show the badges
  function badgePreview() {
    const pc = $("#cePvCard", el), pt = $("#cePvTok", el); if (!pc || !helpers.makeCard) return;
    const id = Object.keys(W.CARDS).find((k) => (W.CARDS[k].aff || []).length === 2 && W.CARDS[k].inPool !== false) || Object.keys(W.CARDS)[0]; if (!id) return;
    const d = new W.Minion(id).dict(); if ((d.aff || []).length < 2) d.aff = W.AFFS.slice(0, 2);
    pc.innerHTML = ""; pt.innerHTML = ""; pc.appendChild(helpers.makeCard(d)); pt.appendChild(helpers.makeToken(d, { static: true, tier: true }));
    if (root.WA_FIT_CARDS) root.WA_FIT_CARDS(pc);
  }
  // a picture for an affinity: square-cropped, 128 px, WebP
  function affIconFromFile(file) {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => { const S = 128, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d"); const k = Math.min(im.width, im.height); g.drawImage(im, (im.width - k) / 2, (im.height - k) / 2, k, k, 0, 0, S, S); res(c.toDataURL("image/webp", 0.9)); }; im.onerror = rej; im.src = URL.createObjectURL(file); });
  }
  function renderTribes() {
    const list = tdraft = tdraft || tribeList();
    cur = null; curKey = ""; renderList();
    $("#cePvCard", el).innerHTML = ""; $("#cePvTok", el).innerHTML = ""; $("#ceText", el).innerHTML = "";
    const colorOf = (t) => t.color || (ART.TRIBE_HUE[t.id] || "#a08a64");
    $("#ceForm", el).innerHTML = `<div class="ce-sec"><h3>Tribes in ${esc(ST.meta.name)}</h3>
      <p class="ce-hint">Each lobby uses up to 5 of these tribes, picked among those that have cards. Renaming a tribe changes it everywhere in this meta.
      Deleting a built-in tribe removes its built-in cards from this meta; your own cards of that tribe become Neutral.</p>
      <div class="ce-tribes">${list.map((t, i) => `<div class="ce-tribe" data-ti="${i}" data-tribe="${esc(t.id)}" style="--tribe:${colorOf(t)}">
        <label class="ce-swatch" title="Colour"><input type="color" data-tk="color" value="${colorOf(t)}"></label>
        <details class="ce-iconpick"><summary title="Icon">${t.icon ? ART.glyphIcon(t.icon) : ART.tribeIcon(t.id) || ART.glyphIcon("")}</summary>
          <div class="ce-icons">${(W.BASE_TRIBES.includes(t.id) ? [""] : []).concat(ART.ICON_KEYS).map((k) => `<button type="button" class="ce-iconbtn${(t.icon || "") === k ? " on" : ""}" data-icon="${k}" title="${k || "original"}">${k ? ART.glyphIcon(k) : ART.tribeIcon(t.id)}</button>`).join("")}</div></details>
        <input type="text" class="ce-tname" data-tk="name" value="${esc(t.name || t.id)}" maxlength="18" aria-label="Tribe name">
        <input type="text" class="ce-tblurb" data-tk="blurb" value="${esc(t.blurb || "")}" maxlength="120" placeholder="${esc(W.TRIBE_BLURB[t.id] || "What this tribe is about (shown in tooltips)")}">
        <span class="ce-tcount">${cardsOfTribe(t.id)} cards</span>
        <button type="button" class="ce-mini del" data-tdel="${i}" title="Delete this tribe">✕</button></div>`).join("") || `<div class="ce-empty">No tribes yet. Every card is Neutral until you add one.</div>`}</div>
      <button type="button" class="pill ce-add" id="ceAddTribe">+ New tribe</button></div>
      ${W.affOn() ? affOverviewHTML() : `<div class="ce-sec ce-affset"><h3>Affinities</h3><p class="ce-hint">Affinities are turned off in this meta: the game stays simple. Turn them on in <b>Rules</b> (left) to give minions affinities, levels and mechanics.</p></div>`}`;
    const box = $("#ceForm", el);
    const affSave = async (cfg, rerender) => {
      if (ST.saveAffinities) await ST.saveAffinities(cfg);
      const msg = $("#ceAffMsg", el); if (msg) msg.textContent = Object.keys(cfg || {}).length ? "Saved for this meta." : "Default values.";
      if (rerender) { const sc = box.scrollTop; renderTribes(); box.scrollTop = sc; renderList(); }
    };
    badgePreview();
    // badge settings: live on the preview, saved a moment later
    box._bdField = (e) => {
      const t = e.target, k = t.dataset.bd, w = t.closest("[data-bw]") && t.closest("[data-bw]").dataset.bw; if (!k || !w) return;
      if (t.type === "radio" && !t.checked) return;
      const b = JSON.parse(JSON.stringify(W.AFF_BADGE)); b[w][k] = t.type === "checkbox" ? t.checked : t.type === "range" ? +t.value : t.value;
      W.setBadge(b); badgePreview();
      if (t.type === "range") { const lb = t.parentElement.querySelector("b"); if (lb) lb.textContent = k === "size" ? t.value + "px" : t.value; }
      clearTimeout(affTimer); affTimer = setTimeout(() => { const cfg = affCfgNow(); cfg.badge = JSON.parse(JSON.stringify(W.AFF_BADGE)); affSave(cfg, false); }, e.type === "change" ? 0 : 350);
    };
    box._affClick = async (e) => {
      const t = e.target;
      const pb = t.closest("[data-bpos]");
      if (pb) { const w = pb.closest("[data-bw]").dataset.bw, b = JSON.parse(JSON.stringify(W.AFF_BADGE)); b[w].pos = pb.dataset.bpos; W.setBadge(b); const cfg = affCfgNow(); cfg.badge = b; await affSave(cfg, true); return; }
      if (t.id === "ceBadgeReset") { const cfg = affCfgNow(); delete cfg.badge; W.setBadge(null); await affSave(cfg, true); return; }
      if (t.id === "ceAffReset" && ST.saveAffinities) { if (pending !== "affreset") { pending = "affreset"; status("Click again: every affinity goes back to its defaults and your own affinities are deleted.", "warn"); return; } pending = null; clearTimeout(affTimer); await affSave(null, true); clearTimeout(affTimer); return; }
      if (t.id === "ceAffAdd") { view = "card"; renderMetas(); startNew("affinity"); return; }
      if (t.dataset.affRestore) { const cfg = affCfgNow(); if (cfg[t.dataset.affRestore]) delete cfg[t.dataset.affRestore].deleted; await affSave(cfg, true); return; }
      const chip = t.closest("[data-aid]");
      if (chip && !box._dragged) { const id = chip.dataset.aid; view = "card"; renderMetas(); await select("affinity|" + id); }
    };
    // drag the chips to re-order the affinities
    box._affDrag = (e) => {
      const chip = e.target.closest && e.target.closest("[data-aid]"); if (!chip && e.type !== "dragend") return;
      if (e.type === "dragstart") { box._dragId = chip.dataset.aid; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", chip.dataset.aid); } catch (x) {} chip.classList.add("dragging"); }
      else if (e.type === "dragover") { e.preventDefault(); for (const c of box.querySelectorAll(".ce-affchip.over")) c.classList.remove("over"); chip.classList.add("over"); }
      else if (e.type === "drop") {
        e.preventDefault(); const from = box._dragId, to = chip.dataset.aid; box._dragId = null; if (!from || from === to) return;
        const l = W.AFFS.slice(); l.splice(l.indexOf(from), 1); l.splice(l.indexOf(to) + (l.indexOf(to) >= W.AFFS.indexOf(from) ? 1 : 0), 0, from);
        const cfg = affCfgNow(); cfg.order = l; affSave(cfg, true);
      } else if (e.type === "dragend") { for (const c of box.querySelectorAll(".ce-affchip")) c.classList.remove("over", "dragging"); }
    };
    if (!box._affBound2) {
      box._affBound2 = true;
      box.addEventListener("input", (e) => { if (view === "tribes" && e.target.dataset && e.target.dataset.bd && box._bdField) box._bdField(e); });
      box.addEventListener("change", (e) => { if (view === "tribes" && e.target.dataset && e.target.dataset.bd && box._bdField) box._bdField(e); });
      box.addEventListener("click", (e) => { if (view === "tribes" && box._affClick) box._affClick(e); });
      for (const ev of ["dragstart", "dragover", "drop", "dragend"]) box.addEventListener(ev, (e) => { if (view === "tribes" && box._affDrag) box._affDrag(e); });
    }
    box.oninput = box.onchange = (e) => {
      const row = e.target.closest("[data-ti]"); if (!row || !e.target.dataset.tk) return;
      const l = tdraft, t = l[+row.dataset.ti], k = e.target.dataset.tk;
      t[k] = e.target.value;
      if (k === "color") row.style.setProperty("--tribe", t.color);
      saveTribesSoon(l, e.type === "change");
    };
    box.onclick = async (e) => {
      const ib = e.target.closest("[data-icon]");
      if (ib) { const l = tdraft, i = +ib.closest("[data-ti]").dataset.ti; l[i].icon = ib.dataset.icon; await saveTribesNow(l); renderTribes(); return; }
      const del = e.target.closest("[data-tdel]");
      if (del) {
        const l = tdraft, i = +del.dataset.tdel, t = l[i];
        if (pending !== "tdel" + t.id) { pending = "tdel" + t.id; status(`Click ✕ again to delete ${TN(t.id)} (${cardsOfTribe(t.id)} cards are affected).`, "warn"); return; }
        pending = null;
        l.splice(i, 1);
        // your cards of that tribe become Neutral, and effects stop pointing at it
        for (const r of work) {
          if (r.tribe === t.id) r.tribe = "";
          for (const ab of r.abilities || []) for (const f of ["ftribe", "ttribe", "ifTribe", "perTribe", "tribe", "toTribe"]) if (ab[f] === t.id) delete ab[f];
        }
        await ST.saveCards(work); work = clone(ST.cards);
        await saveTribesNow(l); renderTribes(); status(`Deleted ${t.name || t.id}.`);
        return;
      }
      if (e.target.id === "ceAddTribe") {
        const l = tdraft;
        l.push({ id: "t_" + Date.now().toString(36), name: "New tribe", color: PALETTE[l.length % PALETTE.length], icon: ART.ICON_KEYS[(l.length + 3) % ART.ICON_KEYS.length], blurb: "" });
        await saveTribesNow(l); renderTribes();
        const inputs = el.querySelectorAll(".ce-tname"); const last = inputs[inputs.length - 1]; if (last) { last.focus(); last.select(); }
        status("New tribe added. Give it a name, a colour and an icon.");
      }
    };
  }
  let tribeTimer = 0;
  let affTimer = 0;
  function saveTribesSoon(l, now) { clearTimeout(tribeTimer); tribeTimer = setTimeout(() => saveTribesNow(l).then(() => { renderList(); renderMetas(); }), now ? 0 : 350); }
  async function saveTribesNow(l) { await ST.saveTribes(l.map((t) => ({ ...t }))); renderMetas(); renderList(); }

  // ---------------------------------------------------------------- selection
  async function select(key) {
    quickOpen = false; view = "card"; form_off(); renderMetas();
    curKey = key; cur = recordFor(key); dirty = false; pending = null; histReset();
    if (!(kindTab === "all" && (kindOf(cur) === "minion" || kindOf(cur) === "spell"))) kindTab = kindOf(cur);
    folded = new Set((cur.abilities || []).length > 2 ? cur.abilities.map((_, i) => i) : []);
    const rec = await ST.getImage(imgKey(cur));
    img = rec ? { ...rec, crop: { ...rec.crop }, tcrop: { ...(rec.tcrop || rec.crop) }, changed: false } : null;
    await ST.load(); // drop unsaved previews of other cards
    renderList(); renderForm(); preview(); status(""); $("#ceTestOut", el).innerHTML = "";
  }
  function startNew(kind, quiet) {
    quickOpen = false; folded = new Set(); form_off();
    if (!quiet && !(kindTab === "all" && (kind === "minion" || kind === "spell"))) kindTab = kind;
    if (kind === "keyword") {
      cur = { id: newId("ck_"), kind: "keyword", name: "New keyword", color: "#c9a24a", icon: "", tip: "", abilities: [{ trigger: "startOfCombat", action: "buff", target: "self", a: 1, h: 1 }] };
      curKey = "keyword|" + cur.id; img = null; dirty = true; pending = null; histReset();
      if (view !== "card") { view = "card"; renderMetas(); }
      renderList(); renderForm(); preview(); $("#ceTestOut", el).innerHTML = "";
      status("New keyword. Name it, give it effects, then Save. Then tick it on any minion.", "warn");
      return;
    }
    if (kind === "affinity") {
      const id = newId("af"), n = W.AFFS.length;
      cur = { id, kind: "affinity", builtIn: false, hidden: false, name: "New affinity", mech: "Growth", tpl: "growth", color: ["#e0604a", "#4ac0e0", "#a06ae0", "#e0c04a", "#5ae08a"][n % 5], color2: "", shape: ["hex", "shield", "diamond", "star", "round"][n % 5], glyph: "", art: "", fx: "", icon: "",
        t1: 2, t2: 4, t3: 0, v1: 1, v2: 2, v3: 3, kw: "shield", desc: "", abilities: [] };
      curKey = "affinity|" + cur.id; img = null; dirty = true; pending = null; histReset();
      if (view !== "card") { view = "card"; renderMetas(); }
      renderList(); renderForm(); preview(); $("#ceTestOut", el).innerHTML = "";
      status("New affinity. Name it, design its badge, pick a mechanic, add level effects, then Save. Then tick it on minions.", "warn");
      return;
    }
    if (kind === "anomaly") {
      cur = { id: newId("an_"), kind: "anomaly", name: "New anomaly", abilities: [], customText: "", banHeroes: [] };
      curKey = "anomaly|" + cur.id; img = null; dirty = true; pending = null; quickOpen = true; histReset();
      if (view !== "card") { view = "card"; renderMetas(); }
      renderList(); renderForm(); preview(); $("#ceTestOut", el).innerHTML = "";
      status("New anomaly. Pick a starting rule below, add more, then Save.", "warn");
      return;
    }
    if (kind === "hero") {
      cur = { id: newId("h_"), kind: "hero", name: "New hero", health: 30, powerName: "Hero power", powerType: "active", powerCost: 1, abilities: [{ trigger: "cast", action: "buff", target: "chosen", a: 1, h: 1 }], customText: "" };
      curKey = "hero|" + cur.id; img = null; dirty = true; pending = null; histReset();
      if (view !== "card") { view = "card"; renderMetas(); }
      renderList(); renderForm(); preview(); $("#ceTestOut", el).innerHTML = "";
      status("New hero. Give it a name, a portrait and a power, then Save.", "warn");
      return;
    }
    if (view !== "card") { view = "card"; renderMetas(); }
    cur = kind === "spell"
      ? { id: newId("s_"), kind: "spell", name: "New spell", tier: 1, cost: 1, target: true, abilities: [{ trigger: "cast", action: "buff", target: "chosen", a: 2, h: 2 }], customText: "" }
      : { id: newId("c_"), kind: "minion", name: "New minion", tribe: "", tier: 1, attack: 2, health: 2, taunt: false, shield: false, reborn: false, windfury: false, venomous: false,
          abilities: [{ trigger: "battlecry", action: "buff", target: "randomFriend", count: 1, a: 1, h: 1 }], noBuiltIn: true, customText: "", inPool: true, rarity: "common" };
    curKey = kind + "|" + cur.id; img = null; dirty = !quiet; pending = null; histReset();
    renderList(); renderForm(); preview(); $("#ceTestOut", el).innerHTML = "";
    status(quiet ? "Pick a card on the left to change it, or build this new one." : "New card. Give it a name, a picture and an effect, then Save card.", quiet ? "" : "warn");
  }

  // ---------------------------------------------------------------- form
  const opt = (pairs, v) => pairs.map(([k, l]) => `<option value="${esc(k)}"${String(k) === String(v == null ? "" : v) ? " selected" : ""}>${esc(l)}</option>`).join("");
  // Number with − / + buttons. Typing still works.
  const num = (k, v, min, max, label, i, ph) => `<div class="ce-num"><span>${label}</span><div class="ce-step"><button type="button" class="ce-stepb" data-step="-1" tabindex="-1" aria-label="Less">−</button><input type="number" ${i != null ? `data-i="${i}" data-k` : "data-f"}="${k}" value="${v == null ? "" : v}" min="${min}" max="${max}" step="1"${ph ? ` placeholder="${ph}"` : ""}><button type="button" class="ce-stepb" data-step="1" tabindex="-1" aria-label="More">+</button></div></div>`;
  const grouped = (groups, v) => groups.filter(([, l]) => l.length).map(([g, l]) => `<optgroup label="${esc(g)}">${opt(l, v)}</optgroup>`).join("");
  const gsel = (k, groups, v, i, label, wide) => `<label class="ce-sel${wide ? " wide" : ""}">${label}<select data-i="${i}" data-k="${k}">${grouped(groups, v)}</select></label>`;
  const sel = (k, pairs, v, i, label, wide) => `<label class="ce-sel${wide ? " wide" : ""}">${label}<select data-i="${i}" data-k="${k}">${opt(pairs, v)}</select></label>`;
  // affinity triggers and actions name the affinities of this meta that run that mechanic
  const AFF_OF = { pulse: "pulse", afterReflux: "ebb", afterFoundation: "found", onMiredDeath: "mire", gainPressure: "gauge", pulseDouble: "pulse", mire: "mire", buildFoundation: "found", onFoundationPlay: "found", onSelfEbb: "ebb", onPressureFull: "gauge", onMire: "mire", foundationAll: "found", foundationGrow: "found", releasePressure: "gauge", ebbMore: "ebb" };
  const affLabel = (k, label) => { const kind = AFF_OF[k]; if (!kind) return label; const l = W.affsOfKind(kind); const base = label.replace(/\s*\([^)]*\)\s*$/, "");
    return l.length ? `${base} · ${l.map((a) => W.affName(a) + " (" + W.affMech(a) + ")").join(", ")}` : `${base} · (no ${W.AFF_KIND_INFO[kind] ? kind : ""} affinity in this meta)`; };
  const triggerPairs = (r) => Object.entries(TRIGGERS).filter(([k, t]) => (spellLike(r) ? t.spell : heroPassive(r) ? W.HERO_TRIGGERS.includes(k) : !t.spell && !t.hero)).map(([k, t]) => [k, affLabel(k, heroPassive(r) ? t.label.replace(/another minion/, "a minion") : t.label)]);
  const TRIG_GROUPS = [["Once", ["gameStart"]], ["Played or sold", ["battlecry", "onSell"]], ["On demand", ["activate", "work"]], ["Evolution", ["evoFull"]], ["Growth", ["onBuffed"]], ["Every turn", ["startOfTurn", "endOfTurn"]], ["Age", ["onAge"]], ["After a fight", ["afterWin", "afterLoss", "afterCombat", "afterSurvive"]],
    ["In the tavern", ["onBuy", "onPlayOther", "onPlayBattlecry", "onSummonT", "onSellOther", "onRoll", "afterUpgrade", "onTriple", "onDiscover"]],
    ["Tavern spells", ["onSpell", "onSpellTargeted", "onBuySpell"]],
    ["Frozen", ["onFreeze", "onBuyFrozen", "onFreezeFoe"]],
    ["Devour", ["afterDevour", "onDevoured"]],
    ["Affinities", ["pulse", "afterReflux", "onSelfEbb", "afterFoundation", "onFoundationPlay", "onPressureFull", "onMiredDeath", "onMire", "onAffUp"]],
    ["In combat", ["startOfCombat", "onAttack", "onAttacked", "onFriendlyAttack", "onDamaged", "onKill", "onOverkill", "deathrattle", "onDeathrattleFriend", "onAllyDeath", "onEnemyDeath", "onSummonAlly", "onEnemySummon", "onShieldLost", "onRebornAlly", "onLastStanding"]],
    ["Lab: chains", ["andThen", "orElse", "andThenC", "orElseC"]],
    ["Always on", ["passive"]]];
  // the old stat-threshold Evolve stays readable on cards that use it, but is no longer offered
  const triggerGroups = (r, cur) => { const ok = new Map(triggerPairs(r)); return TRIG_GROUPS.filter(([g, ks]) => g !== "Affinities" || W.affOn() || ks.includes(cur)).map(([g, ks]) => [g, ks.concat(g === "Growth" && cur === "onReach" ? ["onReach"] : []).filter((k) => ok.has(k)).map((k) => [k, ok.get(k)])]); };
  // what can charge an Evolution crystal: any event a minion can react to
  const EVO_SRC_SKIP = new Set(["passive", "gameStart", "cast", "evoFull", "onReach", "work", "battlecry"]);
  const evoSrcPairs = (r) => [["", "Nothing of its own (other effects charge it)"], ...triggerPairs(r).filter(([k]) => !EVO_SRC_SKIP.has(k))];
  const ACT_GROUPS = [["Stats", ["buff", "permBuff", "absorb", "setStats", "swapStats", "doubleStats", "debuff", "heal", "healN", "buffHand", "tavernBuff", "passStats", "empower", "buffBoost"]], ["Keywords", ["keyword", "randomKeyword", "removeKeyword", "copyKeywords"]],
    ["Next…", ["nextBattlecryTwice", "nextBuyBuff", "nextPlayBuff", "nextSellGold", "freeBuy", "freeRoll", "nextGold", "upgradeDiscount"]],
    ["Fight", ["damage", "destroy", "attackNow", "heroDamage", "steal", "silence", "resurrect", "shuffleEnemies", "combatGold", "devourEnemy"]], ["Devour", ["devour", "spitCopy", "devourBonus", "devourKeywords", "devourGold"]],
    ["Evolution", ["evolve", "mutate", "mutateTarget", "charge"]], ["Minions", ["summon", "summonRandom", "summonCopy", "addMinion", "addCard", "addCopy", "makeGolden", "goldenHand", "transform", "discover", "stealShop", "repeatBattlecry", "fireTrigger", "reposition"]],
    ["Affinities", ["giveAff", "affStats", "gainPressure", "releasePressure", "pulseDouble", "mire", "buildFoundation", "foundationAll", "foundationGrow", "ebbMore"]],
    ["Spell tricks", ["grantEffect", "bounce", "setTribe", "sacrifice", "nextCombatBuff", "nextCombatStrike"]], ["Gold and tavern", ["gold", "goldRandom", "freeBuy", "nextGold", "freeRoll", "refreshShop", "freeUpgrade", "upgradeDiscount", "hero"]],
    ["Tavern spells", ["addSpellId", "addSpell", "castSpell", "copySpell", "nextSpellTwice", "spellBoost", "extraSpell", "spellDiscount"]],
    ["Game rules (for good)", ["ruleBuy", "ruleSell", "ruleRoll", "ruleUpgrade", "ruleShop", "ruleIncome", "ruleMaxGold", "ruleBank", "ruleDiscover", "ruleGolden", "ruleTriple", "ruleDamage", "ruleDevour"]],
    ["Hero tricks", ["armor", "copyOpponent", "copyNextOpponent", "stealGold", "goldenShop", "refreshUp", "tribeShop", "shuffleBoard", "sharedPick"]],
    ["Frozen", ["freezeShop", "freezeMinion", "freezeFoe", "frozenBuff"]],
    ["Markers", ["mkPlus", "mkKw", "mkMove", "mkTake", "mkRemove", "enemyKw"]],
    ["Age", ["ageUp"]],
    ["Lab: counters", ["counter"]],
    ["Aura", ["auraGrant", "auraKw", "auraStats", "extraAttack", "extraBattlecry", "extraDeathrattle", "extraEndOfTurn", "extraStartOfTurn", "extraStartOfCombat", "summonBuff", "buyDiscount", "rollDiscount", "shopSize"]]];
  const actionGroups = (ab, r) => { const ok = new Set(actionPairs(ab, r).map(([k]) => k)); return ACT_GROUPS.filter(([g, ks]) => g !== "Affinities" || W.affOn() || ks.includes(ab.action)).map(([g, ks]) => [g, ks.filter((k) => ok.has(k)).map((k) => [k, affLabel(k, ACTIONS[k].label)])]); };
  const TRIG_HELP = { onSummonT: "When an effect puts a minion on your board in the tavern (Summon, a copy…), not when you play one. Filter on tokens and markers; “the minion that triggered it” is the new one. For combat, use “After a friendly minion is summoned”.", onAge: "Fires at the end of the turn when this minion's age (the turns it ended on your board) reaches the number. Tick the box to fire again every N turns after that. For “while it is old enough”, use a condition on its age instead (More options).", onFoundationPlay: "Like a Battlecry, but only when the slot you drop it on already has a Foundation under it.", onSelfEbb: "Fires on this minion when it Ebbs back to your hand (it keeps what it gains, and can be played again).", onPressureFull: "Fires the moment a gauge (Pressure) reaches its maximum. Spend it to fill it again.", onMire: "In combat, after any of your minions Mires one or more enemies. “The minion that triggered it” is the first enemy Mired.", onBuySpell: "Right after you buy the tavern's spell.", onBuyFrozen: "Right after you buy a minion that was Frozen: the whole tavern frozen, or that minion Frozen by an effect. “The minion that triggered it” is the one you bought.", onFreezeFoe: "In combat, each time one of your effects Freezes an enemy minion (“Freeze enemy minions”). “The minion that triggered it” is the Frozen enemy.", onAffUp: "In the tavern, right after something you do (buy, play, sell…) brings one of your affinities to a new level. Add “Only if… an affinity's level” to aim at one.", andThen: "Runs right after the rule above, only if it happened. Stack them: Then, Then, Otherwise… The tavern or combat version is picked for you from the rule above.", orElse: "Runs instead when the rule above didn't happen: its chance missed, its condition or its cost failed, or it wasn't its turn (every N times). Like “if… else…”.", andThenC: "Runs right after the rule above, only if it happened (in combat).", orElseC: "Runs instead when the rule above didn't happen (in combat): a missed chance, a condition, a cost…", onSignal: "Listens to a name you choose. Any effect that sends this signal in the tavern (\"Send a signal\") makes this one fire. Signals are your own mechanics: build a Totem that shouts \"Storm\" and three minions that react to it.", onSignalC: "Like the tavern version, during a fight: an effect that sends this signal in combat makes this one fire.", evoFull: "The minion wears an Evolution crystal that fills up, charge by charge. Pick what charges it (after you Devour, at the end of each turn, when it kills…); “Charge Evolution” effects on any card can fill it too. When it is full, this effect fires: becomes another form, a random minion, a mutation you design… Golden minions charge twice as fast.", onBuffed: "Fires after any effect gives this minion stats, in the tavern or in combat (not from its own effect that just fired, to avoid loops beyond a few steps).",
    onReach: "Checked whenever its stats change, in the tavern or after a fight. Fires once per minion. Pair it with \"Evolve: this becomes another minion\" or any other effect.", work: "The Nth time the player activates this minion (it needs an Activate effect). Fires once. The minion on the board shows the count.",
    activate: "The player clicks the minion on their board and pays the gold; it works once per turn. Several Activate effects on one card share the first one's cost.", battlecry: "Happens when you play this card from your hand.", deathrattle: "Happens when this minion dies in combat.", passive: "Works the whole time this minion is on your board. Stacks with copies.",
    startOfCombat: "Happens once, before the first attack.", endOfTurn: "Happens when you end your turn in the tavern.", startOfTurn: "Happens when a new tavern turn starts.",
    onAllyDeath: "Use “Every N times” under More options to make it an Avenge effect.", onOverkill: "When this attacks and deals more damage than it needed to kill.",
    onLastStanding: "Once per combat, when every other friendly minion is gone.", gameStart: "Happens once, as the first tavern opens. Use it for game rules.", onDeathrattleFriend: "Fires after each friendly Deathrattle, including repeats from auras.", afterWin: "Checked after each fight, back in the tavern.", afterLoss: "Checked after each fight, back in the tavern.",
    onDevoured: "This minion was eaten (from the tavern, or from your warband). “The minion that triggered it” is the eater, so it can be rewarded or punished.", afterDevour: "Fires on every minion you control after any Devour; “the minion that triggered it” is the eater.",
    afterCombat: "Back in the tavern after every fight, won, lost or drawn.", afterSurvive: "Only when your warband won and this minion was still standing. Grows a minion that keeps living.", onDiscover: "Fires after any Discover: spells, hero powers, golden minions.", onEnemySummon: "Counts Deathrattle tokens, Reborn and copies the enemy summons during the fight." };
  const PICK_HELP = "The player picks the target on the table when the effect fires (Battlecry, Activate, after a buy…). At end of turn, or for bots, the best candidate is taken. In combat the choice is random.";
  const ACTION_HELP = { auraGrant: "While this minion is on your board, the minions it aims at have these effects too (each one works like their own). Several effects: + Add an effect to lend. In combat they keep them for the fight; the summoned ones get them too.", auraKw: "As the fight starts, the minions it aims at get the keyword (minions summoned during the fight too). For a keyword that stays, use a keyword marker.", auraStats: "As the fight starts, the minions it aims at get the stats (minions summoned during the fight too).", extraAttack: "In combat, the minions it aims at attack that many more times each turn (Windfury adds on top).", ageUp: "Adds turns to the targets' age, as if they had spent them on your board (a minus makes them younger, never below 0).", mkPlus: "Stat markers stack on the minion: a +1/+1 marker is +1 Attack and +1 Health, a +2/+2 marker +2/+2, and so on (set the size with Attack and Health). They stay from turn to turn, and markers given in combat are kept back in the tavern. Other effects can move or steal them.", mkKw: "A keyword marker gives its keyword (Flying, Shield, Taunt…) for as long as it stays on the minion, combat after combat. One marker per keyword. Random: keywords the minion doesn't have yet.", mkMove: "Takes markers off the targets (a +1/+1 or a keyword marker) and puts them on this minion. In combat, markers taken from the enemy are gone from their warband for good.", mkTake: "Every marker of the targets goes onto this minion. “A copy” leaves them where they are; “Destroy it” removes the target from the board (tavern) or kills it (combat). With a dead minion (After a friendly / enemy minion dies), the markers it carried.", mkRemove: "Takes markers off the targets for good.", enemyKw: "Picks one keyword the enemy warband has (Taunt, Shield, Venomous…) that this minion doesn't have yet. For the combat only, or as a marker that stays.", foundationAll: "One Foundation under each of the 7 slots, empty ones too, up to the usual cap per slot.", foundationGrow: "Each minion standing on Foundations gets the stats once per Foundation under it (2 Foundations: twice).", releasePressure: "Empties the gauge: the targets get the stats once per point that was in it. Nothing happens with an empty gauge.", ebbMore: "Adds Ebbs on top of what your Water level allows this turn.", affStats: "Every minion carrying that affinity, on your board and in your hand, gets the stats.", addSpellId: "Puts the spell you pick into your hand (if there is room), even one the tavern doesn't sell at your tier.", castSpell: "Casts the spell you pick right away, for free: it counts as a spell you cast (“After you cast a tavern spell”, “cast twice”…). A spell that targets a minion lands on the target you pick here; with no such minion, nothing happens.", copySpell: "A copy of the last tavern spell you cast (by hand or by an effect) goes into your hand.", spellDiscount: "While this is on your board, the tavern's spell costs that much less (it shows in green).", freezeMinion: "Freezes some tavern minions one by one: they stay when you refresh, and are still there at your next turn (then they thaw). They count as Frozen for “After you buy a Frozen minion”, “The Frozen minions in the tavern” and the frozen-minion growth aura.", freezeFoe: "The Frozen enemies skip their next attack (Frozen twice: two attacks). Combine with “The Frozen enemy minions” to shatter them, or with “After your side Freezes an enemy”.", counter: "A number of your own with the name you pick (Rage, Souls, Charge…), kept on this minion or on you. Then use it in More options: “Only if… its Rage is at least 5” (with “spend it” to pay for the effect), or “× each Rage” to scale an effect.", signal: "Sends a named signal: every friendly minion with “When a signal is sent” listening to that name reacts. Chains are capped, so loops stop on their own.", nextSpellTwice: "A one-shot: the next tavern spell(s) you cast this game are cast twice (custom spells and the simple built-in ones). Stacks.", nextBattlecryTwice: "A one-shot: the next minion(s) with a Battlecry you play trigger it twice. Stacks.", nextBuyBuff: "The next minion(s) you buy from the tavern get the stats on arrival in your hand.", nextPlayBuff: "The next minion(s) you play from your hand get the stats as they land (before their Battlecry).", nextSellGold: "The next time(s) you sell a minion you get that much more gold.", spitCopy: "Needs this minion to have Devoured something: a plain copy of its last meal goes to your hand.", devourGold: "Every minion Devoured by any of your minions gives that much gold.", copyKeywords: "This minion gains every keyword the targets have (Taunt, Shield, Reborn…).",
    absorb: "This minion adds the current Attack and Health of the targets to its own (they keep theirs). Golden doubles it.",
    charge: "Adds charges to the Evolution crystal of minions that have one (an “Evolve” effect). In combat the charges land after the fight.", mutate: "The minion keeps its card and gets the bonus the player picks: stats, a keyword and/or an extra effect. Mutations stack and stay when it evolves or turns golden.",
    evolve: "The minion is replaced in its spot by the one you pick, keeping what it gained (stats above its base, keywords, Empower, food). Golden stays golden.", empower: "Permanent: every stat-giving effect of the target gives that much more, in the tavern and in combat. Stacks.", buffBoost: "While this is on your board, each of your minions' stat effects gives more. Several auras stack.", spellBoost: "While this is on your board, tavern spells (Tavern Brew, Hearty Feast, War Banner, your own stat spells) and your hero power give more stats.", addCard: "Pick the exact minion that goes to your hand (any card of this meta, tokens included). Golden copies of the holder add twice as many.", reposition: "Order matters: the leftmost minion attacks first (and dies first), and Deathrattle tokens appear where the minion stood.",
    devour: "From the tavern: all its stats (Abyssal Maw and the Devour rule make it 1.5×). From your warband: eats a friend for its full stats, and the friend's “When this is Devoured” fires.",
    devourEnemy: "A combat Devour: the enemy is destroyed outright and this minion grows. Works through Shield; Stealth minions can't be eaten.", devourBonus: "Stacks with Maw and with copies of this minion. Every Devour on your side counts.", devourKeywords: "Taunt, Shield, Reborn, Windfury, Venomous, Cleave, Stealth, Dodge and Tough all pass to the eater.",
    frozenBuff: "Only when you froze the tavern: the minions still standing there grow before you shop.", goldenHand: "Like a triple, keeping any buffs the card already had. Discover is not offered.", shuffleEnemies: "Scrambles who attacks first on their side; Taunt still works. A gamble, not a plan.",
    steal: "The enemy minion joins your side next to this one and fights for you from then on. Stealth minions can't be taken.", silence: "Removes every keyword, built-in effect and extra effect. Stats stay.", resurrect: "Brings back a full-Health copy of a friendly minion that already died in this fight. Needs room on the board.",
    combatGold: "Gold is paid at the start of your next tavern turn, on top of your income.", reposition: "Order matters: the leftmost minion attacks first, and Deathrattles summon where the minion stood.", shuffleEnemies: "Taunt still works; this only scrambles their attack order.", ruleTriple: "Two copies of a minion merge into a golden one instead of three.", ruleDamage: "Applies to damage from lost fights and from enemy effects that hit your hero.",
    permBuff: "The bonus is kept after the fight, unlike normal combat buffs.", grantEffect: "The chosen minion keeps the new effect for the rest of the game.", sharedPick: "One player per turn picks; everyone gets the same minion. Golden copies count as one card in hand.", nextCombatStrike: "Fires before Start of Combat effects, like a hero power." };
  const phaseOf = (ab) => (TRIGGERS[ab.trigger] || {}).phase;
  const actionPairs = (ab, r) => {
    const ph = phaseOf(ab);
    if (r && isAff(r) && ab.trigger === "startOfCombat") return [["buff", ACTIONS.buff.label], ["keyword", ACTIONS.keyword.label], ["randomKeyword", "Give random keywords to your minions"], ["damage", ACTIONS.damage.label]];
    if (r && heroPassive(r) && ab.trigger === "startOfCombat") return [["damage", ACTIONS.damage.label], ["buff", ACTIONS.buff.label], ["swapStats", "Swap Attack and Health of your minions"], ["randomKeyword", "Give random keywords to your minions"]]; // what a hero can do as a fight starts
    return Object.entries(ACTIONS).filter(([, a]) => (ph === "passive" ? a.phase === "passive" : !a.phase || a.phase === ph) && (!a.hero || (powerLike(r) && (!a.anomaly || isAnom(r)))))
      .filter(([k]) => k !== "sharedPick" || ab.trigger === "startOfTurn").filter(([k]) => k !== "repeatBattlecry" || ab.trigger === "onPlayBattlecry" || ab.trigger === "onPlayOther").filter(([k]) => k !== "evolve" || !(spellLike(r) || powerLike(r))).map(([k, a]) => [k, a.label]);
  };
  const OFFBOARD = new Set(["mkPlus", "mkKw", "freezeMinion", "giveAff", "buff", "permBuff", "debuff", "keyword", "removeKeyword", "randomKeyword", "setStats", "swapStats", "doubleStats", "heal", "healN", "empower", "absorb", "copyKeywords", "setTribe", "grantEffect", "silence", "addCopy", "summonCopy", "passStats"]);
  function targetPairs(ab, r) {
    if (isAff(r) && ab.trigger === "startOfCombat") return ab.action === "damage" ? [["randomEnemy", "Random enemy minions"], ["allEnemies", "All enemy minions"]] : [["allFriends", "All your minions (use the filters)"], ["randomFriend", "Random friendly minions"]];
    if (heroPassive(r) && ab.trigger === "startOfCombat") return ab.action === "damage" ? [["randomEnemy", "Random enemy minions"], ["allEnemies", "All enemy minions"]] : ab.action === "randomKeyword" ? [["randomFriend", "Random friendly minions"]] : [["allFriends", "All your minions"]];
    const combat = phaseOf(ab) === "combat", spell = spellLike(r) || powerLike(r), out = [];
    if (spellLike(r)) out.push(["chosen", "The chosen minion"]); else if (!powerLike(r)) out.push(["self", "This minion"]);
    out.push(["randomFriend", spell ? "Random friendly minions" : "Random other friendly minions"], ["allFriends", spell ? "All your minions" : "All your other minions"]);
    if (!spell) out.push(["allFriendsSelf", "All your minions (this one included)"], ["randomFriendSelf", "Random friendly minions (this one included)"]);
    if (!combat && !isAnom(r)) { out.push(["pickFriend", spell ? "A friendly minion you choose" : "Another friendly minion you choose"]); if (!spell) out.push(["pickAny", "One of your minions you choose (this one included)"]); if (OFFBOARD.has(ab.action)) out.push(["pickShop", "A tavern minion you choose"], ["pickHand", "A minion in your hand you choose"]); }
    { const list = (r && r.abilities) || [], at = list.indexOf(ab); if (at > 0 || ab.target === "previous") out.push(["previous", "The same minions as the rule above (lab)"]); }
    if (!spell) out.push(["adjacent", "Adjacent minions"], ["leftOf", "The minion to the left of this"], ["rightOf", "The minion to the right of this"], ["kin", "Your other minions sharing a tribe with this"]);
    out.push(["buffers", spell ? "Your minions that give stats" : "Your other minions that give stats"], ["tribeMost", "Your minions of your most common tribe"], ["newest", "The minion you played most recently"], ["oldest", "The minion you played longest ago"]);
    out.push(["tokens", "Your tokens"], ["randomToken", "Random tokens of yours"]);
    if (!spell) out.push(["eldest", "Your other minion with the most turns on your board"], ["youngest", "Your other minion with the fewest turns on your board"]);
    out.push(["eldestAll", spell ? "Your minion with the most turns on your board" : "Your minion with the most turns on your board (this one included)"], ["youngestAll", spell ? "Your minion with the fewest turns on your board" : "Your minion with the fewest turns on your board (this one included)"]);
    out.push(["leftmost", "Your leftmost minion"], ["rightmost", "Your rightmost minion"], ["weakestFriend", spell ? "Your weakest minion" : "Your weakest other minion"], ["strongestFriend", spell ? "Your strongest minion" : "Your strongest other minion"]);
    if (!isAnom(r)) out.push(["foundationMinions", "Your minions standing on Foundations (Earth)"]);
    if (ab.target === "colony") out.push(["colony", "Your Colony (old Coral effect)"]);
    if (SOURCE_TRIGGERS.has(ab.trigger) || (DEAD_SOURCE.has(ab.trigger) && (ab.action === "summonCopy" || ab.action === "mkTake"))) out.push(["trigger", DEAD_SOURCE.has(ab.trigger) ? "The minion that died" : "The minion that triggered it"]);
    if (combat) out.push(["frozenEnemies", "The Frozen enemy minions"]);
    else if (!isAnom(r)) out.push(["shopFrozen", "The Frozen minions in the tavern"]);
    if (combat) out.push(["randomEnemy", "Random enemy minions"], ["allEnemies", "All enemy minions"], ["weakestEnemy", "The weakest enemy minion"], ["strongestEnemy", "The strongest enemy minion"], ["frontEnemy", "The enemy's leftmost minion (next attacker)"], ["backEnemy", "The enemy's rightmost minion"], ["allMinions", "Every minion on both sides"]);
    else if (!isAnom(r)) out.push(["shopAll", "The minions in the tavern"], ["shopRandom", "Random minions in the tavern"], ["handAll", "The minions in your hand"], ["handRandom", "Random minions in your hand"]);
    if (ab.action === "passStats") return out.filter(([k]) => k !== "trigger" && k !== "chosen");
    if (["auraGrant", "auraKw", "auraStats", "extraAttack", "summonBuff"].includes(ab.action)) return out.filter(([k]) => /^(self|allFriends|allFriendsSelf|tokens|adjacent|leftOf|rightOf|kin|leftmost|rightmost|eldest|youngest|eldestAll|youngestAll|tribeMost|weakestFriend|strongestFriend)$/.test(k));
    // freezing aims at the tavern (in the tavern) or at enemies (in combat)
    if (ab.action === "castSpell") return out.filter(([k]) => /^(self|chosen|trigger|randomFriend|randomFriendSelf|weakestFriend|strongestFriend|leftmost|rightmost|newest|oldest|previous)$/.test(k));
    if (ab.action === "freezeMinion") return out.filter(([k]) => /^(shopAll|shopRandom|shopFrozen|pickShop)$/.test(k));
    if (ab.action === "freezeFoe") return out.filter(([k]) => /^(randomEnemy|allEnemies|weakestEnemy|strongestEnemy|frontEnemy|backEnemy|frozenEnemies)$/.test(k) || (k === "trigger" && ["onAttacked", "onEnemySummon", "onKill", "onDamaged"].includes(ab.trigger)));
    return ab.action === "damage" ? out.filter(([k]) => k !== "self") : out;
  }
  function spellPairs() { return Object.keys(W.SPELLS).sort((a, b) => W.SPELLS[a].tier - W.SPELLS[b].tier || W.SPELLS[a].name.localeCompare(W.SPELLS[b].name)).map((id) => [id, `${W.SPELLS[id].name} (tier ${W.SPELLS[id].tier}, ${W.SPELLS[id].cost} gold${W.SPELLS[id].target ? ", targets a minion" : ""})`]); }
  function summonPairs() {
    const ids = Object.keys(W.CARDS).sort((a, b) => W.CARDS[a].tier - W.CARDS[b].tier || W.CARDS[a].name.localeCompare(W.CARDS[b].name));
    return Object.keys(W.TOKENS).filter((id) => !W.CARDS[id]).map((id) => [id, `${W.TOKENS[id].name} (token, ${W.TOKENS[id].attack}/${W.TOKENS[id].health})`])
      .concat(ids.map((id) => [id, `${W.CARDS[id].name} (${W.CARDS[id].attack}/${W.CARDS[id].health}, tier ${W.CARDS[id].tier})`]));
  }
  // Keep an ability valid after its trigger or action changed.
  function fixAbility(ab, r) {
    if (spellLike(r)) ab.trigger = "cast";
    // a chain rule follows the rule above it, in the tavern or in combat like that one
    if (/^(andThen|orElse)C?$/.test(ab.trigger)) {
      const list = (r && r.abilities) || [], at = list.indexOf(ab), prev = at > 0 ? list[at - 1] : null;
      if (!prev) ab.trigger = "battlecry";
      else { const base = ab.trigger.replace(/C$/, ""), combat = phaseOf(prev) === "combat"; ab.trigger = base + (combat ? "C" : ""); }
    }
    if (heroPassive(r) && !W.HERO_TRIGGERS.includes(ab.trigger)) ab.trigger = "endOfTurn";
    if (!powerLike(r) && TRIGGERS[ab.trigger] && TRIGGERS[ab.trigger].hero) ab.trigger = "battlecry";
    if (!TRIGGERS[ab.trigger] || (spellLike(r) ? !TRIGGERS[ab.trigger].spell : TRIGGERS[ab.trigger].spell)) ab.trigger = "battlecry";
    if (!TRIGGERS[ab.trigger].filter) delete ab.ftribe;
    if (!actionPairs(ab, r).some(([k]) => k === ab.action)) ab.action = actionPairs(ab, r)[0][0];
    const f = ACTIONS[ab.action].fields;
    if (f.includes("spell") && !W.SPELLS[ab.spell]) ab.spell = (spellPairs()[0] || [""])[0];
    if (!f.includes("spell")) delete ab.spell;
    if (f.includes("target") && !targetPairs(ab, r).some(([k]) => k === ab.target)) { const tp = targetPairs(ab, r), pref = { freezeMinion: "shopRandom", freezeFoe: "randomEnemy", auraGrant: "allFriends", auraKw: "allFriends", auraStats: "allFriends", extraAttack: "allFriends", summonBuff: "self" }[ab.action]; ab.target = pref && tp.some(([k]) => k === pref) ? pref : (tp[0] || ["self"])[0]; }
    if (!f.includes("target")) { delete ab.target; delete ab.ttribe; }
    if (["buff", "permBuff", "summonBuff", "setStats", "debuff", "buffHand", "nextCombatBuff", "empower", "buffBoost", "spellBoost", "foundationGrow", "releasePressure", "affStats", "mkPlus", "auraStats"].includes(ab.action) && !ab.a && !ab.h) { ab.a = 1; ab.h = 1; }
    if (ab.action === "ebbMore" && !ab.n) ab.n = 1;
    if (ab.trigger === "activate") { if (ab.actCost == null) ab.actCost = 1; } else delete ab.actCost;
    if (ab.trigger === "onReach") { if (!ab.stat) ab.stat = "either"; if (!ab.at) ab.at = 5; } else if (ab.trigger === "work" || ab.trigger === "evoFull" || ab.trigger === "onAge") { if (!ab.at) ab.at = 3; } else delete ab.at;
    if (ab.trigger !== "evoFull") { delete ab.src; delete ab.stribe; if (ab.trigger !== "onAge") delete ab.rep; delete ab.inc; }
    else if (ab.src && !(TRIGGERS[ab.src] && TRIGGERS[ab.src].filter)) delete ab.stribe;
    if (ab.action === "charge") { if (!ab.n) ab.n = 1; }
    if (["mkPlus", "mkKw", "mkMove", "mkRemove", "extraAttack"].includes(ab.action) && !ab.n) ab.n = 1;
    if (ab.action === "auraGrant" && !Array.isArray(ab.grants)) ab.grants = [clone(QUICK_MINION[0][1])];
    if (ab.action !== "auraGrant") delete ab.grants;
    if (!(TRIGGERS[ab.trigger] && TRIGGERS[ab.trigger].filter)) { delete ab.ftok; delete ab.fmk; }
    for (const x of ["mkw", "mkind", "mkeep", "asMk", "exact", "mdir", "sfrom", "upTo"]) if (!f.includes(x)) delete ab[x];
    if (!f.includes("target")) { delete ab.ttok; delete ab.tmk; delete ab.tageMin; delete ab.tageMax; }
    if (ab.action === "mutate") { if (!(ab.rmut > 0)) { delete ab.rmut; if (!ab.muts) ab.muts = [{ name: "Shell", a: 0, h: 4, kw: "taunt" }, { name: "Fangs", a: 4, h: 1 }]; } else delete ab.muts; } else { delete ab.muts; delete ab.rmut; }
    if (ab.action !== "evolve") { delete ab.mode; delete ab.rtribe; delete ab.tierUp; } else if (ab.mode !== "random") { delete ab.mode; delete ab.rtribe; delete ab.tierUp; } else { if (ab.rtribe == null) ab.rtribe = "same"; if (ab.tierUp == null) ab.tierUp = 1; if (!ab.count) ab.count = 3; }
    if (ab.trigger === "onSell" && ab.target === "self" && targetPairs(ab, r).some(([k]) => k === "randomFriend")) ab.target = "randomFriend"; // the sold minion is gone: aim at the others
    if (ab.action === "heroDamage" && ab.n == null) ab.n = 2;
    if (ab.action === "keyword" && !ab.kw) ab.kw = "taunt";
    if (ab.action === "giveAff" || ab.action === "affStats") { if (!W.AFF[ab.aff]) ab.aff = W.AFFS[0] || ""; } else delete ab.aff;
    if (ab.action === "fireTrigger") { const l = phaseOf(ab) === "combat" ? W.FIRE_COMBAT : W.FIRE_TAVERN; if (!l.includes(ab.trig)) ab.trig = l[0]; } else delete ab.trig;
    if (["damage", "healN", "gold", "nextGold", "freeRoll", "tavernBuff", "hero", "upgradeDiscount", "extraBattlecry", "extraDeathrattle", "extraEndOfTurn", "extraStartOfTurn", "extraStartOfCombat", "extraSpell", "spellDiscount", "buyDiscount", "rollDiscount", "shopSize"].includes(ab.action) && ab.n == null) ab.n = ab.action === "hero" ? 2 : 1;
    if (ab.trigger === "passive") { delete ab.ifTribe; delete ab.cond; }
    if (ab.action === "doubleStats" && !ab.stat) ab.stat = "attack";
    if (ab.action === "grantEffect" && !ab.grant) ab.grant = clone(QUICK_MINION[3][1]);
    if (ab.action === "setTribe" && ab.toTribe == null) ab.toTribe = "Beast";
    if (ab.action === "sacrifice" && ab.give == null) ab.give = "random";
    if (ab.action === "nextCombatStrike") { if (!ab.spread) ab.spread = "random"; if (ab.n == null) ab.n = 2; }
    if (!f.includes("grant")) delete ab.grant; if (!f.includes("toTribe")) delete ab.toTribe; if (!f.includes("give")) delete ab.give; if (!f.includes("spread")) delete ab.spread;
    if (!f.includes("stat") && ab.trigger !== "onReach") delete ab.stat;
    if (ab.action === "reposition" && !ab.where) ab.where = "front";
    if (ab.action === "devourEnemy") { if (!ab.count) ab.count = 1; if (!ab.share) ab.share = "full"; } if (ab.action !== "devourEnemy") delete ab.share;
    if (ab.action !== "devour") delete ab.devourFrom;
    if (ab.action === "goldenHand" && !ab.count) ab.count = 1;
    if (ab.action === "devourBonus" || ab.action === "frozenBuff") { if (!ab.a && !ab.h) { ab.a = 1; ab.h = 1; } }
    if (ab.per === "devours" || ab.per === "gold" || ab.per === "fed") { if (phaseOf(ab) === "combat" || powerLike(r) && ab.per === "fed") delete ab.per; }
    if (!f.includes("where")) delete ab.where;
    if ((ab.action === "steal" || ab.action === "resurrect") && !ab.count) ab.count = 1;
    if (ab.action === "combatGold" && ab.n == null) ab.n = 1;
    if (ab.action === "ruleDamage" && ab.n == null) ab.n = -1;
    if (!(ab.minTurn > 1)) delete ab.minTurn;
    if (ab.trigger === "passive" || ab.trigger === "gameStart" || ab.trigger === "battlecry" && spellLike(r)) delete ab.minTurn;
    if ((ab.action === "summon" || ab.action === "addCard") && !(W.CARDS[ab.card] || W.TOKENS[ab.card])) ab.card = Object.keys(W.TOKENS)[0] || Object.keys(W.CARDS)[0];
    if (ab.action === "discover" && !ab.tierMode) ab.tierMode = "current";
    if (ab.action === "tribeShop" && !ab.tribeMode) ab.tribeMode = "random";
    if (!f.includes("tribeMode")) delete ab.tribeMode;
    if (ab.action === "goldRandom" && ab.n == null) ab.n = 3;
    if ((ab.action === "freeBuy" || ab.action === "stealGold") && ab.n == null) ab.n = 1;
    if (f.includes("sn") && ab.n == null) ab.n = { ruleBuy: -1, ruleRoll: -1, ruleUpgrade: -1 }[ab.action] || 1;
    if (ab.action === "ruleBank" && ab.n == null) ab.n = 2;
    if (ab.action === "armor" && ab.n == null) ab.n = 5;
    if (ab.action === "refreshUp" && ab.n == null) ab.n = 1;
    if (f.includes("pct") && ab.pct == null) ab.pct = ab.action === "sharedPick" ? 25 : 10;
    if (ab.action === "sharedPick") { if (!ab.pickTier) ab.pickTier = "any"; if (!ab.count) ab.count = 3; }
    if (!f.includes("pct")) delete ab.pct; if (!f.includes("pickTier")) delete ab.pickTier;
    if (!["summonRandom", "transform", "addMinion"].includes(ab.action)) delete ab.allowSelf;
    if (ab.trigger === "passive" || isSpell(r) || ab.trigger === "gameStart" || (spellLike(r) && ab.limit === "turn")) delete ab.limit;
    if (!W.REPEATABLE.has(ab.trigger) || !(ab.every > 1)) delete ab.every;
    if (!W.SCALABLE.has(ab.action) || !ab.per) { delete ab.per; delete ab.perTribe; }
    if (ab.per === "enemy" && phaseOf(ab) !== "combat") ab.per = "friend";
    if (isSpell(r)) { delete ab.ifTribe; delete ab.cond; }
    if (powerLike(r)) { delete ab.golden; if (ab.cond === "alone" || ab.cond === "golden") delete ab.cond; }
    if (!f.includes("tier")) delete ab.tier;
    // the lab: chance, repeats, delay, numeric conditions, counters and signals
    if (!(ab.chance > 0 && ab.chance < 100)) delete ab.chance;
    if (!(ab.repeat > 1)) delete ab.repeat;
    if (!(ab.grow > 0)) delete ab.grow; if (!(ab.rnd > 1)) delete ab.rnd; if (!(ab.uses > 0)) delete ab.uses; if (!(ab.cool > 0)) delete ab.cool;
    delete ab.pick; delete ab.weight; // random draws are gone
    if (!ab.payWhat) delete ab.payN; else { if (!(ab.payN > 0)) ab.payN = 1; if (ab.payWhat === "gold" && phaseOf(ab) === "combat") { delete ab.payWhat; delete ab.payN; } }
    if (!ab.wWhat || !ab.w2What) { for (const x of ["w2What", "w2Cmp", "w2N", "w2Var"]) delete ab[x]; } else { if (ab.w2What === "affN" || ab.w2What === "affLv") { if (!W.AFF[ab.w2Var]) ab.w2Var = W.AFFS[0] || ""; } else if (ab.w2What !== "counter" && ab.w2What !== "pcounter") delete ab.w2Var; else if (!ab.w2Var) ab.w2Var = "Charge"; if (ab.w2What === "turnEven" || ab.w2What === "turnOdd") { delete ab.w2Cmp; delete ab.w2N; } }
    if (!(ab.delay > 0) || phaseOf(ab) === "combat" || ab.trigger === "passive" || ab.trigger === "gameStart") delete ab.delay;
    if (ab.trigger === "passive") { for (const x of ["chance", "repeat", "wWhat", "wCmp", "wN", "wVar", "wSpend", "w2What", "w2Cmp", "w2N", "w2Var", "grow", "rnd", "uses", "payWhat", "payN"]) delete ab[x]; }
    if (!ab.wWhat) { for (const x of ["wCmp", "wN", "wVar", "wSpend"]) delete ab[x]; } else { if (ab.wWhat === "affN" || ab.wWhat === "affLv") { delete ab.wSpend; if (!W.AFF[ab.wVar]) ab.wVar = W.AFFS[0] || ""; } else if (ab.wWhat !== "counter" && ab.wWhat !== "pcounter") { delete ab.wVar; delete ab.wSpend; } else if (!ab.wVar) ab.wVar = "Charge"; if (ab.wWhat === "turnEven" || ab.wWhat === "turnOdd") { delete ab.wCmp; delete ab.wN; } if (ab.wCmp && ab.wCmp !== ">=") delete ab.wSpend; }
    if (ab.per === "aff") { if (!W.AFF[ab.perVar]) ab.perVar = W.AFFS[0] || ""; } else if (ab.per !== "counter" && ab.per !== "pcounter") delete ab.perVar; else if (!ab.perVar) ab.perVar = "Charge";
    if (ab.action === "counter") { if (!ab.vname) ab.vname = "Charge"; if (ab.n == null) ab.n = 1; if (!ab.scope) ab.scope = "minion"; if (!ab.op) ab.op = "add"; } else { delete ab.vname; delete ab.scope; delete ab.op; }
    if (ab.action === "signal") { if (!ab.sigOut) ab.sigOut = "Signal"; } else delete ab.sigOut;
    delete ab.bondKind; delete ab.bondWho; if (ab.target === "partner") ab.target = "self"; if (ab.cond === "bonded" || ab.cond === "bondAdj") delete ab.cond;
    if (ab.trigger === "onSignal" || ab.trigger === "onSignalC") { if (!ab.sig) ab.sig = "Signal"; } else delete ab.sig;
    return ab;
  }
  // Visual styles come from the table's effect library (ui.js).
  const FXS = () => (root.WA_FX ? Object.entries(root.WA_FX.FX) : []); // enumerable entries only: older looks stay playable but hidden
  const FXA = (k) => (k && root.WA_FXE && root.WA_FXE.ALIAS && root.WA_FXE.ALIAS[k]) || k || ""; // an older look shown as the painted one it now plays
  const fxPairs = () => [["", "Default look"], ...FXS().map(([k, v]) => [k, v.name])];
  function playPreview(kind) {
    if (!root.WA_FX || !kind) return;
    const from = $("#cePvTok .mn", el) || $("#cePvCard .card", el), to = $("#cePvCard .card", el);
    if (from && to) root.WA_FX.play(kind, from, to === from ? null : to, el).catch(() => {});
  }

  // One-click starting points for common effects.
  const QUICK_MINION = [
    ["Battlecry: +2/+2 to a friend", { trigger: "battlecry", action: "buff", target: "randomFriend", count: 1, a: 2, h: 2 }],
    ["Activate (2): give a friend +2/+2", { trigger: "activate", actCost: 2, action: "buff", target: "randomFriend", count: 1, a: 2, h: 2 }],
    ["Activate (1): refresh the tavern", { trigger: "activate", actCost: 1, action: "refreshShop" }],
    ["Work (3): this becomes another minion", { trigger: "work", at: 3, action: "evolve", card: "" }],
    ["Battlecry: give all your minions +1/+1 (this one too)", { trigger: "battlecry", action: "buff", target: "allFriendsSelf", a: 1, h: 1 }],
    ["Battlecry: gain the stats of adjacent minions", { trigger: "battlecry", action: "absorb", target: "adjacent" }],
    ["Whenever this gains stats, give your other minions +1/+1", { trigger: "onBuffed", action: "buff", target: "allFriends", a: 1, h: 1 }],
    ["Start of Combat: deal damage equal to its Attack to the weakest enemy", { trigger: "startOfCombat", action: "damage", target: "weakestEnemy", n: 1, per: "attack" }],
    ["Battlecry: give your Taunt minions +2/+2", { trigger: "battlecry", action: "buff", target: "allFriends", tkw: "taunt", a: 2, h: 2 }],
    ["End of turn: give the minions in the tavern +1/+1", { trigger: "endOfTurn", action: "buff", target: "shopAll", a: 1, h: 1 }],
    ["Battlecry: Discover a Beast", { trigger: "battlecry", action: "discover", tierMode: "current", tribe: "Beast" }],
    ["Battlecry: give a friendly minion of your choice +2/+2", { trigger: "battlecry", action: "buff", target: "pickFriend", a: 2, h: 2 }],
    ["Battlecry: Devour a friendly minion of your choice", { trigger: "battlecry", action: "devour", target: "self", count: 1, devourFrom: "boardPick" }],
    ["Activate (1): Devour a tavern minion of your choice", { trigger: "activate", actCost: 1, action: "devour", target: "self", count: 1, devourFrom: "shopPick" }],
    ["Battlecry: give Taunt to a minion of your choice", { trigger: "battlecry", action: "keyword", kw: "taunt", target: "pickAny" }],
    ["Battlecry: your next tavern spell is cast twice", { trigger: "battlecry", action: "nextSpellTwice", n: 1 }],
    ["Battlecry: your next Battlecry triggers twice", { trigger: "battlecry", action: "nextBattlecryTwice", n: 1 }],
    ["Battlecry: the next minion you buy gets +2/+2", { trigger: "battlecry", action: "nextBuyBuff", a: 2, h: 2, count: 1 }],
    ["End of turn: Devour a minion from your hand", { trigger: "endOfTurn", action: "devour", target: "self", count: 1, devourFrom: "hand" }],
    ["After you Devour a Beast, give this +2/+2", { trigger: "afterDevour", ftribe: "Beast", action: "buff", target: "self", a: 2, h: 2 }],
    ["Battlecry: add a copy of its last meal to your hand", { trigger: "battlecry", action: "spitCopy" }],
    ["Aura: Devouring gives 1 gold", { trigger: "passive", action: "devourGold", n: 1 }],
    ["Battlecry: gain the keywords of adjacent minions", { trigger: "battlecry", action: "copyKeywords", target: "adjacent" }],
    ["Battlecry: give the minion you played most recently +3/+3", { trigger: "battlecry", action: "buff", target: "newest", a: 3, h: 3 }],
    ["Work (2): +4/+4 to this", { trigger: "work", at: 2, action: "buff", target: "self", a: 4, h: 4 }],
    ["Evolve (3), charges each end of turn: choose a mutation", { trigger: "evoFull", at: 3, src: "endOfTurn", action: "mutate", muts: [{ name: "Shell", a: 0, h: 4, kw: "taunt" }, { name: "Fangs", a: 4, h: 1 }, { name: "Wings", a: 1, h: 1, kw: "windfury" }] }],
    ["Evolve (2), charges after you Devour: one of 3 random minions a tier higher", { trigger: "evoFull", at: 2, src: "afterDevour", action: "evolve", mode: "random", count: 3, rtribe: "same", tierUp: 1 }],
    ["Evolve (3), charges after each combat: becomes another minion", { trigger: "evoFull", at: 3, src: "afterCombat", action: "evolve", card: "" }],
    ["Evolve (4), charges when it kills: the player chooses between two forms", { trigger: "evoFull", at: 4, src: "onKill", action: "evolve", card: "", cards: ["", ""] }],
    ["Evolve (2, repeatable), charges when you play a minion: 1 of 3 random mutations", { trigger: "evoFull", at: 2, rep: true, inc: 1, src: "onPlayOther", action: "mutate", rmut: 3 }],
    ["Evolve (3), charges each activation: becomes another minion", { trigger: "evoFull", at: 3, src: "activate", action: "evolve", card: "" }],
    ["Battlecry: charge the Evolution of your other minions by 1", { trigger: "battlecry", action: "charge", n: 1, target: "allFriends" }],
    ["After you Devour, charge this minion's Evolution by 1", { trigger: "afterDevour", action: "charge", n: 1, target: "self" }],
    ["Battlecry: +1/+1 for each minion you played this game", { trigger: "battlecry", action: "buff", target: "self", a: 1, h: 1, per: "played" }],
    ["End of turn: +1/+1 for each spell cast this game", { trigger: "endOfTurn", action: "buff", target: "self", a: 1, h: 1, per: "spells" }],
    ["Aura: your stat effects give +1/+1 more", { trigger: "passive", action: "buffBoost", a: 1, h: 1 }],
    ["Aura: tavern spells give +1/+1 more", { trigger: "passive", action: "spellBoost", a: 1, h: 1 }],
    ["Battlecry: a friend's stat effects give +1/+1 more", { trigger: "battlecry", action: "empower", target: "randomFriend", count: 1, a: 1, h: 1 }],
    ["Battlecry: +2/+2 to your minions that give stats", { trigger: "battlecry", action: "buff", target: "buffers", a: 2, h: 2 }],
    ["Battlecry: +1/+1 to all your minions", { trigger: "battlecry", action: "buff", target: "allFriends", a: 1, h: 1 }],
    ["Battlecry: Discover a minion", { trigger: "battlecry", action: "discover", tierMode: "current" }],
    ["Pulse: give a random other friendly minion +1/+1", { trigger: "pulse", action: "buff", target: "randomFriend", count: 1, a: 1, h: 1 }],
    ["Pulse: gain 1 gold (once per turn)", { trigger: "pulse", action: "gold", n: 1, limit: "turn" }],
    ["Pulse: charge the Evolution of your other minions by 1", { trigger: "pulse", action: "charge", target: "allFriends", n: 1 }],
    ["Pulse: your next Pulse effect triggers twice", { trigger: "pulse", action: "pulseDouble", n: 1 }],
    ["Every 3 Pulses: add a Coral Sprout to your hand", { trigger: "pulse", action: "addCard", card: "coral_sprout", count: 1, every: 3 }],
    ["Deathrattle: summon two 1/1s", { trigger: "deathrattle", action: "summon", card: "pup", count: 2 }],
    ["Deathrattle: 3 damage to an enemy", { trigger: "deathrattle", action: "damage", target: "randomEnemy", count: 1, n: 3 }],
    ["Start of Combat: 2 damage to all enemies", { trigger: "startOfCombat", action: "damage", target: "allEnemies", n: 2 }],
    ["End of turn: this gains +1/+1", { trigger: "endOfTurn", action: "buff", target: "self", a: 1, h: 1 }],
    ["Avenge (3): your minions +1/+1", { trigger: "onAllyDeath", every: 3, action: "buff", target: "allFriends", a: 1, h: 1 }],
    ["On attack: +2 Attack for good", { trigger: "onAttack", action: "permBuff", target: "self", a: 2, h: 0 }],
    ["After you buy a minion: +1/+1", { trigger: "onBuy", action: "buff", target: "self", a: 1, h: 1 }],
    ["After you cast a spell: +1/+1 to a friend", { trigger: "onSpell", action: "buff", target: "randomFriend", count: 1, a: 1, h: 1 }],
    ["When sold: gain 2 gold", { trigger: "onSell", action: "gold", n: 2 }],
    ["After a win: this gains +2/+2", { trigger: "afterWin", action: "buff", target: "self", a: 2, h: 2 }],
    ["Aura: Battlecries trigger twice", { trigger: "passive", action: "extraBattlecry", n: 1 }],
    ["Aura: Deathrattles trigger twice", { trigger: "passive", action: "extraDeathrattle", n: 1 }],
    ["Aura: end of turn effects trigger twice", { trigger: "passive", action: "extraEndOfTurn", n: 1 }],
    ["Aura: summoned minions get +2/+2", { trigger: "passive", action: "summonBuff", a: 2, h: 2 }],
    ["Aura: Refreshes are free", { trigger: "passive", action: "rollDiscount", n: 1 }],
    ["Start of Combat: enemies become 1/1", { trigger: "startOfCombat", action: "setStats", target: "allEnemies", a: 1, h: 1 }],
    ["Start of Combat: strip enemy Shields", { trigger: "startOfCombat", action: "removeKeyword", kw: "shield", target: "allEnemies" }],
    ["Overkill: double this minion's Attack", { trigger: "onOverkill", action: "doubleStats", stat: "attack", target: "self" }],
    ["Last one standing: attack again at once", { trigger: "onLastStanding", action: "attackNow", target: "self" }],
    ["When a friend dies, summon a 1-Health copy", { trigger: "onAllyDeath", action: "summonCopy", target: "trigger", count: 1, h: 1, every: 2 }],
    ["Deathrattle: 5 damage to the enemy hero", { trigger: "deathrattle", action: "heroDamage", n: 5 }],
    ["Battlecry: make a friend golden", { trigger: "battlecry", action: "makeGolden", target: "randomFriend", count: 1 }],
    ["Battlecry: transform a friend into a tier 6", { trigger: "battlecry", action: "transform", target: "randomFriend", count: 1, tier: 6 }],
    ["End of turn: steal a tavern minion", { trigger: "endOfTurn", action: "stealShop", count: 1 }],
    ["Swap this minion's Attack and Health", { trigger: "battlecry", action: "swapStats", target: "self" }],
    ["After each Battlecry you play: +1/+1", { trigger: "onPlayBattlecry", action: "buff", target: "self", a: 1, h: 1 }],
    ["On attack: lightning hits another enemy for 2", { trigger: "onAttack", action: "damage", target: "randomEnemy", count: 1, n: 2, fx: "lightning" }],
    ["When a friend attacks, heal it for 2", { trigger: "onFriendlyAttack", action: "healN", target: "trigger", n: 2, fx: "nature" }],
    ["When damaged, throw frost for 1", { trigger: "onDamaged", action: "damage", target: "randomEnemy", count: 1, n: 1, fx: "frost" }],
    ["Start of Combat: fire on all enemies for 1", { trigger: "startOfCombat", action: "damage", target: "allEnemies", n: 1, fx: "fire" }],
    ["After a friend dies, heal your minions 2", { trigger: "onAllyDeath", action: "healN", target: "allFriends", n: 2, fx: "nature" }],
    ["Battlecry: give a random friend a random keyword", { trigger: "battlecry", action: "randomKeyword", target: "randomFriend", count: 1 }],
    ["After you play a Battlecry minion, trigger it again (every 3)", { trigger: "onPlayBattlecry", action: "repeatBattlecry", every: 3 }],
    ["When you sell this, give its stats to a random friend", { trigger: "onSell", action: "passStats", target: "randomFriend", count: 1 }],
    ["Start of Combat: steal an enemy minion", { trigger: "startOfCombat", action: "steal", count: 1 }],
    ["Start of Combat: silence the enemy's leftmost minion", { trigger: "startOfCombat", action: "silence", target: "leftmost" }],
    ["When a friend dies, resurrect it (every 2)", { trigger: "onAllyDeath", action: "resurrect", count: 1, every: 2 }],
    ["Deathrattle: resurrect a fallen friend with 1 Health", { trigger: "deathrattle", action: "resurrect", count: 1, h: 1 }],
    ["After this kills a minion, gain 1 gold next turn", { trigger: "onKill", action: "combatGold", n: 1 }],
    ["After this survives a combat, gain +2/+2", { trigger: "afterSurvive", action: "buff", target: "self", a: 2, h: 2 }],
    ["After each combat, give a friend +1/+1", { trigger: "afterCombat", action: "buff", target: "randomFriend", count: 1, a: 1, h: 1 }],
    ["After you Discover, gain +2/+2", { trigger: "onDiscover", action: "buff", target: "self", a: 2, h: 2 }],
    ["After an enemy is summoned, hit it for 2", { trigger: "onEnemySummon", action: "damage", target: "trigger", n: 2, fx: "arrow" }],
    ["Battlecry: move this to the front", { trigger: "battlecry", action: "reposition", where: "front", target: "self" }],
    ["Start of Combat: shuffle the enemy warband", { trigger: "startOfCombat", action: "shuffleEnemies" }],
    ["From turn 5 on, end of turn: +3/+3", { trigger: "endOfTurn", action: "buff", target: "self", a: 3, h: 3, minTurn: 5 }],
    ["If your hero is at 10 or less Health, Start of Combat: your minions +2/+2", { trigger: "startOfCombat", action: "buff", target: "allFriends", a: 2, h: 2, cond: "lowHealth" }],
    ["Battlecry: eat a friend and gain its stats", { trigger: "battlecry", action: "sacrifice", target: "randomFriend", count: 1, give: "self" }],
    ["Battlecry: Devour a friendly minion (full stats)", { trigger: "battlecry", action: "devour", target: "self", count: 1, devourFrom: "board" }],
    ["When this is Devoured, the eater gets +2/+2", { trigger: "onDevoured", action: "buff", target: "trigger", a: 2, h: 2 }],
    ["When this is Devoured, the eater gets Taunt", { trigger: "onDevoured", action: "keyword", kw: "taunt", target: "trigger" }],
    ["When this is Devoured, your hero loses 3 Health", { trigger: "onDevoured", action: "hero", n: -3 }],
    ["When this is Devoured, add a copy of it to your hand", { trigger: "onDevoured", action: "addCopy", target: "self" }],
    ["Start of Combat: Devour a random enemy", { trigger: "startOfCombat", action: "devourEnemy", count: 1, share: "full", fx: "shadow" }],
    ["After this kills a minion, Devour another enemy", { trigger: "onKill", action: "devourEnemy", count: 1, share: "full" }],
    ["Aura: Devouring gives +2/+2 extra", { trigger: "passive", action: "devourBonus", a: 2, h: 2 }],
    ["Aura: Devoured minions pass on their keywords", { trigger: "passive", action: "devourKeywords" }],
    ["After you Devour, the eater gets Windfury", { trigger: "afterDevour", action: "keyword", kw: "windfury", target: "trigger" }],
    ["End of turn: +1/+1 for each minion you Devoured this game", { trigger: "endOfTurn", action: "buff", target: "self", a: 1, h: 1, per: "devours" }],
    ["Only if fed: Start of Combat, 3 damage to 2 enemies", { trigger: "startOfCombat", action: "damage", target: "randomEnemy", count: 2, n: 3, cond: "fed", fx: "fire" }],
    ["Aura: frozen tavern minions get +1/+1 each turn", { trigger: "passive", action: "frozenBuff", a: 1, h: 1 }],
    ["Battlecry: give your minions +1/+1 for each gold you have", { trigger: "battlecry", action: "buff", target: "allFriends", a: 1, h: 1, per: "gold" }],
  ];
  const QUICK_SPELL = [
    ["Give a minion +3/+3", { trigger: "cast", action: "buff", target: "chosen", a: 3, h: 3 }],
    ["The chosen minion Devours a tavern minion", { trigger: "cast", action: "devour", target: "chosen", count: 1 }],
    ["Give a minion a random keyword", { trigger: "cast", action: "randomKeyword", target: "chosen" }],
    ["Your next 2 minions are free", { trigger: "cast", action: "freeBuy", n: 2 }],
    ["Gain 1 to 4 gold", { trigger: "cast", action: "goldRandom", n: 4 }],
    ["Discover a minion from a random tier", { trigger: "cast", action: "discover", tierMode: "random" }],
    ["Give your minions +1/+1", { trigger: "cast", action: "buff", target: "allFriends", a: 1, h: 1 }],
    ["Give a minion Shield", { trigger: "cast", action: "keyword", target: "chosen", kw: "shield" }],
    ["Gain 2 gold", { trigger: "cast", action: "gold", n: 2 }],
    ["Discover a minion", { trigger: "cast", action: "discover", tierMode: "current" }],
    ["Add 2 random minions to your hand", { trigger: "cast", action: "addMinion", count: 2 }],
    ["Summon a random minion", { trigger: "cast", action: "summonRandom", count: 1 }],
    ["Next upgrade costs 3 less", { trigger: "cast", action: "upgradeDiscount", n: 3 }],
    ["Make a minion golden", { trigger: "cast", action: "makeGolden", target: "chosen" }],
    ["Double a minion's stats", { trigger: "cast", action: "doubleStats", stat: "both", target: "chosen" }],
    ["Summon a copy of a minion", { trigger: "cast", action: "summonCopy", target: "chosen", count: 1 }],
    ["Upgrade the tavern for free", { trigger: "cast", action: "freeUpgrade" }],
    ["Give minions in your hand +2/+2", { trigger: "cast", action: "buffHand", a: 2, h: 2 }],
    ["Give a minion “Deathrattle: summon two 1/1s”", { trigger: "cast", action: "grantEffect", target: "chosen", grant: { trigger: "deathrattle", action: "summon", card: "pup", count: 2 } }],
    ["Give a minion “On attack: lightning for 2”", { trigger: "cast", action: "grantEffect", target: "chosen", grant: { trigger: "onAttack", action: "damage", target: "randomEnemy", count: 1, n: 2, fx: "lightning" } }],
    ["Return a minion to your hand", { trigger: "cast", action: "bounce", target: "chosen" }],
    ["Turn a minion into a Dragon", { trigger: "cast", action: "setTribe", target: "chosen", toTribe: "Dragon" }],
    ["Sacrifice a minion, a friend gets its stats", { trigger: "cast", action: "sacrifice", target: "chosen", give: "random" }],
    ["Next combat: your minions get +2/+2", { trigger: "cast", action: "nextCombatBuff", a: 2, h: 2 }],
    ["Next combat: lightning hits 3 enemies for 2", { trigger: "cast", action: "nextCombatStrike", n: 2, spread: "random", count: 3, fx: "lightning" }],
    ["Next combat: fire on all enemies for 1", { trigger: "cast", action: "nextCombatStrike", n: 1, spread: "all", fx: "fire" }],
    ["Take a minion from the tavern for free", { trigger: "cast", action: "stealShop", count: 1 }],
    ["Refresh the tavern for free", { trigger: "cast", action: "refreshShop" }],
    ["Silence a minion", { trigger: "cast", action: "silence", target: "chosen" }],
    ["Move a minion to the front", { trigger: "cast", action: "reposition", where: "front", target: "chosen" }],
    ["Give a minion “After this survives a combat, gain +2/+2”", { trigger: "cast", action: "grantEffect", target: "chosen", grant: { trigger: "afterSurvive", action: "buff", target: "self", a: 2, h: 2 } }],
    ["Give a minion “Start of Combat: steal an enemy minion”", { trigger: "cast", action: "grantEffect", target: "chosen", grant: { trigger: "startOfCombat", action: "steal", count: 1 } }],
    ["The chosen minion Devours 2 tavern minions", { trigger: "cast", action: "devour", target: "chosen", count: 2 }],
    ["The chosen minion Devours a friendly minion", { trigger: "cast", action: "devour", target: "chosen", count: 1, devourFrom: "board" }],
    ["Give a minion “Start of Combat: Devour a random enemy”", { trigger: "cast", action: "grantEffect", target: "chosen", grant: { trigger: "startOfCombat", action: "devourEnemy", count: 1, share: "full", fx: "shadow" } }],
    ["Give a minion “When this is Devoured, the eater gets +4/+4”", { trigger: "cast", action: "grantEffect", target: "chosen", grant: { trigger: "onDevoured", action: "buff", target: "trigger", a: 4, h: 4 } }],
    ["Make a minion in your hand golden", { trigger: "cast", action: "goldenHand", count: 1 }],
    ["Give a minion +1/+1 for each gold you have", { trigger: "cast", action: "buff", target: "chosen", a: 1, h: 1, per: "gold" }],
  ];
  // level effects for an affinity: "@" stands for the affinity being edited
  const QUICK_AFF = [
    ["Level 1 · end of turn: your minions of this affinity +1/+1", { trigger: "endOfTurn", action: "buff", target: "allFriends", taff: "@", a: 1, h: 1, alv: 1 }],
    ["Level 2 · start of combat: they gain Shield", { trigger: "startOfCombat", action: "keyword", kw: "shield", target: "allFriends", taff: "@", alv: 2 }],
    ["Level 1 · start of combat: 2 damage to a random enemy", { trigger: "startOfCombat", action: "damage", target: "randomEnemy", count: 1, n: 2, alv: 1, fx: "fire" }],
    ["Level 2 · start of combat: your minions of this affinity +3/+0", { trigger: "startOfCombat", action: "buff", target: "allFriends", taff: "@", a: 3, h: 0, alv: 2 }],
    ["Level 1 · after you play one: gain 1 gold (once a turn)", { trigger: "onPlayOther", faff: "@", action: "gold", n: 1, limit: "turn", alv: 1 }],
    ["Level 1 · after you buy one: give it +1/+1", { trigger: "onBuy", faff: "@", action: "buff", target: "trigger", a: 1, h: 1, alv: 1 }],
    ["Level 2 · start of turn: refresh the tavern for free", { trigger: "startOfTurn", action: "freeRoll", n: 1, alv: 2 }],
    ["Level 3 · start of combat: random keywords to 2 of your minions", { trigger: "startOfCombat", action: "randomKeyword", target: "randomFriend", count: 2, alv: 3 }],
    ["Level 2 · after you sell one: your others of this affinity +1/+1", { trigger: "onSellOther", faff: "@", action: "buff", target: "allFriends", taff: "@", a: 1, h: 1, alv: 2 }],
    ["Level 3 · end of turn: gain 2 Armor", { trigger: "endOfTurn", action: "armor", n: 2, alv: 3 }],
  ];
  // effects every minion of an affinity carries ("@" = this affinity): build your own mechanics
  const QUICK_CARRY = [
    ["Battlecry: trigger the Battlecries of the adjacent minions of this affinity (your own Pulse)", { trigger: "battlecry", action: "fireTrigger", trig: "battlecry", target: "adjacent", taff: "@", alv: 1 }],
    ["Battlecry: give your other minions of this affinity +1/+1", { trigger: "battlecry", action: "buff", target: "allFriends", taff: "@", a: 1, h: 1, alv: 1 }],
    ["Deathrattle: give a random friend of this affinity +2/+2", { trigger: "deathrattle", action: "buff", target: "randomFriend", taff: "@", count: 1, a: 2, h: 2, alv: 1 }],
    ["Deathrattle: trigger the Deathrattles of the adjacent minions (level 3)", { trigger: "deathrattle", action: "fireTrigger", trig: "deathrattle", target: "adjacent", alv: 3 }],
    ["Whenever this attacks: your others of this affinity +1/+0", { trigger: "onAttack", action: "buff", target: "allFriends", taff: "@", a: 1, h: 0, alv: 2 }],
    ["After a friend of this affinity dies: gain +2/+1", { trigger: "onAllyDeath", faff: "@", action: "buff", target: "self", a: 2, h: 1, alv: 1 }],
    ["Start of Combat: gain Shield (level 3)", { trigger: "startOfCombat", action: "keyword", kw: "shield", target: "self", alv: 3 }],
    ["End of turn: gain +1/+1 (level 2)", { trigger: "endOfTurn", action: "buff", target: "self", a: 1, h: 1, alv: 2 }],
    ["When you sell this: your minions of this affinity +1/+1", { trigger: "onSell", action: "buff", target: "allFriends", taff: "@", a: 1, h: 1, alv: 1 }],
    ["Battlecry: give the affinity to an adjacent minion", { trigger: "battlecry", action: "giveAff", aff: "@", target: "adjacent", alv: 1 }],
  ];
  const QUICK_HERO = [
    ["End of turn: your leftmost minion +1/+1", { trigger: "endOfTurn", action: "buff", target: "leftmost", a: 1, h: 1, fx: "nature" }],
    ["Start of Combat: 1 damage to 2 enemies", { trigger: "startOfCombat", action: "damage", target: "randomEnemy", count: 2, n: 1, fx: "fire" }],
    ["Start of Combat: lightning on all enemies for 1", { trigger: "startOfCombat", action: "damage", target: "allEnemies", n: 1, fx: "lightning" }],
    ["Start of Combat: your minions +1/+0", { trigger: "startOfCombat", action: "buff", target: "allFriends", a: 1, h: 0 }],
    ["After you buy a minion, give it +1/+1", { trigger: "onBuy", action: "buff", target: "trigger", a: 1, h: 1 }],
    ["After you sell 2 minions, gain 1 gold", { trigger: "onSellOther", action: "gold", n: 1, every: 2 }],
    ["After you play a Battlecry minion, +1/+1 to it", { trigger: "onPlayBattlecry", action: "buff", target: "trigger", a: 1, h: 1 }],
    ["After you upgrade, Discover a minion", { trigger: "afterUpgrade", action: "discover", tierMode: "current" }],
    ["After a loss, gain 2 gold next turn", { trigger: "afterLoss", action: "nextGold", n: 2 }],
    ["Every 3 turns, add a random spell to your hand", { trigger: "startOfTurn", action: "addSpell", count: 1, every: 3 }],
  ];
  QUICK_HERO.push(
    ["Rule: minions cost 1 gold less", { trigger: "gameStart", action: "ruleBuy", n: -1 }],
    ["Rule: the tavern shows 1 more minion", { trigger: "gameStart", action: "ruleShop", n: 1 }],
    ["Rule: keep up to 3 unspent gold", { trigger: "gameStart", action: "ruleBank", n: 3 }],
    ["Start with 8 Armor", { trigger: "gameStart", action: "armor", n: 8 }],
    ["After a loss, copy a minion of your opponent", { trigger: "afterLoss", action: "copyOpponent", count: 1 }],
    ["Every 4 turns, make a tavern minion golden", { trigger: "startOfTurn", action: "goldenShop", count: 1, every: 4 }]);
  QUICK_HERO.push(
    ["Every 2 turns, pickpocket 1 gold from your next opponent", { trigger: "startOfTurn", action: "stealGold", n: 1, every: 2 }],
    ["Every 3rd Battlecry you play triggers twice", { trigger: "onPlayBattlecry", action: "repeatBattlecry", every: 3 }],
    ["After you sell a minion, a random friend inherits its stats", { trigger: "onSellOther", action: "passStats", target: "randomFriend", count: 1 }],
    ["After a win, copy a minion of your next opponent", { trigger: "afterWin", action: "copyNextOpponent", count: 1 }],
    ["Start of Combat: swap your minions' Attack and Health", { trigger: "startOfCombat", action: "swapStats", target: "allFriends" }],
    ["Start of Combat: 2 random keywords on your minions", { trigger: "startOfCombat", action: "randomKeyword", target: "randomFriend", count: 2 }],
    ["Gain 1 gold for each Beast (end of turn)", { trigger: "endOfTurn", action: "nextGold", n: 1, per: "friend", perTribe: "Beast" }],
    ["Rule: two copies make a golden minion", { trigger: "gameStart", action: "ruleTriple" }],
    ["Rule: Devouring gives full stats", { trigger: "gameStart", action: "ruleDevour" }],
    ["After you Devour, gain 1 gold", { trigger: "afterDevour", action: "gold", n: 1 }],
    ["Rule: take 2 less damage from fights", { trigger: "gameStart", action: "ruleDamage", n: -2 }],
    ["After each combat, gain 1 gold next turn", { trigger: "afterCombat", action: "nextGold", n: 1 }],
    ["After you Discover, the minion gets +1/+1", { trigger: "onDiscover", action: "buff", target: "trigger", a: 1, h: 1 }],
    ["Comeback: at 10 or less Health, +2 gold each turn", { trigger: "startOfTurn", action: "gold", n: 2, cond: "lowHealth" }],
    ["From turn 6 on, Start of Combat: your minions +1/+1", { trigger: "startOfCombat", action: "buff", target: "allFriends", a: 1, h: 1, minTurn: 6 }]);
  const QUICK_HERO_ACTIVE = [
    ["The chosen minion Devours a tavern minion", { trigger: "cast", action: "devour", target: "chosen", count: 1 }],
    ["Roll the dice: gain 1 to 3 gold", { trigger: "cast", action: "goldRandom", n: 3 }],
    ["Refresh with your tribe only", { trigger: "cast", action: "tribeShop", tribeMode: "main" }],
    ["Pickpocket 2 gold from your next opponent", { trigger: "cast", action: "stealGold", n: 2, limit: "game" }],
    ["Shuffle your warband", { trigger: "cast", action: "shuffleBoard" }],
    ["Give a minion +1/+2", { trigger: "cast", action: "buff", target: "chosen", a: 1, h: 2 }],
    ["Refresh with minions one tier higher", { trigger: "cast", action: "refreshUp", n: 1 }],
    ["Make a random tavern minion golden", { trigger: "cast", action: "goldenShop", count: 1 }],
    ["Gain 4 Armor", { trigger: "cast", action: "armor", n: 4 }],
    ["Once per game: gain 6 gold", { trigger: "cast", action: "gold", n: 6, limit: "game" }],
    ["Once per game: your Refreshes cost 0", { trigger: "cast", action: "ruleRoll", n: -1, limit: "game" }],
    ["Turn a minion into the tribe you pick", { trigger: "cast", action: "setTribe", target: "chosen", toTribe: "?" }],
    ["Copy a minion from your last opponent", { trigger: "cast", action: "copyOpponent", count: 1 }],
    ["Discover a minion", { trigger: "cast", action: "discover", tierMode: "current" }],
    ["Silence one of your minions", { trigger: "cast", action: "silence", target: "chosen" }],
    ["Move a minion to the front", { trigger: "cast", action: "reposition", where: "front", target: "chosen" }],
    ["Once per game: two copies make a golden minion", { trigger: "cast", action: "ruleTriple", limit: "game" }],
  ];
  const QUICK_ANOMALY = [
    ["Topsy-Turvy: Start of Combat, every minion swaps Attack and Health", { trigger: "startOfCombat", action: "swapStats", target: "allFriends" }],
    ["Tribal Fair: every 2 turns the tavern shows one tribe only", { trigger: "startOfTurn", action: "tribeShop", tribeMode: "random", every: 2 }],
    ["Fortune Teller: every 3 turns, Discover from a random tier", { trigger: "startOfTurn", action: "discover", tierMode: "random", every: 3 }],
    ["Wild Blessings: Start of Combat, 2 random keywords", { trigger: "startOfCombat", action: "randomKeyword", target: "randomFriend", count: 2 }],
    ["Grand Opening: every 3 turns, a free minion", { trigger: "startOfTurn", action: "freeBuy", n: 1, every: 3 }],
    ["Thieves' Guild: every turn, pickpocket 1 gold", { trigger: "startOfTurn", action: "stealGold", n: 1 }],
    ["Inheritance: sold minions pass on their stats", { trigger: "onSellOther", action: "passStats", target: "randomFriend", count: 1 }],
    ["Echo Chamber: every 2nd Battlecry triggers twice", { trigger: "onPlayBattlecry", action: "repeatBattlecry", every: 2 }],
    ["Chaos: shuffle every warband at the end of each turn", { trigger: "endOfTurn", action: "shuffleBoard" }],
    ["Everyone gets the minion one player picks", { trigger: "startOfTurn", action: "sharedPick", pickTier: "any", pct: 25, count: 3 }],
    ["Minions cost 2 gold", { trigger: "gameStart", action: "ruleBuy", n: -1 }],
    ["Refreshes are free", { trigger: "gameStart", action: "ruleRoll", n: -1 }],
    ["Tavern minions may be golden (15%)", { trigger: "gameStart", action: "ruleGolden", pct: 15 }],
    ["Everyone starts at tavern tier 2", { trigger: "gameStart", action: "freeUpgrade" }],
    ["Upgrades cost 2 less", { trigger: "gameStart", action: "ruleUpgrade", n: -2 }],
    ["2 extra gold every turn", { trigger: "gameStart", action: "ruleIncome", n: 2 }],
    ["Gold limit 15", { trigger: "gameStart", action: "ruleMaxGold", n: 5 }],
    ["The tavern shows 2 more minions", { trigger: "gameStart", action: "ruleShop", n: 2 }],
    ["Discover shows 5 choices", { trigger: "gameStart", action: "ruleDiscover", n: 2 }],
    ["Heroes start with 10 Armor", { trigger: "gameStart", action: "armor", n: 10 }],
    ["Every turn, a random spell in hand", { trigger: "startOfTurn", action: "addSpell", count: 1 }],
    ["Every 3 turns, a free Discover", { trigger: "startOfTurn", action: "discover", tierMode: "current", every: 3 }],
    ["Start of Combat: 1 damage to all enemy minions", { trigger: "startOfCombat", action: "damage", target: "allEnemies", n: 1, fx: "shadow" }],
    ["After you win, lose 1 Health (anti-snowball)", { trigger: "afterWin", action: "hero", n: -1 }],
    ["After you upgrade, the tavern turns golden for a moment", { trigger: "afterUpgrade", action: "goldenShop", count: 2 }],
    ["Pairs: two copies make a golden minion", { trigger: "gameStart", action: "ruleTriple" }],
    ["Feast: Devouring gives full stats", { trigger: "gameStart", action: "ruleDevour" }],
    ["Thick Skin: everyone takes 2 less damage from fights", { trigger: "gameStart", action: "ruleDamage", n: -2 }],
    ["Bloodbath: everyone takes 2 more damage from fights", { trigger: "gameStart", action: "ruleDamage", n: 2 }],
    ["Late Bloom: from turn 7, every warband gets +2/+2 at Start of Combat", { trigger: "startOfCombat", action: "buff", target: "allFriends", a: 2, h: 2, minTurn: 7 }],
    ["Underdog: at 10 or less Health, 3 extra gold each turn", { trigger: "startOfTurn", action: "gold", n: 3, cond: "lowHealth" }],
    ["Fog of War: Start of Combat, every enemy warband is shuffled", { trigger: "startOfCombat", action: "shuffleEnemies" }],
    ["Grave Robbers: after each combat, everyone gains 1 gold next turn", { trigger: "afterCombat", action: "nextGold", n: 1 }],
  ];
  const quickFor = (r) => (isAff(r) ? (quickOpen === "carry" ? QUICK_CARRY : QUICK_AFF) : isAnom(r) ? QUICK_ANOMALY : heroPassive(r) ? QUICK_HERO : isHero(r) ? QUICK_HERO_ACTIVE : spellLike(r) ? QUICK_SPELL : QUICK_MINION);
  let quickOpen = false;
  let folded = new Set(); // effect cards shown as a one-line summary
  function quickPanel(r) {
    const list = quickFor(r);
    return `<div class="ce-quick"><div class="ce-quick-head"><b>Pick a starting point</b><span>You can change every part of it afterwards.</span><input id="ceQuickSearch" type="search" placeholder="Filter, e.g. steal, gold, Deathrattle" autocomplete="off" aria-label="Filter starting points"></div>
      <div class="ce-quick-grid">${list.map(([l, ab], i) => `<button type="button" class="ce-qbtn" data-quick="${i}" data-words="${esc((l + " " + W.abilityText(ab, false) + " " + ab.trigger + " " + ab.action).toLowerCase())}">${esc(l)}</button>`).join("")}
      <button type="button" class="ce-qbtn blank" data-quick="-1">Start from scratch</button></div><div class="ce-quick-none ce-empty small" hidden>Nothing matches. Pick “Start from scratch” and build it from the menus.</div>
      <button type="button" class="ce-link" data-quick-close>Cancel</button></div>`;
  }

  // the counter and signal names used anywhere in the meta, offered as suggestions
  function labNames() {
    const vars = new Set(["Charge"]), sigs = new Set();
    const scan = (abs) => (abs || []).forEach((x) => { if (!x) return; for (const k of ["vname", "wVar", "perVar"]) if (x[k]) vars.add(String(x[k]).trim()); for (const k of ["sig", "sigOut"]) if (x[k]) sigs.add(String(x[k]).trim()); if (x.grant) scan([x.grant]); });
    for (const c of work || []) scan(c.abilities); if (cur) scan(cur.abilities);
    return { vars: [...vars].filter(Boolean), sigs: [...sigs].filter(Boolean) };
  }
  const txtIn = (k, v, i, label, list, ph) => `<label class="ce-sel ce-txt">${label}<input type="text" data-i="${i}" data-k="${k}" value="${esc(v || "")}" maxlength="16" placeholder="${esc(ph || "")}" list="${list}" autocomplete="off"></label>`;
  function labLists() { const n = labNames(); return `<datalist id="ceVarNames">${n.vars.map((x) => `<option value="${esc(x)}">`).join("")}</datalist><datalist id="ceSigNames">${n.sigs.map((x) => `<option value="${esc(x)}">`).join("")}</datalist>`; }
  function abilityRow(ab, i, r) {
    const f = ACTIONS[ab.action] ? ACTIONS[ab.action].fields : [];
    const t = TRIGGERS[ab.trigger] || {}, phase = phaseOf(ab);
    const tag = ab.carry ? "Carried · Level " + (ab.alv || 1) : isAff(r) ? "Level " + (ab.alv || 1) + (ab.trigger === "startOfCombat" ? " · Combat" : "") : powerLike(r) ? (ab.trigger === "startOfCombat" ? "Combat" : /^rule/.test(ab.action) ? "Rule" : isAnom(r) ? "Anomaly" : "Hero") : phase === "combat" ? "Combat" : phase === "passive" ? "Aura" : isSpell(r) ? "Spell" : "Tavern";
    let h = `<div class="ce-ab ph-${phase || "tavern"}${folded.has(i) ? " folded" : ""}" data-row="${i}">
      <div class="ce-ab-head"><button type="button" class="ce-fold" data-fold="${i}" aria-expanded="${!folded.has(i)}" title="Show or hide the details"><i></i></button><span class="ce-ab-tag">${tag}</span><span class="ce-ab-text">${esc(W.abilityText(ab, false)) || "<i>Unfinished effect</i>"}</span>
        <button type="button" class="ce-mini" data-up="${i}" title="Move up"${i ? "" : " disabled"}>▲</button><button type="button" class="ce-mini" data-down="${i}" title="Move down"${i < r.abilities.length - 1 ? "" : " disabled"}>▼</button><button type="button" class="ce-mini" data-dup="${i}" title="Duplicate this effect">⧉</button><button type="button" class="ce-mini del" data-del="${i}" title="Remove this effect">✕</button></div>
      <div class="ce-ab-steps">`;
    // 1. when
    h += `<div class="ce-stepbox"><div class="ce-stepn">When</div>`;
    h += spellLike(r) ? `<div class="ce-fixed">${isHero(r) ? "The power is used" : "The spell is cast"}</div>` : gsel("trigger", triggerGroups(r, ab.trigger), ab.trigger, i, "", true);
    if (t.filter) h += sel("ftribe", [["", "Any minion counts"], ...W.TRIBES.map((x) => [x, "Only " + TN(x) + "s count"])], ab.ftribe || "", i, "");
    if (t.filter) h += sel("ftok", [["", "Tokens or not"], ["only", "Only tokens count"], ["no", "Tokens don't count"]], ab.ftok || "", i, "") + sel("fmk", [["", "With or without markers"], ["any", "Only if it carries markers"], ["stat", "Only if it carries stat markers"], ...Object.entries(KW_TEXT).filter(([k]) => k !== "magnetic").map(([k, l]) => [k, "Only if it carries a " + l + " marker"])], ab.fmk || "", i, "");
    if (t.filter && (W.affOn() || ab.faff)) h += sel("faff", [["", "Any affinity counts"], ...W.AFFS.map((x) => [x, "Only " + W.affName(x) + " minions count"])], ab.faff || "", i, "");
    if (isAff(r) || ab.carry) h += sel("alv", [["1", "From level 1"], ["2", "From level 2"], ["3", "From level 3" + (r.t3 ? "" : " (turn level 3 on)")]], String(ab.alv || 1), i, "Unlocks");
    if (ab.trigger === "activate") h += num("actCost", ab.actCost == null ? 1 : ab.actCost, 0, 10, "Gold cost", i);
    if (ab.trigger === "onReach") h += sel("stat", [["either", "Attack or Health"], ["attack", "Attack"], ["health", "Health"]], ab.stat || "either", i, "Watches") + num("at", ab.at || 5, 1, 99, "Reaches", i);
    if (ab.trigger === "work") h += num("at", ab.at || 3, 1, 20, "Activations", i);
    if (ab.trigger === "onAge") h += num("at", ab.at || 3, 1, 30, "Turns on the board", i) + `<label class="ce-check small"><input type="checkbox" data-i="${i}" data-k="rep" ${ab.rep ? "checked" : ""}> Again every N turns after that</label>`;
    if (ab.trigger === "evoFull") {
      h += num("at", ab.at || 3, 1, 30, "Charges needed", i) + sel("src", evoSrcPairs(r), ab.src || "", i, "Charges +1", true);
      if (ab.src && TRIGGERS[ab.src] && TRIGGERS[ab.src].filter) h += sel("stribe", [["", "Any minion counts"], ...W.TRIBES.map((x) => [x, "Only " + TN(x) + "s count"])], ab.stribe || "", i, "");
      h += `<label class="ce-check small"><input type="checkbox" data-i="${i}" data-k="rep" ${ab.rep ? "checked" : ""}> Can evolve again (the crystal empties and refills)</label>`;
      if (ab.rep) h += num("inc", ab.inc || 0, 0, 10, "Each time, needs N more", i);
    }
    if (ab.trigger === "onSignal" || ab.trigger === "onSignalC") h += txtIn("sig", ab.sig, i, "Listens to", "ceSigNames", "e.g. Storm");
    if (TRIG_HELP[ab.trigger]) h += `<p class="ce-help">${TRIG_HELP[ab.trigger]}</p>`;
    h += `</div>`;
    // 2. do
    h += `<div class="ce-stepbox"><div class="ce-stepn">Do</div>${gsel("action", actionGroups(ab, r), ab.action, i, "", true)}${ACTION_HELP[ab.action] ? `<p class="ce-help">${ACTION_HELP[ab.action]}</p>` : ""}${/^pick/.test(ab.target || "") || /Pick$/.test(ab.devourFrom || "") ? `<p class="ce-help">${PICK_HELP}</p>` : ""}<div class="ce-fields">`;
    if (f.includes("a") && !(f.includes("sfrom") && ab.sfrom)) h += num("a", ab.a || 0, 0, 99, "Attack", i) + num("h", ab.h || 0, 0, 99, "Health", i);
    if (f.includes("aff")) h += sel("aff", W.AFFS.map((x) => [x, W.affName(x) + " · " + W.affMech(x)]), ab.aff, i, "Affinity");
    if (f.includes("trig")) h += sel("trig", (phaseOf(ab) === "combat" ? W.FIRE_COMBAT : W.FIRE_TAVERN).map((x) => [x, TRIGGERS[x].label]), ab.trig, i, "Their effects", true);
    if (f.includes("kw")) h += sel("kw", Object.entries(KW_TEXT).filter(([k]) => k !== "magnetic").concat(Object.values(W.CKW).filter((k) => !(isKw(r) && k.id === r.id)).map((k) => [k.id, "✦ " + k.name])), ab.kw, i, "Keyword");
    if (f.includes("mkw")) h += sel("mkw", [["random", "A random keyword"], ...Object.entries(KW_TEXT).filter(([k]) => k !== "magnetic")], ab.mkw || "random", i, "Marker");
    if (f.includes("mkind")) h += sel("mkind", [["", "Any marker"], ["p", "Stat markers (+1/+1, +2/+2…)"], ["kw", "Keyword markers"]], ab.mkind || "", i, "Which");
    if (f.includes("mkeep")) h += sel("mkeep", [["", "Take them (they leave the target)"], ["copy", "A copy (the target keeps them)"], ["eat", "Destroy it and take them"]], ab.mkeep || "", i, "How", true);
    if (f.includes("asMk")) h += sel("asMk", [["", "For this combat"], ["1", "As a marker (it stays)"]], ab.asMk ? "1" : "", i, "Kept");
    if (f.includes("upTo")) h += `<label class="ce-check small"><input type="checkbox" data-i="${i}" data-k="upTo" ${ab.upTo ? "checked" : ""}> Up to N: the player chooses how many (0 to N)</label>`;
    if (f.includes("exact")) h += `<label class="ce-check small"><input type="checkbox" data-i="${i}" data-k="exact" ${ab.exact ? "checked" : ""}> Exact copy (its stats, keywords and markers)</label>`;
    if (f.includes("vname")) h += txtIn("vname", ab.vname || "Charge", i, "Counter", "ceVarNames", "e.g. Rage") + sel("scope", [["minion", "On this minion"], ["player", "On you (the player)"]], ab.scope || "minion", i, "Kept") + sel("op", [["add", "Add (a minus takes away)"], ["set", "Set it to"]], ab.op || "add", i, "How");
    if (f.includes("sigOut")) h += txtIn("sigOut", ab.sigOut, i, "Signal", "ceSigNames", "e.g. Storm");
    if (f.includes("n")) h += num("n", ab.n || 0, ab.action === "hero" || ab.action === "ageUp" ? -20 : ab.action === "counter" ? -99 : 0, 99, ({ nextSpellTwice: "Spells", nextBattlecryTwice: "Battlecries", nextSellGold: "Extra gold", devourGold: "Gold", armor: "Armor", ruleBank: "Gold kept", refreshUp: "Tiers higher", goldRandom: "Up to (gold)", freeBuy: "Minions", stealGold: "Gold", damage: "Damage", gold: "Gold", nextGold: "Gold", combatGold: "Gold", freeRoll: "Refreshes", tavernBuff: "Stats", hero: "Health (− loses)", healN: "Health", buyDiscount: "Gold less", rollDiscount: "Gold less", spellDiscount: "Gold less", upgradeDiscount: "Gold less", shopSize: "More minions", nextCombatStrike: "Damage", charge: "Charges", ageUp: "Turns (− younger)", extraAttack: "Extra attacks", mkPlus: "Markers", mkKw: "How many (random)", mkMove: "Markers", mkRemove: "Markers each" }[ab.action] || (/^extra/.test(ab.action) ? "Extra times" : "Amount")), i);
    if (ab.action === "evolve") h += sel("mode", [["", "Forms you pick"], ["random", "Random minions (the player picks one)"]], ab.mode || "", i, "Becomes", true);
    if (ab.action === "evolve" && ab.mode === "random") {
      h += num("count", ab.count || 3, 1, 5, "Choices", i) + sel("rtribe", [["same", "Of its own tribe"], ["", "Any tribe"], ...W.TRIBES.map((x) => [x, TN(x) + "s"])], ab.rtribe == null ? "same" : ab.rtribe, i, "Tribe") + sel("tierUp", [["0", "Its own tier"], ["1", "One tier higher"], ["2", "Two tiers higher"]], String(ab.tierUp == null ? 1 : ab.tierUp), i, "Tier");
    } else if (f.includes("card") && ab.action === "evolve") {
      const opts = (ab.cards && ab.cards.length ? ab.cards : [ab.card || ""]), pairs = summonPairs().filter(([id]) => id !== r.id);
      h += `<div class="ce-choices">${opts.map((id, j) => `<div class="ce-choice">${sel("cards", pairs, id, i, opts.length > 1 ? `Choice ${j + 1}` : "Next form", true).replace('data-k="cards"', `data-k="cards" data-j="${j}"`)}${opts.length > 1 ? `<button type="button" class="ce-mini" data-i="${i}" data-rmchoice="${j}" title="Remove this choice">✕</button>` : ""}</div>`).join("")}
        <button type="button" class="pill small" data-i="${i}" data-addchoice="1">+ Add a choice (the player picks)</button></div>`;
    } else if (f.includes("card")) h += sel("card", summonPairs(), ab.card, i, "Which minion", true);
    if (f.includes("spell")) h += sel("spell", spellPairs(), ab.spell, i, "Which spell", true);
    if (f.includes("muts")) {
      h += sel("mutMode", [["", "Mutations you design"], ["random", "Random from the built-in list"]], ab.rmut > 0 ? "random" : "", i, "Choices", true);
      if (ab.rmut > 0) h += num("rmut", ab.rmut, 1, 5, "How many offered", i) + `<p class="ce-help">Built-in list: ${W.MUT_LIB.map((m) => esc(W.mutLine(m, false))).join(" · ")}</p>`;
      else {
        const kwPairs = [["", "No keyword"], ...Object.entries(KW_TEXT).filter(([k]) => k !== "magnetic")];
        h += `<div class="ce-muts">${(ab.muts || []).map((m, j) => `<div class="ce-mut">
            <div class="ce-mut-head"><input type="text" class="ce-mut-name" data-i="${i}" data-k="mut" data-j="${j}" data-m="name" value="${esc(m.lib ? (W.MUT_LIB.find((x) => x.id === m.lib) || {}).name || "" : m.name || "")}" placeholder="Name, e.g. Shell" maxlength="24"><button type="button" class="ce-mini" data-i="${i}" data-rmmut="${j}" title="Remove this mutation">✕</button></div>
            <div class="ce-fields">${num("a", m.a || 0, 0, 30, "Attack", i).replace('data-k="a"', `data-k="mut" data-j="${j}" data-m="a"`)}${num("h", m.h || 0, 0, 30, "Health", i).replace('data-k="h"', `data-k="mut" data-j="${j}" data-m="h"`)}
            ${sel("mut", kwPairs, m.kw || "", i, "Keyword").replace('data-k="mut"', `data-k="mut" data-j="${j}" data-m="kw"`)}
            <label class="ce-check small"><input type="checkbox" data-i="${i}" data-k="mut" data-j="${j}" data-m="mst" ${m.mst ? "checked" : ""}> Stats as a marker</label>
            <label class="ce-check small"><input type="checkbox" data-i="${i}" data-k="mut" data-j="${j}" data-m="mkw" ${m.mkw ? "checked" : ""}> Keyword as a marker</label>
            ${sel("mut", [["", "No extra effect"], ...QUICK_MINION.map(([l], q) => [q, l])].concat(m.grant && QUICK_MINION.findIndex(([, g]) => JSON.stringify(g) === JSON.stringify(m.grant)) < 0 ? [["keep", "Current: " + W.abilityText(m.grant, false)]] : []), m.grant ? (QUICK_MINION.findIndex(([, g]) => JSON.stringify(g) === JSON.stringify(m.grant)) >= 0 ? QUICK_MINION.findIndex(([, g]) => JSON.stringify(g) === JSON.stringify(m.grant)) : "keep") : "", i, "Extra effect", true).replace('data-k="mut"', `data-k="mut" data-j="${j}" data-m="grant"`)}</div></div>`).join("")}
          <div class="ce-mut-add"><button type="button" class="pill small" data-i="${i}" data-addmut="1">+ Add a mutation</button>${sel("mutPreset", [["", "+ From the built-in list…"], ...W.MUT_LIB.map((m) => [m.id, W.mutLine(m, false)])], "", i, "")}</div></div>`;
        if ((ab.muts || []).length > 1) h += `<p class="ce-help">The player picks one of these when the effect fires. Golden doubles the stats.</p>`;
      }
    }
    if (f.includes("count") && !(ab.action === "evolve" && ab.mode === "random")) h += num("count", ab.count || 1, 1, ab.action === "sharedPick" ? 5 : 7, ab.action === "sharedPick" ? "Choices" : "How many", i);
    if (f.includes("stats")) h += num("a", ab.a || "", 0, 99, "Attack", i, "own") + num("h", ab.h || "", 0, 99, "Health", i, "own");
    if (f.includes("tribe")) h += sel("tribe", [["", "Any tribe"], ...W.TRIBES.map((x) => [x, TN(x)])], ab.tribe || "", i, "Tribe");
    if (f.includes("tier")) h += sel("tier", [["", "Any tier"], ...[1, 2, 3, 4, 5, 6].map((x) => [x, "Tier " + x])], ab.tier || "", i, "Tier");
    if (f.includes("grants")) {
      // several effects lent by the aura: each one picked from the starting points
      const gl = ab.grants || [], idx = (g) => QUICK_MINION.findIndex(([, q]) => JSON.stringify(q) === JSON.stringify(g));
      h += `<div class="ce-choices ce-grants">${gl.map((g, j) => { const gi = idx(g); return `<div class="ce-choice">${sel("grants", QUICK_MINION.map(([l], q) => [q, l]).concat(gi < 0 ? [["", "Current: " + W.abilityText(g, false)]] : []), gi < 0 ? "" : gi, i, `Effect ${j + 1}`, true).replace('data-k="grants"', `data-k="grants" data-j="${j}"`)}<button type="button" class="ce-mini" data-i="${i}" data-rmgrant="${j}" title="Remove this effect">✕</button></div>`; }).join("")}
        <button type="button" class="pill small" data-i="${i}" data-addgrant="1">+ Add an effect to lend</button></div>`;
    }
    if (f.includes("sfrom")) h += sel("sfrom", [["", "A fixed amount"], ["target", "The Attack and Health of… (pick below)"]], ab.sfrom || "", i, "Stats", true);
    if (f.includes("mdir")) h += sel("mdir", [["", "From the targets onto this minion"], ["out", "From this minion onto the targets"]], ab.mdir || "", i, "Move", true);
    if (f.includes("grant")) {
      const gi = QUICK_MINION.findIndex(([, g]) => JSON.stringify(g) === JSON.stringify(ab.grant));
      h += sel("grant", QUICK_MINION.map(([l], j) => [j, l]).concat(gi < 0 && ab.grant ? [["", "Current: " + W.abilityText(ab.grant, false)]] : []), gi < 0 ? "" : gi, i, "The effect to give", true);
    }
    if (f.includes("toTribe")) h += sel("toTribe", [["?", "The player picks (tribes in this game)"], ...tribeOpts()], ab.toTribe || "", i, "New tribe", true);
    if (f.includes("give")) h += sel("give", [["", "Nobody (just destroy it)"], ["random", "A random other friendly minion"], ["adjacent", "The minions next to it"], ...(spellLike(r) || powerLike(r) ? [] : [["self", "This minion"]])], ab.give || "", i, "Its stats go to", true);
    if (f.includes("spread")) h += sel("spread", [["random", "Random enemies"], ["all", "All enemies"]], ab.spread || "random", i, "Who");
    if (f.includes("stat")) h += sel("stat", [["attack", "Attack"], ["health", "Health"], ["both", "Attack and Health"]], ab.stat || "attack", i, "What");
    if (f.includes("where")) h += sel("where", [["front", "Leftmost: attacks first, dies first"], ["back", "Rightmost: attacks last"]], ab.where || "front", i, "Where", true);
    if (f.includes("devourFrom")) h += sel("devourFrom", [["shop", "A minion in the tavern (full stats)"], ["board", "A friendly minion (full stats)"], ["hand", "A minion from your hand (full stats)"], ...(phaseOf(ab) === "combat" ? [] : [["shopPick", "A tavern minion you choose (half stats)"], ["boardPick", "A friendly minion you choose (full stats)"], ["handPick", "A minion from your hand you choose (full stats)"]])], ab.devourFrom || "shop", i, "Eats", true);
    if (f.includes("share")) h += sel("share", [["full", "All its stats"], ["half", "Half its stats"]], ab.share || "full", i, "Gains");
    if (f.includes("sn")) h += num("n", ab.n || 0, ab.action === "ruleMaxGold" || ab.action === "ruleIncome" ? -9 : -5, ab.action === "ruleMaxGold" ? 20 : 9, { ruleBuy: "Gold (− cheaper)", ruleSell: "Gold (− less)", ruleRoll: "Gold (− cheaper)", ruleUpgrade: "Gold (− cheaper)", ruleShop: "Minions (− fewer)", ruleIncome: "Gold (− less)", ruleMaxGold: "Gold (− lower)", ruleDiscover: "Choices (− fewer)", ruleDamage: "Damage (− less)" }[ab.action] || "Amount", i);
    if (f.includes("pct")) h += num("pct", ab.pct || 10, 1, 100, ab.action === "sharedPick" ? "Golden chance %" : "Chance %", i);
    if (f.includes("pickTier")) h += sel("pickTier", [["any", "Any tier"], ["current", "The picker's tier"], ["up", "One tier above the picker"]], ab.pickTier || "any", i, "Minions from");
    if (f.includes("tierMode")) {
      h += sel("tierMode", [["current", "Your tavern tier"], ["down", "One tier lower"], ["up", "One tier higher"], ["upTo", "Your tier or lower"], ["exact", "A precise tier…"], ["random", "A random tier (up to yours +2)"], ["max", "Tier 6"], ["any", "Any tier"]], ab.tierMode || "current", i, "From", true);
      if (ab.tierMode === "exact") h += sel("dtier", [1, 2, 3, 4, 5, 6].map((x) => [x, "Tier " + x]), ab.dtier || 1, i, "Tier");
    }
    if (f.includes("dtribe")) h += sel("tribe", [["", "Any tribe"], ["@main", "Your most common tribe"], ["@lobby", "A random tribe of the game"], ...W.TRIBES.map((x) => [x, TN(x)])], ab.tribe || "", i, "Tribe");
    if (f.includes("daff") && (W.affOn() || ab.daff)) h += sel("daff", [["", "Any affinity"], ...W.AFFS.map((x) => [x, W.affName(x)])], ab.daff || "", i, "Affinity");
    if (f.includes("dkw")) h += sel("dkw", [["", "Any"], ...Object.entries(KW_TEXT).filter(([k]) => k !== "magnetic").map(([k, l]) => [k, "With " + l])], ab.dkw || "", i, "Keyword");
    if (f.includes("choices")) h += num("choices", ab.choices || 3, 2, 5, "Choices", i);
    if (f.includes("times")) h += num("times", ab.times || 1, 1, 3, "How many times", i);
    if ((ab.action === "gainPressure" || ab.action === "releasePressure") && W.affsOfKind("gauge").length > 1) h += sel("gaff", [["", "Its own (or the first) gauge"], ...W.affsOfKind("gauge").map((x) => [x, W.affName(x) + " · " + W.affMech(x)])], ab.gaff || "", i, "Which gauge");
    if (ab.action === "mire" && W.affsOfKind("mire").length > 1) h += sel("maff", [["", "Its own (or the first) status"], ...W.affsOfKind("mire").map((x) => [x, W.affName(x) + " · " + W.affMech(x)])], ab.maff || "", i, "Which status");
    if (f.includes("dgolden")) h += sel("dgolden", [["", "Normal"], ["1", "Golden ✦"]], ab.dgolden ? "1" : "", i, "The pick is");
    if (f.includes("tribeMode")) h += sel("tribeMode", [["random", "A random tribe of the lobby"], ["main", "Your most common tribe"]], ab.tribeMode || "random", i, "Which tribe", true);
    if (ab.trigger !== "passive" && ab.action !== "devour") h += `<div class="ce-look">${sel("fx", fxPairs(), FXA(ab.fx), i, "Look")}${ab.fx ? `<button type="button" class="ce-mini play" data-fxprev="${i}" title="Preview the look">▶</button>` : ""}</div>`;
    h += `</div></div>`;
    // 3. to whom
    if (f.includes("target") && !(f.includes("sfrom") && !ab.sfrom)) {
      h += `<div class="ce-stepbox"><div class="ce-stepn">${f.includes("sfrom") ? "Stats of" : "To"}</div>${sel("target", targetPairs(ab, r), ab.target, i, "", true)}<div class="ce-fields">`;
      if (["randomFriend", "randomEnemy", "randomFriendSelf", "shopRandom", "handRandom", "randomToken", "leftmost", "rightmost"].includes(ab.target)) h += num("count", ab.count || 1, 1, 7, "How many", i);
      if (!["self", "trigger", "chosen"].includes(ab.target)) h += sel("ttribe", [["", "Any tribe"], ...W.TRIBES.map((x) => [x, TN(x) + "s only"])], ab.ttribe || "", i, "Tribe") + sel("tkw", [["", "Any keyword"], ...Object.values(W.CKW).map((k) => [k.id, "With " + k.name + " only"]), ...Object.entries(KW_TEXT).map(([k, l]) => [k, "With " + l + " only"])], ab.tkw || "", i, "Keyword")
        + (W.affOn() || ab.taff ? sel("taff", [["", "Any affinity"], ...W.AFFS.map((x) => [x, W.affName(x) + " only"])], ab.taff || "", i, "Affinity") : "");
      if (!["self", "chosen", "tokens", "randomToken"].includes(ab.target)) h += sel("ttok", [["", "Tokens and others"], ["only", "Tokens only"], ["no", "No tokens"]], ab.ttok || "", i, "Tokens");
      if (ab.target !== "self") h += sel("tmk", [["", "With or without markers"], ["any", "Only with markers"], ["stat", "Only with stat markers"], ...Object.entries(KW_TEXT).filter(([k]) => k !== "magnetic").map(([k, l]) => [k, "Only with a " + l + " marker"])], ab.tmk === true ? "any" : ab.tmk || "", i, "Markers");
      if (!["self", "chosen"].includes(ab.target)) h += num("tageMin", ab.tageMin || "", 0, 30, "Age at least", i, "any") + num("tageMax", ab.tageMax == null ? "" : ab.tageMax, 0, 30, "Age at most", i, "any");
      h += `</div></div>`;
    }
    h += `</div>`;
    // advanced options, folded away unless used
    const rep = W.REPEATABLE.has(ab.trigger) || (powerLike(r) && ab.trigger === "startOfTurn"), scl = W.SCALABLE.has(ab.action), cond = !isSpell(r) && ab.trigger !== "passive" && ab.trigger !== "gameStart";
    const lim = !isSpell(r) && ab.trigger !== "passive" && ab.trigger !== "gameStart", self = ["summonRandom", "transform", "addMinion", "fireTrigger"].includes(ab.action) && !powerLike(r);
    const used = ab.every > 1 || ab.ifTribe || ab.cond || ab.per || ab.golden === false || ab.limit || ab.allowSelf || ab.minTurn > 1 || ab.pcost > 0 || ab.chance > 0 || ab.repeat > 1 || ab.delay > 0 || ab.wWhat || ab.grow > 0 || ab.rnd > 1 || ab.uses > 0 || ab.payWhat || ab.cool > 0;
    const turnOk = ab.trigger !== "passive" && ab.trigger !== "gameStart" && !(spellLike(r) && isSpell(r));
    if (rep || scl || cond || lim || self || turnOk) {
      h += `<details class="ce-more"${used ? " open" : ""}><summary>More options${used ? " (in use)" : ""}</summary><div class="ce-fields">`;
      if (ab.trigger !== "passive") {
        h += `<div class="ce-lab"><b class="ce-lab-t">⚗ Lab</b>` + num("chance", ab.chance || 100, 1, 100, "Chance %", i) + num("repeat", ab.repeat || 1, 1, 10, "Repeat ×", i)
          + (phaseOf(ab) !== "combat" && ab.trigger !== "gameStart" ? num("delay", ab.delay || 0, 0, 9, "Delay (turns)", i) : "");
        const what = [["", "No condition"], ["attack", "Its Attack"], ["health", "Its Health"], ["srcAttack", "Attack of the minion that triggered it"], ["srcHealth", "Health of the minion that triggered it"], ["age", "Its age (turns on your board)"], ["ageTotal", "Total age of your minions"], ["ageLeft", "Age of your leftmost minion"], ["ageRight", "Age of your rightmost minion"], ["ageMax", "Age of your oldest minion"], ["ageMin", "Age of your youngest minion"], ["ageAvg", "Average age of your minions"], ["ageSrc", "Age of the minion that triggered it"], ["ageOld", "Your minions at least 3 turns old"], ["counter", "Its counter…"], ["pcounter", "Your counter…"], ["gold", "Your gold"], ["hand", "Cards in your hand"], ["board", "Your number of minions"], ["tier", "Your tavern tier"], ["turn", "The turn number"], ["turnEven", "Even turns"], ["turnOdd", "Odd turns"], ["heroHealth", "Your hero's Health"], ["goldens", "Your golden minions"], ["kin", "Minions of its tribe"], ["itsTier", "Its tier"], ...(W.affOn() || ["affN", "affLv", "affs"].includes(ab.wWhat) ? [["affN", "Your minions of an affinity…"], ["affLv", "An affinity's level…"], ["affs", "Your awake affinities"]] : []), ["frozen", phaseOf(ab) === "combat" ? "Frozen enemy minions" : "Frozen minions in the tavern"], ...(phaseOf(ab) === "combat" ? [] : [["spellsHand", "Spells in your hand"], ["spellsTurn", "Spells you cast this turn"]]), ...(phaseOf(ab) === "combat" ? [["enemies", "Number of enemies"]] : [["shop", "Minions in the tavern"], ["winStreak", "Your win streak"], ["lossStreak", "Your losing streak"]])];
        h += sel("wWhat", what, ab.wWhat || "", i, "Only if");
        if (ab.wWhat && ab.wWhat !== "turnEven" && ab.wWhat !== "turnOdd") {
          if (ab.wWhat === "counter" || ab.wWhat === "pcounter") h += txtIn("wVar", ab.wVar || "Charge", i, "Counter", "ceVarNames", "e.g. Rage");
          if (ab.wWhat === "affN" || ab.wWhat === "affLv") h += sel("wVar", W.AFFS.map((x) => [x, W.affName(x) + " · " + W.affMech(x)]), ab.wVar, i, "Affinity");
          h += sel("wCmp", [[">=", "is at least"], ["<=", "is at most"], ["=", "is exactly"]], ab.wCmp || ">=", i, "") + num("wN", ab.wN || 0, -99, 999, "Value", i);
          if ((ab.wWhat === "counter" || ab.wWhat === "pcounter") && (ab.wCmp || ">=") === ">=") h += `<label class="ce-check small"><input type="checkbox" data-i="${i}" data-k="wSpend" ${ab.wSpend ? "checked" : ""}> Spend it: takes that much away each time the effect fires</label>`;
        }
        if (ab.wWhat) {
          h += sel("w2What", what.map(([k, l]) => [k, k ? l : "Nothing more"]), ab.w2What || "", i, "And if");
          if (ab.w2What && ab.w2What !== "turnEven" && ab.w2What !== "turnOdd") {
            if (ab.w2What === "counter" || ab.w2What === "pcounter") h += txtIn("w2Var", ab.w2Var || "Charge", i, "Counter", "ceVarNames", "e.g. Rage");
            if (ab.w2What === "affN" || ab.w2What === "affLv") h += sel("w2Var", W.AFFS.map((x) => [x, W.affName(x) + " · " + W.affMech(x)]), ab.w2Var, i, "Affinity");
            h += sel("w2Cmp", [[">=", "is at least"], ["<=", "is at most"], ["=", "is exactly"]], ab.w2Cmp || ">=", i, "") + num("w2N", ab.w2N || 0, -99, 999, "Value", i);
          }
        }
        h += `<div class="ce-lab-row">` + num("grow", ab.grow || 0, 0, 5, "Grows each time (+N×)", i) + num("rnd", ab.rnd || 1, 1, 5, "Random strength ×1 to ×", i) + num("uses", ab.uses || 0, 0, 20, "At most N times (0 = no limit)", i) + `</div>`;
        h += `<div class="ce-lab-row">` + num("cool", ab.cool || 0, 0, 9, "Then rests N times", i) + `</div>`;
        h += `<div class="ce-lab-row">` + sel("payWhat", [["", "Free"], ["health", "Pay with its Health"], ["attack", "Pay with its Attack"], ...(phaseOf(ab) !== "combat" ? [["gold", "Pay with your gold"]] : [])], ab.payWhat || "", i, "Cost") + (ab.payWhat ? num("payN", ab.payN || 1, 1, 30, "How much", i) : "") + `</div>`;
        h += `</div>`;
      }
      if (rep) h += num("every", ab.every || 1, 1, 9, ab.trigger === "activate" ? "Every N activations" : "Every N times", i);
      if (turnOk) h += num("minTurn", ab.minTurn || 1, 1, 20, "Only from turn", i);
      if (ab.trigger !== "passive" && ab.trigger !== "gameStart" && !isSpell(r) && (W.affOn() || ab.pcost > 0)) {
        h += num("pcost", ab.pcost || 0, 0, 20, `${W.affMech(W.affsOfKind("gauge")[0] || "steam") || "Pressure"} cost (0 = none)`, i);
        if (ab.pcost > 0 && W.affsOfKind("gauge").length > 1) h += sel("paff", [["", "Its own (or the first) gauge"], ...W.affsOfKind("gauge").map((x) => [x, W.affName(x) + " · " + W.affMech(x)])], ab.paff || "", i, "Paid from");
        if (ab.pcost > 0) h += `<label class="ce-check small"><input type="checkbox" data-i="${i}" data-k="pall" ${ab.pall ? "checked" : ""}> Spend it all: the effect repeats once per cost paid</label>`;
      }
      if (cond) h += sel("onlyIf", [["", "Always"], ...(powerLike(r) ? [] : [["alone", "If this is your only minion"], ["fed", "If this has Devoured something"]]), ["full", "If your warband is full"], ...(powerLike(r) ? [] : [["golden", "If this is golden"]]), ["lowHealth", "If your hero has 10 or less Health"], ...W.TRIBES.map((x) => ["tribe:" + x, "If you control another " + TN(x)]), ...(powerLike(r) ? [] : Object.entries(KW_TEXT).map(([k, l]) => ["kw:" + k, "If this has " + l]))], ab.ifTribe ? "tribe:" + ab.ifTribe : ab.ifKw ? "kw:" + ab.ifKw : ab.cond || "", i, "Only if", true)
        + num("minBoard", ab.minBoard || 0, 0, 7, "Needs N+ minions (0 = any)", i);
      if (scl) {
        h += sel("per", [["", "Fixed amount"], ["lastN", "× the number from the rule above (markers removed or moved, minions destroyed…)"], ["lastKinds", "× the different markers of the minion of the rule above"], ["lastMk", "× the markers of the minion of the rule above"], ["lastAtk", "× the Attack of the minion of the rule above"], ["lastHp", "× the Health of the minion of the rule above"], ["counter", "× its counter…"], ["pcounter", "× your counter…"], ["age", "× its age (turns on your board)"], ["ageTotal", "× the total age of your minions"], ["ageLeft", "× the age of your leftmost minion"], ["ageRight", "× the age of your rightmost minion"], ["ageMax", "× the age of your oldest minion"], ["ageMin", "× the age of your youngest minion"], ["ageAvg", "× the average age of your minions"], ["ageSrc", "× the age of the minion that triggered it"], ["ageOld", "× each of your minions at least 3 turns old"], ["friend", "× each other friendly minion"], ["played", "× each minion you played this game"], ["playedTurn", "× each minion you played this turn"], ["spells", "× each tavern spell cast this game"], ["spellsTurn", "× each tavern spell cast this turn"], ["sold", "× each minion sold this game"], ["bought", "× each minion bought this game"], ["turn", "× the turn number"], ...(W.affOn() || ab.per === "pressure" ? [["pressure", "× your Pressure (Steam)"]] : []), ...(W.affOn() || ab.per === "aff" || ab.per === "affs" ? [["aff", "× each of your minions of an affinity…"], ["affs", "× each of your awake affinities"]] : []), ["frozen", phaseOf(ab) === "combat" ? "× each Frozen enemy minion" : "× each Frozen minion in the tavern"], ...(phaseOf(ab) === "combat" ? [] : [["spellsHand", "× each spell in your hand"]]), ...(powerLike(r) || spellLike(r) || !(W.affOn() || ab.per === "foundations") ? [] : [["foundations", "× Foundations under this minion (Earth)"]]), ...(powerLike(r) || spellLike(r) ? [] : [["attack", "× this minion's Attack"], ["health", "× this minion's Health"]]), ...(phaseOf(ab) === "combat" ? [["enemy", "× each enemy minion"]] : [["devours", "× each minion you Devoured this game"], ["gold", "× each gold you have"], ...(powerLike(r) ? [] : [["fed", "× each minion this has Devoured"]])])], ab.per || "", i, "Scaling", true);
        if (ab.per) h += num("perMax", ab.perMax || "", 0, 99, "At most", i, "no limit");
        if (ab.per === "counter" || ab.per === "pcounter") h += txtIn("perVar", ab.perVar || "Charge", i, "Counter", "ceVarNames", "e.g. Rage");
        if (ab.per === "aff") h += sel("perVar", W.AFFS.map((x) => [x, W.affName(x) + " · " + W.affMech(x)]), ab.perVar, i, "Affinity");
        if (["friend", "enemy", "played", "playedTurn"].includes(ab.per)) h += sel("perTribe", [["", "Of any tribe"], ...W.TRIBES.map((x) => [x, TN(x) + "s only"])], ab.perTribe || "", i, "Counting");
      }
      if (lim) h += sel("limit", [["", "Every time"], ...(spellLike(r) ? [] : [["turn", phaseOf(ab) === "combat" ? "Once per combat" : "Once per turn"]]), ["game", "Once per game"]], ab.limit || "", i, "How often");
      if (self) h += `<label class="ce-check small"><input type="checkbox" data-i="${i}" data-k="allowSelf" ${ab.allowSelf ? "checked" : ""}> Can pick this same minion (may loop)</label>`;
      if (!spellLike(r) && !powerLike(r)) h += `<label class="ce-check small"><input type="checkbox" data-i="${i}" data-k="golden" ${ab.golden === false ? "" : "checked"}> Doubles on the golden version</label>`;
      h += `</div></details>`;
    }
    return h + `</div>`;
  }
  function renderHeroForm() {
    const r = cur;
    r.abilities = (r.abilities || []).map((ab) => fixAbility(ab, r));
    const ph = img && !img.removed && img.src ? img : null;
    $("#ceForm", el).innerHTML = `
      <div class="ce-sec"><h3>Portrait</h3>
        ${ph ? `<div class="ce-frames">${frameBox("card", "Hero portrait", ph)}<div class="ce-img-ctl"><p class="ce-hint">Drag the picture to move it, scroll or use the slider to zoom. It shows in a round frame in game.</p>
            <label class="pill">Replace image<input type="file" id="ceFile" accept="image/*" hidden></label><button type="button" class="pill" id="ceImgRemove">Remove picture</button></div></div>`
        : `<div class="ce-img"><div class="ce-crop empty" id="ceCrop"><span>No portrait yet<br>Drop an image here</span></div>
            <div class="ce-img-ctl"><label class="pill">Upload image<input type="file" id="ceFile" accept="image/*" hidden></label><div class="ce-hint">Without a picture the hero shows its initial.</div></div></div>`}
      </div>
      <div class="ce-sec"><h3>Hero</h3>
        ${(() => { const bans = anomList().filter((a) => (a.banHeroes || []).includes(r.id)); return bans.length ? `<p class="ce-hint ce-banned">Banned during: ${bans.map((a) => `<button type="button" class="ce-link" data-goto="anomaly|${esc(a.id)}">✦ ${esc(a.name)}</button>`).join(", ")}</p>` : ""; })()}
        <label class="ce-sel wide">Name<input class="ce-name" data-f="name" value="${esc(r.name)}" maxlength="24"></label>
        <div class="ce-grid">${num("health", r.health, 10, 60, "Starting Health")}</div>
      </div>
      <div class="ce-sec"><h3>Hero power${foldLinks()}</h3>
        <div class="ce-grid"><label class="ce-sel">Power name<input data-f="powerName" value="${esc(r.powerName)}" maxlength="24"></label>
          <div class="ce-field"><span class="ce-lab">Kind</span><div class="ce-chips">
            <label class="ce-chip"><input type="radio" name="cePType" data-f="powerType" value="active" ${r.powerType !== "passive" ? "checked" : ""}><span>Active: pay gold, once per turn</span></label>
            <label class="ce-chip"><input type="radio" name="cePType" data-f="powerType" value="passive" ${r.powerType === "passive" ? "checked" : ""}><span>Passive: works on its own</span></label></div></div>
          ${r.powerType !== "passive" ? num("powerCost", r.powerCost, 0, 10, "Cost in gold") : ""}</div>
        <div id="ceAbs">${r.abilities.map((ab, i) => abilityRow(ab, i, r)).join("") || `<div class="ce-empty">No effect yet.</div>`}</div>
        ${quickOpen ? quickPanel(r) : `<button type="button" class="pill ce-add" id="ceAddAb">+ Add an effect</button>`}
        <details class="ce-more"${r.customText ? " open" : ""}><summary>Write the power text yourself</summary>
          <label class="ce-sel wide">Leave blank to use the generated text<textarea data-f="customText" rows="2" maxlength="220" placeholder="${esc(autoText())}">${esc(r.customText || "")}</textarea></label>
          <p class="ce-hint">Styling: **bold**, *italic*, [red]colour[/] (red, gold, green, blue, purple, orange, pink, grey, or a #hex code).</p></details>
      </div>`;
    const file = $("#ceFile", el); if (file) file.addEventListener("change", (e) => { if (e.target.files[0]) useFile(e.target.files[0]); e.target.value = ""; });
    if (ph) { for (const v of el.querySelectorAll(".ce-view")) bindFrame(v); $("#ceImgRemove", el).addEventListener("click", () => { img = { removed: true, changed: true }; touch(); renderForm(); refreshImage(); }); }
  }
  const foldLinks = () => (cur && (cur.abilities || []).length > 1 ? `<span class="ce-foldall"><button type="button" class="ce-link" data-fold-all="1">Fold all</button><button type="button" class="ce-link" data-fold-all="0">Open all</button></span>` : "");
  function banChips(r) {
    const hs = heroList();
    if (!hs.length) return `<div class="ce-empty small">This meta has no heroes.</div>`;
    const ban = new Set(r.banHeroes || []);
    const left = hs.filter((h) => !ban.has(h.id)).length;
    return `<div class="ce-bans">${hs.map((h) => { const pic = ST.IMAGES["hero:" + h.id];
      return `<button type="button" class="ce-ban${ban.has(h.id) ? " on" : ""}" data-ban="${esc(h.id)}" aria-pressed="${ban.has(h.id)}" title="${esc(W.heroPowerText(h.id) || h.name)}">
        <span class="hero-thumb"${pic ? ` style="background-image:url('${pic.card}')"` : ""}>${pic ? "" : esc(h.name[0])}</span><b>${esc(h.name)}</b><i>${ban.has(h.id) ? "Banned" : "Allowed"}</i></button>`; }).join("")}</div>
      <p class="ce-hint ${left < 3 ? "warn" : ""}">${ban.size ? `${ban.size} banned, ${left} left to pick from.` : "No hero is banned."}${left === 0 ? " With every hero banned, the ban list is ignored." : left < 3 ? " You will get fewer than 3 heroes to choose from." : ""}</p>`;
  }
  // ---------------------------------------------------------------- affinity studio: one affinity, edited like a card
  const TPL_GROUPS = [["tavern", "In the tavern"], ["board", "On the board"], ["combat", "In combat"], ["economy", "Gold and pools"], ["free", "Free-form"]];
  const TPL_NAME = { pulse: "Pulse", gauge: "Gauge", mire: "Status", ebb: "Ebb", found: "Foundation", bonus: "Bonus", growth: "Growth", echo: "Legacy", ward: "Ward", unity: "Pack", strike: "Strike", wealth: "Fortune", resonance: "Resonance", spread: "Spread", lure: "Lure", aura: "Aura", fury: "Fury", bargain: "Bargain", none: "Only my effects" };
  const SHAPE_NAME = { round: "Round", hex: "Hexagon", shield: "Shield", diamond: "Diamond", square: "Square", star: "Star" };
  const FX_NAME = { "": "Still", glow: "Glow", pulse: "Pulse", spin: "Spin", shine: "Shine" };
  const affGen = (r, o) => W.affIconSVG(Object.assign({ color: r.color, color2: r.color2, shape: r.shape, glyph: r.glyph, name: r.name }, o || {}), r.id);
  const affPic = (r) => r.icon || (r.builtIn && r.art !== "gen" ? `ui-art/aff/aff-${r.id}.webp` : affGen(r));
  function affNorm(r) {
    r.t1 = Math.max(1, Math.min(7, r.t1 | 0 || 1)); r.t2 = Math.max(r.t1, Math.min(7, r.t2 | 0 || r.t1));
    if (r.t3) { r.t3 = Math.min(7, Math.max(r.t2 + 1, r.t3 | 0)); if (r.t3 <= r.t2) r.t3 = 0; }
  }
  function renderAffForm() {
    const r = cur; affNorm(r);
    r.abilities = (r.abilities || []).map((ab) => fixAbility(ab, ab.carry ? carryRec(r) : r));
    const own = r.abilities.some((ab) => !ab.carry), carried = r.abilities.some((ab) => ab.carry);
    const I = W.AFF_KIND_INFO, val = I[r.tpl] ? I[r.tpl].value : "", saved = r.builtIn || !!(ST.affinities || {})[r.id];
    const order = W.AFFS.filter((k) => !(W.AFF[k] && W.AFF[k].id === "__none")), pos = order.indexOf(r.id);
    const radio = (k, v, inner, cls = "", title = "") => `<label class="ce-chip ${cls}"${title ? ` title="${esc(title)}"` : ""}><input type="radio" name="ceAff_${k}" data-f="${k}" value="${esc(v)}" ${String(r[k] || "") === String(v) ? "checked" : ""}>${inner}</label>`;
    const track = `<div class="ce-afftrack" style="--ac:${esc(r.color)}">${[1, 2, 3, 4, 5, 6, 7].map((n) => { const lv = r.t3 && n >= r.t3 ? 3 : n >= r.t2 ? 2 : n >= r.t1 ? 1 : 0; const mark = n === r.t1 ? 1 : n === r.t2 && r.t2 !== r.t1 ? 2 : r.t3 && n === r.t3 ? 3 : 0;
      return `<i class="lv${lv}${mark ? " mark" : ""}"><b>${n}</b>${mark ? `<em>Level ${mark}</em>` : ""}</i>`; }).join("")}<span>minions on the board</span></div>`;
    const kwOpts = Object.entries(KW_TEXT).filter(([k]) => k !== "magnetic").concat(Object.values(W.CKW).map((k) => [k.id, "✦ " + k.name]));
    $("#ceForm", el).innerHTML = `
      <div class="ce-sec ce-affform"><h3>Identity</h3>
        <div class="ce-affhero" style="--ac:${esc(r.color)}"><div class="ce-affbig fx-${esc(r.fx || "none")}"><img src="${esc(affPic(r))}" alt=""></div>
          <div class="ce-affmain"><label class="ce-sel wide">Name<input class="ce-name" data-f="name" value="${esc(r.name)}" maxlength="18"></label>
          <label class="ce-sel wide">Mechanic name <small class="ce-sub">shown on the table and in texts (Pulse, Pressure…)</small><input data-f="mech" value="${esc(r.mech)}" maxlength="18"></label></div></div>
        <label class="ce-sel wide">Description <small class="ce-sub">flavour or rules note shown in its tooltip; **bold**, *italic*, [red]colour[/] work</small><textarea data-f="desc" rows="2" maxlength="240">${esc(r.desc || "")}</textarea></label>
        <label class="ce-check"><input type="checkbox" data-f="descOnly" ${r.descOnly ? "checked" : ""}> Show only my description in tooltips (hide the automatic text)</label>
        ${r.hidden ? `<p class="ce-hint warn">Hidden in this meta: minions keep it but it does nothing. Click Restore to bring it back.</p>` : ""}
      </div>
      <div class="ce-sec ce-affform"><h3>Badge</h3>
        <div class="ce-field"><span class="ce-lab">Colours <small class="ce-sub">the main one tints its frame, glow and slot; the second shades the generated badge</small></span>
          <div class="ce-lkrow"><input type="color" data-f="color" value="${esc(r.color)}"><input type="color" data-f="color2" value="${esc(r.color2 || "#1a1430")}">${r.color2 ? `<button type="button" class="ce-mini" id="ceAffC2" title="Back to the dark shade">⟲</button>` : ""}</div></div>
        <div class="ce-field"><span class="ce-lab">Picture</span><div class="ce-chips">
          ${r.builtIn ? radio("art", "", "<span>Original art</span>") + radio("art", "gen", "<span>Generated badge</span>") : ""}
          <label class="pill small">Upload a picture<input type="file" accept="image/*" id="ceAffFile" hidden></label>${r.icon ? `<button type="button" class="pill small" id="ceAffNoIcon">Remove picture</button>` : ""}</div>
          ${r.icon ? `<p class="ce-hint">Your picture is used. Remove it to design a generated badge.</p>` : ""}</div>
        ${r.icon || (r.builtIn && r.art !== "gen") ? "" : `
        <div class="ce-field"><span class="ce-lab">Shape</span><div class="ce-chips ce-affshapes">${W.AFF_SHAPES.map((sh) => radio("shape", sh, `<img src="${esc(affGen(r, { shape: sh }))}" alt=""><span>${SHAPE_NAME[sh]}</span>`, "pic")).join("")}</div></div>
        <div class="ce-field"><span class="ce-lab">Symbol</span><div class="ce-affglyphs">${W.AFF_GLYPHS.map((g) => radio("glyph", g, `<b>${g ? esc(g) : esc((r.name || "?").charAt(0).toUpperCase())}</b>`, "glyph", g ? "" : "Its initial")).join("")}</div></div>`}
        <div class="ce-field"><span class="ce-lab">Animation <small class="ce-sub">on cards and minions</small></span><div class="ce-chips">${W.AFF_FX.map((f) => radio("fx", f, `<span>${FX_NAME[f]}</span>`)).join("")}</div></div>
      </div>
      <div class="ce-sec ce-affform"><h3>Levels</h3>
        <p class="ce-hint">An affinity wakes up at level 1 when a player controls enough minions carrying it, and grows at each next level.</p>
        ${track}
        <div class="ce-grid">${num("t1", r.t1, 1, 7, "Level 1 at")}${num("t2", r.t2, 1, 7, "Level 2 at")}${r.t3 ? num("t3", r.t3, 2, 7, "Level 3 at") : ""}</div>
        <label class="ce-check"><input type="checkbox" data-f="t3on" ${r.t3 ? "checked" : ""}${!r.t3 && r.t2 >= 7 ? " disabled" : ""}> A third level</label>
      </div>
      <div class="ce-sec ce-affform"><h3>Mechanic</h3>
        <p class="ce-hint">A ready-made mechanic with your numbers. Pick “Only my effects” to build it entirely from level effects below.</p>
        ${TPL_GROUPS.map(([g, gl]) => { const ks = W.AFF_KINDS.filter((k) => I[k].group === g); return ks.length ? `<div class="ce-tplgroup"><small>${gl}</small><div class="ce-tpls">${ks.map((k) => `<label class="ce-tpl${r.tpl === k ? " on" : ""}"><input type="radio" name="ceAff_tpl" data-f="tpl" value="${k}" ${r.tpl === k ? "checked" : ""}><b>${TPL_NAME[k]}</b><span>${esc(I[k].label.replace(/^[^:]+:\s*/, ""))}</span></label>`).join("")}</div></div>` : ""; }).join("")}
        ${r.tpl === "ward" ? `<label class="ce-sel">Keyword given<select data-f="kw">${opt(kwOpts, r.kw)}</select></label>` : ""}
        ${["bonus", "growth", "echo", "resonance", "aura"].includes(r.tpl) ? `<div class="ce-chips">${[["both", "Attack and Health"], ["attack", "Attack only"], ["health", "Health only"]].map(([v, l]) => radio("stat", v, `<span>${l}</span>`)).join("")}</div>` : ""}
        ${val ? `<div class="ce-grid">${num("v1", r.v1, 0, 99, "Level 1 · " + val)}${num("v2", r.v2, 0, 99, "Level 2")}${r.t3 ? num("v3", r.v3, 0, 99, "Level 3") : ""}</div>` : ""}
        <p class="ce-hint ce-affblurb">${esc(W.AFF[r.id] ? W.affBlurb(r.id) : "")}</p>
      </div>
      <div class="ce-sec"><h3>Level effects${foldLinks()}</h3>
        <p class="ce-hint">Effects of your own, each unlocked at a level. They run for the player who reaches that level, like a passive hero power: in the tavern (end of turn, after you buy or play one…) or as the fight starts.</p>
        <div id="ceAbs">${own ? r.abilities.map((ab, i) => (ab.carry ? "" : abilityRow(ab, i, r))).join("") : `<div class="ce-empty">No level effect yet.</div>`}</div>
        ${quickOpen === true ? quickPanel(r) : `<button type="button" class="pill ce-add" id="ceAddAb">+ Add a level effect</button>`}
      </div>
      <div class="ce-sec"><h3>Carried effects</h3>
        <p class="ce-hint">Effects that every minion carrying this affinity has, as if printed on it, from the level you pick: Battlecry, Deathrattle, Whenever this attacks, Start of Combat, auras… With “Trigger their own effects” and “Give an affinity”, build your own mechanics (a Pulse, a chain of Deathrattles, a contagion…).</p>
        <div class="ce-abs-carry">${carried ? r.abilities.map((ab, i) => (ab.carry ? abilityRow(ab, i, carryRec(r)) : "")).join("") : `<div class="ce-empty">No carried effect yet.</div>`}</div>
        ${quickOpen === "carry" ? quickPanel(r) : `<button type="button" class="pill ce-add" id="ceAddCarry">+ Add a carried effect</button>`}
      </div>
      <div class="ce-sec"><h3>Order</h3>
        ${saved && pos >= 0 ? `<p class="ce-hint">Position ${pos + 1} of ${order.length}: the order of the affinity chips, lists and tooltips.</p><div class="ce-row"><button type="button" class="pill small" data-affmove="-1" ${pos ? "" : "disabled"}>◀ Earlier</button><button type="button" class="pill small" data-affmove="1" ${pos < order.length - 1 ? "" : "disabled"}>Later ▶</button></div>`
          : `<p class="ce-hint">${r.hidden ? "Hidden affinities have no place in the order." : "Save it first to place it in the order."}</p>`}
        <p class="ce-hint">Badge size and placement on cards: <button type="button" class="ce-link" id="ceAffGoBadges">Tribes &amp; affinities</button>.</p>
      </div>`;
    const fi = $("#ceAffFile", el);
    if (fi) fi.addEventListener("change", async () => { if (!fi.files[0]) return; try { cur.icon = await affIconFromFile(fi.files[0]); touch(); rerenderKeep(); } catch (e) { status("That picture could not be read.", "warn"); } });
    const ni = $("#ceAffNoIcon", el); if (ni) ni.addEventListener("click", () => { cur.icon = ""; touch(); rerenderKeep(); });
    const ac = $("#ceAddCarry", el); if (ac) ac.addEventListener("click", () => { quickOpen = "carry"; rerenderKeep(); const q = $(".ce-quick", el); if (q) q.scrollIntoView({ block: "nearest", behavior: "smooth" }); });
    const gb = $("#ceAffGoBadges", el); if (gb) gb.addEventListener("click", () => { const hb = [...el.querySelectorAll('[data-meta-act="tribes"]')].find((x) => !x.closest("#ceForm")); if (hb) hb.click(); });
    const c2 = $("#ceAffC2", el); if (c2) c2.addEventListener("click", () => { cur.color2 = ""; touch(); rerenderKeep(); });
    for (const b of el.querySelectorAll("[data-affmove]")) b.addEventListener("click", async () => {
      const l = W.AFFS.slice(), i = l.indexOf(cur.id), j = i + +b.dataset.affmove; if (i < 0 || j < 0 || j >= l.length) return;
      [l[i], l[j]] = [l[j], l[i]];
      const cfg = affCfgNow(); cfg.order = l; await ST.saveAffinities(cfg); applyDraft(); renderList(); rerenderKeep(); status("Order saved.");
    });
  }
  // the preview: a minion that carries it (card and token), its slot on the table and what it does
  function affPreview(pc, pt) {
    const d = new W.Minion("__affprev").dict(), r = cur, A = W.AFF[r.id];
    pc.appendChild(helpers.makeCard(d)); pt.appendChild(helpers.makeToken(d, { static: true, tier: true }));
    const lv = r.t3 ? 3 : 2, fx = A ? W.affEffectsText(r.id).concat(W.affCarryText(r.id).map((x) => Object.assign({ carry: true }, x))) : [];
    $("#ceText", el).innerHTML = `<div class="ce-affslotpv" style="--ac:${esc(r.color)}"><img src="${esc(A ? W.affIcon(r.id) : affPic(r))}" alt=""><div><b>${esc(r.name)} · ${esc(r.mech)}</b><span class="pips">${Array.from({ length: lv }, (_, k) => `<i title="Level ${k + 1}: ${[r.t1, r.t2, r.t3][k]} minions">${[r.t1, r.t2, r.t3][k]}</i>`).join("")}</span></div></div>
      ${r.desc ? `<p class="ce-afflore">${richE(r.desc)}</p>` : ""}${r.tpl !== "none" && A ? `<p>${esc(W.affBlurb(r.id))}</p>` : ""}
      ${fx.length ? `<ul class="ce-afffx">${fx.map((x) => `<li><b>${x.carry ? "Carried · " : ""}Level ${x.lv}</b> ${esc(x.text)}</li>`).join("")}</ul>` : r.tpl === "none" ? "<i>No level effect yet.</i>" : ""}`;
  }
  function renderKwForm() {
    const r = cur;
    r.abilities = (r.abilities || []).map((ab) => fixAbility(ab, r));
    $("#ceForm", el).innerHTML = `
      <div class="ce-sec"><h3>Keyword</h3>
        <p class="ce-hint">Your own keyword: a minion that has it runs these effects as if they were its own (golden doubles them). Tick it on minions under Keywords, or hand it out with “Give a keyword”.</p>
        <div class="ce-kwhead"><label class="ce-afficon" title="Upload a small picture"><img src="${esc(r.icon || "")}" alt=""${r.icon ? "" : " hidden"}><b class="ce-kwletter" style="background:${esc(r.color)}"${r.icon ? " hidden" : ""}>${esc((r.name || "?")[0])}</b><input type="file" accept="image/*" id="ceKwIcon" hidden><span>✎</span></label>
          <div class="ce-affmain"><label class="ce-sel wide">Name<input class="ce-name" data-f="name" value="${esc(r.name)}" maxlength="20"></label>
          <div class="ce-affnames"><label class="ce-sel">Colour<input type="color" data-f="color" value="${esc((r.color || "#c9a24a").slice(0, 7))}"></label>${r.icon ? `<button type="button" class="pill small" id="ceKwNoIcon">Remove picture</button>` : ""}</div></div></div>
        <label class="ce-sel wide">Tooltip <small class="ce-sub">what players read when they hover it; empty = the text of its effects</small><textarea data-f="tip" rows="2" maxlength="200">${esc(r.tip || "")}</textarea></label>
      </div>
      <div class="ce-sec"><h3>Effects${foldLinks()}</h3>
        <div id="ceAbs">${r.abilities.map((ab, i) => abilityRow(ab, i, r)).join("") || `<div class="ce-empty">No effect yet.</div>`}</div>
        ${quickOpen ? quickPanel(r) : `<button type="button" class="pill ce-add" id="ceAddAb">+ Add an effect</button>`}
      </div>`;
    const fi = $("#ceKwIcon", el);
    if (fi) fi.addEventListener("change", async () => { if (!fi.files[0]) return; try { cur.icon = await affIconFromFile(fi.files[0]); dirty = true; renderForm(); preview(); } catch (e) { status("That picture could not be read.", "warn"); } });
    const ni = $("#ceKwNoIcon", el); if (ni) ni.addEventListener("click", () => { cur.icon = ""; dirty = true; renderForm(); preview(); });
  }
  function renderAnomForm() {
    const r = cur;
    r.abilities = (r.abilities || []).map((ab) => fixAbility(ab, r));
    const ph = img && !img.removed && img.src ? img : null;
    $("#ceForm", el).innerHTML = `
      <div class="ce-sec"><h3>Anomaly</h3>
        <p class="ce-hint">An anomaly changes the rules for every player in a game. In Anomaly mode, each game draws one of this meta's anomalies at random.
        Its effects run for each player like a passive hero power; “One player picks a minion, everyone gets it” runs once for the whole lobby.</p>
        <label class="ce-sel wide">Name<input class="ce-name" data-f="name" value="${esc(r.name)}" maxlength="28"></label>
      </div>
      <div class="ce-sec"><h3>Banned heroes</h3>
        <p class="ce-hint">Banned heroes can't be picked or drawn by bots while this anomaly is active. Ban the ones its rules would make too strong.</p>
        ${banChips(r)}
      </div>
      <div class="ce-sec"><h3>Picture <small>(optional)</small></h3>
        ${ph ? `<div class="ce-frames">${frameBox("card", "Anomaly picture", ph)}<div class="ce-img-ctl"><p class="ce-hint">Shown on the anomaly card at the start of a game.</p>
            <label class="pill">Replace image<input type="file" id="ceFile" accept="image/*" hidden></label><button type="button" class="pill" id="ceImgRemove">Remove picture</button></div></div>`
        : `<div class="ce-img"><div class="ce-crop empty" id="ceCrop"><span>No picture<br>Drop an image here</span></div>
            <div class="ce-img-ctl"><label class="pill">Upload image<input type="file" id="ceFile" accept="image/*" hidden></label></div></div>`}
      </div>
      <div class="ce-sec"><h3>Rules${foldLinks()}</h3>
        <div id="ceAbs">${r.abilities.map((ab, i) => abilityRow(ab, i, r)).join("") || `<div class="ce-empty">No rule yet.</div>`}</div>
        ${quickOpen ? quickPanel(r) : `<button type="button" class="pill ce-add" id="ceAddAb">+ Add a rule</button>`}
        <details class="ce-more"${r.customText ? " open" : ""}><summary>Write the description yourself</summary>
          <label class="ce-sel wide">Leave blank to use the generated text<textarea data-f="customText" rows="2" maxlength="200" placeholder="${esc(W.anomalyText(r.id) || autoText())}">${esc(r.customText || "")}</textarea></label></details>
      </div>`;
    const file = $("#ceFile", el); if (file) file.addEventListener("change", (e) => { if (e.target.files[0]) useFile(e.target.files[0]); e.target.value = ""; });
    if (ph) { for (const v of el.querySelectorAll(".ce-view")) bindFrame(v); $("#ceImgRemove", el).addEventListener("click", () => { img = { removed: true, changed: true }; touch(); renderForm(); refreshImage(); }); }
  }
  function renderForm() {
    renderFormInner();
    { const f = $("#ceForm", el); if (f && f.querySelector(".ce-ab")) f.insertAdjacentHTML("beforeend", labLists()); }
    const qs = $("#ceQuickSearch", el);
    if (qs) {
      qs.addEventListener("input", () => { const q = qs.value.trim().toLowerCase(); let n = 0; for (const b of el.querySelectorAll(".ce-qbtn[data-words]")) { const on = !q || b.dataset.words.includes(q); b.hidden = !on; n += on; } const none = $(".ce-quick-none", el); if (none) none.hidden = n > 0; });
      qs.addEventListener("keydown", (e) => e.stopPropagation());
      setTimeout(() => qs.focus(), 30);
    }
    const f = $("#ceForm", el), secs = [...f.querySelectorAll(":scope > .ce-sec")];
    if (secs.length < 3) return;
    secs.forEach((sec) => { const h = sec.querySelector("h3"); const t = h ? (h.firstChild && h.firstChild.nodeType === 3 ? h.firstChild.textContent : h.textContent) : ""; sec.dataset.tab = (t || "").trim() || "More"; });
    tabify(f, "form:" + (cur ? cur.kind || "card" : "card"));
  }
  // ---- tabs: the sections of a form tagged data-tab show one group at a time (or all of them, as the person likes)
  const tabState = {};
  let tabsAll = (() => { try { return localStorage.getItem("wa_ce_view") === "all"; } catch (e) { return false; } })();
  function tabify(host, key) {
    const secs = [...host.querySelectorAll(":scope > [data-tab]")]; if (secs.length < 2) return null;
    const names = [...new Set(secs.map((x) => x.dataset.tab))];
    let on = names.includes(tabState[key]) ? tabState[key] : names[0];
    const nav = document.createElement("nav"); nav.className = "ce-tabs"; nav.setAttribute("role", "tablist");
    nav.innerHTML = names.map((n, i) => `<button type="button" role="tab" data-tabgo="${esc(n)}"><b>${i + 1}</b><span>${esc(n)}</span></button>`).join("") + `<button type="button" class="ce-tabs-all" data-taball="1"></button>`;
    host.insertBefore(nav, secs[0]);
    const show = () => {
      for (const x of secs) x.classList.toggle("tab-off", !tabsAll && x.dataset.tab !== on);
      nav.querySelectorAll("[data-tabgo]").forEach((b) => { const sel = b.dataset.tabgo === on; b.classList.toggle("on", sel); b.setAttribute("aria-selected", sel ? "true" : "false"); });
      nav.classList.toggle("all", tabsAll); nav.querySelector("[data-taball]").textContent = tabsAll ? "One tab at a time" : "Show all";
    };
    nav.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.taball) { tabsAll = !tabsAll; try { localStorage.setItem("wa_ce_view", tabsAll ? "all" : "tabs"); } catch (x) {} show(); return; }
      on = b.dataset.tabgo; tabState[key] = on; show();
      if (tabsAll) { const t = secs.find((x) => x.dataset.tab === on); if (t) t.scrollIntoView({ block: "start", behavior: "smooth" }); } else host.scrollTop = 0;
    });
    show();
    return { go: (n) => { on = n; tabState[key] = n; show(); } };
  }
  // anything that needs a hidden field (an error, a jump) brings its tab forward
  function revealTab(node) { const t = node && node.closest && node.closest(".tab-off[data-tab]"); if (!t) return; const b = t.parentElement && t.parentElement.querySelector(`:scope > .ce-tabs [data-tabgo="${CSS.escape(t.dataset.tab)}"]`); if (b) b.click(); }
  function renderFormInner() {
    if (isAff(cur)) return renderAffForm();
    if (isKw(cur)) return renderKwForm();
    if (isAnom(cur)) return renderAnomForm();
    if (isHero(cur)) return renderHeroForm();
    const r = cur, spell = isSpell(r), base = r.builtIn && !spell ? builtInMinion(r.id) : null;
    const lockedSpell = fixedSpell(r);
    r.abilities = (r.abilities || []).map((ab) => fixAbility(ab, r));
    const ph = img && !img.removed && img.src ? img : null;
    $("#ceForm", el).innerHTML = `
      <div class="ce-sec"><h3>Picture</h3>
        ${ph ? `<div class="ce-frames">
          ${frameBox("card", "On the card", ph)}
          ${spell ? "" : frameBox("tok", "On the board", ph)}
          <div class="ce-img-ctl">
            <p class="ce-hint">Drag a picture to move it. Scroll on it or use the slider to zoom. Each frame keeps its own framing.</p>
            ${spell ? "" : `<button type="button" class="pill" data-frame-copy="card">On the board: copy the card framing</button>`}
            <label class="pill">Replace image<input type="file" id="ceFile" accept="image/*" hidden></label>
            <button type="button" class="pill" id="ceImgRemove">Remove picture</button>
          </div></div>`
        : `<div class="ce-img"><div class="ce-crop empty" id="ceCrop"><span>${r.builtIn ? "Uses its tribe portrait" : "No picture yet"}<br>Drop an image here</span></div>
          <div class="ce-img-ctl"><label class="pill">Upload image<input type="file" id="ceFile" accept="image/*" hidden></label>
            <div class="ce-hint">PNG, JPG, WEBP or GIF, any size. You frame it separately for the card and for the board token.</div></div></div>`}
      </div>
      <div class="ce-sec"><h3>${spell ? "Spell" : "Minion"}</h3>
        <label class="ce-sel wide">Name<input class="ce-name" data-f="name" value="${esc(r.name)}" maxlength="28" ${lockedSpell ? "disabled" : ""}></label>
        ${spell ? (lockedSpell ? "" : `<div class="ce-grid">${num("cost", r.cost, 0, 10, "Cost in gold")}${tierPicker(r.tier)}</div>`)
          : `<div class="ce-field"><span class="ce-lab">Tribe <small class="ce-sub">the first one gives the card its colour</small></span><div class="ce-chips">${tribeOpts().map(([v, l]) => `<label class="ce-chip tribe" data-tribe="${v}"><input type="radio" name="ceTribe" data-f="tribe" value="${v}" ${r.tribe === v ? "checked" : ""} ${r.allTribes ? "disabled" : ""}>${ART.tribeIcon(v)}<span>${l}</span></label>`).join("")}</div></div>
          <div class="ce-field"><span class="ce-lab">Also a… <small class="ce-sub">multi-tribe: counts as each of them; appears in lobbies with any of them</small></span><div class="ce-chips">${W.TRIBES.filter((t) => t !== r.tribe).map((t) => `<label class="ce-chip tribe small" data-tribe="${esc(t)}"><input type="checkbox" data-xt="${esc(t)}" ${(r.tribes || []).includes(t) ? "checked" : ""} ${r.allTribes ? "disabled" : ""}>${ART.tribeIcon(t)}<span>${esc(TN(t))}</span></label>`).join("")}
            <label class="ce-chip all"><input type="checkbox" data-f="allTribes" ${r.allTribes ? "checked" : ""}><span>✦ All tribes</span></label></div></div>
          ${W.affOn() ? `<div class="ce-field"><span class="ce-lab">Affinities <small class="ce-sub">up to two; their mechanics wake up when you control enough of them</small></span><div class="ce-chips">${W.AFFS.map((a) => `<label class="ce-chip aff" title="${esc(W.affMech(a) + ": " + W.affBlurb(a))}"><input type="checkbox" data-aff="${a}" ${(r.aff || []).includes(a) ? "checked" : ""}><img src="${esc(W.affIcon(a))}" alt=""><span>${esc(W.affName(a))}</span></label>`).join("")}</div></div>` : ""}
          <div class="ce-field"><span class="ce-lab">Rarity <small class="ce-sub">rarer cards show up less often in the tavern, Discover ignores it</small></span><div class="ce-chips">${Object.entries(W.RARITY).map(([k, v]) => `<label class="ce-chip rar ${k}"><input type="radio" name="ceRarity" data-f="rarity" value="${k}" ${(r.rarity || "common") === k ? "checked" : ""}><i></i><span>${v.name}</span></label>`).join("")}</div></div>
          <div class="ce-grid">${tierPicker(r.tier)}<div class="ce-stats">${num("attack", r.attack, 0, 99, "Attack")}${num("health", r.health, 1, 99, "Health")}</div></div>
          <div class="ce-field"><span class="ce-lab">Keywords</span><div class="ce-chips">${Object.entries(KW_TEXT).map(([k, l]) => `<label class="ce-chip" title="${esc(W.KEYWORD_INFO[k] || "")}"><input type="checkbox" data-f="${k}" ${r[k] ? "checked" : ""}><span>${l}</span></label>`).join("")}${Object.values(W.CKW).map((k) => `<label class="ce-chip ckw" style="--kc:${esc(k.color)}" title="${esc(k.tip || k.abilities.map((ab) => W.abilityText(ab, false)).join(" "))}"><input type="checkbox" data-ckw="${esc(k.id)}" ${(r.ckw || []).includes(k.id) ? "checked" : ""}>${k.icon ? `<img src="${esc(k.icon)}" alt="">` : ""}<span>${esc(k.name)}</span></label>`).join("")}</div></div>
          <div class="ce-field"><span class="ce-lab">Starting markers <small class="ce-sub">markers it carries from the start: effects can move them away (a keyword marker takes its keyword with it)</small></span><div class="ce-chips">${num("mkp", (r.mk && r.mk.p) || 0, 0, 20, "+1/+1 markers")}${Object.entries(KW_TEXT).filter(([k]) => k !== "magnetic").map(([k, l]) => `<label class="ce-chip mk"><input type="checkbox" data-mkk="${k}" ${r.mk && (r.mk.kw || []).includes(k) ? "checked" : ""}><span>◆ ${l}</span></label>`).join("")}</div></div>
          <div class="ce-field"><span class="ce-lab">Attack style <small class="ce-sub">how its attacks look in combat</small></span><div class="ce-fxrow">${[["", { name: "Charge in", color: "#a9b1d6" }], ...FXS()].map(([k, v]) => `<label class="ce-chip ce-fxchip" style="--c:${v.color}"><input type="radio" name="ceAtkFx" data-f="attackFx" value="${k}" ${(FXA(r.attackFx)) === k ? "checked" : ""}><i></i><span>${v.name}</span></label>`).join("")}<button type="button" class="ce-mini play" id="ceAtkPrev" title="Preview the attack">▶</button></div></div>
          <label class="ce-check"><input type="checkbox" data-f="inPool" ${r.inPool !== false ? "checked" : ""}> Can show up in the tavern${r.tribe ? ` (in lobbies with ${TN(r.tribe)}s)` : ""}</label>
          <p class="ce-hint">${r.inPool === false ? "Not in the tavern: it is a token. It gets the token frame, and effects can aim at tokens." : "Untick it to make a token: never offered in the tavern, only effects make it."}</p>
`}
      </div>
      ${lockedSpell ? "" : lookSec(r, spell)}
      ${lockedSpell ? `<div class="ce-sec"><h3>Effect</h3><p class="ce-hint">${esc(W.SPELLS[r.id].text || new W.Spell(r.id).text)}<br>Built-in spell effects are fixed. You can give it a picture here, or make a + New spell with your own effect.</p></div>` : `
      <div class="ce-sec"><h3>Effects${foldLinks()}</h3>
        ${r._norm ? `<div class="ce-goldbar"><span>✦ You are editing the GOLDEN effects</span> <button type="button" class="pill small" data-goldedit="0">Back to the normal effects</button></div>` : ""}
        ${base && builtInText(r.id) ? `<label class="ce-check keep"><input type="checkbox" data-f="keepBuiltIn" ${r.noBuiltIn ? "" : "checked"}> Keep the original effect: <i>${esc(builtInText(r.id))}</i></label>` : ""}
        <div id="ceAbs">${r.abilities.map((ab, i) => abilityRow(ab, i, r)).join("") || `<div class="ce-empty">No ${base && !r.noBuiltIn ? "extra " : ""}effect yet. ${spell ? "A spell needs at least one." : "A plain minion is fine too."}</div>`}</div>
        ${quickOpen ? quickPanel(r) : `<button type="button" class="pill ce-add" id="ceAddAb">+ Add an effect</button>`}
        <details class="ce-more"${r.customText ? " open" : ""}><summary>Write the card text yourself</summary>
          <label class="ce-sel wide">Leave blank to use the generated text<textarea data-f="customText" rows="2" maxlength="220" placeholder="${esc(autoText())}">${esc(r.customText || "")}</textarea></label>
          <p class="ce-hint">Styling: **bold**, *italic*, [red]colour[/] (red, gold, green, blue, purple, orange, pink, grey, or a #hex code).</p></details>
      </div>`}
      ${spell ? "" : goldSec(r)}`;
    const file = $("#ceFile", el); if (file) file.addEventListener("change", (e) => { if (e.target.files[0]) useFile(e.target.files[0]); e.target.value = ""; });
    if (ph) {
      for (const v of el.querySelectorAll(".ce-view")) bindFrame(v);
      $("#ceImgRemove", el).addEventListener("click", () => { img = { removed: true, changed: true }; touch(); renderForm(); refreshImage(); });
    }
  }

  // ---------------------------------------------------------------- searchable lists (v82)
  // Every drop-down of the workshop opens as a list you can type in: the words filter the choices (case and accents
  // ignored; a group's name counts too). Arrows + Enter pick, Escape closes. The real <select> keeps the value.
  const foldTxt = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let combo = null;
  function closeCombo() { if (combo) { combo.remove(); combo = null; } }
  function openCombo(sel, first) {
    closeCombo();
    const r = sel.getBoundingClientRect(), box = document.createElement("div");
    box.className = "ce-combo"; box.innerHTML = `<input type="search" class="ce-combo-q" placeholder="Type to search…" autocomplete="off" spellcheck="false"><div class="ce-combo-list" role="listbox"></div>`;
    document.body.appendChild(box); combo = box;
    const W = Math.min(Math.max(r.width, 300), innerWidth - 16), below = innerHeight - r.bottom - 8;
    box.style.left = Math.max(8, Math.min(r.left, innerWidth - W - 8)) + "px"; box.style.width = W + "px";
    if (below < 260 && r.top > below) { box.style.bottom = innerHeight - r.top + 4 + "px"; box.style.maxHeight = Math.min(440, r.top - 12) + "px"; }
    else { box.style.top = r.bottom + 4 + "px"; box.style.maxHeight = Math.min(440, below) + "px"; }
    const q = box.querySelector("input"), list = box.querySelector(".ce-combo-list"), items = [];
    for (const n of sel.children) { if (n.tagName === "OPTGROUP") { items.push({ group: n.label }); for (const o of n.children) items.push({ o, g: n.label }); } else items.push({ o: n, g: "" }); }
    let act = -1, shown = [];
    const hl = () => { list.querySelectorAll(".ce-combo-o").forEach((d) => d.classList.toggle("act", +d.dataset.n === act)); const a = list.querySelector(".ce-combo-o.act"); if (a) a.scrollIntoView({ block: "nearest" }); };
    const draw = () => {
      const words = foldTxt(q.value).split(/\s+/).filter(Boolean); let html = "", g = null; shown = [];
      for (const it of items) {
        if (it.group != null) { g = it.group; continue; }
        if (words.length && !words.every((w) => foldTxt(it.o.textContent + " " + it.g).includes(w))) continue;
        if (g != null) { html += `<div class="ce-combo-g">${esc(g)}</div>`; g = null; }
        shown.push(it.o); html += `<div class="ce-combo-o${it.o.value === sel.value ? " cur" : ""}${it.o.disabled ? " dis" : ""}" data-n="${shown.length - 1}">${esc(it.o.textContent)}</div>`;
      }
      list.innerHTML = html || `<div class="ce-combo-none">${esc("No match")}</div>`;
      act = shown.findIndex((o) => o.value === sel.value); if (words.length) act = 0; hl();
    };
    const pick = (o) => { if (!o || o.disabled) return; closeCombo(); if (sel.value !== o.value) { sel.value = o.value; sel.dispatchEvent(new Event("input", { bubbles: true })); sel.dispatchEvent(new Event("change", { bubbles: true })); } };
    list.addEventListener("mousedown", (e) => { const d = e.target.closest(".ce-combo-o"); e.preventDefault(); if (d) pick(shown[+d.dataset.n]); });
    q.addEventListener("input", draw);
    box._key = (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); act = Math.min(shown.length - 1, act + 1); hl(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); act = Math.max(0, act - 1); hl(); }
      else if (e.key === "Enter") { e.preventDefault(); pick(shown[act]); }
      else if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); closeCombo(); sel.focus(); }
    };
    if (first) q.value = first;
    draw(); q.focus();
  }
  function bindCombos(host) {
    host.addEventListener("mousedown", (e) => { const s = e.target.closest && e.target.closest("select"); if (!s || s.disabled || s.multiple || e.button !== 0) return; e.preventDefault(); if (combo && combo._for === s) { closeCombo(); return; } openCombo(s); if (combo) combo._for = s; }, true);
    host.addEventListener("keydown", (e) => { const s = e.target; if (!s || s.tagName !== "SELECT" || e.ctrlKey || e.metaKey || e.altKey) return; if (e.key.length === 1 && /\S/.test(e.key)) { e.preventDefault(); openCombo(s, e.key); } else if (e.key === "Enter" || e.key === " " || e.key === "F4") { e.preventDefault(); openCombo(s); } }, true);
    host.addEventListener("scroll", (e) => { if (combo && !combo.contains(e.target)) closeCombo(); }, true);
  }
  document.addEventListener("mousedown", (e) => { if (combo && !combo.contains(e.target) && !(e.target.closest && e.target.closest("select") === combo._for)) closeCombo(); }, true);
  window.addEventListener("resize", closeCombo);
  // the list's keys go first (the game listens to Enter and Escape too)
  window.addEventListener("keydown", (e) => { if (!combo || !combo.contains(document.activeElement)) return; e.stopImmediatePropagation(); if (["ArrowDown", "ArrowUp", "Enter", "Escape", "Tab"].includes(e.key)) combo._key(e); }, true);
  // ---------------------------------------------------------------- Gold tab (v78)
  // A card can carry its own golden version: { on, attack, health, abilities, text }. Off, golden = everything x2.
  // While the golden effects are edited, cur.abilities holds them and cur._norm keeps the normal ones:
  // plainRec() gives the record as it is saved (normal effects in abilities, golden ones in gold.abilities).
  function plainRec(r) {
    if (!r || !r._norm) return r;
    const o = Object.assign({}, r, { abilities: r._norm, gold: Object.assign({}, r.gold, { abilities: r.abilities }) });
    delete o._norm; return o;
  }
  const GOLD_COUNT = new Set(["summon", "summonCopy", "summonRandom", "addMinion", "addSpell", "addSpellId", "addCard", "resurrect", "stealShop", "addCopy"]);
  function doubleAbs(list) {
    return clone(list || []).map((ab) => {
      for (const k of ["a", "h", "n"]) if (typeof ab[k] === "number" && ab[k]) ab[k] *= 2;
      if (GOLD_COUNT.has(ab.action)) ab.count = (ab.count || 1) * 2;
      delete ab.golden; return ab;
    });
  }
  const normAbs = (r) => (r._norm ? r._norm : r.abilities || []);
  const goldAbsOf = (r) => (r._norm ? r.abilities : (r.gold && r.gold.abilities) || []);
  function goldText(r) { return goldAbsOf(r).map((ab) => W.abilityText(Object.assign({}, ab, { golden: false }), true)).join(" "); }
  function goldSec(r) {
    const g = r.gold && r.gold.on ? r.gold : null, editing = !!r._norm, autoA = (r.attack || 0) * 2, autoH = (r.health || 1) * 2;
    return `<div class="ce-sec ce-goldsec"><h3>Golden</h3>
      <p class="ce-hint">Out of the box, the golden version doubles everything: its stats and every number of its effects.</p>
      <p class="ce-hint">Tick the box to set the golden version yourself: it starts filled with ×2, then change what you like (stats, effects, how many it summons, a keyword marker instead of a keyword…).</p>
      <label class="ce-check"><input type="checkbox" data-gold="on" ${g ? "checked" : ""}> Custom golden version</label>
      ${g ? `<div class="ce-grid"><div class="ce-stats">${num("gattack", g.attack != null ? g.attack : autoA, 0, 999, "Golden Attack")}${num("ghealth", g.health != null ? g.health : autoH, 1, 999, "Golden Health")}</div></div>
        <div class="ce-goldtxt"><span class="ce-lab">Golden effects</span><p>${esc(goldText(r)) || "<i>No effect</i>"}</p></div>
        <div class="ce-row"><button type="button" class="pill${editing ? "" : " goldbtn"}" data-goldedit="${editing ? 0 : 1}">${editing ? "Back to the normal effects" : "✦ Edit the golden effects"}</button>
          <button type="button" class="pill" data-goldreset="1">Refill: normal ×2</button></div>
        <label class="ce-sel wide">Golden card text (blank: generated)<textarea data-gold="text" rows="2" maxlength="220" placeholder="${esc(goldText(r))}">${esc(g.text || "")}</textarea></label>` : ""}
    </div>`;
  }
  // ---------------------------------------------------------------- framing
  // Two frames with the exact shapes used in the game. The picture is dragged and zoomed directly inside each.
  const FRAME = { card: { w: 240, h: Math.round(240 / ST.CARD_ASPECT) }, tok: { w: 152, h: Math.round(152 / ST.TOK_ASPECT) } };
  const cropOf = (which) => (which === "card" ? img.crop : (img.tcrop || (img.tcrop = { ...img.crop })));
  function frameBox(which, label, ph) {
    const c = which === "card" ? ph.crop : ph.tcrop || ph.crop, F = FRAME[which];
    return `<div class="ce-frame"><span class="ce-lab">${label}</span>
      <div class="ce-view ${which}" data-view="${which}" style="width:${F.w}px;height:${F.h}px"><img class="ce-view-bg" src="${ph.src}" alt="" draggable="false"><img class="ce-view-img" src="${ph.src}" alt="" draggable="false"></div>
      <div class="ce-zoom"><button type="button" class="ce-stepb" data-zstep="${which}" data-d="-1" aria-label="Zoom out">−</button><input type="range" data-zoom="${which}" min="0.3" max="4" step="0.01" value="${c.z || 1}"><button type="button" class="ce-stepb" data-zstep="${which}" data-d="1" aria-label="Zoom in">+</button></div>
      <div class="ce-zoomrow"><button type="button" class="pill" data-fit="${which}">Whole picture</button><button type="button" class="pill" data-fill="${which}">Fill</button></div></div>`;
  }
  function placeFrame(v) {
    const which = v.dataset.view, im = v.querySelector(".ce-view-img"), bg = v.querySelector(".ce-view-bg");
    if (!im.naturalWidth) return;
    const F = FRAME[which], c = cropOf(which);
    ST.clampCrop(F.w, F.h, im.naturalWidth, im.naturalHeight, c);
    const L = ST.layout(F.w, F.h, im.naturalWidth, im.naturalHeight, c);
    Object.assign(im.style, { left: L.x + "px", top: L.y + "px", width: L.dw + "px", height: L.dh + "px" });
    bg.style.display = L.dw < F.w || L.dh < F.h ? "block" : "none";
    const z = el.querySelector(`[data-zoom="${which}"]`); if (z && document.activeElement !== z) z.value = c.z || 1;
  }
  function bindFrame(v) {
    const which = v.dataset.view, im = v.querySelector(".ce-view-img");
    if (im.complete) placeFrame(v); else im.addEventListener("load", () => placeFrame(v));
    const changed = () => { placeFrame(v); reCrop(); };
    let drag = null;
    v.addEventListener("pointerdown", (e) => { e.preventDefault(); v.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY }; v.classList.add("grab"); });
    v.addEventListener("pointermove", (e) => {
      if (!drag || !im.naturalWidth) return;
      const r = v.getBoundingClientRect(), k = FRAME[which].w / r.width; // screen px -> frame px
      const F = FRAME[which], c = cropOf(which), L = ST.layout(F.w, F.h, im.naturalWidth, im.naturalHeight, c);
      c.fx -= ((e.clientX - drag.x) * k) / L.dw; c.fy -= ((e.clientY - drag.y) * k) / L.dh;
      drag = { x: e.clientX, y: e.clientY }; changed();
    });
    const end = () => { drag = null; v.classList.remove("grab"); };
    v.addEventListener("pointerup", end); v.addEventListener("pointercancel", end);
    v.addEventListener("wheel", (e) => { e.preventDefault(); const c = cropOf(which); c.z = Math.max(0.3, Math.min(4, (c.z || 1) * (e.deltaY < 0 ? 1.08 : 1 / 1.08))); changed(); }, { passive: false });
    const box = v.parentElement;
    box.querySelector(`[data-zoom="${which}"]`).addEventListener("input", (e) => { cropOf(which).z = +e.target.value; changed(); });
    box.querySelectorAll(`[data-zstep="${which}"]`).forEach((b) => b.addEventListener("click", () => { const c = cropOf(which); c.z = Math.max(0.3, Math.min(4, (c.z || 1) * (+b.dataset.d > 0 ? 1.15 : 1 / 1.15))); changed(); }));
    box.querySelector(`[data-fit="${which}"]`).addEventListener("click", () => { const c = cropOf(which), F = FRAME[which]; c.z = ST.fitZoom(F.w, F.h, im.naturalWidth, im.naturalHeight); c.fx = 0.5; c.fy = 0.5; changed(); });
    box.querySelector(`[data-fill="${which}"]`).addEventListener("click", () => { const c = cropOf(which); c.z = 1; changed(); });
    const cp = el.querySelector("[data-frame-copy]");
    if (cp && which === "tok" && !cp._bound) { cp._bound = true; cp.addEventListener("click", () => { img.tcrop = { ...img.crop }; changed(); status("On the board, it now uses the card framing.", "warn"); }); }
  }


  // ---------------------------------------------------------------- Look: how this card shows (aura, foil, frame, entrance, sounds)
  const LOOK_NAMES = { glow: "Glow", pulse: "Pulse", flame: "Flame", halo: "Halo", holo: "Holographic", shine: "Shine", prism: "Prism", gild: "Gilded", slam: "Slam", spin: "Spin", rise: "Rise", flash: "Flash", shadow: "From the shadows", bounce: "Bounce", portal: "Portal" };
  function lookSec(r, spell) {
    const L = r.look || {}, LK = W.LOOK, chips = (k, list, none) => `<div class="ce-chips">${[["", none]].concat(list.map((v) => [v, LOOK_NAMES[v] || v])).map(([v, l]) => `<label class="ce-chip lk"><input type="radio" name="ceLook_${k}" data-look="${k}" value="${v}" ${(L[k] || "") === v ? "checked" : ""}><span>${esc(l)}</span></label>`).join("")}</div>`;
    const skins = (ST.skinList ? ST.skinList("card") : []).filter(Boolean);
    const names = (root.WA_UI && root.WA_UI.sfxNames) || [];
    const snd = (k, label) => { const v = (L.sfx || {})[k] || "", up = v.startsWith("data:"); return `<div class="ce-lksnd"><span>${label}</span><select data-look="sfx.${k}"><option value="">Default</option>${up ? `<option value="${esc(v)}" selected>Your clip</option>` : ""}${names.map((n) => `<option value="${n}" ${v === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select><label class="pill small ce-lkup" title="Upload a short clip (MP3, OGG, WAV, 2 MB max)">Import<input type="file" accept="audio/*" data-lookfile="${k}" hidden></label><button type="button" class="ce-mini play" data-lookplay="${k}" title="Listen">▶</button></div>`; };
    return `<div class="ce-sec ce-looksec"><h3>Look <small class="ce-sub">only how this card shows, never what it does</small></h3>
      <div class="ce-field"><span class="ce-lab">Aura</span><div class="ce-lkrow"><label class="ce-check"><input type="checkbox" data-look="auraOn" ${L.aura ? "checked" : ""}> Glowing</label>${L.aura ? `<input type="color" data-look="aura" value="${esc(L.aura)}">` : ""}</div>${L.aura ? chips("auraStyle", LK.aura.slice(1), "Glow") : ""}</div>
      <div class="ce-field"><span class="ce-lab">Foil <small class="ce-sub">a shimmer over the picture</small></span>${chips("foil", LK.foil, "None")}</div>
      <div class="ce-field"><span class="ce-lab">Name colour</span><div class="ce-lkrow"><label class="ce-check"><input type="checkbox" data-look="nameOn" ${L.nameColor ? "checked" : ""}> Own colour</label>${L.nameColor ? `<input type="color" data-look="nameColor" value="${esc(L.nameColor)}">` : ""}</div></div>
      <div class="ce-field"><span class="ce-lab">Frame <small class="ce-sub">a card frame from your skins, for this card only (uses the layout of the equipped frame)</small></span><select class="ce-lksel" data-look="frame"><option value="">The equipped frame</option>${skins.map((k) => `<option value="${esc(k.id)}" ${L.frame === k.id ? "selected" : ""}>${esc(k.name || k.id)}</option>`).join("")}</select></div>
      ${spell ? "" : `<div class="ce-field"><span class="ce-lab">Entrance <small class="ce-sub">when it lands on your board</small></span><div class="ce-fxrow">${chips("enter", LK.enter, "Standard")}<button type="button" class="ce-mini play" id="ceLookEnter" title="Preview the entrance">▶</button></div></div>
      <div class="ce-field"><span class="ce-lab">Sounds</span>${snd("play", "Played")}${snd("attack", "Attacks")}${snd("death", "Dies")}</div>`}
      <div class="ce-row"><button type="button" class="pill small" id="ceLookReset">Plain look</button></div></div>`;
  }
  function onLook(e) {
    const t = e.target, k = t.dataset.look; if (!k) return false;
    const L = Object.assign({}, cur.look || {});
    let re = false;
    if (k === "auraOn") { if (t.checked) { L.aura = L.aura || "#ffcf5a"; L.auraStyle = L.auraStyle || "glow"; } else { delete L.aura; delete L.auraStyle; } re = true; }
    else if (k === "nameOn") { if (t.checked) L.nameColor = L.nameColor || "#ffe08a"; else delete L.nameColor; re = true; }
    else if (k.startsWith("sfx.")) { const x = Object.assign({}, L.sfx || {}), s = k.slice(4); if (t.value) x[s] = t.value; else delete x[s]; L.sfx = x; if (e.type === "change" && t.value && root.WA_UI) setTimeout(() => lookPlay(s), 30); }
    else if (t.type === "radio") { if (!t.checked) return true; if (t.value) L[k] = t.value; else delete L[k]; re = k === "enter" && e.type === "change"; if (k === "enter" && e.type === "change") setTimeout(lookEnterPreview, 250); }
    else { if (t.value) L[k] = t.value; else delete L[k]; }
    cur.look = W.cleanLook(L) || undefined; if (!cur.look) delete cur.look;
    if (k === "auraOn" || k === "nameOn") { if (cur.look && L.aura && !cur.look.aura) {} }
    touch(); preview();
    if (re && e.type === "change" && (k === "auraOn" || k === "nameOn")) rerenderKeep();
    return true;
  }
  const richE = (t) => (root.WA_UI && root.WA_UI.rich ? root.WA_UI.rich(esc(t || "")) : esc(t || ""));
  function lookPlay(k) { if (!root.WA_UI || !cur) return; const d = isSpell(cur) ? { isSpell: true, spellId: cur.id } : { cardId: cur.id }; root.WA_UI.lookSound(d, k); }
  function lookEnterPreview() { const tok = $("#cePvTok .mn", el); if (tok && root.WA_UI && cur && cur.look && cur.look.enter) { root.WA_UI.enterFx(tok, cur.look); lookPlay("play"); } }
  async function lookFile(t) {
    const f = t.files && t.files[0], k = t.dataset.lookfile; if (!f) return;
    if (!/^audio\//.test(f.type) || f.size > 2000000) { status("Pick a short audio clip (2 MB max).", "err"); t.value = ""; return; }
    const url = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(""); fr.readAsDataURL(f); });
    if (!url) return;
    cur.look = W.cleanLook(Object.assign({}, cur.look || {}, { sfx: Object.assign({}, (cur.look || {}).sfx || {}, { [k]: url }) })) || undefined;
    touch(); rerenderKeep(); lookPlay(k);
  }
  function tierPicker(v) {
    return `<div class="ce-field"><span class="ce-lab">Tavern tier</span><div class="ce-tiers">${[1, 2, 3, 4, 5, 6].map((n) => `<label class="ce-tier${n <= v ? " on" : ""}" title="Tier ${n}"><input type="radio" name="ceTier" data-f="tier" value="${n}" ${n === v ? "checked" : ""}><i class="star"></i></label>`).join("")}<b>${v}</b></div></div>`;
  }
  function onField(e) {
    const t = e.target;
    if (t.id === "ceZoom" || t.id === "ceFile") return;
    if (t.dataset.lookfile) { if (e.type === "change") lookFile(t); return; }
    if (t.dataset.look) { onLook(e); return; }
    if (t.dataset.f && isAff(cur)) {
      const k = t.dataset.f;
      if (k === "t3on") { if (e.type !== "change") return; cur.t3 = t.checked ? Math.min(7, cur.t2 + 1) : 0; }
      else if (t.type === "number") { if (t.value === "") return; cur[k] = Math.max(+t.min, Math.min(+t.max, Math.round(+t.value))); }
      else if (t.type === "radio") { if (!t.checked) return; cur[k] = t.value; }
      else if (t.type === "checkbox") cur[k] = t.checked;
      else cur[k] = t.value;
      if (k === "tpl" && e.type === "change") { const nm = { pulse: "Pulse", gauge: "Pressure", mire: "Mire", ebb: "Ebb", found: "Foundation", bonus: "Bonus", growth: "Growth", echo: "Legacy", ward: "Ward", unity: "Pack", strike: "Strike", wealth: "Fortune" }; if (!cur.mech || Object.values(nm).includes(cur.mech)) cur.mech = nm[cur.tpl] || cur.mech; }
      affNorm(cur);
      touch(); preview();
      if (e.type === "change" && ["tpl", "shape", "glyph", "art", "fx", "color", "color2", "t3on", "t1", "t2", "t3", "v1", "v2", "v3", "kw", "stat"].includes(k)) rerenderKeep();
      else if (k === "name") { const im = $(".ce-affbig img", el); if (im && !cur.icon && !(cur.builtIn && cur.art !== "gen") && !cur.glyph) im.src = affGen(cur); }
      return;
    }
    if (t.dataset.gold) {
      const k = t.dataset.gold;
      if (k === "on") {
        if (t.checked) { if (!cur.gold) cur.gold = { on: true, attack: (cur.attack || 0) * 2, health: (cur.health || 1) * 2, abilities: doubleAbs(normAbs(cur)) }; else cur.gold.on = true; }
        else { if (cur._norm) cur = plainRec(cur); if (cur.gold) cur.gold.on = false; }
        touch(); rerenderKeep(); return;
      }
      if (k === "text" && cur.gold) { cur.gold.text = t.value.slice(0, 220); touch(); preview(); return; }
      return;
    }
    if (t.dataset.mkk) {
      const kw = ((cur.mk && cur.mk.kw) || []).filter((x) => x !== t.dataset.mkk); if (t.checked) kw.push(t.dataset.mkk);
      cur.mk = { p: (cur.mk && cur.mk.p) || 0, kw }; touch(); preview(); return;
    }
    if (t.dataset.f === "mkp") { if (t.value === "") return; cur.mk = { p: Math.max(0, Math.min(20, Math.round(+t.value))), kw: (cur.mk && cur.mk.kw) || [] }; touch(); preview(); return; }
    if ((t.dataset.f === "gattack" || t.dataset.f === "ghealth") && cur.gold) { if (t.value === "") return; cur.gold[t.dataset.f === "gattack" ? "attack" : "health"] = Math.max(+t.min, Math.min(+t.max, Math.round(+t.value))); touch(); preview(); return; }
    if (t.dataset.f) {
      const k = t.dataset.f;
      if (k === "keepBuiltIn") cur.noBuiltIn = !t.checked;
      else if (k === "allTribes") { cur.allTribes = t.checked; if (e.type === "change") { const sc = $("#ceForm", el).scrollTop; renderForm(); $("#ceForm", el).scrollTop = sc; } }
      else if (t.type === "checkbox") cur[k] = t.checked;
      else if (t.type === "number") { if (t.value === "") return; cur[k] = Math.max(+t.min, Math.min(+t.max, Math.round(+t.value))); }
      else if (t.type === "radio") { if (!t.checked) return; cur[k] = k === "tier" ? +t.value : t.value; if (k === "tribe") cur.tribes = [...(cur.tribe ? [cur.tribe] : []), ...(cur.tribes || []).filter((x) => x !== cur.tribe && x)]; if (k === "attackFx" && e.type === "change") setTimeout(() => playPreview(cur.attackFx || "dust"), 50); }
      else cur[k] = t.value;
      if (e.type === "change" && (k === "tribe" || k === "tier" || k === "powerType")) { const sc = $("#ceForm", el).scrollTop; renderForm(); $("#ceForm", el).scrollTop = sc; }
    } else if (t.dataset.ckw) {
      const l = (cur.ckw || []).filter((x) => x !== t.dataset.ckw); if (t.checked) l.push(t.dataset.ckw); cur.ckw = l;
    } else if (t.dataset.aff) {
      let l = (cur.aff || []).filter((x) => x !== t.dataset.aff);
      if (t.checked) l.push(t.dataset.aff);
      if (l.length > 2) l = l.slice(-2);
      cur.aff = l;
      for (const c of el.querySelectorAll("input[data-aff]")) c.checked = l.includes(c.dataset.aff);
    } else if (t.dataset.xt) {
      const extra = (cur.tribes || []).filter((x) => x !== cur.tribe && x !== t.dataset.xt);
      if (t.checked) extra.push(t.dataset.xt);
      cur.tribes = [...(cur.tribe ? [cur.tribe] : []), ...extra];
    } else if (t.dataset.k && t.dataset.i != null) {
      const ab = cur.abilities[+t.dataset.i], k = t.dataset.k;
      if (!ab) return;
      if (k === "golden") { if (t.checked) delete ab.golden; else ab.golden = false; }
      else if (k === "pall") { if (t.checked) ab.pall = true; else delete ab.pall; }
      else if (k === "wSpend") { if (t.checked) ab.wSpend = true; else delete ab.wSpend; }
      else if (k === "wWhat" && t.value === "") { for (const x of ["wWhat", "wCmp", "wN", "wVar", "wSpend", "w2What", "w2Cmp", "w2N", "w2Var"]) delete ab[x]; }
      else if (k === "w2What" && t.value === "") { for (const x of ["w2What", "w2Cmp", "w2N", "w2Var"]) delete ab[x]; }
      else if (k === "payWhat" && t.value === "") { delete ab.payWhat; delete ab.payN; }
      else if (k === "pick" && t.value === "") { delete ab.pick; delete ab.weight; }
      else if (["vname", "sig", "sigOut", "wVar", "w2Var", "perVar"].includes(k)) ab[k] = t.value.slice(0, 16);
      else if (k === "allowSelf") { if (t.checked) ab.allowSelf = true; else delete ab.allowSelf; }
      else if (k === "exact" || k === "upTo") { if (t.checked) ab[k] = true; else delete ab[k]; }
      else if (k === "grants") { const l = (ab.grants || []).slice(); if (t.value !== "") l[+t.dataset.j] = clone(QUICK_MINION[+t.value][1]); ab.grants = l; }
      else if (k === "asMk") { if (t.value) ab.asMk = true; else delete ab.asMk; }
      else if (k === "grant") { if (t.value !== "") ab.grant = clone(QUICK_MINION[+t.value][1]); }
      else if (k === "rep") { if (t.checked) ab.rep = true; else { delete ab.rep; delete ab.inc; } }
      else if (k === "tierUp") ab.tierUp = +t.value;
      else if (k === "alv") ab.alv = Math.max(1, Math.min(3, +t.value || 1));
      else if (k === "rtribe") ab.rtribe = t.value;
      else if (k === "src") { if (t.value) ab.src = t.value; else delete ab.src; delete ab.stribe; }
      else if (k === "mutMode") { if (t.value === "random") { ab.rmut = 3; } else { delete ab.rmut; if (!ab.muts || !ab.muts.length) ab.muts = [{ name: "Shell", a: 0, h: 4, kw: "taunt" }, { name: "Fangs", a: 4, h: 1 }]; } }
      else if (k === "mutPreset") { if (t.value && e.type === "change") { const d = W.MUT_LIB.find((x) => x.id === t.value); if (d) (ab.muts = ab.muts || []).push(clone({ name: d.name, a: d.a, h: d.h, ...(d.kw ? { kw: d.kw } : {}), ...(d.grant ? { grant: d.grant } : {}) })); } }
      else if (k === "mut") {
        const m = (ab.muts || [])[+t.dataset.j], f2 = t.dataset.m; if (!m) return;
        if (m.lib) { const d = W.MUT_LIB.find((x) => x.id === m.lib) || {}; delete m.lib; Object.assign(m, { name: d.name, a: d.a, h: d.h }, d.kw ? { kw: d.kw } : {}, d.grant ? { grant: clone(d.grant) } : {}); }
        if (f2 === "name") m.name = t.value.slice(0, 24);
        else if (f2 === "a" || f2 === "h") { if (t.value !== "") m[f2] = Math.max(0, Math.min(30, Math.round(+t.value))); }
        else if (f2 === "kw") { if (t.value) m.kw = t.value; else delete m.kw; }
        else if (f2 === "mst" || f2 === "mkw") { if (t.checked) m[f2] = true; else delete m[f2]; }
        else if (f2 === "grant") { if (t.value === "") delete m.grant; else if (t.value !== "keep") m.grant = clone(QUICK_MINION[+t.value][1]); }
      }
      else if (k === "cards") { const list = ab.cards && ab.cards.length ? ab.cards.slice() : [ab.card || ""]; list[+t.dataset.j] = t.value; if (list.length > 1) { ab.cards = list; ab.card = list[0]; } else { ab.card = list[0]; delete ab.cards; } }
      else if (k === "onlyIf") { delete ab.ifTribe; delete ab.cond; delete ab.ifKw; if (t.value.startsWith("tribe:")) ab.ifTribe = t.value.slice(6); else if (t.value.startsWith("kw:")) ab.ifKw = t.value.slice(3); else if (t.value) ab.cond = t.value; }
      else if (t.type === "number") { if (t.value === "") delete ab[k]; else ab[k] = Math.max(+t.min, Math.min(+t.max, Math.round(+t.value))); }
      else if (t.value === "" && ["ftribe", "faff", "ttribe", "tkw", "tribe", "tier", "ifTribe", "per", "perTribe", "fx", "give", "limit", "dkw", "daff", "dgolden", "taff", "gaff", "paff", "maff", "aff", "ttok", "mkind", "mkeep", "tmk", "ftok", "fmk", "mdir", "sfrom"].includes(k)) delete ab[k];
      else if (k === "per") { ab.per = t.value; if (!["friend", "enemy", "played", "playedTurn"].includes(t.value)) delete ab.perTribe; }
      else ab[k] = k === "tier" || k === "dtier" ? +t.value : t.value;
      if (k === "action" && e.type === "change") for (const x of ["mode", "rtribe", "tierUp", "muts", "rmut", "a", "h", "n", "kw", "count", "card", "cards", "tribe", "tierMode", "dtier", "dkw", "daff", "choices", "times", "dgolden", "ttribe", "tier", "per", "perTribe", "stat", "grant", "toTribe", "give", "spread", "pct", "pickTier", "allowSelf", "tribeMode", "where", "share", "devourFrom", "mkw", "mkind", "mkeep", "asMk", "exact"]) delete ab[x];
      fixAbility(ab, recOf(ab));
      if (k === "fx" && e.type === "change") setTimeout(() => playPreview(ab.fx), 50);
      if (e.type === "change" && (t.tagName === "SELECT" || k === "rep" || k === "pcost")) { const row = t.closest(".ce-ab"), open = row.querySelector("details[open]"); row.outerHTML = abilityRow(ab, +t.dataset.i, recOf(ab)); if (open) { const d = $(`.ce-ab[data-row="${t.dataset.i}"] details`, el); if (d) d.open = true; } }
      else { const txt = t.closest(".ce-ab").querySelector(".ce-ab-text"); if (txt) txt.textContent = W.abilityText(ab, false); }
    } else return;
    if (isSpell(cur)) cur.target = cur.abilities.some((ab) => ab.target === "chosen");
    if (isHero(cur) && e.target.dataset && e.target.dataset.f === "powerType" && e.type === "change") { cur.abilities = cur.abilities.map((ab) => fixAbility(ab, cur)); }
    const ta = $("textarea[data-f=customText]", el); if (ta) ta.placeholder = autoText();
    touch(); preview();
  }
  function rerenderKeep() { const f = $("#ceForm", el), sc = f.scrollTop; renderForm(); f.scrollTop = sc; preview(); }
  function onFormClick(e) {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.goldedit != null) {
      if (t.dataset.goldedit === "1" && cur.gold) { cur._norm = cur.abilities || []; cur.abilities = clone(cur.gold.abilities || []); folded = new Set(); quickOpen = false; }
      else if (t.dataset.goldedit === "0" && cur._norm) { cur = plainRec(cur); folded = new Set(); quickOpen = false; }
      touch(); rerenderKeep();
      const box = $("#ceAbs", el); if (box) { revealTab(box); box.scrollIntoView({ block: "nearest" }); }
      status(cur._norm ? "Editing the golden effects: every change here is for the golden version only." : "Back to the normal effects.", "warn");
      return;
    }
    if (t.dataset.goldreset != null && cur.gold) {
      const fresh = doubleAbs(normAbs(cur));
      if (cur._norm) cur.abilities = fresh; else cur.gold.abilities = fresh;
      cur.gold.attack = (cur.attack || 0) * 2; cur.gold.health = (cur.health || 1) * 2;
      touch(); rerenderKeep(); status("Golden version refilled: the normal one ×2.", "warn"); return;
    }
    if (t.dataset.step) {
      const inp = t.parentElement.querySelector("input");
      const v = (inp.value === "" ? 0 : +inp.value) + +t.dataset.step;
      inp.value = Math.max(+inp.min, Math.min(+inp.max, v));
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    if (t.id === "ceAddAb") { quickOpen = true; rerenderKeep(); const q = $(".ce-quick", el); if (q) q.scrollIntoView({ block: "nearest", behavior: "smooth" }); return; }
    if (t.dataset.quickClose != null) { quickOpen = false; rerenderKeep(); return; }
    if (t.dataset.addgrant != null || t.dataset.rmgrant != null) {
      const ab = cur.abilities[+t.dataset.i]; if (!ab) return;
      ab.grants = (ab.grants || []).slice();
      if (t.dataset.addgrant != null) ab.grants.push(clone(QUICK_MINION[0][1])); else ab.grants.splice(+t.dataset.rmgrant, 1);
      touch(); rerenderKeep(); return;
    }
    if (t.dataset.addmut != null || t.dataset.rmmut != null) {
      const ab = cur.abilities[+t.dataset.i]; if (!ab) return;
      ab.muts = (ab.muts || []).slice();
      if (t.dataset.addmut != null) ab.muts.push({ name: "", a: 1, h: 1 }); else ab.muts.splice(+t.dataset.rmmut, 1);
      touch(); rerenderKeep(); return;
    }
    if (t.dataset.addchoice != null || t.dataset.rmchoice != null) {
      const ab = cur.abilities[+t.dataset.i]; if (!ab) return;
      let list = ab.cards && ab.cards.length ? ab.cards.slice() : [ab.card || ""];
      if (t.dataset.addchoice != null) list.push(""); else list.splice(+t.dataset.rmchoice, 1);
      if (list.length > 1) { ab.cards = list; ab.card = list[0]; } else { ab.card = list[0] || ""; delete ab.cards; }
      touch(); rerenderKeep(); return;
    }
    if (t.dataset.quick != null) {
      const carry = isAff(cur) && quickOpen === "carry", list = quickFor(cur), q = +t.dataset.quick, ab = q < 0 ? (carry ? { trigger: "battlecry", action: "buff", target: "allFriends", taff: cur.id, a: 1, h: 1, alv: 1 } : defaultAbility(cur)) : clone(list[q][1]);
      if (isAff(cur)) for (const f of ["taff", "faff", "aff"]) if (ab[f] === "@") ab[f] = cur.id;
      if (carry) ab.carry = true;
      cur.abilities.push(fixAbility(ab, recOf(ab)));
      folded = new Set(cur.abilities.map((_, i) => i).slice(0, -1).filter(() => cur.abilities.length > 2));
      quickOpen = false; touch(); rerenderKeep();
      const rows = el.querySelectorAll(".ce-ab"); if (rows.length) { rows[rows.length - 1].scrollIntoView({ block: "nearest", behavior: "smooth" }); rows[rows.length - 1].classList.add("fresh"); }
      return;
    }
    if (t.dataset.goto != null) { const k = t.dataset.goto; guard("goto" + k, () => select(k)); return; }
    if (t.dataset.ban != null && isAnom(cur)) {
      const id = t.dataset.ban, l = cur.banHeroes || (cur.banHeroes = []);
      if (l.includes(id)) l.splice(l.indexOf(id), 1); else l.push(id);
      touch(); rerenderKeep(); return;
    }
    if (t.dataset.fold != null) { const i = +t.dataset.fold; if (folded.has(i)) folded.delete(i); else folded.add(i); const row = t.closest(".ce-ab"); row.classList.toggle("folded", folded.has(i)); t.setAttribute("aria-expanded", !folded.has(i)); return; }
    if (t.dataset.foldAll != null) { const all = t.dataset.foldAll === "1"; folded = new Set(all ? cur.abilities.map((_, i) => i) : []); rerenderKeep(); return; }
    if (t.dataset.jump != null) { revealTab(t); return; }
    if (false) { const sec = $("#ceForm", el).querySelectorAll(".ce-sec")[+t.dataset.jump]; if (sec) sec.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
    if (t.dataset.fxprev != null) { const ab = cur.abilities[+t.dataset.fxprev]; if (ab) playPreview(ab.fx); return; }
    if (t.id === "ceAtkPrev") { playPreview(cur.attackFx || "dust"); return; }
    if (t.id === "ceLookEnter") { lookEnterPreview(); return; }
    if (t.dataset && t.dataset.lookplay) { lookPlay(t.dataset.lookplay); return; }
    if (t.id === "ceLookReset") { delete cur.look; touch(); rerenderKeep(); return; }
    // indices shift: keep each card's open/closed state with it
    const shift = (fn) => { const st = cur.abilities.map((ab, i) => [ab, folded.has(i)]); fn(st); cur.abilities = st.map(([ab]) => ab); folded = new Set(st.map(([, f], i) => (f ? i : -1)).filter((i) => i >= 0)); touch(); rerenderKeep(); };
    if (t.dataset.dup != null) { const i = +t.dataset.dup; shift((st) => st.splice(i + 1, 0, [clone(cur.abilities[i]), false])); return; }
    if (t.dataset.del != null) { const i = +t.dataset.del; shift((st) => st.splice(i, 1)); return; }
    if (t.dataset.up != null) { const i = +t.dataset.up; shift((st) => { [st[i - 1], st[i]] = [st[i], st[i - 1]]; }); return; }
    if (t.dataset.down != null) { const i = +t.dataset.down; if (i < cur.abilities.length - 1) shift((st) => { [st[i + 1], st[i]] = [st[i], st[i + 1]]; }); }
  }
  function touch() {
    histPush();
    dirty = true; pending = null; status("Unsaved changes", "warn");
    const it = el && el.querySelector(`.ce-item.on`); if (it) it.classList.add("dirty");
  }

  // ---------------------------------------------------------------- images
  async function useFile(f) {
    try {
      status("Loading picture...");
      const src = await ST.fromFile(f);
      img = { src, crop: { z: 1, fx: 0.5, fy: 0.45 }, tcrop: { z: 1, fx: 0.5, fy: 0.4 }, changed: true };
      touch(); renderForm();
      await refreshImage();
      status("Picture added. Drag it inside each frame to place it, then Save card.", "warn");
    } catch (e) { status(e.message || "That image could not be read.", "err"); }
  }
  let cropBusy = false, cropAgain = false;
  async function reCrop() {
    img.changed = true; touch();
    if (cropBusy) { cropAgain = true; return; }
    cropBusy = true;
    try { do { cropAgain = false; await refreshImage(); } while (cropAgain); } finally { cropBusy = false; }
  }
  async function refreshImage() {
    const key = imgKey(cur);
    if (img && !img.removed && img.src) {
      const v = await ST.renderVersions(img.src, img.crop, img.tcrop);
      img.tok = v.tok; img.card = v.card;
      await ST.preview(key, img);
    } else await ST.preview(key, null);
    preview();
  }

  // ---------------------------------------------------------------- preview
  function preview() {
    if (el) el.classList.toggle("no-cur", !cur);
    if (!el || !cur) return;
    $("#ceSave", el).textContent = isAff(cur) ? "Save affinity" : isKw(cur) ? "Save keyword" : isHero(cur) ? "Save hero" : isAnom(cur) ? "Save anomaly" : "Save card";
    $("#ceGolden", el).closest("label").hidden = powerLike(cur) || isKw(cur);
    try {
      applyDraft();
      const pc = $("#cePvCard", el), pt = $("#cePvTok", el);
      pc.innerHTML = ""; pt.innerHTML = "";
      if (isAff(cur)) {
        affPreview(pc, pt);
      } else if (isKw(cur)) {
        const box = document.createElement("div"); box.className = "ce-kwprev";
        const txt = cur.tip || (cur.abilities || []).map((ab) => W.abilityText(ab, false)).join(" ");
        box.innerHTML = `<div class="ce-kwbadge" style="--kc:${esc(cur.color)}">${cur.icon ? `<img src="${esc(cur.icon)}" alt="">` : ""}<b>${esc(cur.name)}</b></div><p>${esc(txt) || "<i>No effect yet</i>"}</p>`;
        pc.appendChild(box); $("#ceText", el).innerHTML = "";
      } else if (isAnom(cur)) {
        const pic = ST.IMAGES[imgKey(cur)];
        const box = document.createElement("div"); box.className = "ce-heroprev";
        box.innerHTML = helpers.anomalyCard ? "" : "";
        if (helpers.anomalyCard) box.appendChild(helpers.anomalyCard(cur.id, pic ? pic.card : null));
        pc.appendChild(box);
        $("#ceText", el).innerHTML = "";
      } else if (isHero(cur)) {
        const pic = ST.IMAGES[imgKey(cur)];
        const box = document.createElement("div"); box.className = "ce-heroprev";
        box.innerHTML = `<div class="hp-portrait"${pic ? ` style="background-image:url('${pic.card}')"` : ""}>${pic ? "" : `<span>${esc((cur.name || "?")[0])}</span>`}</div><div class="hp-hname">${esc(cur.name)}</div><div class="hp-life">${cur.health} Health</div>
          <div class="hp-box"><b>${esc(cur.powerName)}</b><small>${cur.powerType === "passive" ? "Passive" : cur.powerCost + " gold · once per turn"}</small><p>${esc(W.heroPowerText(cur.id)) || "<i>No effect yet</i>"}</p></div>`;
        pc.appendChild(box);
        $("#ceText", el).innerHTML = "";
      } else if (isSpell(cur)) {
        const s = new W.Spell(cur.id);
        pc.appendChild(helpers.makeCard(s));
        $("#ceText", el).innerHTML = `<b>${esc(s.name)}</b> · ${s.cost} gold · Tier ${s.tier}<br>${richE(s.text) || "<i>No effect yet</i>"}`;
      } else {
        const d = new W.Minion(cur.id, golden).dict();
        pc.appendChild(helpers.makeCard(d));
        pt.appendChild(helpers.makeToken(d, { static: true, tier: true }));
        $("#ceText", el).innerHTML = `<b>${golden ? "Golden " : ""}${esc(d.name)}</b> · ${d.attack}/${d.health} · ${esc(d.tribeLabel || "Neutral")} · Tier ${d.tier}<br>${richE(d.text) || "<i>No effect</i>"}`;
      }
      if (root.WA_FIT_CARDS) root.WA_FIT_CARDS(pc);
      renderMeter();
      const saved = isAnom(cur) ? anomList().some((a) => a.id === cur.id) : isHero(cur) ? heroList().some((h) => h.id === cur.id) : work.some((r) => r.id === cur.id && kindOf(r) === kindOf(cur)) || !!ST.IMAGES[imgKey(cur)] && !(img && img.changed);
      $("#ceDelete", el).textContent = isAff(cur) ? (cur.builtIn ? (cur.hidden ? "Restore" : "Hide") : "Delete") : cur.builtIn ? "Restore original" : "Delete";
      $("#ceDelete", el).disabled = isAff(cur) ? !(cur.builtIn || ((ST.affinities || {})[cur.id])) : !saved;
    } catch (e) { status("Preview failed: " + e.message, "err"); }
  }

  // ---------------------------------------------------------------- power meter and lint
  // Stats of the built-in cards at each tier, the yardstick for "is this a lot for tier N?"
  const tierAvg = (() => { const sum = {}, n = {}; for (const d of Object.values(W.BASE_CARDS)) { sum[d.tier] = (sum[d.tier] || 0) + d.attack + d.health; n[d.tier] = (n[d.tier] || 0) + 1; } const o = {}; for (const t in sum) o[t] = sum[t] / n[t]; return o; })();
  function lint(r) {
    const out = [];
    const abs = r.abilities || [];
    const seen = new Map();
    abs.forEach((ab, i) => { const k = JSON.stringify(ab); if (seen.has(k)) out.push(["warn", `Effects ${seen.get(k) + 1} and ${i + 1} are identical.`]); else seen.set(k, i); });
    const text = r.customText || abs.map((ab) => W.abilityText(ab, false)).join(" ");
    if (text.length > 150 && !powerLike(r)) out.push(["warn", `The text is long (${text.length} characters): it will be shrunk on the card.`]);
    if (kindOf(r) === "minion") {
      const avg = tierAvg[r.tier] || 6, st = (r.attack || 0) + (r.health || 0);
      if (st > avg * 1.6 && abs.length) out.push(["warn", `${st} total stats plus ${abs.length} effect${abs.length > 1 ? "s" : ""} is a lot for tier ${r.tier}. Consider a higher tier or fewer stats.`]);
      if (st < avg * 0.5 && !abs.length && !(r.builtIn && !r.noBuiltIn)) out.push(["info", `Low stats and no effect: nobody will buy it over a tier ${r.tier} average of ${avg.toFixed(1)}.`]);
      if (abs.some((ab) => ab.action === "summon" && ab.card === r.id && (ab.count || 1) > 1)) out.push(["warn", "It summons copies of itself: Deathrattle chains can fill the board forever."]);
      if (r.inPool === false && !abs.some((ab) => ab.card === r.id) && !work.some((o) => (o.abilities || []).some((ab) => ab.card === r.id || (ab.grant && ab.grant.card === r.id))) && !Object.values(W.CARDS).some((d) => (d.abilities || []).some((ab) => ab.card === r.id))) out.push(["warn", "It can't appear in the tavern and nothing summons it, so it will never show up."]);
      if ((r.abilities || []).some((ab) => ab.trigger === "onSell" && (ab.target === "self" || (ab.action === "buff" && ab.target === "self")))) out.push(["warn", "“When you sell this” happens after the minion has left the board: an effect on “this minion” does nothing. Target your other minions, gold, or your hand."]);
      if ((r.abilities || []).some((ab) => ab.trigger === "onSell" && ["devour", "silence", "makeGolden", "summonCopy", "addCopy"].includes(ab.action) && ab.target === "self")) out.push(["warn", "Selling removes the minion first, so “this minion” is gone when the effect runs."]);
      for (const ab of r.abilities || []) {
        if (ab.action === "evolve" && (!ab.card || ab.card === r.id)) out.push(["warn", "Evolve has no next form: pick the minion it becomes."]);
        if (ab.action === "evolve" && ab.cards && ab.cards.some((id) => !id || id === r.id)) out.push(["warn", "Evolve: one of the choices is empty (or the card itself)."]);
        if (ab.trigger === "evoFull" && !ab.src && !(r.abilities || []).some((x) => x.action === "charge")) out.push(["warn", "Nothing on this card charges its Evolution crystal: pick what charges it, or make sure other cards do."]);
        if (ab.trigger === "onReach" && ab.at <= (ab.stat === "health" ? r.health || 0 : ab.stat === "attack" ? r.attack || 0 : Math.max(r.attack || 0, r.health || 0))) out.push(["warn", "Evolve triggers at once: the threshold is not above its starting stats."]);
        if (ab.trigger === "work" && !(r.abilities || []).some((x) => x.trigger === "activate")) out.push(["warn", "Work counts activations, but this minion has no Activate effect."]);
      }
      if (r.magnetic && (r.abilities || []).some((ab) => ab.trigger === "battlecry")) out.push(["info", "Magnetic: when it merges into a friend, its Battlecry does not trigger (it does when played on its own)."]);
      if (r.rally && !r.tribe && !(r.tribes || []).length && !r.allTribes) out.push(["warn", "Rally counts friends of the same tribe: give it a tribe or it never grows."]);
      if (r.allTribes) out.push(["info", "“All tribes”: it fits every warband and every tribe buff. Keep its stats a little lower than usual."]);
      if ((r.tribes || []).length > 2) out.push(["warn", `${r.tribes.length} tribes is a lot; two reads best on the card.`]);
      if (r.tough && r.health <= 2) out.push(["info", "Tough on a low-Health minion: most tier 1 attackers can't scratch it."]);
      const kws = ["taunt", "shield", "reborn", "windfury", "venomous", "cleave", "stealth", "magnetic", "rally", "tough"].filter((k) => r[k]).length;
      if (kws >= 4) out.push(["warn", `${kws} keywords on one minion is hard to read in a fight.`]);
    }
    if (isHero(r) && r.powerType !== "passive" && r.powerCost === 0 && abs.some((ab) => !["gold", "goldRandom", "discover", "shuffleBoard", "refreshShop", "freezeShop"].includes(ab.action) || ab.action === "gold" && (ab.n || 0) > 1)) out.push(["warn", "A free active power every turn is usually too strong. Try a cost of 1 or 2, or make it once per game."]);
    if (isHero(r) && r.powerType !== "passive" && abs.every((ab) => ab.limit === "game")) out.push(["info", "Every effect is once per game, so the power is spent after one use."]);
    if (isSpell(r) && r.cost === 0 && abs.some((ab) => ["buff", "makeGolden", "doubleStats", "summonCopy"].includes(ab.action))) out.push(["warn", "A 0-cost stat spell: with Magma Titan or “spells cast twice” auras this snowballs."]);
    if (isAnom(r) && abs.some((ab) => ab.action === "ruleDamage" && ab.n > 0) && abs.some((ab) => ab.action === "armor")) out.push(["info", "More fight damage plus Armor cancel out early and bite late. Fine, if that's the point."]);
    if (abs.some((ab) => ab.cond === "lowHealth" && ab.trigger === "gameStart")) out.push(["warn", "“If your hero has 10 or less Health” never applies at the start of the game."]);
    if (abs.some((ab) => ab.minTurn > 1 && ab.limit === "game" && ab.trigger === "startOfTurn")) out.push(["info", "“Only from turn N” with “once per game” fires exactly once, on turn N."]);
    return out;
  }
  function renderMeter() {
    const box = $("#ceMeter", el); if (!box || !cur) return;
    let head = "";
    if (kindOf(cur) === "minion") {
      const avg = tierAvg[cur.tier] || 6, st = (cur.attack || 0) + (cur.health || 0), ratio = st / avg;
      const fx = (cur.abilities || []).length + (cur.builtIn && !cur.noBuiltIn ? 1 : 0);
      const label = ratio < 0.7 ? "light" : ratio < 1.15 ? "fair" : ratio < 1.6 ? "heavy" : "overloaded";
      const pct = Math.max(4, Math.min(100, Math.round(ratio * 50)));
      head = `<div class="ce-meter-row"><span>Stats for tier ${cur.tier}</span><b class="m-${label}">${label}</b></div>
        <div class="ce-bar"><i style="width:${pct}%" class="m-${label}"></i><em style="left:50%"></em></div>
        <small>${st} total vs ${avg.toFixed(1)} on average for built-in tier ${cur.tier} minions · ${fx ? fx + " effect" + (fx > 1 ? "s" : "") : "no effect"}</small>`;
    }
    const notes = lint(cur);
    box.innerHTML = head + (notes.length ? `<ul class="ce-lint">${notes.map(([k, t]) => `<li class="${k}">${esc(t)}</li>`).join("")}</ul>` : "");
    box.hidden = !head && !notes.length;
  }
  // Copy the current card alone, in the same format as Export, so a friend can paste it into Import.
  async function shareCard() {
    if (!cur) return;
    const data = { format: "warband-arena-cards", version: 1, cards: [], images: {} };
    if (isHero(cur)) data.heroes = [packHero(cur)]; else if (isAnom(cur)) data.anomalies = [packAnom(cur)]; else data.cards = [clone(plainRec(cur))];
    const all = await ST.allImages(); if (all[imgKey(cur)]) data.images[imgKey(cur)] = all[imgKey(cur)];
    const text = JSON.stringify(data);
    const ta = $("#ceIO", el); ta.hidden = false; ta.value = text; ta.select();
    try { await navigator.clipboard.writeText(text); status(`Copied “${cur.name}” to the clipboard${rec ? " with its picture" : ""}. Anyone can paste it into Import.`); }
    catch (e) { status("Select the text below and copy it to share this card.", "warn"); }
  }

  // ---------------------------------------------------------------- save / delete
  async function save() {
    if (!cur) return;
    if (cur._norm) { cur = plainRec(cur); renderForm(); } // saved as normal + golden; the form goes back to the normal effects
    if (!(cur.name || "").trim()) { status("Give the card a name first.", "err"); return; }
    // the placeholder name would show up in games (Discover, tavern...) as "New minion"
    if (/^New (minion|spell|hero|anomaly|affinity)$/i.test(cur.name.trim()) && pending !== "defname") { pending = "defname"; status(`It's still called “${cur.name.trim()}”. Rename it, or click Save again to keep that name.`, "warn"); $("[data-f=name]", el) && $("[data-f=name]", el).focus(); return; }
    if (isSpell(cur) && !cur.builtIn && !cur.abilities.length) { status("A spell needs at least one effect.", "err"); return; }
    if (isAff(cur)) {
      if (cur.tpl === "none" && !cur.abilities.length) { status("Without a mechanic template, an affinity needs at least one level effect.", "err"); return; }
      try { cur.name = cur.name.trim(); await ST.saveAffinities(affCfgWith(cur)); dirty = false; pending = null; renderList(); preview(); status("Affinity saved. Tick it on minions (Minion > Affinities)."); }
      catch (e) { status("Could not save: " + (e.message || e), "err"); }
      return;
    }
    if (isKw(cur)) {
      if (!cur.abilities.length) { status("A keyword needs at least one effect.", "err"); return; }
      try { cur.name = cur.name.trim(); await ST.saveKeywords(kwsWith(cur)); dirty = false; pending = null; renderList(); preview(); status("Keyword saved. Tick it on minions under Keywords."); }
      catch (e) { status("Could not save: " + (e.message || e), "err"); }
      return;
    }
    if (isAnom(cur)) {
      if (!cur.abilities.length) { status("An anomaly needs at least one rule.", "err"); return; }
      try {
        cur.name = cur.name.trim();
        if (img && img.changed) await ST.saveImage(imgKey(cur), img.removed ? null : { src: img.src, crop: img.crop, tcrop: img.tcrop || { ...img.crop }, tok: img.tok, card: img.card });
        if (img) img.changed = false;
        await ST.saveAnomalies(anomsWith(cur));
        dirty = false; pending = null; renderList(); preview();
        status("Anomaly saved. Pick Anomaly mode in the main menu to play it.");
      } catch (e) { status("Could not save: " + (e.message || e), "err"); }
      return;
    }
    if (isHero(cur)) {
      if (!cur.abilities.length) { status("A hero power needs at least one effect.", "err"); return; }
      try {
        cur.name = cur.name.trim();
        if (img && img.changed) await ST.saveImage(imgKey(cur), img.removed ? null : { src: img.src, crop: img.crop, tcrop: img.tcrop || { ...img.crop }, tok: img.tok, card: img.card });
        if (img) img.changed = false;
        await ST.saveHeroes(heroesWith(cur));
        dirty = false; pending = null; renderList(); preview();
        status("Hero saved. You can pick it from your next game.");
      } catch (e) { status("Could not save: " + (e.message || e), "err"); }
      return;
    }
    try {
      cur.name = cur.name.trim();
      if (img && img.changed) await ST.saveImage(imgKey(cur), img.removed ? null : { src: img.src, crop: img.crop, tcrop: img.tcrop || { ...img.crop }, tok: img.tok, card: img.card });
      if (img) img.changed = false;
      work = work.filter((r) => !(r.id === cur.id && kindOf(r) === kindOf(cur)));
      if (!fixedSpell(cur)) work.push(clone(cur)); // the old fixed built-in spells only keep a picture
      await ST.saveCards(work);
      work = clone(ST.cards);
      dirty = false; pending = null;
      renderList(); preview();
      status(isSpell(cur) ? "Saved. It can show up in the tavern from your next game." : cur.inPool === false ? "Saved. It stays out of the tavern; effects can still summon it." : "Saved. It joins the tavern from your next game.");
    } catch (e) { status("Could not save: " + (e.message || e), "err"); }
  }
  async function remove() {
    if (!cur) return;
    if (isAff(cur)) {
      const cfg = affCfgNow();
      if (cur.builtIn) {
        if (cur.hidden) { if (cfg[cur.id]) delete cfg[cur.id].deleted; await ST.saveAffinities(cfg); cur.hidden = false; dirty = false; renderList(); renderForm(); preview(); status("Affinity back in this meta."); return; }
        if (pending !== "remove") { pending = "remove"; status("Click again to hide this built-in affinity in this meta (you can bring it back).", "warn"); return; }
        pending = null; cfg[cur.id] = Object.assign(cfg[cur.id] || {}, { deleted: true }); await ST.saveAffinities(cfg); cur.hidden = true; dirty = false; renderList(); renderForm(); preview(); status("Hidden in this meta. Open it again and click Restore to bring it back."); return;
      }
      if (pending !== "remove") { pending = "remove"; status("Click again to delete this affinity (minions lose it).", "warn"); return; }
      pending = null; delete cfg[cur.id]; if (cfg.order) cfg.order = cfg.order.filter((k) => k !== cur.id); await ST.saveAffinities(cfg);
      dirty = false; startNew("minion", true); status("Affinity deleted."); return;
    }
    if (isKw(cur)) {
      if (pending !== "remove") { pending = "remove"; status("Click again to delete this keyword (minions lose it).", "warn"); return; }
      pending = null; await ST.saveKeywords(kwList().filter((k) => k.id !== cur.id));
      dirty = false; startNew("minion", true); status("Keyword deleted."); return;
    }
    if (isAnom(cur)) {
      if (pending !== "remove") { pending = "remove"; status("Click again to delete this anomaly.", "warn"); return; }
      pending = null;
      await ST.saveImage(imgKey(cur), null);
      await ST.saveAnomalies(anomList().filter((a) => a.id !== cur.id));
      dirty = false; startNew("minion", true); status("Anomaly deleted."); return;
    }
    if (isHero(cur)) {
      if (pending !== "remove") { pending = "remove"; status("Click again to delete this hero.", "warn"); return; }
      pending = null;
      await ST.saveImage(imgKey(cur), null);
      await ST.saveHeroes(heroList().filter((h) => h.id !== cur.id));
      dirty = false; startNew("minion", true); status("Hero deleted."); return;
    }
    if (pending !== "remove") { pending = "remove"; status(cur.builtIn ? "Click again to restore the original card (its picture is removed too)." : "Click again to delete this card for good.", "warn"); return; }
    pending = null;
    try {
      work = work.filter((r) => !(r.id === cur.id && kindOf(r) === kindOf(cur)));
      if (!cur.builtIn) for (const r of work) for (const ab of r.abilities || []) if (ab.card === cur.id) delete ab.card;
      await ST.saveImage(imgKey(cur), null);
      W.registerCustom(work, regOpts());
      await ST.saveCards(work.map((r) => ({ ...r, abilities: (r.abilities || []).map((ab) => fixAbility(ab, r)) })));
      work = clone(ST.cards);
      const wasBuiltIn = cur.builtIn, key = curKey;
      dirty = false;
      if (wasBuiltIn) await select(key); else startNew("minion", true);
      status(wasBuiltIn ? "Original card restored." : "Card deleted.");
    } catch (e) { status("Could not delete: " + (e.message || e), "err"); }
  }

  // Copy the card being edited into a new card of your own (built-in effects can't be copied, only the effects listed here).
  async function duplicate() {
    const copy = clone(plainRec(cur)), was = cur.name;
    copy.id = newId(isAff(cur) ? "af" : isSpell(cur) ? "s_" : isHero(cur) ? "h_" : isAnom(cur) ? "an_" : "c_"); if (isAff(cur)) { copy.hidden = false; copy.name = (cur.name + " II").slice(0, 18); } copy.name = (cur.name + " copy").slice(0, 28); copy.builtIn = false; if (!isSpell(copy)) copy.noBuiltIn = true;
    const pic = img && !img.removed && img.src ? { ...img, crop: { ...img.crop }, changed: true } : null;
    cur = copy; curKey = kindOf(copy) + "|" + copy.id; img = pic; dirty = true; pending = null; quickOpen = false; histReset();
    if (pic) await refreshImage();
    renderList(); renderForm(); preview();
    status(`This is a copy of ${was}. Save card to keep it.`, "warn");
  }

  // ---------------------------------------------------------------- watch it fight
  // The card goes into a random warband of its tier and fights a sparring partner on the real table.
  async function watchFight() {
    if (!cur || !root.WA_UI || !root.WA_UI.previewFight) return;
    if (powerLike(cur)) { status("Heroes and anomalies don't fight on their own: put one of their effects on a minion to watch it.", "warn"); return; }
    applyDraft();
    const tier = Math.max(1, Math.min(6, cur.tier || 1)), rng = W.makeRng(Math.floor(Math.random() * 1e9));
    const ids = Object.keys(W.CARDS).filter((k) => W.CARDS[k].inPool !== false && W.CARDS[k].tier <= tier && !W.CARDS[k].retired && k !== cur.id);
    const mk = (n, boost) => { const b = []; for (let i = 0; i < n && ids.length; i++) { const m = new W.Minion(rng.pick(ids)); const g = rng.int(0, boost); m.buff(g, g); b.push(m); } return b; };
    let mine, theirs;
    if (isSpell(cur)) {
      // a spell is cast on a plain board first, so you see what it did
      mine = mk(4, tier); theirs = mk(4 + (tier > 3 ? 1 : 0), tier + 1);
      const g = new W.Game(2, 1, true, { tribes: W.TRIBES.slice() }); const p = g.human(); p.board = mine; p.hand = [new W.Spell(cur.id)]; p.gold = 10; p.tier = tier;
      const err = g.cast(p, 0, 0); if (err) { status(err, "err"); return; }
      mine = p.board;
    } else {
      mine = mk(3 + (tier > 2 ? 1 : 0), tier); const me = new W.Minion(cur.id, golden); mine.splice(rng.int(0, mine.length), 0, me);
      theirs = mk(4 + (tier > 3 ? 1 : 0), tier + 1);
    }
    status("Fight on the table... (Skip to come straight back)");
    el.hidden = true;
    let out = "";
    try { out = await root.WA_UI.previewFight({ mine, theirs, tier, oppName: "Trainer" }); } catch (e) { out = ""; }
    el.hidden = false;
    status(out === "win" ? "Your side won. Back to the editor." : out === "loss" ? "Your side lost. Back to the editor." : out === "draw" ? "A draw. Back to the editor." : out || "", out === "loss" ? "warn" : "");
  }

  // ---------------------------------------------------------------- forge: three random, coherent drafts
  const WORDS = {
    Beast: [["Fang", "Moss", "Thorn", "Howl", "Mire", "Burrow", "Tusk", "Bramble"], ["Hound", "Stalker", "Matron", "Alpha", "Prowler", "Cub", "Boar", "Warden"]],
    Construct: [["Tin", "Gear", "Brass", "Iron", "Cog", "Rivet", "Piston", "Clock"], ["Golem", "Squire", "Sentinel", "Engine", "Automaton", "Knight", "Forge", "Bulwark"]],
    Spirit: [["Grave", "Pale", "Ash", "Wailing", "Hollow", "Dusk", "Bone", "Veil"], ["Shade", "Moth", "Lich", "Warden", "Mourner", "Wisp", "Revenant", "Sovereign"]],
    Corsair: [["Deck", "Bounty", "Salt", "Gold", "Dread", "Brine", "Plank", "Powder"], ["Scamp", "Captain", "Smuggler", "Cannoneer", "Corsair", "Admiral", "Mate", "Lookout"]],
    Elemental: [["Spark", "Molten", "Cinder", "Storm", "Magma", "Ember", "Gale", "Frost"], ["Sprite", "Brute", "Chef", "Djinn", "Titan", "Flame", "Wisp", "Shard"]],
    Dragon: [["Ember", "Scale", "Hoard", "Twin-Flame", "Aurum", "Cinder", "Sky", "Obsidian"], ["Whelp", "Warder", "Keeper", "Drake", "Wyrm", "Ancient", "Broodmother", "Tyrant"]],
    Tidekin: [["Reef", "Shell", "Tide", "Pearl", "Deep", "Coral", "Kelp", "Brine"], ["Crier", "Drummer", "Caller", "Diver", "Chanter", "Herald", "Priest", "Scout"]],
    Infernal: [["Grubling", "Hungering", "Soul", "Pit", "Abyssal", "Cinder", "Hex", "Gluttonous"], ["Imp", "Fiend", "Glutton", "Butcher", "Maw", "Lord", "Tormentor", "Warlock"]],
    "": [["Lantern", "Tavern", "Rallying", "Great", "Grand", "Wandering", "Old", "Silent"], ["Keeper", "Bard", "Herald", "Warden", "Champion", "Pilgrim", "Drifter", "Sage"]],
  };
  const SPELL_WORDS = [["Lucky", "Tavern", "Smith's", "Hearty", "Mirror", "Venom", "War", "Gold", "Quick", "Wild"], ["Coin", "Brew", "Polish", "Feast", "Draught", "Vial", "Banner", "Rush", "Horn", "Blessing", "Trick", "Tonic"]];
  const HERO_WORDS = [["Marshal", "Tinker", "Captain", "Witch", "Gardener", "Warden", "Merchant", "Goldsmith", "Seer", "Mimic", "Duke", "Pickpocket", "Bard", "Gambler", "Mama", "Weaver"], ["Varga", "Ollo", "Sela", "Pyre", "Moss", "Gil", "Pell", "Ira", "Vael", "Nox", "Rook", "Vex", "Wren", "Tamsin", "Hobb", "Ysolde"]];
  const ANOM_WORDS = [["Gift", "Bargain", "Gilded", "Head", "Deep", "Grand", "Iron", "Spell", "Blood", "Topsy", "Tribal", "Fortune", "Wild", "Thieves'", "Echo", "Late", "Fog of", "Grave"], ["Exchange", "Bin", "Tavern", "Start", "Pockets", "Market", "Heroes", "Storm", "Moon", "Turvy", "Fair", "Teller", "Blessings", "Guild", "Chamber", "Bloom", "War", "Robbers"]];
  const THEMES = { any: "Surprise me", summon: "Summons and tokens", buff: "Buffs and growth", damage: "Damage and Start of Combat", gold: "Gold and tavern tricks", keyword: "Keywords", deathrattle: "Deathrattles", chaos: "Chaos and theft", devour: "Devour and hunger", synergy: "Tribe synergy" };
  const frng = { next: () => Math.random(), int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)), pick: (arr) => arr[Math.floor(Math.random() * arr.length)], chance: (p) => Math.random() < p };
  const LOOK = { damage: ["fire", "lightning", "arrow", "frost", "dust", "meat"], buff: ["nature", "holy", ""], chaos: ["shadow", "poison", "void", "wind", "water"] };
  function forgeName(kind, tribe) {
    if (kind === "spell") return `${frng.pick(SPELL_WORDS[0])} ${frng.pick(SPELL_WORDS[1])}`;
    if (kind === "hero") return `${frng.pick(HERO_WORDS[0])} ${frng.pick(HERO_WORDS[1])}`;
    if (kind === "anomaly") return `${frng.pick(ANOM_WORDS[0])} ${frng.pick(ANOM_WORDS[1])}`;
    const w = WORDS[tribe] || WORDS[""];
    const t = tribe && !WORDS[tribe] ? TN(tribe) : "";
    return t && frng.chance(0.5) ? `${t} ${frng.pick(w[1])}` : `${frng.pick(w[0])} ${frng.pick(w[1])}`;
  }
  // one effect for a theme, scaled to the tier; `tribe` adds filters now and then
  function forgeAbility(theme, tier, tribe, kind) {
    const t = theme === "any" ? frng.pick(["summon", "buff", "damage", "gold", "keyword", "deathrattle", "chaos", "devour", "synergy"]) : theme;
    const n = Math.max(1, Math.round(tier * frng.pick([0.5, 0.7, 1])));
    const half = Math.max(1, Math.ceil(tier / 2));
    const tr = tribe && frng.chance(0.5) ? tribe : "";
    const A = {
      summon: () => frng.pick([
        { trigger: "deathrattle", action: "summon", card: frng.pick(["pup", "cub"]), count: tier >= 3 ? 2 : 1, a: half, h: half },
        { trigger: "battlecry", action: "summonRandom", count: 1, tier: Math.max(1, tier - 2) },
        { trigger: "onSummonAlly", action: "buff", target: "trigger", a: half, h: half, ftribe: tr },
        { trigger: "startOfCombat", action: "summon", card: "cub", count: 1, a: n, h: n },
        { trigger: "onAllyDeath", action: "summonCopy", target: "trigger", count: 1, h: 1, every: 2 }]),
      buff: () => frng.pick([
        { trigger: "battlecry", action: "buff", target: "randomFriend", count: 1, a: n, h: n, ttribe: tr, fx: frng.pick(LOOK.buff) },
        { trigger: "endOfTurn", action: "buff", target: tier >= 4 ? "allFriends" : "self", a: half, h: half },
        { trigger: "onBuy", action: "buff", target: "self", a: 1, h: 1, ftribe: tr },
        { trigger: "afterSurvive", action: "buff", target: "self", a: n, h: n },
        { trigger: "onAttack", action: "permBuff", target: "self", a: n, h: 0 },
        { trigger: "battlecry", action: "buff", target: "allFriends", a: half, h: half, ttribe: tr, per: tier >= 4 ? "friend" : undefined, perTribe: tr || undefined }]),
      damage: () => frng.pick([
        { trigger: "startOfCombat", action: "damage", target: "randomEnemy", count: tier >= 4 ? 2 : 1, n, fx: frng.pick(LOOK.damage) },
        { trigger: "onAttack", action: "damage", target: "randomEnemy", count: 1, n: half, fx: frng.pick(LOOK.damage) },
        { trigger: "deathrattle", action: "damage", target: "allEnemies", n: half, fx: "fire" },
        { trigger: "onDamaged", action: "damage", target: "randomEnemy", count: 1, n: half, fx: "frost" },
        { trigger: "onKill", action: "buff", target: "self", a: n, h: n },
        { trigger: "startOfCombat", action: "damage", target: "allEnemies", n: Math.max(1, half - 1), fx: "lightning" }]),
      gold: () => frng.pick([
        { trigger: "onSell", action: "gold", n: half },
        { trigger: "afterCombat", action: "nextGold", n: 1 },
        { trigger: "onKill", action: "combatGold", n: 1 },
        { trigger: "battlecry", action: "freeRoll", n: 1 },
        { trigger: "endOfTurn", action: "tavernBuff", n: 1 },
        { trigger: "battlecry", action: "discover", tierMode: "current" },
        { trigger: "onRoll", action: "buff", target: "self", a: 1, h: 1 }]),
      keyword: () => frng.pick([
        { trigger: "battlecry", action: "keyword", kw: frng.pick(["taunt", "shield", "reborn", "windfury", "rally", "tough"]), target: "randomFriend", count: 1, ttribe: tr },
        { trigger: "startOfCombat", action: "keyword", kw: frng.pick(["shield", "rally", "taunt"]), target: "allFriends", ttribe: tr || tribe },
        { trigger: "onShieldLost", action: "buff", target: "allFriends", a: half, h: 0, ttribe: tr },
        { trigger: "battlecry", action: "randomKeyword", target: "randomFriend", count: 1 }]),
      deathrattle: () => frng.pick([
        { trigger: "deathrattle", action: "buff", target: "allFriends", a: half, h: half, ttribe: tr },
        { trigger: "deathrattle", action: "summon", card: "pup", count: 2, a: half, h: half },
        { trigger: "deathrattle", action: "resurrect", count: 1, h: 1 },
        { trigger: "onDeathrattleFriend", action: "buff", target: "self", a: 1, h: 1 },
        { trigger: "deathrattle", action: "heroDamage", n: n + 1 },
        { trigger: "deathrattle", action: "damage", target: "randomEnemy", count: 1, n: n + 1, fx: "shadow" }]),
      chaos: () => frng.pick([
        { trigger: "startOfCombat", action: "steal", count: 1 },
        { trigger: "startOfCombat", action: "silence", target: "leftmost" },
        { trigger: "startOfCombat", action: "shuffleEnemies" },
        { trigger: "battlecry", action: "swapStats", target: "self" },
        { trigger: "onOverkill", action: "doubleStats", stat: "attack", target: "self" },
        { trigger: "battlecry", action: "transform", target: "randomFriend", count: 1, tier: Math.min(6, tier + 1) },
        { trigger: "onEnemySummon", action: "damage", target: "trigger", n: half, fx: "poison" },
        { trigger: "onLastStanding", action: "attackNow", target: "self" }]),
      devour: () => frng.pick([
        { trigger: "battlecry", action: "devour", target: "self", count: tier >= 4 ? 2 : 1 },
        { trigger: "endOfTurn", action: "devour", target: "self", count: 1, every: tier >= 4 ? 1 : 2 },
        { trigger: "battlecry", action: "devour", target: "self", count: 1, devourFrom: "board" },
        { trigger: "onDevoured", action: "buff", target: "trigger", a: n, h: n },
        { trigger: "onDevoured", action: "addCopy", target: "self" },
        { trigger: "onDevoured", action: "hero", n: -half },
        { trigger: "startOfCombat", action: "devourEnemy", count: 1, share: tier >= 5 ? "full" : "half", fx: "shadow" },
        { trigger: "passive", action: "devourBonus", a: half, h: half },
        { trigger: "passive", action: "devourKeywords" },
        { trigger: "afterDevour", action: "buff", target: "trigger", a: 1, h: 1 },
        { trigger: "startOfCombat", action: "buff", target: "self", a: n, h: n, cond: "fed" },
        { trigger: "endOfTurn", action: "buff", target: "self", a: 1, h: 1, per: "devours" }]),
      synergy: () => {
        const tt = tribe || tr || frng.pick(W.TRIBES.length ? W.TRIBES : [""]);
        return frng.pick([
          { trigger: "onPlayOther", action: "buff", target: "self", a: 1, h: 1, ftribe: tt },
          { trigger: "battlecry", action: "buff", target: "allFriends", a: half, h: half, ttribe: tt },
          { trigger: "onAllyDeath", action: "buff", target: "allFriends", a: 1, h: 1, ftribe: tt, ttribe: tt },
          { trigger: "endOfTurn", action: "buff", target: "randomFriend", count: 1, a: n, h: n, ttribe: tt },
          { trigger: "battlecry", action: "addMinion", count: 1, tribe: tt },
          { trigger: "startOfCombat", action: "buff", target: "allFriends", a: 1, h: 0, ttribe: tt, per: "friend", perTribe: tt }]);
      },
    };
    const ab = A[t] ? A[t]() : A.buff();
    for (const k of Object.keys(ab)) if (ab[k] === "" || ab[k] === undefined) delete ab[k];
    return ab;
  }
  function forgeDraft(kind, tribe, tier, theme) {
    tier = tier || frng.int(1, 6);
    if (kind === "spell") {
      const r = { id: newId("s_"), kind: "spell", name: forgeName("spell"), tier, cost: Math.max(0, Math.min(5, tier - frng.int(0, 1))), target: false, abilities: [], customText: "" };
      const half = Math.max(1, Math.ceil(tier / 2)), n = Math.max(1, tier);
      const ab = frng.pick([
        { trigger: "cast", action: "buff", target: "chosen", a: n, h: n }, { trigger: "cast", action: "keyword", target: "chosen", kw: frng.pick(["taunt", "shield", "reborn", "windfury", "dodge", "tough", "venomous"]) },
        { trigger: "cast", action: "buff", target: "allFriends", a: half, h: half }, { trigger: "cast", action: "gold", n: half }, { trigger: "cast", action: "discover", tierMode: frng.pick(["current", "up", "random"]) },
        { trigger: "cast", action: "nextCombatStrike", n: half, spread: tier >= 4 ? "all" : "random", count: 2, fx: frng.pick(LOOK.damage) }, { trigger: "cast", action: "summonRandom", count: 1, tier: Math.max(1, tier - 1) },
        { trigger: "cast", action: "silence", target: "chosen" }, { trigger: "cast", action: "doubleStats", stat: frng.pick(["attack", "health"]), target: "chosen" }, { trigger: "cast", action: "stealShop", count: 1 },
        { trigger: "cast", action: "grantEffect", target: "chosen", grant: forgeAbility(theme === "any" ? frng.pick(["summon", "damage", "buff"]) : theme, tier, tribe, "minion") }]);
      r.abilities = [ab]; r.target = ab.target === "chosen";
      return r;
    }
    if (kind === "hero") {
      const passive = frng.chance(0.5);
      const r = { id: newId("h_"), kind: "hero", name: forgeName("hero"), health: frng.pick([26, 28, 30, 30, 32, 34]), powerName: frng.pick(["Drill", "Scrap Plans", "Fence", "Kindling", "Pruning", "Haggle", "Gild", "Glimpse", "Echo", "Loaded Dice", "Light Fingers", "Reweave", "Second Wind", "War Chest"]), powerType: passive ? "passive" : "active", powerCost: frng.int(1, 3), abilities: [], customText: "" };
      r.abilities = [passive ? frng.pick([
        { trigger: "endOfTurn", action: "buff", target: frng.pick(["leftmost", "rightmost", "randomFriend"]), count: 1, a: 1, h: 1, fx: "nature" },
        { trigger: "startOfCombat", action: "damage", target: "randomEnemy", count: 2, n: 1, fx: frng.pick(LOOK.damage) },
        { trigger: "onBuy", action: "buff", target: "trigger", a: 1, h: 1, ftribe: tribe || undefined },
        { trigger: "onSellOther", action: "gold", n: 1, every: 2 }, { trigger: "afterCombat", action: "nextGold", n: 1 },
        { trigger: "gameStart", action: frng.pick(["ruleBuy", "ruleShop", "ruleTriple", "ruleDamage", "ruleBank"]), n: frng.pick([-1, 1, 2]) },
        { trigger: "startOfTurn", action: "gold", n: 2, cond: "lowHealth" }, { trigger: "onDiscover", action: "buff", target: "trigger", a: 1, h: 1 },
        { trigger: "afterUpgrade", action: "discover", tierMode: "current" }, { trigger: "onPlayBattlecry", action: "repeatBattlecry", every: 3 }])
      : frng.pick([
        { trigger: "cast", action: "buff", target: "chosen", a: 1, h: 2 }, { trigger: "cast", action: "discover", tierMode: "current" }, { trigger: "cast", action: "goldRandom", n: 3 },
        { trigger: "cast", action: "goldenShop", count: 1 }, { trigger: "cast", action: "refreshUp", n: 1 }, { trigger: "cast", action: "stealShop", count: 1, limit: "game" },
        { trigger: "cast", action: "keyword", target: "chosen", kw: frng.pick(["taunt", "shield", "reborn"]) }, { trigger: "cast", action: "devour", target: "chosen", count: 1 },
        { trigger: "cast", action: "reposition", where: "front", target: "chosen" }, { trigger: "cast", action: "armor", n: 3 }])];
      if (r.powerType === "active" && r.abilities[0].limit === "game") r.powerCost = 0;
      return r;
    }
    if (kind === "anomaly") {
      const r = { id: newId("an_"), kind: "anomaly", name: forgeName("anomaly"), abilities: [], customText: "", banHeroes: [] };
      const pool = [
        { trigger: "gameStart", action: "ruleBuy", n: -1 }, { trigger: "gameStart", action: "ruleShop", n: 2 }, { trigger: "gameStart", action: "ruleTriple" }, { trigger: "gameStart", action: "ruleDamage", n: frng.pick([-2, 2]) },
        { trigger: "gameStart", action: "ruleGolden", pct: 15 }, { trigger: "gameStart", action: "armor", n: 10 }, { trigger: "gameStart", action: "freeUpgrade" }, { trigger: "gameStart", action: "ruleIncome", n: 1 },
        { trigger: "startOfTurn", action: "addSpell", count: 1 }, { trigger: "startOfTurn", action: "sharedPick", pickTier: "any", pct: 25, count: 3 }, { trigger: "startOfTurn", action: "tribeShop", tribeMode: "random", every: 2 },
        { trigger: "startOfCombat", action: "swapStats", target: "allFriends" }, { trigger: "startOfCombat", action: "randomKeyword", target: "randomFriend", count: 2 }, { trigger: "startOfCombat", action: "shuffleEnemies" },
        { trigger: "startOfCombat", action: "damage", target: "allEnemies", n: 1, fx: "shadow" }, { trigger: "afterCombat", action: "nextGold", n: 1 }, { trigger: "startOfTurn", action: "gold", n: 3, cond: "lowHealth" },
        { trigger: "startOfCombat", action: "buff", target: "allFriends", a: 2, h: 2, minTurn: 7 }, { trigger: "onPlayBattlecry", action: "repeatBattlecry", every: 2 }, { trigger: "endOfTurn", action: "shuffleBoard" }];
      const a = frng.pick(pool); r.abilities = [a]; if (frng.chance(0.35)) { const b = frng.pick(pool); if (b !== a) r.abilities.push(b); }
      return r;
    }
    // minion: stats from the tier budget, minus what the effects "cost"
    const avg = tierAvg[tier] || 3 + tier * 1.8;
    const fxCount = tier >= 3 && frng.chance(0.3) ? 2 : frng.chance(0.1) ? 0 : 1;
    const abilities = []; for (let i = 0; i < fxCount; i++) abilities.push(forgeAbility(theme, tier, tribe, "minion"));
    const kws = {}; const profile = frng.pick(["aggro", "balanced", "tank"]);
    const kwPool = profile === "tank" ? ["taunt", "shield", "tough", "reborn"] : profile === "aggro" ? ["windfury", "venomous", "cleave", "dodge"] : ["shield", "reborn", "dodge", "taunt"];
    const kwN = frng.chance(tier >= 3 ? 0.55 : 0.35) ? 1 : 0; for (let i = 0; i < kwN; i++) kws[frng.pick(kwPool)] = true;
    let total = Math.round(avg * (0.88 + frng.next() * 0.32) - fxCount * avg * 0.11 - Object.keys(kws).length * avg * 0.09);
    total = Math.max(2, total);
    const atkShare = profile === "aggro" ? 0.6 : profile === "tank" ? 0.38 : 0.5;
    let attack = Math.max(0, Math.round(total * atkShare)), health = Math.max(1, total - attack);
    if (kws.venomous) attack = Math.max(1, Math.min(attack, 4)); if (kws.windfury) attack = Math.max(1, attack - 1);
    const rarity = frng.pick(["common", "common", "common", "rare", "rare", "epic", "legendary"]);
    const atkFx = abilities.some((ab) => ab.action === "damage") && frng.chance(0.5) ? frng.pick(LOOK.damage) : "";
    const tribes = tribe ? [tribe] : [];
    if (tribe && frng.chance(0.15)) { const o = W.TRIBES.filter((t) => t !== tribe); if (o.length) tribes.push(frng.pick(o)); }
    const allT = !tribe && tier >= 4 && frng.chance(0.12);
    return Object.assign({ id: newId("c_"), kind: "minion", name: forgeName("minion", tribe), tribe: tribe || "", tribes, allTribes: allT, tier, attack, health, abilities, noBuiltIn: true, customText: "", inPool: true, rarity, attackFx: atkFx }, kws);
  }
  function openForge() {
    view = "forge"; cur = null; curKey = ""; dirty = false; pending = null; tdraft = null; crop = null;
    forge = forge || { kind: "minion", tribe: "", tier: 0, theme: "any", drafts: [] };
    forge.drafts = [];
    renderMetas(); renderList();
    $("#cePvCard", el).innerHTML = ""; $("#cePvTok", el).innerHTML = ""; $("#ceText", el).innerHTML = ""; $("#ceMeter", el).hidden = true; $("#ceTestOut", el).innerHTML = "";
    rollForge();
  }
  function rollForge() {
    const f = forge;
    const tribeFor = () => (f.tribe === "~" ? "" : f.tribe || (frng.chance(0.75) && W.TRIBES.length ? frng.pick(W.TRIBES) : ""));
    f.drafts = [0, 1, 2].map(() => { let d = forgeDraft(f.kind, tribeFor(), f.tier, f.theme); d.abilities = (d.abilities || []).map((ab) => fixAbility(ab, d)); return d; });
    renderForge();
  }
  function renderForge() {
    const f = forge, kinds = [["minion", "Minion"], ["spell", "Spell"], ["hero", "Hero"], ["anomaly", "Anomaly"]];
    // the drafts have to exist in the engine for the card previews
    const list = work.slice(); for (const d of f.drafts) if (!powerLike(d)) list.push(d);
    const o = regOpts(); if (f.kind === "hero") o.heroes = heroList().concat(f.drafts.map(packHero)); if (f.kind === "anomaly") o.anomalies = anomList().concat(f.drafts.map(packAnom));
    W.registerCustom(list, o);
    const card = (d) => {
      const box = document.createElement("button"); box.type = "button"; box.className = "forge-card"; box.dataset.draft = f.drafts.indexOf(d);
      const txt = isHero(d) ? W.heroPowerText(d.id) : isAnom(d) ? W.anomalyText(d.id) : isSpell(d) ? new W.Spell(d.id).text : new W.Minion(d.id).dict().text;
      if (isHero(d)) box.innerHTML = `<div class="ce-heroprev"><div class="hp-portrait"><span>${esc(d.name[0])}</span></div><div class="hp-hname">${esc(d.name)}</div><div class="hp-life">${d.health} Health</div><div class="hp-box"><b>${esc(d.powerName)}</b><small>${d.powerType === "passive" ? "Passive" : d.powerCost + " gold · once per turn"}</small><p>${esc(txt)}</p></div></div>`;
      else if (isAnom(d)) box.innerHTML = `<div class="anom-card"><div class="an-art"><span>✦</span></div><div class="an-body"><div class="an-kicker">Anomaly</div><div class="an-name">${esc(d.name)}</div><p>${esc(txt)}</p></div></div>`;
      else { const inner = isSpell(d) ? helpers.makeCard(new W.Spell(d.id)) : helpers.makeCard(new W.Minion(d.id).dict()); inner.classList.add("static"); box.appendChild(inner); }
      const notes = lint(d).filter(([k]) => k === "warn");
      box.insertAdjacentHTML("beforeend", `<div class="forge-foot"><b>${esc(d.name)}</b>${isSpell(d) ? ` · ${d.cost} gold · tier ${d.tier}` : isHero(d) ? ` · ${d.health} Health` : isAnom(d) ? ` · ${d.abilities.length} rule${d.abilities.length > 1 ? "s" : ""}` : ` · ${d.attack}/${d.health} · tier ${d.tier}${d.tribe ? " · " + esc(TN(d.tribe)) : ""}`}${notes.length ? `<i title="${esc(notes.map(([, t]) => t).join(" "))}">⚠ ${notes.length}</i>` : ""}<span>Pick this one</span></div>`);
      return box;
    };
    $("#ceForm", el).innerHTML = `<div class="ce-sec forge"><h3>✦ The Forge</h3>
      <p class="ce-hint">Three drafts, dealt from the same rules the engine runs. Pick one and change anything about it afterwards, or reroll until something sings.</p>
      <div class="forge-ctl">
        <div class="ce-field"><span class="ce-lab">Kind</span><div class="ce-chips">${kinds.map(([k, l]) => `<label class="ce-chip"><input type="radio" name="fgKind" value="${k}" ${f.kind === k ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></div>
        ${f.kind === "minion" ? `<div class="ce-field"><span class="ce-lab">Tribe</span><div class="ce-chips">${[["", "Any"], ["~", "Neutral"], ...W.TRIBES.map((t) => [t, TN(t)])].map(([v, l]) => `<label class="ce-chip tribe" data-tribe="${esc(v)}"><input type="radio" name="fgTribe" value="${esc(v)}" ${f.tribe === v ? "checked" : ""}>${v ? ART.tribeIcon(v) : ""}<span>${esc(l)}</span></label>`).join("")}</div></div>` : ""}
        ${f.kind === "minion" || f.kind === "spell" ? `<div class="ce-field"><span class="ce-lab">Tier</span><div class="ce-chips">${[[0, "Any"], ...[1, 2, 3, 4, 5, 6].map((n) => [n, "Tier " + n])].map(([v, l]) => `<label class="ce-chip"><input type="radio" name="fgTier" value="${v}" ${f.tier === v ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></div>` : ""}
        ${f.kind === "minion" || f.kind === "spell" ? `<div class="ce-field"><span class="ce-lab">Theme</span><div class="ce-chips">${Object.entries(THEMES).map(([k, l]) => `<label class="ce-chip"><input type="radio" name="fgTheme" value="${k}" ${f.theme === k ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></div>` : ""}
      </div>
      <div class="forge-grid" id="forgeGrid"></div>
      <div class="ce-row"><button type="button" class="pill big forge" id="fgReroll">↻ Reroll all three</button><button type="button" class="pill" id="fgKeepAll" title="Save all three as they are">Keep all three</button></div>
    </div>`;
    const grid = $("#forgeGrid", el); for (const d of f.drafts) grid.appendChild(card(d));
    const form = $("#ceForm", el);
    form.onchange = (e) => { const t = e.target; if (!t.name) return; if (t.name === "fgKind") f.kind = t.value; if (t.name === "fgTribe") f.tribe = t.value; if (t.name === "fgTier") f.tier = +t.value; if (t.name === "fgTheme") f.theme = t.value; rollForge(); };
    form.onclick = async (e) => {
      const b = e.target.closest("[data-draft]"); if (b) { pickDraft(f.drafts[+b.dataset.draft]); return; }
      if (e.target.closest("#fgReroll")) { rollForge(); status("Three new drafts."); return; }
      if (e.target.closest("#fgKeepAll")) { await keepDrafts(f.drafts); }
    };
    [...el.querySelectorAll(".forge-card .card")].forEach((c, i) => c.animate([{ transform: "rotateY(90deg) scale(.9)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 360, delay: i * 90, easing: "ease-out", fill: "backwards" }));
  }
  async function keepDrafts(drafts) {
    const hs = drafts.filter(isHero), as = drafts.filter(isAnom), cs = drafts.filter((d) => !powerLike(d));
    if (cs.length) { work = work.concat(cs.map(clone)); await ST.saveCards(work); work = clone(ST.cards); }
    if (hs.length) await ST.saveHeroes(heroList().concat(hs.map(packHero)));
    if (as.length) await ST.saveAnomalies(anomList().concat(as.map(packAnom)));
    renderList(); status(`Saved ${drafts.length} forged ${drafts.length === 1 ? "card" : "cards"}. They join your next game.`); rollForge();
  }
  function pickDraft(d) {
    form_off();
    view = "card"; renderMetas();
    cur = clone(d); curKey = kindOf(cur) + "|" + cur.id; img = null; dirty = true; pending = null; quickOpen = false; folded = new Set(); histReset();
    if (!(kindTab === "all" && (kindOf(cur) === "minion" || kindOf(cur) === "spell"))) kindTab = kindOf(cur);
    renderList(); renderForm(); preview(); $("#ceTestOut", el).innerHTML = "";
    status("Forged! Give it a picture, tweak anything, then Save. ✦ Forge deals three more any time.", "warn");
  }
  function form_off() { const form = $("#ceForm", el); form.onchange = null; form.onclick = null; }

  // ---------------------------------------------------------------- test
  function runHeroTest() {
    applyDraft();
    const out = [];
    try {
      const g = new W.Game(2, Math.floor(Math.random() * 1e9), true, { tribes: W.TRIBES.slice() });
      const [p, q] = g.players;
      g.setHero(p, cur.id); p.tier = 2; p.gold = 10;
      const fill = () => { const id = g.drawWhere((id) => W.CARDS[id].tier <= 2); return id ? new W.Minion(id) : null; };
      p.board = [fill(), fill(), fill()].filter(Boolean); q.board = [fill(), fill(), fill()].filter(Boolean);
      const nameOf = (u) => (p.board.concat(p.hand).find((m) => m.uid === u) || {}).name || "";
      const log = (title, fx) => { const l = (fx || []).filter((f) => f && f.uids); out.push(`<li><b>${title}</b> ${l.length ? l.map((f) => esc((f.label || `+${f.a}/+${f.h}`) + (f.uids.length ? " on " + f.uids.map(nameOf).filter(Boolean).join(", ") : ""))).join("; ") : "<i>nothing happened</i>"}</li>`); };
      if (cur.powerType !== "passive") {
        const err = g.usePower(p, 0);
        if (err) out.push(`<li class="bad">${esc(err)}</li>`); else log(`Used ${esc(cur.powerName)} (${cur.powerCost} gold):`, g.lastEffects);
      } else {
        const trigs = [...new Set(cur.abilities.map((ab) => ab.trigger))];
        for (const t of trigs) {
          if (t === "startOfCombat") { g.nextPairs = [[p, q]]; const ev = g.combatPhase().fights[0].events.filter((e) => e.source === -1 && e.hero === 0); out.push(`<li><b>Start of Combat:</b> ${ev.length ? ev.map((e) => e.kind === "shoot" ? `hit ${e.hits.length} enem${e.hits.length === 1 ? "y" : "ies"}` : e.label || "rally").join(", ") : "<i>nothing happened</i>"}</li>`); continue; }
          g.lastEffects = [];
          for (let k = 0; k < 3; k++) g.heroTrig(p, t, p.board[0] || null);
          log(`${esc(W.TRIGGERS[t].label)} (3 times):`, g.lastEffects);
        }
      }
      if (p.gold !== 10) out.push(`<li>Gold ${p.gold > 10 ? "+" : ""}${p.gold - 10}</li>`);
      if (p.hand.length) out.push(`<li>Hand: ${p.hand.map((m) => esc(m.name)).join(", ")}</li>`);
      if (p.discover.length) out.push(`<li>Discover offered: ${p.discover.map((id) => esc(W.CARDS[id].name)).join(", ")}</li>`);
    } catch (e) { out.push(`<li class="bad">The test hit an error: ${esc(e.message)}</li>`); }
    $("#ceTestOut", el).innerHTML = `<h4>Test run</h4><ul>${out.join("")}</ul>`;
  }
  function runAnomTest() {
    applyDraft();
    const out = [];
    try {
      const g = new W.Game(4, Math.floor(Math.random() * 1e9), false, { anomaly: cur.id });
      for (let t = 0; t < 3 && !g.isOver(); t++) {
        g.startTurn();
        const p = g.players[0];
        const bits = [`${p.maxGold} gold this turn`, `minions cost ${Math.max(0, W.BUY + (p.mods.buy || 0))}`, `Refresh costs ${Math.max(0, W.ROLL + (p.mods.roll || 0))}`, `tier ${p.tier}`, `${p.board.length} on board`, `${p.health} Health`];
        if (p.armor) bits.push(`${p.armor} Armor`);
        out.push(`<li><b>Turn ${g.turn} (${esc(p.name)}):</b> ${esc(bits.join(" · "))}</li>`);
        if (g.lastShared) out.push(`<li>${esc(g.lastShared.by)} picked ${g.lastShared.golden ? "a golden " : ""}${esc(W.CARDS[g.lastShared.id].name)}: every player got a copy.</li>`);
        g.endOfTurnEffects(); g.combatPhase();
      }
      out.push(`<li>Rules on player 1: ${esc(JSON.stringify(g.players[0].mods).replace(/[{}"]/g, "").replace(/,/g, ", ").replace(/:/g, " ")) || "none"}</li>`);
    } catch (e) { out.push(`<li class="bad">The test hit an error: ${esc(e.message)}</li>`); }
    $("#ceTestOut", el).innerHTML = `<h4>Test: 3 turns of a 4-bot game</h4><ul>${out.join("")}</ul>`;
  }
  // Many quick fights: a random warband with the card swapped in, against random warbands of the same tier.
  // The same seeds are used with and without the card, so the difference is the card's doing.
  function winRate(id, isGolden, tier, N = 160) {
    const ids = Object.keys(W.CARDS).filter((k) => k !== id && W.CARDS[k].inPool !== false && W.CARDS[k].tier <= tier && !W.CARDS[k].retired);
    if (ids.length < 4) return "";
    const mk = (rng) => { const n = 4 + rng.int(0, 2), b = []; for (let i = 0; i < n; i++) { const m = new W.Minion(rng.pick(ids)); const g = rng.int(0, tier); m.buff(g, g); b.push(m); } return b; };
    let withW = 0, withoutW = 0, withD = 0, withoutD = 0, t0 = performance.now();
    for (let s = 1; s <= N; s++) {
      const rng = W.makeRng(s * 7919);
      const mine = mk(rng), theirs = mk(rng), at = rng.int(0, mine.length - 1);
      const base = new W.Combat(); base.quiet = true;
      const r0 = base.simulate(mine, theirs, tier, tier, W.makeRng(s), 99, [null, null], null, { turn: tier + 2, health: [30, 30] });
      const swapped = mine.slice(); swapped[at] = new W.Minion(id, isGolden);
      const c = new W.Combat(); c.quiet = true;
      const r1 = c.simulate(swapped, theirs, tier, tier, W.makeRng(s), 99, [null, null], null, { turn: tier + 2, health: [30, 30] });
      if (r0.winner === 0) { withoutW++; withoutD += r0.damage; } if (r1.winner === 0) { withW++; withD += r1.damage; }
    }
    const a = Math.round((withW / N) * 100), b = Math.round((withoutW / N) * 100), d = a - b;
    const verdict = d >= 18 ? ["bad", "much stronger than an average minion of this tier"] : d >= 8 ? ["warn", "stronger than average"] : d <= -8 ? ["warn", "weaker than average"] : ["", "about average"];
    return `<li class="${verdict[0]}"><b>Win rate</b> over ${N} random fights at tier ${tier}: <b>${a}%</b> with it in the warband, ${b}% without (${d >= 0 ? "+" : ""}${d}). ${verdict[1][0].toUpperCase() + verdict[1].slice(1)}.${withW ? ` Average damage on a win: ${(withD / withW).toFixed(1)}.` : ""} <small>${(performance.now() - t0).toFixed(0)} ms</small></li>`;
  }
  function runTest() {
    if (!cur) return;
    if (isAnom(cur)) return runAnomTest();
    if (isHero(cur)) return runHeroTest();
    applyDraft();
    const out = [];
    try {
      const seed = Math.floor(Math.random() * 1e9);
      const g = new W.Game(8, seed, true, { tribes: W.TRIBES.slice() });
      const p = g.human();
      const tier = Math.max(cur.tier || 1, 2);
      p.tier = tier; p.gold = 30;
      const filler = () => { const id = g.drawWhere((id) => W.CARDS[id].tier <= tier && !W.CARDS[id].custom); return id ? new W.Minion(id) : null; };
      // a board that includes the tribes this card cares about, so filtered effects have something to hit
      const wanted = [cur.tribe, ...(cur.abilities || []).flatMap((ab) => [ab.ttribe, ab.ftribe])].filter(Boolean);
      const ofTribe = (t) => { const id = g.drawWhere((id) => W.CARDS[id].tier <= tier && !W.CARDS[id].custom && W.CARDS[id].tribe === t); return id ? new W.Minion(id) : null; };
      p.board = [...new Set(wanted)].slice(0, 2).map(ofTribe).concat([filler(), filler()]).filter(Boolean).slice(0, 4);
      const names = new Map();
      const nameOf = (uid) => { for (const m of [...p.board, ...p.hand, ...p.shop]) if (m.uid === uid) return m.name; return names.get(uid) || ""; };
      const describe = (f) => { const who = f.uids.map(nameOf).filter(Boolean); const what = f.label || (f.a || f.h ? `+${f.a}/+${f.h}` : "effect"); return who.length ? `${what} on ${who.join(", ")}` : what; };
      const log = (title, fx) => { const l = (fx || []).filter((f) => f && f.uids); out.push(`<li><b>${title}</b> ${l.length ? l.map((f) => esc(describe(f))).join("; ") : "<i>nothing happened</i>"}</li>`); };
      p.shop = [filler(), filler(), filler()].filter(Boolean); // something to Devour, steal or refresh
      if (isSpell(cur)) {
        p.hand = [new W.Spell(cur.id)];
        const err = g.cast(p, 0, 0);
        if (err) out.push(`<li class="bad">${esc(err)}</li>`); else log(`Cast${cur.target && p.board[0] ? " on " + esc(p.board[0].name) : ""}:`, g.lastEffects);
        if (p.gold !== 30) out.push(`<li>Gold ${p.gold > 30 ? "+" : ""}${p.gold - 30}</li>`);
        if (p.hand.length) out.push(`<li>Hand: ${p.hand.map((m) => esc(m.name)).join(", ")}</li>`);
        if (p.discover.length) out.push(`<li>Discover offered: ${p.discover.map((id) => esc((W.CARDS[id] || {}).name || id)).join(", ")}</li>`);
      } else {
        const me = new W.Minion(cur.id, golden);
        names.set(me.uid, me.name);
        const trig = new Set((cur.abilities || []).map((ab) => ab.trigger));
        p.hand = [me];
        g.lastEffects = [];
        const err = g.play(p, 0, 1);
        if (err) out.push(`<li class="bad">${esc(err)}</li>`);
        log("Played it:", g.lastEffects);
        if (trig.has("onPlayOther")) { const o = filler(); if (o) { p.hand = [o]; g.lastEffects = []; g.play(p, 0, p.board.length); log(`Played ${esc(o.name)}:`, g.lastEffects); } }
        if (trig.has("onBuy") && p.shop.length) { g.lastEffects = []; const nm = p.shop[0].name; if (!g.buy(p, 0)) log(`Bought ${esc(nm)}:`, g.lastEffects); }
        if (trig.has("onSpell")) { g.lastEffects = []; g.runTavernAb(p, me, "onSpell"); log("Cast a spell:", g.lastEffects); }
        if (trig.has("startOfTurn")) { g.lastEffects = []; g.runTavernAb(p, me, "startOfTurn"); log("Start of turn:", g.lastEffects); }
        if (trig.has("endOfTurn") || me.endOfTurn) log("End of turn:", g.endOfTurnEffects());
        const enemy = []; for (let i = 0; i < 5; i++) { const m = filler(); if (m) { m.buff(tier, tier); enemy.push(m); } }
        const res = new W.Combat().simulate(p.board, enemy, tier, tier, W.makeRng(seed), 99, [null, null], null, { turn: tier + 2, health: [30, 30] });
        const mine = res.events.filter((e) => e.source === me.uid);
        const count = (k) => mine.filter((e) => e.kind === k).length;
        const parts = [["buff", "buff(s)"], ["shoot", "damage"], ["summon", "summon(s)"]].map(([k, l]) => (count(k) ? `${count(k)} ${l}` : "")).filter(Boolean);
        out.push(`<li><b>Combat</b> vs ${enemy.length} enemies: ${parts.length ? "your card fired " + parts.join(", ") : "<i>no combat effect from your card</i>"}. ${res.winner === 0 ? "Won" : res.winner === 1 ? "Lost" : "Draw"}.</li>`);
        out.push(winRate(cur.id, golden, tier));
        if (trig.has("onSell")) { const i = p.board.indexOf(me); if (i >= 0) { const before = p.gold; g.lastEffects = []; g.sell(p, i); log(`Sold it (+${p.gold - before} gold):`, g.lastEffects); } }
        if (p.gold !== 30 && !trig.has("onSell")) out.push(`<li>Gold ${p.gold > 30 ? "+" : ""}${p.gold - 30}</li>`);
        if (p.discover.length) out.push(`<li>Discover offered: ${p.discover.map((m) => esc(m.name)).join(", ")}</li>`);
        if (p.hand.length) out.push(`<li>Hand: ${p.hand.map((m) => esc(m.name)).join(", ")}</li>`);
      }
      $("#ceTestOut", el).innerHTML = `<h4>Test run${golden && !isSpell(cur) ? " (golden)" : ""}</h4><ul>${out.join("")}</ul>`;
    } catch (e) {
      $("#ceTestOut", el).innerHTML = `<h4>Test run</h4><ul><li class="bad">The test hit an error: ${esc(e.message)}</li></ul>`;
    }
  }

  // ---------------------------------------------------------------- export / import
  // the whole active meta (cards, pictures, skins, sounds, fonts, rules) as ma-meta.js, for the game folder you send to a friend
  async function friendPack() {
    if (!ST.packMeta) return;
    status("Packing the meta...");
    try {
      const pack = await ST.packMeta(); pack.stamp = Date.now(); pack.from = (root.WA_UI && root.WA_UI.profileName) || "";
      const text = "/* Warband Arena: the meta \"" + String(pack.name || "").replace(/\*\//g, "") + "\", made " + new Date(pack.stamp).toISOString().slice(0, 16).replace("T", " ") + ". Keep this file next to index.html: the game installs it by itself. */\nwindow.WA_BUNDLED_META = " + JSON.stringify(pack) + ";\n";
      const blob = new Blob([text], { type: "text/javascript" }), url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = "ma-meta.js"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
      const mb = (blob.size / 1048576).toFixed(1);
      status(`ma-meta.js saved (${mb} MB, ${(pack.cards || []).length} card(s)). Put it in the game folder, next to index.html, then send the folder (zipped). Your friend's game installs this meta by itself, and updates it when you send a newer file.`);
    } catch (e) { status("Could not pack the meta: " + (e.message || e), "err"); }
  }
  async function exportAll() {
    const data = { format: "warband-arena-cards", version: 1, cards: ST.cards, tribes: ST.tribes || undefined, heroes: ST.heroes || undefined, anomalies: ST.anomalies || undefined, images: await ST.allImages() };
    const text = JSON.stringify(data);
    const ta = $("#ceIO", el); ta.hidden = false; ta.value = text; ta.select();
    const extra = [data.heroes ? data.heroes.length + " hero(es)" : "", data.anomalies ? data.anomalies.length + " anomaly(ies)" : ""].filter(Boolean).join(", ");
    try { await navigator.clipboard.writeText(text); status(`Copied ${data.cards.length} card(s)${extra ? ", " + extra : ""} and ${Object.keys(data.images).length} picture(s) to the clipboard. Paste it somewhere safe as a backup.`); }
    catch (e) { status("Select the text below and copy it to keep a backup.", "warn"); }
  }
  async function importText() {
    const ta = $("#ceIO", el);
    if (ta.hidden || !ta.value.trim()) { ta.hidden = false; ta.value = ""; ta.placeholder = "Paste an export here, then click Import again."; ta.focus(); status("Paste your export below, then click Import again.", "warn"); return; }
    await importData(ta.value);
  }
  async function importFile(e) { const f = e.target.files[0]; e.target.value = ""; if (f) await importData(await f.text()); }
  async function importData(text) {
    let data;
    try { data = JSON.parse(text); if (data.format !== "warband-arena-cards" || !Array.isArray(data.cards)) throw 0; }
    catch (e) { status("That is not a Warband Arena card export. Paste the whole text, from { to }.", "err"); return; }
    try {
      if (Array.isArray(data.tribes)) {
        const have = ST.tribes || W.BASE_TRIBES.map((id) => ({ id, name: id }));
        const ids = new Set(have.map((t) => t.id));
        await ST.saveTribes(have.concat(data.tribes.filter((t) => t && t.id && !ids.has(t.id))));
      }
      for (const [k, rec] of Object.entries(data.images || {})) if (rec && rec.src && rec.tok && rec.card) await ST.saveImage(k, rec);
      const ids = new Set(data.cards.map((r) => kindOf(r) + "|" + r.id));
      work = ST.cards.filter((r) => !ids.has(kindOf(r) + "|" + r.id)).concat(data.cards);
      await ST.saveCards(work);
      let more = "";
      if (Array.isArray(data.heroes) && data.heroes.length) { const hid = new Set(data.heroes.map((h) => h.id)); await ST.saveHeroes(heroList().filter((h) => !hid.has(h.id)).concat(data.heroes.filter((h) => h && h.id))); more += `, ${data.heroes.length} hero(es)`; }
      if (Array.isArray(data.anomalies) && data.anomalies.length) { const aid = new Set(data.anomalies.map((a) => a.id)); await ST.saveAnomalies(anomList().filter((a) => !aid.has(a.id)).concat(data.anomalies.filter((a) => a && a.id))); more += `, ${data.anomalies.length} anomaly(ies)`; }
      work = clone(ST.cards); dirty = false;
      $("#ceIO", el).hidden = true;
      renderMetas(); startNew("minion", true);
      status(`Imported ${data.cards.length} card(s)${more}.`);
    } catch (e) { status("Import failed: " + (e.message || e), "err"); }
  }

  function status(t, kind) { const s = el && $("#ceStatus", el); if (s) { s.textContent = t; s.className = "ce-status" + (kind ? " " + kind : ""); } }

  // ---- building together: the other person's saves land in the store; show them without losing what is being edited here
  let coopName = "";
  function setCoop(name) {
    coopName = name || ""; if (!el) return;
    let b = $("#ceCoop", el); if (!b) { b = document.createElement("div"); b.id = "ceCoop"; b.className = "ce-coop"; $(".ce-head", el).insertBefore(b, $("#ceClose", el)); }
    b.hidden = !coopName; b.innerHTML = coopName ? `<i></i> Workshop with <b>${esc(coopName)}</b>` : "";
  }
  async function refresh(msg) {
    if (!el) return;
    work = clone(ST.cards || []);
    renderMetas(); renderList();
    if (view === "skins") { renderSkins(); return; }
    if (view === "tribes") { renderTribes(); return; }
    if (cur && curKey && msg && (msg.op === "card" || msg.op === "img" || msg.op === "heroes" || msg.op === "anomalies")) {
      const mine = msg.op === "card" ? kindOf(msg.rec) + "|" + msg.rec.id === curKey : msg.op === "img" ? msg.key === imgKey(cur) : msg.op === "heroes" ? isHero(cur) : isAnom(cur);
      if (!mine) return;
      if (dirty) { status(`${msg.from} just saved this card too. Saving now overwrites their version; reopen it from the list to see theirs.`, "warn"); return; }
      const key = curKey; await select(key); status(`${msg.from} updated this card.`);
    }
  }
  // the table workshop works on the live table: the studio steps aside and comes back when it closes
  async function openTable() {
    if (!root.WA_TABLE || !el) return;
    const cb = onDone, h = helpers;
    document.removeEventListener("keydown", onKey, true);
    await ST.load(); el.remove(); el = null; $("#stage").classList.remove("ce-open");
    root.WA_TABLE.open(() => { open(cb, h); setTimeout(() => { const b = el && el.querySelector('[data-rail="table"]'); if (b) b.click(); }, 0); });
  }
  root.WA_EDITOR = { open, refresh, setCoop, openTable };
})(typeof window !== "undefined" ? window : globalThis);
