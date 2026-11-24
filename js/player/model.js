import { transformedFace, shownTransform } from './transform.js';
import { attachedEffects } from './gear.js';
import { addKeywords } from '../rules/keywords.js';
import { devotionBonus } from './absorb.js';
import { newStart, START_POINTS } from './start.js';

/**
 * The player's character sheet as plain data. No DOM and no storage here,
 * so everything in this file can be tested with `node --test`.
 *
 * The photos are not part of this object: they live in the image store
 * (shared/images.js) and the sheet only remembers whether they exist.
 */

export const SAVE_VERSION = 12;
export const FLAVOR_MAX = 110;

/** Collapses runs of whitespace and trims. An empty result means "no name". */
export function cleanName(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim();
}

/** Everyone walks in as a colorless 1/1 Human with cost 0. */
export function newPlayer(name, now = new Date()) {
  return {
    version: SAVE_VERSION,
    name,
    // Sealed at creation. Opening a booster is what unseals it (not built yet).
    nameLocked: true,
    artChosen: false,     // false until the player uploads, takes or skips a photo
    hasArt: false,        // a cropped photo is in the image store
    hasArtSource: false,  // so is the uncropped original, so the crop can be redone
    artCrop: null,        // { zoom, cx, cy }, see player/crop.js
    flavor: '',
    manaCost: '{0}',      // Scryfall notation; absorbed creatures add their symbols, see shared/mana.js
    colors: [],           // W U B R G letters; empty means colorless
    cardTypes: [],        // besides Creature: Legendary, Enchantment, Artifact, Land (see player/absorb.js)
    types: ['Human'],
    power: 1,             // what absorbing gave; the card also adds the counters
    toughness: 1,
    counters: 0,          // +1/+1 counters the player keeps track of; below 0 they are -1/-1 counters
    bonusPower: 0,        // bonuses until the end of combat, like +2/+0; the card adds them too
    bonusToughness: 0,
    keywords: [],         // keyword names, see rules/keywords.js
    abilities: [],        // other abilities, as text
    absorbed: [],         // [{ id, name, keywords, abilities }] of every card absorbed, in order
    transforms: [],       // cards that can turn the Player Card over, see player/transform.js
    equipment: [],        // Equipment the player has on, see player/gear.js
    auras: [],            // Auras on the player, for good
    spells: [],           // the spell list: instants and sorceries
    booster: null,        // { cardIds, level } of an opened booster not yet picked from
    level: 1,             // see player/level.js
    xp: 0,                // XP toward the next level
    levelBoosters: [],    // levels whose booster is still waiting, oldest first
    start: newStart(),    // the starting points while the card is being made, see player/start.js
    createdAt: now.toISOString(),
  };
}

/**
 * The player opened a booster: the one a level earned. It stays open (also across
 * reloads) until a card is absorbed.
 */
export function withBooster(player, cardIds, level = null) {
  return { ...player, booster: { cardIds: [...cardIds], level } };
}

export function withFlavor(player, text) {
  return { ...player, flavor: String(text ?? '').slice(0, FLAVOR_MAX) };
}

/** The player picked a photo. hasSource says whether the original was kept too. */
export function withArt(player, crop, hasSource) {
  return { ...player, artChosen: true, hasArt: true, hasArtSource: hasSource, artCrop: hasSource ? crop : null };
}

/** The player skipped the photo or went back to the default art. */
export function withoutArt(player) {
  return { ...player, artChosen: true, hasArt: false, hasArtSource: false, artCrop: null };
}

/**
 * The player put a counter on or took one off. +1/+1 and -1/-1 counters cancel
 * out, as in Magic, so one number is enough: 2 is two +1/+1, -1 is one -1/-1.
 */
export function withCounters(player, counters) {
  return { ...player, counters: Number.isInteger(counters) ? counters : 0 };
}

/** Bonuses until the end of combat. Clearing them is withBonus(player, 0, 0). */
export function withBonus(player, power, toughness) {
  const whole = (value) => (Number.isInteger(value) ? value : 0);
  return { ...player, bonusPower: whole(power), bonusToughness: whole(toughness) };
}

/** "+2", "-1" or "0" */
export function describeBonus(value) {
  return value > 0 ? `+${value}` : String(value || 0);
}

/** "+2/+2", "-1/-1" or "0" */
export function describeCounters(counters) {
  if (!counters) return '0';
  const sign = counters > 0 ? '+' : '-';
  return `${sign}${Math.abs(counters)}/${sign}${Math.abs(counters)}`;
}

/**
 * What shared/card.js needs to draw this player. artUrl is the photo, if any;
 * transformArt holds the photos of the other faces, by their index in player.transforms.
 */
export function toCardData(player, artUrl, transformArt = []) {
  const face = transformedFace(player);
  const gear = attachedEffects(player);
  const shown = shownTransform(player);
  const other = shown === -1 ? null : player.transforms[shown];
  const devoted = devotionBonus(player);
  return {
    name: (other && other.name) || player.name,
    placeholderName: 'Human',
    cost: player.manaCost,
    colors: player.colors,
    cardTypes: player.cardTypes,
    types: player.types,
    power: player.power + (player.counters || 0) + (player.bonusPower || 0) + face.power + gear.power + devoted.power,
    toughness: player.toughness + (player.counters || 0) + (player.bonusToughness || 0) + face.toughness + gear.toughness + devoted.toughness,
    keywords: addKeywords(face.keywords, gear.keywords),
    abilities: [...face.abilities, ...gear.abilities.filter((ability) => !face.abilities.includes(ability))],
    flavor: player.flavor,
    artUrl: (other && other.hasArt ? transformArt[shown] : artUrl) || null,
    transformed: Boolean(other),
  };
}

/**
 * Brings a saved sheet up to SAVE_VERSION without losing anything.
 * Returns one of:
 *   { status: 'empty' }                 nothing usable was saved
 *   { status: 'newer' }                 saved by a newer version of the game; leave it alone
 *   { status: 'ok', player, images }    images holds photos (as data URLs) that older
 *                                       versions kept inside the sheet and that now
 *                                       have to be moved to the image store
 *
 * To change the save format: bump SAVE_VERSION and add an `if (data.version === N)` step.
 */
export function upgradeSave(saved) {
  if (!saved || typeof saved !== 'object' || typeof saved.name !== 'string' || !Number.isInteger(saved.version)) {
    return { status: 'empty' };
  }
  if (saved.version > SAVE_VERSION) return { status: 'newer' };

  let data = saved;
  const images = {};

  // v1 kept the photos inside the sheet as data URLs.
  if (data.version === 1) {
    const { art, artSource, artCrop, ...rest } = data;
    const hasArt = typeof art === 'string' && art !== '';
    const hasArtSource = hasArt && typeof artSource === 'string' && artSource !== '';
    if (hasArt) images.art = art;
    if (hasArtSource) images.artSource = artSource;
    data = {
      ...rest,
      version: 2,
      hasArt,
      hasArtSource,
      artCrop: hasArtSource ? artCrop ?? null : null,
      flavor: rest.flavor ?? '',
    };
  }

  // v3 added absorbing cards and opening boosters.
  if (data.version === 2) {
    data = { ...data, version: 3, absorbed: data.absorbed ?? [], booster: data.booster ?? null };
  }

  // v4 keeps the whole mana cost with its symbols instead of a number. A v3 cost
  // only knew the total, so it becomes that much generic mana.
  if (data.version === 3) {
    const { cost, ...rest } = data;
    data = { ...rest, version: 4, manaCost: rest.manaCost ?? `{${Number.isInteger(cost) && cost > 0 ? cost : 0}}` };
  }

  // v5 keeps keywords apart from the other abilities, to explain them.
  if (data.version === 4) {
    data = { ...data, version: 5, keywords: data.keywords ?? [], abilities: data.abilities ?? [] };
  }

  // v6 adds the card types besides Creature. Older saves never kept them.
  if (data.version === 5) {
    data = { ...data, version: 6, cardTypes: data.cardTypes ?? [] };
  }

  // v7 adds the +1/+1 counters.
  if (data.version === 6) {
    data = { ...data, version: 7, counters: data.counters ?? 0 };
  }

  // v8 adds the bonuses until the end of combat.
  if (data.version === 7) {
    data = { ...data, version: 8, bonusPower: data.bonusPower ?? 0, bonusToughness: data.bonusToughness ?? 0 };
  }

  // v9 adds the cards that transform.
  if (data.version === 8) {
    data = { ...data, version: 9, transforms: data.transforms ?? [] };
  }

  // v10 adds Equipment, Auras and the spell list.
  if (data.version === 9) {
    data = { ...data, version: 10, equipment: data.equipment ?? [], auras: data.auras ?? [], spells: data.spells ?? [] };
  }

  // v11 adds the starting points. A card that already absorbed something was made before them.
  if (data.version === 10) {
    const fresh = !(data.absorbed || []).length;
    data = { ...data, version: 11, start: data.start ?? (fresh ? { points: START_POINTS, colors: null } : null) };
  }

  // v12 adds experience and levels. Boosters now come from leveling up, so a free booster
  // left open by an older version (no level) is dropped.
  if (data.version === 11) {
    data = {
      ...data,
      version: 12,
      level: data.level ?? 1,
      xp: data.xp ?? 0,
      levelBoosters: data.levelBoosters ?? [],
      booster: data.booster && data.booster.level ? data.booster : null,
    };
  }

  return { status: 'ok', player: data, images };
}
