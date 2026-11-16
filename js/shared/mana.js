/**
 * Mana costs in Scryfall's notation: "{2}{U}{B/R}". Plain functions, no DOM,
 * so everything here can be tested with `node --test`.
 *
 * A cost is handled as a list of symbols without braces: ['2', 'U', 'B/R'].
 */

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'];
const COLOR_WORDS = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green', C: 'colorless', S: 'snow' };
const isGeneric = (symbol) => /^\d+$/.test(symbol);

/** "{2}{U}{B/R}" -> ['2', 'U', 'B/R']. Anything outside braces is ignored. */
export function parseManaCost(cost) {
  return [...String(cost ?? '').matchAll(/\{([^}]+)\}/g)].map((match) => match[1].toUpperCase());
}

/** Where a symbol goes in a printed cost: X, the generic number, colorless, then by color. */
function symbolRank(symbol) {
  if (symbol === 'X') return [0, 0];
  if (isGeneric(symbol)) return [1, 0];
  if (symbol === 'C') return [2, 0];
  if (symbol === 'S') return [3, 0];
  const colors = symbol.split('/').filter((part) => COLOR_ORDER.includes(part));
  const first = colors.length ? COLOR_ORDER.indexOf(colors[0]) : COLOR_ORDER.length;
  // Single colors before hybrids of the same color.
  return [4, first * 10 + (symbol.includes('/') ? 1 : 0)];
}

/** Symbols in the usual printed order, as a cost string. Several generic symbols become one number. */
export function formatManaCost(symbols) {
  const generic = symbols.filter(isGeneric).reduce((sum, symbol) => sum + Number(symbol), 0);
  const others = symbols.filter((symbol) => !isGeneric(symbol));
  const list = generic || !others.length ? [String(generic), ...others] : others;
  list.sort((a, b) => {
    const [ra, sa] = symbolRank(a);
    const [rb, sb] = symbolRank(b);
    return ra - rb || sa - sb;
  });
  return list.map((symbol) => `{${symbol}}`).join('');
}

/** Adds two costs the way a card would print them: {1}{B} + {2}{R} = {3}{B}{R}. */
export function combineManaCosts(a, b) {
  return formatManaCost([...parseManaCost(a), ...parseManaCost(b)]);
}

/** The cost as a single number, like Magic's mana value: X counts 0, {2/W} counts 2. */
export function manaValue(cost) {
  return parseManaCost(cost).reduce((sum, symbol) => {
    if (isGeneric(symbol)) return sum + Number(symbol);
    if (symbol === 'X' || symbol === 'Y' || symbol === 'Z') return sum;
    const twoGeneric = symbol.match(/^(\d+)\//);
    return sum + (twoGeneric ? Number(twoGeneric[1]) : 1);
  }, 0);
}

/** Scryfall's image of a symbol. Generic numbers above 20 have no image; callers fall back to text. */
export function manaSymbolUrl(symbol) {
  return `https://svgs.scryfall.io/card-symbols/${symbol.replace(/\//g, '')}.svg`;
}

/** Words for one symbol, for screen readers and tooltips: "2", "blue", "black or red". */
export function describeSymbol(symbol) {
  if (isGeneric(symbol)) return symbol;
  return symbol.split('/').map((part) => {
    if (part === 'P') return 'two life';
    return COLOR_WORDS[part] || part;
  }).join(' or ');
}

/** "2, blue, black or red"; "0" for {0}. */
export function describeManaCost(cost) {
  const symbols = parseManaCost(cost);
  return symbols.length ? symbols.map(describeSymbol).join(', ') : '0';
}

/**
 * Which symbols of `after` are new compared with `before`, as a list of booleans
 * in the order of parseManaCost(after). A generic number that changed counts as new.
 */
export function newSymbols(before, after) {
  const left = parseManaCost(before);
  return parseManaCost(after).map((symbol) => {
    const index = left.indexOf(symbol);
    if (index === -1) return true;
    left.splice(index, 1);
    return false;
  });
}
