// Adventure mode: the door types of the tavern, as data.
// A tavern shows closed doors; each door is one of these types. Opening it reveals its choices (minions, spells or heroes)
// that the player buys as they want. To add a type: one entry here (its look, what it gives, its defaults) and its
// generator in aventure/core.js (GEN[source]).
//   gives    : "minion" | "spell" | "mixed" (minions and spells) | "hero"
//   source   : how its choices are drawn (see core.js GEN): "tier", "dominantAffinity", "tierUp", "dominantTribe", "hero",
//              "advSpell" (the Adventure's own spells)
//   choices  : how many choices it reveals (the editor can change it per door)
//   price    : the price of each choice; null = the game's own price (3 gold a minion, a spell's own cost)
//   golden   : its minions are golden
//   special  : a "special" door (its price is set per adventure in the editor, Prices)
(function (root) {
  const D = (root.WA_ADV_DATA = root.WA_ADV_DATA || {});
  D.doors = {
    minion:   { name: "Minions",          fr: "Serviteurs",           gives: "minion", source: "tier",             choices: 3, price: null, color: "#c98a3c", glyph: "minion" },
    spell:    { name: "Spells",           fr: "Sorts",                gives: "spell",  source: "tier",             choices: 3, price: null, color: "#8b6cf0", glyph: "spell" },
    hero:     { name: "Hero",             fr: "Héros",                gives: "hero",   source: "hero",             choices: 3, price: 0,    color: "#e2b04a", glyph: "hero",     special: true },
    golden:   { name: "Magic door",       fr: "Porte magique",        gives: "minion", source: "tier",             choices: 3, price: 6,    color: "#f1cf5a", glyph: "golden",   special: true, golden: true },
    affinity: { name: "Affinity",         fr: "Affinité",             gives: "mixed",  source: "dominantAffinity", choices: 3, price: null, color: "#3fb6a8", glyph: "affinity", special: true },
    tierUp:   { name: "Higher tier (mixed)", fr: "Tier supérieur (mixte)", gives: "mixed", source: "tierUp",        choices: 3, price: null, color: "#d8573f", glyph: "tierUp",   special: true },
    // v140 the higher tier, minions only / spells only
    tierUpMinion: { name: "Higher tier minions", fr: "Serviteurs du tier supérieur", gives: "minion", source: "tierUpMinion", choices: 3, price: null, color: "#e0703a", glyph: "tierUp", special: true },
    tierUpSpell:  { name: "Higher tier spells",  fr: "Sorts du tier supérieur",      gives: "spell",  source: "tierUpSpell",  choices: 3, price: null, color: "#c2508f", glyph: "tierUp", special: true },
    tribe:    { name: "Dominant tribe",   fr: "Tribu dominante",      gives: "minion", source: "dominantTribe",    choices: 3, price: null, color: "#5b8fd8", glyph: "tribe",    special: true },
    // v138 the Adventure's own spells (Ad-spells: "Only show up in adventures" in the editor), nowhere else
    // v140 the neutral minions (no tribe) / the all-tribes minions
    neutral:   { name: "Neutral minions",     fr: "Serviteurs neutres",       gives: "minion", source: "neutral",   choices: 3, price: null, color: "#a08a64", glyph: "neutral",   special: true },
    allTribes: { name: "All-tribes minions",  fr: "Serviteurs toutes tribus", gives: "minion", source: "allTribes", choices: 3, price: null, color: "#e3b94c", glyph: "allTribes", special: true },
    advSpell: { name: "Adventure spells", fr: "Sorts d'aventure",     gives: "spell",  source: "advSpell",         choices: 3, price: null, color: "#e0567a", glyph: "advSpell", special: true },
  };
  // the order they are listed in the editor
  D.doorOrder = ["minion", "spell", "advSpell", "hero", "golden", "affinity", "tierUpMinion", "tierUpSpell", "tierUp", "tribe", "neutral", "allTribes"];
})(typeof window !== "undefined" ? window : globalThis);
