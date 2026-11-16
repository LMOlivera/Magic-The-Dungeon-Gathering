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
 *              remove: the label of the button that gets rid of an Equipment or item
 *              ("Destroyed" when not given).
 *   transform  for a card that transforms: its back face, { name, power, toughness,
 *              keywords, abilities }. Transformed, the player loses what the front
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

  /* ----- Items: other artifacts and enchantments, gone once used. ----- */
  'Seal of Fire': {
    grants: { abilities: ['Sacrifice this enchantment: It deals 2 damage to any target.'], remove: 'Used' },
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
