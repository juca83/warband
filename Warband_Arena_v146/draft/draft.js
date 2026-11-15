// v146 Draft mode screens: the draft (the booster in front of you, your picks on the right in two lists: kept / side), the board
// you build from your kept cards, the tournament (everyone fights everyone, your fights replayed on the table, then the final),
// and the Draft campaign (the same draft, but the opponents are the boards that won before)
(function (root) {
  "use strict";
  let H = null, d = null, sel = [], mode = "draft", board = null, T = null, drag = null;
  const W = () => root.WA, D = () => root.WA_DRAFT;
  const fr = () => !!(H && H.isFr && H.isFr());
  const L = (en, f) => (fr() ? f : en);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TN = (t) => (H && H.TN ? H.TN(t) : t);
  const SLOT = () => ({ unique: L("Unique", "Unique"), neutral: L("Neutral", "Neutre"), mage: L("Mage", "Mage"), hero: L("Hero", "Héros"), t3: "Tier 3", t4: "Tier 4", t5: "Tier 5", t6: "Tier 6" });
  const nameOf = (x) => { const w = W(); return x.kind === "hero" ? (w.HEROES[x.id] || {}).name : x.kind === "spell" ? (w.SPELLS[x.id] || {}).name : (w.CARDS[x.id] || {}).name; };
  const tierOf = (x) => { const w = W(); return x.kind === "minion" ? (w.CARDS[x.id] || {}).tier : x.kind === "spell" ? (w.SPELLS[x.id] || {}).tier || 1 : ""; };
  const MODE = {
    noShopButtons: true,
    fightEnd: async (ev, f) => { const me = f.drMe; const won = ev.winner === 0, draw = ev.winner === -1; if (won) H.sfx.win && H.sfx.win(); else if (!draw) H.sfx.lose && H.sfx.lose(); await H.banner(draw ? `${L("Draw", "Égalité")}<small>${esc(f.drLabel || "")}</small>` : won ? `${L("Victory", "Victoire")}<small>${esc(f.drLabel || "")}</small>` : `${L("Defeat", "Défaite")}<small>${esc(f.drLabel || "")}</small>`, won ? "" : "lose", 1500); },
    gameMenu: () => backToMenu(),
    leave: () => {},
  };

  // ---------------------------------------------------------------- start
  function open(host, m) {
    H = host; mode = m === "campaign" ? "campaign" : "draft"; sel = []; board = null; T = null;
    if (mode === "campaign" && !D().load().campaign.length) {
      const md = H.modal(`<div class="dr"><h2>${L("Draft campaign", "Draft campagne")}</h2><p>${L("No board has won a Draft yet. Win a Draft tournament: your winning board joins the campaign, and the campaign's opponents are those boards.", "Aucun board n'a encore gagné de Draft. Gagne un tournoi de Draft : ton board vainqueur rejoint la campagne, et les adversaires de la campagne sont ces boards-là.")}</p>
        <div class="dr-actions"><button type="button" class="pill" id="drMenu">${L("Back", "Retour")}</button></div></div>`);
      md.firstElementChild.classList.add("dr-box"); md.querySelector("#drMenu").addEventListener("click", backToMenu); return;
    }
    d = new (D().Draft)({ you: L("You", "Toi") });
    render();
  }
  function backToMenu() { H.closeModal(); if (H.hideTip) H.hideTip(); H.newGame(); if (H.showIntro) H.showIntro(); }
  function cardEl(x) {
    const w = W();
    if (x.kind === "hero") return H.heroCard(x.id);
    const o = x.kind === "spell" ? new w.Spell(x.id) : new w.Minion(x.id, !!x.golden);
    return H.makeCard(o.dict());
  }
  const tipCard = (el, x) => { el.addEventListener("mouseenter", () => { if (!H.htmlTip) return; const c = cardEl(x); c.classList.add("static"); H.htmlTip(el, `<div class="dr-tipcard">${c.outerHTML}</div>`); }); el.addEventListener("mouseleave", () => H.hideTip && H.hideTip()); };

  // ---------------------------------------------------------------- your picks: kept / side (drag a card from one list to the other)
  function listsHTML() {
    const picks = d.seats[0].picks, main = picks.filter((c) => !c.side), side = picks.filter((c) => c.side);
    const count = {}; for (const c of main) if (c.kind === "minion") count[c.id] = (count[c.id] || 0) + 1;
    const row = (c) => `<div class="dr-row k-${c.kind}" draggable="true" data-uid="${esc(c.uid)}"><i>${tierOf(c) || (c.kind === "hero" ? "H" : "")}</i><span>${esc(nameOf(c))}</span>${!c.side && c.kind === "minion" && count[c.id] >= 2 ? `<b class="dr-gold" title="${esc(L("2 copies: golden", "2 exemplaires : doré"))}">★</b>` : ""}<button type="button" class="dr-mv" data-uid="${esc(c.uid)}" title="${esc(c.side ? L("Keep it", "La garder") : L("Set it aside", "La mettre de côté"))}">${c.side ? "↑" : "↓"}</button></div>`;
    return `<aside class="dr-lists"><div class="dr-list" data-side="0"><h4>${L("Kept", "Gardées")} <small>${main.length}</small></h4>${main.map(row).join("") || `<p class="dr-empty">${L("Your picks show here.", "Tes choix s'affichent ici.")}</p>`}</div>
      <div class="dr-list side" data-side="1"><h4>${L("Side", "Side")} <small>${side.length}</small></h4>${side.map(row).join("") || `<p class="dr-empty">${L("Drag here what you won't play.", "Glisse ici ce que tu ne joueras pas.")}</p>`}</div></aside>`;
  }
  function bindLists(m, again) {
    for (const r of m.querySelectorAll(".dr-row")) {
      const c = d.seats[0].picks.find((x) => x.uid === r.dataset.uid); if (c) tipCard(r, c);
      r.addEventListener("dragstart", (e) => { drag = r.dataset.uid; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", drag); } catch (x) {} });
    }
    for (const l of m.querySelectorAll(".dr-list")) {
      l.addEventListener("dragover", (e) => { e.preventDefault(); l.classList.add("over"); });
      l.addEventListener("dragleave", () => l.classList.remove("over"));
      l.addEventListener("drop", (e) => { e.preventDefault(); l.classList.remove("over"); if (drag) { d.setSide(drag, l.dataset.side === "1"); drag = null; if (H.hideTip) H.hideTip(); again(); } });
    }
    for (const b of m.querySelectorAll(".dr-mv")) b.addEventListener("click", (e) => { e.stopPropagation(); const c = d.seats[0].picks.find((x) => x.uid === b.dataset.uid); if (c) { d.setSide(c.uid, !c.side); if (H.hideTip) H.hideTip(); again(); } });
  }

  // ---------------------------------------------------------------- the draft
  function render() {
    if (d.done) return build();
    const pack = d.myPack, want = Math.min(d.pick, pack.length), S = SLOT(), tot = d.totalPicks, k = d.pickIndex;
    const m = H.modal(`<div class="dr dr-draft"><div class="dr-mainc"><header class="dr-head"><h2>${mode === "campaign" ? L("Draft campaign", "Draft campagne") : "Draft"}</h2>
        <div class="dr-prog"><b>${L("Booster", "Booster")} ${d.round + 1}/${d.packs}</b> · ${L("Pick", "Choix")} ${d.pickNo + 1}/${d.picksPerRound}<span class="dr-dir">${d.dir > 0 ? L("passes to the left ←", "passe à gauche ←") : L("passes to the right →", "passe à droite →")}</span></div>
        <div class="dr-dots">${Array.from({ length: tot }, (_, i) => `<i class="${i < k ? "on" : i === k ? "now" : ""}${i % d.picksPerRound === 0 && i ? " gap" : ""}"></i>`).join("")}</div></header>
      <p class="dr-hint">${L(`Take ${want} card${want > 1 ? "s" : ""}, then the booster goes to the next player (4 bots draft for their tribes). Two copies of a minion make a golden one.`, `Prends ${want} carte${want > 1 ? "s" : ""}, puis le booster passe au joueur suivant (4 IA draftent pour leurs tribus). Deux exemplaires d'un serviteur font un doré.`)}</p>
      <div class="dr-pack"></div>
      <div class="dr-foot"><span class="dr-left">${L(`${d.seats[0].picks.length} cards`, `${d.seats[0].picks.length} cartes`)}</span><button type="button" class="pill big dr-take" disabled>${want > 1 ? L(`Take these ${want} cards`, `Prendre ces ${want} cartes`) : L("Take this card", "Prendre cette carte")}</button></div></div>
      ${listsHTML()}</div>`);
    m.firstElementChild.classList.add("dr-box");
    const box = m.querySelector(".dr-pack"), btn = m.querySelector(".dr-take");
    for (const c of pack) {
      const wrap = document.createElement("div"); wrap.className = "dr-slot" + (sel.includes(c.uid) ? " on" : ""); wrap.dataset.uid = c.uid;
      wrap.innerHTML = `<span class="dr-tag k-${c.kind}${c.slot === "mage" ? " k-mage" : ""}">${esc(S[c.slot] || "")}</span>`;
      const el = cardEl(c); if (el.tagName === "BUTTON") el.type = "button"; wrap.appendChild(el);
      wrap.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (sel.includes(c.uid)) sel = sel.filter((x) => x !== c.uid); else { if (sel.length >= want) sel.shift(); sel.push(c.uid); }
        for (const x of box.querySelectorAll(".dr-slot")) x.classList.toggle("on", sel.includes(x.dataset.uid));
        btn.disabled = sel.length !== want;
      }, true);
      box.appendChild(wrap);
    }
    btn.addEventListener("click", () => { const e = d.take(sel); if (e) { H.toast(e); return; } sel = []; if (H.hideTip) H.hideTip(); if (H.sfx && H.sfx.buy) H.sfx.buy(); render(); });
    bindLists(m, render);
  }

  // ---------------------------------------------------------------- your board (from your kept cards)
  function build() {
    const w = W(), items = d.collection(0, true), Dm = D();
    if (!board) board = Dm.autoBoard(items);
    // what is still free for the board: the kept items not used yet
    const used = new Set(), keyOf = (m) => m.id + (m.golden ? "*" : "");
    const pool = items.slice(), onBoard = [];
    for (const m of board.minions) { const i = pool.findIndex((x) => x.kind === "minion" && x.id === m.id && !!x.golden === !!m.golden && !used.has(x.key)); if (i >= 0) { used.add(pool[i].key); onBoard.push(pool[i]); } }
    board.minions = onBoard.map((x) => ({ id: x.id, golden: x.golden }));
    if (board.hero && !items.some((x) => x.kind === "hero" && x.id === board.hero)) board.hero = "";
    board.spells = (board.spells || []).filter((id) => items.some((x) => x.kind === "spell" && x.id === id));
    const free = items.filter((x) => !used.has(x.key) && !(x.kind === "hero" && x.id === board.hero) && !(x.kind === "spell" && board.spells.includes(x.id)));
    const m = H.modal(`<div class="dr dr-build"><div class="dr-mainc"><header class="dr-head"><h2>${L("Your board", "Ton board")}</h2>
        <div class="dr-prog">${L("Up to 7 minions (the leftmost attacks first) and a hero; then a tournament: everyone fights everyone once, the top 2 play the final.", "Jusqu'à 7 serviteurs (le plus à gauche attaque en premier) et un héros ; puis un tournoi : chacun affronte chacun une fois, les 2 premiers jouent la finale.")}</div></header>
      <div class="dr-boardrow"><div class="dr-hero">${board.hero ? "" : `<span class="dr-ph">${L("Hero", "Héros")}</span>`}</div><div class="dr-board"></div></div>
      <h4 class="dr-sub">${L("Your kept cards", "Tes cartes gardées")} <small>${L("click one to put it on the board", "clique pour la poser sur le board")}</small></h4>
      <div class="dr-pool"></div>
      <div class="dr-foot"><button type="button" class="pill" id="drAuto">${L("Fill it for me", "Remplir automatiquement")}</button><button type="button" class="pill big" id="drGo"${board.minions.length ? "" : " disabled"}>${mode === "campaign" ? L("Face the campaign", "Affronter la campagne") : L("Start the tournament", "Lancer le tournoi")}</button></div></div>
      ${listsHTML()}</div>`);
    m.firstElementChild.classList.add("dr-box");
    const bEl = m.querySelector(".dr-board"), hEl = m.querySelector(".dr-hero"), pEl = m.querySelector(".dr-pool");
    board.minions.forEach((mn, i) => {
      const x = { kind: "minion", id: mn.id, golden: mn.golden }, wrap = document.createElement("div"); wrap.className = "dr-bslot";
      const c = cardEl(x); wrap.appendChild(c);
      wrap.insertAdjacentHTML("beforeend", `<div class="dr-bctl"><button type="button" data-a="l"${i ? "" : " disabled"}>◀</button><button type="button" data-a="x">✕</button><button type="button" data-a="r"${i < board.minions.length - 1 ? "" : " disabled"}>▶</button></div>`);
      wrap.querySelector('[data-a="l"]').addEventListener("click", () => { [board.minions[i - 1], board.minions[i]] = [board.minions[i], board.minions[i - 1]]; build(); });
      wrap.querySelector('[data-a="r"]').addEventListener("click", () => { [board.minions[i + 1], board.minions[i]] = [board.minions[i], board.minions[i + 1]]; build(); });
      wrap.querySelector('[data-a="x"]').addEventListener("click", () => { board.minions.splice(i, 1); if (H.hideTip) H.hideTip(); build(); });
      bEl.appendChild(wrap);
    });
    for (let i = board.minions.length; i < Dm.MAX_MINIONS; i++) bEl.insertAdjacentHTML("beforeend", `<div class="dr-bslot empty"></div>`);
    if (board.hero) { const c = cardEl({ kind: "hero", id: board.hero }); c.type = "button"; c.title = L("Take it off", "L'enlever"); c.addEventListener("click", () => { board.hero = ""; build(); }); hEl.appendChild(c); }
    for (const x of free) {
      const wrap = document.createElement("div"); wrap.className = "dr-pslot k-" + x.kind; const c = cardEl(x); if (c.tagName === "BUTTON") c.type = "button"; wrap.appendChild(c);
      if (x.golden) wrap.insertAdjacentHTML("afterbegin", `<span class="dr-tag k-hero">${L("Golden", "Doré")}</span>`);
      wrap.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation(); if (H.hideTip) H.hideTip();
        if (x.kind === "hero") board.hero = x.id;
        else if (x.kind === "spell") { if (board.spells.length < Dm.MAX_SPELLS) board.spells.push(x.id); else return H.toast(L("Two spells at most.", "Deux sorts au plus.")); }
        else { if (board.minions.length >= Dm.MAX_MINIONS) return H.toast(L("The board is full (7).", "Le board est plein (7).")); board.minions.push({ id: x.id, golden: x.golden }); }
        build();
      }, true);
      pEl.appendChild(wrap);
    }
    m.querySelector("#drAuto").addEventListener("click", () => { board = Dm.autoBoard(d.collection(0, true)); build(); });
    m.querySelector("#drGo").addEventListener("click", startTournament);
    bindLists(m, build);
  }

  // ---------------------------------------------------------------- the tournament
  function startTournament() {
    const Dm = D(), w = W(), me = { name: d.seats[0].name, board: Dm.normBoard(board), human: true };
    let others;
    if (mode === "campaign") others = Dm.campaignOpponents(w.makeRng(Date.now() % 1e9), 4).map((b) => ({ name: b.name || L("A champion", "Un champion"), board: b, ref: b.id, titles: b.titles }));
    else others = d.seats.slice(1).map((s) => ({ name: s.name, board: Dm.autoBoard(d.collection(s.i)) }));
    T = new Dm.Tournament([me, ...others], { mode });
    tourney();
  }
  const boardLine = (b) => { const w = W(); return `${b.hero && w.HEROES[b.hero] ? `<b>${esc(w.HEROES[b.hero].name)}</b> · ` : ""}${b.minions.map((m) => esc((w.CARDS[m.id] || {}).name || m.id) + (m.golden ? "★" : "")).join(", ")}`; };
  function tourney(last) {
    const st = T.standings(), nR = T.rounds.length, done = T.round >= nR, my = done ? null : T.myMatch();
    const res = (r) => { const a = T.entrants[r.a], b = T.entrants[r.b]; return `<div class="dr-res${a.human || b.human ? " me" : ""}"><span class="${r.winner === r.a ? "w" : ""}">${esc(a.name)}</span><i>${r.winner === -1 ? "=" : r.winner === r.a ? "›" : "‹"}</i><span class="${r.winner === r.b ? "w" : ""}">${esc(b.name)}</span></div>`; };
    const roundRes = T.results.filter((r) => T.rounds[Math.min(T.round, nR - 1)].some(([a, b]) => a === r.a && b === r.b));
    const pair = done && !T.over ? T.finalPair() : null;
    const m = H.modal(`<div class="dr dr-tour"><header class="dr-head"><h2>${mode === "campaign" ? L("Draft campaign", "Draft campagne") : L("Tournament", "Tournoi")}</h2>
        <div class="dr-prog">${T.over ? L("Over", "Terminé") : done ? L("Final", "Finale") : `<b>${L("Round", "Ronde")} ${T.round + 1}/${nR}</b>`}</div></header>
      <table class="dr-table"><thead><tr><th>#</th><th>${L("Player", "Joueur")}</th><th>${L("Board", "Board")}</th><th>${L("W", "V")}</th><th>${L("D", "N")}</th><th>${L("L", "D")}</th><th>${L("Pts", "Pts")}</th></tr></thead>
        <tbody>${st.map((e, i) => `<tr class="${e.human ? "me" : ""}${i < 2 ? " top" : ""}"><td>${i + 1}</td><td>${esc(e.name)}${e.titles ? ` <small class="dr-crown" title="${esc(L("Titles", "Titres"))}">♛${e.titles}</small>` : ""}</td><td class="dr-bl">${boardLine(e.board)}</td><td>${e.w}</td><td>${e.d}</td><td>${e.l}</td><td><b>${e.pts}</b></td></tr>`).join("")}</tbody></table>
      ${roundRes.length ? `<div class="dr-results"><h4>${L("This round", "Cette ronde")}</h4>${roundRes.map(res).join("")}</div>` : ""}
      ${T.over ? endHTML() : ""}
      <div class="dr-actions"><button type="button" class="pill quiet" id="drMenu">${L("Menu", "Menu")}</button>
        ${T.over ? `<button type="button" class="pill big" id="drAgain">${L("A new draft", "Un nouveau draft")}</button>`
          : !done ? (my ? `<button type="button" class="pill big" id="drPlay">${L("Play my match", "Jouer mon match")} · ${esc(T.entrants[my[0]].human ? T.entrants[my[1]].name : T.entrants[my[0]].name)}</button>` : `<button type="button" class="pill big" id="drNext">${T.round + 1 < nR ? L("Next round", "Ronde suivante") : L("To the final", "Vers la finale")}</button>`)
          : pair ? `<button type="button" class="pill big" id="drFinal">${L("Play the final", "Jouer la finale")} · ${esc(T.entrants[pair[0]].name)} – ${esc(T.entrants[pair[1]].name)}</button>` : `<button type="button" class="pill big" id="drFinal">${L("See the result", "Voir le résultat")}</button>`}</div></div>`);
    m.firstElementChild.classList.add("dr-box");
    m.querySelector("#drMenu").addEventListener("click", backToMenu);
    const on = (id, fn) => { const b = m.querySelector(id); if (b) b.addEventListener("click", fn); };
    on("#drAgain", () => open(H, mode));
    on("#drPlay", async () => { const [a, b] = my; const r = T.play(a, b); T.playOthers(); await replay(r, `${L("Round", "Ronde")} ${T.round + 1}`); tourney(); });
    on("#drNext", () => { T.playOthers(); T.nextRound(); if (T.round < nR) { const mm = T.myMatch(); if (!mm) T.playOthers(); } tourney(); });
    on("#drFinal", async () => { const f = T.playFinal(); if (f && (T.entrants[f.a].human || T.entrants[f.b].human)) await replay(f, L("Final", "Finale")); await afterFinal(); tourney(); });
  }
  function endHTML() {
    const c = T.champion, me = T.entrants.find((e) => e.human), won = c && c.human;
    const msg = won ? (mode === "campaign" ? L("You win the campaign tournament: your board joins the campaign's champions.", "Tu gagnes le tournoi de la campagne : ton board rejoint les champions de la campagne.") : L("You win the Draft: your board is kept for the Draft campaign.", "Tu gagnes le Draft : ton board est gardé pour le Draft campagne."))
      : mode === "campaign" ? L(`${c.name} wins and stays in the campaign (one more title).`, `${c.name} gagne et reste dans la campagne (un titre de plus).`) : T.final ? L(`${c.name} wins the final.`, `${c.name} gagne la finale.`) : L(`You are not in the top 2: ${c.name} wins the Draft.`, `Tu n'es pas dans le top 2 : ${c.name} gagne le Draft.`);
    return `<div class="dr-end${won ? " won" : ""}"><b>${won ? "🏆 " : ""}${esc(c.name)}</b><p>${esc(msg)}</p>${T.final ? `<small>${L("Final", "Finale")} : ${esc(T.entrants[T.final.a].name)} – ${esc(T.entrants[T.final.b].name)}</small>` : ""}</div>`;
  }
  async function afterFinal() {
    const c = T.champion, Dm = D(); if (!c) return;
    if (c.human) await Dm.keepWinner(c.board, { name: (H.profileName && H.profileName()) || L("You", "Toi") });
    else if (mode === "campaign" && c.ref) await Dm.keepWinner(null, { ref: c.ref });
  }
  // your match on the table: the game's fight replay
  async function replay(r, label) {
    const meI = T.entrants[r.a].human ? r.a : r.b, opp = T.entrants[meI === r.a ? r.b : r.a], f = r.f; // (the fight is seen from your side)
    const me = T.entrants.find((e) => e.human);
    H.closeModal(); if (H.hideTip) H.hideTip();
    H.setGame(f.game); H.setMode(MODE);
    const you = f.game.human(); you.name = me.name; you.hero = me.board.hero || "";
    f.oppObj = { id: -1, name: opp.name, hue: 200, hero: opp.board.hero || "", alive: true, armor: 0, tier: 6, streak: 0, isBot: true };
    f.hpBefore = [0, 0]; f.armBefore = [0, 0]; f.drLabel = `${label} · ${opp.name}`;
    for (const id of ["#shop", "#board", "#hand"]) H.$(id).innerHTML = "";
    try { await H.playCombat(f); } catch (e) { H.report(e); H.leaveCombat(); }
    H.stage.classList.remove("combat");
  }
  root.WA_DRAFT_UI = { open, get draft() { return d; }, get tournament() { return T; }, get board() { return board; } };
})(typeof window !== "undefined" ? window : globalThis);
