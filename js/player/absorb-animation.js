/**
 * The absorb animation: the creature flies into the player's card, then each
 * value that changes loads in turn (power/toughness, colors, cost, types,
 * abilities) while
 * a caption says what changed. Styled in css/player.css.
 *
 * It only touches the card's elements in place; at the end the card is drawn
 * again from the final data, so nothing the animation does can stick.
 */

import { renderCard, fitCardText, setFrame, fillManaCost, fillCardText } from '../shared/card.js';
import { newSymbols } from '../shared/mana.js';
import { COLOR_ORDER, describeColors, typeLineOf } from './absorb.js';

const GHOST_MS = 1100;  // must match .absorb-ghost in css/player.css
const COUNT_MS = 700;   // a number ticking from its old to its new value
const PAUSE_MS = 450;   // between two changes
const LAST_CAPTION_MS = 1800;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const capital = (text) => text[0].toUpperCase() + text.slice(1);

/** Runs draw(t) with t going from 0 to 1 over ms milliseconds. */
function tween(ms, draw) {
  return new Promise((resolve) => {
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / ms);
      draw(t);
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

const between = (from, to, t) => Math.round(from + (to - from) * t);

/** Restarts the highlight on an element, even if it was already highlighted. */
function flash(element) {
  element.classList.remove('is-changing');
  void element.offsetWidth; // forces a reflow so the animation starts again
  element.classList.add('is-changing');
}

/**
 * cardEl     the <article class="card"> showing the player
 * ghostEl    an <img> over the card for the creature flying in
 * captionEl  where to say what changes
 * before, after  card data (see shared/card.js) before and after absorbing
 * creature   { name, imageUrl } of the absorbed card
 * Resolves when the animation is over and the card shows `after`.
 */
export async function playAbsorb({ cardEl, ghostEl, captionEl, before, after, creature }) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const steps = [];

  if (before.power !== after.power || before.toughness !== after.toughness) {
    steps.push({
      caption: `Power / toughness: ${before.power}/${before.toughness} → ${after.power}/${after.toughness}`,
      async run() {
        const pt = cardEl.querySelector('.card__pt');
        flash(pt);
        await tween(COUNT_MS, (t) => {
          pt.textContent = `${between(before.power, after.power, t)}/${between(before.toughness, after.toughness, t)}`;
        });
      },
    });
  }

  const newColors = after.colors.filter((color) => !before.colors.includes(color));
  if (newColors.length) {
    steps.push({
      caption: `Colors: ${capital(describeColors(before.colors))} → ${capital(describeColors(after.colors))}`,
      async run() {
        const pips = cardEl.querySelectorAll('.pips span');
        for (const color of newColors) {
          const pip = pips[COLOR_ORDER.indexOf(color)];
          pip.className = `pip--${color} is-new`;
          await wait(250);
        }
        // The frame fades to the new identity (css/card.css transitions it).
        cardEl.classList.add('is-recoloring');
        setFrame(cardEl, after.colors);
        await wait(900);
        cardEl.classList.remove('is-recoloring');
      },
    });
  }

  if (before.cost !== after.cost) {
    steps.push({
      caption: `Mana cost: ${before.cost} → ${after.cost}`,
      async run() {
        // The new symbols pop into the cost one after another.
        const costEl = cardEl.querySelector('.card__cost');
        fillManaCost(costEl, after.cost);
        fitCardText(cardEl);
        const symbols = [...costEl.children];
        const fresh = newSymbols(before.cost, after.cost);
        symbols.forEach((symbol, index) => { if (fresh[index]) symbol.style.visibility = 'hidden'; });
        for (const [index, symbol] of symbols.entries()) {
          if (!fresh[index]) continue;
          symbol.style.visibility = '';
          symbol.classList.add('is-new');
          await wait(280);
        }
        await wait(COUNT_MS - 280);
      },
    });
  }

  if (typeLineOf(before) !== typeLineOf(after)) {
    steps.push({
      caption: `Type: ${typeLineOf(before)} → ${typeLineOf(after)}`,
      async run() {
        const typeEl = cardEl.querySelector('.card__type');
        typeEl.textContent = typeLineOf(after);
        typeEl.title = typeEl.textContent;
        fitCardText(cardEl);
        flash(typeEl);
        await wait(COUNT_MS);
      },
    });
  }

  const addedKeywords = (after.keywords || []).filter((keyword) => !(before.keywords || []).includes(keyword));
  const addedAbilities = (after.abilities || []).filter((ability) => !(before.abilities || []).includes(ability));
  if (addedKeywords.length || addedAbilities.length) {
    const gained = addedKeywords.map((keyword, index) => (index ? keyword.toLowerCase() : keyword));
    if (addedAbilities.length) gained.push(addedAbilities.length === 1 ? 'a new ability' : `${addedAbilities.length} new abilities`);
    steps.push({
      caption: `Abilities: gains ${gained.join(', ')}`,
      async run() {
        const box = cardEl.querySelector('.card__text');
        fillCardText(box, after);
        fitCardText(cardEl);
        // Only the new parts light up.
        for (const node of box.querySelectorAll('.card__keywords .kw, .card__ability')) {
          const isNew = node.classList.contains('kw') ? addedKeywords.includes(node.dataset.keyword) : addedAbilities.includes(node.dataset.ability);
          if (isNew) flash(node);
        }
        await wait(COUNT_MS);
      },
    });
  }

  if (reduced) {
    renderCard(cardEl, after);
    captionEl.textContent = `You absorbed ${creature.name}.`;
    await wait(LAST_CAPTION_MS);
    captionEl.textContent = '';
    return;
  }

  renderCard(cardEl, before);
  captionEl.textContent = `Absorbing ${creature.name}…`;

  if (creature.imageUrl) {
    ghostEl.src = creature.imageUrl;
    ghostEl.hidden = false;
    // Restart the CSS animation if the element was used before.
    ghostEl.style.animation = 'none';
    void ghostEl.offsetWidth;
    ghostEl.style.animation = '';
  }
  cardEl.classList.remove('is-absorbing');
  void cardEl.offsetWidth;
  cardEl.classList.add('is-absorbing');
  await wait(GHOST_MS);
  ghostEl.hidden = true;
  ghostEl.removeAttribute('src');
  cardEl.classList.remove('is-absorbing');

  for (const step of steps) {
    await wait(PAUSE_MS);
    captionEl.textContent = step.caption;
    await step.run();
  }

  await wait(PAUSE_MS);
  renderCard(cardEl, after);
  captionEl.textContent = steps.length ? `You absorbed ${creature.name}.` : `You absorbed ${creature.name}. Nothing on your card changed.`;
  await wait(LAST_CAPTION_MS);
  captionEl.textContent = '';
}
