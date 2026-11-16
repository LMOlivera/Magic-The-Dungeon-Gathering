import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SAVE_VERSION, FLAVOR_MAX,
  cleanName, newPlayer, withFlavor, withArt, withoutArt, toCardData, upgradeSave,
} from '../js/player/model.js';

test('a new player is a colorless 1/1 Human with cost 0 and a sealed name', () => {
  const player = newPlayer('Ana', new Date('2026-11-16T12:00:00Z'));
  assert.equal(player.version, SAVE_VERSION);
  assert.equal(player.name, 'Ana');
  assert.equal(player.nameLocked, true);
  assert.equal(player.cost, 0);
  assert.deepEqual(player.colors, []);
  assert.deepEqual(player.types, ['Human']);
  assert.equal(player.power, 1);
  assert.equal(player.toughness, 1);
  assert.equal(player.artChosen, false);
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
  assert.equal(data.rulesText, '');
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
