/**
 * Absorbing a card into the player, as plain data. No DOM here, so it can be
 * tested with `node --test`. Cards are pool cards (see shared/cards.js).
 *
 * What absorbing a creature does:
 *   - its power and toughness are added to the player's
 *   - its colors join the player's (a colorless player takes them; others add them)
 *   - its mana cost is added to the player's, symbol by symbol: {1}{B} + {R} = {1}{B}{R}
 *   - all its creature types join the player's (the player doesn't choose)
 *   - its other card types (Enchantment, Artifact, Land) and Legendary join the player's
 *   - it gains what rules/cards.js gives for its rules text (keywords and abilities)
 *
 * Equipment, Auras and items add their colors and mana cost the same way, but not
 * their types. Instants and sorceries add their colors and join the spell list, but
 * not their cost: that's what casting them costs. What else they give is in player/gear.js.
 */

import { combineManaCosts, devotion } from '../shared/mana.js';
import { CARD_RULES } from '../rules/cards.js';
import { addKeywords } from '../rules/keywords.js';
import { newTransform } from './transform.js';
import { kindOf, grantsOf } from './gear.js';

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
 *   bonusNote  why that bonus is the player's, or null (a Sliver's when not given)
 *   chooseX    its cost has {X}, which the player picks when absorbing it
 * x is that X: abilities written as functions of X get it.
 */
export function textToAbsorb(card, x = 0) {
  const face = frontFace(card);
  const rules = Object.hasOwn(CARD_RULES, face.name) ? CARD_RULES[face.name] : null;
  if (!rules) {
    return { reviewed: !face.text.trim(), keywords: [], abilities: [], transform: null, bonus: null, bonusNote: null, chooseX: false };
  }
  return {
    reviewed: true,
    keywords: [...(rules.keywords || [])],
    abilities: (rules.abilities || []).map((ability) => (typeof ability === 'function' ? ability(x) : ability)),
    power: rules.power,
    toughness: rules.toughness,
    transform: rules.transform || null,
    bonus: rules.bonus || null,
    bonusNote: rules.bonusNote || null,
    chooseX: Boolean(rules.chooseX),
  };
}

/** The X the player picked for a card with {X} in its cost: a whole number, 0 or more. */
export function chosenX(raw) {
  const value = statValue(raw);
  return value !== null && value > 0 ? value : 0;
}

/**
 * What devotion adds to the player's card: for each absorbed card whose rules say
 * `devotion` (like Callaphe, Beloved of the Sea), the number of that color's mana
 * symbols in the player's mana cost. It follows the cost as it changes.
 * Returns { power, toughness }.
 */
export function devotionBonus(player) {
  let power = 0;
  let toughness = 0;
  for (const { name } of player.absorbed || []) {
    const rules = Object.hasOwn(CARD_RULES, name) ? CARD_RULES[name] : null;
    if (!rules || !rules.devotion) continue;
    if (rules.devotion.power) power += devotion(player.manaCost, rules.devotion.power);
    if (rules.devotion.toughness) toughness += devotion(player.manaCost, rules.devotion.toughness);
  }
  return { power, toughness };
}

export function isCreatureCard(card) {
  return /\bCreature\b/.test(frontFace(card).typeLine);
}

/**
 * Creatures, instants and sorceries can be absorbed, and so can Equipment and Auras
 * once rules/cards.js says what they grant. Other cards can't yet.
 */
export function isAbsorbable(card) {
  const kind = kindOf(card);
  if (kind === 'equipment' || kind === 'aura' || kind === 'item') return Boolean(grantsOf(frontFace(card).name));
  return kind !== 'other';
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
 *   bonusNote               why that bonus is the player's, or null
 *   chooseX, x              its cost has {X}; x is the one picked (choices.x), 0 by default
 *   hasText                 the card has rules text
 *   textReviewed            false when that text hasn't been decided about (nothing is gained)
 *   kind                    'creature', 'equipment', 'aura' or 'spell' (player/gear.js)
 *   grants                  for an Equipment or Aura, what it grants (rules/cards.js), or null
 *   spell                   for an instant or sorcery, its entry for the spell list
 */
export function absorbPreview(player, card, choices = {}) {
  const face = frontFace(card);
  const kind = kindOf(card);
  if (kind !== 'creature') return gearPreview(player, card, face, kind);
  const x = chosenX(choices.x);
  const text = textToAbsorb(card, x);
  // Nothing is cast here: the X the player picked is that much generic mana.
  const cost = text.chooseX ? face.manaCost.replace(/\{X\}/gi, `{${x}}`) : face.manaCost;
  const keywords = player.keywords || [];
  const keywordsAfter = addKeywords(keywords, text.keywords);
  return {
    name: face.name,
    addPower: statValue(face.power) ?? text.power ?? null,
    addToughness: statValue(face.toughness) ?? text.toughness ?? null,
    rawPower: face.power,
    rawToughness: face.toughness,
    colors: mergeColors(player.colors, card.colors || []),
    manaCost: combineManaCosts(player.manaCost, cost),
    newTypes: subtypesOf(face.typeLine).filter((type) => !player.types.includes(type)),
    cardTypes: CARD_TYPE_ORDER.filter((type) => (player.cardTypes || []).includes(type) || cardTypesOf(face.typeLine).includes(type)),
    keywords: text.keywords,
    abilities: text.abilities,
    keywordsAfter,
    newKeywords: keywordsAfter.filter((keyword) => !keywords.includes(keyword)),
    newAbilities: text.abilities.filter((ability) => !player.abilities.includes(ability)),
    transform: text.transform,
    bonus: text.bonus,
    bonusNote: text.bonusNote,
    chooseX: text.chooseX,
    x,
    hasText: Boolean(face.text.trim()),
    textReviewed: text.reviewed,
    kind: 'creature',
    grants: null,
    spell: null,
  };
}

/**
 * absorbPreview for a card that isn't a creature: only its colors and cost change the
 * card itself, and a spell only its colors.
 */
function gearPreview(player, card, face, kind) {
  const grants = kind === 'equipment' || kind === 'aura' || kind === 'item' ? grantsOf(face.name) : null;
  const keywords = player.keywords || [];
  const isSpell = kind === 'spell';
  return {
    name: face.name,
    addPower: 0,
    addToughness: 0,
    rawPower: face.power,
    rawToughness: face.toughness,
    colors: mergeColors(player.colors, card.colors || []),
    manaCost: isSpell ? player.manaCost : combineManaCosts(player.manaCost, face.manaCost),
    newTypes: [],
    cardTypes: player.cardTypes || [],
    keywords: [],
    abilities: [],
    keywordsAfter: keywords,
    newKeywords: [],
    newAbilities: [],
    transform: null,
    bonus: null,
    bonusNote: null,
    chooseX: false,
    x: 0,
    hasText: Boolean(face.text.trim()),
    // A spell is cast as printed; an Equipment or Aura needs its entry in rules/cards.js.
    textReviewed: kind === 'spell' || Boolean(grants),
    kind,
    grants,
    spell: kind === 'spell'
      ? { id: card.id, name: face.name, manaCost: face.manaCost, typeLine: face.typeLine, text: face.text, cast: false }
      : null,
  };
}

/**
 * The player after absorbing any card: a creature (absorbCreature), or an
 * Equipment, Aura or spell, which adds its colors and cost and goes to its list.
 * The open booster, if any, is used up.
 */
export function absorbCard(player, card, choices = {}) {
  const preview = absorbPreview(player, card, choices);
  if (preview.kind === 'creature') return absorbCreature(player, card, choices);
  const entry = { id: card.id, name: preview.name };
  return {
    ...player,
    colors: preview.colors,
    manaCost: preview.manaCost,
    absorbed: [...(player.absorbed || []), { ...entry, keywords: [], abilities: [] }],
    // Items are kept with the Equipment: something you have on you until it's used or destroyed.
    equipment: preview.kind === 'equipment' || preview.kind === 'item' ? [...(player.equipment || []), entry] : player.equipment || [],
    auras: preview.kind === 'aura' ? [...(player.auras || []), entry] : player.auras || [],
    spells: preview.kind === 'spell' ? [...(player.spells || []), preview.spell] : player.spells || [],
    booster: null,
  };
}

/**
 * The player after absorbing a creature.
 * choices:
 *   power      how much power to add when the card's power isn't a number
 *   toughness  same for toughness
 *   x          the X of a card with {X} in its cost
 * The open booster, if any, is used up.
 */
export function absorbCreature(player, card, choices = {}) {
  const preview = absorbPreview(player, card, choices);
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
