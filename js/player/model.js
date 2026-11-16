/**
 * The player's character sheet as plain data. No DOM and no storage here,
 * so everything in this file can be tested with `node --test`.
 *
 * The photos are not part of this object: they live in the image store
 * (shared/images.js) and the sheet only remembers whether they exist.
 */

export const SAVE_VERSION = 2;
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
    cost: 0,
    colors: [],
    types: ['Human'],
    power: 1,
    toughness: 1,
    abilities: [],
    createdAt: now.toISOString(),
  };
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

/** What shared/card.js needs to draw this player. artUrl is the photo, if any. */
export function toCardData(player, artUrl) {
  return {
    name: player.name,
    placeholderName: 'Human',
    cost: player.cost,
    colors: player.colors,
    types: player.types,
    power: player.power,
    toughness: player.toughness,
    rulesText: player.abilities.join(', '),
    flavor: player.flavor,
    artUrl: artUrl || null,
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

  return { status: 'ok', player: data, images };
}
