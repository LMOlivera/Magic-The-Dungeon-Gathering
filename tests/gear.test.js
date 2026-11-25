import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { absorbCard, absorbPreview, isAbsorbable } from '../js/player/absorb.js';
import { newPlayer, toCardData, upgradeSave, SAVE_VERSION } from '../js/player/model.js';
import {
  kindOf, withoutAttachment, withDestroyed, withOff, putBackOn, withSpellCast, returnSpells, describeGrants,
} from '../js/player/gear.js';

const card = (name, typeLine, manaCost, colors, text = '') => ({ id: `id-${name}`, name, typeLine, manaCost, colors, text, faces: [] });
const mace = card('+2 Mace', 'Artifact — Equipment', '{1}{W}', ['W'], 'Equipped creature gets +2/+2.');
const halberd = card('Kor Halberd', 'Artifact — Equipment', '{W}', ['W'], 'Equipped creature gets +1/+1 and has vigilance.');
const flight = card('Arcane Flight', 'Enchantment — Aura', '{U}', ['U'], 'Enchant creature\nEnchanted creature gets +1/+1 and has flying.');
const blessing = card('Blessing of the Nephilim', 'Enchantment — Aura', '{W}', ['W'], 'Enchanted creature gets +1/+1 for each of its colors.');
const bolt = card('Burst Lightning', 'Instant', '{R}', ['R'], 'Burst Lightning deals 2 damage to any target.');
const desert = card('Desert', 'Land — Desert', '', [], '{T}: Add {C}.');

test('cards are sorted by what absorbing them does', () => {
  assert.equal(kindOf(mace), 'equipment');
  assert.equal(kindOf(flight), 'aura');
  assert.equal(kindOf(bolt), 'spell');
  assert.equal(kindOf(desert), 'other');
  assert.equal(kindOf(card('Ornithopter', 'Artifact Creature — Thopter', '{0}', [])), 'creature');
  assert.equal(isAbsorbable(desert), false);
  assert.equal(isAbsorbable(card('Some Aura', 'Enchantment — Aura', '{G}', ['G'])), false, 'no rules yet');
  assert.equal(kindOf(card('Seal of Fire', 'Enchantment', '{R}', ['R'])), 'item');
  assert.equal(isAbsorbable(mace), true);
});

test('an Equipment adds its color and cost, and the player wears it', () => {
  const player = absorbCard(newPlayer('Ana'), mace);
  assert.deepEqual(player.colors, ['W']);
  assert.equal(player.manaCost, '{1}{W}');
  assert.deepEqual(player.types, ['Human'], 'no types');
  assert.deepEqual(player.cardTypes, [], 'not an Artifact Creature');
  assert.deepEqual(player.equipment, [{ id: 'id-+2 Mace', name: '+2 Mace' }]);
  assert.equal(player.power, 1, 'the bonus stays on the Equipment');
  const data = toCardData(player);
  assert.equal(`${data.power}/${data.toughness}`, '3/3');
  assert.equal(describeGrants('+2 Mace'), '+2/+2');
});

test('a destroyed Equipment gives nothing until combat is over', () => {
  const player = absorbCard(absorbCard(newPlayer('Ana'), mace), halberd);
  assert.deepEqual(toCardData(player).keywords, ['Vigilance']);
  assert.equal(`${toCardData(player).power}/${toCardData(player).toughness}`, '4/4');
  const destroyed = withDestroyed(player, 'equipment', 1, true);
  assert.deepEqual(toCardData(destroyed).keywords, []);
  assert.equal(`${toCardData(destroyed).power}/${toCardData(destroyed).toughness}`, '3/3');
  assert.equal(destroyed.equipment.length, 2, 'still on the card');
  const back = putBackOn(destroyed);
  assert.equal(back.equipment[1].destroyed, false, 'back when combat is over');
  assert.equal(`${toCardData(back).power}/${toCardData(back).toughness}`, '4/4');
  assert.equal(`${toCardData(withDestroyed(destroyed, 'equipment', 1, false)).power}`, '4', 'restored by hand');
});

test('an Aura can be destroyed too, and no longer counts as an enchantment meanwhile', () => {
  const ethereal = card('Ethereal Armor', 'Enchantment — Aura', '{W}', ['W']);
  const player = absorbCard(absorbCard(newPlayer('Ana'), flight), ethereal);
  // 1/1, +1/+1 Arcane Flight, +2/+2 Ethereal Armor (two Auras)
  assert.equal(`${toCardData(player).power}/${toCardData(player).toughness}`, '4/4');
  const destroyed = withDestroyed(player, 'auras', 0, true);
  // 1/1, +1/+1 Ethereal Armor (one Aura left)
  assert.equal(`${toCardData(destroyed).power}/${toCardData(destroyed).toughness}`, '2/2');
});

test('removing an attachment takes it off for good, keeping its colors, cost and place among the absorbed', () => {
  const player = absorbCard(absorbCard(newPlayer('Ana'), mace), flight);
  const removed = withoutAttachment(player, 'auras', 0, 1);
  assert.deepEqual(removed.auras, []);
  assert.deepEqual(toCardData(removed).keywords, []);
  assert.equal(`${toCardData(removed).power}/${toCardData(removed).toughness}`, '3/3');
  assert.deepEqual(removed.colors, player.colors);
  assert.equal(removed.manaCost, player.manaCost);
  assert.deepEqual(removed.absorbed.map((entry) => [entry.name, Boolean(entry.removed)]), [['+2 Mace', false], ['Arcane Flight', true]]);
  assert.equal(putBackOn(removed).auras.length, 0, 'combat over does not bring it back');
});

test('an Aura is for good, and a bonus per color follows the colors', () => {
  const player = absorbCard(absorbCard(newPlayer('Ana'), flight), blessing);
  assert.deepEqual(player.colors, ['W', 'U']);
  assert.deepEqual(toCardData(player).keywords, ['Flying']);
  // 1/1, +1/+1 from Arcane Flight, +2/+2 from Blessing (two colors)
  assert.equal(`${toCardData(player).power}/${toCardData(player).toughness}`, '4/4');
});

test('instants and sorceries join the spell list, cast once per combat', () => {
  let player = absorbCard(newPlayer('Ana'), bolt);
  assert.deepEqual(player.colors, ['R'], 'a spell adds its colors');
  assert.equal(player.manaCost, '{0}', 'its cost is what casting it costs');
  assert.equal(player.spells.length, 1);
  assert.equal(player.spells[0].name, 'Burst Lightning');
  assert.equal(player.spells[0].cast, false);
  assert.equal(absorbPreview(newPlayer('Ana'), bolt).textReviewed, true, 'spells are cast as printed');
  player = withSpellCast(player, 0, true);
  assert.equal(player.spells[0].cast, true);
  assert.equal(returnSpells(player).spells[0].cast, false);
});

test('every Equipment and Aura of the pool either has rules or waits out of boosters', () => {
  const { cards } = JSON.parse(readFileSync(new URL('../data/level1.json', import.meta.url), 'utf8'));
  const waiting = cards.filter((poolCard) => ['equipment', 'aura'].includes(kindOf(poolCard)) && !isAbsorbable(poolCard)).map((poolCard) => poolCard.name);
  assert.deepEqual(waiting, []);
  const notAbsorbable = cards.filter((poolCard) => !isAbsorbable(poolCard)).map((poolCard) => poolCard.name);
  assert.deepEqual(notAbsorbable, [], 'every card of the pool can come up in a booster');
});

test('every card of the first pick (akashicos.txt) can be absorbed', () => {
  const { cards } = JSON.parse(readFileSync(new URL('../data/akashicos.json', import.meta.url), 'utf8'));
  const list = readFileSync(new URL('../akashicos.txt', import.meta.url), 'utf8').split('\n').filter((line) => line.trim());
  assert.equal(cards.length, list.length, 'every card of the list is in the pool');
  assert.deepEqual(cards.filter((poolCard) => !isAbsorbable(poolCard)).map((poolCard) => poolCard.name), []);
});

test('upgradeSave adds Equipment, Auras and spells to v9 saves', () => {
  const v9 = { ...newPlayer('Ana'), version: 9 };
  delete v9.equipment;
  delete v9.auras;
  delete v9.spells;
  const { player } = upgradeSave(v9);
  assert.equal(player.version, SAVE_VERSION);
  assert.deepEqual([player.equipment, player.auras, player.spells], [[], [], []]);
});

test('Equipment and Auras with a toggle come off for the combat and grant nothing meanwhile', () => {
  const carapace = card('Carapace', 'Enchantment — Aura', '{G}', ['G']);
  const player = absorbCard(newPlayer('Ana'), carapace);
  assert.equal(`${toCardData(player).power}/${toCardData(player).toughness}`, '1/3');
  const revived = withOff(player, 'auras', 0, true);
  assert.equal(`${toCardData(revived).power}/${toCardData(revived).toughness}`, '1/1');
  assert.deepEqual(toCardData(revived).abilities, []);
  const back = putBackOn(revived);
  assert.equal(`${toCardData(back).power}/${toCardData(back).toughness}`, '1/3');
});

test('an item like Seal of Fire is kept with the Equipment, and sacrificing it lasts the combat', () => {
  const seal = card('Seal of Fire', 'Enchantment', '{R}', ['R'], 'Sacrifice this enchantment: It deals 2 damage to any target.');
  const player = absorbCard(newPlayer('Ana'), seal);
  assert.deepEqual(player.equipment.map((entry) => entry.name), ['Seal of Fire']);
  assert.deepEqual(player.auras, []);
  assert.equal(toCardData(player).abilities.length, 1);
  assert.deepEqual(toCardData(withoutAttachment(player, 'equipment', 0, 0)).abilities, []);
  const sacrificed = withOff(player, 'equipment', 0, true);
  assert.deepEqual(toCardData(sacrificed).abilities, []);
  assert.equal(putBackOn(sacrificed).equipment[0].off, false, 'back when combat is over');
});

test('absorbCard absorbs every creature of the pool as a creature', () => {
  const { cards } = JSON.parse(readFileSync(new URL('../data/level1.json', import.meta.url), 'utf8'));
  for (const poolCard of cards.filter((c) => kindOf(c) === 'creature')) {
    assert.equal(absorbPreview(newPlayer('Ana'), poolCard).kind, 'creature', poolCard.name);
    const player = absorbCard(newPlayer('Ana'), poolCard, { power: 0, toughness: 0 });
    assert.equal(player.absorbed.length, 1);
    assert.ok(player.types.length > 1 || poolCard.typeLine.includes('Human'), `${poolCard.name} adds its types`);
  }
  const cecil = cards.find((c) => c.name.startsWith('Cecil'));
  const withCecil = absorbCard(newPlayer('Ana'), cecil);
  assert.equal(withCecil.transforms.length, 1, 'Cecil can transform');
  assert.equal(`${withCecil.power}/${withCecil.toughness}`, '3/4');
  assert.deepEqual(toCardData(withCecil).keywords, ['Deathtouch']);
});

test('upgradeSave keeps a v12 save as it was: nothing destroyed or removed', () => {
  const v12 = { ...absorbCard(absorbCard(newPlayer('Ana'), mace), flight), version: 12 };
  const { status, player } = upgradeSave(v12);
  assert.equal(status, 'ok');
  assert.equal(player.version, SAVE_VERSION);
  assert.deepEqual(player.equipment, v12.equipment);
  assert.deepEqual(player.auras, v12.auras);
  assert.deepEqual(player.absorbed, v12.absorbed);
  assert.equal(`${toCardData(player).power}/${toCardData(player).toughness}`, '4/4');
});
