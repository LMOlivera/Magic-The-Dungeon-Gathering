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
    pattern: /\bsacrifice this creature\b/i,
    title: 'Sacrifice',
    tip: 'You sacrifice yourself: you die to use this ability.',
  },
];
