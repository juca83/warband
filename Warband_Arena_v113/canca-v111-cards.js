// v111: the neutral minions and spells added to the meta "canca 1stmeta" (once, at launch; see images.js addCancaCards).
// Kept in their own file so the game and the tests use the very same records.
(function (root) {
  "use strict";
  root.WA_CANCA_V111 = [
    { id: "c111_peddler", kind: "minion", name: "Colporteur de sortilèges", tribe: "", tribes: [], tier: 4, attack: 3, health: 3, inPool: true, rarity: "common",
      abilities: [{ trigger: "battlecry", action: "discoverSpell", choices: 3 }] },
    { id: "c111_asp", kind: "minion", name: "Aspic", tribe: "", tribes: [], tier: 4, attack: 1, health: 1, venomous: true, inPool: true, rarity: "common", abilities: [] },
    { id: "c111_duelist", kind: "minion", name: "Duelliste", tribe: "", tribes: [], tier: 4, attack: 4, health: 5, inPool: true, rarity: "common",
      abilities: [{ trigger: "startOfCombat", action: "attackFirst", target: "facing" }] },
    { id: "c111_recruiter", kind: "minion", name: "Recruteur", tribe: "", tribes: [], tier: 6, attack: 6, health: 6, inPool: true, rarity: "common",
      abilities: [{ trigger: "battlecry", action: "discover", tribe: "@main", tierMode: "current" }] },
    { id: "c111_avenger", kind: "minion", name: "Vengeur", tribe: "", tribes: [], tier: 6, attack: 6, health: 7, inPool: true, rarity: "common",
      abilities: [{ trigger: "deathrattle", action: "destroy", target: "killer" }] },
    { id: "c111_patron", kind: "minion", name: "Bienfaiteur", tribe: "", tribes: [], tier: 6, attack: 4, health: 4, inPool: true, rarity: "common",
      abilities: [{ trigger: "battlecry", action: "buff", target: "allFriendsSelf", a: 4, h: 4 }, { trigger: "orChoose", action: "buff", target: "pickAny", a: 15, h: 15 }] },
    { id: "c111_rations", kind: "spell", name: "Rations de guerre", tier: 3, cost: 2, target: false, inPool: true, abilities: [{ trigger: "cast", action: "buff", target: "allFriendsSelf", a: 1, h: 1 }] },
    { id: "c111_kin", kind: "spell", name: "Appel du clan", tier: 2, cost: 2, target: true, inPool: true, abilities: [{ trigger: "cast", action: "addSameTribe", target: "chosen" }] },
    { id: "c111_pilfer", kind: "spell", name: "Chapardage", tier: 2, cost: 2, target: false, inPool: true, abilities: [{ trigger: "cast", action: "stealShop", count: 1 }] },
  ];
})(typeof window !== "undefined" ? window : globalThis);
