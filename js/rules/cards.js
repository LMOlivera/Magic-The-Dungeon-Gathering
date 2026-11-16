/**
 * What the player gains from each card's rules text, decided card by card
 * (DESIGN.md, section 5). Keyed by the name of the part that gets absorbed: the
 * front face, or the creature of a card with an adventure.
 *
 *   keywords   names from rules/keywords.js. Always absorbed, drawbacks included.
 *   abilities  any other ability, written the way it reads on the player's card.
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
  'Ankle Biter': { keywords: ['Deathtouch'] },
  // Kept as printed: "enters" happens when combat starts, and again if it leaves and comes back.
  // Kept as printed. {T} ends the player's turn; its counters are the ones on the Player Card.
  'Arcbound Javelineer': {
    keywords: ['Modular 1'],
    abilities: ['{T}, Remove X +1/+1 counters from this creature: It deals X damage to target attacking or blocking creature.'],
  },
  'Arcbound Mouser': { keywords: ['Lifelink', 'Modular 1'] },
  'Arcbound Worker': { keywords: ['Modular 1'] },
  'Arboreal Grazer': {
    keywords: ['Reach'],
    abilities: ['When this creature enters, you may put a land card from your hand onto the battlefield tapped.'],
  },
  'Dragon Sniper': { keywords: ['Reach', 'Vigilance', 'Deathtouch'] },
  'Ornithopter': { keywords: ['Flying'] },
  // Only the creature: its adventure, Curry Favor, isn't absorbed.
  'Smitten Swordmaster': { keywords: ['Lifelink'] },
};
