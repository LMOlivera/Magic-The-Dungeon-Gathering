import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  frontFace, isCreatureCard, subtypesOf, statValue, mergeColors, describeColors,
  absorbPreview, absorbCreature, textToAbsorb, cardTypesOf, typeLineOf,
} from '../js/player/absorb.js';
import { newPlayer, withBooster } from '../js/player/model.js';
import { CARD_RULES } from '../js/rules/cards.js';
import { keywordRule, parseKeyword, addKeywords } from '../js/rules/keywords.js';
import { TERMS } from '../js/rules/terms.js';

/** A pool card with only the fields absorbing uses. */
function creature(name, { cost = '{1}', colors = [], type = 'Creature — Beast', power = '1', toughness = '1', text = '', faces = [] } = {}) {
  return { id: `id-${name}`, name, manaCost: cost, colors, typeLine: type, power, toughness, text, faces };
}

const turtle = creature('Aegis Turtle', { cost: '{U}', colors: ['U'], type: 'Creature — Turtle', power: '0', toughness: '5' });
const vampire = creature('Vampire Noble', { cost: '{2}{B}', colors: ['B'], type: 'Creature — Vampire Noble', power: '3', toughness: '2' });
const ornithopter = creature('Ornithopter', { cost: '{0}', type: 'Artifact Creature — Thopter', power: '0', toughness: '2', text: 'Flying' });
const sniper = creature('Dragon Sniper', { cost: '{G}', colors: ['G'], type: 'Creature — Human Archer', text: 'Reach, vigilance, deathtouch' });
const unreviewed = creature('Not Reviewed Yet', { text: 'When this creature enters, draw a card.' });

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

test('all the creature types are added, without asking', () => {
  assert.deepEqual(absorbCreature(newPlayer('Ana'), vampire).types, ['Human', 'Vampire', 'Noble']);
});

test('types the player already has are not repeated', () => {
  const knight = creature('Cecil', { type: 'Legendary Creature — Human Knight' });
  assert.deepEqual(absorbPreview(newPlayer('Ana'), knight).newTypes, ['Knight']);
  assert.deepEqual(absorbCreature(newPlayer('Ana'), knight).types, ['Human', 'Knight']);
});

test('absorbing records the card, closes the booster and does not change the original player', () => {
  const before = withBooster(newPlayer('Ana'), ['a', 'b', 'c']);
  const after = absorbCreature(before, turtle);
  assert.deepEqual(after.absorbed, [{ id: 'id-Aegis Turtle', name: 'Aegis Turtle', keywords: [], abilities: [] }]);
  assert.equal(after.booster, null);
  assert.deepEqual(before.booster, { cardIds: ['a', 'b', 'c'] });
  assert.equal(before.power, 1);
  assert.deepEqual(before.absorbed, []);
});

test('stats that are not numbers ask the player how much they add', () => {
  // A card rules/cards.js says nothing about, so the player is asked.
  const archpriest = creature('Unreviewed Star', { cost: '{W}', colors: ['W'], type: 'Creature — Human Cleric', power: '*', toughness: '2' });
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
  const player = absorbCreature(newPlayer('Ana'), adventure);
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
    player = absorbCreature(player, card, { power: 1, toughness: 1 });
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

test('keywords from rules/cards.js are absorbed, without repeats', () => {
  const flier = absorbCreature(newPlayer('Ana'), ornithopter);
  assert.deepEqual(flier.keywords, ['Flying']);
  const both = absorbCreature(flier, sniper);
  assert.deepEqual(both.keywords, ['Flying', 'Reach', 'Vigilance', 'Deathtouch']);
  assert.deepEqual(absorbCreature(both, ornithopter).keywords, both.keywords, 'no repeats');
  assert.deepEqual(absorbPreview(flier, ornithopter).newKeywords, []);
});

test('rules text nobody has decided about gives nothing yet', () => {
  const preview = absorbPreview(newPlayer('Ana'), unreviewed);
  assert.equal(preview.hasText, true);
  assert.equal(preview.textReviewed, false);
  const player = absorbCreature(newPlayer('Ana'), unreviewed);
  assert.deepEqual(player.keywords, []);
  assert.deepEqual(player.abilities, []);
  assert.equal(textToAbsorb(turtle).reviewed, true, 'no text, nothing to decide');
});

test('rules/cards.js only uses defined keywords and names cards of the pool', () => {
  const { cards } = JSON.parse(readFileSync(new URL('../data/level1.json', import.meta.url), 'utf8'));
  const names = new Set(cards.flatMap((poolCard) => [poolCard.name, ...(poolCard.faces || []).map((face) => face.name)]));
  for (const [name, rules] of Object.entries(CARD_RULES)) {
    assert.ok(names.has(name), `${name} is not in the pool`);
    for (const keyword of rules.keywords || []) assert.ok(keywordRule(keyword), `${name}: ${keyword} has no rule in rules/keywords.js`);
  }
});

test('other card types join the player type line', () => {
  assert.deepEqual(cardTypesOf('Legendary Enchantment Creature — Nymph'), ['Legendary', 'Enchantment']);
  assert.equal(typeLineOf({ cardTypes: ['Artifact', 'Legendary'], types: ['Human'] }), 'Legendary Artifact Creature — Human');
  assert.deepEqual(cardTypesOf('Creature — Turtle'), []);
  const nymph = creature('Alseid of Life\'s Bounty', { cost: '{W}', colors: ['W'], type: 'Enchantment Creature — Nymph' });
  const thopter = absorbCreature(newPlayer('Ana'), ornithopter);
  assert.deepEqual(thopter.cardTypes, ['Artifact']);
  const both = absorbCreature(thopter, nymph);
  assert.deepEqual(both.cardTypes, ['Enchantment', 'Artifact'], 'printed order, no repeats');
  assert.equal(typeLineOf(both), 'Enchantment Artifact Creature — Human Thopter Nymph');
  assert.equal(typeLineOf(newPlayer('Ana')), 'Creature — Human');
});

test('every phrase in rules/terms.js shows up in some ability', () => {
  const abilities = Object.values(CARD_RULES).flatMap((rules) => rules.abilities || []);
  for (const term of TERMS) {
    assert.equal(term.pattern.flags.includes('g'), false, `${term.title}: no g flag`);
    assert.ok(abilities.some((ability) => term.pattern.test(ability)), `${term.title} matches no ability`);
  }
});

test('keywords with a number add up', () => {
  assert.deepEqual(parseKeyword('Modular 2'), { name: 'Modular', value: 2 });
  assert.deepEqual(parseKeyword('First strike'), { name: 'First strike', value: null });
  assert.deepEqual(parseKeyword('Ward {1}'), { name: 'Ward', value: 1 });
  assert.deepEqual(addKeywords(['Ward {1}'], ['Ward {2}']), ['Ward {3}'], 'mana numbers keep their braces');
  assert.match(keywordRule('Ward {2}'), /pays 2 mana/);
  assert.deepEqual(addKeywords(['Madness {0}'], ['Madness {1}']), ['Madness {0}'], 'Madness costs do not add up');
  assert.deepEqual(addKeywords(['Bushido 1'], ['Bushido 1']), ['Bushido 2'], 'Bushido stacks');
  assert.match(keywordRule('Bushido 2'), /\+2\/\+2/);
  assert.deepEqual(addKeywords(['Lifelink', 'Modular 1'], ['Modular 1', 'Lifelink', 'Flying']), ['Lifelink', 'Modular 2', 'Flying']);
  assert.deepEqual(addKeywords(['Modular'], ['Modular 1']), ['Modular 1'], 'a save from before numbers');
  assert.match(keywordRule('Modular 2'), /2 \+1\/\+1 counters/);
  assert.match(keywordRule('Modular 1'), /1 \+1\/\+1 counter on/);

  const worker = creature('Arcbound Worker', { type: 'Artifact Creature — Construct', power: '0', toughness: '0', text: 'Modular 1' });
  const once = absorbCreature(newPlayer('Ana'), worker);
  assert.deepEqual(once.keywords, ['Modular 1']);
  const preview = absorbPreview(once, worker);
  assert.deepEqual(preview.newKeywords, ['Modular 2']);
  assert.deepEqual(absorbCreature(once, worker).keywords, ['Modular 2']);
});

test('rules/cards.js can say what a * stat adds, so the player is not asked', () => {
  const archpriest = creature('Archpriest of Iona', { cost: '{W}', colors: ['W'], type: 'Creature — Human Cleric', power: '*', toughness: '2', text: 'Archpriest of Iona\'s power is equal to the number of creatures in your party.' });
  const preview = absorbPreview(newPlayer('Ana'), archpriest);
  assert.equal(preview.addPower, 0);
  assert.equal(preview.addToughness, 2);
  const player = absorbCreature(newPlayer('Ana'), archpriest, { power: '5' });
  assert.equal(`${player.power}/${player.toughness}`, '1/3', 'the power stays the player own');
});
