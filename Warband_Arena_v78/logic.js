// ===================================================================
// Warband Arena - game rules. Pure logic, no DOM. Deterministic per seed.
// ===================================================================
(function (root) {
  "use strict";

  const BEAST = "Beast", CONSTRUCT = "Construct", SPIRIT = "Spirit", CORSAIR = "Corsair", ELEMENTAL = "Elemental", DRAGON = "Dragon", TIDEKIN = "Tidekin", INFERNAL = "Infernal", NEUTRAL = "";
  // Tribes of the active meta (filled by registerCustom). Built-in ids stay as they are; a meta can rename
  // them, give them a colour and icon, delete them or add its own.
  const BASE_TRIBES = [BEAST, CONSTRUCT, SPIRIT, CORSAIR, ELEMENTAL, DRAGON, TIDEKIN, INFERNAL];
  const TRIBES = BASE_TRIBES.slice();
  const TRIBE_INFO = {};
  const TN = (t) => (t && TRIBE_INFO[t] && TRIBE_INFO[t].name) || t;
  // Multi-tribe: a minion (or card definition) has `tribe` (its first tribe, for colours and old code),
  // `tribes` (all of them) and `allTribes` (counts as every tribe). These two are the only way to ask.
  const tribesOf = (o) => (o.allTribes ? TRIBES : o.tribes && o.tribes.length ? o.tribes : o.tribe ? [o.tribe] : []);
  const hasTribe = (o, t) => !!t && !!o && (o.allTribes ? TRIBES.includes(t) : o.tribes ? o.tribes.includes(t) : o.tribe === t);
  const tribeLabel = (o) => (o.allTribes ? "All" : tribesOf(o).map(TN).join(" / "));
  // ---------------------------------------------------------------- Affinities
  // Each minion may carry one or two affinities, on top of its tribe. An affinity's mechanic wakes up when you
  // control enough minions that carry it (level 1, t1), grows at the second threshold (level 2, t2) and, if the
  // meta sets one, at a third (level 3, t3). The mechanic is one of a few templates ("kind"); v1 / v2 / v3 are its
  // number at each level. On top of it, an affinity can carry its own effects, each unlocked at a level (alv),
  // that run like a passive hero power for the player who reaches it. A meta can rename, re-illustrate, re-order,
  // re-tune or hide the built-in affinities, and create new ones.
  const AFF_KINDS = ["pulse", "gauge", "mire", "ebb", "found", "bonus", "growth", "echo", "ward", "unity", "strike", "wealth", "resonance", "spread", "lure", "aura", "fury", "bargain", "none"];
  const AFF_KIND_INFO = {
    pulse: { label: "Pulse: playing one fires the effects of the chain", value: "", group: "board" },
    gauge: { label: "Gauge: a shared pool cards fill and spend", value: "max in the pool", group: "economy" },
    mire: { label: "Status: Mire effects lower enemy Attack", value: "Attack lost", group: "combat" },
    ebb: { label: "Ebb: send them back to the hand, bonuses kept", value: "times per turn", group: "tavern" },
    found: { label: "Foundation: a lasting bonus under a board slot", value: "per slot", group: "board" },
    bonus: { label: "Bonus: they gain stats at the start of combat", value: "+X/+X", group: "combat" },
    growth: { label: "Growth: they grow for good at the end of your turn", value: "+X/+X", group: "tavern" },
    echo: { label: "Legacy: when one dies in combat, another one inherits a bonus", value: "+X/+X", group: "combat" },
    ward: { label: "Ward: some of them gain a keyword as the fight starts", value: "minions", param: "kw", group: "combat" },
    unity: { label: "Pack: +Attack for each other minion of the affinity", value: "Attack per other", group: "combat" },
    strike: { label: "Strike: damage to a random enemy as the fight starts", value: "damage", group: "combat" },
    wealth: { label: "Fortune: extra gold at the start of your turn", value: "gold", group: "economy" },
    resonance: { label: "Resonance: playing one gives the others stats", value: "+X/+X", group: "tavern" },
    spread: { label: "Spread: other minions catch it at the end of your turn", value: "minions per turn", group: "tavern" },
    lure: { label: "Lure: the tavern always offers some of them", value: "minions offered", group: "tavern" },
    aura: { label: "Aura: they give stats to the minions next to them as the fight starts", value: "+X/+X", group: "board" },
    fury: { label: "Fury: they gain Attack each time they survive damage", value: "Attack", group: "combat" },
    bargain: { label: "Bargain: free refreshes every turn", value: "free refreshes", group: "economy" },
    none: { label: "No template: only the level effects you write", value: "", group: "free" },
  };
  const AFF_BASE = {
    coral: { name: "Coral", fr: "Corail", mech: "Pulse", mechFr: "Pulsation", kind: "pulse", color: "#ff8fb8", t1: 3, t2: 5, v1: 1, v2: 2 },
    steam: { name: "Steam", fr: "Vapeur", mech: "Pressure", mechFr: "Pression", kind: "gauge", color: "#b88cff", t1: 3, t2: 5, v1: 5, v2: 10 },
    tar: { name: "Tar", fr: "Goudron", mech: "Mire", mechFr: "Engluement", kind: "mire", color: "#d39a3a", t1: 3, t2: 5, v1: 2, v2: 4 },
    water: { name: "Water", fr: "Eau", mech: "Ebb", mechFr: "Reflux", kind: "ebb", color: "#5fb6ff", t1: 3, t2: 5, v1: 1, v2: 2 },
    earth: { name: "Earth", fr: "Terre", mech: "Foundation", mechFr: "Fondation", kind: "found", color: "#8fd06a", t1: 3, t2: 5, v1: 1, v2: 3 },
  };
  const AFF_BUILTIN = Object.keys(AFF_BASE);
  const AFFS = AFF_BUILTIN.slice(); // the affinities of the current meta, in order
  const AFF = {}; for (const k of AFFS) AFF[k] = Object.assign({ id: k, t3: 0, v3: AFF_BASE[k].v2, effects: [] }, AFF_BASE[k]);
  const AFF_VALUE = {}; // what v1 / v2 / v3 mean, per affinity (for texts and the editor)
  for (const k of AFFS) AFF_VALUE[k] = AFF_KIND_INFO[AFF[k].kind].value;
  const clampN = (v, lo, hi, d) => (v != null && isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : d);
  // looks: the generated badge (when there is no uploaded picture) and how badges sit on cards and minions
  const AFF_SHAPES = ["round", "hex", "shield", "diamond", "square", "star"];
  const AFF_GLYPHS = ["", "✦", "✶", "❄", "☀", "☾", "⚡", "☄", "♨", "⚙", "☠", "⚔", "♛", "✿", "❀", "☘", "⚘", "⚓", "♠", "♣", "♥", "♦", "✚", "✪", "❖", "☯", "♫", "▲", "◆", "●", "⬢", "✺"];
  const AFF_FX = ["", "glow", "pulse", "spin", "shine"];
  const BADGE_POS = ["tl", "tr", "bl", "br", "left", "right", "top", "bottom", "name"];
  const BADGE_FRAMES = ["none", "ring", "gold", "silver", "gem", "shield"];
  const BADGE_DEF = { card: { size: 34, pos: "tr", dir: "col", frame: "ring", glow: true, dx: 0, dy: 0 }, token: { size: 30, pos: "left", dir: "col", frame: "ring", glow: true, dx: 0, dy: 0 } };
  const AFF_BADGE = JSON.parse(JSON.stringify(BADGE_DEF));
  function setBadge(b) {
    for (const w of ["card", "token"]) {
      const o = Object.assign({}, BADGE_DEF[w], (b && b[w]) || {}), d = AFF_BADGE[w];
      d.size = clampN(o.size, 14, 72, BADGE_DEF[w].size); d.pos = BADGE_POS.includes(o.pos) ? o.pos : BADGE_DEF[w].pos; d.dir = o.dir === "row" ? "row" : "col";
      d.frame = BADGE_FRAMES.includes(o.frame) ? o.frame : BADGE_DEF[w].frame; d.glow = !!o.glow; d.dx = clampN(o.dx, -40, 40, 0); d.dy = clampN(o.dy, -40, 40, 0);
    }
  }
  const hexC = (v, d) => (typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v) ? v : d);
  // cfg: { [id]: { name, mech, kind, color, color2, shape, glyph, art, fx, icon, t1, t2, t3, v1, v2, v3, kw, desc, effects, deleted, custom }, order: [ids], badge: {...} }
  // affinities are an optional rule of a meta: off unless the meta turns them on (cfg.enabled)
  let AFF_ON = false;
  const affOn = () => AFF_ON;
  function setAffinities(cfg) {
    cfg = cfg || {};
    AFF_ON = cfg.enabled === true;
    for (const k in AFF) delete AFF[k];
    AFFS.length = 0;
    const customs = Object.keys(cfg).filter((k) => k !== "order" && k !== "badge" && !AFF_BASE[k] && cfg[k] && cfg[k].custom);
    const order = (Array.isArray(cfg.order) ? cfg.order : []).filter((k) => AFF_BASE[k] || customs.includes(k));
    const ids = [...new Set(order.some((k) => AFF_BASE[k]) ? order.concat(AFF_BUILTIN, customs) : AFF_BUILTIN.concat(order, customs))];
    for (const k of ids) {
      const c = cfg[k] || {}, base = AFF_BASE[k];
      if (c.deleted) continue;
      const d = Object.assign({ id: k, kind: "bonus", color: "#c9a24a", t1: 3, t2: 5, v1: 1, v2: 2, mech: "Bonus", mechFr: "Bonus", name: k, fr: k }, base || {});
      if (c.name) { d.name = String(c.name).slice(0, 18); d.fr = d.name; }
      if (c.mech) { d.mech = String(c.mech).slice(0, 18); d.mechFr = d.mech; }
      if (c.kind && AFF_KINDS.includes(c.kind)) d.kind = c.kind;
      d.color = hexC(c.color, d.color); d.color2 = hexC(c.color2, "");
      d.shape = AFF_SHAPES.includes(c.shape) ? c.shape : "round"; d.glyph = typeof c.glyph === "string" ? c.glyph.slice(0, 2) : "";
      d.art = c.art === "gen" ? "gen" : ""; d.fx = AFF_FX.includes(c.fx) ? c.fx : "";
      if (c.icon) d.icon = c.icon; else d.icon = "";
      d.t1 = clampN(c.t1, 1, 7, d.t1); d.t2 = clampN(c.t2, 1, 7, d.t2); if (d.t2 < d.t1) d.t2 = d.t1;
      d.t3 = clampN(c.t3, 0, 7, 0); if (d.t3 && d.t3 <= d.t2) d.t3 = d.t2 < 7 ? d.t2 + 1 : 0;
      d.v1 = clampN(c.v1, 0, 99, d.v1); d.v2 = clampN(c.v2, 0, 99, d.v2); d.v3 = clampN(c.v3, 0, 99, d.v2);
      d.kw = typeof c.kw === "string" && c.kw ? c.kw : "shield";
      d.desc = typeof c.desc === "string" ? c.desc.slice(0, 240) : ""; d.descOnly = !!c.descOnly && !!d.desc;
      d.effects = (Array.isArray(c.effects) ? c.effects : []).filter((ab) => ab && TRIGGERS[ab.trigger] && ACTIONS[ab.action]).slice(0, 12).map((ab) => Object.assign({}, ab, { alv: clampN(ab.alv, 1, 3, 1) }));
      // effects every minion carrying it runs, as long as its player has the level
      d.carry = (Array.isArray(c.carry) ? c.carry : []).filter((ab) => ab && TRIGGERS[ab.trigger] && !TRIGGERS[ab.trigger].hero && !TRIGGERS[ab.trigger].spell && ACTIONS[ab.action]).slice(0, 12).map((ab) => { const o = Object.assign({}, ab, { alv: clampN(ab.alv, 1, 3, 1) }); delete o.carry; delete o._aff; return o; });
      d.stat = ["attack", "health"].includes(c.stat) ? c.stat : "both";
      d.custom = !base;
      AFF[k] = d; AFFS.push(k);
    }
    setBadge(cfg.badge);
    for (const k of Object.keys(AFF_VALUE)) delete AFF_VALUE[k];
    for (const k of AFFS) AFF_VALUE[k] = AFF_KIND_INFO[AFF[k].kind].value;
    TEXT_CACHE.clear();
  }
  const affsOf = (o) => (AFF_ON && o && o.aff) || [];
  const hasAff = (o, a) => AFF_ON && !!a && !!o && !!o.aff && o.aff.includes(a);
  const AN = (a) => (AFF[a] ? (LANG === "fr" ? AFF[a].fr : AFF[a].name) : a);
  const kindOfAff = (a) => (AFF[a] ? AFF[a].kind : "");
  const affsOfKind = (kind) => AFFS.filter((a) => AFF[a].kind === kind);
  const affList = (c, base) => { const raw = Array.isArray(c && c.aff) ? c.aff : (base && base.aff) || []; const out = []; for (const a of raw) if (a && typeof a === "string" && !out.includes(a) && out.length < 2) out.push(a); return out; };
  // how many living minions of the board carry it, and the level that gives (0 to 3)
  const affCount = (board, a) => board.reduce((t, m) => t + (m && m.health > 0 && hasAff(m, a) ? 1 : 0), 0);
  const lvFor = (d, n) => (!d ? 0 : d.t3 && n >= d.t3 ? 3 : n >= d.t2 ? 2 : n >= d.t1 ? 1 : 0);
  function affLevel(board, a) { return lvFor(AFF[a], affCount(board, a)); }
  const affMaxLv = (a) => (AFF[a] && AFF[a].t3 ? 3 : 2);
  const affThreshold = (a, lv) => (!AFF[a] ? 0 : lv >= 3 ? AFF[a].t3 : lv === 2 ? AFF[a].t2 : AFF[a].t1);
  const affVal = (a, lv) => (!AFF[a] || lv <= 0 ? 0 : lv >= 3 && AFF[a].t3 ? AFF[a].v3 : lv >= 2 ? AFF[a].v2 : AFF[a].v1);
  // every affinity's count and level for a board: { coral: { n, lv }, ... }
  function affState(board) { const o = {}; for (const a of AFFS) { const n = affCount(board, a); o[a] = { n, lv: lvFor(AFF[a], n) }; } return o; }
  // which affinity of a given kind an effect uses: the one it names, else one its minion carries, else the first of that kind
  function affFor(kind, named, m) {
    if (named && AFF[named] && AFF[named].kind === kind) return named;
    const own = affsOf(m).find((a) => AFF[a] && AFF[a].kind === kind); if (own) return own;
    return affsOfKind(kind)[0] || "";
  }
  // (old Coral effect) "your Colony": a run of adjacent minions of the first Pulse affinity
  function colonies(board, lv) {
    const live = board.filter((m) => m && m.health > 0), out = [], a = affsOfKind("pulse")[0];
    if (lv <= 0 || !a) return out;
    for (let i = 0; i < live.length; i++) {
      if (!hasAff(live[i], a) || (i > 0 && hasAff(live[i - 1], a))) continue;
      let j = i; while (j + 1 < live.length && hasAff(live[j + 1], a)) j++;
      const lo = lv >= 2 ? Math.max(0, i - 1) : i, hi = lv >= 2 ? Math.min(live.length - 1, j + 1) : j;
      out.push(live.slice(lo, hi + 1));
    }
    return out;
  }
  // what an affinity does, with its current names and numbers (for tooltips and the editor)
  function affBlurb(a, lang) {
    const d = AFF[a]; if (!d) return ""; const fr = (lang || LANG) === "fr", t1 = d.t1, t2 = d.t2, v1 = d.v1, v2 = d.v2;
    const N = fr ? d.fr : d.name, M = fr ? d.mechFr : d.mech, K = fr ? (KW_FR[d.kw] || d.kw) : KW_TEXT[d.kw] || (CKW[d.kw] ? CKW[d.kw].name : d.kw);
    const sv = (v) => (d.stat === "attack" ? (fr ? `+${v} Attaque` : `+${v} Attack`) : d.stat === "health" ? (fr ? `+${v} PV` : `+${v} Health`) : `+${v}/+${v}`);
    let s;
    if (fr) s = {
      pulse: `Avec ${t1} serviteurs ${N}, jouer un ${N} déclenche sa ${M} et celle des ${N} directement adjacents, de gauche à droite. Avec ${t2}, elle traverse toute la chaîne de ${N} connectés. Un autre serviteur interrompt la chaîne ; chacun ne se déclenche qu'une fois.`,
      gauge: `Avec ${t1} serviteurs ${N}, une réserve de ${M} s'ouvre (max ${v1}) : les cartes la remplissent et la dépensent. Avec ${t2}, elle contient jusqu'à ${v2}.`,
      mire: `Avec ${t1} serviteurs ${N}, vos effets de ${M} marchent : la cible perd ${v1} Attaque pour ce combat. Avec ${t2}, elle en perd ${v2}.`,
      ebb: `Avec ${t1} serviteurs ${N}, glissez un serviteur ${N} de votre troupe vers votre main (${v1} fois par tour) : il garde ses bonus et rejoue son Cri de guerre. Avec ${t2} : ${v2} fois par tour.`,
      found: `Avec ${t1} serviteurs ${N}, à la fin de votre tour une ${M} se construit sous un de vos serviteurs ${N} (max ${v1} par emplacement). Elle reste sur l'emplacement, quel que soit son occupant. Avec ${t2} : jusqu'à ${v2}.`,
      bonus: `Avec ${t1} serviteurs ${N}, vos ${N} gagnent ${sv(v1)} au début de chaque combat (${M}). Avec ${t2} : ${sv(v2)}.`,
      growth: `Avec ${t1} serviteurs ${N}, vos ${N} gagnent ${sv(v1)} à la fin de votre tour, pour de bon (${M}). Avec ${t2} : ${sv(v2)}.`,
      echo: `Avec ${t1} serviteurs ${N}, quand un ${N} meurt en combat, un autre ${N} aléatoire gagne ${sv(v1)} (${M}). Avec ${t2} : ${sv(v2)}.`,
      ward: `Avec ${t1} serviteurs ${N}, au début du combat ${v1} ${N} aléatoire${v1 > 1 ? "s" : ""} gagne${v1 > 1 ? "nt" : ""} ${K} (${M}). Avec ${t2} : ${v2}.`,
      unity: `Avec ${t1} serviteurs ${N}, au début du combat chaque ${N} gagne +${v1} Attaque par autre ${N} (${M}). Avec ${t2} : +${v2} par autre.`,
      strike: `Avec ${t1} serviteurs ${N}, au début du combat ${M} inflige ${v1} dégâts à un ennemi aléatoire. Avec ${t2} : ${v2} dégâts.`,
      wealth: `Avec ${t1} serviteurs ${N}, vous gagnez ${v1} or de plus au début de votre tour (${M}). Avec ${t2} : ${v2} or.`,
      resonance: `Avec ${t1} serviteurs ${N}, jouer un ${N} donne ${sv(v1)} à vos autres ${N} (${M}). Avec ${t2} : ${sv(v2)}.`,
      spread: `Avec ${t1} serviteurs ${N}, à la fin de votre tour ${v1 > 1 ? v1 + " de vos autres serviteurs deviennent" : "un de vos autres serviteurs devient"} ${N} (${M}), s'il${v1 > 1 ? "s ont" : " a"} de la place pour une affinité. Avec ${t2} : ${v2}.`,
      lure: `Avec ${t1} serviteurs ${N}, la taverne vous propose toujours au moins ${v1} serviteur${v1 > 1 ? "s" : ""} ${N} (${M}). Avec ${t2} : ${v2}.`,
      aura: `Avec ${t1} serviteurs ${N}, au début du combat chaque ${N} donne ${sv(v1)} aux serviteurs à côté de lui (${M}). Avec ${t2} : ${sv(v2)}.`,
      fury: `Avec ${t1} serviteurs ${N}, chaque fois qu'un ${N} survit à des dégâts, il gagne +${v1} Attaque (${M}). Avec ${t2} : +${v2}.`,
      bargain: `Avec ${t1} serviteurs ${N}, ${v1 > 1 ? "vos " + v1 + " premiers rafraîchissements de chaque tour sont gratuits" : "votre premier rafraîchissement de chaque tour est gratuit"} (${M}). Avec ${t2} : ${v2}.`,
      none: `S'éveille avec ${t1} serviteurs ${N}, grandit avec ${t2}.`,
    }[d.kind];
    else s = {
      pulse: `With ${t1} ${N} minions, playing a ${N} fires its ${M} and those of the ${N} minions right next to it, from left to right. With ${t2}, it runs through the whole chain of connected ${N} minions. Any other minion breaks the chain; each fires once.`,
      gauge: `With ${t1} ${N} minions, a shared ${M} pool opens (max ${v1}): cards fill it and spend it. With ${t2}, it holds up to ${v2}.`,
      mire: `With ${t1} ${N} minions, your ${M} effects work: the target loses ${v1} Attack for the fight. With ${t2}, it loses ${v2}.`,
      ebb: `With ${t1} ${N} minions, drag a ${N} minion from your warband to your hand (${v1} time${v1 > 1 ? "s" : ""} per turn): it keeps its bonuses and plays its Battlecry again. With ${t2}: ${v2} times per turn.`,
      found: `With ${t1} ${N} minions, at the end of your turn a ${M} is built under one of your ${N} minions (max ${v1} per slot). It stays on the slot, whoever stands there. With ${t2}: up to ${v2}.`,
      bonus: `With ${t1} ${N} minions, your ${N} minions gain ${sv(v1)} at the start of each combat (${M}). With ${t2}: ${sv(v2)}.`,
      growth: `With ${t1} ${N} minions, your ${N} minions gain ${sv(v1)} for good at the end of your turn (${M}). With ${t2}: ${sv(v2)}.`,
      echo: `With ${t1} ${N} minions, when a ${N} minion dies in combat, another random ${N} minion gains ${sv(v1)} (${M}). With ${t2}: ${sv(v2)}.`,
      ward: `With ${t1} ${N} minions, ${v1} random ${N} minion${v1 > 1 ? "s" : ""} gain${v1 > 1 ? "" : "s"} ${K} as the fight starts (${M}). With ${t2}: ${v2}.`,
      unity: `With ${t1} ${N} minions, each ${N} minion gains +${v1} Attack for each other ${N} minion as the fight starts (${M}). With ${t2}: +${v2} per other.`,
      strike: `With ${t1} ${N} minions, ${M} deals ${v1} damage to a random enemy minion as the fight starts. With ${t2}: ${v2} damage.`,
      wealth: `With ${t1} ${N} minions, you get ${v1} extra gold at the start of your turn (${M}). With ${t2}: ${v2} gold.`,
      resonance: `With ${t1} ${N} minions, playing a ${N} minion gives your other ${N} minions ${sv(v1)} (${M}). With ${t2}: ${sv(v2)}.`,
      spread: `With ${t1} ${N} minions, at the end of your turn ${v1 > 1 ? v1 + " of your other minions become" : "one of your other minions becomes"} ${N} (${M}), if ${v1 > 1 ? "they have" : "it has"} room for an affinity. With ${t2}: ${v2}.`,
      lure: `With ${t1} ${N} minions, the tavern always offers you at least ${v1} ${N} minion${v1 > 1 ? "s" : ""} (${M}). With ${t2}: ${v2}.`,
      aura: `With ${t1} ${N} minions, as the fight starts each ${N} minion gives ${sv(v1)} to the minions next to it (${M}). With ${t2}: ${sv(v2)}.`,
      fury: `With ${t1} ${N} minions, each time a ${N} minion survives damage it gains +${v1} Attack (${M}). With ${t2}: +${v2}.`,
      bargain: `With ${t1} ${N} minions, your first ${v1 > 1 ? v1 + " refreshes" : "refresh"} each turn ${v1 > 1 ? "are" : "is"} free (${M}). With ${t2}: ${v2}.`,
      none: `Wakes up with ${t1} ${N} minions, grows with ${t2}.`,
    }[d.kind];
    if (d.t3 && d.kind !== "pulse" && d.kind !== "none") s += fr ? ` Avec ${d.t3} : ${d.v3}.` : ` With ${d.t3}: ${d.v3}.`;
    else if (d.t3 && d.kind === "none") s = s.replace(/\.$/, fr ? `, et encore avec ${d.t3}.` : `, and again with ${d.t3}.`);
    return s;
  }
  const KW_FR = { taunt: "Provocation", shield: "Bouclier", reborn: "Réincarnation", windfury: "Furie des vents", venomous: "Toxicité", cleave: "Fendoir", stealth: "Camouflage", rally: "Ralliement", tough: "Coriace", magnetic: "Magnétique", flying: "Vol" };
  // the free effects of an affinity, as text, level by level: [{ lv, text }]
  function affEffectsText(a) {
    const d = AFF[a]; if (!d || !d.effects || !d.effects.length) return [];
    return d.effects.map((ab) => {
      let t = abilityText(ab, false);
      t = LANG === "fr" ? frTidy(t) : t.replace(/\banother (minion|friendly)/g, "a $1").replace(/\byour other /g, "your ").replace(/random other friendly/g, "random friendly");
      return { lv: ab.alv || 1, text: t.charAt(0).toUpperCase() + t.slice(1) };
    }).sort((x, y) => x.lv - y.lv);
  }
  const affDesc = (a) => (AFF[a] ? AFF[a].desc || "" : "");
  // the effects an affinity gives to every minion that carries it (tagged, so they can be told apart and gated by level)
  const affAbilities = (a) => (AFF[a] && AFF[a].carry ? AFF[a].carry.map((ab) => Object.assign({}, ab, { _aff: a })) : []);
  function affCarryText(a) {
    const d = AFF[a]; if (!d || !d.carry || !d.carry.length) return [];
    return d.carry.map((ab) => { const t = abilityText(ab, false); return { lv: ab.alv || 1, text: t.charAt(0).toUpperCase() + t.slice(1) }; }).sort((x, y) => x.lv - y.lv);
  }
  // a carried effect works only while its player's board has the level it needs
  const affOk = (ab, board) => !ab._aff || affLevel(board, ab._aff) >= (ab.alv || 1);
  // give a minion an affinity (and the effects it carries); false when it has it or already carries two
  function giveAff(m, a) {
    if (!m || !AFF[a] || hasAff(m, a) || (m.aff || []).length >= 2) return false;
    m.aff = (m.aff || []).concat([a]); m.abilities = (m.abilities || []).concat(affAbilities(a));
    return true;
  }
  // "+X/+X" templates can grow Attack, Health or both
  const statAH = (a, v) => { const st = AFF[a] ? AFF[a].stat : "both"; return [st === "health" ? 0 : v, st === "attack" ? 0 : v]; };
  // ---------------------------------------------------------------- custom keywords
  // A meta can define its own keywords: a name, a colour, a picture, a tooltip, and effects. A minion with the
  // keyword runs those effects as if they were its own (golden doubles them); "Give a keyword" can hand it out.
  const CKW = {};
  function setKeywords(list) {
    for (const k in CKW) delete CKW[k];
    for (const k of list || []) if (k && k.id && k.name) CKW[k.id] = { id: k.id, name: String(k.name).slice(0, 20), color: k.color || "#c9a24a", icon: k.icon || "", tip: k.tip || "", abilities: (k.abilities || []).filter((ab) => ab && TRIGGERS[ab.trigger] && ACTIONS[ab.action]) };
  }
  const kwAbilities = (id) => (CKW[id] ? CKW[id].abilities.map((ab) => Object.assign({}, ab, { _kw: id })) : []);
  const hasKw = (o, k) => !!o && (!!o[k] || (!!o.ckw && o.ckw.includes(k)));
  const kwName = (k) => (CKW[k] ? CKW[k].name : KW_TEXT[k] || k);
  // give a custom keyword to a minion (its effects come with it); false when it already has it
  function giveCkw(m, id) {
    if (!CKW[id] || !m || (m.ckw || []).includes(id)) return false;
    m.ckw = (m.ckw || []).concat([id]); m.abilities = (m.abilities || []).concat(kwAbilities(id));
    return true;
  }
  function takeCkw(m, id) {
    if (!m || !(m.ckw || []).includes(id)) return false;
    m.ckw = m.ckw.filter((x) => x !== id); m.abilities = (m.abilities || []).filter((ab) => ab._kw !== id);
    return true;
  }
  // the picture of an affinity: its own upload, the built-in art, or a generated badge (shape, colours, glyph or initial)
  const SHAPE_SVG = {
    round: (f, st) => `<circle cx="32" cy="32" r="28" fill="${f}" ${st}/>`,
    hex: (f, st) => `<polygon points="32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5" fill="${f}" ${st}/>`,
    shield: (f, st) => `<path d="M32 3 L56 11 V30 C56 46 45 56 32 61 C19 56 8 46 8 30 V11 Z" fill="${f}" ${st}/>`,
    diamond: (f, st) => `<polygon points="32,2 61,32 32,62 3,32" fill="${f}" ${st}/>`,
    square: (f, st) => `<rect x="5" y="5" width="54" height="54" rx="11" fill="${f}" ${st}/>`,
    star: (f, st) => { const p = []; for (let i = 0; i < 16; i++) { const r = i % 2 ? 21 : 30, t = (Math.PI * i) / 8 - Math.PI / 2; p.push((32 + r * Math.cos(t)).toFixed(1) + "," + (32 + r * Math.sin(t)).toFixed(1)); } return `<polygon points="${p.join(" ")}" fill="${f}" ${st}/>`; },
  };
  function affIconSVG(d, id) {
    const c = hexC(d.color, "#c9a24a"), c2 = hexC(d.color2, "") || "#1a1430", shape = SHAPE_SVG[d.shape] ? d.shape : "round";
    const ch = (d.glyph || String(d.name || id).trim().charAt(0).toUpperCase()).replace(/[<&"]/g, "");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="g" cx="40%" cy="32%"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".45" stop-color="${c}"/><stop offset="1" stop-color="${c2}"/></radialGradient></defs>${SHAPE_SVG[shape]("url(#g)", 'stroke="#e8c675" stroke-width="3.5" stroke-linejoin="round"')}<text x="32" y="${d.glyph ? 43 : 42}" text-anchor="middle" font-family="Georgia,'Segoe UI Symbol','DejaVu Sans',serif" font-weight="700" font-size="${d.glyph ? 30 : 28}" fill="#fff" stroke="rgba(0,0,0,.35)" stroke-width="1">${ch}</text></svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }
  function affIcon(a) {
    const d = AFF[a]; if (!d) return "";
    if (d.icon) return d.icon;
    if (AFF_BASE[a] && d.art !== "gen") return `ui-art/aff/aff-${a}.webp`;
    return affIconSVG(d, a);
  }
  const affMech = (a, lang) => (AFF[a] ? ((lang || LANG) === "fr" ? AFF[a].mechFr : AFF[a].mech) : "");
  function colonyOf(board, lv, self) {
    const cs = colonies(board, lv); if (!cs.length) return [];
    const mine = self && cs.find((c) => c.includes(self));
    return mine || cs.reduce((a, b) => (b.length > a.length ? b : a));
  }
  const TRIBE_BLURB = {
    Beast: "Markers that stay: +1/+1 and keyword markers on Beasts and their tokens, moved, stolen and gathered.",
    Construct: "Shields, Taunt and armour that grows each time a Shield breaks.",
    Spirit: "Reborn minions that come back stronger and feed on deaths.",
    Corsair: "Extra gold, cheap selling, and Corsairs that pump each other up.",
    Elemental: "Free refreshes, a stronger tavern, and tavern spells.",
    Dragon: "Start of Combat fire that hits before the first attack.",
    Tidekin: "Battlecries that trigger twice, and Tidekin that grow with every Battlecry you play.",
    Infernal: "Devour minions from the tavern to steal their stats, sometimes at the cost of your Health.",
  };

  const BASE_BLURB = Object.assign({}, TRIBE_BLURB);
  // text uses {n} for the effect amount (doubled when golden).
  const CARDS = {
    // ---------------- Beasts
    // Beasts (v78): markers that stay. +1/+1 and keyword markers, tokens that carry them, and Beasts that move, steal and gather them.
    cute_antelope:   { name: "Cute Antelope", tier: 1, tribe: BEAST, attack: 1, health: 2, mk: { kw: ["windfury"] }, text: "" },
    funny_lemur:     { name: "Funny Lemur", tier: 1, tribe: BEAST, attack: 2, health: 1, mk: { kw: ["tough"] }, text: "" },
    lion_mother:     { name: "Lion Mother", tier: 2, tribe: BEAST, attack: 3, health: 2, text: "", abilities: [{ trigger: "activate", actCost: 2, action: "summon", card: "cub", count: 1 }],
                       gold: { on: true, attack: 6, health: 4, abilities: [{ trigger: "activate", actCost: 2, action: "summon", card: "cub", count: 2 }] } },
    proud_bird:      { name: "Proud Bird", tier: 2, tribe: BEAST, attack: 2, health: 2, text: "", abilities: [{ trigger: "battlecry", action: "summon", card: "birdie", count: 1 }],
                       gold: { on: true, attack: 4, health: 4, abilities: [{ trigger: "battlecry", action: "summon", card: "birdie", count: 2 }] } },
    friendly_zebra:  { name: "Friendly Zebra", tier: 3, tribe: BEAST, attack: 1, health: 2, text: "", abilities: [{ trigger: "afterWin", action: "summonCopy", target: "self", count: 1 }],
                       gold: { on: true, attack: 2, health: 4, abilities: [{ trigger: "afterWin", action: "summonCopy", target: "self", count: 1, exact: true }] } },
    mother_hippo:    { name: "Mother Hippo", tier: 3, tribe: BEAST, attack: 3, health: 4, text: "", abilities: [{ trigger: "startOfCombat", action: "randomKeyword", target: "tokens" }],
                       gold: { on: true, attack: 6, health: 8, abilities: [{ trigger: "startOfCombat", action: "mkKw", mkw: "random", n: 1, target: "tokens" }] } },
    reaper_lion:     { name: "Reaper Lion", tier: 3, tribe: BEAST, attack: 4, health: 3, mk: { kw: ["tough"] }, text: "", abilities: [{ trigger: "startOfCombat", action: "enemyKw" }],
                       gold: { on: true, attack: 6, health: 8, abilities: [{ trigger: "startOfCombat", action: "enemyKw", asMk: true }] } },
    guardian_giraffe:{ name: "Guardian Giraffe", tier: 4, tribe: BEAST, attack: 2, health: 7, taunt: true, text: "", abilities: [{ trigger: "battlecry", action: "mkKw", mkw: "shield", n: 1, target: "pickFriend", ttribe: BEAST }],
                       gold: { on: true, attack: 4, health: 14, abilities: [{ trigger: "battlecry", action: "mkKw", mkw: "shield", n: 1, target: "pickFriend", ttribe: BEAST }] } },
    zebu_traveler:   { name: "Zebu Traveler", tier: 4, tribe: BEAST, attack: 5, health: 3, text: "", abilities: [{ trigger: "onAttack", action: "absorb", target: "rightmost", count: 1, ttribe: BEAST }],
                       gold: { on: true, attack: 10, health: 6, abilities: [{ trigger: "onAttack", action: "absorb", target: "rightmost", count: 2, ttribe: BEAST }] } },
    curious_buffalo: { name: "Curious Buffalo", tier: 5, tribe: BEAST, attack: 6, health: 5, cleave: true, text: "" },
    elephant_king:   { name: "Elephant King", tier: 5, tribe: BEAST, attack: 5, health: 6, mk: { kw: ["tough"] }, text: "",
                       abilities: [{ trigger: "activate", actCost: 1, action: "sacrifice", target: "pickFriend", give: "" }, { trigger: "andThen", action: "mkKw", mkw: "random", n: 1, target: "self" }],
                       gold: { on: true, attack: 10, health: 11, abilities: [{ trigger: "activate", actCost: 1, action: "sacrifice", target: "pickFriend", give: "" }, { trigger: "andThen", action: "mkKw", mkw: "random", n: 2, target: "self" }] } },
    king_gorilla:    { name: "Fierce King Gorilla", tier: 6, tribe: BEAST, attack: 10, health: 6, cleave: true, text: "",
                       abilities: [{ trigger: "onAttack", action: "mkTake", mkeep: "copy", target: "weakestEnemy" }, { trigger: "onAttack", action: "absorb", target: "weakestEnemy" }],
                       gold: { on: true, attack: 20, health: 12, abilities: [{ trigger: "onAttack", action: "mkTake", mkeep: "copy", target: "weakestEnemy", repeat: 2 }, { trigger: "onAttack", action: "absorb", target: "weakestEnemy", repeat: 2 }] } },
    old_king:        { name: "Old King", tier: 6, tribe: BEAST, attack: 7, health: 8, text: "",
                       abilities: [{ trigger: "battlecry", action: "absorb", target: "oldest", ttribe: BEAST }, { trigger: "battlecry", action: "mkTake", mkeep: "copy", target: "oldest", ttribe: BEAST },
                         { trigger: "afterWin", action: "absorb", target: "oldest", ttribe: BEAST }, { trigger: "afterWin", action: "mkTake", mkeep: "copy", target: "oldest", ttribe: BEAST }],
                       gold: { on: true, attack: 14, health: 16, abilities: [{ trigger: "battlecry", action: "absorb", target: "oldest", ttribe: BEAST, repeat: 2 }, { trigger: "battlecry", action: "mkTake", mkeep: "copy", target: "oldest", ttribe: BEAST, repeat: 2 },
                         { trigger: "afterWin", action: "absorb", target: "oldest", ttribe: BEAST, repeat: 2 }, { trigger: "afterWin", action: "mkTake", mkeep: "copy", target: "oldest", ttribe: BEAST, repeat: 2 }] } },
    // ---------------- Constructs
    tin_squire:     { aff: ["steam"], name: "Tin Squire", tier: 1, tribe: CONSTRUCT, attack: 1, health: 2, shield: true, text: "" },
    gear_golem:     { aff: ["steam"], name: "Gear Golem", tier: 2, tribe: CONSTRUCT, attack: 2, health: 4, taunt: true, battlecry: "buff_random_construct", text: "Battlecry: Give another friendly Construct +{n}/+{n}.", n: 2 },
    arc_sentinel:   { aff: ["steam", "earth"], name: "Arc Sentinel", tier: 3, tribe: CONSTRUCT, attack: 3, health: 3, taunt: true, shield: true, text: "" },
    twinblade:      { aff: ["steam"], name: "Twin-Blade Automaton", tier: 4, tribe: CONSTRUCT, attack: 3, health: 4, windfury: true, shield: true, text: "" },
    shield_forge:   { aff: ["steam"], name: "Shield Forge", tier: 5, tribe: CONSTRUCT, attack: 4, health: 6, onShieldLost: "forge", text: "After a friendly Shield breaks, give your Constructs +{n} Attack.", n: 2 },
    titan_engine:   { aff: ["steam"], name: "Titan Engine", tier: 6, tribe: CONSTRUCT, attack: 6, health: 8, startOfCombat: "shield_constructs", text: "Start of Combat: Give your other Constructs Shield.", textG: "Start of Combat: Give your other Constructs Shield and +3/+3." },
    // ---------------- Spirits
    grave_moth:     { aff: ["water"], name: "Grave Moth", tier: 1, tribe: SPIRIT, attack: 2, health: 1, reborn: true, text: "" },
    wailing_shade:  { aff: ["water"], name: "Wailing Shade", tier: 2, tribe: SPIRIT, attack: 3, health: 2, deathrattle: "buff_spirits", text: "Deathrattle: Give your other Spirits +{n}/+{n}.", n: 2 },
    bone_collector: { aff: ["tar"], name: "Bone Collector", tier: 3, tribe: SPIRIT, attack: 2, health: 4, onAllyDeath: "grow", text: "After a friendly minion dies in combat, gain +{n}/+{n}.", n: 1 },
    crypt_warden:   { aff: ["earth"], name: "Crypt Warden", tier: 4, tribe: SPIRIT, attack: 3, health: 5, onReborn: "reborn_buff", text: "After a friendly minion is Reborn, give it +{n}/+{n}.", n: 4 },
    ash_lich:       { aff: ["tar"], name: "Ash Lich", tier: 5, tribe: SPIRIT, attack: 4, health: 6, reborn: true, deathrattle: "buff_spirits", text: "Deathrattle: Give your other Spirits +{n}/+{n}.", n: 2 },
    pale_sovereign: { aff: ["water"], name: "Pale Sovereign", tier: 6, tribe: SPIRIT, attack: 7, health: 7, deathrattle: "spirits_reborn", text: "Deathrattle: Give your other Spirits Reborn.", textG: "Deathrattle: Give your other Spirits Reborn and +3/+3." },
    // ---------------- Corsairs
    deck_scamp:     { aff: ["water"], name: "Deck Scamp", tier: 1, tribe: CORSAIR, attack: 2, health: 1, onSell: "scamp", text: "Sells for {n} extra gold.", n: 2 },
    bounty_captain: { aff: ["tar"], name: "Bounty Captain", tier: 2, tribe: CORSAIR, attack: 3, health: 2, onBuy: "corsair_rally", text: "After you buy a Corsair, give your Corsairs +{n}/+{n}.", n: 1 },
    gold_smuggler:  { aff: ["water"], name: "Gold Smuggler", tier: 3, tribe: CORSAIR, attack: 3, health: 4, battlecry: "next_gold", text: "Battlecry: Gain {n} extra gold next turn.", n: 3 },
    cannoneer:      { aff: ["tar", "steam"], name: "Cannoneer", tier: 4, tribe: CORSAIR, attack: 4, health: 4, startOfCombat: "cannon", text: "Start of Combat: Deal 3 damage to a random enemy minion.", textG: "Start of Combat: Deal 3 damage to a random enemy minion, twice." },
    dread_corsair:  { aff: ["tar"], name: "Dread Corsair", tier: 5, tribe: CORSAIR, attack: 5, health: 5, onAttack: "corsair_cheer", text: "Whenever this attacks, give your other Corsairs +{n}/+{n}.", n: 2 },
    admiral:        { aff: ["water"], name: "Admiral Brinebeard", tier: 6, tribe: CORSAIR, attack: 7, health: 7, endOfTurn: "admiral", text: "At the end of your turn, give your other Corsairs +{n}/+{n}.", n: 4 },
    // ---------------- Elementals
    spark_sprite:   { aff: ["steam"], name: "Spark Sprite", tier: 1, tribe: ELEMENTAL, attack: 1, health: 2, battlecry: "free_roll", text: "Battlecry: Your next Refresh is free.", textG: "Battlecry: Your next 2 Refreshes are free." },
    molten_brute:   { aff: ["earth"], name: "Molten Brute", tier: 2, tribe: ELEMENTAL, attack: 2, health: 3, onPlayOther: "brute", text: "After you play another Elemental, gain +{n}/+{n}.", n: 2 },
    cinder_chef:    { aff: ["steam"], name: "Cinder Chef", tier: 3, tribe: ELEMENTAL, attack: 3, health: 4, onPlayOther: "chef", text: "After you play another Elemental, minions in the tavern get +{n}/+{n} for the rest of the game.", n: 1 },
    storm_djinn:    { aff: ["water", "steam"], name: "Storm Djinn", tier: 4, tribe: ELEMENTAL, attack: 4, health: 5, battlecry: "add_spell", text: "Battlecry: Add a random tavern spell to your hand.", textG: "Battlecry: Add 2 random tavern spells to your hand." },
    magma_titan:    { aff: ["earth", "tar"], name: "Magma Titan", tier: 5, tribe: ELEMENTAL, attack: 5, health: 6, onSpell: "titan", text: "After you cast a tavern spell, gain +{n}/+{n}.", n: 2 },
    primordial:     { aff: ["steam"], name: "Primordial Flame", tier: 6, tribe: ELEMENTAL, attack: 6, health: 6, battlecry: "flame_all", text: "Battlecry: Give your other Elementals +{n}/+{n}.", n: 4 },
    // ---------------- Dragons
    ember_whelp:    { aff: ["tar"], name: "Ember Whelp", tier: 1, tribe: DRAGON, attack: 2, health: 1, startOfCombat: "whelp", text: "Start of Combat: Deal {n} damage to a random enemy minion.", n: 1 },
    scale_warder:   { aff: ["earth"], name: "Scale Warder", tier: 2, tribe: DRAGON, attack: 2, health: 4, taunt: true, battlecry: "dragon_shield", text: "Battlecry: Give another friendly Dragon Shield.", textG: "Battlecry: Give two other friendly Dragons Shield." },
    hoard_keeper:   { aff: ["earth"], name: "Hoard Keeper", tier: 3, tribe: DRAGON, attack: 3, health: 4, startOfCombat: "dragons_atk", text: "Start of Combat: Give your other Dragons +{n} Attack.", n: 1 },
    twin_flame:     { aff: ["steam"], name: "Twin-Flame Drake", tier: 4, tribe: DRAGON, attack: 3, health: 5, startOfCombat: "twin_flame", text: "Start of Combat: Deal {n} damage to two random enemy minions.", n: 2 },
    aurum_wyrm:     { aff: ["earth"], name: "Aurum Wyrm", tier: 5, tribe: DRAGON, attack: 4, health: 5, shield: true, startOfCombat: "dragons_shield", text: "Start of Combat: Give your other Dragons Shield.", textG: "Start of Combat: Give your other Dragons Shield and +2/+2." },
    cinderwing:     { aff: ["tar"], name: "Cinderwing Ancient", tier: 6, tribe: DRAGON, attack: 6, health: 7, startOfCombat: "breath", text: "Start of Combat: Deal {n} damage to all enemy minions.", n: 2 },
    // ---------------- Tidekin
    reef_crier:     { aff: ["coral"], name: "Reef Crier", tier: 1, tribe: TIDEKIN, attack: 2, health: 2, battlecry: "double_next", text: "Battlecry: Your next Battlecry this turn triggers twice.", textG: "Battlecry: Your next two Battlecries this turn trigger twice." },
    shell_drummer:  { aff: ["coral"], name: "Shell Drummer", tier: 2, tribe: TIDEKIN, attack: 2, health: 3, onPlayOther: "drummer", text: "After you play a minion with a Battlecry, gain +{n}/+{n}.", n: 1 },
    tide_caller:    { aff: ["coral", "water"], name: "Tide Caller", tier: 3, tribe: TIDEKIN, attack: 3, health: 4, battlecry: "tide_rally", text: "Battlecry: Give your other Tidekin +{n}/+{n}.", n: 2 },
    pearl_diver:    { aff: ["coral", "water"], name: "Pearl Diver", tier: 4, tribe: TIDEKIN, attack: 4, health: 4, battlecry: "add_battlecry", text: "Battlecry: Add a random minion with a Battlecry to your hand.", textG: "Battlecry: Add 2 random minions with a Battlecry to your hand." },
    deep_chanter:   { aff: ["water"], name: "Deep Chanter", tier: 5, tribe: TIDEKIN, attack: 4, health: 6, chanter: true, text: "Your Battlecries trigger twice.", textG: "Your Battlecries trigger three times." },
    leviathan:      { aff: ["coral", "water"], name: "Leviathan Herald", tier: 6, tribe: TIDEKIN, attack: 6, health: 8, battlecry: "leviathan", text: "Battlecry: Give your minions +1/+1 for each Battlecry you played this game (up to 8).", textG: "Battlecry: Give your minions +2/+2 for each Battlecry you played this game (up to 8)." },
    // ---------------- Infernals
    grubling_imp:   { aff: ["tar"], name: "Grubling Imp", tier: 1, tribe: INFERNAL, attack: 3, health: 1, battlecry: "lose_health", text: "Battlecry: Your hero loses 2 Health." },
    hungering_fiend:{ aff: ["tar"], name: "Hungering Fiend", tier: 2, tribe: INFERNAL, attack: 2, health: 2, battlecry: "devour", text: "Battlecry: Devour a random minion in the tavern.", textG: "Battlecry: Devour 2 random minions in the tavern." },
    soul_glutton:   { aff: ["tar"], name: "Soul Glutton", tier: 3, tribe: INFERNAL, attack: 3, health: 4, onDevour: "glutton", text: "After you Devour, give your other Infernals +{n}/+{n}.", n: 1 },
    pit_butcher:    { aff: ["earth"], name: "Pit Butcher", tier: 4, tribe: INFERNAL, attack: 4, health: 5, endOfTurn: "butcher", text: "At the end of your turn, Devour a random minion in the tavern.", textG: "At the end of your turn, Devour 2 random minions in the tavern." },
    abyssal_maw:    { aff: ["tar"], name: "Abyssal Maw", tier: 5, tribe: INFERNAL, attack: 5, health: 6, maw: true, text: "Devouring gives one and a half times the stats.", textG: "Devouring gives double the stats." },
    lord_of_cinders:{ aff: ["tar"], name: "Lord of Cinders", tier: 6, tribe: INFERNAL, attack: 7, health: 7, battlecry: "devour_all", text: "Battlecry: Devour 3 random minions in the tavern.", textG: "Battlecry: Devour 3 random minions in the tavern for twice the stats." },
    // ---------------- Neutral
    lantern_keeper: { aff: ["coral"], name: "Lantern Keeper", tier: 1, tribe: NEUTRAL, attack: 2, health: 2, battlecry: "buff_random_friend", text: "Battlecry: Give another friendly minion +{n}/+{n}.", n: 1 },
    tavern_bard:    { name: "Tavern Bard", tier: 2, tribe: NEUTRAL, attack: 2, health: 3, endOfTurn: "buff_random_friend", text: "At the end of your turn, give another friendly minion +{n}/+{n}.", n: 1 },
    rally_herald:   { aff: ["coral"], name: "Rallying Herald", tier: 4, tribe: NEUTRAL, attack: 3, health: 5, battlecry: "herald", text: "Battlecry: Give your minions +{n}/+{n} for each different tribe among them.", n: 1 },
    great_warden:   { aff: ["earth"], name: "Great Warden", tier: 5, tribe: NEUTRAL, attack: 5, health: 7, taunt: true, startOfCombat: "buff_all_friends", text: "Start of Combat: Give your other minions +{n}/+{n}.", n: 1 },
    grand_champion: { name: "Grand Champion", tier: 6, tribe: NEUTRAL, attack: 6, health: 10, taunt: true, shield: true, text: "" },
    // ---------------- Affinity cards (neutral: they show up in every lobby)
    coral_bud:        { aff: ["coral"], name: "Coral Bud", tier: 1, tribe: NEUTRAL, attack: 1, health: 2, text: "", abilities: [{ trigger: "pulse", action: "buff", target: "randomFriend", count: 1, a: 1, h: 1 }] },
    gilded_polyp:     { aff: ["coral"], name: "Gilded Polyp", tier: 2, tribe: NEUTRAL, attack: 2, health: 2, text: "", abilities: [{ trigger: "pulse", action: "gold", n: 1, limit: "turn" }] },
    catalyst_coral:   { aff: ["coral"], name: "Catalyst Coral", tier: 2, tribe: NEUTRAL, attack: 1, health: 3, text: "", abilities: [{ trigger: "pulse", action: "charge", target: "allFriends", n: 1 }] },
    reef_echo:        { aff: ["coral", "water"], name: "Reef Echo", tier: 3, tribe: NEUTRAL, attack: 2, health: 4, text: "", abilities: [{ trigger: "pulse", action: "pulseDouble", n: 1 }] },
    nurturing_polyp:  { aff: ["coral"], name: "Nurturing Polyp", tier: 3, tribe: NEUTRAL, attack: 2, health: 5, text: "", abilities: [{ trigger: "pulse", action: "buff", target: "allFriends", taff: "coral", a: 1, h: 1 }] },
    reef_mother:      { aff: ["coral"], name: "Reef Mother", tier: 4, tribe: NEUTRAL, attack: 3, health: 5, text: "", abilities: [{ trigger: "pulse", action: "addCard", card: "coral_sprout", count: 1, every: 3 }] },
    reef_warden:      { aff: ["coral"], name: "Reef Warden", tier: 5, tribe: NEUTRAL, attack: 4, health: 6, text: "", abilities: [{ trigger: "pulse", action: "buff", target: "adjacent", a: 2, h: 2 }] },
    valve_sprite:     { aff: ["steam"], name: "Valve Sprite", tier: 1, tribe: NEUTRAL, attack: 1, health: 2, text: "", abilities: [{ trigger: "endOfTurn", action: "gainPressure", n: 1 }] },
    piston_brute:     { aff: ["steam"], name: "Piston Brute", tier: 2, tribe: NEUTRAL, attack: 2, health: 3, text: "", abilities: [{ trigger: "battlecry", action: "gainPressure", n: 2 }] },
    unstable_boiler:  { aff: ["steam"], name: "Unstable Boiler", tier: 3, tribe: NEUTRAL, attack: 3, health: 5, text: "", abilities: [{ trigger: "onSpell", action: "gainPressure", n: 1 }, { trigger: "battlecry", action: "buff", target: "pickFriend", a: 5, h: 5, pcost: 3 }] },
    pressure_titan:   { aff: ["steam"], name: "Pressure Titan", tier: 5, tribe: NEUTRAL, attack: 5, health: 5, text: "", abilities: [{ trigger: "battlecry", action: "buff", target: "allFriendsSelf", a: 1, h: 1, pcost: 1, pall: true }] },
    tar_spitter:      { aff: ["tar"], name: "Tar Spitter", tier: 2, tribe: NEUTRAL, attack: 3, health: 2, text: "", abilities: [{ trigger: "startOfCombat", action: "mire", target: "randomEnemy", count: 1 }] },
    sticky_slug:      { aff: ["tar"], name: "Sticky Slug", tier: 3, tribe: NEUTRAL, attack: 3, health: 7, taunt: true, text: "", abilities: [{ trigger: "onAttacked", action: "mire", target: "trigger" }] },
    bitumen_devourer: { aff: ["tar"], name: "Bitumen Devourer", tier: 5, tribe: NEUTRAL, attack: 5, health: 8, text: "", abilities: [{ trigger: "onMiredDeath", action: "permBuff", target: "self", a: 3, h: 3 }] },
    brook_nymph:      { aff: ["water"], name: "Brook Nymph", tier: 1, tribe: NEUTRAL, attack: 2, health: 1, text: "", abilities: [{ trigger: "battlecry", action: "buff", target: "self", a: 1, h: 1 }] },
    tide_shaper:      { aff: ["water"], name: "Tide Shaper", tier: 2, tribe: NEUTRAL, attack: 2, health: 3, text: "", abilities: [{ trigger: "afterReflux", action: "gold", n: 1 }] },
    cascade_spirit:   { aff: ["water"], name: "Cascade Spirit", tier: 4, tribe: NEUTRAL, attack: 4, health: 6, text: "", abilities: [{ trigger: "afterReflux", action: "buff", target: "allFriends", taff: "water", a: 2, h: 2 }] },
    pebble_mole:      { aff: ["earth"], name: "Pebble Mole", tier: 1, tribe: NEUTRAL, attack: 1, health: 2, text: "", abilities: [{ trigger: "afterFoundation", action: "buff", target: "self", a: 1, h: 1 }] },
    stone_golem:      { aff: ["earth"], name: "Stone Golem", tier: 2, tribe: NEUTRAL, attack: 2, health: 4, taunt: true, text: "", abilities: [{ trigger: "battlecry", action: "buildFoundation", target: "self" }] },
    ancestral_monolith: { aff: ["earth"], name: "Ancestral Monolith", tier: 4, tribe: NEUTRAL, attack: 4, health: 8, text: "", abilities: [{ trigger: "startOfCombat", action: "buff", target: "self", a: 5, h: 5, per: "foundations" }] },
    telluric_architect: { aff: ["earth"], name: "Telluric Architect", tier: 6, tribe: NEUTRAL, attack: 6, health: 10, text: "", abilities: [{ trigger: "endOfTurn", action: "buff", target: "foundationMinions", a: 2, h: 2 }] },
  };
  const TOKENS = {
    pup: { name: "Pup", tier: 1, tribe: BEAST, attack: 1, health: 1, token: true, text: "" },
    cub: { name: "Cub", tier: 1, tribe: BEAST, attack: 1, health: 1, token: true, text: "" },
    birdie: { name: "Birdie", tier: 1, tribe: BEAST, attack: 1, health: 1, token: true, mk: { kw: ["stealth"] }, text: "" },
    coral_sprout: { aff: ["coral"], name: "Coral Sprout", tier: 1, tribe: NEUTRAL, attack: 1, health: 1, token: true, text: "", abilities: [{ trigger: "pulse", action: "buff", target: "self", a: 1, h: 1 }] },
  };
  const SPELLS = {
    // v78: the Classic meta's tavern spells (the old ones are gone). Skies give stat markers, the Evolutions a keyword,
    // and Home + Sweet = Home Sweet Home. Made of abilities: they can be changed in the card editor like any custom spell.
    strength:        { name: "Strength", tier: 1, cost: 1, target: false, custom: true, abilities: [{ trigger: "cast", action: "nextBuyBuff", a: 1, h: 2, count: 1 }] },
    blue_sky:        { name: "Blue Sky", tier: 2, cost: 2, target: true, custom: true, abilities: [{ trigger: "cast", action: "mkPlus", n: 1, a: 2, h: 2, target: "chosen" }] },
    dawn_sky:        { name: "Dawn Sky", tier: 2, cost: 2, target: true, custom: true, abilities: [{ trigger: "cast", action: "mkPlus", n: 1, a: 1, h: 3, target: "chosen" }] },
    morning_sky:     { name: "Morning Sky", tier: 2, cost: 2, target: true, custom: true, abilities: [{ trigger: "cast", action: "mkPlus", n: 1, a: 3, h: 1, target: "chosen" }] },
    night_sky:       { name: "Night Sky", tier: 2, cost: 2, target: false, custom: true, abilities: [{ trigger: "cast", action: "mkPlus", n: 1, a: 1, h: 1, target: "randomFriendSelf", count: 2 }] },
    evo_stealth:     { name: "Evolution", tier: 3, cost: 1, target: true, custom: true, abilities: [{ trigger: "cast", action: "keyword", kw: "stealth", target: "chosen" }] },
    evo_tough:       { name: "Evolution", tier: 3, cost: 1, target: true, custom: true, abilities: [{ trigger: "cast", action: "keyword", kw: "tough", target: "chosen" }] },
    evo_windfury:    { name: "Evolution", tier: 4, cost: 2, target: true, custom: true, abilities: [{ trigger: "cast", action: "keyword", kw: "windfury", target: "chosen" }] },
    evo_shield:      { name: "Evolution", tier: 4, cost: 2, target: true, custom: true, abilities: [{ trigger: "cast", action: "keyword", kw: "shield", target: "chosen" }] },
    home:            { name: "Home", tier: 5, cost: 3, target: true, custom: true, abilities: [{ trigger: "cast", action: "doubleStats", stat: "health", target: "chosen" }] },
    sweet:           { name: "Sweet", tier: 5, cost: 3, target: true, custom: true, abilities: [{ trigger: "cast", action: "doubleStats", stat: "attack", target: "chosen" }] },
    home_sweet_home: { name: "Home Sweet Home", tier: 6, cost: 3, target: true, custom: true, abilities: [{ trigger: "cast", action: "doubleStats", stat: "both", target: "chosen" }] },
  };
  const KEYWORD_INFO = {
    taunt: "Taunt: enemies must attack this minion first.",
    shield: "Shield: blocks the first damage this minion takes.",
    reborn: "Reborn: returns with 1 Health the first time it dies.",
    windfury: "Windfury: attacks twice.",
    venomous: "Venomous: destroys any minion it damages.",
    cleave: "Cleave: also damages the minions next to its target.",
    stealth: "Stealth: can't be attacked or targeted by enemies until it attacks.",
    devour: "Devour: remove a minion from the tavern and gain its Attack and Health.",
    magnetic: "Magnetic: play it directly to the left of a friendly minion that shares a tribe with it and they merge: that minion gains its stats, keywords and effects.",
    rally: "Rally: Start of Combat, this minion gains +1/+1 for each other friendly minion that shares a tribe with it.",
    tough: "Tough: takes 1 less damage from every hit.",
    flying: "Flying: ignores Taunt when it attacks (it hits a random minion without Taunt; if they all have Taunt, one of them).",
  };
  // every keyword a minion can carry, in display order
  const KW_LIST = ["taunt", "shield", "reborn", "windfury", "venomous", "cleave", "stealth", "magnetic", "rally", "tough", "flying"];
  const KW_RANDOM_COMBAT = KW_LIST.filter((k) => k !== "stealth" && k !== "magnetic");
  // ---------------------------------------------------------------- Markers (v78)
  // Like counters in a card game, a marker sits ON a minion and stays there until something moves it:
  //  - stat markers (+1/+1, and other sizes like +2/+2, +1/+3, +3/+1) stack; each one adds its stats (part of the minion's stats).
  //  - keyword markers (one per keyword): the minion has that keyword as long as the marker is on it.
  // A minion keeps its markers from turn to turn; markers given or taken in combat are kept back in the tavern.
  // m.mk = { st: { "a/h": how many }, kw: { keyword: 1 } } or null.
  const MK_KWS = () => KW_LIST.filter((k) => k !== "magnetic");
  const mkKey = (a, h) => `${a | 0}/${h | 0}`;
  const mkParse = (k) => { const [a, h] = String(k).split("/").map(Number); return [a || 0, h || 0]; };
  const mkSt = (m) => (m && m.mk && m.mk.st) || {};
  const mkStN = (m) => Object.values(mkSt(m)).reduce((t, n) => t + n, 0);
  const mkN = (m) => (m && m.mk ? mkStN(m) + Object.keys(m.mk.kw || {}).length : 0);
  const mkKws = (m) => (m && m.mk ? Object.keys(m.mk.kw || {}) : []);
  const mkCopy = (mk) => (mk ? { st: Object.assign({}, mk.st), kw: Object.assign({}, mk.kw) } : null);
  // the stats all its stat markers give: [Attack, Health]
  function mkStatAH(m) { let a = 0, h = 0; for (const [k, n] of Object.entries(mkSt(m))) { const [x, y] = mkParse(k); a += x * n; h += y * n; } return [a, h]; }
  // a keyword the card itself has (not given by a marker): it stays when the marker leaves
  function mkInnate(m, k) { const d = CARDS[m.cardId] || TOKENS[m.cardId]; return !!(d && d[k] && !(d.mk && (d.mk.kw || []).includes(k))) || !!(m.ckwKw && m.ckwKw[k]); }
  // +n (or -n) stat markers of one size ("1/1", "2/2"…); returns how many really moved. Losing markers never takes a minion below 1 Health.
  function mkAddStat(m, key, n) {
    if (!m || !n) return 0;
    const c = m.mk || (m.mk = { st: {}, kw: {} }), st = c.st || (c.st = {});
    if (n < 0) n = -Math.min(st[key] || 0, -n);
    if (!n) return 0;
    const [a, h] = mkParse(key);
    st[key] = (st[key] || 0) + n; if (!st[key]) delete st[key];
    m.attack = Math.max(0, m.attack + a * n); m.maxHealth += h * n; m.health = Math.max(1, m.health + h * n); if (m.maxHealth < 1) m.maxHealth = 1;
    return n;
  }
  const mkAddP = (m, n) => mkAddStat(m, "1/1", n);
  function mkAddKw(m, k) {
    if (!m || !MK_KWS().includes(k)) return false;
    const c = m.mk || (m.mk = { st: {}, kw: {} });
    if (c.kw[k]) return false;
    c.kw[k] = 1; m[k] = true; return true;
  }
  function mkDelKw(m, k) {
    const c = m && m.mk; if (!c || !c.kw[k]) return false;
    delete c.kw[k]; if (!mkInnate(m, k)) m[k] = false; return true;
  }
  // the markers a card starts with: def.mk = { p: +1/+1 markers, st: { "2/2": n }, kw: [...] }
  function mkStart(m, d) { const s = d && d.mk; if (!s) return; for (const k of s.kw || []) mkAddKw(m, k); if (s.p > 0) mkAddP(m, s.p); for (const k in s.st || {}) if (s.st[k] > 0) mkAddStat(m, k, s.st[k]); }
  // the markers one can take off a minion: "s:a/h" for a stat marker, or a keyword. kind: "p" (stat markers), "kw" or "" (any)
  function mkOpts(a, kind, b) {
    if (!a || !a.mk) return [];
    return [...(kind !== "kw" ? Object.keys(mkSt(a)).filter((k) => a.mk.st[k] > 0).map((k) => "s:" + k) : []), ...(kind !== "p" ? mkKws(a).filter((k) => !(b && b.mk && b.mk.kw[k])) : [])];
  }
  // one marker from a onto b (or just off a when b is null). Returns "s:a/h", a keyword, or "".
  function mkMoveOne(a, b, kind, rng, keep) {
    if (!a || !a.mk || a === b) return "";
    const opts = mkOpts(a, kind, b); if (!opts.length) return "";
    const pick = opts.length === 1 ? opts[0] : rng.pick(opts);
    if (pick.startsWith("s:")) { const key = pick.slice(2); if (!keep) mkAddStat(a, key, -1); if (b) mkAddStat(b, key, 1); }
    else { if (!keep) mkDelKw(a, pick); if (b) mkAddKw(b, pick); }
    return pick;
  }
  // every marker of a onto b (keep: b gains a copy and a keeps them). times multiplies the stat markers gained.
  function mkTakeAll(a, b, keep, times = 1) {
    const got = { st: {}, kw: [] };
    if (!a || !a.mk || a === b) return got;
    const st = Object.assign({}, mkSt(a)), kws = mkKws(a);
    if (!keep) { for (const k in st) mkAddStat(a, k, -st[k]); for (const k of kws) mkDelKw(a, k); }
    for (const k in st) { const n = mkAddStat(b, k, st[k] * Math.max(1, times)); if (n) got.st[k] = n; }
    got.kw = kws.filter((k) => mkAddKw(b, k));
    return got;
  }
  function mkApply(m, pb) { for (const k in pb.mks || {}) mkAddStat(m, k, pb.mks[k]); for (const k of pb.mka || []) mkAddKw(m, k); for (const k of pb.mkd || []) mkDelKw(m, k); }
  const mkStLabel = (st) => Object.entries(st || {}).map(([k, n]) => { const [a, h] = mkParse(k); return `${n > 1 ? n + "× " : ""}+${a}/+${h}`; }).join(" ");
  const mkLabel = (got) => [mkStLabel(got.st), ...(got.kw || []).map((k) => kwName(k))].filter(Boolean).join(" · ") || "Markers";
  const mkOneLabel = (w) => (w.startsWith("s:") ? mkStLabel({ [w.slice(2)]: 1 }) + " marker" : kwName(w) + " marker");
  // a card's golden version: its own stats and effects when the meta sets them (card editor, Gold tab), else everything x2
  const goldOf = (d) => (d && d.gold && d.gold.on ? d.gold : null);
  const GOLD_ABS = new WeakMap();
  function goldAbilities(g) { let l = GOLD_ABS.get(g); if (!l) { l = (g.abilities || []).map((ab) => Object.assign({}, ab, { golden: false })); GOLD_ABS.set(g, l); } return l; }
  // do two minions share a tribe? (used by Magnetic and Rally)
  const sharesTribe = (a, b) => (a.allTribes || b.allTribes ? tribesOf(a).length > 0 && tribesOf(b).length > 0 : tribesOf(a).some((t) => hasTribe(b, t)));

  function def(id) {
    const d = CARDS[id] || TOKENS[id];
    if (!d) throw new Error("Unknown card " + id);
    return d;
  }
  function builtInText(d, golden) {
    if (d.noBuiltIn) return evolveText(d);
    if (golden && d.textG) return [d.textG, evolveText(d)].filter(Boolean).join(" ");
    return [(d.text || "").replace(/\{n\}/g, String((d.n || 0) * (golden ? 2 : 1))), evolveText(d)].filter(Boolean).join(" ");
  }
  // cards from before Evolve was an ability carried evolveAt / evolveInto fields: read them as an Evolve ability
  function withLegacyEvolve(d) { const abs = d.abilities || []; if (!d.evolveAt || !d.evolveInto || abs.some((ab) => ab.trigger === "onReach")) return abs; return abs.concat([{ trigger: "onReach", stat: "either", at: d.evolveAt, action: "evolve", card: d.evolveInto, target: "self" }]); }
  function evolveText() { return ""; }
  const TEXT_CACHE = new Map(); // "id|g" -> text; cleared whenever the card set changes
  function cardText(id, golden) {
    const key = id + (golden ? "|g" : "|n");
    let t = TEXT_CACHE.get(key);
    if (t !== undefined) return t;
    const d = def(id), g = golden ? goldOf(d) : null;
    t = g && g.text ? g.text : d.customText && !(g && g.abilities) ? (LANG === "fr" && d.customTextFr ? d.customTextFr : d.customText) : [builtInText(d, golden), ...(g && g.abilities ? goldAbilities(g) : d.abilities || []).map((ab) => abilityText(ab, golden))].filter(Boolean).join(" ");
    TEXT_CACHE.set(key, t);
    return t;
  }

  // ---------------------------------------------------------------- data-driven effects
  // An ability is { trigger, action, target, ... }. The editor builds them; the
  // engine runs them in the tavern and in combat exactly like built-in effects.
  const TRIGGERS = {
    battlecry:     { label: "Battlecry (when played)", phase: "tavern", text: () => "Battlecry: " },
    endOfTurn:     { label: "At the end of your turn", phase: "tavern", text: () => "At the end of your turn, " },
    startOfTurn:   { label: "At the start of your turn", phase: "tavern", text: () => "At the start of your turn, " },
    onBuy:         { label: "After you buy a minion", phase: "tavern", filter: true, text: (f) => `After you buy ${f ? "a " + f : "a minion"}, ` },
    onPlayOther:   { label: "After you play another minion", phase: "tavern", filter: true, text: (f) => `After you play ${f ? "a " + f : "another minion"}, ` },
    onSell:        { label: "When you sell this", phase: "tavern", text: () => "When you sell this, " },
    onSpell:       { label: "After you cast a tavern spell", phase: "tavern", text: () => "After you cast a tavern spell, " },
    startOfCombat: { label: "Start of Combat", phase: "combat", text: () => "Start of Combat: " },
    onAttack:      { label: "Whenever this attacks", phase: "combat", text: () => "Whenever this attacks, " },
    deathrattle:   { label: "Deathrattle (when it dies)", phase: "combat", text: () => "Deathrattle: " },
    onAllyDeath:   { label: "After a friendly minion dies", phase: "combat", filter: true, text: (f) => `After a friendly ${f || "minion"} dies, ` },
    onSummonAlly:  { label: "After a friendly minion is summoned", phase: "combat", filter: true, text: (f) => `After a friendly ${f || "minion"} is summoned in combat, ` },
    onShieldLost:  { label: "After a friendly Shield breaks", phase: "combat", text: () => "After a friendly Shield breaks, " },
    onBuffed:      { label: "Whenever this gains stats", phase: "tavern", text: () => "Whenever this gains stats, " },
    onDamaged:     { label: "Whenever this takes damage", phase: "combat", text: () => "Whenever this takes damage and survives, " },
    onKill:        { label: "After this kills a minion", phase: "combat", text: () => "After this kills a minion, " },
    onFriendlyAttack: { label: "Whenever another friendly minion attacks", phase: "combat", filter: true, text: (f) => `Whenever another friendly ${f || "minion"} attacks, ` },
    afterUpgrade:  { label: "After you upgrade the tavern", phase: "tavern", text: () => "After you upgrade your tavern, " },
    onRoll:        { label: "After you refresh the tavern", phase: "tavern", text: () => "After you refresh the tavern, " },
    onSellOther:   { label: "After you sell another minion", phase: "tavern", filter: true, text: (f) => `After you sell ${f ? "a " + f : "another minion"}, ` },
    onTriple:      { label: "After you make a golden minion", phase: "tavern", filter: true, text: (f) => `After you make a golden ${f || "minion"}, ` },
    onFreeze:      { label: "After you freeze the tavern", phase: "tavern", text: () => "After you freeze the tavern, " },
    onBuyFrozen:   { label: "After you buy a Frozen minion", phase: "tavern", text: () => "After you buy a Frozen minion, " },
    onFreezeFoe:   { label: "After your side Freezes an enemy", phase: "combat", text: () => "After your side Freezes an enemy, " },
    afterDevour:   { label: "After you Devour", phase: "tavern", filter: true, text: (f) => `After you Devour ${f ? "a " + f : ""}`.trim() + ", " },
    onSpellTargeted: { label: "When a tavern spell targets this", phase: "tavern", text: () => "When a tavern spell targets this, " },
    onBuySpell:    { label: "After you buy a tavern spell", phase: "tavern", text: () => "After you buy a tavern spell, " },
    afterWin:      { label: "After you win a combat", phase: "tavern", text: () => "After you win a combat, " },
    afterLoss:     { label: "After you lose a combat", phase: "tavern", text: () => "After you lose a combat, " },
    onEnemyDeath:  { label: "After an enemy minion dies", phase: "combat", filter: true, text: (f) => `After an enemy ${f || "minion"} dies, ` },
    onRebornAlly:  { label: "After a friendly minion is Reborn", phase: "combat", filter: true, text: (f) => `After a friendly ${f || "minion"} comes back with Reborn, ` },
    onPlayBattlecry: { label: "After you play a Battlecry minion", phase: "tavern", filter: true, text: (f) => `After you play a ${f ? f + " with a Battlecry" : "Battlecry minion"}, ` },
    onOverkill:    { label: "Overkill (this kills with damage to spare)", phase: "combat", text: () => "Overkill: " },
    onLastStanding: { label: "When this is your last minion standing", phase: "combat", text: () => "When this is your last minion standing, " },
    onDeathrattleFriend: { label: "After a friendly Deathrattle triggers", phase: "combat", filter: true, text: (f) => `After a friendly ${f ? f + "'s " : ""}Deathrattle triggers, ` },
    afterCombat:   { label: "After each combat (win or lose)", phase: "tavern", text: () => "After each combat, " },
    afterSurvive:  { label: "After this survives a combat", phase: "tavern", text: () => "After this survives a combat, " },
    onDiscover:    { label: "After you Discover a minion", phase: "tavern", filter: true, text: (f) => `After you Discover ${f ? "a " + f : "a minion"}, ` },
    onEnemySummon: { label: "After an enemy minion is summoned", phase: "combat", filter: true, text: (f) => `After an enemy ${f || "minion"} is summoned, ` },
    onDevoured:    { label: "When this is Devoured", phase: "tavern", text: () => "When this is Devoured, " },
    pulse:         { label: "Pulse (Coral: fires when a Coral is played next to it)", phase: "tavern", text: () => (affMech(affsOfKind("pulse")[0], "en") || "Pulse") + ": " },
    onAttacked:    { label: "Whenever this is attacked", phase: "combat", text: () => "Whenever this is attacked, " },
    onMiredDeath:  { label: "After a Mired enemy minion dies (Tar)", phase: "combat", text: () => "After a Mired enemy minion dies, " },
    afterReflux:   { label: "After one of your minions Ebbs back to your hand (Water)", phase: "tavern", text: () => "After one of your minions Ebbs back to your hand, " },
    afterFoundation: { label: "After you build a Foundation (Earth)", phase: "tavern", text: () => "After you build a Foundation, " },
    onFoundationPlay: { label: "Bedrock: when you play this onto a Foundation (Earth)", phase: "tavern", text: () => "Bedrock: when played onto a Foundation, " },
    onSelfEbb:     { label: "When this Ebbs back to your hand (Water)", phase: "tavern", text: () => "When this Ebbs back to your hand, " },
    onPressureFull: { label: "When your Pressure fills up (Steam)", phase: "tavern", text: () => "When your Pressure fills up, " },
    onMire:        { label: "After your side Mires an enemy (Tar)", phase: "combat", text: () => "After your side Mires an enemy, " },
    passive:       { label: "Aura: always, while on your board", phase: "passive", text: () => "" },
    gameStart:     { label: "At the start of the game", phase: "tavern", hero: true, text: () => "At the start of the game, " },
    cast:          { label: "When cast", phase: "tavern", spell: true, text: () => "" },
    activate:      { label: "Activate (click it on your board, costs gold, once per turn)", phase: "tavern", text: () => "Activate: " },
    onReach:       { label: "Evolve: when this reaches N Attack / Health", phase: "tavern", text: () => "Evolve: " },
    work:          { label: "Work: after this has been activated N times", phase: "tavern", text: () => "Work: " },
    evoFull:       { label: "Evolve: when its Evolution crystal is full", phase: "tavern", text: () => "Evolve: " },
    onAffUp:       { label: "When one of your affinities wakes up or grows", phase: "tavern", text: () => "When one of your affinities wakes up or grows, " },
    andThen:       { label: "Then: if the rule above happened (tavern)", phase: "tavern", chain: true, text: () => "Then, " },
    orElse:        { label: "Otherwise: if the rule above didn't happen (tavern)", phase: "tavern", chain: true, text: () => "Otherwise, " },
    andThenC:      { label: "Then: if the rule above happened (combat)", phase: "combat", chain: true, text: () => "Then, " },
    orElseC:       { label: "Otherwise: if the rule above didn't happen (combat)", phase: "combat", chain: true, text: () => "Otherwise, " },
    onSignal:      { label: "When a signal is sent (tavern)", phase: "tavern", text: () => "When the signal is sent, " },
    onSignalC:     { label: "When a signal is sent (combat)", phase: "combat", text: () => "When the signal is sent, " },
  };
  const ACTIONS = {
    buff:       { label: "Give Attack / Health", fields: ["a", "h", "target"] },
    keyword:    { label: "Give a keyword", fields: ["kw", "target"] },
    damage:     { label: "Deal damage", phase: "combat", fields: ["n", "target"] },
    summon:     { label: "Summon minions", fields: ["card", "count", "stats"] },
    gold:       { label: "Gain gold now", phase: "tavern", fields: ["n"] },
    nextGold:   { label: "Gain gold next turn", phase: "tavern", fields: ["n"] },
    freeRoll:   { label: "Free Refreshes", phase: "tavern", fields: ["n"] },
    addMinion:  { label: "Add random minions to hand", phase: "tavern", fields: ["count", "tribe"] },
    addSpell:   { label: "Add random tavern spells to hand", phase: "tavern", fields: ["count"] },
    addSpellId: { label: "Add a given tavern spell to hand", phase: "tavern", fields: ["spell", "count"] },
    castSpell:  { label: "Cast a given tavern spell for free", phase: "tavern", fields: ["spell", "target"] },
    copySpell:  { label: "Add a copy of the last tavern spell you cast to hand", phase: "tavern", fields: ["count"] },
    addCard:    { label: "Add a specific minion to your hand", phase: "tavern", fields: ["card", "count"] },
    evolve:     { label: "Evolve: this becomes another minion", phase: "tavern", fields: ["card"] },
    charge:     { label: "Charge Evolution crystals", fields: ["n", "target"] },
    mutate:     { label: "Mutate: the player picks a bonus", phase: "tavern", fields: ["muts"] },
    mutateTarget: { label: "Give a mutation to another minion", phase: "tavern", fields: ["muts", "target"] },
    absorb:     { label: "Gain the Attack / Health of other minions", fields: ["target"] },
    copyKeywords: { label: "Gain the keywords of other minions", fields: ["target"] },
    // markers (v78): they sit on a minion and stay there, from turn to turn, even when given in combat
    mkPlus:     { label: "Markers: give stat markers (+1/+1, +2/+2…)", fields: ["n", "a", "target"] },
    mkKw:       { label: "Markers: give a keyword marker", fields: ["mkw", "n", "target"] },
    mkMove:     { label: "Markers: move markers from other minions onto this one", fields: ["n", "mkind", "target"] },
    mkTake:     { label: "Markers: gain all the markers of other minions", fields: ["mkeep", "target"] },
    mkRemove:   { label: "Markers: remove markers", fields: ["n", "mkind", "target"] },
    enemyKw:    { label: "Gain a random keyword the enemy warband has", phase: "combat", fields: ["asMk"] },
    nextSpellTwice: { label: "Your next tavern spells are cast twice", phase: "tavern", fields: ["n"] },
    nextBattlecryTwice: { label: "Your next Battlecries trigger twice", phase: "tavern", fields: ["n"] },
    nextBuyBuff: { label: "The next minions you buy get stats", phase: "tavern", fields: ["a", "h", "count"] },
    nextPlayBuff: { label: "The next minions you play get stats", phase: "tavern", fields: ["a", "h", "count"] },
    nextSellGold: { label: "Your next sales give extra gold", phase: "tavern", fields: ["n", "count"] },
    spitCopy:   { label: "Add a copy of the last minion this Devoured to your hand", phase: "tavern", fields: [] },
    devourGold: { label: "Aura: Devouring gives gold", phase: "passive", fields: ["n"] },
    discover:   { label: "Discover a minion", phase: "tavern", fields: ["tierMode", "dtribe", "dkw", "daff", "choices", "times", "dgolden"] },
    devour:     { label: "Devour minions", phase: "tavern", fields: ["count", "target", "devourFrom"] },
    tavernBuff: { label: "Buff the tavern for the rest of the game", phase: "tavern", fields: ["n"] },
    hero:       { label: "Change your hero's Health", phase: "tavern", fields: ["n"] },
    destroy:    { label: "Destroy minions", phase: "combat", fields: ["target"] },
    permBuff:   { label: "Give Attack / Health permanently", phase: "combat", fields: ["a", "h", "target"] },
    summonRandom: { label: "Summon random minions", fields: ["count", "tier", "tribe"] },
    addCopy:    { label: "Add a copy to your hand", phase: "tavern", fields: ["target"] },
    upgradeDiscount: { label: "Make the next tavern upgrade cheaper", phase: "tavern", fields: ["n"] },
    setStats:   { label: "Set Attack and Health", fields: ["a", "h", "target"] },
    swapStats:  { label: "Swap Attack and Health", fields: ["target"] },
    doubleStats: { label: "Double Attack or Health", fields: ["stat", "target"] },
    debuff:     { label: "Lower Attack / Health", phase: "combat", fields: ["a", "h", "target"] },
    removeKeyword: { label: "Remove a keyword", fields: ["kw", "target"] },
    heal:       { label: "Restore to full Health", phase: "combat", fields: ["target"] },
    healN:      { label: "Heal some Health", phase: "combat", fields: ["n", "target"] },
    attackNow:  { label: "Make it attack right away", phase: "combat", fields: ["target"] },
    heroDamage: { label: "Damage the enemy hero", phase: "combat", fields: ["n"] },
    summonCopy: { label: "Summon copies of a minion", fields: ["count", "stats", "exact", "target"] },
    makeGolden: { label: "Make golden", phase: "tavern", fields: ["target"] },
    transform:  { label: "Transform into a random minion", phase: "tavern", fields: ["tier", "tribe", "target"] },
    stealShop:  { label: "Take tavern minions for free", phase: "tavern", fields: ["count"] },
    buffHand:   { label: "Give stats to minions in your hand", phase: "tavern", fields: ["a", "h"] },
    empower:    { label: "Make a minion's stat effects bigger", fields: ["a", "h", "target"] },
    buffBoost:  { label: "Aura: your minions' stat effects give more", phase: "passive", fields: ["a", "h"] },
    spellBoost: { label: "Aura: your tavern spells and hero power give more stats", phase: "passive", fields: ["a", "h"] },
    spellDiscount: { label: "Aura: tavern spells cost less", phase: "passive", fields: ["n"] },
    freeUpgrade: { label: "Upgrade the tavern for free", phase: "tavern", fields: [] },
    refreshShop: { label: "Refresh the tavern for free", phase: "tavern", fields: [] },
    freezeShop: { label: "Freeze the tavern", phase: "tavern", fields: [] },
    freezeMinion: { label: "Freeze tavern minions (they stay when you refresh, until your next turn)", phase: "tavern", fields: ["target"] },
    freezeFoe:  { label: "Freeze enemy minions (they skip their next attack)", phase: "combat", fields: ["target"] },
    grantEffect: { label: "Give a minion an extra effect", phase: "tavern", fields: ["grant", "target"] },
    bounce:     { label: "Return a minion to your hand", phase: "tavern", fields: ["target"] },
    setTribe:   { label: "Change a minion's tribe", phase: "tavern", fields: ["toTribe", "target"] },
    sacrifice:  { label: "Destroy a minion and pass on its stats", phase: "tavern", fields: ["give", "target"] },
    nextCombatBuff: { label: "Next combat: your minions get stats", phase: "tavern", fields: ["a", "h"] },
    nextCombatStrike: { label: "Next combat: strike enemies at the start", phase: "tavern", fields: ["n", "spread", "count"] },
    extraBattlecry: { label: "Your Battlecries trigger extra times", phase: "passive", fields: ["n"] },
    extraDeathrattle: { label: "Your Deathrattles trigger extra times", phase: "passive", fields: ["n"] },
    extraEndOfTurn: { label: "Your end of turn effects trigger extra times", phase: "passive", fields: ["n"] },
    extraStartOfTurn: { label: "Your start of turn effects trigger extra times", phase: "passive", fields: ["n"] },
    extraStartOfCombat: { label: "Your Start of Combat effects trigger extra times", phase: "passive", fields: ["n"] },
    extraSpell: { label: "Your tavern spells are cast extra times", phase: "passive", fields: ["n"] },
    summonBuff: { label: "Minions you summon in combat get stats", phase: "passive", fields: ["a", "h"] },
    buyDiscount: { label: "Minions cost less to buy", phase: "passive", fields: ["n"] },
    rollDiscount: { label: "Refreshes cost less", phase: "passive", fields: ["n"] },
    shopSize: { label: "The tavern offers more minions", phase: "passive", fields: ["n"] },
    // affinities
    gainPressure: { label: "Gain Pressure (Steam)", fields: ["n"] },
    pulseDouble: { label: "Your next Pulse effects trigger twice (Coral)", phase: "tavern", fields: ["n"] },
    mire:       { label: "Mire enemy minions (Tar)", phase: "combat", fields: ["target"] },
    buildFoundation: { label: "Build a Foundation under minions (Earth)", phase: "tavern", fields: ["target"] },
    foundationAll: { label: "Build a Foundation under every slot of your board (Earth)", phase: "tavern", fields: [] },
    foundationGrow: { label: "Minions on Foundations get stats for each Foundation under them (Earth)", phase: "tavern", fields: ["a", "h"] },
    releasePressure: { label: "Release all your Pressure: stats for each point (Steam)", phase: "tavern", fields: ["a", "h", "target"] },
    ebbMore:    { label: "Extra Ebbs this turn (Water)", phase: "tavern", fields: ["n"] },
    affStats:   { label: "Give stats to all your minions of an affinity, on board and in hand", phase: "tavern", fields: ["aff", "a", "h"] },
    giveAff:    { label: "Give an affinity", fields: ["aff", "target"] },
    counter:    { label: "Counter: add to or set a counter of your own (Rage, Souls…)", fields: ["vname", "n", "scope", "op"] },
    signal:     { label: "Send a signal: the minions listening to it react", fields: ["sigOut"] },
    fireTrigger: { label: "Trigger their own effects (Battlecry, Deathrattle…)", fields: ["trig", "target"] },
    // game rules: only heroes and anomalies use these. They change one player's game for good.
    ruleBuy:     { label: "Rule: minions cost more or less", phase: "tavern", hero: true, fields: ["sn"] },
    ruleSell:    { label: "Rule: selling gives more or less gold", phase: "tavern", hero: true, fields: ["sn"] },
    ruleRoll:    { label: "Rule: Refreshes cost more or less", phase: "tavern", hero: true, fields: ["sn"] },
    ruleUpgrade: { label: "Rule: tavern upgrades cost more or less", phase: "tavern", hero: true, fields: ["sn"] },
    ruleShop:    { label: "Rule: the tavern shows more or fewer minions", phase: "tavern", hero: true, fields: ["sn"] },
    ruleIncome:  { label: "Rule: more or less gold every turn", phase: "tavern", hero: true, fields: ["sn"] },
    ruleMaxGold: { label: "Rule: raise or lower the gold limit", phase: "tavern", hero: true, fields: ["sn"] },
    ruleBank:    { label: "Rule: keep unspent gold for next turn", phase: "tavern", hero: true, fields: ["n"] },
    ruleDiscover: { label: "Rule: Discover shows more or fewer choices", phase: "tavern", hero: true, fields: ["sn"] },
    ruleGolden:  { label: "Rule: tavern minions may be golden", phase: "tavern", hero: true, fields: ["pct"] },
    armor:       { label: "Gain Armor", phase: "tavern", hero: true, fields: ["n"] },
    copyOpponent: { label: "Copy minions from your last opponent", phase: "tavern", hero: true, fields: ["count"] },
    goldenShop:  { label: "Make tavern minions golden", phase: "tavern", hero: true, fields: ["count"] },
    refreshUp:   { label: "Refresh with minions from a higher tier", phase: "tavern", hero: true, fields: ["n"] },
    // fun effects (anyone can use these)
    passStats:   { label: "Give a minion the stats of the one that triggered it", phase: "tavern", fields: ["target"] },
    randomKeyword: { label: "Give a random keyword", fields: ["target"] },
    goldRandom:  { label: "Gain a random amount of gold", phase: "tavern", fields: ["n"] },
    freeBuy:     { label: "Your next minions are free to buy", phase: "tavern", fields: ["n"] },
    repeatBattlecry: { label: "Trigger its Battlecry again", phase: "tavern", fields: [] },
    // hero & anomaly tricks
    stealGold:   { label: "Pickpocket gold from your next opponent", phase: "tavern", hero: true, fields: ["n"] },
    copyNextOpponent: { label: "Copy minions from your next opponent", phase: "tavern", hero: true, fields: ["count"] },
    tribeShop:   { label: "Refresh with minions of a single tribe", phase: "tavern", hero: true, fields: ["tribeMode"] },
    shuffleBoard: { label: "Shuffle your warband's order", phase: "tavern", hero: true, fields: [] },
    sharedPick:  { label: "One player picks a minion, everyone gets it", phase: "tavern", hero: true, anomaly: true, fields: ["pickTier", "pct", "count"] },
    // combat tricks
    resurrect:   { label: "Resurrect a friendly minion that died this combat", phase: "combat", fields: ["count", "stats"] },
    steal:       { label: "Take control of a random enemy minion", phase: "combat", fields: ["count"] },
    shuffleEnemies: { label: "Shuffle the enemy warband", phase: "combat", fields: [] },
    combatGold:  { label: "Gain gold next turn (from combat)", phase: "combat", fields: ["n"] },
    silence:     { label: "Silence (remove keywords and effects)", fields: ["target"] },
    reposition:  { label: "Move minions to the leftmost or rightmost spot", fields: ["where", "target"] },
    devourEnemy: { label: "Devour an enemy minion in combat", phase: "combat", fields: ["count", "share"] },
    devourBonus: { label: "Devouring gives extra stats", phase: "passive", fields: ["a", "h"] },
    devourKeywords: { label: "Devoured minions pass on their keywords", phase: "passive", fields: [] },
    frozenBuff:  { label: "Frozen tavern minions grow each turn", phase: "passive", fields: ["a", "h"] },
    goldenHand:  { label: "Make a minion in your hand golden", phase: "tavern", fields: ["count"] },
    ruleDevour:  { label: "Rule: Devouring gives 1.5× the stats", phase: "tavern", hero: true, fields: [] },
    ruleTriple:  { label: "Rule: two copies make a golden minion", phase: "tavern", hero: true, fields: [] },
    ruleDamage:  { label: "Rule: take more or less damage from fights", phase: "tavern", hero: true, fields: ["sn"] },
  };
  const RULE_MOD = { ruleBuy: "buy", ruleSell: "sell", ruleRoll: "roll", ruleUpgrade: "upgrade", ruleShop: "shop", ruleIncome: "income", ruleMaxGold: "maxGold", ruleBank: "bank", ruleDiscover: "discover", ruleGolden: "golden", ruleTriple: "triple", ruleDamage: "damage", ruleDevour: "devour" };
  const TARGETS = {
    self: "this minion", randomFriend: "random other friendly minions", allFriends: "your other minions", adjacent: "adjacent minions",
    leftmost: "your leftmost other minion", rightmost: "your rightmost other minion", trigger: "the minion that triggered it",
    randomEnemy: "random enemy minions", allEnemies: "all enemy minions", chosen: "the chosen minion (spells)", buffers: "your other minions that give stats",
    allFriendsSelf: "all your minions (this one included)", randomFriendSelf: "random friendly minions (this one included)", leftOf: "the minion to the left of this", rightOf: "the minion to the right of this",
    kin: "your other minions that share a tribe with this", weakestFriend: "your weakest other minion", strongestFriend: "your strongest other minion",
    weakestEnemy: "the weakest enemy minion", strongestEnemy: "the strongest enemy minion", frontEnemy: "the enemy's leftmost minion", backEnemy: "the enemy's rightmost minion", allMinions: "every minion on both sides",
    shopAll: "the minions in the tavern", shopRandom: "random minions in the tavern", shopFrozen: "the Frozen minions in the tavern", frozenEnemies: "the Frozen enemy minions", handAll: "the minions in your hand", handRandom: "random minions in your hand",
    tribeMost: "your other minions of your most common tribe", newest: "the minion you played most recently", oldest: "the minion you played longest ago",
    previous: "the same minions as the rule above",
    pickFriend: "another friendly minion you choose", pickAny: "one of your minions you choose", pickShop: "a tavern minion you choose", pickHand: "a minion in your hand you choose",
    colony: "your Colony (Coral)", foundationMinions: "your minions standing on Foundations (Earth)",
    tokens: "your tokens", randomToken: "random tokens of yours",
  };
  const PICK_TARGETS = new Set(["pickFriend", "pickAny", "pickShop", "pickHand"]);
  const PICK_DEVOUR = { boardPick: "board", shopPick: "shop", handPick: "hand" }; // Devour with a chosen meal
  const TARGET_PHASE = { shopFrozen: "tavern", frozenEnemies: "combat", weakestEnemy: "combat", strongestEnemy: "combat", frontEnemy: "combat", backEnemy: "combat", allMinions: "combat", shopAll: "tavern", shopRandom: "tavern", handAll: "tavern", handRandom: "tavern" }; // targets that only make sense in one phase
  // does this minion have an effect that gives stats? (for the "buffers" target and the boosts)
  const BUFF_ACTS = new Set(["buff", "permBuff", "buffHand", "tavernBuff", "nextCombatBuff", "summonBuff"]);
  const givesStats = (o) => (o.abilities || []).some((ab) => BUFF_ACTS.has(ab.action)) || /\+\d+\/\+\d+|\+\d+ Attack|\+\d+ Health|\+\d+\/\+\d+|\+\d+ Attaque|\+\d+ PV/.test(builtInText(def(o.cardId), false));
  // Options any repeatable trigger can use: every Nth time, a condition, and scaling.
  const REPEATABLE = new Set(["endOfTurn", "startOfTurn", "onBuy", "onPlayOther", "onSell", "onSpell", "onAttack", "onAllyDeath", "onSummonAlly", "onShieldLost", "onDamaged", "onKill", "onFriendlyAttack", "afterUpgrade", "onRoll",
    "onSellOther", "onTriple", "onFreeze", "onBuySpell", "onBuyFrozen", "onFreezeFoe", "afterDevour", "onSpellTargeted", "afterWin", "afterLoss", "onEnemyDeath", "onRebornAlly", "onPlayBattlecry", "onOverkill", "onDeathrattleFriend",
    "afterCombat", "afterSurvive", "onDiscover", "onEnemySummon", "onDevoured", "activate", "onBuffed", "onAttacked", "onMiredDeath", "afterReflux", "afterFoundation", "pulse", "onSignal", "onSignalC", "onAffUp", "onPressureFull", "onMire", "onSelfEbb"]);
  // Passives: "while this is on your board". Golden copies count double unless the ability says otherwise.
  function passive(board, action, except) {
    let t = 0;
    for (const m of board) {
      if (m === except || m.health <= 0 || !m.abilities) continue;
      for (const ab of m.abilities) if (ab.trigger === "passive" && ab.action === action && affOk(ab, board)) t += (ab.n || 1) * (ab.golden === false ? 1 : m.mult());
    }
    return t;
  }
  function passiveStats(board, except) {
    let a = 0, h = 0;
    for (const m of board) {
      if (m === except || m.health <= 0 || !m.abilities) continue;
      for (const ab of m.abilities) if (ab.trigger === "passive" && ab.action === "summonBuff" && affOk(ab, board)) { const k = ab.golden === false ? 1 : m.mult(); a += (ab.a || 0) * k; h += (ab.h || 0) * k; }
    }
    return [a, h];
  }
  // sum of a passive's a/h over the board (devourBonus, frozenBuff)
  function passiveAH(board, action) {
    let a = 0, h = 0;
    for (const m of board) { if (m.health <= 0 || !m.abilities) continue; for (const ab of m.abilities) if (ab.trigger === "passive" && ab.action === action && affOk(ab, board)) { const k = ab.golden === false ? 1 : m.mult(); a += (ab.a || 0) * k; h += (ab.h || 0) * k; } }
    return [a, h];
  }
  const timesWord = (t) => (t === 2 ? "twice" : t === 3 ? "three times" : t + " times");
  const OFFBOARD_OK = new Set(["freezeMinion", "giveAff", "buff", "permBuff", "debuff", "keyword", "removeKeyword", "randomKeyword", "setStats", "swapStats", "doubleStats", "heal", "healN", "empower", "absorb", "copyKeywords", "setTribe", "grantEffect", "silence", "addCopy", "summonCopy", "passStats"]);
  const SCALABLE = new Set(["nextCombatBuff", "nextCombatStrike", "healN", "buff", "damage", "gold", "nextGold", "tavernBuff", "permBuff", "freeRoll", "debuff", "buffHand", "heroDamage", "setStats", "combatGold", "gainPressure", "mkPlus"]);
  const KW_TEXT = { taunt: "Taunt", shield: "Shield", reborn: "Reborn", windfury: "Windfury", venomous: "Venomous", cleave: "Cleave", stealth: "Stealth", magnetic: "Magnetic", rally: "Rally", tough: "Tough", flying: "Flying" };
  const plural = (n, w) => (n === 1 ? w : w.endsWith("y") ? w.slice(0, -1) + "ies" : w + "s");
  function targetText(ab) { return targetTextBase(ab) + kwFilterText(ab, "en"); }
  function targetTextBase(ab) {
    const t = TN(ab.ttribe || ""), n = ab.count || 1;
    switch (ab.target) {
      case "self": return "this minion";
      case "randomFriend": return n > 1 ? `${n} random other friendly ${t ? plural(2, t) : "minions"}` : `a random other friendly ${t || "minion"}`;
      case "allFriends": return `your other ${t ? plural(2, t) : "minions"}`;
      case "adjacent": return `adjacent ${t ? plural(2, t) : "minions"}`;
      case "leftmost": return n > 1 ? `your ${n} leftmost other ${t ? plural(2, t) : "minions"}` : `your leftmost other ${t || "minion"}`;
      case "rightmost": return n > 1 ? `your ${n} rightmost other ${t ? plural(2, t) : "minions"}` : `your rightmost other ${t || "minion"}`;
      case "tokens": return `your ${t ? t + " " : ""}tokens`;
      case "randomToken": return n > 1 ? `${n} random ${t ? t + " " : ""}tokens of yours` : `a random ${t ? t + " " : ""}token of yours`;
      case "trigger": return ab.trigger === "onDevoured" || ab.trigger === "afterDevour" ? "the eater" : ab.trigger === "onAttacked" ? "the attacker" : "it";
      case "randomEnemy": return n > 1 ? `${n} random enemy ${t ? plural(2, t) : "minions"}` : `a random enemy ${t || "minion"}`;
      case "allEnemies": return `all enemy ${t ? plural(2, t) : "minions"}`;
      case "chosen": return "a minion";
      case "buffers": return `your other ${t ? plural(2, t) : "minions"} that give stats`;
      case "allFriendsSelf": return `all your ${t ? plural(2, t) : "minions"}`;
      case "randomFriendSelf": return n > 1 ? `${n} random friendly ${t ? plural(2, t) : "minions"}` : `a random friendly ${t || "minion"}`;
      case "leftOf": return `the ${t || "minion"} to the left of this`;
      case "rightOf": return `the ${t || "minion"} to the right of this`;
      case "kin": return `your other ${t ? plural(2, t) : "minions"} that share a tribe with this`;
      case "weakestFriend": return `your weakest other ${t || "minion"}`;
      case "strongestFriend": return `your strongest other ${t || "minion"}`;
      case "weakestEnemy": return `the weakest enemy ${t || "minion"}`;
      case "strongestEnemy": return `the strongest enemy ${t || "minion"}`;
      case "frontEnemy": return `the enemy's leftmost ${t || "minion"}`;
      case "backEnemy": return `the enemy's rightmost ${t || "minion"}`;
      case "allMinions": return `every ${t || "minion"} on both sides`;
      case "shopAll": return `the ${t ? plural(2, t) : "minions"} in the tavern`;
      case "shopRandom": return n > 1 ? `${n} random ${t ? plural(2, t) : "minions"} in the tavern` : `a random ${t || "minion"} in the tavern`;
      case "shopFrozen": return `the Frozen ${t ? plural(2, t) : "minions"} in the tavern`;
      case "frozenEnemies": return `the Frozen enemy ${t ? plural(2, t) : "minions"}`;
      case "handAll": return `the ${t ? plural(2, t) : "minions"} in your hand`;
      case "handRandom": return n > 1 ? `${n} random ${t ? plural(2, t) : "minions"} in your hand` : `a random ${t || "minion"} in your hand`;
      case "tribeMost": return "your other minions of your most common tribe";
      case "previous": return "the same minions";
      case "pickFriend": return `another friendly ${t || "minion"} of your choice`;
      case "pickAny": return `one of your ${t ? plural(2, t) : "minions"} of your choice`;
      case "pickShop": return `a tavern ${t || "minion"} of your choice`;
      case "pickHand": return `a ${t || "minion"} in your hand of your choice`;
      case "colony": return "your Colony";
      case "foundationMinions": return `your ${t ? plural(2, t) : "minions"} standing on Foundations`;
      case "newest": return `the ${t || "minion"} you played most recently`;
      case "oldest": return `the ${t || "minion"} you played longest ago`;
    }
    return "a minion";
  }
  // "with Taunt" after a target when the ability filters on a keyword
  function kwFilterText(ab, lang) {
    let af = ab.taff && AFF[ab.taff] ? (lang === "fr" ? ` d'affinité ${AFF[ab.taff].fr}` : ` of the ${AFF[ab.taff].name} affinity`) : "";
    const fr = lang === "fr";
    if (ab.tmk) af += fr ? " qui porte des marqueurs" : " with markers";
    if (ab.ttok === "only" && !/token|jeton/i.test(ab.target || "")) af += fr ? " (jetons seulement)" : " (tokens only)"; else if (ab.ttok === "no") af += fr ? " (pas les jetons)" : " (not tokens)";
    if (!ab.tkw) return af; const n = CKW[ab.tkw] ? CKW[ab.tkw].name : lang === "fr" ? (FR.kw[ab.tkw] || ab.tkw) : (KW_TEXT[ab.tkw] || ab.tkw); return (lang === "fr" ? ` avec ${n}` : ` with ${n}`) + af;
  }
  // "After you buy a Murloc, " said for the Nth time: "After you buy 5 Murlocs, ". Falls back to "(every N times)".
  function everyText(trig, f, n) {
    const w = f || null, P = (one, many) => (w ? plural(n, w) : n === 1 ? one : many);
    switch (trig) {
      case "onBuy": return `After you buy ${n} ${P("minion", "minions")}, `;
      case "onPlayOther": return `After you play ${n} ${w ? plural(n, w) : "other minions"}, `;
      case "onSellOther": return `After you sell ${n} ${w ? plural(n, w) : "other minions"}, `;
      case "onSpell": return `After you cast ${n} tavern spells, `;
      case "onRoll": return `After you refresh the tavern ${n} times, `;
      case "afterUpgrade": return `After you upgrade your tavern ${n} times, `;
      case "onTriple": return `After you make ${n} golden ${P("minion", "minions")}, `;
      case "onDiscover": return `After you Discover ${n} ${P("minion", "minions")}, `;
      case "onFreeze": return `After you freeze the tavern ${n} times, `;
      case "afterDevour": return `After you Devour ${n} times, `;
      case "afterWin": return `After you win ${n} combats, `;
      case "afterLoss": return `After you lose ${n} combats, `;
      case "afterCombat": return `After ${n} combats, `;
      case "onAttack": return `After this attacks ${n} times, `;
      case "onKill": return `After this kills ${n} minions, `;
      case "onDamaged": return `After this takes damage ${n} times, `;
      case "onAllyDeath": return `After ${n} friendly ${P("minion", "minions")} die, `;
      case "onEnemyDeath": return `After ${n} enemy ${P("minion", "minions")} die, `;
      case "onSummonAlly": return `After ${n} friendly ${P("minion", "minions")} are summoned in combat, `;
      case "onEnemySummon": return `After ${n} enemy ${P("minion", "minions")} are summoned, `;
      case "onFriendlyAttack": return `After ${n} attacks by other friendly ${w ? plural(2, w) : "minions"}, `;
      case "onShieldLost": return `After ${n} friendly Shields break, `;
      case "onPlayBattlecry": return `After you play ${n} ${w ? plural(n, w) + " with a Battlecry" : "Battlecry minions"}, `;
      case "onRebornAlly": return `After ${n} friendly ${P("minion", "minions")} come back with Reborn, `;
      case "onDeathrattleFriend": return `After ${n} friendly Deathrattles trigger, `;
      case "pulse": return `Every ${n} Pulses: `;
      case "startOfTurn": case "endOfTurn": return null;
    }
    return null;
  }
  // the "for each ..." tail of a scaling effect
  // the text of the "lab" options any effect can have: chance, a numeric condition, a delay, repeats
  function modPre(ab, lang) {
    const fr = lang === "fr"; let t = "";
    if (ab.wWhat) {
      const v = ab.wVar || "Charge", n = ab.wN || 0;
      if (ab.wWhat === "turnEven" || ab.wWhat === "turnOdd") t += fr ? (ab.wWhat === "turnEven" ? "les tours pairs, " : "les tours impairs, ") : (ab.wWhat === "turnEven" ? "on even turns, " : "on odd turns, ");
      else if (ab.wSpend && (ab.wWhat === "counter" || ab.wWhat === "pcounter") && (ab.wCmp || ">=") === ">=") t += fr ? `dépense ${n} ${v}${ab.wWhat === "pcounter" ? " (les vôtres)" : ""} : ` : `spend ${n} ${ab.wWhat === "pcounter" ? "of your " : ""}${v}: `;
      else {
        const subj0 = fr ? { goldens: "votre nombre de serviteurs dorés", kin: "le nombre de serviteurs de sa tribu", itsTier: "son niveau", shop: "le nombre de serviteurs en taverne", winStreak: "votre série de victoires", lossStreak: "votre série de défaites", affN: `votre nombre de serviteurs ${AN(v)}`, affLv: `le niveau de ${AN(v)}`, affs: "votre nombre d'affinités éveillées", frozen: "le nombre de serviteurs Gelés", spellsHand: "le nombre de sorts dans votre main", spellsTurn: "le nombre de sorts lancés ce tour" }
          : { goldens: "your number of golden minions", kin: "the number of minions of its tribe", itsTier: "its tier", shop: "the number of minions in the tavern", winStreak: "your win streak", lossStreak: "your losing streak", affN: `your number of ${AN(v)} minions`, affLv: `the level of ${AN(v)}`, affs: "your number of awake affinities", frozen: "the number of Frozen minions", spellsHand: "the number of spells in your hand", spellsTurn: "the number of spells you cast this turn" };
        const subj = subj0[ab.wWhat] || (fr ? { attack: "son Attaque", health: "ses PV", gold: "votre or", hand: "votre main", tier: "votre niveau de taverne", board: "votre nombre de serviteurs", turn: "le numéro du tour", heroHealth: "les PV de votre héros", counter: `son compteur ${v}`, pcounter: `votre compteur ${v}`, enemies: "le nombre d'ennemis" }[ab.wWhat]
          : { attack: "its Attack", health: "its Health", gold: "your gold", hand: "your hand size", tier: "your tavern tier", board: "your number of minions", turn: "the turn number", heroHealth: "your hero's Health", counter: `its ${v}`, pcounter: `your ${v}`, enemies: "the number of enemies" }[ab.wWhat]);
        const cmp = ab.wCmp === "<=" ? (fr ? `est au plus ${n}` : `is at most ${n}`) : ab.wCmp === "=" ? (fr ? `vaut exactement ${n}` : `is exactly ${n}`) : (fr ? `est d'au moins ${n}` : `is at least ${n}`);
        if (subj) t += fr ? `si ${subj} ${cmp}, ` : `if ${subj} ${cmp}, `;
      }
    }
    if (ab.w2What) { const sub = modPre({ wWhat: ab.w2What, wCmp: ab.w2Cmp, wN: ab.w2N, wVar: ab.w2Var }, lang); if (sub) t += (fr ? "et " : "and ") + sub; }
    if (ab.payWhat && ab.payN > 0) t += fr ? `payez ${ab.payN} ${{ health: "PV de ce serviteur", attack: "Attaque de ce serviteur", gold: "or" }[ab.payWhat]} : ` : `pay ${ab.payN} ${{ health: "of its Health", attack: "of its Attack", gold: "gold" }[ab.payWhat]}: `;
    if (ab.delay > 0) t += fr ? `dans ${ab.delay} tour${ab.delay > 1 ? "s" : ""}, ` : `in ${ab.delay} turn${ab.delay > 1 ? "s" : ""}, `;
    if (ab.chance > 0 && ab.chance < 100) t += fr ? `${ab.chance} % : ` : `${ab.chance}%: `;
    return t;
  }
  function modPost(ab, lang) {
    const fr = lang === "fr"; let t = "";
    // short notes: card text is small
    const tags = [];
    if (ab.repeat > 1) tags.push(ab.chance > 0 && ab.chance < 100 ? (fr ? `${ab.repeat} jets` : `${ab.repeat} rolls`) : `×${ab.repeat}`);
    if (ab.rnd > 1) tags.push(`×1–${ab.rnd}`);
    if (ab.grow > 0) tags.push(fr ? `+${ab.grow}× à chaque fois` : `+${ab.grow}× each time`);
    if (ab.uses > 0) tags.push(`max ${ab.uses}`);
    if (ab.cool > 0) tags.push(fr ? `repos ${ab.cool}` : `rests ${ab.cool}`);
    if (tags.length) t += ` (${tags.join(", ")})`;
    return t;
  }
  // the lab's say on how big an effect is: grows each time it fires, a random strength
  function labMul(ab, m, rnd) { let k = 1; if (ab.grow > 0 && m) k *= 1 + ab.grow * (m._growN || 0); if (ab.rnd > 1 && rnd) k *= 1 + Math.floor(rnd() * ab.rnd); return k; }
  function perText(ab) {
    const t = TN(ab.perTribe) || "";
    switch (ab.per) {
      case "devours": return " for each minion you Devoured this game";
      case "counter": return ` for each ${ab.perVar || "Charge"} it has`;
      case "pcounter": return ` for each ${ab.perVar || "Charge"} you have`;
      case "gold": return " for each gold you have";
      case "fed": return " for each minion this has Devoured";
      case "played": return ` for each ${t || "minion"} you played this game`;
      case "playedTurn": return ` for each ${t || "minion"} you played this turn`;
      case "spells": return " for each tavern spell you cast this game";
      case "spellsTurn": return " for each tavern spell you cast this turn";
      case "sold": return " for each minion you sold this game";
      case "bought": return " for each minion you bought this game";
      case "turn": return " for each turn played";
      case "enemy": return ` for each enemy ${t || "minion"}`;
      case "attack": return " for each Attack this minion has";
      case "health": return " for each Health this minion has";
      case "foundations": return " for each Foundation under this minion";
      case "aff": return ` for each of your ${AN(ab.perVar)} minions`;
      case "affs": return " for each of your awake affinities";
      case "frozen": return " for each Frozen minion (in the tavern, or enemy in combat)";
      case "spellsHand": return " for each tavern spell in your hand";
      case "pressure": return ` for each ${affMech(affFor("gauge", ab.gaff || ab.paff), "en")} you have`;
    }
    return ` for each other friendly ${t || "minion"}`;
  }
  function perTextFR(ab) {
    const t = TN(ab.perTribe) || "";
    switch (ab.per) {
      case "devours": return " pour chaque serviteur Dévoré cette partie";
      case "counter": return ` pour chaque ${ab.perVar || "Charge"} qu'il a`;
      case "pcounter": return ` pour chaque ${ab.perVar || "Charge"} que vous avez`;
      case "gold": return " pour chaque or que vous avez";
      case "fed": return " pour chaque serviteur que celui-ci a Dévoré";
      case "played": return ` pour chaque ${t || "serviteur"} joué${t && frFem(t) ? "e" : ""} cette partie`;
      case "playedTurn": return ` pour chaque ${t || "serviteur"} joué${t && frFem(t) ? "e" : ""} ce tour`;
      case "spells": return " pour chaque sort de taverne lancé cette partie";
      case "spellsTurn": return " pour chaque sort de taverne lancé ce tour";
      case "sold": return " pour chaque serviteur vendu cette partie";
      case "bought": return " pour chaque serviteur acheté cette partie";
      case "turn": return " pour chaque tour joué";
      case "enemy": return ` pour chaque ${t ? frNoun(t, 1, { side: "enemy" }).replace(/^une? /, "") : "serviteur ennemi"}`;
      case "attack": return " pour chaque point d'Attaque de ce serviteur";
      case "health": return " pour chaque PV de ce serviteur";
      case "foundations": return " pour chaque Fondation sous ce serviteur";
      case "aff": return ` pour chacun de vos serviteurs ${AN(ab.perVar)}`;
      case "affs": return " pour chacune de vos affinités éveillées";
      case "frozen": return " pour chaque serviteur Gelé (de la taverne, ou ennemi en combat)";
      case "spellsHand": return " pour chaque sort de taverne dans votre main";
      case "pressure": return ` pour chaque point de ${affMech(affFor("gauge", ab.gaff || ab.paff), "fr")} que vous avez`;
    }
    return ` pour chaque ${t ? "autre " + frNoun(t, 1, { side: "ally" }).replace(/^une? /, "") : "autre serviteur allié"}`;
  }
  // `left` (optional) shows how many triggers are still needed instead of the full "every N"
  // the stat an Evolve watches: "Attack", "Health" or either
  // the next form(s) of an Evolve action, by name
  function evolveOptions(ab) { const ids = (ab.cards && ab.cards.length >= 2 ? ab.cards : [ab.card]).filter(Boolean); return ids.map((id) => { const cd = CARDS[id] || TOKENS[id]; return cd ? cd.name : "?"; }); }
  // ---- Evolution: mutations (a bonus the player picks) and the crystal's charge source
  const MUT_LIB = [
    { id: "shell", name: "Shell", fr: "Carapace", a: 0, h: 4, kw: "taunt" },
    { id: "fangs", name: "Fangs", fr: "Crocs", a: 4, h: 1 },
    { id: "venom", name: "Venom glands", fr: "Glandes à venin", a: 1, h: 0, kw: "venomous" },
    { id: "wings", name: "Wings", fr: "Ailes", a: 1, h: 1, kw: "windfury" },
    { id: "aegis", name: "Aegis", fr: "Égide", a: 1, h: 1, kw: "shield" },
    { id: "phoenix", name: "Phoenix heart", fr: "Cœur de phénix", a: 0, h: 2, kw: "reborn" },
    { id: "bulk", name: "Bulk", fr: "Masse", a: 3, h: 3 },
    { id: "claws", name: "Claws", fr: "Griffes", a: 2, h: 0, kw: "cleave" },
    { id: "brood", name: "Brood", fr: "Couvée", a: 0, h: 1, grant: { trigger: "deathrattle", action: "summon", card: "pup", count: 2 } },
    { id: "instinct", name: "Instinct", fr: "Instinct", a: 1, h: 1, grant: { trigger: "afterSurvive", action: "buff", target: "self", a: 2, h: 2 } },
    { id: "spines", name: "Spines", fr: "Épines", a: 0, h: 2, grant: { trigger: "onDamaged", action: "damage", target: "randomEnemy", count: 1, n: 2 } },
    { id: "hunger", name: "Hunger", fr: "Faim", a: 2, h: 2, grant: { trigger: "endOfTurn", action: "devour", count: 1, devourFrom: "shop" } },
  ];
  const mutDef = (o) => (o && o.lib ? MUT_LIB.find((x) => x.id === o.lib) || null : o);
  const mutName = (d) => (!d ? "?" : LANG === "fr" && d.fr ? d.fr : d.name || (LANG === "fr" ? "Mutation" : "Mutation"));
  function mutDesc(d, golden) {
    if (!d) return "";
    const k = golden ? 2 : 1, a = (d.a || 0) * k, h = (d.h || 0) * k, fr = LANG === "fr", parts = [];
    if (a || h) parts.push(`+${a}/+${h}`);
    if (d.kw) parts.push(fr ? FR.kw[d.kw] || d.kw : KW_TEXT[d.kw] || d.kw);
    if (d.grant && TRIGGERS[d.grant.trigger] && ACTIONS[d.grant.action]) parts.push(`“${abilityText(d.grant, false).replace(/\.$/, "")}”`);
    return parts.join(", ");
  }
  const mutLine = (o, golden) => { const d = mutDef(o), x = mutDesc(d, golden); return mutName(d) + (x ? ` (${x})` : ""); };
  function mutateText(ab, golden) {
    const fr = LANG === "fr";
    if (ab.rmut > 0) return fr ? `choisit 1 mutation parmi ${ab.rmut} au hasard` : `choose 1 of ${ab.rmut} random mutations`;
    const list = (ab.muts || []).filter((o) => mutDef(o));
    if (!list.length) return fr ? "mute" : "mutate";
    if (list.length === 1) return (fr ? "mute : " : "mutate: ") + mutLine(list[0], golden);
    const ls = list.map((o) => mutLine(o, golden));
    return (fr ? "choisissez une mutation : " : "choose a mutation: ") + ls.slice(0, -1).join(", ") + (fr ? " ou " : " or ") + ls[ls.length - 1];
  }
  // "after you Devour a Beast" - the event that charges an Evolve's crystal
  function evoSrcText(ab) {
    if (!ab.src || !TRIGGERS[ab.src]) return "";
    const fr = LANG === "fr", f = TN(ab.stribe || "");
    const special = fr ? { activate: "à chaque activation", startOfCombat: "au début de chaque combat", deathrattle: "quand il meurt", battlecry: "quand il est joué" } : { activate: "each activation", startOfCombat: "at the start of each combat", deathrattle: "when it dies", battlecry: "when it is played" };
    if (special[ab.src]) return special[ab.src];
    const t = fr ? (FR_TRIG[ab.src] ? FR_TRIG[ab.src](f) : TRIGGERS[ab.src].text(f)) : TRIGGERS[ab.src].text(f);
    const x = t.replace(/[,:]\s*$/, "").trim(); return x.charAt(0).toLowerCase() + x.slice(1);
  }
  function evoPre(ab) {
    const fr = LANG === "fr", at = ab.at || 3;
    const r = !ab.rep ? "" : ab.inc > 0 ? (fr ? `, puis +${ab.inc} à chaque fois` : `, then +${ab.inc} each time`) : (fr ? ", répétable" : ", repeatable");
    return fr ? `Évolution (${at}${r}) : ` : `Evolve (${at}${r}): `;
  }
  function evolveRandomText(ab) {
    const fr = LANG === "fr", c = ab.count || 3, up = ab.tierUp == null ? 1 : ab.tierUp;
    if (fr) {
      const kind = ab.rtribe === "same" ? "de sa tribu" : ab.rtribe ? "(" + TN(ab.rtribe) + ")" : "";
      const tier = up === 0 ? "de son niveau" : up === 1 ? "d'un niveau au-dessus" : `de ${up} niveaux au-dessus`;
      return c > 1 ? `devient 1 serviteur ${kind ? kind + " " : ""}${tier} parmi ${c} au hasard` : `devient un serviteur aléatoire ${kind ? kind + " " : ""}${tier}`;
    }
    const kind = ab.rtribe === "same" ? (c > 1 ? "minions of its tribe" : "minion of its tribe") : ab.rtribe ? TN(ab.rtribe) + (c > 1 ? "s" : "") : c > 1 ? "minions" : "minion";
    const tier = up === 0 ? "of its tier" : up === 1 ? "a tier higher" : `${up} tiers higher`;
    return c > 1 ? `becomes 1 of ${c} random ${kind} ${tier}` : `becomes a random ${kind} ${tier}`;
  }
  function reachStat(ab, lang) { const st = ab.stat === "health" ? "health" : ab.stat === "attack" ? "attack" : "either"; return lang === "fr" ? { attack: "Attaque", health: "PV", either: "Attaque ou PV" }[st] : { attack: "Attack", health: "Health", either: "Attack or Health" }[st]; }
  // Discover: which tier, which tribe, a keyword, how many choices, how many times, golden
  function discoverText(ab, k, lang) {
    const t0 = discoverText0(ab, k, lang); if (!ab.daff || !AFF[ab.daff]) return t0;
    const fr = lang === "fr", add = fr ? ` d'affinité ${AN(ab.daff)}` : ` of the ${AN(ab.daff)} affinity`, re = fr ? /\bserviteurs?\b/ : /\bminions?\b/;
    if (re.test(t0)) return t0.replace(re, (w) => w + add);
    return t0.replace(fr ? /^(Découvre (?:un|une) \S+)/ : /^(Discover an? (?:golden )?\S+)/, "$1" + add);
  }
  function discoverText0(ab, k, lang) {
    const fr = lang === "fr", times = Math.max(1, ab.times || 1) * k, tm = ab.tierMode || "current", dt = Math.max(1, Math.min(6, ab.dtier || 1));
    const tribe = ab.tribe || "", kw = ab.dkw && KW_TEXT[ab.dkw] ? ab.dkw : "";
    if (!fr) {
      const gold = ab.dgolden ? "golden " : "";
      const who = tribe === "@main" ? `${gold}minion of your most common tribe` : tribe === "@lobby" ? `${gold}minion of a random tribe` : tribe ? gold + TN(tribe) : gold + "minion";
      const tier = { current: "from your tavern tier", down: "from one tier lower", up: "from one tavern tier higher", upTo: "of your tier or lower", exact: `of tier ${dt}`, random: "from a random tier", max: "of tier 6", any: "of any tier" }[tm] || "from your tavern tier";
      const art = /^[aeiou]/i.test(who) ? "an" : "a";
      return `Discover ${art} ${who}${kw ? " with " + KW_TEXT[kw] : ""} ${tier}${times > 1 ? (times === 2 ? ", twice" : `, ${times} times`) : ""}${ab.choices && ab.choices !== 3 ? ` (${ab.choices} choices)` : ""}`;
    }
    const FRK = { taunt: "Provocation", shield: "Bouclier", reborn: "Réincarnation", windfury: "Furie des vents", venomous: "Venimeux", cleave: "Fendoir", stealth: "Camouflage", magnetic: "Magnétique", rally: "Ralliement", tough: "Robuste", flying: "Vol" };
    const fem = tribe && tribe[0] !== "@" && frFem(TN(tribe));
    const who = tribe === "@main" ? "un serviteur de votre tribu la plus nombreuse" : tribe === "@lobby" ? "un serviteur d'une tribu aléatoire" : tribe ? frNoun(TN(tribe), 1) : "un serviteur";
    const gold = ab.dgolden ? (fem ? " dorée" : " doré") : "";
    const whoG = gold ? who.replace(/^(une?) (\S+)/, `$1 $2${gold}`) : who;
    const tier = { current: "de votre niveau de taverne", down: "d'un niveau de taverne en dessous", up: "du niveau de taverne supérieur", upTo: "de votre niveau ou moins", exact: `de niveau ${dt}`, random: "d'un niveau aléatoire", max: "de niveau 6", any: "de n'importe quel niveau" }[tm] || "de votre niveau de taverne";
    return `Découvre ${whoG}${kw ? " avec " + ((FR.kw && FR.kw[kw]) || FRK[kw] || KW_TEXT[kw]) : ""} ${tier}${times > 1 ? ", " + frTimes(times) : ""}${ab.choices && ab.choices !== 3 ? ` (${ab.choices} choix)` : ""}`;
  }
  // French contractions the composed sentences need ("de le serviteur" -> "du serviteur", "à les" -> "aux")
  const frFix = (s) => s.replace(/\bde le /g, "du ").replace(/\bde les /g, "des ").replace(/\bde un /g, "d'un ").replace(/\bde une /g, "d'une ").replace(/\bà le /g, "au ").replace(/\bà les /g, "aux ").replace(/\bDe le /g, "Du ");
  function abilityText(ab, golden, left) { return LANG === "fr" ? frFix(abilityTextFR(ab, golden, left)) : abilityTextEN(ab, golden, left); }
  function abilityTextEN(ab, golden, left) {
    const tr = TRIGGERS[ab.trigger], k = golden && ab.golden !== false ? 2 : 1;
    if (!tr || !ACTIONS[ab.action]) return "";
    const n = (ab.n || 0) * k, a = (ab.a || 0) * k, h = (ab.h || 0) * k, c = ab.count || 1;
    let body = "";
    switch (ab.action) {
      case "buff": body = `give ${targetText(ab)} ${a && h ? `+${a}/+${h}` : a ? `+${a} Attack` : `+${h} Health`}`; break;
      case "keyword": body = `give ${targetText(ab)} ${kwName(ab.kw || "taunt")}`; break;
      case "damage": body = `deal ${n} damage to ${targetText(ab)}`; break;
      case "summon": {
        const cd = CARDS[ab.card] || TOKENS[ab.card];
        const nm = cd ? cd.name : "minion";
        const st = ab.a || ab.h ? ` ${(ab.a || cd.attack) * k}/${(ab.h || cd.health) * k}` : "";
        body = `summon ${c === 1 ? "a" : c}${st} ${plural(c, nm)}`; break;
      }
      case "gold": body = `gain ${n} gold`; break;
      case "nextGold": body = `gain ${n} extra gold next turn`; break;
      case "freeRoll": body = n === 1 ? "your next Refresh is free" : `your next ${n} Refreshes are free`; break;
      case "addMinion": body = `add ${c * k === 1 ? "a" : c * k} random ${ab.tribe ? plural(c * k, TN(ab.tribe)) : plural(c * k, "minion")} to your hand`; break;
      case "addSpell": body = `add ${c * k === 1 ? "a random tavern spell" : c * k + " random tavern spells"} to your hand`; break;
      case "addSpellId": { const sn = SPELLS[ab.spell] ? SPELLS[ab.spell].name : "a tavern spell"; body = `add ${c * k === 1 ? sn : c * k + " × " + sn} to your hand`; break; }
      case "castSpell": { const sp = SPELLS[ab.spell], sn = sp ? sp.name : "a tavern spell"; body = `cast ${sn} for free${sp && sp.target ? " on " + targetText(ab) : ""}`; break; }
      case "copySpell": body = `add ${c * k === 1 ? "a copy" : c * k + " copies"} of the last tavern spell you cast to your hand`; break;
      case "spellDiscount": body = `your tavern spells cost ${ab.n || 1} less`; break;
      case "addCard": { const cd = CARDS[ab.card] || TOKENS[ab.card]; const nm = cd ? cd.name : "minion"; body = `add ${c * k === 1 ? "a" : c * k} ${plural(c * k, nm)} to your hand`; break; }
      case "evolve": { if (ab.mode === "random") { body = evolveRandomText(ab); break; } const opts = evolveOptions(ab); body = opts.length >= 2 ? `becomes ${opts.slice(0, -1).join(", ")} or ${opts[opts.length - 1]} (your choice)` : `becomes ${opts[0] || "another minion"}`; break; }
      case "charge": { const cn = Math.max(1, ab.n || 1) * k; body = !ab.target || ab.target === "self" ? `charge its Evolution by ${cn}` : `charge the Evolution of ${targetText(ab)} by ${cn}`; break; }
      case "mutate": body = mutateText(ab, golden && ab.golden !== false); break;
      case "mutateTarget": { const mt = mutateText(ab, false); body = `give ${targetText(ab)} a mutation (${mt.replace(/^mutate: /, "")})`; break; }
      case "discover": body = discoverText(ab, k, "en"); break;
      case "gainPressure": body = `gain ${n} ${affMech(affFor("gauge", ab.gaff), "en")}`; break;
      case "pulseDouble": body = Math.max(1, n) === 1 ? "your next Pulse effect triggers twice" : `your next ${Math.max(1, n)} Pulse effects trigger twice`; break;
      case "mire": { const ma = affFor("mire", ab.maff); body = !ma || affMech(ma, "en") === "Mire" ? `Mire ${targetText(ab)}` : `apply ${affMech(ma, "en")} to ${targetText(ab)}`; break; }
      case "buildFoundation": body = `build a Foundation under ${targetText(ab)}`; break;
      case "foundationAll": body = "build a Foundation under every slot of your board"; break;
      case "foundationGrow": body = `give your minions standing on Foundations ${a && h ? `+${a}/+${h}` : a ? `+${a} Attack` : `+${h} Health`} for each Foundation under them`; break;
      case "releasePressure": { const ga = affFor("gauge", ab.gaff), nm = affMech(ga, "en") || "Pressure"; body = `release all your ${nm}: give ${targetText(ab)} ${a && h ? `+${a}/+${h}` : a ? `+${a} Attack` : `+${h} Health`} for each point`; break; }
      case "ebbMore": body = `you can Ebb ${Math.max(1, n)} more time${Math.max(1, n) > 1 ? "s" : ""} this turn`; break;
      case "affStats": body = `give your ${AN(ab.aff) || "?"} minions ${a && h ? `+${a}/+${h}` : a ? `+${a} Attack` : `+${h} Health`}, on your board and in your hand`; break;
      case "giveAff": body = `give ${targetText(ab)} the ${AN(ab.aff) || "?"} affinity`; break;
      case "counter": { const nm = (ab.vname || "Charge").trim(), v = (ab.n || 0) * (ab.golden === false ? 1 : k); body = ab.op === "set" ? (ab.scope === "player" ? `set your ${nm} to ${v}` : `set its ${nm} to ${v}`) : v < 0 ? (ab.scope === "player" ? `remove ${-v} from your ${nm}` : `remove ${-v} ${nm} from it`) : (ab.scope === "player" ? `you get +${v} ${nm}` : `it gets +${v} ${nm}`); break; }
      case "signal": body = `send the signal "${(ab.sigOut || ab.sig || "?").trim()}"`; break;
      case "fireTrigger": body = `trigger the ${FIRE_NAME[ab.trig] ? FIRE_NAME[ab.trig][0] : "Battlecry"} effects of ${targetText(ab)}`; break;
      case "absorb": body = `this minion gains the Attack and Health of ${targetText(ab)}`; break;
      case "copyKeywords": body = `this minion gains the keywords of ${targetText(ab)}`; break;
      case "nextSpellTwice": body = n === 1 ? "your next tavern spell is cast twice" : `your next ${n} tavern spells are cast twice`; break;
      case "nextBattlecryTwice": body = n === 1 ? "your next Battlecry triggers twice" : `your next ${n} Battlecries trigger twice`; break;
      case "nextBuyBuff": body = `the next ${c * k === 1 ? "minion" : c * k + " minions"} you buy ${c * k === 1 ? "gets" : "get"} ${a && h ? `+${a}/+${h}` : a ? `+${a} Attack` : `+${h} Health`}`; break;
      case "nextPlayBuff": body = `the next ${c * k === 1 ? "minion" : c * k + " minions"} you play ${c * k === 1 ? "gets" : "get"} ${a && h ? `+${a}/+${h}` : a ? `+${a} Attack` : `+${h} Health`}`; break;
      case "nextSellGold": body = `your next ${c * k === 1 ? "sale gives" : c * k + " sales give"} ${n} more gold`; break;
      case "spitCopy": body = "add a copy of the last minion this Devoured to your hand"; break;
      case "devourGold": body = `Devouring gives you ${n} gold`; break;
      case "devour": { const what = ab.devourFrom === "boardPick" ? "a friendly minion of your choice (full stats)" : ab.devourFrom === "shopPick" ? "a tavern minion of your choice" : ab.devourFrom === "handPick" ? "a minion in your hand of your choice (full stats)" : ab.devourFrom === "board" ? `${c * k === 1 ? "a random other friendly minion" : c * k + " random other friendly minions"} (full stats)` : ab.devourFrom === "hand" ? `${c * k === 1 ? "a random minion" : c * k + " random minions"} from your hand (full stats)` : `${c * k === 1 ? "a random minion" : c * k + " random minions"} in the tavern`; body = !ab.target || ab.target === "self" ? `Devour ${what}` : ab.target === "chosen" ? `the chosen minion Devours ${what}` : `${targetText(ab)} Devour${/^(a|your|it)\b/.test(targetText(ab)) && !/^your other/.test(targetText(ab)) ? "s" : ""} ${what}`; break; }
      case "devourEnemy": { const m2 = c * k; body = `Devour ${m2 === 1 ? "a random enemy minion" : m2 + " random enemy minions"}: destroy ${m2 === 1 ? "it" : "them"} and gain ${ab.share === "full" ? "all" : "half"} ${m2 === 1 ? "its" : "their"} stats`; break; }
      case "devourBonus": body = `Devouring gives ${a && h ? `+${a}/+${h}` : a ? `+${a} Attack` : `+${h} Health`} extra`; break;
      case "devourKeywords": body = "minions you Devour pass on their keywords"; break;
      case "frozenBuff": body = `frozen tavern minions get ${a && h ? `+${a}/+${h}` : a ? `+${a} Attack` : `+${h} Health`} at the start of your turn`; break;
      case "goldenHand": body = `make ${c * k === 1 ? "a random minion" : c * k + " random minions"} in your hand golden`; break;
      case "ruleDevour": body = "Devouring gives one and a half times the stats"; break;
      case "tavernBuff": body = `minions in the tavern get +${n}/+${n} for the rest of the game`; break;
      case "hero": body = n < 0 ? `your hero loses ${-n} Health` : `your hero gains ${n} Health`; break;
      case "destroy": body = `destroy ${targetText(ab)}`; break;
      case "permBuff": body = `give ${targetText(ab)} ${a && h ? `+${a}/+${h}` : a ? `+${a} Attack` : `+${h} Health`} permanently`; break;
      case "summonRandom": { const m = c * k; body = `summon ${m === 1 ? "a" : m} random ${ab.tier ? "tier " + ab.tier + " " : ""}${ab.tribe ? plural(m, TN(ab.tribe)) : plural(m, "minion")}${ab.allowSelf ? "" : ab.tier || ab.tribe ? " (not this one)" : ""}`; break; }
      case "addCopy": body = `add a copy of ${ab.target === "self" ? "this" : targetText(ab)} to your hand`; break;
      case "upgradeDiscount": body = `your next tavern upgrade costs (${n}) less`; break;
      case "setStats": body = `set the stats of ${targetText(ab)} to ${a}/${h}`; break;
      case "swapStats": body = `swap the Attack and Health of ${targetText(ab)}`; break;
      case "doubleStats": body = `${k > 1 ? "triple" : "double"} the ${ab.stat === "health" ? "Health" : ab.stat === "both" ? "Attack and Health" : "Attack"} of ${targetText(ab)}`; break;
      case "debuff": body = `give ${targetText(ab)} ${a && h ? `-${a}/-${h}` : a ? `-${a} Attack` : `-${h} Health`}`; break;
      case "removeKeyword": body = `remove ${kwName(ab.kw || "taunt")} from ${targetText(ab)}`; break;
      case "heal": body = `restore ${targetText(ab)} to full Health`; break;
      case "healN": body = `restore ${n} Health to ${targetText(ab)}`; break;
      case "attackNow": body = `${targetText(ab)} attacks right away`; break;
      case "heroDamage": body = `deal ${n} damage to the enemy hero`; break;
      case "summonCopy": { const m = c * k; body = `summon ${m === 1 ? "a copy" : m + " copies"} of ${ab.target === "self" ? "this" : targetText(ab)}${ab.a && ab.h ? ` as a ${ab.a}/${ab.h}` : ab.h ? ` with ${ab.h} Health` : ab.a ? ` with ${ab.a} Attack` : ""}${ab.exact ? " (exact: same stats, keywords and markers)" : ""}`; break; }
      case "makeGolden": body = `make ${targetText(ab)} golden`; break;
      case "transform": body = `transform ${targetText(ab)} into a random ${ab.tier ? "tier " + ab.tier + " " : ""}${TN(ab.tribe) || "minion"}`; break;
      case "stealShop": { const m = c * k; body = `take ${m === 1 ? "a random minion" : m + " random minions"} from the tavern for free`; break; }
      case "buffHand": body = `give the minions in your hand ${a && h ? `+${a}/+${h}` : a ? `+${a} Attack` : `+${h} Health`}`; break;
      case "empower": body = `the stat effects of ${targetText(ab)} give ${a && h ? `+${a}/+${h}` : a ? `+${a} Attack` : `+${h} Health`} more`; break;
      case "buffBoost": body = `your minions' stat effects give ${a && h ? `+${a}/+${h}` : a ? `+${a} Attack` : `+${h} Health`} more`; break;
      case "spellBoost": body = `your tavern spells and hero power give ${a && h ? `+${a}/+${h}` : a ? `+${a} Attack` : `+${h} Health`} more`; break;
      case "freeUpgrade": body = "upgrade your tavern for free"; break;
      case "refreshShop": body = "refresh the tavern for free"; break;
      case "freezeShop": body = "freeze the tavern"; break;
      case "freezeMinion": body = `Freeze ${targetText(ab)} (${(ab.count || 1) > 1 || /^(shopAll|shopFrozen)$/.test(ab.target) ? "they stay" : "it stays"} when you refresh, until your next turn)`; break;
      case "freezeFoe": body = `Freeze ${targetText(ab)} (${(ab.count || 1) > 1 || /^all|frozenEnemies/.test(ab.target || "") ? "they skip their" : "it skips its"} next attack)`; break;
      case "grantEffect": { const g = ab.grant ? abilityText(ab.grant, false).replace(/\.$/, "") : "an effect"; body = `give ${targetText(ab)} “${g}”`; break; }
      case "bounce": body = `return ${targetText(ab)} to your hand`; break;
      case "setTribe": body = `turn ${targetText(ab)} into ${ab.toTribe === "?" ? "a tribe of your choice" : ab.toTribe ? "a " + TN(ab.toTribe) : "a Neutral minion"}`; break;
      case "sacrifice": body = `destroy ${targetText(ab)}${ab.give === "random" ? " and give its stats to a random other friendly minion" : ab.give === "adjacent" ? " and give its stats to the minions next to it" : ab.give === "self" ? " and gain its stats" : ""}`; break;
      case "nextCombatBuff": body = `your minions have ${a && h ? `+${a}/+${h}` : a ? `+${a} Attack` : `+${h} Health`} during your next combat`; break;
      case "nextCombatStrike": body = `at the start of your next combat, deal ${n} damage to ${ab.spread === "all" ? "all enemy minions" : c === 1 ? "a random enemy minion" : c + " random enemy minions"}`; break;
      case "extraBattlecry": body = `your other Battlecries trigger ${timesWord(1 + (ab.n || 1) * k)}`; break;
      case "extraDeathrattle": body = `your Deathrattles trigger ${timesWord(1 + (ab.n || 1) * k)}`; break;
      case "extraEndOfTurn": body = `your end of turn effects trigger ${timesWord(1 + (ab.n || 1) * k)}`; break;
      case "extraStartOfTurn": body = `your start of turn effects trigger ${timesWord(1 + (ab.n || 1) * k)}`; break;
      case "extraStartOfCombat": body = `your Start of Combat effects trigger ${timesWord(1 + (ab.n || 1) * k)}`; break;
      case "extraSpell": body = `your tavern spells are cast ${timesWord(1 + (ab.n || 1) * k)}`; break;
      case "summonBuff": body = `minions you summon in combat get ${a && h ? `+${a}/+${h}` : a ? `+${a} Attack` : `+${h} Health`}`; break;
      case "buyDiscount": body = `minions cost (${(ab.n || 1) * k}) less to buy`; break;
      case "rollDiscount": body = `refreshes cost (${(ab.n || 1) * k}) less`; break;
      case "shopSize": body = `the tavern offers ${(ab.n || 1) * k} more ${(ab.n || 1) * k === 1 ? "minion" : "minions"}`; break;
      case "ruleBuy": body = n < 0 ? `minions cost (${-n}) less` : `minions cost (${n}) more`; break;
      case "ruleSell": body = n < 0 ? `selling a minion gives ${-n} less gold` : `selling a minion gives ${n} more gold`; break;
      case "ruleRoll": body = n < 0 ? `Refreshes cost (${-n}) less` : `Refreshes cost (${n}) more`; break;
      case "ruleUpgrade": body = n < 0 ? `tavern upgrades cost (${-n}) less` : `tavern upgrades cost (${n}) more`; break;
      case "ruleShop": body = n < 0 ? `the tavern shows ${-n} fewer ${plural(-n, "minion")}` : `the tavern shows ${n} more ${plural(n, "minion")}`; break;
      case "ruleIncome": body = n < 0 ? `you get ${-n} less gold each turn` : `you get ${n} extra gold each turn`; break;
      case "ruleMaxGold": body = n < 0 ? `your gold limit is ${-n} lower` : `your gold limit is ${n} higher`; break;
      case "ruleBank": body = `you keep up to ${n} unspent gold for your next turn`; break;
      case "ruleDiscover": body = n < 0 ? `Discover shows ${-n} fewer ${plural(-n, "choice")}` : `Discover shows ${n} more ${plural(n, "choice")}`; break;
      case "ruleGolden": body = `minions in the tavern have a ${ab.pct || 10}% chance to be golden`; break;
      case "armor": body = `gain ${n} Armor`; break;
      case "copyOpponent": body = `add ${c === 1 ? "a copy of a random minion" : c + " copies of random minions"} from your last opponent's warband to your hand`; break;
      case "goldenShop": body = `make ${c === 1 ? "a random minion" : c + " random minions"} in the tavern golden`; break;
      case "refreshUp": body = `refresh the tavern with minions from ${(ab.n || 1) === 1 ? "one tier" : (ab.n || 1) + " tiers"} higher`; break;
      case "passStats": body = `give ${targetText(ab)} the Attack and Health of ${ab.trigger === "onSell" ? "this" : ab.trigger === "onSellOther" ? "the sold minion" : "the minion that triggered it"}`; break;
      case "randomKeyword": body = `give ${targetText(ab)} a random keyword`; break;
      case "mkPlus": { const m = Math.max(1, ab.n || 1) * k, z = `+${ab.a == null ? 1 : ab.a}/+${ab.h == null ? 1 : ab.h}`; body = `give ${targetText(ab)} ${m === 1 ? "a " + z + " marker" : m + " " + z + " markers"}`; break; }
      case "mkKw": { const m = Math.max(1, ab.n || 1) * k; body = !ab.mkw || ab.mkw === "random" ? `give ${targetText(ab)} ${m === 1 ? "a random keyword marker" : m + " random keyword markers"}` : `give ${targetText(ab)} a ${kwName(ab.mkw)} marker`; break; }
      case "mkMove": { const m = Math.max(1, ab.n || 1) * k, w = ab.mkind === "p" ? "stat " : ab.mkind === "kw" ? "keyword " : ""; body = `move ${m === 1 ? "a " + w + "marker" : m + " " + w + "markers"} from ${targetText(ab)} onto this minion`; break; }
      case "mkRemove": { const m = Math.max(1, ab.n || 1) * k, w = ab.mkind === "p" ? "stat " : ab.mkind === "kw" ? "keyword " : ""; body = `remove ${m === 1 ? "a " + w + "marker" : m + " " + w + "markers"} from ${targetText(ab)}`; break; }
      case "mkTake": body = (ab.mkeep === "copy" ? `this minion gains a copy of the markers of ${targetText(ab)}` : ab.mkeep === "eat" ? `destroy ${targetText(ab)} and gain all its markers` : `this minion takes all the markers of ${targetText(ab)}`) + (k > 1 ? ` (${k}x the stat markers)` : ""); break;
      case "enemyKw": body = `this minion gains ${k > 1 ? k + " random keywords" : "a random keyword"} the enemy warband has${ab.asMk ? (k > 1 ? ", as markers" : ", as a marker") : ""}`; break;
      case "goldRandom": body = `gain 1 to ${Math.max(1, n)} gold at random`; break;
      case "freeBuy": body = n === 1 ? "your next minion costs 0 gold" : `your next ${n} minions cost 0 gold`; break;
      case "repeatBattlecry": body = "trigger its Battlecry again"; break;
      case "stealGold": body = `steal ${n} gold from your next opponent (they get ${n} less next turn)`; break;
      case "copyNextOpponent": body = `add ${c === 1 ? "a copy of a random minion" : c + " copies of random minions"} from your next opponent's warband to your hand`; break;
      case "tribeShop": body = ab.tribeMode === "main" ? "refresh the tavern with minions of your most common tribe" : "refresh the tavern with minions of one random tribe"; break;
      case "shuffleBoard": body = "shuffle the order of your minions"; break;
      case "resurrect": { const m2 = c * k; body = `summon ${m2 === 1 ? "a friendly minion" : m2 + " friendly minions"} that died this combat${ab.a && ab.h ? ` as a ${ab.a}/${ab.h}` : ab.h ? ` with ${ab.h} Health` : ab.a ? ` with ${ab.a} Attack` : ""}`; break; }
      case "steal": { const m2 = c * k; body = `take control of ${m2 === 1 ? "a random enemy minion" : m2 + " random enemy minions"}`; break; }
      case "shuffleEnemies": body = "shuffle the enemy warband"; break;
      case "combatGold": body = `gain ${n} gold next turn`; break;
      case "silence": body = `silence ${targetText(ab)}`; break;
      case "reposition": body = `move ${targetText(ab)} to the ${ab.where === "back" ? "rightmost spot (attacks last)" : "leftmost spot (attacks first)"}`; break;
      case "ruleTriple": body = "two copies of a minion make a golden one"; break;
      case "ruleDamage": body = n < 0 ? `you take ${-n} less damage from each fight` : `you take ${n} more damage from each fight`; break;
      case "sharedPick": {
        const from = ab.pickTier === "current" ? "their tavern tier" : ab.pickTier === "up" ? "one tier above theirs" : "any tier";
        body = `one player picks 1 of ${ab.count || 3} minions from ${from}${ab.pct ? ` (each has a ${ab.pct}% chance to be golden)` : ""} and every player gets a copy`; break;
      }
    }
    if (ab.per && SCALABLE.has(ab.action)) body += perText(ab);
    let pre = ab.trigger === "activate" ? `Activate (${ab.actCost == null ? 1 : ab.actCost}): ` : tr.text(TN(ab.ftribe || ""));
    if (ab.trigger === "onReach") pre = `Evolve (${ab.at || 1} ${reachStat(ab, "en")}): `;
    else if (ab.trigger === "work") pre = `Work (${left || ab.at || 1}): `;
    else if (ab.trigger === "evoFull") { pre = evoPre(ab); const st = evoSrcText(ab); if (st) body += `. Charge: ${st}`; }
    if (ab.trigger === "activate" && ab.every > 1) pre = `Activate (${ab.actCost == null ? 1 : ab.actCost}): every ${left || ab.every} ${(left || ab.every) === 1 ? "activation" : "activations"}, `;
    else if (ab.every > 1 && (REPEATABLE.has(ab.trigger) || ab.trigger === "startOfTurn")) {
      const n = left || ab.every, ev = REPEATABLE.has(ab.trigger) ? everyText(ab.trigger, TN(ab.ftribe || ""), n) : null;
      pre = ev || pre.replace(/, $/, ab.trigger === "startOfTurn" || ab.trigger === "endOfTurn" ? ` (every ${ab.every} turns), ` : ` (every ${ab.every} times), `);
    }
    if (ab.faff && AFF[ab.faff]) pre = pre.replace(/([,:]) $/, ` (${AN(ab.faff)} only)$1 `);
    if (ab.minTurn > 1) pre += `from turn ${ab.minTurn} on, `;
    if (ab.pcost > 0) pre += ab.pall ? (ab.pcost === 1 ? `spend all your ${affMech(affFor("gauge", ab.paff), "en")}, and for each one spent, ` : `spend all your ${affMech(affFor("gauge", ab.paff), "en")}, and for every ${ab.pcost} spent, `) : `spend ${ab.pcost} ${affMech(affFor("gauge", ab.paff), "en")} to `;
    if (ab.ifTribe) pre += `if you control another ${TN(ab.ifTribe)}, `;
    if (ab.minBoard > 0) pre += `if you control at least ${ab.minBoard} minions, `;
    if (ab.ifKw) pre += `if this has ${kwName(ab.ifKw)}, `;
    if (ab.cond) pre += { alone: "if this is your only minion, ", full: "if your warband is full, ", golden: "if this is golden, ", lowHealth: "if your hero has 10 or less Health, ", fed: "if this has Devoured something, " }[ab.cond] || "";
    if (ab.trigger === "onSignal" || ab.trigger === "onSignalC") pre = pre.replace(/^When the signal is sent, /, `When the signal "${(ab.sig || "?").trim()}" is sent, `);
    pre += modPre(ab, "en"); body += modPost(ab, "en");
    const out = pre ? pre + body : body.charAt(0).toUpperCase() + body.slice(1);
    const lim = ab.limit === "game" ? " (Once per game.)" : ab.limit === "turn" ? (TRIGGERS[ab.trigger].phase === "combat" ? " (Once per combat.)" : " (Once per turn.)") : "";
    return (pre.endsWith(": ") ? pre + body.charAt(0).toUpperCase() + body.slice(1) : out) + "." + lim;
  }
  // ================================================================ French (fr)
  // The engine composes card text from data. This block is the French version of that composition, plus the
  // French names and texts of the built-in content. setLang("fr") switches; custom content keeps what its author typed.
  let LANG = "en";
  const FR = {
    tribes: { Beast: "Bête", Construct: "Construction", Spirit: "Esprit", Corsair: "Corsaire", Elemental: "Élémentaire", Dragon: "Dragon", Tidekin: "Ondin", Infernal: "Infernal" },
    fem: new Set(["Bête", "Construction"]),
    kw: { taunt: "Provocation", shield: "Bouclier", reborn: "Renaissance", windfury: "Furie des vents", venomous: "Venimeux", cleave: "Fauchage", stealth: "Camouflage", magnetic: "Magnétisme", rally: "Ralliement", tough: "Coriace", flying: "Vol" },
    kwInfo: {
      taunt: "Provocation : les ennemis doivent attaquer ce serviteur en premier.", shield: "Bouclier : bloque les premiers dégâts subis par ce serviteur.",
      reborn: "Renaissance : revient avec 1 PV la première fois qu'il meurt.", windfury: "Furie des vents : attaque deux fois.", venomous: "Venimeux : détruit tout serviteur qu'il blesse.",
      cleave: "Fauchage : blesse aussi les serviteurs voisins de sa cible.", stealth: "Camouflage : ne peut être ni attaqué ni ciblé par les ennemis tant qu'il n'a pas attaqué.",
      devour: "Dévorer : retire un serviteur de la taverne et gagne son Attaque et ses PV.", magnetic: "Magnétisme : jouez-le juste à gauche d'un serviteur allié de la même tribu et ils fusionnent : ce serviteur gagne ses stats, ses mots-clés et ses effets.", rally: "Ralliement : au Début de combat, ce serviteur gagne +1/+1 pour chaque autre serviteur allié de la même tribu.", tough: "Coriace : subit 1 dégât de moins à chaque coup.", flying: "Vol : ignore la Provocation quand il attaque (il frappe un serviteur sans Provocation au hasard ; s'ils en ont tous, l'un d'eux).",
    },
    blurb: {
      Beast: "Des marqueurs qui restent : marqueurs +1/+1 et de mots-clés sur les Bêtes et leurs jetons, déplacés, volés et rassemblés.", Construct: "Boucliers, Provocation et une armure qui grandit à chaque Bouclier brisé.",
      Spirit: "Des serviteurs Renaissance qui reviennent plus forts et se nourrissent des morts.", Corsair: "De l'or en plus, des ventes avantageuses, et des Corsaires qui se gonflent entre eux.",
      Elemental: "Des rafraîchissements gratuits, une taverne plus forte et des sorts de taverne.", Dragon: "Du feu en Début de combat, avant la première attaque.",
      Tidekin: "Des Cris de guerre qui se déclenchent deux fois, et des Ondins qui grandissent à chaque Cri de guerre.", Infernal: "Dévorez les serviteurs de la taverne pour voler leurs stats, parfois au prix de vos PV.",
    },
    rarity: { common: "Commun", rare: "Rare", epic: "Épique", legendary: "Légendaire" },
    cards: {
      cute_antelope: ["Antilope mignonne", ""], funny_lemur: ["Lémurien rigolo", ""], lion_mother: ["Mère lionne", ""], proud_bird: ["Oiseau fier", ""],
      friendly_zebra: ["Zèbre amical", ""], mother_hippo: ["Mère hippo", ""], reaper_lion: ["Lion faucheur", ""], guardian_giraffe: ["Girafe gardienne", ""],
      zebu_traveler: ["Zébu voyageur", ""], curious_buffalo: ["Buffle curieux", ""], elephant_king: ["Roi éléphant", ""], king_gorilla: ["Roi gorille féroce", ""],
      old_king: ["Vieux roi", ""], tin_squire: ["Écuyer de fer-blanc", ""], gear_golem: ["Golem à engrenages", "Cri de guerre : Donne +{n}/+{n} à une autre Construction alliée."],
      arc_sentinel: ["Sentinelle à arc", ""], twinblade: ["Automate à deux lames", ""], shield_forge: ["Forge à boucliers", "Après qu'un Bouclier allié se brise, donne +{n} Attaque à vos Constructions."],
      titan_engine: ["Moteur titan", "Début de combat : Donne Bouclier à vos autres Constructions.", "Début de combat : Donne Bouclier et +3/+3 à vos autres Constructions."],
      grave_moth: ["Phalène des tombes", ""], wailing_shade: ["Ombre gémissante", "Râle d'agonie : Donne +{n}/+{n} à vos autres Esprits."], bone_collector: ["Collecteur d'os", "Après la mort d'un serviteur allié en combat, gagne +{n}/+{n}."],
      crypt_warden: ["Gardien de crypte", "Après la Renaissance d'un serviteur allié, lui donne +{n}/+{n}."], ash_lich: ["Liche de cendres", "Râle d'agonie : Donne +{n}/+{n} à vos autres Esprits."],
      pale_sovereign: ["Souverain blafard", "Râle d'agonie : Donne Renaissance à vos autres Esprits.", "Râle d'agonie : Donne Renaissance et +3/+3 à vos autres Esprits."],
      deck_scamp: ["Mousse du pont", "Se vend {n} or de plus."], bounty_captain: ["Capitaine des primes", "Après l'achat d'un Corsaire, donne +{n}/+{n} à vos Corsaires."], gold_smuggler: ["Contrebandier d'or", "Cri de guerre : Gagne {n} or de plus au prochain tour."],
      cannoneer: ["Canonnier", "Début de combat : Inflige 3 dégâts à un serviteur ennemi aléatoire.", "Début de combat : Inflige 3 dégâts à un serviteur ennemi aléatoire, deux fois."],
      dread_corsair: ["Corsaire redoutable", "Quand ce serviteur attaque, donne +{n}/+{n} à vos autres Corsaires."], admiral: ["Amiral Barbesaumure", "À la fin de votre tour, donne +{n}/+{n} à vos autres Corsaires."],
      spark_sprite: ["Lutin d'étincelles", "Cri de guerre : Votre prochain Rafraîchissement est gratuit.", "Cri de guerre : Vos 2 prochains Rafraîchissements sont gratuits."],
      molten_brute: ["Brute en fusion", "Après avoir joué un autre Élémentaire, gagne +{n}/+{n}."], cinder_chef: ["Chef cendré", "Après avoir joué un autre Élémentaire, les serviteurs de la taverne gagnent +{n}/+{n} pour le reste de la partie."],
      storm_djinn: ["Djinn des tempêtes", "Cri de guerre : Ajoute un sort de taverne aléatoire à votre main.", "Cri de guerre : Ajoute 2 sorts de taverne aléatoires à votre main."],
      magma_titan: ["Titan de magma", "Après avoir lancé un sort de taverne, gagne +{n}/+{n}."], primordial: ["Flamme primordiale", "Cri de guerre : Donne +{n}/+{n} à vos autres Élémentaires."],
      ember_whelp: ["Dragonnet de braise", "Début de combat : Inflige {n} dégât(s) à un serviteur ennemi aléatoire."], scale_warder: ["Gardien d'écailles", "Cri de guerre : Donne Bouclier à un autre Dragon allié.", "Cri de guerre : Donne Bouclier à deux autres Dragons alliés."],
      hoard_keeper: ["Gardien du trésor", "Début de combat : Donne +{n} Attaque à vos autres Dragons."], twin_flame: ["Drake à deux flammes", "Début de combat : Inflige {n} dégâts à deux serviteurs ennemis aléatoires."],
      aurum_wyrm: ["Wyrm doré", "Début de combat : Donne Bouclier à vos autres Dragons.", "Début de combat : Donne Bouclier et +2/+2 à vos autres Dragons."], cinderwing: ["Ancien Aile-de-cendre", "Début de combat : Inflige {n} dégâts à tous les serviteurs ennemis."],
      reef_crier: ["Crieur du récif", "Cri de guerre : Votre prochain Cri de guerre ce tour se déclenche deux fois.", "Cri de guerre : Vos deux prochains Cris de guerre ce tour se déclenchent deux fois."],
      shell_drummer: ["Tambour de coquillage", "Après avoir joué un serviteur avec un Cri de guerre, gagne +{n}/+{n}."], tide_caller: ["Appeleur de marée", "Cri de guerre : Donne +{n}/+{n} à vos autres Ondins."],
      pearl_diver: ["Plongeur de perles", "Cri de guerre : Ajoute un serviteur aléatoire avec un Cri de guerre à votre main.", "Cri de guerre : Ajoute 2 serviteurs aléatoires avec un Cri de guerre à votre main."],
      deep_chanter: ["Chantre des profondeurs", "Vos Cris de guerre se déclenchent deux fois.", "Vos Cris de guerre se déclenchent trois fois."],
      leviathan: ["Héraut du Léviathan", "Cri de guerre : Donne +1/+1 à vos serviteurs pour chaque Cri de guerre joué cette partie (jusqu'à 8).", "Cri de guerre : Donne +2/+2 à vos serviteurs pour chaque Cri de guerre joué cette partie (jusqu'à 8)."],
      grubling_imp: ["Diablotin larvaire", "Cri de guerre : Votre héros perd 2 PV."], hungering_fiend: ["Démon affamé", "Cri de guerre : Dévore un serviteur aléatoire de la taverne.", "Cri de guerre : Dévore 2 serviteurs aléatoires de la taverne."],
      soul_glutton: ["Glouton d'âmes", "Après avoir Dévoré, donne +{n}/+{n} à vos autres Infernaux."], pit_butcher: ["Boucher de la fosse", "À la fin de votre tour, Dévore un serviteur aléatoire de la taverne.", "À la fin de votre tour, Dévore 2 serviteurs aléatoires de la taverne."],
      abyssal_maw: ["Gueule abyssale", "Dévorer donne une fois et demie les stats.", "Dévorer donne le double des stats."],
      lord_of_cinders: ["Seigneur des cendres", "Cri de guerre : Dévore 3 serviteurs aléatoires de la taverne.", "Cri de guerre : Dévore 3 serviteurs aléatoires de la taverne pour le double des stats."],
      lantern_keeper: ["Porteur de lanterne", "Cri de guerre : Donne +{n}/+{n} à un autre serviteur allié."], tavern_bard: ["Barde de taverne", "À la fin de votre tour, donne +{n}/+{n} à un autre serviteur allié."],
      rally_herald: ["Héraut du ralliement", "Cri de guerre : Donne +{n}/+{n} à vos serviteurs pour chaque tribu différente parmi eux."], great_warden: ["Grand Gardien", "Début de combat : Donne +{n}/+{n} à vos autres serviteurs."],
      grand_champion: ["Grand Champion", ""], pup: ["Chiot", ""], cub: ["Lionceau", ""], birdie: ["Oisillon", ""],
      nurturing_polyp: ["Polype nourricier", ""], coral_bud: ["Bourgeon de corail", ""], reef_warden: ["Gardien du récif", ""], gilded_polyp: ["Polype doré", ""], catalyst_coral: ["Corail catalyseur", ""],
      reef_echo: ["Écho du récif", ""], reef_mother: ["Mère-récif", ""], coral_sprout: ["Petit Corail", ""], valve_sprite: ["Lutin soupape", ""], piston_brute: ["Brute à pistons", ""],
      unstable_boiler: ["Chaudière instable", ""], pressure_titan: ["Titan de pression", ""], tar_spitter: ["Cracheur de goudron", ""], sticky_slug: ["Limace collante", ""], bitumen_devourer: ["Dévoreur de bitume", ""],
      brook_nymph: ["Nymphe du ruisseau", ""], tide_shaper: ["Façonneur de marée", ""], cascade_spirit: ["Esprit de la cascade", ""], pebble_mole: ["Taupe à cailloux", ""], stone_golem: ["Golem de pierre", ""],
      ancestral_monolith: ["Monolithe ancestral", ""], telluric_architect: ["Architecte tellurique", ""],
    },
    spells: {
      lucky_coin: ["Pièce porte-bonheur", "Gagne 1 or."], tavern_brew: ["Bière de taverne", "Donne +2/+2 à un serviteur."], polish: ["Polish du forgeron", "Donne Bouclier à un serviteur."],
      recruit: ["Cor de recrutement", "Découvre un serviteur de votre niveau de taverne."], gold_rush: ["Ruée vers l'or", "Au prochain tour, gagne 3 or de plus."], spirit_ward: ["Garde spirituelle", "Donne Renaissance à un serviteur."],
      feast: ["Festin copieux", "Donne +1/+1 à vos serviteurs."], mirror: ["Potion miroir", "Ajoute une copie simple d'un serviteur allié à votre main."], venom_vial: ["Fiole de venin", "Donne Venimeux à un serviteur."],
      war_banner: ["Bannière de guerre", "Donne +3/+3 aux serviteurs de votre tribu la plus nombreuse."],
      strength: ["Force"], blue_sky: ["Ciel bleu"], dawn_sky: ["Ciel de l'aube"], morning_sky: ["Ciel du matin"], night_sky: ["Ciel nocturne"],
      evo_stealth: ["Évolution"], evo_tough: ["Évolution"], evo_windfury: ["Évolution"], evo_shield: ["Évolution"],
    },
    heroes: {
      h_marshal: ["Maréchale Varga", "Exercice"], h_tinker: ["Bricoleur Ollo", "Plans de ferraille"], h_sela: ["Capitaine Sela", "Receleuse"], h_pyre: ["Sorcière du bûcher", "Petit bois"], h_moss: ["Jardinier Moss", "Taille"],
      h_gil: ["Gardien Gil", "Tenir bon"], h_pell: ["Marchand Pell", "Marchandage"], h_ira: ["Orfèvre Ira", "Dorure"], h_vael: ["Voyante Vael", "Aperçu"], h_nox: ["Mime Nox", "Écho"], h_duke: ["Duc de fer", "Blindage"],
      h_pim: ["Pim la pickpocket", "Doigts agiles"], h_echo: ["Écho le barde", "Rappel"], h_rook: ["Rook le joueur", "Dés pipés"], h_vex: ["Maman Vex", "L'heure du repas"], h_heir: ["L'Héritier", "Héritage"], h_wren: ["Wren la tisseuse", "Retissage"],
    },
    anomalies: {
      an_gift: "Échange de cadeaux", an_bargain: "Bac à bonnes affaires", an_gilded: "Taverne dorée", an_rush: "Longueur d'avance", an_purse: "Poches profondes", an_market: "Grand marché", an_iron: "Héros de fer", an_spells: "Tempête de sorts",
      an_blood: "Lune de sang", an_topsy: "Sens dessus dessous", an_fair: "Foire tribale", an_fortune: "Diseuse de bonne aventure", an_blessing: "Bénédictions sauvages", an_sale: "Grande ouverture", an_mirror: "Match miroir",
    },
    triggerLabels: {
      onAffUp: "Quand une de vos affinités s'éveille ou grandit",
      onFoundationPlay: "Socle : quand vous le jouez sur une Fondation (Terre)", onSelfEbb: "Quand ce serviteur revient dans votre main par Reflux (Eau)", onPressureFull: "Quand votre Pression est pleine (Vapeur)", onMire: "Après que votre camp englue un ennemi (Goudron)",
      andThen: "Puis : si la règle du dessus a eu lieu (taverne)", orElse: "Sinon : si la règle du dessus n'a pas eu lieu (taverne)", andThenC: "Puis : si la règle du dessus a eu lieu (combat)", orElseC: "Sinon : si la règle du dessus n'a pas eu lieu (combat)",
      onSignal: "Quand un signal est envoyé (taverne)", onSignalC: "Quand un signal est envoyé (combat)",
      evoFull: "Évolution : quand son cristal d'Évolution est plein",
      battlecry: "Cri de guerre (quand joué)", endOfTurn: "À la fin de votre tour", startOfTurn: "Au début de votre tour", onBuy: "Après l'achat d'un serviteur", onPlayOther: "Après avoir joué un autre serviteur", onSell: "Quand vous vendez ce serviteur",
      onSpell: "Après avoir lancé un sort de taverne", startOfCombat: "Début de combat", onAttack: "Quand ce serviteur attaque", deathrattle: "Râle d'agonie (quand il meurt)", onAllyDeath: "Après la mort d'un serviteur allié", onSummonAlly: "Après l'invocation d'un serviteur allié",
      onShieldLost: "Après qu'un Bouclier allié se brise", onDamaged: "Quand ce serviteur subit des dégâts", onKill: "Après que ce serviteur tue un serviteur", onFriendlyAttack: "Quand un autre serviteur allié attaque", afterUpgrade: "Après avoir amélioré la taverne", onRoll: "Après avoir rafraîchi la taverne",
      onSellOther: "Après avoir vendu un autre serviteur", onTriple: "Après avoir créé un serviteur doré", onFreeze: "Après avoir gelé la taverne", onBuySpell: "Après avoir acheté un sort de taverne", onBuyFrozen: "Après avoir acheté un serviteur Gelé", onFreezeFoe: "Après que votre camp a Gelé un ennemi", afterDevour: "Après avoir Dévoré", onSpellTargeted: "Quand un sort de taverne cible ce serviteur", afterWin: "Après avoir gagné un combat", afterLoss: "Après avoir perdu un combat",
      onEnemyDeath: "Après la mort d'un serviteur ennemi", onRebornAlly: "Après la Renaissance d'un serviteur allié", onPlayBattlecry: "Après avoir joué un serviteur à Cri de guerre", onOverkill: "Carnage (tue avec des dégâts en trop)", onLastStanding: "Quand c'est votre dernier serviteur debout",
      onDeathrattleFriend: "Après le déclenchement d'un Râle d'agonie allié", afterCombat: "Après chaque combat (gagné ou perdu)", afterSurvive: "Après que ce serviteur survit à un combat", onDiscover: "Après avoir Découvert un serviteur", onEnemySummon: "Après l'invocation d'un serviteur ennemi",
      pulse: "Pulsation (Corail : quand un Corail est joué à côté)", onAttacked: "Quand ce serviteur est attaqué", onMiredDeath: "Après la mort d'un serviteur ennemi englué (Goudron)", afterReflux: "Après qu'un de vos serviteurs revient dans votre main par Reflux (Eau)", afterFoundation: "Après avoir construit une Fondation (Terre)",
      onDevoured: "Quand ce serviteur est Dévoré", passive: "Aura : toujours, tant qu'il est sur votre plateau", gameStart: "Au début de la partie", cast: "Quand lancé", activate: "Activation (clic sur le plateau, coûte de l'or, une fois par tour)",
    },
    actionLabels: {
      mkPlus: "Marqueurs : donner des marqueurs de stats (+1/+1, +2/+2…)", mkKw: "Marqueurs : donner un marqueur de mot-clé", mkMove: "Marqueurs : déplacer des marqueurs d'autres serviteurs sur celui-ci",
      mkTake: "Marqueurs : gagner tous les marqueurs d'autres serviteurs", mkRemove: "Marqueurs : retirer des marqueurs", enemyKw: "Gagner un mot-clé aléatoire de la troupe adverse",
      counter: "Compteur : ajouter à un compteur à vous (Rage, Âmes…) ou le fixer", signal: "Envoyer un signal : les serviteurs qui l'écoutent réagissent",
      foundationAll: "Construire une Fondation sous chaque emplacement (Terre)", foundationGrow: "Stats pour chaque Fondation sous vos serviteurs (Terre)", releasePressure: "Libérer toute la Pression : stats par point (Vapeur)", ebbMore: "Reflux en plus ce tour (Eau)", affStats: "Stats à tous vos serviteurs d'une affinité, plateau et main",
      gainPressure: "Gagner de la Pression (Vapeur)", pulseDouble: "Vos prochains effets de Pulsation se déclenchent deux fois (Corail)", mire: "Engluer des serviteurs ennemis (Goudron)", buildFoundation: "Construire une Fondation sous des serviteurs (Terre)", giveAff: "Donner une affinité", fireTrigger: "Déclencher leurs propres effets (Cri de guerre, Râle d'agonie…)",
      charge: "Charger les cristaux d'Évolution", mutate: "Mutation : le joueur choisit un bonus", mutateTarget: "Donner une mutation à un autre serviteur",
      buff: "Donner Attaque / PV", keyword: "Donner un mot-clé", damage: "Infliger des dégâts", summon: "Invoquer des serviteurs", gold: "Gagner de l'or", nextGold: "Or en plus au prochain tour", freeRoll: "Rafraîchissements gratuits", addMinion: "Ajouter des serviteurs aléatoires à la main",
      addSpell: "Ajouter des sorts de taverne aléatoires à la main", addCard: "Ajouter un serviteur précis à votre main", discover: "Découvrir un serviteur", devour: "Dévorer", devourEnemy: "Dévorer un ennemi en combat", devourBonus: "Dévorer donne des stats en plus", devourKeywords: "Dévorer transmet les mots-clés",
      frozenBuff: "Les serviteurs gelés de la taverne grandissent chaque tour", addSpellId: "Ajouter un sort de taverne précis à la main", castSpell: "Lancer gratuitement un sort de taverne précis", copySpell: "Ajouter à la main une copie du dernier sort lancé", spellDiscount: "Aura : les sorts de taverne coûtent moins cher", freezeMinion: "Geler des serviteurs de la taverne (ils restent au rafraîchissement, jusqu'à votre prochain tour)", freezeFoe: "Geler des serviteurs ennemis (ils sautent leur prochaine attaque)", goldenHand: "Rendre doré un serviteur de votre main", ruleDevour: "Règle : Dévorer donne 1,5× les stats", tavernBuff: "Les serviteurs de la taverne grandissent", hero: "Votre héros gagne / perd des PV", destroy: "Détruire",
      permBuff: "Donner des stats permanentes", summonRandom: "Invoquer des serviteurs aléatoires", addCopy: "Ajouter une copie à votre main", upgradeDiscount: "Réduction sur l'amélioration de taverne", setStats: "Fixer les stats", swapStats: "Échanger Attaque et PV", doubleStats: "Doubler les stats", debuff: "Retirer des stats",
      removeKeyword: "Retirer un mot-clé", heal: "Soigner entièrement", healN: "Rendre des PV", attackNow: "Attaquer immédiatement", heroDamage: "Dégâts au héros ennemi", summonCopy: "Invoquer une copie", makeGolden: "Rendre doré", transform: "Transformer", stealShop: "Prendre un serviteur de la taverne",
      buffHand: "Donner des stats aux serviteurs de votre main", empower: "Agrandir les effets de stats d'un serviteur", buffBoost: "Aura : les effets de stats de vos serviteurs donnent plus", spellBoost: "Aura : vos sorts de taverne et pouvoir héroïque donnent plus", freeUpgrade: "Améliorer la taverne gratuitement", refreshShop: "Rafraîchir la taverne", freezeShop: "Geler la taverne", grantEffect: "Donner un effet", bounce: "Renvoyer un serviteur dans votre main", setTribe: "Changer de tribu", sacrifice: "Sacrifier",
      nextCombatBuff: "Stats pendant le prochain combat", nextCombatStrike: "Frappe au début du prochain combat", extraBattlecry: "Les Cris de guerre se déclenchent plus", extraDeathrattle: "Les Râles d'agonie se déclenchent plus", extraEndOfTurn: "Les effets de fin de tour se déclenchent plus", extraStartOfTurn: "Les effets de début de tour se déclenchent plus",
      extraStartOfCombat: "Les effets de Début de combat se déclenchent plus", extraSpell: "Les sorts de taverne sont lancés plus", summonBuff: "Les serviteurs invoqués en combat gagnent des stats", buyDiscount: "Les serviteurs coûtent moins", rollDiscount: "Les rafraîchissements coûtent moins", shopSize: "La taverne propose plus de serviteurs",
      ruleBuy: "Règle : prix d'achat", ruleSell: "Règle : prix de vente", ruleRoll: "Règle : prix du rafraîchissement", ruleUpgrade: "Règle : prix de l'amélioration", ruleShop: "Règle : taille de la taverne", ruleIncome: "Règle : plus ou moins d'or chaque tour", ruleMaxGold: "Règle : limite d'or", ruleBank: "Règle : garder l'or non dépensé",
      ruleDiscover: "Règle : choix à la Découverte", ruleGolden: "Règle : serviteurs dorés dans la taverne", armor: "Gagner de l'Armure", copyOpponent: "Copier un serviteur du dernier adversaire", goldenShop: "Rendre doré un serviteur de la taverne", refreshUp: "Rafraîchir avec un niveau supérieur", passStats: "Transmettre l'Attaque et les PV",
      randomKeyword: "Donner un mot-clé aléatoire", goldRandom: "Gagner un montant d'or aléatoire", freeBuy: "Prochains serviteurs gratuits", repeatBattlecry: "Répéter le Cri de guerre", stealGold: "Voler de l'or au prochain adversaire", copyNextOpponent: "Copier un serviteur du prochain adversaire", tribeShop: "Rafraîchir avec une seule tribu",
      shuffleBoard: "Mélanger vos serviteurs", resurrect: "Ressusciter", steal: "Prendre le contrôle", shuffleEnemies: "Mélanger la troupe ennemie", combatGold: "Or au prochain tour (combat)", silence: "Réduire au silence", reposition: "Déplacer", ruleTriple: "Règle : deux copies font un doré", ruleDamage: "Règle : dégâts subis", sharedPick: "Un joueur choisit un serviteur, tout le monde le reçoit",
    },
  };
  const frFem = (t) => FR.fem.has(t);
  const frPl = (n, w) => (n === 1 ? w : w.endsWith("s") || w.endsWith("x") ? w : /(eau|au|eu)$/.test(w) ? w + "x" : w + "s");
  // "un autre X allié aléatoire" with the right gender
  function frNoun(t, n, { other = false, random = false, side = "", all = false, the = false } = {}) {
    const f = t ? frFem(t) : false, w = t || "serviteur", e = f ? "e" : "";
    const adj = (side === "ally" ? ` allié${e}` : side === "enemy" ? ` ennemi${e}` : "") + (random ? " aléatoire" : "");
    if (n > 1) return `${all ? (f ? "toutes " : "tous ") : ""}${the ? "les " : n + " "}${other ? "autres " : ""}${frPl(2, w)}${adj.replace(/(allié|ennemi)(e?)/, "$1$2s").replace(/aléatoire$/, "aléatoires")}`;
    return `${f ? "une" : "un"} ${other ? "autre " : ""}${w}${adj}`;
  }
  function targetTextFR(ab) { return targetTextFRBase(ab) + kwFilterText(ab, "fr"); }
  function targetTextFRBase(ab) {
    const t = TN(ab.ttribe || ""), n = ab.count || 1;
    switch (ab.target) {
      case "self": return "ce serviteur";
      case "randomFriend": return frNoun(t, n, { other: true, random: true, side: "ally" });
      case "allFriends": return `vos autres ${t ? frPl(2, t) : "serviteurs"}`;
      case "adjacent": return `les ${t ? frPl(2, t) : "serviteurs"} adjacent${t && frFem(t) ? "e" : ""}s`;
      case "leftmost": return n > 1 ? `vos ${n} autres ${t ? frPl(2, t) : "serviteurs"} les plus à gauche` : `votre autre ${t || "serviteur"} le plus à gauche`;
      case "rightmost": return n > 1 ? `vos ${n} autres ${t ? frPl(2, t) : "serviteurs"} les plus à droite` : `votre autre ${t || "serviteur"} le plus à droite`;
      case "tokens": return `vos jetons${t ? " " + t : ""}`;
      case "randomToken": return n > 1 ? `${n} de vos jetons${t ? " " + t : ""} au hasard` : `un de vos jetons${t ? " " + t : ""} au hasard`;
      case "trigger": return ab.trigger === "onDevoured" || ab.trigger === "afterDevour" ? "le dévoreur" : ab.trigger === "onAttacked" ? "l'attaquant" : "celui-ci";
      case "randomEnemy": return frNoun(t, n, { random: true, side: "enemy" });
      case "allEnemies": return frNoun(t, 2, { side: "enemy", all: true, the: true });
      case "chosen": return "un serviteur";
      case "buffers": return `vos autres ${t ? frPl(2, t) : "serviteurs"} qui donnent des stats`;
      case "allFriendsSelf": return `${t && frFem(t) ? "toutes" : "tous"} vos ${t ? frPl(2, t) : "serviteurs"}`;
      case "randomFriendSelf": return frNoun(t, n, { random: true, side: "ally" });
      case "leftOf": return `${t ? (frFem(t) ? "la " : "le ") + t : "le serviteur"} à gauche de celui-ci`;
      case "rightOf": return `${t ? (frFem(t) ? "la " : "le ") + t : "le serviteur"} à droite de celui-ci`;
      case "kin": return `vos autres ${t ? frPl(2, t) : "serviteurs"} qui partagent une tribu avec celui-ci`;
      case "weakestFriend": return `votre autre ${t || "serviteur"} le plus faible`;
      case "strongestFriend": return `votre autre ${t || "serviteur"} le plus fort`;
      case "weakestEnemy": return `${t ? (frFem(t) ? "la " : "le ") + t : "le serviteur"} ennemi${t && frFem(t) ? "e" : ""} le plus faible`;
      case "strongestEnemy": return `${t ? (frFem(t) ? "la " : "le ") + t : "le serviteur"} ennemi${t && frFem(t) ? "e" : ""} le plus fort`;
      case "frontEnemy": return `${t ? (frFem(t) ? "la " : "le ") + t : "le serviteur"} ennemi${t && frFem(t) ? "e" : ""} le plus à gauche`;
      case "backEnemy": return `${t ? (frFem(t) ? "la " : "le ") + t : "le serviteur"} ennemi${t && frFem(t) ? "e" : ""} le plus à droite`;
      case "allMinions": return `${t ? "chaque " + t : "chaque serviteur"} des deux camps`;
      case "shopAll": return `les ${t ? frPl(2, t) : "serviteurs"} de la taverne`;
      case "shopRandom": return `${frNoun(t, n, { random: true })} de la taverne`;
      case "shopFrozen": return `les ${t ? frPl(2, t) : "serviteurs"} Gelés de la taverne`;
      case "frozenEnemies": return `les ${t ? frPl(2, t) : "serviteurs"} ennemis Gelés`;
      case "handAll": return `les ${t ? frPl(2, t) : "serviteurs"} de votre main`;
      case "handRandom": return `${frNoun(t, n, { random: true })} de votre main`;
      case "tribeMost": return "vos autres serviteurs de votre tribu la plus nombreuse";
      case "previous": return "les mêmes serviteurs";
      case "pickFriend": return `${frNoun(t, 1, { other: true, side: "ally" })} de votre choix`;
      case "pickAny": return `un${t && frFem(t) ? "e" : ""} de vos ${t ? frPl(2, t) : "serviteurs"} de votre choix`;
      case "pickShop": return `${frNoun(t, 1)} de la taverne de votre choix`;
      case "pickHand": return `${frNoun(t, 1)} de votre main de votre choix`;
      case "colony": return "votre Colonie";
      case "foundationMinions": return `vos ${t ? frPl(2, t) : "serviteurs"} posés sur une Fondation`;
      case "newest": return `${t ? (frFem(t) ? "la " : "le ") + t : "le serviteur"} joué${t && frFem(t) ? "e" : ""} le plus récemment`;
      case "oldest": return `${t ? (frFem(t) ? "la " : "le ") + t : "le serviteur"} joué${t && frFem(t) ? "e" : ""} depuis le plus longtemps`;
    }
    return "un serviteur";
  }
  // the triggers "Trigger their own effects" can fire, by phase: [English, French]
  const FIRE_NAME = { battlecry: ["Battlecry", "de Cri de guerre"], endOfTurn: ["end-of-turn", "de fin de tour"], startOfTurn: ["start-of-turn", "de début de tour"], pulse: ["Pulse", "de Pulsation"], onSell: ["sell", "de vente"], afterSurvive: ["survive", "de survie"],
    deathrattle: ["Deathrattle", "de Râle d'agonie"], startOfCombat: ["Start of Combat", "de Début de combat"], onAttack: ["attack", "d'attaque"], onKill: ["kill", "de victime"], onDamaged: ["damage", "de dégâts subis"] };
  const FIRE_TAVERN = ["battlecry", "endOfTurn", "startOfTurn", "pulse", "afterSurvive"], FIRE_COMBAT = ["deathrattle", "startOfCombat", "onAttack", "onKill", "onDamaged"];
  const FR_TRIG = {
    onBuffed: () => "Quand ce serviteur gagne des stats, ",
    battlecry: () => "Cri de guerre : ", endOfTurn: () => "À la fin de votre tour, ", startOfTurn: () => "Au début de votre tour, ",
    onBuy: (f) => `Après l'achat ${f ? "d'" + frNoun(f, 1).replace(/^une? /, "") : "d'un serviteur"}, `.replace("d'un serviteur,", "d'un serviteur,"),
    onPlayOther: (f) => `Après avoir joué ${f ? frNoun(f, 1) : "un autre serviteur"}, `, onSell: () => "Quand vous vendez ce serviteur, ", onSpell: () => "Après avoir lancé un sort de taverne, ",
    startOfCombat: () => "Début de combat : ", onAttack: () => "Quand ce serviteur attaque, ", deathrattle: () => "Râle d'agonie : ",
    onAllyDeath: (f) => `Après la mort ${f ? "d'" + frNoun(f, 1, { side: "ally" }).replace(/^une? /, "") : "d'un serviteur allié"}, `,
    onSummonAlly: (f) => `Après l'invocation ${f ? "d'" + frNoun(f, 1, { side: "ally" }).replace(/^une? /, "") : "d'un serviteur allié"} en combat, `,
    onShieldLost: () => "Après qu'un Bouclier allié se brise, ", onDamaged: () => "Quand ce serviteur subit des dégâts et survit, ", onKill: () => "Après que ce serviteur tue un serviteur, ",
    onFriendlyAttack: (f) => `Quand ${f ? frNoun(f, 1, { other: true, side: "ally" }) : "un autre serviteur allié"} attaque, `, afterUpgrade: () => "Après avoir amélioré votre taverne, ", onRoll: () => "Après avoir rafraîchi la taverne, ",
    onSellOther: (f) => `Après avoir vendu ${f ? frNoun(f, 1) : "un autre serviteur"}, `, onTriple: (f) => `Après avoir créé ${f ? frNoun(f, 1) + (frFem(f) ? " dorée" : " doré") : "un serviteur doré"}, `,
    onFreeze: () => "Après avoir gelé la taverne, ", onBuySpell: () => "Après avoir acheté un sort de taverne, ", onBuyFrozen: () => "Après avoir acheté un serviteur Gelé, ", onFreezeFoe: () => "Après que votre camp a Gelé un ennemi, ", afterDevour: (f) => `Après avoir Dévoré${f ? " " + frNoun(f, 1) : ""}, `, onSpellTargeted: () => "Quand un sort de taverne cible ce serviteur, ", afterWin: () => "Après avoir gagné un combat, ", afterLoss: () => "Après avoir perdu un combat, ",
    onEnemyDeath: (f) => `Après la mort ${f ? "d'" + frNoun(f, 1, { side: "enemy" }).replace(/^une? /, "") : "d'un serviteur ennemi"}, `, onRebornAlly: (f) => `Après la Renaissance ${f ? "d'" + frNoun(f, 1, { side: "ally" }).replace(/^une? /, "") : "d'un serviteur allié"}, `,
    onPlayBattlecry: (f) => `Après avoir joué ${f ? frNoun(f, 1) + " avec un Cri de guerre" : "un serviteur à Cri de guerre"}, `, onOverkill: () => "Carnage : ", onLastStanding: () => "Quand c'est votre dernier serviteur debout, ",
    onDeathrattleFriend: (f) => `Après le déclenchement du Râle d'agonie ${f ? "d'" + frNoun(f, 1, { side: "ally" }).replace(/^une? /, "") : "d'un allié"}, `, afterCombat: () => "Après chaque combat, ", afterSurvive: () => "Après que ce serviteur survit à un combat, ",
    onDiscover: (f) => `Après avoir Découvert ${f ? frNoun(f, 1) : "un serviteur"}, `, onEnemySummon: (f) => `Après l'invocation ${f ? "d'" + frNoun(f, 1, { side: "enemy" }).replace(/^une? /, "") : "d'un serviteur ennemi"}, `,
    onDevoured: () => "Quand ce serviteur est Dévoré, ", onAttacked: () => "Quand ce serviteur est attaqué, ", pulse: () => (affMech(affsOfKind("pulse")[0], "fr") || "Pulsation") + " : ", onMiredDeath: () => "Après la mort d'un serviteur ennemi englué, ",
    onAffUp: () => "Quand une de vos affinités s'éveille ou grandit, ",
    andThen: () => "Puis, ", orElse: () => "Sinon, ", andThenC: () => "Puis, ", orElseC: () => "Sinon, ",
    onSignal: () => "Quand le signal est envoyé, ", onSignalC: () => "Quand le signal est envoyé, ",
    onFoundationPlay: () => "Socle : quand joué sur une Fondation, ", onSelfEbb: () => "Quand ce serviteur revient dans votre main par Reflux, ", onPressureFull: () => "Quand votre Pression est pleine, ", onMire: () => "Après que votre camp englue un ennemi, ",
    afterReflux: () => "Après qu'un de vos serviteurs revient dans votre main par Reflux, ", afterFoundation: () => "Après avoir construit une Fondation, ", passive: () => "", gameStart: () => "Au début de la partie, ", cast: () => "",
  };
  function everyTextFR(trig, f, n) {
    const P = (w) => (f ? frPl(n, f) : w), many = f ? frPl(2, f) : "serviteurs";
    switch (trig) {
      case "pulse": return `Toutes les ${n} Pulsations : `;
      case "onBuy": return `Après l'achat de ${n} ${P("serviteurs")}, `;
      case "onPlayOther": return `Après avoir joué ${n} ${f ? many : "autres serviteurs"}, `;
      case "onSellOther": return `Après avoir vendu ${n} ${f ? many : "autres serviteurs"}, `;
      case "onSpell": return `Après avoir lancé ${n} sorts de taverne, `;
      case "onRoll": return `Après avoir rafraîchi la taverne ${n} fois, `;
      case "afterUpgrade": return `Après avoir amélioré votre taverne ${n} fois, `;
      case "onTriple": return `Après avoir créé ${n} ${P("serviteurs")} doré${f && frFem(f) ? "e" : ""}s, `;
      case "onDiscover": return `Après avoir Découvert ${n} ${P("serviteurs")}, `;
      case "onFreeze": return `Après avoir gelé la taverne ${n} fois, `;
      case "afterDevour": return `Après avoir Dévoré ${n} fois, `;
      case "afterWin": return `Après avoir gagné ${n} combats, `;
      case "afterLoss": return `Après avoir perdu ${n} combats, `;
      case "afterCombat": return `Après ${n} combats, `;
      case "onAttack": return `Après ${n} attaques de ce serviteur, `;
      case "onKill": return `Après que ce serviteur a tué ${n} serviteurs, `;
      case "onDamaged": return `Après avoir subi des dégâts ${n} fois, `;
      case "onAllyDeath": return `Après la mort de ${n} ${P("serviteurs")} allié${f && frFem(f) ? "e" : ""}s, `;
      case "onEnemyDeath": return `Après la mort de ${n} ${P("serviteurs")} ennemi${f && frFem(f) ? "e" : ""}s, `;
      case "onSummonAlly": return `Après l'invocation de ${n} ${P("serviteurs")} allié${f && frFem(f) ? "e" : ""}s en combat, `;
      case "onEnemySummon": return `Après l'invocation de ${n} ${P("serviteurs")} ennemi${f && frFem(f) ? "e" : ""}s, `;
      case "onFriendlyAttack": return `Après ${n} attaques d'autres ${many} allié${f && frFem(f) ? "e" : ""}s, `;
      case "onShieldLost": return `Après ${n} Boucliers alliés brisés, `;
      case "onPlayBattlecry": return `Après avoir joué ${n} ${f ? many + " avec un Cri de guerre" : "serviteurs à Cri de guerre"}, `;
      case "onRebornAlly": return `Après ${n} Renaissances alliées, `;
      case "onDeathrattleFriend": return `Après ${n} Râles d'agonie alliés, `;
    }
    return null;
  }
  const frStats = (a, h) => (a && h ? `+${a}/+${h}` : a ? `+${a} Attaque` : `+${h} PV`);
  const frTimes = (t) => (t === 2 ? "deux fois" : t === 3 ? "trois fois" : t + " fois");
  function abilityTextFR(ab, golden, left) {
    const tr = TRIGGERS[ab.trigger], k = golden && ab.golden !== false ? 2 : 1;
    if (!tr || !ACTIONS[ab.action]) return "";
    const n = (ab.n || 0) * k, a = (ab.a || 0) * k, h = (ab.h || 0) * k, c = ab.count || 1, T = () => targetTextFR(ab), ck = c * k;
    const some = (m, w) => (m === 1 ? `un ${w}` : `${m} ${frPl(2, w)}`);
    let body = "";
    switch (ab.action) {
      case "buff": body = `donne ${frStats(a, h)} à ${T()}`; break;
      case "keyword": body = `donne ${CKW[ab.kw] ? CKW[ab.kw].name : FR.kw[ab.kw] || "Provocation"} à ${T()}`; break;
      case "damage": body = `inflige ${n} dégât${n > 1 ? "s" : ""} à ${T()}`; break;
      case "summon": { const cd = CARDS[ab.card] || TOKENS[ab.card]; const nm = cd ? cd.name : "serviteur"; const st = ab.a || ab.h ? ` ${(ab.a || cd.attack) * k}/${(ab.h || cd.health) * k}` : ""; body = `invoque ${c === 1 ? "un" : c} ${frPl(c, nm)}${st}`; break; }
      case "gold": body = `gagne ${n} or`; break;
      case "nextGold": body = `gagne ${n} or de plus au prochain tour`; break;
      case "freeRoll": body = n === 1 ? "votre prochain Rafraîchissement est gratuit" : `vos ${n} prochains Rafraîchissements sont gratuits`; break;
      case "addMinion": body = `ajoute ${ck === 1 ? (ab.tribe && frFem(TN(ab.tribe)) ? "une" : "un") : ck} ${ab.tribe ? frPl(ck, TN(ab.tribe)) : frPl(ck, "serviteur")} aléatoire${ck > 1 ? "s" : ""} à votre main`; break;
      case "addSpell": body = `ajoute ${ck === 1 ? "un sort de taverne aléatoire" : ck + " sorts de taverne aléatoires"} à votre main`; break;
      case "addSpellId": { const sn = SPELLS[ab.spell] ? SPELLS[ab.spell].name : "un sort de taverne"; body = `ajoute ${ck === 1 ? sn : ck + " × " + sn} à votre main`; break; }
      case "castSpell": { const sp = SPELLS[ab.spell], sn = sp ? sp.name : "un sort de taverne"; body = `lance ${sn} gratuitement${sp && sp.target ? " sur " + T() : ""}`; break; }
      case "copySpell": body = `ajoute ${ck === 1 ? "une copie" : ck + " copies"} du dernier sort de taverne lancé à votre main`; break;
      case "spellDiscount": body = `vos sorts de taverne coûtent ${ab.n || 1} de moins`; break;
      case "addCard": { const cd = CARDS[ab.card] || TOKENS[ab.card]; const nm = cd ? cd.name : "serviteur"; body = `ajoute ${ck === 1 ? "un" : ck} ${frPl(ck, nm)} à votre main`; break; }
      case "evolve": { if (ab.mode === "random") { body = evolveRandomText(ab); break; } const opts = evolveOptions(ab); body = opts.length >= 2 ? `devient ${opts.slice(0, -1).join(", ")} ou ${opts[opts.length - 1]} (au choix)` : `devient ${opts[0] || "un autre serviteur"}`; break; }
      case "charge": { const cn = Math.max(1, ab.n || 1) * k; body = !ab.target || ab.target === "self" ? `charge son Évolution de ${cn}` : `charge l'Évolution de ${T()} de ${cn}`; break; }
      case "mutate": body = mutateText(ab, golden && ab.golden !== false); break;
      case "mutateTarget": { const mt = mutateText(ab, false); body = `donne une mutation à ${T()} (${mt.replace(/^mute : /, "")})`; break; }
      case "discover": body = discoverText(ab, k, "fr"); break;
      case "gainPressure": body = `gagne ${n} ${affMech(affFor("gauge", ab.gaff), "fr")}`; break;
      case "pulseDouble": body = Math.max(1, n) === 1 ? "votre prochain effet de Pulsation se déclenche deux fois" : `vos ${Math.max(1, n)} prochains effets de Pulsation se déclenchent deux fois`; break;
      case "mire": { const ma = affFor("mire", ab.maff); body = !ma || affMech(ma, "fr") === "Engluement" ? `englue ${T()}` : `applique ${affMech(ma, "fr")} à ${T()}`; break; }
      case "buildFoundation": body = `construit une Fondation sous ${T()}`; break;
      case "foundationAll": body = "construit une Fondation sous chaque emplacement de votre plateau"; break;
      case "foundationGrow": body = `donne ${frStats(a, h)} à vos serviteurs posés sur une Fondation, pour chaque Fondation sous eux`; break;
      case "releasePressure": { const ga = affFor("gauge", ab.gaff), nm = affMech(ga, "fr") || "Pression"; body = `libère toute votre ${nm} : donne ${frStats(a, h)} à ${T()} par point`; break; }
      case "ebbMore": body = `vous pouvez faire ${Math.max(1, n)} Reflux de plus ce tour`; break;
      case "affStats": body = `donne ${frStats(a, h)} à vos serviteurs ${AN(ab.aff) || "?"}, sur le plateau et dans la main`; break;
      case "giveAff": body = `donne l'affinité ${AN(ab.aff) || "?"} à ${T()}`; break;
      case "counter": { const nm = (ab.vname || "Charge").trim(), v = (ab.n || 0) * (ab.golden === false ? 1 : k); body = ab.op === "set" ? (ab.scope === "player" ? `fixe votre ${nm} à ${v}` : `fixe son ${nm} à ${v}`) : v < 0 ? (ab.scope === "player" ? `retire ${-v} à votre ${nm}` : `lui retire ${-v} ${nm}`) : (ab.scope === "player" ? `vous gagnez +${v} ${nm}` : `il gagne +${v} ${nm}`); break; }
      case "signal": body = `envoie le signal « ${(ab.sigOut || ab.sig || "?").trim()} »`; break;
      case "fireTrigger": body = `déclenche les effets ${FIRE_NAME[ab.trig] ? FIRE_NAME[ab.trig][1] : "de Cri de guerre"} de ${T()}`.replace(/ de les /g, " des ").replace(/ de le /g, " du ").replace(/ de (une?) /g, " d'$1 ").replace(/ de (votre|vos) /g, " de $1 "); break;
      case "absorb": body = `ce serviteur gagne l'Attaque et les PV de ${T()}`; break;
      case "copyKeywords": body = `ce serviteur gagne les mots-clés de ${T()}`; break;
      case "nextSpellTwice": body = n === 1 ? "votre prochain sort de taverne est lancé deux fois" : `vos ${n} prochains sorts de taverne sont lancés deux fois`; break;
      case "nextBattlecryTwice": body = n === 1 ? "votre prochain Cri de guerre se déclenche deux fois" : `vos ${n} prochains Cris de guerre se déclenchent deux fois`; break;
      case "nextBuyBuff": body = `${ck === 1 ? "le prochain serviteur que vous achetez gagne" : `les ${ck} prochains serviteurs que vous achetez gagnent`} ${frStats(a, h)}`; break;
      case "nextPlayBuff": body = `${ck === 1 ? "le prochain serviteur que vous jouez gagne" : `les ${ck} prochains serviteurs que vous jouez gagnent`} ${frStats(a, h)}`; break;
      case "nextSellGold": body = `${ck === 1 ? "votre prochaine vente rapporte" : `vos ${ck} prochaines ventes rapportent`} ${n} or de plus`; break;
      case "spitCopy": body = "ajoute à votre main une copie du dernier serviteur que celui-ci a Dévoré"; break;
      case "devourGold": body = `Dévorer vous rapporte ${n} or`; break;
      case "devour": { const what = ab.devourFrom === "boardPick" ? "un serviteur allié de votre choix (stats entières)" : ab.devourFrom === "shopPick" ? "un serviteur de la taverne de votre choix" : ab.devourFrom === "handPick" ? "un serviteur de votre main de votre choix (stats entières)" : ab.devourFrom === "board" ? `${ck === 1 ? "un autre serviteur allié aléatoire" : ck + " autres serviteurs alliés aléatoires"} (stats entières)` : ab.devourFrom === "hand" ? `${ck === 1 ? "un serviteur aléatoire" : ck + " serviteurs aléatoires"} de votre main (stats entières)` : `${ck === 1 ? "un serviteur aléatoire" : ck + " serviteurs aléatoires"} de la taverne`; body = !ab.target || ab.target === "self" ? `Dévore ${what}` : ab.target === "chosen" ? `le serviteur choisi Dévore ${what}` : `${T()} Dévore${/^(vos|les|tous|toutes|\d)/.test(T()) ? "nt" : ""} ${what}`; break; }
      case "devourEnemy": body = `Dévore ${ck === 1 ? "un serviteur ennemi aléatoire" : ck + " serviteurs ennemis aléatoires"} : ${ck === 1 ? "le détruit" : "les détruit"} et gagne ${ab.share === "full" ? "toutes" : "la moitié de"} ${ck === 1 ? "ses" : "leurs"} stats`; break;
      case "devourBonus": body = `Dévorer donne ${frStats(a, h)} en plus`; break;
      case "devourKeywords": body = "les serviteurs que vous Dévorez transmettent leurs mots-clés"; break;
      case "frozenBuff": body = `les serviteurs gelés de la taverne gagnent ${frStats(a, h)} au début de votre tour`; break;
      case "goldenHand": body = `rend doré${ck > 1 ? "s" : ""} ${ck === 1 ? "un serviteur aléatoire" : ck + " serviteurs aléatoires"} de votre main`; break;
      case "ruleDevour": body = "Dévorer donne une fois et demie les stats"; break;
      case "tavernBuff": body = `les serviteurs de la taverne gagnent +${n}/+${n} pour le reste de la partie`; break;
      case "hero": body = n < 0 ? `votre héros perd ${-n} PV` : `votre héros gagne ${n} PV`; break;
      case "destroy": body = `détruit ${T()}`; break;
      case "permBuff": body = `donne ${frStats(a, h)} à ${T()} de façon permanente`; break;
      case "summonRandom": { const m = ck; body = `invoque ${m === 1 ? "un" : m} ${ab.tribe ? frPl(m, TN(ab.tribe)) : frPl(m, "serviteur")} aléatoire${m > 1 ? "s" : ""}${ab.tier ? " de niveau " + ab.tier : ""}${ab.allowSelf ? "" : ab.tier || ab.tribe ? " (pas celui-ci)" : ""}`; break; }
      case "addCopy": body = `ajoute une copie de ${ab.target === "self" ? "ce serviteur" : T()} à votre main`; break;
      case "upgradeDiscount": body = `votre prochaine amélioration de taverne coûte (${n}) de moins`; break;
      case "setStats": body = `fixe les stats de ${T()} à ${a}/${h}`; break;
      case "swapStats": body = `échange l'Attaque et les PV de ${T()}`; break;
      case "doubleStats": body = `${k > 1 ? "triple" : "double"} ${ab.stat === "health" ? "les PV" : ab.stat === "both" ? "l'Attaque et les PV" : "l'Attaque"} de ${T()}`; break;
      case "debuff": body = `donne ${a && h ? `-${a}/-${h}` : a ? `-${a} Attaque` : `-${h} PV`} à ${T()}`; break;
      case "removeKeyword": body = `retire ${CKW[ab.kw] ? CKW[ab.kw].name : FR.kw[ab.kw] || "Provocation"} à ${T()}`; break;
      case "heal": body = `rend tous ses PV à ${T()}`; break;
      case "healN": body = `rend ${n} PV à ${T()}`; break;
      case "attackNow": body = `${T()} attaque immédiatement`; break;
      case "heroDamage": body = `inflige ${n} dégât${n > 1 ? "s" : ""} au héros ennemi`; break;
      case "summonCopy": { const m = ck; body = `invoque ${m === 1 ? "une copie" : m + " copies"} de ${ab.target === "self" ? "ce serviteur" : T()}${ab.a && ab.h ? ` en ${ab.a}/${ab.h}` : ab.h ? ` avec ${ab.h} PV` : ab.a ? ` avec ${ab.a} Attaque` : ""}${ab.exact ? " (exacte : mêmes stats, mots-clés et marqueurs)" : ""}`; break; }
      case "makeGolden": body = `rend ${T()} doré`; break;
      case "transform": body = `transforme ${T()} en ${ab.tribe ? frNoun(TN(ab.tribe), 1, { random: true }) : "un serviteur aléatoire"}${ab.tier ? " de niveau " + ab.tier : ""}`; break;
      case "stealShop": { const m = ck; body = `prend gratuitement ${m === 1 ? "un serviteur aléatoire" : m + " serviteurs aléatoires"} de la taverne`; break; }
      case "buffHand": body = `donne ${frStats(a, h)} aux serviteurs de votre main`; break;
      case "empower": body = `les effets de stats de ${T()} donnent ${frStats(a, h)} de plus`; break;
      case "buffBoost": body = `les effets de stats de vos serviteurs donnent ${frStats(a, h)} de plus`; break;
      case "spellBoost": body = `vos sorts de taverne et votre pouvoir héroïque donnent ${frStats(a, h)} de plus`; break;
      case "freeUpgrade": body = "améliore votre taverne gratuitement"; break;
      case "refreshShop": body = "rafraîchit la taverne gratuitement"; break;
      case "freezeShop": body = "gèle la taverne"; break;
      case "freezeMinion": body = `Gèle ${T()} (reste${(ab.count || 1) > 1 || /^(shopAll|shopFrozen)$/.test(ab.target) ? "nt" : ""} au rafraîchissement, jusqu'à votre prochain tour)`; break;
      case "freezeFoe": body = `Gèle ${T()} (${(ab.count || 1) > 1 || /^all|frozenEnemies/.test(ab.target || "") ? "ils sautent leur" : "il saute sa"} prochaine attaque)`; break;
      case "grantEffect": { const g = ab.grant ? abilityTextFR(ab.grant, false).replace(/\.$/, "") : "un effet"; body = `donne « ${g} » à ${T()}`; break; }
      case "bounce": body = `renvoie ${T()} dans votre main`; break;
      case "setTribe": body = `transforme ${T()} en ${ab.toTribe === "?" ? "une tribu de votre choix" : ab.toTribe ? frNoun(TN(ab.toTribe), 1) : "un serviteur Neutre"}`; break;
      case "sacrifice": body = `détruit ${T()}${ab.give === "random" ? " et donne ses stats à un autre serviteur allié aléatoire" : ab.give === "adjacent" ? " et donne ses stats aux serviteurs voisins" : ab.give === "self" ? " et gagne ses stats" : ""}`; break;
      case "nextCombatBuff": body = `vos serviteurs ont ${frStats(a, h)} pendant votre prochain combat`; break;
      case "nextCombatStrike": body = `au début de votre prochain combat, inflige ${n} dégât${n > 1 ? "s" : ""} à ${ab.spread === "all" ? "tous les serviteurs ennemis" : c === 1 ? "un serviteur ennemi aléatoire" : c + " serviteurs ennemis aléatoires"}`; break;
      case "extraBattlecry": body = `vos autres Cris de guerre se déclenchent ${frTimes(1 + (ab.n || 1) * k)}`; break;
      case "extraDeathrattle": body = `vos Râles d'agonie se déclenchent ${frTimes(1 + (ab.n || 1) * k)}`; break;
      case "extraEndOfTurn": body = `vos effets de fin de tour se déclenchent ${frTimes(1 + (ab.n || 1) * k)}`; break;
      case "extraStartOfTurn": body = `vos effets de début de tour se déclenchent ${frTimes(1 + (ab.n || 1) * k)}`; break;
      case "extraStartOfCombat": body = `vos effets de Début de combat se déclenchent ${frTimes(1 + (ab.n || 1) * k)}`; break;
      case "extraSpell": body = `vos sorts de taverne sont lancés ${frTimes(1 + (ab.n || 1) * k)}`; break;
      case "summonBuff": body = `les serviteurs que vous invoquez en combat gagnent ${frStats(a, h)}`; break;
      case "buyDiscount": body = `les serviteurs coûtent (${(ab.n || 1) * k}) de moins`; break;
      case "rollDiscount": body = `les rafraîchissements coûtent (${(ab.n || 1) * k}) de moins`; break;
      case "shopSize": body = `la taverne propose ${(ab.n || 1) * k} serviteur${(ab.n || 1) * k > 1 ? "s" : ""} de plus`; break;
      case "ruleBuy": body = n < 0 ? `les serviteurs coûtent (${-n}) de moins` : `les serviteurs coûtent (${n}) de plus`; break;
      case "ruleSell": body = n < 0 ? `vendre un serviteur rapporte ${-n} or de moins` : `vendre un serviteur rapporte ${n} or de plus`; break;
      case "ruleRoll": body = n < 0 ? `les Rafraîchissements coûtent (${-n}) de moins` : `les Rafraîchissements coûtent (${n}) de plus`; break;
      case "ruleUpgrade": body = n < 0 ? `les améliorations de taverne coûtent (${-n}) de moins` : `les améliorations de taverne coûtent (${n}) de plus`; break;
      case "ruleShop": body = n < 0 ? `la taverne montre ${-n} serviteur${-n > 1 ? "s" : ""} de moins` : `la taverne montre ${n} serviteur${n > 1 ? "s" : ""} de plus`; break;
      case "ruleIncome": body = n < 0 ? `vous recevez ${-n} or de moins chaque tour` : `vous recevez ${n} or de plus chaque tour`; break;
      case "ruleMaxGold": body = n < 0 ? `votre limite d'or est abaissée de ${-n}` : `votre limite d'or est relevée de ${n}`; break;
      case "ruleBank": body = `vous gardez jusqu'à ${n} or non dépensé pour votre prochain tour`; break;
      case "ruleDiscover": body = n < 0 ? `Découvrir montre ${-n} choix de moins` : `Découvrir montre ${n} choix de plus`; break;
      case "ruleGolden": body = `les serviteurs de la taverne ont ${ab.pct || 10}% de chances d'être dorés`; break;
      case "armor": body = `gagne ${n} Armure`; break;
      case "copyOpponent": body = `ajoute ${c === 1 ? "une copie d'un serviteur aléatoire" : c + " copies de serviteurs aléatoires"} de la troupe de votre dernier adversaire à votre main`; break;
      case "goldenShop": body = `rend doré${c > 1 ? "s" : ""} ${c === 1 ? "un serviteur aléatoire" : c + " serviteurs aléatoires"} de la taverne`; break;
      case "refreshUp": body = `rafraîchit la taverne avec des serviteurs ${(ab.n || 1) === 1 ? "d'un niveau" : "de " + (ab.n || 1) + " niveaux"} au-dessus`; break;
      case "passStats": body = `donne à ${T()} l'Attaque et les PV ${ab.trigger === "onSell" ? "de ce serviteur" : ab.trigger === "onSellOther" ? "du serviteur vendu" : "du serviteur déclencheur"}`; break;
      case "randomKeyword": body = `donne un mot-clé aléatoire à ${T()}`; break;
      case "mkPlus": { const m = Math.max(1, ab.n || 1) * k, z = `+${ab.a == null ? 1 : ab.a}/+${ab.h == null ? 1 : ab.h}`; body = `donne ${m === 1 ? "un marqueur " + z : m + " marqueurs " + z} à ${T()}`; break; }
      case "mkKw": { const m = Math.max(1, ab.n || 1) * k; body = !ab.mkw || ab.mkw === "random" ? `donne ${m === 1 ? "un marqueur de mot-clé aléatoire" : m + " marqueurs de mots-clés aléatoires"} à ${T()}` : `donne un marqueur ${FR.kw[ab.mkw] || kwName(ab.mkw)} à ${T()}`; break; }
      case "mkMove": { const m = Math.max(1, ab.n || 1) * k, w = ab.mkind === "p" ? " de stats" : ab.mkind === "kw" ? " de mot-clé" : ""; body = `déplace ${m === 1 ? "un marqueur" + w : m + " marqueurs" + w} de ${T()} sur ce serviteur`; break; }
      case "mkRemove": { const m = Math.max(1, ab.n || 1) * k, w = ab.mkind === "p" ? " de stats" : ab.mkind === "kw" ? " de mot-clé" : ""; body = `retire ${m === 1 ? "un marqueur" + w : m + " marqueurs" + w} à ${T()}`; break; }
      case "mkTake": body = (ab.mkeep === "copy" ? `ce serviteur gagne une copie des marqueurs de ${T()}` : ab.mkeep === "eat" ? `détruit ${T()} et gagne tous ses marqueurs` : `ce serviteur prend tous les marqueurs de ${T()}`) + (k > 1 ? ` (marqueurs de stats x${k})` : ""); break;
      case "enemyKw": body = `ce serviteur gagne ${k > 1 ? k + " mots-clés aléatoires" : "un mot-clé aléatoire"} de la troupe adverse${ab.asMk ? (k > 1 ? ", sous forme de marqueurs" : ", sous forme de marqueur") : ""}`; break;
      case "goldRandom": body = `gagne entre 1 et ${Math.max(1, n)} or au hasard`; break;
      case "freeBuy": body = n === 1 ? "votre prochain serviteur coûte 0 or" : `vos ${n} prochains serviteurs coûtent 0 or`; break;
      case "repeatBattlecry": body = "déclenche à nouveau son Cri de guerre"; break;
      case "stealGold": body = `vole ${n} or à votre prochain adversaire (il en reçoit ${n} de moins au prochain tour)`; break;
      case "copyNextOpponent": body = `ajoute ${c === 1 ? "une copie d'un serviteur aléatoire" : c + " copies de serviteurs aléatoires"} de la troupe de votre prochain adversaire à votre main`; break;
      case "tribeShop": body = ab.tribeMode === "main" ? "rafraîchit la taverne avec des serviteurs de votre tribu la plus nombreuse" : "rafraîchit la taverne avec des serviteurs d'une tribu aléatoire"; break;
      case "shuffleBoard": body = "mélange l'ordre de vos serviteurs"; break;
      case "resurrect": body = `invoque ${ck === 1 ? "un serviteur allié" : ck + " serviteurs alliés"} mort${ck > 1 ? "s" : ""} ce combat${ab.a && ab.h ? ` en ${ab.a}/${ab.h}` : ab.h ? ` avec ${ab.h} PV` : ab.a ? ` avec ${ab.a} Attaque` : ""}`; break;
      case "steal": body = `prend le contrôle ${ck === 1 ? "d'un serviteur ennemi aléatoire" : "de " + ck + " serviteurs ennemis aléatoires"}`; break;
      case "shuffleEnemies": body = "mélange la troupe ennemie"; break;
      case "combatGold": body = `gagne ${n} or au prochain tour`; break;
      case "silence": body = `réduit ${T()} au silence`; break;
      case "reposition": body = `déplace ${T()} ${ab.where === "back" ? "tout à droite (attaque en dernier)" : "tout à gauche (attaque en premier)"}`; break;
      case "ruleTriple": body = "deux copies d'un serviteur forment un doré"; break;
      case "ruleDamage": body = n < 0 ? `vous subissez ${-n} dégât${-n > 1 ? "s" : ""} de moins à chaque combat` : `vous subissez ${n} dégât${n > 1 ? "s" : ""} de plus à chaque combat`; break;
      case "sharedPick": { const from = ab.pickTier === "current" ? "son niveau de taverne" : ab.pickTier === "up" ? "un niveau au-dessus du sien" : "n'importe quel niveau"; body = `un joueur choisit 1 serviteur parmi ${ab.count || 3} de ${from}${ab.pct ? ` (chacun a ${ab.pct}% de chances d'être doré)` : ""} et chaque joueur en reçoit une copie`; break; }
      default: body = abilityTextEN(ab, golden, left); // anything new falls back to English rather than vanishing
    }
    if (ab.per && SCALABLE.has(ab.action)) body += perTextFR(ab);
    const f = TN(ab.ftribe || "");
    let pre = ab.trigger === "activate" ? `Activation (${ab.actCost == null ? 1 : ab.actCost}) : ` : (FR_TRIG[ab.trigger] || (() => tr.text(f)))(f);
    if (ab.trigger === "onReach") pre = `Évolution (${ab.at || 1} ${reachStat(ab, "fr")}) : `;
    else if (ab.trigger === "work") pre = `Labeur (${left || ab.at || 1}) : `;
    else if (ab.trigger === "evoFull") { pre = evoPre(ab); const st = evoSrcText(ab); if (st) body += `. Charge : ${st}`; }
    if (ab.trigger === "activate" && ab.every > 1) pre = `Activation (${ab.actCost == null ? 1 : ab.actCost}) : toutes les ${left || ab.every} activation${(left || ab.every) > 1 ? "s" : ""}, `;
    else if (ab.every > 1 && (REPEATABLE.has(ab.trigger) || ab.trigger === "startOfTurn")) {
      const nn = left || ab.every, ev = REPEATABLE.has(ab.trigger) ? everyTextFR(ab.trigger, f, nn) : null;
      pre = ev || pre.replace(/, $/, ab.trigger === "startOfTurn" || ab.trigger === "endOfTurn" ? ` (tous les ${ab.every} tours), ` : ` (toutes les ${ab.every} fois), `);
    }
    if (ab.faff && AFF[ab.faff]) pre = pre.replace(/ ?([,:]) $/, (m0, c) => ` (${AN(ab.faff)} uniquement)${c === ":" ? " :" : ","} `);
    if (ab.minTurn > 1) pre += `à partir du tour ${ab.minTurn}, `;
    if (ab.pcost > 0) pre += ab.pall ? (ab.pcost === 1 ? `en dépensant toute votre ${affMech(affFor("gauge", ab.paff), "fr")}, pour chaque point dépensé, ` : `en dépensant toute votre ${affMech(affFor("gauge", ab.paff), "fr")}, pour chaque tranche de ${ab.pcost}, `) : `en dépensant ${ab.pcost} ${affMech(affFor("gauge", ab.paff), "fr")}, `;
    if (ab.ifTribe) pre += `si vous contrôlez ${frNoun(TN(ab.ifTribe), 1, { other: true })}, `;
    if (ab.minBoard > 0) pre += `si vous contrôlez au moins ${ab.minBoard} serviteurs, `;
    if (ab.ifKw) pre += `si ce serviteur a ${CKW[ab.ifKw] ? CKW[ab.ifKw].name : FR.kw[ab.ifKw] || ab.ifKw}, `;
    if (ab.trigger === "onSignal" || ab.trigger === "onSignalC") pre = pre.replace(/^Quand le signal est envoyé, /, `Quand le signal « ${(ab.sig || "?").trim()} » est envoyé, `);
    pre += modPre(ab, "fr"); body += modPost(ab, "fr");
    if (ab.cond) pre += { alone: "si c'est votre seul serviteur, ", full: "si votre troupe est pleine, ", golden: "si ce serviteur est doré, ", lowHealth: "si votre héros a 10 PV ou moins, ", fed: "si ce serviteur a Dévoré quelque chose, " }[ab.cond] || "";
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const lim = ab.limit === "game" ? " (Une fois par partie.)" : ab.limit === "turn" ? (TRIGGERS[ab.trigger].phase === "combat" ? " (Une fois par combat.)" : " (Une fois par tour.)") : "";
    return ((pre ? (pre.endsWith(": ") ? pre + cap(body) : pre + body) : cap(body)) + "." + lim).replace(/ à les /g, " aux ").replace(/ à le /g, " au ");
  }
  // Names and texts of the built-in content, applied after registerCustom builds the tables (edited names are kept).
  const EN_KW = Object.assign({}, KW_TEXT), EN_KW_INFO = Object.assign({}, KEYWORD_INFO), EN_RARITY = {};
  function localize() {
    const fr = LANG === "fr";
    for (const k in KW_TEXT) KW_TEXT[k] = fr ? FR.kw[k] : EN_KW[k];
    for (const k in KEYWORD_INFO) KEYWORD_INFO[k] = fr ? FR.kwInfo[k] : EN_KW_INFO[k];
    for (const k in RARITY) { if (!EN_RARITY[k]) EN_RARITY[k] = RARITY[k].name; RARITY[k].name = fr ? FR.rarity[k] : EN_RARITY[k]; }
    for (const t of TRIBES) { const i = TRIBE_INFO[t]; if (!i) continue; if (i.name === t && FR.tribes[t]) i.name = fr ? FR.tribes[t] : t; else if (fr === false && i.name === FR.tribes[t]) i.name = t; }
    for (const t of Object.keys(TRIBE_BLURB)) if (BASE_BLURB[t] && (TRIBE_BLURB[t] === BASE_BLURB[t] || TRIBE_BLURB[t] === FR.blurb[t])) TRIBE_BLURB[t] = fr ? FR.blurb[t] || BASE_BLURB[t] : BASE_BLURB[t];
    const swap = (o, base, map) => { if (!o || !base || !map) return; if (o.name === base.name || o.name === map[0]) o.name = fr ? map[0] : base.name; if (base.text != null && (o.text === base.text || o.text === map[1])) o.text = fr && map[1] != null ? map[1] : base.text; if (base.textG && (o.textG === base.textG || o.textG === map[2])) o.textG = fr && map[2] ? map[2] : base.textG; };
    for (const id in CARDS) swap(CARDS[id], BASE_CARDS[id], FR.cards[id]);
    for (const id in TOKENS) swap(TOKENS[id], BASE_TOKENS[id], FR.cards[id]);
    for (const id in SPELLS) swap(SPELLS[id], BASE_SPELLS[id], FR.spells[id]);
    for (const id in HEROES) { const h = HEROES[id], b = DEFAULT_HEROES.find((x) => x.id === id), m = FR.heroes[id]; if (!b || !m) continue; if (h.name === b.name || h.name === m[0]) h.name = fr ? m[0] : b.name; if (h.power.name === b.power.name || h.power.name === m[1]) h.power.name = fr ? m[1] : b.power.name; }
    for (const id in ANOMALIES) { const a = ANOMALIES[id], b = DEFAULT_ANOMALIES.find((x) => x.id === id), m = FR.anomalies[id]; if (!b || !m) continue; if (a.name === b.name || a.name === m) a.name = fr ? m : b.name; }
    for (const k in TRIGGERS) TRIGGERS[k].label = fr && FR.triggerLabels[k] ? FR.triggerLabels[k] : EN_TRIG_LABELS[k];
    for (const k in ACTIONS) ACTIONS[k].label = fr && FR.actionLabels[k] ? FR.actionLabels[k] : EN_ACT_LABELS[k];
    TEXT_CACHE.clear();
  }
  const EN_TRIG_LABELS = {}; for (const k in TRIGGERS) EN_TRIG_LABELS[k] = TRIGGERS[k].label;
  const EN_ACT_LABELS = {}; for (const k in ACTIONS) EN_ACT_LABELS[k] = ACTIONS[k].label;
  const BASE_TOKENS = {}; for (const id in TOKENS) BASE_TOKENS[id] = Object.assign({}, TOKENS[id]);
  function setLang(l) { LANG = l === "fr" ? "fr" : "en"; localize(); }
  const getLang = () => LANG;
  const hasTrig = (m, t) => !!(m.abilities && m.abilities.some((ab) => ab.trigger === t || (ab.trigger === "evoFull" && ab.src === t)));
  // an Evolve's own charge source ("charges after you Devour a Beast"): does this event count?
  function srcOk(ab, src) {
    if (!ab.stribe) return true;
    if (ab.src === "afterDevour") return !!(src && src.lastMeal && hasTribe(src.lastMeal, ab.stribe));
    return !!(src && hasTribe(src, ab.stribe));
  }
  // "Once per turn" / "once per game": holder.lim is replaced (never mutated) so copies made for planning stay apart.
  function limitHit(ab, key, holder, turn) {
    if (!ab.limit) return false;
    const v = holder.lim && holder.lim[key];
    if (ab.limit === "game" ? v != null : v === turn) return true;
    holder.lim = Object.assign({}, holder.lim, { [key]: ab.limit === "game" ? "g" : turn });
    return false;
  }
  // Does this ability fire now? Handles the "only for" filter, "every N times" and "if you control".
  // numeric conditions: "only if its Attack is at least 5", "only if your Rage is exactly 3", "on even turns"
  const SIG = { cur: null }, LAST = { ts: [] }; // LAST.ts: who the latest rule hit, for "the same minions"
  const CHAIN = new Set(["andThen", "orElse", "andThenC", "orElseC"]), CHAIN_THEN = new Set(["andThen", "andThenC"]);
  function whenVal(ab, m, friends, ctx) {
    const p = ctx && ctx.p;
    switch (ab.wWhat) {
      case "attack": return m ? m.attack : null; case "health": return m ? m.health : null;
      case "gold": return p ? p.gold : null; case "hand": return p ? p.hand.length : null; case "tier": return p ? p.tier : null;
      case "board": return friends.filter((o) => o.health > 0).length;
      case "turn": return ctx && ctx.turn != null ? ctx.turn : null; case "heroHealth": return ctx && ctx.health != null ? ctx.health : null;
      case "counter": return m ? (m.vars || {})[ab.wVar || "Charge"] || 0 : null;
      case "pcounter": return p ? (p.vars || {})[ab.wVar || "Charge"] || 0 : m && m._pvars ? m._pvars[ab.wVar || "Charge"] || 0 : null;
      case "enemies": return ctx && ctx.enemies ? ctx.enemies.filter((o) => o.health > 0).length : null;
      case "goldens": return friends.filter((o) => o.health > 0 && o.golden).length;
      case "kin": return m ? friends.filter((o) => o !== m && o.health > 0 && tribesOf(m).some((t) => t !== NEUTRAL && hasTribe(o, t))).length : null;
      case "itsTier": return m ? m.tier || 1 : null;
      case "shop": return p ? p.shop.length : null;
      case "winStreak": return p ? Math.max(0, p.streak || 0) : null;
      case "lossStreak": return p ? Math.max(0, -(p.streak || 0)) : null;
      case "affN": return AFF[ab.wVar] ? affCount(friends, ab.wVar) : null;
      case "affLv": return AFF[ab.wVar] ? lvFor(AFF[ab.wVar], affCount(friends, ab.wVar)) : null;
      case "affs": return AFFS.filter((a) => lvFor(AFF[a], affCount(friends, a)) > 0).length;
      case "spellsHand": return p ? p.hand.filter((o) => o.isSpell).length : null;
      case "spellsTurn": return p ? p.spellsTurn || 0 : null;
      case "frozen": return p ? p.shop.filter((o) => !o.isSpell && (o.ice || p.frozen)).length : ctx && ctx.enemies ? ctx.enemies.filter((o) => o.health > 0 && o.chill > 0).length : null;
    }
    return null;
  }
  function whenOk(ab, m, friends, ctx) {
    if (ab.wWhat === "turnEven" || ab.wWhat === "turnOdd") { const t = ctx && ctx.turn; return t != null && (t % 2 === 0) === (ab.wWhat === "turnEven"); }
    const v = whenVal(ab, m, friends, ctx); if (v == null) return false; const n = ab.wN || 0;
    return ab.wCmp === "<=" ? v <= n : ab.wCmp === "=" ? v === n : v >= n;
  }
  function gate(ab, i, m, src, friends, counters, ctx) {
    if ((ab.trigger === "onSignal" || ab.trigger === "onSignalC") && (ab.sig || "").trim().toLowerCase() !== (SIG.cur || "").toLowerCase()) return false;
    if (ab.wWhat && !whenOk(ab, m, friends, ctx)) return false;
    if (ab.w2What && !whenOk({ wWhat: ab.w2What, wCmp: ab.w2Cmp, wN: ab.w2N, wVar: ab.w2Var }, m, friends, ctx)) return false;
    // a price to pay: Health or Attack of this minion (never down to 0), or gold in the tavern
    if (ab.payWhat && ab.payN > 0) {
      const P = ab.payN, pp = ctx && ctx.p;
      if (ab.payWhat === "health" ? !(m && m.health > P) : ab.payWhat === "attack" ? !(m && m.attack >= P) : ab.payWhat === "gold" ? !(pp && pp.gold >= P) : false) return false;
    }
    if (ab.ftribe && ab.trigger === "afterDevour") { if (!src || !src.lastMeal || !hasTribe(src.lastMeal, ab.ftribe)) return false; }
    else if (ab.ftribe && (!src || !hasTribe(src, ab.ftribe))) return false;
    if (ab.faff && (!src || !hasAff(src, ab.faff))) return false;
    if (ab.minTurn > 1 && ctx && ctx.turn != null && ctx.turn < ab.minTurn) return false;
    if (ab.cond === "lowHealth" && !(ctx && ctx.health != null && ctx.health <= 10)) return false;
    if (ab.ifTribe && !friends.some((o) => o !== m && o.health > 0 && hasTribe(o, ab.ifTribe))) return false;
    if (ab.minBoard > 0 && friends.filter((o) => o.health > 0).length < ab.minBoard) return false;
    if (ab.ifKw && !hasKw(m, ab.ifKw)) return false;
    if (ab.cond === "alone" && friends.some((o) => o !== m && o.health > 0)) return false;
    if (ab.cond === "full" && friends.filter((o) => o.health > 0).length < BOARD_MAX) return false;
    if (ab.cond === "golden" && !(m && m.golden)) return false;
    if (ab.cond === "fed" && !(m && m.fed > 0)) return false;
    if (ab.every > 1 && REPEATABLE.has(ab.trigger)) {
      const key = i + ":" + ab.trigger;
      counters[key] = (counters[key] || 0) + 1;
      if (counters[key] % ab.every !== 0) return false;
    }
    // at most N times (per minion; in combat, per fight)
    if (ab.cool > 0) { const ck = "cd" + i + ab.trigger; if ((counters[ck] || 0) > 0) { counters[ck]--; return false; } counters[ck] = ab.cool; }
    if (ab.uses > 0) { const uk = "u" + i + ab.trigger; if ((counters[uk] || 0) >= ab.uses) return false; counters[uk] = (counters[uk] || 0) + 1; }
    // grows each time: how many times it fired before, for the amount
    if (ab.grow > 0) { const gk = "g" + i + ab.trigger; if (m) m._growN = counters[gk] || 0; counters[gk] = (counters[gk] || 0) + 1; }
    if (ab.payWhat && ab.payN > 0) { const P = ab.payN; if (ab.payWhat === "health" && m) { m.health -= P; } else if (ab.payWhat === "attack" && m) m.attack = Math.max(0, m.attack - P); else if (ab.payWhat === "gold" && ctx && ctx.p) ctx.p.gold -= P; }
    // "spend N": a counter condition that pays for the effect
    if (ab.wSpend && ab.wN > 0 && (ab.wWhat === "counter" || ab.wWhat === "pcounter") && (ab.wCmp || ">=") === ">=") {
      const bag = ab.wWhat === "counter" ? m && m.vars : ctx && ctx.p ? ctx.p.vars : m && m._pvars; const nm = ab.wVar || "Charge";
      if (bag) bag[nm] = (bag[nm] || 0) - ab.wN;
    }
    return true;
  }
  function scale(ab, m, friends, enemies, p, turn) {
    if (!ab.per || !SCALABLE.has(ab.action)) return 1;
    if (ab.per === "devours") return p ? p.devours || 0 : 0;
    if (ab.per === "gold") return p ? p.gold || 0 : 0;
    if (ab.per === "fed") return m ? m.fed || 0 : 0;
    if (ab.per === "played") return p ? (ab.perTribe ? (p.playedT && p.playedT[ab.perTribe]) || 0 : p.played || 0) : 0;
    if (ab.per === "playedTurn") return p ? (ab.perTribe ? (p.playedTurnT && p.playedTurnT[ab.perTribe]) || 0 : p.playedTurn || 0) : 0;
    if (ab.per === "spells") return p ? p.spellsCast || 0 : 0;
    if (ab.per === "spellsTurn") return p ? p.spellsTurn || 0 : 0;
    if (ab.per === "sold") return p ? p.sold || 0 : 0;
    if (ab.per === "bought") return p ? p.bought || 0 : 0;
    if (ab.per === "turn") return turn || (p && p.game ? p.game.turn : 0) || 0;
    if (ab.per === "attack") return m ? m.attack : 0;
    if (ab.per === "health") return m ? Math.max(0, m.health) : 0;
    if (ab.per === "counter") return m ? Math.max(0, (m.vars || {})[ab.perVar || "Charge"] || 0) : 0;
    if (ab.per === "pcounter") return p ? Math.max(0, (p.vars || {})[ab.perVar || "Charge"] || 0) : m && m._pvars ? Math.max(0, m._pvars[ab.perVar || "Charge"] || 0) : 0;
    if (ab.per === "foundations") return m ? (m.foundN >= 0 ? m.foundN : p && p.found && p.board ? p.found[p.board.indexOf(m)] || 0 : 0) : 0;
    if (ab.per === "aff") return AFF[ab.perVar] ? affCount(friends, ab.perVar) : 0;
    if (ab.per === "spellsHand") return p ? p.hand.filter((o) => o.isSpell).length : 0;
    if (ab.per === "frozen") return p && p.shop ? p.shop.filter((o) => !o.isSpell && (o.ice || p.frozen)).length : (enemies || []).filter((o) => o.health > 0 && o.chill > 0).length;
    if (ab.per === "affs") return AFFS.filter((a) => lvFor(AFF[a], affCount(friends, a)) > 0).length;
    if (ab.per === "pressure") return p && p.gauges ? p.gauges[affFor("gauge", ab.gaff || ab.paff, m)] || 0 : 0;
    const pool = ab.per === "enemy" ? enemies : friends.filter((o) => o !== m);
    return pool.filter((o) => o.health > 0 && (!ab.perTribe || hasTribe(o, ab.perTribe))).length;
  }
  function randomCardId(rng, tier, tribe, not) {
    const ids = Object.keys(CARDS).filter((id) => id !== not && (!tier || CARDS[id].tier === +tier) && (!tribe || hasTribe(CARDS[id], tribe)));
    return ids.length ? rng.pick(ids) : "";
  }
  function pickN(rng, arr, n) { const a = [...arr], out = []; while (out.length < n && a.length) out.push(a.splice(rng.int(0, a.length - 1), 1)[0]); return out; }
  // the minions a "you choose" target may pick from
  function pickPool(target, self, friends, ctx) {
    if (target === "pickFriend") return friends.filter((o) => o !== self && o.health > 0);
    if (target === "pickAny") return friends.filter((o) => o.health > 0);
    if (target === "pickShop") return ctx && ctx.shop ? ctx.shop.filter((o) => !o.isSpell) : [];
    if (target === "pickHand") return ctx && ctx.hand ? ctx.hand.filter((o) => !o.isSpell) : [];
    return [];
  }
  function abilityTargets(ab, self, friends, enemies, src, rng, ctx) {
    const tf = (o) => (!ab.ttribe || hasTribe(o, ab.ttribe)) && (!ab.tkw || hasKw(o, ab.tkw)) && (!ab.taff || hasAff(o, ab.taff)) && (!ab.tmk || mkN(o) > 0) && (!ab.ttok || (ab.ttok === "no" ? !o.token : !!o.token));
    const others = friends.filter((o) => o !== self && o.health > 0 && tf(o));
    const mine = friends.filter((o) => o.health > 0 && tf(o));
    const foes = enemies.filter((e) => e.health > 0 && tf(e));
    const n = Math.max(1, ab.count || 1), size = (o) => o.attack + o.health;
    const ext = (o, v) => (!o.length ? [] : [v === "min" ? o.reduce((a, b) => (size(b) < size(a) ? b : a)) : o.reduce((a, b) => (size(b) > size(a) ? b : a))]);
    switch (ab.target) {
      case "previous": return (LAST.ts || []).filter((o) => o.health > 0 && tf(o));
      case "self": return self ? [self] : [];
      case "randomFriend": return pickN(rng, others, n);
      case "allFriends": return others;
      case "allFriendsSelf": return mine;
      case "randomFriendSelf": return pickN(rng, mine, n);
      case "leftOf": { const i = friends.indexOf(self); return i > 0 && friends[i - 1].health > 0 && tf(friends[i - 1]) ? [friends[i - 1]] : []; }
      case "rightOf": { const i = friends.indexOf(self); return i >= 0 && friends[i + 1] && friends[i + 1].health > 0 && tf(friends[i + 1]) ? [friends[i + 1]] : []; }
      case "kin": return self ? others.filter((o) => sharesTribe(o, self)) : [];
      case "weakestFriend": return ext(others, "min");
      case "strongestFriend": return ext(others, "max");
      case "weakestEnemy": return ext(foes.filter((e) => !e.stealth), "min");
      case "strongestEnemy": return ext(foes.filter((e) => !e.stealth), "max");
      case "frontEnemy": return foes.slice(0, 1);
      case "backEnemy": return foes.slice(-1);
      case "allMinions": return mine.concat(foes);
      case "pickFriend": case "pickAny": case "pickShop": case "pickHand": {
        const pool = pickPool(ab.target, self, friends, ctx).filter(tf);
        if (ab._pick != null) return pool.filter((o) => o.uid === ab._pick);
        return ctx && ctx.tavern ? [] : pickN(rng, pool, 1); // in combat (no choice possible) a random one
      }
      case "tribeMost": { const cnt = {}; for (const o of friends) for (const t of tribesOf(o)) cnt[t] = (cnt[t] || 0) + 1; const best = Object.keys(cnt).sort((x, y) => cnt[y] - cnt[x])[0]; return best ? others.filter((o) => hasTribe(o, best)) : []; }
      case "newest": { const l = others.filter((o) => o.playedAt); return l.length ? [l.reduce((a, b) => (b.playedAt > a.playedAt ? b : a))] : []; }
      case "oldest": { const l = others.filter((o) => o.playedAt); return l.length ? [l.reduce((a, b) => (b.playedAt < a.playedAt ? b : a))] : []; }
      case "shopAll": return ctx && ctx.shop ? ctx.shop.filter((o) => !o.isSpell && tf(o)) : [];
      case "shopRandom": return ctx && ctx.shop ? pickN(rng, ctx.shop.filter((o) => !o.isSpell && tf(o)), n) : [];
      case "shopFrozen": return ctx && ctx.shop ? ctx.shop.filter((o) => !o.isSpell && (o.ice || ctx.shopFrozen) && tf(o)) : [];
      case "frozenEnemies": return enemies.filter((e) => e.health > 0 && e.chill > 0 && tf(e));
      case "handAll": return ctx && ctx.hand ? ctx.hand.filter((o) => !o.isSpell && tf(o)) : [];
      case "handRandom": return ctx && ctx.hand ? pickN(rng, ctx.hand.filter((o) => !o.isSpell && tf(o)), n) : [];
      case "buffers": return others.filter(givesStats);
      case "adjacent": { const i = friends.indexOf(self); return i < 0 ? [] : [friends[i - 1], friends[i + 1]].filter((o) => o && o.health > 0 && tf(o)); }
      case "leftmost": return others.slice(0, n);
      case "rightmost": return others.slice(-n);
      case "tokens": return mine.filter((o) => o.token);
      case "randomToken": return pickN(rng, mine.filter((o) => o.token), n);
      case "trigger": case "chosen": return src && (src.health > 0 || ab.action === "summonCopy" || ab.action === "mkTake") && tf(src) ? [src] : [];
      case "randomEnemy": return pickN(rng, enemies.filter((e) => e.health > 0 && !e.stealth && tf(e)), n);
      case "allEnemies": return enemies.filter((e) => e.health > 0 && tf(e));
      case "colony": return colonyOf(friends, ctx && ctx.coral || 0, self).filter((o) => o.health > 0 && tf(o));
      case "foundationMinions": return mine.filter((o) => ctx && ctx.foundAt && ctx.foundAt(o) > 0);
    }
    return [];
  }

  // ---------------------------------------------------------------- RNG
  function makeRng(seed) {
    let s = (seed >>> 0) || 1;
    const next = () => {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return { next, int: (a, b) => a + Math.floor(next() * (b - a + 1)), pick: (arr) => arr[Math.floor(next() * arr.length)] };
  }

  // ---------------------------------------------------------------- Minion & Spell
  let nextUid = 1;
  const HOOKS = ["deathrattle", "battlecry", "onSummonAlly", "onAllyDeath", "endOfTurn", "startOfCombat", "onShieldLost", "onReborn", "onSell", "onBuy", "onAttack", "onPlayOther", "onSpell", "onDevour"];
  // Ids: while a player's tavern action runs, new cards take ids from that player's own stream, so two
  // people acting at once number their cards the same way on both ends of an online game. Outside
  // actions (start of turn, bots, combat) the shared counter is used; previews never touch either.
  let uidCtx = null;
  const PREVIEW_CTX = { uidBase: -1e9, uidN: 0 };
  const newUid = () => (uidCtx ? uidCtx.uidBase + uidCtx.uidN++ : nextUid++);
  function withUids(ctx, fn) { const prev = uidCtx; uidCtx = ctx; try { return fn(); } finally { uidCtx = prev; } }
  class Minion {
    // a card drawn for a dialog or the editor: it must not shift the id sequence of the real game
    static preview(id, golden = false) { return withUids(PREVIEW_CTX, () => new Minion(id, golden)); }
    constructor(id, golden = false) {
      this.uid = newUid();
      // declared up front so every minion shares one hidden class (these are set later by effects)
      this.lim = null; this.tctr = null; this.granted = null; this.isCopy = false; this.poolCost = null; this.silenced = false; this.fed = 0;
      this.actTurn = 0; this.boostA = 0; this.boostH = 0; this.dodge = false; this.ice = false; this.chill = 0;
      this.evo = 0; this.evoLv = 0; this.evoDone = false; this.muts = null; this.wounds = 0; this.rested = false; this.aff = []; this.mired = 0; this.slotIx = -1; this.foundN = -1; this.ckw = []; this.mk = null; // Evolution crystal: charge, times evolved, done (not repeatable), mutation names
      if (!id) return;
      const d = def(id);
      const m = golden ? 2 : 1, g = golden ? goldOf(d) : null;
      Object.assign(this, {
        cardId: id, name: d.name, tribe: d.tribe, tribes: d.tribes ? d.tribes.slice() : d.tribe ? [d.tribe] : [], allTribes: !!d.allTribes, tier: d.tier, golden, token: !!d.token || d.inPool === false,
        attack: g && g.attack != null ? g.attack : d.attack * m, health: g && g.health != null ? g.health : d.health * m, maxHealth: g && g.health != null ? g.health : d.health * m,
        taunt: !!d.taunt, shield: !!d.shield, reborn: !!d.reborn, windfury: !!d.windfury, venomous: !!d.venomous, cleave: !!d.cleave, stealth: !!d.stealth, magnetic: !!d.magnetic, rally: !!d.rally, tough: !!d.tough, flying: !!d.flying,
        attackFx: d.attackFx || "", rarity: d.rarity || "common",
        chanter: !d.noBuiltIn && !!d.chanter, maw: !d.noBuiltIn && !!d.maw,
        abilities: g && g.abilities ? goldAbilities(g) : withLegacyEvolve(d), actN: 0, aff: affList(d), ckw: (d.ckw || []).filter((k) => CKW[k]),
      });
      if (this.ckw.length) this.abilities = this.abilities.concat(...this.ckw.map(kwAbilities));
      if (AFF_ON) for (const a of this.aff) if (AFF[a] && AFF[a].carry && AFF[a].carry.length) this.abilities = this.abilities.concat(affAbilities(a));
      for (const h of HOOKS) this[h] = d.noBuiltIn ? "" : d[h] || "";
      mkStart(this, d);
    }
    mult() { return this.golden ? 2 : 1; }
    setTribe(t) { this.tribe = t || ""; this.tribes = t ? [t] : []; this.allTribes = false; }
    n() { return (def(this.cardId).n || 0) * this.mult(); }
    hasBattlecry() { return !!this.battlecry || hasTrig(this, "battlecry"); }
    baseAttack() { const d = def(this.cardId), g = this.golden ? goldOf(d) : null; return (g && g.attack != null ? g.attack : d.attack * this.mult()); }
    baseHealth() { const d = def(this.cardId), g = this.golden ? goldOf(d) : null; return (g && g.health != null ? g.health : d.health * this.mult()); }
    buff(a, h) {
      this.attack += a; this.health += h; this.maxHealth += h;
    }
    clone(keepUid = true) {
      // Explicit copy in a fixed order: one hidden class for every minion, no per-property shape transitions.
      const c = new Minion();
      c.uid = keepUid ? this.uid : c.uid;
      c.cardId = this.cardId; c.name = this.name; c.tribe = this.tribe; c.tribes = this.tribes; c.allTribes = this.allTribes; c.tier = this.tier; c.golden = this.golden; c.token = this.token;
      c.attack = this.attack; c.health = this.health; c.maxHealth = this.maxHealth;
      c.taunt = this.taunt; c.shield = this.shield; c.reborn = this.reborn; c.windfury = this.windfury; c.venomous = this.venomous; c.cleave = this.cleave; c.stealth = this.stealth; c.magnetic = this.magnetic; c.rally = this.rally; c.tough = this.tough; c.flying = this.flying; c.silenced = this.silenced; c.actTurn = this.actTurn; c.boostA = this.boostA; c.boostH = this.boostH; c.evolveAt = this.evolveAt; c.evolveInto = this.evolveInto;
      c.attackFx = this.attackFx; c.rarity = this.rarity; c.chanter = this.chanter; c.maw = this.maw; c.abilities = this.abilities;
      for (const h of HOOKS) c[h] = this[h];
      c.lim = this.lim; c.tctr = this.tctr; c.granted = this.granted; c.isCopy = this.isCopy; c.poolCost = this.poolCost; c.fed = this.fed; c.actN = this.actN; c.reached = this.reached; c.eaten = this.eaten; c.lastMeal = this.lastMeal; c.playedAt = this.playedAt;
      c.evo = this.evo; c.evoLv = this.evoLv; c.evoDone = this.evoDone; c.evoReady = this.evoReady; c.vars = this.vars ? Object.assign({}, this.vars) : null; c.muts = this.muts; c.wounds = this.wounds; c.rested = this.rested;
      c.aff = this.aff; c.mired = this.mired; c.slotIx = this.slotIx; c.foundN = this.foundN; c.ckw = this.ckw; c.mk = mkCopy(this.mk);
      return c;
    }
    text() {
      const extra = (this.granted || []).filter((ab) => !ab._kw && !ab._aff).map((ab) => abilityText(ab, this.golden));
      // counting abilities show how many triggers are left ("After you buy 3 Murlocs" after two of five)
      const live = !def(this.cardId).customText && (this.tctr && (this.abilities || []).some((ab, i) => ab.every > 1 && this.tctr[i + ":" + ab.trigger]) || (this.actN > 0 && (this.abilities || []).some((ab) => ab.trigger === "work")));
      const base = live ? [builtInText(def(this.cardId), this.golden), ...this.abilities.map((ab, i) => (this.granted || []).includes(ab) || ab._kw || ab._aff ? "" : abilityText(ab, this.golden, ab.trigger === "work" ? Math.max(1, (ab.at || 1) - (this.actN || 0)) : ab.every > 1 ? ab.every - (((this.tctr || {})[i + ":" + ab.trigger] || 0) % ab.every) : 0))].filter(Boolean).join(" ") : cardText(this.cardId, this.golden);
      return [base, ...extra].filter(Boolean).join(" ");
    }
    keywords() { return KW_LIST.filter(k => this[k]); }
    // { at, stat, into } of the first Evolve that has not fired yet, else null
    evolveInfo() {
      const i = (this.abilities || []).findIndex((ab, k) => ab.trigger === "onReach" && !(this.reached && this.reached[k])); if (i < 0) return null;
      const ab = this.abilities[i]; return { at: ab.at || 1, stat: ab.stat === "health" ? "health" : ab.stat === "attack" ? "attack" : "either", into: ab.action === "evolve" ? (ab.cards && ab.cards.length >= 2 ? "" : ab.card) : "", choice: ab.action === "evolve" && ab.cards && ab.cards.length >= 2 ? ab.cards.length : 0 };
    }
    // the Evolution crystal: { have, need, done, lv, rep, how, what, muts } or null when nothing evolves
    evoGauge() {
      const abs = (this.abilities || []).filter((ab) => ab.trigger === "evoFull");
      if (!abs.length) return this.muts && this.muts.length ? { have: 0, need: 0, done: true, lv: this.evoLv || 0, rep: false, how: [], what: [], muts: this.muts.slice(), none: true } : null;
      const f = abs[0], need = Math.max(1, (f.at || 3) + (f.rep ? (f.inc || 0) * (this.evoLv || 0) : 0));
      const how = abs.map(evoSrcText).filter(Boolean).concat((this.abilities || []).filter((ab) => ab.action === "charge" && (!ab.target || ab.target === "self") && ab.trigger !== "evoFull").map((ab) => abilityText(ab, this.golden).replace(/[.:,]?\s*(charge its Evolution by|charge son Évolution de) \d+\.?$/i, "").replace(/[,:]\s*$/, "")));
      const what = abs.map((ab) => abilityText(Object.assign({}, ab, { src: "" }), this.golden).replace(/^[^:]+:\s*/, ""));
      return { have: this.evoDone ? need : Math.min(need, this.evo || 0), need, done: !!this.evoDone, lv: this.evoLv || 0, rep: !!f.rep, how, what, muts: (this.muts || []).slice(), golden: !!this.golden };
    }
    // { cost } when this minion has an Activate effect, else null
    activation() {
      const i = (this.abilities || []).findIndex((x) => x.trigger === "activate"); if (i < 0) return null;
      const ab = this.abilities[i], w = this.abilities.find((x) => x.trigger === "work" && x.at > 0), work = w ? w.at : 0;
      return { cost: ab.actCost == null ? 1 : ab.actCost, work, done: work ? Math.min(work, this.actN || 0) : 0 };
    }
    // a silenced minion keeps its stats and nothing else
    silence() { for (const k of KW_LIST) this[k] = false; this.ckw = []; this.abilities = []; this.granted = null; this.chanter = false; this.maw = false; for (const h of HOOKS) this[h] = ""; this.silenced = true; }
    dict() {
      return {
        uid: this.uid, cardId: this.cardId, name: this.name, tribe: this.tribe, tribes: tribesOf(this).slice(), allTribes: !!this.allTribes, tribeLabel: tribeLabel(this), tier: this.tier,
        attack: this.attack, health: this.health, maxHealth: this.maxHealth,
        baseAttack: this.baseAttack(), baseHealth: this.baseHealth(), golden: this.golden, token: this.token,
        taunt: this.taunt, shield: this.shield, reborn: this.reborn, windfury: this.windfury, venomous: this.venomous, cleave: !!this.cleave, stealth: !!this.stealth, magnetic: !!this.magnetic, rally: !!this.rally, tough: !!this.tough, flying: !!this.flying, silenced: !!this.silenced, rarity: this.rarity || "common", mk: this.mk && mkN(this) ? { st: Object.assign({}, mkSt(this)), kw: mkKws(this) } : null,
        activate: this.activation(), actTurn: this.actTurn, vars: this.vars && Object.keys(this.vars).length ? Object.assign({}, this.vars) : null, evoReady: !!this.evoReady, ice: !!this.ice, chill: this.chill || 0, aff: affsOf(this).slice(), mired: this.mired || 0, ckw: (this.ckw || []).filter((k) => CKW[k]).map((k) => ({ id: k, name: CKW[k].name, color: CKW[k].color, icon: CKW[k].icon, tip: CKW[k].tip || CKW[k].abilities.map((ab) => abilityText(ab, this.golden)).join(" ") })), evolve: this.evolveInfo(), gauge: this.evoGauge(), wounds: this.wounds || 0,
        deathrattle: !!this.deathrattle || hasTrig(this, "deathrattle"), soc: !!this.startOfCombat || hasTrig(this, "startOfCombat"), text: this.silenced ? "" : this.text(), keywords: this.keywords(),
      };
    }
  }
  class Spell {
    constructor(id) {
      const d = SPELLS[id];
      const text = d.custom ? (d.customText || (d.abilities || []).map((ab) => abilityText(ab, false)).join(" ")) : d.text;
      Object.assign(this, { uid: newUid(), spellId: id, isSpell: true, name: d.name, tier: d.tier, cost: d.cost, target: d.target, text, custom: !!d.custom });
    }
    dict() { return { uid: this.uid, spellId: this.spellId, isSpell: true, name: this.name, tier: this.tier, cost: this.cost, target: this.target, text: this.text }; }
  }

  // ---------------------------------------------------------------- Combat
  const BOARD_MAX = 7;

  class Combat {
    // relay (Duos): { boards: [boardA2, boardB2], tiers: [..], prep: [..] } - when a side's warband falls,
    // its partner's warband steps in and the fight goes on.
    simulate(...args) { return this.simulateInner(...args); }
    simulateInner(boardA, boardB, tierA, tierB, rng, damageCap = Infinity, prep = [null, null], relay = null, ctx = null) {
      this.rng = rng || makeRng(Math.floor(Math.random() * 1e9));
      this.ctx = ctx; // { turn, health: [a, b] } for "from turn N" and "if your hero is low" conditions
      this.dead = [[], []]; this.goldNext = [];
      this.perm = [];
      this.relay = relay; this.slot = [0, 0]; this.tierNow = [tierA, tierB];
      this.sides = [boardA.map(m => m.clone(true)), boardB.map(m => m.clone(true))];
      // your own counters (player scope) can be read and changed during the fight; the change lasts for the fight
      this.pvars = [0, 1].map((k) => { const pl = ctx && ctx.players && ctx.players[k]; const bag = Object.assign({}, (pl && pl.vars) || {}); for (const o of this.sides[k]) o._pvars = bag; return bag; });
      this.pools = {}; this.poolOwner = {};
      for (const s of [0, 1]) this.affInit(s, ctx && ctx.players ? ctx.players[s] : null);
      this.events = [];
      this.attacked = new Set();
      const [a, b] = this.sides;
      const first = a.length > b.length ? 0 : b.length > a.length ? 1 : this.rng.int(0, 1);
      this.log("start", { first });
      // effects bought with tavern spells for this fight ("next combat: ...")
      for (const s of [0, 1]) {
        const pr = prep && prep[s];
        if (!pr) continue;
        this.prepExtras(s, pr);
        if ((pr.a || pr.h) && this.sides[s].length) {
          this.sides[s].forEach((m) => m.buff(pr.a, pr.h));
          this.log("buff", { side: s, source: -1, hero: s, uids: this.sides[s].map((m) => m.uid), a: pr.a, h: pr.h, label: "Rallied" });
        }
        for (const st of pr.strikes || []) {
          const foes = this.sides[1 - s].filter((e) => e.health > 0);
          const ts = st.all ? foes : pickN(this.rng, foes.filter((e) => !e.stealth), st.count || 1);
          const hits = ts.map((t) => this.damage(t, st.n, false)).filter(Boolean);
          if (hits.length) { this.curFx = st.fx || ""; this.log("shoot", { side: s, source: -1, hero: s, hits }); this.curFx = ""; this.afterHits(hits); }
          this.resolveDeaths(s);
        }
      }

      // Rally: strength in numbers, before any Start of Combat effect
      for (const s of [first, 1 - first]) {
        for (const m of this.sides[s]) {
          if (!m.rally) continue;
          const n = this.sides[s].filter((o) => o !== m && o.health > 0 && sharesTribe(m, o)).length * m.mult();
          if (n > 0) { m.buff(n, n); this.log("buff", { side: s, source: m.uid, uids: [m.uid], a: n, h: n, label: "Rally" }); }
        }
      }
      // Bonus affinities: their minions grow before the fight
      for (const s of [first, 1 - first]) this.affBonus(s);
      for (const s of [first, 1 - first]) {
        for (const m of [...this.sides[s]]) {
          if ((m.startOfCombat || hasTrig(m, "startOfCombat")) && this.sides[s].includes(m)) {
            const socTimes = 1 + passive(this.sides[s], "extraStartOfCombat");
            for (let rep = 0; rep < socTimes && this.sides[s].includes(m); rep++) {
              if (m.startOfCombat) this.startOfCombat(s, m);
              this.runAb(s, m, "startOfCombat");
            }
            this.resolveDeaths(s);
          }
        }
      }

      let turn = first, attacks = 0;
      for (;;) {
      while (this.sides[0].length && this.sides[1].length && attacks < 400) {
        const att = this.nextAttacker(turn);
        if (!att) {
          if (!this.nextAttacker(1 - turn)) break;
          turn = 1 - turn; continue;
        }
        if (att.chill > 0) { att.chill--; this.attacked.add(att.uid); this.log("thaw", { side: turn, uids: [att.uid], left: att.chill }); attacks++; turn = 1 - turn; continue; }
        const swings = att.windfury ? 2 : 1;
        for (let i = 0; i < swings; i++) {
          if (!this.sides[turn].includes(att) || !this.sides[1 - turn].length || att.attack <= 0) break;
          const target = this.pickTarget(1 - turn, att);
          this.attack(turn, att, target, i === 1);
          this.resolveDeaths(turn);
          attacks++;
        }
        this.attacked.add(att.uid);
        turn = 1 - turn;
      }
      // Duos: a fallen warband is replaced by the partner's
      if (!this.relay || attacks >= 400) break;
      const fresh = [0, 1].filter((s) => !this.sides[s].length && this.slot[s] === 0 && this.relay.boards[s] && this.relay.boards[s].length);
      if (!fresh.length) break;
      for (const s of fresh) this.enter(s);
      if (!this.sides[0].length || !this.sides[1].length) {
        // the other side may be empty too and still have someone waiting
        const more = [0, 1].filter((s) => !this.sides[s].length && this.slot[s] === 0 && this.relay.boards[s] && this.relay.boards[s].length);
        for (const s of more) this.enter(s);
        if (!this.sides[0].length || !this.sides[1].length) break;
      }
      turn = fresh.length === 1 ? fresh[0] : this.rng.int(0, 1);
      }

      let winner = -1;
      if (this.sides[0].length && !this.sides[1].length) winner = 0;
      else if (this.sides[1].length && !this.sides[0].length) winner = 1;
      let damage = 0;
      const survivors = winner >= 0 ? this.sides[winner] : [];
      if (winner >= 0) damage = Math.min(damageCap, this.tierNow[winner] + survivors.reduce((t, m) => t + m.tier, 0));
      this.log("end", { winner, damage, survivors: survivors.map(m => m.uid), heroTier: winner >= 0 ? this.tierNow[winner] : 0, tiers: survivors.map((m) => m.tier), capped: winner >= 0 && damage < this.tierNow[winner] + survivors.reduce((t, m) => t + m.tier, 0) });
      const pressure = Object.keys(this.pools).map((k) => { const [base, a] = k.split("|"), pl = this.poolOwner[base]; return pl && (pl.gauges[a] || 0) !== this.pools[k] ? [pl, a, this.pools[k]] : null; }).filter(Boolean);
      return { winner, damage, events: this.events, survivors, perm: this.perm, heroDmg: this.heroDmg || [0, 0], used: this.usedOnce || [], slot: this.slot.slice(), goldNext: this.goldNext, pressure };
    }
    // hero / anomaly start-of-combat tricks: swap everyone's stats, random keywords
    prepExtras(s, pr) {
      const side = this.sides[s];
      if (!side.length) return;
      if (pr.swap) {
        const l = side.filter((x) => x.attack > 0);
        l.forEach((x) => { [x.attack, x.health] = [x.health, x.attack]; x.maxHealth = Math.max(x.maxHealth, x.health); });
        if (l.length) this.log("buff", { side: s, source: -1, hero: s, uids: l.map((x) => x.uid), a: 0, h: 0, label: "Swapped" });
      }
      for (let i = 0; i < (pr.kw || 0); i++) {
        const t = this.rng.pick(side); if (!t) break;
        const opts = KW_RANDOM_COMBAT.filter((x) => !t[x]); if (!opts.length) continue;
        const kw = this.rng.pick(opts); t[kw] = true;
        this.log("buff", { side: s, source: -1, hero: s, uids: [t.uid], a: 0, h: 0, label: KW_TEXT[kw] });
      }
    }
    // the partner's warband steps in: its hero's start-of-combat power and Start of Combat effects fire now
    enter(s) {
      this.slot[s] = 1;
      this.tierNow[s] = this.relay.tiers[s];
      this.sides[s] = this.relay.boards[s].map((m) => m.clone(true));
      this.affInit(s, this.ctx && this.ctx.relayPlayers ? this.ctx.relayPlayers[s] : null);
      this.affBonus(s);
      this.log("relay", { side: s });
      const pr = this.relay.prep && this.relay.prep[s];
      if (pr) {
        this.prepExtras(s, pr);
        if ((pr.a || pr.h) && this.sides[s].length) {
          this.sides[s].forEach((m) => m.buff(pr.a, pr.h));
          this.log("buff", { side: s, source: -1, hero: s, uids: this.sides[s].map((m) => m.uid), a: pr.a, h: pr.h, label: "Rallied" });
        }
        for (const st of pr.strikes || []) {
          const foes = this.sides[1 - s].filter((e) => e.health > 0);
          const ts = st.all ? foes : pickN(this.rng, foes.filter((e) => !e.stealth), st.count || 1);
          const hits = ts.map((t) => this.damage(t, st.n, false)).filter(Boolean);
          if (hits.length) { this.curFx = st.fx || ""; this.log("shoot", { side: s, source: -1, hero: s, hits }); this.curFx = ""; this.afterHits(hits); }
          this.resolveDeaths(s);
        }
      }
      for (const m of [...this.sides[s]]) {
        if ((m.startOfCombat || hasTrig(m, "startOfCombat")) && this.sides[s].includes(m)) {
          const socTimes = 1 + passive(this.sides[s], "extraStartOfCombat");
          for (let rep = 0; rep < socTimes && this.sides[s].includes(m); rep++) {
            if (m.startOfCombat) this.startOfCombat(s, m);
            this.runAb(s, m, "startOfCombat");
          }
          this.resolveDeaths(s);
        }
      }
    }

    // affinities for a warband entering the fight: levels from its starting board, Foundations under each slot, its Pressure
    affInit(s, pl) {
      (this.affS = this.affS || [null, null])[s] = affState(this.sides[s]);
      this.sides[s].forEach((m, i) => { m.slotIx = i; m.foundN = pl && pl.found ? pl.found[i] || 0 : 0; });
      const key = s + ":" + (this.slot ? this.slot[s] : 0); this.poolKey = this.poolKey || [null, null]; this.poolKey[s] = key;
      if (!(key in this.poolOwner)) this.poolOwner[key] = pl || null;
    }
    // a side's pool for a gauge affinity (read from its player the first time)
    pool(s, a) { const k = this.poolKey[s] + "|" + a; if (this.pools[k] == null) { const pl = this.poolOwner[this.poolKey[s]]; this.pools[k] = pl && pl.gauges ? pl.gauges[a] || 0 : 0; } return k; }
    affBonus(s) {
      for (const a of AFFS) {
        const kind = AFF[a].kind, lv = this.lvOf(s, a), v = affVal(a, lv);
        if (lv > 0) this.affStartFx(s, a, lv);
        if (v <= 0 || !["bonus", "ward", "unity", "strike", "aura"].includes(kind)) continue;
        const ts = this.sides[s].filter((m) => m.health > 0 && hasAff(m, a)); if (!ts.length) continue;
        if (kind === "bonus") {
          const [ba, bh] = statAH(a, v); ts.forEach((m) => m.buff(ba, bh));
          this.log("buff", { side: s, source: -1, hero: s, uids: ts.map((m) => m.uid), a: ba, h: bh, label: affMech(a, "en") });
        } else if (kind === "unity") {
          const n = (ts.length - 1) * v; if (n <= 0) continue;
          ts.forEach((m) => m.buff(n, 0));
          this.log("buff", { side: s, source: -1, hero: s, uids: ts.map((m) => m.uid), a: n, h: 0, label: affMech(a, "en") });
        } else if (kind === "ward") {
          const kw = AFF[a].kw, has = (m) => (CKW[kw] ? (m.ckw || []).includes(kw) : !!m[kw]);
          const l = pickN(this.rng, ts.filter((m) => !has(m)), v); if (!l.length) continue;
          l.forEach((m) => { if (CKW[kw]) giveCkw(m, kw); else m[kw] = true; });
          this.log("buff", { side: s, source: -1, hero: s, uids: l.map((m) => m.uid), a: 0, h: 0, label: kwName(kw) });
        } else if (kind === "aura") {
          // each one gives its neighbours stats (a minion between two of them gets it twice)
          const [ba, bh] = statAH(a, v), row = this.sides[s];
          for (const m of ts) {
            const i = row.indexOf(m), nb = [row[i - 1], row[i + 1]].filter((o) => o && o.health > 0); if (!nb.length) continue;
            nb.forEach((o) => o.buff(ba, bh));
            this.log("buff", { side: s, source: m.uid, uids: nb.map((o) => o.uid), a: ba, h: bh, label: affMech(a, "en") });
          }
        } else if (kind === "strike") {
          const foes = this.sides[1 - s].filter((e) => e.health > 0 && !e.stealth), t = foes.length ? this.rng.pick(foes) : null; if (!t) continue;
          const hits = [this.damage(t, v, false)].filter(Boolean);
          if (hits.length) { this.log("shoot", { side: s, source: -1, hero: s, hits }); this.afterHits(hits); }
          this.resolveDeaths(s);
        }
      }
    }
    // an affinity's own "Start of Combat" effects: stats, keywords, damage
    affStartFx(s, a, lv) {
      const d = AFF[a]; if (!d.effects || !d.effects.length) return;
      const ctx = this.ctx || {};
      d.effects.forEach((ab, i) => {
        if (ab.trigger !== "startOfCombat" || (ab.alv || 1) > lv) return;
        if (!gate(ab, i, null, null, this.sides[s], {}, { turn: ctx.turn, health: ctx.health ? ctx.health[s] : null })) return;
        const tf = (o) => o.health > 0 && (!ab.ttribe || hasTribe(o, ab.ttribe)) && (!ab.tkw || hasKw(o, ab.tkw)) && (!ab.taff || hasAff(o, ab.taff));
        const friends = this.sides[s].filter(tf), foes = this.sides[1 - s].filter((o) => o.health > 0);
        const pickF = () => (ab.target === "randomFriend" ? pickN(this.rng, friends, ab.count || 1) : friends);
        if (ab.action === "buff" || ab.action === "permBuff") {
          const l = pickF(); if (!l.length) return; l.forEach((m) => m.buff(ab.a || 0, ab.h || 0));
          this.log("buff", { side: s, source: -1, hero: s, uids: l.map((m) => m.uid), a: ab.a || 0, h: ab.h || 0, label: affMech(a, "en") });
        } else if (ab.action === "keyword" && ab.kw) {
          const l = pickF(); if (!l.length) return; l.forEach((m) => { if (CKW[ab.kw]) giveCkw(m, ab.kw); else m[ab.kw] = true; });
          this.log("buff", { side: s, source: -1, hero: s, uids: l.map((m) => m.uid), a: 0, h: 0, label: kwName(ab.kw) });
        } else if (ab.action === "randomKeyword") {
          for (const t of pickN(this.rng, friends, ab.count || 1)) { const opts = KW_RANDOM_COMBAT.filter((x) => !t[x]); if (!opts.length) continue; const kw = this.rng.pick(opts); t[kw] = true; this.log("buff", { side: s, source: -1, hero: s, uids: [t.uid], a: 0, h: 0, label: KW_TEXT[kw] }); }
        } else if (ab.action === "damage") {
          const ts = ab.target === "allEnemies" ? foes : pickN(this.rng, foes.filter((e) => !e.stealth), ab.count || 1);
          const hits = ts.map((t) => this.damage(t, ab.n || 0, false)).filter(Boolean);
          if (hits.length) { this.curFx = ab.fx || ""; this.log("shoot", { side: s, source: -1, hero: s, hits }); this.curFx = ""; this.afterHits(hits); }
          this.resolveDeaths(s);
        }
      });
    }
    lvOf(s, a) { return a && this.affS && this.affS[s] && this.affS[s][a] ? this.affS[s][a].lv : 0; }
    tctx(s) { return { coral: this.lvOf(s, affsOfKind("pulse")[0]), foundAt: (o) => (o.foundN > 0 ? o.foundN : 0) }; }
    // Steam: an effect with a Pressure cost fires only if the pool can pay it (0 = no, else how many times)
    payPressure(s, ab, m) {
      if (!(ab.pcost > 0)) return 1;
      const a = affFor("gauge", ab.paff, m);
      if (this.lvOf(s, a) < 1) return 0;
      const key = this.pool(s, a), have = this.pools[key] || 0, need = ab.pcost;
      if (have < need) return 0;
      const times = ab.pall ? Math.floor(have / need) : 1;
      this.pools[key] = have - times * need;
      this.log("buff", { side: s, source: m.uid, uids: [m.uid], a: 0, h: 0, label: `-${times * need} ${affMech(a, "en")}` });
      return times;
    }
    snap() { return [this.sides[0].map(m => m.dict()), this.sides[1].map(m => m.dict())]; }
    log(kind, data) { if (this.quiet) return; this.events.push(Object.assign({ kind, boards: this.snap() }, this.curFx && (kind === "shoot" || kind === "buff" || kind === "summon") ? { fx: this.curFx } : null, data)); }
    alive(m) { return this.sides[0].includes(m) || this.sides[1].includes(m); }

    nextAttacker(s) {
      const c = this.sides[s].filter(m => m.attack > 0);
      if (!c.length) return null;
      const fresh = c.find(m => !this.attacked.has(m.uid));
      if (fresh) return fresh;
      for (const m of this.sides[s]) this.attacked.delete(m.uid);
      return c[0];
    }

    pickTarget(s, att) {
      const seen = this.sides[s].filter(m => !m.stealth), pool = seen.length ? seen : this.sides[s];
      const taunts = pool.filter(m => m.taunt);
      // Flying: flies over Taunt and hits a random minion without it; when they all have Taunt, one of them
      if (att && att.flying) { const free = pool.filter(m => !m.taunt); return this.rng.pick(free.length ? free : pool); }
      return this.rng.pick(taunts.length ? taunts : pool);
    }

    attack(side, att, target, windfury2) {
      // "Whenever this attacks" effects resolve first, so "attack" is always followed by its "hit".
      // the swing starts first: the table freezes it mid-way while these effects play ("windup"), then it lands
      if (hasTrig(att, "onAttack") || att.onAttack === "corsair_cheer" || this.sides[side].some((o) => o !== att && o.health > 0 && hasTrig(o, "onFriendlyAttack")))
        this.log("windup", { side, attacker: att.uid, target: target.uid, second: windfury2, fx: att.attackFx || "" });
      if (att.onAttack === "corsair_cheer") {
        const amt = att.n(), uids = [];
        for (const o of this.sides[side]) if (o !== att && hasTribe(o, CORSAIR)) { o.buff(amt, amt); uids.push(o.uid); }
        if (uids.length) this.log("buff", { side, source: att.uid, uids, a: amt, h: amt, quick: true });
      }
      if (hasTrig(att, "onAttack")) {
        this.runAb(side, att, "onAttack");
        if (target.health <= 0 || att.health <= 0) {
          this.resolveDeaths(side);
          if (!this.sides[side].includes(att) || !this.sides[1 - side].length) return;
          target = this.pickTarget(1 - side, att);
        }
      }
      for (const o of [...this.sides[side]]) if (o !== att && o.health > 0 && hasTrig(o, "onFriendlyAttack")) this.runAb(side, o, "onFriendlyAttack", att);
      if (att.health <= 0 || target.health <= 0) {
        this.resolveDeaths(side);
        if (!this.sides[side].includes(att) || !this.sides[1 - side].length) return;
        if (!this.sides[1 - side].includes(target)) target = this.pickTarget(1 - side, att);
      }
      att.stealth = false;
      this.log("attack", { side, attacker: att.uid, target: target.uid, second: windfury2, fx: att.attackFx || "" });
      if (target.health > 0 && hasTrig(target, "onAttacked")) {
        this.runAb(1 - side, target, "onAttacked", att);
        if (att.health <= 0 || target.health <= 0 || !this.sides[side].includes(att) || !this.sides[1 - side].includes(target)) { this.resolveDeaths(side); return; }
      }
      if (target.dodge) {
        // Dodge: the whole swing misses, nobody takes damage
        target.dodge = false;
        this.log("hit", { side, attacker: att.uid, target: target.uid, hits: [{ uid: target.uid, dmg: 0, popped: false, venom: false, dodged: true }] });
        return;
      }
      const ti = this.sides[1 - side].indexOf(target);
      const splash = att.cleave ? [this.sides[1 - side][ti - 1], this.sides[1 - side][ti + 1]].filter(Boolean) : [];
      const hits = [this.damage(target, att.attack, att.venomous), ...splash.map((o) => this.damage(o, att.attack, att.venomous)), this.damage(att, target.attack, target.venomous)].filter(Boolean);
      this.log("hit", { side, attacker: att.uid, target: target.uid, hits });
      this.afterHits(hits);
      if (att.health > 0) this.killedBy(side, att, [target, ...splash].filter((t) => t.health <= 0));
      if (att.health > 0 && target.health < 0 && hasTrig(att, "onOverkill")) this.runAb(side, att, "onOverkill", target);
    }

    damage(m, amount, venom) {
      if (amount <= 0) return null;
      if (m.shield) { m.shield = false; return { uid: m.uid, dmg: 0, popped: true, venom: false }; }
      if (m.tough) { amount -= 1; if (amount <= 0) return { uid: m.uid, dmg: 0, popped: false, venom: false, tough: true }; }
      m.health -= amount;
      let v = false;
      if (venom && m.health > 0) { m.health = 0; v = true; }
      return { uid: m.uid, dmg: amount, popped: false, venom: v };
    }

    sideOf(uid) { return this.sides[0].some(m => m.uid === uid) ? 0 : this.sides[1].some(m => m.uid === uid) ? 1 : -1; }
    // markers changed in combat are written down: the same minion back in the tavern gets the same change (Combat.perm)
    mkRec(s, m, st, add, del) { if (!m || (!(st && Object.keys(st).length) && !(add && add.length) && !(del && del.length))) return; (this.perm = this.perm || []).push({ side: s, uid: m.uid, a: 0, h: 0, mks: st || {}, mka: add || [], mkd: del || [] }); }

    // Shield Forge: react to broken shields.
    afterHits(hits) {
      for (const h of hits) {
        if (h.popped || h.dmg <= 0) continue;
        const s = this.sideOf(h.uid);
        const m = s < 0 ? null : this.sides[s].find((o) => o.uid === h.uid);
        if (m && m.health > 0) for (const a of affsOf(m)) {
          // Fury: it survived, it hits back harder
          if (!AFF[a] || AFF[a].kind !== "fury") continue;
          const v = affVal(a, this.lvOf(s, a)); if (v <= 0) continue;
          m.buff(v, 0); this.log("buff", { side: s, source: -1, hero: s, uids: [m.uid], a: v, h: 0, label: affMech(a, "en") });
        }
        if (m && m.health > 0 && hasTrig(m, "onDamaged")) this.runAb(s, m, "onDamaged");
      }
      for (const h of hits) {
        if (!h.popped) continue;
        const s = this.sideOf(h.uid);
        if (s < 0) continue;
        const broke = this.sides[s].find((o) => o.uid === h.uid);
        for (const f of [...this.sides[s]]) if (f.health > 0 && hasTrig(f, "onShieldLost")) this.runAb(s, f, "onShieldLost", broke);
        for (const f of this.sides[s]) {
          if (f.onShieldLost !== "forge" || f.health <= 0) continue;
          const amt = f.n(), uids = [];
          for (const o of this.sides[s]) if (hasTribe(o, CONSTRUCT) && o.health > 0) { o.attack += amt; uids.push(o.uid); }
          if (uids.length) this.log("buff", { side: s, source: f.uid, uids, a: amt, h: 0 });
        }
      }
    }

    resolveDeaths(attSide) {
      for (let guard = 0; guard < 30; guard++) {
        const dead = [[], []];
        let any = false;
        for (const s of [0, 1]) for (const m of this.sides[s]) if (m.health <= 0) { dead[s].push(m); any = true; }
        for (const sd of [0, 1]) {
          const only = this.sides[sd].length === 1 ? this.sides[sd][0] : null;
          if (only && only.health > 0 && !(this.lastFired || (this.lastFired = [false, false]))[sd] && hasTrig(only, "onLastStanding")) {
            this.lastFired[sd] = true; this.runAb(sd, only, "onLastStanding");
            for (const x of [0, 1]) for (const o of this.sides[x]) if (o.health <= 0) any = true;
          }
        }
        if (!any) return;
        this.log("deaths", { uids: [...dead[0], ...dead[1]].map(m => m.uid) });
        const positions = [[], []];
        for (const s of [0, 1]) {
          let left = 0;
          const kept = [];
          for (const m of this.sides[s]) {
            if (m.health <= 0) { positions[s].push({ m, pos: left }); this.dead[s].push(m); }
            else { kept.push(m); left++; }
          }
          this.sides[s] = kept;
        }
        this.log("removed", {});
        for (const s of [attSide, 1 - attSide]) {
          let offset = 0;
          for (const { m, pos: p0 } of positions[s]) {
            const pos = p0 + offset;
            this.allyDied(s, m);
            const before = this.sides[s].length;
            const drTimes = 1 + passive(this.sides[s], "extraDeathrattle");
            for (let rep = 0; rep < drTimes; rep++) {
              const b2 = this.sides[s].length;
              if (m.deathrattle) this.deathrattle(s, m, pos);
              if (hasTrig(m, "deathrattle")) this.runAb(s, m, "deathrattle", null, pos + (this.sides[s].length - b2));
              if (m.deathrattle || hasTrig(m, "deathrattle")) for (const w of [...this.sides[s]]) if (w.health > 0 && hasTrig(w, "onDeathrattleFriend")) this.runAb(s, w, "onDeathrattleFriend", m);
            }
            if (m.reborn) {
              const r = new Minion(m.cardId, m.golden);
              r.health = 1; r.maxHealth = Math.max(1, r.maxHealth); r.reborn = false;
              if (this.summon(s, r, pos + (this.sides[s].length - before))) {
                this.log("reborn", { side: s, uid: r.uid, from: m.uid });
                for (const w of [...this.sides[s]]) if (w !== r && w.health > 0 && hasTrig(w, "onRebornAlly")) this.runAb(s, w, "onRebornAlly", r);
                for (const w of this.sides[s]) {
                  if (w.onReborn === "reborn_buff" && w !== r) { const amt = w.n(); r.buff(amt, amt); this.log("buff", { side: s, source: w.uid, uids: [r.uid], a: amt, h: amt }); }
                }
              }
            }
            offset += this.sides[s].length - before;
          }
        }
      }
    }

    allyDied(s, dead) {
      // Legacy: a dying minion leaves a bonus to another one of its affinity
      for (const a of affsOf(dead)) {
        if (!AFF[a] || AFF[a].kind !== "echo") continue;
        const v = affVal(a, this.lvOf(s, a)); if (v <= 0) continue;
        const heirs = this.sides[s].filter((o) => o !== dead && o.health > 0 && hasAff(o, a)); if (!heirs.length) continue;
        const h = this.rng.pick(heirs), [ea, eh] = statAH(a, v); h.buff(ea, eh);
        this.log("buff", { side: s, source: -1, hero: s, uids: [h.uid], a: ea, h: eh, label: affMech(a, "en") });
      }
      if (dead.mired) for (const o of [...this.sides[1 - s]]) if (o.health > 0 && hasTrig(o, "onMiredDeath")) this.runAb(1 - s, o, "onMiredDeath", dead);
      for (const o of [...this.sides[1 - s]]) if (o.health > 0 && hasTrig(o, "onEnemyDeath")) this.runAb(1 - s, o, "onEnemyDeath", dead);
      for (const o of [...this.sides[s]]) if (hasTrig(o, "onAllyDeath")) this.runAb(s, o, "onAllyDeath", dead);
      const grown = [];
      for (const o of this.sides[s]) if (o.onAllyDeath === "grow") { o.buff(o.n(), o.n()); grown.push(o); }
      if (grown.length) this.log("buff", { side: s, source: grown[0].uid, uids: grown.map(o => o.uid), a: grown[0].n(), h: grown[0].n() });
      if (hasTribe(dead, BEAST)) {
        for (const al of this.sides[s]) {
          if (al.onAllyDeath !== "beast_rally") continue;
          const amt = al.n(), uids = [];
          for (const o of this.sides[s]) if (hasTribe(o, BEAST)) { o.buff(amt, amt); uids.push(o.uid); }
          if (uids.length) this.log("buff", { side: s, source: al.uid, uids, a: amt, h: amt });
        }
      }
    }

    summon(s, m, pos) {
      if (this.sides[s].length >= BOARD_MAX) return false;
      if ((this.summonCount = (this.summonCount || 0) + 1) > 60) return false; // keeps endless summon loops finite
      pos = Math.max(0, Math.min(pos, this.sides[s].length));
      this.sides[s].splice(pos, 0, m);
      for (const o of this.sides[s]) {
        if (o !== m && o.onSummonAlly === "beast_attack" && hasTribe(m, BEAST)) m.attack += o.n();
      }
      const [sa, sh] = passiveStats(this.sides[s], m);
      if (sa || sh) m.buff(sa, sh);
      if ((this.summonDepth = (this.summonDepth || 0) + 1) < 12) {
        for (const o of [...this.sides[s]]) if (o !== m && hasTrig(o, "onSummonAlly")) this.runAb(s, o, "onSummonAlly", m);
        for (const o of [...this.sides[1 - s]]) if (o.health > 0 && hasTrig(o, "onEnemySummon")) this.runAb(1 - s, o, "onEnemySummon", m);
      }
      this.summonDepth--;
      return true;
    }

    killedBy(s, m, victims) {
      if (!victims.length || !hasTrig(m, "onKill")) return;
      for (const v of victims) this.runAb(s, m, "onKill", v);
    }

    // Run a minion's data-driven abilities for one trigger.
    runAb(s, m, trig, src = null, pos = -1) {
      if ((this.abDepth = (this.abDepth || 0) + 1) > 40) { this.abDepth--; return; }
      if (!this.ctr) this.ctr = new Map();
      if (!this.ctr.has(m.uid)) this.ctr.set(m.uid, {});
      const abs = m.abilities || [];
      const tryOne = (ab, i) => {
        if (ab._aff && this.lvOf(s, ab._aff) < (ab.alv || 1)) return false;
        if (!gate(ab, i, m, src, this.sides[s], this.ctr.get(m.uid), this.ctx ? { turn: this.ctx.turn, health: this.ctx.health[s], enemies: this.sides[1 - s] } : { enemies: this.sides[1 - s] })) return false;
        if (ab.limit) {
          // counted per card and side, so copies summoned by the effect can't start it again
          const lk = "L" + s + ":" + m.cardId + ":" + i, c = this.limCtr || (this.limCtr = {});
          if (c[lk] || (ab.limit === "game" && m.lim && m.lim["c" + i])) return false;
          c[lk] = 1;
          if (ab.limit === "game") (this.usedOnce = this.usedOnce || []).push({ side: s, uid: m.uid, key: "c" + i });
        }
        const pm = this.payPressure(s, ab, m); if (!pm) return false;
        return this.applyAb(s, m, pm === 1 ? ab : Object.assign({}, ab, { _pm: pm }), src, pos) !== false;
      };
      abs.forEach((ab, i) => {
        if (ab.trigger !== trig) return;
        let ok = tryOne(ab, i);
        // "Then" runs when the rule above happened, "Otherwise" when it didn't (a missed chance, a condition, a cost…)
        for (let j = i + 1; j < abs.length && CHAIN.has(abs[j].trigger); j++) if (CHAIN_THEN.has(abs[j].trigger) === ok) ok = tryOne(abs[j], j);
      });
      for (const ab of m.abilities || []) if (ab.trigger === "evoFull" && ab.src === trig && srcOk(ab, src)) { this.chargeLater(s, m, ab.golden === false ? 1 : m.mult()); break; }
      this.abDepth--;
    }
    // Evolution charged in combat lands on the tavern minion after the fight (like permanent buffs)
    chargeLater(s, m, n) {
      if (!m || n <= 0 || !(m.abilities || []).some((ab) => ab.trigger === "evoFull") || m.evoDone) return;
      (this.perm = this.perm || []).push({ side: s, uid: m.uid, a: 0, h: 0, evo: n });
      this.log("buff", { side: s, source: m.uid, uids: [m.uid], a: 0, h: 0, label: `+${n} Evolution` });
    }
    // Abilities can pick how they look (lightning, fire, healing light...); events logged while one runs carry it.
    applyAb(s, m, ab, src, pos) {
      if (!ab._rp && ab.repeat > 1) { const a2 = Object.assign({}, ab, { _rp: 1 }); let any = false; for (let r = 0; r < Math.min(10, ab.repeat); r++) if (this.applyAb(s, m, a2, src, pos) !== false) any = true; return any; }
      if (!ab._ch && ab.chance > 0 && ab.chance < 100) {
        const ok = this.rng.next() * 100 < ab.chance;
        if (ok) this.log("roll", { side: s, uid: m.uid, pct: ab.chance, ok });
        if (!ok) return false; ab = Object.assign({}, ab, { _ch: 1 });
      }
      const prev = this.curFx;
      this.curFx = ab.fx || "";
      try { this.applyAbInner(s, m, ab, src, pos); } finally { this.curFx = prev; }
    }
    applyAbInner(s, m, ab, src, pos) {
      const friends = this.sides[s], enemies = this.sides[1 - s];
      const k = labMul(ab, m, () => this.rng.next()) * (ab.golden === false ? 1 : m.mult()) * (ab._pm || 1) * (ab.per === "pressure" && SCALABLE.has(ab.action) ? this.pools[this.pool(s, affFor("gauge", ab.gaff || ab.paff, m))] || 0 : scale(ab, m, friends, enemies, this.ctx && this.ctx.players ? this.ctx.players[s] : null, this.ctx && this.ctx.turn));
      if (k <= 0 && ab.per) return;
      const T = () => { const l = abilityTargets(ab, m, friends, enemies, src, this.rng, this.tctx(s)); if (ab.target !== "previous") LAST.ts = l; return l; };
      const show = (ts, a, h, label) => { if (ts.length) this.log("buff", { side: this.sideOf(ts[0].uid) < 0 ? s : this.sideOf(ts[0].uid), source: m.uid, uids: ts.map((t) => t.uid), a, h, label }); };
      switch (ab.action) {
        case "charge": { const cn = Math.max(1, ab.n || 1) * k; for (const t of T()) if (this.sideOf(t.uid) === s || friends.includes(t)) this.chargeLater(s, t, cn); break; }
        case "setStats": { const ts = T(), a = (ab.a || 0) * k, h = Math.max(1, (ab.h || 1) * k); ts.forEach((t) => { t.attack = a; t.health = h; t.maxHealth = h; }); show(ts, 0, 0, `${a}/${h}`); break; }
        case "swapStats": { const ts = T(); ts.forEach((t) => { [t.attack, t.health] = [t.health, t.attack]; t.maxHealth = Math.max(t.maxHealth, t.health); }); show(ts, 0, 0, "Swapped"); break; }
        case "doubleStats": {
          const ts = T(), f = 1 + (ab.golden === false ? 1 : m.mult());
          ts.forEach((t) => { const a = ab.stat !== "health" ? t.attack * (f - 1) : 0, h = ab.stat !== "attack" ? t.health * (f - 1) : 0; t.buff(a, h); });
          show(ts, 0, 0, `x${f}`); break;
        }
        case "debuff": {
          const ts = T(), a = (ab.a || 0) * k, h = (ab.h || 0) * k;
          ts.forEach((t) => { t.attack = Math.max(0, t.attack - a); t.health -= h; });
          if (ts.length) this.log("buff", { side: this.sideOf(ts[0].uid), source: m.uid, uids: ts.map((t) => t.uid), a: 0, h: 0, label: a && h ? `-${a}/-${h}` : a ? `-${a} Atk` : `-${h} HP` });
          break;
        }
        case "removeKeyword": { const ts = T().filter((t) => hasKw(t, ab.kw || "taunt")); ts.forEach((t) => (CKW[ab.kw] ? takeCkw(t, ab.kw) : (t[ab.kw || "taunt"] = false))); show(ts, 0, 0, "No " + kwName(ab.kw || "taunt")); break; }
        case "heal": { const ts = T().filter((t) => t.health < t.maxHealth); ts.forEach((t) => (t.health = t.maxHealth)); show(ts, 0, 0, "Healed"); break; }
        case "healN": {
          const ts = T().filter((t) => t.health > 0 && t.health < t.maxHealth), n = (ab.n || 0) * k;
          ts.forEach((t) => (t.health = Math.min(t.maxHealth, t.health + n))); show(ts, 0, 0, `+${n} Health`); break;
        }
        case "attackNow": {
          for (const t of T()) {
            if ((this.attackDepth || 0) >= 3 || t.health <= 0 || !this.sides[s].includes(t) || !this.sides[1 - s].length) continue;
            this.attackDepth = (this.attackDepth || 0) + 1;
            this.attack(s, t, this.pickTarget(1 - s, t), false);
            this.attackDepth--;
          }
          break;
        }
        case "heroDamage": (this.heroDmg = this.heroDmg || [0, 0])[s] += (ab.n || 0) * k; show([m], 0, 0, `${(ab.n || 0) * k} to hero`); break;
        case "devourEnemy": {
          const got = [];
          for (let i = 0; i < (ab.count || 1) * (ab.golden === false ? 1 : m.mult()); i++) {
            const pool = enemies.filter((t) => t.health > 0 && !t.stealth); if (!pool.length) break;
            const t = this.rng.pick(pool), f = ab.share === "full" ? 1 : 0.5;
            const a = Math.ceil(t.attack * f), h = Math.ceil(t.health * f), d = t.health; t.health = 0;
            this.log("shoot", { side: s, source: m.uid, hits: [{ uid: t.uid, dmg: d, popped: false, venom: true }] });
            m.buff(a, h); m.fed = (m.fed || 0) + 1; got.push([a, h]); this.killedBy(s, m, [t]);
          }
          if (got.length) this.log("buff", { side: s, source: m.uid, uids: [m.uid], a: got.reduce((x, y) => x + y[0], 0), h: got.reduce((x, y) => x + y[1], 0), label: "Devour" });
          break;
        }
        case "gainPressure": {
          const ga = affFor("gauge", ab.gaff, m), lv = this.lvOf(s, ga); if (lv < 1) break;
          const key = this.pool(s, ga), max = affVal(ga, lv), add = (ab.n || 0) * k, before = this.pools[key] || 0;
          this.pools[key] = Math.min(max, before + add); if (this.pools[key] > before) show([m], 0, 0, `+${this.pools[key] - before} ${affMech(ga, "en")}`); break;
        }
        case "giveAff": { const got = T().filter((t) => t.health > 0 && giveAff(t, ab.aff)); show(got, 0, 0, AN(ab.aff)); break; }
        case "counter": {
          const nm = (ab.vname || "Charge").trim().slice(0, 16) || "Charge", v = (ab.n || 0) * k;
          const bag = ab.scope === "player" ? (m._pvars = m._pvars || (this.pvars = this.pvars || [{}, {}])[s]) : (m.vars = m.vars || {});
          if (ab.scope === "player") for (const o of friends) o._pvars = bag;
          bag[nm] = Math.max(-9999, Math.min(99999, ab.op === "set" ? v : (bag[nm] || 0) + v));
          show([m], 0, 0, `${nm} ${bag[nm]}`); break;
        }
        case "signal": {
          const sg = (ab.sigOut || ab.sig || "").trim(); if (!sg || (this.sigDepth || 0) >= 6) break;
          this.sigDepth = (this.sigDepth || 0) + 1; const prev = SIG.cur; SIG.cur = sg;
          show([m], 0, 0, "📣 " + sg);
          try { for (const o of [...friends]) if (o.health > 0 && hasTrig(o, "onSignalC")) this.runAb(s, o, "onSignalC", m); } finally { SIG.cur = prev; this.sigDepth--; }
          break;
        }
        case "fireTrigger": {
          const tg = FIRE_COMBAT.includes(ab.trig) ? ab.trig : "deathrattle";
          if ((this.fireDepth || 0) >= 4) break;
          if (!this.fireDepth) this.fired = new Set(); this.fired.add(m); this.fireDepth = (this.fireDepth || 0) + 1;
          try { for (const t of T()) {
            if ((t === m && !ab.allowSelf) || this.fired.has(t)) continue; this.fired.add(t);
            const ts = this.sides[s].includes(t) ? s : this.sides[1 - s].includes(t) ? 1 - s : -1; if (ts < 0) continue;
            if (tg === "deathrattle") { const pos = this.sides[ts].indexOf(t); if (t.deathrattle) this.deathrattle(ts, t, pos + 1); this.runAb(ts, t, "deathrattle", null, pos + 1); }
            else { if (tg === "startOfCombat" && t.startOfCombat) this.startOfCombat(ts, t); this.runAb(ts, t, tg); }
            show([t], 0, 0, "Echo!");
          } } finally { this.fireDepth--; }
          if (!this.fireDepth) this.resolveDeaths(s);
          break;
        }
        case "mire": {
          const ma = affFor("mire", ab.maff, m), lv = this.lvOf(s, ma); if (lv < 1) break;
          const amt = affVal(ma, lv) * (ab._pm || 1), ts = T().filter((t) => t.health > 0);
          ts.forEach((t) => { t.attack = Math.max(0, t.attack - amt); t.mired = (t.mired || 0) + 1; });
          if (ts.length) this.log("buff", { side: this.sideOf(ts[0].uid), source: m.uid, uids: ts.map((t) => t.uid), a: 0, h: 0, label: `Mired -${amt}`, mire: true });
          if (ts.length && (this.mireDepth || 0) < 3) { this.mireDepth = (this.mireDepth || 0) + 1; try { for (const o of [...this.sides[s]]) if (o.health > 0 && hasTrig(o, "onMire")) this.runAb(s, o, "onMire", ts[0]); } finally { this.mireDepth--; } }
          break;
        }
        case "combatGold": { const g = (ab.n || 0) * k; if (g > 0) { this.goldNext.push({ side: s, uid: m.uid, n: g }); show([m], 0, 0, `+${g} gold next turn`); } break; }
        case "shuffleEnemies": {
          const e = this.sides[1 - s];
          for (let i = e.length - 1; i > 0; i--) { const j = this.rng.int(0, i); [e[i], e[j]] = [e[j], e[i]]; }
          if (e.length) this.log("buff", { side: 1 - s, source: m.uid, uids: e.map((t) => t.uid), a: 0, h: 0, label: "Shuffled" });
          break;
        }
        case "steal": {
          const taken = [];
          for (let i = 0; i < (ab.count || 1) * (ab.golden === false ? 1 : m.mult()); i++) {
            const pool = enemies.filter((t) => t.health > 0 && !t.stealth);
            if (!pool.length || friends.length >= BOARD_MAX) break;
            const t = this.rng.pick(pool);
            enemies.splice(enemies.indexOf(t), 1);
            const at = Math.max(0, Math.min(friends.indexOf(m) + 1, friends.length));
            friends.splice(at, 0, t); this.attacked.delete(t.uid); taken.push(t.uid);
          }
          if (taken.length) this.log("summon", { side: s, source: m.uid, uids: taken, label: "Stolen" });
          break;
        }
        case "resurrect": {
          const at = pos >= 0 ? pos : friends.indexOf(m) + 1, placed = [];
          for (let i = 0; i < (ab.count || 1) * (ab.golden === false ? 1 : m.mult()); i++) {
            const pool = this.dead[s].filter((d) => d !== m);
            if (!pool.length) break;
            const d = this.rng.pick(pool);
            const r = new Minion(d.cardId, d.golden);
            if (ab.a) r.attack = ab.a; if (ab.h) { r.health = ab.h; r.maxHealth = ab.h; }
            if (this.summon(s, r, Math.max(0, at) + placed.length)) placed.push(r.uid);
          }
          if (placed.length) this.log("summon", { side: s, source: m.uid, uids: placed, label: "Resurrected" });
          break;
        }
        case "silence": { const ts = T().filter((t) => !t.silenced); ts.forEach((t) => t.silence()); show(ts, 0, 0, "Silenced"); break; }
        case "reposition": {
          for (const t of T()) {
            const sd = this.sideOf(t.uid); if (sd < 0) continue;
            const row = this.sides[sd], i = row.indexOf(t); if (i < 0) continue;
            row.splice(i, 1); if (ab.where === "back") row.push(t); else row.unshift(t);
            this.log("buff", { side: sd, source: m.uid, uids: [t.uid], a: 0, h: 0, label: ab.where === "back" ? "To the back" : "To the front", quick: true });
          }
          break;
        }
        case "summonCopy": {
          const at = pos >= 0 ? pos : friends.indexOf(m) + 1, placed = [];
          for (const t of T()) for (let i = 0; i < (ab.count || 1) * (ab.golden === false ? 1 : m.mult()); i++) {
            if (t.isCopy && t === m) break; // a copy can't copy itself again
            const c = ab.exact ? t.clone(false) : new Minion(t.cardId, t.golden); c.isCopy = true;
            if (ab.exact) { c.health = Math.max(1, c.health); }
            if (ab.a) c.attack = ab.a; if (ab.h) { c.health = ab.h; c.maxHealth = ab.h; }
            if (this.summon(s, c, Math.max(0, at) + placed.length)) placed.push(c.uid);
          }
          if (placed.length) this.log("summon", { side: s, source: m.uid, uids: placed });
          break;
        }
        case "permBuff": {
          const ts = abilityTargets(ab, m, friends, enemies, src, this.rng, this.tctx(s));
          const a = (ab.a || 0) * k, h = (ab.h || 0) * k;
          ts.forEach((t) => { t.buff(a, h); (this.perm = this.perm || []).push({ side: s, uid: t.uid, a, h }); });
          if (ts.length) this.log("buff", { side: s, source: m.uid, uids: ts.map((t) => t.uid), a, h, label: "Permanent" });
          break;
        }
        case "freezeFoe": {
          const ts = abilityTargets(ab, m, friends, enemies, src, this.rng, this.tctx(s)).filter((t) => t.health > 0 && enemies.includes(t));
          ts.forEach((t) => { t.chill = (t.chill || 0) + Math.max(1, k); });
          if (ts.length) {
            this.log("chill", { side: 1 - s, source: m.uid, uids: ts.map((t) => t.uid) });
            if ((this.freezeDepth || 0) < 3) { this.freezeDepth = (this.freezeDepth || 0) + 1; for (const t of ts) for (const o of [...friends]) if (o.health > 0 && hasTrig(o, "onFreezeFoe")) this.runAb(s, o, "onFreezeFoe", t); this.freezeDepth--; }
          }
          break;
        }
        case "destroy": {
          const ts = abilityTargets(ab, m, friends, enemies, src, this.rng, this.tctx(s)).filter((t) => t.health > 0);
          const hits = ts.map((t) => { const d = t.health; t.health = 0; return { uid: t.uid, dmg: d, popped: false, venom: true }; });
          if (hits.length) { this.log("shoot", { side: s, source: m.uid, hits }); this.killedBy(s, m, ts); }
          break;
        }
        case "summonRandom": {
          const at = pos >= 0 ? pos : friends.indexOf(m) + 1, placed = [];
          for (let i = 0; i < (ab.count || 1) * (ab.golden === false ? 1 : m.mult()); i++) {
            const id = randomCardId(this.rng, ab.tier, ab.tribe, ab.allowSelf ? "" : m.cardId);
            if (!id) break;
            const t = new Minion(id);
            if (this.summon(s, t, Math.max(0, at) + placed.length)) placed.push(t.uid);
          }
          if (placed.length) this.log("summon", { side: s, source: m.uid, uids: placed });
          break;
        }
        case "buff": {
          const ts = abilityTargets(ab, m, friends, enemies, src, this.rng, this.tctx(s));
          const [ba, bh] = passiveAH(friends, "buffBoost"), a = (ab.a || 0) * k + (ab.a || ab.h ? ba + m.boostA : 0), h = (ab.h || 0) * k + (ab.a || ab.h ? bh + m.boostH : 0);
          ts.forEach((t) => t.buff(a, h));
          if (ts.length) this.log("buff", { side: this.sideOf(ts[0].uid), source: m.uid, uids: ts.map((t) => t.uid), a, h });
          for (const t of ts) if (hasTrig(t, "onBuffed")) this.runAb(this.sideOf(t.uid), t, "onBuffed", m);
          break;
        }
        case "absorb": {
          const ts = abilityTargets(ab, m, friends, enemies, src, this.rng, this.tctx(s)).filter((t) => t !== m);
          const a = ts.reduce((x, t) => x + t.attack, 0) * k, h = ts.reduce((x, t) => x + Math.max(0, t.health), 0) * k;
          if (a || h) { m.buff(a, h); this.log("buff", { side: s, source: m.uid, uids: [m.uid], a, h }); if (hasTrig(m, "onBuffed")) this.runAb(s, m, "onBuffed", m); }
          break;
        }
        case "empower": {
          const ts = abilityTargets(ab, m, friends, enemies, src, this.rng, this.tctx(s));
          ts.forEach((t) => { t.boostA += (ab.a || 0) * k; t.boostH += (ab.h || 0) * k; });
          if (ts.length) this.log("buff", { side: this.sideOf(ts[0].uid), source: m.uid, uids: ts.map((t) => t.uid), a: 0, h: 0, label: `Effects +${(ab.a || 0) * k}/+${(ab.h || 0) * k}` });
          break;
        }
        case "randomKeyword": {
          const ts = abilityTargets(ab, m, friends, enemies, src, this.rng, this.tctx(s)), got = [];
          for (const t of ts) { const opts = KW_RANDOM_COMBAT.filter((x) => !t[x]); if (!opts.length) continue; const kw = this.rng.pick(opts); t[kw] = true; got.push(KW_TEXT[kw]); }
          if (ts.length) this.log("buff", { side: this.sideOf(ts[0].uid), source: m.uid, uids: ts.map((t) => t.uid), a: 0, h: 0, label: got.length === 1 ? got[0] : "Keywords" });
          break;
        }
        case "mkPlus": {
          const ts = T().filter((t) => t.health > 0), nn = Math.max(1, ab.n || 1) * k, key = mkKey(ab.a == null ? 1 : ab.a, ab.h == null ? 1 : ab.h);
          for (const t of ts) { const got = mkAddStat(t, key, nn); if (got) this.mkRec(s, t, { [key]: got }); }
          show(ts, 0, 0, mkStLabel({ [key]: nn }) + (nn > 1 ? " markers" : " marker")); break;
        }
        case "mkKw": {
          const ts = T().filter((t) => t.health > 0), nn = Math.max(1, ab.n || 1) * k, got = [], hit = [];
          for (const t of ts) {
            const l = !ab.mkw || ab.mkw === "random" ? pickN(this.rng, KW_RANDOM_COMBAT.filter((x) => !t[x] && !(t.mk && t.mk.kw[x])), nn) : [ab.mkw];
            const added = l.filter((x) => mkAddKw(t, x));
            if (added.length) { this.mkRec(s, t, null, added); got.push(...added); hit.push(t); }
          }
          show(hit, 0, 0, got.length === 1 ? kwName(got[0]) + " marker" : "Markers"); break;
        }
        case "mkMove": case "mkRemove": {
          // mkMove: markers off the targets onto this minion; mkRemove: markers off the targets, gone
          const nn = Math.max(1, ab.n || 1) * k, moved = [], hit = [], into = ab.action === "mkMove" ? m : null;
          const rec = (t, w, sign) => { const sd = this.sideOf(t.uid); if (w.startsWith("s:")) this.mkRec(sd < 0 ? s : sd, t, { [w.slice(2)]: sign }); else this.mkRec(sd < 0 ? s : sd, t, null, sign > 0 ? [w] : [], sign < 0 ? [w] : []); };
          if (into) {
            const from = T().filter((t) => t !== m && mkN(t) > 0);
            for (let i = 0; i < nn;) {
              const srcs = from.filter((t) => mkOpts(t, ab.mkind || "", m).length); if (!srcs.length) break;
              const a = this.rng.pick(srcs), w = mkMoveOne(a, m, ab.mkind || "", this.rng);
              if (!w) { from.splice(from.indexOf(a), 1); continue; }
              i++; moved.push(w); if (a.health > 0) rec(a, w, -1); rec(m, w, 1);
            }
            if (moved.length) show([m], 0, 0, moved.length === 1 ? mkOneLabel(moved[0]) : `${moved.length} markers`);
          } else {
            for (const a of T().filter((t) => t.health > 0 && mkN(t) > 0)) for (let i = 0; i < nn; i++) { const w = mkMoveOne(a, null, ab.mkind || "", this.rng); if (!w) break; rec(a, w, -1); if (!hit.includes(a)) hit.push(a); }
            show(hit, 0, 0, "Markers removed");
          }
          break;
        }
        case "mkTake": {
          const ts = T().filter((t) => t !== m), keep = ab.mkeep === "copy", all = { st: {}, kw: [] };
          for (const t of ts) {
            const st = Object.assign({}, mkSt(t)), tk = mkKws(t);
            if (Object.keys(st).length || tk.length) {
              const g = mkTakeAll(t, m, keep, k);
              if (!keep && t.health > 0) { const neg = {}; for (const x in st) neg[x] = -st[x]; this.mkRec(this.sideOf(t.uid) < 0 ? s : this.sideOf(t.uid), t, neg, [], tk); }
              this.mkRec(s, m, g.st, g.kw); for (const x in g.st) all.st[x] = (all.st[x] || 0) + g.st[x]; all.kw.push(...g.kw);
            }
            if (ab.mkeep === "eat" && t.health > 0) { const d = t.health; t.health = 0; this.log("shoot", { side: s, source: m.uid, hits: [{ uid: t.uid, dmg: d, popped: false, venom: true }] }); this.killedBy(s, m, [t]); }
          }
          if (Object.keys(all.st).length || all.kw.length) show([m], 0, 0, mkLabel(all));
          break;
        }
        case "enemyKw": {
          const pool = [...new Set(enemies.filter((e) => e.health > 0).flatMap((e) => KW_LIST.filter((x) => e[x] && x !== "magnetic")))].filter((x) => !m[x]);
          const l = pickN(this.rng, pool, Math.max(1, k));
          for (const x of l) { if (ab.asMk) { if (mkAddKw(m, x)) this.mkRec(s, m, null, [x]); } else m[x] = true; }
          if (l.length) show([m], 0, 0, l.map((x) => kwName(x)).join(" ") + (ab.asMk ? " marker" : ""));
          break;
        }
        case "keyword": {
          const ts = abilityTargets(ab, m, friends, enemies, src, this.rng, this.tctx(s));
          if (CKW[ab.kw]) ts.forEach((t) => giveCkw(t, ab.kw)); else ts.forEach((t) => (t[ab.kw || "taunt"] = true));
          if (ts.length) this.log("buff", { side: this.sideOf(ts[0].uid), source: m.uid, uids: ts.map((t) => t.uid), a: 0, h: 0, label: kwName(ab.kw || "taunt") });
          break;
        }
        case "damage": {
          const ts = abilityTargets(ab, m, friends, enemies, src, this.rng, this.tctx(s));
          const hits = ts.map((t) => this.damage(t, (ab.n || 0) * k, false)).filter(Boolean);
          if (hits.length) { this.log("shoot", { side: s, source: m.uid, hits }); this.afterHits(hits); this.killedBy(s, m, ts.filter((t) => t.health <= 0)); }
          break;
        }
        case "summon": {
          const at = pos >= 0 ? pos : friends.indexOf(m) + 1;
          const placed = [];
          for (let i = 0; i < (ab.count || 1); i++) {
            if (!(CARDS[ab.card] || TOKENS[ab.card])) break;
            const t = new Minion(ab.card, m.golden && ab.golden !== false);
            if (ab.a) { t.attack = ab.a * k; } if (ab.h) { t.health = ab.h * k; t.maxHealth = t.health; }
            if (this.summon(s, t, Math.max(0, at) + placed.length)) placed.push(t.uid);
          }
          if (placed.length) this.log("summon", { side: s, source: m.uid, uids: placed });
          break;
        }
      }
    }

    summonTokens(s, m, pos, id, count, stats) {
      const placed = [];
      for (let i = 0; i < count; i++) {
        const t = new Minion(id, m.golden);
        if (stats) { t.attack = stats; t.health = stats; t.maxHealth = stats; }
        if (this.summon(s, t, pos + placed.length)) placed.push(t.uid);
      }
      if (placed.length) this.log("summon", { side: s, source: m.uid, uids: placed });
    }

    deathrattle(s, m, pos) {
      switch (m.deathrattle) {
        case "summon_pup": this.summonTokens(s, m, pos, "pup", 1, m.n()); break;
        case "summon_two_cubs": this.summonTokens(s, m, pos, "cub", 2, m.n()); break;
        case "summon_big_cubs": this.summonTokens(s, m, pos, "cub", 2, m.n()); break;
        case "buff_spirits": {
          const amt = m.n(), uids = [];
          for (const o of this.sides[s]) if (hasTribe(o, SPIRIT)) { o.buff(amt, amt); uids.push(o.uid); }
          if (uids.length) this.log("buff", { side: s, source: m.uid, uids, a: amt, h: amt });
          break;
        }
        case "spirits_reborn": {
          const uids = [];
          for (const o of this.sides[s]) if (hasTribe(o, SPIRIT)) { o.reborn = true; if (m.golden) o.buff(3, 3); uids.push(o.uid); }
          if (uids.length) this.log("buff", { side: s, source: m.uid, uids, a: m.golden ? 3 : 0, h: m.golden ? 3 : 0, label: "Reborn" });
          break;
        }
      }
    }

    shoot(s, src, shots, dmg) {
      const hits = [];
      for (let i = 0; i < shots; i++) {
        const enemies = this.sides[1 - s].filter(e => e.health > 0);
        if (!enemies.length) break;
        const t = this.rng.pick(enemies);
        const h = this.damage(t, dmg, false);
        if (h) hits.push(h);
      }
      if (hits.length) { this.log("shoot", { side: s, source: src.uid, hits }); this.afterHits(hits); }
    }

    startOfCombat(s, m) {
      const others = (tribe) => this.sides[s].filter(o => o !== m && (!tribe || hasTribe(o, tribe)));
      const buffLog = (list, a, h, label) => { if (list.length) this.log("buff", { side: s, source: m.uid, uids: list.map(o => o.uid), a, h, label, soc: true }); };
      switch (m.startOfCombat) {
        case "buff_all_friends": { const l = others(); l.forEach(o => o.buff(m.n(), m.n())); buffLog(l, m.n(), m.n()); break; }
        case "shield_constructs": { const l = others(CONSTRUCT); l.forEach(o => { o.shield = true; if (m.golden) o.buff(3, 3); }); buffLog(l, m.golden ? 3 : 0, m.golden ? 3 : 0, "Shield"); break; }
        case "dragons_atk": { const l = others(DRAGON); l.forEach(o => (o.attack += m.n())); buffLog(l, m.n(), 0); break; }
        case "dragons_shield": { const l = others(DRAGON); l.forEach(o => { o.shield = true; if (m.golden) o.buff(2, 2); }); buffLog(l, m.golden ? 2 : 0, m.golden ? 2 : 0, "Shield"); break; }
        case "whelp": this.shoot(s, m, 1, m.n()); break;
        case "cannon": this.shoot(s, m, m.golden ? 2 : 1, 3); break;
        case "twin_flame": this.shoot(s, m, 2, m.n()); break;
        case "breath": {
          const hits = [];
          for (const e of this.sides[1 - s]) { const h = this.damage(e, m.n(), false); if (h) hits.push(h); }
          if (hits.length) { this.log("shoot", { side: s, source: m.uid, hits, breath: true }); this.afterHits(hits); }
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------- Game
  const MAX_TIER = 6, HAND_MAX = 10, START_HEALTH = 30, BUY = 3, SELL = 1, ROLL = 1, MAX_GOLD = 10, PASS_COST = 1;
  const SHOP_SIZE = [0, 3, 4, 4, 5, 5, 6];
  const POOL_COPIES = [0, 16, 15, 13, 11, 9, 7];
  // Rarer cards have fewer copies in the shared tavern pool (Discover ignores rarity).
  const RARITY = { common: { name: "Common", copies: 1 }, rare: { name: "Rare", copies: 0.5 }, epic: { name: "Epic", copies: 0.3 }, legendary: { name: "Legendary", copies: 0.15 } };
  const copiesOf = (d) => Math.max(1, Math.round(POOL_COPIES[d.tier] * (RARITY[d.rarity] || RARITY.common).copies));
  const UPGRADE_COST = [0, 5, 7, 8, 9, 10, 0];
  const BOT_NAMES = ["Brannoch", "Mirelda", "Old Tusk", "Vexa", "Grindle", "Sable", "Quillon", "Hobb", "Ysolde", "Kettle", "Morrow", "Tamsin"];
  const HERO_HUES = [18, 200, 140, 280, 45, 330, 170, 95, 240, 0];

  // ---------------------------------------------------------------- heroes
  // A hero has its own Health and a hero power: "active" (pay gold, once per turn, may need a target)
  // or "passive" (fires on tavern triggers, or at the start of combat).
  const DEFAULT_HEROES = [
    { id: "h_marshal", name: "Marshal Varga", health: 30, power: { name: "Drill", type: "active", cost: 1, abilities: [{ trigger: "cast", action: "buff", target: "chosen", a: 1, h: 2 }] } },
    { id: "h_tinker", name: "Tinker Ollo", health: 30, power: { name: "Scrap Plans", type: "active", cost: 2, abilities: [{ trigger: "cast", action: "discover", tierMode: "current" }] } },
    { id: "h_sela", name: "Captain Sela", health: 28, power: { name: "Fence", type: "passive", abilities: [{ trigger: "onSellOther", action: "gold", n: 1, every: 2 }] } },
    { id: "h_pyre", name: "Pyre Witch", health: 30, power: { name: "Kindling", type: "passive", abilities: [{ trigger: "startOfCombat", action: "damage", target: "randomEnemy", count: 2, n: 1, fx: "fire" }] } },
    { id: "h_moss", name: "Gardener Moss", health: 30, power: { name: "Pruning", type: "passive", abilities: [{ trigger: "endOfTurn", action: "buff", target: "leftmost", a: 1, h: 1, fx: "nature" }] } },
    { id: "h_gil", name: "Warden Gil", health: 32, power: { name: "Stand Firm", type: "active", cost: 1, abilities: [{ trigger: "cast", action: "keyword", target: "chosen", kw: "taunt" }, { trigger: "cast", action: "buff", target: "chosen", a: 0, h: 3 }] } },
    { id: "h_pell", name: "Merchant Pell", health: 30, power: { name: "Haggle", type: "passive", abilities: [{ trigger: "gameStart", action: "ruleBuy", n: -1 }, { trigger: "gameStart", action: "ruleShop", n: -1 }] } },
    { id: "h_ira", name: "Goldsmith Ira", health: 30, power: { name: "Gild", type: "active", cost: 3, abilities: [{ trigger: "cast", action: "goldenShop", count: 1 }] } },
    { id: "h_vael", name: "Seer Vael", health: 30, power: { name: "Glimpse", type: "active", cost: 2, abilities: [{ trigger: "cast", action: "refreshUp", n: 1 }] } },
    { id: "h_nox", name: "Mimic Nox", health: 30, power: { name: "Echo", type: "passive", abilities: [{ trigger: "afterLoss", action: "copyOpponent", count: 1 }] } },
    { id: "h_duke", name: "Iron Duke", health: 25, power: { name: "Plating", type: "passive", abilities: [{ trigger: "gameStart", action: "armor", n: 12 }] } },
    { id: "h_pim", name: "Pickpocket Pim", health: 28, power: { name: "Light Fingers", type: "passive", abilities: [{ trigger: "startOfTurn", action: "stealGold", n: 1, every: 2 }] } },
    { id: "h_echo", name: "Echo the Bard", health: 30, power: { name: "Encore", type: "passive", abilities: [{ trigger: "onPlayBattlecry", action: "repeatBattlecry", every: 3 }] } },
    { id: "h_rook", name: "Rook the Gambler", health: 30, power: { name: "Loaded Dice", type: "active", cost: 1, abilities: [{ trigger: "cast", action: "goldRandom", n: 3 }] } },
    { id: "h_vex", name: "Mama Vex", health: 30, power: { name: "Feeding Time", type: "active", cost: 2, abilities: [{ trigger: "cast", action: "devour", target: "chosen", count: 1 }] } },
    { id: "h_heir", name: "The Heir", health: 30, power: { name: "Inheritance", type: "passive", abilities: [{ trigger: "onSellOther", action: "passStats", target: "randomFriend", count: 1 }] } },
    { id: "h_wren", name: "Wren the Weaver", health: 30, power: { name: "Reweave", type: "active", cost: 1, abilities: [{ trigger: "cast", action: "setTribe", target: "chosen", toTribe: "?" }, { trigger: "cast", action: "buff", target: "chosen", a: 1, h: 1 }] } },
  ];
  // Anomalies change the rules for every player in a game ("Anomaly" mode). Their effects run for each
  // player like a passive hero power; "sharedPick" runs once for the whole lobby.
  const DEFAULT_ANOMALIES = [
    { id: "an_gift", name: "Gift Exchange", abilities: [{ trigger: "startOfTurn", action: "sharedPick", pickTier: "any", pct: 25, count: 3 }] },
    { id: "an_bargain", name: "Bargain Bin", abilities: [{ trigger: "gameStart", action: "ruleBuy", n: -1 }], banHeroes: ["h_pell"] },
    { id: "an_gilded", name: "Gilded Tavern", abilities: [{ trigger: "gameStart", action: "ruleGolden", pct: 12 }], banHeroes: ["h_ira"] },
    { id: "an_rush", name: "Head Start", abilities: [{ trigger: "gameStart", action: "freeUpgrade" }, { trigger: "gameStart", action: "ruleIncome", n: 1 }] },
    { id: "an_purse", name: "Deep Pockets", abilities: [{ trigger: "gameStart", action: "ruleMaxGold", n: 5 }, { trigger: "gameStart", action: "ruleBank", n: 3 }] },
    { id: "an_market", name: "Grand Market", abilities: [{ trigger: "gameStart", action: "ruleShop", n: 2 }, { trigger: "gameStart", action: "ruleDiscover", n: 1 }] },
    { id: "an_iron", name: "Iron Heroes", abilities: [{ trigger: "gameStart", action: "armor", n: 15 }], banHeroes: ["h_duke"] },
    { id: "an_spells", name: "Spell Storm", abilities: [{ trigger: "startOfTurn", action: "addSpell", count: 1 }] },
    { id: "an_blood", name: "Blood Moon", abilities: [{ trigger: "startOfCombat", action: "damage", target: "allEnemies", n: 1, fx: "shadow" }] },
    { id: "an_topsy", name: "Topsy-Turvy", abilities: [{ trigger: "startOfCombat", action: "swapStats", target: "allFriends" }] },
    { id: "an_fair", name: "Tribal Fair", abilities: [{ trigger: "startOfTurn", action: "tribeShop", tribeMode: "random", every: 2 }] },
    { id: "an_fortune", name: "Fortune Teller", abilities: [{ trigger: "startOfTurn", action: "discover", tierMode: "random", every: 3 }] },
    { id: "an_blessing", name: "Wild Blessings", abilities: [{ trigger: "startOfCombat", action: "randomKeyword", target: "randomFriend", count: 2 }] },
    { id: "an_sale", name: "Grand Opening", abilities: [{ trigger: "startOfTurn", action: "freeBuy", n: 1, every: 3 }] },
    { id: "an_mirror", name: "Mirror Match", abilities: [{ trigger: "afterLoss", action: "copyOpponent", count: 1 }], banHeroes: ["h_nox"] },
  ];
  const ANOMALIES = {}, ANOMALY_LIST = [];
  function setAnomalies(list) {
    ANOMALY_LIST.length = 0;
    for (const k in ANOMALIES) delete ANOMALIES[k];
    for (const a of list || DEFAULT_ANOMALIES) {
      if (!a || !a.id || ANOMALIES[a.id]) continue;
      ANOMALIES[a.id] = { id: a.id, name: a.name || "Anomaly", abilities: a.abilities || [], text: a.text || "", banHeroes: Array.isArray(a.banHeroes) ? a.banHeroes.slice() : [] };
      ANOMALY_LIST.push(a.id);
    }
  }
  function anomalyText(id) {
    const a = ANOMALIES[id]; if (!a) return "";
    if (a.text) return a.text;
    if (LANG === "fr") return a.abilities.map((ab) => frTidy(abilityText(ab, false)).replace(/^Au début de la partie, /, "").replace(/^Au début de votre tour, un joueur/, "Au début de chaque tour, un joueur").replace(/^Au début de votre tour/, "Au début de chaque tour")).map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(" ");
    return a.abilities.map((ab) => abilityText(ab, false).replace(/\banother (minion|friendly)/g, "a $1").replace(/\byour other /g, "your ").replace(/random other friendly/g, "random friendly").replace(/^At the start of the game, /, "").replace(/^At the start of your turn, one player/, "At the start of every turn, one player").replace(/^At the start of your turn/, "At the start of each turn")).map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(" ");
  }
  const HEROES = {}, HERO_LIST = [];
  const HERO_TRIGGERS = ["gameStart", "startOfTurn", "endOfTurn", "onBuy", "onBuyFrozen", "onBuySpell", "onSellOther", "onPlayOther", "onPlayBattlecry", "onSpell", "onRoll", "onFreeze", "afterUpgrade", "onTriple", "afterWin", "afterLoss", "afterCombat", "onDiscover", "startOfCombat"];
  function setHeroes(list) {
    HERO_LIST.length = 0;
    for (const k in HEROES) delete HEROES[k];
    for (const h of list || DEFAULT_HEROES) {
      if (!h || !h.id || HEROES[h.id]) continue;
      const pw = h.power || {};
      HEROES[h.id] = { id: h.id, name: h.name || "Hero", health: Math.max(10, Math.min(60, h.health | 0 || 30)), img: h.img || null,
        power: { name: pw.name || "Hero power", type: pw.type === "passive" ? "passive" : "active", cost: Math.max(0, Math.min(10, pw.cost | 0)), abilities: pw.abilities || [], text: pw.text || "" } };
      HERO_LIST.push(h.id);
    }
  }
  const frTidy = (t) => t.replace(/\bun autre serviteur allié aléatoire\b/g, "un serviteur allié aléatoire").replace(/\bune autre (\S+) alliée aléatoire\b/g, "une $1 alliée aléatoire").replace(/\bun autre (\S+) allié aléatoire\b/g, "un $1 allié aléatoire").replace(/\bvos autres /g, "vos ").replace(/^Après avoir vendu une? autre /, (m) => m.replace(" autre", "")).replace(/^Après avoir vendu (\d+) autres /, "Après avoir vendu $1 ");
  function heroPowerText(id) {
    const h = HEROES[id]; if (!h) return "";
    if (h.power.text) return h.power.text;
    if (LANG === "fr") return h.power.abilities.map((ab) => frTidy(abilityText(ab, false)).replace(/^Au début de la partie, (\w)/, (x, c) => (/^rule/.test(ab.action) ? c.toUpperCase() : "Au début de la partie, " + c))).join(" ");
    return h.power.abilities.map((ab) => abilityText(ab, false).replace(/\banother (minion|friendly)/g, "a $1").replace(/^After you sell another /, "After you sell a ").replace(/\byour other /g, "your ").replace(/random other friendly/g, "random friendly")
      .replace(/^At the start of the game, (\w)/, (x, c) => (/^rule/.test(ab.action) ? c.toUpperCase() : "At the start of the game, " + c))).join(" ");
  }

  class Player {
    // the first gauge affinity's pool (Steam's Pressure by default): the old name, kept for convenience
    get pressure() { const a = affsOfKind("gauge")[0]; return a ? this.gauges[a] || 0 : 0; }
    set pressure(v) { const a = affsOfKind("gauge")[0]; if (a) this.gauges[a] = v; }
    constructor(id, name, isBot) {
      Object.assign(this, {
        id, name, isBot, health: START_HEALTH, alive: true, placement: 0,
        tier: 1, upgradeCost: UPGRADE_COST[1], gold: 0, maxGold: 0,
        board: [], hand: [], shop: [], shopSpell: null, frozen: false, discover: [], discoverQ: [], discoverGolden: false, evolveChoices: [], picks: [],
        lastOpponent: -1, lastResult: "", streak: 0, hue: 0, mmr: 0, skill: 0.5,
        hero: "", heroChoices: [], powerUsed: false, heroCtr: {}, anoCtr: {}, heroStarted: false, uidBase: 1000000 * (id + 1), uidN: 0,
        mods: {}, armor: 0, tribePick: [], freeBuys: 0,
        nextGold: 0, nextCombat: null, freeRolls: 0, shopBuff: 0, spellsCast: 0, lastBoard: [], doubleNext: 0, battlecries: 0, devours: 0, nextSpell2: 0, nextBc2: 0, nextBuy: [], nextPlay: [], nextSell: [],
        played: 0, playedT: {}, playedTurn: 0, playedTurnT: {}, spellsTurn: 0, sold: 0, bought: 0,
        gauges: {}, affCtr: {}, found: [0, 0, 0, 0, 0, 0, 0], refluxUsed: 0, pulseNext2: 0, // affinities: Steam's Pressure, Earth's Foundations per board slot, Water's Ebbs this turn
      });
    }
    // t = "" counts the Neutrals (the bots have always treated "no tribe" as a tribe of its own)
    tribeCount(t) { return this.board.filter(m => (t ? hasTribe(m, t) : !tribesOf(m).length)).length; }
    // the best tribe count among a card's tribes (for the bots)
    tribeFit(o) { const ts = tribesOf(o); if (!ts.length) return this.tribeCount(""); let b = 0; for (const t of ts) b = Math.max(b, this.tribeCount(t)); return b; }
  }

  // MMR change for a finishing place. Better than the lobby earns more.
  function mmrDelta(place, mmr, lobbyAvg) {
    const base = [145, 100, 60, 22, -22, -60, -100, -145][place - 1] || 0;
    const adj = Math.max(-40, Math.min(40, (lobbyAvg - mmr) / 40));
    return Math.round(base + adj);
  }
  const RANKS = [[0, "Copper"], [2500, "Bronze"], [4000, "Silver"], [5500, "Gold"], [7000, "Platinum"], [8500, "Diamond"], [10000, "Legend"]];
  function rankOf(mmr) {
    let i = 0;
    for (let k = 0; k < RANKS.length; k++) if (mmr >= RANKS[k][0]) i = k;
    const lo = RANKS[i][0], hi = RANKS[i + 1] ? RANKS[i + 1][0] : null;
    return { name: RANKS[i][1], index: i, progress: hi ? (mmr - lo) / (hi - lo) : 1, next: hi, nextName: RANKS[i + 1] ? RANKS[i + 1][1] : "" };
  }
  // Bots are never clueless: even at low rating they plan, and they get sharper as rating climbs.
  const skillFor = (mmr) => Math.max(0.3, Math.min(1, 0.3 + ((mmr - 1500) / 9000) * 0.7));

  class Game {
    constructor(numPlayers = 8, seed = null, withHuman = true, opts = {}) {
      this.seed = seed == null ? Math.floor(Math.random() * 1e9) : seed;
      this.rng = makeRng(this.seed);
      nextUid = 1; // both ends of an online game must number minions the same way
      // seats played by people: the first one by default; an online duo passes [0, 1]
      this.humans = opts.humans || (withHuman ? [0] : []);
      const mmr = opts.mmr == null ? 3000 : opts.mmr;
      const tribes = [...TRIBES]; this.shuffle(tribes);
      const avail = availableTribes();
      this.tribes = opts.tribes || tribes.filter((t) => avail.includes(t)).slice(0, 5).sort((a, b) => TRIBES.indexOf(a) - TRIBES.indexOf(b));
      this.pool = {};
      for (const id in CARDS) if (CARDS[id].inPool !== false && this.inLobby(CARDS[id])) this.pool[id] = copiesOf(CARDS[id]);
      const names = [...BOT_NAMES]; this.shuffle(names);
      this.players = [];
      for (let i = 0; i < numPlayers; i++) {
        const human = this.humans.includes(i);
        const p = new Player(i, human ? (opts.names && opts.names[i]) || "You" : names[i % names.length], !human);
        p.hue = HERO_HUES[(i * 3) % HERO_HUES.length];
        p.mmr = human ? mmr : Math.max(0, Math.round(mmr + (this.rng.next() + this.rng.next() + this.rng.next() - 1.5) * 700));
        p.skill = skillFor(p.mmr);
        this.players.push(p);
      }
      this.lobbyAvg = Math.round(this.players.reduce((t, p) => t + p.mmr, 0) / this.players.length);
      // heroes: bots get one each (different while there are enough), the human is offered up to three
      // an anomaly can ban heroes that would be too strong under its rules
      const anom = (opts.anomaly && ANOMALIES[opts.anomaly]) || null;
      const allowed = HERO_LIST.filter((id) => !(anom && anom.banHeroes.includes(id)));
      this.heroPool = allowed.length ? allowed : [...HERO_LIST];
      if (this.heroPool.length) {
        const deck = [...this.heroPool]; this.shuffle(deck);
        this.players.forEach((p, i) => { if (p.isBot) this.setHero(p, deck[i % deck.length]); });
        for (const human of this.players.filter((p) => !p.isBot)) { const pool = [...this.heroPool]; this.shuffle(pool); human.heroChoices = pool.slice(0, 3); this.setHero(human, human.heroChoices[0]); }
      }
      this.anomaly = (opts.anomaly && ANOMALIES[opts.anomaly]) || null;
      // Duos: players 0+1, 2+3, ... share one Health pool and fight as a relay
      this.duo = !!opts.duo && numPlayers >= 4 && numPlayers % 2 === 0;
      this.pace = opts.pace === "long" || opts.pace === "epic" ? opts.pace : "normal";
      for (const p of this.players) { p.health += this.healthBonus(); p.maxHealth = p.health; }
      this.teams = [];
      if (this.duo) {
        for (let i = 0; i < numPlayers; i += 2) {
          const t = { id: i / 2, members: [this.players[i], this.players[i + 1]], health: 0, armor: 0, alive: true, placement: 0, lastOpp: -1 };
          t.members.forEach((p) => { p.team = t.id; });
          this.teams.push(t);
        }
        // the human's partner shares the human's lobby rating
        for (const t of this.teams) this.teamHealth(t);
      }
      this.sharedPick = null; this.lastShared = null; this.sharedCtr = {};
      this.turn = 0;
      this.lastDead = null;
      this.nextPairs = null;
    }

    human() { return this.players.find(p => !p.isBot); }
    // Each player shops with a random stream of their own, so two people acting at the same time can
    // apply each other's actions in any order and still land on the same game (online duos).
    rngOf(p) { return p.rng || (p.rng = makeRng((this.seed ^ (p.id + 1) * 0x9E3779B1) >>> 0)); }
    // The tavern pool is shared, but during the shopping phase each person draws from a private view of it
    // (taken once the bots are done). Their own takes and returns update both; the views are dropped at the
    // start of the next turn. So the order in which two people act never changes what they draw.
    viewOf(p) { return (p && p.poolView) || this.pool; }
    take(id, view) { view[id]--; if (view !== this.pool) this.pool[id]--; }
    give(id, n, view) { this.pool[id] += n; if (view && view !== this.pool) view[id] += n; }
    snapViews() { for (const p of this.players) p.poolView = p.isBot || !p.alive ? null : Object.assign({}, this.pool); }
    shuffleWith(rng, arr) { for (let i = arr.length - 1; i > 0; i--) { const j = rng.int(0, i); [arr[i], arr[j]] = [arr[j], arr[i]]; } }
    // neutral cards always; tribal cards when one of their tribes is in this lobby
    inLobby(d) { const ts = tribesOf(d); return !ts.length || ts.some((t) => this.tribes.includes(t)); }
    teamOf(p) { return this.duo && p ? this.teams[p.team] : null; }
    mateOf(p) { const t = this.teamOf(p); return t ? t.members.find((x) => x !== p) : null; }
    // a duo shares Health: the average of the two heroes, plus 10
    teamHealth(t) { t.health = Math.round((t.members[0].health + t.members[1].health) / 2) + 10; this.syncTeam(t); }
    syncTeam(t) { for (const p of t.members) { p.health = t.health; p.armor = t.armor; p.maxHealth = Math.max(p.maxHealth || 0, t.health); } }
    addHealth(p, n) {
      const t = this.teamOf(p);
      if (t) { t.health = Math.max(1, Math.min(80, t.health + n)); this.syncTeam(t); }
      else p.health = Math.max(1, Math.min(60, p.health + n));
    }
    addArmor(p, n) {
      const t = this.teamOf(p);
      if (t) { t.armor = Math.max(0, Math.min(99, t.armor + n)); this.syncTeam(t); }
      else p.armor = Math.max(0, Math.min(99, (p.armor || 0) + n));
    }
    setHero(p, id) {
      const h = HEROES[id]; if (!h) return "That hero is not in this meta.";
      p.hero = id; p.health = h.health + this.healthBonus(); p.maxHealth = p.health;
      const t = this.teams && this.teamOf(p);
      if (t && this.turn <= 1) { const o = t.members.find((x) => x !== p); const oh = o.hero && HEROES[o.hero] ? HEROES[o.hero].health : 30; t.health = Math.round((h.health + oh) / 2) + 10; this.syncTeam(t); }
      return "";
    }
    // Use an active hero power. target = board index when the power needs a chosen minion.
    // an active power whose effects are all "once per game" is spent once they have run
    powerSpent(p) {
      const h = HEROES[p.hero];
      return !!(h && h.power.type === "active" && h.power.abilities.length && h.power.abilities.every((ab, i) => ab.limit === "game" && p.lim && p.lim["h" + i] != null));
    }
    usePower(p, target = -1) {
      const h = HEROES[p.hero];
      if (!h || h.power.type !== "active") return "Your hero has no power to use.";
      if (this.powerSpent(p)) return `${h.power.name} can only be used once per game.`;
      if (p.powerUsed) return "You already used your hero power this turn.";
      if (p.gold < h.power.cost) return `You need ${h.power.cost} gold for ${h.power.name}.`;
      const needs = h.power.abilities.some((ab) => ab.target === "chosen"), t = p.board[target];
      if (needs && !t) return `Drag ${h.power.name} onto one of your minions.`;
      this.lastEffects = []; this.lastTriple = [];
      p.gold -= h.power.cost; p.powerUsed = true;
      h.power.abilities.forEach((ab, i) => { if (!limitHit(ab, "h" + i, p, this.turn)) this.applyTavernAb(p, null, ab, t || null); });
      return "";
    }
    // passive hero powers and the anomaly's per-player effects
    heroTrig(p, trig, src = null, which = "both") {
      const h = HEROES[p.hero];
      const run = (list, ctr, tag) => list.forEach((ab, i) => {
        if (ab.trigger !== trig || ab.action === "sharedPick") return;
        if (!gate(ab, i, null, src, p.board, ctr, { turn: this.turn, health: p.health, p })) return;
        if (limitHit(ab, tag + i, p, this.turn)) return;
        this.applyTavernAb(p, null, ab, src);
      });
      if (which !== "anomaly" && h && h.power.type === "passive") run(h.power.abilities, p.heroCtr, "h");
      if (which !== "hero" && this.anomaly) run(this.anomaly.abilities, p.anoCtr, "a");
      if (which === "both") this.affTrig(p, trig, src);
    }
    // an affinity's own effects, for the player whose board reaches the level each one needs
    affTrig(p, trig, src) {
      if (trig === "startOfCombat") return;
      for (const a of AFFS) {
        const d = AFF[a]; if (!d.effects || !d.effects.length) continue;
        const lv = affLevel(p.board, a); if (!lv) continue;
        const ctr = (p.affCtr || (p.affCtr = {}))[a] || (p.affCtr[a] = {});
        d.effects.forEach((ab, i) => {
          if ((ab.alv || 1) > lv || ab.trigger !== trig || ab.action === "sharedPick") return;
          if (!gate(ab, i, null, src, p.board, ctr, { turn: this.turn, health: p.health, p })) return;
          if (limitHit(ab, "f" + a + ":" + i, p, this.turn)) return;
          this.applyTavernAb(p, null, ab, src);
        });
      }
    }
    // Growth: end of turn, for good
    affGrowth(p) {
      for (const a of affsOfKind("growth")) {
        const v = affVal(a, affLevel(p.board, a)); if (v <= 0) continue;
        const ts = p.board.filter((m) => hasAff(m, a)); if (!ts.length) continue;
        const [ga, gh] = statAH(a, v); ts.forEach((m) => m.buff(ga, gh));
        this.lastEffects.push({ uids: ts.map((m) => m.uid), a: ga, h: gh, source: -1, label: affMech(a) });
      }
    }
    // Resonance: playing one gives the others of its affinity stats
    affResonance(p, m) {
      for (const a of affsOf(m)) {
        if (!AFF[a] || AFF[a].kind !== "resonance") continue;
        const v = affVal(a, affLevel(p.board, a)); if (v <= 0) continue;
        const ts = p.board.filter((o) => o !== m && o.health > 0 && hasAff(o, a)); if (!ts.length) continue;
        const [ra, rh] = statAH(a, v); ts.forEach((o) => o.buff(ra, rh));
        this.lastEffects.push({ uids: ts.map((o) => o.uid), a: ra, h: rh, source: m.uid, label: affMech(a), aff: a });
      }
    }
    // Spread: at the end of the turn, other minions catch it (if they have room for an affinity)
    affSpread(p) {
      for (const a of affsOfKind("spread")) {
        const v = affVal(a, affLevel(p.board, a)); if (v <= 0) continue;
        const cand = p.board.filter((m) => m.health > 0 && !hasAff(m, a) && (m.aff || []).length < 2);
        const got = pickN(this.rngOf(p), cand, v).filter((m) => giveAff(m, a));
        if (got.length) this.lastEffects.push({ uids: got.map((m) => m.uid), a: 0, h: 0, source: -1, label: affMech(a), aff: a });
      }
    }
    // Lure: the tavern always offers some minions of the affinity (others are swapped for them)
    affLure(p, top) {
      const lures = affsOfKind("lure"); if (!lures.length || !AFF_ON) return;
      const rng = this.rngOf(p), view = this.viewOf(p);
      for (const a of lures) {
        let need = Math.min(p.shop.length, affVal(a, affLevel(p.board, a))) - p.shop.filter((m) => hasAff(m, a)).length;
        while (need-- > 0) {
          const slots = p.shop.map((m, i) => i).filter((i) => !p.shop[i].golden && !lures.some((b) => hasAff(p.shop[i], b)));
          if (!slots.length) break;
          const id = this.draw(top, 0, rng, view, (x) => (CARDS[x].aff || []).includes(a)); if (!id) break;
          const i = slots[rng.int(0, slots.length - 1)];
          this.returnToPool([p.shop[i]]);
          const nm = new Minion(id); if (p.shopBuff) nm.buff(p.shopBuff, p.shopBuff); p.shop[i] = nm;
        }
      }
    }
    // Bargain: free refreshes left this turn
    bargainLeft(p) { let n = 0; for (const a of affsOfKind("bargain")) n += affVal(a, affLevel(p.board, a)); return Math.max(0, n - (p.bargainUsed || 0)); }
    // when an action wakes up or grows one of your affinities: "When one of your affinities wakes up or grows"
    affUpCheck(p, before) {
      const now = affState(p.board), up = AFFS.filter((a) => now[a].lv > (before[a] ? before[a].lv : 0)); if (!up.length) return;
      this.lastEffects = this.lastEffects || [];
      for (const a of up) for (const m of [...p.board]) if (m.health > 0 && hasTrig(m, "onAffUp")) this.runTavernAb(p, m, "onAffUp", null);
    }
    // Fortune: gold at the start of the turn
    affWealth(p) {
      let g = 0; for (const a of affsOfKind("wealth")) g += affVal(a, affLevel(p.board, a));
      if (g > 0) { p.gold += g; p.affGold = g; } else p.affGold = 0;
    }
    // the human picks a hero after the first tavern opened: run its "start of the game" effects then
    confirmHero(p, id) {
      const err = this.setHero(p, id); if (err) return err;
      if (p.heroStarted || this.turn !== 1) return "";
      p.heroStarted = true;
      const before = JSON.stringify(p.mods);
      this.inGameStart = true; this.heroTrig(p, "gameStart", null, "hero"); this.inGameStart = false;
      p.maxGold = this.goldCap(p); p.gold = Math.max(0, p.maxGold + p.nextGold + (p.mods.income || 0)); p.nextGold = 0;
      if (JSON.stringify(p.mods) !== before) this.refill(p);
      return "";
    }
    goldCap(p) { return Math.max(1, Math.min(2 + this.turn, MAX_GOLD + (p.mods.maxGold || 0))); }
    addMod(p, key, n) {
      p.mods = Object.assign({}, p.mods, { [key]: (p.mods[key] || 0) + n });
      if (key === "upgrade" && p.tier < MAX_TIER) p.upgradeCost = Math.max(0, p.upgradeCost + n);
    }
    upCost(p) { return Math.max(0, UPGRADE_COST[p.tier] + (p.mods.upgrade || 0)); }
    hurt(p, d) {
      d = Math.max(0, d + (p.mods.damage || 0));
      if (d <= 0) return;
      const t = this.teamOf(p);
      if (t) { const a = Math.min(t.armor, d); t.armor -= a; t.health -= d - a; this.syncTeam(t); return; }
      const a = Math.min(p.armor || 0, d); p.armor -= a; p.health -= d - a;
    }
    // bots and timeouts: a sensible tribe to turn minions into
    bestTribe(p) {
      const c = {};
      for (const m of p.board) for (const t of tribesOf(m)) if (this.tribes.includes(t)) c[t] = (c[t] || 0) + 1;
      const best = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
      return best || this.tribes[0] || "";
    }
    chooseTribe(p, tribe) {
      const pick = p.tribePick.shift(); if (!pick) return "Nothing to choose.";
      if (!this.tribes.includes(tribe)) tribe = this.bestTribe(p);
      const l = [...p.board, ...p.hand].filter((m) => !m.isSpell && pick.uids.includes(m.uid));
      l.forEach((m) => m.setTribe(tribe));
      this.lastEffects = [{ uids: l.map((m) => m.uid), a: 0, h: 0, label: TN(tribe), source: -1 }];
      return "";
    }
    // Anomaly: one player picks a minion, everyone gets a copy
    runSharedPick(ab) {
      const alive = this.alive(); if (!alive.length) return;
      const chooser = alive[(this.turn - 1) % alive.length];
      const tier = ab.pickTier === "current" ? chooser.tier : ab.pickTier === "up" ? Math.min(MAX_TIER, chooser.tier + 1) : 0;
      const ids = Object.keys(CARDS).filter((id) => CARDS[id].inPool !== false && (!tier || CARDS[id].tier === tier) && this.inLobby(CARDS[id]));
      const options = pickN(this.rng, ids, Math.max(1, Math.min(5, ab.count || 3))).map((id) => ({ id, golden: this.rng.next() * 100 < (ab.pct || 0) }));
      if (!options.length) return;
      this.sharedPick = { chooser: chooser.id, options };
      if (chooser.isBot) this.chooseShared(this.botShared(chooser, options));
    }
    botShared(p, options) {
      let best = 0, bs = -1e9;
      options.forEach((o, i) => { const d = CARDS[o.id], sc = d.tier * 3 + (o.golden ? 7 : 0) + p.tribeFit(d) * 2 + (d.attack + d.health) * 0.3; if (sc > bs) { bs = sc; best = i; } });
      return best;
    }
    chooseShared(i) {
      const sp = this.sharedPick; if (!sp) return "Nothing to pick.";
      const o = sp.options[Math.max(0, Math.min(i, sp.options.length - 1))];
      this.sharedPick = null;
      const chooser = this.players.find((x) => x.id === sp.chooser);
      this.lastShared = { by: chooser ? chooser.name : "", byId: sp.chooser, id: o.id, golden: o.golden, turn: this.turn, uids: {} };
      for (const p of this.alive()) {
        if (p.hand.length >= HAND_MAX) continue;
        const m = new Minion(o.id, o.golden); m.poolCost = 0;
        p.hand.push(m); this.lastShared.uids[p.id] = m.uid;
        const t = this.checkTriples(p);
        if (!p.isBot) this.lastTriple = t;
      }
      if (sp.botsWaiting) { sp.botsWaiting = false; this.botTurns(); }
      return "";
    }
    botTurns() {
      for (const p of this.alive()) {
        if (!p.isBot) continue;
        if (this.duo) this.botPass(p, false);
        (p.oldBot ? BotV1 : Bot).takeTurn(this, p);
        if (this.duo) this.botPass(p, true);
      }
      if (this.duo) for (const p of this.alive()) if (p.isBot && p.needsPlay) this.botPlace(p);
      this.snapViews();
    }
    // passive "Start of Combat" hero powers become strikes and rallies for that fight
    heroPrep(p) {
      const h = HEROES[p.hero];
      const base = p.nextCombat ? { a: p.nextCombat.a, h: p.nextCombat.h, strikes: p.nextCombat.strikes.slice() } : { a: 0, h: 0, strikes: [] };
      const add = (list, ctr) => { for (const [i, ab] of list.entries()) {
        if (ab.trigger !== "startOfCombat" || !gate(ab, i, null, null, p.board, ctr, { turn: this.turn, health: p.health, p })) continue;
        if (ab.action === "damage") base.strikes.push({ n: ab.n || 0, all: ab.target === "allEnemies", count: ab.count || 1, fx: ab.fx || "" });
        else if (ab.action === "buff" || ab.action === "permBuff") { base.a += ab.a || 0; base.h += ab.h || 0; }
        else if (ab.action === "swapStats") base.swap = true;
        else if (ab.action === "randomKeyword") base.kw = (base.kw || 0) + (ab.count || 1);
      } };
      if (h && h.power.type === "passive") add(h.power.abilities, p.heroCtr);
      if (this.anomaly) add(this.anomaly.abilities, p.anoCtr);
      return base.a || base.h || base.strikes.length || base.swap || base.kw ? base : null;
    }
    alive() { return this.players.filter(p => p.alive); }
    // a cheap fingerprint of everything that matters, to compare two ends of an online game
    fingerprint() {
      let h = 2166136261 >>> 0;
      const mix = (v) => { const str = String(v); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
      mix(this.turn); mix(nextUid); for (const p of this.players) { mix(p.uidN); for (const m of p.inbox || []) mix("in" + m.uid); }
      for (const p of this.players) { mix(p.id); mix(p.health); mix(p.gold); mix(p.tier); mix(p.alive ? 1 : 0); mix("pr" + JSON.stringify(p.gauges || {}) + "f" + (p.found || []).join("") + "r" + (p.refluxUsed || 0) + "p" + (p.pulseNext2 || 0)); for (const m of p.board) mix(`${m.uid}:${m.cardId}:${m.attack}/${m.health}:${m.golden ? 1 : 0}`); for (const m of p.hand) mix(`${m.uid}:${m.cardId || m.spellId}`); for (const m of p.shop) mix(`${m.uid}:${m.cardId}`); }
      return h.toString(16);
    }
    isOver() { return this.duo ? this.teams.filter((t) => t.alive).length <= 1 : this.alive().length <= 1; }
    spellIds(maxTier) { return Object.keys(SPELLS).filter(id => SPELLS[id].tier <= maxTier && SPELLS[id].inPool !== false); }

    startTurn() {
      this.turn++;
      for (const p of this.players) p.poolView = null;
      if (this.turn === 1) {
        // "At the start of the game": the anomaly for everyone, hero powers for heroes already settled
        this.inGameStart = true;
        for (const p of this.alive()) {
          const pending = !p.isBot && p.heroChoices.length > 1;
          if (!pending) p.heroStarted = true;
          this.heroTrig(p, "gameStart", null, pending ? "anomaly" : "both");
        }
        this.inGameStart = false;
      }
      for (const p of this.alive()) {
        const left = this.turn > 1 ? Math.min(p.gold, p.mods.bank || 0) : 0;
        p.maxGold = this.goldCap(p);
        p.gold = Math.max(0, p.maxGold + p.nextGold + (p.mods.income || 0) + left);
        p.nextGold = 0;
        if (this.turn > 1 && p.tier < MAX_TIER) p.upgradeCost = Math.max(0, p.upgradeCost - 1);
        if (p.frozen) {
          const [fa, fh] = passiveAH(p.board, "frozenBuff");
          if (fa || fh) p.shop.forEach((x) => x.buff(fa, fh));
          p.frozen = false;
          this.fill(p, 0, true); // the frozen minions stay, and fresh ones top the tavern up to its current size
        } else {
          const iced = p.shop.filter((x) => x.ice), [fa, fh] = passiveAH(p.board, "frozenBuff");
          this.refill(p);
          if (fa || fh) iced.forEach((x) => x.buff(fa, fh)); // minions Frozen one by one grow too
        }
        for (const m of p.shop) m.ice = false; // they stayed for this turn: thawed now
      }
      for (const p of this.alive()) {
        p.powerUsed = false; p.playedTurn = 0; p.playedTurnT = {}; p.spellsTurn = 0; p.refluxUsed = 0; p.bargainUsed = 0;
        // keep what happened to each player as the turn opened, so the table can show it
        this.lastEffects = []; this.lastTriple = []; this.lastDevour = [];
        this.affWealth(p);
        for (const m of [...p.board]) if (m.evoReady) { m.evoReady = false; this.fireEvolve(p, m); }
        if ((p.later || []).length) { const due = p.later.filter((x) => x.turn <= this.turn); p.later = p.later.filter((x) => x.turn > this.turn);
          for (const x of due) { const m = x.uid === -1 ? null : p.board.find((o) => o.uid === x.uid) || p.hand.find((o) => o.uid === x.uid); if (x.uid !== -1 && !m) continue; this.applyTavernAb(p, m, x.ab, null); } }
        if (p.evoCheckNext) { p.evoCheckNext = false; this.checkEvolve(p); }
        this.heroTrig(p, "startOfTurn");
        const sotTimes = 1 + passive(p.board, "extraStartOfTurn");
        for (let rep = 0; rep < sotTimes; rep++) for (const m of [...p.board]) if (hasTrig(m, "startOfTurn")) this.runTavernAb(p, m, "startOfTurn");
        p.startFx = { effects: this.lastEffects.slice(), triple: (this.lastTriple || []).slice(), devour: (this.lastDevour || []).slice(), turn: this.turn };
      }
      this.lastEffects = []; this.lastTriple = []; this.lastDevour = [];
      // pairings first, so bots can look at the board they will fight
      if (this.duo) this.pairTeams(); else this.nextPairs = this.makePairs(this.alive());
      this.lastShared = null;
      if (this.anomaly) this.anomaly.abilities.forEach((ab, i) => {
        if (ab.action !== "sharedPick" || ab.trigger !== "startOfTurn" || this.sharedPick) return;
        if (!gate(ab, i, null, null, [], this.sharedCtr)) return;
        this.runSharedPick(ab);
      });
      // a human picks for everyone: bots wait for that choice before they shop
      if (this.sharedPick) { this.sharedPick.botsWaiting = true; return; }
      this.botTurns();
    }

    nextOpponentOf(p) {
      if (!this.nextPairs) return null;
      for (const [a, b] of this.nextPairs) { if (a === p) return b; if (b === p) return a; }
      return null;
    }

    endOfTurnEffects() {
      this.evoDefer = true;
      try { return this.endOfTurnInner(); } finally { this.evoDefer = false; }
    }
    endOfTurnInner() {
      const out = [];
      if (this.sharedPick) this.chooseShared(0);
      for (const p of this.alive()) if (p.inbox && p.inbox.length) this.takeInbox(p);
      if (this.duo) for (const p of this.alive()) if (p.isBot && p.needsPlay) this.botPlace(p);
      for (const p of this.alive()) {
        p.doubleNext = 0;
        while (p.discover.length) this.chooseDiscover(p, 0);
        while ((p.picks || []).length) this.choosePick(p, this.bestPick(p));
        while ((p.evolveChoices || []).length) this.chooseEvolve(p, p.isBot ? this.bestEvolve(p) : 0);
        while (p.tribePick.length) this.chooseTribe(p, this.bestTribe(p));
        { this.lastEffects = []; this.heroTrig(p, "endOfTurn"); if (!p.isBot) out.push(...this.lastEffects); }
        const eotTimes = 1 + passive(p.board, "extraEndOfTurn");
        for (let rep = 0; rep < eotTimes; rep++) {
        for (const m of [...p.board]) {
          if (!hasTrig(m, "endOfTurn")) continue;
          this.lastEffects = [];
          this.runTavernAb(p, m, "endOfTurn");
          if (!p.isBot) out.push(...this.lastEffects);
        }
        for (const m of [...p.board]) {
          if (m.endOfTurn === "buff_random_friend") {
            const t = this.buffRandom(p, m, "", m.n(), m.n());
            if (t && !p.isBot) out.push({ uids: [t.uid], a: m.n(), h: m.n(), source: m.uid });
          } else if (m.endOfTurn === "butcher") {
            this.lastDevour = []; this.lastEffects = [];
            const n = this.devour(p, m, m.mult());
            const ga = this.lastDevour.reduce((t, d) => t + d.a, 0), gh = this.lastDevour.reduce((t, d) => t + d.h, 0);
            if (n && !p.isBot) out.push({ uids: [m.uid], a: ga, h: gh, source: m.uid, label: "Devour", devour: this.lastDevour.slice() });
          } else if (m.endOfTurn === "admiral") {
            const ts = p.board.filter(o => o !== m && hasTribe(o, CORSAIR));
            ts.forEach(o => o.buff(m.n(), m.n()));
            if (ts.length && !p.isBot) out.push({ uids: ts.map(o => o.uid), a: m.n(), h: m.n(), source: m.uid });
          }
        }
        }
        // "you choose" effects raised at end of turn can't wait: the best candidate is taken
        this.lastEffects = []; while ((p.picks || []).length) this.choosePick(p, this.bestPick(p)); if (!p.isBot) out.push(...this.lastEffects);
        this.lastEffects = []; this.checkEvolve(p); if (!p.isBot) out.push(...this.lastEffects);
        this.lastEffects = []; this.earthTurn(p); if (!p.isBot) out.push(...this.lastEffects);
        this.lastEffects = []; this.affGrowth(p); this.affSpread(p); if (!p.isBot) out.push(...this.lastEffects);
      }
      return out;
    }

    // How much a lost fight can cost. "normal" is the classic curve; "long" and "epic" keep the lobby alive longer.
    // In Duo a team fights twice per turn, so each fight is capped lower.
    // longer paces also start everyone with more Health
    healthBonus() { return this.pace === "epic" ? 10 : this.pace === "long" ? 5 : 0; }
    damageCap() {
      const t = this.turn, pace = this.pace;
      let cap = pace === "epic" ? (t <= 3 ? 4 : t <= 6 ? 6 : t <= 9 ? 8 : t <= 12 ? 10 : t <= 15 ? 12 : 15)
        : pace === "long" ? (t <= 3 ? 5 : t <= 6 ? 8 : t <= 9 ? 12 : t <= 12 ? 15 : 20)
        : (t <= 3 ? 5 : t <= 7 ? 10 : 99);
      if (this.duo && pace !== "normal") cap = Math.ceil(cap * 0.6);
      return cap;
    }

    // Duos: which partner fights first alternates every turn
    fightOrder(t) { const m = t.members.filter((p) => p.alive); return this.turn % 2 ? m : m.slice().reverse(); }
    pairTeams() {
      const alive = this.teams.filter((t) => t.alive);
      let best = null, bestRep = 1e9;
      for (let attempt = 0; attempt < 8; attempt++) {
        const order = [...alive]; this.shuffle(order);
        const pairs = []; let rep = 0, i = 0;
        for (; i + 1 < order.length; i += 2) { pairs.push([order[i], order[i + 1]]); if (order[i].lastOpp === order[i + 1].id) rep++; }
        if (i < order.length) pairs.push([order[i], null]);
        if (rep < bestRep) { bestRep = rep; best = pairs; }
        if (!rep) break;
      }
      this.nextTeamPairs = best;
      // player pairs, first fighters against each other, for bots planning and the "Next" tag
      this.nextPairs = [];
      for (const [A, B] of best) {
        const a = this.fightOrder(A), b = B ? this.fightOrder(B) : [];
        this.nextPairs.push([a[0], b[0] || null]);
        if (a[1]) this.nextPairs.push([a[1], b[1] || b[0] || null]);
      }
    }
    teamGhost(A) {
      if (this.lastDeadTeam) return this.lastDeadTeam;
      const others = this.teams.filter((t) => t.alive && t !== A);
      if (!others.length) return { boards: [[], []], tiers: [1, 1], names: ["Ghost", "Ghost"] };
      const o = this.rng.pick(others), ord = this.fightOrder(o);
      return { boards: ord.map((p) => p.board.map((m) => m.clone(false))), tiers: ord.map((p) => p.tier), names: ord.map((p) => p.name) };
    }
    combatPhaseDuo() {
      if (this.sharedPick) this.chooseShared(0);
      for (const p of this.alive()) while (p.tribePick.length) this.chooseTribe(p, this.bestTribe(p));
      const aliveT = this.teams.filter((t) => t.alive);
      const pairs = this.nextTeamPairs && this.nextTeamPairs.every((pr) => pr.every((t) => !t || t.alive)) ? this.nextTeamPairs : (this.pairTeams(), this.nextTeamPairs);
      const fights = [];
      let humanFight = null;
      for (const [A, B] of pairs) {
        const oa = this.fightOrder(A), ob = B ? this.fightOrder(B) : null;
        const g = B ? null : this.teamGhost(A);
        const boardsB = ob ? ob.map((p) => p.board) : g.boards, tiersB = ob ? ob.map((p) => p.tier) : g.tiers;
        for (const p of [...oa, ...(ob || [])]) p.lastBoard = p.board.map((m) => m.dict());
        const prepA = oa.map((p) => this.heroPrep(p)), prepB = ob ? ob.map((p) => this.heroPrep(p)) : [null, null];
        const hpBefore = [A.health, B ? B.health : 0];
        const cb = new Combat(); cb.quiet = [...A.members, ...(B ? B.members : [])].every((p) => p.isBot);
        const r = cb.simulate(oa[0].board, boardsB[0] || [], oa[0].tier, tiersB[0] || 1, this.rng, this.damageCap(), [prepA[0], prepB[0]],
          { boards: [oa[1] ? oa[1].board : null, boardsB[1] || null], tiers: [oa[1] ? oa[1].tier : 1, tiersB[1] || 1], prep: [prepA[1] || null, prepB[1] || null] },
          { turn: this.turn, health: [A.health, B ? B.health : 0], players: [oa[0], ob ? ob[0] : null], relayPlayers: [oa[1] || null, ob ? ob[1] || null : null] });
        for (const p of [...oa, ...(ob || [])]) p.nextCombat = null;
        const sideOf = (s) => (s === 0 ? oa : ob || []);
        const owner = (s, uid) => { for (const p of sideOf(s)) { const m = p.board.find((x) => x.uid === uid); if (m) return m; } return null; };
        for (const gn of r.goldNext || []) { for (const p of sideOf(gn.side)) if (p.board.some((x) => x.uid === gn.uid)) p.nextGold += gn.n; }
        for (const [pl, a, v] of r.pressure || []) pl.gauges[a] = v;
        if (r.heroDmg) { if (B) this.hurt(B.members[0], r.heroDmg[0]); this.hurt(A.members[0], r.heroDmg[1]); }
        for (const u of r.used || []) { const m = owner(u.side, u.uid); if (m) m.lim = Object.assign({}, m.lim, { [u.key]: "g" }); }
        for (const pb of r.perm || []) { for (const p of sideOf(pb.side)) { const m = p.board.find((x) => x.uid === pb.uid); if (!m) continue; m.buff(pb.a, pb.h); mkApply(m, pb); if (pb.evo) this.chargeEvo(p, m, pb.evo); break; } }
        const res = (t, out) => { if (!t) return; for (const p of t.members) { p.lastResult = out; p.streak = out === "win" ? Math.max(0, p.streak) + 1 : out === "loss" ? Math.min(0, p.streak) - 1 : 0; } };
        if (r.winner === 0) { if (B) this.hurt(B.members[0], r.damage); res(A, "win"); res(B, "loss"); }
        else if (r.winner === 1) { this.hurt(A.members[0], r.damage); res(A, "loss"); res(B, "win"); }
        else { res(A, "draw"); res(B, "draw"); }
        for (const pl of [...oa, ...(ob || [])]) {
          const tr = pl.lastResult === "win" ? "afterWin" : pl.lastResult === "loss" ? "afterLoss" : "";
          if (tr) { for (const m of [...pl.board]) if (hasTrig(m, tr)) this.runTavernAb(pl, m, tr); this.heroTrig(pl, tr); }
          this.afterFight(pl, r.winner === (oa.includes(pl) ? 0 : 1) ? r.survivors : []);
        }
        oa.forEach((p, i) => (p.lastOpponent = ob ? (ob[i] || ob[0]).id : -1));
        if (ob) ob.forEach((p, i) => (p.lastOpponent = (oa[i] || oa[0]).id));
        A.lastOpp = B ? B.id : -1; if (B) B.lastOpp = A.id;
        const f = { duo: true, a: oa[0].id, b: ob ? ob[0].id : -1, order: [oa.map((p) => p.id), ob ? ob.map((p) => p.id) : []],
          names: [oa.map((p) => p.name), ob ? ob.map((p) => p.name) : g.names], bName: B ? B.members.map((p) => p.name).join(" & ") : "Ghosts",
          winner: r.winner, damage: r.damage, events: r.events, hpBefore, slot: r.slot };
        fights.push(f);
        if ([...A.members, ...(B ? B.members : [])].some((p) => !p.isBot)) humanFight = f;
      }
      const dead = aliveT.filter((t) => t.health <= 0).sort((x, y) => y.health - x.health);
      let place = aliveT.length - dead.length + 1;
      for (const t of dead) {
        t.alive = false; t.placement = place++;
        const ord = this.fightOrder(t);
        this.lastDeadTeam = { boards: ord.map((p) => p.board.map((m) => m.clone(false))), tiers: ord.map((p) => p.tier), names: ord.map((p) => p.name) };
        for (const p of t.members) {
          p.alive = false; p.placement = t.placement;
          this.returnToPool(p.board); this.returnToPool(p.hand); this.returnToPool(p.shop); this.returnToPool(p.inbox || []);
          for (const id of p.discover) this.pool[id]++;
          p.board = []; p.hand = []; p.shop = []; p.discover = []; p.discoverQ = []; p.discoverGolden = false; p.evolveChoices = []; p.picks = []; p.shopSpell = null; p.inbox = [];
        }
      }
      if (this.isOver()) for (const t of this.teams) if (t.alive) { t.placement = 1; for (const p of t.members) p.placement = 1; }
      this.nextPairs = null; this.nextTeamPairs = null;
      return { fights, human: humanFight, eliminated: dead.flatMap((t) => t.members.map((p) => p.id)) };
    }

    combatPhase() {
      this.evoDefer = true;
      try { return this.combatPhaseInner(); } finally { this.evoDefer = false; }
    }
    combatPhaseInner() {
      if (this.duo) return this.combatPhaseDuo();
      if (this.sharedPick) this.chooseShared(0);
      for (const p of this.alive()) while (p.tribePick.length) this.chooseTribe(p, this.bestTribe(p));
      const alive = this.alive();
      const pairs = this.nextPairs && this.nextPairs.every(pr => pr.every(x => !x || x.alive)) ? this.nextPairs : this.makePairs(alive);
      const fights = [];
      let humanFight = null;
      for (const [a, b] of pairs) {
        let boardB, tierB;
        if (b) { boardB = b.board; tierB = b.tier; }
        else { const g = this.ghost(a, alive); boardB = g.board; tierB = g.tier; }
        a.lastBoard = a.board.map(m => m.dict());
        if (b) b.lastBoard = b.board.map(m => m.dict());
        const cb = new Combat(); cb.quiet = a.isBot && (!b || b.isBot); // only the human's fight is replayed
        const r = cb.simulate(a.board, boardB, a.tier, tierB, this.rng, this.damageCap(), [this.heroPrep(a), b ? this.heroPrep(b) : null], null, { turn: this.turn, health: [a.health, b ? b.health : 0], players: [a, b || null] });
        a.nextCombat = null; if (b) b.nextCombat = null;
        for (const gn of r.goldNext || []) { const o = gn.side === 0 ? a : b; if (o) o.nextGold += gn.n; }
        for (const [pl, a, v] of r.pressure || []) pl.gauges[a] = v;
        if (r.heroDmg) { if (b) this.hurt(b, r.heroDmg[0]); this.hurt(a, r.heroDmg[1]); }
        for (const u of r.used || []) {
          const owner = u.side === 0 ? a : b;
          const m = owner && owner.board.find((x) => x.uid === u.uid);
          if (m) m.lim = Object.assign({}, m.lim, { [u.key]: "g" });
        }
        for (const pb of r.perm || []) {
          const owner = pb.side === 0 ? a : b;
          const m = owner && owner.board.find((x) => x.uid === pb.uid);
          if (m) { m.buff(pb.a, pb.h); mkApply(m, pb); if (pb.evo) this.chargeEvo(owner, m, pb.evo); }
        }
        const f = { a: a.id, b: b ? b.id : -1, bName: b ? b.name : "Ghost", winner: r.winner, damage: r.damage, events: r.events,
                    hpBefore: [a.health, b ? b.health : 0] };
        const res = (p, out) => { if (!p) return; p.lastResult = out; p.streak = out === "win" ? Math.max(0, p.streak) + 1 : out === "loss" ? Math.min(0, p.streak) - 1 : 0; };
        if (r.winner === 0) { if (b) this.hurt(b, r.damage); res(a, "win"); res(b, "loss"); }
        else if (r.winner === 1) { this.hurt(a, r.damage); res(a, "loss"); res(b, "win"); }
        else { res(a, "draw"); res(b, "draw"); }
        for (const pl of [a, b]) {
          if (!pl) continue;
          const tr = pl.lastResult === "win" ? "afterWin" : pl.lastResult === "loss" ? "afterLoss" : "";
          if (tr) { for (const m of [...pl.board]) if (hasTrig(m, tr)) this.runTavernAb(pl, m, tr); this.heroTrig(pl, tr); }
          this.afterFight(pl, r.winner === (pl === a ? 0 : 1) ? r.survivors : []);
        }
        a.lastOpponent = b ? b.id : -1;
        if (b) b.lastOpponent = a.id;
        fights.push(f);
        if (!a.isBot || (b && !b.isBot)) humanFight = f;
      }
      const dead = alive.filter(p => p.health <= 0).sort((x, y) => y.health - x.health);
      let place = alive.length - dead.length + 1;
      for (const p of dead) {
        p.alive = false; p.placement = place++;
        this.lastDead = { board: p.board.map(m => m.clone(false)), tier: p.tier };
        this.returnToPool(p.board); this.returnToPool(p.hand); this.returnToPool(p.shop);
        for (const id of p.discover) this.pool[id]++;
        p.board = []; p.hand = []; p.shop = []; p.discover = []; p.discoverQ = []; p.discoverGolden = false; p.evolveChoices = []; p.picks = []; p.shopSpell = null;
      }
      if (this.isOver()) for (const p of this.alive()) p.placement = 1;
      this.nextPairs = null;
      return { fights, human: humanFight, eliminated: dead.map(p => p.id) };
    }

    // "After each combat" for everyone; "After this survives a combat" for the winner's survivors
    afterFight(pl, survivors) {
      const sv = new Set(survivors.map((m) => m.uid));
      for (const m of [...pl.board]) if (hasTrig(m, "afterCombat")) this.runTavernAb(pl, m, "afterCombat");
      this.heroTrig(pl, "afterCombat");
      for (const m of [...pl.board]) if (sv.has(m.uid) && hasTrig(m, "afterSurvive")) this.runTavernAb(pl, m, "afterSurvive");
      this.checkEvolve(pl);
    }
    makePairs(alive) {
      let best = null, bestRep = 1e9;
      for (let attempt = 0; attempt < 8; attempt++) {
        const order = [...alive]; this.shuffle(order);
        const pairs = []; let rep = 0, i = 0;
        for (; i + 1 < order.length; i += 2) {
          pairs.push([order[i], order[i + 1]]);
          if (order[i].lastOpponent === order[i + 1].id) rep++;
        }
        if (i < order.length) pairs.push([order[i], null]);
        if (rep < bestRep) { bestRep = rep; best = pairs; }
        if (!rep) break;
      }
      return best;
    }

    ghost(p, alive) {
      if (this.lastDead) return this.lastDead;
      const others = alive.filter(x => x !== p);
      if (!others.length) return { board: [], tier: 1 };
      const o = this.rng.pick(others);
      return { board: o.board.map(m => m.clone(false)), tier: o.tier };
    }

    // ---------- actions: return "" on success or a reason
    buy(p, i) {
      if (i < 0 || i >= p.shop.length) return "Nothing there.";
      const cost = this.buyCost(p);
      if (p.gold < cost) return `You need ${cost} gold to buy a minion.`;
      if (p.hand.length >= HAND_MAX) return "Your hand is full.";
      const [m] = p.shop.splice(i, 1);
      const wasFrozen = !!m.ice || !!p.frozen; m.ice = false;
      p.gold -= cost;
      if (p.freeBuys > 0) p.freeBuys--;
      p.hand.push(m); p.bought++;
      this.lastEffects = [];
      if (p.nextBuy && p.nextBuy.length) { const [a, h] = p.nextBuy.shift(); m.buff(a, h); this.lastEffects.push({ uids: [m.uid], a, h, source: m.uid }); }
      if (hasTribe(m, CORSAIR)) {
        for (const c of p.board) {
          if (c.onBuy !== "corsair_rally") continue;
          const ts = p.board.filter(o => hasTribe(o, CORSAIR));
          ts.forEach(o => o.buff(c.n(), c.n()));
          if (ts.length) this.lastEffects.push({ uids: ts.map(o => o.uid), a: c.n(), h: c.n(), source: c.uid });
        }
      }
      for (const c of [...p.board]) if (hasTrig(c, "onBuy")) this.runTavernAb(p, c, "onBuy", m);
      this.heroTrig(p, "onBuy", m);
      if (wasFrozen) { for (const c of [...p.board]) if (hasTrig(c, "onBuyFrozen")) this.runTavernAb(p, c, "onBuyFrozen", m); this.heroTrig(p, "onBuyFrozen", m); }
      this.lastTriple = this.checkTriples(p);
      return "";
    }

    // Duos: send a card from your hand or warband to your partner's hand
    pass(p, zone, i) {
      const mate = this.mateOf(p);
      if (!mate || !mate.alive) return "You have no partner to send cards to.";
      if (p.gold < PASS_COST) return `Sending a card costs ${PASS_COST} gold.`;
      const list = zone === "board" ? p.board : p.hand, m = list[i];
      if (!m) return "Nothing there.";
      if (mate.hand.length + (mate.inbox || []).length >= HAND_MAX) return `${mate.name}'s hand is full.`;
      list.splice(i, 1);
      p.gold -= PASS_COST;
      (this.passLog = this.passLog || []).push({ from: p.id, to: mate.id, uid: m.uid, name: m.name, turn: this.turn });
      if (mate.isBot) { mate.hand.push(m); if (!m.isSpell) this.checkTriples(mate); mate.needsPlay = true; }
      else (mate.inbox = mate.inbox || []).push(m); // a person takes it with their next own action (see takeInbox)
      return "";
    }
    // Cards sent by the partner wait in an inbox until the receiver's own turn of events pulls them in: this keeps
    // two people's action sequences independent (online duos) while still feeling instant on the table.
    takeInbox(p) {
      if (!p.inbox || !p.inbox.length) return "Nothing to take.";
      const got = [];
      while (p.inbox.length && p.hand.length < HAND_MAX) { const m = p.inbox.shift(); p.hand.push(m); got.push(m); }
      if (!got.length) return "Your hand is full.";
      this.lastTriple = got.some((m) => !m.isSpell) ? this.checkTriples(p) : [];
      this.lastInbox = got.map((m) => m.uid);
      return "";
    }
    // bots help their partner: copies the partner can triple, then spare minions of the partner's tribe
    botPass(p, late) {
      const mate = this.mateOf(p);
      if (!mate || !mate.alive || p.gold < PASS_COST) return;
      const count = (pl, id) => [...pl.hand, ...pl.board].filter((x) => !x.isSpell && !x.golden && x.cardId === id).length;
      const mainOf = (pl) => { const c = {}; for (const x of pl.board) for (const t of tribesOf(x)) c[t] = (c[t] || 0) + 1; const t = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; return t && c[t] >= 3 ? t : ""; };
      for (let k = 0; k < 2 && p.gold >= PASS_COST && mate.hand.length < HAND_MAX; k++) {
        let pick = null;
        for (const zone of ["hand", "board"]) for (let i = 0; i < p[zone].length && !pick; i++) {
          const x = p[zone][i];
          if (x.isSpell || x.golden || x.token) continue;
          if (count(mate, x.cardId) === 2 && count(p, x.cardId) < 2) pick = [zone, i];
        }
        if (!pick && late) {
          const mt = mainOf(mate), mine = mainOf(p);
          const i = p.hand.findIndex((x) => !x.isSpell && mt && hasTribe(x, mt) && !hasTribe(x, mine));
          if (i >= 0 && p.board.length >= BOARD_MAX) pick = ["hand", i];
        }
        if (!pick) break;
        this.pass(p, pick[0], pick[1]);
      }
    }
    // a bot partner places what it was sent
    botPlace(p) {
      p.needsPlay = false;
      while (p.discover.length) this.chooseDiscover(p, 0);
      while ((p.picks || []).length) this.choosePick(p, this.bestPick(p));
      while ((p.evolveChoices || []).length) this.chooseEvolve(p, this.bestEvolve(p));
      for (let guard = 0; guard < 12; guard++) {
        const i = p.hand.findIndex((x) => !x.isSpell);
        if (i < 0) break;
        const m = p.hand[i], val = (x) => x.attack + x.health + (x.golden ? 6 : 0) + x.tier * 2;
        if (p.board.length >= BOARD_MAX) {
          let wi = 0; p.board.forEach((x, j) => { if (val(x) < val(p.board[wi])) wi = j; });
          if (val(p.board[wi]) >= val(m)) break;
          this.sell(p, wi);
        }
        this.play(p, i);
        while (p.discover.length) this.chooseDiscover(p, 0);
      }
    }

    // what a tavern spell costs you (the spell discount aura)
    spellCost(p, s) { return s ? Math.max(0, s.cost - passive(p.board, "spellDiscount")) : 0; }
    buySpell(p) {
      const s = p.shopSpell;
      if (!s) return "No spell in the tavern.";
      const cost = this.spellCost(p, s);
      if (p.gold < cost) return `You need ${cost} gold for ${s.name}.`;
      if (p.hand.length >= HAND_MAX) return "Your hand is full.";
      p.gold -= cost;
      p.shopSpell = null;
      p.hand.push(s);
      this.lastEffects = [];
      for (const m of [...p.board]) if (hasTrig(m, "onBuySpell")) this.runTavernAb(p, m, "onBuySpell", null);
      this.heroTrig(p, "onBuySpell");
      return "";
    }

    // Cast a spell from hand. target = board index (for targeted spells). Remembers the last spell cast (for "copy the last spell").
    cast(p, handIdx, target = -1) {
      const s = p.hand[handIdx], prev = p.lastSpellId;
      if (s && s.isSpell) p.lastSpellId = s.spellId;
      const err = this.castInner(p, handIdx, target);
      if (err) p.lastSpellId = prev;
      return err;
    }
    castInner(p, handIdx, target = -1) {
      const s = p.hand[handIdx];
      if (!s || !s.isSpell) return "That is not a spell.";
      const t = p.board[target];
      if (s.target && !t) return `Drag ${s.name} onto one of your minions.`;
      this.lastEffects = []; this.lastTriple = [];
      const fx = (list, a, h, label) => { if (list.length) this.lastEffects.push({ uids: list.map(o => o.uid), a, h, label, source: -1 }); };
      let spellTimes = 1 + passive(p.board, "extraSpell");
      if (p.nextSpell2 > 0 && (s.custom || this.REPEATABLE_SPELL(s.spellId))) { spellTimes += 1; p.nextSpell2--; this.lastEffects.push({ uids: [], a: 0, h: 0, label: "Spell x2", source: -1 }); }
      if (s.custom) {
        for (let rep = 0; rep < spellTimes; rep++) for (const ab of SPELLS[s.spellId].abilities || []) this.applyTavernAb(p, null, ab, t || null);
        if (t && hasTrig(t, "onSpellTargeted")) this.runTavernAb(p, t, "onSpellTargeted");
        p.hand.splice(p.hand.indexOf(s), 1);
        this.afterSpell(p);
        return "";
      }
      // Simple built-in spells repeat with "cast extra times"; the others happen once.
      const [sa, sh] = passiveAH(p.board, "spellBoost");
      const REPEAT = { lucky_coin: () => { p.gold += 1; }, tavern_brew: () => { t.buff(2 + sa, 2 + sh); fx([t], 2 + sa, 2 + sh); }, feast: () => { p.board.forEach(o => o.buff(1 + sa, 1 + sh)); fx(p.board, 1 + sa, 1 + sh); }, gold_rush: () => { p.nextGold += 3; } };
      if (REPEAT[s.spellId]) {
        for (let rep = 0; rep < spellTimes; rep++) REPEAT[s.spellId]();
        if (t && hasTrig(t, "onSpellTargeted")) this.runTavernAb(p, t, "onSpellTargeted");
        p.hand.splice(p.hand.indexOf(s), 1);
        this.afterSpell(p);
        return "";
      }
      switch (s.spellId) {
        case "lucky_coin": p.gold += 1; break;
        case "tavern_brew": t.buff(2, 2); fx([t], 2, 2); break;
        case "polish": if (t.shield) return `${t.name} already has Shield.`; t.shield = true; fx([t], 0, 0, "Shield"); break;
        case "spirit_ward": if (t.reborn) return `${t.name} already has Reborn.`; t.reborn = true; fx([t], 0, 0, "Reborn"); break;
        case "venom_vial": if (t.venomous) return `${t.name} is already Venomous.`; t.venomous = true; fx([t], 0, 0, "Venomous"); break;
        case "feast": p.board.forEach(o => o.buff(1, 1)); fx(p.board, 1, 1); break;
        case "gold_rush": p.nextGold += 3; break;
        case "recruit": {
          if (p.discover.length) return "Pick your discover first.";
          this.offerDiscover(p, p.tier);
          if (!p.discover.length) return "No minions of your tier are left.";
          break;
        }
        case "mirror": {
          if (t.token) return "Tokens can't be copied.";
          if (p.hand.length >= HAND_MAX) return "Your hand is full.";
          if (!(this.viewOf(p)[t.cardId] > 0)) return `No copies of ${t.name} are left.`;
          this.take(t.cardId, this.viewOf(p));
          p.hand.splice(handIdx, 1);
          p.hand.push(new Minion(t.cardId));
          this.afterSpell(p);
          this.lastTriple = this.checkTriples(p);
          return "";
        }
        case "war_banner": {
          const counts = {};
          for (const o of p.board) for (const t of tribesOf(o)) counts[t] = (counts[t] || 0) + 1;
          const best = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
          if (!best) return "You have no tribe on your board yet.";
          const l = p.board.filter(o => hasTribe(o, best));
          l.forEach(o => o.buff(3 + sa, 3 + sh)); fx(l, 3 + sa, 3 + sh);
          break;
        }
      }
      if (t && hasTrig(t, "onSpellTargeted")) this.runTavernAb(p, t, "onSpellTargeted");
      p.hand.splice(p.hand.indexOf(s), 1);
      this.afterSpell(p);
      return "";
    }

    REPEATABLE_SPELL(id) { return ["lucky_coin", "tavern_brew", "feast", "gold_rush"].includes(id); }
    afterSpell(p) {
      p.spellsCast++; p.spellsTurn++;
      for (const m of [...p.board]) if (hasTrig(m, "onSpell")) this.runTavernAb(p, m, "onSpell");
      this.heroTrig(p, "onSpell");
      for (const m of p.board) if (m.onSpell === "titan") { m.buff(m.n(), m.n()); (this.lastEffects = this.lastEffects || []).push({ uids: [m.uid], a: m.n(), h: m.n(), source: m.uid }); }
    }

    play(p, i, pos = -1) {
      if (i < 0 || i >= p.hand.length) return "Nothing there.";
      if (p.hand[i].isSpell) return p.hand[i].target ? `Drag ${p.hand[i].name} onto one of your minions.` : this.cast(p, i);
      if (p.board.length >= BOARD_MAX) return "Your warband is full. Sell a minion first.";
      const [m] = p.hand.splice(i, 1);
      if (pos < 0 || pos > p.board.length) pos = p.board.length;
      p.played++; p.playedTurn++; for (const t of tribesOf(m)) { p.playedT[t] = (p.playedT[t] || 0) + 1; p.playedTurnT[t] = (p.playedTurnT[t] || 0) + 1; }
      this.lastEffects = []; this.lastDevour = [];
      // Magnetic: played right before a friend of its tribe, it merges into it (no Battlecry, like a buff)
      const host = m.magnetic && pos < p.board.length ? p.board[pos] : null;
      if (host && host !== m && sharesTribe(m, host)) {
        host.buff(m.attack, m.health);
        for (const kw of KW_LIST) if (kw !== "magnetic" && m[kw]) host[kw] = true;
        for (const k of m.ckw || []) giveCkw(host, k);
        for (const ab of m.abilities || []) if (ab.trigger !== "battlecry" && ab.trigger !== "activate" && !ab._kw && !ab._aff) { const g = JSON.parse(JSON.stringify(ab)); host.granted = (host.granted || []).concat([g]); host.abilities = (host.abilities || []).concat([g]); }
        host.boostA += m.boostA; host.boostH += m.boostH; host.fed += m.fed; if (m.eaten) host.eaten = (host.eaten || []).concat(m.eaten);
        this.lastEffects.push({ uids: [host.uid], a: m.attack, h: m.health, label: "Magnetic", source: host.uid });
        this.returnToPool([m]);
        this.lastTriple = (this.lastTriple || []).concat(this.checkTriples(p));
        return "";
      }
      p.board.splice(pos, 0, m); m.playedAt = (this.playSeq = (this.playSeq || 0) + 1);
      if (p.nextPlay && p.nextPlay.length) { const [a, h] = p.nextPlay.shift(); m.buff(a, h); this.lastEffects.push({ uids: [m.uid], a, h, source: m.uid }); }
      if (m.hasBattlecry()) {
        const chant = p.board.reduce((best, o) => (o.chanter && o !== m ? Math.max(best, o.golden ? 3 : 2) : best), 1);
        let times = chant + passive(p.board, "extraBattlecry", m);
        if (p.doubleNext > 0 && m.battlecry !== "double_next") { times += 1; p.doubleNext--; }
        if (p.nextBc2 > 0 && !(m.abilities || []).some((ab) => ab.trigger === "battlecry" && ab.action === "nextBattlecryTwice")) { times += 1; p.nextBc2--; }
        for (let k = 0; k < times; k++) this.battlecry(p, m);
        if (times > 1) this.lastEffects.push({ uids: [m.uid], a: 0, h: 0, label: `Battlecry x${times}`, source: m.uid });
        p.battlecries++;
        for (const o of p.board) if (o !== m && o.onPlayOther === "drummer") { o.buff(o.n(), o.n()); this.lastEffects.push({ uids: [o.uid], a: o.n(), h: o.n(), source: o.uid }); }
      }
      if (hasTrig(m, "onFoundationPlay") && p.found && (p.found[p.board.indexOf(m)] || 0) > 0) this.runTavernAb(p, m, "onFoundationPlay"); // Bedrock
      for (const o of [...p.board]) if (o !== m && hasTrig(o, "onPlayOther")) this.runTavernAb(p, o, "onPlayOther", m);
      if (m.hasBattlecry()) for (const o of [...p.board]) if (o !== m && hasTrig(o, "onPlayBattlecry")) this.runTavernAb(p, o, "onPlayBattlecry", m);
      this.heroTrig(p, "onPlayOther", m);
      if (m.hasBattlecry()) this.heroTrig(p, "onPlayBattlecry", m);
      if (hasTribe(m, ELEMENTAL)) {
        for (const o of p.board) {
          if (o === m) continue;
          if (o.onPlayOther === "brute") { o.buff(o.n(), o.n()); this.lastEffects.push({ uids: [o.uid], a: o.n(), h: o.n(), source: o.uid }); }
          if (o.onPlayOther === "chef") {
            p.shopBuff += o.n();
            p.shop.forEach(s => s.buff(o.n(), o.n()));
            this.lastEffects.push({ uids: p.shop.map(s => s.uid), a: o.n(), h: o.n(), source: o.uid, shop: true });
          }
        }
      }
      this.pulse(p, m);
      this.affResonance(p, m);
      if (m.golden && !m.token) this.queueDiscover(p, { tierMode: "exact", dtier: Math.min(p.tier + 1, MAX_TIER) });
      return "";
    }
    // Coral: playing a Coral sends a Pulse through the reef (itself and the Corals right next to it; the whole chain at level 2),
    // from left to right, each minion once. A non-Coral minion stops it.
    pulseChain(p, m) {
      const i = p.board.indexOf(m); if (i < 0) return [];
      const idx = new Set();
      for (const a of affsOf(m)) {
        if (!AFF[a] || AFF[a].kind !== "pulse") continue;
        const lv = affLevel(p.board, a); if (lv < 1) continue;
        let lo = i, hi = i;
        if (lv >= 2) { while (lo > 0 && hasAff(p.board[lo - 1], a)) lo--; while (hi < p.board.length - 1 && hasAff(p.board[hi + 1], a)) hi++; }
        else { if (i > 0 && hasAff(p.board[i - 1], a)) lo = i - 1; if (i < p.board.length - 1 && hasAff(p.board[i + 1], a)) hi = i + 1; }
        for (let k = lo; k <= hi; k++) idx.add(k);
      }
      return [...idx].sort((x, y) => x - y).map((k) => p.board[k]);
    }
    pulse(p, m) {
      const chain = this.pulseChain(p, m); if (!chain.length) return;
      this.lastPulse = chain.map((o) => o.uid);
      for (const o of chain) {
        if (!p.board.includes(o)) continue;
        if (!hasTrig(o, "pulse")) continue;
        let times = 1; if ((p.pulseNext2 || 0) > 0) { p.pulseNext2--; times = 2; }
        (this.lastEffects = this.lastEffects || []).push({ uids: [o.uid], a: 0, h: 0, label: times > 1 ? "Pulse x2" : "Pulse", source: o.uid, aff: affsOf(o).find((x) => kindOfAff(x) === "pulse") || "" });
        for (let t = 0; t < times && p.board.includes(o); t++) this.runTavernAb(p, o, "pulse");
      }
      this.lastTriple = (this.lastTriple || []).concat(this.checkTriples(p));
    }

    // Activate: a minion's on-demand effect, once per turn, paid in gold
    activate(p, i) {
      const m = p.board[i];
      if (!m) return "Nothing there.";
      const act = m.activation();
      if (!act) return "This minion has nothing to activate.";
      if (m.actTurn === this.turn) return "Already activated this turn.";
      if (p.gold < act.cost) return "Not enough gold.";
      p.gold -= act.cost; m.actTurn = this.turn; m.actN = (m.actN || 0) + 1;
      this.lastEffects = []; this.lastTriple = []; this.lastDevour = [];
      this.runTavernAb(p, m, "activate");
      // Work (N): the Nth activation fires it (once)
      const n = m.actN; let evolved = false;
      (m.abilities || []).forEach((ab, i) => { if (evolved || ab.trigger !== "work" || (ab.at || 1) !== n) return; if (!gate(ab, i, m, null, p.board, m.tctr, { turn: this.turn, health: p.health, p })) return; this.applyTavernAb(p, m, ab, null); if (p.board[i] !== m && !p.board.includes(m)) evolved = true; });
      const a2 = p.board.includes(m) ? m.activation() : null; if (a2 && a2.work && a2.done < a2.work) this.lastEffects.push({ uids: [m.uid], a: 0, h: 0, label: `Work ${a2.done}/${a2.work}`, source: m.uid });
      this.lastTriple = (this.lastTriple || []).concat(this.checkTriples(p));
      this.checkEvolve(p);
      return "";
    }
    // "Whenever this gains stats": after a tavern buff lands (guarded against loops)
    afterBuffed(p, list, by) {
      if ((this.buffDepth = (this.buffDepth || 0) + 1) > 6) { this.buffDepth--; return; }
      for (const t of list) if (p.board.includes(t) && hasTrig(t, "onBuffed")) this.runTavernAb(p, t, "onBuffed", by);
      this.buffDepth--;
    }
    // Evolve: the minion becomes its next form in the same spot and keeps its gains, keywords, boosts and food
    evolveMinion(p, m, into) {
      if (!into || !(CARDS[into] || TOKENS[into])) return;
      const i = p.board.indexOf(m); if (i < 0) return;
      const x = new Minion(into, m.golden);
      const ga = m.attack - m.baseAttack(), gh = m.health - m.baseHealth(); // what it gained since it was played
      x.buff(Math.max(0, ga), Math.max(0, gh));
      for (const kw of KW_LIST) if (m[kw]) x[kw] = true;
      x.boostA = m.boostA; x.boostH = m.boostH; x.fed = m.fed; x.eaten = m.eaten; x.lastMeal = m.lastMeal;
      if (m.granted && m.granted.length) { x.granted = m.granted.slice(); x.abilities = (x.abilities || []).concat(x.granted); } // mutations and given effects stay
      x.muts = m.muts ? m.muts.slice() : null;
      p.board[i] = x;
      (this.lastEffects = this.lastEffects || []).push({ uids: [x.uid], a: 0, h: 0, label: "Evolved!", source: x.uid, evolvedFrom: m.uid });
      this.lastTriple = (this.lastTriple || []).concat(this.checkTriples(p));
    }
    // Evolve triggers: a minion that reached its threshold fires its Evolve ability (once)
    checkEvolve(p) {
      if (this.evoDefer) { p.evoCheckNext = true; return; }
      let again = true, guard = 0;
      while (again && guard++ < 10) {
        again = false;
        for (let i = 0; i < p.board.length && !again; i++) {
          const m = p.board[i];
          (m.abilities || []).forEach((ab, k) => {
            if (again || ab.trigger !== "onReach" || (m.reached && m.reached[k])) return;
            const at = ab.at || 1, hit = ab.stat === "health" ? m.health >= at : ab.stat === "attack" ? m.attack >= at : m.attack >= at || m.health >= at;
            if (!hit) return;
            if (!m.reached) m.reached = {}; m.reached[k] = true; // fires once per minion
            if (!gate(ab, k, m, null, p.board, m.tctr || (m.tctr = {}), { turn: this.turn, health: p.health, p })) return;
            this.applyTavernAb(p, m, ab, null); again = true;
          });
        }
      }
    }
    sell(p, i) {
      if (i < 0 || i >= p.board.length) return "Nothing there.";
      const [m] = p.board.splice(i, 1);
      p.sold++;
      p.gold += Math.max(0, SELL + (p.mods.sell || 0)) + (m.onSell === "scamp" ? m.n() : 0);
      this.lastEffects = [];
      if (p.nextSell && p.nextSell.length) { const g = p.nextSell.shift(); p.gold += g; this.lastEffects.push({ uids: [], a: 0, h: 0, label: `+${g} gold`, source: -1 }); }
      if (hasTrig(m, "onSell")) this.runTavernAb(p, m, "onSell");
      for (const o of [...p.board]) if (hasTrig(o, "onSellOther")) this.runTavernAb(p, o, "onSellOther", m);
      this.heroTrig(p, "onSellOther", m);
      this.returnToPool([m]);
      return "";
    }

    buyCost(p) { return p.freeBuys > 0 ? 0 : Math.max(0, BUY - passive(p.board, "buyDiscount") + (p.mods.buy || 0)); }
    rollCost(p) { return p.freeRolls > 0 || this.bargainLeft(p) > 0 ? 0 : Math.max(0, ROLL - passive(p.board, "rollDiscount") + (p.mods.roll || 0)); }
    roll(p) {
      const rc = this.rollCost(p);
      if (p.freeRolls > 0) p.freeRolls--;
      else if (this.bargainLeft(p) > 0) p.bargainUsed = (p.bargainUsed || 0) + 1;
      else if (p.gold < rc) return `You need ${rc} gold to refresh.`;
      else p.gold -= rc;
      p.frozen = false;
      this.refill(p);
      for (const m of [...p.board]) if (hasTrig(m, "onRoll")) this.runTavernAb(p, m, "onRoll");
      this.heroTrig(p, "onRoll");
      return "";
    }

    toggleFreeze(p) {
      p.frozen = !p.frozen;
      if (p.frozen) { for (const m of [...p.board]) if (hasTrig(m, "onFreeze")) this.runTavernAb(p, m, "onFreeze"); this.heroTrig(p, "onFreeze"); }
      return "";
    }

    upgrade(p) {
      if (p.tier >= MAX_TIER) return "Your tavern is already at the top tier.";
      if (p.gold < p.upgradeCost) return `You need ${p.upgradeCost} gold to upgrade.`;
      p.gold -= p.upgradeCost; p.tier++;
      p.upgradeCost = this.upCost(p);
      for (const m of [...p.board]) if (hasTrig(m, "afterUpgrade")) this.runTavernAb(p, m, "afterUpgrade");
      this.heroTrig(p, "afterUpgrade");
      return "";
    }

    move(p, from, to) {
      if (from < 0 || from >= p.board.length) return "Nothing there.";
      to = Math.max(0, Math.min(to, p.board.length - 1));
      const [m] = p.board.splice(from, 1);
      p.board.splice(to, 0, m);
      return "";
    }

    // "You choose" effects: the player picks one of the candidates (i = index in cands; -1 skips the effect)
    choosePick(p, i) {
      const q = p.picks || [];
      if (!q.length) return "Nothing to choose.";
      const pk = q.shift();
      if (i < 0) return "";
      const uid = pk.cands[Math.max(0, Math.min(i | 0, pk.cands.length - 1))];
      const zone = pk.zone === "shop" ? p.shop : pk.zone === "hand" ? p.hand : p.board;
      if (!zone.some((o) => o.uid === uid)) return "";
      const m = pk.uid === -1 ? null : p.board.find((o) => o.uid === pk.uid);
      if (pk.uid !== -1 && !m) return ""; // the minion left the board: the effect fizzles
      const src = pk.src === -1 ? null : p.board.concat(p.hand, p.shop).find((o) => o.uid === pk.src) || null;
      this.lastEffects = this.lastEffects || []; this.lastTriple = this.lastTriple || [];
      this.applyTavernAb(p, m, Object.assign({}, pk.ab, { _pick: uid }), src);
      this.lastTriple = this.lastTriple.concat(this.checkTriples(p));
      this.checkEvolve(p);
      return "";
    }
    // what a bot picks: the weakest candidate for hurtful effects, the strongest otherwise
    bestPick(p) {
      const pk = (p.picks || [])[0]; if (!pk) return 0;
      const zone = pk.zone === "shop" ? p.shop : pk.zone === "hand" ? p.hand : p.board;
      const hurt = ["destroy", "devour", "sacrifice", "debuff", "silence", "bounce", "removeKeyword"].includes(pk.ab.action);
      let best = 0, bs = hurt ? Infinity : -Infinity;
      pk.cands.forEach((uid, i) => { const o = zone.find((x) => x.uid === uid); if (!o) return; const sc = o.attack + o.health; if (hurt ? sc < bs : sc > bs) { bs = sc; best = i; } });
      return best;
    }
    // Evolve with a choice: the player picks the next form (the first one at end of turn if they don't)
    chooseEvolve(p, i) {
      const q = p.evolveChoices || [];
      if (!q.length) return "Nothing to choose.";
      const c = q.shift(), m = p.board.find((x) => x.uid === c.uid);
      if (!m) return "";
      i = Math.max(0, Math.min(i | 0, c.options.length - 1));
      this.lastEffects = this.lastEffects || [];
      if (c.kind === "mut") { this.applyMut(p, m, c.options[i]); this.lastTriple = (this.lastTriple || []).concat(this.checkTriples(p)); }
      else this.evolveMinion(p, m, c.options[i]);
      this.checkEvolve(p);
      return "";
    }
    bestEvolve(p) {
      const c = (p.evolveChoices || [])[0]; if (!c) return 0; let best = 0, bs = -Infinity;
      const KWV = { shield: 5, reborn: 5, windfury: 4, venomous: 6, taunt: 2, cleave: 3, stealth: 1, tough: 3, rally: 2, flying: 2 };
      c.options.forEach((o, i) => {
        let sc;
        if (c.kind === "mut") { const d = mutDef(o); sc = d ? (d.a || 0) + (d.h || 0) + (d.kw ? KWV[d.kw] || 2 : 0) + (d.grant ? 4 : 0) : -1; }
        else { const d = CARDS[o] || TOKENS[o]; sc = d ? d.attack + d.health + (d.tier || 0) * 2 : 0; }
        if (sc > bs) { bs = sc; best = i; }
      });
      return best;
    }
    chooseDiscover(p, i) {
      if (!p.discover.length) return "Nothing to discover.";
      i = Math.max(0, Math.min(i, p.discover.length - 1));
      const picked = p.discover[i];
      p.discover.forEach((id, j) => { if (j !== i) this.give(id, 1, this.viewOf(p)); });
      p.discover = [];
      const golden = !!p.discoverGolden; p.discoverGolden = false;
      if (p.hand.length < HAND_MAX) {
        const nm = new Minion(picked, golden); if (golden) nm.poolCost = 1; p.hand.push(nm);
        for (const o of [...p.board]) if (hasTrig(o, "onDiscover")) this.runTavernAb(p, o, "onDiscover", nm);
        this.heroTrig(p, "onDiscover", nm);
        this.lastTriple = this.checkTriples(p);
      } else this.give(picked, 1, this.viewOf(p));
      this.nextDiscover(p);
      return "";
    }

    // ---------- internals
    refill(p, up = 0) {
      // Frozen minions (one by one) stay through a refresh
      const keep = p.shop.filter((m) => m.ice);
      this.returnToPool(p.shop.filter((m) => !m.ice));
      p.shop = keep;
      this.fill(p, up);
    }
    // draw minions until the tavern holds its current size (keeps whatever is already there)
    fill(p, up = 0, keepSpell = false) {
      const size = Math.max(1, Math.min(BOARD_MAX, SHOP_SIZE[p.tier] + passive(p.board, "shopSize") + (p.mods.shop || 0)));
      const top = Math.min(MAX_TIER, p.tier + up);
      for (let i = p.shop.length; i < size; i++) {
        const id = (up && this.draw(top, top, this.rngOf(p), this.viewOf(p))) || this.draw(top, 0, this.rngOf(p), this.viewOf(p));
        if (!id) break;
        const gold = p.mods.golden > 0 && this.rngOf(p).next() * 100 < p.mods.golden;
        const m = new Minion(id, gold);
        if (gold) m.poolCost = 1;
        if (p.shopBuff) m.buff(p.shopBuff, p.shopBuff);
        p.shop.push(m);
      }
      this.affLure(p, top);
      if (keepSpell && p.shopSpell) return;
      const sp = this.spellIds(p.tier);
      p.shopSpell = sp.length ? new Spell(this.rngOf(p).pick(sp)) : null;
    }

    draw(maxTier, exactTier = 0, rng = this.rng, view = this.pool, pred = null) {
      const ok = id => (exactTier ? CARDS[id].tier === exactTier : CARDS[id].tier <= maxTier) && (!pred || pred(id));
      let total = 0;
      for (const id in view) if (ok(id) && view[id] > 0) total += view[id];
      if (total <= 0) return "";
      let r = rng.int(1, total);
      for (const id in view) {
        if (!ok(id) || view[id] <= 0) continue;
        r -= view[id];
        if (r <= 0) { this.take(id, view); return id; }
      }
      return "";
    }

    returnToPool(ms) { const view = uidCtx && uidCtx.poolView; for (const m of ms) if (!m.isSpell && !m.token && this.pool[m.cardId] != null) this.give(m.cardId, m.poolCost != null ? m.poolCost : m.golden ? 3 : 1, view); }

    // a Discover from an effect: shown now, or after the one already on screen
    queueDiscover(p, spec) { if (p.discover.length) { (p.discoverQ || (p.discoverQ = [])).push(spec); return; } this.discoverFrom(p, spec); }
    discoverFrom(p, spec) {
      const T = p.tier, tm = spec.tierMode || "current";
      const tiers = tm === "up" ? [Math.min(MAX_TIER, T + 1)] : tm === "down" ? [Math.max(1, T - 1)] : tm === "random" ? [this.rngOf(p).int(1, Math.min(MAX_TIER, T + 2))] : tm === "max" ? [MAX_TIER]
        : tm === "exact" ? [Math.max(1, Math.min(MAX_TIER, spec.dtier || 1))] : tm === "upTo" ? Array.from({ length: T }, (_, i) => i + 1) : tm === "any" ? [1, 2, 3, 4, 5, 6] : [T];
      let tribe = spec.tribe || "";
      if (tribe === "@main") tribe = this.bestTribe(p) || "";
      else if (tribe === "@lobby") tribe = this.tribes.length ? this.rngOf(p).pick(this.tribes) : "";
      p.discoverGolden = !!spec.golden;
      this.offerDiscover(p, tiers, tribe, spec.dkw || "", spec.choices || 0, spec.daff || "");
      if (!p.discover.length) { p.discoverGolden = false; this.nextDiscover(p); } // nothing left to offer: go on with the next one
    }
    nextDiscover(p) { while (!p.discover.length && p.discoverQ && p.discoverQ.length) this.discoverFrom(p, p.discoverQ.shift()); }
    offerDiscover(p, tier, tribe = "", kw = "", choices = 0, daff = "") {
      // every card of those tiers is equally likely here, whatever its rarity; the filters loosen when nothing fits
      const tiers = Array.isArray(tier) ? tier : [tier];
      const view = this.viewOf(p), all = Object.keys(view).filter((id) => view[id] > 0);
      const okT = (id) => tiers.includes(CARDS[id].tier), okR = (id) => !tribe || hasTribe(CARDS[id], tribe), okK = (id) => !kw || !!CARDS[id][kw];
      const okA = (id) => !daff || hasAff(CARDS[id], daff);
      let ids = all.filter((id) => okT(id) && okR(id) && okK(id) && okA(id));
      if (!ids.length && daff) ids = all.filter((id) => okA(id) && okR(id) && okK(id) && CARDS[id].tier <= Math.max(...tiers)); // that affinity at a lower tier
      if (!ids.length && daff) ids = all.filter((id) => okA(id));
      if (!ids.length && kw) ids = all.filter((id) => okR(id) && okK(id) && CARDS[id].tier <= Math.max(...tiers)); // that keyword at a lower tier
      if (!ids.length && tribe) ids = all.filter((id) => okR(id) && (!kw || okK(id))); // none of that tier: any tier of the tribe
      if (!ids.length && (tribe || kw)) ids = all.filter((id) => okT(id));
      const opts = [];
      const want = Math.max(1, Math.min(6, (choices || 3) + ((p.mods && p.mods.discover) || 0)));
      while (opts.length < want && ids.length) { const id = ids.splice(this.rngOf(p).int(0, ids.length - 1), 1)[0]; this.take(id, view); opts.push(id); }
      p.discover = opts;
    }

    checkTriples(p) {
      const out = [];
      for (let changed = true; changed;) {
        changed = false;
        const counts = {};
        for (const m of [...p.hand, ...p.board]) if (!m.isSpell && !m.golden && !m.token) counts[m.cardId] = (counts[m.cardId] || 0) + 1;
        const need = Math.max(2, 3 + (p.mods.triple || 0));
        for (const id in counts) {
          if (counts[id] < need) continue;
          let ea = 0, eh = 0, removed = [], granted = [], muts = [], evo = 0, evoLv = 0, evoDone = false; const mkS = {};
          const kw = {}, mkK = {};
          for (const zone of [p.hand, p.board]) {
            for (let i = 0; i < zone.length && removed.length < need;) {
              const m = zone[i];
              if (!m.isSpell && m.cardId === id && !m.golden) {
                const [ma, mh] = mkStatAH(m); for (const [x, n] of Object.entries(mkSt(m))) mkS[x] = (mkS[x] || 0) + n;
                ea += m.attack - m.baseAttack() - ma; eh += m.health - m.baseHealth() - mh;
                for (const k of KW_LIST) if (m[k] && !(m.mk && m.mk.kw[k])) kw[k] = true;
                for (const k of mkKws(m)) mkK[k] = 1;
                if (m.granted) granted.push(...m.granted); if (m.muts) muts.push(...m.muts);
                evo = Math.max(evo, m.evo || 0); evoLv = Math.max(evoLv, m.evoLv || 0); evoDone = evoDone || !!m.evoDone;
                zone.splice(i, 1); removed.push(m.uid);
              } else i++;
            }
          }
          const g = new Minion(id, true);
          g.buff(ea, eh);
          if (g.attack < 0) g.attack = 0; if (g.health < 1) { g.health = 1; } if (g.maxHealth < g.health) g.maxHealth = g.health; // copies whose stats were lowered or swapped can't drag the golden below zero
          Object.assign(g, kw);
          for (const x in mkS) mkAddStat(g, x, mkS[x]); for (const k in mkK) mkAddKw(g, k); // the markers of the copies stay markers on the golden
          if (granted.length) { g.granted = granted; g.abilities = (g.abilities || []).concat(granted); }
          if (muts.length) g.muts = muts;
          g.evo = evo; g.evoLv = evoLv; g.evoDone = evoDone;
          if (p.hand.length < HAND_MAX || p.board.length >= BOARD_MAX) p.hand.push(g); else p.board.push(g); // a full hand: the golden lands on the board instead
          out.push({ removed, golden: g.uid });
          if ((this.tripleDepth = (this.tripleDepth || 0) + 1) < 4)
            for (const o of [...p.board]) if (hasTrig(o, "onTriple")) this.runTavernAb(p, o, "onTriple", g);
          if (this.tripleDepth < 4) this.heroTrig(p, "onTriple", g);
          this.tripleDepth--;
          changed = true;
          break;
        }
      }
      return out;
    }

    battlecry(p, m) {
      this.builtInBattlecry(p, m);
      this.runTavernAb(p, m, "battlecry");
    }
    builtInBattlecry(p, m) {
      const fx = (list, a, h, label) => { if (list.length) this.lastEffects.push({ uids: list.map(o => o.uid), a, h, label, source: m.uid }); };
      switch (m.battlecry) {
        case "buff_random_friend": { const t = this.buffRandom(p, m, "", m.n(), m.n()); if (t) fx([t], m.n(), m.n()); break; }
        case "buff_random_construct": { const t = this.buffRandom(p, m, CONSTRUCT, m.n(), m.n()); if (t) fx([t], m.n(), m.n()); break; }
        case "next_gold": p.nextGold += m.n(); fx([m], 0, 0, `+${m.n()} gold next turn`); break;
        case "free_roll": p.freeRolls += m.mult(); fx([m], 0, 0, m.golden ? "2 free Refreshes" : "Free Refresh"); break;
        case "add_spell": for (let i = 0; i < m.mult() && p.hand.length < HAND_MAX && this.spellIds(p.tier).length; i++) p.hand.push(new Spell(this.rngOf(p).pick(this.spellIds(p.tier)))); break;
        case "flame_all": { const l = p.board.filter(o => o !== m && hasTribe(o, ELEMENTAL)); l.forEach(o => o.buff(m.n(), m.n())); fx(l, m.n(), m.n()); break; }
        case "dragon_shield": {
          const l = p.board.filter(o => o !== m && hasTribe(o, DRAGON) && !o.shield);
          this.shuffleWith(this.rngOf(p), l);
          const picked = l.slice(0, m.mult());
          picked.forEach(o => (o.shield = true)); fx(picked, 0, 0, "Shield");
          break;
        }
        case "double_next": p.doubleNext += m.mult(); fx([m], 0, 0, m.golden ? "Next 2 Battlecries x2" : "Next Battlecry x2"); break;
        case "tide_rally": { const l = p.board.filter(o => o !== m && hasTribe(o, TIDEKIN)); l.forEach(o => o.buff(m.n(), m.n())); fx(l, m.n(), m.n()); break; }
        case "add_battlecry": {
          for (let k = 0; k < m.mult() && p.hand.length < HAND_MAX; k++) {
            const id = this.drawWhere(id => CARDS[id].tier <= p.tier && !!CARDS[id].battlecry && id !== "pearl_diver", this.rngOf(p), this.viewOf(p));
            if (id) { p.hand.push(new Minion(id)); fx([m], 0, 0, "+1 card"); }
          }
          this.lastTriple = this.checkTriples(p);
          break;
        }
        case "leviathan": { const x = Math.min(8, p.battlecries) * m.mult(); if (x) { p.board.forEach(o => o.buff(x, x)); fx(p.board, x, x); } break; }
        case "lose_health": this.addHealth(p, -2); fx([m], 0, 0, "-2 hero Health"); break;
        case "devour": this.devour(p, m, m.mult()); break;
        case "devour_all": this.devour(p, m, 3, m.golden ? 2 : 1); break;
        case "__abilities__": break;
        case "herald": {
          const tribes = new Set(p.board.flatMap(o => tribesOf(o)));
          const amt = tribes.size * m.mult();
          if (amt) { p.board.forEach(o => o.buff(amt, amt)); fx(p.board, amt, amt); }
          break;
        }
      }
    }

    // Devour: eat minions from the tavern and take their stats.
    // from: "shop" (full stats; Maw and the Devour rule make it 1.5x) or "board" / "hand" (eat a friend for its full stats)
    devour(p, m, count, extra = 1, from = "shop", pickUid = null) {
      // full stats from the tavern; Abyssal Maw and the Devour rule make it 1.5x (golden Maw 2x)
      const maw = Math.max(p.board.reduce((best, o) => (o.maw ? Math.max(best, o.golden ? 4 : 3) : best), 2), p.mods.devour ? 3 : 2);
      const [ba, bh] = passiveAH(p.board, "devourBonus"), keep = p.board.some((o) => o.health > 0 && (o.abilities || []).some((ab) => ab.trigger === "passive" && ab.action === "devourKeywords"));
      let eaten = 0;
      for (let k = 0; k < count; k++) {
        const pool = from === "board" ? p.board.filter((o) => o !== m) : from === "hand" ? p.hand.filter((o) => !o.isSpell) : p.shop;
        if (!pool.length) break;
        const x = pickUid != null ? pool.find((o) => o.uid === pickUid) : pool[this.rngOf(p).int(0, pool.length - 1)];
        if (!x) break;
        if (from === "board") p.board.splice(p.board.indexOf(x), 1); else if (from === "hand") p.hand.splice(p.hand.indexOf(x), 1); else p.shop.splice(p.shop.indexOf(x), 1);
        const f = from === "shop" ? maw * extra : 2 * extra;   // f / 2 of its stats: full from the tavern, 1.5x with Maw (2x golden); friends and hand give full
        const a = Math.ceil(x.attack * f / 2) + ba, h = Math.ceil(x.health * f / 2) + bh;
        m.buff(a, h); m.fed = (m.fed || 0) + 1; m.lastMeal = x; (m.eaten = m.eaten || []).push(x.cardId);
        if (keep) for (const kw of KW_LIST) if (x[kw]) m[kw] = true;
        this.returnToPool([x]);
        (this.lastDevour = this.lastDevour || []).push({ from: x.uid, into: m.uid, a, h });
        (this.lastEffects = this.lastEffects || []).push({ uids: [m.uid], a, h, label: "Devour", source: m.uid });
        eaten++;
        // the meal gets a word: "When this is Devoured" fires with the eater as the trigger
        if (hasTrig(x, "onDevoured") && (this.devouredDepth || 0) < 3) { this.devouredDepth = (this.devouredDepth || 0) + 1; this.runTavernAb(p, x, "onDevoured", m); this.devouredDepth--; }
      }
      if (!eaten) return 0;
      p.devours += eaten;
      { const g = passive(p.board, "devourGold") * eaten; if (g > 0) { p.gold += g; (this.lastEffects = this.lastEffects || []).push({ uids: [], a: 0, h: 0, label: `+${g} gold`, source: -1 }); } }
      for (const g of p.board) {
        if (g.onDevour !== "glutton") continue;
        const l = p.board.filter(o => o !== g && hasTribe(o, INFERNAL));
        for (let k = 0; k < eaten; k++) l.forEach(o => o.buff(g.n(), g.n()));
        if (l.length) this.lastEffects.push({ uids: l.map(o => o.uid), a: g.n() * eaten, h: g.n() * eaten, source: g.uid });
      }
      if (eaten && !this.inDevourHook) {
        this.inDevourHook = true;
        for (const o of [...p.board]) if (hasTrig(o, "afterDevour")) this.runTavernAb(p, o, "afterDevour", m);
        this.inDevourHook = false;
      }
      return eaten;
    }

    // Draw a specific kind of card from the pool (weighted by copies left).
    drawWhere(pred, rng = this.rng, view = this.pool) {
      let total = 0;
      for (const id in view) if (pred(id) && view[id] > 0) total += view[id];
      if (total <= 0) return "";
      let r = rng.int(1, total);
      for (const id in view) { if (!pred(id) || view[id] <= 0) continue; r -= view[id]; if (r <= 0) { this.take(id, view); return id; } }
      return "";
    }

    // Data-driven abilities in the tavern. `m` is null for custom spells.
    // ---------- affinities (tavern side)
    affs(p) { return affState(p.board); }
    // Steam: an effect with a Pressure cost fires only when the pool can pay it (0 = no, else how many times)
    payPressure(p, ab, m) {
      if (!(ab.pcost > 0)) return 1;
      const a = affFor("gauge", ab.paff, m), have = (p.gauges || {})[a] || 0;
      if (!a || affLevel(p.board, a) < 1 || have < ab.pcost) return 0;
      const times = ab.pall ? Math.floor(have / ab.pcost) : 1;
      p.gauges[a] = have - times * ab.pcost;
      (this.lastEffects = this.lastEffects || []).push({ uids: m ? [m.uid] : [], a: 0, h: 0, label: `-${times * ab.pcost} ${affMech(a, "en")}`, source: m ? m.uid : -1, aff: a });
      return times;
    }
    gainPressure(p, n, m, named) {
      const a = affFor("gauge", named, m); if (!a) return 0;
      const lv = affLevel(p.board, a); if (lv < 1 || n <= 0) return 0;
      if (!p.gauges) p.gauges = {};
      const before = p.gauges[a] || 0; p.gauges[a] = Math.min(affVal(a, lv), before + n);
      if (p.gauges[a] > before) (this.lastEffects = this.lastEffects || []).push({ uids: m ? [m.uid] : [], a: 0, h: 0, label: `+${p.gauges[a] - before} ${affMech(a, "en")}`, source: m ? m.uid : -1, aff: a });
      if (p.gauges[a] > before && p.gauges[a] >= affVal(a, lv) && (this.fullDepth || 0) < 4) { // just filled up
        this.fullDepth = (this.fullDepth || 0) + 1;
        try { for (const o of [...p.board]) if (hasTrig(o, "onPressureFull")) this.runTavernAb(p, o, "onPressureFull", m || null); this.heroTrig(p, "onPressureFull", m || null); } finally { this.fullDepth--; }
      }
      return p.gauges[a] - before;
    }
    // Foundations stay under a board slot, whoever stands there later; the cap is the best Foundation affinity's
    foundCap(p) { let c = 1; for (const a of affsOfKind("found")) c = Math.max(c, affVal(a, Math.max(1, affLevel(p.board, a)))); return c; }
    buildFoundation(p, i, src) {
      if (!p.found) p.found = [0, 0, 0, 0, 0, 0, 0];
      if (i < 0 || i >= BOARD_MAX || (p.found[i] || 0) >= this.foundCap(p)) return false;
      p.found[i] = (p.found[i] || 0) + 1;
      const on = p.board[i];
      (this.lastEffects = this.lastEffects || []).push({ uids: on ? [on.uid] : [], a: 0, h: 0, label: "+1 " + (affMech(affsOfKind("found")[0], "en") || "Foundation"), source: src ? src.uid : -1, aff: affsOfKind("found")[0] || "" });
      if ((this.foundDepth = (this.foundDepth || 0) + 1) < 8) for (const o of [...p.board]) if (hasTrig(o, "afterFoundation")) this.runTavernAb(p, o, "afterFoundation", on || null);
      this.foundDepth--;
      return true;
    }
    // level 1+: at the end of the turn, one Foundation under a random minion of that affinity whose slot still has room
    earthTurn(p) {
      for (const a of affsOfKind("found")) {
        const lv = affLevel(p.board, a); if (lv < 1) continue;
        const cap = Math.max(1, affVal(a, lv)), ids = p.board.map((m, i) => (hasAff(m, a) && (p.found[i] || 0) < cap ? i : -1)).filter((i) => i >= 0);
        if (ids.length) this.buildFoundation(p, ids[this.rngOf(p).int(0, ids.length - 1)], null);
      }
    }
    // Ebb: send a minion back to the hand, enchantments kept (as many times per turn as its best Ebb affinity allows)
    ebbAffOf(p, m) { let best = "", v = 0; for (const a of affsOf(m)) if (AFF[a] && AFF[a].kind === "ebb") { const x = affVal(a, affLevel(p.board, a)); if (x > v || !best) { best = a; v = x; } } return best; }
    refluxLeft(p, m) {
      const list = m ? [this.ebbAffOf(p, m)].filter(Boolean) : affsOfKind("ebb");
      let v = 0; for (const a of list) v = Math.max(v, affVal(a, affLevel(p.board, a)));
      return Math.max(0, v - (p.refluxUsed || 0));
    }
    canReflux(p, i) {
      const m = p.board[i], a = m ? this.ebbAffOf(p, m) : "";
      if (!m || !a) return "This minion can't Ebb back to your hand.";
      if (this.inTavern && !this.inTavern()) return "Only in the tavern.";
      if (affLevel(p.board, a) < 1) return `You need ${AFF[a].t1} ${AN(a)} minions for ${affMech(a)}.`;
      if (this.refluxLeft(p, m) <= 0) return "No Ebb left this turn.";
      if (p.hand.length >= HAND_MAX) return "Your hand is full.";
      return "";
    }
    reflux(p, i) {
      const err = this.canReflux(p, i); if (err) return err;
      const a = this.ebbAffOf(p, p.board[i]);
      const [m] = p.board.splice(i, 1);
      p.refluxUsed = (p.refluxUsed || 0) + 1;
      p.hand.push(m);
      this.lastEffects = [{ uids: [m.uid], a: 0, h: 0, label: affMech(a, "en") || "Ebb", source: m.uid, aff: a }];
      if (hasTrig(m, "onSelfEbb")) this.runTavernAb(p, m, "onSelfEbb");
      for (const o of [...p.board]) if (hasTrig(o, "afterReflux")) this.runTavernAb(p, o, "afterReflux", m);
      this.heroTrig(p, "afterReflux", m);
      return "";
    }
    runTavernAb(p, m, trig, src = null) {
      if (!m.tctr) m.tctr = {};
      const abs = m.abilities || [];
      const tryOne = (ab, i) => {
        if (!affOk(ab, p.board)) return false;
        if (!gate(ab, i, m, src, p.board, m.tctr, { turn: this.turn, health: p.health, p })) return false;
        if (limitHit(ab, "t" + i, m, this.turn)) return false;
        const pm = this.payPressure(p, ab, m); if (!pm) return false;
        return this.applyTavernAb(p, m, pm === 1 ? ab : Object.assign({}, ab, { _pm: pm }), src) !== false;
      };
      abs.forEach((ab, i) => {
        if (ab.trigger !== trig) return;
        let ok = tryOne(ab, i);
        for (let j = i + 1; j < abs.length && CHAIN.has(abs[j].trigger); j++) if (CHAIN_THEN.has(abs[j].trigger) === ok) ok = tryOne(abs[j], j);
      });
      // an Evolve whose crystal charges on this event
      for (const ab of m.abilities || []) if (ab.trigger === "evoFull" && ab.src === trig && srcOk(ab, src)) { this.chargeEvo(p, m, ab.golden === false ? 1 : m.mult()); break; }
    }
    // Evolution: fill the crystal; when it's full the Evolve effects fire (once, or again and again when repeatable)
    chargeEvo(p, m, n) {
      if (!m || n <= 0 || !p.board.includes(m)) return;
      const g = m.evoGauge(); if (!g || g.done || g.none) return;
      m.evo = (m.evo || 0) + n;
      (this.lastEffects = this.lastEffects || []).push({ uids: [m.uid], a: 0, h: 0, label: `+${n} Evolution`, source: m.uid, evo: true });
      this.fireEvolve(p, m);
    }
    fireEvolve(p, m) {
      // at the end of the turn or after a fight, a full crystal waits: its Evolution opens the next turn
      if (this.evoDefer) { const g0 = m.evoGauge(); if (g0 && !g0.done && !g0.none && (m.evo || 0) >= g0.need && !m.evoReady) { m.evoReady = true; (this.lastEffects = this.lastEffects || []).push({ uids: [m.uid], a: 0, h: 0, label: "Evolution next turn", source: m.uid, evo: true }); } return; }
      for (let guard = 0; guard < 6; guard++) {
        if (!p.board.includes(m)) return;
        const g = m.evoGauge(); if (!g || g.done || g.none || (m.evo || 0) < g.need) return;
        const abs = m.abilities.filter((ab) => ab.trigger === "evoFull"), first = abs[0];
        m.evo -= g.need; m.evoLv = (m.evoLv || 0) + 1;
        if (!first.rep) { m.evoDone = true; m.evo = 0; }
        (this.lastEffects = this.lastEffects || []).push({ uids: [m.uid], a: 0, h: 0, label: "Evolution!", source: m.uid, evo: true, evoFull: true });
        if (!m.tctr) m.tctr = {};
        for (const ab of abs) {
          if (!p.board.includes(m)) return; // it became another minion
          const k = m.abilities.indexOf(ab);
          if (!gate(Object.assign({}, ab, { every: 0 }), k, m, null, p.board, m.tctr, { turn: this.turn, health: p.health, p })) continue;
          this.applyTavernAb(p, m, ab, null);
        }
      }
    }
    // a mutation: stats, a keyword and/or an extra effect, kept for good
    applyMut(p, m, o) {
      const d = mutDef(o); if (!d || !m) return;
      const k = m.mult(), a = (d.a || 0) * k, h = (d.h || 0) * k;
      if (a || h) m.buff(a, h);
      if (d.kw && KW_LIST.includes(d.kw)) m[d.kw] = true;
      if (d.grant && TRIGGERS[d.grant.trigger] && ACTIONS[d.grant.action]) { const g = JSON.parse(JSON.stringify(d.grant)); m.granted = (m.granted || []).concat([g]); m.abilities = (m.abilities || []).concat([g]); }
      m.muts = (m.muts || []).concat([mutName(d)]);
      (this.lastEffects = this.lastEffects || []).push({ uids: [m.uid], a, h, label: mutName(d), source: m.uid, evo: true });
      if (a || h) this.afterBuffed(p, [m], m);
    }
    // how much bigger a stat effect is: the source's own Empower, the "effects give more" aura, or the spell aura
    boostFor(p, m) {
      const [a, h] = m ? passiveAH(p.board, "buffBoost") : passiveAH(p.board, "spellBoost");
      return [a + (m ? m.boostA : 0), h + (m ? m.boostH : 0)];
    }
    applyTavernAb(p, m, ab, src) {
      if (!ab._dl && ab.delay > 0) {
        (p.later = p.later || []).push({ turn: this.turn + ab.delay, uid: m ? m.uid : -1, ab: Object.assign({}, ab, { _ch: 1, _dl: 1 }) });
        (this.lastEffects = this.lastEffects || []).push({ uids: m ? [m.uid] : [], a: 0, h: 0, label: `In ${ab.delay} turn${ab.delay > 1 ? "s" : ""}…`, source: m ? m.uid : -1 });
        return;
      }
      if (!ab._rp && ab.repeat > 1) { const a2 = Object.assign({}, ab, { _dl: 1, _rp: 1 }); let any = false; for (let r = 0; r < Math.min(10, ab.repeat); r++) if (this.applyTavernAb(p, m, a2, src) !== false) any = true; return any; }
      if (!ab._ch && ab.chance > 0 && ab.chance < 100) {
        const ok = this.rngOf(p).next() * 100 < ab.chance;
        if (m && ok) (this.lastEffects = this.lastEffects || []).push({ uids: [m.uid], a: 0, h: 0, label: "", dice: { pct: ab.chance, ok }, source: m.uid }); // only a success shows
        if (!ok) return false; ab = Object.assign({}, ab, { _ch: 1 });
      }
      // "you choose" targets: the effect waits in p.picks until the player (or the bot) picks; then it runs with _pick set
      if (ab._pick == null && (PICK_TARGETS.has(ab.target) && (ACTIONS[ab.action] || {}).fields && ACTIONS[ab.action].fields.includes("target") || (ab.action === "devour" && PICK_DEVOUR[ab.devourFrom]))) {
        const dv = ab.action === "devour" && PICK_DEVOUR[ab.devourFrom], zone = dv ? PICK_DEVOUR[ab.devourFrom] : ab.target === "pickShop" ? "shop" : ab.target === "pickHand" ? "hand" : "board";
        const pool = (dv ? pickPool(zone === "board" ? "pickFriend" : zone === "shop" ? "pickShop" : "pickHand", m, p.board, { shop: p.shop, hand: p.hand }) : pickPool(ab.target, m, p.board, { shop: p.shop, hand: p.hand })).filter((o) => (!ab.ttribe || hasTribe(o, ab.ttribe)) && (!ab.tkw || !!o[ab.tkw]) && (!ab.tmk || mkN(o) > 0) && (!ab.ttok || (ab.ttok === "no" ? !o.token : !!o.token)));
        if (!pool.length) return;
        (p.picks = p.picks || []).push({ uid: m ? m.uid : -1, src: src ? src.uid : -1, ab, zone, cands: pool.map((o) => o.uid), text: abilityText(ab, !!(m && m.golden)) });
        if (m) (this.lastEffects = this.lastEffects || []).push({ uids: [m.uid], a: 0, h: 0, label: "Choose...", source: m.uid });
        return;
      }
      const sc = scale(ab, m, p.board, [], p, this.turn);
      if (ab.per && sc <= 0) return;
      const k = (m && ab.golden !== false ? m.mult() : 1) * sc * (ab._pm || 1) * labMul(ab, m, () => this.rngOf(p).next());
      const fx = (list, a, h, label) => { if (list.length) (this.lastEffects = this.lastEffects || []).push({ uids: list.map((o) => o.uid), a, h, label, source: m ? m.uid : -1, fx: ab.fx || "" }); };
      // tavern and hand targets only make sense for effects that change a minion in place; anything that moves, copies or removes one stays on the board
      const ts = () => { const l = tsRaw(); if (ab.target !== "previous") LAST.ts = l; return l; };
      const tsRaw = () => { const l = abilityTargets(ab, m, p.board, [], src, this.rngOf(p), { shop: p.shop, hand: p.hand, shopFrozen: p.frozen, tavern: true, coral: affLevel(p.board, affsOfKind("pulse")[0]), foundAt: (o) => (p.found && p.board.indexOf(o) >= 0 ? p.found[p.board.indexOf(o)] || 0 : 0) }); return OFFBOARD_OK.has(ab.action) ? l : l.filter((t) => p.board.includes(t)); };
      const n = (ab.n || 0) * k, c = Math.max(1, ab.count || 1);
      switch (ab.action) {
        case "evolve": {
          if (!m || !p.board.includes(m)) break;
          let opts = (ab.cards || []).filter((id) => id && (CARDS[id] || TOKENS[id]));
          if (ab.mode === "random") {
            const view = this.viewOf(p), up = ab.tierUp == null ? 1 : ab.tierUp, tier = Math.min(MAX_TIER, Math.max(1, (m.tier || 1) + up));
            const tribe = ab.rtribe === "same" ? (tribesOf(m)[0] || "") : ab.rtribe || "";
            const base = Object.keys(CARDS).filter((id) => id !== m.cardId && CARDS[id].inPool !== false && (view[id] == null || view[id] > 0));
            let ids = base.filter((id) => CARDS[id].tier === tier && (!tribe || hasTribe(CARDS[id], tribe)));
            if (!ids.length) ids = base.filter((id) => CARDS[id].tier <= tier && (!tribe || hasTribe(CARDS[id], tribe)));
            if (!ids.length) ids = base.filter((id) => CARDS[id].tier === tier);
            opts = pickN(this.rngOf(p), ids, Math.max(1, Math.min(5, ab.count || 3)));
            if (!opts.length) break;
            if (opts.length === 1) { this.evolveMinion(p, m, opts[0]); break; }
          }
          if (opts.length >= 2) { (p.evolveChoices = p.evolveChoices || []).push({ uid: m.uid, options: opts }); fx([m], 0, 0, "Evolving..."); }
          else this.evolveMinion(p, m, opts[0] || ab.card);
          break;
        }
        case "charge": { const cn = Math.max(1, ab.n || 1) * k; for (const t of ts()) this.chargeEvo(p, t, cn); break; }
        case "mutateTarget": { for (const t of ts().filter((o) => p.board.includes(o))) this.applyTavernAb(p, t, Object.assign({}, ab, { action: "mutate", target: undefined }), src); break; }
        case "mutate": {
          if (!m || !p.board.includes(m)) break;
          const opts = ab.rmut > 0 ? pickN(this.rngOf(p), MUT_LIB, Math.min(MUT_LIB.length, ab.rmut)).map((x) => ({ lib: x.id })) : (ab.muts || []).filter((o) => mutDef(o)).map((o) => JSON.parse(JSON.stringify(o)));
          if (!opts.length) break;
          if (opts.length === 1) { this.applyMut(p, m, opts[0]); break; }
          (p.evolveChoices = p.evolveChoices || []).push({ uid: m.uid, kind: "mut", options: opts }); fx([m], 0, 0, "Mutating...");
          break;
        }
        case "buff": { const l = ts(), [ba, bh] = this.boostFor(p, m); if (!l.length) break; const a = (ab.a || 0) * k + (ab.a || ab.h ? ba : 0), h = (ab.h || 0) * k + (ab.a || ab.h ? bh : 0); l.forEach((t) => t.buff(a, h)); fx(l, a, h); this.afterBuffed(p, l, m); break; }
        case "copyKeywords": { if (!m) break; const l = ts().filter((t) => t !== m); let got = []; for (const t of l) for (const kw of KW_LIST) if (t[kw] && !m[kw]) { m[kw] = true; got.push(KW_TEXT[kw] || kw); } if (got.length) fx([m], 0, 0, got.join(" ")); break; }
        case "gainPressure": this.gainPressure(p, n, m, ab.gaff); break;
        case "pulseDouble": p.pulseNext2 = (p.pulseNext2 || 0) + Math.max(1, n || 1); fx(m ? [m] : [], 0, 0, "Next Pulse x2"); break;
        case "buildFoundation": { for (const t of ts()) { const i = p.board.indexOf(t); if (i >= 0) this.buildFoundation(p, i, m); } break; }
        case "foundationAll": { for (let i = 0; i < BOARD_MAX; i++) this.buildFoundation(p, i, m); break; }
        case "foundationGrow": {
          const got = []; p.board.forEach((t, i) => { const f = p.found ? p.found[i] || 0 : 0; if (f > 0 && t.health > 0) { t.buff((ab.a || 0) * k * f, (ab.h || 0) * k * f); got.push(t); } });
          fx(got, 0, 0, "Foundations"); break;
        }
        case "releasePressure": {
          const ga = affFor("gauge", ab.gaff, m); if (!ga || !p.gauges) break;
          const pts = p.gauges[ga] || 0; if (pts <= 0) break;
          p.gauges[ga] = 0; const l = ts(); const ra = (ab.a || 0) * k * pts, rh = (ab.h || 0) * k * pts;
          l.forEach((t) => t.buff(ra, rh)); fx(l, ra, rh, `-${pts} ${affMech(ga, "en")}`); break;
        }
        case "ebbMore": { p.refluxUsed = (p.refluxUsed || 0) - Math.max(1, n || 1); fx(m ? [m] : [], 0, 0, `+${Math.max(1, n || 1)} ${affMech(affsOfKind("ebb")[0], "en") || "Ebb"}`); break; }
        case "affStats": {
          if (!ab.aff) break; const l = p.board.concat(p.hand).filter((t) => !t.isSpell && t.health > 0 && hasAff(t, ab.aff));
          l.forEach((t) => t.buff((ab.a || 0) * k, (ab.h || 0) * k)); fx(l.filter((t) => p.board.includes(t)), (ab.a || 0) * k, (ab.h || 0) * k); if (m && l.some((t) => p.hand.includes(t))) fx([m], 0, 0, "Hand too"); break;
        }
        case "giveAff": { const got = ts().filter((t) => !t.isSpell && giveAff(t, ab.aff)); fx(got, 0, 0, AN(ab.aff)); break; }
        case "counter": {
          const nm = (ab.vname || "Charge").trim().slice(0, 16) || "Charge", v = (ab.n || 0) * (m && ab.golden !== false ? m.mult() : 1) * sc;
          const bag = ab.scope === "player" ? (p.vars = p.vars || {}) : m ? (m.vars = m.vars || {}) : (p.vars = p.vars || {});
          bag[nm] = Math.max(-9999, Math.min(99999, ab.op === "set" ? v : (bag[nm] || 0) + v));
          fx(m ? [m] : [], 0, 0, `${nm} ${bag[nm]}`);
          break;
        }
        case "signal": {
          const sg = (ab.sigOut || ab.sig || "").trim(); if (!sg || (this.sigDepth || 0) >= 6) break;
          this.sigDepth = (this.sigDepth || 0) + 1; const prev = SIG.cur; SIG.cur = sg;
          if (m) fx([m], 0, 0, "📣 " + sg);
          try { for (const o of [...p.board]) if (hasTrig(o, "onSignal")) this.runTavernAb(p, o, "onSignal", m); } finally { SIG.cur = prev; this.sigDepth--; }
          break;
        }
        case "fireTrigger": {
          const tg = FIRE_TAVERN.includes(ab.trig) ? ab.trig : "battlecry"; if ((this.fireDepth || 0) >= 4) break;
          // a chain fires each minion once (like Pulse): the set lives while the outermost trigger runs
          if (!this.fireDepth) this.fired = new Set(); if (m) this.fired.add(m);
          this.fireDepth = (this.fireDepth || 0) + 1;
          try { for (const t of ts()) { if (!p.board.includes(t) || (t === m && !ab.allowSelf) || this.fired.has(t)) continue; this.fired.add(t); if (tg === "battlecry") { if (t.hasBattlecry()) this.battlecry(p, t); } else this.runTavernAb(p, t, tg); fx([t], 0, 0, "Echo!"); } }
          finally { this.fireDepth--; }
          break;
        }
        case "nextSpellTwice": p.nextSpell2 += Math.max(1, n || 1); fx(m ? [m] : [], 0, 0, `Next ${Math.max(1, n || 1) > 1 ? Math.max(1, n || 1) + " spells" : "spell"} x2`); break;
        case "nextBattlecryTwice": p.nextBc2 += Math.max(1, n || 1); fx(m ? [m] : [], 0, 0, `Next ${Math.max(1, n || 1) > 1 ? Math.max(1, n || 1) + " Battlecries" : "Battlecry"} x2`); break;
        case "nextBuyBuff": { const [ba, bh] = this.boostFor(p, m); for (let i = 0; i < c * k; i++) p.nextBuy.push([(ab.a || 0) * (m ? m.mult() : 1) + ba, (ab.h || 0) * (m ? m.mult() : 1) + bh]); fx(m ? [m] : [], 0, 0, "Next buys +"); break; }
        case "nextPlayBuff": { const [ba, bh] = this.boostFor(p, m); for (let i = 0; i < c * k; i++) p.nextPlay.push([(ab.a || 0) * (m ? m.mult() : 1) + ba, (ab.h || 0) * (m ? m.mult() : 1) + bh]); fx(m ? [m] : [], 0, 0, "Next plays +"); break; }
        case "nextSellGold": for (let i = 0; i < c * k; i++) p.nextSell.push(Math.max(0, n)); fx(m ? [m] : [], 0, 0, "Next sales +gold"); break;
        case "spitCopy": { if (!m || !m.eaten || !m.eaten.length) break; const id = m.eaten[m.eaten.length - 1]; if (p.hand.length < HAND_MAX && (CARDS[id] || TOKENS[id])) { const nm = new Minion(id); p.hand.push(nm); fx([nm], 0, 0, "Copy"); } break; }
        case "absorb": { if (!m) break; const l = ts().filter((t) => t !== m); const a = l.reduce((x, t) => x + t.attack, 0) * k, h = l.reduce((x, t) => x + Math.max(0, t.health), 0) * k; if (a || h) { m.buff(a, h); fx([m], a, h); this.afterBuffed(p, [m], m); } break; }
        case "empower": { const l = ts(); l.forEach((t) => { t.boostA += (ab.a || 0) * k; t.boostH += (ab.h || 0) * k; }); fx(l, 0, 0, `Effects +${(ab.a || 0) * k}/+${(ab.h || 0) * k}`); break; }
        case "keyword": { const l = ts(); l.forEach((t) => (CKW[ab.kw] ? giveCkw(t, ab.kw) : (t[ab.kw || "taunt"] = true))); fx(l, 0, 0, kwName(ab.kw || "taunt")); break; }
        case "setStats": { const l = ts(), a = (ab.a || 0) * k, h = Math.max(1, (ab.h || 1) * k); l.forEach((t) => { t.attack = a; t.health = h; t.maxHealth = h; }); fx(l, 0, 0, `${a}/${h}`); break; }
        case "swapStats": { const l = ts().filter((t) => t.attack > 0); l.forEach((t) => { [t.attack, t.health] = [t.health, t.attack]; t.maxHealth = t.health; }); fx(l, 0, 0, "Swapped"); break; }
        case "doubleStats": {
          const l = ts(), f = 1 + (m && ab.golden !== false ? m.mult() : 1);
          l.forEach((t) => t.buff(ab.stat !== "health" ? t.attack * (f - 1) : 0, ab.stat !== "attack" ? t.health * (f - 1) : 0)); fx(l, 0, 0, `x${f}`); break;
        }
        case "removeKeyword": { const l = ts().filter((t) => hasKw(t, ab.kw || "taunt")); l.forEach((t) => (CKW[ab.kw] ? takeCkw(t, ab.kw) : (t[ab.kw || "taunt"] = false))); fx(l, 0, 0, "No " + kwName(ab.kw || "taunt")); break; }
        case "summonCopy": {
          let at = m ? p.board.indexOf(m) + 1 : p.board.length; if (at <= 0) at = p.board.length;
          const made = [];
          for (const t of ts()) for (let i = 0; i < c * (m && ab.golden !== false ? m.mult() : 1) && p.board.length < BOARD_MAX; i++) {
            if (t.isCopy && t === m) break; // a copy can't copy itself again
            const x = ab.exact ? t.clone(false) : new Minion(t.cardId, t.golden); x.isCopy = true; if (ab.a) x.attack = ab.a; if (ab.h) { x.health = ab.h; x.maxHealth = ab.h; }
            p.board.splice(at + made.length, 0, x); made.push(x);
          }
          fx(made, 0, 0, "Copied"); break;
        }
        case "makeGolden": {
          const made = [];
          for (const t of ts()) {
            if (t.golden || t.token || t.isSpell) continue;
            const i = p.board.indexOf(t); if (i < 0) continue;
            const g = new Minion(t.cardId, true), [ta, th] = mkStatAH(t);
            g.buff(t.attack - t.baseAttack() - ta, t.health - t.baseHealth() - th);
            for (const kw of KW_LIST) if (t[kw] && !(t.mk && t.mk.kw[kw])) g[kw] = true;
            for (const [x, n] of Object.entries(mkSt(t))) mkAddStat(g, x, n); for (const k of mkKws(t)) mkAddKw(g, k);
            p.board[i] = g; made.push(g);
          }
          fx(made, 0, 0, "Golden!"); break;
        }
        case "transform": {
          const made = [];
          for (const t of ts()) {
            const i = p.board.indexOf(t), id = randomCardId(this.rngOf(p), ab.tier, ab.tribe, ab.allowSelf || !m ? "" : m.cardId);
            if (i < 0 || !id) continue;
            const x = new Minion(id); p.board[i] = x; made.push(x);
          }
          fx(made, 0, 0, "Transformed"); break;
        }
        case "stealShop": {
          for (let i = 0; i < c * (m && ab.golden !== false ? m.mult() : 1) && p.shop.length && p.hand.length < HAND_MAX; i++) p.hand.push(p.shop.splice(this.rngOf(p).int(0, p.shop.length - 1), 1)[0]);
          this.lastTriple = (this.lastTriple || []).concat(this.checkTriples(p));
          if (m) fx([m], 0, 0, "Free minion"); break;
        }
        case "buffHand": { const l = p.hand.filter((t) => !t.isSpell); l.forEach((t) => t.buff((ab.a || 0) * k, (ab.h || 0) * k)); if (m) fx([m], 0, 0, `Hand +${(ab.a || 0) * k}/+${(ab.h || 0) * k}`); break; }
        case "freeUpgrade": if (p.tier < MAX_TIER) { p.tier++; p.upgradeCost = this.upCost(p); if (m) fx([m], 0, 0, "Tier up!"); } break;
        case "refreshShop": p.frozen = false; this.refill(p); if (m) fx([m], 0, 0, "Refreshed"); break;
        case "freezeShop": p.frozen = true; if (m) fx([m], 0, 0, "Frozen"); break;
        case "freezeMinion": { const got = ts().filter((t) => p.shop.includes(t) && !t.ice); got.forEach((t) => { t.ice = true; }); if (got.length) (this.lastEffects = this.lastEffects || []).push({ uids: got.map((t) => t.uid), a: 0, h: 0, label: "Frozen", source: m ? m.uid : -1, shop: true }); break; }
        case "grantEffect": {
          if (!ab.grant) break;
          const l = ts().filter((t) => !t.isSpell);
          for (const t of l) { const g = JSON.parse(JSON.stringify(ab.grant)); t.granted = (t.granted || []).concat([g]); t.abilities = (t.abilities || []).concat([g]); }
          fx(l, 0, 0, "New effect"); break;
        }
        case "bounce": {
          const l = ts().filter((t) => p.board.includes(t) && t !== m);
          for (const t of l) { if (p.hand.length >= HAND_MAX) break; p.board.splice(p.board.indexOf(t), 1); p.hand.push(t); }
          break;
        }
        case "setTribe": {
          const l = ts();
          if (ab.toTribe === "?") {
            if (!l.length || !this.tribes.length) break;
            if (p.isBot) { const t = this.bestTribe(p); l.forEach((x) => x.setTribe(t)); fx(l, 0, 0, TN(t)); }
            else p.tribePick.push({ uids: l.map((x) => x.uid) });
            break;
          }
          l.forEach((t) => t.setTribe(ab.toTribe || "")); fx(l, 0, 0, TN(ab.toTribe) || "Neutral"); break;
        }
        case "sacrifice": {
          for (const t of ts()) {
            const i = p.board.indexOf(t); if (i < 0) continue;
            const others = p.board.filter((o) => o !== t);
            const to = ab.give === "random" ? (others.length ? [others[this.rngOf(p).int(0, others.length - 1)]] : []) : ab.give === "adjacent" ? [p.board[i - 1], p.board[i + 1]].filter(Boolean) : ab.give === "self" && m && m !== t ? [m] : [];
            p.board.splice(i, 1);
            this.returnToPool([t]);
            to.forEach((o) => o.buff(t.attack, t.health));
            fx(to, t.attack, t.health, "Sacrifice");
          }
          break;
        }
        case "nextCombatBuff": { const nc = p.nextCombat || (p.nextCombat = { a: 0, h: 0, strikes: [] }); nc.a += (ab.a || 0) * k; nc.h += (ab.h || 0) * k; if (m) fx([m], 0, 0, "Next combat"); break; }
        case "nextCombatStrike": { const nc = p.nextCombat || (p.nextCombat = { a: 0, h: 0, strikes: [] }); nc.strikes.push({ n: n, all: ab.spread === "all", count: c, fx: ab.fx || "" }); if (m) fx([m], 0, 0, "Next combat"); break; }
        case "summon": {
          if (!(CARDS[ab.card] || TOKENS[ab.card])) break;
          let at = m ? p.board.indexOf(m) + 1 : p.board.length;
          if (at <= 0) at = p.board.length;
          const made = [];
          for (let i = 0; i < c && p.board.length < BOARD_MAX; i++) {
            const t = new Minion(ab.card, !!(m && m.golden && ab.golden !== false));
            if (ab.a) t.attack = ab.a * k; if (ab.h) { t.health = ab.h * k; t.maxHealth = t.health; }
            p.board.splice(at + i, 0, t); made.push(t);
          }
          fx(made, 0, 0, "Summoned");
          break;
        }
        case "gold": if (this.inGameStart) p.nextGold += n; else p.gold += n; if (m) fx([m], 0, 0, `+${n} gold`); break;
        case "nextGold": p.nextGold += n; if (m) fx([m], 0, 0, `+${n} gold next turn`); break;
        case "freeRoll": p.freeRolls += n; if (m) fx([m], 0, 0, n === 1 ? "Free Refresh" : `${n} free Refreshes`); break;
        case "addMinion":
          for (let i = 0; i < c * k && p.hand.length < HAND_MAX; i++) { const id = this.drawWhere((id) => CARDS[id].tier <= p.tier && (!ab.tribe || hasTribe(CARDS[id], ab.tribe)) && (ab.allowSelf || !m || id !== m.cardId), this.rngOf(p), this.viewOf(p)); if (id) p.hand.push(new Minion(id)); }
          this.lastTriple = (this.lastTriple || []).concat(this.checkTriples(p));
          break;
        case "addSpell": for (let i = 0; i < c * k && p.hand.length < HAND_MAX && this.spellIds(p.tier).length; i++) p.hand.push(new Spell(this.rngOf(p).pick(this.spellIds(p.tier)))); break;
        case "addSpellId": { if (!SPELLS[ab.spell]) break; let n2 = 0; for (let i = 0; i < c * k && p.hand.length < HAND_MAX; i++) { p.hand.push(new Spell(ab.spell)); n2++; } if (n2) fx(m ? [m] : [], 0, 0, `+${n2} ${SPELLS[ab.spell].name}`); break; }
        case "copySpell": { if (!p.lastSpellId || !SPELLS[p.lastSpellId]) break; for (let i = 0; i < c * k && p.hand.length < HAND_MAX; i++) p.hand.push(new Spell(p.lastSpellId)); break; }
        case "castSpell": {
          const sp = SPELLS[ab.spell]; if (!sp || (this.castDepth || 0) >= 3) break;
          let tgt = -1;
          if (sp.target) { const t0 = ts().filter((t) => p.board.includes(t)); if (!t0.length) break; tgt = p.board.indexOf(t0[0]); }
          // cast for free: the spell joins the hand for a moment and is cast from there; the effects shown so far are kept
          const keep = this.lastEffects || [], keepT = this.lastTriple || [], spell = new Spell(ab.spell); p.hand.push(spell);
          this.castDepth = (this.castDepth || 0) + 1;
          let err = ""; try { err = this.cast(p, p.hand.length - 1, tgt); } finally { this.castDepth--; }
          if (err) { const at = p.hand.indexOf(spell); if (at >= 0) p.hand.splice(at, 1); }
          this.lastEffects = keep.concat(this.lastEffects || []); this.lastTriple = keepT.concat(this.lastTriple || []);
          if (!err && m) fx([m], 0, 0, sp.name);
          break;
        }
        case "addCard":
          if (CARDS[ab.card] || TOKENS[ab.card]) for (let i = 0; i < c * k && p.hand.length < HAND_MAX; i++) p.hand.push(new Minion(ab.card));
          this.lastTriple = (this.lastTriple || []).concat(this.checkTriples(p));
          break;
        case "discover": { const spec = { tierMode: ab.tierMode || "current", dtier: ab.dtier, tribe: ab.tribe || "", dkw: ab.dkw || "", daff: ab.daff || "", choices: ab.choices || 0, golden: !!ab.dgolden }; for (let i = 0; i < Math.max(1, ab.times || 1) * k; i++) this.queueDiscover(p, spec); break; }
        case "devour": {
          // no target = this minion (older cards); spells and others pick who eats
          const eaters = !ab.target || ab.target === "self" ? (m ? [m] : []) : ts();
          const from = PICK_DEVOUR[ab.devourFrom] || (ab.devourFrom === "board" ? "board" : ab.devourFrom === "hand" ? "hand" : "shop");
          for (const t of eaters) if (p.board.includes(t)) this.devour(p, t, PICK_DEVOUR[ab.devourFrom] ? 1 : c * k, 1, from, ab._pick);
          break;
        }
        case "goldenHand": {
          const made = [];
          for (let i = 0; i < c * k; i++) {
            const pool = p.hand.filter((t) => !t.isSpell && !t.golden && !t.token); if (!pool.length) break;
            const t = pool[this.rngOf(p).int(0, pool.length - 1)], g = new Minion(t.cardId, true);
            g.buff(t.attack - t.baseAttack(), t.health - t.baseHealth()); for (const kw of KW_LIST) if (t[kw]) g[kw] = true; g.poolCost = t.poolCost != null ? t.poolCost : 1;
            p.hand[p.hand.indexOf(t)] = g; made.push(g);
          }
          fx(made, 0, 0, "Golden!"); break;
        }
        case "passStats": {
          const giver = src && !src.isSpell ? src : m; // "When you sell this": the minion itself
          if (!giver) break;
          const l = ts().filter((t) => t !== giver), a = Math.max(0, giver.attack), h = Math.max(0, giver.health);
          l.forEach((t) => t.buff(a, h)); fx(l, a, h, "Inherited"); break;
        }
        case "randomKeyword": {
          const l = ts().filter((t) => !t.isSpell), got = [];
          for (const t of l) { const opts = KW_LIST.filter((x) => !t[x]); if (!opts.length) continue; const kw = this.rngOf(p).pick(opts); t[kw] = true; got.push(KW_TEXT[kw]); }
          fx(l, 0, 0, got.length === 1 ? got[0] : "Keywords"); break;
        }
        case "mkPlus": {
          const l = ts().filter((t) => !t.isSpell), nn = Math.max(1, ab.n || 1) * k, key = mkKey(ab.a == null ? 1 : ab.a, ab.h == null ? 1 : ab.h);
          l.forEach((t) => mkAddStat(t, key, nn)); fx(l, 0, 0, mkStLabel({ [key]: nn }) + (nn > 1 ? " markers" : " marker")); if (l.length) this.afterBuffed(p, l, m); break;
        }
        case "mkKw": {
          const l = ts().filter((t) => !t.isSpell), nn = Math.max(1, ab.n || 1) * k, got = [], hit = [];
          for (const t of l) {
            const want = !ab.mkw || ab.mkw === "random" ? pickN(this.rngOf(p), MK_KWS().filter((x) => !t[x] && !(t.mk && t.mk.kw[x])), nn) : [ab.mkw];
            const added = want.filter((x) => mkAddKw(t, x)); if (added.length) { got.push(...added); hit.push(t); }
          }
          fx(hit, 0, 0, got.length === 1 ? kwName(got[0]) + " marker" : "Markers"); break;
        }
        case "mkMove": case "mkRemove": {
          if (ab.action === "mkMove" && !m) break;
          const nn = Math.max(1, ab.n || 1) * k, from = ts().filter((t) => t !== m && !t.isSpell && mkN(t) > 0), rng = this.rngOf(p), moved = [];
          if (ab.action === "mkMove") {
            for (let i = 0; i < nn;) { const srcs = from.filter((t) => mkOpts(t, ab.mkind || "", m).length); if (!srcs.length) break; const a = rng.pick(srcs), w = mkMoveOne(a, m, ab.mkind || "", rng); if (!w) { from.splice(from.indexOf(a), 1); continue; } i++; moved.push(w); }
            if (moved.length) { fx([m], 0, 0, moved.length === 1 ? mkOneLabel(moved[0]) : `${moved.length} markers`); if (moved.some((w) => w.startsWith("s:"))) this.afterBuffed(p, [m], m); }
          } else {
            for (const a of from) for (let i = 0; i < nn; i++) { if (!mkMoveOne(a, null, ab.mkind || "", rng)) break; moved.push(a); }
            fx([...new Set(moved)], 0, 0, "Markers removed");
          }
          break;
        }
        case "mkTake": {
          if (!m) break;
          const l = ts().filter((t) => t !== m && !t.isSpell), keep = ab.mkeep === "copy", all = { st: {}, kw: [] };
          for (const t of l) {
            const g = mkTakeAll(t, m, keep, k); for (const x in g.st) all.st[x] = (all.st[x] || 0) + g.st[x]; all.kw.push(...g.kw);
            if (ab.mkeep === "eat") { const i = p.board.indexOf(t); if (i >= 0) { p.board.splice(i, 1); this.returnToPool([t]); } }
          }
          if (Object.keys(all.st).length || all.kw.length) { fx([m], 0, 0, mkLabel(all)); if (Object.keys(all.st).length) this.afterBuffed(p, [m], m); }
          break;
        }
        case "goldRandom": { const g = this.rngOf(p).int(1, Math.max(1, n)); if (this.inGameStart) p.nextGold += g; else p.gold += g; fx(m ? [m] : [], 0, 0, `+${g} gold`); (this.lastEffects = this.lastEffects || []).push({ uids: [], a: 0, h: 0, label: `+${g} gold`, source: -1 }); break; }
        case "freeBuy": p.freeBuys = (p.freeBuys || 0) + Math.max(1, n); if (m) fx([m], 0, 0, "Free buys"); break;
        case "repeatBattlecry":
          if (src && !src.isSpell && p.board.includes(src) && src.hasBattlecry() && (this.echoDepth || 0) < 3) { this.echoDepth = (this.echoDepth || 0) + 1; this.battlecry(p, src); this.echoDepth--; fx([src], 0, 0, "Echo!"); }
          break;
        case "stealGold": {
          const others = this.alive().filter((x) => x !== p && (!this.duo || x.team !== p.team));
          const o = this.nextOpponentOf(p) || (others.length ? this.rngOf(p).pick(others) : null);
          if (!o || o === p) break;
          o.nextGold -= n; if (this.inGameStart) p.nextGold += n; else p.gold += n;
          (this.lastEffects = this.lastEffects || []).push({ uids: [], a: 0, h: 0, label: `Stole ${n} gold`, source: -1 }); break;
        }
        case "copyNextOpponent": {
          const others = this.alive().filter((x) => x !== p && (!this.duo || x.team !== p.team));
          const o = this.nextOpponentOf(p) || (others.length ? this.rngOf(p).pick(others) : null);
          const pool = (o ? o.board : []).filter((x) => !x.token && CARDS[x.cardId]);
          for (let i = 0; i < c && pool.length && p.hand.length < HAND_MAX; i++) { const x = new Minion(this.rngOf(p).pick(pool).cardId); x.poolCost = 0; p.hand.push(x); }
          this.lastTriple = (this.lastTriple || []).concat(this.checkTriples(p));
          break;
        }
        case "tribeShop": {
          const tribe = ab.tribeMode === "main" ? this.bestTribe(p) : this.rngOf(p).pick(this.tribes);
          if (!tribe) break;
          this.returnToPool(p.shop); p.shop = []; p.frozen = false;
          const size = Math.max(1, Math.min(BOARD_MAX, SHOP_SIZE[p.tier] + passive(p.board, "shopSize") + (p.mods.shop || 0)));
          for (let i = 0; i < size; i++) { const id = this.drawWhere((id) => CARDS[id].tier <= p.tier && hasTribe(CARDS[id], tribe), this.rngOf(p), this.viewOf(p)); if (!id) break; const x = new Minion(id); if (p.shopBuff) x.buff(p.shopBuff, p.shopBuff); p.shop.push(x); }
          (this.lastEffects = this.lastEffects || []).push({ uids: p.shop.map((x) => x.uid), a: 0, h: 0, label: TN(tribe), source: -1, shop: true });
          break;
        }
        case "shuffleBoard": this.shuffleWith(this.rngOf(p), p.board); break;
        case "silence": { const l = ts().filter((t) => !t.isSpell && !t.silenced); l.forEach((t) => t.silence()); fx(l, 0, 0, "Silenced"); break; }
        case "reposition": {
          const l = ts().filter((t) => p.board.includes(t));
          for (const t of l) { p.board.splice(p.board.indexOf(t), 1); if (ab.where === "back") p.board.push(t); else p.board.unshift(t); }
          fx(l, 0, 0, ab.where === "back" ? "To the back" : "To the front"); break;
        }
        case "tavernBuff": p.shopBuff += n; p.shop.forEach((x) => x.buff(n, n)); fx(p.shop, n, n); break;
        case "summonRandom": {
          let at = m ? p.board.indexOf(m) + 1 : p.board.length;
          if (at <= 0) at = p.board.length;
          const made = [];
          for (let i = 0; i < c * (m && ab.golden !== false ? m.mult() : 1) && p.board.length < BOARD_MAX; i++) {
            const id = randomCardId(this.rngOf(p), ab.tier, ab.tribe, ab.allowSelf || !m ? "" : m.cardId);
            if (!id) break;
            const t = new Minion(id); p.board.splice(at + i, 0, t); made.push(t);
          }
          fx(made, 0, 0, "Summoned");
          break;
        }
        case "addCopy": {
          const l = ts().filter((t) => !t.isSpell);
          for (const t of l) if (p.hand.length < HAND_MAX) p.hand.push(new Minion(t.cardId));
          fx(l, 0, 0, "Copied");
          this.lastTriple = (this.lastTriple || []).concat(this.checkTriples(p));
          break;
        }
        case "upgradeDiscount": if (p.tier < MAX_TIER) { p.upgradeCost = Math.max(0, p.upgradeCost - n); if (m) fx([m], 0, 0, `Upgrade -${n}`); } break;
        case "hero": this.addHealth(p, n); if (m) fx([m], 0, 0, n < 0 ? `${n} hero Health` : `+${n} hero Health`); break;
        case "armor": this.addArmor(p, n); if (m) fx([m], 0, 0, `+${n} Armor`); break;
        case "copyOpponent": {
          const o = this.players.find((x) => x.id === p.lastOpponent);
          const pool = (o ? o.board : []).filter((x) => !x.token && CARDS[x.cardId]);
          for (let i = 0; i < c && pool.length && p.hand.length < HAND_MAX; i++) { const x = new Minion(this.rngOf(p).pick(pool).cardId); x.poolCost = 0; p.hand.push(x); }
          this.lastTriple = (this.lastTriple || []).concat(this.checkTriples(p));
          break;
        }
        case "goldenShop": {
          const l = pickN(this.rngOf(p), p.shop.filter((x) => !x.golden && !x.token), c), made = [];
          for (const x of l) { const g = new Minion(x.cardId, true); g.poolCost = 1; g.buff(x.attack - x.baseAttack(), x.health - x.baseHealth()); p.shop[p.shop.indexOf(x)] = g; made.push(g); }
          if (made.length) (this.lastEffects = this.lastEffects || []).push({ uids: made.map((x) => x.uid), a: 0, h: 0, label: "Golden!", source: -1, shop: true });
          break;
        }
        case "refreshUp": p.frozen = false; this.refill(p, Math.max(1, ab.n || 1)); break;
        default:
          if (RULE_MOD[ab.action]) this.addMod(p, RULE_MOD[ab.action], ab.action === "ruleGolden" ? (ab.pct || 10) : ab.action === "ruleBank" ? Math.max(0, ab.n || 0) : ab.action === "ruleTriple" ? -1 : ab.action === "ruleDevour" ? 1 : (ab.n || 0));
      }
    }

    buffRandom(p, src, tribe, a, h) {
      const ts = p.board.filter(o => o !== src && (!tribe || hasTribe(o, tribe)));
      if (!ts.length) return null;
      const t = this.rngOf(p).pick(ts);
      t.buff(a, h);
      return t;
    }

    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = this.rng.int(0, i);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
  }

  // a player's own actions number their new cards from their own stream (see withUids)
  const AFFUP = { depth: 0 };
  for (const name of ["buy", "buySpell", "cast", "play", "sell", "roll", "toggleFreeze", "upgrade", "move", "chooseDiscover", "chooseTribe", "pass", "usePower", "confirmHero", "takeInbox", "activate"]) {
    const orig = Game.prototype[name];
    Game.prototype[name] = function (p, ...args) {
      return withUids(p, () => {
        const before = AFF_ON && !AFFUP.depth && p && p.board ? affState(p.board) : null;
        AFFUP.depth++; let r; try { r = orig.call(this, p, ...args); } finally { AFFUP.depth--; }
        if (!r && p && p.board) this.checkEvolve(p);
        if (!r && before) this.affUpCheck(p, before);
        return r;
      });
    };
  }

  // ---------------------------------------------------------------- Bot
  // skill 0..1 (from MMR): better levelling, stronger tribe focus, fewer blunders.
  const CURVES = {
    low:  { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5, 11: 6 },
    mid:  { 1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 4, 7: 4, 8: 5, 9: 5, 10: 6 },
    high: { 1: 1, 2: 2, 3: 2, 4: 3, 5: 4, 6: 4, 7: 5, 8: 5, 9: 6 },
  };
  const BotV1 = {
    takeTurn(g, p) {
      const resolve = () => { while (p.discover.length) g.chooseDiscover(p, this.bestDiscover(p)); };
      const curve = p.skill < 0.3 ? CURVES.low : p.skill > 0.65 ? CURVES.high : CURVES.mid;
      for (let guard = 0; guard < 50; guard++) {
        resolve();
        this.playHand(g, p);
        if (this.shouldUpgrade(g, p, curve)) { g.upgrade(p); continue; }
        let best = this.bestShop(g, p);
        if (best >= 0 && p.gold >= BUY) {
          const cand = this.score(p, p.shop[best]);
          const full = p.board.length >= BOARD_MAX;
          if (!full || !p.hand.some(m => !m.isSpell)) {
            if (full) {
              const w = this.weakest(p);
              if (w >= 0 && this.score(p, p.board[w]) + 1 < cand) g.sell(p, w); else best = -1;
            }
            if (best >= 0 && p.gold >= BUY) { g.buy(p, best); continue; }
          }
        }
        if (p.shopSpell && p.gold >= g.spellCost(p, p.shopSpell) && p.hand.length < HAND_MAX && this.wantSpell(p, p.shopSpell)) { g.buySpell(p); this.castSpells(g, p); continue; }
        if (p.board.length >= BOARD_MAX && p.hand.some(m => !m.isSpell)) break;
        if (p.freeRolls > 0 || p.gold >= BUY + ROLL) { g.roll(p); continue; }
        break;
      }
      resolve();
      this.playHand(g, p);
      this.castSpells(g, p);
      resolve();
      this.playHand(g, p);
      const front = p.board.filter(m => m.deathrattle.startsWith("summon") || m.startOfCombat);
      p.board = [...front, ...p.board.filter(m => !front.includes(m))];
      if (p.shop.some(m => this.owned(p, m.cardId) >= 2)) p.frozen = true;
    },
    wantSpell(p, s) {
      if (s.target && !p.board.length) return false;
      if (s.spellId === "war_banner" && !p.board.some(m => tribesOf(m).length)) return false;
      if (s.spellId === "mirror") return p.board.some(m => !m.token && this.owned(p, m.cardId) >= 2);
      return s.cost <= 2 || p.skill > 0.4;
    },
    castSpells(g, p) {
      for (let guard = 0; guard < 12; guard++) {
        const i = p.hand.findIndex(m => m.isSpell);
        if (i < 0) return;
        const s = p.hand[i];
        let t = -1;
        if (s.target) {
          if (!p.board.length) { p.hand.splice(i, 1); continue; }
          let bs = -1e9;
          p.board.forEach((m, j) => {
            let sc = this.score(p, m);
            if (s.spellId === "polish" && m.shield) sc = -1e9;
            if (s.spellId === "spirit_ward" && m.reborn) sc = -1e9;
            if (s.spellId === "venom_vial" && (m.venomous || m.attack > 6)) sc = -1e9;
            if (s.spellId === "mirror") sc = this.owned(p, m.cardId) >= 2 ? 100 : m.token ? -1e9 : sc;
            if (sc > bs) { bs = sc; t = j; }
          });
        }
        // cast() returns a reason on failure: then drop the spell so it can't clog the hand.
        if (g.cast(p, i, t)) p.hand.splice(i, 1);
        while (p.discover.length) g.chooseDiscover(p, this.bestDiscover(p));
        this.playHand(g, p);
      }
    },
    shouldUpgrade(g, p, curve) {
      if (p.tier >= MAX_TIER || p.gold < p.upgradeCost) return false;
      if (p.tier < (curve[g.turn] || MAX_TIER)) return true;
      return p.upgradeCost <= 2 && p.gold - p.upgradeCost >= BUY;
    },
    playHand(g, p) {
      for (let guard = 0; guard < 12 && p.board.length < BOARD_MAX; guard++) {
        let bi = -1, bs = -1e9;
        p.hand.forEach((m, j) => { if (m.isSpell) return; const s = this.score(p, m) + (m.golden ? 50 : 0); if (s > bs) { bs = s; bi = j; } });
        if (bi < 0) return;
        g.play(p, bi);
        while (p.discover.length) g.chooseDiscover(p, this.bestDiscover(p));
      }
    },
    mainTribe(p) {
      const c = {};
      for (const m of p.board) for (const t of tribesOf(m)) c[t] = (c[t] || 0) + 1;
      return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || "";
    },
    score(p, m) {
      let s = m.attack + m.health + m.tier * 2;
      if (m.rally) s += 2; if (m.magnetic) s += 1;
      if (m.taunt) s += 1; if (m.shield) s += 3; if (m.reborn) s += 2; if (m.windfury) s += 3; if (m.venomous) s += 4; if (m.cleave) s += 3; if (m.stealth) s += 2; if (m.dodge) s += 3; if (m.tough) s += 3; if (m.flying) s += 2;
      if (m.deathrattle) s += 2;
      if (m.startOfCombat || m.onAllyDeath || m.onSummonAlly || m.endOfTurn || m.onShieldLost || m.onReborn || m.onAttack || m.onPlayOther || m.onSpell || m.onDevour || m.chanter || m.maw) s += 3;
      s += 3 * ((m.abilities && m.abilities.length) || 0);
      if (tribesOf(m).length) {
        const w = 1 + 2.5 * p.skill;
        s += w * p.tribeFit(m);
        if (hasTribe(m, this.mainTribe(p))) s += 2 * p.skill;
        if (m.allTribes) s += 2;
      }
      if (m.golden) s += 6;
      return s;
    },
    owned(p, id) { return [...p.board, ...p.hand].filter(m => !m.isSpell && m.cardId === id && !m.golden).length; },
    bestShop(g, p) {
      if (p.shop.length && g.rngOf(p).next() < (1 - p.skill) * 0.3) return g.rngOf(p).int(0, p.shop.length - 1);
      let b = -1, bs = -1e9;
      p.shop.forEach((m, i) => {
        let s = this.score(p, m);
        const o = this.owned(p, m.cardId);
        s += o >= 2 ? 12 : o === 1 ? 3 + 3 * p.skill : 0;
        if (s > bs) { bs = s; b = i; }
      });
      return b;
    },
    weakest(p) {
      let w = -1, ws = 1e9;
      p.board.forEach((m, i) => {
        if (m.golden) return;
        const s = this.score(p, m) + (this.owned(p, m.cardId) >= 2 ? 8 : 0);
        if (s < ws) { ws = s; w = i; }
      });
      return w;
    },
    bestDiscover(p) {
      let b = 0, bs = -1e9;
      p.discover.forEach((id, i) => { const d = def(id); const s = d.attack + d.health + (1 + 2 * p.skill) * p.tribeFit(d); if (s > bs) { bs = s; b = i; } });
      return b;
    },
  };


  // ---------------------------------------------------------------- bot, second version
  // Plans with the real combat simulator: it tries candidate buys and line-ups against the boards
  // it is likely to meet (its next opponent first) and keeps what wins more. A sim budget scales with skill.
  const Bot = Object.assign(Object.create(BotV1), {
    takeTurn(g, p) {
      const ai = this.ctx(g, p);
      const resolve = () => { while (p.discover.length) g.chooseDiscover(p, this.pickDiscover(ai)); };
      for (let guard = 0; guard < 60; guard++) {
        resolve();
        this.playHand(g, p);
        this.castSpells(g, p, ai);
        if (this.wantUpgrade(ai)) { if (!g.upgrade(p)) continue; }
        const buy = this.chooseBuy(ai);
        if (buy) {
          if (buy.sell >= 0) g.sell(p, buy.sell);
          if (!g.buy(p, buy.index)) { resolve(); this.playHand(g, p); continue; }
        }
        if (buy) continue;
        if (p.shopSpell && p.gold >= g.spellCost(p, p.shopSpell) && p.hand.length < HAND_MAX && this.wantSpell(p, p.shopSpell)) { g.buySpell(p); this.castSpells(g, p, ai); continue; }
        if (this.wantRoll(g, ai)) { g.roll(p); continue; }
        break;
      }
      resolve(); this.playHand(g, p); this.castSpells(g, p, ai); resolve(); this.playHand(g, p);
      this.usePower(g, p, ai); resolve(); this.playHand(g, p);
      this.arrange(ai);
      this.freezeIfWorth(g, ai);
    },

    usePower(g, p, ai) {
      const h = HEROES[p.hero];
      if (!h || h.power.type !== "active" || p.powerUsed || p.gold < h.power.cost) return;
      let t = -1;
      if (h.power.abilities.some((ab) => ab.target === "chosen")) {
        if (!p.board.length) return;
        const acts = h.power.abilities.map((ab) => ab.action), bad = acts.includes("sacrifice") || acts.includes("bounce");
        let bs = -1e9;
        p.board.forEach((m, j) => { let sc = this.worth(p, m) + m.attack * 0.5; if (bad) sc = -sc + (m.token ? 20 : 0); if (acts.includes("keyword") && h.power.abilities.some((ab) => ab.kw && m[ab.kw])) sc -= 6; if (sc > bs) { bs = sc; t = j; } });
      }
      g.usePower(p, t);
    },
    // context: who we are likely to fight, and how many simulated fights we may run
    ctx(g, p) {
      const next = g.nextOpponentOf ? g.nextOpponentOf(p) : null;
      const others = g.alive().filter((q) => q !== p && q.board.length);
      others.sort((a, b) => this.power(b.board) - this.power(a.board));
      const refs = [];
      if (next && next.board.length) refs.push(next);
      for (const q of others) if (refs.length < 3 && !refs.includes(q)) refs.push(q);
      const budget = Math.round(24 + 220 * Math.max(0, p.skill - 0.3));
      return { g, p, refs, budget, used: 0, rng: makeRng((g.turn * 7919 + p.id * 104729) >>> 0) };
    },
    power(board) { return board.reduce((t, m) => t + m.attack + m.health + (m.shield ? m.attack : 0) + (m.reborn ? 2 : 0), 0); },
    // Average fight result of a line-up: +1 a win, -1 a loss, more for bigger margins. null when out of budget.
    evalBoard(ai, board) {
      if (!ai.refs.length || !board.length) return board.length ? null : -1.5;
      if (ai.used + ai.refs.length > ai.budget) return null;
      let t = 0;
      ai.refs.forEach((q, i) => {
        const c = new Combat(); c.quiet = true;
        const r = c.simulate(board, q.board, ai.p.tier, q.tier, makeRng((ai.rng.next() * 1e9) >>> 0));
        const w = i === 0 ? 1.5 : 1; // the next opponent matters most
        t += w * (r.winner === 0 ? 1 + r.damage / 15 : r.winner === 1 ? -1 - r.damage / 15 : 0);
        ai.used++;
      });
      return t / (ai.refs.length + 0.5);
    },
    // static worth of a minion for this player (tribe synergy, triples, keywords, effects)
    worth(p, m) {
      let s = BotV1.score(p, m);
      const o = this.owned(p, m.cardId);
      if (!m.golden) s += o >= 2 ? 14 : o === 1 ? 3 + 4 * p.skill : 0;
      if (m.abilities) for (const ab of m.abilities) {
        if (ab.trigger === "passive") {
          if (ab.action === "extraBattlecry") s += 3 * p.board.filter((x) => x.hasBattlecry && x.hasBattlecry()).length + 2;
          else if (ab.action === "extraDeathrattle") s += 3 * p.board.filter((x) => x.deathrattle || hasTrig(x, "deathrattle")).length + 2;
          else if (ab.action === "extraEndOfTurn") s += 3 * p.board.filter((x) => x.endOfTurn || hasTrig(x, "endOfTurn")).length + 1;
          else s += 3;
        }
        if (ab.ftribe && p.tribeCount(ab.ftribe)) s += 1.5 * p.tribeCount(ab.ftribe);
        if (ab.ttribe && p.tribeCount(ab.ttribe)) s += 1.5 * p.tribeCount(ab.ttribe);
      }
      return s;
    },
    weakestIndex(p) {
      let w = -1, ws = 1e9;
      p.board.forEach((m, i) => { if (m.golden) return; const s = this.worth(p, m); if (s < ws) { ws = s; w = i; } });
      return w;
    },
    // pick a shop minion to buy (and maybe one to sell first), or null
    chooseBuy(ai) {
      const { g, p } = ai;
      const cost = g.buyCost(p);
      if (!p.shop.length || p.gold < cost || p.hand.length >= HAND_MAX) return null;
      const full = p.board.length >= BOARD_MAX;
      if (full && p.hand.some((m) => !m.isSpell) && !p.shop.some((m) => this.owned(p, m.cardId) >= 2)) return null;
      const ranked = p.shop.map((m, i) => ({ i, m, w: this.worth(p, m) })).sort((a, b) => b.w - a.w);
      // low skill sometimes just grabs something
      if (ai.rng.next() < (1 - p.skill) * 0.15) { const r = ranked[(ai.rng.next() * ranked.length) | 0]; return full ? null : { index: r.i, sell: -1 }; }
      const base = this.evalBoard(ai, p.board);
      let best = null;
      for (const c of ranked.slice(0, p.skill > 0.6 ? 4 : 3)) {
        let sell = -1, board = p.board.concat([c.m]);
        if (full) { sell = this.weakestIndex(p); if (sell < 0) continue; board = p.board.filter((_, j) => j !== sell).concat([c.m]); }
        const e = base == null ? null : this.evalBoard(ai, board);
        const gain = e == null || base == null ? 0 : e - base;
        const triple = this.owned(p, c.m.cardId) >= 2;
        let v = c.w + gain * (6 + 10 * p.skill);
        if (full) {
          const lost = this.worth(p, p.board[sell]);
          if (!triple && (e == null ? c.w <= lost + 2 : gain <= 0.05)) continue;
          v -= lost * 0.5;
        }
        if (!best || v > best.v) best = { index: c.i, sell, v };
      }
      return best;
    },
    wantUpgrade(ai) {
      const { g, p } = ai;
      if (p.tier >= MAX_TIER || p.gold < p.upgradeCost) return false;
      const curve = p.skill > 0.65 ? CURVES.high : CURVES.mid;
      const target = curve[g.turn] || MAX_TIER;
      // under pressure: stabilise the board first unless far behind the curve
      if (p.health <= 12 && g.turn > 5 && p.tier >= target - 1 && p.upgradeCost > 2) return false;
      if (p.tier < target) {
        // don't skip a great buy (a triple) for an upgrade unless the upgrade is cheap
        const triple = p.shop.some((m) => this.owned(p, m.cardId) >= 2);
        if (triple && p.gold - p.upgradeCost < g.buyCost(p) && p.upgradeCost > 3) return false;
        return true;
      }
      return p.upgradeCost <= 2 && p.gold - p.upgradeCost >= g.buyCost(p);
    },
    wantRoll(g, ai) {
      const { p } = ai, rc = g.rollCost(p);
      if (p.gold < rc) return false;
      if (p.freeRolls > 0) return true;
      return p.gold >= g.buyCost(p) + rc;
    },
    playHand(g, p) {
      // auras and "after you play" minions first, so later plays benefit; then plain minions, then Battlecries
      const order = (m) => {
        if (m.chanter || (m.abilities || []).some((ab) => ab.trigger === "passive" || ab.trigger === "onPlayOther" || ab.trigger === "onPlayBattlecry") || m.onPlayOther) return 0;
        return m.hasBattlecry && m.hasBattlecry() ? 2 : 1;
      };
      for (let guard = 0; guard < 12 && p.board.length < BOARD_MAX; guard++) {
        let bi = -1, bk = 9, bs = -1e9;
        p.hand.forEach((m, j) => { if (m.isSpell) return; const k = m.golden ? -1 : order(m), s = this.worth(p, m); if (k < bk || (k === bk && s > bs)) { bk = k; bs = s; bi = j; } });
        if (bi < 0) return;
        if (g.play(p, bi)) return;
        while (p.discover.length) g.chooseDiscover(p, BotV1.bestDiscover(p));
      }
    },
    castSpells(g, p, ai) {
      for (let guard = 0; guard < 12; guard++) {
        const i = p.hand.findIndex((m) => m.isSpell);
        if (i < 0) return;
        const s = p.hand[i];
        let t = -1;
        if (s.target) {
          if (!p.board.length) return; // keep it for later
          let bs = -1e9;
          const acts = s.custom ? (SPELLS[s.spellId].abilities || []).map((ab) => ab.action) : [];
          p.board.forEach((m, j) => {
            let sc = this.worth(p, m) + m.attack * (m.windfury ? 2 : 1) * 0.5 + (m.shield ? 3 : 0);
            if (s.spellId === "polish" && m.shield) sc = -1e9;
            if (s.spellId === "spirit_ward" && m.reborn) sc = -1e9;
            if (s.spellId === "venom_vial" && (m.venomous || m.attack > 6)) sc = -1e9;
            if (s.spellId === "mirror") sc = this.owned(p, m.cardId) >= 2 ? 100 : m.token ? -1e9 : sc;
            if (acts.includes("sacrifice") || acts.includes("bounce")) sc = -sc + (m.token ? 20 : 0) + (acts.includes("bounce") && m.hasBattlecry() ? 15 : 0);
            if (acts.includes("makeGolden") && m.golden) sc = -1e9;
            if (sc > bs) { bs = sc; t = j; }
          });
        }
        if (g.cast(p, i, t)) p.hand.splice(i, 1);
        while (p.discover.length) g.chooseDiscover(p, this.pickDiscover(ai));
        this.playHand(g, p);
      }
    },
    pickDiscover(ai) {
      const { p } = ai;
      let b = 0, bs = -1e9;
      p.discover.forEach((id, i) => { const m = new Minion(id); const s = this.worth(p, m); if (s > bs) { bs = s; b = i; } });
      return b;
    },
    // try a few line-ups in the simulator and keep the best one
    arrange(ai) {
      const { p } = ai;
      if (p.board.length < 2) return;
      const front = (m) => (m.deathrattle && m.deathrattle.startsWith("summon")) || m.startOfCombat || hasTrig(m, "startOfCombat") || hasTrig(m, "deathrattle");
      const key = (f) => [...p.board].sort((a, b) => f(b) - f(a));
      const cands = [
        [...p.board.filter(front), ...p.board.filter((m) => !front(m))],
        key((m) => m.attack * (m.windfury ? 2 : 1) + (m.cleave ? 8 : 0) + (m.shield ? 4 : 0)),
        key((m) => (front(m) ? 20 : 0) - (m.taunt ? 5 : 0) + (hasTrig(m, "onAllyDeath") || m.onAllyDeath ? -10 : 0)),
        key((m) => -(m.attack + m.health)),
        [...p.board],
      ];
      let best = cands[0], bv = null;
      for (const c of cands) {
        const v = this.evalBoard(ai, c);
        if (v == null) break;
        if (bv == null || v > bv + 1e-9) { bv = v; best = c; }
      }
      p.board = best;
    },
    freezeIfWorth(g, ai) {
      const { p } = ai;
      if (p.shop.some((m) => this.owned(p, m.cardId) >= 2)) { p.frozen = true; return; }
      const strong = p.shop.some((m) => m.tier >= p.tier && this.worth(p, m) > Math.max(0, ...p.board.map((x) => this.worth(p, x))) && p.gold < g.buyCost(p));
      if (strong && p.skill > 0.5) p.frozen = true;
    },
  });

  // Player-made cards and edits to built-in cards. Built-ins keep a pristine copy so they can be restored.
  const ORIGINAL = {};
  // Player-made cards and edits to built-in cards, for the active meta. A "blank" meta starts
  // with no built-in cards at all (tokens stay so effects can summon them).
  const BASE_CARDS = Object.assign({}, CARDS), BASE_SPELLS = Object.assign({}, SPELLS);
  const META = { blank: false };
  // tribes: [{ id, name, color, icon, blurb }] for this meta, or undefined for the built-in eight
  function setTribes(list) {
    TEXT_CACHE.clear();
    const l = list || BASE_TRIBES.map((id) => ({ id, name: id }));
    TRIBES.length = 0;
    for (const k in TRIBE_INFO) delete TRIBE_INFO[k];
    for (const t of l) {
      if (!t || !t.id || TRIBES.includes(t.id)) continue;
      TRIBES.push(t.id);
      TRIBE_INFO[t.id] = { name: (t.name || t.id).trim() || t.id, color: t.color || "", icon: t.icon || "", blurb: t.blurb || "" };
    }
    for (const k of Object.keys(TRIBE_BLURB)) if (!TRIBES.includes(k)) delete TRIBE_BLURB[k];
    for (const t of TRIBES) { const b = TRIBE_INFO[t].blurb || BASE_BLURB[t] || ""; if (b) TRIBE_BLURB[t] = b; else delete TRIBE_BLURB[t]; }
  }
  // ---- a card's own look (Card editor > Look): aura, foil, name colour, frame, entrance, sounds. Display only.
  const LOOK = { aura: ["glow", "pulse", "flame", "halo"], foil: ["holo", "shine", "prism", "gild"], enter: ["slam", "spin", "rise", "flash", "shadow", "bounce", "portal"] };
  const hexOk = (v) => (typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v) ? v : "");
  const sndOk = (v) => (typeof v === "string" && (/^[a-z]{2,16}$/.test(v) || (/^data:audio\//.test(v) && v.length < 450000)) ? v : "");
  function cleanLook(l) {
    if (!l || typeof l !== "object") return null;
    const o = {};
    if (hexOk(l.aura)) { o.aura = l.aura; o.auraStyle = LOOK.aura.includes(l.auraStyle) ? l.auraStyle : "glow"; }
    if (LOOK.foil.includes(l.foil)) o.foil = l.foil;
    if (LOOK.enter.includes(l.enter)) o.enter = l.enter;
    if (hexOk(l.nameColor)) o.nameColor = l.nameColor;
    if (typeof l.frame === "string" && /^[\w:.-]{1,80}$/.test(l.frame)) o.frame = l.frame;
    if (l.sfx && typeof l.sfx === "object") { const x = {}; for (const k of ["play", "attack", "death"]) if (sndOk(l.sfx[k])) x[k] = l.sfx[k]; if (Object.keys(x).length) o.sfx = x; }
    return Object.keys(o).length ? o : null;
  }
  // the Gold tab of the card editor: { on, attack, health, abilities } (anything left out stays "x2")
  function cleanGold(g) {
    if (!g || typeof g !== "object" || !g.on) return null;
    const o = { on: true };
    if (g.attack != null && isFinite(+g.attack)) o.attack = Math.max(0, Math.min(999, Math.round(+g.attack)));
    if (g.health != null && isFinite(+g.health)) o.health = Math.max(1, Math.min(999, Math.round(+g.health)));
    if (Array.isArray(g.abilities)) o.abilities = g.abilities.filter((ab) => ab && TRIGGERS[ab.trigger] && ACTIONS[ab.action]).map((ab) => Object.assign({}, ab));
    if (g.text) o.text = String(g.text).slice(0, 220);
    return o;
  }
  // the markers a card starts with: { p: +1/+1 markers, kw: [keywords] }
  function cleanMk(s) {
    if (!s || typeof s !== "object") return null;
    const o = { p: Math.max(0, Math.min(20, (s.p | 0) || 0)), kw: (Array.isArray(s.kw) ? s.kw : []).filter((k) => KW_LIST.includes(k) && k !== "magnetic") };
    if (s.st && typeof s.st === "object") { const st = {}; for (const k in s.st) if (/^\d+\/\d+$/.test(k) && s.st[k] > 0) st[k] = Math.min(20, s.st[k] | 0); if (Object.keys(st).length) o.st = st; }
    return o.p || o.kw.length || o.st ? o : null;
  }
  function registerCustom(list, opts = {}) {
    TEXT_CACHE.clear();
    setTribes(opts.tribes);
    setHeroes(opts.heroes);
    setAnomalies(opts.anomalies);
    setAffinities(opts.affinities);
    setKeywords(opts.keywords);
    META.blank = !!opts.blank;
    for (const id in CARDS) delete CARDS[id];
    for (const id in SPELLS) delete SPELLS[id];
    for (const k in ORIGINAL) delete ORIGINAL[k];
    if (!META.blank) { for (const id in BASE_CARDS) CARDS[id] = Object.assign({}, BASE_CARDS[id]); for (const id in BASE_SPELLS) SPELLS[id] = Object.assign({}, BASE_SPELLS[id]); } // copies: names get localized in place
    // Links were removed in v66: cards made with them simply lose those rules
    const noLinks = (abs) => (abs || []).filter((ab) => ab && ab.action !== "bond" && ab.trigger !== "onBond" && ab.trigger !== "onPartnerDeath").map((ab) => {
      if (ab.target !== "partner" && ab.cond !== "bonded" && ab.cond !== "bondAdj") return ab;
      const o = Object.assign({}, ab); if (o.target === "partner") o.target = "self"; if (o.cond === "bonded" || o.cond === "bondAdj") delete o.cond; return o; });
    for (let c of list || []) {
      if (!c || !c.id) continue;
      if (c.abilities) c = Object.assign({}, c, { abilities: noLinks(c.abilities) });
      if (c.kind === "spell") {
        if (BASE_SPELLS[c.id] && !BASE_SPELLS[c.id].abilities) continue; // the old fixed built-in spells can't change; spells made of abilities can
        SPELLS[c.id] = { name: c.name || "New spell", tier: clampTier(c.tier), cost: Math.max(0, Math.min(10, c.cost | 0)), target: !!c.target, custom: true,
          abilities: (c.abilities || []).map((ab) => Object.assign({}, ab, { trigger: "cast" })), customText: c.customText || "", inPool: c.inPool !== false, look: cleanLook(c.look) };
        continue;
      }
      const orig = META.blank ? null : BASE_CARDS[c.id] || null;
      ORIGINAL[c.id] = orig;
      const base = orig || {};
      CARDS[c.id] = Object.assign({}, base, {
        name: c.name || base.name || "New minion", tier: clampTier(c.tier || base.tier), tribe: c.tribe != null ? c.tribe : base.tribe || "", tribes: tribeList(c, base), allTribes: !!c.allTribes,
        attack: Math.max(0, c.attack != null ? c.attack | 0 : base.attack), health: Math.max(1, c.health != null ? c.health | 0 : base.health),
        taunt: !!c.taunt, shield: !!c.shield, reborn: !!c.reborn, windfury: !!c.windfury, venomous: !!c.venomous, cleave: !!c.cleave, stealth: !!c.stealth, magnetic: !!c.magnetic, rally: !!c.rally, tough: !!c.tough, flying: !!c.flying,
        abilities: withLegacyEvolve(c), noBuiltIn: !!c.noBuiltIn || !orig, customText: c.customText || "", aff: affList(c, base), ckw: Array.isArray(c.ckw) ? c.ckw.filter((k) => typeof k === "string").slice(0, 4) : base.ckw || [],
        inPool: c.inPool !== false, custom: true, builtIn: !!orig, attackFx: c.attackFx || "", rarity: RARITY[c.rarity] ? c.rarity : base.rarity || "common", look: cleanLook(c.look),
        evolveAt: 0, evolveInto: "",
        gold: cleanGold(c.gold !== undefined ? c.gold : base.gold), mk: cleanMk(c.mk !== undefined ? c.mk : base.mk),
      });
      CARDS[c.id].tribe = CARDS[c.id].tribes[0] || "";
    }
    // a deleted tribe takes its built-in cards out of the meta; player cards of it turn Neutral (or keep their other tribes)
    for (const id in CARDS) {
      const d = CARDS[id];
      const kept = tribesOf(d).filter((t) => TRIBES.includes(t));
      if (d.allTribes || kept.length === tribesOf(d).length) continue;
      CARDS[id] = d.custom || kept.length ? Object.assign({}, d, { tribe: kept[0] || NEUTRAL, tribes: kept }) : Object.assign({}, d, { inPool: false, retired: true });
    }
    // affinities off: the cards built on their mechanics leave the tavern (they stay in the meta, and come back when turned on)
    if (!AFF_ON) for (const id in CARDS) if (CARDS[id].inPool !== false && affDependent(CARDS[id])) CARDS[id] = Object.assign({}, CARDS[id], { inPool: false, affOnly: true });
    localize();
  }
  const AFF_TRIGS = new Set(["pulse", "afterReflux", "afterFoundation", "onMiredDeath", "onAffUp", "onFoundationPlay", "onSelfEbb", "onPressureFull", "onMire"]), AFF_ACTS = new Set(["gainPressure", "pulseDouble", "mire", "buildFoundation", "giveAff", "foundationAll", "foundationGrow", "releasePressure", "ebbMore", "affStats"]);
  function affDependent(d) {
    return (d.abilities || []).some((ab) => AFF_TRIGS.has(ab.trigger) || AFF_ACTS.has(ab.action) || ab.taff || ab.faff || ab.daff || ab.pcost > 0 || ab.per === "pressure" || ab.per === "foundations" || ab.per === "aff" || ab.per === "affs" || ["affN", "affLv", "affs"].includes(ab.wWhat) || ["affN", "affLv", "affs"].includes(ab.w2What) || ab.target === "colony" || ab.target === "foundationMinions" || ab.src && AFF_TRIGS.has(ab.src));
  }
  // Tribes that have at least one minion able to appear in the tavern.
  const availableTribes = () => TRIBES.filter((t) => Object.keys(CARDS).some((id) => hasTribe(CARDS[id], t) && CARDS[id].inPool !== false));
  // the tribes a player card asks for: `tribes` (deduplicated), else its single tribe, else the built-in's
  function tribeList(c, base) {
    const raw = Array.isArray(c.tribes) && c.tribes.length ? c.tribes : c.tribe != null ? [c.tribe] : base.tribes || (base.tribe ? [base.tribe] : []);
    const out = []; for (const t of raw) if (t && !out.includes(t)) out.push(t);
    return out;
  }
  const clampTier = (t) => Math.max(1, Math.min(6, t | 0 || 1));

  const VERSION = "78"; // bumped with every release: two browsers must run the same one to play together
  root.WA = { VERSION, affOn, affDependent, AFF_TRIGS, AFF_ACTS, FIRE_NAME, FIRE_TAVERN, FIRE_COMBAT, affAbilities, affCarryText, giveAff, LOOK, cleanLook, AFF_SHAPES, AFF_GLYPHS, AFF_FX, BADGE_POS, BADGE_FRAMES, BADGE_DEF, AFF_BADGE, setBadge, affIconSVG, affMaxLv, affThreshold, affEffectsText, affDesc, lvFor, AFFS, AFF, AFF_BASE, AFF_VALUE, AFF_KINDS, AFF_KIND_INFO, AFF_BUILTIN, affsOfKind, kindOfAff, affFor, affIcon, CKW, setKeywords, hasKw, kwName, giveCkw, setAffinities, affState, affLevel, affVal, affCount, hasAff, affsOf, colonies, colonyOf, affName: AN, affBlurb, affMech, MUT_LIB, mutLine, withUids, gate, limitHit, hasTrig, MAX_TIER, UPGRADE_COST, BOT_NAMES, HERO_HUES, TARGET_PHASE, PICK_TARGETS, PICK_DEVOUR, setLang, getLang, FR, KW_LIST, passiveAH, tribesOf, hasTribe, tribeLabel, ANOMALIES, ANOMALY_LIST, DEFAULT_ANOMALIES, setAnomalies, anomalyText, RULE_MOD, HEROES, HERO_LIST, HERO_TRIGGERS, DEFAULT_HEROES, heroPowerText, setHeroes, BASE_TRIBES, TRIBE_INFO, tribeName: TN, setTribes, RARITY, passive, META, BASE_CARDS, BASE_SPELLS, availableTribes, REPEATABLE, SCALABLE, TRIGGERS, ACTIONS, TARGETS, KW_TEXT, abilityText, registerCustom, ORIGINAL, CARDS, TOKENS, SPELLS, TRIBES, TRIBE_BLURB, KEYWORD_INFO, def, cardText, makeRng, Minion, Spell, Combat, Game, Bot, BotV1,
              BOARD_MAX, HAND_MAX, MAX_TIER, BUY, SELL, ROLL, PASS_COST, POOL_COPIES, mmrDelta, rankOf, skillFor,
              BEAST, CONSTRUCT, SPIRIT, CORSAIR, ELEMENTAL, DRAGON, TIDEKIN, INFERNAL };
})(typeof window !== "undefined" ? window : globalThis);
