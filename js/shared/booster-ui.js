/**
 * Draws the cards of a booster as full card images from Scryfall, each a button
 * to pick it. Styled by css/booster.css. Used by the Player Card and BoosterTest.html.
 */

import { el } from './dom.js';
import { sideCount, cardImageUrl } from './cards.js';

function describe(card) {
  const stats = card.power != null ? `, ${card.power}/${card.toughness}` : '';
  return `${card.name}, ${card.typeLine}${stats}`;
}

/** One card: the image as a button to pick it, plus a flip button for double-faced cards. */
function cardSlot(card, index, onPick) {
  const slot = el('li', 'slot');
  slot.style.setProperty('--i', index);

  const button = el('button', 'slot__card');
  button.type = 'button';
  button.title = card.name; // shown on hover, also while the image is still loading
  button.setAttribute('aria-pressed', 'false');

  let side = 0;
  const img = el('img');
  img.alt = describe(card);
  img.width = 488;
  img.height = 680;
  img.addEventListener('load', () => button.classList.add('is-loaded'));
  img.addEventListener('error', () => {
    // Offline or Scryfall unreachable: the card is still playable from its text.
    img.remove();
    button.classList.add('is-loaded');
    button.append(
      el('span', 'slot__fallback-name', card.name),
      el('span', 'slot__fallback-type', card.typeLine),
      el('span', 'slot__fallback-note', "The image didn't load."),
    );
  });
  img.src = cardImageUrl(card, side);
  button.append(img);
  button.addEventListener('click', () => onPick(card));
  slot.append(button);

  if (sideCount(card) > 1) {
    const flip = el('button', 'action action--quiet slot__flip', 'Flip card');
    flip.type = 'button';
    flip.addEventListener('click', () => {
      side = (side + 1) % sideCount(card);
      button.classList.remove('is-loaded');
      img.src = cardImageUrl(card, side);
      img.alt = `${card.faces[side].name}, ${card.faces[side].typeLine}`;
      button.title = card.faces[side].name;
    });
    slot.append(flip);
  }
  return slot;
}

/**
 * Fills listEl (a <ul class="booster">) with the cards.
 * onPick(card) runs when the player clicks one. Returns controls for the booster:
 *   setPicked(card)  marks that card as picked and dims the others (null clears it)
 *   lock()           leaves the cards visible but no longer clickable
 */
export function renderBooster(listEl, cards, onPick) {
  const slots = cards.map((card, index) => cardSlot(card, index, onPick));
  listEl.classList.remove('is-done');
  listEl.replaceChildren(...slots);

  return {
    setPicked(picked) {
      slots.forEach((slot, index) => {
        const chosen = cards[index] === picked;
        slot.classList.toggle('is-picked', chosen);
        slot.classList.toggle('is-passed', picked != null && !chosen);
        slot.querySelector('.slot__card').setAttribute('aria-pressed', String(chosen));
      });
    },
    lock() {
      for (const button of listEl.querySelectorAll('button')) button.disabled = true;
      listEl.classList.add('is-done');
    },
  };
}
