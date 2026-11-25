/**
 * Boosters as plain data. No DOM here, so it can be tested with `node --test`.
 */

import { kindOf } from './gear.js';

export const BOOSTER_SIZE = 3;

/** Cards the player already absorbed don't come up again. Set to false to allow repeats. */
export const NO_REPEATS = true;

/** The cards a booster for this player can deal: the pool minus what they already absorbed (with NO_REPEATS). */
export function boosterPool(pool, player, noRepeats = NO_REPEATS) {
  if (!noRepeats) return pool;
  const absorbed = new Set((player.absorbed || []).map((card) => card.id));
  return pool.filter((card) => !absorbed.has(card.id));
}

/**
 * The attachment booster's pool (a placeholder for testing): every card of the given
 * pools that is neither a creature nor an instant or sorcery, so the Equipment, items
 * and Auras. A card in several pools counts once.
 */
export function attachmentPool(pools) {
  const byId = new Map();
  for (const pool of pools) {
    for (const card of pool || []) {
      if (byId.has(card.id)) continue;
      const kind = kindOf(card);
      if (kind === 'equipment' || kind === 'item' || kind === 'aura') byId.set(card.id, card);
    }
  }
  return [...byId.values()];
}

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
