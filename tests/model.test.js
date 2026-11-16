import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SAVE_VERSION, FLAVOR_MAX,
  cleanName, newPlayer, withFlavor, withArt, withoutArt, withBooster, withCounters, describeCounters,
  toCardData, upgradeSave,
} from '../js/player/model.js';

test('a new player is a colorless 1/1 Human with cost {0} and a sealed name', () => {
  const player = newPlayer('Ana', new Date('2026-11-16T12:00:00Z'));
  assert.equal(player.version, SAVE_VERSION);
  assert.equal(player.name, 'Ana');
  assert.equal(player.nameLocked, true);
  assert.equal(player.manaCost, '{0}');
  assert.equal('cost' in player, false);
  assert.deepEqual(player.colors, []);
  assert.deepEqual(player.types, ['Human']);
  assert.equal(player.power, 1);
  assert.equal(player.toughness, 1);
  assert.equal(player.artChosen, false);
  assert.deepEqual(player.absorbed, []);
  assert.equal(player.booster, null);
  assert.equal(player.createdAt, '2026-11-16T12:00:00.000Z');
});

test('cleanName trims and collapses whitespace, with no length limit', () => {
  assert.equal(cleanName('  Ana   la \n Brava '), 'Ana la Brava');
  assert.equal(cleanName('   '), '');
  assert.equal(cleanName(undefined), '');
  assert.equal(cleanName('A'.repeat(500)).length, 500);
});

test('flavor text is capped at FLAVOR_MAX and does not mutate the player', () => {
  const player = newPlayer('Ana');
  const next = withFlavor(player, 'x'.repeat(FLAVOR_MAX + 50));
  assert.equal(next.flavor.length, FLAVOR_MAX);
  assert.equal(player.flavor, '');
});

test('choosing and removing art updates the flags', () => {
  const crop = { zoom: 2, cx: 0.4, cy: 0.6 };
  const withPhoto = withArt(newPlayer('Ana'), crop, true);
  assert.deepEqual(
    [withPhoto.artChosen, withPhoto.hasArt, withPhoto.hasArtSource, withPhoto.artCrop],
    [true, true, true, crop],
  );

  const noSource = withArt(newPlayer('Ana'), crop, false);
  assert.equal(noSource.hasArtSource, false);
  assert.equal(noSource.artCrop, null);

  const skipped = withoutArt(withPhoto);
  assert.deepEqual(
    [skipped.artChosen, skipped.hasArt, skipped.hasArtSource, skipped.artCrop],
    [true, false, false, null],
  );
});

test('the basic card has no rules text; flavor and art pass through', () => {
  const player = withFlavor(newPlayer('Ana'), 'Born in a tavern.');
  const data = toCardData(player, 'blob:photo');
  assert.equal(data.name, 'Ana');
  assert.deepEqual(data.keywords, []);
  assert.deepEqual(data.abilities, []);
  assert.equal(data.flavor, 'Born in a tavern.');
  assert.equal(data.artUrl, 'blob:photo');
  assert.equal(toCardData(player).artUrl, null);
});

test('upgradeSave ignores missing or broken saves', () => {
  assert.deepEqual(upgradeSave(null), { status: 'empty' });
  assert.deepEqual(upgradeSave('junk'), { status: 'empty' });
  assert.deepEqual(upgradeSave({ version: 1 }), { status: 'empty' });
  assert.deepEqual(upgradeSave({ name: 'Ana' }), { status: 'empty' });
});

test('upgradeSave leaves saves from a newer version alone', () => {
  assert.deepEqual(upgradeSave({ version: SAVE_VERSION + 1, name: 'Ana' }), { status: 'newer' });
});

test('upgradeSave returns a current save unchanged', () => {
  const player = withFlavor(newPlayer('Ana'), 'Hi');
  const result = upgradeSave(player);
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.player, player);
  assert.deepEqual(result.images, {});
});

test('upgradeSave moves v1 photos out of the sheet and keeps everything else', () => {
  const v1 = {
    version: 1,
    name: 'Ana',
    nameLocked: true,
    art: 'data:image/jpeg;base64,AAAA',
    artSource: 'data:image/jpeg;base64,BBBB',
    artCrop: { zoom: 1.5, cx: 0.5, cy: 0.3 },
    artChosen: true,
    flavor: 'Hi',
    cost: 0,
    colors: [],
    types: ['Human'],
    power: 1,
    toughness: 1,
    abilities: [],
    createdAt: '2026-11-16T12:00:00.000Z',
  };
  const { status, player, images } = upgradeSave(v1);
  assert.equal(status, 'ok');
  assert.deepEqual(images, { art: v1.art, artSource: v1.artSource });
  assert.equal(player.version, SAVE_VERSION);
  assert.equal(player.hasArt, true);
  assert.equal(player.hasArtSource, true);
  assert.deepEqual(player.artCrop, v1.artCrop);
  assert.equal('art' in player, false);
  assert.equal('artSource' in player, false);
  for (const key of ['name', 'nameLocked', 'artChosen', 'flavor', 'power', 'toughness', 'createdAt']) {
    assert.deepEqual(player[key], v1[key], key);
  }
  assert.deepEqual(player.absorbed, []);
  assert.equal(player.booster, null);
});

test('upgradeSave adds absorbing and boosters to v2 saves', () => {
  const v2 = { ...newPlayer('Ana'), version: 2, flavor: 'Hi', hasArt: true };
  delete v2.absorbed;
  delete v2.booster;
  const { status, player, images } = upgradeSave(v2);
  assert.equal(status, 'ok');
  assert.equal(player.version, SAVE_VERSION);
  assert.deepEqual(player.absorbed, []);
  assert.equal(player.booster, null);
  assert.equal(player.flavor, 'Hi');
  assert.equal(player.hasArt, true);
  assert.deepEqual(images, {});
});

test('upgradeSave turns a v3 numeric cost into generic mana', () => {
  const v3 = { ...newPlayer('Ana'), version: 3, cost: 2 };
  delete v3.manaCost;
  const { player } = upgradeSave(v3);
  assert.equal(player.version, SAVE_VERSION);
  assert.equal(player.manaCost, '{2}');
  assert.equal('cost' in player, false);
  const zero = { ...v3, cost: 0 };
  assert.equal(upgradeSave(zero).player.manaCost, '{0}');
});

test('the card shows the player mana cost', () => {
  const player = { ...newPlayer('Ana'), manaCost: '{1}{U}' };
  assert.equal(toCardData(player).cost, '{1}{U}');
});

test('an opened booster is kept until a card is absorbed', () => {
  const ids = ['a', 'b', 'c'];
  const player = withBooster(newPlayer('Ana'), ids);
  assert.deepEqual(player.booster, { cardIds: ['a', 'b', 'c'] });
  ids.push('d');
  assert.equal(player.booster.cardIds.length, 3, 'keeps its own copy');
  assert.deepEqual(upgradeSave(player).player.booster, { cardIds: ['a', 'b', 'c'] });
});

test('upgradeSave handles the earliest v1 saves: no flavor, no original photo', () => {
  const withPhoto = upgradeSave({ version: 1, name: 'Ana', art: 'data:image/jpeg;base64,AAAA', artChosen: true });
  assert.deepEqual(withPhoto.images, { art: 'data:image/jpeg;base64,AAAA' });
  assert.equal(withPhoto.player.hasArt, true);
  assert.equal(withPhoto.player.hasArtSource, false);
  assert.equal(withPhoto.player.artCrop, null);
  assert.equal(withPhoto.player.flavor, '');

  const skipped = upgradeSave({ version: 1, name: 'Ana', art: null, artChosen: true });
  assert.deepEqual(skipped.images, {});
  assert.equal(skipped.player.hasArt, false);
});

test('upgradeSave keeps v4 abilities and adds keywords', () => {
  const v4 = { ...newPlayer('Ana'), version: 4, abilities: ['Old note'] };
  delete v4.keywords;
  const { player } = upgradeSave(v4);
  assert.equal(player.version, SAVE_VERSION);
  assert.deepEqual(player.keywords, []);
  assert.deepEqual(player.abilities, ['Old note']);
});

test('upgradeSave adds card types to v5 saves', () => {
  const v5 = { ...newPlayer('Ana'), version: 5 };
  delete v5.cardTypes;
  const { player } = upgradeSave(v5);
  assert.equal(player.version, SAVE_VERSION);
  assert.deepEqual(player.cardTypes, []);
});

test('+1/+1 counters show on the card power and toughness', () => {
  const player = withCounters({ ...newPlayer('Ana'), power: 2, toughness: 3 }, 2);
  assert.equal(player.power, 2, 'the absorbed power stays apart');
  assert.equal(`${toCardData(player).power}/${toCardData(player).toughness}`, '4/5');
  const shrunk = withCounters(player, -1);
  assert.equal(`${toCardData(shrunk).power}/${toCardData(shrunk).toughness}`, '1/2');
  assert.equal(describeCounters(2), '+2/+2');
  assert.equal(describeCounters(-1), '-1/-1');
  assert.equal(describeCounters(0), '0');
});

test('upgradeSave adds counters to v6 saves', () => {
  const v6 = { ...newPlayer('Ana'), version: 6 };
  delete v6.counters;
  const { player } = upgradeSave(v6);
  assert.equal(player.version, SAVE_VERSION);
  assert.equal(player.counters, 0);
});
