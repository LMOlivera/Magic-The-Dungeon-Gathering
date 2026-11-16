/**
 * Phrases in card text that mean something particular in this game. On the
 * player's card (and the absorb screen) they get a tooltip, like keywords.
 * Rules in DESIGN.md, section 5 ("El texto de reglas").
 *
 *   pattern  what to look for in an ability's text (no g flag and no capturing
 *            groups: use (?:...); the case is ignored)
 *   title    the tooltip's heading
 *   tip      what it means at the table
 *
 * Plain data, no DOM: tests can import it.
 */

/** Symbols in card text that mean something particular, keyed like mana symbols ({T} is 'T'). */
export const SYMBOLS = {
  T: {
    title: 'Tap',
    tip: 'You tap to use this ability, and that ends your turn. You also tap when you attack.',
  },
};

export const TERMS = [
  {
    pattern: /\b(?:when|whenever) this creature enters\b/i,
    title: 'Enters',
    tip: 'This happens when combat starts, and again each time you come back to the battlefield (for example after being exiled).',
  },
  {
    pattern: /\b(?:your|a full) party\b/i,
    title: 'Party',
    tip: 'Your party is the group of players. It counts up to one each of Cleric, Rogue, Warrior and Wizard among their creature types; a full party has all four.',
  },
  {
    pattern: /\byou control (?:[a-z]+ or more )?artifacts\b|\bartifacts you control\b/i,
    title: 'Your artifacts',
    tip: 'Only your own artifacts count: you, if you are an Artifact Creature, and the artifacts you absorbed.',
  },
  {
    pattern: /\btransform it\b/i,
    title: 'Transform',
    tip: 'Use Transform under your card: it turns over to its other face until combat is over.',
  },
  {
    pattern: /\byour starting life total\b/i,
    title: 'Starting life',
    tip: 'Your toughness when combat started.',
  },
  {
    pattern: /\byour life total\b/i,
    title: 'Life',
    tip: 'Your life is your toughness, minus the damage you have taken this combat.',
  },
  {
    pattern: /\bsacrifice this creature\b/i,
    title: 'Sacrifice',
    tip: 'You sacrifice yourself: you die to use this ability.',
  },
];
