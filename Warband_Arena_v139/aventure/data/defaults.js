// Adventure mode: the defaults of a new adventure type, as data. The editor (Studio > Adventure) starts from these and
// saves each type with the meta; nothing here touches the game's cards.
(function (root) {
  const D = (root.WA_ADV_DATA = root.WA_ADV_DATA || {});
  D.defaults = {
    fights: 30,                 // the number of fights of a run (v139 set per adventure, 3-60); winning the last one wins it
    maxFights: 60,
    bosses: [10, 20, 30],       // the boss fights
    // the tavern tier from each fight on (fight 1 = tier 1, fight 5 = tier 2…): what "your tavern tier" means for the cards'
    // effects (Discover from your tier…) and the tier of the doors that do not set one
    tierFrom: [1, 5, 10, 15, 20, 25],
    // the income of the taverns: first tavern, then +1 each tavern, at most "cap" (unspent gold is kept)
    income: { first: 3, step: 1, cap: 10 },
    sellGold: 1,
    // the cost to open the doors of a tavern: the first free, then +1 each (0, 1, 2…); back to 0 each tavern
    openCost: { first: 0, step: 1 },
    // the doors of every tavern unless a special floor changes them (always at least a Minion and a Spell door)
    tavern: [{ type: "minion" }, { type: "spell" }, { type: "minion" }],
    // the start: 3 tier 1 minions of 3 different tribes, the player picks 1 and plays it
    start: { choices: 3, tier: 1 },
    // v138 the hero's lives: a lost fight costs a life and the run goes on (a lost boss sends back to the tavern before it);
    // the run ends at 0
    lives: 3,
  };
  // a door of a tavern: { type, tier: 0 (= the tavern tier) | 1..6, tierMode: "upto" | "exact", choices, price (null = the
  // door type's price for this adventure), name ("" = the name of its kind) }
  D.newType = (name, id) => ({
    id: id || "adv" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36),
    name: name || "New adventure", blurb: "", color: "#c98a3c", emblem: "compass",
    boards: {},                 // { "7": [ { id, minions: [ { card, golden, a, h, form } ] } ] } several boards a level: one is
                                // drawn; a / h = Attack / Health added to the card (v137), form = "" (as the game decides:
                                // night when the board's Nightfall affinity is on) | "day" | "night"
    bosses: D.defaults.bosses.slice(),
    tierFrom: D.defaults.tierFrom.slice(),
    tavern: D.defaults.tavern.map((d) => ({ type: d.type, tier: 0, tierMode: "upto", choices: (D.doors && D.doors[d.type] && D.doors[d.type].choices) || 3, price: null, name: "" })),
    floors: {},                 // { "9": { mode: "add" | "replace", doors: [door…] } } the tavern after fight 9
    prices: {},                 // { hero: 0, golden: 6, … } the price of each special door's choices (empty = the default)
    restrict: { tribes: [], cards: [], spells: [], heroes: [], affinities: [], anomalies: [] }, // what is left out
    lives: D.defaults.lives,    // v138 the hero's lives for a run
    fights: D.defaults.fights,  // v139 the number of floors (fights) of a run
    doorIcons: {},              // v139 { minion: "ic:sword" | "img:data:image/…" } this adventure's icons of the door kinds
    doorNames: {},              // v137 { minion: "Armurerie", … } this adventure's names of the door kinds (empty = the default)
  });
  // the two examples of the brief, made once for a meta that has no adventure yet (their tribes are found by name in the
  // meta; no enemy board: you build them in the editor)
  D.examples = [
    { name: "Space Conquest", fr: "Conquête spatiale", color: "#5b8fd8", emblem: "planet", keep: [/xyrmex|essaim|swarm/i, /blob/i], blurb: "Essaims et Blobs." },
    { name: "Magic Land", fr: "Magic Land", color: "#8b6cf0", emblem: "moon", keep: [/wolf|loup|human/i, /wizard|sorci|mage/i], blurb: "Loups-garous et Sorciers." },
  ];
  D.emblems = ["compass", "planet", "moon", "sword", "crown", "flame", "tower", "skull"];
  // the emblems' drawings (24×24 strokes), shared by the game screens and the editor
  D.emblemArt = {
    compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor"/>',
    planet: '<circle cx="12" cy="12" r="5.5"/><path d="M3.5 15.5c3-1.2 13.5-5.6 17-8.6-1.3-.8-6.8 1-10.8 3"/><circle cx="18.5" cy="5.5" r="1" fill="currentColor"/>',
    moon: '<path d="M19 14.5A8 8 0 0 1 9.5 5a8 8 0 1 0 9.5 9.5z"/><path d="M15 4.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="currentColor"/>',
    sword: '<path d="M14.5 4.5h5v5L9 20l-5-5z"/><path d="M6 13l5 5M3.5 20.5l2-2"/>',
    crown: '<path d="M3.5 8l4.5 4 4-6.5 4 6.5 4.5-4-2 10.5h-13z"/><path d="M5.5 20.5h13"/>',
    flame: '<path d="M12 21c-4 0-6.5-2.7-6.5-6.2 0-3.6 3-5.4 3.6-9.3 2.1 1.4 3.4 3.4 3.4 5.4 1-.8 1.6-2 1.8-3.2 2.4 1.9 4.2 4.4 4.2 7.1 0 3.5-2.5 6.2-6.5 6.2z"/>',
    tower: '<path d="M6 21V8h12v13"/><path d="M5 8V4h2.5v2H11V4h2v2h3.5V4H19v4"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
    skull: '<path d="M12 3.5c-4.4 0-7.5 3-7.5 7 0 2.5 1.2 4.2 3 5.2V19h9v-3.3c1.8-1 3-2.7 3-5.2 0-4-3.1-7-7.5-7z"/><circle cx="9" cy="11" r="1.6" fill="currentColor"/><circle cx="15" cy="11" r="1.6" fill="currentColor"/>',
  };
  // v139 more icons for the doors (the editor's icon picker offers these, the door glyphs and the emblems)
  D.extraIcons = {
    key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v2"/>',
    chest: '<path d="M4 10.5a8 4 0 0 1 16 0V19H4z"/><path d="M4 12.5h16M11 12.5v3h2v-3"/>',
    coin: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5"/><path d="M12 9.5v5"/>',
    scroll: '<path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7"/><path d="M7 4a2 2 0 0 0-2 2v1h4V6a2 2 0 0 0-2-2zM7 20a2 2 0 0 1-2-2v-1h4v1"/><path d="M10 9h6M10 12h6M10 15h4"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    bolt: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>',
    paw: '<circle cx="7" cy="9" r="1.8"/><circle cx="11" cy="6.5" r="1.8"/><circle cx="15.5" cy="7.5" r="1.8"/><circle cx="18" cy="11.5" r="1.8"/><path d="M8 16.5c0-2.5 2-4.5 4.5-4.5S17 14 17 16.5c0 1.8-1.5 2.5-3 2.5h-3c-1.5 0-3-.7-3-2.5z"/>',
    leaf: '<path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14z"/><path d="M5 19 13 11"/>',
    gem: '<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18M12 20 8 9l4-5 4 5z"/>',
    shield: '<path d="M12 3.5l7 3v5.5c0 4.3-3 7.4-7 8.5-4-1.1-7-4.2-7-8.5V6.5z"/>',
    anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v13M8 10h8M5 14a7 7 0 0 0 14 0"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5v.7"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  };
  // the door kinds' glyphs
  D.glyphArt = {
    advSpell: '<path d="M9.5 3.5h5M10.5 3.5v4.2L6 15.5a3.6 3.6 0 0 0 3.1 5.4h5.8a3.6 3.6 0 0 0 3.1-5.4l-4.5-7.8V3.5"/><path d="M7.6 14.5h8.8"/><circle cx="11" cy="17.6" r=".9" fill="currentColor"/><circle cx="13.6" cy="16.4" r=".6" fill="currentColor"/>',
    minion: '<path d="M12 3.5l7 3v5.5c0 4.3-3 7.4-7 8.5-4-1.1-7-4.2-7-8.5V6.5z"/><path d="M9 11.5l2 2 4-4"/>',
    spell: '<path d="M12 2.8l2 5.4 5.6.4-4.3 3.6 1.4 5.6L12 14.9l-4.7 2.9 1.4-5.6-4.3-3.6 5.6-.4z"/>',
    hero: '<path d="M3.5 8.5l4.5 4 4-6.5 4 6.5 4.5-4-2 10h-13z"/>',
    golden: '<path d="M6.5 4h11l3.5 5-9 11.5L3 9z"/><path d="M3 9h18M9 4l3 16.5L15 4"/>',
    affinity: '<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>',
    tierUp: '<path d="M6 13l6-6 6 6M6 19l6-6 6 6"/>',
    tribe: '<path d="M6 21V4M6 4h11l-2.5 4L17 12H6"/>',
  };
})(typeof window !== "undefined" ? window : globalThis);
