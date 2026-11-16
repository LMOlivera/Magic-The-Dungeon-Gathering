/**
 * What each keyword does in this game. These are table rules, not Magic's: the
 * players apply them, the app only shows them (on the absorb screen, and as a
 * tooltip on the player's card). Which ones are decided is in DESIGN.md, section 6.
 *
 * A keyword missing here can't be absorbed yet, so the cards that have it wait
 * in rules/cards.js until it's defined.
 *
 * A keyword with a number, like "Modular 1", has a function as its rule: it
 * gets the number and returns the text.
 *
 * Plain data, no DOM: tests can import it.
 */

const counters = (n) => `${n} +1/+1 counter${n === 1 ? '' : 's'}`;

export const KEYWORDS = {
  Vigilance: 'Enemies will focus their attacks on players with Vigilance.',
  Flying: 'Only creatures with flying or reach can defend themselves against your attacks.',
  Reach: 'You can defend yourself against creatures with flying.',
  Lifelink: 'Damage you deal heals you by the same amount.',
  Deathtouch: 'Any damage you deal to a creature destroys it.',
  'First strike': 'You act before everyone else in the round.',
  Modular: (n) => `Each time you enter (when combat starts), put ${counters(n)} on yourself. When you die, you may put your +1/+1 counters on another creature or player.`,
};

/** "Modular 2" -> { name: 'Modular', value: 2 }; "Flying" -> { name: 'Flying', value: null } */
export function parseKeyword(keyword) {
  const match = String(keyword).trim().match(/^(.*?)(?:\s+(\d+))?$/);
  return { name: match[1], value: match[2] ? Number(match[2]) : null };
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
 * a keyword with a number adds it to the one already there: Modular 1 and
 * Modular 1 make Modular 2, as two Modular abilities would in Magic.
 */
export function addKeywords(list, more) {
  const result = [...list];
  for (const keyword of more) {
    const { name, value } = parseKeyword(keyword);
    const index = result.findIndex((had) => parseKeyword(had).name === name);
    if (index === -1) result.push(keyword);
    else if (value !== null) result[index] = `${name} ${(parseKeyword(result[index]).value ?? 0) + value}`;
  }
  return result;
}
