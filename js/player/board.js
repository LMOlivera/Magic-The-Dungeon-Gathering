/**
 * The character sheet around the card: the attachments, the creatures the card
 * inherited and the XP bar. Plain data, no DOM: tests can import it. Layout in
 * DESIGN.md, section 10 (Player Card).
 *
 * cardById maps a pool card's id to the pool card (shared/cards.js), so the board
 * can show each card's image and printed power/toughness. Pools may still be loading
 * or fail to load: everything here works with an empty map too.
 */

import { kindOf } from './gear.js';

/** Empty slots fill each panel up to this many, as decoration. They are not a limit. */
export const MIN_ATTACHMENT_SLOTS = 5;
export const MIN_CREATURE_SLOTS = 6;
/** Past this much XP per level, the XP bar is one bar instead of a segment per point. */
export const MAX_XP_SEGMENTS = 12;

/**
 * Equipment, items and Auras, Equipment first:
 * [{ id, name, off, list: 'equipment' | 'auras', index, kind: 'equipment' | 'item' | 'aura' }]
 * index is the entry's place in its own list (for withOff and withoutEquipment).
 * An item (Seal of Fire) is kept with the Equipment; only its pool card tells them apart.
 */
export function attachmentsOf(player, cardById = new Map()) {
  const equipment = (player.equipment || []).map((entry, index) => {
    const card = cardById.get(entry.id);
    return { ...entry, list: 'equipment', index, kind: card && kindOf(card) === 'item' ? 'item' : 'equipment' };
  });
  const auras = (player.auras || []).map((entry, index) => ({ ...entry, list: 'auras', index, kind: 'aura' }));
  return [...equipment, ...auras];
}

/**
 * The creatures the card absorbed, oldest first: [{ id, name, keywords, abilities, absorbedAt, card }]
 * absorbedAt is the entry's place in player.absorbed; card is the pool card, or null
 * when it isn't known (yet).
 * Without the pool card, an absorbed card counts as a creature unless it's on the
 * spell list, the Equipment or the Auras.
 */
export function inheritedCreatures(player, cardById = new Map()) {
  const notCreatures = new Set(
    [...(player.spells || []), ...(player.equipment || []), ...(player.auras || [])].map((entry) => entry.id),
  );
  return (player.absorbed || []).flatMap((entry, absorbedAt) => {
    const card = cardById.get(entry.id) || null;
    const creature = card ? kindOf(card) === 'creature' : !notCreatures.has(entry.id);
    return creature ? [{ ...entry, absorbedAt, card }] : [];
  });
}

/** How many empty slots to draw after `count` cards so a panel shows at least `min`. */
export function emptySlots(count, min) {
  return Math.max(0, min - count);
}

/**
 * The XP bar: one segment per XP the level takes, true when earned.
 * null when the level takes more than MAX_XP_SEGMENTS: then it's one bar, filled to `share` (0 to 1).
 */
export function xpSegments(xp, needed) {
  if (!(needed > 0)) return { segments: [], share: 0 };
  const earned = Math.max(0, Math.min(xp, needed));
  return {
    segments: needed > MAX_XP_SEGMENTS ? null : Array.from({ length: needed }, (_, i) => i < earned),
    share: earned / needed,
  };
}

/** A pool card's printed power/toughness, "2/1", or '' for a card without them. */
export function printedStats(card) {
  if (!card || card.power == null || card.toughness == null) return '';
  return `${card.power}/${card.toughness}`;
}
