/**
 * What the player gains from each card's rules text, decided card by card
 * (DESIGN.md, section 5). Keyed by the name of the part that gets absorbed: the
 * front face, or the creature of a card with an adventure.
 *
 *   keywords   names from rules/keywords.js. Always absorbed, drawbacks included.
 *   abilities  any other ability, written the way it reads on the player's card.
 *   power, toughness  what the card adds, for a stat it doesn't print as a number
 *              (like "*"). Without it the player is asked when absorbing.
 *   transform  for a card that transforms: its back face, { name, power, toughness,
 *              keywords, abilities }. Transformed, the player loses what the front
 *              gave and gets this instead; power and toughness are a bonus (see
 *              player/transform.js).
 *
 * A card with rules text that isn't listed here hasn't been reviewed yet:
 * absorbing it gives its stats, colors, cost and types, but none of its text.
 * Cards without rules text need no entry.
 *
 * Plain data, no DOM: tests can import it.
 */

export const CARD_RULES = {
  // Kept as printed: summoning creatures may become a mechanic later.
  'Akki Ember-Keeper': {
    abilities: ['Whenever a nontoken modified creature you control dies, create a 1/1 colorless Spirit creature token. (Equipment, Auras you control, and counters are modifications.)'],
  },
  // Kept as printed. Sacrificing itself means the player dies to use it.
  'Alseid of Life\'s Bounty': {
    keywords: ['Lifelink'],
    abilities: ['{1}, Sacrifice this creature: Target creature or enchantment you control gains protection from the color of your choice until end of turn.'],
  },
  // Kept as printed. Only the player's own artifacts count (rules/terms.js).
  // Kept as printed: monsters may cast spells. Its +X/+0 goes in the bonus power.
  'Armored Armadillo': {
    keywords: ['Ward {1}'],
    abilities: ['{3}{W}: This creature gets +X/+0 until end of turn, where X is its toughness.'],
  },
  // Kept as printed: its +2/+0 goes in the bonus power, and Madness stays in case
  // hands and discarding come to the game.
  'Blazing Rootwalla': {
    keywords: ['Madness {0}'],
    abilities: ['{R}: This creature gets +2/+0 until end of turn. Activate only once each turn.'],
  },
  // "This turn" becomes "this round" for this card: another player can deal the damage first.
  'Bloodcrazed Goblin': {
    abilities: ['This creature can\'t attack unless an opponent has been dealt damage this round.'],
  },
  // Kept as printed, like Akki Ember-Keeper: only the player's own Goblins count.
  'Boggart Cursecrafter': {
    keywords: ['Deathtouch'],
    abilities: ['Whenever another Goblin you control dies, this creature deals 1 damage to each opponent.'],
  },
  // Kept as printed, like Akki Ember-Keeper: only the player's own Vampires count.
  // Transforms for real: the Player Card turns over. The back face is a +2/+1
  // bonus (4/4 against its 2/3) with its own abilities. "Cecil" is "this creature".
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
  'Captivating Vampire': {
    abilities: [
      'Other Vampire creatures you control get +1/+1.',
      'Tap five untapped Vampires you control: Gain control of target creature. It becomes a Vampire in addition to its other types.',
    ],
  },
  'Ardent Recruit': {
    abilities: ['Metalcraft — This creature gets +2/+2 as long as you control three or more artifacts.'],
  },
  'Ankle Biter': { keywords: ['Deathtouch'] },
  'Assassin Initiate': {
    abilities: ['{1}: This creature gains your choice of flying, deathtouch, or lifelink until end of turn.'],
  },
  // Kept as printed: "enters" happens when combat starts, and again if it leaves and comes back.
  // Kept as printed. {T} ends the player's turn; its counters are the ones on the Player Card.
  'Arcbound Javelineer': {
    keywords: ['Modular 1'],
    abilities: ['{T}, Remove X +1/+1 counters from this creature: It deals X damage to target attacking or blocking creature.'],
  },
  'Arcbound Mouser': { keywords: ['Lifelink', 'Modular 1'] },
  'Arcbound Worker': { keywords: ['Modular 1'] },
  // Its */2 doesn't replace the player's power: it adds 0, and the first ability
  // becomes a bonus worked out again each combat, kept as the Player Card's bonus power.
  // The party is the group of players (rules/terms.js).
  'Archpriest of Iona': {
    power: 0,
    abilities: [
      'During combat, this creature gets +X/+0, where X is the number of creatures in your party. (Your party consists of up to one each of Cleric, Rogue, Warrior, and Wizard.)',
      'At the beginning of combat on your turn, if you have a full party, target creature gets +1/+1 and gains flying until end of turn.',
    ],
  },
  'Arboreal Grazer': {
    keywords: ['Reach'],
    abilities: ['When this creature enters, you may put a land card from your hand onto the battlefield tapped.'],
  },
  'Dragon Sniper': { keywords: ['Reach', 'Vigilance', 'Deathtouch'] },
  'Ornithopter': { keywords: ['Flying'] },
  // Only the creature: its adventure, Curry Favor, isn't absorbed.
  'Smitten Swordmaster': { keywords: ['Lifelink'] },
};
