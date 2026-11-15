// v145 Draft mode: 8 seats (you and 7 bots), 3 rounds of boosters of 10 cards; at each pick every seat takes 2 cards from the
// booster it holds and passes it on (to the left in rounds 1 and 3, to the right in round 2), so a booster empties in 5 picks:
// 15 picks, 30 cards each. Then a game where each player's tavern offers the cards they drafted (logic.js, Game opts.draft).
(function (root) {
  "use strict";
  const W = () => root.WA;
  const SEATS = 8, ROUNDS = 3, PACK = 10, TAKE = 2;

  // ---------------------------------------------------------------- what a booster is made of
  // 1 Unique tribe card · 1 random neutral · 1 random tavern spell ("mage" card) · 1 hero (a tribe's hero 1 time in 3, any hero
  // otherwise) · 1 tier 3, 2 tier 4, 2 tier 5 and 1 tier 6 of a random tribe each (the same tribe or not)
  const SLOTS = ["unique", "neutral", "spell", "hero", "t3", "t4", "t4", "t5", "t5", "t6"];
  function cardSets() {
    const w = W(), ok = (id) => { const d = w.CARDS[id]; return !!d && d.inPool !== false && !d.retired && !d.affOnly && !(w.EVO_T && w.EVO_T.has(id)); };
    const ids = Object.keys(w.CARDS).filter(ok), ts = (id) => w.tribesOf(w.CARDS[id]).filter(Boolean);
    const tribes = w.availableTribes(), byTier = {};
    for (const t of [3, 4, 5, 6]) { byTier[t] = {}; for (const tr of tribes) { const l = ids.filter((id) => w.CARDS[id].tier === t && !w.CARDS[id].allTribes && !w.CARDS[id].unique && w.hasTribe(w.CARDS[id], tr)); if (l.length) byTier[t][tr] = l; } }
    const spells = Object.keys(w.SPELLS).filter((id) => { const s = w.SPELLS[id]; return s.inPool !== false && !s.advOnly; });
    const heroes = w.HERO_LIST.filter((h) => w.HEROES[h] && !w.HEROES[h].off);
    return {
      uniques: ids.filter((id) => w.CARDS[id].unique && !w.CARDS[id].allTribes && ts(id).length),
      neutrals: ids.filter((id) => !w.CARDS[id].allTribes && !ts(id).length), spells, heroes,
      tribeHeroes: heroes.filter((h) => (w.HEROES[h].needTribes || []).length), byTier,
    };
  }
  const pick = (rng, l) => (l && l.length ? l[Math.floor(rng.next() * l.length)] : null);
  let UID = 1;
  function makeBooster(rng, S) {
    const out = [];
    for (const slot of SLOTS) {
      let c = null;
      if (slot === "unique") { const id = pick(rng, S.uniques) || pick(rng, Object.values(S.byTier[6]).flat()); if (id) c = { kind: "minion", id }; }
      else if (slot === "neutral") { const id = pick(rng, S.neutrals); if (id) c = { kind: "minion", id }; }
      else if (slot === "spell") { const id = pick(rng, S.spells); if (id) c = { kind: "spell", id }; }
      else if (slot === "hero") { const id = (rng.next() < 1 / 3 && pick(rng, S.tribeHeroes)) || pick(rng, S.heroes); if (id) c = { kind: "hero", id }; }
      else { const t = +slot.slice(1), tr = pick(rng, Object.keys(S.byTier[t])), id = tr && pick(rng, S.byTier[t][tr]); if (id) c = { kind: "minion", id, tribe: tr }; }
      if (c) out.push(Object.assign(c, { uid: "d" + UID++, slot }));
    }
    return out;
  }

  // ---------------------------------------------------------------- how a bot drafts
  // early on the strongest cards; the more it has picked, the more it sticks to its two main tribes (their affinities): a
  // card of those tribes, a hero of those tribes, a spell of those tribes; one hero is enough
  const tribeCount = (picks) => { const w = W(), n = {}; for (const c of picks) if (c.kind === "minion") { const d = w.CARDS[c.id]; if (d && !d.allTribes) for (const t of w.tribesOf(d)) if (t) n[t] = (n[t] || 0) + 1; } return n; };
  const topTribes = (n, k) => Object.keys(n).sort((a, b) => n[b] - n[a]).slice(0, k);
  const RAR = { common: 0, rare: 0.6, epic: 1.2, legendary: 2 };
  function score(seat, c, noise) {
    const w = W(), n = tribeCount(seat.picks), top = topTribes(n, 2).filter((t) => n[t] >= 2), commit = Math.min(2.6, 0.3 + seat.picks.length * 0.12);
    if (c.kind === "minion") {
      const d = w.CARDS[c.id]; if (!d) return -9;
      const ts = d.allTribes ? [] : w.tribesOf(d).filter(Boolean);
      let s = d.tier * 0.8 + ((d.attack || 0) + (d.health || 0)) / 8 + (RAR[d.rarity] || 0) + (d.unique ? 2 : 0) + ((d.abilities || []).length ? 0.6 : 0);
      if (ts.length) { const best = Math.max(0, ...ts.map((t) => n[t] || 0)); s += commit * Math.min(best, 8) * 0.45 + (ts.some((t) => top.includes(t)) ? commit * 1.6 : top.length >= 2 ? -commit * 1.8 : 0); }
      else s += 0.4 + (top.length >= 2 ? -commit * 0.6 : 0); // a neutral fits any plan, less than the main tribes later on
      return s + noise;
    }
    if (c.kind === "spell") {
      const sp = w.SPELLS[c.id]; if (!sp) return -9;
      const need = [sp.tribe, ...(sp.needTribes || [])].filter(Boolean);
      let s = 2.4 + (sp.tier || 1) * 0.35 + (RAR[sp.rarity] || 0);
      if (need.length) s += need.some((t) => top.includes(t)) ? commit * 2 : -commit * 2;
      return s + noise;
    }
    if (c.kind === "hero") {
      const h = w.HEROES[c.id]; if (!h) return -9;
      const need = h.needTribes || [], have = seat.picks.filter((x) => x.kind === "hero");
      let s = have.length ? 1.2 : 5.5;
      if (need.length) s += need.some((t) => top.includes(t)) ? 3.5 : -4.5; // a hero of a tribe it does not play: almost never
      if (need.length && LIVE.tribes && !need.some((t) => LIVE.tribes.has(t))) s -= 6; // a tribe with no card in the boosters
      if (have.some((x) => x.id === c.id)) s -= 6; // the same hero twice: no use
      if (have.length && have.some((x) => !(w.HEROES[x.id].needTribes || []).length) && need.some((t) => top.includes(t))) s += 2; // a better fitting hero than the one it has
      return s + noise;
    }
    return 0;
  }
  const LIVE = { tribes: null }; // the tribes that have cards in the boosters
  function botTake(seat, pack, rng) {
    const ranked = pack.map((c) => ({ c, s: score(seat, c, rng.next() * 1.4) })).sort((a, b) => b.s - a.s);
    return ranked.slice(0, TAKE).map((x) => x.c);
  }

  // ---------------------------------------------------------------- a draft
  class Draft {
    constructor(seed, names) {
      const w = W();
      this.seed = seed == null ? Math.floor(Math.random() * 1e9) : seed; this.rng = w.makeRng(this.seed ^ 0xd4af7);
      this.sets = cardSets(); LIVE.tribes = new Set([3, 4, 5, 6].flatMap((t) => Object.keys(this.sets.byTier[t])));
      this.seats = Array.from({ length: SEATS }, (_, i) => ({ i, bot: i > 0, name: i ? (names && names[i - 1]) || (w.BOT_NAMES || [])[i - 1] || "Bot " + i : "You", picks: [] }));
      this.round = 0; this.pickNo = 0; this.done = false; this.log = [];
      this.packs = this.seats.map(() => makeBooster(this.rng, this.sets));
    }
    get dir() { return this.round % 2 === 0 ? 1 : -1; } // left, right, left
    get myPack() { return this.packs[0]; }
    get picksPerRound() { return PACK / TAKE; }
    // the human takes 2 cards (by uid) from the booster in front of them; every bot does the same; the boosters move on
    take(uids) {
      if (this.done) return "The draft is over.";
      const mine = this.packs[0], want = Math.min(TAKE, mine.length), got = mine.filter((c) => uids.includes(c.uid));
      if (got.length !== want) return `Take ${want} cards.`;
      this.takeFrom(0, got);
      for (let s = 1; s < SEATS; s++) this.takeFrom(s, botTake(this.seats[s], this.packs[s], this.rng));
      this.pass();
      return "";
    }
    takeFrom(s, cards) { const pack = this.packs[s]; for (const c of cards) { const i = pack.indexOf(c); if (i >= 0) pack.splice(i, 1); this.seats[s].picks.push(Object.assign({}, c, { round: this.round, pick: this.pickNo })); } }
    pass() {
      this.pickNo++;
      if (this.packs.every((p) => !p.length)) {
        this.round++; this.pickNo = 0;
        if (this.round >= ROUNDS) { this.done = true; this.packs = this.seats.map(() => []); return; }
        this.packs = this.seats.map(() => makeBooster(this.rng, this.sets));
        return;
      }
      const d = this.dir, next = new Array(SEATS);
      for (let s = 0; s < SEATS; s++) next[(s + d + SEATS) % SEATS] = this.packs[s]; // the seat on the left (or right) gets it
      this.packs = next;
    }
    // the whole draft for a seat, then what the game needs
    poolOf(s) {
      const p = this.seats[s].picks;
      return { minions: p.filter((c) => c.kind === "minion").map((c) => c.id), spells: p.filter((c) => c.kind === "spell").map((c) => c.id), heroes: p.filter((c) => c.kind === "hero").map((c) => c.id) };
    }
    pools() { return this.seats.map((s) => this.poolOf(s.i)); }
    mainTribes(s, k) { return topTribes(tribeCount(this.seats[s].picks), k || 2); }
    // the lobby's tribes: every tribe someone drafted a minion of
    tribes() { const all = new Set(); for (const s of this.seats) for (const t of Object.keys(tribeCount(s.picks))) all.add(t); return [...all]; }
    // a bot plays the whole draft alone (tests)
    autoHuman() { const p = this.myPack; return p.length ? this.take(botTake(this.seats[0], p, this.rng).map((c) => c.uid)) : "Nothing to take."; }
  }

  root.WA_DRAFT = { Draft, makeBooster, cardSets, score, botTake, tribeCount, topTribes, SLOTS, SEATS, ROUNDS, PACK, TAKE };
})(typeof window !== "undefined" ? window : globalThis);
