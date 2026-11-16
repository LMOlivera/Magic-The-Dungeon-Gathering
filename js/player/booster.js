/**
 * Boosters as plain data. No DOM here, so it can be tested with `node --test`.
 */

export const BOOSTER_SIZE = 3;

/**
 * Picks `size` different cards from the pool, each equally likely.
 * random is a function returning a number in [0, 1), like Math.random.
 * The pool itself is not changed. A pool smaller than `size` gives all of it.
 */
export function makeBooster(pool, size = BOOSTER_SIZE, random = Math.random) {
  const cards = [...pool];
  const count = Math.min(size, cards.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(random() * (cards.length - i));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards.slice(0, count);
}
