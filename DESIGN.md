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
- [DECIDED] **Turn order:** whenever a combat starts, players and enemies roll a d20 to set the order of turns. Creatures with Haste go first; if several have Haste, they roll too, and they go first in that order, then everyone else.
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
- [DECIDED] Each booster has 3 cards.
- [DECIDED] For now, a booster doesn't deal cards the player already absorbed. It may not stay: it's one switch, `NO_REPEATS` in `js/player/booster.js`.
  - Chosen while implementing, not confirmed: if fewer than 3 cards are left, the booster has the ones left; with none left, the Player Card says there's nothing left to open.
- [DECIDED] The name of the player's card is set when it's created. It can only change after opening a booster.
- [PROPOSED] Each enemy gives XP equal to its mana value.
- [PROPOSED] Catch-up for whoever falls behind: the lowest-level player opens 4-card boosters instead of 3.
- [PENDING] How much XP each level takes.
- [PENDING] Whether the game is purely cooperative or has a winner (for example, the highest level at the end).

## 5. What absorbing each kind of card gives

| Card | What the player gets |
|---|---|
| Creature | [DECIDED] +P/+T, its colors, its cost, its creature types, and its text decided card by card (below) |
| Equipment | [DECIDED] The player equips it and gets what it grants. It stays its own card, so something can destroy it, and then that's lost. Adds its colors and cost. |
| Aura | [DECIDED] A permanent bonus: the player enchants themselves for good. Adds its colors and cost. |
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
  - Under the card, "Equipment and auras" lists what the player has on. Each Equipment has a "Destroyed" button (also for sacrificing it, like Blazing Torch); Auras have none, since they're for good.
  - Under the card, "Spells" lists the spell list with each spell's cost and text. "Cast" puts it in the graveyard and "Combat over" brings every spell back.
  - Spells are cast as printed, so they need no entry in `js/rules/cards.js`.
  - Ethereal Armor's "each enchantment you control" counts the player's Auras. Blessing of the Nephilim's bonus follows the player's colors.
  - Equipment, Auras and items with no entry in `js/rules/cards.js` stay out of boosters until they're decided.
  - An Equipment or Aura can have a button that takes it off for the rest of the combat (`toggle`); while off it grants nothing, and "Combat over" puts it back.
- [DECIDED] **Blinding Powder:** "Unattach" takes it off until the next combat; then it's back on by itself.
- [DECIDED] **Carapace:** instead of "Sacrifice this Aura: Regenerate", when the player dies they come back without the Aura, and it returns when combat is over. Its text on the card: "When you would die, you come back instead, without Carapace. Carapace returns when combat is over." Under the card, "Revived" takes it off.
- [DECIDED] **Cartouche of Zeal:** gives its +1/+1 and Haste and starts on, like any Aura. "Target creature can't block this turn" is WIP (its tooltip says so).
- [DECIDED] **Seal of Fire:** an item. Sacrificing it takes it away for the rest of the combat ("Sacrificed" under the card), and "Combat over" brings it back.
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
- [DECIDED] Phrases that mean something particular in this game also show their rule in a tooltip, inside the card text and on the absorb screen, just like keywords. They're in `js/rules/terms.js`. So far: "When/Whenever this creature enters", "enters tapped", "at the beginning of your upkeep", "prepared", "you gain N life" / "gained life", "Sacrifice this creature", "your party" / "a full party", "artifacts you control", "transform it", "your life total", "your starting life total", and the {T} symbol.
- [DECIDED] Keywords that appear inside an ability's text (like "gains flying") don't get a tooltip. Only the ones on the keyword line do.
- [DECIDED] **Tapping ({T}):** the player always taps to attack, as in Magic. An ability with {T} taps them too, so using it ends their turn.
- [DECIDED] **"When this creature enters"** on the player's card means when combat starts. If a card exiles the player and returns them to the battlefield, they enter again and the ability triggers again, so it can trigger several times.
- [DECIDED] **"Enters tapped":** the player starts each combat tapped, so they pass their first turn.
- [DECIDED] **Upkeep:** "at the beginning of your upkeep" is the start of the player's turn.
- [DECIDED] **Prepared:** a card with a spell of its own (like Stingerquill Voxmancer) lets the player cast a copy of that spell while prepared. A copy doesn't go to the graveyard like the spells on the list, so being prepared again lets them cast it again.
- [DECIDED] **Gain life:** gaining life heals the player, but never above their toughness. ("You gain N life" and "gained life" show this in a tooltip.)
- [DECIDED] **"Sacrifice this creature"** on the player's card means the player sacrifices themselves: they die to trigger the effect.
- [DECIDED] **Slivers:** a Sliver's "Sliver creatures you control" includes the player themselves when they are a Sliver (and absorbing one makes them one). So a Sliver gives the player directly what it gives Slivers: its keywords go on the keyword line, with their tooltip.
- [DECIDED] The same goes for other creature types: "each Vampire you control" includes the player when they are a Vampire (Cordial Vampire). Text that says "other" or "another" ("Other Vampire creatures", "another Human") leaves the player out.
- [DECIDED] **Party:** a card's "party" is the group of players. It counts up to one each of Cleric, Rogue, Warrior and Wizard among their creature types; a full party has all four.
- [DECIDED] **The player's artifacts:** "artifacts you control" are only the player's own artifacts.
  - Chosen while implementing, not confirmed: the player counts, if they're an Artifact Creature, and so do the artifacts they absorbed.
- [DECIDED] **+1/+1 counters:** the player keeps track of them on the Player Card, with buttons under the card to add and remove them. The card's power and toughness include them.
  - Chosen while implementing, not confirmed: -1/-1 counters go in the same number, as a negative, because in Magic a +1/+1 and a -1/-1 counter cancel out.
- [DECIDED] **Combat bonuses:** bonuses worked out again during combat are kept on the Player Card, under the card, like the counters: "Bonus power" and "Bonus toughness". The card's power and toughness include them.
  - Chosen while implementing, not confirmed: the "Combat over" button resets them to 0 when combat ends (it also brings the spells back and turns the card back to its front). They also serve for other cards' "+N/+N until end of turn".
- [DECIDED] **Cards that transform** (double-faced, like Cecil, Dark Knight) transform for real. On absorbing one, the player gets the front face, and the Player Card can be turned over.
  - Turned over, the player loses what the front face gave them and gets what the back face gives, plus a stat bonus: the difference between the two faces. With Cecil: 2/3 against 4/4, so +2/+1, and Deathtouch and Darkness become Lifelink and Protect.
  - [DECIDED] On getting a transformation, the player can give that face another name and another photo, if they want. Without a name or photo of its own, it uses the usual ones.
  - [DECIDED] The dialog for that name and photo opens as soon as the player presses "Absorb", before the animation, so it can't be missed. The card is already saved by then, so reloading loses nothing; the absorb animation plays once the dialog is closed.
  - Chosen while implementing, not confirmed:
    - [DECIDED] Under the card, the button just says "Transform" (not the card's name). Turned over, it says "Turn back".
    - Under the card there's also "Edit other face" (which opens the name and photo again).
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

- [PENDING] How the card is renamed after opening a booster (section 4). Not built yet.

## 6. Keywords (table rules)

- [DECIDED] **Vigilance:** enemies focus their attacks on players with Vigilance. Text: "Enemies will focus their attacks on players with Vigilance." Replaces the earlier version ("becomes the focus of every enemy until they die").
- [DECIDED] **Bushido N:** whenever the player attacks someone or is attacked, they get +N/+N until end of turn, kept as combat bonuses. It stacks: Bushido 1 + Bushido 1 = Bushido 2. Text: "Whenever you attack or are attacked, you get +N/+N until end of turn."
- [DECIDED] **Haste:** goes first in the turn order (section 3). Text: "When combat starts, you go before everyone without haste. Everyone with haste rolls a d20 too, to set the order among them."
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
  player.css      Player Card, camera and art editor
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
    absorb.js     absorbing a card (pure)
    transform.js  cards that transform: turning the player's card over (pure)
    gear.js       Equipment, Auras and the spell list (pure)
    roster.js     the cards saved in this browser, and their storage keys (pure)
    absorb-animation.js  the absorb animation on the card
  rules/          the game's own rules, written by hand (pure data)
    keywords.js   what each keyword does in this game
    cards.js      what the player gets from each card's text
    terms.js      phrases in card text that mean something particular in this game, with their tooltip
  game/           doesn't exist yet; the Game part goes here
data/
  level1.json     test pool: the cards of level1.txt with their data and image links
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
- Hash navigation: `#game` and `#player-card`. Any other value shows home. Always use simple names (letters, numbers and dashes), no `#/route`.
- Style: a single dark theme, map-grid background, amber accent. Colors and fonts are variables on `:root`; reuse them in new screens.
- Fonts from Google Fonts (Grenze Gotisch for headings, Alegreya Sans for text), with fallback fonts.
- Footer with the notice that this is an unofficial fan project, not affiliated with Wizards of the Coast. Keep it.
- Don't use the official logo or card back. The identity's colors are shown with plain circles on the type line.
- [DECIDED] The mana cost is shown as on a real card, with mana icons. They're the SVG images Scryfall publishes (`https://svgs.scryfall.io/card-symbols/R.svg`), loaded like the card images. If one doesn't load, or it's a generic number above 20 (Scryfall has no image), a circle with the text is shown. Mana symbols inside ability text are drawn as icons too.
- [DECIDED] The card frame imitates real Magic cards and changes color with the identity: grey if colorless, its own color if it has one, gold if it has two or more. It's drawn in CSS (`css/card.css`), with no official frame images. When an absorbed card changes the identity, the frame shifts gradually to the new color.

## 10. Current state

The code is already split following the architecture in section 9.

- **Home:** done. Title, **Game** and **Player Card** buttons, and the sample starting card.
  - [DECIDED] The home card keeps the texts "Colorless. No abilities yet." and "Everyone walks in as a 1/1."
- **Player Card:** card creation, boosters, absorbing creatures, Equipment, items, Auras and the spell list, +1/+1 counters, combat bonuses and cards that transform are done. Still missing: the other counters (damage, mana, XP, level) and export/import.
  - [DECIDED] A browser can keep several player cards, for whoever wants more than one game. Going to Player Card with no cards starts a new one; with some, it shows a menu of the cards ("Your cards") to play one, delete one or make another.
  - Chosen while implementing, not confirmed: each card on the menu shows its photo, name, type line, power/toughness and how many cards it absorbed. From a card, "Your cards" (next to "Back to start") goes back to the menu, and coming to Player Card always opens on the menu. "Start over" became "Delete card", which goes back to the menu.
  - [DECIDED] On the flavor text screen, the "Open your first booster pack!" button opens the first booster.
  - The booster deals 3 cards from `data/level1.json`. Every card in the pool can come up. The player picks one, confirms it, sees how their card turns out and absorbs it.
  - [DECIDED] When absorbing, the values can be seen loading into the card: the creature flies into the card and each value that changes (power/toughness, colors, cost, types, abilities) updates in turn, with a caption saying what changed. With "reduce motion" turned on in the system, the card changes all at once.
  - [DECIDED] After the first absorption, the Player Card page shows only the current card.
  - Chosen while implementing, not confirmed: that view keeps the "Back to start" link and a discreet "Start over" under the card, along with the counters, the bonuses and the transform buttons.
  - [DECIDED] Under the card there's an "Open a booster" button, to keep opening boosters (and test the cards).
  - [PENDING] Whether that button stays as it is or boosters are earned some other way (on leveling up, section 4), and whether flavor text and art can be edited afterwards, since the card-only view doesn't have those controls.
  - An open booster stays saved until a card is absorbed. Closing it or reloading the page shows the same cards.
  - The card paints the player's color circles, and the type line shrinks to fit, like the name.
  - [DECIDED] Step 1: name the card. It stays set (see section 4).
  - [DECIDED] The name has no character limit. If it's long, the font shrinks to fit.
  - [DECIDED] Step 2: upload a photo or take one for the card art. It's saved only in the browser.
  - [DECIDED] The photo can be edited in basic ways: move, zoom and crop.
  - [DECIDED] Optional flavor text.
  - [DECIDED] The player's basic card has no default text.
  - Chosen while implementing, not confirmed: the photo can be skipped and changed later; flavor text has a maximum of 110 characters; the original photo is kept so it can be cropped again.
  - The list of cards is saved in `localStorage` under `mtdg.players`, and each card's sheet under `mtdg.player.<id>` (format version 10). The photos go in IndexedDB (database `mtdg`, keys `player.<id>.art` and `player.<id>.artSource`; the other face of a card that transforms uses `player.<id>.transform0.art`, etc.). The keys are in `js/player/roster.js`.
  - Before there could be several cards, the only card was saved under `mtdg.player` with its photos under `player.art`, `player.artSource` and `player.transform0.art`. When the page opens it becomes the first card of the list; the old keys are removed only once its photos are under the new ones.
  - When a card is made, the page asks the browser to keep the data (`navigator.storage.persist()`), so it isn't cleared when the device runs low on space. Safari on iPhone still clears a site's data after 7 days without visiting it, unless the page was added to the home screen; export/import (section 11) is the real backup.
  - Old saves are migrated automatically when the page opens:
    - Version 1 kept the photos inside the sheet.
    - Version 3 added absorbed cards and the open booster.
    - Version 4 keeps the full cost with its symbols. A version 3 cost only had the total, so it becomes generic mana ({2}).
    - Version 5 keeps keywords apart from the other abilities.
    - Version 6 adds the card types besides Creature. Saves from before version 6 start without card types, even if they absorbed an artifact or an enchantment.
    - Version 7 adds +1/+1 counters, version 8 combat bonuses, version 9 cards that transform and version 10 Equipment, Auras and the spell list.
- **Game:** empty screen marked "Not built yet".
- **Boosters:** the Player Card deals 3 different random cards from the `data/level1.json` pool, shows their images from Scryfall and lets the player pick one and confirm it with "Confirm". Each card's name shows on mouse hover, even if the image hasn't loaded. (The `BoosterTest.html` proof of concept, which dealt from the whole pool, was removed.)
  - `level1.txt` is the test card list (99 cards). The pool is rebuilt with `node scripts/build-pool.js level1.txt oracle-cards-YYYYMMDD.jsonl data/level1.json`.
  - Cards are looked up by name. Scryfall's file has a single printing per card, so the image may be from a different edition than the one in the list.
  - Images are requested from `cards.scryfall.io` with a plain `<img>` tag. No key is needed and no API calls, and Scryfall allows use from other sites.

## 11. Next steps

1. Character sheet: manual counters (damage, mana, XP, level), export/import.
2. The rules still WIP or pending: Deathtouch, Defender, Menace, "can't block", the formation, "until end of turn".
3. **Game** view: current room, monsters and room counter.

## 12. Discarded ideas

- **A shared seed** so every device generates the same thing: not needed, because the devices share nothing. Each phone opens its own boosters and the dungeon lives on a single screen.
- **A combat engine** that resolves turns and damage: the players do it at the table.
- **Effect primitives** to implement card text, and **classifying them with an LLM**: the app doesn't interpret cards and no LLM is used.
