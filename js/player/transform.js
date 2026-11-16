/**
 * Cards that transform, like Cecil, Dark Knight. Absorbing one gives the player
 * its front face as usual and keeps its back face, so the Player Card can turn
 * over. Plain data, no DOM: tests can import it.
 *
 * Each entry of player.transforms:
 *   id, front, back        the card's id and the names of its two faces
 *   absorbedIndex          its entry in player.absorbed
 *   gave                   { keywords, abilities } the front face gave the player;
 *                          transformed, the player loses them
 *   power, toughness       the bonus the back face gives
 *   keywords, abilities    what the back face gives instead
 *   transformed            the card shows this back face now
 *   name                   the player's name for that face ('' keeps their usual name)
 *   hasArt, hasArtSource, artCrop  that face's own photo, like the player's
 *                          (the photos are in the image store, see player/view.js)
 */

import { addKeywords, parseKeyword } from '../rules/keywords.js';

/** The entry for a card just absorbed. backRules is the `transform` of its rules/cards.js entry. */
export function newTransform(card, frontName, backRules, gave, absorbedIndex) {
  return {
    id: card.id,
    front: frontName,
    back: backRules.name,
    absorbedIndex,
    gave: { keywords: [...gave.keywords], abilities: [...gave.abilities] },
    power: backRules.power || 0,
    toughness: backRules.toughness || 0,
    keywords: [...(backRules.keywords || [])],
    abilities: [...(backRules.abilities || [])],
    transformed: false,
    name: '',
    hasArt: false,
    hasArtSource: false,
    artCrop: null,
  };
}

function withTransform(player, index, change) {
  return {
    ...player,
    transforms: (player.transforms || []).map((entry, i) => (i === index ? { ...entry, ...change } : entry)),
  };
}

/** Turns one card over (on = true) or back. */
export function withTransformed(player, index, on) {
  return withTransform(player, index, { transformed: Boolean(on) });
}

/** Every card back to its front face, as when combat is over. */
export function untransformAll(player) {
  return { ...player, transforms: (player.transforms || []).map((entry) => ({ ...entry, transformed: false })) };
}

export function withTransformName(player, index, name) {
  return withTransform(player, index, { name: String(name ?? '').replace(/\s+/g, ' ').trim() });
}

export function withTransformArt(player, index, crop, hasSource) {
  return withTransform(player, index, { hasArt: true, hasArtSource: hasSource, artCrop: hasSource ? crop : null });
}

export function withoutTransformArt(player, index) {
  return withTransform(player, index, { hasArt: false, hasArtSource: false, artCrop: null });
}

/** The index of the face showing (the last card turned over), or -1 when none is. */
export function shownTransform(player) {
  const transforms = player.transforms || [];
  for (let i = transforms.length - 1; i >= 0; i--) if (transforms[i].transformed) return i;
  return -1;
}

/**
 * What the player has with the cards turned over as they are: without what the
 * front faces gave (unless another card gave it too), plus what the back faces give.
 * Returns { keywords, abilities, power, toughness } where power and toughness are the bonus.
 */
export function transformedFace(player) {
  const flipped = (player.transforms || []).filter((entry) => entry.transformed);
  let keywords = player.keywords || [];
  let abilities = player.abilities || [];
  if (!flipped.length) return { keywords, abilities, power: 0, toughness: 0 };

  const flippedCards = new Set(flipped.map((entry) => entry.absorbedIndex));
  const others = (player.absorbed || []).filter((_, i) => !flippedCards.has(i));
  const sameKeyword = (a, b) => parseKeyword(a).name === parseKeyword(b).name;
  const othersGive = (keyword) => others.some((card) => (card.keywords || []).some((given) => sameKeyword(given, keyword)));
  const othersGiveAbility = (ability) => others.some((card) => (card.abilities || []).includes(ability));

  for (const entry of flipped) {
    keywords = keywords.filter((keyword) => !entry.gave.keywords.some((given) => sameKeyword(given, keyword)) || othersGive(keyword));
    abilities = abilities.filter((ability) => !entry.gave.abilities.includes(ability) || othersGiveAbility(ability));
  }
  let power = 0;
  let toughness = 0;
  for (const entry of flipped) {
    keywords = addKeywords(keywords, entry.keywords);
    abilities = [...abilities, ...entry.abilities.filter((ability) => !abilities.includes(ability))];
    power += entry.power;
    toughness += entry.toughness;
  }
  return { keywords, abilities, power, toughness };
}
