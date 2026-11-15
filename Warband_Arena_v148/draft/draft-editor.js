// v147 Studio › Draft: draft types (like the adventures: as many as you like, each with its name), and for each one the number
// of boosters, the cards taken at each pick, each slot of the booster (its size is the number of slots), and what can come in
// the boosters (tribes, minions, heroes, spells). The full card shows while the mouse is over a name.
(function (root) {
  "use strict";
  let api = null, host = null, data = null, sel = "", open = new Set(), saveT = 0, hcEl = null, tab = "booster";
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
    host = h; api = a; host.classList.add("dre-root"); data = Dm().load(); if (!data.types.some((t) => t.id === sel)) sel = data.types[0].id;
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
    const row = (s, i) => { const needTier = s.k === "tier" || s.k === "anyTier", optTier = s.k === "neutral" || s.k === "spell", tribeOk = s.k === "tier" || s.k === "unique" || s.k === "tribeHero";
      return `<div class="dre-slot"><b>${i + 1}</b><select data-slot="${i}" data-sf="k">${Dm().KINDS.map((k) => `<option value="${k}"${s.k === k ? " selected" : ""}>${esc(K[k])}</option>`).join("")}</select>
        ${needTier || optTier ? `<select data-slot="${i}" data-sf="tier">${optTier ? `<option value="0"${!s.tier ? " selected" : ""}>${L("any tier", "tout tier")}</option>` : ""}${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}"${s.tier === n && !s.up ? " selected" : ""}>Tier ${n}</option>`).join("")}${[1, 2, 3, 4, 5].map((n) => `<option value="${n}+"${s.tier === n && s.up ? " selected" : ""}>${L(`Tier ${n} and above`, `Niveau ${n} et plus`)}</option>`).join("")}</select>` : ""}
        ${tribeOk ? `<select data-slot="${i}" data-sf="tribe"><option value="">${L("random tribe", "tribu au hasard")}</option>${tribes.map((tr) => `<option value="${esc(tr)}"${s.tribe === tr ? " selected" : ""}>${esc(w.tribeName(tr))}</option>`).join("")}</select>` : ""}
        <span class="dre-sbtn"><button type="button" class="ce-mini" data-act="slotUp" data-i="${i}"${i ? "" : " disabled"}>▲</button><button type="button" class="ce-mini del" data-act="slotRm" data-i="${i}"${t.slots.length > 1 ? "" : " disabled"}>✕</button></span></div>`; };
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
      return `<div class="dre-brow${b.off ? " off" : ""}"><div class="dre-bhead"><label class="ae-tog"><input type="checkbox" data-bon="${esc(b.id)}"${b.off ? "" : " checked"}><b>${esc(b.name || "?")}</b></label>
        <small>${b.titles ? `♛ ${b.titles} · ` : ""}${esc(date(b.date))}${b.off ? " · " + L("not in the campaign", "hors campagne") : ""}${nc ? ` · ${L("next combat", "prochain combat")}: ${esc(nc)}` : ""}</small><button type="button" class="ce-mini del" data-act="bdel" data-id="${esc(b.id)}">✕ ${L("Delete", "Supprimer")}</button></div>
        <div class="dre-bmins">${b.hero && w.HEROES[b.hero] ? `<span class="dre-bhero" data-hc="h:${esc(b.hero)}">${heroThumb(b.hero)}</span>` : ""}${mins.map((m, k) => { let html = ""; try { html = api.helpers.makeCard(m.dict()).outerHTML; } catch (e) {} return `<span class="dre-bmin" data-hc="b:${esc(b.id)}/${k}">${html}</span>`; }).join("")}</div></div>`; };
    return `<div class="ce-sec"><p class="ce-hint">${L("The boards that won this draft: they are the opponents of its Draft campaign. Untick one to keep it out of the campaign; the full card shows on hover.", "Les boards qui ont gagné ce draft : ce sont les adversaires de son Draft campagne. Décoche-en un pour le sortir de la campagne ; la carte entière s'affiche au survol.")}</p><div class="dre-boards">${t.campaign.map(row).join("")}</div></div>`;
  }
  function draw() {
    const t = type(), w = W();
    hidePrev(); hcEl = null;
    const sets = Dm().cardSets(t.restrict);
    host.innerHTML = `<div class="st-head"><h3>Draft</h3><p class="ce-hint">${L("Draft types, like the adventures: when a player starts a Draft (or the Draft campaign), they choose one by its name. 5 players (you and 4 bots) open the boosters and take cards in turn; then each one plays their cards on the table and a tournament is played.", "Des types de draft, comme les aventures : en lançant un Draft (ou le Draft campagne), le joueur en choisit un par son nom. 5 joueurs (toi et 4 IA) ouvrent les boosters et prennent des cartes à tour de rôle ; puis chacun joue ses cartes sur la table et un tournoi se joue.")}</p></div>
      <div class="dre-wrap"><aside class="dre-types">${data.types.map((x) => `<button type="button" class="dre-type${x.id === t.id ? " on" : ""}" data-act="sel" data-id="${esc(x.id)}"><b>${esc(x.name)}</b><small>${x.packs} × ${x.slots.length} · ${x.campaign.length} ${x.campaign.length > 1 ? L("winning boards", "boards vainqueurs") : L("winning board", "board vainqueur")}</small></button>`).join("")}
        <button type="button" class="pill small" data-act="new">+ ${L("New draft", "Nouveau draft")}</button></aside>
      <div class="dre-main"><div class="ce-sec dre-set">
        <label>${L("Name", "Nom")} <input type="text" data-k="name" value="${esc(t.name)}" maxlength="40"></label>
        <label>${L("Boosters per player", "Boosters par joueur")} <select data-k="packs">${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}"${t.packs === n ? " selected" : ""}>${n}</option>`).join("")}</select></label>
        <label>${L("Cards per pick", "Cartes par choix")} <select data-k="pick">${[1, 2, 3].map((n) => `<option value="${n}"${t.pick === n ? " selected" : ""}>${n}</option>`).join("")}</select></label>
        <span class="ce-hint">${L(`Boosters of ${t.slots.length} cards: ${t.packs * Math.ceil(t.slots.length / t.pick)} picks, ${t.packs * t.slots.length} cards each.`, `Boosters de ${t.slots.length} cartes : ${t.packs * Math.ceil(t.slots.length / t.pick)} choix, ${t.packs * t.slots.length} cartes chacun.`)} ${L("Mages:", "Mages :")} ${sets.mages.map((id) => `<span data-hc="m:${esc(id)}" class="dre-hc">${esc(w.CARDS[id].name)}</span>`).join(", ") || "—"}.</span>
        <label class="dre-chk"><input type="checkbox" data-k="triple"${t.triple ? " checked" : ""}> ${L("Triple reward when a golden card is played (tavern phase)", "Récompense de triple quand une carte dorée est jouée (phase de taverne)")}</label>
        ${data.types.length > 1 ? `<button type="button" class="ce-mini del" data-act="del">${L("Delete this draft", "Supprimer ce draft")}</button>` : ""}</div>
        <nav class="ae-tabs"><button type="button" class="ae-tab${tab === "booster" ? " on" : ""}" data-act="tab" data-tab="booster">${L("Booster slots", "Emplacements du booster")}</button><button type="button" class="ae-tab${tab === "restrict" ? " on" : ""}" data-act="tab" data-tab="restrict">${L("Cards in the boosters", "Cartes dans les boosters")}</button><button type="button" class="ae-tab${tab === "boards" ? " on" : ""}" data-act="tab" data-tab="boards">${L("Winning boards", "Boards vainqueurs")} <small>${t.campaign.length}</small></button></nav>
        ${tab === "booster" ? `<div class="ce-sec"><p class="ce-hint">${L("Each line is one card of the booster, in this order; the booster has as many cards as lines (15 at most).", "Chaque ligne est une carte du booster, dans cet ordre ; le booster a autant de cartes que de lignes (15 au plus).")}</p>${slotsHTML(t)}</div>` : tab === "boards" ? boardsHTML(t) : restrictHTML(t)}
      </div></div>`;
  }
  function onClick(e) {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const t = type(), act = b.dataset.act, R = t.restrict;
    if (act === "sel") { sel = b.dataset.id; draw(); return; }
    if (act === "tab") { tab = b.dataset.tab; draw(); return; }
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
  function onInput(e) { const x = e.target; if (x.dataset.k === "name") { type().name = x.value.slice(0, 40) || "Draft"; save(); const b = host.querySelector(".dre-type.on b"); if (b) b.textContent = type().name; } }
  function onChange(e) {
    const x = e.target, t = type(), R = t.restrict;
    if (x.dataset.k === "packs") t.packs = +x.value;
    else if (x.dataset.k === "pick") t.pick = +x.value;
    else if (x.dataset.k === "triple") t.triple = x.checked;
    else if (x.dataset.bon != null) { const b = t.campaign.find((y) => y.id === x.dataset.bon); if (b) b.off = !x.checked; }
    else if (x.dataset.k === "name") return;
    else if (x.dataset.slot != null) { const s = t.slots[+x.dataset.slot]; if (x.dataset.sf === "k") { s.k = x.value; if ((s.k === "tier" || s.k === "anyTier") && !s.tier) s.tier = 3; } else if (x.dataset.sf === "tier") { s.tier = parseInt(x.value, 10) || 0; s.up = /\+$/.test(x.value); } else s.tribe = x.value; t.slots[+x.dataset.slot] = Dm().normSlot(s); }
    else if (x.dataset.t) R.tribes = x.checked ? R.tribes.filter((v) => v !== x.dataset.t) : [...new Set(R.tribes.concat(x.dataset.t))];
    else if (x.dataset.c) R.cards = x.checked ? R.cards.filter((v) => v !== x.dataset.c) : [...new Set(R.cards.concat(x.dataset.c))];
    else if (x.dataset.h) R.heroes = x.checked ? R.heroes.filter((v) => v !== x.dataset.h) : [...new Set(R.heroes.concat(x.dataset.h))];
    else if (x.dataset.s) R.spells = x.checked ? R.spells.filter((v) => v !== x.dataset.s) : [...new Set(R.spells.concat(x.dataset.s))];
    else return;
    save(); draw();
  }
  root.WA_DRAFT_EDITOR = { render };
})(typeof window !== "undefined" ? window : globalThis);
