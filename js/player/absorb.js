/**
 * Absorbing a card into the player, as plain data. No DOM here, so it can be
 * tested with `node --test`. Cards are pool cards (see shared/cards.js).
 *
 * Only creatures for now. What absorbing a creature does:
 *   - its power and toughness are added to the player's
 *   - its colors join the player's (a colorless player takes them; others add them)
 *   - its mana cost is added to the player's, symbol by symbol: {1}{B} + {R} = {1}{B}{R}
 *   - the player chooses which of its creature types to add to theirs
 */

import { combineManaCosts } from '../shared/mana.js';

export const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'];
export const COLOR_NAMES = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green' };

/**
 * The part of the card that gets absorbed. Most cards have one; for cards with
 * two parts (double-faced, adventures) it's the first, which is the creature.
 */
export function frontFace(card) {
  const face = card.faces && card.faces.length ? card.faces[0] : card;
  return {
    name: face.name,
    manaCost: face.manaCost ?? card.manaCost ?? '',
    typeLine: face.typeLine || card.typeLine,
    power: face.power ?? card.power,
    toughness: face.toughness ?? card.toughness,
  };
}

export function isCreatureCard(card) {
  return /\bCreature\b/.test(frontFace(card).typeLine);
}

/** "Artifact Creature — Phyrexian Myr" -> ['Phyrexian', 'Myr'] */
export function subtypesOf(typeLine) {
  const [, subtypes] = String(typeLine).split(' — ');
  return subtypes ? subtypes.trim().split(/\s+/) : [];
}

/** A printed power or toughness as a number, or null when it isn't one (like "*"). */
export function statValue(raw) {
  return /^-?\d+$/.test(String(raw ?? '').trim()) ? Number(raw) : null;
}

/** Joins two color lists without repeats, in the usual W U B R G order. */
export function mergeColors(a, b) {
  return COLOR_ORDER.filter((color) => a.includes(color) || b.includes(color));
}

/** "colorless", "blue", "blue and black", "white, blue and black" */
export function describeColors(colors) {
  const names = COLOR_ORDER.filter((color) => colors.includes(color)).map((color) => COLOR_NAMES[color]);
  if (!names.length) return 'colorless';
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/**
 * What absorbing the creature would do, before the player decides anything.
 *   addPower, addToughness  numbers, or null when the card's stat isn't a number
 *                           (then the player says how much it adds)
 *   rawPower, rawToughness  the stats as printed, for showing them
 *   colors                  the player's colors afterwards
 *   manaCost                the player's mana cost afterwards
 *   newTypes                its creature types the player doesn't have yet
 */
export function absorbPreview(player, card) {
  const face = frontFace(card);
  return {
    name: face.name,
    addPower: statValue(face.power),
    addToughness: statValue(face.toughness),
    rawPower: face.power,
    rawToughness: face.toughness,
    colors: mergeColors(player.colors, card.colors || []),
    manaCost: combineManaCosts(player.manaCost, face.manaCost),
    newTypes: subtypesOf(face.typeLine).filter((type) => !player.types.includes(type)),
  };
}

/**
 * The player after absorbing a creature.
 * choices:
 *   types      the creature types the player chose to add (others are ignored)
 *   power      how much power to add when the card's power isn't a number
 *   toughness  same for toughness
 * The open booster, if any, is used up.
 */
export function absorbCreature(player, card, choices = {}) {
  const preview = absorbPreview(player, card);
  const chosen = new Set(choices.types || []);
  return {
    ...player,
    power: player.power + (preview.addPower ?? (statValue(choices.power) || 0)),
    toughness: player.toughness + (preview.addToughness ?? (statValue(choices.toughness) || 0)),
    colors: preview.colors,
    manaCost: preview.manaCost,
    types: [...player.types, ...preview.newTypes.filter((type) => chosen.has(type))],
    absorbed: [...(player.absorbed || []), { id: card.id, name: preview.name }],
    booster: null,
  };
}
