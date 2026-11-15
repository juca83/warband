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
      const lv = Array.from({ length: A.FN(t) }, (_, i) => `<i class="${filled.includes(i + 1) ? "on" : ""}${t.bosses.includes(i + 1) ? " boss" : ""}"></i>`).join("");
      return `<button type="button" class="adv-pick${ok ? "" : " empty"}" data-id="${esc(t.id)}" style="--ac:${esc(t.color)}" ${ok ? "" : "disabled"}>
        <span class="adv-pick-glow"></span>${medal(t, "big")}
        <b class="adv-pick-name">${esc(t.name)}</b>${t.blurb ? `<span class="adv-pick-blurb">${esc(t.blurb)}</span>` : ""}
        <span class="adv-pick-tribes">${tribes}</span>
        <span class="adv-pick-lv" title="${esc(L("Levels with an enemy board (bosses in red)", "Niveaux avec un board ennemi (les boss en rouge)"))}">${lv}</span>
        <span class="adv-pick-go">${ok ? L("Set out", "Partir") : L("No enemy board yet", "Aucun board ennemi")}</span></button>`;
    }).join("");
    const m = H.modal(`<div class="adv-picker"><h2 class="adv-title">${svg(EMBLEM.compass, "adv-title-ic")}${L("Adventure", "Aventure")}</h2>
      <p class="adv-sub">${L(`Fights in a row against set boards, bosses on the way. Between fights, open the tavern's doors. A lost fight costs a life (a lost boss is fought again); with no lives left, the run is over.`, `Des combats d'affilée contre des boards préparés, avec des boss en chemin. Entre deux combats, ouvre les portes de la taverne. Un combat perdu coûte une vie (un boss perdu se retente) ; sans vies, la run s'arrête.`)}</p>
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
    updateItem: () => {},
    decorate: (el, d) => decorate(el, d),
    turnBanner: () => H.banner(`${L("Tavern", "Taverne")} ${run.tavern}<small>${H.you.gold} ${L("gold", "or")} · ${L("open the doors", "ouvre les portes")}</small>`, "adv-ban", 1300),
    fight: (preView) => fight(preView),
    fightEnd: (ev, f) => fightEnd(ev, f),
    gameMenu: () => gameMenu(),
    heroExtra: (el, p) => (el.id === "myhero" && run ? heartsHTML() : ""),
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
  // v137 the doors' places: the (first) Minion door on the left, the Spell door on the right, the others evenly between
  function doorOrder() {
    const l = run.doors.slice(), mi = l.findIndex((d) => d.spec.type === "minion"), si = l.map((d) => d.spec.type).lastIndexOf("spell");
    const rank = (d, k) => (k === mi ? 0 : k === si ? 2 : 1);
    return l.map((d, k) => [d, rank(d, k), k]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map((x) => x[0]);
  }
  function shopList(base) {
    if (!run || !run.doors.length) return base;
    const byUid = new Map(base.map((d) => [d.uid, d])), out = [], group = new Map();
    let gi = 0;
    for (const d of doorOrder()) {
      const before = out.length;
      if (!d.open) out.push({ uid: "door:" + d.i, advItem: "door", door: d });
      else for (const u of d.uids || []) {
        if (byUid.has(u)) { const x = byUid.get(u); x.advDoor = d.i; out.push(x); byUid.delete(u); continue; }
        const h = run.heroItems.find((y) => y.uid === u); if (h) out.push({ uid: u, advItem: "hero", hero: h, door: d });
      }
      if (out.length > before) { group.set(String(out[before].uid), gi); gi++; }
    }
    const extra = [...byUid.values()]; if (extra.length) { group.set(String(extra[0].uid), gi); out.push(...extra); } // anything else the tavern got
    // a full row shrinks its cards so that it always fits the width of the board
    const n = out.length, room = 960, z = Math.max(0.58, Math.min(1, room / (n * 112 + (n - 1) * 14 + gi * 18)));
    const row = H.$("#shop"); if (row) row.style.setProperty("--adv-z", z.toFixed(3));
    // each door's group starts with a free margin, so the groups spread over the whole row with equal gaps
    if (run.p.lifeFx) { const n = run.p.lifeFx; run.p.lifeFx = 0; setTimeout(async () => { renderChrome(); await heartFx("gain", run.p.lives - 1); H.toast(L(`+${n} ${n === 1 ? "life" : "lives"}`, `+${n} ${n > 1 ? "vies" : "vie"}`)); }, 60); }
    queueMicrotask(() => { const r = H.$("#shop"); if (!r) return; r.classList.toggle("adv-one", gi <= 1); for (const el of r.children) { const g = group.get(String(el.dataset.uid)); el.classList.toggle("adv-gs", g != null && g > 0); } });
    return out;
  }
  function makeItem(d) {
    return d.advItem === "door" ? makeDoor(d.door) : makeHero(d.hero, d.door);
  }
  const doorLabel = (d) => A.doorName(type, d.spec);
  // v138 a door looks like the game's own pieces: it is a board token (the same frame, the skin you equipped included) whose
  // picture is an oak door; the left socket holds the gold it costs to open, the right one the sign of its kind; under it,
  // a label with its name and what is behind (on as many lines as it needs)
  function doorInfo(d) {
    const n = d.spec.choices, t = d.spec.tier, info = [];
    info.push(L(`${n} ${n === 1 ? "choice" : "choices"}`, `${n} choix`) + (t ? (d.spec.tierMode === "exact" ? ` · tier ${t}` : ` · tier ≤ ${t}`) : ""));
    if (d.price != null && d.price > 0) info.push(L(`${d.price} gold each`, `${d.price} or chacun`));
    else if (d.price === 0) info.push(L("free choices", "choix gratuits"));
    return info;
  }
  // v139 a door kind's icon in this adventure (one picked in the editor, or a picture)
  function doorIconHTML(kind) { const ic = A.doorIcon(type, kind); return ic.img ? `<img class="dt-img" src="${esc(ic.img)}" alt="" draggable="false">` : svg(ic.svg || GLYPH.minion); }
  function makeDoor(d) {
    const el = document.createElement("div"), name = doorLabel(d), cost = run.openCost();
    el.className = "mn static adv-doortok" + (d.def.golden ? " golden" : ""); el.dataset.uid = "door:" + d.i;
    el.style.setProperty("--dc", d.def.color); el.style.setProperty("--tribe", d.def.color);
    el.innerHTML = `<div class="mn-body"><div class="dt-portal"><i class="dr-rays"></i><i class="dr-core"></i></div>
        <div class="dt-leaf"><i class="dt-wood"></i><i class="dt-strap s1"></i><i class="dt-strap s2"></i><span class="dt-medal">${doorIconHTML(d.spec.type)}</span><i class="dt-knock"></i></div></div>
      <div class="mn-gem atk dt-cost${cost ? "" : " free"}"><span>${cost}</span></div>
      <div class="mn-gem hp dt-kind"><span>${doorIconHTML(d.spec.type)}</span></div>
      <div class="dt-label"><b>${esc(name)}</b><small>${esc(doorInfo(d).join(" · "))}</small></div>`;
    // v144 what is behind it in the game's own tooltip, at once on hover (no more browser tooltip)
    el.addEventListener("mouseenter", () => { if (H.htmlTip && !d.open) H.htmlTip(el, doorTipHTML(d)); });
    el.addEventListener("mouseleave", () => { if (H.hideTip) H.hideTip(); });
    el.addEventListener("click", () => { if (H.hideTip) H.hideTip(); openDoor(d, el); });
    return el;
  }
  function doorTip(d) {
    const T = d.def, n = d.spec.choices, tierTxt = d.spec.tier ? (d.spec.tierMode === "exact" ? L(`tier ${d.spec.tier}`, `tier ${d.spec.tier}`) : L(`up to tier ${d.spec.tier}`, `jusqu'au tier ${d.spec.tier}`)) : L("of your tavern tier or lower", "de ton tier de taverne ou moins");
    const what = { minion: L(`${n} minions ${tierTxt}`, `${n} serviteurs ${tierTxt}`), spell: L(`${n} spells ${tierTxt}`, `${n} sorts ${tierTxt}`), hero: L(`${n} heroes: take one`, `${n} héros : prends-en un`),
      golden: L(`${n} golden minions ${tierTxt}`, `${n} serviteurs dorés ${tierTxt}`), affinity: L(`${n} minions or spells of your strongest affinity`, `${n} serviteurs ou sorts de ton affinité dominante`),
      tierUp: L(`${n} minions or spells of the next tier`, `${n} serviteurs ou sorts du tier suivant`), tribe: L(`${n} minions of the tribe most present on your board`, `${n} serviteurs de la tribu la plus présente sur ton plateau`),
      tierUpMinion: L(`${n} minions of the next tier`, `${n} serviteurs du tier suivant`), tierUpSpell: L(`${n} spells of the next tier`, `${n} sorts du tier suivant`),
      neutral: L(`${n} neutral minions ${tierTxt}`, `${n} serviteurs neutres ${tierTxt}`), allTribes: L(`${n} all-tribes minions ${tierTxt}`, `${n} serviteurs toutes tribus ${tierTxt}`),
      advSpell: L(`${n} adventure spells ${tierTxt}`, `${n} sorts d'aventure ${tierTxt}`) }[d.spec.type] || "";
    const cost = run.openCost();
    return `${doorLabel(d)} — ${what}. ${cost ? L(`Opening it costs ${cost} gold.`, `L'ouvrir coûte ${cost} or.`) : L("Opening it is free.", "L'ouvrir est gratuit.")}${d.price != null ? " " + L(`Each choice: ${d.price} gold.`, `Chaque choix : ${d.price} or.`) : ""}`;
  }
  function doorTipHTML(d) {
    const t = doorTip(d), i = t.indexOf(" — "), body = i >= 0 ? t.slice(i + 3) : t, cut = body.indexOf(". ");
    const kind = fr() ? d.def.fr : d.def.name;
    return `<h3>${esc(doorLabel(d))}</h3>${kind !== doorLabel(d) ? `<div class="tt-sub">${esc(kind)}</div>` : ""}<p>${esc(cut >= 0 ? body.slice(0, cut + 1) : body)}</p>${cut >= 0 ? `<p>${esc(body.slice(cut + 2))}</p>` : ""}`;
  }
  async function openDoor(d, el) {
    if (H.busy || d.open) return;
    const e = run.openDoor(d.i);
    if (e) { H.toast(H.T(e)); H.sfx.error && H.sfx.error(); H.anim(el, [{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }], { duration: 260 }); return; }
    H.busy = true;
    try {
      H.renderGold(); H.sfx.coin && H.sfx.coin();
      el.classList.add("opening");
      const r = H.rectOf(el.querySelector(".mn-body") || el); H.glow && H.glow(el, d.def.color);
      await H.wait(240); H.burst(r.cx, r.cy, 30, ["#ffffff", "#fff4c8", d.def.color, d.def.color], 95);
      await H.wait(380);
      el.classList.add("gone");
      await H.wait(260);
    } finally { H.busy = false; }
    const made = H.renderTavern(); renderChrome();
    made.forEach((x, k) => H.anim(x, [{ transform: "translateY(18px) scale(.7)", opacity: 0 }, { transform: "translateY(-4px) scale(1.04)", opacity: 1, offset: .7 }, { transform: "none", opacity: 1 }], { duration: 420, delay: k * 90, easing: "cubic-bezier(.2,.7,.3,1)", fill: "backwards" }));
    refreshDoorCosts();
  }
  function refreshDoorCosts() {
    const cost = run.openCost();
    for (const x of document.querySelectorAll("#shop .adv-doortok")) {
      const c = x.querySelector(".dt-cost"); if (c) { c.querySelector("span").textContent = cost; c.classList.toggle("free", !cost); }
      x.classList.toggle("poor", H.you.gold < cost);
    }
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
    // v143 its power in the game's tooltip, at once (no more browser tooltip)
    el.addEventListener("mouseenter", () => { if (H.heroTip) H.heroTip(el, h.id, L("Click to take this hero (one per door).", "Clique pour prendre ce héros (un par porte).")); });
    el.addEventListener("mouseleave", () => { if (H.hideTip) H.hideTip(); });
    el.addEventListener("click", () => {
      if (H.busy) return;
      if (H.hideTip) H.hideTip();
      const e = run.buyHero(h.uid); if (e) { H.toast(H.T(e)); H.sfx.error && H.sfx.error(); return; }
      H.sfx.buff && H.sfx.buff(); H.renderTavern(); renderChrome();
      const r = H.rectOf(H.$("#myhero")); H.burst(r.cx, r.cy, 26, ["#fff4c8", "#ffd36a", "#e2b04a"], 90);
      H.banner(`${esc(hd.name)}<small>${L("is your hero now", "est maintenant ton héros")}</small>`, "adv-ban", 1300);
    });
    return el;
  }

  // ---------------------------------------------------------------- lives (v138): hearts by the portrait and in the panel
  const HEART = '<svg viewBox="0 0 24 22" aria-hidden="true"><defs><radialGradient id="advHg" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#ffb0bc"/><stop offset=".42" stop-color="#e3304a"/><stop offset="1" stop-color="#6e0616"/></radialGradient></defs><path class="hb" d="M12 20.6C5.8 16 1.9 12.6 1.9 7.7 1.9 4.6 4.3 2.2 7.3 2.2c2 0 3.6 1 4.7 2.6 1.1-1.6 2.7-2.6 4.7-2.6 3 0 5.4 2.4 5.4 5.5 0 4.9-3.9 8.3-10.1 12.9z"/><path class="hs" d="M6.4 5.4c-1.5.5-2.3 1.7-2.3 3.1"/></svg>';
  const livesNow = () => (run.livesShown != null ? run.livesShown : run.p.lives);
  function heartsHTML(cls = "") {
    const n = livesNow(), max = Math.max(run.p.maxLives, n);
    return `<div class="adv-hearts ${cls}${max > 5 ? " many" : ""}" title="${esc(L(`${n} ${n === 1 ? "life" : "lives"} left of ${max}`, `${n} ${n > 1 ? "vies" : "vie"} sur ${max}`))}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? "full" : "lost"}" style="--i:${i}">${HEART}</i>`).join("")}</div>`;
  }
  // a heart breaks (a lost fight) or fills (a spell): it plays on the portrait's hearts
  async function heartFx(kind, idx) {
    const box = H.$("#myhero .adv-hearts"); if (!box) return;
    const h = box.children[idx]; if (!h) return;
    h.classList.add(kind === "lose" ? "breaking" : "gaining");
    const r = H.rectOf(h);
    if (kind === "lose") { H.burst(r.cx, r.cy, 16, ["#ff6b7a", "#c3283a", "#5d0b16"], 46); H.sfx.hero && H.sfx.hero(); }
    else { H.burst(r.cx, r.cy, 18, ["#ffffff", "#ffb3c0", "#ff5a77"], 52); H.sfx.buff && H.sfx.buff(); }
    await H.wait(650);
    if (kind === "lose") h.className = "lost";
  }

  // ---------------------------------------------------------------- the fights
  async function fight(preView) {
    const f = run.fight();
    if (!f) { H.toast(L("This adventure has no enemy board.", "Cette aventure n'a aucun board ennemi.")); H.busy = false; return; }
    run.livesShown = run.p.lives + (f.lifeLost ? 1 : 0); renderChrome(true);
    const boss = f.enemy.boss;
    await H.banner(boss ? `${L("Boss", "Boss")}<small>${esc(run.floorName(f.level))}</small>` : `${esc(run.floorName(f.level))}<small>${L("Fight", "Combat")} ${f.level} / ${A.FN(type)}</small>`, boss ? "adv-ban boss" : "adv-ban", boss ? 1500 : 1000);
    f.oppObj = { id: -1, name: run.floorName(f.level), hue: boss ? 0 : 200, hero: A.enemyHero(f.enemy.board), alive: true, armor: 0, tier: f.enemy.tier, streak: 0, isBot: true, icon: svg(boss ? EMBLEM.skull : EMBLEM[type.emblem] || EMBLEM.sword, "adv-enemy-ic") };
    f.hpBefore = [0, 0]; f.armBefore = [0, 0]; // (lives, not Health, in the Adventure)
    try { await H.playCombat(f, preView); } catch (err) { H.report(err); H.leaveCombat(); }
    run.livesShown = null;
    if (run.over) return endScreen();
    run.nextTavern();
    renderChrome();
    H.startTurnUI();
    refreshDoorCosts();
  }
  async function fightEnd(ev, f) {
    const out = f.out || (ev.winner === 1 ? "loss" : ev.winner === 0 ? "win" : "draw");
    if (out === "loss") {
      H.sfx.lose && H.sfx.lose();
      const left = run.p.lives, idx = left; // the heart that breaks
      await heartFx("lose", idx); run.livesShown = null; renderChrome(true);
      const lv = L(`${left} ${left === 1 ? "life" : "lives"} left`, `${left} ${left > 1 ? "vies restantes" : "vie restante"}`);
      await H.banner(run.over ? `${L("Defeat", "Défaite")}<small>${L(`No lives left: the run ends on floor ${f.level}`, `Plus de vies : la run s'arrête à l'étage ${f.level}`)}</small>`
        : f.retry ? `${L("Defeat", "Défaite")}<small>${L(`-1 life · ${lv} · back to the tavern to face the boss again`, `-1 vie · ${lv} · retour à la taverne pour retenter le boss`)}</small>`
        : `${L("Defeat", "Défaite")}<small>${L(`-1 life · ${lv} · on to the next floor`, `-1 vie · ${lv} · en route pour l'étage suivant`)}</small>`, "lose", 1800);
      return;
    }
    H.sfx.win && H.sfx.win();
    const last = f.level >= A.FN(type);
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
      const boss = s.kind === "boss", res = run.fights.filter((x) => x.level === s.level).pop();
      return `<i class="adv-st fight${boss ? " boss" : ""} ${st}${res ? " r-" + res.out : ""}" title="${esc(run.floorName(s.level))}">${boss ? svg(EMBLEM.skull) : s.level % 5 === 0 || i === cur ? `<em>${s.level}</em>` : ""}</i>`;
    }).join("")}</div>`;
    const curEl = bar.querySelector(".adv-st.cur");
    if (curEl) curEl.insertAdjacentHTML("beforeend", `<span class="adv-you">${H.you.hero && W().HEROES[H.you.hero] && H.heroPic(H.you.hero) ? `<span style="background-image:url('${esc(H.heroPic(H.you.hero))}')"></span>` : svg(EMBLEM[type.emblem] || EMBLEM.compass)}</span>`);
    const next = run.steps.slice(cur).find((s) => s.kind !== "tavern");
    const wins = (inFight ? run.fights.slice(0, -1) : run.fights).filter((x) => x.out !== "loss").length; // (the fight being played is not counted yet)
    pan.innerHTML = `<div class="adv-pan" style="--ac:${esc(type.color)}">${medal(type, "big")}<b class="adv-pan-name">${esc(type.name)}</b>
      <div class="adv-pan-floor"><small>${L("Floor", "Étage")}</small><strong>${run.level}</strong><small>/ ${A.FN(type)}</small></div>
      <div class="adv-pan-rows"><span class="lives">${L("Lives", "Vies")}${heartsHTML("adv-small")}</span><span>${L("Tavern tier", "Tier de taverne")}<b>${H.you.tier}</b></span><span>${L("Fights won", "Combats gagnés")}<b>${wins}</b></span>
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
    const marks = run.fights.map((x) => `<i class="r-${x.out}${x.boss ? " boss" : ""}" title="${esc(run.floorName(x.level) + (x.out === "loss" ? ` · -1 ${L("life", "vie")}` : ""))}"></i>`).join("");
    const m = H.modal(`<div class="adv-end ${won ? "won" : "lost"}" style="--ac:${esc(type.color)}">
      <div class="adv-end-rays"></div>${medal(type, "huge")}
      <h2>${won ? L("Adventure won!", "Aventure gagnée !") : gaveUp ? L("Run given up", "Run abandonnée") : L("The run is over", "La run est terminée")}</h2>
      <p class="adv-end-sub">${esc(type.name)} · ${won ? L(`all ${A.FN(type)} floors cleared with ${run.p.lives} ${run.p.lives === 1 ? "life" : "lives"} left`, `les ${A.FN(type)} étages franchis avec ${run.p.lives} ${run.p.lives > 1 ? "vies restantes" : "vie restante"}`) : gaveUp ? L(`stopped on floor ${last ? last.level : 1}`, `arrêtée à l'étage ${last ? last.level : 1}`) : L(`out of lives on floor ${last ? last.level : 1}`, `à court de vies à l'étage ${last ? last.level : 1}`)}</p>
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
    H.stage.classList.remove("adv"); H.stage.style.removeProperty("--adv-c"); { const r = H.$("#shop"); if (r) r.classList.remove("adv-one"); }
    for (const id of ["#advBar", "#advPanel"]) { const e = H.$(id); if (e) e.remove(); }
    run = null; type = null;
  }

  root.WA_ADV_UI = { open, get run() { return run; } };
})(typeof window !== "undefined" ? window : globalThis);
