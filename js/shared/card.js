/**
 * The card component. Every card on screen (home, player, later boosters and
 * monsters) is drawn by renderCard, styled by css/card.css.
 *
 * Card data:
 *   name             string; empty shows placeholderName instead
 *   placeholderName  string, optional
 *   cost             mana cost in Scryfall notation, e.g. '{1}{U}{R}' (see shared/mana.js)
 *   colors           W U B R G letters; empty means colorless
 *   cardTypes        what the type line has before Creature, optional, e.g. ['Legendary', 'Enchantment']
 *   types            creature types, e.g. ['Human']
 *   power, toughness number
 *   keywords         keyword names, optional; each explains itself in a tooltip (rules/keywords.js)
 *   abilities        other abilities as text, optional; one paragraph each. Mana symbols
 *                    show as icons and the phrases of rules/terms.js explain themselves
 *   rulesText        string, optional
 *   flavor           string, optional
 *   artUrl           string, optional; without it the default doorway is drawn
 */

import { el } from './dom.js';
import { COLOR_ORDER, describeColors, typeLineOf } from '../player/absorb.js';
import { parseManaCost, manaSymbolUrl, describeSymbol, describeManaCost } from './mana.js';
import { keywordRule } from '../rules/keywords.js';
import { TERMS, SYMBOLS } from '../rules/terms.js';

const TEXT_MIN_PX = 8;     // the name and the type line never get smaller than this
const BOX_TEXT_MIN_PX = 7; // nor does the text box

/** The frame color, as in Magic: grey when colorless, the color for one, gold for two or more. */
export function frameFor(colors) {
  if (!colors.length) return 'colorless';
  return colors.length === 1 ? colors[0] : 'gold';
}

/** Sets the card--frame-* class. Changing it later makes the frame fade to the new color. */
export function setFrame(target, colors) {
  for (const cls of [...target.classList]) if (cls.startsWith('card--frame-')) target.classList.remove(cls);
  const frame = frameFor(colors);
  if (frame !== 'colorless') target.classList.add(`card--frame-${frame}`);
}

export function describeCard(data) {
  const keywords = (data.keywords || []).map((keyword) => `, ${keyword.toLowerCase()}`).join('');
  return `${data.name || 'Unnamed card'}: ${typeLineOf(data)}, mana cost ${describeManaCost(data.cost)}, ${describeColors(data.colors)}, ${data.power}/${data.toughness}${keywords}`;
}

/**
 * The keywords on one line, as on a real card: "Flying, vigilance". Each one with
 * a rule is a button that shows it in a tooltip (shared/tooltip.js).
 */
function keywordLine(keywords) {
  const line = el('p', 'card__keywords');
  keywords.forEach((keyword, index) => {
    if (index) line.append(', ');
    const label = index ? keyword.toLowerCase() : keyword;
    const rule = keywordRule(keyword);
    if (!rule) {
      line.append(label);
      return;
    }
    const button = explained(label, keyword, rule);
    button.dataset.keyword = keyword;
    line.append(button);
  });
  return line;
}

/** Text (or a node) with a tooltip (shared/tooltip.js), styled like the keywords. */
function explained(content, title, tip) {
  const button = el('button', 'kw');
  button.append(content);
  button.type = 'button';
  button.dataset.tipTitle = title;
  button.dataset.tip = tip;
  return button;
}

// A mana symbol, or one of the phrases of rules/terms.js (group i + 2 is TERMS[i]).
const RICH_TEXT = new RegExp(['(\\{[^}]+\\})', ...TERMS.map((term) => `(${term.pattern.source})`)].join('|'), 'gi');

/**
 * The nodes for an ability's text: mana symbols as icons ("{1}, Sacrifice…"),
 * and the phrases that mean something particular in this game with a tooltip.
 */
export function abilityNodes(text) {
  const nodes = [];
  let last = 0;
  for (const match of text.matchAll(RICH_TEXT)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    last = match.index + match[0].length;
    if (match[1]) {
      const symbol = match[1].slice(1, -1).toUpperCase();
      const icon = manaSymbol(symbol);
      icon.alt = match[1]; // copying the text keeps the braces
      const meaning = Object.hasOwn(SYMBOLS, symbol) ? SYMBOLS[symbol] : null;
      nodes.push(meaning ? explained(icon, meaning.title, meaning.tip) : icon);
      continue;
    }
    const term = TERMS[match.slice(2).findIndex(Boolean)];
    nodes.push(explained(match[0], term.title, term.tip));
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function abilityParagraph(text) {
  const paragraph = el('p', 'card__ability');
  paragraph.dataset.ability = text;
  paragraph.append(...abilityNodes(text));
  return paragraph;
}

/** Fills the text box: keywords, then other abilities, rules text and flavor. */
export function fillCardText(box, data) {
  const parts = [];
  if (data.keywords && data.keywords.length) parts.push(keywordLine(data.keywords));
  for (const ability of data.abilities || []) parts.push(abilityParagraph(ability));
  if (data.rulesText) parts.push(el('p', null, data.rulesText));
  const flavor = (data.flavor || '').trim();
  if (flavor) parts.push(el('p', 'card__flavor', flavor));
  box.replaceChildren(...parts);
}

/**
 * One mana symbol: Scryfall's image, or a plain circle with the text if it
 * can't load (offline, or a generic number above 20, which has no image).
 */
export function manaSymbol(symbol) {
  const img = el('img', 'mana');
  img.src = manaSymbolUrl(symbol);
  img.alt = '';
  img.title = describeSymbol(symbol);
  img.addEventListener('error', () => img.replaceWith(el('span', 'mana mana--text', symbol)), { once: true });
  return img;
}

/** Fills an element with the symbols of a cost, sized so a long cost still fits the title bar. */
export function fillManaCost(target, cost) {
  const symbols = parseManaCost(cost);
  if (!symbols.length) symbols.push('0');
  target.replaceChildren(...symbols.map(manaSymbol));
  target.style.setProperty('--mana-size', `${Math.max(11, Math.min(17, Math.floor(120 / symbols.length) - 3))}px`);
  target.title = `Mana cost: ${describeManaCost(cost)}`;
}

export function renderCard(target, data) {
  const name = data.name || '';
  target.textContent = '';
  target.setAttribute('aria-label', describeCard(data));
  setFrame(target, data.colors);

  const top = el('div', 'card__row');
  const nameEl = el('span', 'card__name', name || data.placeholderName || '');
  nameEl.title = name;
  const costEl = el('span', 'card__cost');
  fillManaCost(costEl, data.cost);
  top.append(nameEl, costEl);

  const art = el('div', 'card__art');
  if (data.artUrl) {
    art.classList.add('card__art--photo');
    const img = el('img');
    img.src = data.artUrl;
    img.alt = `Card art for ${name || 'your card'}`;
    art.append(img);
  } else {
    art.setAttribute('role', 'img');
    art.setAttribute('aria-label', 'A lit doorway in a stone wall');
  }

  // One circle per color, in W U B R G order; the card's colors are filled in.
  const typeRow = el('div', 'card__row');
  const pips = el('span', 'pips');
  const colorWords = describeColors(data.colors);
  pips.title = data.colors.length ? colorWords[0].toUpperCase() + colorWords.slice(1) : 'No colors yet';
  pips.setAttribute('aria-hidden', 'true');
  for (const color of COLOR_ORDER) pips.append(el('span', data.colors.includes(color) ? `pip--${color}` : null));
  const typeLine = typeLineOf(data);
  const typeEl = el('span', 'card__type', typeLine);
  typeEl.title = typeLine;
  typeRow.append(typeEl, pips);

  const text = el('div', 'card__text');
  fillCardText(text, data);

  target.append(top, art, typeRow, text, el('span', 'card__pt', `${data.power}/${data.toughness}`));
  fitCardText(target);
}

/**
 * An invisible element outside the card that measures text at its natural width.
 * It isn't rotated or zoomed like the card, and getBoundingClientRect gives
 * fractions of a pixel, which clientWidth and scrollWidth round away.
 */
let measurer = null;
function naturalWidth(textEl, sizePx) {
  if (!measurer) {
    measurer = document.createElement('span');
    measurer.setAttribute('aria-hidden', 'true');
    Object.assign(measurer.style, { position: 'absolute', left: '-10000px', top: '0', visibility: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none' });
    document.body.append(measurer);
  }
  const style = getComputedStyle(textEl);
  Object.assign(measurer.style, {
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    letterSpacing: style.letterSpacing,
    fontSize: `${sizePx}px`,
  });
  measurer.textContent = textEl.textContent;
  return measurer.getBoundingClientRect().width;
}

/**
 * Shrinks the name and the type line until each fits on one line, and the text
 * box until its text fits inside. Only text that doesn't fit even at the smallest
 * size gets cut (the name and type line keep the full text in their tooltip).
 * The text is measured, so call this again when the card becomes visible, the
 * window resizes or a font finishes loading.
 */
export function fitCardText(target) {
  for (const textEl of target.querySelectorAll('.card__name, .card__type')) {
    textEl.style.fontSize = '';
    // Both values are in the element's own CSS pixels, before the card's zoom and rotation.
    // The element fills the free space in its bar (flex: 1 1 0), so its width is the room available.
    const available = parseFloat(getComputedStyle(textEl).width);
    if (!available) continue; // hidden: nothing to measure yet
    const start = parseFloat(getComputedStyle(textEl).fontSize);
    let size = start;
    // Half a pixel of slack so rounding inside the browser can't bring the ellipsis back.
    while (size > TEXT_MIN_PX && naturalWidth(textEl, size) > available - 0.5) {
      size = Math.max(TEXT_MIN_PX, size - 0.25);
    }
    if (size !== start) textEl.style.fontSize = `${size}px`;
  }

  // The text box has a fixed height (the rest of the card), so its text shrinks until it stops overflowing.
  const box = target.querySelector('.card__text');
  if (!box) return;
  box.style.fontSize = '';
  if (!box.clientHeight) return;
  let size = parseFloat(getComputedStyle(box).fontSize);
  while (size > BOX_TEXT_MIN_PX && box.scrollHeight > box.clientHeight + 1) {
    size = Math.max(BOX_TEXT_MIN_PX, size - 0.5);
    box.style.fontSize = `${size}px`;
  }
}

/** The size of the card's art box as width / height, or null while the card is hidden. */
export function artBoxRatio(target) {
  const box = target.querySelector('.card__art');
  return box && box.offsetWidth && box.offsetHeight ? box.offsetWidth / box.offsetHeight : null;
}
