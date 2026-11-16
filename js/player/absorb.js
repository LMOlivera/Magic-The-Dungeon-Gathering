/**
 * Absorbing a card into the player, as plain data. No DOM here, so it can be
 * tested with `node --test`. Cards are pool cards (see shared/cards.js).
 *
 * Only creatures for now. What absorbing a creature does:
 *   - its power and toughness are added to the player's
 *   - its colors join the player's (a colorless player takes them; others add them)
 *   - its mana cost is added to the player's, symbol by symbol: {1}{B} + {R} = {1}{B}{R}
 *   - all its creature types join the player's (the player doesn't choose)
 *   - its other card types (Enchantment, Artifact, Land) and Legendary join the player's
 *   - it gains what rules/cards.js gives for its rules text (keywords and abilities)
 */

import { combineManaCosts } from '../shared/mana.js';
import { CARD_RULES } from '../rules/cards.js';
import { addKeywords } from '../rules/keywords.js';
import { newTransform } from './transform.js';

export const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'];
export const COLOR_NAMES = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green' };
/**
 * What a creature's type line can have before "Creature", in the order it prints
 * them. Legendary is a supertype, not a card type, but it joins the player's too.
 */
export const CARD_TYPE_ORDER = ['Legendary', 'Enchantment', 'Artifact', 'Land'];

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
    text: face.text ?? card.text ?? '',
  };
}

/**
 * What the player gains from the card's rules text, as decided in rules/cards.js.
 *   reviewed   false when the card has rules text nobody has decided about yet
 *   keywords   keyword names, abilities  other abilities as text
 *   power, toughness  what it adds when the card's stat isn't a number, or undefined
 *   transform  its back face for a card that transforms, or null
 *   bonus      { power, toughness } it adds on top of its stats (a Sliver lord), or null
 */
export function textToAbsorb(card) {
  const face = frontFace(card);
  const rules = Object.hasOwn(CARD_RULES, face.name) ? CARD_RULES[face.name] : null;
  if (!rules) return { reviewed: !face.text.trim(), keywords: [], abilities: [], transform: null, bonus: null };
  return {
    reviewed: true,
    keywords: [...(rules.keywords || [])],
    abilities: [...(rules.abilities || [])],
    power: rules.power,
    toughness: rules.toughness,
    transform: rules.transform || null,
    bonus: rules.bonus || null,
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

/** "Legendary Enchantment Creature — Nymph" -> ['Legendary', 'Enchantment'] */
export function cardTypesOf(typeLine) {
  const [types] = String(typeLine).split(' — ');
  const words = types.trim().split(/\s+/);
  return CARD_TYPE_ORDER.filter((type) => words.includes(type));
}

/** The player's type line: "Enchantment Creature — Human Nymph". */
export function typeLineOf({ cardTypes = [], types }) {
  return `${[...CARD_TYPE_ORDER.filter((type) => cardTypes.includes(type)), 'Creature'].join(' ')} — ${types.join(' ')}`;
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
 *   addPower, addToughness  numbers, or null when the card's stat isn't a number and
 *                           rules/cards.js doesn't say what it adds
 *                           (then the player says how much it adds)
 *   rawPower, rawToughness  the stats as printed, for showing them
 *   colors                  the player's colors afterwards
 *   manaCost                the player's mana cost afterwards
 *   newTypes                its creature types the player doesn't have yet
 *   cardTypes               the player's card types afterwards, besides Creature
 *   keywords, abilities     everything its text gives (textToAbsorb)
 *   keywordsAfter           the player's keywords afterwards ("Modular 1" twice is "Modular 2")
 *   newKeywords, newAbilities  what the player doesn't have yet, or has with a new number
 *   transform               its back face (rules/cards.js) for a card that transforms, or null
 *   bonus                   { power, toughness } it adds on top of its stats, or null
 *   hasText                 the card has rules text
 *   textReviewed            false when that text hasn't been decided about (nothing is gained)
 */
export function absorbPreview(player, card) {
  const face = frontFace(card);
  const text = textToAbsorb(card);
  const keywords = player.keywords || [];
  const keywordsAfter = addKeywords(keywords, text.keywords);
  return {
    name: face.name,
    addPower: statValue(face.power) ?? text.power ?? null,
    addToughness: statValue(face.toughness) ?? text.toughness ?? null,
    rawPower: face.power,
    rawToughness: face.toughness,
    colors: mergeColors(player.colors, card.colors || []),
    manaCost: combineManaCosts(player.manaCost, face.manaCost),
    newTypes: subtypesOf(face.typeLine).filter((type) => !player.types.includes(type)),
    cardTypes: CARD_TYPE_ORDER.filter((type) => (player.cardTypes || []).includes(type) || cardTypesOf(face.typeLine).includes(type)),
    keywords: text.keywords,
    abilities: text.abilities,
    keywordsAfter,
    newKeywords: keywordsAfter.filter((keyword) => !keywords.includes(keyword)),
    newAbilities: text.abilities.filter((ability) => !player.abilities.includes(ability)),
    transform: text.transform,
    bonus: text.bonus,
    hasText: Boolean(face.text.trim()),
    textReviewed: text.reviewed,
  };
}

/**
 * The player after absorbing a creature.
 * choices:
 *   power      how much power to add when the card's power isn't a number
 *   toughness  same for toughness
 * The open booster, if any, is used up.
 */
export function absorbCreature(player, card, choices = {}) {
  const preview = absorbPreview(player, card);
  const absorbed = player.absorbed || [];
  // What its text gave, so turning over a transformed card knows what to take away.
  const gave = { keywords: preview.keywords, abilities: preview.abilities };
  const transforms = player.transforms || [];
  return {
    ...player,
    power: player.power + (preview.addPower ?? (statValue(choices.power) || 0)) + (preview.bonus?.power || 0),
    toughness: player.toughness + (preview.addToughness ?? (statValue(choices.toughness) || 0)) + (preview.bonus?.toughness || 0),
    colors: preview.colors,
    manaCost: preview.manaCost,
    types: [...player.types, ...preview.newTypes],
    cardTypes: preview.cardTypes,
    keywords: preview.keywordsAfter,
    abilities: [...player.abilities, ...preview.newAbilities],
    absorbed: [...absorbed, { id: card.id, name: preview.name, ...gave }],
    transforms: preview.transform
      ? [...transforms, newTransform(card, preview.name, preview.transform, gave, absorbed.length)]
      : transforms,
    booster: null,
  };
}
