/**
 * BoosterTest.html: proof of concept for boosters.
 * Loads the level 1 pool, deals 3 random cards with their images from Scryfall,
 * lets you pick one and confirm it. Nothing is saved: the real flow, which
 * absorbs the card, is in the Player Card.
 */

import { $ } from './shared/dom.js';
import { loadPool } from './shared/cards.js';
import { renderBooster } from './shared/booster-ui.js';
import { makeBooster, BOOSTER_SIZE } from './player/booster.js';

const POOL_URL = 'data/level1.json';

const boosterEl = $('bt-booster');
const statusEl = $('bt-status');
const openButton = $('bt-open');
const confirmButton = $('bt-confirm');

let pool = [];
let opened = 0;
let booster = null;
let picked = null; // the card the player clicked, until they confirm it

function pick(card) {
  picked = card;
  booster.setPicked(card);
  confirmButton.textContent = `Confirm ${card.name}`;
  confirmButton.hidden = false;
  statusEl.textContent = `${card.name} picked. Confirm it, or pick another card.`;
}

function confirmPick() {
  if (!picked) return;
  booster.lock();
  confirmButton.hidden = true;
  statusEl.textContent = `You took ${picked.name}. This test page doesn't save it; open boosters from the Player Card to absorb cards.`;
  picked = null;
  openButton.focus();
}

function openBooster() {
  opened++;
  picked = null;
  confirmButton.hidden = true;
  const cards = makeBooster(pool);
  booster = renderBooster(boosterEl, cards, pick);
  statusEl.textContent = `Booster ${opened}. Pick one of the ${cards.length} cards.`;
  openButton.textContent = 'Open another booster';
}

openButton.addEventListener('click', openBooster);
confirmButton.addEventListener('click', confirmPick);

try {
  pool = await loadPool(POOL_URL);
  $('bt-pool').textContent = `Pool: ${pool.length} cards from level1.txt. Each booster has ${BOOSTER_SIZE}.`;
  openButton.disabled = false;
} catch {
  const error = $('bt-error');
  error.textContent = `Couldn't load ${POOL_URL}. Open this page through a local server (npm start), not as a file.`;
  error.hidden = false;
}
