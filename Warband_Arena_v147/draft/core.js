// v146 Draft mode. A draft table of 5 seats (you and 4 bots); each player opens N boosters of 10 cards (N = 3 by default, set in
// the editor), takes 1 or 2 cards (single or double pick) and passes the booster on (left, right, left...). Two copies of the
// same minion make a golden one. Then each player builds a board (up to 7 minions, a hero, up to 2 spells cast at the Start of
// Combat) and a tournament is played: everyone fights everyone once; the top 2 play a final. A board that wins its tournament
// is kept for the Draft campaign, where the draft is the same but the opponents are the boards that won before.
(function (root) {
  "use strict";
  const W = () => root.WA;
  const PACK = 10, SEATS = 5, MAX_MINIONS = 7, MAX_SPELLS = 2;

  // ---------------------------------------------------------------- draft types (Studio › Draft), like the adventures
  // a type: { id, name, packs, pick, slots: [{ k, tier, tribe }], restrict: { tribes, cards, spells, heroes }, campaign: [boards] }
  // slot kinds: unique (a tribe's Unique card) · neutral · mage (a Unique neutral of tier 5) · hero (a tribe's hero 1 time in 3,
  // any hero otherwise) · tribeHero · anyHero · spell · tier (a minion of that tier, of a random tribe or of the slot's tribe) ·
  // anyTier (any minion of that tier, neutral ones too)
  const KINDS = ["unique", "neutral", "mage", "hero", "tribeHero", "anyHero", "spell", "tier", "anyTier"];
  const DEF_SLOTS = [{ k: "unique" }, { k: "neutral" }, { k: "mage" }, { k: "hero" }, { k: "tier", tier: 3 }, { k: "tier", tier: 4 }, { k: "tier", tier: 4 }, { k: "tier", tier: 5 }, { k: "tier", tier: 5 }, { k: "tier", tier: 6 }];
  const DEF = { packs: 3, pick: 2, restrict: { tribes: [], cards: [], spells: [], heroes: [] } };
  const strList = (l, n) => (Array.isArray(l) ? [...new Set(l.filter((x) => typeof x === "string" && x))].slice(0, n || 2000) : []);
  const normSlot = (x) => { x = x || {}; const k = KINDS.includes(x.k) ? x.k : "tier"; return { k, tier: Math.max(0, Math.min(6, Math.round(+x.tier) || (k === "tier" || k === "anyTier" ? 3 : 0))), tribe: typeof x.tribe === "string" ? x.tribe : "" }; };
  function normType(t) {
    t = t || {};
    const r = t.restrict || {}, slots = Array.isArray(t.slots) && t.slots.length ? t.slots.slice(0, 15).map(normSlot) : DEF_SLOTS.map(normSlot);
    return { id: String(t.id || "dt" + Math.random().toString(36).slice(2, 9)), name: String(t.name || "Draft").slice(0, 40), packs: Math.max(1, Math.min(6, Math.round(+t.packs) || DEF.packs)), pick: Math.max(1, Math.min(3, Math.round(+t.pick) || DEF.pick)), slots,
      restrict: { tribes: strList(r.tribes, 40), cards: strList(r.cards), spells: strList(r.spells), heroes: strList(r.heroes) }, campaign: (Array.isArray(t.campaign) ? t.campaign : []).map(normBoard).slice(0, 200) };
  }
  const normSettings = (s) => normType(s); // (v146 name)
  function snapOk(m) { return m && typeof m.id === "string"; }
  function normBoard(b) {
    b = b || {};
    return { id: String(b.id || "db" + Math.random().toString(36).slice(2, 9)), name: String(b.name || "").slice(0, 40), date: +b.date || Date.now(), titles: Math.max(0, Math.round(+b.titles) || 0),
      hero: typeof b.hero === "string" ? b.hero : "", spells: strList(b.spells, MAX_SPELLS),
      minions: (Array.isArray(b.minions) ? b.minions : []).filter(snapOk).slice(0, MAX_MINIONS).map((m) => { const o = { id: m.id, golden: !!m.golden }; if (m.atk != null) { o.atk = Math.max(0, Math.round(+m.atk) || 0); o.hp = Math.max(1, Math.round(+m.hp) || 1); } if (Array.isArray(m.kw) && m.kw.length) o.kw = strList(m.kw, 20); if (m.mk) o.mk = m.mk; if (Array.isArray(m.ckw) && m.ckw.length) o.ckw = strList(m.ckw, 20); if (Array.isArray(m.gr) && m.gr.length) o.gr = m.gr.slice(0, 20); if (m.form) o.form = m.form === "night" ? "night" : "day"; return o; }) };
  }
  // the data of a meta: { v: 2, types: [...] } (v146 kept one { settings, campaign }: it becomes the first type)
  function normData(d) {
    d = d || {};
    let types = Array.isArray(d.types) ? d.types : d.settings || d.campaign ? [Object.assign({ id: "draft1", name: "Draft" }, d.settings || {}, { campaign: d.campaign || [] })] : [];
    types = types.map(normType); if (!types.length) types = [normType({ id: "draft1", name: "Draft" })];
    return { v: 2, types };
  }
  const load = () => normData(root.WA_STORE && root.WA_STORE.draft);
  async function save(d) { if (root.WA_STORE && root.WA_STORE.saveDraft) await root.WA_STORE.saveDraft(normData(d)); }

  // ---------------------------------------------------------------- what a booster is made of
  const SLOTS = DEF_SLOTS.map((x) => (x.k === "tier" ? "t" + x.tier : x.k)); // (v146 names)
  function cardSets(restrict) {
    const w = W(), R = restrict || DEF.restrict, outT = new Set(R.tribes || []), outC = new Set(R.cards || []), outS = new Set(R.spells || []), outH = new Set(R.heroes || []);
    const ts = (id) => w.tribesOf(w.CARDS[id]).filter(Boolean);
    const ok = (id) => { const d = w.CARDS[id]; if (!d || d.inPool === false || d.retired || d.affOnly || outC.has(id) || (w.EVO_T && w.EVO_T.has(id))) return false; const t = ts(id); return d.allTribes || !t.length || t.some((x) => !outT.has(x)); };
    const ids = Object.keys(w.CARDS).filter(ok), neutral = (id) => !w.CARDS[id].allTribes && !ts(id).length;
    const tribes = w.availableTribes().filter((t) => !outT.has(t)), byTier = {};
    for (const t of [1, 2, 3, 4, 5, 6]) { byTier[t] = {}; for (const tr of tribes) { const l = ids.filter((id) => w.CARDS[id].tier === t && !w.CARDS[id].allTribes && !w.CARDS[id].unique && w.hasTribe(w.CARDS[id], tr)); if (l.length) byTier[t][tr] = l; } }
    const mages = ids.filter((id) => neutral(id) && w.CARDS[id].unique && w.CARDS[id].tier === 5);
    const heroes = w.HERO_LIST.filter((h) => w.HEROES[h] && !w.HEROES[h].off && !outH.has(h) && !(w.HEROES[h].needTribes || []).every((t) => outT.has(t) && (w.HEROES[h].needTribes || []).length));
    return { all: ids, isNeutral: neutral,
      uniques: ids.filter((id) => w.CARDS[id].unique && !w.CARDS[id].allTribes && ts(id).length),
      neutrals: ids.filter((id) => neutral(id) && !mages.includes(id)), mages, heroes,
      spells: Object.keys(w.SPELLS).filter((id) => { const s = w.SPELLS[id]; return s.inPool !== false && !s.advOnly && !outS.has(id); }),
      tribeHeroes: heroes.filter((h) => (w.HEROES[h].needTribes || []).length), byTier,
    };
  }
  const pick = (rng, l) => (l && l.length ? l[Math.floor(rng.next() * l.length)] : null);
  let UID = 1;
  function makeBooster(rng, S, slots) {
    const w = W(), out = [];
    const tierAny = (t, neutralToo) => S.all.filter((id) => w.CARDS[id].tier === t && !w.CARDS[id].unique && (neutralToo || !S.isNeutral(id)));
    for (const sl of (slots || DEF_SLOTS).map(normSlot)) {
      let c = null;
      if (sl.k === "unique") { const l = sl.tribe ? S.uniques.filter((id) => w.hasTribe(w.CARDS[id], sl.tribe)) : S.uniques; const id = pick(rng, l) || pick(rng, Object.values(S.byTier[6]).flat()); if (id) c = { kind: "minion", id }; }
      else if (sl.k === "neutral") { const id = pick(rng, sl.tier ? S.neutrals.filter((x) => w.CARDS[x].tier === sl.tier) : S.neutrals) || pick(rng, S.neutrals); if (id) c = { kind: "minion", id }; }
      else if (sl.k === "mage") { const id = pick(rng, S.mages) || pick(rng, S.neutrals); if (id) c = { kind: "minion", id }; }
      else if (sl.k === "hero") { const id = (rng.next() < 1 / 3 && pick(rng, S.tribeHeroes)) || pick(rng, S.heroes); if (id) c = { kind: "hero", id }; }
      else if (sl.k === "tribeHero") { const l = sl.tribe ? S.tribeHeroes.filter((h) => (w.HEROES[h].needTribes || []).includes(sl.tribe)) : S.tribeHeroes; const id = pick(rng, l) || pick(rng, S.heroes); if (id) c = { kind: "hero", id }; }
      else if (sl.k === "anyHero") { const id = pick(rng, S.heroes); if (id) c = { kind: "hero", id }; }
      else if (sl.k === "spell") { const id = pick(rng, sl.tier ? S.spells.filter((x) => (w.SPELLS[x].tier || 1) === sl.tier) : S.spells) || pick(rng, S.spells); if (id) c = { kind: "spell", id }; }
      else if (sl.k === "anyTier") { const id = pick(rng, tierAny(sl.tier || 3, true)); if (id) c = { kind: "minion", id }; }
      else { const t = sl.tier || 3, map = S.byTier[t] || {}, tr = sl.tribe && map[sl.tribe] ? sl.tribe : pick(rng, Object.keys(map)), id = tr && pick(rng, map[tr]); if (id) c = { kind: "minion", id, tribe: tr }; }
      if (c) out.push(Object.assign(c, { uid: "d" + UID++, slot: sl.k === "tier" ? "t" + (sl.tier || 3) : sl.k, tier: sl.tier }));
    }
    return out;
  }

  // ---------------------------------------------------------------- a collection: two copies of a minion make a golden one
  function collect(picks) {
    const out = [], byId = {};
    for (const c of picks) { if (c.kind !== "minion") { out.push({ key: c.uid, kind: c.kind, id: c.id, golden: false, uids: [c.uid] }); continue; } (byId[c.id] = byId[c.id] || []).push(c); }
    for (const id in byId) { const l = byId[id]; for (let i = 0; i + 1 < l.length; i += 2) out.push({ key: l[i].uid, kind: "minion", id, golden: true, uids: [l[i].uid, l[i + 1].uid] }); if (l.length % 2) { const c = l[l.length - 1]; out.push({ key: c.uid, kind: "minion", id, golden: false, uids: [c.uid] }); } }
    return out;
  }

  // ---------------------------------------------------------------- how a bot drafts (for its two main tribes)
  const tribeCount = (picks) => { const w = W(), n = {}; for (const c of picks) if (c.kind === "minion") { const d = w.CARDS[c.id]; if (d && !d.allTribes) for (const t of w.tribesOf(d)) if (t) n[t] = (n[t] || 0) + 1; } return n; };
  const topTribes = (n, k) => Object.keys(n).sort((a, b) => n[b] - n[a]).slice(0, k);
  const RAR = { common: 0, rare: 0.6, epic: 1.2, legendary: 2 };
  const LIVE = { tribes: null };
  function score(seat, c, noise) {
    const w = W(), n = tribeCount(seat.picks), top = topTribes(n, 2).filter((t) => n[t] >= 2), commit = Math.min(2.6, 0.3 + seat.picks.length * 0.12);
    if (c.kind === "minion") {
      const d = w.CARDS[c.id]; if (!d) return -9;
      const ts = d.allTribes ? [] : w.tribesOf(d).filter(Boolean);
      let s = d.tier * 0.8 + ((d.attack || 0) + (d.health || 0)) / 8 + (RAR[d.rarity] || 0) + (d.unique ? 2 : 0) + ((d.abilities || []).length ? 0.6 : 0);
      if (seat.picks.some((x) => x.id === c.id) && seat.picks.filter((x) => x.id === c.id).length % 2 === 1) s += 3; // the second copy makes a golden one
      if (ts.length) { const best = Math.max(0, ...ts.map((t) => n[t] || 0)); s += commit * Math.min(best, 8) * 0.45 + (ts.some((t) => top.includes(t)) ? commit * 1.6 : top.length >= 2 ? -commit * 1.8 : 0); }
      else s += 0.4 + (top.length >= 2 ? -commit * 0.6 : 0);
      return s + noise;
    }
    if (c.kind === "spell") {
      const sp = w.SPELLS[c.id]; if (!sp) return -9;
      const need = [sp.tribe, ...(sp.needTribes || [])].filter(Boolean);
      let s = 2.0 + (sp.tier || 1) * 0.35 + (RAR[sp.rarity] || 0) + (combatSpell(c.id) ? 1 : -1.5);
      if (need.length) s += need.some((t) => top.includes(t)) ? commit * 2 : -commit * 2;
      return s + noise;
    }
    if (c.kind === "hero") {
      const h = w.HEROES[c.id]; if (!h) return -9;
      const need = h.needTribes || [], have = seat.picks.filter((x) => x.kind === "hero");
      let s = (have.length ? 1.2 : 5) + (h.power && h.power.type === "passive" ? 1.5 : -1); // in a fight, only a passive power plays
      if (need.length) s += need.some((t) => top.includes(t)) ? 3.5 : -4.5;
      if (need.length && LIVE.tribes && !need.some((t) => LIVE.tribes.has(t))) s -= 6;
      if (have.some((x) => x.id === c.id)) s -= 6;
      return s + noise;
    }
    return 0;
  }
  function botTake(seat, pack, rng, n) {
    return pack.map((c) => ({ c, s: score(seat, c, rng.next() * 1.4) })).sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.c);
  }

  // ---------------------------------------------------------------- a draft
  class Draft {
    constructor(opts) {
      const w = W(), o = opts || {}, st = normType(o.type || o.settings || load().types[0]);
      this.type = st; this.packs = st.packs; this.pick = st.pick; this.restrict = st.restrict; this.slots = st.slots;
      this.seed = o.seed == null ? Math.floor(Math.random() * 1e9) : o.seed; this.rng = w.makeRng(this.seed ^ 0xd4af7);
      this.sets = cardSets(this.restrict); LIVE.tribes = new Set([3, 4, 5, 6].flatMap((t) => Object.keys(this.sets.byTier[t])));
      const names = o.names || (w.BOT_NAMES || []).slice(0, SEATS - 1);
      this.seats = Array.from({ length: SEATS }, (_, i) => ({ i, bot: i > 0, name: i ? names[i - 1] || "Bot " + i : o.you || "You", picks: [] }));
      this.round = 0; this.pickNo = 0; this.done = false;
      this.boosters = this.seats.map(() => makeBooster(this.rng, this.sets, this.slots));
    }
    get dir() { return this.round % 2 === 0 ? 1 : -1; }
    get myPack() { return this.boosters[0]; }
    get packSize() { return this.slots.length; }
    get picksPerRound() { return Math.ceil(this.packSize / this.pick); }
    get totalPicks() { return this.packs * this.picksPerRound; }
    get pickIndex() { return this.round * this.picksPerRound + this.pickNo; }
    take(uids) {
      if (this.done) return "The draft is over.";
      const mine = this.boosters[0], want = Math.min(this.pick, mine.length), got = mine.filter((c) => uids.includes(c.uid));
      if (got.length !== want) return `Take ${want} card${want > 1 ? "s" : ""}.`;
      this.takeFrom(0, got);
      for (let s = 1; s < SEATS; s++) this.takeFrom(s, botTake(this.seats[s], this.boosters[s], this.rng, Math.min(this.pick, this.boosters[s].length)));
      this.pass();
      return "";
    }
    takeFrom(s, cards) { const b = this.boosters[s]; for (const c of cards) { const i = b.indexOf(c); if (i >= 0) b.splice(i, 1); this.seats[s].picks.push(Object.assign({}, c, { round: this.round, pick: this.pickNo, side: false })); } }
    pass() {
      this.pickNo++;
      if (this.boosters.every((b) => !b.length)) {
        this.round++; this.pickNo = 0;
        if (this.round >= this.packs) { this.done = true; this.boosters = this.seats.map(() => []); return; }
        this.boosters = this.seats.map(() => makeBooster(this.rng, this.sets, this.slots));
        return;
      }
      const d = this.dir, next = new Array(SEATS);
      for (let s = 0; s < SEATS; s++) next[(s + d + SEATS) % SEATS] = this.boosters[s];
      this.boosters = next;
    }
    // your picks: kept (main) or set aside (side), as in a sideboard
    setSide(uid, side) { const c = this.seats[0].picks.find((x) => x.uid === uid); if (c) c.side = !!side; }
    collection(s, mainOnly) { return collect(this.seats[s].picks.filter((c) => !mainOnly || !c.side)); }
    mainTribes(s, k) { return topTribes(tribeCount(this.seats[s].picks), k || 2); }
    autoHuman() { const p = this.myPack; return p.length ? this.take(botTake(this.seats[0], p, this.rng, Math.min(this.pick, p.length)).map((c) => c.uid)) : "Nothing to take."; }
  }

  // ---------------------------------------------------------------- boards
  const COMBAT_ACTS = new Set(["buff", "permBuff", "mkPlus", "keyword", "mkKw", "damage", "summon", "doubleStats", "giveKeyword", "addSpell", "deathrattle"]);
  function combatSpell(id) { const s = W().SPELLS[id]; return !!s && (s.abilities || []).some((ab) => COMBAT_ACTS.has(ab.action)); }
  function minionValue(it, top) {
    const w = W(), d = w.CARDS[it.id]; if (!d) return -9;
    const ts = d.allTribes ? top : w.tribesOf(d).filter(Boolean), g = it.golden ? 2 : 1;
    return (d.tier * 1.3 + ((d.attack || 0) + (d.health || 0)) * g / 4 + ((d.abilities || []).length ? 1 : 0) * g + (d.taunt ? 1 : 0) + (d.shield ? 1.5 : 0) + (d.reborn ? 1 : 0)) + (ts.some((t) => top.includes(t)) ? 3 : 0);
  }
  // a bot's board: its best 7 minions (its main tribes first), its best passive hero, its 2 best fight spells
  function autoBoard(items) {
    const w = W(), mins = items.filter((x) => x.kind === "minion"), n = {};
    for (const x of mins) { const d = w.CARDS[x.id]; if (d && !d.allTribes) for (const t of w.tribesOf(d)) if (t) n[t] = (n[t] || 0) + (x.golden ? 2 : 1); }
    const top = topTribes(n, 2);
    const chosen = mins.map((x) => ({ x, v: minionValue(x, top) })).sort((a, b) => b.v - a.v).slice(0, MAX_MINIONS).map((o) => o.x);
    const heroes = items.filter((x) => x.kind === "hero").map((x) => { const h = w.HEROES[x.id]; const need = h.needTribes || []; return { id: x.id, v: (h.power && h.power.type === "passive" ? 3 : 0) + (need.some((t) => top.includes(t)) ? 2 : need.length ? -3 : 0) }; }).sort((a, b) => b.v - a.v);
    const spells = items.filter((x) => x.kind === "spell" && combatSpell(x.id)).sort((a, b) => (w.SPELLS[b.id].tier || 1) - (w.SPELLS[a.id].tier || 1)).slice(0, MAX_SPELLS).map((x) => x.id);
    return normBoard({ hero: heroes.length ? heroes[0].id : "", spells, minions: order(chosen).map((x) => ({ id: x.id, golden: x.golden })) });
  }
  // the order on the board: what summons or comes back first (it takes the first hits), then the biggest attackers, Taunts last
  function order(list) {
    const w = W(), key = (x) => { const d = w.CARDS[x.id] || {}, abs = d.abilities || []; return (abs.some((a) => a.trigger === "deathrattle" || a.action === "summon") || d.reborn ? 0 : 1) * 1000 - (d.attack || 0) * (x.golden ? 2 : 1) + (d.taunt ? 500 : 0); };
    return list.slice().sort((a, b) => key(a) - key(b));
  }
  // a minion as it stands on a board after the tavern (its stats, keywords, markers, the effects it was given, its form)
  function snap(m) {
    const w = W(), o = { id: m.cardId, golden: !!m.golden, atk: m.attack, hp: m.health };
    const kw = (w.KW_LIST || []).filter((k) => m[k]); if (kw.length) o.kw = kw;
    if (m.mk) o.mk = JSON.parse(JSON.stringify(m.mk)); if (m.ckw && m.ckw.length) o.ckw = m.ckw.slice();
    if (m.granted && m.granted.length) o.gr = JSON.parse(JSON.stringify(m.granted)); if (m.alt && m.form) o.form = m.form;
    return o;
  }
  function boardMinions(b) {
    const w = W(), src = (b.minions || []).filter((m) => w.CARDS[m.id] || w.TOKENS[m.id]), l = src.map((m) => new w.Minion(m.id, !!m.golden));
    const G = w.Game.prototype; G.syncForms.call({ nightFor: G.nightFor }, { board: l, hand: [], shop: [] });
    l.forEach((mn, i) => { const s = src[i];
      if (s.form && mn.alt && mn.form !== s.form) w.swapForm(mn);
      if (s.gr && s.gr.length) { mn.granted = s.gr.map((x) => Object.assign({}, x)); mn.abilities = (mn.abilities || []).concat(mn.granted); }
      for (const k of s.kw || []) { if ((w.KW_LIST || []).includes(k)) mn[k] = true; }
      if (s.ckw && s.ckw.length) mn.ckw = [...new Set([...(mn.ckw || []), ...s.ckw])];
      if (s.mk) mn.mk = JSON.parse(JSON.stringify(s.mk));
      if (s.atk != null) { mn.attack = s.atk; mn.health = s.hp; mn.maxHealth = s.hp; } });
    return l;
  }
  // a bot plays its board in a tavern of its own, as a player would: its cards one by one (their Battlecries, its choices),
  // then its end of turn; the board as it stands is the one it fights with
  function playBoard(plan, seed) {
    const w = W(), g = new w.Game(1, seed || 1, true, { noSellGold: true }), p = g.human();
    g.startTurn(); p.isBot = true; p.tier = 6; p.gold = 0; p.shop = []; p.shopSpell = null; p.shopSpellX = []; p.board = []; p.hand = [];
    if (plan.hero && w.HEROES[plan.hero]) p.hero = plan.hero;
    const settle = () => { for (let k = 0; k < 20; k++) { if (p.discover && p.discover.length) g.chooseDiscover(p, 0); else if ((p.picks || []).length) g.choosePick(p, g.bestPick(p)); else if ((p.evolveChoices || []).length) g.chooseEvolve(p, 0); else break; } };
    for (const m of plan.minions) { if (p.board.length >= MAX_MINIONS) break; p.hand.push(new w.Minion(m.id, !!m.golden)); const e = g.play(p, p.hand.length - 1, p.board.length); if (e) p.hand.pop(); settle(); }
    for (let i = 0; i < p.hand.length && p.board.length < MAX_MINIONS;) { if (p.hand[i].isSpell) { i++; continue; } const e = g.play(p, i, p.board.length); if (e) i++; settle(); } // what its Battlecries gave
    try { g.endOfTurnEffects(); } catch (e) {}
    return normBoard({ hero: plan.hero, spells: plan.spells, minions: p.board.slice(0, MAX_MINIONS).map(snap) });
  }
  const spellAbs = (ids) => (ids || []).filter((id) => W().SPELLS[id]).map((id) => ({ trigger: "startOfCombat", action: "castSpellCombat", spick: "given", spell: id }));
  // a fight between two boards (A plays as "you", B as the other side); the game's own fight, with both heroes' passive powers
  // and both boards' spells cast at the Start of Combat
  function fight(A, B, seed) {
    const w = W(), g = new w.Game(1, seed || 1, true, {}), p = g.human();
    p.hero = A.hero && w.HEROES[A.hero] ? A.hero : ""; p.board = boardMinions(A); p.health = p.maxHealth = 30;
    const eb = boardMinions(B);
    g.enemySide(B.hero && w.HEROES[B.hero] ? B.hero : null, eb, B.spells || []);
    const a = spellAbs(A.spells); if (a.length) g.ghostAbs = [a, g.ghostAbs ? g.ghostAbs[1] : null];
    let f; try { f = g.fightPair(p, null, eb, 6); } finally { g.enemySide(null); }
    f.game = g; f.enemyMinions = eb;
    return f;
  }

  // ---------------------------------------------------------------- the tournament
  // entrants: [{ name, board, human, ref }] (the human first when there is one). Everyone fights everyone once (round robin,
  // rounds where one sits out when they are odd); a win is 1 point, a draw ½. The final: the top 2 (normal mode: you against the
  // best bot, when you are in the top 2)
  class Tournament {
    constructor(entrants, opts) {
      const o = opts || {}, w = W();
      this.entrants = entrants.map((e, i) => Object.assign({ i, pts: 0, w: 0, l: 0, d: 0, dealt: 0 }, e));
      this.seed = o.seed == null ? Math.floor(Math.random() * 1e9) : o.seed; this.rng = w.makeRng(this.seed ^ 0x70f);
      this.mode = o.mode || "draft"; // "draft" | "campaign"
      this.rounds = roundRobin(this.entrants.length); this.round = 0; this.results = []; this.final = null; this.over = false; this.champion = null;
    }
    get matchesNow() { return this.rounds[this.round] || []; }
    // a match: the fight seen from entrant a's side
    play(a, b) {
      const A = this.entrants[a], B = this.entrants[b], swap = !!B.human && !A.human; // the fight is always seen from the human's side
      const f = swap ? fight(B.board, A.board, this.rng.int(1, 1e9)) : fight(A.board, B.board, this.rng.int(1, 1e9));
      const w0 = swap ? b : a, w1 = swap ? a : b, win = f.winner === 0 ? w0 : f.winner === 1 ? w1 : -1, r = { a, b, winner: win, damage: f.damage || 0, f, me: swap ? b : a };
      this.results.push(r); this.score(r); return r;
    }
    score(r) {
      const A = this.entrants[r.a], B = this.entrants[r.b];
      if (r.winner === -1) { A.pts += 0.5; B.pts += 0.5; A.d++; B.d++; }
      else { const Wn = this.entrants[r.winner], Ls = r.winner === r.a ? B : A; Wn.pts += 1; Wn.w++; Ls.l++; Wn.dealt += r.damage; }
    }
    // the matches of the round not played yet (the human's own one is played by the screen, with its replay)
    playOthers() { const out = []; for (const [a, b] of this.matchesNow) if (!this.entrants[a].human && !this.entrants[b].human && !this.done(a, b)) out.push(this.play(a, b)); return out; }
    done(a, b) { return this.results.some((r) => r.a === a && r.b === b); }
    myMatch() { return this.matchesNow.find(([a, b]) => (this.entrants[a].human || this.entrants[b].human) && !this.done(a, b)) || null; }
    nextRound() { this.round++; return this.round < this.rounds.length; }
    standings() {
      const head = (x, y) => { const r = this.results.find((q) => (q.a === x.i && q.b === y.i) || (q.a === y.i && q.b === x.i)); return r ? (r.winner === x.i ? -1 : r.winner === y.i ? 1 : 0) : 0; };
      return this.entrants.slice().sort((x, y) => y.pts - x.pts || y.w - x.w || head(x, y) || y.dealt - x.dealt || x.i - y.i);
    }
    // the final, once every round is played: [a, b] or null (normal mode: no final when you are not in the top 2)
    finalPair() {
      const st = this.standings(); if (st.length < 2) return null;
      const human = this.entrants.find((e) => e.human);
      if (this.mode === "draft") { if (!human) return [st[0].i, st[1].i]; const top2 = st.slice(0, 2); if (!top2.includes(human)) return null; const bestBot = st.find((e) => !e.human); return [human.i, bestBot.i]; }
      return [st[0].i, st[1].i]; // campaign: the top 2 (you first if you are in it)
    }
    playFinal() {
      let pair = this.finalPair();
      if (!pair) { this.over = true; this.champion = this.standings()[0]; return null; }
      if (this.entrants[pair[1]].human) pair = [pair[1], pair[0]];
      const A = this.entrants[pair[0]], B = this.entrants[pair[1]];
      let f = fight(A.board, B.board, this.rng.int(1, 1e9)), tries = 0;
      while (f.winner === -1 && tries++ < 4) f = fight(A.board, B.board, this.rng.int(1, 1e9)); // a final needs a winner: a draw is fought again
      const win = f.winner === 0 ? pair[0] : f.winner === 1 ? pair[1] : this.standings()[0].i;
      this.final = { a: pair[0], b: pair[1], winner: win, f, replays: tries, me: pair[0] };
      this.over = true; this.champion = this.entrants[win];
      return this.final;
    }
  }
  function roundRobin(n) {
    const ids = Array.from({ length: n % 2 ? n + 1 : n }, (_, i) => i), m = ids.length, rounds = [];
    for (let r = 0; r < m - 1; r++) {
      const pairs = [];
      for (let k = 0; k < m / 2; k++) { const a = ids[k], b = ids[m - 1 - k]; if (a < n && b < n) pairs.push(a < b ? [a, b] : [b, a]); }
      rounds.push(pairs); ids.splice(1, 0, ids.pop());
    }
    return rounds;
  }

  // ---------------------------------------------------------------- the campaign: the boards that won
  async function keepWinner(board, opts) {
    const d = load(), o = opts || {}, t = d.types.find((x) => x.id === o.typeId) || d.types[0];
    if (o.ref) { const b = t.campaign.find((x) => x.id === o.ref); if (b) b.titles++; }
    else t.campaign.unshift(normBoard(Object.assign({}, board, { titles: 1, name: o.name || board.name || "", date: Date.now() })));
    await save(d); return d;
  }
  function campaignOpponents(rng, n, typeId) { const d = load(), t = d.types.find((x) => x.id === typeId) || d.types[0], l = t.campaign.slice(); for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l.slice(0, n || 4); }

  root.WA_DRAFT = { KINDS, DEF_SLOTS, normType, normSlot, snap, playBoard, Draft, Tournament, makeBooster, cardSets, collect, autoBoard, order, fight, boardMinions, combatSpell, roundRobin, keepWinner, campaignOpponents,
    normSettings, normBoard, normData, load, save, score, botTake, tribeCount, topTribes, SLOTS, SEATS, PACK, MAX_MINIONS, MAX_SPELLS, DEF };
})(typeof window !== "undefined" ? window : globalThis);
