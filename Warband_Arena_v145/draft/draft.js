// v145 Draft mode screens: the booster in front of you (take 2 cards), your cards so far, then the summary and the game
(function (root) {
  "use strict";
  let H = null, d = null, sel = [];
  const W = () => root.WA, D = () => root.WA_DRAFT;
  const fr = () => !!(H && H.isFr && H.isFr());
  const L = (en, f) => (fr() ? f : en);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TN = (t) => (H && H.TN ? H.TN(t) : t);
  const SLOT = () => ({ unique: L("Unique", "Unique"), neutral: L("Neutral", "Neutre"), spell: L("Spell", "Sort"), hero: L("Hero", "Héros"), t3: "Tier 3", t4: "Tier 4", t5: "Tier 5", t6: "Tier 6" });

  function open(host) { H = host; d = new (D().Draft)(null); sel = []; render(); }
  function cardEl(c) {
    const w = W();
    if (c.kind === "hero") return H.heroCard(c.id);
    const o = c.kind === "spell" ? new w.Spell(c.id) : new w.Minion(c.id);
    return H.makeCard(o.dict());
  }
  function mineHTML() {
    const w = W(), me = d.seats[0].picks, n = D().tribeCount(me), tr = Object.keys(n).sort((a, b) => n[b] - n[a]);
    const neutral = me.filter((c) => c.kind === "minion" && (w.CARDS[c.id].allTribes || !w.tribesOf(w.CARDS[c.id]).filter(Boolean).length)).length;
    const heroes = me.filter((c) => c.kind === "hero"), spells = me.filter((c) => c.kind === "spell");
    return `<div class="dr-mine"><b>${L("Your cards", "Tes cartes")} <small>${me.length}/30</small></b>
      <div class="dr-chips">${tr.map((t, i) => `<span class="dr-chip${i < 2 ? " dr-main" : ""}">${esc(TN(t))} <i>${n[t]}</i></span>`).join("")}${neutral ? `<span class="dr-chip">${L("Neutral", "Neutre")} <i>${neutral}</i></span>` : ""}
        <span class="dr-chip dr-kh">${L("Heroes", "Héros")} <i>${heroes.length}</i></span><span class="dr-chip dr-ks">${L("Spells", "Sorts")} <i>${spells.length}</i></span></div>
      ${tr.length >= 2 ? `<small class="dr-aff">${L(`Your two main tribes (${esc(TN(tr[0]))}, ${esc(TN(tr[1]))}) give your tavern their tier 1 and 2 cards.`, `Tes deux tribus principales (${esc(TN(tr[0]))}, ${esc(TN(tr[1]))}) donnent à ta taverne leurs cartes de tier 1 et 2.`)}</small>` : ""}</div>`;
  }
  function render() {
    if (d.done) return summary();
    const pack = d.myPack, want = Math.min(D().TAKE, pack.length), S = SLOT();
    const m = H.modal(`<div class="dr"><header class="dr-head"><h2>Draft</h2>
        <div class="dr-prog"><b>${L("Booster", "Booster")} ${d.round + 1}/3</b> · ${L("Pick", "Choix")} ${d.pickNo + 1}/${d.picksPerRound}<span class="dr-dir">${d.dir > 0 ? L("passes to the left ←", "passe à gauche ←") : L("passes to the right →", "passe à droite →")}</span></div>
        <div class="dr-dots">${Array.from({ length: 15 }, (_, i) => `<i class="${i < d.round * 5 + d.pickNo ? "on" : i === d.round * 5 + d.pickNo ? "now" : ""}${i % 5 === 0 && i ? " gap" : ""}"></i>`).join("")}</div></header>
      <p class="dr-hint">${L(`Take ${want} cards, then the booster goes to the next player (the 7 others are bots drafting for their tribes).`, `Prends ${want} cartes, puis le booster passe au joueur suivant (les 7 autres sont des IA qui draftent pour leurs tribus).`)}</p>
      <div class="dr-pack"></div>
      <div class="dr-foot">${mineHTML()}<button type="button" class="pill big dr-take" disabled>${L(`Take these ${want} cards`, `Prendre ces ${want} cartes`)}</button></div></div>`);
    m.firstElementChild.classList.add("dr-box");
    const box = m.querySelector(".dr-pack"), btn = m.querySelector(".dr-take");
    for (const c of pack) {
      const wrap = document.createElement("div"); wrap.className = "dr-slot" + (sel.includes(c.uid) ? " on" : ""); wrap.dataset.uid = c.uid;
      wrap.innerHTML = `<span class="dr-tag k-${c.kind}">${esc(S[c.slot] || "")}</span>`;
      const el = cardEl(c); if (el.tagName === "BUTTON") el.type = "button"; wrap.appendChild(el);
      wrap.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (sel.includes(c.uid)) sel = sel.filter((x) => x !== c.uid); else { if (sel.length >= want) sel.shift(); sel.push(c.uid); }
        for (const x of box.querySelectorAll(".dr-slot")) x.classList.toggle("on", sel.includes(x.dataset.uid));
        btn.disabled = sel.length !== want; if (H.sfx && H.sfx.click) H.sfx.click();
      }, true);
      box.appendChild(wrap);
    }
    btn.addEventListener("click", () => {
      const e = d.take(sel); if (e) { H.toast(e); return; }
      sel = []; if (H.hideTip) H.hideTip(); if (H.sfx && H.sfx.buy) H.sfx.buy(); render();
    });
  }
  function summary() {
    const w = W(), me = d.seats[0].picks, n = D().tribeCount(me), tr = Object.keys(n).sort((a, b) => n[b] - n[a]);
    const group = (title, list) => list.length ? `<div class="dr-grp"><h4>${esc(title)} <small>${list.length}</small></h4><div class="dr-names">${list.map((c) => {
      const nm = c.kind === "hero" ? w.HEROES[c.id].name : c.kind === "spell" ? w.SPELLS[c.id].name : w.CARDS[c.id].name, t = c.kind === "minion" ? w.CARDS[c.id].tier : c.kind === "spell" ? w.SPELLS[c.id].tier || 1 : "";
      return `<span class="dr-name k-${c.kind}">${t ? `<i>${t}</i>` : ""}${esc(nm)}</span>`; }).join("")}</div></div>` : "";
    const byTribe = tr.map((t) => group(TN(t), me.filter((c) => c.kind === "minion" && !w.CARDS[c.id].allTribes && w.tribesOf(w.CARDS[c.id])[0] === t).sort((a, b) => w.CARDS[a.id].tier - w.CARDS[b.id].tier))).join("");
    const others = me.filter((c) => c.kind === "minion" && (w.CARDS[c.id].allTribes || !w.tribesOf(w.CARDS[c.id]).filter(Boolean).length));
    const bots = d.seats.slice(1).map((s) => `<span class="dr-bot"><b>${esc(s.name)}</b> ${d.mainTribes(s.i).map((t) => esc(TN(t))).join(" + ")}</span>`).join("");
    const m = H.modal(`<div class="dr dr-sum"><header class="dr-head"><h2>${L("Draft complete", "Draft terminé")}</h2><div class="dr-prog">${L("30 cards: your tavern will offer these (and your two main tribes' tiers 1-2).", "30 cartes : ta taverne proposera celles-ci (et les tiers 1-2 de tes deux tribus principales).")}</div></header>
      <div class="dr-cols"><div>${group(L("Heroes (your hero choice)", "Héros (ton choix de héros)"), me.filter((c) => c.kind === "hero"))}${group(L("Spells", "Sorts"), me.filter((c) => c.kind === "spell"))}${byTribe}${group(L("Neutral", "Neutres"), others)}</div>
        <aside><h4>${L("The bots drafted", "Les IA ont drafté")}</h4><div class="dr-bots">${bots}</div></aside></div>
      <div class="dr-actions"><button type="button" class="pill quiet" id="drMenu">${L("Menu", "Menu")}</button><button type="button" class="pill big" id="drPlay">${L("Play with these cards", "Jouer avec ces cartes")}</button></div></div>`);
    m.firstElementChild.classList.add("dr-box");
    m.querySelector("#drPlay").addEventListener("click", () => H.startDraftGame({ pools: d.pools(), tribes: d.tribes(), names: d.seats.slice(1).map((s) => s.name) }));
    m.querySelector("#drMenu").addEventListener("click", () => { H.closeModal(); if (H.showIntro) H.showIntro(); });
  }
  root.WA_DRAFT_UI = { open, get draft() { return d; } };
})(typeof window !== "undefined" ? window : globalThis);
