import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BOOSTER_SIZE, makeBooster, boosterPool, attachmentPool } from '../js/player/booster.js';
import { parseListLine, nameKeys, toPoolCard } from '../scripts/build-pool.js';
import { sideCount, cardImageUrl } from '../js/shared/cards.js';

const pool = Array.from({ length: 10 }, (_, i) => ({ name: `Card ${i}` }));

/** A repeatable stand-in for Math.random. */
function fakeRandom(seed = 1) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test('a booster has 3 different cards from the pool', () => {
  assert.equal(BOOSTER_SIZE, 3);
  for (let seed = 1; seed <= 200; seed++) {
    const booster = makeBooster(pool, BOOSTER_SIZE, fakeRandom(seed));
    assert.equal(booster.length, 3);
    assert.equal(new Set(booster).size, 3, 'no repeats');
    for (const card of booster) assert.ok(pool.includes(card));
  }
});

test('making a booster does not change the pool', () => {
  const before = [...pool];
  makeBooster(pool, 3, fakeRandom(7));
  assert.deepEqual(pool, before);
});

test('a small pool gives what it has', () => {
  assert.equal(makeBooster(pool.slice(0, 2)).length, 2);
  assert.deepEqual(makeBooster([]), []);
});

test('the booster size can change (4 cards for the player who is behind)', () => {
  assert.equal(makeBooster(pool, 4, fakeRandom(3)).length, 4);
});

test('every card can come up, in every position', () => {
  const seen = [new Set(), new Set(), new Set()];
  const random = fakeRandom(42);
  for (let i = 0; i < 2000; i++) makeBooster(pool, 3, random).forEach((card, slot) => seen[slot].add(card));
  for (const slot of seen) assert.equal(slot.size, pool.length);
});

test('list lines are parsed, including names with commas, slashes and odd numbers', () => {
  assert.deepEqual(parseListLine('1 Aegis Turtle (IKO) 39'), { count: 1, name: 'Aegis Turtle', set: 'IKO', number: '39' });
  assert.deepEqual(parseListLine("1 Alseid of Life's Bounty (PLST) THB-1"), { count: 1, name: "Alseid of Life's Bounty", set: 'PLST', number: 'THB-1' });
  assert.equal(parseListLine('1 Cecil, Dark Knight / Cecil, Redeemed Paladin (FIN) 91').name, 'Cecil, Dark Knight / Cecil, Redeemed Paladin');
  assert.equal(parseListLine('1 +2 Mace (AFR) 1').name, '+2 Mace');
  assert.deepEqual(parseListLine('1 Akiri, Line-Slinger (CMR) 515 *E*'), { count: 1, name: 'Akiri, Line-Slinger', set: 'CMR', number: '515' });
  assert.equal(parseListLine('1 The Goose Mother (PMEI) 2026-10 *F*').name, 'The Goose Mother');
  assert.equal(parseListLine('1 Renfield, Delusional Minion (VOW) 342').name, 'Eruth, Tormented Prophet', 'other printed name');
  assert.equal(parseListLine(''), null);
});

test('two-part names match Scryfall whether written with / or //', () => {
  assert.deepEqual(nameKeys('Smitten Swordmaster / Curry Favor'), ['smitten swordmaster // curry favor', 'smitten swordmaster']);
  assert.deepEqual(nameKeys('Smitten Swordmaster // Curry Favor'), nameKeys('Smitten Swordmaster / Curry Favor'));
  assert.deepEqual(nameKeys('Aegis Turtle'), ['aegis turtle', 'aegis turtle']);
});

test('a Scryfall card is reduced to the fields the game uses', () => {
  const card = toPoolCard({
    id: 'abc', name: 'Aegis Turtle', layout: 'normal', mana_cost: '{U}', cmc: 1, colors: ['U'],
    type_line: 'Creature — Turtle', oracle_text: '', power: '0', toughness: '5', keywords: [], artist: 'Someone',
    image_uris: { small: 's.jpg', normal: 'n.jpg', art_crop: 'a.jpg', png: 'p.png' },
    legalities: { standard: 'legal' }, prices: { usd: '0.05' },
  });
  assert.deepEqual(card, {
    id: 'abc', name: 'Aegis Turtle', layout: 'normal', manaCost: '{U}', manaValue: 1, colors: ['U'],
    typeLine: 'Creature — Turtle', text: '', power: '0', toughness: '5', keywords: [], artist: 'Someone',
    images: { small: 's.jpg', normal: 'n.jpg', artCrop: 'a.jpg' }, faces: [],
  });
});

test('double-faced cards take their images and stats from the faces', () => {
  const card = toPoolCard({
    id: 'dfc', name: 'Front // Back', layout: 'transform', cmc: 1, type_line: 'Creature // Creature', keywords: [],
    card_faces: [
      { name: 'Front', mana_cost: '{B}', type_line: 'Creature', oracle_text: 'a', power: '2', toughness: '3', colors: ['B'], artist: 'X', image_uris: { small: 'f-s', normal: 'f-n', art_crop: 'f-a' } },
      { name: 'Back', mana_cost: '', type_line: 'Creature', oracle_text: 'b', power: '4', toughness: '4', colors: ['W'], image_uris: { small: 'b-s', normal: 'b-n', art_crop: 'b-a' } },
    ],
  });
  assert.equal(card.manaCost, '{B}');
  assert.deepEqual(card.colors, ['B']);
  assert.equal(`${card.power}/${card.toughness}`, '2/3');
  assert.equal(card.images.normal, 'f-n');
  assert.equal(sideCount(card), 2);
  assert.equal(cardImageUrl(card, 0), 'f-n');
  assert.equal(cardImageUrl(card, 1), 'b-n');
  assert.equal(cardImageUrl(card, 1, 'small'), 'b-s');
});

test('adventure-style cards have two parts but one printed side', () => {
  const card = toPoolCard({
    id: 'adv', name: 'Knight // Spell', layout: 'adventure', mana_cost: '{1}{B} // {B}', cmc: 2, colors: ['B'],
    type_line: 'Creature // Sorcery', power: '2', toughness: '1', keywords: [],
    image_uris: { small: 's', normal: 'n', art_crop: 'a' },
    card_faces: [{ name: 'Knight', mana_cost: '{1}{B}', type_line: 'Creature' }, { name: 'Spell', mana_cost: '{B}', type_line: 'Sorcery' }],
  });
  assert.equal(card.faces.length, 2);
  assert.equal(sideCount(card), 1);
  assert.equal(cardImageUrl(card, 0), 'n');
});

test('boosters leave out the cards the player already absorbed', () => {
  const pool = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  const player = { absorbed: [{ id: 'b', name: 'B' }, { id: 'd', name: 'D' }] };
  assert.deepEqual(boosterPool(pool, player).map((card) => card.id), ['a', 'c']);
  assert.equal(boosterPool(pool, player, false), pool, 'repeats allowed');
  assert.deepEqual(boosterPool(pool, { absorbed: [] }), pool);
  for (let seed = 1; seed < 20; seed++) {
    const booster = makeBooster(boosterPool(pool, player), BOOSTER_SIZE, fakeRandom(seed));
    assert.ok(booster.every((card) => card.id !== 'b' && card.id !== 'd'));
  }
});

test('the attachment booster deals every card that is not a creature or a spell, each once', () => {
  const card = (id, typeLine) => ({ id, name: id, typeLine, faces: [] });
  const mace = card('mace', 'Artifact — Equipment');
  const seal = card('seal', 'Enchantment');
  const flight = card('flight', 'Enchantment — Aura');
  const pools = [
    [card('hound', 'Creature — Dog'), mace, card('thopter', 'Artifact Creature — Thopter')],
    [card('bolt', 'Instant'), card('rift', 'Sorcery'), flight],
    [seal, mace, card('desert', 'Land — Desert')],
  ];
  assert.deepEqual(attachmentPool(pools).map((entry) => entry.id), ['mace', 'flight', 'seal']);
  assert.deepEqual(attachmentPool([null, []]), [], 'a pool that failed to load is skipped');
  // And, like any booster, not what the player already absorbed.
  assert.deepEqual(boosterPool(attachmentPool(pools), { absorbed: [{ id: 'mace' }] }).map((entry) => entry.id), ['flight', 'seal']);
});
