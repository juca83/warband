// Adventure mode: what the player sees. It plays on the game's own table (cards, board, hand, triples, the fight replay)
// through the host the table gives it (ui.js advHost), and only adds its own pieces: the adventure picker, the start pick,
// the doors of the tavern, the progress bar, the side panel and the end screens. Loaded only when the mode is opened.
(function (root) {
  const D = root.WA_ADV_DATA, A = root.WA_ADV;
  let H = null, run = null, type = null, data = null;
  const fr = () => H.isFr();
  const L = (en, frs) => (fr() ? frs : en);
  const esc = (s) => H.escH(String(s == null ? "" : s));
  const W = () => root.WA;

  // ---------------------------------------------------------------- drawings
  const EMBLEM = D.emblemArt;
  const GLYPH = D.glyphArt;
  const svg = (inner, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const typeName = (t) => (fr() ? t.fr : t.name);
  const medal = (t, cls = "") => `<span class="adv-medal ${cls}" style="--ac:${esc(t.color)}">${svg(EMBLEM[t.emblem] || EMBLEM.compass)}</span>`;

  // ---------------------------------------------------------------- picking an adventure
  function open(host) {
    H = host;
    data = A.load();
    const tiles = data.types.map((t) => {
      const filled = A.filledLevels(t), allow = A.allowed(t), ok = filled.length > 0;
      const tribes = allow.tribes.slice(0, 7).map((tr) => `<span class="adv-tchip" data-tribe="${esc(tr)}">${esc(W().tribeName(tr))}</span>`).join("");
      const lv = Array.from({ length: D.defaults.fights }, (_, i) => `<i class="${filled.includes(i + 1) ? "on" : ""}${t.bosses.includes(i + 1) ? " boss" : ""}"></i>`).join("");
      return `<button type="button" class="adv-pick${ok ? "" : " empty"}" data-id="${esc(t.id)}" style="--ac:${esc(t.color)}" ${ok ? "" : "disabled"}>
        <span class="adv-pick-glow"></span>${medal(t, "big")}
        <b class="adv-pick-name">${esc(t.name)}</b>${t.blurb ? `<span class="adv-pick-blurb">${esc(t.blurb)}</span>` : ""}
        <span class="adv-pick-tribes">${tribes}</span>
        <span class="adv-pick-lv" title="${esc(L("Levels with an enemy board (bosses in red)", "Niveaux avec un board ennemi (les boss en rouge)"))}">${lv}</span>
        <span class="adv-pick-go">${ok ? L("Set out", "Partir") : L("No enemy board yet", "Aucun board ennemi")}</span></button>`;
    }).join("");
    const m = H.modal(`<div class="adv-picker"><h2 class="adv-title">${svg(EMBLEM.compass, "adv-title-ic")}${L("Adventure", "Aventure")}</h2>
      <p class="adv-sub">${L(`${D.defaults.fights} fights in a row against set boards; bosses on floors ${(data.types[0] || { bosses: D.defaults.bosses }).bosses.join(", ")}. Between fights, open the tavern's doors. One defeat and the run is over.`, `${D.defaults.fights} combats d'affilée contre des boards préparés ; boss aux étages ${(data.types[0] || { bosses: D.defaults.bosses }).bosses.join(", ")}. Entre deux combats, ouvre les portes de la taverne. Une défaite et la run s'arrête.`)}</p>
      ${tiles ? `<div class="adv-picks">${tiles}</div>` : `<div class="adv-none">${svg(EMBLEM.tower, "adv-none-ic")}<p>${L("No adventure in this meta yet. Make one in the editor: Studio › Adventure (admin mode).", "Aucune aventure dans cette méta pour l'instant. Crée-la dans l'éditeur : Studio › Aventure (mode admin).")}</p></div>`}
      <div class="intro-actions"><button type="button" class="pill" id="advBack">${L("Back", "Retour")}</button></div></div>`);
    m.querySelector("#advBack").addEventListener("click", () => { H.closeModal(); H.showIntro(); });
    m.querySelectorAll(".adv-pick[data-id]").forEach((b) => b.addEventListener("click", () => { const t = data.types.find((x) => x.id === b.dataset.id); if (t) start(t); }));
  }

  // ---------------------------------------------------------------- a run
  const MODE = {
    noShopButtons: true,
    shopList: (base) => shopList(base),
    makeItem: (d) => makeItem(d),
    updateItem: (el, d) => { if (d.advItem === "door") { el.title = doorTip(d.door); } },
    decorate: (el, d) => decorate(el, d),
    turnBanner: () => H.banner(`${L("Tavern", "Taverne")} ${run.tavern}<small>${H.you.gold} ${L("gold", "or")} · ${L("open the doors", "ouvre les portes")}</small>`, "adv-ban", 1300),
    fight: (preView) => fight(preView),
    fightEnd: (ev, f) => fightEnd(ev, f),
    gameMenu: () => gameMenu(),
    leave: () => leave(),
  };
  function start(t) {
    type = t;
    H.closeModal();
    H.newGame(); // a clean table (and the mode of a previous run left)
    run = new A.Run(t);
    run.p.icon = svg(EMBLEM[t.emblem] || EMBLEM.compass, "adv-enemy-ic"); // no hero yet: the adventure's emblem on the portrait
    H.setGame(run.game); H.setMode(MODE);
    H.stage.classList.add("adv"); H.stage.classList.remove("combat");
    H.stage.style.setProperty("--adv-c", t.color);
    H.applyTableBg(); H.applyKeeper(); H.applyCardSkin();
    for (const id of ["#shop", "#board", "#hand"]) H.$(id).innerHTML = "";
    H.renderTribeList();
    buildChrome();
    const offers = run.begin();
    H.busy = false;
    H.renderTavern(); renderChrome();
    startPick(offers);
  }
  function startPick(offers) {
    const w = W();
    const m = H.modal(`<div class="adv-start"><div class="adv-start-head">${medal(type, "big")}<div><h2>${esc(type.name)}</h2><p>${L("Pick your first companion: it joins your warband and the first fight starts right away.", "Choisis ton premier compagnon : il rejoint ta troupe et le premier combat commence aussitôt.")}</p></div></div>
      <div class="choices adv-start-cards"></div></div>`);
    const box = m.querySelector(".adv-start-cards");
    offers.forEach((id, k) => {
      const c = H.makeCard(new w.Minion(id).dict()); c.classList.add("adv-start-card"); c.style.setProperty("--k", k);
      const tr = w.tribesOf(w.CARDS[id]).filter(Boolean)[0];
      const wrap = document.createElement("div"); wrap.className = "adv-start-pick"; wrap.appendChild(c);
      wrap.insertAdjacentHTML("beforeend", `<span class="adv-start-tribe" data-tribe="${esc(tr || "")}">${esc(tr ? w.tribeName(tr) : L("Neutral", "Neutre"))}</span>`);
      wrap.addEventListener("click", () => {
        const e = run.chooseStart(id); if (e) { H.toast(H.T(e)); return; }
        H.closeModal(); H.renderTavern(); renderChrome(); H.sfx.buff && H.sfx.buff();
        setTimeout(() => H.endTurn(), 650);
      });
      box.appendChild(wrap);
    });
    requestAnimationFrame(() => H.fitAllCards(box));
  }

  // the tavern row: the doors in their order, each opened one replaced by what it revealed (still for sale)
  function shopList(base) {
    if (!run || !run.doors.length) return base;
    const byUid = new Map(base.map((d) => [d.uid, d])), out = [];
    for (const d of run.doors) {
      if (!d.open) { out.push({ uid: "door:" + d.i, advItem: "door", door: d }); continue; }
      for (const u of d.uids || []) {
        if (byUid.has(u)) { const x = byUid.get(u); x.advDoor = d.i; out.push(x); byUid.delete(u); continue; }
        const h = run.heroItems.find((y) => y.uid === u); if (h) out.push({ uid: u, advItem: "hero", hero: h, door: d });
      }
    }
    for (const x of byUid.values()) out.push(x); // anything else the tavern got (a card an effect put there)
    // a full row shrinks its cards so that it always fits between the side panel and the affinities
    const n = out.length, room = 800, z = Math.max(0.58, Math.min(1, room / (n * 107 + (n - 1) * 16 + 24)));
    const row = H.$("#shop"); if (row) row.style.setProperty("--adv-z", z.toFixed(3));
    return out;
  }
  function makeItem(d) {
    return d.advItem === "door" ? makeDoor(d.door) : makeHero(d.hero, d.door);
  }
  function doorTitle(d) { return (fr() ? d.def.fr : d.def.name) + (d.spec.tier ? ` · T${d.spec.tier}` : ""); }
  function makeDoor(d) {
    const el = document.createElement("div");
    const cost = run.openCost();
    el.className = "adv-door"; el.dataset.uid = "door:" + d.i; el.style.setProperty("--dc", d.def.color);
    el.innerHTML = `<div class="adv-door-light"></div><div class="adv-door-frame"></div>
      <div class="adv-door-leaf"><i class="band b1"></i><i class="band b2"></i><span class="adv-door-sigil">${svg(GLYPH[d.def.glyph] || GLYPH.minion)}</span><i class="ring"></i></div>
      <span class="adv-door-plate">${esc(doorTitle(d))}</span>
      <span class="adv-door-cost${cost ? "" : " free"}">${cost ? cost : L("Free", "Gratuit")}</span>
      ${d.price ? `<span class="adv-door-each" title="${esc(L("Price of each choice", "Prix de chaque choix"))}">${d.price} ${L("each", "/ choix")}</span>` : ""}`;
    el.title = doorTip(d);
    el.addEventListener("click", () => openDoor(d, el));
    return el;
  }
  function doorTip(d) {
    const T = d.def, n = d.spec.choices, tierTxt = d.spec.tier ? (d.spec.tierMode === "exact" ? L(`tier ${d.spec.tier}`, `tier ${d.spec.tier}`) : L(`up to tier ${d.spec.tier}`, `jusqu'au tier ${d.spec.tier}`)) : L("of your tavern tier or lower", "de ton tier de taverne ou moins");
    const what = { minion: L(`${n} minions ${tierTxt}`, `${n} serviteurs ${tierTxt}`), spell: L(`${n} spells ${tierTxt}`, `${n} sorts ${tierTxt}`), hero: L(`${n} heroes: take one`, `${n} héros : prends-en un`),
      golden: L(`${n} golden minions ${tierTxt}`, `${n} serviteurs dorés ${tierTxt}`), affinity: L(`${n} minions or spells of your strongest affinity`, `${n} serviteurs ou sorts de ton affinité dominante`),
      tierUp: L(`${n} minions or spells of the next tier`, `${n} serviteurs ou sorts du tier suivant`), tribe: L(`${n} minions of the tribe most present on your board`, `${n} serviteurs de la tribu la plus présente sur ton plateau`) }[d.spec.type] || "";
    const cost = run.openCost();
    return `${fr() ? T.fr : T.name} — ${what}. ${cost ? L(`Opening it costs ${cost} gold.`, `L'ouvrir coûte ${cost} or.`) : L("Opening it is free.", "L'ouvrir est gratuit.")}${d.price != null ? " " + L(`Each choice: ${d.price} gold.`, `Chaque choix : ${d.price} or.`) : ""}`;
  }
  async function openDoor(d, el) {
    if (H.busy || d.open) return;
    const e = run.openDoor(d.i);
    if (e) { H.toast(H.T(e)); H.sfx.error && H.sfx.error(); H.anim(el, [{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }], { duration: 260 }); return; }
    H.busy = true;
    try {
      H.renderGold(); H.sfx.coin && H.sfx.coin();
      el.classList.add("opening");
      const r = H.rectOf(el); H.burst(r.cx, r.cy, 22, ["#fff4c8", "#ffd36a", d.def.color], 80);
      await H.wait(560);
      el.classList.add("gone");
      await H.wait(220);
    } finally { H.busy = false; }
    const made = H.renderTavern(); renderChrome();
    made.forEach((x, k) => H.anim(x, [{ transform: "translateY(18px) scale(.7)", opacity: 0 }, { transform: "translateY(-4px) scale(1.04)", opacity: 1, offset: .7 }, { transform: "none", opacity: 1 }], { duration: 420, delay: k * 90, easing: "cubic-bezier(.2,.7,.3,1)", fill: "backwards" }));
    for (const x of document.querySelectorAll("#shop .adv-door")) x.title = doorTip(run.doors[+x.dataset.uid.split(":")[1]]);
    refreshDoorCosts();
  }
  function refreshDoorCosts() {
    const cost = run.openCost();
    for (const x of document.querySelectorAll("#shop .adv-door")) { const c = x.querySelector(".adv-door-cost"); if (!c) continue; c.textContent = cost ? cost : L("Free", "Gratuit"); c.classList.toggle("free", !cost); x.classList.toggle("poor", H.you.gold < cost); }
  }
  // what a door revealed: a soft light of the door's colour under it; its own price when it has one
  function decorate(el, d) {
    if (!run) return;
    const di = run.doorOf ? run.doorOf[d.uid] : null; if (di == null) return;
    const door = run.doors[di]; el.classList.add("adv-from"); el.style.setProperty("--dc", door.def.color);
    if (!el.querySelector(".adv-floor")) el.insertAdjacentHTML("afterbegin", `<span class="adv-floor"></span>`);
    const src = (d.isSpell ? run.p.shopSpellX : run.p.shop).find((o) => o.uid === d.uid);
    if (src && src._price != null && !d.isSpell && !el.querySelector(".adv-price")) el.insertAdjacentHTML("beforeend", `<span class="adv-price">${src._price}</span>`);
  }
  function makeHero(h, door) {
    const w = W(), hd = w.HEROES[h.id], pic = H.heroPic(h.id);
    const el = document.createElement("button"); el.type = "button";
    el.className = "adv-hero adv-from"; el.dataset.uid = h.uid; el.style.setProperty("--dc", door.def.color);
    el.innerHTML = `<span class="adv-floor"></span><span class="adv-hero-port"${pic ? ` style="background-image:url('${esc(pic)}')"` : ""}>${pic ? "" : esc(hd.name[0])}</span>
      <b class="adv-hero-name">${esc(hd.name)}</b><span class="adv-hero-pow">${esc(hd.power.name)}</span>${h.price ? `<span class="adv-price">${h.price}</span>` : `<span class="adv-price free">${L("Free", "Gratuit")}</span>`}`;
    el.title = `${hd.name} — ${hd.power.name}: ${String(w.heroPowerText(h.id) || "").replace(/\*\*|\[[a-z#0-9]+\]|\[\/\]/gi, "")}\n${L("Click to take this hero (one per door).", "Clique pour prendre ce héros (un par porte).")}`;
    el.addEventListener("click", () => {
      if (H.busy) return;
      const e = run.buyHero(h.uid); if (e) { H.toast(H.T(e)); H.sfx.error && H.sfx.error(); return; }
      H.sfx.buff && H.sfx.buff(); H.renderTavern(); renderChrome();
      const r = H.rectOf(H.$("#myhero")); H.burst(r.cx, r.cy, 26, ["#fff4c8", "#ffd36a", "#e2b04a"], 90);
      H.banner(`${esc(hd.name)}<small>${L("is your hero now", "est maintenant ton héros")}</small>`, "adv-ban", 1300);
    });
    return el;
  }

  // ---------------------------------------------------------------- the fights
  async function fight(preView) {
    const f = run.fight();
    if (!f) { H.toast(L("This adventure has no enemy board.", "Cette aventure n'a aucun board ennemi.")); H.busy = false; return; }
    renderChrome(true);
    const boss = f.enemy.boss;
    await H.banner(boss ? `${L("Boss", "Boss")}<small>${esc(run.floorName(f.level))}</small>` : `${esc(run.floorName(f.level))}<small>${L("Fight", "Combat")} ${f.level} / ${D.defaults.fights}</small>`, boss ? "adv-ban boss" : "adv-ban", boss ? 1500 : 1000);
    f.oppObj = { id: -1, name: run.floorName(f.level), hue: boss ? 0 : 200, hero: "", alive: true, armor: 0, tier: f.enemy.tier, streak: 0, isBot: true, icon: svg(boss ? EMBLEM.skull : EMBLEM[type.emblem] || EMBLEM.sword, "adv-enemy-ic") };
    f.hpBefore = [0, 0]; f.armBefore = [0, 0];
    try { await H.playCombat(f, preView); } catch (err) { H.report(err); H.leaveCombat(); }
    if (run.over) return endScreen();
    run.nextTavern();
    renderChrome();
    H.startTurnUI();
    refreshDoorCosts();
  }
  async function fightEnd(ev, f) {
    const out = f.out || (ev.winner === 1 ? "loss" : ev.winner === 0 ? "win" : "draw");
    if (out === "loss") { H.sfx.lose && H.sfx.lose(); await H.banner(`${L("Defeat", "Défaite")}<small>${L(`The run ends on floor ${f.level}`, `La run s'arrête à l'étage ${f.level}`)}</small>`, "lose", 1600); return; }
    H.sfx.win && H.sfx.win();
    const last = f.level >= D.defaults.fights;
    await H.banner(out === "draw" ? `${L("Draw", "Égalité")}<small>${L("it counts as a win", "elle compte comme une victoire")}</small>` : `${last ? L("Adventure won!", "Aventure gagnée !") : L("Victory", "Victoire")}<small>${L(`Floor ${f.level} cleared`, `Étage ${f.level} franchi`)}</small>`, "win", 1300);
  }

  // ---------------------------------------------------------------- the progress bar and the side panel
  function buildChrome() {
    let bar = H.$("#advBar"); if (!bar) { bar = document.createElement("div"); bar.id = "advBar"; H.stage.appendChild(bar); }
    let pan = H.$("#advPanel"); if (!pan) { pan = document.createElement("div"); pan.id = "advPanel"; const side = H.$("#players"); side.insertBefore(pan, side.firstChild); }
  }
  function renderChrome(inFight) {
    const bar = H.$("#advBar"), pan = H.$("#advPanel"); if (!bar || !run) return;
    const cur = run.stepIx;
    bar.innerHTML = `<span class="adv-bar-name">${medal(type, "sm")}<b>${esc(type.name)}</b></span><div class="adv-track">${run.steps.map((s, i) => {
      const st = i < cur ? "done" : i === cur ? "cur" : "";
      if (s.kind === "tavern") return `<i class="adv-st tav ${st}" title="${esc(L(`Tavern after fight ${s.after}`, `Taverne après le combat ${s.after}`))}"></i>`;
      const boss = s.kind === "boss", res = run.fights.find((x) => x.level === s.level);
      return `<i class="adv-st fight${boss ? " boss" : ""} ${st}${res ? " r-" + res.out : ""}" title="${esc(run.floorName(s.level))}">${boss ? svg(EMBLEM.skull) : s.level % 5 === 0 || i === cur ? `<em>${s.level}</em>` : ""}</i>`;
    }).join("")}</div>`;
    const curEl = bar.querySelector(".adv-st.cur");
    if (curEl) curEl.insertAdjacentHTML("beforeend", `<span class="adv-you">${H.you.hero && W().HEROES[H.you.hero] && H.heroPic(H.you.hero) ? `<span style="background-image:url('${esc(H.heroPic(H.you.hero))}')"></span>` : svg(EMBLEM[type.emblem] || EMBLEM.compass)}</span>`);
    const next = run.steps.slice(cur).find((s) => s.kind !== "tavern");
    const wins = run.fights.filter((x) => x.out !== "loss").length - (inFight && run.fights.length ? 1 : 0); // (the fight being played is not counted yet)
    pan.innerHTML = `<div class="adv-pan" style="--ac:${esc(type.color)}">${medal(type, "big")}<b class="adv-pan-name">${esc(type.name)}</b>
      <div class="adv-pan-floor"><small>${L("Floor", "Étage")}</small><strong>${run.level}</strong><small>/ ${D.defaults.fights}</small></div>
      <div class="adv-pan-rows"><span>${L("Tavern tier", "Tier de taverne")}<b>${H.you.tier}</b></span><span>${L("Fights won", "Combats gagnés")}<b>${wins}</b></span>
      <span>${inFight ? L("Now", "En cours") : L("Next", "Suivant")}<b>${next ? (next.kind === "boss" ? L("Boss", "Boss") + " " + next.level : L("Fight", "Combat") + " " + next.level) : "—"}</b></span>
      ${!inFight && run.doors.length ? `<span>${L("Next door", "Porte suivante")}<b>${run.openCost() ? run.openCost() + " " + L("gold", "or") : L("free", "gratuite")}</b></span>` : ""}</div></div>`;
  }

  // ---------------------------------------------------------------- menus and the end
  function gameMenu() {
    const m = H.modal(`<h2 class="menu-title">${esc(type.name)}</h2><div class="game-menu adv-menu">
      <button type="button" class="pill big" id="advResume">${L("Resume", "Reprendre")}</button>
      <button type="button" class="pill" id="advGiveUp"${H.busy ? " disabled" : ""}>${L("Give up the run", "Abandonner la run")}</button>
      <button type="button" class="pill" id="advQuit">${L("Quit to the main menu", "Quitter vers le menu")}</button></div>`);
    m.querySelector("#advResume").addEventListener("click", () => H.closeModal());
    m.querySelector("#advGiveUp").addEventListener("click", () => { H.closeModal(); run.over = true; run.won = false; endScreen(true); });
    m.querySelector("#advQuit").addEventListener("click", () => { H.closeModal(); quit(); });
  }
  function endScreen(gaveUp) {
    const won = run.won, last = run.fights[run.fights.length - 1];
    const marks = run.fights.map((x) => `<i class="r-${x.out}${x.boss ? " boss" : ""}" title="${esc(run.floorName(x.level))}"></i>`).join("");
    const m = H.modal(`<div class="adv-end ${won ? "won" : "lost"}" style="--ac:${esc(type.color)}">
      <div class="adv-end-rays"></div>${medal(type, "huge")}
      <h2>${won ? L("Adventure won!", "Aventure gagnée !") : gaveUp ? L("Run given up", "Run abandonnée") : L("The run is over", "La run est terminée")}</h2>
      <p class="adv-end-sub">${esc(type.name)} · ${won ? L(`all ${D.defaults.fights} floors cleared`, `les ${D.defaults.fights} étages franchis`) : L(`stopped on floor ${last ? last.level : 1}`, `arrêtée à l'étage ${last ? last.level : 1}`)}</p>
      <div class="adv-end-marks">${marks}</div>
      <div class="adv-end-board"></div>
      <div class="intro-actions"><button type="button" class="pill big" id="advAgain">${L("Play again", "Rejouer")}</button><button type="button" class="pill" id="advOther">${L("Another adventure", "Autre aventure")}</button><button type="button" class="pill" id="advMenu">${L("Main menu", "Menu principal")}</button></div></div>`);
    const bd = m.querySelector(".adv-end-board");
    for (const mn of run.p.board) { const t = H.makeToken(mn.dict(), { static: true }); bd.appendChild(t); }
    (won ? H.sfx.win : H.sfx.lose) && (won ? H.sfx.win : H.sfx.lose)();
    m.querySelector("#advAgain").addEventListener("click", () => start(type));
    m.querySelector("#advOther").addEventListener("click", () => { quit(true); });
    m.querySelector("#advMenu").addEventListener("click", () => { quit(); });
  }
  function quit(toPicker) {
    H.closeModal(); H.newGame(); // newGame() leaves the mode (MODE.leave) and deals a classic table
    if (toPicker) open(H); else H.showIntro();
  }
  function leave() {
    H.stage.classList.remove("adv"); H.stage.style.removeProperty("--adv-c");
    for (const id of ["#advBar", "#advPanel"]) { const e = H.$(id); if (e) e.remove(); }
    run = null; type = null;
  }

  root.WA_ADV_UI = { open, get run() { return run; } };
})(typeof window !== "undefined" ? window : globalThis);
