// Adventure mode: the door types of the tavern, as data.
// A tavern shows closed doors; each door is one of these types. Opening it reveals its choices (minions, spells or heroes)
// that the player buys as they want. To add a type: one entry here (its look, what it gives, its defaults) and its
// generator in aventure/core.js (GEN[source]).
//   gives    : "minion" | "spell" | "mixed" (minions and spells) | "hero"
//   source   : how its choices are drawn (see core.js GEN): "tier", "dominantAffinity", "tierUp", "dominantTribe", "hero"
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
    tierUp:   { name: "Higher tier",      fr: "Tier supérieur",       gives: "mixed",  source: "tierUp",           choices: 3, price: null, color: "#d8573f", glyph: "tierUp",   special: true },
    tribe:    { name: "Dominant tribe",   fr: "Tribu dominante",      gives: "minion", source: "dominantTribe",    choices: 3, price: null, color: "#5b8fd8", glyph: "tribe",    special: true },
  };
  // the order they are listed in the editor
  D.doorOrder = ["minion", "spell", "hero", "golden", "affinity", "tierUp", "tribe"];
})(typeof window !== "undefined" ? window : globalThis);
