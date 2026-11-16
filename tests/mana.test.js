import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseManaCost, formatManaCost, combineManaCosts, manaValue,
  manaSymbolUrl, describeSymbol, describeManaCost, newSymbols,
} from '../js/shared/mana.js';

test('costs are read symbol by symbol', () => {
  assert.deepEqual(parseManaCost('{2}{U}{B/R}'), ['2', 'U', 'B/R']);
  assert.deepEqual(parseManaCost('{0}'), ['0']);
  assert.deepEqual(parseManaCost(''), []);
  assert.deepEqual(parseManaCost(null), []);
  assert.deepEqual(parseManaCost('{1}{B} // {B}'), ['1', 'B', 'B'], 'callers pass one face; this just reads symbols');
});

test('absorbing adds the symbols like a printed card', () => {
  assert.equal(combineManaCosts('{0}', '{R}'), '{R}', 'the starting {0} goes away');
  assert.equal(combineManaCosts('{R}', '{1}{B}'), '{1}{B}{R}');
  assert.equal(combineManaCosts('{1}{B}{R}', '{2}{R}'), '{3}{B}{R}{R}');
  assert.equal(combineManaCosts('{U}', '{B/R}'), '{U}{B/R}');
  assert.equal(combineManaCosts('{B}', '{B/R}'), '{B}{B/R}', 'a color before its hybrids');
  assert.equal(combineManaCosts('{0}', '{0}'), '{0}');
  assert.equal(combineManaCosts('{0}', ''), '{0}', 'cards with no cost add nothing');
  assert.equal(combineManaCosts('{G}', '{1}'), '{1}{G}');
});

test('the usual order: X, generic, colorless, then W U B R G', () => {
  assert.equal(formatManaCost(['G', 'R', 'B', 'U', 'W', '2', 'X', 'C']), '{X}{2}{C}{W}{U}{B}{R}{G}');
  assert.equal(formatManaCost(['1', '2', '3']), '{6}');
});

test('mana value counts generic, colors and hybrids the Magic way', () => {
  assert.equal(manaValue('{0}'), 0);
  assert.equal(manaValue('{3}{B}{R}{R}'), 6);
  assert.equal(manaValue('{B/R}'), 1);
  assert.equal(manaValue('{2/W}'), 2);
  assert.equal(manaValue('{X}{R}'), 1);
  assert.equal(manaValue(''), 0);
});

test('symbol images and words', () => {
  assert.equal(manaSymbolUrl('R'), 'https://svgs.scryfall.io/card-symbols/R.svg');
  assert.equal(manaSymbolUrl('B/R'), 'https://svgs.scryfall.io/card-symbols/BR.svg');
  assert.equal(manaSymbolUrl('2/W'), 'https://svgs.scryfall.io/card-symbols/2W.svg');
  assert.equal(manaSymbolUrl('12'), 'https://svgs.scryfall.io/card-symbols/12.svg');
  assert.equal(describeSymbol('B/R'), 'black or red');
  assert.equal(describeSymbol('B/P'), 'black or two life');
  assert.equal(describeManaCost('{2}{U}'), '2, blue');
  assert.equal(describeManaCost(''), '0');
});

test('the new symbols after absorbing are found, generic changes included', () => {
  assert.deepEqual(newSymbols('{0}', '{R}'), [true]);
  assert.deepEqual(newSymbols('{1}{B}', '{1}{B}{R}'), [false, false, true]);
  assert.deepEqual(newSymbols('{1}{B}', '{3}{B}'), [true, false]);
  assert.deepEqual(newSymbols('{R}', '{R}{R}'), [false, true]);
});
