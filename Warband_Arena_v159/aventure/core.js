// Adventure mode: the rules of a run, without any display (aventure.js shows it, Node tests run it).
// It reads the game's content (cards, spells, tribes, heroes, affinities) and never changes it. Its own data (the adventure
// types made in the editor) is saved with the meta (WA_STORE.adventure) and normalised here.
(function (root) {
  const D = root.WA_ADV_DATA || {};
  const W = () => root.WA;
  const clamp = (v, a, b, d) => { v = Math.round(+v); return isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };
  const DEF = () => D.defaults;
  const FN = (type) => (type && type.fights) || DEF().fights; // v139 the number of floors of an adventure
  const FR = () => !!(W().getLang && W().getLang() === "fr"), M = (en, fr) => (FR() ? fr : en);

  // ---------------------------------------------------------------- the data of the adventures
  function normDoor(d) {
    const t = d && D.doors[d.type] ? d.type : "minion";
    return { type: t, tier: clamp(d && d.tier, 0, 6, 0), tierMode: d && d.tierMode === "exact" ? "exact" : "upto", choices: clamp(d && d.choices, 1, 6, D.doors[t].choices), price: d && d.price != null && d.price !== "" ? clamp(d.price, 0, 30, null) : null, name: String((d && d.name) || "").slice(0, 32) };
  }
  // v140 a board's hero (one the game knows), else none
  const enemyHero = (b) => (b && b.hero && W().HEROES[b.hero] ? b.hero : "");
  // an enemy minion: its card, golden, the Attack / Health added to it, its form ("" = as the game decides)
  // v139 also its keywords (the game's and the custom ones) and its markers ({ p: +1/+1 markers, st: { "2/2": n, … }, kw })
  const MK_SIZES = ["2/2", "1/3", "3/1"];
  const strList = (l, n) => (Array.isArray(l) ? [...new Set(l.filter((x) => typeof x === "string" && x))].slice(0, n) : []);
  function normMinion(m) {
    const o = { card: String(m.card), golden: !!m.golden, a: clamp(m.a, -999, 999, 0), h: clamp(m.h, -999, 999, 0), form: m.form === "day" || m.form === "night" ? m.form : "", kw: strList(m.kw, 24), mk: null };
    const mk = m.mk && typeof m.mk === "object" ? { p: clamp(m.mk.p, 0, 30, 0), st: {}, kw: strList(m.mk.kw, 12) } : null;
    if (mk) for (const k of MK_SIZES) { const n = clamp(m.mk.st && m.mk.st[k], 0, 30, 0); if (n) mk.st[k] = n; } // v140 +2/+2, +1/+3, +3/+1 markers
    if (mk && (mk.p || mk.kw.length || Object.keys(mk.st).length)) o.mk = mk;
    const ev = strList(m.evo, 6); if (ev.length) o.evo = ev; // v141 the earlier forms of its line it evolved from (their effects / stats)
    return o;
  }
  // an icon of a door kind: one of the editor's icons ("ic:<name>") or a picture ("img:data:image/…", small)
  const iconOk = (v) => typeof v === "string" && ((/^ic:[a-zA-Z]+$/.test(v) && !!iconSvg(v.slice(3))) || (/^img:data:image\/(png|jpeg|webp|gif);base64,/.test(v) && v.length < 300000));
  function iconSvg(k) { return (D.glyphArt && D.glyphArt[k]) || (D.emblemArt && D.emblemArt[k]) || (D.extraIcons && D.extraIcons[k]) || ""; }
  function normType(t) {
    const base = D.newType(t && t.name, t && t.id), o = Object.assign(base, {});
    if (!t) return o;
    o.name = String(t.name || o.name).slice(0, 40); o.blurb = String(t.blurb || "").slice(0, 400); o.color = /^#[0-9a-f]{6}$/i.test(t.color || "") ? t.color : o.color; o.emblem = D.emblems.includes(t.emblem) ? t.emblem : o.emblem;
    // v139 the number of floors; boards, bosses and floors are kept up to the most floors there can be (making the run
    // shorter for a while loses nothing)
    o.fights = clamp(t.fights, 3, DEF().maxFights, DEF().fights);
    const MX = DEF().maxFights;
    o.boards = {};
    for (const k of Object.keys(t.boards || {})) { const n = +k; if (!(Number.isInteger(n) && n >= 1 && n <= MX)) continue; const l = (t.boards[k] || []).filter(Boolean).map((b) => ({ id: b.id || "b" + Math.random().toString(36).slice(2, 8), name: String(b.name || "").slice(0, 40), minions: (b.minions || []).filter((m) => m && m.card).slice(0, 7).map(normMinion), spells: strList(b.spells, 6), hero: typeof b.hero === "string" ? b.hero.slice(0, 80) : "" })); if (l.length) o.boards[n] = l; }
    o.bosses = Array.isArray(t.bosses) ? [...new Set(t.bosses.map((x) => clamp(x, 1, MX, 0)).filter(Boolean))].sort((a, b) => a - b) : o.bosses;
    if (Array.isArray(t.tierFrom) && t.tierFrom.length === 6) o.tierFrom = t.tierFrom.map((x, i) => clamp(x, 1, MX, DEF().tierFrom[i]));
    if (Array.isArray(t.tavern) && t.tavern.length) o.tavern = t.tavern.map(normDoor);
    o.floors = {};
    for (const k of Object.keys(t.floors || {})) { const n = +k, f = t.floors[k]; if (Number.isInteger(n) && n >= 1 && n < MX && f && Array.isArray(f.doors)) o.floors[n] = { mode: f.mode === "replace" ? "replace" : "add", doors: f.doors.map(normDoor) }; } // a floor out of the run is dropped
    o.prices = {}; for (const k of Object.keys(t.prices || {})) if (D.doors[k] && t.prices[k] != null && t.prices[k] !== "") o.prices[k] = clamp(t.prices[k], 0, 30, 0);
    o.doorNames = {}; for (const k of Object.keys(t.doorNames || {})) if (D.doors[k] && String(t.doorNames[k] || "").trim()) o.doorNames[k] = String(t.doorNames[k]).trim().slice(0, 32);
    o.lives = clamp(t.lives, 1, 9, DEF().lives);
    // v157 the choice after a won fight: A keys or B coupons ({ floor: { k, c } }, set in the editor, Rewards)
    // v158 each choice is any Adventure effect: keys, coupons, a new life, a healed life ({ a: { kind, n }, b: { kind, n } }; v157 { k, c })
    o.rewards = {}; for (const k of Object.keys(t.rewards || {})) { const n = +k, r = t.rewards[k]; if (Number.isInteger(n) && n >= 1 && n <= MX && r) { const a = normRw(r.a || (r.k != null ? { kind: "keys", n: r.k } : null), "keys"), b = normRw(r.b || (r.c != null ? { kind: "coupons", n: r.c } : null), "coupons"); if (a.n || b.n) o.rewards[n] = { a, b }; } }
    o.doorIcons = {}; for (const k of Object.keys(t.doorIcons || {})) if (D.doors[k] && iconOk(t.doorIcons[k])) o.doorIcons[k] = t.doorIcons[k];
    const r = t.restrict || {}; for (const k of Object.keys(o.restrict)) o.restrict[k] = Array.isArray(r[k]) ? r[k].filter((x) => typeof x === "string") : [];
    return o;
  }
  const RW_KINDS = ["keys", "coupons", "life", "heal"];
  function normRw(x, def) { return { kind: x && RW_KINDS.includes(x.kind) ? x.kind : def, n: clamp(x && x.n, 0, 20, 0) }; }
  function normalize(data) { return { v: 1, types: ((data && data.types) || []).map(normType) }; }
  function load() { const st = root.WA_STORE; return normalize(st && st.adventure); }
  // the two examples of the brief, for a meta without any adventure (their tribes found by name; no enemy board yet)
  function examples() {
    const w = W(), fr = w.getLang && w.getLang() === "fr", tribes = w.availableTribes();
    return D.examples.map((e) => {
      const t = D.newType(fr ? e.fr : e.name); t.color = e.color; t.emblem = e.emblem; t.blurb = e.blurb;
      const keep = tribes.filter((id) => e.keep.some((re) => re.test(id) || re.test(w.tribeName(id))));
      if (keep.length) t.restrict.tribes = tribes.filter((id) => !keep.includes(id));
      return t;
    });
  }

  // ---------------------------------------------------------------- the steps of a run
  // a list of typed steps, so that new kinds (events, a choice of paths) can come in later without changing the rest
  function steps(type) {
    const n = FN(type), out = [];
    for (let i = 1; i <= n; i++) {
      out.push({ kind: type.bosses.includes(i) ? "boss" : "combat", level: i });
      if (i < n) out.push({ kind: "tavern", after: i });
    }
    return out;
  }
  const tierAt = (type, level) => { let t = 1; type.tierFrom.forEach((from, i) => { if (level >= from) t = i + 1; }); return Math.max(1, Math.min(6, t)); };
  const isBoss = (type, level) => type.bosses.includes(level) && level <= FN(type);

  // ---------------------------------------------------------------- what an adventure lets in
  // restrictions are what is LEFT OUT: anything added to the game later is in by default (and listed in the editor)
  function allowed(type) {
    const w = W(), R = type.restrict, outT = new Set(R.tribes), outC = new Set(R.cards), outS = new Set(R.spells), outH = new Set(R.heroes), outA = new Set(R.affinities);
    const tribes = w.availableTribes().filter((t) => !outT.has(t));
    const minionOk = (id) => { const d = w.CARDS[id]; if (!d || d.inPool === false || d.retired || d.affOnly || outC.has(id) || (w.EVO_T && w.EVO_T.has(id))) return false; if (d.allTribes) return !outT.has("*all"); const ts = w.tribesOf(d).filter(Boolean); return ts.length ? ts.some((t) => !outT.has(t) && tribes.includes(t)) : !outT.has("*neutral"); };
    const minions = Object.keys(w.CARDS).filter(minionOk);
    const spellOk = (id) => { const s = w.SPELLS[id]; if (!s || s.inPool === false || s.advOnly || outS.has(id)) return false; if (s.tribe && !tribes.includes(s.tribe)) return false; if ((s.needTribes || []).length && !s.needTribes.some((t) => tribes.includes(t))) return false; return true; };
    const spells = Object.keys(w.SPELLS).filter(spellOk);
    const heroes = w.HERO_LIST.filter((id) => { const h = w.HEROES[id]; return h && !h.off && !(h.uniqDraft && !h.uniqAdv) /* v159 a Draft-only hero: never here */ && !outH.has(id) && (!(h.needTribes || []).length || h.needTribes.some((t) => tribes.includes(t))) && !(h.banTribes || []).some((t) => tribes.includes(t)); });
    const affinities = (w.AFFS || []).filter((a) => !outA.has(a));
    // what the game itself must never offer (pool, random spells): the minions and spells left out
    const exclude = new Set([...Object.keys(w.CARDS).filter((id) => !minionOk(id) && w.CARDS[id].inPool !== false && !(w.EVO_T && w.EVO_T.has(id))), ...Object.keys(w.SPELLS).filter((id) => !spellOk(id))]);
    return { tribes, minions, spells, heroes, affinities, exclude, minionSet: new Set(minions), spellSet: new Set(spells) };
  }

  // ---------------------------------------------------------------- drawing choices
  function pickN(rng, list, n, weight) {
    const pool = list.slice(), out = [];
    while (out.length < n && pool.length) {
      let tot = 0; const ws = pool.map((x) => { const v = Math.max(0.0001, weight ? weight(x) : 1); tot += v; return v; });
      let r = rng.next() * tot, k = 0; while (k < pool.length - 1 && r >= ws[k]) { r -= ws[k]; k++; }
      out.push(pool.splice(k, 1)[0]);
    }
    return out;
  }
  const rarityW = (d) => { const w = W(); return (w.RARITY[(d && d.rarity) || "common"] || w.RARITY.common).copies || 1; };
  const owned = (p) => new Set([...p.board, ...p.hand].filter((m) => m && !m.isSpell).map((m) => m.cardId));
  function tierOk(t, spec, cur) { const want = spec.tier || cur; return spec.tierMode === "exact" ? t === want : t <= want; }
  function minionPool(run, spec, cur, extra) {
    const w = W(), have = owned(run.p);
    return run.allow.minions.filter((id) => { const d = w.CARDS[id]; return tierOk(d.tier || 1, spec, cur) && !((w.isUnique ? w.isUnique(id) : d.unique) && have.has(id)) && (!extra || extra(d, id)); });
  }
  function spellPoolOf(run, spec, cur, extra) { const w = W(); return run.allow.spells.filter((id) => tierOk(w.SPELLS[id].tier || 1, spec, cur) && !(w.uniqSpellHeld && w.uniqSpellHeld(run.p, id)) && (!extra || extra(w.SPELLS[id], id))); }
  // the tribe most present on the board (all-tribes and Mannequins aside; a tie goes to the leftmost)
  function dominantTribe(run) {
    const w = W(), n = {}, first = {};
    run.p.board.forEach((m, i) => { if (!m || m.allTribes || (w.isMannequin && w.isMannequin(m))) return; for (const t of w.tribesOf(m)) if (t) { n[t] = (n[t] || 0) + 1; if (first[t] == null) first[t] = i; } });
    // v159 the tribe with the most minions on your board (any tribe on it); a tie: one of the tied tribes, drawn (the same one for
    // the whole tavern)
    const top = Math.max(0, ...Object.values(n)); if (!top) return null;
    const tied = Object.keys(n).filter((t) => n[t] === top).sort((a, b) => first[a] - first[b]);
    if (tied.length === 1) return tied[0];
    const key = run.tavern + ":" + tied.join(","); if (run._domKey !== key) { run._domKey = key; run._dom = tied[Math.floor(run.rng.next() * tied.length)]; }
    return run._dom;
  }
  // v143 the 1st and 2nd tribes of the board (ties included); a tribe's hero (one that needs a tribe) is only offered when
  // one of its tribes is among them
  function topTribes(run, k) {
    const w = W(), n = {};
    run.p.board.forEach((m) => { if (!m || m.allTribes || (w.isMannequin && w.isMannequin(m))) return; for (const t of w.tribesOf(m)) if (t) n[t] = (n[t] || 0) + 1; });
    const l = Object.keys(n).sort((a, b) => n[b] - n[a]); if (!l.length) return [];
    const cut = n[l[Math.min(k, l.length) - 1]]; return l.filter((t) => n[t] >= cut);
  }
  // v158 a hero "Unique in Adventure" you already had in this run (now or before) is never offered again
  const heroHad = (run, id) => { const h = W().HEROES[id]; return !!(h && h.uniqAdv && (run.p.hero === id || (run.p.heroMem && Object.prototype.hasOwnProperty.call(run.p.heroMem, id)) || (run.heroesHad && run.heroesHad.has(id)))); };
  function heroFits(run, id) { const h = W().HEROES[id], need = (h && h.needTribes) || []; if (!need.length) return true; const top = topTribes(run, 2); return need.some((t) => top.includes(t)); }
  // the affinity most present on the board (by its count; a tribe's affinity counts its tribe's minions)
  function dominantAffinity(run) {
    const w = W(); if (!w.AFFS || !w.AFFS.length) return null;
    const st = w.affState(run.p.board), l = run.allow.affinities.filter((a) => st[a] && st[a].n > 0).sort((a, b) => st[b].n - st[a].n || st[b].lv - st[a].lv);
    return l[0] || null;
  }
  const affMinion = (a) => (d) => { const w = W(), A = w.AFF[a]; if (!A) return false; if ((d.aff || []).includes(a)) return true; if (A.tribe) return !d.allTribes && w.hasTribe(d, A.tribe); if (A.kind === "fire") return w.isFireMinion(d); return false; };
  const affSpell = (a) => (s) => { const w = W(), A = w.AFF[a]; if (!A) return false; if (A.tribe && (s.tribe === A.tribe || (s.needTribes || []).includes(A.tribe))) return true; return JSON.stringify(s.abilities || []).includes(`"${a}"`); };
  function byKind(run, door, cur, ok) {
    const w = W(); let l = minionPool(run, door, cur, ok);
    for (let t = (door.tier || cur) + 1; !l.length && t <= 6; t++) l = minionPool(run, { tier: t, tierMode: "upto" }, t, ok); // none of that tier: the nearest tier above
    return { items: pickN(run.rng, l, door.choices, (id) => rarityW(w.CARDS[id])).map((id) => ({ kind: "minion", id })) };
  }
  // GEN[source](run, door, cur) → { items: [{ kind: "minion" | "spell" | "hero", id, golden }], label }
  const GEN = {
    // v138 the Adventure's own spells (advOnly), of the door's tier, whatever the restrictions
    advSpell(run, door, cur) {
      const w = W(), l = Object.keys(w.SPELLS).filter((id) => w.SPELLS[id].advOnly && tierOk(w.SPELLS[id].tier || 1, door, cur) && !(w.uniqSpellHeld && w.uniqSpellHeld(run.p, id)));
      return { items: pickN(run.rng, l, door.choices, (id) => rarityW(w.SPELLS[id])).map((id) => ({ kind: "spell", id })) };
    },
    tier(run, door, cur) {
      const T = D.doors[door.type], w = W();
      if (T.gives === "spell") return { items: pickN(run.rng, spellPoolOf(run, door, cur), door.choices, (id) => rarityW(w.SPELLS[id])).map((id) => ({ kind: "spell", id })) };
      return { items: pickN(run.rng, minionPool(run, door, cur, T.golden ? (d) => !d.unique : null), door.choices, (id) => rarityW(w.CARDS[id])).map((id) => ({ kind: "minion", id, golden: !!T.golden })) };
    },
    hero(run, door) {
      const shown = new Set(run.heroItems.map((h) => h.id)); // v140 nor the hero you have, nor one another door already shows
      const ex = run.game.excludeHeroes, l = run.allow.heroes.filter((id) => id !== run.p.hero && !shown.has(id) && !(ex && ex.has(id)) && heroFits(run, id)); // v148 nor a hero "Unique in Adventure" had before // v143 a tribe's hero: only for your 1st / 2nd tribe
      return { items: pickN(run.rng, l, door.choices).map((id) => ({ kind: "hero", id })) };
    },
    tierUp(run, door, cur) {
      const w = W(), t = Math.min(6, cur + 1), spec = { tier: t, tierMode: "exact" };
      const m = minionPool(run, spec, t).map((id) => ({ kind: "minion", id, w: rarityW(w.CARDS[id]) })), s = spellPoolOf(run, spec, t).map((id) => ({ kind: "spell", id, w: rarityW(w.SPELLS[id]) * 0.6 }));
      return { items: pickN(run.rng, m.concat(s), door.choices, (x) => x.w).map((x) => ({ kind: x.kind, id: x.id })), label: { en: `Tier ${t}`, fr: `Tier ${t}` } };
    },
    // v140 the higher tier, minions only / spells only
    tierUpMinion(run, door, cur) {
      const w = W(), t = Math.min(6, cur + 1), spec = { tier: t, tierMode: "exact" };
      return { items: pickN(run.rng, minionPool(run, spec, t), door.choices, (id) => rarityW(w.CARDS[id])).map((id) => ({ kind: "minion", id })), label: { en: `Tier ${t}`, fr: `Tier ${t}` } };
    },
    tierUpSpell(run, door, cur) {
      const w = W(), t = Math.min(6, cur + 1); let l = spellPoolOf(run, { tier: t, tierMode: "exact" }, t);
      if (!l.length) l = spellPoolOf(run, { tier: t, tierMode: "upto" }, t); // no spell of that very tier: the best below
      return { items: pickN(run.rng, l, door.choices, (id) => rarityW(w.SPELLS[id])).map((id) => ({ kind: "spell", id })), label: { en: `Tier ${t}`, fr: `Tier ${t}` } };
    },
    // v140 the neutral minions / the all-tribes minions (of the door's tier; if none there, the nearest tier above)
    neutral(run, door, cur) { return byKind(run, door, cur, (d) => !d.allTribes && !W().tribesOf(d).filter(Boolean).length); },
    allTribes(run, door, cur) { return byKind(run, door, cur, (d) => !!d.allTribes); },
    dominantTribe(run, door, cur) {
      const w = W(), t = dominantTribe(run);
      if (!t) return Object.assign(GEN.tier(run, Object.assign({}, door, { type: "minion" }), cur), { label: { en: "no tribe yet: any", fr: "aucune tribu : au hasard" } });
      return { items: pickN(run.rng, minionPool(run, door, cur, (d) => !d.allTribes && w.hasTribe(d, t)), door.choices, (id) => rarityW(w.CARDS[id])).map((id) => ({ kind: "minion", id })), label: { en: w.tribeName(t), fr: w.tribeName(t) }, tribe: t };
    },
    dominantAffinity(run, door, cur) {
      const w = W(), a = dominantAffinity(run);
      if (!a) { const r = GEN.dominantTribe(run, door, cur); return Object.assign(r, { label: { en: "no affinity yet: " + r.label.en, fr: "aucune affinité : " + r.label.fr } }); }
      const m = minionPool(run, door, cur, affMinion(a)).map((id) => ({ kind: "minion", id, w: rarityW(w.CARDS[id]) })), s = spellPoolOf(run, door, cur, affSpell(a)).map((id) => ({ kind: "spell", id, w: rarityW(w.SPELLS[id]) }));
      return { items: pickN(run.rng, m.concat(s), door.choices, (x) => x.w).map((x) => ({ kind: x.kind, id: x.id })), label: { en: w.affName(a), fr: w.affName(a) }, aff: a };
    },
  };

  // ---------------------------------------------------------------- the doors of a tavern
  function doorsFor(type, after) {
    const f = type.floors[after], base = type.tavern.map((d) => Object.assign({}, d));
    let l = !f ? base : f.mode === "replace" ? f.doors.map((d) => Object.assign({}, d)) : base.concat(f.doors.map((d) => Object.assign({}, d)));
    // always at least a Minion door and a Spell door (unless a special floor replaces them on purpose; v140 a Neutral, All-tribes
    // or Higher tier minions door, narrower, does not stand for the Minion door)
    if (!f || f.mode !== "replace") { if (!l.some((d) => D.doors[d.type].gives === "minion" && !D.doors[d.type].golden && ["tier", "dominantTribe"].includes(D.doors[d.type].source))) l.unshift({ type: "minion", tier: 0, tierMode: "upto", choices: 3, price: null }); if (!l.some((d) => d.type === "spell")) l.push({ type: "spell", tier: 0, tierMode: "upto", choices: 3, price: null }); }
    return l.map(normDoor);
  }
  const priceOf = (type, door) => (door.price != null ? door.price : type.prices[door.type] != null ? type.prices[door.type] : D.doors[door.type].price);

  // ---------------------------------------------------------------- enemy boards
  function boardsOf(type, level) { return type.boards[level] || []; }
  // the board of a level: one of its boards, drawn; a level without a board borrows the nearest level below (else above)
  function enemyFor(type, level, rng) {
    let lv = level, list = boardsOf(type, lv);
    for (let k = level - 1; !list.length && k >= 1; k--) { list = boardsOf(type, k); lv = k; }
    for (let k = level + 1; !list.length && k <= FN(type); k++) { list = boardsOf(type, k); lv = k; }
    if (!list.length) return null;
    const b = list[Math.floor(rng.next() * list.length)], minions = buildBoard(b);
    return { minions, tier: Math.max(1, ...minions.map((m) => m.tier || 1)), board: b, from: lv, boss: isBoss(type, level) };
  }
  // v137 an enemy board as it fights: its day / night cards take the form the game gives them (night when the board's own
  // Nightfall affinity is on: 4 Human/Werewolf cards are 4 werewolves), unless the editor set one; then the added stats
  // v141 an evolved enemy minion: what the game's evolution keeps from the earlier forms of its line (each form's "Keep"
  // options): their effects and their stats (one copy of each), from the oldest form to the last one before the card
  const evoChain = (ids) => { const w = W(); return (ids || []).filter((id) => w.CARDS[id]).sort((a, b) => (w.CARDS[a].tier || 1) - (w.CARDS[b].tier || 1)); };
  function evoCarry(ids) {
    const w = W(), keepOf = w.evoKeepOf || (() => ({ stats: false, effects: false })); let abs = [], a = 0, h = 0, n = 0;
    for (const id of evoChain(ids)) { const d = w.CARDS[id], k = keepOf(d); n++;
      abs = k.effects ? abs.concat((d.abilities || []).map((ab) => Object.assign({}, ab, { _from: id }))) : [];
      if (k.stats) { a += d.attack || 0; h += d.health || 0; } else { a = 0; h = 0; } }
    return { abs, a, h, n };
  }
  function applyEvo(mn, ids) {
    const c = evoCarry(ids); if (!c.n) return;
    if (c.abs.length) { mn.granted = (mn.granted || []).concat(c.abs); mn.abilities = (mn.abilities || []).concat(c.abs); }
    mn.evoLine = evoChain(ids); // v142 its line, for "summon one of each earlier evolution of its line" (Brood Queen)
    mn.evoAcc = { a: c.a, h: c.h, n: c.n }; mn.attack += c.a; mn.health += c.h; mn.maxHealth = (mn.maxHealth || mn.health) + c.h;
  }
  // the earlier forms a card can come from, tier by tier (the cards whose evolutions lead to it)
  function evoBefore(id) {
    const w = W(), out = []; let cur = [id];
    for (let k = 0; k < 6 && cur.length; k++) { const prev = Object.keys(w.CARDS).filter((x) => (w.CARDS[x].evo || []).some((e) => cur.includes(e))); if (!prev.length) break; out.unshift(prev); cur = prev; }
    return out;
  }
  // v144 the editor's difficulty test: each level's boards against typical boards of a player at that level (as many minions
  // as the level, 7 at most; cards this adventure allows, of the tavern's tier or the one below, most of them of one tribe;
  // 1 golden from level 6, 2 from 10, 3 from 13; each minion buffed as a player's would be by then: +1/+1 at level 3, +5/+5
  // at 8, +19/+19 at 15). It gives the share of fights the player wins (draws apart).
  function typicalBoard(type, allow, level, rng) {
    const w = W(), T = tierAt(type, level), size = Math.min(7, Math.max(1, level)), gold = level >= 13 ? 3 : level >= 10 ? 2 : level >= 6 ? 1 : 0;
    let pool = allow.minions.filter((id) => { const t = w.CARDS[id].tier || 1; return t <= T && t >= Math.max(1, T - 1); });
    if (!pool.length) pool = allow.minions.filter((id) => (w.CARDS[id].tier || 1) <= T);
    if (!pool.length) return [];
    const main = allow.tribes.length ? allow.tribes[Math.floor(rng.next() * allow.tribes.length)] : null;
    const tribal = main ? pool.filter((id) => !w.CARDS[id].allTribes && w.hasTribe(w.CARDS[id], main)) : [];
    const ids = []; for (let i = 0; i < size; i++) { const l = tribal.length && rng.next() < 0.65 ? tribal : pool; ids.push(l[Math.floor(rng.next() * l.length)]); }
    const bf = Math.round(0.5 * (level - 1) + 0.06 * (level - 1) * (level - 1)); // the buffs a player has gathered by then (+1/+1 at level 3, +5 at 8, +19 at 15)
    return buildBoard({ minions: ids.map((card, i) => ({ card, golden: i < gold, a: bf, h: bf })) });
  }
  function simLevel(type, level, n, seed) {
    const w = W(), allow = allowed(type), rng = w.makeRng((seed || 1) * 7919 + level), out = { win: 0, loss: 0, draw: 0, n: 0 };
    for (let k = 0; k < (n || 40); k++) {
      const e = enemyFor(type, level, rng); if (!e) return null;
      const g = new w.Game(1, (seed || 1) * 1000 + level * 50 + k, true, { tribes: allow.tribes.length ? allow.tribes : undefined, exclude: allow.exclude });
      const p = g.human(); p.board = typicalBoard(type, allow, level, rng); if (!p.board.length) return null;
      g.enemySide(enemyHero(e.board), e.minions, e.board.spells || []); let f;
      try { f = g.fightPair(p, null, e.minions, e.tier); } finally { g.enemySide(null); }
      out.n++; if (f.winner === 0) out.win++; else if (f.winner === 1) out.loss++; else out.draw++;
    }
    return out;
  }
  function buildBoard(b) {
    const w = W(), src = b.minions.filter((m) => w.CARDS[m.card] || w.TOKENS[m.card]), minions = src.map((m) => new w.Minion(m.card, !!m.golden));
    const G = w.Game.prototype; G.syncForms.call({ nightFor: G.nightFor }, { board: minions, hand: [], shop: [] });
    minions.forEach((mn, i) => {
      const s = src[i];
      if (s.form && mn.alt && mn.form !== s.form) w.swapForm(mn);
      // v139 its keywords and markers (markers first: their stats count in what the editor shows as the card's)
      for (const k of s.kw || []) { if (w.KW_LIST.includes(k)) { mn[k] = true; } else if (w.CKW && w.CKW[k] && w.giveCkw) w.giveCkw(mn, k); }
      if (s.evo && s.evo.length) applyEvo(mn, s.evo);
      if (s.mk && w.mkStartOn) w.mkStartOn(mn, { p: s.mk.p || 0, st: s.mk.st || {}, kw: s.mk.kw || [] });
      if (s.a) mn.attack = Math.max(0, mn.attack + s.a);
      if (s.h) { mn.health = Math.max(1, mn.health + s.h); mn.maxHealth = Math.max(1, (mn.maxHealth || mn.health) + s.h); }
    });
    return minions;
  }
  function filledLevels(type) { return Object.keys(type.boards).map(Number).filter((n) => type.boards[n].some((b) => b.minions.length)).sort((a, b) => a - b); }

  // ---------------------------------------------------------------- a run
  class Run {
    constructor(type, seed) {
      const w = W();
      this.type = type; this.allow = allowed(type); this.steps = steps(type);
      this.seed = seed == null ? Math.floor(Math.random() * 1e9) : seed; this.rng = w.makeRng(this.seed ^ 0x5eed);
      this.level = 1; this.tavern = 0; this.stepIx = 0; this.over = false; this.won = false; this.fights = []; this.opened = 0; this.doors = []; this.heroItems = [];
      const run = this;
      this.game = new w.Game(1, this.seed, true, {
        tribes: this.allow.tribes.length ? this.allow.tribes : undefined, exclude: this.allow.exclude,
        excludeHeroes: new Set(w.HERO_LIST.filter((h) => !this.allow.heroes.includes(h))), // v140 Discover a hero never offers one left out
        adventure: { income: () => run.income(), affinityHeroes: false, coupons: true }, // v157 coupons and keys
      });
      this.p = this.game.human();
      this.game.heroOk = (p, id) => heroFits(run, id); // v143 Discover a hero / a random hero: the same rule as the Hero door
      this.p.hero = ""; this.p.heroChoices = []; this.p.gold = 0; this.p.tier = tierAt(type, 1); this.p.name = "You";
      this.p.coupons = 0; this.p.keys = 0; this.bossesBeaten = 0; // v157
      this.p.lives = this.p.maxLives = type.lives || DEF().lives; this.p.health = this.p.maxHealth = 30; this.p.armor = 0; // v138 lives (Health plays no part here)
    }
    income() { return 0; } // v157 no gold in an Adventure: coupons buy the cards, keys open the doors
    // v157 the coupons of a tavern: 1, then one more for each boss beaten (1 on floors 1-5, 2 on 6-10, 3 on 11-15 with bosses on 5 and 10)
    couponsPerTavern() { return 1 + (this.bossesBeaten || 0); }
    get step() { return this.steps[this.stepIx]; }
    // the start: the turn opens (turn 1), 3 tier 1 minions of 3 different tribes are offered
    begin() {
      const w = W(); this.game.startTurn();
      const S = DEF().start, t1 = this.allow.minions.filter((id) => (w.CARDS[id].tier || 1) === S.tier && !w.CARDS[id].allTribes);
      const byTribe = {}; for (const id of t1) { const t = w.tribesOf(w.CARDS[id]).filter(Boolean)[0] || "*neutral"; (byTribe[t] = byTribe[t] || []).push(id); }
      const tribes = pickN(this.rng, Object.keys(byTribe).filter((t) => t !== "*neutral"), S.choices);
      if (tribes.length < S.choices && byTribe["*neutral"]) tribes.push("*neutral");
      this.startOffers = tribes.map((t) => pickN(this.rng, byTribe[t], 1, (id) => rarityW(w.CARDS[id]))[0]).filter(Boolean);
      for (let i = this.startOffers.length; i < S.choices; i++) { const x = pickN(this.rng, t1.filter((id) => !this.startOffers.includes(id)), 1)[0]; if (x) this.startOffers.push(x); }
      return this.startOffers;
    }
    // the picked minion is played (its Battlecry happens)
    chooseStart(id) {
      const w = W(); if (!this.startOffers || !this.startOffers.includes(id)) return M("Not offered.", "Pas proposé.");
      this.p.hand.push(new w.Minion(id)); this.startOffers = null;
      return this.game.play(this.p, this.p.hand.length - 1, this.p.board.length) || "";
    }
    // the fight of the current level: the floor's enemy board, the game's own fight and all it leaves behind
    fight() {
      const g = this.game, e = enemyFor(this.type, this.level, this.rng); if (!e) return null;
      if (g.stampLines) g.stampLines(this.p);
      g.evoDefer = true; let f;
      g.enemySide(enemyHero(e.board), e.minions, e.board.spells || []); // v139 its combat spells, v140 its hero's power
      try { f = g.fightPair(this.p, null, e.minions, e.tier); } finally { g.evoDefer = false; g.enemySide(null); }
      f.bName = this.floorName(this.level); f.enemy = e; f.level = this.level;
      const out = f.winner === 1 ? "loss" : f.winner === 0 ? "win" : "draw"; f.out = out;
      this.p.health = this.p.maxHealth; // (Health plays no part in the Adventure: lives do)
      this.fights.push({ level: this.level, out, boss: e.boss });
      this.lastOut = out;
      // v138 a lost fight costs a life and the run goes on to the next floor; a lost boss sends back to the tavern before it
      // (to fight it again); the run ends at 0 lives
      f.lifeLost = out === "loss"; f.retry = false;
      if (out === "loss") { this.p.lives = Math.max(0, this.p.lives - 1); if (this.p.lives <= 0) { this.over = true; this.won = false; } else f.retry = this.mustRetry(); }
      else if (this.level >= FN(this.type)) { this.over = true; this.won = true; this.stepIx = this.steps.length - 1; }
      if (out !== "loss" && e.boss && !(this.bossDone || (this.bossDone = new Set())).has(this.level)) { this.bossDone.add(this.level); this.bossesBeaten = this.bossDone.size; }
      // v157 a won fight of a floor with a reward: the choice A (keys) / B (coupons) comes before the tavern
      const rw = this.type.rewards && this.type.rewards[this.level];
      // v159 a fight must be won for its reward; a boss gives its reward even when lost or drawn (once per floor)
      const earned = rw && !this.over && (e.boss || out === "win") && !(this.rewarded && this.rewarded.has(this.level));
      this.reward = earned ? { level: this.level, a: Object.assign({}, rw.a), b: Object.assign({}, rw.b) } : null; f.reward = this.reward;
      if (earned) (this.rewarded || (this.rewarded = new Set())).add(this.level);
      return f;
    }
    // a lost boss is fought again (and the last fight, boss or not: the adventure is won only by beating it)
    mustRetry() { return this.lastOut === "loss" && (isBoss(this.type, this.level) || this.level >= FN(this.type));
    }
    floorName(level) { const fr = W().getLang && W().getLang() === "fr"; return isBoss(this.type, level) ? (fr ? `Boss · étage ${level}` : `Boss · floor ${level}`) : (fr ? `Étage ${level}` : `Floor ${level}`); }
    // after a won (or drawn) fight: the next tavern opens (its income, the tier of the next fight, its doors)
    nextTavern() {
      this.tavern++; if (!this.mustRetry()) this.level++;
      const ti = this.steps.findIndex((s) => s.kind === "tavern" && s.after === this.level - 1); // (a boss on floor 1 has no tavern before it)
      this.stepIx = ti >= 0 ? ti : this.steps.findIndex((s) => s.kind !== "tavern" && s.level === this.level);
      this.p.tier = tierAt(this.type, this.level);
      this.game.startTurn();
      this.opened = 0; this.heroItems = []; this.doorOf = {};
      this.p.coupons = (this.p.coupons || 0) + this.couponsPerTavern(); // v157 (unspent coupons are kept)
      this.doors = doorsFor(this.type, this.level - 1).map((d, i) => ({ i, spec: d, open: false, price: priceOf(this.type, d), def: D.doors[d.type] }));
      const last = this.fights[this.fights.length - 1]; this.bossGift = null;
      if (last && last.boss && last.out !== "loss") this.bossReward();
    }
    // v144 a boss beaten: in the next tavern, at once, Discover a minion (3 choices) of the tribe most present on your board, of
    // your tavern tier or lower (any tribe when the board has none)
    bossReward() {
      const w = W(), t = dominantTribe(this), cur = this.p.tier, spec = { tier: cur, tierMode: "upto" };
      let l = t ? minionPool(this, spec, cur, (d) => !d.allTribes && w.hasTribe(d, t)) : [];
      if (!l.length) l = minionPool(this, spec, cur);
      const ids = pickN(this.rng, l, 3, (id) => rarityW(w.CARDS[id]));
      if (!ids.length) return;
      this.p.discover = ids; this.p.discoverGolden = false; this.p.discoverEvo = null; this.bossGift = { tribe: t || "" };
    }
    // v157 the choice after a won fight: "k" (A: keys) or "c" (B: coupons)
    takeReward(which) {
      const r = this.reward; if (!r) return M("Nothing to choose.", "Rien à choisir.");
      const x = which === "a" || which === "k" ? r.a : r.b, p = this.p, n = x.n;
      if (x.kind === "keys") p.keys = (p.keys || 0) + n;
      else if (x.kind === "coupons") p.coupons = (p.coupons || 0) + n;
      else if (x.kind === "life") { p.maxLives += n; p.lives += n; p.lifeFx = (p.lifeFx || 0) + n; }
      else if (x.kind === "heal") { const h = Math.max(0, Math.min(n, p.maxLives - p.lives)); p.lives += h; p.lifeFx = (p.lifeFx || 0) + h; }
      this.reward = null; this.lastReward = { which, kind: x.kind, n }; return "";
    }
    // the tavern ends: the next step is the fight of the new level
    toFight() { this.stepIx = this.steps.findIndex((s) => s.kind !== "tavern" && s.level === this.level); }
    openCost() { return this.opened ? 1 : 0; } // v157 the first door of a tavern is free, then a key each
    // a door opens: its price is paid, its choices go to the tavern (minions and spells are bought the game's own way)
    openDoor(i) {
      const w = W(), d = this.doors[i]; if (!d || d.open) return M("That door is open.", "Cette porte est déjà ouverte.");
      const cost = this.openCost(); if ((this.p.keys || 0) < cost) return M("You need a key to open this door.", "Il te faut une clef pour ouvrir cette porte."); // v157 a key a door (the first one of a tavern is free)
      const r = (GEN[d.def.source] || GEN.tier)(this, d.spec, this.p.tier);
      this.p.keys -= cost; this.opened++; d.open = true; d.label = r.label || null; d.uids = [];
      for (const it of r.items) {
        if (it.kind === "hero") { const h = { uid: `hero:${i}:${it.id}`, id: it.id, price: d.price || 0, door: i }; this.heroItems.push(h); d.uids.push(h.uid); continue; }
        const o = it.kind === "spell" ? new w.Spell(it.id) : new w.Minion(it.id, !!it.golden);
        if (d.price != null) o._price = d.price;
        if (it.kind === "spell") this.p.shopSpellX.push(o); else this.p.shop.push(o);
        this.doorOf[o.uid] = i; d.uids.push(o.uid);
      }
      this.game.syncForms(this.p); // v137 day / night cards behind the door take the form of the time of day at once
      return "";
    }
    buyHero(uid) {
      const h = this.heroItems.find((x) => x.uid === uid); if (!h) return M("Nothing there.", "Rien ici.");
      const cp = h.price > 0 ? 1 : 0; // v157 a hero door's hero: a coupon (free when its price is 0)
      if ((this.p.coupons || 0) < cp) return M("You need a coupon for this hero.", "Il te faut un coupon pour ce héros.");
      this.p.coupons -= cp; this.game.gainHero(this.p, h.id, ""); (this.heroesHad || (this.heroesHad = new Set())).add(h.id); // v158
      this.heroItems = this.heroItems.filter((x) => x.door !== h.door && x.id !== h.id); // one hero a door (v140 and the one taken leaves the other doors)
      return "";
    }
  }

  // v139 a door kind's icon in this adventure: { svg } or { img }
  const doorIcon = (type, kind) => { const v = (type.doorIcons || {})[kind]; if (v && v.startsWith("img:")) return { img: v.slice(4) }; if (v && v.startsWith("ic:")) return { svg: iconSvg(v.slice(3)) }; return { svg: iconSvg(D.doors[kind].glyph) }; };
  const doorName = (type, d) => (d.name || (type.doorNames || {})[d.type] || (FR() ? D.doors[d.type].fr : D.doors[d.type].name));
  root.WA_ADV = { RW_KINDS, simLevel, typicalBoard, topTribes, heroFits, evoBefore, evoCarry, MK_SIZES, enemyHero, FN, iconSvg, doorIcon, buildBoard, normMinion, doorName, normalize, normType, load, examples, steps, tierAt, isBoss, allowed, doorsFor, priceOf, enemyFor, filledLevels, boardsOf, dominantTribe, dominantAffinity, Run, GEN, pickN };
})(typeof window !== "undefined" ? window : globalThis);
