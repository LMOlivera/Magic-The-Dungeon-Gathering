/**
 * The player cards saved in this browser, so one phone can keep several games.
 * Plain data, no DOM and no storage: tests can import it.
 *
 * Where things are saved:
 *   ROSTER_KEY            { version, ids } the cards, in the order they were made
 *   sheetKey(id)          each card's sheet (player/model.js)
 *   imageKeys(id)         its photos in the image store (shared/images.js)
 *   transformImageKeys(id, index)  the photos of the other face of a card that transforms
 *
 * Before there could be several cards, the only card was saved under OLD_SHEET_KEY,
 * with its photos under OLD_IMAGE_KEYS; player/view.js moves it over (oldImageMoves).
 */

export const ROSTER_VERSION = 1;
export const ROSTER_KEY = 'mtdg.players';
export const OLD_SHEET_KEY = 'mtdg.player';

export const sheetKey = (id) => `mtdg.player.${id}`;
export const imageKeys = (id) => ({ art: `player.${id}.art`, artSource: `player.${id}.artSource` });
export const transformImageKeys = (id, index) => ({
  art: `player.${id}.transform${index}.art`,
  artSource: `player.${id}.transform${index}.artSource`,
});

const OLD_IMAGE_KEYS = { art: 'player.art', artSource: 'player.artSource' };
const oldTransformKeys = (index) => ({ art: `player.transform${index}.art`, artSource: `player.transform${index}.artSource` });

export function newRoster() {
  return { version: ROSTER_VERSION, ids: [] };
}

/** A saved roster, or null when there's none (or it's unreadable). */
export function readRoster(saved) {
  if (!saved || typeof saved !== 'object' || !Array.isArray(saved.ids)) return null;
  return { version: ROSTER_VERSION, ids: saved.ids.filter((id) => typeof id === 'string' && id) };
}

export function withCard(roster, id) {
  return roster.ids.includes(id) ? roster : { ...roster, ids: [...roster.ids, id] };
}

export function withoutCard(roster, id) {
  return { ...roster, ids: roster.ids.filter((other) => other !== id) };
}

/** A new id for a card: letters, numbers and dashes, so it fits in storage keys. */
export function newCardId(now = Date.now(), random = Math.random) {
  return `${now.toString(36)}-${Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0')}`;
}

/** Every image key a card can use, given its sheet (for deleting the card). */
export function allImageKeys(id, sheet) {
  const keys = [imageKeys(id)];
  for (const index of (sheet && Array.isArray(sheet.transforms) ? sheet.transforms : []).keys()) {
    keys.push(transformImageKeys(id, index));
  }
  return keys.flatMap((pair) => [pair.art, pair.artSource]);
}

/** [from, to] image keys that move when the single old card becomes card `id`. */
export function oldImageMoves(id, oldSheet) {
  const moves = [
    [OLD_IMAGE_KEYS.art, imageKeys(id).art],
    [OLD_IMAGE_KEYS.artSource, imageKeys(id).artSource],
  ];
  for (const index of (oldSheet && Array.isArray(oldSheet.transforms) ? oldSheet.transforms : []).keys()) {
    moves.push([oldTransformKeys(index).art, transformImageKeys(id, index).art]);
    moves.push([oldTransformKeys(index).artSource, transformImageKeys(id, index).artSource]);
  }
  return moves;
}
