/**
 * Making a new card: the starting points. Plain data, no DOM: tests can import it.
 * Rules in DESIGN.md, section 10 (Player Card).
 *
 * A new card has START_POINTS to spend. First it picks one creature from the first
 * cards (data/akashicos.json), then as many spells from data/akashicos_spells.json
 * as its points allow. Each card costs its mana value in points; for a creature with
 * {X} in its cost, the X the player picks costs points too. Every spell has to share
 * a color with that creature.
 *
 * player.start while the card is being made:
 *   { points, colors }  points left; colors are the creature's, or null before it's picked
 *   null                done (also for cards made before starting points existed)
 */

import { manaValue } from '../shared/mana.js';
import { frontFace, textToAbsorb, chosenX } from './absorb.js';

export const START_POINTS = 5;

/** What a new card starts with. */
export function newStart() {
  return { points: START_POINTS, colors: null };
}

/** The player picked their creature and can now pick spells. */
export function picksSpells(player) {
  return Boolean(player.start && player.start.colors);
}

/** What a card costs in points: its mana value, plus the X picked for a creature with {X}. */
export function cardPoints(card, x = 0) {
  const base = manaValue(frontFace(card).manaCost);
  return textToAbsorb(card).chooseX ? base + chosenX(x) : base;
}

/** The highest X the player can pick for that card with their points (0 or more). */
export function maxX(card, points) {
  return Math.max(0, points - manaValue(frontFace(card).manaCost));
}

/** The first cards the player can pay for. */
export function affordableCreatures(pool, player) {
  const points = player.start ? player.start.points : 0;
  return pool.filter((card) => cardPoints(card) <= points);
}

/**
 * The spells the player can pick now: they share a color with their creature, cost
 * no more than the points left, and weren't picked already.
 */
export function startSpells(pool, player) {
  if (!picksSpells(player)) return [];
  const { points, colors } = player.start;
  const absorbed = new Set((player.absorbed || []).map((card) => card.id));
  return pool.filter((card) => !absorbed.has(card.id)
    && (card.colors || []).some((color) => colors.includes(color))
    && cardPoints(card) <= points);
}

/**
 * The player after paying for a card they picked: the creature sets the colors the
 * spells must share. With no points left, making the card is done.
 */
export function withStartPick(player, card, x = 0) {
  if (!player.start) return player;
  const points = Math.max(0, player.start.points - cardPoints(card, x));
  const colors = player.start.colors || [...(card.colors || [])];
  return { ...player, start: points > 0 ? { points, colors } : null };
}

/** The player is done picking spells (or nothing is left they could pick): the rest of the points are lost. */
export function withStartDone(player) {
  return { ...player, start: null };
}
