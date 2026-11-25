import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  attachmentsOf, inheritedCreatures, emptySlots, xpSegments, printedStats, MAX_XP_SEGMENTS,
} from '../js/player/board.js';

const pool = (...cards) => new Map(cards.map((card) => [card.id, card]));
const card = (id, typeLine, power = null, toughness = null) => ({ id, name: id, typeLine, power, toughness, faces: [] });

const hound = card('hound', 'Creature — Dog', '2', '1');
const wisp = card('wisp', 'Creature — Spirit', '1', '1');
const mace = card('mace', 'Artifact — Equipment');
const seal = card('seal', 'Enchantment');
const flight = card('flight', 'Enchantment — Aura');
const bolt = card('bolt', 'Instant');

const player = {
  absorbed: [
    { id: 'hound', name: 'Grave Hound', keywords: [], abilities: [] },
    { id: 'mace', name: 'Mace', keywords: [], abilities: [] },
    { id: 'bolt', name: 'Bolt', keywords: [], abilities: [] },
    { id: 'wisp', name: 'Lantern Wisp', keywords: ['Flying'], abilities: [] },
    { id: 'seal', name: 'Seal', keywords: [], abilities: [] },
    { id: 'flight', name: 'Flight', keywords: [], abilities: [] },
  ],
  equipment: [{ id: 'mace', name: 'Mace', off: false }, { id: 'seal', name: 'Seal', off: true }],
  auras: [{ id: 'flight', name: 'Flight', off: false }],
  spells: [{ id: 'bolt', name: 'Bolt', cast: false }],
};

test('attachments are every card absorbed that is not a creature or a spell, oldest first', () => {
  const attachments = attachmentsOf(player, pool(hound, wisp, mace, seal, flight, bolt));
  assert.deepEqual(attachments.map(({ name, absorbedAt, list, index, kind, off, destroyed }) => [name, absorbedAt, list, index, kind, off, destroyed]), [
    ['Mace', 1, 'equipment', 0, 'equipment', false, false],
    ['Seal', 4, 'equipment', 1, 'item', true, false],
    ['Flight', 5, 'auras', 0, 'aura', false, false],
  ]);
});

test('a destroyed attachment stays, marked; a removed one is gone from every panel', () => {
  const cards = pool(hound, wisp, mace, seal, flight, bolt);
  const destroyed = { ...player, auras: [{ ...player.auras[0], destroyed: true }] };
  assert.deepEqual(attachmentsOf(destroyed, cards).map(({ name, destroyed: d }) => [name, d]), [['Mace', false], ['Seal', false], ['Flight', true]]);

  const removed = {
    ...player,
    equipment: [player.equipment[1]],
    absorbed: player.absorbed.map((entry, i) => (i === 1 ? { ...entry, removed: true } : entry)),
  };
  for (const cardsKnown of [cards, new Map()]) {
    assert.deepEqual(attachmentsOf(removed, cardsKnown).map(({ name, index }) => [name, index]), [['Seal', 0], ['Flight', 0]]);
    assert.ok(!inheritedCreatures(removed, cardsKnown).some((entry) => entry.id === 'mace'), 'not taken for a creature');
  }
});

test('an Equipment destroyed for good by an older version is no longer shown', () => {
  const old = { ...player, equipment: [player.equipment[1]] };
  assert.deepEqual(attachmentsOf(old, pool(hound, wisp, mace, seal, flight, bolt)).map((entry) => entry.name), ['Seal', 'Flight']);
});

test('two copies of a card each match their own entry', () => {
  const twice = {
    absorbed: [{ id: 'mace', name: 'Mace' }, { id: 'mace', name: 'Mace' }],
    equipment: [{ id: 'mace', name: 'Mace', off: false }, { id: 'mace', name: 'Mace', off: true }],
  };
  assert.deepEqual(attachmentsOf(twice, pool(mace)).map(({ index, off }) => [index, off]), [[0, false], [1, true]]);
  const oneRemoved = { absorbed: [twice.absorbed[0], { ...twice.absorbed[1], removed: true }], equipment: [twice.equipment[0]] };
  assert.deepEqual(attachmentsOf(oneRemoved, pool(mace)).map(({ absorbedAt, index }) => [absorbedAt, index]), [[0, 0]]);
});

test('without the pool, attachments are what the player has on, and an item reads as Equipment', () => {
  const attachments = attachmentsOf(player);
  assert.deepEqual(attachments.map(({ name, kind }) => [name, kind]), [['Mace', 'equipment'], ['Seal', 'equipment'], ['Flight', 'aura']]);
  assert.deepEqual(attachmentsOf({}), []);
});

test('every absorbed card lands in exactly one panel', () => {
  const cards = pool(hound, wisp, mace, seal, flight, bolt);
  const shown = [
    ...attachmentsOf(player, cards).map((entry) => entry.absorbedAt),
    ...inheritedCreatures(player, cards).map((entry) => entry.absorbedAt),
    ...player.absorbed.flatMap((entry, i) => (player.spells.some((spell) => spell.id === entry.id) ? [i] : [])),
  ].sort();
  assert.deepEqual(shown, [0, 1, 2, 3, 4, 5]);
});

test('inherited creatures are the creatures absorbed, oldest first, with their pool card', () => {
  const creatures = inheritedCreatures(player, pool(hound, wisp, mace, seal, flight, bolt));
  assert.deepEqual(creatures.map((entry) => entry.name), ['Grave Hound', 'Lantern Wisp']);
  assert.equal(creatures[0].card, hound);
  assert.deepEqual(creatures.map((entry) => entry.absorbedAt), [0, 3]);
  assert.deepEqual(creatures[1].keywords, ['Flying']);
});

test('without the pool, every absorbed card that is not a spell or attachment counts as a creature', () => {
  const creatures = inheritedCreatures(player);
  assert.deepEqual(creatures.map((entry) => entry.name), ['Grave Hound', 'Lantern Wisp']);
  assert.equal(creatures[0].card, null);
  assert.deepEqual(inheritedCreatures({}), []);
});

test('the pool wins over the guess: a destroyed Equipment is not a creature', () => {
  const destroyed = { ...player, equipment: [] };
  assert.ok(inheritedCreatures(destroyed).some((entry) => entry.id === 'mace'), 'the guess gets it wrong');
  assert.ok(!inheritedCreatures(destroyed, pool(hound, wisp, mace)).some((entry) => entry.id === 'mace'));
});

test('empty slots fill a panel up to its minimum, never below zero', () => {
  assert.equal(emptySlots(3, 5), 2);
  assert.equal(emptySlots(0, 6), 6);
  assert.equal(emptySlots(8, 5), 0);
});

test('the XP bar has a segment per XP the level takes', () => {
  assert.deepEqual(xpSegments(2, 3), { segments: [true, true, false], share: 2 / 3 });
  assert.deepEqual(xpSegments(0, 6).segments, [false, false, false, false, false, false]);
  assert.deepEqual(xpSegments(9, 3).segments, [true, true, true], 'never more than full');
});

test('past the segment limit the XP bar is one bar', () => {
  const { segments, share } = xpSegments(15, MAX_XP_SEGMENTS + 3);
  assert.equal(segments, null);
  assert.equal(share, 1);
  assert.equal(xpSegments(3, 30).share, 0.1);
  assert.deepEqual(xpSegments(0, 0), { segments: [], share: 0 });
});

test('printed stats read as on the card', () => {
  assert.equal(printedStats(hound), '2/1');
  assert.equal(printedStats(card('x', 'Creature', '*', '*')), '*/*');
  assert.equal(printedStats(mace), '');
  assert.equal(printedStats(null), '');
});
