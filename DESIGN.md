# Magic: The Dungeon Gathering — Design document

Working title. A dungeon-crawling web app built on Magic cards, to play with friends. Fan project, non-commercial.

This document is the source of truth for the design. Every rule is tagged:

- **[DECIDED]** set by the game's author. Don't change it without asking them.
- **[PROPOSED]** a suggestion not confirmed yet. It can be implemented as a default, but it has to be easy to change.
- **[PENDING]** not defined. Ask before implementing.

---

## 1. How it's played

It's a board game with screens to help. The app is not a video game that runs the rules.

- [DECIDED] Each player keeps their phone open on the **Player Card**. It's their character sheet.
- [DECIDED] A tablet, laptop or TV has the **Game** part open, where everyone can see it.
- [DECIDED] The devices don't talk to each other. No websockets, no server, no syncing of any kind.
- [DECIDED] Players keep track of their character's state by hand on their phone: the damage they take, their upgrades, etc.
- [DECIDED] The players apply the rules at the table. The app doesn't resolve combat or interpret card text.
- [DECIDED] **Game** only shows the room, the monsters and how many rooms have been played.
- [DECIDED] No LLM is used, neither in the app nor to prepare the data.

What this means for the code: the app only works out what is tedious to do by hand (opening a booster, adding up what was absorbed, generating a room). Every number on the character sheet must be correctable by hand, because the player has the last word.

## 2. Concept

- [DECIDED] Each player is a card. They start as a Human creature, cost 0, colorless, 1/1.
- [DECIDED] The player opens 3-card boosters, keeps one card and "absorbs" its characteristics. Example: absorbing a blue 0/5 turtle makes them blue, a turtle, and gives them +0/+5.
- [DECIDED] The players advance through the rooms of a dungeon, fighting other Magic cards.
- [DECIDED] It's played with friends, each one a card. It has to adapt to the number of players.

## 3. Combat (table rules)

The players apply these rules. The app doesn't run them; at most it offers counters to keep track.

- [DECIDED] Turn-based, classic RPG style: enemies attack on their turn and the player on theirs.
- [DECIDED] Each turn the player generates mana of one of their colors. Enemies generate mana too.
- [DECIDED] Absorbed instants and sorceries make up the player's spell list, which they can cast on their turn.
- [DECIDED] Each spell on the list can be cast once per combat: after it's cast it "goes to the graveyard", and it comes back when combat is over.
- [DECIDED] The player's life is their toughness; their starting life ("starting life total") is the toughness they have when combat starts.
- [PROPOSED] Power = damage per attack. Toughness = maximum life. Damage lasts for the whole combat and the player heals when moving to another room.
- [DECIDED] **Turn order:** whenever a combat starts, players and enemies roll a d20 to set the order of turns. Creatures with Flash act first, but only on the first turn of combat (they still roll for their place in the order). Creatures with Haste go first; if several have Haste, they roll too, and they go first in that order, then everyone else.
  - [PENDING] Whether the app helps with the roll (for example on the Game screen) or it's done with real dice at the table.
- [PROPOSED] On their turn, a player attacks or casts spells. (This replaces the proposed round order "first all the players, then all the enemies".)
- [DECIDED] Mana isn't lost between rounds: it builds up, and it's lost when combat ends.
- [PROPOSED] Mana: 1 per turn, of a color the player chooses among theirs. While colorless, the player generates colorless mana, which only pays generic costs.
- [PROPOSED] Death: the player is out until the room is over. If everyone falls, the game is over.
- [DECIDED] **Formation:** players have a formation, and so do enemies (who is in front, who is behind). Trample uses it. How it works is for later.
  - [PENDING] How the formation is set and shown (on the Game screen, at the table).
- [PENDING] Mana curve. At 1 per turn, a cost-6 spell takes 6 turns. Alternative: a land-like curve (turn 1 gives 1, turn 2 gives 2...) without building up.
- [PENDING] What enemies spend their mana on (do they have spells of their own?).
- [PENDING] What "this turn" and "until end of turn" mean in general (the player's turn or the round?). For now it's decided card by card.

## 4. Progression

- [DECIDED] Only the player who defeats the monster gets the XP.
- [DECIDED] On leveling up, the player opens a booster.
- [DECIDED] **Experience:** players start at level 1. Leveling up takes their level × 3 XP: 3 to reach level 2, 6 more to reach level 3, and so on. The player keeps track of XP on the Player Card, with − and + buttons in "Status" (section 10). The rules are in `js/player/level.js`.
  - Chosen while implementing, not confirmed: XP left over counts toward the next level, and a big gain can level up more than once (each new level earns its booster). − corrects a mistake: it never goes below 0 or takes a level away.
- [DECIDED] **Level boosters:** every even level opens a booster of spells from `akashicos_spells.txt` of the player's colors (every color of the spell has to be one of theirs); every odd level, a booster of creatures from `akashicos.txt`. Boosters only come from leveling up: the free "Open a booster" button (from `level1.txt`) is gone.
  - Chosen while implementing, not confirmed: the booster opens by itself on leveling up; closed, it waits under the card ("Open your level N booster"), and several wait in order. While a new card is still spending its starting points, boosters wait until it's done. A booster with nothing left to deal is used up, with a message. A creature with {X} from a booster picks X freely, since no points are spent.
- [DECIDED] Each booster has 3 cards.
- [DECIDED] For now, a booster doesn't deal cards the player already absorbed. It may not stay: it's one switch, `NO_REPEATS` in `js/player/booster.js`.
  - Chosen while implementing, not confirmed: if fewer than 3 cards are left, the booster has the ones left; with none left, the Player Card says there's nothing left to open.
- [DECIDED] The name of the player's card is set when it's created, and the player can rename it each time their card absorbs a card: after pressing "Absorb", a dialog offers to rename it or keep the name. (This replaces the earlier rule, where the name was sealed until opening a booster.)
  - Chosen while implementing, not confirmed: it's asked after every card absorbed (the first creature, each starting spell and each level booster), before the absorb animation. An empty name keeps the old one. Art and flavor text still can't be changed after the card is made.
- [PROPOSED] Each enemy gives XP equal to its mana value.
- [PROPOSED] Catch-up for whoever falls behind: the lowest-level player opens 4-card boosters instead of 3.
- [DECIDED] How much XP each level takes: level × 3 (above).
- [PENDING] Whether the game is purely cooperative or has a winner (for example, the highest level at the end).

## 5. What absorbing each kind of card gives

| Card | What the player gets |
|---|---|
| Creature | [DECIDED] +P/+T, its colors, its cost, its creature types, and its text decided card by card (below) |
| Equipment | [DECIDED] The player equips it and gets what it grants. It stays its own card, so something can destroy it: then it gives nothing until combat is over, when it comes back. Adds its colors and cost. |
| Aura | [DECIDED] A bonus that lasts: the player enchants themselves. Like any attachment it can be destroyed until combat is over (see below). Adds its colors and cost. |
| Instant / sorcery | [DECIDED] Joins the spell list (section 3) and adds its colors. Its cost isn't added: it's what casting the spell costs. |
| Item (an artifact or enchantment that isn't an Equipment or Aura) | [DECIDED] Kept with the Equipment (Seal of Fire). Sacrificing it only lasts the combat: it's back when combat is over. Adds its colors and cost. |
| Land | [PROPOSED] +1 mana per turn of that color (there are no lands left in the test pool) |
| Everything else | [PENDING] Case by case |

- [DECIDED] Equipment, Auras and items add their colors and their mana cost, like creatures, but not their types: absorbing an Equipment doesn't make the player an Artifact Creature.
- [DECIDED] Instants and sorceries add their colors (so the player can make the mana to cast them) but not their cost.
- [DECIDED] Some creatures may have abilities that destroy Equipment or artifacts and can target them.
- Chosen while implementing, not confirmed:
  - The Equip cost is ignored: the player is equipped as soon as they absorb it.
  - What an Equipment or Aura grants is written in `js/rules/cards.js` (`grants`). "Equipped creature" and "enchanted creature" are the player, and abilities granted in quotes ("Equipped creature has '…'") become the player's own abilities.
  - [DECIDED] **Destroy and Remove:** every attachment (Equipment, item or Aura) has two buttons in its details, under "Attachments" (section 10). "Destroy" is temporary: it gives nothing until combat is over, and "Combat over" brings it back. "Remove" deletes it from the Player Card for good. (This replaces the earlier rule: a "Destroyed" button on Equipment only, which lost it for good, and none on Auras.)
    - Chosen while implementing, not confirmed: a destroyed attachment is grey with a "Destroyed" badge, and "Restore" brings it back by hand (for a mistaken tap). "Remove" asks first. A removed card keeps the colors and cost it added (as an Equipment destroyed did before), and it stays among the absorbed cards (`removed` on its entry in `absorbed`), so boosters still don't deal it again; it leaves the "Attachments" panel. A destroyed Aura doesn't count for "each enchantment you control" (Ethereal Armor). Cards with a button of their own (Unattach, Revived, Sacrificed) keep it besides "Destroy".
  - The "Spellbook" panel lists the spell list with each spell's cost and text. "Cast" puts it in the graveyard and "Combat over" brings every spell back.
  - Spells are cast as printed, so they need no entry in `js/rules/cards.js`.
  - Ethereal Armor's "each enchantment you control" counts the player's Auras. Blessing of the Nephilim's bonus follows the player's colors.
  - Equipment, Auras and items with no entry in `js/rules/cards.js` stay out of boosters until they're decided.
  - An Equipment or Aura can have a button that takes it off for the rest of the combat (`toggle`); while off it grants nothing, and "Combat over" puts it back.
- [DECIDED] **Blinding Powder:** "Unattach" takes it off until the next combat; then it's back on by itself.
- [DECIDED] **Carapace:** instead of "Sacrifice this Aura: Regenerate", when the player dies they come back without the Aura, and it returns when combat is over. Its text on the card: "When you would die, you come back instead, without Carapace. Carapace returns when combat is over." In its details (Attachments), "Revived" takes it off.
- [DECIDED] **Cartouche of Zeal:** gives its +1/+1 and Haste and starts on, like any Aura. "Target creature can't block this turn" is WIP (its tooltip says so).
- [DECIDED] **Seal of Fire:** an item. Sacrificing it takes it away for the rest of the combat ("Sacrificed" in its details, under Attachments), and "Combat over" brings it back.
- [DECIDED] **Bagel and Schmear** and **Desert** were taken out of the pool (`level1.txt` and `data/level1.json`).

- [PROPOSED] When absorbing, the app adds up the stats, colors and types by itself and records the absorbed card on the sheet. The player can correct the result by hand.

### Absorbing a creature

- [DECIDED] Its power and toughness are added to the player's.
- [DECIDED] Its colors join the player's. A colorless player takes the creature's colors; a colored one adds them to theirs. A colorless creature leaves the colors as they are.
- [DECIDED] Its mana cost is added to the player's symbol by symbol, the way a card would print it: {1}{B} + {R} = {1}{B}{R}, and {1}{B} + {2}{R} = {3}{B}{R}. The starting {0} goes away when the first cost is added.
- [DECIDED] All the card's creature types join the player's, without asking: the player doesn't choose. Types the player already has aren't repeated. (This replaces the earlier rule, where the player chose which ones to add.)
- [DECIDED] If the creature has another card type besides Creature, the player gets it without being asked: absorbing Akki Ember-Keeper (Enchantment Creature) makes them an "Enchantment Creature — Human …".
- [DECIDED] Legendary joins too, although it's a supertype and not a card type: "Legendary Creature — Human Knight".
- Chosen while implementing, not confirmed:
  - The two rules above cover Legendary, Enchantment, Artifact and Land, in the order they're printed: "Legendary Enchantment Artifact Creature".
  - Mana symbols are sorted as on cards: X, generic, colorless, then white, blue, black, red and green, with hybrids next to their first color.
  - If power or toughness isn't a number (for example `*`), the player is asked how much it adds. By default, 0. `js/rules/cards.js` can say how much a card adds (`power`, `toughness`); then the player isn't asked.
  - For two-part cards, the creature part is absorbed: the front face of double-faced cards, and the creature of cards with an adventure or similar.

#### Rules text

General rules:

- [DECIDED] Each creature's rules text is decided card by card, because cards don't work the same way in the dungeon. The decisions are in `js/rules/cards.js`: which keywords and which other abilities each card gives.
- [DECIDED] Keywords aren't explained with Magic's text in parentheses (reminder text), because they work differently in this game. Each one has its own rule in `js/rules/keywords.js` (section 6):
  - The absorb screen explains what each keyword gained is for.
  - On the player's card, the keyword shows its rule in a tooltip: on mouse hover, on keyboard focus, or when tapped on the phone.
- [DECIDED] Phrases that mean something particular in this game also show their rule in a tooltip, inside the card text and on the absorb screen, just like keywords. They're in `js/rules/terms.js`. So far: "When/Whenever this creature enters", "enters tapped", "at the beginning of your upkeep", "prepared", "you gain N life" / "gained life", "Sacrifice this creature", "your party" / "a full party", "artifacts you control", "transform it", "your life total", "your starting life total", "your end step" / "each end step", "opponent", "player", the WIP words (draw, discard, hand, library, scry, mill, explores, graveyard, commander), and the {T} symbol.
- [DECIDED] Keywords that appear inside an ability's text (like "gains flying") don't get a tooltip. Only the ones on the keyword line do.
- [DECIDED] **Tapping ({T}):** the player always taps to attack, as in Magic. An ability with {T} taps them too, so using it ends their turn.
- [DECIDED] **"When this creature enters"** on the player's card means when combat starts. If a card exiles the player and returns them to the battlefield, they enter again and the ability triggers again, so it can trigger several times.
- [DECIDED] **"Enters tapped":** the player starts each combat tapped, so they pass their first turn.
- [DECIDED] **Upkeep:** "at the beginning of your upkeep" is the start of the player's turn.
- [DECIDED] **End step:** "your end step" is the end of the player's turn; "each end step" is the end of every turn, players' and monsters' alike.
- [DECIDED] **Opponent and player:** an "opponent" is a monster, and "player" means players and monsters alike. So "deals combat damage to a player" triggers when the player hits a monster, and "each player creates a token" includes the monsters.
- [DECIDED] **No deck or hand yet:** text about drawing, discarding, the library, the hand, the graveyard, scry, mill and exploring stays on the card, with a "WIP" tooltip on those words. Commander rules (Partner, Partner with, Choose a Background, "commanders you control") stay too, marked WIP.
  - Chosen while implementing, not confirmed: the graveyard tooltip also says that for now only the spells the player casts go there.
- [DECIDED] **Text about the card itself as a card** is left out: casting it from hand (Sneak), "This spell can't be countered", "Discard this card" and "Return this card from your graveyard".
- [DECIDED] **Devotion:** the player's devotion to a color is the number of that color's mana symbols in their mana cost (hybrid and Phyrexian symbols count for each of their colors). The app counts it and keeps it up to date as the cost changes; the card's `*` adds 0 (without asking).
- [DECIDED] **{X} in a creature's cost:** the player picks X when absorbing it. It's added to their mana cost as that much generic mana, and it's the X in the card's text.
- [DECIDED] **Prepared:** a card with a spell of its own (like Stingerquill Voxmancer) lets the player cast a copy of that spell while prepared. A copy doesn't go to the graveyard like the spells on the list, so being prepared again lets them cast it again.
- [DECIDED] **Gain life:** gaining life heals the player, but never above their toughness. ("You gain N life" and "gained life" show this in a tooltip.)
- [DECIDED] **"Sacrifice this creature"** on the player's card means the player sacrifices themselves: they die to trigger the effect.
- [DECIDED] **Slivers:** a Sliver's "Sliver creatures you control" includes the player themselves when they are a Sliver (and absorbing one makes them one). So a Sliver gives the player directly what it gives Slivers: its keywords go on the keyword line, with their tooltip.
- [DECIDED] The same goes for other creature types: "each Vampire you control" includes the player when they are a Vampire (Cordial Vampire). Text that says "other" or "another" ("Other Vampire creatures", "another Human") leaves the player out.
- [DECIDED] **Party:** a card's "party" is the group of players. It counts up to one each of Cleric, Rogue, Warrior and Wizard among their creature types; a full party has all four.
- [DECIDED] **The player's artifacts:** "artifacts you control" are only the player's own artifacts.
  - Chosen while implementing, not confirmed: the player counts, if they're an Artifact Creature, and so do the artifacts they absorbed.
- [DECIDED] **+1/+1 counters:** the player keeps track of them on the Player Card, with buttons in "Status" to add and remove them. The card's power and toughness include them.
  - Chosen while implementing, not confirmed: -1/-1 counters go in the same number, as a negative, because in Magic a +1/+1 and a -1/-1 counter cancel out.
- [DECIDED] **Combat bonuses:** bonuses worked out again during combat are kept on the Player Card, in "Status", like the counters: "Bonus power" and "Bonus toughness". The card's power and toughness include them.
  - Chosen while implementing, not confirmed: the "Combat over" button resets them to 0 when combat ends (it also brings the spells back and turns the card back to its front). They also serve for other cards' "+N/+N until end of turn".
- [DECIDED] **Cards that transform** (double-faced, like Cecil, Dark Knight) transform for real. On absorbing one, the player gets the front face, and the Player Card can be turned over.
  - Turned over, the player loses what the front face gave them and gets what the back face gives, plus a stat bonus: the difference between the two faces. With Cecil: 2/3 against 4/4, so +2/+1, and Deathtouch and Darkness become Lifelink and Protect.
  - [DECIDED] On getting a transformation, the player can give that face another name and another photo, if they want. Without a name or photo of its own, it uses the usual ones.
  - [DECIDED] That name and photo are set on the rename screen, which opens after every card absorbed (section 4): under the card's own name, one section per other face, with its name and "Take a photo", "Upload a photo" and "Use my usual art". There is no "Edit other face" button under the card. (This replaces the earlier rules: a dialog of its own when absorbing a card that transforms, and "Edit other face" under the card.)
    - Chosen while implementing, not confirmed: "Keep the names" (or Escape) keeps the names as they were; art picked for a face is kept right away. The rename screen still opens before the animation, and the card is already saved by then, so reloading loses nothing.
  - Chosen while implementing, not confirmed:
    - [DECIDED] Under the card, the button just says "Transform" (not the card's name). Turned over, it says "Turn back".
    - [DECIDED] With more than one card that transforms, each card's button is on its own row and names it: "Transform (Cecil)", "Turn back (Cecil)". The name is the part before the comma, or the whole name if two would read the same.
    - The card spins when it turns over, and turned over it shows a moon (☾) before the name, like the back face of double-faced cards.
    - It lasts until combat ends: "Combat over" clears the bonuses and turns the card back to its front.
    - If another absorbed card also gives a keyword or ability of the front face, the player keeps it when turned over.
- Chosen while implementing, not confirmed:
  - Keywords a card gives are always absorbed, drawbacks included. Keywords the player already has aren't repeated.
  - A card whose text hasn't been reviewed yet can still be absorbed: it gives power, toughness, colors, cost and types, but nothing from its text. The absorb screen says so.
  - If the text doesn't fit in the card's text box, the font shrinks, like the name's.
  - If the text names the card itself ("Archpriest of Iona's power"), the player's card says "this creature", the way Scryfall writes other cards nowadays.

Card by card (all [DECIDED]):

- **Akki Ember-Keeper:** keeps its text as printed, even though the game has no tokens yet: a mechanic for summoning creatures may come later. Only the player's own creatures count.
- **Alseid of Life's Bounty:** gives Lifelink and keeps as printed its ability to pay {1} and sacrifice itself.
- **Ankle Biter:** gives Deathtouch.
- **Arboreal Grazer:** gives Reach and keeps as printed its ability to put a land onto the battlefield when it enters.
- **Arcbound Javelineer:** gives Modular 1 and keeps as printed its ability to tap and remove X counters to deal X damage.
- **Arcbound Mouser:** gives Lifelink and Modular 1. **Arcbound Worker:** gives Modular 1. They have no other text.
- **Archpriest of Iona:** its "party" is the group of players. Its `*` power doesn't overwrite the player's: absorbing it adds 0 (without asking). The bonus it gives from the party is worked out again during combat, and the player keeps it as bonus power, like the counters. Its first ability reads "During combat, this creature gets +X/+0, where X is the number of creatures in your party." The second is kept as printed.
- **Ardent Recruit:** keeps its text as printed.
- **Armored Armadillo:** gives Ward {1} and keeps as printed its +X/+0 ability, kept as bonus power.
- **Assassin Initiate:** keeps its text as printed.
- **Blazing Rootwalla:** gives Madness {0} and keeps as printed its +2/+0, kept as bonus power.
- **Bloodcrazed Goblin:** keeps its text, but with "this round" instead of "this turn": "This creature can't attack unless an opponent has been dealt damage this round." That way damage another player dealt earlier in the round counts.
- **Boggart Cursecrafter:** gives Deathtouch and keeps its text as printed, like Akki Ember-Keeper: only the player's own Goblins count.
- **Captivating Vampire:** keeps its text as printed, like Akki Ember-Keeper: only the player's own Vampires count.
- **Cecil, Dark Knight:** gives Deathtouch and keeps Darkness ("Cecil" becomes "this creature"). Transforms into Cecil, Redeemed Paladin: +2/+1, Lifelink and Protect.
- **Champion of the Parish:** keeps its text as printed, like Akki Ember-Keeper: only the player's own Humans count. Its counters go on the Player Card's +1/+1 counters.
- **Cloudshredder Sliver:** gives Flying and Haste (the player is a Sliver and counts themselves).
- **Cordial Vampire:** keeps its text as printed. The player is a Vampire and counts themselves, and "another creature" includes monsters: whenever a creature dies, the player gets a +1/+1 counter.
- **Devoted Retainer:** gives Bushido 1.
- **Doomed Traveler:** keeps its text as printed, like Akki Ember-Keeper.
- **Dragon Sniper:** gives Reach, Vigilance and Deathtouch.
- **Dryad Arbor:** its text is only reminder text; the ability it has as a Forest goes on the player's card: "{T}: Add {G}." Tapping for mana ends the player's turn, like any {T}.
- **Dropkick Bomber:** keeps its text as printed; "other" and "another" leave the player out, like Captivating Vampire.
- **Earth Kingdom Protectors:** gives Vigilance and keeps as printed its ability to sacrifice itself. Ally is a creature type; "another" leaves the player out.
- **Fanatical Firebrand:** gives Haste and keeps as printed its ability to tap and sacrifice itself to deal 1 damage.
- **Goblin Champion:** gives Haste and Exalted.
- **Goblin Gaveleer:** gives Trample and keeps as printed its +2/+0 for each Equipment.
- **Lancer Sliver, Striking Sliver:** give First strike ("Sliver creatures you control", so no text).
- **Monoist Sentry:** gives Defender (WIP).
- **Oathsworn Vampire:** keeps its text as printed. "Enters tapped" makes the player pass their first turn of each combat; the graveyard ability stays just in case.
- **Ornithopter:** gives Flying.
- **Phyrexian Dreadnought:** gives Trample and keeps its text as printed, a trap on purpose: it enters when combat starts, so unless the player sacrifices 12 power of creatures, they die.
- **Putrid Goblin:** gives Persist.
- **Stingerquill Voxmancer:** keeps its text as printed, and its spell shows as one more ability: "Its spell: Vicious Verse {B/R}, Sorcery — Vicious Verse deals 1 damage to target opponent." While prepared, the player can cast a copy of it.
- **Vampire Lacerator:** keeps its text as printed (its upkeep is the start of the player's turn).
- **Voracious Vampire:** gives Menace (WIP) and keeps its text as printed; the player is a Vampire, so they can be its target.
- **Smitten Swordmaster:** gives Lifelink (only the creature, not its adventure).
- Creatures without text (Aegis Turtle, Phyrexian Walker, Vampire Noble) need no review.

First cards (`akashicos.txt`), all [DECIDED] unless marked:

- Every first card with rules text has an entry in `js/rules/cards.js`. Unless said below, a card gives its keywords and keeps the rest of its text as printed, with the rules above ("this creature" for its own name, WIP words, opponent and player). Caelorna, Isamaru, Kalakscion, Sundial and Tyrox have no text.
- **Adamaro, First to Desire:** monsters have no hand, so it adds 0/0. Its text stays, marked WIP.
- **Anafenza, Unyielding Lineage** and **Wan Shi Tong, Librarian:** give Flash, plus their other keywords and text.
- **Callaphe, Daxos, Tymaret:** their `*` follows the player's devotion (above). Each keeps a line saying so, like "This creature gets +X/+0, where X is your devotion to blue", and its other text.
- **Mikaeus, The Goose Mother, Wan Shi Tong:** the player picks X. Their text is written with that number ("enters with 3 +1/+1 counters"; The Goose Mother's half X rounds up and Wan Shi Tong's rounds down).
- **Erayo, Soratami Ascendant:** flips like a transform, but keeps the front face's text and adds Erayo's Essence's ability. Chosen while implementing, not confirmed: flipping gives +0/+0, because the Essence has no power or toughness.
- **Emet-Selch** (→ Hades, +4/+2, Vigilance), **Rona** (→ Rona, Tolarian Obliterator, +4/+2, Trample) and **The Emperor of Palamecia** (→ The Lord Master of Hell, +1/+1) transform like Cecil.
- **Bilbo Baggins, Burglar** and **Bilbo, Luckwearer:** only the creature, not its adventure, like Smitten Swordmaster.
- **Boromir, Warden of the Tower:** "The Ring tempts you" is left out.
- **Locutus, Surrak, Wilson, Oroku Saki, Winter Soldier:** lose the text about the card itself (above). Locutus keeps nothing else.
- Chosen while implementing, not confirmed, applying the Sliver and Vampire rule: **Locutus** ("Artifact creatures you control get +1/+1") makes the player an Artifact Creature, and **Jacques le Vert** ("Green creatures you control get +0/+2") makes them green, so the bonus is added to their power and toughness for good, with no text. Adeliz's Wizards, Ardbert's legendary creatures and Meriadoc's Halflings include the player too.

Reviewed on my own with the rules above, after the author asked me to go on alone (Chosen while implementing, not confirmed; each one only applies rules already decided):

- **Forge Devil, Goblin Arsonist, Goblin Swine-Rider, Hemosymbic Mite, Hollowhenge Scavenger, Kor Duelist, Myr Scrapling, Spitfire Handler, Vampire Slayer:** keep their text as printed.
- **Goblin Instigator, Kavaron Harrier, Nested Shambler:** keep their text as printed, like Akki Ember-Keeper (they make tokens).
- **Guul Draz Vampire:** keeps its text as printed; its +2/+1 goes in the combat bonuses.
- **Icatian Javelineers:** keeps its text as printed; the javelin counter is kept at the table, not on the Player Card.
- **Knucklebone Witch:** keeps its text as printed; the player is a Goblin, so their own death counts too.
- **Sliver lords:** what a Sliver gives Slivers goes straight to the player, who is a Sliver. [DECIDED] Cards that say "All Sliver creatures" reach every Sliver, other players and monsters included, so they also keep their text on the card:
  - **Heart Sliver:** Haste, plus its text. **Spinneret Sliver:** Reach, plus its text. **Winged Sliver:** Flying, plus its text.
  - **Muscle Sliver, Sinew Sliver:** +1/+1 added to the player's power and toughness, plus their text. **Plated Sliver:** +0/+1, plus its text. Two of them stack (Muscle and Sinew give +2/+2).
  - **Venom Sliver:** Deathtouch ("Sliver creatures you control", so no text).

Still open:

- [DECIDED] Renaming: each time the card absorbs a card, a dialog offers to rename it (section 4).

## 6. Keywords (table rules)

- [DECIDED] **Vigilance:** enemies focus their attacks on players with Vigilance. Text: "Enemies will focus their attacks on players with Vigilance." Replaces the earlier version ("becomes the focus of every enemy until they die").
- [DECIDED] **Bushido N:** whenever the player attacks someone or is attacked, they get +N/+N until end of turn, kept as combat bonuses. It stacks: Bushido 1 + Bushido 1 = Bushido 2. Text: "Whenever you attack or are attacked, you get +N/+N until end of turn."
- [DECIDED] **Haste:** goes first in the turn order (section 3). Text: "When combat starts, you go before everyone without haste. Everyone with haste rolls a d20 too, to set the order among them."
- [DECIDED] **Flash:** the player acts first when combat starts, before creatures with Haste, but only on the first turn of combat. They still roll initiative, which sets their place after that. Text: "When combat starts, you act first, even before creatures with haste. You only act first on the first turn of combat. You still roll initiative."
- [DECIDED] **Double strike:** "Your attacks deal their damage twice."
- [DECIDED] **Prowess:** "Whenever you cast a spell, you get +N/+N until end of turn." Kept as combat bonuses; it adds up like Exalted (Prowess + Prowess = Prowess 2).
- [DECIDED] **Protection:** only works against instants and sorceries. Text for "Protection from white and from black": "White or black instants and sorceries can't target you or deal damage to you. It only works against instants and sorceries: you can still attack, deal damage and be attacked."
- [DECIDED] **Partner, Partner with, Choose a Background:** WIP.
- [DECIDED] **First strike:** a player with first strike hits back when attacked. A monster with first strike deals damage to whoever attacks it. Text: "Whenever a creature attacks you, you hit it back with your power."
- [DECIDED] **Exalted:** whenever the player attacks, they get +1/+1 until end of turn, kept as combat bonuses. It stacks: two Exalted give Exalted 2 (+2/+2). Text: "Whenever you attack, you get +N/+N until end of turn."
- [DECIDED] **Trample:** uses the formation. If the attack kills the creature in front, the damage left over hits the one behind it. Text: "If your attack kills the creature in front, the damage left over hits the one behind it."
- [DECIDED] **Persist:** "When you die, if you have no -1/-1 counters, you come back with a -1/-1 counter." The -1/-1 counter goes in the Player Card's counters.
- [DECIDED] **Lifelink:** heals the player by the damage they deal. Text: "Damage you deal heals you by the same amount."
- [DECIDED] **Flying:** as in Magic, where only creatures with flying or reach can block it: only creatures with flying or reach can defend themselves against its attacks. Text: "Only creatures with flying or reach can defend themselves against your attacks."
- [DECIDED] **Reach:** can defend against creatures with flying, as in Magic, where it lets a creature block them (rule 702.17). It doesn't help attack them. Text: "You can defend yourself against creatures with flying."
- [PENDING] **Deathtouch:** "any damage it deals to a creature destroys it" is too strong. To be defined later; meanwhile the tooltip says "WIP".
- [DECIDED] **Modular N:** each time the player enters (when combat starts) they put N +1/+1 counters on themselves, and when they die they may put their +1/+1 counters on another creature or player. Text: "Each time you enter (when combat starts), put N +1/+1 counters on yourself. When you die, you may put your +1/+1 counters on another creature or player."
  - Chosen while implementing, not confirmed: keywords with a number add up. Absorbing two cards with Modular 1 gives Modular 2, just like two Modular abilities in Magic.
- [DECIDED] **Ward N:** monsters can cast spells, so it stays as in Magic: when a monster targets the player with a spell or ability, it's countered unless it pays N mana. Text: "Whenever a monster targets you with a spell or ability, it's countered unless that monster pays N mana." Written as on the card, "Ward {1}", with the mana icon.
  - Chosen while implementing, not confirmed: it adds up like Modular (Ward {1} + Ward {1} = Ward {2}), which in Magic is the same as having Ward {1} twice.
- [DECIDED] **Madness N:** kept in case hands and discarding come later. Its rule is Magic's: "If you discard this card, discard it into exile. When you do, cast it for its madness cost (N mana) or put it into your graveyard."
  - Chosen while implementing, not confirmed: its cost doesn't add up; if the player already has Madness, they keep the one they had.
- [PENDING] **Defender:** in Magic it prevents attacking, and since absorbing is permanent, a player with Defender could never attack again. To be defined; meanwhile the tooltip says "WIP".
- [PENDING] **Menace:** to be defined; meanwhile the tooltip says "WIP".
- [PENDING] What happens if two players have Vigilance at once.
- [PENDING] The rest of the keywords.
- The rules in this section are in `js/rules/keywords.js`, which is the text the player sees. If a rule changes here, change it there too.

## 7. The dungeon (the Game part)

- [DECIDED] Game shows the current room, its monsters and how many rooms have been played. Nothing else.
- [PROPOSED] The dungeon plays by the same rules as the players: each monster is a base creature that absorbed N cards from its own boosters. A boss is a creature that absorbed many.
  - Why: at level 10 a player is around 20/25, and almost no single card goes over 10/10, so a single card stops being a threat.
- [PROPOSED] Scaling by number of players: each room is built from a budget that depends on the group.
- [PENDING] How Game knows how many players there are and how strong they are, since it can't see the phones. The simplest way is to type it on the Game screen.
- [PENDING] Whether monsters' life is tracked on the Game screen or at the table.
- [PENDING] Dungeon structure: number of rooms, kinds of rooms, when a boss appears.

## 8. Cards and pool

- [DECIDED] The app doesn't implement the cards' rules text. The players read the card and resolve it at the table.
- [DECIDED] The data comes from a JSON file in the repo, not from API calls during the game.
- [DECIDED] The author will add a filtered version of Scryfall's JSON with the pool's cards. He decides which cards go in through that file.
- [DECIDED] The app shows the card images.
- Original source: Scryfall's "Oracle Cards" file (one entry per card, over 200 MB). Page: https://scryfall.com/docs/api/bulk-data. The full file (`oracle-cards-*.jsonl`) is in `.gitignore`: it isn't committed to the repo nor loaded in the browser.
- Images: each card has `image_uris` in several sizes. Use `small` (146×204) for lists and `normal` (488×680) for the full card. They load straight from Scryfall and aren't kept in the repo.
- Scryfall's image guidelines: don't cover or crop the copyright or the artist's name, and don't distort the image. Showing the whole card complies.
- Double-faced cards have their images in `card_faces`, not on the card. If they go into the pool this has to be handled.

## 9. Technical plan

### Hosting and saving

- [DECIDED] Free hosting, static site, JavaScript only.
- [DECIDED] All state is saved in each user's browser. Nothing leaves the device.
- [DECIDED] GitHub Pages (in use): a static site in a public repo. Limits: 1 GB per site and a soft cap of 100 GB of traffic per month.
- [PROPOSED] The state goes in `localStorage`, always with `try/catch`, with a version number and migrations so games aren't lost when the format changes.
- [PROPOSED] The art photos are kept apart, in IndexedDB, so they aren't rewritten on every change and don't hit the roughly 5 MB cap of `localStorage`.
- [PROPOSED] Export and import the character as JSON (or a code to copy), because clearing the browser's data deletes the game.

### Architecture

- [PROPOSED] No build step and no dependencies: native browser modules (ES modules). GitHub Pages serves the files as they are. Since modules don't load from `file://`, development uses a local server: `npm start` runs `scripts/serve.py`, Python's built-in server with caching turned off, so the browser never mixes old and new modules after an edit.
- [PROPOSED] Player Card and Game are two independent screens. They only share the card data, the card component and saving.
- [PROPOSED] Structure (already in place):

```
index.html        only the views' HTML
css/
  base.css        variables, page and shared controls (buttons, fields, alerts, tooltip)
  card.css        the card component
  home.css        home
  player.css      Player Card (the character sheet), camera and art editor
assets/
  bg-landscape.jpg  the character sheet's background
  booster.css     the cards of a booster, to pick one
js/
  main.js         hash navigation and home
  shared/
    card.js       draws any card (home, player; later boosters and monsters)
    storage.js    localStorage with try/catch
    images.js     photos in IndexedDB
    busy.js       overlay with a spinner while the browser works on something
    tooltip.js    tooltips for elements with data-tip (mouse, keyboard and touch)
    mana.js       mana costs: read, add, sort, mana value, icons (pure)
    cards.js      loads a card pool and gives each card's image link
    booster-ui.js draws a booster's cards to pick one
    dom.js        DOM helpers
  player/
    model.js      the character sheet as pure data, and save migrations
    crop.js       crop math (pure)
    view.js       the Player Card screen
    art-editor.js art editor: move, zoom, crop
    camera.js     live camera
    photo.js      shrinks photos and turns them into JPEG
    booster.js    builds a booster from a pool (pure)
    level.js      experience, levels and the boosters they earn (pure)
    absorb.js     absorbing a card (pure)
    transform.js  cards that transform: turning the player's card over (pure)
    gear.js       Equipment, Auras and the spell list (pure)
    board.js      the character sheet around the card: attachments, inherited creatures, XP bar (pure)
    roster.js     the cards saved in this browser, and their storage keys (pure)
    start.js      a new card's starting points: its creature and spells (pure)
    absorb-animation.js  the absorb animation on the card
  rules/          the game's own rules, written by hand (pure data)
    keywords.js   what each keyword does in this game
    cards.js      what the player gets from each card's text
    terms.js      phrases in card text that mean something particular in this game, with their tooltip
  game/           doesn't exist yet; the Game part goes here
data/
  level1.json     test pool: the cards of level1.txt with their data and image links
  akashicos.json  the cards of akashicos.txt, which a new card picks its first card from
  akashicos_spells.json  the spells of akashicos_spells.txt, which a new card spends its other points on
scripts/
  build-pool.js   builds a pool JSON from a list and Scryfall's file
  serve.py        local server for development, without caching
tests/            node --test
package.json      only scripts: npm start and npm test. No dependencies.
```

- Rule for new code: whatever works something out (absorbing, building a booster, generating a monster) goes in pure modules like `model.js` and `crop.js`, with no DOM or saving, and with its test. Views only connect those modules to the screen.
- [PROPOSED] Tests with Node's built-in runner (`node --test`), only for what the app works out: absorbing a card, building a booster, generating a monster, migrating a save.
- To change the save format: bump `SAVE_VERSION` in `model.js` and add a step in `upgradeSave`, with its test. Never throw away an old save.

### Interface

- Interface text in English, to go with the cards.
- [DECIDED] **Phones:** the page never scrolls sideways, and dialogs (boosters, absorbing, renaming, camera, art editor) take the whole screen.
  - Chosen while implementing, not confirmed: up to 560px wide the dialogs are full-screen; up to 760px the card's glow stays inside the screen width (it used to reach past the edge, which made the page scroll sideways), and as a backstop anything reaching past the edge is clipped and the page can't scroll sideways. In "Status" the labels wrap so the rows fit a 320px screen. Checked at 320, 360 and 390px wide.
- Hash navigation: `#game` and `#player-card`. Any other value shows home. Always use simple names (letters, numbers and dashes), no `#/route`.
- Style: a single dark theme, map-grid background, amber accent. The character sheet (section 10) is the exception: it sits over a landscape (`assets/bg-landscape.jpg`). Colors and fonts are variables on `:root`; reuse them in new screens.
- Fonts from Google Fonts (Grenze Gotisch for headings, Alegreya Sans for text, Cinzel for the character sheet's banner, panels and tabs), with fallback fonts.
- Footer with the notice that this is an unofficial fan project, not affiliated with Wizards of the Coast. Keep it.
- Don't use the official logo or card back. The identity's colors are shown with plain circles on the type line.
- [DECIDED] The mana cost is shown as on a real card, with mana icons. They're the SVG images Scryfall publishes (`https://svgs.scryfall.io/card-symbols/R.svg`), loaded like the card images. If one doesn't load, or it's a generic number above 20 (Scryfall has no image), a circle with the text is shown. Mana symbols inside ability text are drawn as icons too.
- [DECIDED] The card frame imitates real Magic cards and changes color with the identity: grey if colorless, its own color if it has one, gold if it has two or more. It's drawn in CSS (`css/card.css`), with no official frame images. When an absorbed card changes the identity, the frame shifts gradually to the new color.

## 10. Current state

The code is already split following the architecture in section 9.

- **Home:** done. Title, **Game** and **Player Card** buttons, and the sample starting card.
  - [DECIDED] The home card keeps the texts "Colorless. No abilities yet." and "Everyone walks in as a 1/1."
- **Player Card:** card creation (with starting points), boosters, absorbing creatures, Equipment, items, Auras and the spell list, +1/+1 counters, combat bonuses, cards that transform, and XP and levels are done. Still missing: the other counters (damage, mana) and export/import.
  - [DECIDED] A browser can keep several player cards, for whoever wants more than one game. Going to Player Card with no cards starts a new one; with some, it shows a menu of the cards ("Your cards") to play one, delete one or make another.
  - Chosen while implementing, not confirmed: each card on the menu shows its photo, name, type line, power/toughness and how many cards it absorbed. From a card, "Your cards" (next to "Back to start") goes back to the menu, and coming to Player Card always opens on the menu. "Start over" became "Delete card", which goes back to the menu.
  - [DECIDED] A new card doesn't open a booster: its first card is picked from every card in `akashicos.txt` (`data/akashicos.json`). On the flavor text screen, the "Choose your first card!" button shows them all. (This replaces the earlier rule, where that button opened the first booster.)
    - [DECIDED] The card lists have no search field.
    - [DECIDED] The first card is mandatory: the list has no "Close" button and Escape doesn't close it, so the player can only leave it by absorbing a card (reloading the page brings them back to the "Choose your first card!" button). After it come the spells (starting points) and then the boosters levels earn (section 4).
  - [DECIDED] **Starting points:** a new card has 5 points to spend. Each card costs its mana value in points. First the player picks one creature from `akashicos.txt`; then, on another screen, spells from `akashicos_spells.txt` of that creature's colors, as many as their points allow.
    - [DECIDED] "Of its colors" means every color of the spell is one of the creature's: a blue creature gets blue spells, but not Agony Warp (blue and black); a blue and black creature gets both. (This replaces the earlier rule, where sharing one color was enough.) The rules are in `js/player/start.js`.
    - [DECIDED] For a creature with {X} in its cost, X costs points too: X can go up to the points left (Mikaeus with X = 2 costs 3).
    - [DECIDED] The player can stop with "Done" whenever they want, and it ends by itself when no spell they can afford is left. Points left over are lost.
    - Chosen while implementing, not confirmed: the color has to be the creature's, not one a spell added later. A spell with {X} costs its mana value without X (Banefire costs 1), since X is paid when it's cast. Each spell can be picked once. The spell screen opens by itself after each absorption while points are left; closed, it opens again from "Choose a spell" under the card. "Open a booster" is hidden until the points are spent. The absorb screen shows the points before and after.
  - The booster deals 3 cards from `data/level1.json`. Every card in the pool can come up. The player picks one, confirms it, sees how their card turns out and absorbs it.
  - [DECIDED] When absorbing, the values can be seen loading into the card: the creature flies into the card and each value that changes (power/toughness, colors, cost, types, abilities) updates in turn, with a caption saying what changed. With "reduce motion" turned on in the system, the card changes all at once.
  - [DECIDED] After the first absorption, the Player Card page is the **character sheet**, laid out after the author's mocks (desktop and phone), over the landscape background. (This replaces the earlier layout: the card alone, with "Text on card", "Spells" and "Status" accordions beside it.)
    - [DECIDED] **Wide screens:** three columns. In the middle, the card, upright, under a "Character Sheet" banner. On the left, the "Attachments" panel (purple) over the "Inherited Creatures" panel (green). On the right, the "Spellbook" panel (blue) over the "Status" panel (bronze). The level and XP are on the top left, and a gold button on the top right.
    - [DECIDED] **Phones:** one column: the level and the gold button on top, the card, "Attachments" (a row of small cards), "Inherited Creatures" (a row of circles), and a sheet at the bottom with two tabs, "Spellbook" and "Status".
    - [DECIDED] Every card absorbed shows in exactly one panel: creatures in "Inherited Creatures", instants and sorceries in "Spellbook", and every other card in "Attachments".
    - [DECIDED] **Attachments:** every other card absorbed (Equipment, items and Auras), oldest first, as small cards. **Inherited Creatures:** every creature absorbed, oldest first, as a circle with its art and printed power/toughness. **Spellbook:** the spell list, each spell with its card, cost, type, text, "1/1" (ready) or "0/1" (cast this combat) and "Cast". **Status:** XP, +1/+1 counters, bonus power and toughness and "Combat over".
    - Chosen while implementing, not confirmed (the mocks show things the game doesn't have yet, mapped onto what it has):
      - The mocks' "Floor III · Room VII" with its bar is the level and XP ("Level 1 · 0/3 XP"), with one segment per XP the level takes (one plain bar past 12). Floors and rooms belong to the Game screen, which the phone can't see.
      - The mocks' "End Turn" button is "Your cards" (the menu of cards); there are no turns on the Player Card. "Back to start" stays beside it, except on phones under 480px, where it only fits on the menu.
      - The mocks' counts ("3/5", "3/6") have no limit in the game, so the panels show only how many there are ("3"). Empty dashed slots fill each panel up to 6 cards (two rows of 3 on wide screens, one row on phones), as decoration; more fit.
      - The banner's subtitle is "Dungeon Crawler", as in the mock. The labels stay "Bonus power" and "Bonus toughness" (the mock says "strength" and "life").
      - Tapping an attachment, a creature or a spell's card opens its details: the full card image from Scryfall, what it gives and its buttons ("Destroy", "Remove", "Unattach", "Put back", "Cast"…). An attachment taken off for the combat is dimmed, with an "Off" badge; a destroyed one is grey, with a "Destroyed" badge. A removed one isn't shown, and neither is an Equipment destroyed for good by an older version.
      - Small cards and spell thumbnails show the whole card image (`small`), never cropped. The creature circles use Scryfall's art crop, with the artist named in the circle's tooltip; the details show the full card. The images and printed power/toughness come from the card pools (`data/*.json`), loaded in the background; without them the board still works, with striped placeholders.
      - A card is told apart by its pool card; until the pools load, "Attachments" shows only what the player has on, and every other absorbed card that isn't a spell counts as a creature.
      - On wide screens the spell list scrolls inside its panel. The three columns start at 1000px; below that it's the phone layout, at most 560px wide and centered.
  - [DECIDED] **Text on card:** all the card's text at a size that's easy to read, because the card's own text shrinks as the card gains more: name, power/toughness, the full type line, keywords, abilities (with the same tooltips as on the card) and flavor text. It follows the card, transformed face included.
    - Chosen while implementing, not confirmed: the mocks have no place for it, so it opens in a dialog from "Read the card's text" under the card.
  - Chosen while implementing, not confirmed: under the card go what's waiting (choosing spells, "Open your level N booster"), the transform buttons, "Read the card's text" and a discreet "Delete card".
  - [DECIDED] Boosters are earned by leveling up (section 4). The free "Open a booster" button that dealt from `level1.txt` was removed; under the card, "Open your level N booster" shows while one is waiting.
    - [DECIDED] **Attachment booster (placeholder):** under the card, "Open an attachment booster" opens a free booster of 3 cards from every pool in `data/`, keeping only the cards that are neither creatures nor instants or sorceries (Equipment, items and Auras). It's a placeholder, an exception to "boosters only come from leveling up".
      - Chosen while implementing, not confirmed: it leaves out what the player already absorbed, and the Equipment, items and Auras with no entry in `js/rules/cards.js`, like every booster. It's hidden while a new card is spending its starting points. It isn't saved: closing it deals new cards next time. Absorbing from it clears a level booster left open, which then deals new cards (the level booster itself still waits). The pools in `data/` are listed in `DATA_POOL_URLS` (`js/player/view.js`), since the browser can't list a folder.
  - [PENDING] Whether flavor text and art can be edited afterwards, since the character sheet doesn't have those controls.
  - An open booster stays saved until a card is absorbed. Closing it or reloading the page shows the same cards.
  - The card paints the player's color circles, and the type line shrinks to fit, like the name.
  - [DECIDED] Step 1: name the card. It stays set (see section 4).
  - [DECIDED] The name has no character limit. If it's long, the font shrinks to fit.
  - [DECIDED] Step 2: upload a photo or take one for the card art. It's saved only in the browser.
  - [DECIDED] The photo can be edited in basic ways: move, zoom and crop.
  - [DECIDED] Optional flavor text.
  - [DECIDED] The player's basic card has no default text.
  - Chosen while implementing, not confirmed: the photo can be skipped and changed later; flavor text has a maximum of 110 characters; the original photo is kept so it can be cropped again.
  - The list of cards is saved in `localStorage` under `mtdg.players`, and each card's sheet under `mtdg.player.<id>` (format version 13). The photos go in IndexedDB (database `mtdg`, keys `player.<id>.art` and `player.<id>.artSource`; the other face of a card that transforms uses `player.<id>.transform0.art`, etc.). The keys are in `js/player/roster.js`.
  - Before there could be several cards, the only card was saved under `mtdg.player` with its photos under `player.art`, `player.artSource` and `player.transform0.art`. When the page opens it becomes the first card of the list; the old keys are removed only once its photos are under the new ones.
  - When a card is made, the page asks the browser to keep the data (`navigator.storage.persist()`), so it isn't cleared when the device runs low on space. Safari on iPhone still clears a site's data after 7 days without visiting it, unless the page was added to the home screen; export/import (section 11) is the real backup.
  - Old saves are migrated automatically when the page opens:
    - Version 1 kept the photos inside the sheet.
    - Version 3 added absorbed cards and the open booster.
    - Version 4 keeps the full cost with its symbols. A version 3 cost only had the total, so it becomes generic mana ({2}).
    - Version 5 keeps keywords apart from the other abilities.
    - Version 6 adds the card types besides Creature. Saves from before version 6 start without card types, even if they absorbed an artifact or an enchantment.
    - Version 7 adds +1/+1 counters, version 8 combat bonuses, version 9 cards that transform and version 10 Equipment, Auras and the spell list.
    - Version 11 adds the starting points. A card that absorbed nothing yet gets its 5 points; one that already absorbed something was made before them and gets none.
    - Version 12 adds the level, XP and the boosters waiting. Every card starts at level 1 with 0 XP. A free booster left open by an older version is dropped, since boosters now come from leveling up.
    - Version 13 lets any attachment be destroyed until combat is over (`destroyed` on Equipment and Auras) and removed for good (`removed` on its entry in `absorbed`). Nothing is converted: an Equipment destroyed by an older version was already off the player.
- **Game:** empty screen marked "Not built yet".
- **First card:** see Player Card above.
- **Boosters:** a level booster deals 3 different random cards from `data/akashicos_spells.json` (even levels) or `data/akashicos.json` (odd levels); `data/level1.json` is no longer used by the Player Card. It shows their images from Scryfall and lets the player pick one and confirm it with "Confirm". Each card's name shows on mouse hover, even if the image hasn't loaded. (The `BoosterTest.html` proof of concept, which dealt from the whole pool, was removed.)
  - `level1.txt` is the test card list (99 cards). The pool is rebuilt with `node scripts/build-pool.js level1.txt oracle-cards-YYYYMMDD.jsonl data/level1.json`.
  - `akashicos.txt` is the list of first cards (111). Its pool is rebuilt the same way: `node scripts/build-pool.js akashicos.txt oracle-cards-YYYYMMDD.jsonl data/akashicos.json`.
  - `akashicos_spells.txt` is the list of starting spells (60, all instants and sorceries costing 1 or 2): `node scripts/build-pool.js akashicos_spells.txt oracle-cards-YYYYMMDD.jsonl data/akashicos_spells.json`.
  - A marker after the collector number ("*F*", "*E*") is ignored. Printings sold under another name are looked up by their real name (`OTHER_NAMES` in `scripts/build-pool.js`): Benny, Platinum Thief is Tinybones, Trinket Thief, and Renfield, Delusional Minion is Eruth, Tormented Prophet.
  - Cards are looked up by name. Scryfall's file has a single printing per card, so the image may be from a different edition than the one in the list.
  - Images are requested from `cards.scryfall.io` with a plain `<img>` tag. No key is needed and no API calls, and Scryfall allows use from other sites.

## 11. Next steps

1. Character sheet: manual counters (damage, mana), export/import.
2. The rules still WIP or pending: Deathtouch, Defender, Menace, "can't block", the formation, "until end of turn".
3. **Game** view: current room, monsters and room counter.

## 12. Discarded ideas

- **A shared seed** so every device generates the same thing: not needed, because the devices share nothing. Each phone opens its own boosters and the dungeon lives on a single screen.
- **A combat engine** that resolves turns and damage: the players do it at the table.
- **Effect primitives** to implement card text, and **classifying them with an LLM**: the app doesn't interpret cards and no LLM is used.
