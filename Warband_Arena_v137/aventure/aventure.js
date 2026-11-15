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
      <p class="adv-sub">${L(`${D.defaults.fights} fights in a row against set boards, bosses on the way. Between fights, open the tavern's doors. A lost fight costs Health: at 0, the run is over.`, `${D.defaults.fights} combats d'affilée contre des boards préparés, avec des boss en chemin. Entre deux combats, ouvre les portes de la taverne. Un combat perdu coûte des PV : à 0, la run s'arrête.`)}</p>
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
    queueMicrotask(() => { const r = H.$("#shop"); if (!r) return; r.classList.toggle("adv-one", gi <= 1); for (const el of r.children) { const g = group.get(String(el.dataset.uid)); el.classList.toggle("adv-gs", g != null && g > 0); } });
    return out;
  }
  function makeItem(d) {
    return d.advItem === "door" ? makeDoor(d.door) : makeHero(d.hero, d.door);
  }
  const doorLabel = (d) => A.doorName(type, d.spec);
  // v137 a door: a carved stone arch (its keystone holds a gem of the door's colour), an oak leaf with iron straps and a
  // glowing medallion of its kind; the magic behind it shines through the gaps, more on hover, and floods out as it opens
  let artN = 0;
  function doorArt(d) {
    const n = ++artN, id = (k) => `adv${n}${k}`, g = GLYPH[d.def.glyph] || GLYPH.minion;
    const pt = (r, a) => `${(60 + r * Math.cos(a * Math.PI / 180)).toFixed(2)} ${(58 - r * Math.sin(a * Math.PI / 180)).toFixed(2)}`;
    const joints = [160, 140, 120, 60, 40, 20].map((a) => `M${pt(36, a)} L${pt(50, a)}`).join(" ");
    const key = `M${pt(36, 100)} L${pt(56, 101)} L${pt(56, 79)} L${pt(36, 80)} A36 36 0 0 0 ${pt(36, 100)} Z`;
    const grain = (x) => `M${x + 3} 0 C${x + 5} 30 ${x + 2} 60 ${x + 4} 128 M${x + 9} 0 C${x + 8} 40 ${x + 11} 80 ${x + 9.5} 128`;
    const strap = (y) => `<path d="M0 ${y} H48 L57 ${y + 3.6} L48 ${y + 7.2} H0 Z" fill="url(#${id("ir")})"/><path d="M0 ${y + .6} H47.6" stroke="rgba(255,255,255,.28)" stroke-width=".7"/>` +
      [5, 17, 29, 41].map((x) => `<circle cx="${x}" cy="${y + 3.6}" r="1.45" fill="url(#${id("rv")})"/>`).join("");
    const runes = Array.from({ length: 12 }, (_, i) => { const a = i * 30, r1 = 17.2, r2 = 19.6, c = (r, aa) => `${(36 + r * Math.cos(aa * Math.PI / 180)).toFixed(2)} ${(72 + r * Math.sin(aa * Math.PI / 180)).toFixed(2)}`; return i % 3 === 0 ? `<path d="M${c(r1, a - 3)} L${c(r2, a)} L${c(r1, a + 3)}"/>` : `<path d="M${c(r1, a)} L${c(r2, a)}"/>`; }).join("");
    const arch = `<svg class="dr-arch" viewBox="0 0 120 160" aria-hidden="true"><defs>
        <linearGradient id="${id("st")}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b6aa96"/><stop offset=".55" stop-color="#8a7f6e"/><stop offset="1" stop-color="#5e5649"/></linearGradient>
        <linearGradient id="${id("k")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6cbb6"/><stop offset="1" stop-color="#93876f"/></linearGradient>
        <linearGradient id="${id("gm")}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".35" style="stop-color:var(--dc)"/><stop offset="1" stop-color="#1a0f05"/></linearGradient>
        <filter id="${id("n")}" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="${n % 9}"/><feColorMatrix values="0 0 0 0 .1  0 0 0 0 .08  0 0 0 0 .05  0 0 0 -1.6 1.15"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs>
      <path d="M10 152 V58 A50 50 0 0 1 110 58 V152 Z M24 152 V58 A36 36 0 0 1 96 58 V152 Z" fill="url(#${id("st")})" fill-rule="evenodd"/>
      <path d="M10 152 V58 A50 50 0 0 1 110 58 V152 Z M24 152 V58 A36 36 0 0 1 96 58 V152 Z" fill="#000" fill-rule="evenodd" filter="url(#${id("n")})" opacity=".55"/>
      <path d="${joints} M10 82 H24 M10 106 H24 M10 130 H24 M96 82 H110 M96 106 H110 M96 130 H110" stroke="#2b241d" stroke-width="1.1" stroke-linecap="round"/>
      <path d="M24 152 V58 A36 36 0 0 1 96 58 V152" fill="none" stroke="#1b1611" stroke-width="2.6"/>
      <path class="dr-seam" d="M25.6 150.4 V58 A34.4 34.4 0 0 1 94.4 58 V150.4 Z" fill="none" style="stroke:color-mix(in srgb, var(--dc) 45%, #fff)" stroke-width="2.3" stroke-linejoin="round"/>
      <path d="M26.6 152 V58 A33.4 33.4 0 0 1 93.4 58 V152" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="2.4"/>
      <path d="M10.6 152 V58 A49.4 49.4 0 0 1 109.4 58 V152" fill="none" stroke="rgba(255,248,230,.35)" stroke-width="1"/>
      <rect x="6.5" y="54" width="21" height="6.5" rx="1.4" fill="url(#${id("k")})" stroke="#2b241d" stroke-width=".9"/><rect x="92.5" y="54" width="21" height="6.5" rx="1.4" fill="url(#${id("k")})" stroke="#2b241d" stroke-width=".9"/>
      <rect x="6.5" y="139" width="21" height="13" rx="1.4" fill="url(#${id("st")})" stroke="#2b241d" stroke-width=".9"/><rect x="92.5" y="139" width="21" height="13" rx="1.4" fill="url(#${id("st")})" stroke="#2b241d" stroke-width=".9"/>
      <path d="${key}" fill="url(#${id("k")})" stroke="#2b241d" stroke-width="1"/>
      <g class="dr-gem"><path d="M60 3.6 L67 11.6 L60 19.6 L53 11.6 Z" fill="url(#${id("gm")})" stroke="#1d1308" stroke-width=".9"/><path d="M60 3.6 L63.4 11.6 L60 19.6 M53 11.6 H67" fill="none" stroke="rgba(255,255,255,.45)" stroke-width=".6"/><circle cx="57.6" cy="8.8" r="1.2" fill="#fff" opacity=".9"/></g>
      <rect x="3" y="150.5" width="114" height="8" rx="2.2" fill="url(#${id("k")})" stroke="#2b241d" stroke-width=".9"/><path d="M4.5 151.6 H115.5" stroke="rgba(255,255,255,.45)" stroke-width=".8"/></svg>`;
    const leaf = `<svg viewBox="0 0 72 128" aria-hidden="true"><defs>
        <clipPath id="${id("c")}"><path d="M1.6 128 V36 A34.4 34.4 0 0 1 70.4 36 V128 Z"/></clipPath>
        <linearGradient id="${id("w1")}" x1="0" x2="1"><stop offset="0" stop-color="#8a5732"/><stop offset=".5" stop-color="#6c3f22"/><stop offset="1" stop-color="#4a2914"/></linearGradient>
        <linearGradient id="${id("w2")}" x1="0" x2="1"><stop offset="0" stop-color="#7b4a29"/><stop offset=".5" stop-color="#5f361c"/><stop offset="1" stop-color="#3f2211"/></linearGradient>
        <linearGradient id="${id("sh")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".62"/><stop offset=".38" stop-color="#000" stop-opacity="0"/><stop offset=".86" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>
        <linearGradient id="${id("ir")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c838e"/><stop offset=".5" stop-color="#3b4048"/><stop offset="1" stop-color="#1c1f24"/></linearGradient>
        <radialGradient id="${id("rv")}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#eef1f6"/><stop offset=".5" stop-color="#8a929e"/><stop offset="1" stop-color="#2a2e34"/></radialGradient>
        <radialGradient id="${id("br")}" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#fff0b8"/><stop offset=".45" stop-color="#d4a345"/><stop offset="1" stop-color="#5c3c10"/></radialGradient>
        <radialGradient id="${id("md")}" cx=".42" cy=".36" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".3" style="stop-color:color-mix(in srgb, var(--dc) 55%, #fff)"/><stop offset=".75" style="stop-color:var(--dc)"/><stop offset="1" style="stop-color:color-mix(in srgb, var(--dc) 45%, #000)"/></radialGradient></defs>
      <g clip-path="url(#${id("c")})">
        ${[0, 1, 2, 3, 4].map((k) => `<rect x="${k * 14.4}" y="0" width="14.4" height="128" fill="url(#${id(k % 2 ? "w2" : "w1")})"/>`).join("")}
        <path d="${[0, 1, 2, 3, 4].map((k) => grain(k * 14.4)).join(" ")}" fill="none" stroke="rgba(28,12,4,.42)" stroke-width=".55"/>
        <path d="M14.4 0 V128 M28.8 0 V128 M43.2 0 V128 M57.6 0 V128" stroke="#24120a" stroke-width=".9"/>
        <rect width="72" height="128" fill="url(#${id("sh")})"/>
        ${strap(40)}${strap(102)}
        <rect x="0" y="38.4" width="3.2" height="10.4" rx=".8" fill="#2a2e34"/><rect x="0" y="100.4" width="3.2" height="10.4" rx=".8" fill="#2a2e34"/>
      </g>
      <path d="M1.6 128 V36 A34.4 34.4 0 0 1 70.4 36 V128" fill="none" stroke="#1a0c04" stroke-width="1.3"/>
      <g class="dr-runes" fill="none" style="stroke:color-mix(in srgb, var(--dc) 70%, #fff)" stroke-width=".9" stroke-linecap="round">${runes}</g>
      <circle cx="36" cy="72" r="14.6" fill="url(#${id("br")})" stroke="#2a1708" stroke-width="1"/>
      <circle cx="36" cy="72" r="12.4" fill="none" stroke="rgba(60,35,8,.55)" stroke-width=".8" stroke-dasharray="1.2 1.6"/>
      <circle class="dr-disc" cx="36" cy="72" r="10.6" fill="url(#${id("md")})" stroke="#2a1708" stroke-width=".9"/>
      <g transform="translate(26.4 62.4) scale(.8)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff;filter:drop-shadow(0 0 1.6px rgba(0,0,0,.7))">${g}</g>
      <circle cx="61" cy="80" r="2.4" fill="url(#${id("rv")})"/><circle cx="61" cy="85.4" r="4.4" fill="none" stroke="#c9a24a" stroke-width="1.5"/><circle cx="61" cy="85.4" r="4.4" fill="none" stroke="rgba(0,0,0,.4)" stroke-width=".5"/></svg>`;
    return { arch, leaf };
  }
  function makeDoor(d) {
    const el = document.createElement("div"), art = doorArt(d), name = doorLabel(d);
    const cost = run.openCost();
    el.className = "adv-door"; el.dataset.uid = "door:" + d.i; el.style.setProperty("--dc", d.def.color);
    el.innerHTML = `<div class="dr-aura"></div><div class="dr-glow"></div><div class="dr-portal"><i class="dr-rays"></i><i class="dr-core"></i></div>
      <div class="dr-leaf">${art.leaf}</div>${art.arch}
      <span class="dr-name${name.length > 13 ? " long" : ""}"><b>${esc(name)}</b>${d.spec.tier ? `<em>T${d.spec.tier}</em>` : ""}</span>
      <span class="dr-cost${cost ? "" : " free"}">${cost ? `<b>${cost}</b>` : L("Free", "Gratuit")}</span>
      ${d.price ? `<span class="dr-each" title="${esc(L("Price of each choice", "Prix de chaque choix"))}">${d.price}<small>${L("each", "/ choix")}</small></span>` : ""}`;
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
    return `${doorLabel(d)} — ${what}. ${cost ? L(`Opening it costs ${cost} gold.`, `L'ouvrir coûte ${cost} or.`) : L("Opening it is free.", "L'ouvrir est gratuit.")}${d.price != null ? " " + L(`Each choice: ${d.price} gold.`, `Chaque choix : ${d.price} or.`) : ""}`;
  }
  async function openDoor(d, el) {
    if (H.busy || d.open) return;
    const e = run.openDoor(d.i);
    if (e) { H.toast(H.T(e)); H.sfx.error && H.sfx.error(); H.anim(el, [{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }], { duration: 260 }); return; }
    H.busy = true;
    try {
      H.renderGold(); H.sfx.coin && H.sfx.coin();
      el.classList.add("opening");
      const r = H.rectOf(el); H.glow && H.glow(el, d.def.color);
      await H.wait(240); H.burst(r.cx, r.cy, 30, ["#ffffff", "#fff4c8", d.def.color, d.def.color], 95);
      await H.wait(380);
      el.classList.add("gone");
      await H.wait(260);
    } finally { H.busy = false; }
    const made = H.renderTavern(); renderChrome();
    made.forEach((x, k) => H.anim(x, [{ transform: "translateY(18px) scale(.7)", opacity: 0 }, { transform: "translateY(-4px) scale(1.04)", opacity: 1, offset: .7 }, { transform: "none", opacity: 1 }], { duration: 420, delay: k * 90, easing: "cubic-bezier(.2,.7,.3,1)", fill: "backwards" }));
    for (const x of document.querySelectorAll("#shop .adv-door")) x.title = doorTip(run.doors[+x.dataset.uid.split(":")[1]]);
    refreshDoorCosts();
  }
  function refreshDoorCosts() {
    const cost = run.openCost();
    for (const x of document.querySelectorAll("#shop .adv-door")) { const c = x.querySelector(".dr-cost"); if (!c) continue; c.innerHTML = cost ? `<b>${cost}</b>` : L("Free", "Gratuit"); c.classList.toggle("free", !cost); x.classList.toggle("poor", H.you.gold < cost); }
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
    run.hpShown = f.hpBefore[0]; renderChrome(true);
    const boss = f.enemy.boss;
    await H.banner(boss ? `${L("Boss", "Boss")}<small>${esc(run.floorName(f.level))}</small>` : `${esc(run.floorName(f.level))}<small>${L("Fight", "Combat")} ${f.level} / ${D.defaults.fights}</small>`, boss ? "adv-ban boss" : "adv-ban", boss ? 1500 : 1000);
    f.oppObj = { id: -1, name: run.floorName(f.level), hue: boss ? 0 : 200, hero: "", alive: true, armor: 0, tier: f.enemy.tier, streak: 0, isBot: true, icon: svg(boss ? EMBLEM.skull : EMBLEM[type.emblem] || EMBLEM.sword, "adv-enemy-ic") };
    f.hpBefore = [f.hpBefore[0], 0]; f.armBefore = [f.armBefore[0] || 0, 0]; // v137 your Health counts; the floors have none
    try { await H.playCombat(f, preView); } catch (err) { H.report(err); H.leaveCombat(); }
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
      const left = run.p.health, again = !run.over && f.level >= D.defaults.fights;
      await H.banner(run.over ? `${L("Defeat", "Défaite")}<small>${L(`No Health left: the run ends on floor ${f.level}`, `Plus de PV : la run s'arrête à l'étage ${f.level}`)}</small>`
        : `${L("Defeat", "Défaite")}<small>${L(`-${f.hpLoss} Health · ${left} left`, `-${f.hpLoss} PV · il en reste ${left}`)}${again ? " · " + L("fight it again", "à rejouer") : ""}</small>`, "lose", 1600);
      return;
    }
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
      const boss = s.kind === "boss", res = run.fights.filter((x) => x.level === s.level).pop();
      return `<i class="adv-st fight${boss ? " boss" : ""} ${st}${res ? " r-" + res.out : ""}" title="${esc(run.floorName(s.level))}">${boss ? svg(EMBLEM.skull) : s.level % 5 === 0 || i === cur ? `<em>${s.level}</em>` : ""}</i>`;
    }).join("")}</div>`;
    const curEl = bar.querySelector(".adv-st.cur");
    if (curEl) curEl.insertAdjacentHTML("beforeend", `<span class="adv-you">${H.you.hero && W().HEROES[H.you.hero] && H.heroPic(H.you.hero) ? `<span style="background-image:url('${esc(H.heroPic(H.you.hero))}')"></span>` : svg(EMBLEM[type.emblem] || EMBLEM.compass)}</span>`);
    const next = run.steps.slice(cur).find((s) => s.kind !== "tavern");
    const wins = (inFight ? run.fights.slice(0, -1) : run.fights).filter((x) => x.out !== "loss").length; // (the fight being played is not counted yet)
    const hp = inFight && run.hpShown != null ? run.hpShown : H.you.health; // (nor its damage)
    pan.innerHTML = `<div class="adv-pan" style="--ac:${esc(type.color)}">${medal(type, "big")}<b class="adv-pan-name">${esc(type.name)}</b>
      <div class="adv-pan-floor"><small>${L("Floor", "Étage")}</small><strong>${run.level}</strong><small>/ ${D.defaults.fights}</small></div>
      <div class="adv-pan-rows"><span class="hp">${L("Health", "PV")}<b>${hp} / ${H.you.maxHealth}</b></span><span>${L("Tavern tier", "Tier de taverne")}<b>${H.you.tier}</b></span><span>${L("Fights won", "Combats gagnés")}<b>${wins}</b></span>
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
    const marks = run.fights.map((x) => `<i class="r-${x.out}${x.boss ? " boss" : ""}" title="${esc(run.floorName(x.level) + (x.out === "loss" ? ` · -${x.hp} ${L("Health", "PV")}` : ""))}"></i>`).join("");
    const m = H.modal(`<div class="adv-end ${won ? "won" : "lost"}" style="--ac:${esc(type.color)}">
      <div class="adv-end-rays"></div>${medal(type, "huge")}
      <h2>${won ? L("Adventure won!", "Aventure gagnée !") : gaveUp ? L("Run given up", "Run abandonnée") : L("The run is over", "La run est terminée")}</h2>
      <p class="adv-end-sub">${esc(type.name)} · ${won ? L(`all ${D.defaults.fights} floors cleared with ${run.p.health} Health left`, `les ${D.defaults.fights} étages franchis avec ${run.p.health} PV restants`) : gaveUp ? L(`stopped on floor ${last ? last.level : 1}`, `arrêtée à l'étage ${last ? last.level : 1}`) : L(`out of Health on floor ${last ? last.level : 1}`, `à court de PV à l'étage ${last ? last.level : 1}`)}</p>
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
