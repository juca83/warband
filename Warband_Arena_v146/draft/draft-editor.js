// v146 Studio › Draft: the number of boosters, single or double pick, and what can be in the boosters (tribes, minions, heroes)
(function (root) {
  "use strict";
  let api = null, host = null, data = null, open = new Set(), saveT = 0;
  const W = () => root.WA, Dm = () => root.WA_DRAFT;
  const fr = () => !!(root.WA_I18N && root.WA_I18N.lang === "fr");
  const L = (en, f) => (fr() ? f : en);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const thumb = (id) => { try { return `<span class="ae-th">${root.WA_ART.art(id)}</span>`; } catch (e) { return `<span class="ae-th"></span>`; } };
  const heroThumb = (id) => { const r = api.ST && api.ST.IMAGES && api.ST.IMAGES["hero:" + id], h = W().HEROES[id]; return `<span class="ae-th ae-hth"${r ? ` style="background-image:url('${esc(r.card)}')"` : ""}>${r ? "" : esc(((h && h.name) || "?")[0])}</span>`; };
  function save() { clearTimeout(saveT); saveT = setTimeout(async () => { await Dm().save(data); if (api.status) api.status(L("Draft settings saved.", "Réglages du Draft enregistrés.")); }, 250); }
  function render(h, a) {
    host = h; api = a; data = Dm().load();
    draw();
    host.onclick = onClick; host.onchange = onChange;
  }
  function pool() {
    const w = W(), ok = (id) => { const d = w.CARDS[id]; return d && d.inPool !== false && !d.retired && !d.affOnly && (d.tier || 1) >= 3 && !(w.EVO_T && w.EVO_T.has(id)); }; // (tiers 1-2 never come in boosters)
    const ids = Object.keys(w.CARDS).filter(ok).sort((x, y) => (w.CARDS[x].tier || 1) - (w.CARDS[y].tier || 1) || w.CARDS[x].name.localeCompare(w.CARDS[y].name));
    const groups = {}; for (const id of ids) { const d = w.CARDS[id], t = d.allTribes ? "*all" : (w.tribesOf(d).filter(Boolean)[0] || "*neutral"); (groups[t] = groups[t] || []).push(id); }
    return groups;
  }
  function draw() {
    const w = W(), S = data.settings, R = S.restrict, G = pool(), outT = new Set(R.tribes), outC = new Set(R.cards), outH = new Set(R.heroes);
    const gname = (g) => (g === "*all" ? L("All tribes", "Toutes tribus") : g === "*neutral" ? L("Neutral", "Neutres") : w.tribeName(g));
    const order = [...w.availableTribes().filter((t) => G[t]), "*neutral", "*all"].filter((g) => G[g]);
    const sets = Dm().cardSets(R);
    const grp = (g) => { const l = G[g], tribe = g[0] !== "*", off = tribe && outT.has(g), kept = l.filter((id) => !outC.has(id)).length;
      return `<div class="ae-grp${off ? " off" : ""}"><div class="ae-ghead">${tribe ? `<label class="ae-tog"><input type="checkbox" data-t="${esc(g)}" ${off ? "" : "checked"}><b>${esc(gname(g))}</b></label>` : `<b>${esc(gname(g))}</b>`}
        <small>${off ? L("left out", "retirée") : `${kept}/${l.length}`}</small><button type="button" class="ce-mini" data-act="all" data-g="${esc(g)}">${L("all", "tout")}</button><button type="button" class="ce-mini" data-act="none" data-g="${esc(g)}">${L("none", "rien")}</button><button type="button" class="ce-mini" data-act="grp" data-g="${esc(g)}">${open.has(g) ? "▾" : "▸"}</button></div>
        ${open.has(g) ? `<div class="ae-items">${l.map((id) => `<label class="ae-it"><input type="checkbox" data-c="${esc(id)}" ${outC.has(id) ? "" : "checked"}>${thumb(id)}<span><i>T${w.CARDS[id].tier}</i> ${esc(w.CARDS[id].name)}${w.CARDS[id].unique ? " ✦" : ""}</span></label>`).join("")}</div>` : ""}</div>`; };
    const heroes = w.HERO_LIST.filter((h) => w.HEROES[h] && !w.HEROES[h].off);
    host.innerHTML = `<div class="st-head"><h3>Draft</h3><p class="ce-hint">${L("The Draft mode: 5 players (you and 4 bots) open boosters of 10 cards (1 Unique tribe card, 1 neutral, 1 Mage, 1 hero, 1 tier 3, 2 tier 4, 2 tier 5, 1 tier 6), take 1 or 2 cards and pass them on. Then everyone builds a board and a tournament is played; a board that wins goes to the Draft campaign.", "Le mode Draft : 5 joueurs (toi et 4 IA) ouvrent des boosters de 10 cartes (1 Unique de tribu, 1 neutre, 1 Mage, 1 héros, 1 tier 3, 2 tier 4, 2 tier 5, 1 tier 6), prennent 1 ou 2 cartes et les passent. Puis chacun construit un board et un tournoi se joue ; un board vainqueur rejoint le Draft campagne.")}</p></div>
      <div class="ce-sec dre-set">
        <label>${L("Boosters per player", "Boosters par joueur")} <select data-k="packs">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}"${S.packs === n ? " selected" : ""}>${n}</option>`).join("")}</select></label>
        <label>${L("Pick", "Choix")} <select data-k="pick"><option value="1"${S.pick === 1 ? " selected" : ""}>${L("Single: 1 card at a time", "Simple : 1 carte à la fois")}</option><option value="2"${S.pick === 2 ? " selected" : ""}>${L("Double: 2 cards at a time", "Double : 2 cartes à la fois")}</option></select></label>
        <span class="ce-hint">${L(`${S.packs * Math.ceil(10 / S.pick)} picks, ${S.packs * 10} cards each.`, `${S.packs * Math.ceil(10 / S.pick)} choix, ${S.packs * 10} cartes chacun.`)} ${L(`Mages: ${sets.mages.map((id) => w.CARDS[id].name).join(", ") || "none"}.`, `Mages : ${sets.mages.map((id) => w.CARDS[id].name).join(", ") || "aucun"}.`)}</span>
      </div>
      <div class="ce-sec"><h4>${L("Minions in the boosters", "Serviteurs dans les boosters")}</h4><p class="ce-hint">${L("Untick a tribe or a card to leave it out of the Draft (the cards of tier 3 to 6: boosters hold no tier 1 or 2).", "Décoche une tribu ou une carte pour la retirer du Draft (les cartes de tier 3 à 6 : les boosters n'ont pas de tier 1 ni 2).")}</p>${order.map(grp).join("")}</div>
      <div class="ce-sec"><h4>${L("Heroes in the boosters", "Héros dans les boosters")} <small>${heroes.filter((h) => !outH.has(h)).length}/${heroes.length}</small></h4>
        <div class="ae-items">${heroes.map((h) => `<label class="ae-it"><input type="checkbox" data-h="${esc(h)}" ${outH.has(h) ? "" : "checked"}>${heroThumb(h)}<span>${esc(w.HEROES[h].name)}${(w.HEROES[h].needTribes || []).length ? ` <small>(${esc(w.HEROES[h].needTribes.map((t) => w.tribeName(t)).join("/"))})</small>` : ""}</span></label>`).join("")}</div></div>`;
  }
  function onClick(e) {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const g = b.dataset.g, R = data.settings.restrict, ids = pool()[g] || [];
    if (b.dataset.act === "grp") { open.has(g) ? open.delete(g) : open.add(g); draw(); return; }
    if (b.dataset.act === "all") { R.cards = R.cards.filter((x) => !ids.includes(x)); if (g[0] !== "*") R.tribes = R.tribes.filter((x) => x !== g); }
    if (b.dataset.act === "none") R.cards = [...new Set(R.cards.concat(ids))];
    save(); draw();
  }
  function onChange(e) {
    const x = e.target, S = data.settings, R = S.restrict;
    if (x.dataset.k === "packs") S.packs = +x.value;
    else if (x.dataset.k === "pick") S.pick = +x.value;
    else if (x.dataset.t) R.tribes = x.checked ? R.tribes.filter((t) => t !== x.dataset.t) : [...new Set(R.tribes.concat(x.dataset.t))];
    else if (x.dataset.c) R.cards = x.checked ? R.cards.filter((t) => t !== x.dataset.c) : [...new Set(R.cards.concat(x.dataset.c))];
    else if (x.dataset.h) R.heroes = x.checked ? R.heroes.filter((t) => t !== x.dataset.h) : [...new Set(R.heroes.concat(x.dataset.h))];
    else return;
    save(); draw();
  }
  root.WA_DRAFT_EDITOR = { render };
})(typeof window !== "undefined" ? window : globalThis);
