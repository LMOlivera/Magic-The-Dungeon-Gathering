import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  START_POINTS, newStart, picksSpells, cardPoints, maxX, affordableCreatures, startSpells, withStartPick, withStartDone,
} from '../js/player/start.js';
import { absorbCard, isAbsorbable } from '../js/player/absorb.js';
import { newPlayer, upgradeSave, SAVE_VERSION } from '../js/player/model.js';

const pool = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8')).cards;
const creatures = pool('akashicos');
const spells = pool('akashicos_spells');
const creature = (name) => creatures.find((card) => card.name.split(' // ')[0] === name);
const spell = (name) => spells.find((card) => card.name === name);

/** Absorbs a card the way the Player Card does while making a new card. */
function pick(player, card, x) {
  return withStartPick(absorbCard(player, card, { x }), card, x);
}

test('a new card starts with 5 points and picks a creature first', () => {
  const player = newPlayer('Ana');
  assert.equal(START_POINTS, 5);
  assert.deepEqual(player.start, newStart());
  assert.equal(picksSpells(player), false);
  assert.equal(affordableCreatures(creatures, player).length, creatures.length, 'every first card costs 5 or less');
});

test('a card costs its mana value, and a picked X costs points too', () => {
  assert.equal(cardPoints(creature('Aragorn, the Uniter')), 4);
  assert.equal(cardPoints(creature('Mikaeus, the Lunarch'), 2), 3);
  assert.equal(maxX(creature('Mikaeus, the Lunarch'), 5), 4);
  assert.equal(maxX(creature('Wan Shi Tong, Librarian'), 5), 3);
  assert.equal(cardPoints(spell('Banefire')), 1, 'a spell X is paid when it is cast, not with points');
});

test('the spells offered share a color with the creature and fit the points left', () => {
  const player = pick(newPlayer('Ana'), creature('Thalia, Guardian of Thraben')); // {1}{W}
  assert.deepEqual(player.start, { points: 3, colors: ['W'] });
  const offered = startSpells(spells, player);
  assert.ok(offered.length);
  for (const card of offered) assert.ok(card.colors.includes('W') && card.manaValue <= 3, card.name);
  assert.ok(!offered.includes(spell('Banefire')), 'a red spell is not offered');
});

test('picking spells spends points until none are left', () => {
  let player = pick(newPlayer('Ana'), creature('Thalia, Guardian of Thraben'));
  const first = startSpells(spells, player).find((card) => card.manaValue === 2);
  player = pick(player, first);
  assert.equal(player.start.points, 1);
  assert.ok(player.spells.some((entry) => entry.id === first.id));
  assert.ok(!startSpells(spells, player).includes(first), 'a spell is picked once');
  assert.ok(startSpells(spells, player).every((card) => card.manaValue === 1));
  player = pick(player, startSpells(spells, player)[0]);
  assert.equal(player.start, null, 'no points left: done');
  assert.deepEqual(startSpells(spells, player), []);
});

test('spells must match the creature, not colors a spell added', () => {
  // A two-color spell adds its second color to the player, but not to what spells must share.
  let player = pick(newPlayer('Ana'), creature('Gran-Gran')); // {U}
  const twoColors = spells.find((card) => card.colors.length > 1 && card.colors.includes('U'));
  if (twoColors) {
    player = pick(player, twoColors);
    assert.deepEqual(player.start.colors, ['U']);
  }
  assert.ok(startSpells(spells, player).every((card) => card.colors.includes('U')));
});

test('the creature can use up every point, and "Done" ends it early', () => {
  const mikaeus = pick(newPlayer('Ana'), creature('Mikaeus, the Lunarch'), 4);
  assert.equal(mikaeus.start, null);
  const thalia = pick(newPlayer('Ana'), creature('Thalia, Guardian of Thraben'));
  assert.equal(withStartDone(thalia).start, null);
});

test('every spell of akashicos_spells.txt is in the pool and can be absorbed', () => {
  const list = readFileSync(new URL('../akashicos_spells.txt', import.meta.url), 'utf8').split('\n').filter((line) => line.trim());
  assert.equal(spells.length, list.length);
  assert.deepEqual(spells.filter((card) => !isAbsorbable(card)).map((card) => card.name), []);
});

test('upgradeSave gives starting points only to v10 cards that absorbed nothing', () => {
  const fresh = { ...newPlayer('Ana'), version: 10 };
  delete fresh.start;
  assert.deepEqual(upgradeSave(fresh).player.start, { points: 5, colors: null });
  const played = { ...fresh, absorbed: [{ id: 'a', name: 'Aegis Turtle', keywords: [], abilities: [] }] };
  assert.equal(upgradeSave(played).player.start, null);
  assert.equal(upgradeSave(played).player.version, SAVE_VERSION);
});
