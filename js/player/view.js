/**
 * The Player Card view (#view-player-card): the player's character sheet.
 * Flow: name the card, pick its art, then the finished sheet.
 *
 * Everything stays in this browser: the sheet in localStorage under SAVE_KEY,
 * the photos in the image store under IMAGE_KEYS.
 */

import { $, el } from '../shared/dom.js';
import { renderCard, fitCardName, artBoxRatio } from '../shared/card.js';
import { storageWorks, readJSON, writeJSON, removeKey } from '../shared/storage.js';
import { putImage, getImage, deleteImage, imagesPersist, dataUrlToBlob } from '../shared/images.js';
import {
  SAVE_VERSION, FLAVOR_MAX,
  cleanName, newPlayer, withFlavor, withArt, withoutArt, toCardData, upgradeSave,
} from './model.js';
import { withBusy } from '../shared/busy.js';
import { fileToSource, canvasToBlob } from './photo.js';
import { createCamera } from './camera.js';
import { createArtEditor } from './art-editor.js';

const SAVE_KEY = 'mtdg.player';
const IMAGE_KEYS = { art: 'player.art', artSource: 'player.artSource' };
const FALLBACK_ART_RATIO = 248 / 196;

export async function initPlayerView() {
  const card = $('pc-card');
  const nameInput = $('pc-name');
  const flavorInput = $('pc-flavor');
  const fileInput = $('pc-file');
  const captureInput = $('pc-capture');

  let player = null;        // the sheet, or null before the card is named
  let artUrl = null;        // object URL of the cropped photo
  let editingArt = false;   // the player came back to change the art
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
    $('pc-step-name').hidden = step !== 'name';
    $('pc-step-art').hidden = step !== 'art';
    $('pc-sheet').hidden = step !== 'sheet';

    drawCard();

    if (step === 'art') {
      $('pc-art-step').textContent = editingArt ? 'Card art' : 'Step 2 of 2';
      $('pc-art-prompt').replaceChildren(
        'Give ', el('strong', null, player.name), ' some card art: take a photo now or upload one.',
      );
      $('pc-art-skip').textContent = editingArt ? 'Use the default art' : 'Skip for now';
      $('pc-art-skip').hidden = editingArt && !player.hasArt;
      $('pc-art-cancel').hidden = !editingArt;
    } else if (step === 'sheet') {
      $('pc-edit-art').hidden = !player.hasArtSource;
      if (document.activeElement !== flavorInput) flavorInput.value = player.flavor || '';
      $('pc-flavor-count').textContent = `${flavorInput.value.length}/${FLAVOR_MAX}`;
      $('pc-summary').replaceChildren(
        el('strong', null, player.name),
        ` walks in as a colorless ${player.power}/${player.toughness} ${player.types.join(' ')}. Open a booster to absorb your first card.`,
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

  $('pc-reset').addEventListener('click', async () => {
    if (!confirm(`Start over? This deletes ${player.name} and its art from this browser.`)) return;
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
  });

  /* ----- Keeping up with the page ----- */
  // The name is measured to fit, so refit when the view appears, the window
  // resizes or the display font finishes loading.
  const refitName = () => fitCardName(card);
  window.addEventListener('hashchange', refitName);
  window.addEventListener('resize', refitName);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refitName);

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
