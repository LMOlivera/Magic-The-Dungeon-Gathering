/**
 * What each keyword does in this game. These are table rules, not Magic's: the
 * players apply them, the app only shows them (on the absorb screen, and as a
 * tooltip on the player's card). Which ones are decided is in DESIGN.md, section 6.
 *
 * A keyword missing here can't be absorbed yet, so the cards that have it wait
 * in rules/cards.js until it's defined.
 *
 * A keyword with a number, like "Modular 1", has a function as its rule: it
 * gets the number and returns the text. Keywords whose number is mana, like
 * "Ward {1}", are written with braces, as on the card (MANA_KEYWORDS).
 *
 * Plain data, no DOM: tests can import it.
 */

const counters = (n) => `${n} +1/+1 counter${n === 1 ? '' : 's'}`;

/** Keywords whose number is a mana cost: "Ward {1}", not "Ward 1". */
const MANA_KEYWORDS = new Set(['Ward', 'Madness']);

/** Keywords whose numbers add up when absorbed twice. Any other keeps the one the player had. */
const ADDS_UP = new Set(['Modular', 'Ward']);

export const KEYWORDS = {
  Vigilance: 'Enemies will focus their attacks on players with Vigilance.',
  Flying: 'Only creatures with flying or reach can defend themselves against your attacks.',
  Reach: 'You can defend yourself against creatures with flying.',
  Lifelink: 'Damage you deal heals you by the same amount.',
  Deathtouch: 'WIP', // too strong as "any damage destroys"; to be defined
  'First strike': 'You act before everyone else in the round.',
  Ward: (n) => `Whenever a monster targets you with a spell or ability, it's countered unless that monster pays ${n} mana.`,
  // Kept from Magic in case hands and discarding come to the game.
  Madness: (n) => `If you discard this card, discard it into exile. When you do, cast it for its madness cost (${n} mana) or put it into your graveyard.`,
  Modular: (n) => `Each time you enter (when combat starts), put ${counters(n)} on yourself. When you die, you may put your +1/+1 counters on another creature or player.`,
};

/** "Modular 2" -> { name: 'Modular', value: 2 }; "Ward {1}" -> { name: 'Ward', value: 1 }; "Flying" -> value null */
export function parseKeyword(keyword) {
  const match = String(keyword).trim().match(/^(.*?)(?:\s+\{?(\d+)\}?)?$/);
  return { name: match[1], value: match[2] ? Number(match[2]) : null };
}

/** The keyword as the card prints it: "Modular 2", "Ward {2}", "Flying". */
export function formatKeyword(name, value) {
  if (value === null || value === undefined) return name;
  return MANA_KEYWORDS.has(name) ? `${name} {${value}}` : `${name} ${value}`;
}

/** The rule for a keyword ("Flying", "Modular 2"), or null when it isn't part of the game yet. */
export function keywordRule(keyword) {
  const { name, value } = parseKeyword(keyword);
  if (!Object.hasOwn(KEYWORDS, name)) return null;
  const rule = KEYWORDS[name];
  return typeof rule === 'function' ? rule(value ?? 1) : rule;
}

/**
 * Adds keywords to a list. New ones go at the end and repeats are dropped, but
 * a keyword in ADDS_UP adds its number to the one already there: Modular 1 and
 * Modular 1 make Modular 2, as two Modular abilities would in Magic.
 */
export function addKeywords(list, more) {
  const result = [...list];
  for (const keyword of more) {
    const { name, value } = parseKeyword(keyword);
    const index = result.findIndex((had) => parseKeyword(had).name === name);
    if (index === -1) result.push(keyword);
    else if (value !== null && ADDS_UP.has(name)) result[index] = formatKeyword(name, (parseKeyword(result[index]).value ?? 0) + value);
  }
  return result;
}
