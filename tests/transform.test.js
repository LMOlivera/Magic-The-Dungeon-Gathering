import { test } from 'node:test';
import assert from 'node:assert/strict';

import { absorbCreature } from '../js/player/absorb.js';
import { newPlayer, toCardData, upgradeSave, SAVE_VERSION } from '../js/player/model.js';
import {
  withTransformed, untransformAll, withTransformName, withTransformArt, withoutTransformArt, shownTransform,
} from '../js/player/transform.js';

const cecil = {
  id: 'cecil',
  name: 'Cecil, Dark Knight // Cecil, Redeemed Paladin',
  layout: 'transform',
  colors: ['B'],
  faces: [
    { name: 'Cecil, Dark Knight', manaCost: '{B}', typeLine: 'Legendary Creature — Human Knight', power: '2', toughness: '3', text: 'Deathtouch\nDarkness — …' },
    { name: 'Cecil, Redeemed Paladin', manaCost: '', typeLine: 'Legendary Creature — Human Knight', power: '4', toughness: '4', text: 'Lifelink\nProtect — …' },
  ],
};
const biter = { id: 'biter', name: 'Ankle Biter', manaCost: '{G}', colors: ['G'], typeLine: 'Creature — Snake', power: '1', toughness: '1', text: 'Deathtouch', faces: [] };

const withCecil = () => absorbCreature(newPlayer('Ana'), cecil);

test('absorbing a card that transforms keeps its back face', () => {
  const player = withCecil();
  assert.equal(player.transforms.length, 1);
  const [entry] = player.transforms;
  assert.equal(entry.front, 'Cecil, Dark Knight');
  assert.equal(entry.back, 'Cecil, Redeemed Paladin');
  assert.equal(entry.transformed, false);
  assert.deepEqual(entry.gave.keywords, ['Deathtouch']);
  assert.equal(shownTransform(player), -1);
  const data = toCardData(player);
  assert.equal(`${data.power}/${data.toughness}`, '3/4');
  assert.deepEqual(data.keywords, ['Deathtouch']);
  assert.equal(data.transformed, false);
});

test('transformed, the card trades the front face for the back one and gets +2/+1', () => {
  const player = withTransformed(withCecil(), 0, true);
  const data = toCardData(player);
  assert.equal(`${data.power}/${data.toughness}`, '5/5');
  assert.deepEqual(data.keywords, ['Lifelink']);
  assert.equal(data.abilities.length, 1);
  assert.match(data.abilities[0], /^Protect/);
  assert.equal(data.transformed, true);
  assert.equal(shownTransform(player), 0);

  const back = untransformAll(player);
  assert.deepEqual(toCardData(back).keywords, ['Deathtouch']);
  assert.match(toCardData(back).abilities[0], /^Darkness/);
});

test('a keyword another card gave too stays when transformed', () => {
  const player = withTransformed(absorbCreature(withCecil(), biter), 0, true);
  assert.deepEqual(toCardData(player).keywords, ['Deathtouch', 'Lifelink']);
});

test('the other face can have its own name and art', () => {
  let player = withTransformName(withCecil(), 0, '  Ana,   the Paladin ');
  player = withTransformArt(player, 0, { zoom: 1, cx: 0.5, cy: 0.5 }, true);
  assert.equal(toCardData(player, 'blob:front', ['blob:back']).name, 'Ana');
  const flipped = withTransformed(player, 0, true);
  const data = toCardData(flipped, 'blob:front', ['blob:back']);
  assert.equal(data.name, 'Ana, the Paladin');
  assert.equal(data.artUrl, 'blob:back');

  const plain = withTransformName(withoutTransformArt(flipped, 0), 0, '');
  const plainData = toCardData(plain, 'blob:front', []);
  assert.equal(plainData.name, 'Ana', 'no name of its own: the usual one');
  assert.equal(plainData.artUrl, 'blob:front', 'no art of its own: the usual one');
});

test('upgradeSave adds transforms to v8 saves', () => {
  const v8 = { ...newPlayer('Ana'), version: 8 };
  delete v8.transforms;
  const { player } = upgradeSave(v8);
  assert.equal(player.version, SAVE_VERSION);
  assert.deepEqual(player.transforms, []);
});
