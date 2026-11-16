/**
 * Card pools: JSON files in data/, built by scripts/build-pool.js from Scryfall's bulk data.
 * The game never calls Scryfall's API. The only requests that reach Scryfall are
 * the card images, which the browser loads from the URLs stored in the pool.
 *
 * A pool card:
 *   id, name, layout, manaCost, manaValue, colors, typeLine, text,
 *   power, toughness (strings or null), keywords, artist,
 *   images: { small, normal, artCrop }
 *   faces: [] for most cards; two entries for cards with two parts. Only cards
 *          with two printed sides (layout "transform") have images on each face.
 */

export async function loadPool(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);
  const data = await response.json();
  return data.cards;
}

/** How many printed sides the card has: 2 for double-faced cards, otherwise 1. */
export function sideCount(card) {
  const sides = card.faces.filter((face) => face.images).length;
  return sides > 1 ? sides : 1;
}

/**
 * URL of the full card image on Scryfall. size is 'small' (146x204) or 'normal' (488x680).
 * Always show the whole image, undistorted and uncropped: Scryfall asks that the
 * copyright and artist line stay visible.
 */
export function cardImageUrl(card, side = 0, size = 'normal') {
  const images = sideCount(card) > 1 ? card.faces[side].images : card.images;
  return images ? images[size] : null;
}
