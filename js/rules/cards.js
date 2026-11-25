/**
 * What the player gains from each card's rules text, decided card by card
 * (DESIGN.md, section 5). Keyed by the name of the part that gets absorbed: the
 * front face, or the creature of a card with an adventure.
 *
 *   keywords   names from rules/keywords.js. Always absorbed, drawbacks included.
 *   abilities  any other ability, written the way it reads on the player's card.
 *   power, toughness  what the card adds, for a stat it doesn't print as a number
 *              (like "*"). Without it the player is asked when absorbing.
 *   bonus      { power, toughness } added to the player's on top of the card's own
 *              stats, for a lord whose bonus reaches the player (a Sliver lord).
 *   grants     for an Equipment or an Aura: what the equipped or enchanted creature
 *              (the player) gets, { power, toughness, perColor, perEnchantment,
 *              keywords, abilities }. See player/gear.js. Abilities granted in quotes
 *              ("Equipped creature has '...'") are written as the player's own.
 *              Also for items (an artifact or enchantment that isn't an Equipment or
 *              Aura, like Seal of Fire): what having it gives.
 *              toggle { label, note }: a button that takes it off until combat is over.
 *   bonusNote  with bonus: why it reaches the player, for the absorb screen.
 *   chooseX    the card has {X} in its cost: the player picks X when absorbing it.
 *              Abilities can then be functions of X, returning the text.
 *   devotion   { power or toughness: 'W' | 'U' | 'B' | 'R' | 'G' }: the stat grows
 *              with the player's devotion to that color (player/absorb.js).
 *   transform  for a card that transforms: its back face, { name, power, toughness,
 *              keywords, abilities, keepFront }. Transformed, the player loses what the front
 *              gave and gets this instead; power and toughness are a bonus (see
 *              player/transform.js).
 *
 * A card with rules text that isn't listed here hasn't been reviewed yet:
 * absorbing it gives its stats, colors, cost and types, but none of its text.
 * Cards without rules text need no entry.
 *
 * Rules used again and again below (DESIGN.md, section 5):
 *   - "you control" counts only the player's own creatures, and the player counts
 *     as one of their own creature types; "other" and "another" leave them out.
 *   - "enters" is when combat starts; sacrificing itself means the player dies;
 *     {T} ends the player's turn; "until end of turn" bonuses go in the bonus power
 *     and toughness of the Player Card; +1/+1 counters go in its counters.
 *   - Abilities that make tokens are kept for when summoning comes to the game.
 *   - A card naming itself says "this creature" instead.
 *
 * Plain data, no DOM: tests can import it.
 */

/** "1 +1/+1 counter", "3 +1/+1 counters" */
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const counters = (n) => plural(n, '+1/+1 counter');

export const CARD_RULES = {
  'Akki Ember-Keeper': {
    abilities: ['Whenever a nontoken modified creature you control dies, create a 1/1 colorless Spirit creature token. (Equipment, Auras you control, and counters are modifications.)'],
  },
  'Alseid of Life\'s Bounty': {
    keywords: ['Lifelink'],
    abilities: ['{1}, Sacrifice this creature: Target creature or enchantment you control gains protection from the color of your choice until end of turn.'],
  },
  'Ankle Biter': { keywords: ['Deathtouch'] },
  'Arboreal Grazer': {
    keywords: ['Reach'],
    abilities: ['When this creature enters, you may put a land card from your hand onto the battlefield tapped.'],
  },
  'Arcbound Javelineer': {
    keywords: ['Modular 1'],
    abilities: ['{T}, Remove X +1/+1 counters from this creature: It deals X damage to target attacking or blocking creature.'],
  },
  'Arcbound Mouser': { keywords: ['Lifelink', 'Modular 1'] },
  'Arcbound Worker': { keywords: ['Modular 1'] },
  // Its */2 doesn't replace the player's power: it adds 0, and the first ability
  // becomes a bonus worked out again each combat. The party is the group of players.
  'Archpriest of Iona': {
    power: 0,
    abilities: [
      'During combat, this creature gets +X/+0, where X is the number of creatures in your party. (Your party consists of up to one each of Cleric, Rogue, Warrior, and Wizard.)',
      'At the beginning of combat on your turn, if you have a full party, target creature gets +1/+1 and gains flying until end of turn.',
    ],
  },
  'Ardent Recruit': {
    abilities: ['Metalcraft — This creature gets +2/+2 as long as you control three or more artifacts.'],
  },
  // Monsters may cast spells, so Ward stays.
  'Armored Armadillo': {
    keywords: ['Ward {1}'],
    abilities: ['{3}{W}: This creature gets +X/+0 until end of turn, where X is its toughness.'],
  },
  'Assassin Initiate': {
    abilities: ['{1}: This creature gains your choice of flying, deathtouch, or lifelink until end of turn.'],
  },
  // Madness stays in case hands and discarding come to the game.
  'Blazing Rootwalla': {
    keywords: ['Madness {0}'],
    abilities: ['{R}: This creature gets +2/+0 until end of turn. Activate only once each turn.'],
  },
  // "This turn" becomes "this round": another player can deal the damage first.
  'Bloodcrazed Goblin': {
    abilities: ['This creature can\'t attack unless an opponent has been dealt damage this round.'],
  },
  'Boggart Cursecrafter': {
    keywords: ['Deathtouch'],
    abilities: ['Whenever another Goblin you control dies, this creature deals 1 damage to each opponent.'],
  },
  'Captivating Vampire': {
    abilities: [
      'Other Vampire creatures you control get +1/+1.',
      'Tap five untapped Vampires you control: Gain control of target creature. It becomes a Vampire in addition to its other types.',
    ],
  },
  // Transforms for real: the Player Card turns over. The back face is a +2/+1
  // bonus (4/4 against its 2/3) with its own abilities.
  'Cecil, Dark Knight': {
    keywords: ['Deathtouch'],
    abilities: ['Darkness — Whenever this creature deals damage, you lose that much life. Then if your life total is less than or equal to half your starting life total, untap this creature and transform it.'],
    transform: {
      name: 'Cecil, Redeemed Paladin',
      power: 2,
      toughness: 1,
      keywords: ['Lifelink'],
      abilities: ['Protect — Whenever this creature attacks, other attacking creatures gain indestructible until end of turn.'],
    },
  },
  'Champion of the Parish': {
    abilities: ['Whenever another Human you control enters, put a +1/+1 counter on this creature.'],
  },
  /*
   * ----- First cards (akashicos.txt) -----
   * Rules for them (DESIGN.md, section 5, "First cards"):
   *   - Text about drawing, discarding, the library, the hand, the graveyard, scry,
   *     mill and Commander stays on the card with a WIP tooltip (rules/terms.js).
   *   - Text about the card itself as a card (cast from hand, discard this card,
   *     return this card from the graveyard, can't be countered) is left out.
   *   - "Opponent" is a monster; "player" is players and monsters alike.
   *   - Abilities written as functions get the X the player picked (chooseX).
   *   - devotion: { power or toughness: color } is counted from the player's mana
   *     cost, and kept up to date (player/absorb.js, devotionBonus).
   */
  // Monsters have no hand: it adds 0/0.
  'Adamaro, First to Desire': {
    power: 0,
    toughness: 0,
    abilities: ['This creature\'s power and toughness are each equal to the number of cards in the hand of the opponent with the most cards in hand.'],
  },
  // The player is a Wizard, so the bonus reaches them.
  'Adeliz, the Cinder Wind': {
    keywords: ['Flying', 'Haste'],
    abilities: ['Whenever you cast an instant or sorcery spell, Wizards you control get +1/+1 until end of turn.'],
  },
  'Akiri, Line-Slinger': {
    keywords: ['First strike', 'Vigilance', 'Partner'],
    abilities: ['This creature gets +1/+0 for each artifact you control.'],
  },
  'Alesha, Who Laughs at Fate': {
    keywords: ['First strike'],
    abilities: [
      'Whenever this creature attacks, put a +1/+1 counter on it.',
      'Raid — At the beginning of your end step, if you attacked this turn, return target creature card with mana value less than or equal to this creature\'s power from your graveyard to the battlefield.',
    ],
  },
  'Alirios, Enraptured': {
    abilities: [
      'This creature enters tapped.',
      'This creature doesn\'t untap during your untap step if you control a Reflection.',
      'When this creature enters, create a 3/2 blue Reflection creature token.',
    ],
  },
  'Alisaie Leveilleur': {
    keywords: ['Partner with Alphinaud Leveilleur', 'First strike'],
    abilities: ['Dualcast — The second spell you cast each turn costs {2} less to cast.'],
  },
  'Alphinaud Leveilleur': {
    keywords: ['Partner with Alisaie Leveilleur', 'Vigilance'],
    abilities: ['Eukrasia — Whenever you cast your second spell each turn, draw a card.'],
  },
  'Anafenza, Unyielding Lineage': {
    keywords: ['Flash', 'First strike'],
    abilities: ['Whenever another nontoken creature you control dies, this creature endures 2. (Put two +1/+1 counters on it or create a 2/2 white Spirit creature token.)'],
  },
  'Anax and Cymede': {
    keywords: ['First strike', 'Vigilance'],
    abilities: ['Heroic — Whenever you cast a spell that targets this creature, creatures you control get +1/+1 and gain trample until end of turn.'],
  },
  'Anep, Vizier of Hazoret': {
    keywords: ['Trample'],
    abilities: ['You may exert this creature as it attacks. When you do, exile the top two cards of your library. Until the end of your next turn, you may play those cards. (An exerted creature won\'t untap during your next untap step.)'],
  },
  'Animar, Soul of Elements': {
    keywords: ['Protection from white and from black'],
    abilities: [
      'Whenever you cast a creature spell, put a +1/+1 counter on this creature.',
      'Creature spells you cast cost {1} less to cast for each +1/+1 counter on this creature.',
    ],
  },
  'April O\'Neil, Kunoichi Trainee': {
    abilities: [
      'When this creature enters, scry 2. (Look at the top two cards of your library, then put any number of them on the bottom and the rest on top in any order.)',
      'This creature can\'t be blocked by creatures with power 3 or greater.',
    ],
  },
  'Aragorn, the Uniter': {
    abilities: [
      'Whenever you cast a white spell, create a 1/1 white Human Soldier creature token.',
      'Whenever you cast a blue spell, scry 2.',
      'Whenever you cast a red spell, this creature deals 3 damage to target opponent.',
      'Whenever you cast a green spell, target creature gets +4/+4 until end of turn.',
    ],
  },
  // The player is legendary, so they get the counters too.
  'Ardbert, Warrior of Darkness': {
    abilities: [
      'Whenever you cast a white spell, put a +1/+1 counter on each legendary creature you control. They gain vigilance until end of turn.',
      'Whenever you cast a black spell, put a +1/+1 counter on each legendary creature you control. They gain menace until end of turn.',
    ],
  },
  'Arwen Undómiel': {
    abilities: ['Whenever you scry, put a +1/+1 counter on target creature.', '{4}{G}{U}: Scry 2.'],
  },
  'Astrid Peth': {
    abilities: [
      'Whenever this creature enters or attacks, create a Food token.',
      'Brand-new Sky — Whenever you sacrifice a Clue or Food, this creature explores. (Reveal the top card of your library. Put that card into your hand if it\'s a land. Otherwise, put a +1/+1 counter on this creature, then put the card back or put it into your graveyard.)',
    ],
  },
  'Azog, Moria\'s Ruin': {
    abilities: ['When this creature enters, destroy up to one other target creature. Its controller amasses Goblins X, where X is that creature\'s power. If you controlled that creature, draw a card. (To amass Goblins X, that player puts X +1/+1 counters on an Army they control. It\'s also a Goblin. If they don\'t control an Army, they create a 0/0 black Goblin Army creature token first.)'],
  },
  'Bard the Bowman': {
    keywords: ['Reach'],
    abilities: ['Whenever you draw your second card each turn, put a +1/+1 counter on target creature. It gains lifelink until end of turn.'],
  },
  'Bard, Heir of Girion': {
    keywords: ['Reach', 'Vigilance'],
    abilities: ['Other creatures you control get +1/+1.', 'Whenever you attack, draw a card.'],
  },
  'Baylen, the Haymaker': {
    abilities: [
      'Tap two untapped tokens you control: Add one mana of any color.',
      'Tap three untapped tokens you control: Draw a card.',
      'Tap four untapped tokens you control: Put three +1/+1 counters on this creature. It gains trample until end of turn.',
    ],
  },
  // Listed as Benny, Platinum Thief.
  'Tinybones, Trinket Thief': {
    abilities: [
      'At the beginning of each end step, if an opponent discarded a card this turn, you draw a card and you lose 1 life.',
      '{4}{B}{B}: Each opponent with no cards in hand loses 10 life.',
    ],
  },
  'Beverly Crusher, Ship\'s Doctor': {
    abilities: ['Seek out — Whenever you draw your second card each turn, put a +1/+1 counter on each of up to three target creatures.'],
  },
  // Only the creature, not its adventure (like Smitten Swordmaster).
  'Bilbo Baggins, Burglar': { abilities: ['When this creature enters, draw a card.'] },
  'Bilbo, Luckwearer': {
    abilities: ['This creature can\'t be blocked.', 'Whenever this creature deals combat damage to a player, draw a card, then discard a card.'],
  },
  'Bilbo, Thief in the Night': {
    abilities: [
      'Spells you cast from anywhere other than your hand cost {1} less to cast.',
      'Whenever this creature attacks, you may cast an artifact, instant, or sorcery spell from your graveyard. If an instant or sorcery spell cast this way would be put into your graveyard, exile it instead.',
    ],
  },
  'Black Waltz No. 3': {
    keywords: ['Flying', 'Deathtouch'],
    abilities: ['Whenever you cast a noncreature spell, this creature deals 2 damage to each opponent.'],
  },
  'Bombur, Gentle Dreamer': {
    abilities: [
      'Storied (If you control three or more artifacts, legendaries, and/or Sagas, you have an enduring story for the rest of the game.)',
      'This creature doesn\'t untap during your untap step unless you have an enduring story.',
    ],
  },
  // "The Ring tempts you" is left out.
  'Boromir, Warden of the Tower': {
    keywords: ['Vigilance'],
    abilities: [
      'Whenever an opponent casts a spell, if no mana was spent to cast it, counter that spell.',
      'Sacrifice this creature: Creatures you control gain indestructible until end of turn.',
    ],
  },
  'Brigone, Soldier of Meletis': {
    keywords: ['Vigilance'],
    abilities: [
      'Heroic — Whenever you cast a spell that targets this creature, put a +1/+1 counter on it.',
      '{T}, Remove a +1/+1 counter from this creature: Draw a card.',
    ],
  },
  'Brothers Yamazaki': {
    keywords: ['Bushido 1'],
    abilities: [
      'If there are exactly two permanents named Brothers Yamazaki on the battlefield, the "legend rule" doesn\'t apply to them.',
      'Each other creature named Brothers Yamazaki gets +2/+2 and has haste.',
    ],
  },
  'Calix, Guided by Fate': {
    abilities: [
      'Constellation — Whenever this creature or another enchantment you control enters, put a +1/+1 counter on target creature.',
      'Whenever this creature or an enchanted creature you control deals combat damage to a player, you may create a token that\'s a copy of a nonlegendary enchantment you control. Do this only once each turn.',
    ],
  },
  'Callaphe, Beloved of the Sea': {
    power: 0,
    devotion: { power: 'U' },
    abilities: [
      'This creature gets +X/+0, where X is your devotion to blue: each blue mana symbol in your mana cost.',
      'Creatures and enchantments you control have "Spells your opponents cast that target this permanent cost {1} more to cast."',
    ],
  },
  'Cleon, Merry Champion': {
    keywords: ['Double strike'],
    abilities: ['Heroic — Whenever you cast a spell that targets this creature, exile the top card of your library. You may play that card until the end of your next turn.'],
  },
  'Colleen Wing, Street Samurai': {
    abilities: ['Whenever you cast a spell that targets a creature you control, put a +1/+1 counter on this creature. Scry 1. (Look at the top card of your library. You may put that card on the bottom.)'],
  },
  'Danitha, Spear of Agony': {
    keywords: ['First strike'],
    abilities: ['Whenever you cast a spell that targets an opponent or a creature an opponent controls, put a +1/+1 counter on this creature.'],
  },
  'Danitha, Sword of Hope': {
    keywords: ['First strike'],
    abilities: ['Whenever you cast an Equipment spell or a spell that targets a creature you control, draw a card. This ability triggers only once each turn.'],
  },
  'Daxos, Blessed by the Sun': {
    toughness: 0,
    devotion: { toughness: 'W' },
    abilities: [
      'This creature gets +0/+X, where X is your devotion to white: each white mana symbol in your mana cost.',
      'Whenever another creature you control enters or dies, you gain 1 life.',
    ],
  },
  'Doran, Besieged by Time': {
    abilities: [
      'Each creature spell you cast with toughness greater than its power costs {1} less to cast.',
      'Whenever a creature you control attacks or blocks, it gets +X/+X until end of turn, where X is the difference between its power and toughness.',
    ],
  },
  'Doran, the Siege Tower': {
    abilities: ['Each creature assigns combat damage equal to its toughness rather than its power.'],
  },
  'Echo, Perceptive Prodigy': {
    keywords: ['Vigilance'],
    abilities: ['{1}, {T}: Copy target activated or triggered ability you control from a creature source. You may choose new targets for the copy. (Mana abilities can\'t be targeted.)'],
  },
  'Emet-Selch, Unsundered': {
    keywords: ['Vigilance'],
    abilities: [
      'Whenever this creature enters or attacks, draw a card, then discard a card.',
      'At the beginning of your upkeep, if there are fourteen or more cards in your graveyard, you may transform this creature.',
    ],
    // 6/6 against 2/4.
    transform: {
      name: 'Hades, Sorcerer of Eld',
      power: 4,
      toughness: 2,
      keywords: ['Vigilance'],
      abilities: [
        'Echo of the Lost — During your turn, you may play cards from your graveyard.',
        'If a card or token would be put into your graveyard from anywhere, exile it instead.',
      ],
    },
  },
  // Flipped, it keeps its front face's text and adds the Essence's (keepFront).
  'Erayo, Soratami Ascendant': {
    keywords: ['Flying'],
    abilities: ['Whenever the fourth spell of a turn is cast, flip this creature.'],
    transform: {
      name: 'Erayo\'s Essence',
      power: 0,
      toughness: 0,
      keepFront: true,
      abilities: ['Whenever an opponent casts their first spell each turn, counter that spell.'],
    },
  },
  'Esior, Wardwing Familiar': {
    keywords: ['Flying', 'Partner'],
    abilities: ['Spells your opponents cast that target one or more commanders you control cost {3} more to cast.'],
  },
  'Flubs, the Fool': {
    abilities: [
      'You may play an additional land on each of your turns.',
      'Whenever you play a land or cast a spell, draw a card if you have no cards in hand. Otherwise, discard a card.',
    ],
  },
  'Geist of Saint Thalia': {
    keywords: ['Flying'],
    abilities: ['Noncreature spells you cast cost {1} less to cast.'],
  },
  'Gluntch, the Bestower': {
    keywords: ['Flying'],
    abilities: ['At the beginning of your end step, choose a player. They put two +1/+1 counters on a creature they control. Choose a second player to draw a card. Then choose a third player to create two Treasure tokens.'],
  },
  'Goreclaw, Terror of Qal Sisma': {
    abilities: [
      'Creature spells you cast with power 4 or greater cost {2} less to cast.',
      'Whenever this creature attacks, each creature you control with power 4 or greater gets +1/+1 and gains trample until end of turn.',
    ],
  },
  'Gran-Gran': {
    abilities: [
      'Whenever this creature becomes tapped, draw a card, then discard a card.',
      'Noncreature spells you cast cost {1} less to cast as long as there are three or more Lesson cards in your graveyard.',
    ],
  },
  'Greta, Sweettooth Scourge': {
    abilities: [
      'When this creature enters, create a Food token. (It\'s an artifact with "{2}, {T}, Sacrifice this token: You gain 3 life.")',
      '{G}, Sacrifice a Food: Put a +1/+1 counter on target creature. Activate only as a sorcery.',
      '{1}{B}, Sacrifice a Food: You draw a card and you lose 1 life.',
    ],
  },
  'Grismold, the Dreadsower': {
    keywords: ['Trample'],
    abilities: [
      'At the beginning of your end step, each player creates a 1/1 green Plant creature token.',
      'Whenever a creature token dies, put a +1/+1 counter on this creature.',
    ],
  },
  'Hapatra, Vizier of Poisons': {
    abilities: [
      'Whenever this creature deals combat damage to a player, you may put a -1/-1 counter on target creature.',
      'Whenever you put one or more -1/-1 counters on a creature, create a 1/1 green Snake creature token with deathtouch.',
    ],
  },
  'Hawkeye, Bowslinger': {
    keywords: ['Reach', 'Vigilance'],
    abilities: ['Whenever you cast a spell that targets a creature, put a +1/+1 counter on this creature. Scry 1. (Look at the top card of your library. You may put that card on the bottom.)'],
  },
  'Hobgoblin, Mantled Marauder': {
    keywords: ['Flying', 'Haste'],
    abilities: ['Whenever you discard a card, this creature gets +2/+0 until end of turn.'],
  },
  'Jackal, Genius Geneticist': {
    keywords: ['Trample'],
    abilities: ['Whenever you cast a creature spell with mana value equal to this creature\'s power, copy that spell, except the copy isn\'t legendary. Then put a +1/+1 counter on this creature. (The copy becomes a token.)'],
  },
  // It makes the player green, so its bonus to green creatures they control is theirs, like a Sliver lord's.
  'Jacques le Vert': {
    bonus: { power: 0, toughness: 2 },
    bonusNote: 'You become green, so its bonus to green creatures you control is yours too.',
  },
  'Jadar, Ghoulcaller of Nephalia': {
    abilities: ['At the beginning of your end step, if you control no creatures with decayed, create a 2/2 black Zombie creature token with decayed. (It can\'t block. When it attacks, sacrifice it at end of combat.)'],
  },
  'Kalitas, Traitor of Ghet': {
    keywords: ['Lifelink'],
    abilities: [
      'If a nontoken creature an opponent controls would die, instead exile that card and create a 2/2 black Zombie creature token.',
      '{2}{B}, Sacrifice another Vampire or Zombie: Put two +1/+1 counters on this creature.',
    ],
  },
  'Kiku, Night\'s Flower': {
    abilities: ['{2}{B}{B}, {T}: Target creature deals damage to itself equal to its power.'],
  },
  'Kitsa, Otterball Elite': {
    keywords: ['Vigilance', 'Prowess'],
    abilities: [
      '{T}: Draw a card, then discard a card.',
      '{2}, {T}: Copy target instant or sorcery spell you control. You may choose new targets for the copy. Activate only if this creature\'s power is 3 or greater.',
    ],
  },
  'Krark, the Thumbless': {
    keywords: ['Partner'],
    abilities: ['Whenever you cast an instant or sorcery spell, flip a coin. If you lose the flip, return that spell to its owner\'s hand. If you win the flip, copy that spell, and you may choose new targets for the copy.'],
  },
  'Kydele, Chosen of Kruphix': {
    keywords: ['Partner'],
    abilities: ['{T}: Add {C} for each card you\'ve drawn this turn.'],
  },
  'Laelia, the Blade Reforged': {
    keywords: ['Haste'],
    abilities: [
      'Whenever this creature attacks, exile the top card of your library. You may play that card this turn.',
      'Whenever one or more cards are put into exile from your library and/or your graveyard, put a +1/+1 counter on this creature.',
    ],
  },
  'Liliana the Repentant': {
    abilities: [
      'Whenever another creature or planeswalker you control enters, mill two cards.',
      'Exhaust — {5}{B}: Return target creature or planeswalker card from your graveyard to the battlefield. Put a +1/+1 counter on this creature. Activate only as a sorcery. (Activate each exhaust ability only once.)',
    ],
  },
  // It makes the player an Artifact Creature, so its bonus is theirs, like a Sliver lord's.
  // "Discard this card" is left out.
  'Locutus, the One Who Speaks': {
    bonus: { power: 1, toughness: 1 },
    bonusNote: 'You become an Artifact Creature, so its bonus to artifact creatures you control is yours too.',
  },
  'Longshot, Rebel Bowman': {
    keywords: ['Reach'],
    abilities: [
      'Noncreature spells you cast cost {1} less to cast.',
      'Whenever you cast a noncreature spell, this creature deals 2 damage to each opponent.',
    ],
  },
  'Loot, the Anomaly': {
    abilities: [
      'If this creature\'s power is negative, it assigns combat damage as though its power were positive.',
      'Threshold — Sacrifice another creature or planeswalker: This creature gets -2/-0 until end of turn. Activate only if there are seven or more cards in your graveyard.',
    ],
  },
  'Lotho, Corrupt Shirriff': {
    abilities: ['Whenever a player casts their second spell each turn, you lose 1 life and create a Treasure token. (It\'s an artifact with "{T}, Sacrifice this token: Add one mana of any color.")'],
  },
  'Mahadi, Emporium Master': {
    abilities: ['At the beginning of your end step, create a Treasure token for each creature that died this turn. (It\'s an artifact with "{T}, Sacrifice this token: Add one mana of any color.")'],
  },
  'Mai, Scornful Striker': {
    keywords: ['First strike'],
    abilities: ['Whenever a player casts a noncreature spell, they lose 2 life.'],
  },
  'Malcolm, the Eyes': {
    keywords: ['Flying', 'Haste'],
    abilities: ['Whenever you cast your second spell each turn, investigate. (Create a Clue token. It\'s an artifact with "{2}, Sacrifice this token: Draw a card.")'],
  },
  'Mangara, the Diplomat': {
    keywords: ['Lifelink'],
    abilities: [
      'Whenever an opponent attacks with creatures, if two or more of those creatures are attacking you and/or planeswalkers you control, draw a card.',
      'Whenever an opponent casts their second spell each turn, draw a card.',
    ],
  },
  // The player is a Halfling, so their own attacks count.
  'Meriadoc Brandybuck': {
    abilities: ['Whenever one or more Halflings you control attack a player, create a Food token. (It\'s an artifact with "{2}, {T}, Sacrifice this token: You gain 3 life.")'],
  },
  'Mikaeus, the Lunarch': {
    chooseX: true,
    abilities: [
      (x) => `This creature enters with ${counters(x)} on it.`,
      '{T}: Put a +1/+1 counter on this creature.',
      '{T}, Remove a +1/+1 counter from this creature: Put a +1/+1 counter on each other creature you control.',
    ],
  },
  // Sneak (cast from hand) is left out.
  'Oroku Saki, Shredder Rising': {
    abilities: ['Whenever this creature deals combat damage to a player, you draw a card and lose 1 life.'],
  },
  'Pippin, Guard of the Citadel': {
    keywords: ['Vigilance', 'Ward {1}'],
    abilities: ['{T}: Another target creature you control gains protection from the card type of your choice until end of turn. (It can\'t be blocked, targeted, dealt damage, enchanted, or equipped by anything of that type.)'],
  },
  'Pippin, Warden of Isengard': {
    keywords: ['Partner with Merry, Warden of Isengard'],
    abilities: [
      '{1}, {T}: Create a Food token.',
      '{T}, Sacrifice four Foods: Other creatures you control get +3/+3 and gain haste until end of turn. Activate only as a sorcery.',
    ],
  },
  'Professor Zei, Anthropologist': {
    abilities: [
      '{T}, Discard a card: Draw a card.',
      '{1}, {T}, Sacrifice this creature: Return target instant or sorcery card from your graveyard to your hand. Activate only during your turn.',
    ],
  },
  'Prompto Argentum': {
    keywords: ['Haste'],
    abilities: ['Selfie Shot — Whenever you cast a noncreature spell, if at least four mana was spent to cast it, create a Treasure token.'],
  },
  // Listed as Renfield, Delusional Minion.
  'Eruth, Tormented Prophet': {
    abilities: ['If you would draw a card, exile the top two cards of your library instead. You may play those cards this turn.'],
  },
  'Reyav, Master Smith': {
    abilities: ['Whenever a creature you control that\'s enchanted or equipped attacks, that creature gains double strike until end of turn.'],
  },
  'Rona, Herald of Invasion': {
    abilities: [
      'Whenever you cast a legendary spell, untap this creature.',
      '{T}: Draw a card, then discard a card.',
      '{5}{B/P}: Transform this creature. Activate only as a sorcery. ({B/P} can be paid with either {B} or 2 life.)',
    ],
    // 5/5 against 1/3.
    transform: {
      name: 'Rona, Tolarian Obliterator',
      power: 4,
      toughness: 2,
      keywords: ['Trample'],
      abilities: ['Whenever a source deals damage to this creature, that source\'s controller exiles a card from their hand at random. If it\'s a land card, you may put it onto the battlefield under your control. Otherwise, you may cast it without paying its mana cost.'],
    },
  },
  'Samut, Vizier of Naktamun': {
    keywords: ['First strike', 'Vigilance', 'Haste'],
    abilities: ['Whenever a creature you control deals combat damage to a player, if that creature entered this turn, draw a card.'],
  },
  'Sergeant John Benton': {
    keywords: ['Trample', 'Haste'],
    abilities: ['Share Intelligence — Whenever this creature deals combat damage to a player, you and that player each draw that many cards.'],
  },
  'Shang-Chi and the Ten Rings': {
    keywords: ['First strike'],
    abilities: [
      'Whenever you draw a card, put a +1/+1 counter on this creature.',
      'When the tenth +1/+1 counter is put on this creature, you draw five cards and gain 5 life.',
    ],
  },
  'Shay Cormac': {
    abilities: [
      '{1}: Permanents your opponents control lose hexproof, indestructible, protection, shroud, and ward until end of turn.',
      'Whenever a creature an opponent controls becomes the target of a spell or ability you control, put a bounty counter on that creature.',
      'Whenever a creature with a bounty counter on it dies, put two +1/+1 counters on this creature.',
    ],
  },
  // "This spell can't be countered" is left out.
  'Surrak, Elusive Hunter': {
    keywords: ['Trample'],
    abilities: ['Whenever a creature you control or a creature spell you control becomes the target of a spell or ability an opponent controls, draw a card.'],
  },
  'Sygg, River Cutthroat': {
    abilities: ['At the beginning of each end step, if an opponent lost 3 or more life this turn, you may draw a card. (Damage causes loss of life.)'],
  },
  'Tam, Mindful First-Year': {
    abilities: [
      'Each other creature you control has hexproof from each of its colors.',
      '{T}: Target creature you control becomes all colors until end of turn.',
    ],
  },
  'Thalia, Guardian of Thraben': {
    keywords: ['First strike'],
    abilities: ['Noncreature spells cost {1} more to cast.'],
  },
  'The Emperor of Palamecia': {
    abilities: [
      '{T}: Add {U} or {R}. Spend this mana only to cast a noncreature spell.',
      'Whenever you cast a noncreature spell, if at least four mana was spent to cast it, put a +1/+1 counter on this creature. Then if it has three or more +1/+1 counters on it, transform it.',
    ],
    // 3/3 against 2/2.
    transform: {
      name: 'The Lord Master of Hell',
      power: 1,
      toughness: 1,
      abilities: ['Starfall — Whenever this creature attacks, it deals X damage to each opponent, where X is the number of noncreature, nonland cards in your graveyard.'],
    },
  },
  'The Goose Mother': {
    chooseX: true,
    keywords: ['Flying'],
    abilities: [
      (x) => `This creature enters with ${counters(x)} on it.`,
      (x) => `When this creature enters, create ${plural(Math.ceil(x / 2), 'Food token')}.`,
      'Whenever this creature attacks, you may sacrifice a Food. If you do, draw a card.',
    ],
  },
  'The Raven Man': {
    abilities: [
      'At the beginning of each end step, if a player discarded a card this turn, create a 1/1 black Bird creature token with flying and "This token can\'t block."',
      '{3}{B}, {T}: Each opponent discards a card. Activate only as a sorcery.',
    ],
  },
  'Tinybones, Bauble Burglar': {
    abilities: [
      'Whenever an opponent discards a card, exile it from their graveyard with a stash counter on it.',
      'During your turn, you may play cards you don\'t own with stash counters on them from exile, and mana of any type can be spent to cast those spells.',
      '{3}{B}, {T}: Each opponent discards a card. Activate only as a sorcery.',
    ],
  },
  'Tinybones, Pocket Nuisance': {
    abilities: [
      'When this creature enters, each opponent discards a card.',
      'Whenever a player discards one or more cards, this creature deals 1 damage to each opponent.',
    ],
  },
  'Tomik, Izzet Sparkmage': {
    keywords: ['Prowess'],
    abilities: ['If a source you control would deal noncombat damage to an opponent or a permanent an opponent controls, it deals that much damage plus 1 instead.'],
  },
  'Trelasarra, Moon Dancer': {
    abilities: ['Whenever you gain life, put a +1/+1 counter on this creature and scry 1. (Look at the top card of your library. You may put that card on the bottom.)'],
  },
  'Tymaret, Chosen from Death': {
    toughness: 0,
    devotion: { toughness: 'B' },
    abilities: [
      'This creature gets +0/+X, where X is your devotion to black: each black mana symbol in your mana cost.',
      '{1}{B}: Exile up to two target cards from graveyards. You gain 1 life for each creature card exiled this way.',
    ],
  },
  'Ultros, Obnoxious Octopus': {
    abilities: [
      'Whenever you cast a noncreature spell, if at least four mana was spent to cast it, tap target creature an opponent controls and put a stun counter on it. (If a permanent with a stun counter would become untapped, remove one from it instead.)',
      'Whenever you cast a noncreature spell, if at least eight mana was spent to cast it, put eight +1/+1 counters on this creature.',
    ],
  },
  'Urdnan, Dromoka Warrior': {
    abilities: [
      'When this creature enters, put a +1/+1 counter on target creature.',
      'Whenever you attack, target attacking creature with a +1/+1 counter on it gains first strike until end of turn. If that creature has two or more +1/+1 counters on it, it gains double strike until end of turn instead.',
    ],
  },
  'Vadmir, New Blood': {
    abilities: [
      'Whenever you commit a crime, put a +1/+1 counter on this creature. This ability triggers only once each turn. (Targeting opponents, anything they control, and/or cards in their graveyards is a crime.)',
      'As long as this creature has four or more +1/+1 counters on it, it has menace and lifelink.',
    ],
  },
  'Vnwxt, Verbose Host': {
    abilities: [
      'Start your engines! (If you have no speed, it starts at 1. It increases once on each of your turns when an opponent loses life. Max speed is 4.)',
      'You have no maximum hand size.',
      'Max speed — If you would draw a card, draw two cards instead.',
    ],
  },
  'Wan Shi Tong, Librarian': {
    chooseX: true,
    keywords: ['Flash', 'Flying', 'Vigilance'],
    abilities: [
      (x) => `When this creature enters, put ${counters(x)} on it. Then draw ${plural(Math.floor(x / 2), 'card')}.`,
      'Whenever an opponent searches their library, put a +1/+1 counter on this creature and draw a card.',
    ],
  },
  // "This spell can't be countered" is left out.
  'Wilson, Refined Grizzly': {
    keywords: ['Reach', 'Vigilance', 'Trample', 'Ward {2}', 'Choose a Background'],
  },
  // Returning this card from the graveyard is left out.
  'Winter Soldier, Icy Assassin': {
    keywords: ['Vigilance', 'Menace'],
    abilities: ['This creature gets +2/+0 for each Equipment attached to it.'],
  },
  'Yume, Chronicler of Valor': {
    abilities: ['The first spell you cast during each of your turns has assist. When you cast that spell, if another player spent mana to cast it, you and that player each draw a card. (As you cast a spell with assist, you may choose another player. They may pay some or all of the generic mana in the spell\'s cost.)'],
  },
  /* ----- Equipment: the player equips it on absorbing it (no Equip cost). ----- */
  '+2 Mace': { grants: { power: 2, toughness: 2 } },
  'Arc Spitter': { grants: { abilities: ['{1}: This creature deals 1 damage to target creature that\'s blocking it.'] } },
  'Blade of the Bloodchief': {
    grants: { abilities: ['Whenever a creature dies, put a +1/+1 counter on this creature. If this creature is a Vampire, put two +1/+1 counters on it instead.'] },
  },
  // Sacrificing it means pressing "Destroyed" on the Player Card.
  // Unattached, it comes off until the next combat, then it's back on by itself.
  'Blinding Powder': {
    grants: {
      abilities: ['Unattach Blinding Powder: Prevent all combat damage that would be dealt to this creature this turn.'],
      toggle: { label: 'Unattach', note: 'Unattached until combat is over.' },
    },
  },
  'Blazing Torch': {
    grants: {
      abilities: [
        'This creature can\'t be blocked by Vampires or Zombies.',
        '{T}, Sacrifice Blazing Torch: Blazing Torch deals 2 damage to any target.',
      ],
    },
  },
  'Bronze Sword': { grants: { power: 2 } },
  'Cathar\'s Shield': { grants: { toughness: 3, keywords: ['Vigilance'] } },
  'Honed Khopesh': { grants: { power: 1, toughness: 1 } },
  'Kor Halberd': { grants: { power: 1, toughness: 1, keywords: ['Vigilance'] } },
  'Spidersilk Net': { grants: { toughness: 2, keywords: ['Reach'] } },

  /* ----- Auras: the player enchants themselves for good. ----- */
  'Arcane Flight': { grants: { power: 1, toughness: 1, keywords: ['Flying'] } },
  'Armor of Faith': { grants: { power: 1, toughness: 1, abilities: ['{W}: This creature gets +0/+1 until end of turn.'] } },
  'Blessing of the Nephilim': { grants: { perColor: { power: 1, toughness: 1 } } },
  // Instead of "Sacrifice this Aura: Regenerate": when the player dies, they come back
  // without it, and it returns when combat is over.
  'Carapace': {
    grants: {
      toughness: 2,
      abilities: ['When you would die, you come back instead, without Carapace. Carapace returns when combat is over.'],
      toggle: { label: 'Revived', note: 'Gone until combat is over: it brought you back.' },
    },
  },
  // Starts on, like any Aura. "Target creature can't block this turn" is WIP (rules/terms.js).
  'Cartouche of Zeal': {
    grants: {
      power: 1,
      toughness: 1,
      keywords: ['Haste'],
      abilities: ['When this Aura enters, target creature can\'t block this turn.'],
    },
  },
  'Deviant Glee': { grants: { power: 2, toughness: 1, abilities: ['{R}: This creature gains trample until end of turn.'] } },
  // The enchantments the player controls are their Auras.
  'Ethereal Armor': { grants: { perEnchantment: { power: 1, toughness: 1 }, keywords: ['First strike'] } },
  'Flowstone Blade': { grants: { abilities: ['{R}: This creature gets +1/-1 until end of turn.'] } },
  'Mark of the Vampire': { grants: { power: 2, toughness: 2, keywords: ['Lifelink'] } },
  'Predator\'s Gambit': {
    grants: {
      power: 2,
      toughness: 1,
      abilities: ['This creature has intimidate as long as you control no other creatures. (It can\'t be blocked except by artifact creatures and/or creatures that share a color with it.)'],
    },
  },
  'Sadistic Glee': { grants: { abilities: ['Whenever a creature dies, put a +1/+1 counter on this creature.'] } },

  /* ----- Items: other artifacts and enchantments. ----- */
  // Sacrificing it only lasts the combat: it's back when combat is over.
  'Seal of Fire': {
    grants: {
      abilities: ['Sacrifice this enchantment: It deals 2 damage to any target.'],
      toggle: { label: 'Sacrificed', note: 'Sacrificed until combat is over.' },
    },
  },

  // Sliver lords: absorbing one makes the player a Sliver, and they count themselves,
  // so what it gives Slivers goes straight to the player. "All Sliver creatures"
  // also reaches other Slivers (players and monsters), so that text stays on the card.
  'Cloudshredder Sliver': { keywords: ['Flying', 'Haste'] },
  // "Another creature" includes monsters, and the player counts as one of their Vampires.
  'Cordial Vampire': {
    abilities: ['Whenever this creature or another creature dies, put a +1/+1 counter on each Vampire you control.'],
  },
  'Devoted Retainer': { keywords: ['Bushido 1'] },
  'Doomed Traveler': {
    abilities: ['When this creature dies, create a 1/1 white Spirit creature token with flying.'],
  },
  'Dragon Sniper': { keywords: ['Reach', 'Vigilance', 'Deathtouch'] },
  'Dropkick Bomber': {
    abilities: [
      'Other Goblins you control get +1/+1.',
      '{R}: Until end of turn, another target Goblin you control gains flying and "When this creature deals combat damage, sacrifice it."',
    ],
  },
  // Its text is only reminder text: the ability it has comes from being a Forest.
  'Dryad Arbor': { abilities: ['{T}: Add {G}.'] },
  // Ally is a creature type.
  'Earth Kingdom Protectors': {
    keywords: ['Vigilance'],
    abilities: ['Sacrifice this creature: Another target Ally you control gains indestructible until end of turn. (Damage and effects that say "destroy" don\'t destroy it.)'],
  },
  'Fanatical Firebrand': {
    keywords: ['Haste'],
    abilities: ['{T}, Sacrifice this creature: It deals 1 damage to any target.'],
  },
  'Forge Devil': {
    abilities: ['When this creature enters, it deals 1 damage to target creature and 1 damage to you.'],
  },
  'Goblin Arsonist': {
    abilities: ['When this creature dies, you may have it deal 1 damage to any target.'],
  },
  'Goblin Champion': { keywords: ['Haste', 'Exalted'] },
  // Trample uses the formation: leftover damage goes to the creature behind.
  'Goblin Gaveleer': {
    keywords: ['Trample'],
    abilities: ['This creature gets +2/+0 for each Equipment attached to it.'],
  },
  'Goblin Instigator': {
    abilities: ['When this creature enters, create a 1/1 red Goblin creature token.'],
  },
  'Goblin Swine-Rider': {
    abilities: ['Whenever this creature becomes blocked, it deals 2 damage to each attacking creature and each blocking creature.'],
  },
  'Guul Draz Vampire': {
    abilities: ['As long as an opponent has 10 or less life, this creature gets +2/+1 and has intimidate. (It can\'t be blocked except by artifact creatures and/or creatures that share a color with it.)'],
  },
  'Heart Sliver': {
    keywords: ['Haste'],
    abilities: ['All Sliver creatures have haste.'],
  },
  'Hemosymbic Mite': {
    abilities: ['Whenever this creature becomes tapped, another target creature you control gets +X/+X until end of turn, where X is this creature\'s power.'],
  },
  'Hollowhenge Scavenger': {
    abilities: ['Morbid — When this creature enters, if a creature died this turn, you gain 5 life.'],
  },
  // The javelin counter is kept at the table, not on the Player Card.
  'Icatian Javelineers': {
    abilities: [
      'This creature enters with a javelin counter on it.',
      '{T}, Remove a javelin counter from this creature: It deals 1 damage to any target.',
    ],
  },
  'Kavaron Harrier': {
    abilities: ['Whenever this creature attacks, you may pay {2}. If you do, create a 2/2 colorless Robot artifact creature token that\'s tapped and attacking. Sacrifice that token at end of combat.'],
  },
  // The player is a Goblin, so their own death counts too.
  'Knucklebone Witch': {
    abilities: ['Whenever a Goblin you control is put into a graveyard from the battlefield, you may put a +1/+1 counter on this creature.'],
  },
  'Kor Duelist': {
    abilities: ['As long as this creature is equipped, it has double strike. (It deals both first-strike and regular combat damage.)'],
  },
  'Lancer Sliver': { keywords: ['First strike'] },
  // Defender is still WIP.
  'Monoist Sentry': { keywords: ['Defender'] },
  'Muscle Sliver': {
    bonus: { power: 1, toughness: 1 },
    abilities: ['All Sliver creatures get +1/+1.'],
  },
  'Myr Scrapling': {
    abilities: ['Sacrifice this creature: Put a +1/+1 counter on target creature.'],
  },
  'Nested Shambler': {
    abilities: ['When this creature dies, create X tapped 1/1 green Squirrel creature tokens, where X is this creature\'s power.'],
  },
  // "Enters tapped": the player passes their first turn of each combat. The
  // graveyard ability is kept just in case.
  'Oathsworn Vampire': {
    abilities: [
      'This creature enters tapped.',
      'You may cast this card from your graveyard if you gained life this turn.',
    ],
  },
  'Ornithopter': { keywords: ['Flying'] },
  // Kept as printed, a trap on purpose: it enters when combat starts, so unless the
  // player sacrifices 12 power of creatures, they die.
  'Phyrexian Dreadnought': {
    keywords: ['Trample'],
    abilities: ['When this creature enters, sacrifice it unless you sacrifice any number of creatures with total power 12 or greater.'],
  },
  'Plated Sliver': {
    bonus: { power: 0, toughness: 1 },
    abilities: ['All Sliver creatures get +0/+1.'],
  },
  // Persist comes back with a -1/-1 counter, kept in the Player Card's counters.
  'Putrid Goblin': { keywords: ['Persist'] },
  'Sinew Sliver': {
    bonus: { power: 1, toughness: 1 },
    abilities: ['All Sliver creatures get +1/+1.'],
  },
  // Only the creature: its adventure, Curry Favor, isn't absorbed.
  'Smitten Swordmaster': { keywords: ['Lifelink'] },
  'Spinneret Sliver': {
    keywords: ['Reach'],
    abilities: ['All Sliver creatures have reach.'],
  },
  'Spitfire Handler': {
    abilities: [
      'This creature can\'t block creatures with power greater than this creature\'s power.',
      '{R}: This creature gets +1/+0 until end of turn.',
    ],
  },
  // A card with a spell of its own: being prepared lets the player cast a copy of it,
  // and a copy doesn't go to the graveyard like the spells on their list.
  'Stingerquill Voxmancer': {
    abilities: [
      'At the beginning of your upkeep, if this creature isn\'t prepared, it becomes prepared. (While it\'s prepared, you may cast a copy of its spell. Doing so unprepares it.)',
      'Its spell: Vicious Verse {B/R}, Sorcery \u2014 Vicious Verse deals 1 damage to target opponent.',
    ],
  },
  'Striking Sliver': { keywords: ['First strike'] },
  // Upkeep is the start of the player's turn.
  'Vampire Lacerator': {
    abilities: ['At the beginning of your upkeep, you lose 1 life unless an opponent has 10 or less life.'],
  },
  'Vampire Slayer': {
    abilities: ['Whenever this creature deals damage to a Vampire, destroy that creature.'],
  },
  'Venom Sliver': { keywords: ['Deathtouch'] },
  // Menace is still WIP. The player is a Vampire, so they can be the target.
  'Voracious Vampire': {
    keywords: ['Menace'],
    abilities: ['When this creature enters, target Vampire you control gets +1/+1 and gains menace until end of turn.'],
  },
  'Winged Sliver': {
    keywords: ['Flying'],
    abilities: ['All Sliver creatures have flying.'],
  },
};
