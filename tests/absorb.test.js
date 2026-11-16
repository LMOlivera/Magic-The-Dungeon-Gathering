import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  frontFace, isCreatureCard, subtypesOf, statValue, mergeColors, describeColors,
  absorbPreview, absorbCreature,
} from '../js/player/absorb.js';
import { newPlayer, withBooster } from '../js/player/model.js';

/** A pool card with only the fields absorbing uses. */
function creature(name, { cost = '{1}', colors = [], type = 'Creature — Beast', power = '1', toughness = '1', faces = [] } = {}) {
  return { id: `id-${name}`, name, manaCost: cost, colors, typeLine: type, power, toughness, faces };
}

const turtle = creature('Aegis Turtle', { cost: '{U}', colors: ['U'], type: 'Creature — Turtle', power: '0', toughness: '5' });
const vampire = creature('Vampire Noble', { cost: '{2}{B}', colors: ['B'], type: 'Creature — Vampire Noble', power: '3', toughness: '2' });
const ornithopter = creature('Ornithopter', { cost: '{0}', type: 'Artifact Creature — Thopter', power: '0', toughness: '2' });

test('absorbing a creature adds its power and toughness', () => {
  const player = absorbCreature(newPlayer('Ana'), turtle);
  assert.equal(`${player.power}/${player.toughness}`, '1/6');
});

test('a colorless player takes the creature colors; a colored one adds them', () => {
  const blue = absorbCreature(newPlayer('Ana'), turtle);
  assert.deepEqual(blue.colors, ['U']);
  const blueBlack = absorbCreature(blue, vampire);
  assert.deepEqual(blueBlack.colors, ['U', 'B']);
  assert.deepEqual(absorbCreature(blueBlack, turtle).colors, ['U', 'B'], 'no repeats');
});

test('a colorless creature leaves the colors as they are', () => {
  assert.deepEqual(absorbCreature(newPlayer('Ana'), ornithopter).colors, []);
  assert.deepEqual(absorbCreature(absorbCreature(newPlayer('Ana'), turtle), ornithopter).colors, ['U']);
});

test('the creature mana cost is added symbol by symbol', () => {
  const blue = absorbCreature(newPlayer('Ana'), turtle);
  assert.equal(blue.manaCost, '{U}', 'the starting {0} goes away');
  const player = absorbCreature(blue, vampire);
  assert.equal(player.manaCost, '{2}{U}{B}');
  assert.equal(absorbCreature(player, ornithopter).manaCost, '{2}{U}{B}', '{0} adds nothing');
  const red = creature('Goblin', { cost: '{1}{R}', colors: ['R'] });
  assert.equal(absorbCreature(player, red).manaCost, '{3}{U}{B}{R}');
});

test('only the creature types the player chooses are added', () => {
  const base = newPlayer('Ana');
  assert.deepEqual(absorbCreature(base, vampire).types, ['Human'], 'nothing chosen');
  assert.deepEqual(absorbCreature(base, vampire, { types: ['Noble'] }).types, ['Human', 'Noble']);
  assert.deepEqual(absorbCreature(base, vampire, { types: ['Vampire', 'Noble'] }).types, ['Human', 'Vampire', 'Noble']);
  assert.deepEqual(absorbCreature(base, vampire, { types: ['Dragon'] }).types, ['Human'], 'types the card lacks are ignored');
});

test('types the player already has are not offered again', () => {
  const knight = creature('Cecil', { type: 'Legendary Creature — Human Knight' });
  assert.deepEqual(absorbPreview(newPlayer('Ana'), knight).newTypes, ['Knight']);
  assert.deepEqual(absorbCreature(newPlayer('Ana'), knight, { types: ['Human', 'Knight'] }).types, ['Human', 'Knight']);
});

test('absorbing records the card, closes the booster and does not change the original player', () => {
  const before = withBooster(newPlayer('Ana'), ['a', 'b', 'c']);
  const after = absorbCreature(before, turtle);
  assert.deepEqual(after.absorbed, [{ id: 'id-Aegis Turtle', name: 'Aegis Turtle' }]);
  assert.equal(after.booster, null);
  assert.deepEqual(before.booster, { cardIds: ['a', 'b', 'c'] });
  assert.equal(before.power, 1);
  assert.deepEqual(before.absorbed, []);
});

test('stats that are not numbers ask the player how much they add', () => {
  const archpriest = creature('Archpriest of Iona', { cost: '{W}', colors: ['W'], type: 'Creature — Human Cleric', power: '*', toughness: '2' });
  const preview = absorbPreview(newPlayer('Ana'), archpriest);
  assert.equal(preview.addPower, null);
  assert.equal(preview.rawPower, '*');
  assert.equal(preview.addToughness, 2);
  assert.equal(absorbCreature(newPlayer('Ana'), archpriest).power, 1, 'adds 0 when the player says nothing');
  assert.equal(absorbCreature(newPlayer('Ana'), archpriest, { power: '3' }).power, 4);
  assert.equal(absorbCreature(newPlayer('Ana'), archpriest, { power: 'junk' }).power, 1);
  assert.equal(absorbCreature(newPlayer('Ana'), archpriest, { power: 3 }).toughness, 3, 'printed stats ignore choices');
});

test('two-part cards absorb their creature part', () => {
  const adventure = {
    id: 'adv', name: 'Smitten Swordmaster // Curry Favor', manaCost: '{1}{B} // {B}', colors: ['B'],
    typeLine: 'Creature — Human Knight // Sorcery — Adventure', power: '2', toughness: '1',
    faces: [
      { name: 'Smitten Swordmaster', manaCost: '{1}{B}', typeLine: 'Creature — Human Knight', power: '2', toughness: '1', colors: null },
      { name: 'Curry Favor', manaCost: '{B}', typeLine: 'Sorcery — Adventure', power: null, toughness: null, colors: null },
    ],
  };
  assert.equal(frontFace(adventure).name, 'Smitten Swordmaster');
  assert.ok(isCreatureCard(adventure));
  const player = absorbCreature(newPlayer('Ana'), adventure, { types: ['Knight'] });
  assert.equal(`${player.power}/${player.toughness}`, '3/2');
  assert.deepEqual(player.colors, ['B']);
  assert.equal(player.manaCost, '{1}{B}', 'only the creature part, not the adventure');
  assert.deepEqual(player.types, ['Human', 'Knight']);
  assert.equal(player.absorbed[0].name, 'Smitten Swordmaster');
});

test('helpers', () => {
  assert.deepEqual(subtypesOf('Artifact Creature — Phyrexian Myr'), ['Phyrexian', 'Myr']);
  assert.deepEqual(subtypesOf('Land Creature — Forest Dryad'), ['Forest', 'Dryad']);
  assert.deepEqual(subtypesOf('Artifact'), []);
  assert.equal(statValue('3'), 3);
  assert.equal(statValue('-1'), -1);
  assert.equal(statValue('*'), null);
  assert.equal(statValue('1+*'), null);
  assert.equal(statValue(null), null);
  assert.deepEqual(mergeColors(['R', 'W'], ['G', 'U']), ['W', 'U', 'R', 'G']);
  assert.equal(describeColors([]), 'colorless');
  assert.equal(describeColors(['B']), 'black');
  assert.equal(describeColors(['B', 'U']), 'blue and black');
  assert.equal(describeColors(['W', 'U', 'B']), 'white, blue and black');
  assert.ok(!isCreatureCard(creature('Fog', { type: 'Instant' })));
  assert.ok(isCreatureCard(creature('Dryad Arbor', { type: 'Land Creature — Forest Dryad' })));
});

test('every creature in the level 1 pool can be absorbed', async () => {
  const { cards } = JSON.parse(readFileSync(new URL('../data/level1.json', import.meta.url), 'utf8'));
  const creatures = cards.filter(isCreatureCard);
  assert.equal(creatures.length, 64);
  let player = newPlayer('Ana');
  for (const card of creatures) {
    const preview = absorbPreview(player, card);
    player = absorbCreature(player, card, { types: preview.newTypes, power: 1, toughness: 1 });
  }
  assert.ok(Number.isInteger(player.power) && Number.isInteger(player.toughness));
  assert.match(player.manaCost, /^(\{[^}]+\})+$/);
  // Every symbol of every creature ended up in the cost.
  const { manaValue } = await import('../js/shared/mana.js');
  const total = creatures.reduce((sum, card) => sum + manaValue(frontFace(card).manaCost), 0);
  assert.equal(manaValue(player.manaCost), total);
  assert.deepEqual(player.colors, ['W', 'U', 'B', 'R', 'G']);
  assert.equal(player.absorbed.length, 64);
  assert.equal(new Set(player.types).size, player.types.length, 'no repeated types');
});

test('the card frame follows the colors: grey, the color, or gold for several', async () => {
  const { frameFor } = await import('../js/shared/card.js');
  assert.equal(frameFor([]), 'colorless');
  assert.equal(frameFor(['U']), 'U');
  assert.equal(frameFor(['W']), 'W');
  assert.equal(frameFor(['U', 'B']), 'gold');
  assert.equal(frameFor(['W', 'U', 'B', 'R', 'G']), 'gold');
});
