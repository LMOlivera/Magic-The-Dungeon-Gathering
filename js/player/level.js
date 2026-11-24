/**
 * Experience and levels, as plain data. No DOM here: tests can import it.
 * Rules in DESIGN.md, section 4 (Progression).
 *
 *   - A card starts at level 1 with 0 XP.
 *   - Leveling up takes level × 3 XP: 3 to reach level 2, 6 more to reach level 3...
 *     The XP left over counts toward the next level.
 *   - Each level reached earns a booster: on an even level, of spells from
 *     data/akashicos_spells.json that share a color with the player; on an odd level,
 *     of creatures from data/akashicos.json.
 *
 * On the sheet:
 *   level, xp          the level, and the XP gathered toward the next one
 *   levelBoosters      the levels whose booster hasn't been absorbed from yet, oldest first
 */

import { boosterPool } from './booster.js';

export const START_LEVEL = 1;

/** The XP it takes to go from this level to the next. */
export function xpToLevelUp(level) {
  return level * 3;
}

/** What the booster of a level deals: 'spells' on even levels, 'creatures' on odd ones. */
export function boosterKind(level) {
  return level % 2 === 0 ? 'spells' : 'creatures';
}

/**
 * The player after gaining (or, to correct a mistake, losing) XP. Reaching the XP
 * a level takes levels up, as many times as it fits, and each new level earns its
 * booster. Losing XP never goes below 0 or takes a level away.
 */
export function withXp(player, delta) {
  let level = player.level || START_LEVEL;
  let xp = Math.max(0, (player.xp || 0) + (Number.isInteger(delta) ? delta : 0));
  const levelBoosters = [...(player.levelBoosters || [])];
  while (xp >= xpToLevelUp(level)) {
    xp -= xpToLevelUp(level);
    level += 1;
    levelBoosters.push(level);
  }
  return { ...player, level, xp, levelBoosters };
}

/** The next booster to open, as { level, kind }, or null when none is waiting. */
export function nextLevelBooster(player) {
  const [level] = player.levelBoosters || [];
  return level ? { level, kind: boosterKind(level) } : null;
}

/** That booster was used: a card was absorbed from it, or nothing was left to deal. */
export function withLevelBoosterUsed(player) {
  return { ...player, levelBoosters: (player.levelBoosters || []).slice(1), booster: null };
}

/**
 * The cards a level booster can deal: not absorbed yet and, for spells, sharing a
 * color with the player.
 */
export function levelBoosterPool(pool, player, kind) {
  const cards = boosterPool(pool, player);
  if (kind !== 'spells') return cards;
  const colors = player.colors || [];
  return cards.filter((card) => (card.colors || []).some((color) => colors.includes(color)));
}
