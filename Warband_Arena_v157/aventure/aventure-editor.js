// Adventure mode: its editor (Studio › Adventure). Types of adventure, their enemy boards (levels 1-30, several boards a
// level), their taverns (the doors of every tavern, special floors), the prices of the special doors, their restrictions and
// their progression. Saved with the meta (WA_STORE.saveAdventure); it only refers to the game's cards, never changes them.
(function (root) {
  const D = root.WA_ADV_DATA, A = root.WA_ADV;
  let api = null, host = null, data = null, sel = "", tab = "boards", level = 1, openGroups = new Set(), saveT = 0, edit = null; // edit = { b, m } the enemy minion whose stats are open
  let diff = null; // v144 the difficulty test: { id: the adventure, res: { level: { win, loss, draw, n } }, running }
  let picker = null, pickQ = "", iconPick = "", hcEl = null, heroPick = -1; // v140 heroPick: the board whose hero picker is open // v139 the minion picker (board), the icon picker (door kind), the card shown on hover
  const W = () => root.WA;
  const fr = () => !!(root.WA_I18N && root.WA_I18N.lang === "fr");
  const L = (en, f) => (fr() ? f : en);
  const esc = (s) => api.esc(String(s == null ? "" : s));
  const type = () => data.types.find((t) => t.id === sel) || null;
  const FIGHTS = () => A.FN(type()); // v139 per adventure
  const doorName = (k) => (fr() ? D.doors[k].fr : D.doors[k].name);
  const kindName = (t, k) => (t && t.doorNames && t.doorNames[k]) || doorName(k); // this adventure's name of a door kind
  const svg = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const emblem = (k) => svg(D.emblemArt[k] || D.emblemArt.compass);
  const glyph = (k) => svg(D.glyphArt[k] || D.glyphArt.minion);
  const nameOf = (id) => { const w = W(), d = w.CARDS[id] || w.TOKENS[id] || w.SPELLS[id]; return d ? d.name : id; };
  // v139 a card's small picture (its photo, else its portrait) and the full card shown while the mouse is over its name
  const thumbHTML = (id, spell) => { const A2 = root.WA_ART; try { return `<span class="ae-th">${spell ? A2.spellArt(id) : A2.art(id)}</span>`; } catch (e) { return `<span class="ae-th"></span>`; } };
  const kwLabel = (k) => { const w = W(); try { return w.kwName ? w.kwName(k) : k; } catch (e) { return k; } };
  const iconHTML = (t, kind) => { const ic = A.doorIcon(t, kind); return ic.img ? `<img src="${esc(ic.img)}" alt="">` : svg(ic.svg || D.glyphArt.minion); };
  // v140 a hero's portrait (its picture, else its initial) and its card (portrait, name, power) shown on hover
  const heroPicURL = (id) => { const r = api.ST && api.ST.IMAGES && api.ST.IMAGES["hero:" + id]; return r ? r.card : ""; };
  const heroThumb = (id) => { const w = W(), h = w.HEROES[id], u = heroPicURL(id); return `<span class="ae-th ae-hth"${u ? ` style="background-image:url('${esc(u)}')"` : ""}>${u ? "" : esc(((h && h.name) || "?")[0])}</span>`; };
  function heroCardHTML(id) {
    const w = W(), h = w.HEROES[id]; if (!h) return "";
    const u = heroPicURL(id), txt = String((w.heroPowerText && w.heroPowerText(id)) || "").replace(/\*\*|\[[a-z#0-9]+\]|\[\/\]/gi, "");
    return `<div class="ae-herocard"><div class="ae-hc-port"${u ? ` style="background-image:url('${esc(u)}')"` : ""}>${u ? "" : esc(h.name[0])}</div><b>${esc(h.name)}</b><div class="ae-hc-pow"><em>${esc(h.power.name)}</em>${h.power.type === "passive" ? `<small>${L("passive", "passif")}</small>` : `<small>${h.power.cost != null ? h.power.cost : ""} ${L("gold", "or")}</small>`}<p>${esc(txt)}</p></div></div>`;
  }
  function hidePrev() { const o = document.querySelector(".ae-hovercard"); if (o) o.remove(); }
  function showPrev(key, anchor) {
    const w = W(), [kind, id] = key.split(":"); let c = null;
    const box = document.createElement("div"); box.className = "ae-hovercard";
    if (kind === "h") { if (!w.HEROES[id]) return; box.innerHTML = heroCardHTML(id); }
    else { try { c = api.helpers.makeCard(kind === "s" ? new w.Spell(id).dict() : new w.Minion(id).dict()); } catch (e) { return; } box.appendChild(c); }
    document.body.appendChild(box);
    const r = anchor.getBoundingClientRect(), bw = 180, bh = 255, left = r.right + 14 + bw < innerWidth ? r.right + 14 : Math.max(8, r.left - bw - 14);
    box.style.left = left + "px"; box.style.top = Math.max(8, Math.min(innerHeight - bh - 8, r.top + r.height / 2 - bh / 2)) + "px";
    if (root.WA_FIT_CARDS) requestAnimationFrame(() => root.WA_FIT_CARDS(box));
  }
  function onOver(e) { const x = e.target.closest && e.target.closest("[data-hc]"); if (x === hcEl) return; hcEl = x; hidePrev(); if (x && host.contains(x)) showPrev(x.dataset.hc, x); }

  function save(now) {
    clearTimeout(saveT);
    const go = async () => { try { await api.ST.saveAdventure(A.normalize(data)); api.status(L("Adventure saved.", "Aventure enregistrée.")); } catch (e) { api.status(String(e.message || e)); } };
    if (now) go(); else saveT = setTimeout(go, 350);
  }

  function render(h, a) {
    api = a; host = h;
    data = A.load();
    if (!data.types.find((t) => t.id === sel)) sel = data.types[0] ? data.types[0].id : "";
    draw();
    host.onclick = onClick; host.oninput = onInput; host.onchange = onChange;
    host.onmouseover = onOver; host.onmouseleave = () => { hcEl = null; hidePrev(); };
  }

  // ---------------------------------------------------------------- the page
  function draw() {
    const t = type(); hidePrev(); hcEl = null;
    host.innerHTML = `<div class="st-head"><h3>${L("Adventure", "Aventure")}</h3><p class="ce-hint">${L("The Adventure mode: a run of fights against the boards you build, with taverns of doors between them. Everything here is saved with this meta and only uses its cards (it never changes them).", "Le mode Aventure : une suite de combats contre les boards que tu construis, avec des tavernes à portes entre eux. Tout ici est enregistré avec cette méta et ne fait qu'utiliser ses cartes (sans jamais les modifier).")}</p></div>
      <div class="ae-wrap">
        <aside class="ae-types">
          ${data.types.map((x) => `<button type="button" class="ae-type${x.id === sel ? " on" : ""}" data-act="pick" data-id="${esc(x.id)}" style="--ac:${esc(x.color)}"><span class="adv-medal sm" style="--ac:${esc(x.color)}">${emblem(x.emblem)}</span><span><b>${esc(x.name)}</b><small>${A.filledLevels(x).filter((n) => n <= A.FN(x)).length}/${A.FN(x)} ${L("levels", "niveaux")}</small></span></button>`).join("")}
          <button type="button" class="pill small" data-act="new">+ ${L("New adventure", "Nouvelle aventure")}</button>
          ${data.types.length ? "" : `<button type="button" class="pill small" data-act="examples">${L("Make the 2 examples", "Créer les 2 exemples")}</button>`}
          <div class="ae-io"><button type="button" class="ce-mini" data-act="export" title="${esc(L("Export the adventures as a file", "Exporter les aventures en fichier"))}">⤓ ${L("Export", "Exporter")}</button><label class="ce-mini" title="${esc(L("Import adventures from a file", "Importer des aventures d'un fichier"))}">⤒ ${L("Import", "Importer")}<input type="file" accept=".json,application/json" data-act="import" hidden></label></div>
        </aside>
        <section class="ae-main">${t ? typePage(t) : `<div class="ce-empty">${L("No adventure yet: make one with “+ New adventure”.", "Aucune aventure : crée-en une avec « + Nouvelle aventure ».")}</div>`}</section>
      </div>`;
    if (t && tab === "boards") fillBoards(t);
  }
  function typePage(t) {
    const tabs = [["boards", L("Enemy boards", "Boards ennemis")], ["taverns", L("Taverns", "Tavernes")], ["prices", L("Doors", "Portes")], ["rewards", L("Rewards", "Récompenses")], ["restrict", L("Restrictions", "Restrictions")], ["progress", L("Progression", "Progression")]];
    return `<div class="ae-head" style="--ac:${esc(t.color)}">
        <div class="ae-emblems">${D.emblems.map((e) => `<button type="button" class="ae-emb${t.emblem === e ? " on" : ""}" data-act="emblem" data-e="${e}" title="${e}">${emblem(e)}</button>`).join("")}</div>
        <div class="ae-fields"><label class="ce-sel wide">${L("Name", "Nom")}<input data-f="name" value="${esc(t.name)}" maxlength="40"></label>
          <label class="ce-sel wide">${L("Description (shown when choosing)", "Description (affichée au choix)")}<input data-f="blurb" value="${esc(t.blurb)}" maxlength="400"></label></div>
        <label class="ce-sel ae-color">${L("Colour", "Couleur")}<input type="color" data-f="color" value="${esc(t.color)}"></label>
        <button type="button" class="ce-mini del" data-act="delete" title="${esc(L("Delete this adventure", "Supprimer cette aventure"))}">🗑</button></div>
      <nav class="ae-tabs">${tabs.map(([k, l]) => `<button type="button" class="ae-tab${tab === k ? " on" : ""}" data-act="tab" data-tab="${k}">${l}</button>`).join("")}</nav>
      <div class="ae-body">${{ boards: boardsTab, taverns: tavernsTab, prices: pricesTab, rewards: rewardsTab, restrict: restrictTab, progress: progressTab }[tab](t)}</div>`;
  }

  // ---------------------------------------------------------------- enemy boards
  function boardsTab(t) {
    const filled = A.filledLevels(t), list = t.boards[level] || [], boss = t.bosses.includes(level);
    const strip = Array.from({ length: FIGHTS() }, (_, i) => { const n = i + 1; return `<button type="button" class="ae-lv${n === level ? " sel" : ""}${filled.includes(n) ? " on" : ""}${t.bosses.includes(n) ? " boss" : ""}" data-act="level" data-n="${n}" title="${esc((t.bosses.includes(n) ? "Boss · " : "") + L("level ", "niveau ") + n)}">${n}</button>`; }).join("");
    return `<div class="ae-strip">${strip}</div>${diffHTML(t)}
      <div class="ae-lvhead"><h4>${L("Level", "Niveau")} ${level}${boss ? ` <span class="ae-boss">BOSS</span>` : ""}</h4>
        <label class="ce-check"><input type="checkbox" data-act="boss" ${boss ? "checked" : ""}> ${L("Boss fight", "Combat de boss")}</label>
        <span class="ce-hint">${list.length > 1 ? L(`${list.length} boards: one is drawn at random`, `${list.length} boards : l'un est tiré au hasard`) : L("Several boards on a level: one is drawn at random in the game.", "Plusieurs boards sur un niveau : l'un est tiré au hasard en jeu.")}</span></div>
      ${list.map((b, i) => `<div class="ae-board" data-b="${i}">
        <div class="ae-bhead"><b>${L("Board", "Board")} ${String.fromCharCode(65 + i)}</b><span class="ae-bsum">${boardSum(b)}</span>
          <span class="ae-bbtns"><button type="button" class="ce-mini" data-act="dupBoard" data-b="${i}" title="${esc(L("Duplicate", "Dupliquer"))}">⧉</button><button type="button" class="ce-mini" data-act="copyNext" data-b="${i}" title="${esc(L("Copy to the next level", "Copier au niveau suivant"))}">→ ${level + 1 <= FIGHTS() ? level + 1 : ""}</button><button type="button" class="ce-mini del" data-act="delBoard" data-b="${i}" title="${esc(L("Delete this board", "Supprimer ce board"))}">✕</button></span></div>
        <div class="ae-row">${b.minions.map((m, j) => `<div class="ae-mn${edit && edit.b === i && edit.m === j ? " ed" : ""}"><div class="ae-slot" data-b="${i}" data-m="${j}"></div><div class="ae-mctl"><button type="button" class="ce-mini" data-act="left" data-b="${i}" data-m="${j}" ${j ? "" : "disabled"} title="${esc(L("Move left", "Vers la gauche"))}">◀</button><button type="button" class="ce-mini${m.golden ? " on" : ""}" data-act="gold" data-b="${i}" data-m="${j}" title="${esc(L("Golden", "Doré"))}">★</button><button type="button" class="ce-mini" data-act="right" data-b="${i}" data-m="${j}" ${j < b.minions.length - 1 ? "" : "disabled"} title="${esc(L("Move right", "Vers la droite"))}">▶</button><button type="button" class="ce-mini del" data-act="rmMinion" data-b="${i}" data-m="${j}" title="${esc(L("Remove", "Retirer"))}">✕</button></div>
            <button type="button" class="ae-mod${m.a || m.h || m.form || (m.kw || []).length || m.mk ? " on" : ""}" data-act="mod" data-b="${i}" data-m="${j}" title="${esc(L("Its stats, form, keywords and markers", "Ses stats, sa forme, ses mots-clés et ses marqueurs"))}">${modLabel(m)}</button></div>`).join("")}
          ${b.minions.length < 7 ? `<button type="button" class="ae-add${picker && picker.b === i ? " on" : ""}" data-act="pickOpen" data-b="${i}" title="${esc(L("Add a minion", "Ajouter un serviteur"))}"></button>` : ""}</div>
        ${picker && picker.b === i && b.minions.length < 7 ? pickerHTML(t, i) : ""}
        ${edit && edit.b === i && b.minions[edit.m] ? editPanel(b, edit.m) : ""}
        ${boardHeroHTML(b, i)}${combatSpellsHTML(b, i)}</div>`).join("")}
      <button type="button" class="pill" data-act="newBoard">+ ${L(`New board on level ${level}`, `Nouveau board au niveau ${level}`)}</button>`;
  }
  // v139 the minion picker: the same order as before (this adventure's tribes first…), a picture for each, the card on hover
  function pickerHTML(t, bi) {
    const w = W(), mine = A.allowed(t).tribes, groups = {};
    const ids = [...new Set([...Object.keys(w.CARDS), ...Object.keys(w.TOKENS)])].filter((id) => { const d = w.CARDS[id] || w.TOKENS[id]; return d && !d.retired; });
    for (const id of ids) { const d = w.CARDS[id] || w.TOKENS[id], tok = !w.CARDS[id] || w.CARDS[id].inPool === false, g = tok ? "~tok" : d.allTribes ? "*all" : w.tribesOf(d).filter(Boolean)[0] || "*neutral"; (groups[g] = groups[g] || []).push(id); }
    const gname = (g) => (g === "~tok" ? L("Tokens / not in the tavern", "Jetons / hors taverne") : g === "*neutral" ? L("Neutral", "Neutre") : g === "*all" ? L("All tribes", "Toutes tribus") : w.tribeName(g));
    const tierOf = (id) => (w.CARDS[id] || w.TOKENS[id]).tier || 0;
    const rank = (g) => (mine.includes(g) ? mine.indexOf(g) / 100 : g === "*neutral" ? 1 : g === "*all" ? 1.5 : g === "~tok" ? 3 : 2);
    const order = Object.keys(groups).sort((a, b) => rank(a) - rank(b) || gname(a).localeCompare(gname(b)));
    const q = pickQ.trim().toLowerCase(), hit = (id) => !q || nameOf(id).toLowerCase().includes(q);
    let other = false;
    const html = order.map((g) => {
      const l = groups[g].sort((a, b) => tierOf(a) - tierOf(b) || nameOf(a).localeCompare(nameOf(b))); // (all of them: the search only hides)
      const sep = rank(g) >= 2 && !other ? ((other = true), `<div class="ae-pk-sep">${L("Not in this adventure", "Hors de cette aventure")}</div>`) : "";
      return `${sep}<div class="ae-pk-g"${l.some(hit) ? "" : " hidden"}><b>${mine.includes(g) ? "★ " : ""}${esc(gname(g))}</b><div class="ae-pk-items">${l.map((id) => `<button type="button" class="ae-pk-it" data-act="pickAdd" data-b="${bi}" data-id="${esc(id)}" data-hc="m:${esc(id)}"${hit(id) ? "" : " hidden"}>${thumbHTML(id)}<span><b>${esc(nameOf(id))}</b><small>T${tierOf(id)}</small></span></button>`).join("")}</div></div>`;
    }).join("");
    return `<div class="ae-picker"><div class="ae-pk-head"><input type="text" data-pickq="1" value="${esc(pickQ)}" placeholder="${esc(L("Find a minion…", "Chercher un serviteur…"))}"><span class="ce-hint">${L("Click to add · the card shows on hover", "Clic pour ajouter · la carte s'affiche au survol")}</span><button type="button" class="ce-mini" data-act="pickClose">✕</button></div><div class="ae-pk-list">${html || `<div class="ce-empty">${L("No match.", "Aucun résultat.")}</div>`}</div></div>`;
  }
  // v140 the board's hero: its passive power plays in the fight (an active power does nothing); its portrait faces you
  function boardHeroHTML(b, bi) {
    const w = W(), id = b.hero && w.HEROES[b.hero] ? b.hero : "", ids = w.HERO_LIST.filter((h) => w.HEROES[h]);
    return `<div class="ae-bhero"><span class="ae-bsl">♛ ${L("Hero", "Héros")}<small>${L("its passive power plays in the fight", "son pouvoir passif joue en combat")}</small></span>
      ${id ? `<span class="ae-spchip ae-herochip" data-hc="h:${esc(id)}">${heroThumb(id)}<b>${esc(w.HEROES[id].name)}</b>${w.HEROES[id].power.type !== "passive" ? `<small class="ae-warn">${L("active power: no effect", "pouvoir actif : sans effet")}</small>` : ""}<button type="button" class="ce-mini del" data-act="heroRm" data-b="${bi}">✕</button></span>` : ""}
      <button type="button" class="pill small" data-act="heroOpen" data-b="${bi}">${id ? L("Change", "Changer") : L("+ Give it a hero", "+ Lui donner un héros")}</button></div>
      ${heroPick === bi ? `<div class="ae-heropick">${ids.map((h) => `<button type="button" class="ae-hp-it${h === id ? " on" : ""}" data-act="heroSet" data-b="${bi}" data-id="${esc(h)}" data-hc="h:${esc(h)}">${heroThumb(h)}<span><b>${esc(w.HEROES[h].name)}</b><small>${w.HEROES[h].power.type === "passive" ? L("passive", "passif") : L("active", "actif")}</small></span></button>`).join("")}</div>` : ""}`;
  }
  // v139 the board's combat spells: cast by its side at the Start of Combat (their in-fight effects; gold and tavern ones do nothing)
  function combatSpellsHTML(b, bi) {
    const w = W(), l = (b.spells || []).filter((id) => w.SPELLS[id]);
    const opts = Object.keys(w.SPELLS).filter((id) => (w.SPELLS[id].abilities || []).length && !l.includes(id)).sort((x, y) => (w.SPELLS[x].tier || 1) - (w.SPELLS[y].tier || 1) || nameOf(x).localeCompare(nameOf(y)));
    const grp = (lab, ids) => (ids.length ? `<optgroup label="${esc(lab)}">${ids.map((id) => `<option value="${esc(id)}">T${w.SPELLS[id].tier || 1} · ${esc(nameOf(id))}</option>`).join("")}</optgroup>` : "");
    return `<div class="ae-bspells"><span class="ae-bsl">✦ ${L("Combat spells", "Sorts de combat")}<small>${L("cast by this board at the Start of Combat", "lancés par ce board au début du combat")}</small></span>
      ${l.map((id, k) => `<span class="ae-spchip" data-hc="s:${esc(id)}">${thumbHTML(id, true)}<b>${esc(nameOf(id))}</b><button type="button" class="ce-mini del" data-act="spRm" data-b="${bi}" data-k="${k}">✕</button></span>`).join("")}
      ${l.length < 6 ? `<select data-act="addSpell" data-b="${bi}"><option value="">+ ${L("Add a spell", "Ajouter un sort")}</option>${grp(L("Tavern spells", "Sorts de taverne"), opts.filter((id) => !w.SPELLS[id].advOnly))}${grp("Ad-spells", opts.filter((id) => w.SPELLS[id].advOnly))}</select>` : ""}</div>`;
  }
  // the board as it will fight (forms of the time of day, added stats), aligned on the board's slots (null = a card missing)
  function built(b) { const w = W(), ok = b.minions.map((m) => !!(w.CARDS[m.card] || w.TOKENS[m.card])), l = A.buildBoard(b); let k = 0; return b.minions.map((m, j) => (ok[j] ? l[k++] : null)); }
  const variant = (b, j, o) => built({ minions: b.minions.map((m, i) => (i === j ? Object.assign({}, m, o) : m)) })[j];
  function boardSum(b) {
    let a = 0, h = 0; for (const m of built(b)) if (m) { a += m.attack; h += m.health; }
    return `${b.minions.length}/7 · ${a}/${h}`;
  }
  const sign = (n) => (n > 0 ? "+" + n : String(n));
  function modLabel(m) {
    const st = m.a || m.h ? `${sign(m.a || 0)}/${sign(m.h || 0)}` : L("Stats", "Stats");
    return `<i>✎</i>${st}${m.form ? `<em>${m.form === "night" ? "☾" : "☀"}</em>` : ""}${(m.kw || []).length || m.mk ? "<em>◆</em>" : ""}`;
  }
  // the stats and form of one enemy minion: final Attack / Health (saved as what is added to the card), its form
  function editPanel(b, j) {
    const w = W(), m = b.minions[j], cur = built(b)[j];
    if (!cur) return "";
    const base = variant(b, j, { a: 0, h: 0 }), auto = variant(b, j, { form: "" }), alt = !!cur.alt;
    const d0 = new w.Minion(m.card, !!m.golden), dayName = d0.form === "night" && d0.alt ? d0.alt.name : d0.name, nightName = d0.alt ? (d0.form === "night" ? d0.name : d0.alt.name) : "";
    const stat = (k, label, v, bv) => `<div class="ae-stat ${k}"><span>${label}</span><button type="button" data-act="st" data-k="${k}" data-d="-1">−</button><input type="number" data-st="${k}" value="${v}" min="${k === "h" ? 1 : 0}" max="999"><button type="button" data-act="st" data-k="${k}" data-d="1">+</button><small>${L("card", "carte")} ${bv}${v !== bv ? ` <b>${sign(v - bv)}</b>` : ""}</small></div>`;
    return `<div class="ae-medit"><div class="ae-mprev"></div>
      <div class="ae-mfields"><div class="ae-mtitle"><b>${esc(cur.name)}</b>${m.golden ? `<span class="ae-gold">${L("golden", "doré")}</span>` : ""}<small>${L("as it fights on this board", "tel qu'il combat sur ce board")}</small></div>
        ${stat("a", L("Attack", "Attaque"), cur.attack, base.attack)}${stat("h", L("Health", "Vie"), cur.health, base.health)}
        ${alt ? `<div class="ae-forms"><span>${L("Form", "Forme")}</span>
          <button type="button" data-act="form" data-v=""${!m.form ? ' class="on"' : ""}>${L("Auto", "Auto")} <small>(${esc(auto.form === "night" ? nightName : dayName)})</small></button>
          <button type="button" data-act="form" data-v="day"${m.form === "day" ? ' class="on"' : ""}>☀ ${esc(dayName)}</button>
          <button type="button" data-act="form" data-v="night"${m.form === "night" ? ' class="on"' : ""}>☾ ${esc(nightName)}</button></div>
          <p class="ce-hint">${L("Auto: night when this board's own Nightfall affinity is on (as in the game), so 4 Human/Werewolf cards fight as werewolves.", "Auto : la nuit quand l'affinité Nightfall de ce board est active (comme en jeu) : 4 cartes Humain/Loup-garou combattent en loups-garous.")}</p>` : ""}
        ${evoHTML(m)}${kwMkHTML(m)}
        <div class="ae-mbtns"><button type="button" class="ce-mini wide" data-act="modReset">${L("Back to the card", "Revenir à la carte")}</button><button type="button" class="pill small" data-act="modClose">${L("Done", "Terminé")}</button></div></div></div>`;
  }
  // v144 the difficulty test: each level against typical boards of a player at that level (simulated fights)
  const diffCell = (r) => { if (!r) return ["", "…"]; if (!r.n) return ["none", "—"]; const p = Math.round((100 * r.win) / r.n); return [p >= 70 ? "easy" : p >= 45 ? "fair" : p >= 25 ? "hard" : "brutal", p + "%"]; };
  function diffHTML(t) {
    const d = diff && diff.id === t.id ? diff : null;
    const cells = d ? Array.from({ length: FIGHTS() }, (_, i) => { const r = d.res[i + 1], [c, v] = d.res[i + 1] === undefined ? ["", d.running ? "…" : ""] : diffCell(r); return `<span class="ae-dcell ${c}${t.bosses.includes(i + 1) ? " boss" : ""}" data-dl="${i + 1}" title="${esc(r && r.n ? L(`Level ${i + 1}: a typical board wins ${r.win}, loses ${r.loss}, draws ${r.draw} of ${r.n}`, `Niveau ${i + 1} : un board type gagne ${r.win}, perd ${r.loss}, fait ${r.draw} égalités sur ${r.n}`) : "")}">${v}</span>`; }).join("") : "";
    return `<div class="ae-diff"><button type="button" class="pill small" data-act="diffRun"${d && d.running ? " disabled" : ""}>⚖ ${d && d.running ? L("Testing…", "Test en cours…") : L("Test the difficulty", "Tester la difficulté")}</button>
      <span class="ce-hint">${L("Each level's boards against 40 typical boards of a player at that level (as many minions as the level, cards this adventure allows of the tavern's tier or the one below, mostly of one tribe, some golden later, buffed as a player's would be: +1/+1 at level 3, +5/+5 at 8, +19/+19 at 15; no spells or hero). An estimate to compare levels with each other. The share of fights the player wins:", "Les boards de chaque niveau contre 40 boards types d'un joueur à ce niveau (autant de serviteurs que le niveau, cartes permises du tier de la taverne ou celui d'en dessous, surtout d'une tribu, quelques dorés ensuite, buffés comme ceux d'un joueur : +1/+1 au niveau 3, +5/+5 au 8, +19/+19 au 15 ; sans sorts ni héros). Une estimation pour comparer les niveaux entre eux. La part des combats que le joueur gagne :")} <b class="ae-dleg easy">${L("easy", "facile")}</b> <b class="ae-dleg fair">${L("fair", "équilibré")}</b> <b class="ae-dleg hard">${L("hard", "dur")}</b> <b class="ae-dleg brutal">${L("brutal", "brutal")}</b></span>
      ${d ? `<div class="ae-dstrip">${cells}</div>` : ""}</div>`;
  }
  function runDiff(t) {
    diff = { id: t.id, res: {}, running: true }; rerender();
    const d = diff, N = FIGHTS(); let lv = 1;
    const step = () => {
      if (diff !== d) return;
      try { d.res[lv] = A.simLevel(t, lv, 40, 1) || { win: 0, loss: 0, draw: 0, n: 0 }; } catch (e) { d.res[lv] = { win: 0, loss: 0, draw: 0, n: 0 }; }
      const c = host.querySelector(`.ae-dcell[data-dl="${lv}"]`);
      if (c) { const [k, v] = diffCell(d.res[lv]); c.className = `ae-dcell ${k}${t.bosses.includes(lv) ? " boss" : ""}`; c.textContent = v; }
      lv++; if (lv <= N) setTimeout(step, 0); else { d.running = false; rerender(); }
    };
    setTimeout(step, 30);
  }
  // v141 an evolving card (Essaims): the earlier forms of its line it evolved from, one per tier; it keeps their effects and
  // stats as the game's evolution does
  function evoHTML(m) {
    const w = W(), opts = A.evoBefore(m.card); if (!opts.length) return "";
    const sel = m.evo || [], c = A.evoCarry(sel);
    return `<div class="ae-kws ae-evo"><span>${L("Evolved from", "Évolué depuis")}</span><div>${opts.map((l, lv) => `<span class="ae-evolv">${l.map((id) => `<button type="button" class="ae-chip${sel.includes(id) ? " on" : ""}" data-act="evoTog" data-lv="${lv}" data-id="${esc(id)}" data-hc="m:${esc(id)}">T${w.CARDS[id].tier || 1} ${esc(w.CARDS[id].name)}</button>`).join("")}</span>`).join("")}</div></div>
      <p class="ce-hint">${L(`Like an evolution in the game: it keeps the effects and stats of each form picked (once each, as the cards' "Keep" options say).${c.n ? ` Here: +${c.a}/+${c.h}, ${c.abs.length} effect(s) kept.` : ""}`, `Comme une évolution en jeu : il garde les effets et les stats de chaque forme choisie (une fois chacune, selon les options « Garder » des cartes).${c.n ? ` Ici : +${c.a}/+${c.h}, ${c.abs.length} effet(s) gardé(s).` : ""}`)}</p>`;
  }
  // v139 its keywords (the game's and the custom ones; those of the card itself shown, not removable) and its markers
  function kwMkHTML(m) {
    const w = W(), d = w.CARDS[m.card] || w.TOKENS[m.card] || {}, own = (k) => !!d[k] || (d.ckw || []).includes(k);
    const kws = w.KW_LIST.filter((k) => k !== "magnetic").concat(Object.keys(w.CKW || {}));
    const mkKws = Object.keys(w.KW_TEXT || {}).filter((k) => k !== "magnetic" && k !== "venomous"), mk = m.mk || { p: 0, kw: [] };
    return `<div class="ae-kws"><span>${L("Keywords", "Mots-clés")}</span><div>${kws.map((k) => `<button type="button" class="ae-chip${own(k) ? " own" : (m.kw || []).includes(k) ? " on" : ""}" data-act="kwTog" data-k="${esc(k)}" ${own(k) ? `disabled title="${esc(L("The card has it", "La carte l'a déjà"))}"` : ""}>${esc(kwLabel(k))}</button>`).join("")}</div></div>
      <div class="ae-kws"><span>${L("Markers", "Marqueurs")}</span><div>${[["1/1", mk.p || 0], ...A.MK_SIZES.map((k) => [k, (mk.st || {})[k] || 0])].map(([k, n]) => `<span class="ae-mkp"><button type="button" data-act="mkp" data-sz="${k}" data-d="-1">−</button><b>${n}</b><button type="button" data-act="mkp" data-sz="${k}" data-d="1">+</button><small>+${k.replace("/", "/+")}</small></span>`).join("")}${mkKws.map((k) => `<button type="button" class="ae-chip mk${(mk.kw || []).includes(k) ? " on" : ""}" data-act="mkTog" data-k="${esc(k)}">◆ ${esc(kwLabel(k))}</button>`).join("")}</div></div>`;
  }
  function fillBoards(t) {
    const list = t.boards[level] || [], all = list.map(built);
    for (const s of host.querySelectorAll(".ae-slot")) {
      const bi = +s.dataset.b, mi = +s.dataset.m, m = list[bi].minions[mi], mn = all[bi][mi];
      if (!mn) { s.innerHTML = `<div class="ae-missing">${esc(m.card)}<small>${L("not in this meta", "absent de cette méta")}</small></div>`; continue; }
      const tk = api.helpers.makeToken(mn.dict(), { static: true }); if (m.a || m.h) tk.classList.add("ae-buffed"); s.appendChild(tk);
    }
    const pv = host.querySelector(".ae-mprev");
    if (pv && edit && list[edit.b]) { const mn = all[edit.b][edit.m]; if (mn) { const c = api.helpers.makeCard ? api.helpers.makeCard(mn.dict()) : api.helpers.makeToken(mn.dict(), { static: true }); pv.appendChild(c); } }
  }

  // ---------------------------------------------------------------- taverns
  function doorRow(d, path, i) {
    const tierSel = `<select data-door="${path}" data-i="${i}" data-k="tier"><option value="0"${!d.tier ? " selected" : ""}>${L("Tavern tier", "Tier de la taverne")}</option>${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}"${d.tier === n ? " selected" : ""}>Tier ${n}</option>`).join("")}</select>`;
    const T = D.doors[d.type], tiered = ["tier", "dominantTribe", "dominantAffinity", "neutral", "allTribes", "advSpell"].includes(T.source);
    return `<div class="ae-door" style="--dc:${esc(T.color)}"><span class="ae-dico">${iconHTML(type(), d.type)}</span>
      <select data-door="${path}" data-i="${i}" data-k="type">${D.doorOrder.map((k) => `<option value="${k}"${d.type === k ? " selected" : ""}>${esc(kindName(type(), k))}</option>`).join("")}</select>
      <input class="ae-dname" type="text" maxlength="32" data-door="${path}" data-i="${i}" data-k="name" value="${esc(d.name || "")}" placeholder="${esc(kindName(type(), d.type))}" title="${esc(L("This door's own name (empty = the name of its kind)", "Le nom de cette porte (vide = le nom de son type)"))}">
      <span class="ae-dbtns"><button type="button" class="ce-mini" data-act="doorUp" data-door="${path}" data-i="${i}" ${i ? "" : "disabled"}>▲</button><button type="button" class="ce-mini del" data-act="doorRm" data-door="${path}" data-i="${i}">✕</button></span><i class="ae-break"></i>
      ${tiered ? tierSel + `<select data-door="${path}" data-i="${i}" data-k="tierMode"><option value="upto"${d.tierMode !== "exact" ? " selected" : ""}>${L("or lower", "ou moins")}</option><option value="exact"${d.tierMode === "exact" ? " selected" : ""}>${L("exactly", "exactement")}</option></select>` : `<span class="ae-dnote">${/^tierUp/.test(T.source) ? L("tier of the tavern + 1", "tier de la taverne + 1") : L("any allowed hero", "un héros autorisé")}</span>`}
      <label class="ae-num">${L("choices", "choix")}<input type="number" min="1" max="6" data-door="${path}" data-i="${i}" data-k="choices" value="${d.choices}"></label>
      <label class="ae-num">${L("price", "prix")}<input type="number" min="0" max="30" data-door="${path}" data-i="${i}" data-k="price" value="${d.price == null ? "" : d.price}" placeholder="${esc(defPriceTxt(type(), d.type))}"></label></div>`;
  }
  const defPriceTxt = (t, k) => { const p = t.prices[k] != null ? t.prices[k] : D.doors[k].price; return p == null ? (k === "spell" ? L("cost", "coût") : "3") : String(p); };
  function tavernsTab(t) {
    const floors = Object.keys(t.floors).map(Number).sort((a, b) => a - b);
    return `<div class="ce-sec"><h4>${L("Every tavern", "Chaque taverne")}</h4>
        <p class="ce-hint">${L("The doors of every tavern between two fights. There is always at least a Minion door and a Spell door (added if missing). Opening: the first door of a tavern is free, then each door takes a key. Each card behind a door takes a coupon.", "Les portes de chaque taverne entre deux combats. Il y a toujours au moins une porte Serviteurs et une porte Sorts (ajoutées si elles manquent). Ouverture : la 1re porte d'une taverne est gratuite, puis chaque porte demande une clef. Chaque carte derrière une porte prend un coupon.")}</p>
        <div class="ae-doors">${t.tavern.map((d, i) => doorRow(d, "tavern", i)).join("")}</div>
        <button type="button" class="pill small" data-act="doorAdd" data-door="tavern">+ ${L("Add a door", "Ajouter une porte")}</button></div>
      <div class="ce-sec"><h4>${L("Special floors", "Étages spéciaux")}</h4>
        <p class="ce-hint">${L("The tavern after a given fight: add doors to the usual ones (a guaranteed Hero door…), or replace them all.", "La taverne après un combat donné : ajouter des portes aux habituelles (une porte Héros garantie…), ou toutes les remplacer.")}</p>
        ${floors.map((n) => `<div class="ae-floor"><div class="ae-fhead"><b>${L("Tavern after fight", "Taverne après le combat")} ${n}</b>
          <select data-floor="${n}" data-k="mode"><option value="add"${t.floors[n].mode === "add" ? " selected" : ""}>${L("adds these doors", "ajoute ces portes")}</option><option value="replace"${t.floors[n].mode === "replace" ? " selected" : ""}>${L("replaces all the doors", "remplace toutes les portes")}</option></select>
          <button type="button" class="ce-mini del" data-act="floorRm" data-n="${n}">✕</button></div>
          <div class="ae-doors">${t.floors[n].doors.map((d, i) => doorRow(d, "floor:" + n, i)).join("")}</div>
          <button type="button" class="pill small" data-act="doorAdd" data-door="floor:${n}">+ ${L("Add a door", "Ajouter une porte")}</button></div>`).join("")}
        <div class="ae-row ae-newfloor"><label class="ae-num">${L("After fight", "Après le combat")}<input type="number" min="1" max="${FIGHTS() - 1}" id="aeFloorN" value="${nextFreeFloor(t)}"></label><button type="button" class="pill small" data-act="floorAdd">+ ${L("Special floor", "Étage spécial")}</button></div></div>`;
  }
  const nextFreeFloor = (t) => { for (let n = 1; n < FIGHTS(); n++) if (!t.floors[n]) return n; return 1; };

  // ---------------------------------------------------------------- prices
  function pricesTab(t) {
    return `<div class="ce-sec"><h4>${L("The doors of this adventure", "Les portes de cette aventure")}</h4>
      <p class="ce-hint">${L("Each kind of door: its name on the door (empty = the default name) and what each choice behind it costs (empty = the default). A door can still have its own name and price in Taverns.", "Chaque type de porte : son nom sur la porte (vide = le nom par défaut) et ce que coûte chaque choix derrière (vide = la valeur par défaut). Une porte peut encore avoir son propre nom et son prix dans Tavernes.")}</p>
      <div class="ae-prices">${D.doorOrder.map((k) => `<div class="ae-price${iconPick === k ? " picking" : ""}" style="--dc:${esc(D.doors[k].color)}"><button type="button" class="ae-dico ae-dico-btn" data-act="iconPick" data-k="${k}" title="${esc(L("Change its icon", "Changer son icône"))}">${iconHTML(t, k)}</button>
        <label class="ae-pname"><input type="text" maxlength="32" data-dname="${k}" value="${esc((t.doorNames || {})[k] || "")}" placeholder="${esc(doorName(k))}">${D.doors[k].special ? `<em>${L("special", "spéciale")}</em>` : ""}</label>
${k === "hero" ? `        <label class="ae-pprice"><input type="number" min="0" max="30" data-price="${k}" value="${t.prices[k] == null ? "" : t.prices[k]}" placeholder="${esc(D.doors[k].price == null ? (k === "spell" ? L("cost", "coût") : "3") : String(D.doors[k].price))}"><small>${L("0 = free, else 1 coupon", "0 = gratuit, sinon 1 coupon")}</small></label>` : ""}</div>${iconPick === k ? iconPickerHTML(t, k) : ""}`).join("")}</div></div>`;
  }
  // v139 the icon of a door kind: one of these, or a picture of your own
  function iconPickerHTML(t, k) {
    const keys = [...new Set([...Object.keys(D.glyphArt), ...Object.keys(D.emblemArt), ...Object.keys(D.extraIcons || {})])], cur = (t.doorIcons || {})[k] || "";
    return `<div class="ae-iconpick" style="--dc:${esc(D.doors[k].color)}"><div class="ae-ip-grid">${keys.map((x) => `<button type="button" class="ae-ip${cur === "ic:" + x ? " on" : ""}" data-act="iconSet" data-k="${k}" data-v="ic:${x}" title="${esc(x)}">${svg(A.iconSvg(x))}</button>`).join("")}</div>
      <div class="ae-ip-foot"><label class="pill small">${L("Your own picture…", "Ton image…")}<input type="file" accept="image/*" data-iconimg="${k}" hidden></label><button type="button" class="pill small" data-act="iconSet" data-k="${k}" data-v="">${L("Default", "Par défaut")}</button><button type="button" class="ce-mini" data-act="iconPick" data-k="${k}">✕</button></div></div>`;
  }

  // ---------------------------------------------------------------- restrictions
  function restrictTab(t) {
    const w = W(), R = t.restrict, outT = new Set(R.tribes), outC = new Set(R.cards);
    const tribes = w.availableTribes(), byT = {};
    for (const id of Object.keys(w.CARDS)) { const d = w.CARDS[id]; if (!d || d.inPool === false || d.retired || d.affOnly || (w.EVO_T && w.EVO_T.has(id))) continue; const g = d.allTribes ? "*all" : w.tribesOf(d).filter(Boolean)[0] || "*neutral"; (byT[g] = byT[g] || []).push(id); }
    const groups = [...tribes, "*neutral", "*all"].filter((g) => byT[g] || tribes.includes(g));
    const gname = (g) => (g === "*neutral" ? L("Neutral", "Neutres") : g === "*all" ? L("All tribes", "Toutes tribus") : w.tribeName(g));
    const tierOf = (id) => (w.CARDS[id] || w.SPELLS[id]).tier || 0;
    const card = (id, kind) => `<label class="ae-it" data-hc="m:${esc(id)}"><input type="checkbox" data-rk="${kind}" data-id="${esc(id)}" ${(kind === "cards" ? outC : new Set(R[kind])).has(id) ? "" : "checked"}>${thumbHTML(id)}<span><b>${esc(nameOf(id))}</b><small>T${tierOf(id)}</small></span></label>`;
    const tribeBlock = (g) => {
      const l = (byT[g] || []).sort((a, b) => tierOf(a) - tierOf(b) || nameOf(a).localeCompare(nameOf(b))), off = outT.has(g), kept = l.filter((id) => !outC.has(id)).length;
      return `<div class="ae-grp${off ? " off" : ""}" data-tribe="${esc(g)}"><div class="ae-ghead"><label class="ae-tog"><input type="checkbox" data-act="tribeTog" data-t="${esc(g)}" ${off ? "" : "checked"}><b>${esc(gname(g))}</b></label>
        <small>${off ? L("left out", "retirée") : `${kept}/${l.length}`}</small><button type="button" class="ce-mini" data-act="grp" data-g="${esc("t:" + g)}">${openGroups.has("t:" + g) ? "▾" : "▸"}</button></div>
        ${openGroups.has("t:" + g) && !off ? `<div class="ae-items">${l.map((id) => card(id, "cards")).join("")}</div>` : ""}</div>`;
    };
    const flat = (key, title, ids, label) => `<div class="ae-grp"><div class="ae-ghead"><b>${title}</b><small>${ids.filter((id) => !R[key].includes(id)).length}/${ids.length}</small>
        <button type="button" class="ce-mini" data-act="all" data-rk="${key}" data-on="1">${L("all", "tout")}</button><button type="button" class="ce-mini" data-act="all" data-rk="${key}" data-on="0">${L("none", "rien")}</button>
        <button type="button" class="ce-mini" data-act="grp" data-g="${key}">${openGroups.has(key) ? "▾" : "▸"}</button></div>
        ${openGroups.has(key) ? `<div class="ae-items">${ids.map((id) => `<label class="ae-it"${key === "spells" ? ` data-hc="s:${esc(id)}"` : key === "heroes" ? ` data-hc="h:${esc(id)}"` : ""}><input type="checkbox" data-rk="${key}" data-id="${esc(id)}" ${R[key].includes(id) ? "" : "checked"}>${key === "spells" ? thumbHTML(id, true) : key === "heroes" ? heroThumb(id) : ""}<span>${esc(label(id))}</span></label>`).join("")}</div>` : ""}</div>`;
    const spells = Object.keys(w.SPELLS).filter((id) => w.SPELLS[id].inPool !== false).sort((a, b) => tierOf(a) - tierOf(b) || nameOf(a).localeCompare(nameOf(b)));
    return `<div class="ce-sec"><h4>${L("What this adventure lets in", "Ce que cette aventure autorise")}</h4>
        <p class="ce-hint">${L("Only what is ticked can show up behind the doors and at the start. Untick a tribe to leave it out in one click. What you add to the game later is in by default.", "Seul ce qui est coché peut apparaître derrière les portes et au départ. Décoche une tribu pour la retirer en un clic. Ce que tu ajouteras plus tard au jeu est autorisé par défaut.")}</p>
        <h5 class="ae-sub">${L("Minions by tribe", "Serviteurs par tribu")}</h5>${groups.map(tribeBlock).join("")}
        <h5 class="ae-sub">${L("The rest", "Le reste")}</h5>
        ${flat("spells", L("Spells", "Sorts"), spells, (id) => `T${tierOf(id)} · ${nameOf(id)}`)}
        ${flat("heroes", L("Heroes", "Héros"), w.HERO_LIST.filter((id) => w.HEROES[id] && !w.HEROES[id].off), (id) => w.HEROES[id].name)}
        ${flat("affinities", L("Affinities", "Affinités"), (w.AFFS || []).slice(), (id) => w.affName(id))}
        ${flat("anomalies", L("Anomalies (no Anomaly door yet)", "Anomalies (pas encore de porte Anomalie)"), (w.ANOMALY_LIST || []).slice(), (id) => (w.ANOMALIES[id] || {}).name || id)}</div>`;
  }

  // ---------------------------------------------------------------- progression
  // v157 the choice after a won fight: A keys or B coupons, floor by floor (a floor with 0 and 0 has no choice)
  function rewardsTab(t) {
    t.rewards = t.rewards || {};
    const n = A.FN(t), rows = Array.from({ length: n - 1 }, (_, i) => i + 1).map((lv) => { const r = t.rewards[lv] || { k: 0, c: 0 }, on = !!(r.k || r.c);
      return `<div class="ae-rw${on ? " on" : ""}${t.bosses.includes(lv) ? " boss" : ""}"><b>${t.bosses.includes(lv) ? "☠ " : ""}${L("Fight", "Combat")} ${lv}</b>
        <label class="ae-rw-a"><span class="ae-pilldot blue">A</span>${L("keys", "clefs")}<input type="number" min="0" max="20" data-rw="${lv}" data-rk="k" value="${r.k || 0}"></label>
        <label class="ae-rw-b"><span class="ae-pilldot red">B</span>${L("coupons", "coupons")}<input type="number" min="0" max="20" data-rw="${lv}" data-rk="c" value="${r.c || 0}"></label>
        <small>${on ? L("the player chooses A or B after winning this fight", "le joueur choisit A ou B après avoir gagné ce combat") : L("no choice", "pas de choix")}</small></div>`; }).join("");
    return `<div class="ce-sec"><h4>${L("Choice after a fight: A keys or B coupons", "Choix après un combat : A clefs ou B coupons")}</h4>
      <p class="ce-hint">${L("After winning a fight that has a reward, the player sees two capsules, A (keys) and B (coupons), with how many of each, and takes one before the tavern. A key opens a door (the first door of a tavern is free); a coupon takes a card. Every tavern gives 1 coupon, +1 for each boss beaten. Leave 0 and 0 for no choice.", "Après avoir gagné un combat avec récompense, le joueur voit deux capsules, A (clefs) et B (coupons), avec leur nombre, et en prend une avant la taverne. Une clef ouvre une porte (la première porte d'une taverne est gratuite) ; un coupon prend une carte. Chaque taverne donne 1 coupon, +1 par boss vaincu. Laisse 0 et 0 pour aucun choix.")}</p>
      <div class="ae-rws">${rows}</div></div>`;
  }
  function progressTab(t) {
    return `<div class="ce-sec"><h4>${L("Levels", "Niveaux")}</h4>
        <p class="ce-hint">${L("How many floors (fights) this adventure has: winning the last one wins it.", "Combien d'étages (combats) compte cette aventure : gagner le dernier la gagne.")}</p>
        <div class="ae-tiers"><label class="ae-num">${L("Number of levels", "Nombre de niveaux")}<input type="number" min="3" max="${D.defaults.maxFights}" data-fights="1" value="${A.FN(t)}"></label></div></div>
      <div class="ce-sec"><h4>${L("Lives", "Vies")}</h4>
        <p class="ce-hint">${L("A lost fight costs a life and the run goes on to the next floor; a lost boss sends back to the tavern before it, to face it again. With no lives left, the run is over. Ad-spells can give or heal lives.", "Un combat perdu coûte une vie et la run continue à l'étage suivant ; un boss perdu renvoie à la taverne juste avant lui, pour le retenter. Sans vies, la run s'arrête. Des Ad-spells peuvent donner ou soigner des vies.")}</p>
        <div class="ae-tiers"><label class="ae-num">${L("Lives at the start", "Vies au départ")}<input type="number" min="1" max="9" data-lives="1" value="${t.lives}"></label></div></div>
      <div class="ce-sec"><h4>${L("Tavern tier", "Tier de taverne")}</h4>
        <p class="ce-hint">${L("There is no Upgrade button: the tavern tier rises with the fights. It is what “your tavern tier” means for the cards' effects, and the tier of the doors that do not set one.", "Il n'y a pas de bouton Améliorer : le tier de taverne monte avec les combats. C'est ce que « ton tier de taverne » veut dire pour les effets des cartes, et le tier des portes qui n'en fixent pas.")}</p>
        <div class="ae-tiers">${t.tierFrom.map((n, i) => `<label class="ae-num">Tier ${i + 1} ${L("from fight", "dès le combat")}<input type="number" min="1" max="${FIGHTS()}" data-tierfrom="${i}" value="${n}" ${i ? "" : "disabled"}></label>`).join("")}</div></div>
      <div class="ce-sec"><h4>${L("Bosses", "Boss")}</h4><p class="ce-hint">${L("The boss fights (marked on the bar and in the editor).", "Les combats de boss (marqués sur la barre et dans l'éditeur).")}</p>
        <div class="ae-strip">${Array.from({ length: FIGHTS() }, (_, i) => `<button type="button" class="ae-lv${t.bosses.includes(i + 1) ? " boss on" : ""}" data-act="bossTog" data-n="${i + 1}">${i + 1}</button>`).join("")}</div></div>`;
  }

  // ---------------------------------------------------------------- events
  function rerender() { const sc = host.scrollTop; draw(); host.scrollTop = sc; }
  function doorList(t, path) { return path === "tavern" ? t.tavern : t.floors[path.split(":")[1]].doors; }
  function onClick(e) {
    const b = e.target.closest("[data-act]"); if (!b || b.tagName === "SELECT" || (b.tagName === "INPUT" && b.type !== "checkbox")) return;
    const act = b.dataset.act, t = type();
    if (b.tagName === "INPUT" && b.type === "checkbox") return; // handled on change
    if (act === "pick") { sel = b.dataset.id; level = 1; edit = null; picker = null; iconPick = ""; rerender(); return; }
    if (act === "new") { const n = D.newType(L("New adventure", "Nouvelle aventure")); data.types.push(n); sel = n.id; tab = "boards"; save(true); rerender(); return; }
    if (act === "examples") { const ex = A.examples(); data.types.push(...ex); sel = ex[0].id; save(true); rerender(); return; }
    if (act === "export") { const blob = new Blob([JSON.stringify(A.normalize(data), null, 1)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "aventures.json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); return; }
    if (!t) return;
    if (act === "delete") { if (!confirm(L(`Delete the adventure “${t.name}”?`, `Supprimer l'aventure « ${t.name} » ?`))) return; data.types = data.types.filter((x) => x !== t); sel = data.types[0] ? data.types[0].id : ""; save(true); rerender(); return; }
    if (act === "tab") { tab = b.dataset.tab; rerender(); return; }
    if (act === "emblem") { t.emblem = b.dataset.e; save(); rerender(); return; }
    if (act === "diffRun") { runDiff(t); return; }
    if (act === "level") { level = +b.dataset.n; edit = null; picker = null; heroPick = -1; rerender(); return; }
    const list = t.boards[level] || (t.boards[level] = []), bi = +b.dataset.b, mi = +b.dataset.m;
    if (act === "newBoard") { list.push({ id: "b" + Date.now().toString(36), name: "", minions: [] }); save(); rerender(); return; }
    if (act === "dupBoard") { list.splice(bi + 1, 0, JSON.parse(JSON.stringify(Object.assign({}, list[bi], { id: "b" + Date.now().toString(36) })))); save(); rerender(); return; }
    if (act === "copyNext") { if (level >= FIGHTS()) return; (t.boards[level + 1] = t.boards[level + 1] || []).push(JSON.parse(JSON.stringify(Object.assign({}, list[bi], { id: "b" + Date.now().toString(36) })))); save(); api.status(L(`Copied to level ${level + 1}.`, `Copié au niveau ${level + 1}.`)); rerender(); return; }
    if (act === "delBoard") { list.splice(bi, 1); if (!list.length) delete t.boards[level]; edit = null; save(); rerender(); return; }
    if (act === "rmMinion") { list[bi].minions.splice(mi, 1); edit = null; save(); rerender(); return; }
    if (act === "gold") { list[bi].minions[mi].golden = !list[bi].minions[mi].golden; save(); rerender(); return; }
    if (act === "left" || act === "right") { const m = list[bi].minions, j = act === "left" ? mi - 1 : mi + 1; if (j < 0 || j >= m.length) return; [m[mi], m[j]] = [m[j], m[mi]]; if (edit && edit.b === bi && edit.m === mi) edit.m = j; save(); rerender(); return; }
    // v137 the stats and form of an enemy minion
    if (act === "mod") { edit = edit && edit.b === bi && edit.m === mi ? null : { b: bi, m: mi }; picker = null; rerender(); return; }
    // v139 the minion picker, the combat spells
    if (act === "pickOpen") { picker = picker && picker.b === bi ? null : { b: bi }; edit = null; rerender(); const q = host.querySelector("[data-pickq]"); if (q) q.focus(); return; }
    if (act === "pickClose") { picker = null; rerender(); return; }
    if (act === "pickAdd") { const bd = list[bi]; if (bd && bd.minions.length < 7) bd.minions.push({ card: b.dataset.id, golden: false }); if (!bd || bd.minions.length >= 7) picker = null; save(); rerender(); return; }
    if (act === "heroOpen") { heroPick = heroPick === bi ? -1 : bi; rerender(); return; }
    if (act === "heroSet") { const bd = list[bi]; if (bd) { bd.hero = b.dataset.id; heroPick = -1; save(); rerender(); } return; }
    if (act === "heroRm") { const bd = list[bi]; if (bd) { bd.hero = ""; save(); rerender(); } return; }
    if (act === "spRm") { const bd = list[bi]; if (bd) { bd.spells = (bd.spells || []).filter((_, k) => k !== +b.dataset.k); save(); rerender(); } return; }
    // v139 the icon of a door kind
    if (act === "iconPick") { iconPick = iconPick === b.dataset.k ? "" : b.dataset.k; rerender(); return; }
    if (act === "iconSet") { t.doorIcons = t.doorIcons || {}; if (b.dataset.v) t.doorIcons[b.dataset.k] = b.dataset.v; else delete t.doorIcons[b.dataset.k]; iconPick = ""; save(); rerender(); return; }
    if (edit && list[edit.b] && list[edit.b].minions[edit.m]) {
      const bd = list[edit.b], m = bd.minions[edit.m];
      if (act === "modClose") { edit = null; rerender(); return; }
      if (act === "modReset") { m.a = 0; m.h = 0; m.form = ""; m.kw = []; m.mk = null; delete m.evo; save(); rerender(); return; }
      if (act === "form") { m.form = b.dataset.v; save(); rerender(); return; }
      if (act === "evoTog") { const id = b.dataset.id, lvl = A.evoBefore(m.card)[+b.dataset.lv] || [], had = (m.evo || []).includes(id), l = (m.evo || []).filter((x) => !lvl.includes(x)); m.evo = had ? l : l.concat(id); if (!m.evo.length) delete m.evo; save(); rerender(); return; }
      if (act === "kwTog") { const k = b.dataset.k, l = m.kw || []; m.kw = l.includes(k) ? l.filter((x) => x !== k) : l.concat(k); save(); rerender(); return; }
      if (act === "mkTog") { const k = b.dataset.k, mk = m.mk || { p: 0, st: {}, kw: [] }; mk.kw = (mk.kw || []).includes(k) ? mk.kw.filter((x) => x !== k) : (mk.kw || []).concat(k); m.mk = mk.p || mk.kw.length || Object.keys(mk.st || {}).length ? mk : null; save(); rerender(); return; }
      if (act === "mkp") { const mk = m.mk || { p: 0, st: {}, kw: [] }, sz = b.dataset.sz || "1/1"; mk.st = mk.st || {};
        if (sz === "1/1") mk.p = Math.max(0, Math.min(30, (mk.p || 0) + +b.dataset.d)); else { const n = Math.max(0, Math.min(30, (mk.st[sz] || 0) + +b.dataset.d)); if (n) mk.st[sz] = n; else delete mk.st[sz]; }
        m.mk = mk.p || (mk.kw || []).length || Object.keys(mk.st).length ? mk : null; save(); rerender(); return; }
      if (act === "st") { const k = b.dataset.k, cur = built(bd)[edit.m]; if (!cur) return; setStat(bd, edit.m, k, (k === "a" ? cur.attack : cur.health) + +b.dataset.d); return; }
    }
    if (act === "doorAdd") { doorList(t, b.dataset.door).push({ type: "minion", tier: 0, tierMode: "upto", choices: 3, price: null, name: "" }); save(); rerender(); return; }
    if (act === "doorRm") { const l = doorList(t, b.dataset.door); l.splice(+b.dataset.i, 1); if (b.dataset.door === "tavern" && !l.length) l.push({ type: "minion", tier: 0, tierMode: "upto", choices: 3, price: null }); save(); rerender(); return; }
    if (act === "doorUp") { const l = doorList(t, b.dataset.door), i = +b.dataset.i; if (i > 0) [l[i - 1], l[i]] = [l[i], l[i - 1]]; save(); rerender(); return; }
    if (act === "floorAdd") { const n = Math.max(1, Math.min(FIGHTS() - 1, +host.querySelector("#aeFloorN").value || 1)); if (!t.floors[n]) t.floors[n] = { mode: "add", doors: [{ type: "hero", tier: 0, tierMode: "upto", choices: 3, price: null }] }; save(); rerender(); return; }
    if (act === "floorRm") { delete t.floors[b.dataset.n]; save(); rerender(); return; }
    if (act === "grp") { const g = b.dataset.g; if (openGroups.has(g)) openGroups.delete(g); else openGroups.add(g); rerender(); return; }
    if (act === "all") { const k = b.dataset.rk, on = b.dataset.on === "1", w = W(); const ids = k === "spells" ? Object.keys(w.SPELLS) : k === "heroes" ? w.HERO_LIST.slice() : k === "affinities" ? (w.AFFS || []).slice() : (w.ANOMALY_LIST || []).slice(); t.restrict[k] = on ? [] : ids; save(); rerender(); return; }
    if (act === "bossTog") { const n = +b.dataset.n; t.bosses = t.bosses.includes(n) ? t.bosses.filter((x) => x !== n) : t.bosses.concat(n).sort((x, y) => x - y); save(); rerender(); return; }
  }
  // a final Attack / Health typed or stepped: saved as what is added to the card's own (in the form it fights in)
  function setStat(bd, j, k, v) {
    const base = variant(bd, j, { a: 0, h: 0 }); if (!base) return;
    v = Math.max(k === "h" ? 1 : 0, Math.min(999, Math.round(+v) || 0));
    bd.minions[j][k] = v - (k === "a" ? base.attack : base.health); save(); rerender();
  }
  function onInput(e) {
    const x = e.target, t = type(); if (!t) return;
    if (x.dataset.pickq) { // v139 the picker's search, without redrawing the page
      pickQ = x.value; const q = pickQ.trim().toLowerCase(), box = x.closest(".ae-picker");
      for (const it of box.querySelectorAll(".ae-pk-it")) it.hidden = !!q && !nameOf(it.dataset.id).toLowerCase().includes(q);
      for (const g of box.querySelectorAll(".ae-pk-g")) g.hidden = ![...g.querySelectorAll(".ae-pk-it")].some((it) => !it.hidden);
      return;
    }
    if (x.dataset.f === "name" || x.dataset.f === "blurb") { t[x.dataset.f] = x.value; save(); const el = host.querySelector(`.ae-type.on b`); if (el && x.dataset.f === "name") el.textContent = x.value; return; }
    if (x.dataset.f === "color") { t.color = x.value; save(); return; }
  }
  function onChange(e) {
    const x = e.target, t = type();
    if (x.dataset.act === "import" && x.files && x.files[0]) {
      const r = new FileReader(); r.onload = () => { try { const got = A.normalize(JSON.parse(r.result)); for (const n of got.types) { if (data.types.some((y) => y.id === n.id)) n.id = D.newType().id; data.types.push(n); } sel = got.types[0] ? got.types[0].id : sel; save(true); rerender(); api.status(L(`${got.types.length} adventure(s) imported.`, `${got.types.length} aventure(s) importée(s).`)); } catch (err) { api.status(L("This file is not an adventure file.", "Ce fichier n'est pas un fichier d'aventures.")); } };
      r.readAsText(x.files[0]); return;
    }
    if (!t) return;
    if (x.dataset.f === "color") { t.color = x.value; save(); rerender(); return; }
    if (x.dataset.act === "boss") { t.bosses = x.checked ? [...new Set(t.bosses.concat(level))].sort((a, b) => a - b) : t.bosses.filter((n) => n !== level); save(); rerender(); return; }
    if (x.dataset.st && edit) { const bd = (t.boards[level] || [])[edit.b]; if (bd) setStat(bd, edit.m, x.dataset.st, x.value); return; }
    if (x.dataset.fights) { t.fights = Math.max(3, Math.min(D.defaults.maxFights, Math.round(+x.value) || 30)); x.value = t.fights; if (level > t.fights) level = t.fights; save(); rerender(); return; }
    if (x.dataset.act === "addSpell" && x.value) { const bd = (t.boards[level] || [])[+x.dataset.b]; if (bd) { bd.spells = (bd.spells || []).concat(x.value).slice(0, 6); save(); rerender(); } return; }
    if (x.dataset.iconimg && x.files && x.files[0]) { const k = x.dataset.iconimg; iconFromFile(x.files[0]).then((url) => { if (!url) { api.status(L("This picture could not be read.", "Cette image n'a pas pu être lue.")); return; } t.doorIcons = t.doorIcons || {}; t.doorIcons[k] = "img:" + url; iconPick = ""; save(); rerender(); }); return; }
    if (x.dataset.rw) { const lv = +x.dataset.rw, k = x.dataset.rk; t.rewards = t.rewards || {}; const r = t.rewards[lv] = Object.assign({ k: 0, c: 0 }, t.rewards[lv]); r[k] = Math.max(0, Math.min(20, Math.round(+x.value) || 0)); x.value = r[k]; if (!r.k && !r.c) delete t.rewards[lv]; save(); const row = x.closest(".ae-rw"); if (row) row.classList.toggle("on", !!(r.k || r.c)); return; } // v157
    if (x.dataset.lives) { t.lives = Math.max(1, Math.min(9, Math.round(+x.value) || 3)); x.value = t.lives; save(); return; }
    if (x.dataset.dname) { const v = x.value.trim().slice(0, 32); t.doorNames = t.doorNames || {}; if (v) t.doorNames[x.dataset.dname] = v; else delete t.doorNames[x.dataset.dname]; save(); return; }
    if (x.dataset.door) {
      const d = doorList(t, x.dataset.door)[+x.dataset.i], k = x.dataset.k;
      if (k === "name") { d.name = x.value.trim().slice(0, 32); save(); return; }
      if (k === "type") d.type = x.value; else if (k === "tier") d.tier = +x.value; else if (k === "tierMode") d.tierMode = x.value;
      else if (k === "choices") d.choices = Math.max(1, Math.min(6, +x.value || 3)); else if (k === "price") d.price = x.value === "" ? null : Math.max(0, Math.min(30, +x.value));
      save(); if (k === "type") rerender(); return;
    }
    if (x.dataset.floor) { t.floors[x.dataset.floor].mode = x.value; save(); return; }
    if (x.dataset.price) { if (x.value === "") delete t.prices[x.dataset.price]; else t.prices[x.dataset.price] = Math.max(0, Math.min(30, +x.value)); save(); return; }
    if (x.dataset.tierfrom) { const i = +x.dataset.tierfrom; t.tierFrom[i] = Math.max(1, Math.min(FIGHTS(), +x.value || 1)); for (let k = 1; k < 6; k++) if (t.tierFrom[k] < t.tierFrom[k - 1]) t.tierFrom[k] = t.tierFrom[k - 1]; save(); rerender(); return; }
    if (x.dataset.act === "tribeTog") { const g = x.dataset.t; t.restrict.tribes = x.checked ? t.restrict.tribes.filter((y) => y !== g) : [...new Set(t.restrict.tribes.concat(g))]; save(); rerender(); return; }
    if (x.dataset.rk) { const k = x.dataset.rk, id = x.dataset.id; t.restrict[k] = x.checked ? t.restrict[k].filter((y) => y !== id) : [...new Set(t.restrict[k].concat(id))]; save(); const g = x.closest(".ae-grp"); const sm = g && g.querySelector(".ae-ghead small"); if (sm && k !== "cards") { const all = g.querySelectorAll("input[data-rk]").length, on = g.querySelectorAll("input[data-rk]:checked").length; sm.textContent = `${on}/${all}`; } return; }
  }

  // a picture made into a small square icon (kept with the adventure)
  function iconFromFile(file) {
    return new Promise((res) => {
      const fr2 = new FileReader(); fr2.onerror = () => res(""); fr2.onload = () => {
        const im = new Image(); im.onerror = () => res(""); im.onload = () => {
          const S = 112, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d"), k = Math.min(S / im.width, S / im.height), w2 = im.width * k, h2 = im.height * k;
          g.drawImage(im, (S - w2) / 2, (S - h2) / 2, w2, h2); let u = ""; try { u = c.toDataURL("image/webp", 0.9); } catch (e) { u = ""; } if (!/^data:image\/webp/.test(u)) u = c.toDataURL("image/png"); res(u);
        }; im.src = fr2.result;
      }; fr2.readAsDataURL(file);
    });
  }
  root.WA_ADV_EDITOR = { render };
})(typeof window !== "undefined" ? window : globalThis);
