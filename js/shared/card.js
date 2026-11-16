/**
 * The card component. Every card on screen (home, player, later boosters and
 * monsters) is drawn by renderCard, styled by css/card.css.
 *
 * Card data:
 *   name             string; empty shows placeholderName instead
 *   placeholderName  string, optional
 *   cost             number
 *   colors           string[]; empty means colorless
 *   types            string[], e.g. ['Human']
 *   power, toughness number
 *   rulesText        string, optional
 *   flavor           string, optional
 *   artUrl           string, optional; without it the default doorway is drawn
 */

import { el } from './dom.js';

const NAME_MIN_PX = 8;

export function describeCard(data) {
  const colors = data.colors.length ? data.colors.join(' and ') : 'colorless';
  return `${data.name || 'Unnamed card'}: ${data.types.join(' ')}, cost ${data.cost}, ${colors}, ${data.power}/${data.toughness}`;
}

export function renderCard(target, data) {
  const name = data.name || '';
  target.textContent = '';
  target.setAttribute('aria-label', describeCard(data));

  const top = el('div', 'card__row');
  const nameEl = el('span', 'card__name', name || data.placeholderName || '');
  nameEl.title = name;
  top.append(nameEl, el('span', 'card__cost', String(data.cost)));

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

  const typeRow = el('div', 'card__row');
  const pips = el('span', 'pips');
  pips.title = 'No colors yet';
  pips.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 5; i++) pips.append(el('span'));
  typeRow.append(el('span', null, `Creature — ${data.types.join(' ')}`), pips);

  const text = el('div', 'card__text');
  if (data.rulesText) text.append(el('p', null, data.rulesText));
  const flavor = (data.flavor || '').trim();
  if (flavor) text.append(el('p', 'card__flavor', flavor));

  target.append(top, art, typeRow, text, el('span', 'card__pt', `${data.power}/${data.toughness}`));
  fitCardName(target);
}

/**
 * Shrinks the name until it fits on one line. Only a name that doesn't fit
 * even at NAME_MIN_PX gets cut with an ellipsis (the full name stays in the tooltip).
 * The name is measured, so call this again when the card becomes visible,
 * the window resizes or the display font finishes loading.
 */
export function fitCardName(target) {
  const nameEl = target.querySelector('.card__name');
  if (!nameEl) return;
  nameEl.style.fontSize = '';
  if (!nameEl.clientWidth) return; // hidden: nothing to measure yet
  let size = parseFloat(getComputedStyle(nameEl).fontSize);
  while (nameEl.scrollWidth > nameEl.clientWidth && size > NAME_MIN_PX) {
    size = Math.max(NAME_MIN_PX, size - 0.5);
    nameEl.style.fontSize = `${size}px`;
  }
}

/** The size of the card's art box as width / height, or null while the card is hidden. */
export function artBoxRatio(target) {
  const box = target.querySelector('.card__art');
  return box && box.offsetWidth && box.offsetHeight ? box.offsetWidth / box.offsetHeight : null;
}
