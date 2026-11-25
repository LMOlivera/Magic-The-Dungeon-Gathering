import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  START_LEVEL, xpToLevelUp, boosterKind, withXp, nextLevelBooster, withLevelBoosterUsed, levelBoosterPool,
} from '../js/player/level.js';
import { newPlayer, withBooster, upgradeSave, SAVE_VERSION } from '../js/player/model.js';
import { absorbCard } from '../js/player/absorb.js';

const pool = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8')).cards;
const spells = pool('akashicos_spells');

test('a card starts at level 1 with 0 XP and no booster waiting', () => {
  const player = newPlayer('Ana');
  assert.equal(player.level, START_LEVEL);
  assert.equal(player.xp, 0);
  assert.equal(nextLevelBooster(player), null);
});

test('leveling up takes level × 3 XP', () => {
  assert.equal(xpToLevelUp(1), 3);
  assert.equal(xpToLevelUp(2), 6);
  assert.equal(xpToLevelUp(5), 15);
  let player = withXp(newPlayer('Ana'), 2);
  assert.deepEqual([player.level, player.xp], [1, 2]);
  player = withXp(player, 1);
  assert.deepEqual([player.level, player.xp], [2, 0], '3 XP reaches level 2');
  player = withXp(player, 6);
  assert.deepEqual([player.level, player.xp], [3, 0], '6 more reach level 3');
});

test('XP left over counts, and a big gain can level up more than once', () => {
  const player = withXp(newPlayer('Ana'), 10); // 3 to level 2, 6 to level 3, 1 left
  assert.deepEqual([player.level, player.xp], [3, 1]);
  assert.deepEqual(player.levelBoosters, [2, 3]);
});

test('losing XP corrects a mistake but never goes below 0 or takes a level away', () => {
  const player = withXp(withXp(newPlayer('Ana'), 4), -5);
  assert.deepEqual([player.level, player.xp], [2, 0]);
  assert.deepEqual(player.levelBoosters, [2]);
});

test('even levels earn a spell booster and odd levels a creature booster', () => {
  assert.equal(boosterKind(2), 'spells');
  assert.equal(boosterKind(3), 'creatures');
  assert.equal(boosterKind(4), 'spells');
  let player = withXp(newPlayer('Ana'), 10);
  assert.deepEqual(nextLevelBooster(player), { level: 2, kind: 'spells' });
  player = withLevelBoosterUsed(withBooster(player, ['a'], 2));
  assert.deepEqual(nextLevelBooster(player), { level: 3, kind: 'creatures' });
  assert.equal(player.booster, null);
});

test('spell boosters only deal spells of the player colors and were not absorbed', () => {
  const player = { ...newPlayer('Ana'), colors: ['R'] };
  const cards = levelBoosterPool(spells, player, 'spells');
  assert.ok(cards.length);
  assert.ok(cards.every((card) => card.colors.includes('R')));
  const absorbedOne = absorbCard(player, cards[0]);
  assert.ok(!levelBoosterPool(spells, absorbedOne, 'spells').includes(cards[0]));
  assert.equal(levelBoosterPool(spells, player, 'creatures').length, spells.length, 'creature boosters ignore color');
  const warp = spells.find((card) => card.name === 'Agony Warp');
  assert.ok(!levelBoosterPool(spells, { ...player, colors: ['U'] }, 'spells').includes(warp), 'blue and black is not blue only');
  assert.ok(levelBoosterPool(spells, { ...player, colors: ['U', 'B'] }, 'spells').includes(warp));
});

test('upgradeSave adds levels to v11 saves and drops a free booster left open', () => {
  const v11 = { ...newPlayer('Ana'), version: 11, booster: { cardIds: ['a', 'b', 'c'] } };
  delete v11.level;
  delete v11.xp;
  delete v11.levelBoosters;
  const { player } = upgradeSave(v11);
  assert.equal(player.version, SAVE_VERSION);
  assert.deepEqual([player.level, player.xp, player.levelBoosters, player.booster], [1, 0, [], null]);
  const open = upgradeSave({ ...v11, booster: { cardIds: ['a'], level: 2 } }).player;
  assert.deepEqual(open.booster, { cardIds: ['a'], level: 2 });
});
