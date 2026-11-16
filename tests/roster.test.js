import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  newRoster, readRoster, withCard, withoutCard, newCardId, sheetKey, imageKeys, transformImageKeys,
  allImageKeys, oldImageMoves,
} from '../js/player/roster.js';

test('cards join and leave the roster in order, without repeats', () => {
  let roster = withCard(withCard(newRoster(), 'a'), 'b');
  assert.deepEqual(roster.ids, ['a', 'b']);
  assert.deepEqual(withCard(roster, 'a').ids, ['a', 'b']);
  roster = withoutCard(roster, 'a');
  assert.deepEqual(roster.ids, ['b']);
});

test('readRoster ignores missing or broken rosters', () => {
  assert.equal(readRoster(null), null);
  assert.equal(readRoster({ ids: 'nope' }), null);
  assert.deepEqual(readRoster({ version: 1, ids: ['a', 3, '', 'b'] }).ids, ['a', 'b']);
});

test('ids fit in storage keys, and each card has its own keys', () => {
  const id = newCardId(1700000000000, () => 0.5);
  assert.match(id, /^[a-z0-9-]+$/);
  assert.notEqual(newCardId(1, () => 0.1), newCardId(1, () => 0.2));
  assert.equal(sheetKey('x'), 'mtdg.player.x');
  assert.deepEqual(imageKeys('x'), { art: 'player.x.art', artSource: 'player.x.artSource' });
  assert.deepEqual(transformImageKeys('x', 1), { art: 'player.x.transform1.art', artSource: 'player.x.transform1.artSource' });
});

test('deleting a card knows every photo it has', () => {
  assert.deepEqual(allImageKeys('x', { transforms: [{}] }), [
    'player.x.art', 'player.x.artSource', 'player.x.transform0.art', 'player.x.transform0.artSource',
  ]);
  assert.deepEqual(allImageKeys('x', null), ['player.x.art', 'player.x.artSource']);
});

test('the single card from before moves its photos to its new id', () => {
  assert.deepEqual(oldImageMoves('x', { transforms: [{}] }), [
    ['player.art', 'player.x.art'],
    ['player.artSource', 'player.x.artSource'],
    ['player.transform0.art', 'player.x.transform0.art'],
    ['player.transform0.artSource', 'player.x.transform0.artSource'],
  ]);
});
