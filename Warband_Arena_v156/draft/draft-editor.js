// v147 Studio › Draft: draft types (like the adventures: as many as you like, each with its name), and for each one the number
// of boosters, the cards taken at each pick, each slot of the booster (its size is the number of slots), and what can come in
// the boosters (tribes, minions, heroes, spells). The full card shows while the mouse is over a name.
(function (root) {
  "use strict";
  let api = null, host = null, data = null, sel = "", open = new Set(), saveT = 0, hcEl = null, tab = "settings";
  const W = () => root.WA, Dm = () => root.WA_DRAFT;
  const fr = () => !!(root.WA_I18N && root.WA_I18N.lang === "fr");
  const L = (en, f) => (fr() ? f : en);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const thumb = (id, spell) => { try { return `<span class="ae-th">${spell ? root.WA_ART.spellArt(id) : root.WA_ART.art(id)}</span>`; } catch (e) { return `<span class="ae-th"></span>`; } };
  const heroPic = (id) => { const r = api.ST && api.ST.IMAGES && api.ST.IMAGES["hero:" + id]; return r ? r.card : ""; };
  const heroThumb = (id) => { const u = heroPic(id), h = W().HEROES[id]; return `<span class="ae-th ae-hth"${u ? ` style="background-image:url('${esc(u)}')"` : ""}>${u ? "" : esc(((h && h.name) || "?")[0])}</span>`; };
  const type = () => data.types.find((t) => t.id === sel) || data.types[0];
  function save() { clearTimeout(saveT); saveT = setTimeout(async () => { await Dm().save(data); if (api.status) api.status(L("Draft saved.", "Draft enregistré.")); }, 250); }

  // ---------------------------------------------------------------- the full card on hover (as in the Adventure editor)
  function heroCardHTML(id) {
    const w = W(), h = w.HEROES[id]; if (!h) return "";
    const u = heroPic(id), txt = String((w.heroPowerText && w.heroPowerText(id)) || "").replace(/\*\*|\[[a-z#0-9]+\]|\[\/\]/gi, "");
    return `<div class="ae-herocard"><div class="ae-hc-port"${u ? ` style="background-image:url('${esc(u)}')"` : ""}>${u ? "" : esc(h.name[0])}</div><b>${esc(h.name)}</b><div class="ae-hc-pow"><em>${esc(h.power.name)}</em>${h.power.type === "passive" ? `<small>${L("passive", "passif")}</small>` : `<small>${h.power.cost != null ? h.power.cost : ""} ${L("gold", "or")}</small>`}<p>${esc(txt)}</p></div></div>`;
  }
  function hidePrev() { const o = document.querySelector(".ae-hovercard"); if (o) o.remove(); }
  function showPrev(key, anchor) {
    const w = W(), i = key.indexOf(":"), kind = key.slice(0, i), id = key.slice(i + 1); let c = null;
    const box = document.createElement("div"); box.className = "ae-hovercard";
    if (kind === "h") { if (!w.HEROES[id]) return; box.innerHTML = heroCardHTML(id); }
    else if (kind === "b") { const [bid, k] = id.split("/"), bd = type().campaign.find((y) => y.id === bid), m = bd && Dm().boardMinions(bd)[+k]; if (!m) return; try { c = api.helpers.makeCard(m.dict()); } catch (e) { return; } box.appendChild(c); }
    else { try { c = api.helpers.makeCard(kind === "s" ? new w.Spell(id).dict() : new w.Minion(id).dict()); } catch (e) { return; } box.appendChild(c); }
    document.body.appendChild(box);
    const r = anchor.getBoundingClientRect(), bw = 180, bh = 255, left = r.right + 14 + bw < innerWidth ? r.right + 14 : Math.max(8, r.left - bw - 14);
    box.style.left = left + "px"; box.style.top = Math.max(8, Math.min(innerHeight - bh - 8, r.top + r.height / 2 - bh / 2)) + "px";
    if (root.WA_FIT_CARDS) requestAnimationFrame(() => root.WA_FIT_CARDS(box));
  }
  function onOver(e) { const x = e.target.closest && e.target.closest("[data-hc]"); if (x === hcEl) return; hcEl = x; hidePrev(); if (x && host.contains(x)) showPrev(x.dataset.hc, x); }

  function render(h, a) {
    // v154 its own box inside the Studio's (the Studio's box is the card editor's form: nothing of the Draft tab may stay on it)
    h.classList.remove("dre-root"); h.innerHTML = ""; const box = document.createElement("div"); box.className = "dre-root"; h.appendChild(box);
    host = box; api = a; data = Dm().load(); if (!data.types.some((t) => t.id === sel)) sel = data.types[0].id;
    host.onclick = onClick; host.onchange = onChange; host.oninput = onInput; host.onmouseover = onOver; host.onmouseleave = () => { hcEl = null; hidePrev(); };
    draw();
  }
  function pool() {
    const w = W(), ok = (id) => { const d = w.CARDS[id]; return d && d.inPool !== false && !d.retired && !d.affOnly && !(w.EVO_T && w.EVO_T.has(id)); };
    const ids = Object.keys(w.CARDS).filter(ok).sort((x, y) => (w.CARDS[y].tier || 1) - (w.CARDS[x].tier || 1) || w.CARDS[x].name.localeCompare(w.CARDS[y].name));
    const groups = {}; for (const id of ids) { const d = w.CARDS[id], t = d.allTribes ? "*all" : (w.tribesOf(d).filter(Boolean)[0] || "*neutral"); (groups[t] = groups[t] || []).push(id); }
    return groups;
  }
  const KN = () => ({ unique: L("Unique card of a tribe", "Carte Unique d'une tribu"), neutral: L("Neutral minion", "Serviteur neutre"), mage: L("Mage (Unique neutral of tier 5)", "Mage (Unique neutre de tier 5)"), hero: L("Hero (a tribe's 1 in 3)", "Héros (de tribu 1 fois sur 3)"), tribeHero: L("A tribe's hero", "Héros de tribu"), anyHero: L("Any hero", "N'importe quel héros"), spell: L("Tavern spell", "Sort de taverne"), tier: L("Minion of a tribe, of tier…", "Serviteur d'une tribu, de tier…"), anyTier: L("Any minion of tier…", "N'importe quel serviteur de tier…") });
  function slotsHTML(t) {
    const w = W(), K = KN(), tribes = w.availableTribes();
    // one kind of card: its selects (part "" = the slot, part "or" = its other possibility)
    const part = (s, i, pt) => { const needTier = s.k === "tier" || s.k === "anyTier", optTier = s.k === "neutral" || s.k === "spell", tribeOk = s.k === "tier" || s.k === "unique" || s.k === "tribeHero", a = `data-slot="${i}" data-part="${pt}"`;
      return `<select ${a} data-sf="k">${Dm().KINDS.map((k) => `<option value="${k}"${s.k === k ? " selected" : ""}>${esc(K[k])}</option>`).join("")}</select>
        ${needTier || optTier ? `<select ${a} data-sf="tier">${optTier ? `<option value="0"${!s.tier ? " selected" : ""}>${L("any tier", "tout tier")}</option>` : ""}${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}"${s.tier === n && !s.up ? " selected" : ""}>Tier ${n}</option>`).join("")}${[1, 2, 3, 4, 5].map((n) => `<option value="${n}+"${s.tier === n && s.up ? " selected" : ""}>${L(`Tier ${n} and above`, `Niveau ${n} et plus`)}</option>`).join("")}</select>` : ""}
        ${tribeOk ? `<select ${a} data-sf="tribe"><option value="">${L("random tribe", "tribu au hasard")}</option>${tribes.map((tr) => `<option value="${esc(tr)}"${s.tribe === tr ? " selected" : ""}>${esc(w.tribeName(tr))}</option>`).join("")}</select>` : ""}`; };
    // v149 "or": the slot gives this card or another one, with these chances
    const orSel = (s, i) => `<select data-slot="${i}" data-sf="or" class="dre-or"><option value="">${L("only", "seul")}</option>${Dm().PCTS.map((p) => `<option value="${p}"${s.or && s.pct === p ? " selected" : ""}>${L("or", "ou")} ${p}/${100 - p} %</option>`).join("")}</select>`;
    const row = (s, i) => `<div class="dre-slot${s.or ? " has-or" : ""}"><b>${i + 1}</b><div class="dre-parts"><div class="dre-part">${part(s, i, "")}${orSel(s, i)}</div>${s.or ? `<div class="dre-part dre-alt"><em>${L("or", "ou")}</em>${part(s.or, i, "or")}</div>` : ""}</div>
        <span class="dre-sbtn"><button type="button" class="ce-mini" data-act="slotUp" data-i="${i}"${i ? "" : " disabled"}>▲</button><button type="button" class="ce-mini del" data-act="slotRm" data-i="${i}"${t.slots.length > 1 ? "" : " disabled"}>✕</button></span></div>`;
    return `<div class="dre-slots">${t.slots.map(row).join("")}</div>${t.slots.length < 15 ? `<button type="button" class="pill small" data-act="slotAdd">+ ${L("Add a slot", "Ajouter un emplacement")}</button>` : ""}`;
  }
  function restrictHTML(t) {
    const w = W(), R = t.restrict, G = pool(), outT = new Set(R.tribes), outC = new Set(R.cards), outH = new Set(R.heroes), outS = new Set(R.spells);
    const gname = (g) => (g === "*all" ? L("All tribes", "Toutes tribus") : g === "*neutral" ? L("Neutral", "Neutres") : w.tribeName(g));
    const order = [...w.availableTribes().filter((tr) => G[tr]), "*neutral", "*all"].filter((g) => G[g]);
    const grp = (g) => { const l = G[g], tribe = g[0] !== "*", off = tribe && outT.has(g), kept = l.filter((id) => !outC.has(id)).length;
      return `<div class="ae-grp${off ? " off" : ""}"><div class="ae-ghead">${tribe ? `<label class="ae-tog"><input type="checkbox" data-t="${esc(g)}" ${off ? "" : "checked"}><b>${esc(gname(g))}</b></label>` : `<b>${esc(gname(g))}</b>`}
        <small>${off ? L("left out", "retirée") : `${kept}/${l.length}`}</small><button type="button" class="ce-mini" data-act="all" data-g="${esc(g)}">${L("all", "tout")}</button><button type="button" class="ce-mini" data-act="none" data-g="${esc(g)}">${L("none", "rien")}</button><button type="button" class="ce-mini" data-act="grp" data-g="${esc(g)}">${open.has(g) ? "▾" : "▸"}</button></div>
        ${open.has(g) ? `<div class="ae-items">${l.map((id) => `<label class="ae-it" data-hc="m:${esc(id)}"><input type="checkbox" data-c="${esc(id)}" ${outC.has(id) ? "" : "checked"}>${thumb(id)}<span><i>T${w.CARDS[id].tier}</i> ${esc(w.CARDS[id].name)}${w.CARDS[id].unique ? " ✦" : ""}</span></label>`).join("")}</div>` : ""}</div>`; };
    const heroes = w.HERO_LIST.filter((h) => w.HEROES[h] && !w.HEROES[h].off);
    const spells = Object.keys(w.SPELLS).filter((id) => w.SPELLS[id].inPool !== false && !w.SPELLS[id].advOnly).sort((a, b) => (w.SPELLS[a].tier || 1) - (w.SPELLS[b].tier || 1));
    return `<div class="ce-sec"><h4>${L("Minions", "Serviteurs")}</h4>${order.map(grp).join("")}</div>
      <div class="ce-sec"><div class="ae-grp"><div class="ae-ghead"><b>${L("Heroes", "Héros")}</b><small>${heroes.filter((h) => !outH.has(h)).length}/${heroes.length}</small><button type="button" class="ce-mini" data-act="grp" data-g="*heroes">${open.has("*heroes") ? "▾" : "▸"}</button></div>
        ${open.has("*heroes") ? `<div class="ae-items">${heroes.map((h) => `<label class="ae-it" data-hc="h:${esc(h)}"><input type="checkbox" data-h="${esc(h)}" ${outH.has(h) ? "" : "checked"}>${heroThumb(h)}<span>${esc(w.HEROES[h].name)}${(w.HEROES[h].needTribes || []).length ? ` <small>(${esc(w.HEROES[h].needTribes.map((x) => w.tribeName(x)).join("/"))})</small>` : ""}</span></label>`).join("")}</div>` : ""}</div>
      <div class="ae-grp"><div class="ae-ghead"><b>${L("Spells", "Sorts")}</b><small>${spells.filter((s) => !outS.has(s)).length}/${spells.length} · ${L("only for Spell slots", "seulement pour les emplacements Sort")}</small><button type="button" class="ce-mini" data-act="grp" data-g="*spells">${open.has("*spells") ? "▾" : "▸"}</button></div>
        ${open.has("*spells") ? `<div class="ae-items">${spells.map((s) => `<label class="ae-it" data-hc="s:${esc(s)}"><input type="checkbox" data-s="${esc(s)}" ${outS.has(s) ? "" : "checked"}>${thumb(s, true)}<span><i>T${w.SPELLS[s].tier || 1}</i> ${esc(w.SPELLS[s].name)}</span></label>`).join("")}</div>` : ""}</div></div>`;
  }
  // v148 the boards that won this draft: the campaign's opponents (untick one to leave it out; ✕ deletes it)
  function boardsHTML(t) {
    const w = W();
    if (!t.campaign.length) return `<div class="ce-sec"><p class="ce-hint">${L("No winning board yet: win this draft's tournament and your board shows up here, ready for its Draft campaign.", "Aucun board vainqueur pour l'instant : gagne le tournoi de ce draft et ton board apparaît ici, prêt pour son Draft campagne.")}</p></div>`;
    const date = (n) => { try { return new Date(n).toLocaleDateString(fr() ? "fr-FR" : "en-GB"); } catch (e) { return ""; } };
    const row = (b) => { let mins = []; try { mins = Dm().boardMinions(b); } catch (e) {}
      const nc = b.nc ? [b.nc.a || b.nc.h ? `+${b.nc.a || 0}/+${b.nc.h || 0}` : "", (b.nc.strikes || []).length ? `${b.nc.strikes.length} ${L("strike(s)", "frappe(s)")}` : "", (b.nc.burns || []).length ? `${b.nc.burns.length} ${L("Burn", "Brûlure")}` : "", (b.nc.sums || []).length ? `${b.nc.sums.length} ${L("summon(s)", "invocation(s)")}` : ""].filter(Boolean).join(" · ") : "";
      return `<div class="dre-brow${b.off ? " off" : ""}"><div class="dre-bhead"><label class="ae-tog" title="${esc(L("In the campaign", "Dans la campagne"))}"><input type="checkbox" data-bon="${esc(b.id)}"${b.off ? "" : " checked"}></label><input type="text" class="dre-bname" data-bname="${esc(b.id)}" value="${esc(b.name || "")}" maxlength="40" placeholder="${esc(L("Name", "Nom"))}" title="${esc(L("Rename this board", "Renommer ce board"))}">
        <small>${b.titles ? `♛ ${b.titles} · ` : ""}${esc(date(b.date))}${b.off ? " · " + L("not in the campaign", "hors campagne") : ""}${nc ? ` · ${L("next combat", "prochain combat")}: ${esc(nc)}` : ""}</small><button type="button" class="ce-mini del" data-act="bdel" data-id="${esc(b.id)}">✕ ${L("Delete", "Supprimer")}</button></div>
        <div class="dre-bmins">${b.hero && w.HEROES[b.hero] ? `<span class="dre-bhero" data-hc="h:${esc(b.hero)}">${heroThumb(b.hero)}</span>` : ""}${mins.map((m, k) => { let html = ""; try { html = api.helpers.makeCard(m.dict()).outerHTML; } catch (e) {} return `<span class="dre-bmin" data-hc="b:${esc(b.id)}/${k}">${html}</span>`; }).join("")}</div></div>`; };
    return `<div class="ce-sec"><p class="ce-hint">${L("The boards that won this draft: they are the opponents of its Draft campaign. Untick one to keep it out of the campaign; the full card shows on hover.", "Les boards qui ont gagné ce draft : ce sont les adversaires de son Draft campagne. Décoche-en un pour le sortir de la campagne ; la carte entière s'affiche au survol.")}</p><div class="dre-boards">${t.campaign.map(row).join("")}</div></div>`;
  }
  // v152 the winning boards against each other: n tournaments, then the results and the stats
  let sim = null, simN = 10, simOff = false, simRes = null, simType = "";
  const pct = (x) => Math.round(x * 100) + " %", n1 = (x) => (Math.round(x * 10) / 10).toLocaleString(fr() ? "fr-FR" : "en-GB");
  function simHTML(t) {
    const w = W(), list = t.campaign.filter((b) => simOff || !b.off), running = !!sim && !sim._over;
    const head = `<div class="ce-sec dre-sim"><p class="ce-hint">${L("Every winning board of this draft meets every other one once per tournament (a win 1 point, a draw ½). Choose how many tournaments to play; the more, the surer the result.", "Chaque board gagnant de ce draft affronte chacun des autres une fois par tournoi (une victoire 1 point, une égalité ½). Choisis combien de tournois jouer ; plus il y en a, plus le résultat est sûr.")}</p>
      <div class="dre-simctl"><label>${L("Tournaments", "Tournois")} <select data-k="simN">${[1, 5, 10, 25, 50, 100, 250].map((n) => `<option value="${n}"${simN === n ? " selected" : ""}>${n}</option>`).join("")}</select></label>
        <label class="dre-chk"><input type="checkbox" data-k="simOff"${simOff ? " checked" : ""}> ${L("Also the boards left out of the campaign", "Aussi les boards sortis de la campagne")}</label>
        ${running ? `<button type="button" class="pill" data-act="simStop">${L("Stop", "Arrêter")}</button>` : `<button type="button" class="pill big" data-act="simGo"${list.length < 2 ? " disabled" : ""}>${L("Run the test", "Lancer le test")} · ${list.length} boards</button>`}
        <span class="dre-simprog">${running ? `${L("Fight", "Combat")} ${sim.done} / ${sim.total}` : list.length < 2 ? L("2 winning boards needed.", "Il faut 2 boards vainqueurs.") : ""}</span></div></div>`;
    if (!simRes || simType !== t.id) return head;
    const r = simRes, nm = (id) => esc((w.CARDS[id] || w.TOKENS[id] || {}).name || id);
    const imp = (m) => (m.impact == null ? "—" : `${m.impact >= 0 ? "+" : ""}${Math.round(m.impact * 100)} pts`);
    const mrow = (m) => `<tr><td><span class="dre-hc" data-hc="m:${esc(m.id)}">${nm(m.id)}</span></td><td>${m.boards}</td><td>${m.fights}</td><td>${pct(m.rate)}</td><td>${pct(m.alive)}</td><td>${n1(m.dmg)}</td><td>${n1(m.eff)}</td><td>${n1(m.kills)}</td><td>${n1(m.given)}</td><td class="${m.impact > 0.05 ? "hi" : m.impact < -0.02 ? "lo" : ""}"><b>${imp(m)}</b></td></tr>`;
    const mth = `<tr><th>${L("Minion", "Serviteur")}</th><th>Boards</th><th>${L("Fights", "Combats")}</th><th>${L("Win %", "% victoires")}</th><th>${L("Alive at the end", "En vie à la fin")}</th><th>${L("Attack damage / fight", "Dégâts d'attaque / combat")}</th><th>${L("Effect damage / fight", "Dégâts d'effets / combat")}</th><th>${L("Kills / fight", "Kills / combat")}</th><th>${L("Stats given / fight", "Stats données / combat")}</th><th>Impact</th></tr>`;
    const B = r.boards, vs = (a, b) => { const x = a.vs[b.i], g = x.w + x.d + x.l; return g ? Math.round(((x.w + x.d / 2) / g) * 100) : null; };
    return head + `<div class="ce-sec dre-simres">
      <h4>${L("Result", "Résultat")} <small>${r.tournaments} ${L("tournaments", "tournois")} · ${r.fights} ${L("fights", "combats")} · ${L("draws", "égalités")} ${pct(r.draws)} · ${n1(r.attacks)} ${L("attacks a fight", "attaques par combat")}</small></h4>
      <table class="dr-table"><thead><tr><th>#</th><th>Board</th><th>${L("Hero", "Héros")}</th><th>${L("Tournaments won", "Tournois gagnés")}</th><th>${L("W", "V")}</th><th>${L("D", "N")}</th><th>${L("L", "D")}</th><th>${L("Win %", "% victoires")}</th><th>${L("Damage when it wins", "Dégâts quand il gagne")}</th><th>${L("Minions left when it wins", "Serviteurs restants quand il gagne")}</th></tr></thead>
        <tbody>${B.map((b, i) => `<tr class="${i === 0 ? "top" : ""}"><td>${i + 1}</td><td><b>${esc(b.name)}</b></td><td>${b.hero && w.HEROES[b.hero] ? `<span class="dre-hc" data-hc="h:${esc(b.hero)}">${esc(w.HEROES[b.hero].name)}</span>` : "—"}</td><td>${n1(b.titles)}</td><td>${b.w}</td><td>${b.d}</td><td>${b.l}</td><td><b>${pct(b.rate)}</b></td><td>${n1(b.avgDmg)}</td><td>${n1(b.avgSurv)}</td></tr>`).join("")}</tbody></table>
      ${B.length <= 12 ? `<h4>${L("Head to head", "Face à face")} <small>${L("win % of the line's board against the column's", "% de victoires du board de la ligne contre celui de la colonne")}</small></h4>
      <table class="dr-table dre-vs"><thead><tr><th></th>${B.map((b) => `<th>${esc(b.name)}</th>`).join("")}</tr></thead><tbody>${B.map((a) => `<tr><td><b>${esc(a.name)}</b></td>${B.map((b) => { const v = a === b ? null : vs(a, b); return `<td class="${v == null ? "x" : v >= 60 ? "hi" : v <= 40 ? "lo" : ""}">${v == null ? "" : v + " %"}</td>`; }).join("")}</tr>`).join("")}</tbody></table>` : ""}
      <h4>${L("The most impactful minions", "Les serviteurs les plus impactants")} <small>${L("impact = the win % its board loses when it is taken out (every effect counts: Start of Combat, auras, doubled effects, Wildfire…)", "impact = le % de victoires que perd son board quand on le retire (tout compte : début de combat, auras, effets doublés, Embrasement…)")}</small></h4>
      <table class="dr-table">${mth}${r.top.map(mrow).join("")}</table>
      <h4>${L("The least impactful minions", "Les serviteurs les moins impactants")}</h4>
      <table class="dr-table">${mth}${r.bottom.map(mrow).join("")}</table>
      ${r.heroes.length ? `<h4>${L("Heroes", "Héros")}</h4><table class="dr-table"><tr><th>${L("Hero", "Héros")}</th><th>${L("Fights", "Combats")}</th><th>${L("Win %", "% victoires")}</th></tr>${r.heroes.map((h) => `<tr><td><span class="dre-hc" data-hc="h:${esc(h.id)}">${esc(h.name)}</span></td><td>${h.fights}</td><td>${pct(h.rate)}</td></tr>`).join("")}</table>` : ""}
      <details class="dre-allm"><summary>${L("Every minion", "Tous les serviteurs")} (${r.minions.length})</summary><table class="dr-table">${mth}${r.minions.map(mrow).join("")}</table></details>
    </div>`;
  }
  function simRun(t) {
    const list = t.campaign.filter((b) => simOff || !b.off); if (list.length < 2) return;
    sim = Dm().simStart(list, simN); simType = t.id; simRes = null; draw();
    const tick = () => { if (!sim) return; const over = sim.step(40); const pr = host.querySelector(".dre-simprog"); if (pr) pr.textContent = `${L("Fight", "Combat")} ${sim.done} / ${sim.total}`;
      if (over) { sim._over = true; simRes = Dm().simReport(sim, 2); draw(); } else setTimeout(tick, 0); };
    setTimeout(tick, 0);
  }
  // v153 the draft's settings, in their own tab
  function settingsHTML(t) {
    const w = W(), sets = Dm().cardSets(t.restrict);
    return `<div class="ce-sec dre-set dre-settings">
        <label>${L("Boosters per player", "Boosters par joueur")} <select data-k="packs">${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}"${t.packs === n ? " selected" : ""}>${n}</option>`).join("")}</select></label>
        <label>${L("Cards per pick", "Cartes par choix")} <select data-k="pick">${[1, 2, 3].map((n) => `<option value="${n}"${t.pick === n ? " selected" : ""}>${n}</option>`).join("")}</select></label>
        <label>${L("Copies to make a golden one", "Exemplaires pour un doré")} <select data-k="tripleN"><option value="2"${t.tripleN !== 3 ? " selected" : ""}>2 (Draft)</option><option value="3"${t.tripleN === 3 ? " selected" : ""}>3 (${L("as in a normal game", "comme en partie normale")})</option></select></label>
        <span class="ce-hint">${L(`Boosters of ${t.slots.length} cards: ${t.packs * Math.ceil(t.slots.length / t.pick)} picks, ${t.packs * t.slots.length} cards each.`, `Boosters de ${t.slots.length} cartes : ${t.packs * Math.ceil(t.slots.length / t.pick)} choix, ${t.packs * t.slots.length} cartes chacun.`)} ${L("Mages:", "Mages :")} ${sets.mages.map((id) => `<span data-hc="m:${esc(id)}" class="dre-hc">${esc(w.CARDS[id].name)}</span>`).join(", ") || "—"}.</span>
        <label class="dre-chk"><input type="checkbox" data-k="triple"${t.triple ? " checked" : ""}> ${L("Triple reward when a golden card is played (tavern phase)", "Récompense de triple quand une carte dorée est jouée (phase de taverne)")}</label>
      </div>`;
  }
  function draw() {
    const t = type(), w = W();
    hidePrev(); hcEl = null; if (root.WA_FIT_CARDS) setTimeout(() => root.WA_FIT_CARDS(host), 30); // v150 the rules text fits the cards
    const sets = Dm().cardSets(t.restrict);
    host.innerHTML = `<div class="st-head"><h3>Draft</h3><p class="ce-hint">${L("Draft types, like the adventures: when a player starts a Draft (or the Draft campaign), they choose one by its name. 5 players (you and 4 bots) open the boosters and take cards in turn; then each one plays their cards on the table and a tournament is played.", "Des types de draft, comme les aventures : en lançant un Draft (ou le Draft campagne), le joueur en choisit un par son nom. 5 joueurs (toi et 4 IA) ouvrent les boosters et prennent des cartes à tour de rôle ; puis chacun joue ses cartes sur la table et un tournoi se joue.")}</p></div>
      <div class="dre-wrap"><aside class="dre-types">${data.types.map((x) => `<button type="button" class="dre-type${x.id === t.id ? " on" : ""}" data-act="sel" data-id="${esc(x.id)}"><b>${esc(x.name)}</b><small>${x.packs} × ${x.slots.length} · ${x.campaign.length} ${x.campaign.length > 1 ? L("winning boards", "boards vainqueurs") : L("winning board", "board vainqueur")}</small></button>`).join("")}
        <button type="button" class="pill small" data-act="new">+ ${L("New draft", "Nouveau draft")}</button></aside>
      <div class="dre-main"><div class="ce-sec dre-set">
        <label>${L("Name", "Nom")} <input type="text" data-k="name" value="${esc(t.name)}" maxlength="40"></label>
        ${data.types.length > 1 ? `<button type="button" class="ce-mini del" data-act="del">${L("Delete this draft", "Supprimer ce draft")}</button>` : ""}</div>
        <nav class="ae-tabs"><button type="button" class="ae-tab${tab === "settings" ? " on" : ""}" data-act="tab" data-tab="settings">${L("Draft settings", "Réglages du draft")}</button><button type="button" class="ae-tab${tab === "booster" ? " on" : ""}" data-act="tab" data-tab="booster">${L("Booster slots", "Emplacements du booster")}</button><button type="button" class="ae-tab${tab === "restrict" ? " on" : ""}" data-act="tab" data-tab="restrict">${L("Cards in the boosters", "Cartes dans les boosters")}</button><button type="button" class="ae-tab${tab === "boards" ? " on" : ""}" data-act="tab" data-tab="boards">${L("Winning boards", "Boards vainqueurs")} <small>${t.campaign.length}</small></button><button type="button" class="ae-tab${tab === "sim" ? " on" : ""}" data-act="tab" data-tab="sim">${L("Board test", "Test des boards")}</button></nav>
        ${tab === "booster" ? `<div class="ce-sec"><p class="ce-hint">${L("Each line is one card of the booster, in this order; the booster has as many cards as lines (15 at most).", "Chaque ligne est une carte du booster, dans cet ordre ; le booster a autant de cartes que de lignes (15 au plus).")}</p>${slotsHTML(t)}</div>` : tab === "settings" ? settingsHTML(t) : tab === "boards" ? boardsHTML(t) : tab === "sim" ? simHTML(t) : restrictHTML(t)}
      </div></div>`;
  }
  function onClick(e) {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const t = type(), act = b.dataset.act, R = t.restrict;
    if (act === "sel") { sel = b.dataset.id; draw(); return; }
    if (act === "tab") { tab = b.dataset.tab; draw(); return; }
    if (act === "simGo") { simRun(t); return; }
    if (act === "simStop") { if (sim) { sim.stop = true; } return; }
    if (act === "new") { const n = Dm().normType({ name: L("Draft ", "Draft ") + (data.types.length + 1) }); data.types.push(n); sel = n.id; save(); draw(); return; }
    if (act === "del") { if (!confirm(L(`Delete the draft "${t.name}" and its winning boards?`, `Supprimer le draft « ${t.name} » et ses boards vainqueurs ?`))) return; data.types = data.types.filter((x) => x !== t); sel = data.types[0].id; save(); draw(); return; }
    if (act === "bdel") { const bd = t.campaign.find((y) => y.id === b.dataset.id); if (!bd || !confirm(L(`Delete the board of ${bd.name || "?"} from this draft's campaign? It can't be undone.`, `Supprimer le board de ${bd.name || "?"} de la campagne de ce draft ? C'est définitif.`))) return; t.campaign = t.campaign.filter((y) => y !== bd); save(); draw(); return; }
    if (act === "slotAdd") { t.slots.push(Dm().normSlot({ k: "tier", tier: 3 })); save(); draw(); return; }
    if (act === "slotRm") { t.slots.splice(+b.dataset.i, 1); save(); draw(); return; }
    if (act === "slotUp") { const i = +b.dataset.i; [t.slots[i - 1], t.slots[i]] = [t.slots[i], t.slots[i - 1]]; save(); draw(); return; }
    const g = b.dataset.g, ids = pool()[g] || [];
    if (act === "grp") { open.has(g) ? open.delete(g) : open.add(g); draw(); return; }
    if (act === "all") { R.cards = R.cards.filter((x) => !ids.includes(x)); if (g[0] !== "*") R.tribes = R.tribes.filter((x) => x !== g); }
    if (act === "none") R.cards = [...new Set(R.cards.concat(ids))];
    save(); draw();
  }
  function onInput(e) { const x = e.target;
    if (x.dataset.bname) { const b = type().campaign.find((y) => y.id === x.dataset.bname); if (b) { b.name = x.value.slice(0, 40); save(); } return; } // v150 rename a winning board
    if (x.dataset.k === "name") { type().name = x.value.slice(0, 40) || "Draft"; save(); const b = host.querySelector(".dre-type.on b"); if (b) b.textContent = type().name; } }
  function onChange(e) {
    const x = e.target, t = type(), R = t.restrict;
    if (x.dataset.k === "packs") t.packs = +x.value;
    else if (x.dataset.k === "pick") t.pick = +x.value;
    else if (x.dataset.k === "triple") t.triple = x.checked;
    else if (x.dataset.k === "tripleN") t.tripleN = +x.value === 3 ? 3 : 2;
    else if (x.dataset.k === "simN") { simN = +x.value; return; }
    else if (x.dataset.k === "simOff") { simOff = x.checked; draw(); return; }
    else if (x.dataset.bon != null) { const b = t.campaign.find((y) => y.id === x.dataset.bon); if (b) b.off = !x.checked; }
    else if (x.dataset.k === "name" || x.dataset.bname) return;
    else if (x.dataset.slot != null) {
      const top = t.slots[+x.dataset.slot];
      if (x.dataset.sf === "or") { if (!x.value) { delete top.or; delete top.pct; } else { if (!top.or) top.or = { k: top.k === "spell" ? "hero" : "spell" }; top.pct = +x.value; } }
      else { const s = x.dataset.part === "or" && top.or ? top.or : top; if (x.dataset.sf === "k") { s.k = x.value; if ((s.k === "tier" || s.k === "anyTier") && !s.tier) s.tier = 3; } else if (x.dataset.sf === "tier") { s.tier = parseInt(x.value, 10) || 0; s.up = /\+$/.test(x.value); } else s.tribe = x.value; }
      t.slots[+x.dataset.slot] = Dm().normSlot(top);
    }
    else if (x.dataset.t) R.tribes = x.checked ? R.tribes.filter((v) => v !== x.dataset.t) : [...new Set(R.tribes.concat(x.dataset.t))];
    else if (x.dataset.c) R.cards = x.checked ? R.cards.filter((v) => v !== x.dataset.c) : [...new Set(R.cards.concat(x.dataset.c))];
    else if (x.dataset.h) R.heroes = x.checked ? R.heroes.filter((v) => v !== x.dataset.h) : [...new Set(R.heroes.concat(x.dataset.h))];
    else if (x.dataset.s) R.spells = x.checked ? R.spells.filter((v) => v !== x.dataset.s) : [...new Set(R.spells.concat(x.dataset.s))];
    else return;
    save(); draw();
  }
  root.WA_DRAFT_EDITOR = { render };
})(typeof window !== "undefined" ? window : globalThis);
