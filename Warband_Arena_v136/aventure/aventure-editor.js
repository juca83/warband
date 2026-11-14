// Adventure mode: its editor (Studio › Adventure). Types of adventure, their enemy boards (levels 1-30, several boards a
// level), their taverns (the doors of every tavern, special floors), the prices of the special doors, their restrictions and
// their progression. Saved with the meta (WA_STORE.saveAdventure); it only refers to the game's cards, never changes them.
(function (root) {
  const D = root.WA_ADV_DATA, A = root.WA_ADV;
  let api = null, host = null, data = null, sel = "", tab = "boards", level = 1, openGroups = new Set(), saveT = 0;
  const W = () => root.WA;
  const fr = () => !!(root.WA_I18N && root.WA_I18N.lang === "fr");
  const L = (en, f) => (fr() ? f : en);
  const esc = (s) => api.esc(String(s == null ? "" : s));
  const type = () => data.types.find((t) => t.id === sel) || null;
  const FIGHTS = () => D.defaults.fights;
  const doorName = (k) => (fr() ? D.doors[k].fr : D.doors[k].name);
  const svg = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const emblem = (k) => svg(D.emblemArt[k] || D.emblemArt.compass);
  const glyph = (k) => svg(D.glyphArt[k] || D.glyphArt.minion);
  const nameOf = (id) => { const w = W(), d = w.CARDS[id] || w.TOKENS[id] || w.SPELLS[id]; return d ? d.name : id; };

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
  }

  // ---------------------------------------------------------------- the page
  function draw() {
    const t = type();
    host.innerHTML = `<div class="st-head"><h3>${L("Adventure", "Aventure")}</h3><p class="ce-hint">${L("The Adventure mode: a run of fights against the boards you build, with taverns of doors between them. Everything here is saved with this meta and only uses its cards (it never changes them).", "Le mode Aventure : une suite de combats contre les boards que tu construis, avec des tavernes à portes entre eux. Tout ici est enregistré avec cette méta et ne fait qu'utiliser ses cartes (sans jamais les modifier).")}</p></div>
      <div class="ae-wrap">
        <aside class="ae-types">
          ${data.types.map((x) => `<button type="button" class="ae-type${x.id === sel ? " on" : ""}" data-act="pick" data-id="${esc(x.id)}" style="--ac:${esc(x.color)}"><span class="adv-medal sm" style="--ac:${esc(x.color)}">${emblem(x.emblem)}</span><span><b>${esc(x.name)}</b><small>${A.filledLevels(x).length}/${FIGHTS()} ${L("levels", "niveaux")}</small></span></button>`).join("")}
          <button type="button" class="pill small" data-act="new">+ ${L("New adventure", "Nouvelle aventure")}</button>
          ${data.types.length ? "" : `<button type="button" class="pill small" data-act="examples">${L("Make the 2 examples", "Créer les 2 exemples")}</button>`}
          <div class="ae-io"><button type="button" class="ce-mini" data-act="export" title="${esc(L("Export the adventures as a file", "Exporter les aventures en fichier"))}">⤓ ${L("Export", "Exporter")}</button><label class="ce-mini" title="${esc(L("Import adventures from a file", "Importer des aventures d'un fichier"))}">⤒ ${L("Import", "Importer")}<input type="file" accept=".json,application/json" data-act="import" hidden></label></div>
        </aside>
        <section class="ae-main">${t ? typePage(t) : `<div class="ce-empty">${L("No adventure yet: make one with “+ New adventure”.", "Aucune aventure : crée-en une avec « + Nouvelle aventure ».")}</div>`}</section>
      </div>`;
    if (t && tab === "boards") fillBoards(t);
  }
  function typePage(t) {
    const tabs = [["boards", L("Enemy boards", "Boards ennemis")], ["taverns", L("Taverns", "Tavernes")], ["prices", L("Prices", "Prix")], ["restrict", L("Restrictions", "Restrictions")], ["progress", L("Progression", "Progression")]];
    return `<div class="ae-head" style="--ac:${esc(t.color)}">
        <div class="ae-emblems">${D.emblems.map((e) => `<button type="button" class="ae-emb${t.emblem === e ? " on" : ""}" data-act="emblem" data-e="${e}" title="${e}">${emblem(e)}</button>`).join("")}</div>
        <div class="ae-fields"><label class="ce-sel wide">${L("Name", "Nom")}<input data-f="name" value="${esc(t.name)}" maxlength="40"></label>
          <label class="ce-sel wide">${L("Description (shown when choosing)", "Description (affichée au choix)")}<input data-f="blurb" value="${esc(t.blurb)}" maxlength="400"></label></div>
        <label class="ce-sel ae-color">${L("Colour", "Couleur")}<input type="color" data-f="color" value="${esc(t.color)}"></label>
        <button type="button" class="ce-mini del" data-act="delete" title="${esc(L("Delete this adventure", "Supprimer cette aventure"))}">🗑</button></div>
      <nav class="ae-tabs">${tabs.map(([k, l]) => `<button type="button" class="ae-tab${tab === k ? " on" : ""}" data-act="tab" data-tab="${k}">${l}</button>`).join("")}</nav>
      <div class="ae-body">${{ boards: boardsTab, taverns: tavernsTab, prices: pricesTab, restrict: restrictTab, progress: progressTab }[tab](t)}</div>`;
  }

  // ---------------------------------------------------------------- enemy boards
  function boardsTab(t) {
    const filled = A.filledLevels(t), list = t.boards[level] || [], boss = t.bosses.includes(level);
    const strip = Array.from({ length: FIGHTS() }, (_, i) => { const n = i + 1; return `<button type="button" class="ae-lv${n === level ? " sel" : ""}${filled.includes(n) ? " on" : ""}${t.bosses.includes(n) ? " boss" : ""}" data-act="level" data-n="${n}" title="${esc((t.bosses.includes(n) ? "Boss · " : "") + L("level ", "niveau ") + n)}">${n}</button>`; }).join("");
    const opts = minionOptions();
    return `<div class="ae-strip">${strip}</div>
      <div class="ae-lvhead"><h4>${L("Level", "Niveau")} ${level}${boss ? ` <span class="ae-boss">BOSS</span>` : ""}</h4>
        <label class="ce-check"><input type="checkbox" data-act="boss" ${boss ? "checked" : ""}> ${L("Boss fight", "Combat de boss")}</label>
        <span class="ce-hint">${list.length > 1 ? L(`${list.length} boards: one is drawn at random`, `${list.length} boards : l'un est tiré au hasard`) : L("Several boards on a level: one is drawn at random in the game.", "Plusieurs boards sur un niveau : l'un est tiré au hasard en jeu.")}</span></div>
      ${list.map((b, i) => `<div class="ae-board" data-b="${i}">
        <div class="ae-bhead"><b>${L("Board", "Board")} ${String.fromCharCode(65 + i)}</b><span class="ae-bsum">${boardSum(b)}</span>
          <span class="ae-bbtns"><button type="button" class="ce-mini" data-act="dupBoard" data-b="${i}" title="${esc(L("Duplicate", "Dupliquer"))}">⧉</button><button type="button" class="ce-mini" data-act="copyNext" data-b="${i}" title="${esc(L("Copy to the next level", "Copier au niveau suivant"))}">→ ${level + 1 <= FIGHTS() ? level + 1 : ""}</button><button type="button" class="ce-mini del" data-act="delBoard" data-b="${i}" title="${esc(L("Delete this board", "Supprimer ce board"))}">✕</button></span></div>
        <div class="ae-row">${b.minions.map((m, j) => `<div class="ae-mn"><div class="ae-slot" data-b="${i}" data-m="${j}"></div><div class="ae-mctl"><button type="button" class="ce-mini" data-act="left" data-b="${i}" data-m="${j}" ${j ? "" : "disabled"}>◀</button><button type="button" class="ce-mini${m.golden ? " on" : ""}" data-act="gold" data-b="${i}" data-m="${j}" title="${esc(L("Golden", "Doré"))}">★</button><button type="button" class="ce-mini" data-act="right" data-b="${i}" data-m="${j}" ${j < b.minions.length - 1 ? "" : "disabled"}>▶</button><button type="button" class="ce-mini del" data-act="rmMinion" data-b="${i}" data-m="${j}">✕</button></div></div>`).join("")}
          ${b.minions.length < 7 ? `<div class="ae-add"><select data-act="addMinion" data-b="${i}"><option value="">+ ${L("Add a minion", "Ajouter un serviteur")}</option>${opts}</select></div>` : ""}</div></div>`).join("")}
      <button type="button" class="pill" data-act="newBoard">+ ${L(`New board on level ${level}`, `Nouveau board au niveau ${level}`)}</button>`;
  }
  let optCache = "";
  function minionOptions() {
    if (optCache) return optCache;
    const w = W(), groups = {};
    const ids = [...new Set([...Object.keys(w.CARDS), ...Object.keys(w.TOKENS)])].filter((id) => { const d = w.CARDS[id] || w.TOKENS[id]; return d && !d.retired; });
    for (const id of ids) { const d = w.CARDS[id] || w.TOKENS[id], tok = !w.CARDS[id] || w.CARDS[id].inPool === false, g = tok ? "~tok" : d.allTribes ? "*all" : w.tribesOf(d).filter(Boolean)[0] || "~neutral"; (groups[g] = groups[g] || []).push(id); }
    const gname = (g) => (g === "~tok" ? L("Tokens / not in the tavern", "Jetons / hors taverne") : g === "~neutral" ? L("Neutral", "Neutre") : g === "*all" ? L("All tribes", "Toutes tribus") : w.tribeName(g));
    const tierOf = (id) => (w.CARDS[id] || w.TOKENS[id]).tier || 0;
    optCache = Object.keys(groups).sort((a, b) => (a[0] === "~" ? 1 : 0) - (b[0] === "~" ? 1 : 0) || gname(a).localeCompare(gname(b))).map((g) => `<optgroup label="${esc(gname(g))}">${groups[g].sort((a, b) => tierOf(a) - tierOf(b) || nameOf(a).localeCompare(nameOf(b))).map((id) => `<option value="${esc(id)}">T${tierOf(id)} · ${esc(nameOf(id))}</option>`).join("")}</optgroup>`).join("");
    return optCache;
  }
  function boardSum(b) {
    const w = W(); let a = 0, h = 0;
    for (const m of b.minions) { const d = w.CARDS[m.card] || w.TOKENS[m.card]; if (!d) continue; a += (d.attack || 0) * (m.golden ? 2 : 1); h += (d.health || 0) * (m.golden ? 2 : 1); }
    return `${b.minions.length}/7 · ${a}/${h}`;
  }
  function fillBoards(t) {
    const w = W();
    for (const s of host.querySelectorAll(".ae-slot")) {
      const m = (t.boards[level] || [])[+s.dataset.b].minions[+s.dataset.m];
      if (!(w.CARDS[m.card] || w.TOKENS[m.card])) { s.innerHTML = `<div class="ae-missing">${esc(m.card)}<small>${L("not in this meta", "absent de cette méta")}</small></div>`; continue; }
      const tk = api.helpers.makeToken(new w.Minion(m.card, !!m.golden).dict(), { static: true }); s.appendChild(tk);
    }
  }

  // ---------------------------------------------------------------- taverns
  function doorRow(d, path, i) {
    const tierSel = `<select data-door="${path}" data-i="${i}" data-k="tier"><option value="0"${!d.tier ? " selected" : ""}>${L("Tavern tier", "Tier de la taverne")}</option>${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}"${d.tier === n ? " selected" : ""}>Tier ${n}</option>`).join("")}</select>`;
    const T = D.doors[d.type], tiered = T.source === "tier" || T.source === "dominantTribe" || T.source === "dominantAffinity";
    return `<div class="ae-door" style="--dc:${esc(T.color)}"><span class="ae-dico">${glyph(d.type)}</span>
      <select data-door="${path}" data-i="${i}" data-k="type">${D.doorOrder.map((k) => `<option value="${k}"${d.type === k ? " selected" : ""}>${esc(doorName(k))}</option>`).join("")}</select>
      ${tiered ? tierSel + `<select data-door="${path}" data-i="${i}" data-k="tierMode"><option value="upto"${d.tierMode !== "exact" ? " selected" : ""}>${L("or lower", "ou moins")}</option><option value="exact"${d.tierMode === "exact" ? " selected" : ""}>${L("exactly", "exactement")}</option></select>` : `<span class="ae-dnote">${T.source === "tierUp" ? L("tier of the tavern + 1", "tier de la taverne + 1") : L("any allowed hero", "un héros autorisé")}</span>`}
      <label class="ae-num">${L("choices", "choix")}<input type="number" min="1" max="6" data-door="${path}" data-i="${i}" data-k="choices" value="${d.choices}"></label>
      <label class="ae-num">${L("price", "prix")}<input type="number" min="0" max="30" data-door="${path}" data-i="${i}" data-k="price" value="${d.price == null ? "" : d.price}" placeholder="${esc(defPriceTxt(type(), d.type))}"></label>
      <span class="ae-dbtns"><button type="button" class="ce-mini" data-act="doorUp" data-door="${path}" data-i="${i}" ${i ? "" : "disabled"}>▲</button><button type="button" class="ce-mini del" data-act="doorRm" data-door="${path}" data-i="${i}">✕</button></span></div>`;
  }
  const defPriceTxt = (t, k) => { const p = t.prices[k] != null ? t.prices[k] : D.doors[k].price; return p == null ? (k === "spell" ? L("cost", "coût") : "3") : String(p); };
  function tavernsTab(t) {
    const floors = Object.keys(t.floors).map(Number).sort((a, b) => a - b);
    return `<div class="ce-sec"><h4>${L("Every tavern", "Chaque taverne")}</h4>
        <p class="ce-hint">${L("The doors of every tavern between two fights. There is always at least a Minion door and a Spell door (added if missing). Opening: the first door is free, then 1, 2, 3… gold (back to 0 each tavern). The price is that of each choice behind the door (empty = the door's price, see Prices).", "Les portes de chaque taverne entre deux combats. Il y a toujours au moins une porte Serviteurs et une porte Sorts (ajoutées si elles manquent). Ouverture : la 1re porte est gratuite, puis 1, 2, 3… or (retour à 0 à chaque taverne). Le prix est celui de chaque choix derrière la porte (vide = le prix de la porte, voir Prix).")}</p>
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
    return `<div class="ce-sec"><h4>${L("Prices of the doors' choices", "Prix des choix derrière les portes")}</h4>
      <p class="ce-hint">${L("What each choice behind a door of that kind costs in this adventure (a door can still set its own price in Taverns). Empty = the default.", "Ce que coûte chaque choix derrière une porte de ce type dans cette aventure (une porte peut encore fixer son propre prix dans Tavernes). Vide = la valeur par défaut.")}</p>
      <div class="ae-prices">${D.doorOrder.map((k) => `<label class="ae-price" style="--dc:${esc(D.doors[k].color)}"><span class="ae-dico">${glyph(k)}</span><b>${esc(doorName(k))}</b>${D.doors[k].special ? `<em>${L("special", "spéciale")}</em>` : ""}
        <input type="number" min="0" max="30" data-price="${k}" value="${t.prices[k] == null ? "" : t.prices[k]}" placeholder="${esc(D.doors[k].price == null ? (k === "spell" ? L("cost", "coût") : "3") : String(D.doors[k].price))}"><small>${L("gold", "or")}</small></label>`).join("")}</div></div>`;
  }

  // ---------------------------------------------------------------- restrictions
  function restrictTab(t) {
    const w = W(), R = t.restrict, outT = new Set(R.tribes), outC = new Set(R.cards);
    const tribes = w.availableTribes(), byT = {};
    for (const id of Object.keys(w.CARDS)) { const d = w.CARDS[id]; if (!d || d.inPool === false || d.retired || d.affOnly || (w.EVO_T && w.EVO_T.has(id))) continue; const g = d.allTribes ? "*all" : w.tribesOf(d).filter(Boolean)[0] || "*neutral"; (byT[g] = byT[g] || []).push(id); }
    const groups = [...tribes, "*neutral", "*all"].filter((g) => byT[g] || tribes.includes(g));
    const gname = (g) => (g === "*neutral" ? L("Neutral", "Neutres") : g === "*all" ? L("All tribes", "Toutes tribus") : w.tribeName(g));
    const tierOf = (id) => (w.CARDS[id] || w.SPELLS[id]).tier || 0;
    const card = (id, kind) => `<label class="ae-it"><input type="checkbox" data-rk="${kind}" data-id="${esc(id)}" ${(kind === "cards" ? outC : new Set(R[kind])).has(id) ? "" : "checked"}><span>T${tierOf(id)} · ${esc(nameOf(id))}</span></label>`;
    const tribeBlock = (g) => {
      const l = (byT[g] || []).sort((a, b) => tierOf(a) - tierOf(b) || nameOf(a).localeCompare(nameOf(b))), off = outT.has(g), kept = l.filter((id) => !outC.has(id)).length;
      return `<div class="ae-grp${off ? " off" : ""}" data-tribe="${esc(g)}"><div class="ae-ghead"><label class="ae-tog"><input type="checkbox" data-act="tribeTog" data-t="${esc(g)}" ${off ? "" : "checked"}><b>${esc(gname(g))}</b></label>
        <small>${off ? L("left out", "retirée") : `${kept}/${l.length}`}</small><button type="button" class="ce-mini" data-act="grp" data-g="${esc("t:" + g)}">${openGroups.has("t:" + g) ? "▾" : "▸"}</button></div>
        ${openGroups.has("t:" + g) && !off ? `<div class="ae-items">${l.map((id) => card(id, "cards")).join("")}</div>` : ""}</div>`;
    };
    const flat = (key, title, ids, label) => `<div class="ae-grp"><div class="ae-ghead"><b>${title}</b><small>${ids.filter((id) => !R[key].includes(id)).length}/${ids.length}</small>
        <button type="button" class="ce-mini" data-act="all" data-rk="${key}" data-on="1">${L("all", "tout")}</button><button type="button" class="ce-mini" data-act="all" data-rk="${key}" data-on="0">${L("none", "rien")}</button>
        <button type="button" class="ce-mini" data-act="grp" data-g="${key}">${openGroups.has(key) ? "▾" : "▸"}</button></div>
        ${openGroups.has(key) ? `<div class="ae-items">${ids.map((id) => `<label class="ae-it"><input type="checkbox" data-rk="${key}" data-id="${esc(id)}" ${R[key].includes(id) ? "" : "checked"}><span>${esc(label(id))}</span></label>`).join("")}</div>` : ""}</div>`;
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
  function progressTab(t) {
    return `<div class="ce-sec"><h4>${L("Tavern tier", "Tier de taverne")}</h4>
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
    if (act === "pick") { sel = b.dataset.id; level = 1; rerender(); return; }
    if (act === "new") { const n = D.newType(L("New adventure", "Nouvelle aventure")); data.types.push(n); sel = n.id; tab = "boards"; save(true); rerender(); return; }
    if (act === "examples") { const ex = A.examples(); data.types.push(...ex); sel = ex[0].id; save(true); rerender(); return; }
    if (act === "export") { const blob = new Blob([JSON.stringify(A.normalize(data), null, 1)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "aventures.json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); return; }
    if (!t) return;
    if (act === "delete") { if (!confirm(L(`Delete the adventure “${t.name}”?`, `Supprimer l'aventure « ${t.name} » ?`))) return; data.types = data.types.filter((x) => x !== t); sel = data.types[0] ? data.types[0].id : ""; save(true); rerender(); return; }
    if (act === "tab") { tab = b.dataset.tab; rerender(); return; }
    if (act === "emblem") { t.emblem = b.dataset.e; save(); rerender(); return; }
    if (act === "level") { level = +b.dataset.n; rerender(); return; }
    const list = t.boards[level] || (t.boards[level] = []), bi = +b.dataset.b, mi = +b.dataset.m;
    if (act === "newBoard") { list.push({ id: "b" + Date.now().toString(36), name: "", minions: [] }); save(); rerender(); return; }
    if (act === "dupBoard") { list.splice(bi + 1, 0, JSON.parse(JSON.stringify(Object.assign({}, list[bi], { id: "b" + Date.now().toString(36) })))); save(); rerender(); return; }
    if (act === "copyNext") { if (level >= FIGHTS()) return; (t.boards[level + 1] = t.boards[level + 1] || []).push(JSON.parse(JSON.stringify(Object.assign({}, list[bi], { id: "b" + Date.now().toString(36) })))); save(); api.status(L(`Copied to level ${level + 1}.`, `Copié au niveau ${level + 1}.`)); rerender(); return; }
    if (act === "delBoard") { list.splice(bi, 1); if (!list.length) delete t.boards[level]; save(); rerender(); return; }
    if (act === "rmMinion") { list[bi].minions.splice(mi, 1); save(); rerender(); return; }
    if (act === "gold") { list[bi].minions[mi].golden = !list[bi].minions[mi].golden; save(); rerender(); return; }
    if (act === "left" || act === "right") { const m = list[bi].minions, j = act === "left" ? mi - 1 : mi + 1; if (j < 0 || j >= m.length) return; [m[mi], m[j]] = [m[j], m[mi]]; save(); rerender(); return; }
    if (act === "doorAdd") { doorList(t, b.dataset.door).push({ type: "minion", tier: 0, tierMode: "upto", choices: 3, price: null }); save(); rerender(); return; }
    if (act === "doorRm") { const l = doorList(t, b.dataset.door); l.splice(+b.dataset.i, 1); if (b.dataset.door === "tavern" && !l.length) l.push({ type: "minion", tier: 0, tierMode: "upto", choices: 3, price: null }); save(); rerender(); return; }
    if (act === "doorUp") { const l = doorList(t, b.dataset.door), i = +b.dataset.i; if (i > 0) [l[i - 1], l[i]] = [l[i], l[i - 1]]; save(); rerender(); return; }
    if (act === "floorAdd") { const n = Math.max(1, Math.min(FIGHTS() - 1, +host.querySelector("#aeFloorN").value || 1)); if (!t.floors[n]) t.floors[n] = { mode: "add", doors: [{ type: "hero", tier: 0, tierMode: "upto", choices: 3, price: null }] }; save(); rerender(); return; }
    if (act === "floorRm") { delete t.floors[b.dataset.n]; save(); rerender(); return; }
    if (act === "grp") { const g = b.dataset.g; if (openGroups.has(g)) openGroups.delete(g); else openGroups.add(g); rerender(); return; }
    if (act === "all") { const k = b.dataset.rk, on = b.dataset.on === "1", w = W(); const ids = k === "spells" ? Object.keys(w.SPELLS) : k === "heroes" ? w.HERO_LIST.slice() : k === "affinities" ? (w.AFFS || []).slice() : (w.ANOMALY_LIST || []).slice(); t.restrict[k] = on ? [] : ids; save(); rerender(); return; }
    if (act === "bossTog") { const n = +b.dataset.n; t.bosses = t.bosses.includes(n) ? t.bosses.filter((x) => x !== n) : t.bosses.concat(n).sort((x, y) => x - y); save(); rerender(); return; }
  }
  function onInput(e) {
    const x = e.target, t = type(); if (!t) return;
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
    if (x.dataset.act === "addMinion" && x.value) { const l = t.boards[level] || (t.boards[level] = []), b = l[+x.dataset.b]; if (b.minions.length < 7) b.minions.push({ card: x.value, golden: false }); save(); rerender(); return; }
    if (x.dataset.act === "boss") { t.bosses = x.checked ? [...new Set(t.bosses.concat(level))].sort((a, b) => a - b) : t.bosses.filter((n) => n !== level); save(); rerender(); return; }
    if (x.dataset.door) {
      const d = doorList(t, x.dataset.door)[+x.dataset.i], k = x.dataset.k;
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

  root.WA_ADV_EDITOR = { render };
})(typeof window !== "undefined" ? window : globalThis);
