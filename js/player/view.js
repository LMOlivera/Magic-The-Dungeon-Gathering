/**
 * The Player Card view (#view-player-card): the player's character sheet.
 * Flow: name the card, pick its art, then the finished sheet, where the player
 * opens their first booster. Once the card has absorbed something the page
 * shows only the card.
 *
 * Everything stays in this browser: the sheet in localStorage under SAVE_KEY,
 * the photos in the image store under IMAGE_KEYS.
 */

import { $, el } from '../shared/dom.js';
import { renderCard, fitCardText, artBoxRatio, fillManaCost, abilityNodes } from '../shared/card.js';
import { storageWorks, readJSON, writeJSON, removeKey } from '../shared/storage.js';
import { putImage, getImage, deleteImage, imagesPersist, dataUrlToBlob } from '../shared/images.js';
import {
  SAVE_VERSION, FLAVOR_MAX,
  cleanName, newPlayer, withFlavor, withArt, withoutArt, withBooster, withCounters, describeCounters,
  toCardData, upgradeSave,
} from './model.js';
import { isCreatureCard, absorbPreview, absorbCreature, describeColors, typeLineOf } from './absorb.js';
import { keywordRule, parseKeyword } from '../rules/keywords.js';
import { makeBooster } from './booster.js';
import { loadPool, cardImageUrl } from '../shared/cards.js';
import { renderBooster } from '../shared/booster-ui.js';
import { playAbsorb } from './absorb-animation.js';
import { withBusy } from '../shared/busy.js';
import { fileToSource, canvasToBlob } from './photo.js';
import { createCamera } from './camera.js';
import { createArtEditor } from './art-editor.js';

const SAVE_KEY = 'mtdg.player';
const IMAGE_KEYS = { art: 'player.art', artSource: 'player.artSource' };
const FALLBACK_ART_RATIO = 1.37; // .card__art aspect-ratio in css/card.css
const POOL_URL = 'data/level1.json';

export async function initPlayerView() {
  const card = $('pc-card');
  const nameInput = $('pc-name');
  const flavorInput = $('pc-flavor');
  const fileInput = $('pc-file');
  const captureInput = $('pc-capture');

  let player = null;        // the sheet, or null before the card is named
  let artUrl = null;        // object URL of the cropped photo
  let editingArt = false;   // the player came back to change the art
  let animating = false;    // the absorb animation is playing on the card
  let savedByNewer = false; // the save belongs to a newer version: don't touch it
  let storageOk = storageWorks();

  /* ----- Loading and saving ----- */
  function setArtUrl(blob) {
    if (artUrl) URL.revokeObjectURL(artUrl);
    artUrl = blob ? URL.createObjectURL(blob) : null;
  }

  function save() {
    if (!writeJSON(SAVE_KEY, player)) storageOk = false;
  }

  async function load() {
    const saved = readJSON(SAVE_KEY);
    const upgraded = upgradeSave(saved);
    savedByNewer = upgraded.status === 'newer';
    player = upgraded.status === 'ok' ? upgraded.player : null;

    if (player && saved.version !== SAVE_VERSION) {
      // Move photos that an older save kept inside the sheet, and only replace
      // the old save once they are safely stored.
      let moved = true;
      for (const [name, dataUrl] of Object.entries(upgraded.images)) {
        try {
          moved = (await putImage(IMAGE_KEYS[name], dataUrlToBlob(dataUrl))) && moved;
        } catch {
          moved = false;
        }
      }
      if (moved) save();
    }

    const art = player && player.hasArt ? await getImage(IMAGE_KEYS.art) : null;
    // The sheet says there is a photo but it's gone (cleared site data): show the default art.
    if (player && player.hasArt && !art) player = withoutArt(player);
    setArtUrl(art);
  }

  /* ----- Rendering ----- */
  function showError(message) {
    const box = $('pc-error');
    box.textContent = message || '';
    box.hidden = !message;
  }

  function drawCard() {
    renderCard(card, toCardData(player || newPlayer(cleanName(nameInput.value)), artUrl));
  }

  function render() {
    $('pc-storage-warning').hidden = storageOk && imagesPersist();
    $('pc-newer').hidden = !savedByNewer;

    let step = 'sheet';
    if (savedByNewer) step = 'none';
    else if (!player) step = 'name';
    else if (!player.artChosen || editingArt) step = 'art';
    else if ((player.absorbed || []).length) step = 'card';
    $('pc-step-name').hidden = step !== 'name';
    $('pc-step-art').hidden = step !== 'art';
    $('pc-sheet').hidden = step !== 'sheet';
    $('view-player-card').classList.toggle('is-card-only', step === 'card');
    $('pc-card-foot').hidden = step !== 'card';

    // While the animation plays it owns the card.
    if (!animating) drawCard();

    if (step === 'art') {
      $('pc-art-step').textContent = editingArt ? 'Card art' : 'Step 2 of 2';
      $('pc-art-prompt').replaceChildren(
        'Give ', el('strong', null, player.name), ' some card art: take a photo now or upload one.',
      );
      $('pc-art-skip').textContent = editingArt ? 'Use the default art' : 'Skip for now';
      $('pc-art-skip').hidden = editingArt && !player.hasArt;
      $('pc-art-cancel').hidden = !editingArt;
    } else if (step === 'card') {
      $('pc-counter-value').textContent = describeCounters(player.counters || 0);
    } else if (step === 'sheet') {
      $('pc-edit-art').hidden = !player.hasArtSource;
      if (document.activeElement !== flavorInput) flavorInput.value = player.flavor || '';
      $('pc-flavor-count').textContent = `${flavorInput.value.length}/${FLAVOR_MAX}`;
      $('pc-summary').replaceChildren(
        el('strong', null, player.name),
        ` walks in as a ${describeColors(player.colors)} ${player.power}/${player.toughness} ${player.types.join(' ')}.`,
      );
    }
  }

  /* ----- Step 1: name ----- */
  nameInput.addEventListener('input', () => {
    if (!player) drawCard();
  });

  $('pc-name-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = cleanName(nameInput.value);
    if (!name) {
      showError('Pick a name for your card first.');
      nameInput.focus();
      return;
    }
    showError('');
    player = newPlayer(name);
    save();
    render();
    $('pc-art-camera').focus();
  });

  /* ----- Step 2: art ----- */
  const editor = createArtEditor();
  const camera = createCamera({
    onPhoto: (photo) => frameAndKeep(photo, true),
    onUseFile: () => captureInput.click(),
  });

  /**
   * Opens the editor on a photo and keeps the result as the card's art.
   * isNew: the photo was just taken or uploaded, so the original is stored too.
   */
  async function frameAndKeep(source, isNew) {
    let result;
    try {
      const crop = isNew ? null : player.artCrop;
      result = await editor.edit(source, crop, artBoxRatio(card) || FALLBACK_ART_RATIO);
    } catch {
      showError("Couldn't open that photo for editing.");
      return;
    }
    if (!result || !player) return;
    try {
      // Encoding and storing takes a moment; the overlay stays until the new card is drawn.
      await withBusy('Saving your art…', async () => {
        const art = await canvasToBlob(result.canvas);
        await Promise.all([
          putImage(IMAGE_KEYS.art, art),
          isNew ? putImage(IMAGE_KEYS.artSource, source) : null,
        ]);
        player = withArt(player, result.crop, true);
        setArtUrl(art);
        save();
        editingArt = false;
        showError('');
        render();
      });
    } catch {
      showError("Couldn't save that photo. Try again.");
    }
  }

  async function useDefaultArt() {
    await deleteImage(IMAGE_KEYS.art);
    await deleteImage(IMAGE_KEYS.artSource);
    player = withoutArt(player);
    setArtUrl(null);
    save();
    editingArt = false;
    showError('');
    render();
  }

  async function useFile(file) {
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) {
      showError("That file isn't an image.");
      return;
    }
    let source;
    try {
      source = await withBusy('Reading your photo…', () => fileToSource(file));
    } catch {
      showError("Couldn't read that photo. Try a JPEG or PNG.");
      return;
    }
    await frameAndKeep(source, true);
  }

  for (const input of [fileInput, captureInput]) {
    input.addEventListener('change', () => {
      useFile(input.files && input.files[0]);
      input.value = '';
    });
  }

  $('pc-art-camera').addEventListener('click', () => {
    showError('');
    // Without a live camera, phones open their camera app from this input; desktops get a file picker.
    if (!camera.open()) captureInput.click();
  });
  $('pc-art-upload').addEventListener('click', () => fileInput.click());
  $('pc-art-skip').addEventListener('click', useDefaultArt);
  $('pc-art-cancel').addEventListener('click', () => {
    editingArt = false;
    showError('');
    render();
  });

  /* ----- The finished sheet ----- */
  flavorInput.addEventListener('input', () => {
    if (!player) return;
    player = withFlavor(player, flavorInput.value);
    save();
    render();
  });

  $('pc-edit-art').addEventListener('click', async () => {
    const source = await getImage(IMAGE_KEYS.artSource);
    if (!source) {
      showError("The original photo is no longer in this browser. Use Change art to pick a new one.");
      return;
    }
    await frameAndKeep(source, false);
  });

  $('pc-change-art').addEventListener('click', () => {
    editingArt = true;
    render();
    $('pc-art-camera').focus();
  });

  async function startOver() {
    if (!player || !confirm(`Start over? This deletes ${player.name} and its art from this browser.`)) return;
    removeKey(SAVE_KEY);
    await deleteImage(IMAGE_KEYS.art);
    await deleteImage(IMAGE_KEYS.artSource);
    player = null;
    setArtUrl(null);
    editingArt = false;
    nameInput.value = '';
    flavorInput.value = '';
    showError('');
    render();
    nameInput.focus();
  }
  $('pc-reset').addEventListener('click', startOver);
  $('pc-reset-card').addEventListener('click', startOver);

  /* ----- Counters ----- */
  function changeCounters(by) {
    if (!player || animating) return;
    player = withCounters(player, (player.counters || 0) + by);
    save();
    render();
  }
  $('pc-counter-up').addEventListener('click', () => changeCounters(1));
  $('pc-counter-down').addEventListener('click', () => changeCounters(-1));

  /* ----- Boosters and absorbing ----- */
  const boosterDialog = $('pc-booster');
  const confirmButton = $('pc-booster-confirm');
  let creaturePool = null; // creatures of the pool; only creatures can be absorbed so far
  let boosterCards = [];
  let boosterControls = null;
  let picked = null;       // the card clicked in the booster
  let absorbing = null;    // the card being absorbed, on the second step

  async function loadCreatures() {
    if (!creaturePool) creaturePool = (await loadPool(POOL_URL)).filter(isCreatureCard);
    return creaturePool;
  }

  /** The cards of the open booster, or a new booster if none is open (or its cards left the pool). */
  function currentBooster(pool) {
    if (player.booster) {
      const byId = new Map(pool.map((poolCard) => [poolCard.id, poolCard]));
      const cards = player.booster.cardIds.map((id) => byId.get(id));
      if (cards.length && cards.every(Boolean)) return cards;
    }
    const cards = makeBooster(pool);
    player = withBooster(player, cards.map((poolCard) => poolCard.id));
    save();
    return cards;
  }

  function showPickStep() {
    absorbing = null;
    $('pc-booster-pick').hidden = false;
    $('pc-absorb').hidden = true;
    $('pc-booster-title').textContent = 'Booster';
  }

  function pickCard(boosterCard) {
    picked = boosterCard;
    boosterControls.setPicked(boosterCard);
    confirmButton.textContent = `Confirm ${boosterCard.name}`;
    confirmButton.hidden = false;
    $('pc-booster-status').textContent = `${boosterCard.name} picked. Confirm it, or pick another card.`;
  }

  $('pc-open-booster').addEventListener('click', async () => {
    showError('');
    let pool;
    try {
      pool = await withBusy('Opening your booster\u2026', loadCreatures);
    } catch {
      showError("Couldn't load the card pool. Check your connection and try again.");
      return;
    }
    boosterCards = currentBooster(pool);
    picked = null;
    confirmButton.hidden = true;
    $('pc-booster-status').textContent = 'Pick one card to absorb.';
    boosterControls = renderBooster($('pc-booster-cards'), boosterCards, pickCard);
    showPickStep();
    render();
    boosterDialog.showModal();
  });

  $('pc-booster-close').addEventListener('click', () => boosterDialog.close());

  /* Second step: show what changes and ask about creature types. */
  function absorbChoices() {
    const types = [...$('pc-absorb-type-options').querySelectorAll('input:checked')].map((input) => input.value);
    const power = $('pc-absorb-power');
    const toughness = $('pc-absorb-toughness');
    return { types, power: power ? power.value : undefined, toughness: toughness ? toughness.value : undefined };
  }

  /** before and after are text, or functions returning a node to show (for mana symbols). */
  function changeRow(label, before, after, same = before === after) {
    const show = (value) => (typeof value === 'function' ? value() : value);
    const row = el('div', 'changes__row');
    const value = el('dd');
    if (same) value.append(show(after), el('span', 'changes__same', ' (no change)'));
    else value.append(show(before), el('span', 'changes__arrow', ' → '), show(after));
    row.append(el('dt', null, label), value);
    return row;
  }

  function manaCostNode(cost) {
    const node = el('span', 'card__cost changes__mana');
    fillManaCost(node, cost);
    return node;
  }

  function renderChanges() {
    const after = absorbCreature(player, absorbing, absorbChoices());
    // Power and toughness as the card shows them, with the counters.
    const [now, then] = [toCardData(player), toCardData(after)];
    const capital = (text) => text[0].toUpperCase() + text.slice(1);
    $('pc-absorb-changes').replaceChildren(
      changeRow('Power / toughness', `${now.power}/${now.toughness}`, `${then.power}/${then.toughness}`),
      changeRow('Colors', capital(describeColors(player.colors)), capital(describeColors(after.colors))),
      changeRow('Mana cost', () => manaCostNode(player.manaCost), () => manaCostNode(after.manaCost), player.manaCost === after.manaCost),
      changeRow('Type', typeLineOf(player), typeLineOf(after)),
    );
  }

  /**
   * What the card's rules text gives: each keyword with what it does in this game,
   * and the other abilities as they will read on the card.
   */
  function showAbilities(preview) {
    const items = [];
    for (const keyword of preview.keywords) {
      const item = el('li');
      item.append(el('strong', null, keyword), ` — ${keywordRule(keyword) || 'Not defined yet.'}`);
      const { name } = parseKeyword(keyword);
      const result = preview.keywordsAfter.find((had) => parseKeyword(had).name === name);
      if (result !== keyword) item.append(el('span', 'changes__same', ` (adds to yours: you’ll have ${result})`));
      else if (!preview.newKeywords.includes(keyword)) item.append(el('span', 'changes__same', ' (you already have it)'));
      items.push(item);
    }
    for (const ability of preview.abilities) {
      const item = el('li');
      item.append(...abilityNodes(ability));
      if (!preview.newAbilities.includes(ability)) item.append(el('span', 'changes__same', ' (you already have it)'));
      items.push(item);
    }
    $('pc-absorb-ability-list').replaceChildren(...items);

    let note = '';
    if (!preview.textReviewed) note = 'Its rules text isn’t part of the game yet, so you don’t gain it.';
    else if (preview.hasText && !items.length) note = 'Its rules text does nothing in the dungeon.';
    const noteEl = $('pc-absorb-ability-note');
    noteEl.textContent = note;
    noteEl.hidden = !note;
    $('pc-absorb-abilities-title').textContent = items.length ? 'Abilities you gain' : 'Rules text';
    $('pc-absorb-abilities').hidden = !items.length && !note;
  }

  /** A number field for a stat the card doesn't print as a number, like "*". */
  function statField(id, cardName, label, raw) {
    const field = el('div', 'field');
    const labelEl = el('label', null, `${cardName}'s ${label} is ${raw}. How much ${label} does it add?`);
    labelEl.htmlFor = id;
    const input = el('input', 'input');
    Object.assign(input, { id, type: 'number', inputMode: 'numeric', step: '1', value: '0' });
    input.addEventListener('input', renderChanges);
    field.append(labelEl, input);
    return field;
  }

  function showAbsorbStep(boosterCard) {
    absorbing = boosterCard;
    const preview = absorbPreview(player, boosterCard);
    $('pc-booster-title').textContent = `Absorb ${preview.name}`;

    const stats = [];
    if (preview.addPower === null) stats.push(statField('pc-absorb-power', preview.name, 'power', preview.rawPower));
    if (preview.addToughness === null) stats.push(statField('pc-absorb-toughness', preview.name, 'toughness', preview.rawToughness));
    $('pc-absorb-stats').replaceChildren(...stats);

    const options = preview.newTypes.map((type) => {
      const label = el('label');
      const box = el('input');
      Object.assign(box, { type: 'checkbox', value: type });
      box.addEventListener('change', renderChanges);
      label.append(box, type);
      return label;
    });
    $('pc-absorb-type-options').replaceChildren(...options);
    $('pc-absorb-types').hidden = !options.length;
    const noTypes = $('pc-absorb-no-types');
    noTypes.hidden = options.length > 0;
    noTypes.textContent = 'It has no creature types you don\u2019t already have.';

    showAbilities(preview);
    renderChanges();
    $('pc-booster-pick').hidden = true;
    $('pc-absorb').hidden = false;
    (stats.length ? stats[0].querySelector('input') : options[0]?.querySelector('input') || $('pc-absorb-go')).focus();
  }

  confirmButton.addEventListener('click', () => {
    if (picked) showAbsorbStep(picked);
  });

  $('pc-absorb-back').addEventListener('click', () => {
    showPickStep();
    confirmButton.focus();
  });

  $('pc-absorb-go').addEventListener('click', async () => {
    if (!absorbing || animating) return;
    const creature = absorbing;
    const before = player;
    player = absorbCreature(player, creature, absorbChoices());
    save();
    absorbing = null;
    picked = null;
    boosterDialog.close();

    // Switch to the card-only page, then load the new values into the card.
    animating = true;
    render();
    window.scrollTo(0, 0);
    card.focus({ preventScroll: true });
    try {
      await playAbsorb({
        cardEl: card,
        ghostEl: $('pc-absorb-ghost'),
        captionEl: $('pc-absorb-caption'),
        before: toCardData(before, artUrl),
        after: toCardData(player, artUrl),
        creature: { name: absorbPreview(before, creature).name, imageUrl: cardImageUrl(creature) },
      });
    } finally {
      animating = false;
      render();
    }
  });

  /* ----- Keeping up with the page ----- */
  // The name and type line are measured to fit, so refit when the view appears,
  // the window resizes or the display font finishes loading.
  const refitText = () => fitCardText(card);
  window.addEventListener('hashchange', refitText);
  window.addEventListener('resize', refitText);
  if (document.fonts) {
    // ready can resolve before the card's fonts even start loading, so also
    // refit every time a font finishes loading.
    document.fonts.ready.then(refitText);
    document.fonts.addEventListener('loadingdone', refitText);
  }

  // Another tab changed or cleared the card.
  window.addEventListener('storage', async (event) => {
    if (event.key !== SAVE_KEY && event.key !== null) return;
    editingArt = false;
    await load();
    render();
  });

  await load();
  render();
}
