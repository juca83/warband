## v124
- **Affinity order on a tie**: when two tribes are equally present on your board, the affinity of the tribe of the **leftmost** minion comes first (it was the rightmost).
- **Painted medallions for the Beast and Cog affinities**, in the bronze ring of the Fire one: a golden paw in a forest glow, a brass gear with steel cogs. "canca 1stmeta" gets them once at launch (a picture you uploaded stays).
- **1, 2 or 3 levels per affinity**: the affinity editor has a "Levels" choice (1 level, 2 levels, 3 levels); with one level only "Level 1 at" and its value remain. The Beast and Cog affinities of "canca 1stmeta" now have a single level (5 minions), as asked (unless you had changed their second level).

## v123
- **Venomous**:
  - it is no longer a marker: effects that gave it as a marker give the plain keyword, and it is gone from the marker lists of the editor;
  - once a Venomous minion has killed an enemy minion, it loses Venomous for the rest of the fight ("Venom spent"); back in the tavern it has it again.
- **Spell rarity**: a spell can be Common, Rare, Epic or Legendary (Spell form of the card editor). Rarer spells show up less often in the tavern (the same shares as minions: common 1, rare 0.5, epic 0.3, legendary 0.15); the rarity gem shows on the spell card and in its tooltip. Spells are Common until you change them.
- **Tribe affinities** (an affinity can now be tied to a tribe in the affinity editor: every minion of that tribe carries it, optionally only those with at least one marker). Added once to "canca 1stmeta":
  - **Bête · Vieillesse**: with 5 Beasts, your Beasts get 2 turns older each turn instead of 1 (new mechanic "Ageing"). Its symbol shows the total age of your Beasts.
  - **Cog · Mek'cog**: with 5 Cogs that each carry at least one marker, every Cog gets "Deathrattle: summon a 1/1 Mek'cog" as the fight starts (new mechanic "Legacy token"; the new token Mek'cog, Cog, 1/1).
  - The total age of the whole board is no longer shown (the Beasts' symbol shows theirs).
  - The two affinity symbols follow the tribes on your board: the first is the affinity of your most present tribe, the second the next one (a tie goes to the tribe of the rightmost minion). A tribe's affinity shows as soon as that tribe is on your board, with its count, even before it wakes up.

## v122
- **Fire rules (Blaze), as written in the rules:**
  - **Wildfire damage** (the Fire affinity's value, plus the fire bonuses) is the damage of Burn and of Deflagration. It is counted as the fight starts and never goes down during the fight (an aura minion dying no longer lowers it); effects can still raise it.
  - **Burn N**: N markers, one at a time, each on a random enemy minion without Fire (no Blaze) that none of your Burns has reached yet in this fight. Once they all have, a new round starts with all of them. So Burn 3 burns 3 different enemies, or puts 3 markers on the only one there is. The number of enemies is no longer capped by the Wildfire. After each attack of a minion of its own side, a burned minion takes the Wildfire damage and loses a marker (it used to be after any attack, either side); the marker shows how many times it will still burn.
  - **Deflagration**: the wall of fire gets as many crossings as the Wildfire damage when it rises. Every minion without Fire that attacks across it, whichever side (yours too now), takes the Wildfire damage of that moment and uses one crossing; it goes on with its attack if it lives. The counter by the wall drops by 1 each time. Blaze minions cross it unharmed.
  - The keyword explanations and the editor's help say the same.
- **Fix: Echo (copy a minion of your last opponent after a loss).** It ran before the game noted who you had just fought, so it copied from the opponent of the fight before (nothing after the first fight), and it ignored tokens (an opponent with a lone token gave nothing). It now gives a copy of a random minion of the warband that just beat you, tokens included (the Mannequin aside); a lone minion is the one.
- **Every player has a different hero**: each human is offered 3 heroes nobody else gets, and the bots take the others, one each. Heroes are shared only when the meta has fewer heroes than players.
- **In game, the cards of a tribe**:
  - hovering a Human/Werewolf card shows its other form beside it, with the notes;
  - a new icon after the spells one lists the neutral minions (an hexagon, in the tan of neutral portraits).
- **The Blob tribe icon is pink in the main menu** and the tribe choice, as in game.
- **Line breaks**: a line break written in a card text, a hero power text, a spell, an anomaly… is kept on the cards and in the tooltips. On every minion card the keywords and markers sit on their own line, the card's text under them, centered.

## v121
- **Fix: Blobs in Stealth.** When the Blobs merge into the Mannequin and the fusion strikes, every Blob that took part comes out of Stealth (it attacked). When the Blobs left in Stealth on a side can't strike at all, they step out of hiding as soon as nothing else on that side can be attacked. That happens with no Mannequin left, or with no Attack between them and the Mannequin. A lone Blob left in Stealth used to stall the fight until the attack limit (it ended in a draw).
- **Fix: Friendly Zebra (and any "summon a copy of this" in the tavern).** A copy can copy itself in the tavern now. With 2 Zebras after a win, each one makes its copy (only the board's 7 slots limit them). In combat, a copy still can't copy itself, so a copy-on-death effect can't loop.
- **Card editor, "More options": the age options can count one tribe.** This works for the scaling ("× the age of your youngest minion") and for the conditions ("Only if" / "And if"). A "Counting" choice appears under the age of your youngest, oldest, leftmost or rightmost minion, the total and average age, and the minions at least 3 turns old. Examples: "the age of your youngest Beast", "for each of your Beasts at least 3 turns old".
- **In game: the cards of a tribe and the tavern spells.** Click a tribe's icon at the bottom of the players column to see every card of that tribe in this game, in place of the players. The list shows its tavern minions by tier, then its evolutions and tokens, as real cards; hover a card for its details. A new ✦ icon does the same for the tavern spells of the game. Click the same icon again to see the players again. The Blob icon gets its colour (the hue of Blob portraits; a colour set in the Tribes tab still wins).

## v120
- **Fix: Stealth minions always attack on their turn, even with 0 Attack** (and so come out of Stealth). A lone hidden minion with 0 Attack used to stall the fight (the other side could not hit it, and it never attacked): the fight ended in a draw. The Mannequin still never attacks on its own.
- **Affinities are counted as the fight starts, and kept for the whole fight** (before any Start of Combat effect): 7 Blaze at the start = 2 fire damage (plus the fire bonuses) until the end of the fight, even when Blaze minions die; a Start of Combat effect can't raise the level either. The affinity symbols show that count during the fight.
- **Card editor, "⚔ Fight!"**: the tested minion stands leftmost and your side opens the fight, so it strikes first. A Blob (or a warband with Blobs) gets a Mannequin to fight in; if the Mannequin has the aura "your side never attacks first", the other side opens and the Blob strikes second.
- **A tribe's spell shows its tribe at the bottom of its card**, where a minion shows its own (Full Moon: Human/Werewolf; a spell "only with Blaze": Blaze).

## v119
- **New spell in "canca 1stmeta": Embrasement soudain** (added once at launch; tier 3, 2 gold, only in the tavern when Blaze is in the game; change it in the card editor like your own). At the start of your next combat, as many random enemy minions as your Wildfire (1 with 1 to 6 Blaze, 2 with 7) each get **Burn 2**. The burn ticks deal your fire damage (the affinity's value plus every fire bonus). Without a Fire minion on your board it does nothing.
  - The effect is in the editor for any spell or effect: "Next combat: at the start, Burn N on as many random enemy minions as your Wildfire" (Fire group).
- **Carnage** (a keyword now, explained in tooltips, renamable in the Keywords tab): when a minion kills an enemy with damage to spare and survives, its Carnage effects can use that excess damage:
  - new scale "× the excess damage" (for any effect on the Carnage trigger);
  - new targets "the minions next to the one it killed", "the minion left of…", "the minion right of…";
  - "Make it attack right away" has a cap: at most N times per fight (0 = no limit beyond the usual chain of 3);
  - ready-made Carnage effects at the top of "+ Add an effect": hit the neighbours (both, left, right), gain the excess as stats (this fight / for good), attack again once, give the excess as Attack to another minion or to all your other minions (this fight / for good).
- **Aura: your side never attacks first** (Aura group): the other side opens the attacks; if both sides have it, chance decides. The "who attacks first" banner follows it. Add it to the Mannequin if you want the Blobs to always strike second.
- **Editor: "Start from scratch" is now the first choice** when you add an effect.

## v118
- **Table workshop: the bartender's speech bubble can be placed** ("Bartender's speech bubble"). It shows a sample line while you edit; it still follows the bartender, plus its own offset.
- **The warband sits in the tavern exactly as in a fight**: same size, centred the same way, at the same height (the tavern row used to be smaller, pushed left and higher). The "Total age" chip moves under the warband, at the left (the workshop can still move it).
- **Fix: "All tribes" minions count for the tribes' affinities.** An "all tribes" card, or a minion made "all tribes" by a hero power, now counts in the Fire count of a Blaze warband (and shows the Fire badge). A tribe's affinities are the ones at least half of its tavern cards carry.

## v117
- **Delete anything**: the built-in tokens (Mannequin, Goo Blob, Pup, Cub, Birdie, Coral Sprout) can now be deleted too, with "Delete card", like any built-in card, spell or hero; they come back with one click from "🗑 Deleted cards" at the bottom of the list. An effect that summons or gives a deleted card does nothing. **Without the Mannequin, the Blobs no longer merge: they fight like any minion.**
- **Tavern spells: "Only in the tavern when one of these tribes is in the game" / "Never in the tavern when…"** (card editor, Spell), like the heroes. A spell that asks for a tribe is listed under that tribe in Studio > Tribes.
- **Xyrmex: no more triple reward after an evolution** (back as before v116). The rule "a Xyrmex level only from its tavern tier" stays.
- **Heroes: "Starting Armor"** (card editor, Hero): the hero starts the game with that much Armor (in Duo, the team gets the average of its two heroes, like Health). Shown in the hero choice and in the list.

## v116
- **Players list: a hero's power on hover.** Hovering a player on the left shows their hero, its power and what it does; for a power limited per game, whether it was used yet ("Once per game: already used", "2 times per game: 1 used, 1 left").
- **Xyrmex nerf:**
  - The tavern shows a Xyrmex level only from that tavern tier: the Tier 2 Xyrmex from Tavern 2, the Tier 3 from Tavern 3, and so on (the evolution lines used to ignore the tavern tier). A line card left in your tavern only turns into your new evolution if your tavern can show that level.
  - **Triple reward after an evolution**: once you chose the evolution of three line cards (or got the one already chosen), you Discover a minion of the next tavern tier, like the reward of a golden. It can offer the evolution you just chose if it is of that tier: tripling at Tavern 2 into a Tier 3 evolution can give you a second copy at once.
- **Fix: Strength (and every "your next minion bought / played gets…", "your next sale gives…")**: two of them cast now both go on the next minion (two Strengths: +2/+4), each for as many minions as it says, instead of one minion each.
- **Studio, Tribes: the cards of each tribe.** The arrow next to a tribe ("▸ 16 cards") opens every card of that tribe by tier, with its tokens and tribal spells; click a card to open it in the card editor.

## v115
- **Fix: a spell whose effect aims at "the chosen minion" always asks for a target**, even when its record says it needs none (Night Sky in "canca 1stmeta": "a +1/+1 marker to the chosen minion" could not be aimed).
- **Heroes, card editor (Heroes):**
  - **"✕ Remove from the hero choice"** / "↩ Put it back": a hero left out is never offered at the start of a game (to you or to the bots). The list shows "✕ Not in the choice".
  - **"Only offered when one of these tribes is in the game"** and **"Never offered when one of these tribes is in the game"** (tick the tribes). If no hero fits a game, the heroes left in the choice are used.
  - **"Uses per game"** for an active power (0 = no limit; 1 = once per game, 2 = twice…), on top of "once per turn". In game the power shows the uses left (2×, 1×…) and its tooltip says it.
- **New effects for hero powers** (any tavern effect can use them):
  - **Rule: your fire (Burn, Wildfire) deals more or less damage** (Game rules): +1 makes every Burn tick, Wildfire and fire-wall hit of that player deal 1 more. The Fire chip in the tavern counts it.
  - **Sell the target; its markers go at random to your other minions** (Hero tricks): the usual sale (gold, "after you sell" effects), then each marker of the sold minion goes to a random other minion (a keyword marker to one that doesn't have it).
  - **Give the target a keyword of your oldest minion that it doesn't have yet** (Hero tricks): picked at random among the keywords the oldest has (the most turns on your board). Choosing it aims at "your minion with the fewest turns on your board" by default.
  - **The target counts as every tribe (All tribes)** (Hero tricks). A golden made from it stays "all tribes".
  - **Discover: "Every level, evolutions included"** (Evolution lines): a Discover of Xyrmex of your tier can offer the evolutions of any line (by default only the levels your tavern could show you, so mostly Larvae). The one you pick opens its line for you (its copies can show up in your tavern).
  - **"Goo Blob"**: a 1/1 Blob token, for "Add a specific minion to your hand" (the Mannequin comes with it as with any Blob).
  - "Lock in werewolf form" was already there (Day and night); a power aimed at a minion now refuses a minion it can't work on (a non-Human for the lock, a Blob for a "Beasts only" filter, a minion already "all tribes"…) without spending the gold.
- **Bots** use these powers too: they aim only at minions the power works on, and sell (with the markers) only to make room on a full board.
- **Game pace**: the rule of the pace you pick is written next to it (Health at the start, Health a lost fight can cost turn by turn, Duo).
- **Fix (Duo)**: the Mannequin can no longer be sent to your partner (a bot could send it to a partner who already had one: two Mannequins on a board). A partner gets their own with their first Blob.

## v114
- **The Mannequin is never boosted.** It is a place on the board for the fusion, not a card that grows: your effects (spells, Battlecries, auras, "+X/+X to your Blobs", markers, keywords, hero powers) can't target it, and random or "all your minions" effects skip it and go to a real minion. While the Blobs are merged in it, it is their body (what happens to the fusion during the strike stays as before); when they split back it is its empty 0/1 self again. It is not counted for "your most common tribe" either.
  - So an "When this merges / comes out of a fusion" effect aimed at the Mannequin itself no longer gives it anything; aimed at the Blob (this minion), it works as before.
- **Tavern frequency from a card**: new card effect "Your tavern: how often a tribe's cards show up" (card editor, Gold and tavern): ×N for one tribe (or the card's own tribe) in that player's tavern, for the rest of the game (×1 = normal, from ×0.5 to ×10). It overrides the tribe's frequency set in the Tribes tab, for that player only.
- **The Queens bring the Xyrmex back to ×1**: when a Queen opens every evolution in your tavern, your Xyrmex frequency goes back to normal (×1) instead of ×4, for you only. Measured at tavern tier 4: about 32% of your tavern slots are Xyrmex after the Queen, instead of 64% if they stayed ×4.
- **Golden frames**: a plain gold, no glow (the v113 tint was far too bright).

## v113
- **Blobs: each Blob keeps its turn.** The attack order stays left to right: each time a Blob's turn comes, all your Blobs merge into the Mannequin and the fusion strikes (then they split back). With two Blobs, the fusion strikes twice in a round; your other minions attack in between as usual.
- **The Mannequin comes with any Blob**: bought, Discovered, from a spell, a triple… (before: only when bought).
- **Tavern frequency per tribe** (card editor, Tribes, "×" on each tribe): how often its cards show up in the tavern (×1 normal). The Xyrmex start at ×4 (a single Larva against a whole tribe each): about 2.5 times as many Larvae. Set it higher or lower as you like.
- **The tavern follows your evolution**: after a Xyrmex evolves, the cards of its line left in your tavern that you can no longer get become the new level (if the pool has a copy).
- **Golden cards at a glance**: when a frame has no golden picture of its own (the default frame included), golden cards get it tinted gold with a golden glow, in the tavern, the hand and on the board. A frame with its own golden picture keeps it.
- **Discover**: the explanation of a card shows above the Discover window (it was behind it).

## v112
- **Card editor, "Rules only"** (next to "For a friend"): saves the rules of the active meta (cards, tribes, affinities, keywords, heroes, anomalies) as a small JSON file, without pictures, sounds or skins. A meta whose "For a friend" file weighs a hundred megabytes fits in a few hundred kilobytes.

## v111
- **New neutral cards in "canca 1stmeta"** (added once at launch, only to that meta; edit or delete them in the card editor like your own):
  - Tier 4: **Colporteur de sortilèges** 3/3, Battlecry: Discover a tavern spell (3 spells of tier 1 to yours). **Aspic** 1/1 Venomous. **Duelliste** 4/5, Start of Combat: the enemy minion facing this one attacks first in this fight.
  - Tier 6: **Recruteur** 6/6, Battlecry: Discover a minion of your most common tribe. **Vengeur** 6/7, Deathrattle: destroy the minion that killed it. **Bienfaiteur** 4/4, Battlecry: choose: +4/+4 to all your minions (this one included), or +15/+15 to one minion of your choice.
  - Spells: **Rations de guerre** (tier 3, 2 gold): +1/+1 to all your minions. **Appel du clan** (tier 2, 2 gold): pick a minion, get another minion of its tribe (a neutral for a neutral). **Chapardage** (tier 2, 2 gold): take a random minion of the tavern.
- **New in the card editor** (any card):
  - **"Or, your choice"** (Lab: chains): a Choose One. The player picks this rule or the one above (several in a row: one of them all); bots take the bigger effect.
  - Target **"The enemy minion facing this one"** (combat): the same place from the centre of the rows; half a place off, the one on the right; nobody in front nor diagonally: no effect.
  - Action **"The target attacks first in this fight"**: its side opens the fight with it.
  - Target **"The minion that killed it"** (Deathrattle).
  - Action **"Get a different minion of the target's tribe"** (a neutral for a neutral).

## v110
- **Bots play every tribe.** At the start of a game each bot gets a tribe plan: one bot per tribe of the lobby first (so every tribe is played), the two left over play freely (they follow what their board becomes). A dedicated bot keeps its tribe; it gives up only if the tribe never came by turn 8, or when it is about to die with too little of it.
  - Measured over 160 games (boards at turn 10): Xyrmex boards 29 instead of 3, Spirit 53 instead of 38, Dragon 41 (31), Construct 41 (34), Corsair 22 (14).
- **Xyrmex knowledge**: a Xyrmex bot buys the Larvae and the copies of its lines (the triples make the evolutions), stays at a low tavern tier a little longer and refreshes to find the copies until its first evolution, and freezes a tavern that shows one.
- **Better valuations**: effects that keep growing the board (permanent stats each turn, each play, each buy) are worth more the earlier they come; cards that evolve when tripled are worth more with each copy.
- **High-MMR bots no longer level too fast**: their faster curve was measured clearly worse; every bot follows the middle curve.
- Measured strength: a lobby of the new bots is as strong as a lobby of the previous ones (same raw board power turn by turn, same results against a witness bot), while playing far more tribes. Bots still take 10 to 20 ms per turn for all seven.

## v109
- **Two new card triggers for the Blobs** (card editor, group "Blobs (fusion)"):
  - **"When this merges into the Mannequin"**: fires for each Blob (and the Mannequin) as it goes into the fusion, before the strike. A bonus it gives itself counts in the fusion and stays on it for the rest of the fight.
  - **"When this comes out of a fusion"**: fires for each Blob back on the board (and the Mannequin) after the fusion survived its attack. If the fusion falls, nobody comes out and it doesn't fire.
  - With these triggers, the target "the minion that triggered it" is the Mannequin: what it gets stays on it for the next fusions.

## v108
- **New tribe: Blobs**, shapeless jelly beings that only fight inside a mould.
  - **Mannequin** (token, 0/1, Stealth, Blob): buying a Blob gives you one if you have none in hand or on your board (it pops into your hand).
  - **In combat the Blobs never attack alone.** When their turn comes in the attack order, all your living Blobs merge into the Mannequin: it gets all their stats, keywords (Shield, Windfury, Venomous, Cleave, Taunt, Tough, Flying), markers and effects, and strikes (twice with Windfury). If it lives, they split back where they stood, as they were (the damage it took is gone), and the Mannequin is a 0/1 in Stealth again. If the fusion falls, every Blob inside falls with it.
  - The Blobs and the Mannequin take one turn together in the attack order; your other minions attack normally.
  - The enemy can't attack the Mannequin (Stealth), only the Blobs; each Blob killed is that much less for the next fusion. If the Mannequin is killed (Cleave, effects…), the Blobs can't attack any more. An empty Mannequin (no Blob left) loses its Stealth.
  - Cards: Goo, Droplet (T1); Slime Wall, Gel Cube (T2); Acid Ooze, Mimic Jelly (T3); Gel Guardian, Swarming Mass (T4); Engulfer, Ooze Mother (T5); Gelatinous King, Primordial Ooze (T6). The Mannequin is a Blob, so the Blob buffs grow it too.
  - Bots keep their Mannequin while they have Blobs.

## v107
- **Effect slot**: a new spot left of the line between the boards. For now it shows the hits the wall of fire has left ("2x", "1x"), text only, during fights (the enemy's wall above, yours below when both stand). Place it in the table workshop ("Effect slot").
- **Table workshop, alignment guides**: while you drag an element, a sprite or a placeholder, it lines up with the sides and centres of the other elements and with the centre of the table, and pink lines show the alignment. Hold Alt to place it freely (the guides follow the "Snap" box).
- Table workshop, fixed: pulling the corner of an element made it jump straight to its biggest size (it was measured as 0 px); it now grows smoothly. Sprites rotate around their real centre.

## v106
- **Fire rules checked and fixed** (Wildfire = the value of the Fire affinity: 1 with 1 to 6 Fire minions, 2 with 7):
  - **A Fire minion (Blaze, or carrying Fire) can't be burned**: the marker goes to another enemy; with no valid target the Burn is lost (no marker). Fire minions still cross walls unharmed.
  - **Burn reaches at most Wildfire enemy minions in the whole fight**, all your Burns together. With Wildfire 1, every marker of every Burn lands on the same enemy. With 2, the first marker goes on one enemy, the next on another, then the markers land randomly between the two. Burn N now spreads N markers in all (before: N on each target).
  - **The wall of fire takes as many hits as your fire damage when it rises** (Wildfire + fire bonuses: 1 with 1 to 6 Fire minions). Each enemy crossing it takes the fire damage and uses one hit; at 0 the flames go out. Another Deflagration adds its hits to the wall.
- **Enemy affinities in fights**: two new symbols show the enemy's active affinities (count, level, mechanic; Fire with its damage), live during the fight. Hover them for the details. Place them in the table workshop ("Enemy affinity slot 1/2"); by default they sit at the top left.
- Your affinity symbols are now fully lit during fights, and follow the fight live for every affinity (not only Fire).

## v105
- **Blood Moon Alpha'er**: while it is on your board, every Human/Werewolf card of your tavern, your hand and your board is a werewolf (in your hand it does nothing). Fixed: in duos, a card your partner sent to your hand kept its human form; the Alpha now also wins over any other form rule. Its text says where it works.
- **Fire is an affinity**: the Blaze cards carry the new built-in affinity **Fire** (mechanic "Wildfire"), with its own medallion. It works like the other affinities of the meta, and its settings are in the card editor, Affinities, Fire.
  - The number of Fire minions on your board (1 to 7) is the fire affinity: how many enemies all your Burns reach in a fight, and how many hits your wall of fire takes. Any minion given the Fire affinity counts, whatever its tribe.
  - Fire damage = the affinity's value: 1 from 1 Fire minion (level 1), 2 from 7 (level 2), plus the fire bonuses. Change the thresholds and values in the editor.
  - The wall of fire spares the minions that carry Fire (and the Blaze).
  - The Fire symbol (affinity slot) shows the count and the fire damage, and follows the fight live.
  - The old tribe affinity is gone: no more fire chips, no more "Affinity" keyword, no more fire numbers in the Keywords tab. "× its affinity" options now count the minions carrying its affinity.
  - In a meta without affinities, the Blaze cards leave the tavern like the other affinity cards. Turn affinities on in Rules to play them.
  - The Blaze cards saved in your metas get the Fire affinity once by themselves.
- **Affinity symbols only when active**: the affinity slots (and the Steam gauge) show only an affinity that has reached level 1; otherwise they are not on the table. The table workshop still shows them so they can be placed.

## v104
- **Table workshop**: the **total age** of your warband, **your fire** chip (fire damage and affinity) and the **enemy fire** chip (fights) can be moved and resized like the other elements. They show while you design the table, even with an empty warband (the total age sits on the right of the warband: use ⇄ to put the panel on the other side).
- **Burn is capped by the affinity**: in a whole fight, all your Burn effects together burn at most as many enemy minions as your affinity. With affinity 2, the first Burn already marks 2 enemies and a second Burn card does nothing.
- **The wall of fire burns out**: Deflagration stops after as many hits as your affinity (all your Deflagrations together in the fight; a second one only tops the wall up if your affinity grew). Blaze attackers still cross it without using it. The flames die down when it goes out.

## v103
- **Fire reworked (Blaze)**: Burn and Deflagration were too strong.
  - **Fire damage**: 1 with 1 to 6 Blaze on your board, 2 from 7 Blaze, plus the fire bonuses. Both players see each side's fire damage during the fight, in the fire chip ("🔥 2 · Affinity 5", updated live); in the tavern the chip shows yours.
  - **Burn N**: puts N burn markers on as many enemy minions as its affinity, with no damage right away. No enemy gets a second marker before every enemy got one in this fight. **At the end of each combat turn** (after each attack), every burned minion takes the fire damage and loses 1 marker.
  - **Deflagration**: a wall of fire between the boards for the fight. Every **non-Blaze** enemy minion that attacks through it loses Health equal to the fire damage (Blaze cross it unharmed). Walls don't add up.
  - **Raise the fire damage** with any trigger (card editor, "Fire (affinity)"): "Aura: +N fire damage while this is on the board" (passive) and "+N fire damage for the rest of the fight" (when it attacks, dies, is attacked, start of combat…). Cards: Magma Golem (Deathrattle +1), Wall of Embers (whenever attacked +1), Ember Lord (aura +1), Inferno Drake (whenever it attacks +1); Pyromancer and Phoenix: Burn 2; Sun Titan: Burn 2 and Deflagration.
  - **New look for the wall of fire**: real flames (particles), in the style of the game's sprites.
- **Delete a built-in card** from a meta (card editor, "Delete card"): it leaves the tavern and every list of this meta. It stays under "🗑 Deleted cards" with a Restore button.
- **Every keyword in the Keywords tab**: Taunt, Shield, Reborn, Windfury, Venomous, Cleave, Stealth, Magnetic, Rally, Tough, Flying, Devour, Burn, Deflagration and Affinity, next to yours. Change their name and their explanation for this meta (cards and tooltips use them); Burn, Deflagration and Affinity also set the fire damage numbers (1, 2, from 7 Blaze). "Restore original" brings back the original.
- **Import affinities from another meta** (card editor, Tribes): its affinities and settings (switched on), the cards that carry or use them with their pictures, the cards they summon, and the keywords and tribes they need. A card this meta already edited only gets the affinities added. Done once by itself at launch: "affi-cd" into "canca 1stmeta".

## v102
- **New tribe: Blaze** (Brasier), fire at the start of the fight.
  - **Affinity** (1 to 7): the number of Blaze minions on your board (this one included). It sets how many enemies they hit and how hard. Your affinity shows at the bottom left of your warband ("🔥 Affinity N").
  - **Burn N**: deals N damage to as many random enemy minions as the affinity, and each gets a **burn marker** (a flame in the middle of its picture, "+X"). The next time a burned minion takes damage, it takes X more (X = the affinity it was burned with), then loses the marker. Markers stack.
  - **Deflagration**: a **wall of fire** rises between the two boards for the rest of the fight. Every enemy minion that attacks through it loses Attack equal to the affinity (walls add up).
  - Cards: Spark Imp, Kindling (T1); Ash Herald, Cinder Hound (T2); Flame Dancer, Magma Golem (T3); Pyromancer, Wall of Embers (T4); Phoenix, Ember Lord (T5); Sun Titan, Inferno Drake (T6).
- **Card editor**: new group "Fire (affinity)" (Burn, Deflagration); for any effect, "How many = its affinity" (random targets), "Repeat × its affinity" (Lab) and the scaling "× its affinity".

## v101
- **Evolution lines (Xyrmex) in the tavern**: your tavern only offers the levels of the line you hold in hand or on your board (holding a level 2: only your level 2, no more Larvae; holding a Larva and a level 2: both). Holding none: the Larva. Once a Queen's Battlecry has opened every evolution, all levels show up.
- **They show up whatever your tavern tier**: staying at tavern 1, you still find your level 2, 3, 4 or 5 evolution (the other tribes still follow the tavern tier).
- **Stats add up for real**: the three copies' stats all go into the evolution (3 Larvae 1/2 + Brood Drone 2/2 = 5/8), with their buffs and markers.
- **The Queens keep the stats and markers, not the effects** of the cards before them (the tier 5 Xyrmex have "Its effects" unticked; those saved in your meta are switched once, by themselves).
- A written card text can name a tribe as {t:Xyrmex}: it shows the tribe's current name (the Swarm cards now say "Essaim 3+" if you renamed the tribe).

## v100
- **"If it's day" / "If it's night"** (card editor, More options): in "Only if" and in "Condition". Day = odd turns, night = even turns, in the tavern and in combat (the fight of a turn happens at that turn's time). The card text says "by day," / "at night,".

## v99
- **Triples: the ages add up.** A golden (or an evolution) is as old as its three copies together (before: as old as the oldest). The Beasts that care about age, and the Xyrmex Queen, get much older.
- **Evolutions add up instead of replacing** (Xyrmex): the chosen evolution keeps the creature it comes from: its stats (its card's Attack and Health, and those of the evolutions before it) add to the new card's, its effects and keywords stay, and so do its markers. At the Queen you have every evolution you chose, as it was when you chose it, plus the Queen. What the copies gained (buffs) always comes along.
  - **Card editor, ⇪ Evolutions**: three boxes say what the new card keeps from this one: "Its stats", "Its effects", "Its markers". All ticked on the Xyrmex; untick them to make an evolution replace the card (stats: then only the buffs come along).
  - The evolution window says when the evolution adds to your creature.
  - The same effect several times on a card is written once with "(×2)", "(×3)"…; an effect kept from a card with its own written text shows that text.

## v98
- **New tribe: Xyrmex** (an evolving alien swarm). Only one Xyrmex in the tavern at tier 1: the **Xyrmex Larva**.
  - **Triple** a Xyrmex: instead of a golden, you **choose its evolution** among 3 cards of the next tier ("⇪ Evolve!"). It keeps what the three copies gained (stats and markers).
  - From then on, **your tavern only offers the evolution you chose** (the others never show up), and tripling that card again gives the same evolution, no choice. Evolutions never come out of Discover or random effects unless you chose them.
  - Tier after tier up to the **Queens** (tier 6, Unique): tripling a tier 5 lets you choose your Queen. Every Queen has "**Battlecry:** every evolution of its tribe joins your tavern for the rest of the game" (not the other Queens).
  - Three lines, one card of each per tier: **Brood** (Deathrattle: summon one of each earlier evolution of its line), **Hive** (End of turn: your Xyrmex everywhere, board, hand and tavern, get +1/+1 for each Xyrmex on your board), **Swarm** (Start of Combat: with 3+ Xyrmex, +3/+3 and Shield; 5+, +5/+5, Shield and Windfury instead; 7, seven +1/+1 markers, Shield, Windfury and Reborn instead).
  - Cards: Xyrmex Larva (T1); Brood Drone, Hive Worker, Swarm Soldier (T2); Brood Nurse, Hive Forager, Swarm Warrior (T3); Brood Keeper, Hive Builder, Swarm Champion (T4); Brood Warden, Hive Architect, Swarm Warlord (T5); Brood Queen, Hive Queen, Swarm Queen (T6).
- **Card editor**: "⇪ Evolutions" (Minion tab): up to 3 cards a minion evolves into when tripled; a card listed there by any card becomes evolution-only. New effects "Summon each earlier evolution of its line" and "Add every evolution of its tribe to your tavern", new target "Your minions everywhere (board, hand and tavern)", new scaling "× your minions on the board, this one included", new condition "Minions of its tribe (this one included)".
- **Fix**: in combat, "the same minions as the rule above" now works after Give Attack/Health, Deal damage, Destroy, Give a keyword and the other effects that aimed at minions (it found nobody before).
- Long card texts can shrink a little more before they are cut.

## v97
- **Night picture framed by hand**: on a shapeshifter, the Picture tab has "☀ Day picture / ☾ Night picture". The night picture uses the same tool as the day one (drag, zoom, "Whole picture", "Fill", separate framing for the card and the board). Each side keeps its own draft; Save card saves both. Sharing a card takes its night picture along; deleting a card removes it too.
- **New effect "All your Human/Werewolf cards stay werewolves (while this is on your board)"** (Day and night group). **Blood Moon Alpha** now uses it: it only works from your board (it still turns your Human/Werewolf cards of the tavern, hand and board into werewolves). The old effect (tavern, hand or board) stays available. A Blood Moon Alpha saved in your meta (renamed or not) switches to the new effect once, by itself.
- **Discover and other choices**: "👁 Look at the table" puts the choice aside to look at your hand and board (tooltips work); "↩ Back to the choice" brings it back.
- **Day / night corner**: it now sits under the minions (the 7th one is no longer covered) and has no tooltip or help cursor.

## v96
- **⟲ Make it change form** (card editor, Minion tab): one button turns any minion into a shapeshifter. It gets a second form (its own name, stats, keywords, attack style, effects and picture) and a **Rule** decides when it switches. For now the only rule is **Day / night (werewolf)**: first form by day (odd turns), second form by night (even turns); new rules can be added to the list later. "Remove the second form" (two clicks) turns it back into a normal minion.
- The **Night** tab only shows on shapeshifters (their night effects and text).
- **Picture tab**: "☀ Day picture" (the usual one, framed by hand) and, under it, "☾ Night picture" (framed automatically).

## v95
- **Card editor, Minion tab: ☀ Day form / ☾ Night form** (on day / night cards): the same fields edit either form: name, Attack, Health, keywords and now the **attack style** of each form. Tribe, tier, rarity and the rest stay shared. The Night tab keeps the night effects, text and picture.
- The Human/Werewolf cards: humans shoot **arrows**, werewolves throw **meat**.
- **The other form's stats above the gems** (tavern, board, hand): by day, the werewolf's Attack and Health on dark grey; by night, the human's on yellow. Faded when the minion is locked in werewolf form.
- **Hover a day / night card** (tavern, board or hand): the card of its other form shows right beside it, with its full text ("☾ At night" / "☀ By day"). On your own minions it is the real one, with what that form gained. When there is no room beside it, the tip goes under the card instead of hiding it.
- Long card texts can shrink a little more before they are cut.

## v94
- **Day and night**: odd turns are **days**, even turns are **nights**. A corner of your warband shows it (a sun in a light corner by day, a moon in a dark corner with stars by night), whatever table is in use.
- **New tribe: Human/Werewolf** (Humain/Loup-garou). Each of its cards has **two forms**: a Human by day, a Werewolf by night.
  - As each turn begins, every Human/Werewolf card of yours (tavern, hand, board) **changes form** (the card turns over).
  - Each form has its **own name, stats, keywords, effects and picture**, and keeps what it gains: buffs given to the Human stay on the Human, buffs given to the Werewolf stay on the Werewolf. Markers stay on the minion and count in both forms. Combat is fought in the form of that turn.
  - The tribe line shows "Human" or "Werewolf"; a sun or moon badge sits on the card, and its tooltip shows the other form.
  - **Lock in werewolf form** (new effect, "Day and night" group): the targets turn werewolf now and stay werewolves for good, even by day (a 🔒 on the moon). Spell **Full Moon** (tier 2, 1 gold, only in games with the tribe): lock a minion in werewolf form. **Moon Priestess** does it with a Battlecry.
  - **Blood Moon Alpha** (Unique, tier 6): while it is in your tavern, your hand or on your board, all your Human/Werewolf cards stay werewolves, even by day; when it leaves, they follow the time of day again.
  - Starting cards (to fine-tune): Wary Villager / Feral Villager, Young Shepherd / Moonstruck Pup (T1), Silver Hunter / Pack Stalker, Innkeeper's Wife / Howling Matron (T2), Village Smith / Ironjaw, Moon Priestess / Moon Witch (T3), Village Elder / Grey Elder, Bounty Tracker / Bloodhound (T4), Lord of the Manor / Beast of the Manor (T5), Old Huntsman / Great Wolf of the Wild, Blood Moon Alpha (T6).
- **Card editor, new "Night" tab** (any minion can be a day / night card): night name, Attack, Health, keywords, its own effects ("☾ Edit the night effects", "Copy the day effects"), its own card text and its own **night picture**. "☾ Show the night form" in the preview.
- The tribe joins metas that saved their own tribe list too (delete it in Tribes if you don't want it).

## v93
- **Stealth, fixed**: a minion in Stealth can **never** be attacked any more (before, when all your minions were in Stealth, the enemy attacked one of them anyway).
  - When all of one side's minions are in Stealth, the other side can't attack: **the hidden side attacks instead** with its next minion ("No visible target"), and attacking takes away its Stealth.
  - When both sides are all in Stealth, the minion whose turn it is steps out of hiding (loses Stealth, no attack), then it's the other side's turn.
  - A hidden side that can't attack (0 Attack) can't be attacked either: the fight stops.
- **Stealth marker = single use, like the Shield**: once lost (it attacked), it is gone for the rest of that combat and its marker no longer shows on the minion; it's back for the next combat. Same for a popped Shield marker or a used Reborn marker.

## v92
- **"× the markers of…"** (card editor, More options, Scaling): an effect's amount is multiplied by **how many markers some minions carry**, no rule above needed. "Count the markers of": your other minions (added up), all your minions, this minion, the minion that triggered it, your leftmost / rightmost other minion, the minions next to this, your other minion with the most markers, or the enemy minions. "Which markers": every marker, stat markers, keyword markers, or one keyword's markers. A tribe can be chosen for the groups, and "At most" still caps it.
- Works with every effect that can scale: stats, markers, gold, Armor, damage, healing… e.g. "At the end of your turn, give this +1/+1 for each marker on your other minions."

## v91
- **New "When": "After a friendly minion is attacked"** (combat, any of your minions, this one included; can be limited to a tribe, and works with "Every N times"). Its target "The attacked minion" aims at the minion that was attacked.
- **Target "The minion just summoned (a token too)"**: with "After a friendly minion is summoned" (combat or tavern), the target now says plainly that it aims at the minion that was just summoned, tokens included (it was listed as "The minion that triggered it"). The card text says "the summoned minion".

## v90
- **Unique** moves: no more word on the tribe line; a **diamond** sits right under the name, above the text. Hover it: "Unique card: only one copy of it can exist for you…".
- **Frames by tribe, unique and rarity** (editor, Frames): a new "Unique cards" choice gives every unique card its own frame (it wins over the rarity and tribe frames; a card's own frame still wins over all).

## v89
- **Unique** is now written on the card, between the rarity gem and the tribe (e.g. "Unique Constructs").
- **Gold**: the 10 coins fit on one row. Coins beyond 10 go on a second row; gold gained during the turn above your base (e.g. 11/10) shows a bit more orange, base gold above 10 stays yellow.

## v88
- "Make the next tavern upgrade cheaper" becomes **"Change the cost of the tavern upgrade"**: a plus makes it cheaper, a **minus makes it more expensive** (never below 0).
- **"× each…" scaling (with "At most") on more effects**: change the cost of the tavern upgrade, add tavern spells (random, a given one, a copy of the last one), add a given minion, the next sales give extra gold, the next minions bought / played get stats, charge Evolution, free buys, random gold, next spells / Battlecries twice, gain the Attack and Health of other minions, discover a marker.

## v87
- **Discover, beyond minions**: a new **Discover** group of effects in the card editor (with the old "Discover a minion"):
  - **Discover a marker**: one of a few random markers (stat markers +1/+1, +2/+2, +1/+3, +3/+1, or keyword markers; "Offers" can keep only one kind), put on the targets; for a stat marker, how many of it.
  - **Discover a keyword** (to the targets) · **Discover a tavern spell** (to your hand, from your tier) · **Discover a token** (to your hand, any token of the meta) · **Discover an affinity** (to the targets, when affinities are on).
  - "Choices": how many offers. They work on minions and on tavern spells; a "Then" rule waits for the choice; bots take the first offer; a single possible offer is given at once.

## v86
- Bro-cog is gone (it was only an example).
- **Unique** (card editor, Minion tab, under the rarity): a player can have only **one** of the card, in hand and on board together, and it **never becomes golden** (no triple, no "make golden", no golden Discover). Once you have it, the tavern and Discover don't offer it to you any more (and never two at once), effects don't add or copy a second one, and you can't buy or play another. Shown in the card's tooltip.

## v85
- New Construct, **Bro-cog** (tier 2, 2/3): "After you sell another minion (with markers), this minion takes all the markers of the sold minion." Automatic, nothing to choose; golden: twice the stat markers.

## v84
- **The sold minion as target A**: with "After you sell another minion", the take-and-give effects (gain / move markers, gain Attack and Health, gain keywords) can aim at **"The sold minion"**. Example: "After you sell another minion, this minion takes all the markers of the sold minion": automatic, nothing to choose. With a target B, those markers go to target B instead.

## v83
- **Target A and target B**: effects that take something from minions and give it to others now have a **Target B (receives)** under **Target A**: "Markers: move markers", "Markers: gain the markers", "Gain the Attack / Health of other minions", "Gain the keywords of other minions". No target B (the default): this minion receives, as before. Both can be "of your choice": the player picks A, then B (A is not offered again), then the markers.
- **"Markers: gain the markers" takes a number**: "How many (0 = all)". With a number and one minion to take from, the player picks which markers; "a copy" leaves them on target A.

## v82
- Removed three auras added in v81 that nobody asked for: "the tokens you make get stats", "your effects give more stat markers", "your minions age faster".
- **Search in every drop-down of the card editor**: click a list (or start typing on it) and type words to filter the choices; arrows and Enter pick, Escape closes.
- **"Minions you summon in combat get stats"** (Aura) can now give **the Attack and Health of a minion you pick from the usual targets** (your leftmost, your oldest, your strongest…) instead of a fixed amount.
- **Choose your markers**: when an effect moves or removes markers from one minion, a window shows that minion's markers with how many of each; click one to take it (the − puts it back), the counter shows how many you took, then Confirm. Bots and several minions at once: at random as before.
  - "Markers: remove markers" can be **"Up to N"**: the player decides how many (0 to N).
- **One rule feeds the next** ("Then" rules): new scaling "× the number from the rule above" (markers removed or moved, minions destroyed) and "× the different markers / the markers / the Attack / the Health of the minion of the rule above", with an **"At most"** cap on every scaling. A "Then" rule now waits for the player's choices of the rule above (target, markers).
  - Examples: "Remove up to 5 markers of your choice, then your hero gains that much Armor (at most 5)" · "Sacrifice a minion, then your hero gains 1 Armor for each different marker it had (at most 5)".
  - "Your hero gains Armor" can now be used by any minion or spell.
- **Mutations can give markers**: tick "Stats as a marker" and / or "Keyword as a marker" on a mutation.
- **Markers sit at fixed spots** on the minions of the board: each kind always in the same place (stat markers on the left, keyword markers on the right by default). Move them in **Creation studio > Look > Markers layout**: drag them on a sample minion or type their position, and set their size.

## v81
- **Markers both ways**: "Markers: move markers" now has a direction, "From the targets onto this minion" or "From this minion onto the targets", with the usual list of targets.
- **Auras, many more** (When: "Aura: always, while on your board"):
  - **Give effects to your minions**: the minions it aims at have one or several effects of your choice (+ Add an effect to lend), for as long as this minion stays on your board, in the tavern and in combat (minions summoned in combat get them too). Shown on their card with a ✦.
  - **Your minions have a keyword** (in combat) · **have more stats** (in combat) · **attack extra times** (in combat, on top of Windfury).
  - **The tokens you make get stats** (tavern and combat) · **your effects give more stat markers** · **your minions age faster**.
  - Auras aim at your other minions / all of them / tokens / adjacent / left or right of it / its kin / leftmost / rightmost / oldest / youngest, and every filter applies: tribe, keyword, affinity, tokens, markers, age.
- **Markers filter, finer**: "With or without markers" / "Only with markers" / "Only with stat markers" / "Only with a <keyword> marker", on every target.
- **New trigger "After a friendly minion is summoned (tavern)"**: when an effect puts a minion on your board in the tavern (Summon, copies). Triggers that watch other minions can now also filter on **tokens** (only tokens / no tokens) and on **markers**, and conditions can read the **Attack / Health of the minion that triggered it**. Example: "After a friendly minion is summoned (a token), if its Attack is at most 1, this minion gains its Attack and Health", in the tavern and in combat.

## v80
- **Frames: Hand, Board, Tokens.** In the Collection (and the card editor's Skins), "Cards" is now **Hand** (cards in your hand) and "Tokens" is now **Board** (minions on the board and in the tavern). A new **Tokens** row dresses the tokens (minions made by effects) on their own, so you can tell them from the minions you bought at a glance. It offers the same frames as the Board; "Same as Board" keeps them alike.
- **Age, the whole set** for the card editor:
  - New trigger **"Age: when this has spent N turns on your board"** (fires at the end of that turn; can fire again every N turns).
  - Conditions and scaling: its age · the total age of your minions · the age of your leftmost / rightmost minion · of your oldest / youngest minion · the average age · the age of the minion that triggered it · your number of minions at least 3 turns old.
  - Targets: your (other) minion with the most / fewest turns on your board, this one included or not; any target can be filtered by age (at least / at most N turns).
  - "Age: make minions older or younger" now takes a minus too (never below 0), and can be picked in the editor (Age group).

## v79
- **Age**: every minion counts the turns it has spent on your board (+1 each time a turn ends with it there). Shown under each minion (⌛ 3), and the **total age** of your warband sits at the right of your board.
  - Kept when it goes back to your hand, evolves or becomes golden (the golden takes its oldest copy's age); an exact copy has the same age, a plain copy starts at 0.
  - Card editor: conditions "Its age (turns on your board)" and "Total age of your minions"; scaling "× its age" and "× the total age of your minions"; targets "your other minion with the most / fewest turns on your board"; new action "Age: make minions older".
- **Tokens in the card editor**: a **Tokens** group at the top of the card list holds every token (Cub, Birdie, Pup, Coral Sprout and yours), and **+ New token** makes one. The built-in tokens can now be changed and saved like any card ("Restore original" brings them back).

## v78
- **Markers** (like counters in a card game): they sit on a minion and stay there, turn after turn, until an effect moves them.
  - **Stat markers** stack: a +1/+1 marker is +1 Attack and +1 Health; other sizes exist too (+2/+2, +1/+3, +3/+1…) and keep their size when moved. **Keyword markers** (one per keyword): the minion has that keyword as long as the marker is on it; move the marker away and the keyword goes with it.
  - Markers given or taken **in combat are kept** back in the tavern (a marker stolen from an enemy is gone from their warband for good).
  - Shown on minions and cards as small chips (green +N for +1/+1 markers, +2/+2 and the like for other sizes, one round chip per keyword marker), and in the tooltip. Triples and "Make golden" keep them.
  - Card editor, new **Markers** group of effects: give stat markers (pick their size) · give a keyword marker (a chosen one or random) · move markers from other minions onto this one · gain all the markers of other minions (take them, a copy, or destroy the minion and take them) · remove markers · gain a random keyword the enemy warband has (for the combat, or as a marker).
  - Targets can be filtered to **minions that carry markers**. Minion tab: **starting markers** (+1/+1 and keyword markers it carries from the start).
- **Flying** (new keyword): ignores Taunt when it attacks, it hits a random minion without Taunt (if they all have Taunt, one of them). Wings on the token.
- **Tokens**: a token is any card that never shows up in the tavern (untick "Can show up in the tavern"). They get a TOKEN tag and a dashed frame, and effects can aim at **your tokens** / **random tokens of yours**, or filter "tokens only / no tokens".
- **Golden tab** in the card editor: tick "Custom golden version" and the golden card gets its own Attack, Health, effects and text, filled in with ×2 to start. "Edit the golden effects" edits them with the usual effect editor (summon 2 instead of 1, a keyword marker instead of a keyword, an exact copy…).
- Summon copies: new "Exact copy" option (same stats, keywords and markers). "Your leftmost / rightmost minion" can take several minions.
- **The Beasts are new**, built around markers (the old Beasts are gone):
  - Tokens: Cub 1/1 · Birdie 1/1 with a Stealth marker.
  - T1 Cute Antelope 1/2, Windfury marker · Funny Lemur 2/1, Tough marker.
  - T2 Lion Mother 3/2, Activate (2): summon a Cub (golden 6/4: two Cubs) · Proud Bird 2/2, Battlecry: summon a Birdie (golden 4/4: two).
  - T3 Friendly Zebra 1/2, after you win a combat: summon a copy of it (golden: an exact copy) · Mother Hippo 3/4, Start of Combat: your tokens get a random keyword (golden: a keyword marker) · Reaper Lion 4/3, Tough marker, Start of Combat: gains a keyword of the enemy warband (golden: as a marker).
  - T4 Guardian Giraffe 2/7 Taunt, Battlecry: a Shield marker on a friendly Beast · Zebu Traveler 5/3, when it attacks: gains the stats of your rightmost other Beast (golden: two).
  - T5 Curious Buffalo 6/5 Cleave · Elephant King 5/6, Tough marker, Activate (1): destroy a friendly minion and gain a random keyword marker (golden: two).
  - T6 Fierce King Gorilla 10/6 Cleave, when it attacks: gains the markers and the stats of the weakest enemy (golden: twice) · Old King 7/8, Battlecry and after a win: gains the stats and markers of your oldest Beast (golden: twice).
- **New tavern spells** (the old ones are gone: the Classic meta has these 12, and they can be changed in the card editor like your own spells):
  - T1 Strength (1 gold): the next minion you buy gets +1/+2.
  - T2 Blue Sky (2): a +2/+2 marker on a minion · Dawn Sky (2): a +1/+3 marker · Morning Sky (2): a +3/+1 marker · Night Sky (2): a +1/+1 marker on two random friendly minions.
  - T3 Evolution (1): give a minion Stealth · Evolution (1): give a minion Tough. T4 Evolution (2): Windfury · Evolution (2): Shield.
  - T5 Home (3): double a minion's Health · Sweet (3): double its Attack. T6 Home Sweet Home (3): double both.

## v77
- Online: only what differs travels. The meta is cut into pieces (cards and rules, look and sounds, each picture, each skin), each with a short fingerprint; the friend's game compares with the copy it already has (from the launcher's ma-meta.js or an earlier game) and asks only for the pieces that changed. Same meta: the game starts at once. One card or one picture changed: a few kilobytes. The host prepares the list while the friend types the code.
- In-game menu (☰ Menu, top right, or Escape): Resume, Concede (results screen, rated at your current place), Quit to the main menu. Online, conceding ends the game for the duo, on the friend's screen too.
- Fixed: a duo game's results screen had no "Play again" button (online games could not be left).
- New affinity effects in the card editor (Affinities group):
  - Triggers: Bedrock: when played onto a Foundation (Earth) · When this Ebbs back to your hand (Water) · When your Pressure fills up (Steam) · After your side Mires an enemy (Tar, combat).
  - Actions: Build a Foundation under every slot (Earth) · Stats for each Foundation under your minions (Earth) · Release all your Pressure: stats per point (Steam) · Extra Ebbs this turn (Water) · Stats to all your minions of an affinity, on board and in hand.

## v76
- Playing online: everything is in place before the first card is dealt.
  - The host's whole meta (pictures, card skins, table, bartender, sounds, rules) is checked first: a friend who already has the very same meta (from the launcher's ma-meta.js, or from an earlier game) starts at once, nothing travels.
  - Otherwise it is sent once, before the deal, with a progress bar on the friend's screen, then kept in the friend's game: the next game starts at once. (Before, the pictures trickled in during the game and the rest only came at the end.)
  - After the game the friend's own meta comes back as it was.
- The skins a player picks are theirs: a newer copy of a friend's meta (a new ma-meta.js from the launcher) no longer puts the sender's skins back, nor the sender's table.
- At start, every picture of the meta (cards, tokens, skins, table, bartender) is decoded once behind a short loading bar, so nothing pops in during play; ma-meta.js's text is let go once installed (less memory).

## v75
- Playing online works even when the two homes' routers block a direct link, with nothing to set up:
  - Both computers now try two ways at once: the direct link (as before) and a relay through a free public MQTT broker over a secure websocket (three brokers, in case one is down). The direct link is kept when it opens within a few seconds, the relay otherwise. Same room code, same screens.
  - Tested: direct only, relay only, and both available, each for a full game in sync.

## v74
- Playing online between two homes: when the two computers can't link directly (a router or a firewall in the way), the link now goes through a relay on ports 80 and 443, which nearly every network lets through; PeerJS's own relays were often down, which gave "Nobody answered that room code" even with the right code.
  - More address finders (STUN) too, and 30 seconds to connect instead of 12 (a relayed link is slower to open).
  - When the room is found but the link can't be made, the message says so instead of blaming the code.
  - LISEZ-MOI: what to try when it won't connect.

## v73
- Sending the game to a friend:
  - Studio: "For a friend" saves ma-meta.js, the whole active meta (cards, pictures, skins, sounds, fonts, rules, tables). Put it next to index.html in the folder you send.
  - A game that finds ma-meta.js next to it installs that meta by itself on the first launch and selects it; a newer file updates the same meta (no duplicates, the friend's own metas are left alone).
  - Opened from inside the .zip (Windows copies only index.html out of it), or with files missing, the game shows how to extract it and start it properly instead of a broken table.
  - A browser that keeps little data for a game opened from a file (some Firefox / Safari settings) gets a warning to use Chrome or Edge.
  - LISEZ-MOI.txt in the folder: how to start the game, how to send your meta.

## v72
- Smoother game, nothing removed:
  - The hidden aiming arrow kept animating and repainting its glowing line 60 times a second for nothing; it now sleeps while hidden. At rest in the tavern the browser goes from about 63 ms of work per second to about 1 ms; in the main menu from 23 ms to 0 (the shine of "Open the tavern" no longer moves its layout).
  - Hovering cards and minions: the tilt is computed once per frame (it was on every mouse move), cards in hand and minions get their own layer, and the board's idle bob holds still while you aim at the board or your hand or hold a card. No slow frame left while hovering in our measurements.
  - Buying: the card flying to your hand no longer animates a filter (repainted every frame); its golden glow is a fading halo instead.
  - Card texts are fitted once per text and size (they were measured again after every action).
  - The editor no longer uses a costly :has() rule on the whole table.
- The Expedition mode is gone (and its PvE editor): about 110 KB less to load, no mode switch on the menu, no "Expedition together" room.
- Tavern spells, new effects (editor: "Tavern spells" groups):
  - "Add a given tavern spell to hand" (you pick the spell, how many).
  - "Cast a given tavern spell for free" (on the minion you pick for a targeted spell); it counts as a spell cast.
  - "Add a copy of the last tavern spell you cast to hand".
  - Aura "Tavern spells cost less" (the tavern spell's price shows in green).
  - Trigger "After you buy a tavern spell" (heroes can use it too).
  - Lab: conditions "Spells in your hand", "Spells you cast this turn"; "x each spell in your hand".

## v71
- Devour now gives all the stats of the tavern minion eaten (was half). Abyssal Maw and the Devour rule make it 1.5x (golden Maw 2x). "Devour an enemy" in combat keeps its All / Half choice, All by default.
- Frozen minions, a new family of effects (editor: "Frozen" groups of triggers and actions):
  - "Freeze tavern minions": they stay when you refresh, and are still there at your next turn (then they thaw). Frost shows on them; the frozen-minion growth aura grows them too.
  - "After you buy a Frozen minion" (Frozen alone, or the whole tavern frozen); "the minion that triggered it" is the one bought.
  - Target "The Frozen minions in the tavern".
  - In combat, "Freeze enemy minions": they skip their next attack (frost on them, a shiver and a thaw when their turn comes).
  - "After your side Freezes an enemy" (the Frozen enemy is "the minion that triggered it"), and target "The Frozen enemy minions" - to shatter them.
  - Lab: condition "Frozen minions" (in the tavern, or enemies in combat) and "x each Frozen minion".

## v70
- Imported sounds up to 2 MB each (was 700 KB): game sounds, a visual effect's sound, a card's own sounds and bartender voices.
- Bartender: a "Chance to speak" slider for each moment (0% = never, 100% = every time). The built-in odds are shown as defaults: new turn 50%, refresh 33%, sell 35%, the rest 100%. The "Talks" slider still applies on top, to every moment. (The refresh line no longer waits for every third refresh: it is a chance like the others.)

## v69
- Imported sounds can now weigh up to 700 KB (was 300 KB): game sounds, the sound of a visual effect, a card's own sounds, and bartender voices (was 400 KB).

## v68
- Bartender voices: in Bartender and texts, each moment (new turn, upgrade, tier 6, golden minion, refresh, spell, sell, win streak, losing streak, low Health) can get up to 8 recorded voices (MP3, OGG, WAV, 400 KB each), listened to and removed from the studio. When the bartender talks, a voice plays; with as many voices as lines of your own, line N speaks with voice N, otherwise a random voice of the moment. The bubble stays up while the voice speaks (a small speaker shows on it), a new line cuts the previous voice, and a Voice volume slider sits next to them (the game's sound switch and sound volume still apply).

## v67
- Fonts: 24 more title fonts and 12 more text fonts for the interface theme (40 and 22 in all). Card skins can pick the font of the name and tribe line, of the card text and of the numbers; token skins the font of their numbers. Each font is now fetched on its own with the weights it really has (a font with a single weight no longer blocks the others).
- Token skins have gem slots: an Attack gem, a Health gem and a plate behind the tier stars, painted apart, placed with sliders or dragged in the layout, with the numbers' size, offset, colour and font.
- Holding a minion no longer shows the big red "Sell" box over the tavern: a small gold coin (+1) appears on the minion when letting go would sell it.
- End of combat: the damage is counted on screen. The winner's tavern tier pops up on its hero, then each survivor's tier pops up on its token and flies into a damage counter; the counter then strikes the losing hero. A damage cap shows as "max".

## v66
- Links are gone: no more "Link two minions", "When this gets linked", "When its linked partner dies", "its linked partner" or the link conditions. Cards made with them still load; those rules are simply dropped (and "its linked partner" aims at the minion itself).
- Bigger hand cards (+30%): they show more of themselves at the bottom of the screen, a full hand of 10 fits between your gold and End Turn, and the hovered card rises whole.
- Six new affinity mechanics in the affinity studio:
  - Resonance: playing one gives your other minions of the affinity +X/+X.
  - Spread: at the end of your turn, X of your other minions catch the affinity (if they have room for one).
  - Lure: the tavern always offers you at least X minions of the affinity.
  - Aura: as the fight starts, each one gives +X/+X to the minions next to it.
  - Fury: each time one survives damage, it gains +X Attack.
  - Bargain: your first X refreshes each turn are free (the refresh button shows it).
- Effect editor: a new trigger "When one of your affinities wakes up or grows"; lab conditions "Your minions of an affinity…", "An affinity's level…", "Your awake affinities"; and "× each of your minions of an affinity" / "× each of your awake affinities".
- The wider grab area of warband and tavern minions no longer hides their Ebb badge or their attack glow.

## v65
- Hand: a hovered card lifts but keeps catching the pointer down to where it rests, so it no longer bounces in and out at the bottom edge of the screen; grabbing it is reliable.
- Warband and tavern: minions catch a grab a few pixels beyond their frame (in the wider gaps), so a slightly-off click still picks them up.

# v64 — More room, shorter texts

- **More room between the minions** on every row (tavern, warband, fights): the gap goes from 12 to 26 pixels; a full warband and a full tavern still fit with room to spare.
- **Random draws are gone** from the lab (a card that had one now runs all its rules as written; saving it cleans it up).
- **Shorter lab texts on cards**: "30%:" instead of "30% chance:", and the notes are gathered in one short bracket — "(3 rolls, ×1–3, +1× each time, max 4, rests 2)".
# v63 — Your own pictures in effects, draws and rests

- **The chance tag no longer hides the effect**: it is now a tiny "30%" in the minion's corner, gone in half a second, with no glow and no pause; the effect plays at the same moment, untouched.
- **Your own pictures in the visual effects editor** (*Visual effects › Your pictures*):
  - **Projectile**: your picture flies instead of the glowing orb (it points where it flies, spins, or stays upright; its own size), with a soft glow behind;
  - **Impact**: your picture bursts where it hits (size, how long, whether it turns), on top of the glow, rings and rays you keep or remove;
  - **Particles**: a new particle shape, *Your picture*;
  - PNG with transparency works best; the pictures travel with the meta like the rest of its look.
- **The lab, more varied**:
  - **Random draw** (A, B, C): rules of the same trigger sharing a letter — only one of them fires each time, at random, with an optional **weight**; a drawn rule's Then / Otherwise follow it.
  - **Then rests N times**: after firing, the effect sits out the next N times (great with *Otherwise*).
  - **New conditions**: your golden minions, minions of its tribe, its tier, and in the tavern the minions in the tavern, your win streak and your losing streak.
# v62 — Quiet luck

- **No more dice**: the lab's chances roll unseen. Only a success shows, with a quick golden tag "✦ 30%" over the minion and a short glow; a miss shows nothing. Fights and the end of the turn no longer pause for the rolls.
# v61 — Dice, chains and the same minions

- **You see the dice**: every chance from the lab shows a die tumbling over the minion, then **50% ✓** (green, the minion glows) or **50% ✗** (grey, the minion shakes), with its own little rattle — in the tavern, at the end of the turn, at the start of the next one and in combat.
- **One roll per repeat**: "30% chance, ×3" now rolls three times, so it can happen 0, 1, 2 or 3 times (the text says "3 rolls").
- **Chains: Then / Otherwise** (new triggers in *Lab: chains*): a *Then* rule runs right after the rule above, only if it happened; an *Otherwise* rule runs instead when it didn't — a missed chance, a condition or a cost that failed, or "every N times" when it wasn't its turn. Stack them (Then, Then, Otherwise…). The tavern or combat version is picked for you from the rule above.
- **New target: the same minions as the rule above** — "give a random friend +1/+1; Then: give the same minion Taunt".
# v60 — The lab, further; attacks that pause; links

- **"Whenever this attacks" now plays during the attack**: the attacker sets off, freezes mid-swing with a glow while its effects play (and those of "Whenever another friendly minion attacks"), then the swing lands. Ranged attackers hold their wind-up the same way.
- **Fixed again: the drop slot when you move a minion.** The minion you grab was measured while still tilted and enlarged by the hover effect, so the slot drifted when you picked up the first one or grabbed by a corner. The row is now measured flat; checked on 54 positions (2, 4 and 7 minions, every start and end, both corners) at three screen sizes.
- **Signals are gone from the menus** (cards that already use them keep working).
- **The lab goes further** (*More options › ⚗ Lab*, on any effect):
  - **And if…**: a second condition on top of the first (its Attack, your gold, a counter, even turns…).
  - **Grows each time (+N×)**: the effect gets stronger every time it fires — ×1, then ×2, ×3… (in combat, per fight).
  - **Random strength ×1 to ×N**.
  - **At most N times**: then it is spent.
  - **Cost**: pay with its Health (never down to 0), its Attack, or your gold (tavern) — no payment, no effect.
- **Links** (new effect *Link two minions*, triggers *When this gets linked* and *When its linked partner dies*, target *its linked partner*): **Share** (stats one gains, the other gains too), **Vengeance** (when one dies, the other takes its Attack and Health), **Union** (side by side as combat starts: +N/+N and shared keywords), **Echo** (the Battlecry and Deathrattle of one trigger the other's).
# v59 — Exact drop slots and new sounds

- **Fixed: the drop slot when you move a minion** (or play one from your hand). The slot was computed from a fixed token size while tokens are drawn smaller on the table, so the glow and the minions making room drifted, more and more as the board filled up. The row is now measured as it stands when you pick a minion up: the glow sits exactly in the gap, at the minions' height and size, and the neighbours slide by the right amount. The slot also no longer flickers between two places near the middle.
- **A new sound engine**, with more impact and less of an old-school feel:
  - a real room (convolution reverb) instead of a simple echo, soft saturation, a glue compressor and a limiter, and stereo placement;
  - impacts in layers: an attack click, a sub that drops in pitch for the weight, a crunchy body and a short room;
  - every sound redone: coins are real metal, a card is picked with a swish of card stock and set down with a slap on wood, refreshing riffles the cards, freezing cracks like glass, upgrading rises into a chord, golden minions get a big swell and impact, spells rush in then sparkle, deaths crumble; the attack styles (lightning, fire, frost, shadow, holy, rock…) all hit harder;
  - same names, so your sound overrides and the cards' own sounds keep working.
# v58 — The effect lab

- **Fixed: Evolutions reached at the end of the turn** (a crystal charged at the end of the turn, or stats reached then) fired before the fight. They now open the **next turn, after the fight**, with the start-of-turn effects; a choice (forms, mutations) is offered then. The same goes for crystals charged during a fight.
- **Activate by clicking the whole minion**, not just the little button. A minion you can activate glows softly and its button pulses; once used, a click shows its details again. Dragging still moves it.
- **The effect lab** (*More options* of any effect, *⚗ Lab*), to build your own mechanics:
  - **Chance %**: the effect only happens that often.
  - **Repeat ×N**: any effect runs N times.
  - **Delay**: a tavern effect lands N turns later ("in 2 turns, gain 5 gold").
  - **Only if…** a number: its Attack or Health, your gold, cards in hand, minions, tavern tier, turn number, even / odd turns, your hero's Health, the number of enemies (in combat), or a counter, *at least / at most / exactly* N.
  - **Counters of your own**: new effect *Counter* — add to (or set) a named number (Rage, Souls, Charge…) kept on the minion or on you. Use it in *Only if* (with **spend it** to pay for an effect: "spend 5 Rage: +10/+10") or to scale an effect (*× its counter*). Counters show as small plates under the minion and next to your gold; in a fight, your own counters can change for the length of the fight.
  - **Signals**: new effect *Send a signal* ("Storm"), new triggers *When a signal is sent* (tavern and combat). Every friendly minion listening to that name reacts; chains are capped, so loops stop by themselves. Names you already used are suggested.
# v57 — A lighter studio

- **Tabs instead of one long scroll**: a card opens on *Picture · Minion · Look · Effects*, one at a time; the tab you were on stays when you open another card. *Show all* (top right of the tabs) brings back the whole form in one scroll, and is remembered.
- **Card skins in five tabs**: *Frame · Layout (the workshop) · Illustration · Gems · Text*. Once a skin is open, the library shrinks to a strip of thumbnails, and the per-tribe frames and the card back wait until you close it.
- **One slim bar on top**: the studio's name, your metas, help and Close on a single row; more room for the work.
- Fewer buttons at once: *Test* and *Fight* stay big, *Duplicate*, *Share*, *Restore* get smaller; the create buttons fit their column.
- **Card text colour**: the keywords in bold now take the text colour too, until you pick a keyword colour of your own (before, they stayed gold, so the text looked unchanged). A skin that is not equipped says so: its changes only show in play once it is equipped.
# v56 — Smoother tavern

- **Fixed: the card text colour of a card skin did nothing** (the text kept its built-in colour). New: a colour for the **keywords** in the text.
- **Gems can be placed with sliders**: left ↔ right, up ↕ down and size under each gem; dragging them in the workshop moves the sliders too. The workshop shows the numbers' colour.
- **Buying feels like it**: the minion arcs from the tavern into your hand, lifted and turning, and lands with a little bounce; the coins you pay fly from your purse to the tavern, and the spent coins flash out one by one.
- **Selling feels like it**: the minion is tossed to the bartender, who catches it and flips the coins back into your purse; the gold counter goes up when they land, coin by coin.
- **Cards and minions tilt toward the pointer** when you hover them, with a soft light on them.
- **No more tooltip popping up right after a drop or a click** when the table changes under a still pointer; move the pointer and it comes back.
# v55 — Picture window, gem sizes, text colours

- **The illustration stays inside the frame** (*Studio → Frames and card backs*, a card skin, *Illustration*):
  - **✂ Cut it out from the frame**: the transparent window of your frame becomes the illustration's mask, a little larger so it tucks under the frame's edge; the picture zone is placed on it and the illustration goes behind the frame;
  - or a shape: rectangle (rounded corners), arch, oval, circle, hexagon, octagon, shield, diamond;
  - or your own mask (PNG: transparency, or black and white); exported at the frame's size it is placed by itself.
- **Gem size**: a slider under each gem (attack, health, tier / cost); dragging the corner in the workshop still works.
- **Text colours** in one place: name, card text, tribe line and, new, the numbers on the gems (buffed and hurt numbers keep their green and red).
- Masks travel with the skin like the gems.
# v54 — Gems apart and curved text

- **Card skins can bring their three gems as separate pictures** (attack, health, tier / cost), in *Studio → Frames and card backs*:
  - pick the frame and the three gems **together** in *Add a card skin*: the frame is the file named frame / card / cadre (or the one that is no gem), the gems are found by their names (attack, atk, attaque / health, hp, vie, pv / tier, cost, coût, mana…), otherwise in that order;
  - or import them one by one, or the three at once, on an existing skin; *Remove* shows the frame's own painting again;
  - a gem exported on a canvas the size of the frame keeps its spot; empty edges are cut away;
  - each gem is a layer of the workshop: drag it, resize it, nudge it with the arrow keys;
  - size of the numbers and a nudge up or down to sit them on your gems.
- **Curved text**: the card name and the tribe line can follow an arc (bending up or down), live in the workshop, the preview and the game. Long names still fit.
- Gems travel with the skin: shared metas, a friend's game and "build together" carry them.
- Fixed: the minion / golden / spell previews of a card skin were drawn over the studio header.
# v53 — Creation studio

- **A simpler game by default: affinities are now an option of each meta, off unless you turn them on** (*Studio → Rules*). Off, minions keep their affinities for later, the table slots and badges disappear, and the cards made only for affinities leave the tavern. Turn them on again and everything comes back.
- **The editor becomes a creation studio**, with a side rail in three parts:
  - *Content*: cards, heroes, anomalies, keywords, tribes (and affinities when they are on).
  - *Look*: visual effects, interface theme, frames and card backs, table, bartender and texts, sounds and music, menus and screens.
  - *Meta*: rules.
  Everything in *Look* is saved with the meta: shared, copied, imported and borrowed with it, like the cards.
- **Visual effects editor**: create your own effects from 10 models (fireball, ice shard, storm, arcane, venom, sunlight, shadow, boulder, thorns…): three colours, how it flies (orb, comet, lightning, arrow, spinning star, beam from the sky), trail, speed and curve, impact (glow, flash, shock rings, rays, pillar of light, table shake), particles (shape, number, speed, gravity, direction) and sound, with a live preview between two minions. Use them as a card's *Attack style*, as an effect's *Look*, or for **12 table moments** (a minion lands, dies, is summoned, a spell is cast or hits, a Shield breaks, a golden minion, upgrade, buy, sell…).
- **Full interface theme**: 6 starting points (Tavern night, Frozen dungeon, Dwarven forge, Elven grove, Neon arcade, Old map), 13 colours (background, panels, text, accent, danger, the table's light…), title and text fonts, your own font file, buttons (solid, glass, outline) and corners. The whole game changes live as you edit.
- **Frames and card backs**: a card or token frame per tribe and per rarity, and your own card back, shown when Discover cards are revealed.
- **Bartender and texts**: how often the bartender talks, your own lines for 10 moments (new turn, upgrade, triple, refresh, spell, sell, win and losing streaks…), and **rewrite any text of the interface** (search it in English or French).
- **Sounds and music**: sound and music volume, music for the menu, the tavern and fights, and every sound of the game replaced by another one, your own clip, or silence.
- **Menus and screens**: game name, line above it, logo, menu background, embers, end-of-game titles and texts (1st, top 4, out), end picture, fight banners.
- The *Table* section has a button to open the table workshop.
# v52 — Build your own mechanics

- **Fixed: Pulse and the other affinity effects could not be picked in the card editor.** The menus now have an *Affinities* group:
  - triggers: Pulse, After one Ebbs back, After you build a Foundation, After a Mired enemy dies, plus *Whenever this is attacked* in combat;
  - effects: gain gauge points, double the next Pulse, Mire, build a Foundation, give a mutation to another minion.
  - Each one names the affinities of the meta that run it, including your own (a new Pulse affinity works with the Pulse trigger).
- **Carried effects** (affinity studio): effects that every minion carrying the affinity has as if printed on it, unlocked at level 1, 2 or 3. Any minion trigger works: Battlecry, Deathrattle, Whenever this attacks, Start of Combat, auras… Ten ready-made starts.
- **New effects to build mechanics:**
  - *Trigger their own effects*: fire the Battlecry, end-of-turn, Pulse… (tavern) or Deathrattle, Start of Combat, attack… (combat) effects of the targets. A chain fires each minion only once, like Pulse. Example: an affinity whose minions carry "Battlecry: trigger the Battlecries of the adjacent minions of this affinity" is your own Pulse.
  - *Give an affinity* (with the effects it carries), to minions on the board, in the tavern or in hand.
  - *Discover* can ask for an affinity.
  - Any "after you play / buy / sell…" trigger can count only the minions of an affinity.
- Templates *Bonus*, *Growth* and *Legacy* can give Attack and Health, Attack only or Health only.
- An affinity can show only your own description in tooltips.
- Badges sit inside the card or minion by default (they no longer slide under the next card) and always above the frame; the nudges still move them out.
- The card editor's *Look* section is laid out properly again; the sound import button is readable; French texts fixed ("Whenever this gains stats", affinity filters).
# v51 — Affinity studio

- **Affinity badges you can see and shape** (*Tribes & affinities → Affinity badges*): bigger by default, framed, and set separately for cards and for minions on the board:
  - size (14 to 72 px), position picked on a card or minion (corners, sides, top, bottom, above the name), stacked or side by side, fine nudges;
  - frame: none, coloured ring, gold, silver, gem or shield, with an optional glow in the affinity's colour. Live preview.
- **Affinity studio**: affinities are now edited like cards (*Affinities* tab, *+ New affinity*), with a live preview of a minion carrying it, its table slot and its texts:
  - **Identity**: name, mechanic name, description (styled text) shown in its tooltip.
  - **Badge**: two colours, your own picture or a **generated badge** (round, hexagon, shield, diamond, square, star) with a symbol (❄ ☀ ⚡ ⚙ ☠ ✿ ⚓ ♛ … or its initial), and an animation (glow, pulse, spin, shine). Built-in affinities can switch to a generated badge too.
  - **Levels**: thresholds on a visual track, and an optional **third level** with its own value.
  - **Mechanic**: 13 templates. New: *Growth* (they grow for good at the end of your turn), *Legacy* (when one dies in combat, another inherits a bonus), *Ward* (a chosen keyword as the fight starts), *Pack* (+Attack for each other one), *Strike* (damage to an enemy as the fight starts), *Fortune* (gold at the start of your turn), and *Only my effects*.
  - **Level effects**: any number of your own effects, each unlocked at level 1, 2 or 3, built with the full effect editor (end of turn, after you buy / play / sell one of them, start of turn, start of combat…), with ready-made starting points. New filter: *only minions of an affinity count*.
  - **Order**: drag the affinities in *Tribes & affinities*, or move them from the studio. Built-ins can be hidden and restored.
- In game: the table slots show up to 3 level pips, the state of every template, and the tooltips list the level effects (locked ones greyed) and the description.
# v50 — Living tables and richer cards

- **Table ambience** (Table workshop → *Ambience*), saved with each table:
  - **Weather and particles**: rain, snow, embers, bubbles, fireflies, falling leaves, petals, floating dust, sparkles, fog, ash — with density, speed, colour, and behind or in front of the cards.
  - **Light**: a tint (colour and strength), a vignette, and light rays with their own colour.
  - **Background motion**: slow drift, breathing or sway.
  - **Music**: your own loop (MP3/OGG, 5 MB max) with its volume. It plays during games on this table and goes quiet when the sound is off.
  - Undo works on all of it. The ambience travels with the meta, shared tables and online games.
- **Card look** (card editor → *Look*), for minions and spells. It changes how the card shows, never what it does:
  - **Aura**: a coloured glow (steady, pulse, flame or halo) on the card and on the minion on the board.
  - **Foil**: holographic, shine, prism or gilded shimmer over the picture.
  - **Name colour**, and a **frame** taken from your card skins for this card only.
  - **Entrance** when it lands on the board: slam, spin, rise, flash, from the shadows, bounce, portal (with a preview).
  - **Sounds** for played / attacks / dies: a built-in sound or your own short clip (300 KB max).
- **Styled card text**: `**bold**`, `*italic*`, `[red]colour[/]` (red, gold, green, blue, purple, orange, pink, grey, or a #hex code), on cards and in tooltips.
# v49 — Your own affinities and keywords

- **Affinity designer** (card editor → *Tribes & affinities*): every affinity is a card you can edit — name, mechanic name, colour, picture (upload, cropped round), thresholds, and the mechanic's numbers. Built-in affinities can be renamed, re-illustrated or hidden (and restored); **+ New affinity** creates your own from a template:
  - *Pulse* (playing one fires the chain), *Gauge* (a pool cards fill and spend), *Status* (Mire-like Attack loss), *Ebb* (back to hand, bonuses kept), *Foundation* (lasting bonus under a slot), *Bonus* (they gain stats at the start of combat).
  - All texts, tooltips, table slots and the gauge follow your names, pictures and colours. With several gauges or statuses, effects pick which one they use.
- **Custom keywords** (*+ New keyword*): a name, colour, picture, tooltip and any effects. Tick it on minions (it shows in their text and tooltip), filter on it, check it, give or remove it with effects. Golden doubles its effects; Magnetic passes it on.
- Affinities and keywords travel with the meta (shared metas, online games, building together).
# v48 — Coral: Pulse

- **Coral's mechanic is now Pulse** (it replaces Colony). With 3 Corals on the board, playing a Coral fires its Pulse effect and those of the Corals right next to it. With 5, the Pulse runs through the whole chain of connected Corals. It runs from left to right, each minion once per Pulse; a non-Coral minion stops it. Placement matters.
- New trigger **Pulse** and new effect **Your next Pulse effects trigger twice**. "Every N Pulses" works with the usual *Every N times* option.
- The Coral cards were rebuilt around it: Coral Bud (+1/+1 to a friend), Gilded Polyp (+1 gold, once a turn), Catalyst Coral (charges Evolutions), Reef Echo (doubles the next Pulse), Nurturing Polyp (+1/+1 to your other Corals), Reef Mother (every 3 Pulses: a Coral Sprout in hand), Reef Warden (+2/+2 to its neighbours). Coral Sprout is a token.
- On the board: awake Corals glow and adjacent ones are linked; a Pulse runs along the links as a wave. Five Pulse quick starts in the card editor.
# v47 — Pressure gauge

- The **steam ring** is now Steam's **Pressure gauge**: it fills up with glowing steam as Pressure builds (current / max in the middle, bubbles, a glow when full, greyed while Steam is not active yet). Players see it as soon as they have a Steam minion; hover it for the details. It is an element of the Table workshop (move, resize, hide).
- The two **affinity slots** both use the **shell frame** (or no frame).
# v46 — Affinities

- **Five elemental affinities**, on top of tribes: Coral, Steam, Tar, Water, Earth. A minion carries up to two. Each affinity's mechanic wakes up at **level 1 (3 minions)** and grows at **level 2 (5 minions)**. Thresholds and values are set per meta in the card editor (*Tribes & affinities*).
  - **Coral — Colony:** adjacent Corals link into a Colony; "your Colony" effects reach all of it. Level 2: the minions right next to a Colony join it. Colonies glow and show their links on the board.
  - **Steam — Pressure:** a shared tank (max 5, then 10). Cards gain Pressure; any effect can cost Pressure ("spend 3 Pressure to…"), or spend it all and repeat per cost.
  - **Tar — Mire:** Mire effects work at level 1: the enemy loses 2 Attack for the fight (4 at level 2) and is marked Mired. New triggers: *Whenever this is attacked*, *After a Mired enemy minion dies*.
  - **Water — Ebb:** drag a Water minion from your warband to your hand, bonuses kept; play it again for its Battlecry. Once a turn (twice at level 2). New trigger: *After one of your minions Ebbs*.
  - **Earth — Foundation:** at the end of your turn a Foundation is built under one of your Earth minions (1 per slot, 3 at level 2). It stays on the slot, whoever stands there. New effect *Build a Foundation*, trigger *After you build a Foundation*, scaling *× Foundations under this minion*, target *your minions standing on Foundations*.
- **Affinity slots on the table:** two slots (steam ring and shell frame) show your two strongest affinities, their count, level pips and the mechanic's state (Pressure, Ebbs left, Foundations, Mire…); hover for the details. Both are elements of the Table workshop: move, resize, hide, and pick the frame (steam ring, shell, or none).
- Affinity icons on minions and cards, explained in their tooltips.
- **Editor:** affinity chips on minions (max 2), affinity filter on targets, *Pressure cost* in More options, new targets *Your Colony* and *Minions on Foundations*, new scalings.
- **Content:** 17 new neutral minions built on the mechanics (Nurturing Polyp, Unstable Boiler, Sticky Slug, Bitumen Devourer, Cascade Spirit, Ancestral Monolith, Telluric Architect…), and the built-in minions received thematic affinities (Constructs mostly Steam, Infernals Tar, Tidekin Coral/Water, Beasts Earth…). All editable in the card editor.
- Affinity settings travel with the meta (online games, shared metas, building together).
# v45 — The friend plays on your meta, with your look

- In a game with a friend, the guest already played with the host's cards, but still saw **their own** pictures, card frames, tokens, End Turn button, table, bartender and table design. Now the guest's own look is put aside for the game: the host's pictures arrive card by card, and the host's skins and table design are shown as soon as the host's meta has arrived. Nothing is saved on the guest's side.
- At the end of the game (or when starting a new one), the guest gets their own meta and look back.
# v44 — Playing with a friend over the internet, fixed

- **The connection died right after the deal.** PeerJS (the WebRTC link between the two browsers) refuses any single message of 16 KB or more, and closes the connection when it gets one. The host's meta, pictures, and even the game setup with custom cards were bigger than that: the link dropped at once, each browser went on alone (a bot took over the friend), and the pictures never arrived. Every message is now cut into small slices and put back together on the other side.
- **Pictures first, gently.** The host's pictures are sent one card at a time (they appear on the friend's cards as they arrive), then the rest of the meta, waiting for the connection to drain between pieces so the game's own messages never queue behind them.
- **Turn boundary.** When one player finished watching the fight first and started the next turn, the other browser threw those early actions away: the two games drifted apart. Messages from a turn ahead are now kept and played once this browser reaches that turn.
- If the connection is lost anyway, a banner says so clearly (a bot then plays the friend's warband).
- Tested with two real browsers over WebRTC: 12 heavy pictures arrive in about 3 s, games stay in sync turn after turn.
# v43 — Movable duo portal

- The **duo portal** (send a card to your partner) is now an element of the Table workshop: move it and resize it like the rest. It shows in the workshop even when you are not in a duo, and goes away again when you close it.
- In a duo game the portal sits where you put it, and dropping a card on it follows its new place.
# v42 — Movable sell zone, richer Discover

- **Sell zone in the Table workshop.** The zone where you drop a minion to sell it is now a table element like the others: move it, stretch its width and height freely (corner or numbers). The drag uses exactly that zone (never over your warband), so a rearranged table sells where you see it. It is shown striped in the workshop.
- **Fix:** after typing a number in the workshop, the first click on *Save* could be lost (the header was rebuilt as the field lost focus).
- **Discover, new options** (card editor → *Discover a minion*):
  - *From*: your tier, **one tier lower**, one tier higher, **your tier or lower**, **a precise tier (1–6)**, a random tier, tier 6, **any tier**.
  - *Tribe*: any, a given tribe, **your most common tribe**, **a random tribe of the game**.
  - **Keyword**: only minions with Taunt, Shield, Reborn…
  - **Choices**: 2 to 5 cards offered.
  - **How many times**: 1 to 3 Discovers in a row (the window says how many are left).
  - **The pick is golden**.
  - Filters loosen on their own when nothing fits (keyword at a lower tier, then any tier of the tribe…).
- Discovers now **queue**: a second Discover (another battlecry, the golden reward…) waits for the first instead of replacing it. A golden card with a Discover discovers twice.
# v41 — Saved tables, offered to players

- **Fix: golden fusion.** The flying copies and the big golden card kept the hand's shrink only on their outline, so the illustration spilled out of the frame. They are now scaled as a whole: the card stays intact from start to finish.
- **Several tables per meta.** The Table workshop has a *Tables* section: pick the table you edit, name it, *Save*, *Save as a new table* (a copy), *Delete this table*, or start a *New empty table*. Unsaved changes must be saved before switching.
- **Offered to players ★.** Tick *Offered to players* and save: the table appears in the players' Collection. Unticked tables stay drafts, visible only in the workshop. The very first table is offered by default.
- **Boards in the Collection.** A new *Boards* row lists the *Classic table* and every offered table; the player's choice applies right away, is remembered, and the *Table decor* below shows the placeholders of the chosen board. Collection objects are shared by all tables.
- Tables travel with the meta (shared metas, copies). A design saved with v39/v40 becomes "Table 1", offered.
# v40 — Player mode, admin mode, table decor, golden fusion

- **Two menus.** The main menu is now the player's: Battlegrounds / Expedition, Solo / Duo, Play with a friend, Collection, How to play, language. **Admin mode** (code required) adds a *Creation* panel with every tool: Card editor, Skins, PvE editor, Table workshop, Build cards together. *Player mode* puts it away again; the choice is remembered.
- **Table placeholders.** In the Table workshop, admins add *placeholders* (position, size, rotation, front/back layer) and upload *collection objects* (with idle motion, click reaction, particles and sound like the other sprites). Placeholders are invisible in game unless something is placed on them.
- **Table decor in the Collection.** For each placeholder the player picks an object (or Empty); it appears on the table right away and stays after reload. *See the table* previews it, *Back to the Collection* returns. (Which objects a player owns will come later; for now all are available.)
- **Golden fusion.** On a triple the three copies fly together into a fan, spin and melt into one in a flash; the golden card pops out large with a shine, then drops into the hand (or the board). About 1.6 s.
# v39 — Table workshop
- Move, resize and hide table elements; add clickable 2D sprites (idle motion, reaction, particles, sound). Drop zones follow the moved layout.
# v38 — Expedition: cards, loot and fair bosses
- Events, doors and loot shown as cards; loot after every win; wounds only after a loss; boss Retreat door and softening; duo: a random player decides each step, shared events.
# v37 — Expedition mode
- Solo, duo with a bot or online; adaptive balance; PvE editor.
# v36 — Readability pass
- Shorter Evolve texts, tooltips without panel, the hand peeks from the bottom and rises on hover, hero lowered.
# v35 — Evolution crystal
- Charges, mutates into random forms, fills progressively; hover to see the charge.
# v34 — Procedural spell looks
# v33 — Smooth painted effects

- Each painted effect now has 41 frames instead of 6: the 6 painted keys plus 7 in-betweens per gap, computed with optical flow (the art is morphed from one key to the next, not just cross-faded). Stored as WebP grids (~3.4 MB for all 12).
- Playback blends neighbouring frames, eases the timing (quick burst, slow settle), adds a gentle swell and a soft fade, so the motion stays fluid at any frame rate. Projectiles grow or loop smoothly along their path with a light glow.
# v32 — Attack looks painted from your effect sheet

- All the procedural attack looks are gone except **Arrow** and **Meat**. The new looks are built from the 12-effect sheet, cut into 6-frame strips in `ui-art/fx/`:
  Fireball (flies, grows, explodes) · Lightning (a spark that lands and bursts into a ring) · Ice spikes · Splash · Shadow ooze (an orb that splatters) · Poison gas · Wild growth (the mushroom) · Holy light · Void vortex · Tornado (travels, then spins on the target) · Dust cloud.
- Ground effects (ice, splash, ooze, gas, growth, holy light, tornado, dust, fire burst) rise from the table under the target; the others play on it.
- Cards using an old look keep working: Healing light → Wild growth, Boulder / Claw slash → Dust cloud, Thorns → Wild growth, Blood → Shadow ooze, Meteor → Fireball, Prism → Holy light. The editor shows them as their new look.
- Table moments (plain melee hits, deaths, shields, summons, keyword gains) are unchanged.
# v31 — You choose the target

## v39 — Table workshop
- New in the main menu: Table workshop. Works on the live table, saved in the meta (and shared with it).
- Move any table element by dragging its outline, resize it by its corner (or type X / Y / size): players panel, bartender, Upgrade / Refresh / Freeze, tavern row, warband, your hero, hero power, gold, hand, End Turn, enemy hero, rank and sound chips (some can be hidden). Arrow keys nudge (Shift: 10 px), Ctrl+Z undoes, "Snap" rounds to 5 px.
- 2D sprites: add PNG / WebP / GIF pictures and place them anywhere (move, resize, rotate, mirror, opacity, behind the minions or in front of the table, order).
- Sprites come alive: an idle motion (float, bob, sway, hang, breathe, flicker, glow, slow turn) and a reaction when clicked (bounce, jump, shake, swing, squash, jelly wobble, spin, flip, pulse, light up), with particles (sparkles, magic dust, smoke, leaves, petals, coins, hearts, bubbles, flames, stars, notes, snow), a sound, strength and speed. "Try the clicks" lets you play with them before saving; in a game every player can click them.
- Drag and drop now measures the zones where they are, so a rearranged table plays normally.

## v38 — Expedition rework
- Events, doors, loot, treasure and camps are cards now (the same frame as minions, your card skin included). An event shows its own card, then one card per choice.
- Gold no longer comes on its own: you start with 10, then earn it from loot, events and treasure. Upgrades get 1 gold cheaper per tavern visit (not per step).
- Loot after every fight won: pick 1 of 3 — a minion (shown as its card), a tavern spell, gold, a mutation, stats or a keyword for the minion you choose, Evolution charges, a potion, bandages... Elites and bosses always offer a relic.
- Wounds only after a lost fight (winning patches everyone up), and a wound never takes Attack below 1.
- Bosses are no longer a wall: each loss weakens the boss and makes the balance more forgiving, and after a loss you can Retreat — back to a tavern 3 steps earlier to grow, the boss waits (2 retreats per boss). Fights are never hopeless either: the enemy steps down below a minimum win chance (40% fights, 30% elites, 25% bosses).
- Duo: each step a random player decides what comes next (announced with 🎲); events are decided by that player for both warbands (the partner gets the result at the start of the next step; shared Health is only counted once). Loot, treasure and camps stay personal.
- PvE editor: loot table, boss softening and retreats, minimum win chances.

## v37 — Expedition (PvE roguelike)
- New game: Expedition, solo or duo (with a bot partner, or a friend online: "Play with a friend" → "Expedition together").
- The table never changes: between steps the top row turns over to show 2–3 doors (Fight, Elite, Tavern, Event, Treasure, Camp, and the Boss at the end), then what's behind the one you open: an enemy warband to scout before you press Fight!, the tavern, or choice cards.
- Your warband must last: gold builds up step after step (income + rewards), Expedition Health only heals at camps and in events, minions that die in a fight come back wounded (-1/-1), and at 3 wounds they are gone for good. Drag a minion down to your hand to rest it (it comes back later without its Battlecry); a whole step there heals one wound.
- Adaptive balance: before every fight the game simulates it against your warband and tunes the enemy toward a target win chance (75% fights, 55% elites, 45% bosses). A strong warband is only partly followed (a highroll stays rewarded, and pays extra "threat" gold); a weak one gets a little mercy.
- Elites have a rule; bosses have two waves and a Nemesis rule picked to counter your warband (shields, Reborn, Deathrattles, one big carry, wide boards...). Lose to a boss and it waits for you.
- 16 relics (kept all run), 12 events, 3 bosses, camps (rest, train, tend wounds, meditate), treasure, elite spoils.
- Duo: shared Health, your two warbands fight one after the other against two enemy waves, and you take turns picking doors. Each player keeps their own relics and choices.
- PvE editor (main menu): rules, economy, doors, adaptive balance with a bot balance tester; events (texts, choices, requirements, effects, random outcomes); bosses (waves, fixed rules, Nemesis pool, mirror); relics (effects + expedition bonuses). Saved per meta and shared with it.
- New effect for cards: "Give a mutation to another minion".

## v36 — Table polish
- Card texts fit: Evolve texts are much shorter ("Evolve (4): Becomes X. Charge: when it dies."); what a new form keeps is explained in the crystal's tooltip instead.
- Hovering a token: only the big card and its keyword notes, no panel around them (the notes have their own dark boxes).
- Hand: cards peek out of the bottom edge; hovering one makes it rise and show itself whole, with only its keyword notes beside it.
- Your hero sits a little lower and smaller, so the warband's Evolution crystals stay visible.

## v35 — Evolution crystal
- New Evolve: no more Attack/Health thresholds. A minion with an Evolve effect wears your Evolution crystal (bottom of the token and card). It fills from the bottom, charge by charge, and glows when ready.
- Hover the crystal: charge (e.g. 1 / 3), what charges it, what happens when it's full, how many times it evolved and its mutations. The big card tooltip shows the same block.
- What charges it: any event — at the end of turn, after you Devour (optionally a given tribe), when it kills, after each combat, each activation, when you play a minion… plus the new effect “Charge Evolution” (e.g. Battlecry: charge your other minions by 1). Combat charges land after the fight. Golden minions charge twice as fast.
- Repeatable: “Can evolve again”, optionally needing N more charges each time.
- When full, choose: fixed forms (as before), random minions (1 of N, its tribe or any, its tier or 1–2 tiers higher), or Mutations.
- Mutations: the same minion gets a bonus the player picks — stats, a keyword and/or an extra effect. Design your own in the editor, take some from a built-in list (Shell, Fangs, Wings, Phoenix heart, Brood, Instinct…), or offer N random ones. Mutations stack and stay through evolving and tripling.
- The old stat-threshold Evolve still works on existing cards but is no longer offered in the editor.

## v34 — Smooth spells
- All painted sprite sheets are gone (the 6-frame / interpolated looks). Every spell is now drawn live, every frame, with smooth easing — no flipbooks.
- Fireball: a comet with a fiery ribbon, a popping core, flame petals, rising embers and a ground ring.
- Lightning: a bolt and a fast spark, then a crackling orb whose arcs flicker, sparks and twinkling stars.
- Ice spikes: a spinning crystal leaves snowflakes; spikes spring up in a fan, then shatter into bouncing shards.
- Splash: a wobbly water blob with drips; a splash column, a crown of droplets and ripples.
- Shadow ooze: a little ink creature; an ink splat with blinking eyes, drips and purple wisps.
- Poison gas: a lobbed green glob; a bubbling puddle with popping bubbles and toxic puffs.
- Wild growth: a leaf swirl; vines curl up, leaves fly and flowers pop open.
- Holy light: a soft beam from above, a halo springing in, twinkling stars and rising motes.
- Void vortex: a dark orb with orbiting motes; everything spirals in, then pops.
- Tornado: wind gusts; a swaying twister with orbiting leaves.
- Dust cloud: puffy cartoon dust and bouncing pebbles.
- Arrow and Meat unchanged. The download is ~3.4 MB lighter.

## Picks
- New targets for any tavern-side effect: **another friendly minion you choose**, **one of your minions you choose (this one included)**, **a tavern minion you choose**, **a minion in your hand you choose** (the last two for effects that change a minion in place: stats, keywords, tribe, copies…).
- Devour gains **a friendly / tavern / hand minion you choose** as its meal.
- How it plays: when the effect fires (Battlecry, Activate, after a buy, after a Devour…), the candidates light up on the table with a green bar "Choose a target · <effect>"; click one, or Skip. Several picks queue up. At end of turn, or for bots, the best candidate is taken automatically (weakest for hurtful effects, strongest otherwise). In combat the choice is random. Works online.
- Tribe and keyword filters narrow the candidates ("a friendly Beast you choose").
- Four quick starts.

## Fixed (found by the fuzzer)
- A golden formed from copies whose stats had been swapped or lowered could end up with negative Attack.
# v30 — "Next…" effects, more Devour, more targets

## New effects
- **Next…** group: your next tavern spell(s) are cast twice · your next Battlecry(ies) trigger twice · the next minion(s) you buy get +X/+Y · the next minion(s) you play get +X/+Y · your next sale(s) give extra gold (with the existing free buys / free refreshes / gold next turn / cheaper upgrade).
- **Devour**: Devour **from your hand** (full stats) · *Add a copy of the last minion this Devoured to your hand* · aura *Devouring gives gold* · "After you Devour" can now be filtered by the tribe of what was eaten ("After you Devour a Beast, …").
- **Gain the keywords of other minions** (e.g. of adjacent minions).

## New targets
- Your minions of your **most common tribe** · the minion you played **most recently** · the one you played **longest ago**.

## Fixed
- A triple formed on the board with a full hand overflowed the hand; the golden minion now lands on the board instead.
- Tavern / hand targets are now only used by effects that change a minion in place (stats, keywords, tribe, silence, copies); effects that move or remove minions stay on the board.
# v29 — Painted tables

- On a painted table the "Your warband" box (dark panel, dashed inset, label) is no longer drawn over the picture: the painting defines the areas. Drop highlights (green / sell) still show while dragging.
# v28 — Table layout v2 (Battlegrounds-style)

- The bartender (the enemy hero during combat) now sits at the top centre, the same size and in the same spot as your hero at the bottom centre; the two minion rows are centred between them, on x = 770.
- Upgrade / Refresh / Freeze moved to a column on the left of the rows, next to the players panel.
- Hand under your hero, gold at the bottom left, timer and End Turn at the bottom right.
- The table template (Skins → Tables → Download table template) reflects the new layout with every position written on it.
# v27 — Many more building blocks for effects

## Targets (every effect that aims at minions)
- **All your minions (this one included)** and **random friendly minions (this one included)** — next to the "other" versions.
- The minion **to the left / to the right** of this one; your other minions **sharing a tribe** with this one; your **weakest / strongest** other minion.
- In combat: the **weakest / strongest enemy**, the enemy's **leftmost** (next attacker) and **rightmost** minion, **every minion on both sides**.
- In the tavern: **the minions in the tavern** (all / random) and **in your hand** (all / random).
- A **keyword filter** next to the tribe filter: "your other minions with Taunt only", etc.

## Conditions and scaling
- "Only if this has <keyword>", "Needs N+ minions on your board".
- Scaling "× this minion's Attack / Health": "deal damage equal to its Attack", "+1/+1 for each Health it has"…

## New effect and trigger
- **Gain the Attack / Health of other minions** (absorb, e.g. of adjacent minions, of your Beasts…), in the tavern and in combat.
- **Whenever this gains stats** trigger (tavern and combat; chained reactions limited to avoid loops).
- Discover can be limited to a **tribe**.
- Eight new quick starts showing these off.
# v26 — Evolve with a choice, new main menu, editor polish

## Evolve: the player chooses the next form
- In the Evolve effect, "+ Add a choice": two or more next forms. When the Evolve fires, a Discover-like screen shows the forms as full cards and the player picks one (it keeps what it gained). Unpicked at end of turn → the first one; bots take the strongest. Works online (the choice is sent like any other action).
- Card text: "Evolve (6 Attack): this becomes X or Y (your choice; keeps what it gained)." Quick start "Evolve (6 Attack): the player chooses between two forms".

## Main menu
- A proper title screen: gold title with ornaments, embers, two panels — Next game (mode, rules, pace, options, tribes of the lobby, big golden "Open the tavern") and your record (rank ring, MMR to the next rank, record line, last placements, current meta) — and five icon tiles (friend, Collection, editor, how to play, language). Version shown bottom right. Rank names translated.

## Card editor
- Gold title with an "Workshop" eyebrow, short note with a "?" for the long one, meta tabs as chips, section stepper 1 · 2 · 3 above the form, search field with an icon, warmer panels and list rows, golden Save button.
# v25 — Building cards together

## "Play with a friend" → "Build cards together"
- The room now has a purpose: **Play a game** or **Build cards together**. In the second, the host's whole meta is copied to the friend (as "<Meta> · <Host>"), then both open the card editor on it with a green "Workshop with X" badge.
- Every save on either side crosses over and is applied on the other: cards (with pictures), deletions, tribes, heroes, anomalies, skins (added, changed, deleted, equipped). A toast says who saved what.
- The card you have open refreshes when your friend saves it — unless you have unsaved changes on it: then you keep yours and get a warning (last save wins; reopen it from the list to see theirs).
- Closing the editor or losing the link ends the session; each of you keeps their copy.
- Same-computer mode: each window now keeps its own meta selection (a store reload no longer follows the other window's choice).
# v24 — Sharing a meta with your friend

## Playing together
- **Version check** in the lobby: both browsers must run the same zip (the game is computed on both sides in parallel). If the versions differ, both players get a clear message instead of a game that drifts apart. The version shows as v24 from now on and is bumped with every release.
- The host's **whole meta** now follows the deal: cards, tribes, heroes, anomalies **and their pictures and equipped skins**, streamed in slices right after the game starts. The guest sees the host's custom cards with their pictures.
- **Keep the meta**: once it has arrived, the guest gets a 💾 button at the top right (and on the end-of-game screen). One click installs the host's meta as "<Meta> · <Host>" in the meta list, pictures and skins included. Keeping it again later updates that same meta instead of adding another.
- After a game as guest, the browser goes back to its own meta (it used to keep the host's card set until a reload).
# v23 — Evolve and Work as effects, big card on hover

## Evolve is now an effect like any other
- Trigger **Evolve: when this reaches N Attack / Health** (group "Growth"): pick what it watches — Attack, Health, or either — and the threshold. Checked whenever its stats change, in the tavern or after a fight; fires once per minion.
- Action **Evolve: this becomes another minion** (group "Minions"): pick the next form. It keeps what it gained, its keywords, Empower and food; golden stays golden.
- The two combine freely: "Evolve (8 Health): becomes X", or "Evolve (6 Attack): give your other minions +2/+2", or "Deathrattle: evolve"… The old card-level Evolve fields are gone; cards made with them are read as the new effect automatically.

## Work (N)
- Trigger **Work: after this has been activated N times** (group "On demand", next to Activate): the Nth activation fires it, once. Pair it with Evolve, a buff, a Discover… The token badge counts (⚒ 1/3) and the card text counts down.
- The old "Activate every N activations" stays available as a plain Activate with "Every N activations".

## Hover a token: the whole card
- Hovering a minion on your board or in the tavern shows its full card, big, with the keyword explanations, tribe blurb, Evolve / Activate / Work details beside it (Hearthstone style). Hand cards keep the text tooltip.

# v22 — Card workshop (layers)

## Skins → open a card / token / button skin: the workshop
- The skin is shown as layers on a live mock-up: Illustration · Frame · Name plate · Text panel · Tribe line · Tier stars · Attack / Health / Tier gems (tokens: Portrait · Frame · Stars · gems; button: Frame · Label box).
- Drag a layer to move it, pull its corner handle to resize (gems: diameter), arrow keys nudge by 1 px (Shift: 10). The layer list on the side selects, and the eye hides a layer in the workshop only.
- "Illustration behind the frame": the picture is drawn under the frame, through its transparent window — the frame's edge now overlaps the art instead of the art sitting on top. Detected automatically when a frame with a see-through window is uploaded (also once for skins made before this version); can be toggled.
- The numeric fields are still there, collapsed under "Numbers", and stay in sync both ways.

## Fixed
- In the skin detail panel the variant thumbnails (Minions / Golden / Spells) picked up the game's card styles and overflowed onto the text below.

# v21 — Skins library + Collection

## Editor: one "Skins" tab (replaces Table + Bartender)
- Every painted asset now lives once in a library shared by all metas: Tables, Cards, Tokens, End Turn button, Bartenders.
- Each meta *equips* one skin per kind (✓ on the tile). A frame painted once can dress several metas.
- Tiles: Built-in · your skins (rename inline, Equip / Back to built-in, ✕ twice to delete) · Add.
  Cards/tokens/button keep the variant uploads (golden, spell) and the zone layout editor; tables keep the dim slider and zone guide; bartenders keep the circle crop.
- Clicking a skin previews it on the right without equipping it.
- Old saves migrate automatically: per-meta backgrounds, card/token/button skins and bartender skins become library entries, equipped where they were.

## Main menu: Collection
- New "Collection" button: every kind in a row, Built-in + library tiles (+ Random for bartenders), equipped tile highlighted for the active meta. One click equips and applies right away.

## Fixed
- French strings for everything above.


# v3 — looks and sound

## Frames and portraits
- Hero, enemy hero and bartender frames are drawn at their true proportions (they were being stretched) and ~10% smaller.
- Each portrait is sized to the measured hole of its frame PNG, so no dark gap or overlap shows; the bartender frame no longer clips at the top of the table.

## Effects (fxengine.js, ui.js)
- Melee attacks: motion trail on the lunge and a directional spark burst with a dust puff on impact.
- Shield pops: golden glass shards and a flash. Dodge: "Miss!" with a sidestep. Tough: stone chips.
- Deaths: dark smoke, falling ash and a few rising wisps instead of a flat particle burst.
- Buffs: a rising sparkle column in the buff's colour, in the tavern and in combat.
- Summons / Reborn / Stolen / Resurrected: a light pillar in a colour per kind.
- Hero damage: red screen flash, double shockwave, debris; harder shake on 10+ damage.
- Fixed: a negative frame delta at skip speed could crash the canvas loop (ellipse with negative radius).

## Sound (ui.js)
- New synth engine: compressor on the master, a tavern-room echo bus, real attack/release envelopes, pitch sweeps and FM bells.
- Every effect re-voiced (coins, hits, shields, deaths, summons, fanfares, lightning, fire, frost, heal, poison, holy, shadow, arrow, water, boulder, slash, triple) plus new ones for Miss and Tough. Slight random pitch variation so repeats don't sound mechanical.

# v4 — play feel and APM

- Right-click fast lane: tavern minion/spell → buy, hand card → play (spells cast), warband minion → sell. Long-press on touch is ignored.
- Keyboard: 1–7 buy that tavern slot (or pick choice N in Discover / hero / tribe dialogs), R refresh, F freeze, U upgrade, H hero power, Space or Enter ends the turn, Esc cancels a drag or aim.
- Adaptive "snappy" mode: when actions come faster than ~0.7 s apart, slide/flip animations run at 45% length, tooltips wait longer and the bartender stops quipping.
- Drag starts after 4 px instead of 6; refused drops snap back faster; warband minions slide aside quicker while dragging; cards and tokens no longer trigger text selection or touch scrolling.
- Every tavern action no longer serialises the whole table's HTML (with picture data URLs) — a large hidden per-click cost, most noticeable on phones.
- The intro lists the shortcuts.

# v5 — the Forge and "Fight!"

- **✦ Forge** (card editor): deals three random, coherent drafts — minion, spell, hero or anomaly — with a name, stats inside the tier's budget, a keyword or two and 1–2 effects around a theme (summons, buffs, damage, gold, keywords, deathrattles, chaos, tribe synergy). Filter by tribe and tier, reroll, pick one to edit, or keep all three.
- **⚔ Fight!** (card editor): puts the card you're editing into a random warband of its tier and plays a real fight on the table, with the full animations and sound; spells are cast first so you see what they did. Back to the editor afterwards.

# v6 — Devour toolkit and option audit

## Devour
- Trigger **When this is Devoured** (fires on the meal; "the eater" is the trigger target): reward the eater, punish your hero, add a copy of the meal to your hand…
- **Devour** can now eat **a friendly minion** (full stats) as well as a tavern minion; the friend's "When this is Devoured" fires.
- **Devour an enemy in combat**: destroys it outright (through Shield) and the eater gains half or all of its stats.
- Auras: **Devouring gives extra stats**, **Devoured minions pass on their keywords**.
- Condition **If this has Devoured something**; scaling **× each minion you Devoured this game**, **× each minion this has Devoured**, **× each gold you have**.
- Hero/anomaly rule: **Devouring gives full stats**. "After you Devour" now targets the eater.
- The Forge has a "Devour and hunger" theme; 20+ new starting points.

## Audit
- "Move to the front/back" renamed to **leftmost / rightmost spot**, with help explaining why order matters (leftmost attacks and dies first; Deathrattle tokens appear where the minion stood).
- "Trigger its Battlecry again" is only offered on triggers that have a played minion to repeat (it did nothing elsewhere).
- "The minion that triggered it" is now offered for Discover, enemy summons and Devour triggers.
- New: **Make a minion in your hand golden**, **Frozen tavern minions grow each turn** (aura).

# v7 — multi-tribe minions and a lighter content pipeline

## Multi-tribe
- A minion can have several tribes ("Beast / Dragon") or be **All tribes**. It counts as each of them for every buff, filter, condition and scaling, appears in lobbies that have any of its tribes, and the first tribe gives the card its colour.
- Editor: tribe chips gained an "Also a…" row and an "All tribes" switch; the card and tooltip show every tribe; the Forge deals the occasional dual-tribe or All card. Deleting a tribe keeps a card's other tribes.
- Bots understand it (they value a card by its best-fitting tribe).

## Smoothness with lots of content
- Pictures are stored as binary Blobs and used through object URLs instead of base64 strings: roughly a quarter less storage, no base64 copies in memory or in the DOM, and the browser decodes them on demand. Existing saves are converted silently the first time they load. Exports still carry portable data URLs.
- Card images decode off the main thread and thumbnails load lazily; the editor search is debounced.

# v8 — play with a friend

- **Play with a friend** (main menu): one player hosts and gets a 5-character room code, the other joins. You form one duo against three bot duos, each on your own screen. The connection is direct between the two browsers (WebRTC; PeerJS's free public broker is only used to find each other), so there is no server to run. A "same computer, two windows" option works offline.
- How it stays in sync: both browsers deal the very same game (same seed, the host's card set) and exchange only actions. Each player shops with their own random stream and a private view of the tavern pool, cards sent through the portal wait in an inbox and enter the hand as the receiver's own next action, and the fight starts once both players said "End turn". A fingerprint is compared every turn; if a friend disconnects, a bot takes over their warband.
- Engine: two human seats, per-player ids and random streams during actions, `Game.fingerprint()`; `Minion.preview()` for dialogs. Existing single-player games are unaffected in rules (the random stream per player means results for a given seed differ from v7).

# v9 — clean main menu
- The menu is just the title, rank, the lobby's tribes, the mode switches, the timer and the buttons. The rules and shortcuts moved to a **How to play** screen.

# v10 — portraits, cards, quieter sounds
- Hero, enemy hero and bartender rings are ~35% smaller than before and the portraits now overlap the ring's soft inner edge, so no dark gap shows. (A late CSS block had been overriding the frame sizes; it is now the single place that sets them.)
- Cards restyled to match the painted frames: bronze double border, gold name ribbon with a tribe-coloured underline, warm text panel, tribe name in small caps (no icon).
- Sounds: overall volume and echo reduced; hits, deaths, buffs, coins and refreshes are softer; the win/loss fanfares are gone — a soft two-note "back to the tavern" cue plays instead (slightly brighter after a win), and the game-over screen uses the same cue.

# v11 — paint your own card skin
- Editor → Table → **Card skin**: upload a PNG frame for minion cards (plus optional golden and spell variants). It is drawn under the picture window, the name, the text, the tribe line and the stat gems. "Download card template" gives a 560 × 848 PNG with every zone marked; the same file ships as `ui-art/card-template.png`.
