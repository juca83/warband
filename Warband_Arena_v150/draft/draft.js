// v147 Draft mode screens: pick a draft type (made in Studio › Draft), the draft (the booster in front of you; your cards on the
// right in one list, by tribe and tier, with the affinities they fill), then a turn on the tavern table with every card you
// drafted: play them (their Battlecries happen), sell them (no gold), End turn: the tournament (your fights replayed)
(function (root) {
  "use strict";
  let H = null, d = null, sel = [], mode = "draft", type = null, T = null, played = new Set(), heroPick = "";
  const W = () => root.WA, D = () => root.WA_DRAFT;
  const fr = () => !!(H && H.isFr && H.isFr());
  const L = (en, f) => (fr() ? f : en);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TN = (t) => (H && H.TN ? H.TN(t) : t);
  const tIcon = (t) => { try { return root.WA_ART.tribeIcon(t); } catch (e) { return ""; } };
  const SLOT = () => ({ unique: L("Unique", "Unique"), neutral: L("Neutral", "Neutre"), mage: L("Mage", "Mage"), hero: L("Hero", "Héros"), tribeHero: L("Tribe hero", "Héros de tribu"), anyHero: L("Hero", "Héros"), spell: L("Spell", "Sort"), anyTier: L("Minion", "Serviteur") });
  const slotLabel = (c) => SLOT()[c.slot] || (c.slot && c.slot[0] === "t" ? "Tier " + c.slot.slice(1) : "");
  const nameOf = (x) => { const w = W(); return x.kind === "hero" ? (w.HEROES[x.id] || {}).name : x.kind === "spell" ? (w.SPELLS[x.id] || {}).name : (w.CARDS[x.id] || {}).name; };
  const tierOf = (x) => { const w = W(); return x.kind === "minion" ? (w.CARDS[x.id] || {}).tier || 1 : x.kind === "spell" ? (w.SPELLS[x.id] || {}).tier || 1 : 0; };

  // ---------------------------------------------------------------- start: the draft type
  function open(host, m) {
    H = host; mode = m === "campaign" ? "campaign" : "draft"; sel = []; T = null; G = null; usedOpen = false; played = new Set(); heroPick = "";
    const types = D().load().types, ok = (t) => mode !== "campaign" || t.campaign.length;
    const go = (t) => { type = t; d = new (D().Draft)({ type: t, you: L("You", "Toi") }); render(); };
    if (types.length === 1 && ok(types[0])) return go(types[0]);
    const title = mode === "campaign" ? L("Draft campaign", "Draft campagne") : "Draft";
    const md = H.modal(`<div class="dr dr-types"><h2>${title}</h2><p class="dr-hint">${mode === "campaign" ? L("Your opponents: the boards that won this draft before (yours, never a bot's).", "Tes adversaires : les boards qui ont gagné ce draft avant (les tiens, jamais ceux d'une IA).") : L("Choose a draft.", "Choisis un draft.")}</p>
      <div class="dr-tlist">${types.map((t) => `<button type="button" class="dr-type" data-id="${esc(t.id)}"${ok(t) ? "" : " disabled"}><b>${esc(t.name)}</b><small>${t.packs} × ${t.slots.length} ${L("cards", "cartes")} · ${t.pick === 1 ? L("single pick", "choix simple") : t.pick + " " + L("cards a pick", "cartes par choix")}${mode === "campaign" ? ` · ${t.campaign.length} board${t.campaign.length > 1 ? "s" : ""}` : ""}</small>${ok(t) ? "" : `<i>${L("No winning board yet", "Aucun board vainqueur")}</i>`}</button>`).join("")}</div>
      <div class="dr-actions"><button type="button" class="pill" id="drMenu">${L("Back", "Retour")}</button></div></div>`);
    md.firstElementChild.classList.add("dr-box", "dr-narrow");
    md.querySelector("#drMenu").addEventListener("click", backToMenu);
    md.querySelectorAll(".dr-type[data-id]").forEach((b) => b.addEventListener("click", () => { const t = types.find((x) => x.id === b.dataset.id); if (t && ok(t)) go(t); }));
  }
  function backToMenu() { H.closeModal(); if (H.hideTip) H.hideTip(); endPlay(); H.newGame(); if (H.showIntro) H.showIntro(); }
  function cardEl(x) {
    const w = W();
    if (x.kind === "hero") return H.heroCard(x.id);
    const o = x.kind === "spell" ? new w.Spell(x.id) : new w.Minion(x.id, !!x.golden);
    return H.makeCard(o.dict());
  }
  const tipCard = (el, x) => { el.addEventListener("mouseenter", () => { if (!H.htmlTip) return; const c = cardEl(x); c.classList.add("static"); H.htmlTip(el, `<div class="dr-tipcard">${c.outerHTML}</div>`); }); el.addEventListener("mouseleave", () => H.hideTip && H.hideTip()); };

  // ---------------------------------------------------------------- your cards: one list, by tribe (icon), highest tier first
  function groupsOf(items) {
    const w = W(), g = {};
    for (const x of items) {
      let k = x.kind === "hero" ? "*hero" : x.kind === "spell" ? "*spell" : null;
      if (!k) { const c = w.CARDS[x.id] || {}; k = c.allTribes ? "*all" : (w.tribesOf(c).filter(Boolean)[0] || "*neutral"); }
      (g[k] = g[k] || []).push(x);
    }
    const order = Object.keys(g).sort((a, b) => (a === "*hero" ? -1 : b === "*hero" ? 1 : a === "*spell" ? 1 : b === "*spell" ? -1 : g[b].length - g[a].length));
    return order.map((k) => ({ k, items: g[k].sort((a, b) => tierOf(b) - tierOf(a) || String(nameOf(a)).localeCompare(String(nameOf(b)))) }));
  }
  const gName = (k) => (k === "*hero" ? L("Heroes", "Héros") : k === "*spell" ? L("Spells", "Sorts") : k === "*all" ? L("All tribes", "Toutes tribus") : k === "*neutral" ? L("Neutral", "Neutres") : TN(k));
  function listHTML(items, clickable) {
    return groupsOf(items).map(({ k, items: l }) => `<div class="dr-grp2"><h5>${k[0] === "*" ? `<span class="dr-gi">${k === "*hero" ? "♛" : k === "*spell" ? "✦" : k === "*all" ? "✷" : "◇"}</span>` : tIcon(k)}<span>${esc(gName(k))}</span><small>${l.length}</small></h5>
      ${l.map((x) => `<div class="dr-row k-${x.kind}${played.has(x.key) ? " played" : ""}${clickable && x.kind !== "hero" && !played.has(x.key) ? " can" : ""}" data-key="${esc(x.key)}"><i>${x.kind === "hero" ? "H" : tierOf(x)}</i><span>${esc(nameOf(x))}</span>${x.golden ? `<b class="dr-gold" title="${esc(L("Golden (2 copies)", "Doré (2 exemplaires)"))}">★</b>` : ""}</div>`).join("")}</div>`).join("");
  }
  // the affinities your cards fill (as on the table): each one with how many of your cards count for it and its next step
  function affHTML(items) {
    const w = W(); if (!w.AFFS || !w.AFFS.length) return "";
    const mins = items.filter((x) => x.kind === "minion" && w.CARDS[x.id]).map((x) => new w.Minion(x.id, !!x.golden));
    const rows = w.AFFS.map((a) => { const A = w.AFF[a]; if (!A) return ""; const n = w.affCount ? w.affCount(mins, a) : 0, lv = w.lvFor ? w.lvFor(A, n) : 0, mx = w.affMaxLv ? w.affMaxLv(a) : 1, next = lv < mx && w.affThreshold ? w.affThreshold(a, lv + 1) : 0, src = w.affIcon ? w.affIcon(a) : "";
      const pct = next ? Math.min(100, Math.round((100 * n) / next)) : 100;
      return `<div class="dr-aff${lv ? " on" : ""}" title="${esc((fr() ? A.mechFr || A.mech : A.mech) || A.name || a)}">${src ? `<img src="${esc(src)}" alt="">` : ""}<span><b>${esc(A.name || a)}</b><em><i style="width:${pct}%"></i></em></span><small>${n}${next ? "/" + next : ""}${lv ? ` · ${L("lv", "niv")} ${lv}` : ""}</small></div>`; }).join("");
    return `<div class="dr-affs"><h4>${L("Affinities", "Affinités")}</h4>${rows}</div>`;
  }

  // ---------------------------------------------------------------- the draft
  function render() {
    if (d.done) return startPlay();
    const pack = d.myPack, want = Math.min(d.pick, pack.length), tot = d.totalPicks, k = d.pickIndex, mine = d.collection(0);
    const m = H.modal(`<div class="dr dr-draft"><div class="dr-mainc"><header class="dr-head"><h2>${esc(type.name)}</h2>
        <div class="dr-prog"><b>${L("Booster", "Booster")} ${d.round + 1}/${d.packs}</b> · ${L("Pick", "Choix")} ${d.pickNo + 1}/${d.picksPerRound}<span class="dr-dir">${d.dir > 0 ? L("passes to the left ←", "passe à gauche ←") : L("passes to the right →", "passe à droite →")}</span></div>
        <div class="dr-dots">${Array.from({ length: tot }, (_, i) => `<i class="${i < k ? "on" : i === k ? "now" : ""}${i % d.picksPerRound === 0 && i ? " gap" : ""}"></i>`).join("")}</div></header>
      <p class="dr-hint">${L(`Take ${want} card${want > 1 ? "s" : ""}, then the booster goes to the next player (4 bots draft for their tribes). Two copies of a minion make a golden one.`, `Prends ${want} carte${want > 1 ? "s" : ""}, puis le booster passe au joueur suivant (4 IA draftent pour leurs tribus). Deux exemplaires d'un serviteur font un doré.`)}</p>
      <div class="dr-pack"></div>
      <div class="dr-foot"><span class="dr-left">${L(`${d.seats[0].picks.length} cards`, `${d.seats[0].picks.length} cartes`)}</span><button type="button" class="pill big dr-take" disabled>${want > 1 ? L(`Take these ${want} cards`, `Prendre ces ${want} cartes`) : L("Take this card", "Prendre cette carte")}</button></div></div>
      <aside class="dr-side"><div class="dr-list"><h4>${L("Your cards", "Tes cartes")} <small>${d.seats[0].picks.length}</small></h4>${listHTML(mine, false) || `<p class="dr-empty">${L("Your picks show here.", "Tes choix s'affichent ici.")}</p>`}</div>${affHTML(mine)}</aside></div>`);
    m.firstElementChild.classList.add("dr-box");
    const box = m.querySelector(".dr-pack"), btn = m.querySelector(".dr-take");
    if (pack.length > 10) box.classList.add("big");
    for (const c of pack) {
      const wrap = document.createElement("div"); wrap.className = "dr-slot" + (sel.includes(c.uid) ? " on" : ""); wrap.dataset.uid = c.uid;
      // v150 a Unique you already have: you will only ever play one
      const w0 = W(), dup = c.kind === "minion" && w0.CARDS[c.id] && (w0.CARDS[c.id].unique || w0.CARDS[c.id].uniqDraft) && d.seats[0].picks.some((x) => x.id === c.id);
      if (dup) wrap.classList.add("dup");
      wrap.innerHTML = `<span class="dr-tag k-${c.kind}${c.slot === "mage" ? " k-mage" : ""}">${esc(slotLabel(c))}</span>${dup ? `<span class="dr-dup">${esc(L("Unique: you have it already", "Unique : tu l'as déjà"))}</span>` : ""}`;
      const el = cardEl(c); if (el.tagName === "BUTTON") el.type = "button"; wrap.appendChild(el);
      wrap.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (sel.includes(c.uid)) sel = sel.filter((x) => x !== c.uid); else { if (sel.length >= want) sel.shift(); sel.push(c.uid); }
        for (const x of box.querySelectorAll(".dr-slot")) x.classList.toggle("on", sel.includes(x.dataset.uid));
        btn.disabled = sel.length !== want;
      }, true);
      box.appendChild(wrap);
    }
    if (root.WA_FIT_CARDS) requestAnimationFrame(() => root.WA_FIT_CARDS(box)); // v150 the rules text fits the card
    btn.addEventListener("click", () => { const e = d.take(sel); if (e) { H.toast(e); return; } sel = []; if (H.hideTip) H.hideTip(); if (H.sfx && H.sfx.buy) H.sfx.buy(); render(); });
    for (const r of m.querySelectorAll(".dr-row")) { const x = mine.find((y) => y.key === r.dataset.key); if (x) tipCard(r, x); }
  }

  // ---------------------------------------------------------------- your turn: every card you drafted, on the tavern table
  const PLAY = {
    noShopButtons: true,
    shopList: () => [],
    turnBanner: () => (resumed ? H.banner(`${L("Change your board", "Modifie ton board")}<small>${L("your cards left · the order of your board · End turn: back to the tournament", "tes cartes restantes · l'ordre de ton board · Fin du tour : retour au tournoi")}</small>`, "", 1600)
      : H.banner(`${L("Build your board", "Construis ton board")}<small>${L("click your cards on the left · End turn: the tournament", "clique tes cartes à gauche · Fin du tour : le tournoi")}</small>`, "", 1600)),
    fight: () => toTournament(),
    gameMenu: () => backToMenu(),
    leave: () => endPlay(),
  };
  let G = null, usedOpen = false, resumed = false; const HAND = 10; // v148 the hand holds 10 cards at most: choose what to take
  let handT = 0; const watchHand = () => { clearInterval(handT); handT = setInterval(() => { const el = document.getElementById("drPanel"); if (!el || !G) { clearInterval(handT); return; } const sm = el.querySelector("h4 small"), n = G.human().hand.length; if (sm && !sm.textContent.endsWith(n + "/" + HAND)) panel(); }, 400); };
  function endPlay() { const p = document.getElementById("drPanel"); if (p) p.remove(); if (H && H.stage) H.stage.classList.remove("drp"); }
  function startPlay() {
    const heroes = [...new Set(d.collection(0).filter((x) => x.kind === "hero").map((x) => x.id))];
    if (heroes.length > 1 && !heroPick) {
      const m = H.modal(`<div class="dr"><h2>${L("Choose your hero", "Choisis ton héros")}</h2><p class="dr-hint">${L("The heroes you drafted. In the tournament only a passive power plays.", "Les héros que tu as draftés. Pendant le tournoi, seul un pouvoir passif joue.")}</p><div class="hero-choices"></div></div>`);
      const box = m.querySelector(".hero-choices");
      for (const id of heroes) { const c = H.heroCard(id); c.addEventListener("click", () => { heroPick = id; H.closeModal(); startPlay(); }); box.appendChild(c); }
      return;
    }
    if (!heroPick && heroes.length) heroPick = heroes[0];
    H.closeModal(); if (H.hideTip) H.hideTip();
    const w = W(), opts = D().gameOpts(type, d.collection(0)); G = new w.Game(1, null, true, opts); G.startTurn();
    const p = G.human(); p.ownU = opts.ownUniques; /* v148 the Uniques you drafted are yours: never discovered again */ p.name = d.seats[0].name; p.tier = 6; p.gold = 0; p.shop = []; p.shopSpell = null; p.shopSpellX = []; p.board = []; p.hand = [];
    p.hero = ""; if (heroPick && w.HEROES[heroPick]) G.setHero(p, heroPick);
    p.mods.triple = -1; // v149 two copies of a minion make a golden one (in hand or on board, a Discover included)
    const hp = w.HEROES[p.hero]; p.gold = hp && hp.power && hp.power.type !== "passive" ? hp.power.cost || 0 : 0; // v149 gold for the hero power, once
    resume(true);
  }
  // the tavern table with your board (v149: also between two rounds of the tournament, to change your board)
  function resume(first) {
    H.closeModal(); if (H.hideTip) H.hideTip();
    H.setGame(G); H.setMode(PLAY);
    for (const id of ["#shop", "#board", "#hand"]) H.$(id).innerHTML = "";
    H.stage.classList.add("drp");
    H.renderTribeList(); H.renderTavern();
    panel(); watchHand();
    resumed = !first; H.startTurnUI();
  }
  function panel() {
    let el = document.getElementById("drPanel"); if (!el) { el = document.createElement("div"); el.id = "drPanel"; H.stage.appendChild(el); }
    const mine = d.collection(0).filter((x) => x.kind !== "hero"), left = mine.filter((x) => !played.has(x.key)).length, hand = G.human().hand.length;
    const free = mine.filter((x) => !played.has(x.key)), used = mine.filter((x) => played.has(x.key)); // v149 the cards taken go down, in "Used"
    el.innerHTML = `<h4>${L("Your cards", "Tes cartes")} <small>${left} ${L("left", "restantes")} · ${L("hand", "main")} ${hand}/${HAND}</small></h4><p class="dr-phint">${L("Click a card: it goes to your hand.", "Clique une carte : elle va dans ta main.")}</p>
      <div class="dr-plist">${listHTML(free, true) || `<p class="dr-empty">${L("Every card is used.", "Toutes tes cartes sont utilisées.")}</p>`}${used.length ? `<details class="dr-used"${usedOpen ? " open" : ""}><summary>${L("Used", "Utilisées")} <small>${used.length}</small></summary>${listHTML(used, false)}</details>` : ""}</div>`;
    const det = el.querySelector(".dr-used"); if (det) det.addEventListener("toggle", () => { usedOpen = det.open; });
    for (const r of el.querySelectorAll(".dr-row")) {
      const x = mine.find((y) => y.key === r.dataset.key); if (!x) continue; tipCard(r, x);
      r.addEventListener("click", () => {
        if (played.has(x.key) || x.kind === "hero" || H.busy) return; if (H.hideTip) H.hideTip();
        const p = G.human(); if (p.hand.length >= HAND) { H.toast(L(`Your hand is full (${HAND} cards): play or sell a card first.`, `Ta main est pleine (${HAND} cartes) : joue ou vends une carte d'abord.`)); return; }
        const w = W(); p.hand.push(x.kind === "spell" ? new w.Spell(x.id) : new w.Minion(x.id, !!x.golden));
        played.add(x.key); if (x.kind === "minion") G.checkTriples(p); // v149 the second copy: golden
        if (H.sfx && H.sfx.buy) H.sfx.buy(); H.renderTavern(); panel();
      });
    }
  }

  // ---------------------------------------------------------------- the tournament
  function toTournament() {
    const Dm = D(), w = W(), you = G.human();
    const myBoard = Dm.normBoard({ hero: you.hero || "", minions: you.board.slice(0, Dm.MAX_MINIONS).map(Dm.snap), nc: you.nextCombat }); // v148 nc: what your spells give the next combat, in every fight
    endPlay();
    if (T && !T.over) { const e = T.entrants.find((x) => x.human); if (e) e.board = myBoard; H.busy = false; tourney(); return; } // v149 back from changing your board
    const me = { name: d.seats[0].name, board: myBoard, human: true };
    let others;
    if (mode === "campaign") others = Dm.campaignOpponents(w.makeRng(Date.now() % 1e9), 4, type.id).map((b) => ({ name: b.name || L("A champion", "Un champion"), board: b, ref: b.id, titles: b.titles }));
    else others = d.seats.slice(1).map((s, i) => { const c = d.collection(s.i); return { name: s.name, board: Dm.playBoard(Dm.autoBoard(c), 1000 + i, Dm.gameOpts(type, c)) }; });
    T = new Dm.Tournament([me, ...others], { mode });
    H.busy = false;
    tourney();
  }
  const boardLine = (b) => { const w = W(); return `${b.hero && w.HEROES[b.hero] ? `<b>${esc(w.HEROES[b.hero].name)}</b> · ` : ""}${b.minions.map((m) => esc((w.CARDS[m.id] || {}).name || m.id) + (m.golden ? "★" : "") + (m.atk != null ? ` <small>${m.atk}/${m.hp}</small>` : "")).join(", ")}`; };
  function tourney() {
    const st = T.standings(), nR = T.rounds.length, done = T.round >= nR, my = done ? null : T.myMatch();
    const res = (r) => { const a = T.entrants[r.a], b = T.entrants[r.b]; return `<div class="dr-res${a.human || b.human ? " me" : ""}"><span class="${r.winner === r.a ? "w" : ""}">${esc(a.name)}</span><i>${r.winner === -1 ? "=" : r.winner === r.a ? "›" : "‹"}</i><span class="${r.winner === r.b ? "w" : ""}">${esc(b.name)}</span></div>`; };
    const roundRes = T.results.filter((r) => T.rounds[Math.min(T.round, nR - 1)].some(([a, b]) => a === r.a && b === r.b));
    const pair = done && !T.over ? T.finalPair() : null;
    const m = H.modal(`<div class="dr dr-tour"><header class="dr-head"><h2>${mode === "campaign" ? L("Draft campaign", "Draft campagne") : L("Tournament", "Tournoi")} · ${esc(type.name)}</h2>
        <div class="dr-prog">${T.over ? L("Over", "Terminé") : done ? L("Final", "Finale") : `<b>${L("Round", "Ronde")} ${T.round + 1}/${nR}</b>`}</div></header>
      <table class="dr-table"><thead><tr><th>#</th><th>${L("Player", "Joueur")}</th><th>${L("Board", "Board")}</th><th>${L("W", "V")}</th><th>${L("D", "N")}</th><th>${L("L", "D")}</th><th>${L("Pts", "Pts")}</th></tr></thead>
        <tbody>${st.map((e, i) => `<tr class="${e.human ? "me" : ""}${i < 2 ? " top" : ""}"><td>${i + 1}</td><td>${esc(e.name)}${e.titles ? ` <small class="dr-crown">♛${e.titles}</small>` : ""}</td><td class="dr-bl">${boardLine(e.board)}</td><td>${e.w}</td><td>${e.d}</td><td>${e.l}</td><td><b>${e.pts}</b></td></tr>`).join("")}</tbody></table>
      ${roundRes.length ? `<div class="dr-results"><h4>${L("This round", "Cette ronde")}</h4>${roundRes.map(res).join("")}</div>` : ""}
      ${T.over ? endHTML() : ""}
      <div class="dr-actions"><button type="button" class="pill quiet" id="drMenu">${L("Menu", "Menu")}</button>
        ${!T.over && G ? `<button type="button" class="pill" id="drEdit">${L("Change my board", "Modifier mon board")}</button>` : ""}
        ${T.over ? `<button type="button" class="pill big" id="drAgain">${L("A new draft", "Un nouveau draft")}</button>`
          : !done ? (my ? `<button type="button" class="pill big" id="drPlay">${L("Watch my match", "Voir mon match")} · ${esc(T.entrants[my[0]].human ? T.entrants[my[1]].name : T.entrants[my[0]].name)}</button>` : `<button type="button" class="pill big" id="drNext">${T.round + 1 < nR ? L("Next round", "Ronde suivante") : L("To the final", "Vers la finale")}</button>`)
          : pair ? `<button type="button" class="pill big" id="drFinal">${L("The final", "La finale")} · ${esc(T.entrants[pair[0]].name)} – ${esc(T.entrants[pair[1]].name)}</button>` : `<button type="button" class="pill big" id="drFinal">${L("See the result", "Voir le résultat")}</button>`}</div></div>`);
    m.firstElementChild.classList.add("dr-box");
    const on = (id, fn) => { const b = m.querySelector(id); if (b) b.addEventListener("click", fn); };
    on("#drMenu", backToMenu);
    on("#drEdit", () => resume(false));
    on("#drAgain", () => { H.closeModal(); H.newGame(); open(H, mode); });
    on("#drPlay", async () => { const [a, b] = my; const r = T.play(a, b); T.playOthers(); await replay(r, `${L("Round", "Ronde")} ${T.round + 1}`); tourney(); });
    on("#drNext", () => { T.playOthers(); T.nextRound(); tourney(); });
    on("#drFinal", async () => { const f = T.playFinal(); if (f && (T.entrants[f.a].human || T.entrants[f.b].human)) await replay(f, L("Final", "Finale")); await afterFinal(); tourney(); });
  }
  function endHTML() {
    const c = T.champion, won = c && c.human;
    const msg = won ? (mode === "campaign" ? L("You win the campaign tournament: your board joins the campaign's champions.", "Tu gagnes le tournoi de la campagne : ton board rejoint les champions de la campagne.") : L("You win the Draft: your board is kept for the Draft campaign.", "Tu gagnes le Draft : ton board est gardé pour le Draft campagne."))
      : mode === "campaign" ? L(`${c.name} wins and stays in the campaign (one more title).`, `${c.name} gagne et reste dans la campagne (un titre de plus).`) : T.final ? L(`${c.name} wins the final.`, `${c.name} gagne la finale.`) : L(`You are not in the top 2: ${c.name} wins the Draft.`, `Tu n'es pas dans le top 2 : ${c.name} gagne le Draft.`);
    return `<div class="dr-end${won ? " won" : ""}"><b>${won ? "🏆 " : ""}${esc(c.name)}</b><p>${esc(msg)}</p>${T.final ? `<small>${L("Final", "Finale")} : ${esc(T.entrants[T.final.a].name)} – ${esc(T.entrants[T.final.b].name)}</small>` : ""}</div>`;
  }
  async function afterFinal() {
    const c = T.champion, Dm = D(); if (!c) return;
    if (c.human) await Dm.keepWinner(c.board, { name: (H.profileName && H.profileName()) || L("You", "Toi"), typeId: type.id });
    else if (mode === "campaign" && c.ref) await Dm.keepWinner(null, { ref: c.ref, typeId: type.id });
  }
  // your match on the table: the game's own fight replay (Speed 2x and Skip as in any fight)
  const FIGHT = {
    noShopButtons: true, shopList: () => [], gameMenu: () => backToMenu(), leave: () => {},
    fightEnd: async (ev, f) => { const won = ev.winner === 0, draw = ev.winner === -1; if (won) H.sfx.win && H.sfx.win(); else if (!draw) H.sfx.lose && H.sfx.lose(); await H.banner(draw ? `${L("Draw", "Égalité")}<small>${esc(f.drLabel || "")}</small>` : won ? `${L("Victory", "Victoire")}<small>${esc(f.drLabel || "")}</small>` : `${L("Defeat", "Défaite")}<small>${esc(f.drLabel || "")}</small>`, won ? "" : "lose", 1300); },
  };
  async function replay(r, label) {
    const meI = T.entrants[r.a].human ? r.a : r.b, opp = T.entrants[meI === r.a ? r.b : r.a], f = r.f, me = T.entrants[meI];
    H.closeModal(); if (H.hideTip) H.hideTip();
    H.setGame(f.game); H.setMode(FIGHT);
    const you = f.game.human(); you.name = me.name; you.hero = me.board.hero || "";
    f.oppObj = { id: -1, name: opp.name, hue: 200, hero: opp.board.hero || "", alive: true, armor: 0, tier: 6, streak: 0, isBot: true };
    f.hpBefore = [0, 0]; f.armBefore = [0, 0]; f.drLabel = `${label} · ${opp.name}`;
    for (const id of ["#shop", "#board", "#hand"]) H.$(id).innerHTML = "";
    try { await H.playCombat(f); } catch (e) { H.report(e); H.leaveCombat(); }
    H.stage.classList.remove("combat");
  }
  root.WA_DRAFT_UI = { open, get draft() { return d; }, get tournament() { return T; }, get game() { return G; }, get played() { return played; } };
})(typeof window !== "undefined" ? window : globalThis);
