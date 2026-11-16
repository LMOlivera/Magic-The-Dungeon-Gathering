/**
 * The card component. Every card on screen (home, player, later boosters and
 * monsters) is drawn by renderCard, styled by css/card.css.
 *
 * Card data:
 *   name             string; empty shows placeholderName instead
 *   placeholderName  string, optional
 *   cost             mana cost in Scryfall notation, e.g. '{1}{U}{R}' (see shared/mana.js)
 *   colors           W U B R G letters; empty means colorless
 *   types            string[], e.g. ['Human']
 *   power, toughness number
 *   rulesText        string, optional
 *   flavor           string, optional
 *   artUrl           string, optional; without it the default doorway is drawn
 */

import { el } from './dom.js';
import { COLOR_ORDER, describeColors } from '../player/absorb.js';
import { parseManaCost, manaSymbolUrl, describeSymbol, describeManaCost } from './mana.js';

const TEXT_MIN_PX = 8;

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
  return `${data.name || 'Unnamed card'}: ${data.types.join(' ')}, mana cost ${describeManaCost(data.cost)}, ${describeColors(data.colors)}, ${data.power}/${data.toughness}`;
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
  const typeLine = `Creature — ${data.types.join(' ')}`;
  const typeEl = el('span', 'card__type', typeLine);
  typeEl.title = typeLine;
  typeRow.append(typeEl, pips);

  const text = el('div', 'card__text');
  if (data.rulesText) text.append(el('p', null, data.rulesText));
  const flavor = (data.flavor || '').trim();
  if (flavor) text.append(el('p', 'card__flavor', flavor));

  target.append(top, art, typeRow, text, el('span', 'card__pt', `${data.power}/${data.toughness}`));
  fitCardText(target);
}

/**
 * Shrinks the name and the type line until each fits on one line. Only text that
 * doesn't fit even at TEXT_MIN_PX gets cut with an ellipsis (the full text stays
 * in the tooltip). The text is measured, so call this again when the card becomes
 * visible, the window resizes or the display font finishes loading.
 */
export function fitCardText(target) {
  for (const textEl of target.querySelectorAll('.card__name, .card__type')) {
    textEl.style.fontSize = '';
    if (!textEl.clientWidth) continue; // hidden: nothing to measure yet
    let size = parseFloat(getComputedStyle(textEl).fontSize);
    while (textEl.scrollWidth > textEl.clientWidth && size > TEXT_MIN_PX) {
      size = Math.max(TEXT_MIN_PX, size - 0.5);
      textEl.style.fontSize = `${size}px`;
    }
  }
}

/** The size of the card's art box as width / height, or null while the card is hidden. */
export function artBoxRatio(target) {
  const box = target.querySelector('.card__art');
  return box && box.offsetWidth && box.offsetHeight ? box.offsetWidth / box.offsetHeight : null;
}
