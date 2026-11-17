/**
 * The Player Card view (#view-player-card): the player's character sheet.
 * A browser can keep several cards. With none, the page starts a new one; with
 * some, it opens on the menu of cards ("Your cards") to play, delete or make one.
 * Flow of a new card: name it, pick its art, then the finished sheet, where the
 * player opens their first booster. Once the card has absorbed something the
 * page shows only the card.
 *
 * Everything stays in this browser, under the keys of player/roster.js: the list
 * of cards and each card's sheet in localStorage, the photos in the image store.
 */

import { $, el } from '../shared/dom.js';
import { renderCard, fitCardText, artBoxRatio, fillManaCost, abilityNodes } from '../shared/card.js';
import { storageWorks, readJSON, writeJSON, removeKey } from '../shared/storage.js';
import { putImage, getImage, deleteImage, imagesPersist, dataUrlToBlob } from '../shared/images.js';
import {
  SAVE_VERSION, FLAVOR_MAX,
  cleanName, newPlayer, withFlavor, withArt, withoutArt, withBooster, withCounters, describeCounters,
  withBonus, describeBonus,
  toCardData, upgradeSave,
} from './model.js';
import { isAbsorbable, absorbPreview, absorbCard, describeColors, typeLineOf } from './absorb.js';
import { describeGrants, grantsOf, withoutEquipment, withOff, putBackOn, withSpellCast, returnSpells } from './gear.js';
import { keywordRule, parseKeyword } from '../rules/keywords.js';
import { makeBooster, boosterPool } from './booster.js';
import {
  withTransformed, untransformAll, withTransformName, withTransformArt, withoutTransformArt,
} from './transform.js';
import { loadPool, cardImageUrl } from '../shared/cards.js';
import { renderBooster } from '../shared/booster-ui.js';
import { playAbsorb } from './absorb-animation.js';
import { withBusy } from '../shared/busy.js';
import { fileToSource, canvasToBlob } from './photo.js';
import { createCamera } from './camera.js';
import { createArtEditor } from './art-editor.js';
import {
  ROSTER_KEY, OLD_SHEET_KEY, sheetKey, imageKeys, transformImageKeys, newRoster, readRoster, withCard,
  withoutCard, newCardId, allImageKeys, oldImageMoves,
} from './roster.js';

const FLIP_MS = 600; // .card.is-flipping in css/player.css
const FALLBACK_ART_RATIO = 1.37; // .card__art aspect-ratio in css/card.css
const POOL_URL = 'data/level1.json';

export async function initPlayerView() {
  const card = $('pc-card');
  const nameInput = $('pc-name');
  const flavorInput = $('pc-flavor');
  const fileInput = $('pc-file');
  const captureInput = $('pc-capture');

  let roster = newRoster(); // the cards saved in this browser
  let currentId = null;     // the card being played, or null on the menu or while making one
  let creating = false;     // making a new card (the name step) instead of showing the menu
  let player = null;        // the sheet, or null before the card is named
  let artUrl = null;        // object URL of the cropped photo
  let transformArtUrls = []; // object URLs of the other faces' photos, by index in player.transforms
  let artTarget = null;     // whose art the camera and editor are for: null for the card, or a transform index
  let editingArt = false;   // the player came back to change the art
  let animating = false;    // the absorb animation is playing on the card
  let savedByNewer = false; // the save belongs to a newer version: don't touch it
  let storageOk = storageWorks();

  /* ----- Loading and saving ----- */
  // The current card's photos.
  const artKeys = () => imageKeys(currentId);
  const transformKeys = (index) => transformImageKeys(currentId, index);

  function saveRoster() {
    if (!writeJSON(ROSTER_KEY, roster)) storageOk = false;
  }

  /**
   * Before there could be several cards, the only one was saved under the old keys.
   * It becomes the first card of the roster; the old keys are removed only once its
   * photos are safely under the new ones.
   */
  async function moveOldCard() {
    const old = readJSON(OLD_SHEET_KEY);
    if (!old || readRoster(readJSON(ROSTER_KEY))) return;
    const id = newCardId();
    const moves = oldImageMoves(id, old);
    let moved = true;
    for (const [from, to] of moves) {
      const blob = await getImage(from);
      if (blob) moved = (await putImage(to, blob)) && moved;
    }
    if (!moved || !writeJSON(sheetKey(id), old) || !writeJSON(ROSTER_KEY, withCard(newRoster(), id))) return;
    removeKey(OLD_SHEET_KEY);
    for (const [from] of moves) await deleteImage(from);
  }

  function loadRoster() {
    roster = readRoster(readJSON(ROSTER_KEY)) || newRoster();
  }

  /** The menu again: no card is being played. */
  function showMenu() {
    currentId = null;
    player = null;
    creating = false;
    editingArt = false;
    savedByNewer = false;
    setArtUrl(null);
    clearTransformArtUrls();
    showError('');
  }

  function setArtUrl(blob) {
    if (artUrl) URL.revokeObjectURL(artUrl);
    artUrl = blob ? URL.createObjectURL(blob) : null;
  }

  function setTransformArtUrl(index, blob) {
    if (transformArtUrls[index]) URL.revokeObjectURL(transformArtUrls[index]);
    transformArtUrls[index] = blob ? URL.createObjectURL(blob) : null;
  }

  function clearTransformArtUrls() {
    for (const url of transformArtUrls) if (url) URL.revokeObjectURL(url);
    transformArtUrls = [];
  }

  function save() {
    if (currentId && !writeJSON(sheetKey(currentId), player)) storageOk = false;
  }

  /** Loads the current card. */
  async function load() {
    if (!currentId) return;
    const saved = readJSON(sheetKey(currentId));
    const upgraded = upgradeSave(saved);
    savedByNewer = upgraded.status === 'newer';
    player = upgraded.status === 'ok' ? upgraded.player : null;

    if (player && saved.version !== SAVE_VERSION) {
      // Move photos that an older save kept inside the sheet, and only replace
      // the old save once they are safely stored.
      let moved = true;
      for (const [name, dataUrl] of Object.entries(upgraded.images)) {
        try {
          moved = (await putImage(artKeys()[name], dataUrlToBlob(dataUrl))) && moved;
        } catch {
          moved = false;
        }
      }
      if (moved) save();
    }

    const art = player && player.hasArt ? await getImage(artKeys().art) : null;
    // The sheet says there is a photo but it's gone (cleared site data): show the default art.
    if (player && player.hasArt && !art) player = withoutArt(player);
    setArtUrl(art);

    clearTransformArtUrls();
    for (const [index, entry] of (player ? player.transforms || [] : []).entries()) {
      if (!entry.hasArt) continue;
      const other = await getImage(transformKeys(index).art);
      if (other) setTransformArtUrl(index, other);
      else player = withoutTransformArt(player, index);
    }
  }

  /* ----- Rendering ----- */
  function showError(message) {
    const box = $('pc-error');
    box.textContent = message || '';
    box.hidden = !message;
  }

  function drawCard() {
    renderCard(card, toCardData(player || newPlayer(cleanName(nameInput.value)), artUrl, transformArtUrls));
  }

  function render() {
    $('pc-storage-warning').hidden = storageOk && imagesPersist();
    $('pc-newer').hidden = !savedByNewer;

    let step = 'sheet';
    if (savedByNewer) step = 'none';
    else if (!currentId && roster.ids.length && !creating) step = 'menu';
    else if (!player) step = 'name';
    else if (!player.artChosen || editingArt) step = 'art';
    else if ((player.absorbed || []).length) step = 'card';
    $('pc-step-menu').hidden = step !== 'menu';
    $('view-player-card').classList.toggle('is-menu', step === 'menu');
    $('pc-to-menu').hidden = step === 'menu' || step === 'name' || !roster.ids.length;
    $('pc-name-cancel').hidden = !roster.ids.length;
    $('pc-step-name').hidden = step !== 'name';
    $('pc-step-art').hidden = step !== 'art';
    $('pc-sheet').hidden = step !== 'sheet';
    $('view-player-card').classList.toggle('is-card-only', step === 'card');
    $('pc-card-foot').hidden = step !== 'card';

    // While the animation plays it owns the card.
    if (!animating && step !== 'menu') drawCard();

    if (step === 'menu') {
      renderMenu();
    } else if (step === 'art') {
      $('pc-art-step').textContent = editingArt ? 'Card art' : 'Step 2 of 2';
      $('pc-art-prompt').replaceChildren(
        'Give ', el('strong', null, player.name), ' some card art: take a photo now or upload one.',
      );
      $('pc-art-skip').textContent = editingArt ? 'Use the default art' : 'Skip for now';
      $('pc-art-skip').hidden = editingArt && !player.hasArt;
      $('pc-art-cancel').hidden = !editingArt;
    } else if (step === 'card') {
      $('pc-counter-value').textContent = describeCounters(player.counters || 0);
      $('pc-bonus-power-value').textContent = describeBonus(player.bonusPower);
      $('pc-bonus-toughness-value').textContent = describeBonus(player.bonusToughness);
      const anyTransformed = (player.transforms || []).some((entry) => entry.transformed);
      const anyCast = (player.spells || []).some((spell) => spell.cast);
      const anyOff = [...(player.equipment || []), ...(player.auras || [])].some((entry) => entry.off);
      $('pc-bonus-clear').disabled = !player.bonusPower && !player.bonusToughness && !anyTransformed && !anyCast && !anyOff;
      renderTransforms();
      renderGear();
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
    currentId = newCardId();
    creating = false;
    player = newPlayer(name);
    save();
    roster = withCard(roster, currentId);
    saveRoster();
    // Ask the browser not to clear the cards when the device runs low on space.
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    render();
    $('pc-art-camera').focus();
  });

  $('pc-name-cancel').addEventListener('click', () => {
    showMenu();
    nameInput.value = '';
    render();
  });

  /* ----- The menu of cards ----- */
  let menuUrls = []; // object URLs of the photos on the menu

  async function renderMenu() {
    for (const url of menuUrls) URL.revokeObjectURL(url);
    menuUrls = [];
    const rows = [];
    for (const id of roster.ids) {
      const upgraded = upgradeSave(readJSON(sheetKey(id)));
      const sheet = upgraded.status === 'ok' ? upgraded.player : null;
      const row = el('li', 'roster__card');
      const thumb = el('div', 'roster__art');
      const info = el('div', 'roster__info');
      if (sheet) {
        const data = toCardData(sheet);
        info.append(
          el('strong', 'roster__name', sheet.name),
          el('span', 'roster__line', `${typeLineOf(sheet)} \u00b7 ${data.power}/${data.toughness}`),
          el('span', 'roster__line', `${(sheet.absorbed || []).length} cards absorbed`),
        );
        if (sheet.hasArt) {
          getImage(imageKeys(id).art).then((blob) => {
            if (!blob || !thumb.isConnected) return;
            const url = URL.createObjectURL(blob);
            menuUrls.push(url);
            const img = el('img');
            img.src = url;
            img.alt = '';
            thumb.append(img);
          });
        }
      } else {
        info.append(el('strong', 'roster__name', upgraded.status === 'newer' ? 'Saved by a newer version' : 'Unreadable card'));
      }
      const play = el('button', 'action action--primary', 'Play');
      play.type = 'button';
      play.disabled = !sheet && upgraded.status !== 'newer';
      play.addEventListener('click', () => openCard(id));
      const remove = el('button', 'action action--quiet', 'Delete');
      remove.type = 'button';
      remove.addEventListener('click', () => deleteCard(id, sheet));
      const actions = el('div', 'roster__actions');
      actions.append(play, remove);
      row.append(thumb, info, actions);
      rows.push(row);
    }
    $('pc-roster').replaceChildren(...rows);
  }

  async function openCard(id) {
    showMenu();
    currentId = id;
    await load();
    render();
    window.scrollTo(0, 0);
  }

  async function deleteCard(id, sheet) {
    const name = sheet ? sheet.name : 'this card';
    if (!confirm(`Delete ${name}? This deletes the card and its art from this browser.`)) return;
    removeKey(sheetKey(id));
    for (const key of allImageKeys(id, sheet)) await deleteImage(key);
    roster = withoutCard(roster, id);
    saveRoster();
    if (currentId === id) showMenu();
    nameInput.value = '';
    flavorInput.value = '';
    render();
    if (!roster.ids.length) nameInput.focus();
  }

  $('pc-new-card').addEventListener('click', () => {
    showMenu();
    creating = true;
    nameInput.value = '';
    flavorInput.value = '';
    render();
    nameInput.focus();
  });

  $('pc-to-menu').addEventListener('click', () => {
    if (animating) return;
    showMenu();
    render();
    window.scrollTo(0, 0);
  });

  /* ----- Step 2: art ----- */
  const editor = createArtEditor();
  const camera = createCamera({
    onPhoto: (photo) => frameAndKeep(photo, true), // for artTarget
    onUseFile: () => captureInput.click(),
  });

  /**
   * Opens the editor on a photo and keeps the result as the art of artTarget:
   * the card, or the other face of a card that transforms.
   * isNew: the photo was just taken or uploaded, so the original is stored too.
   */
  async function frameAndKeep(source, isNew) {
    const target = artTarget;
    const keys = target === null ? artKeys() : transformKeys(target);
    let result;
    try {
      const crop = isNew ? null : (target === null ? player.artCrop : player.transforms[target].artCrop);
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
          putImage(keys.art, art),
          isNew ? putImage(keys.artSource, source) : null,
        ]);
        if (target === null) {
          player = withArt(player, result.crop, true);
          setArtUrl(art);
          editingArt = false;
        } else {
          player = withTransformArt(player, target, result.crop, true);
          setTransformArtUrl(target, art);
          renderTransformDialog();
        }
        save();
        showError('');
        render();
      });
    } catch {
      showError("Couldn't save that photo. Try again.");
    }
  }

  async function useDefaultArt() {
    await deleteImage(artKeys().art);
    await deleteImage(artKeys().artSource);
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
    artTarget = null;
    // Without a live camera, phones open their camera app from this input; desktops get a file picker.
    if (!camera.open()) captureInput.click();
  });
  $('pc-art-upload').addEventListener('click', () => {
    artTarget = null;
    fileInput.click();
  });
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
    const source = await getImage(artKeys().artSource);
    if (!source) {
      showError("The original photo is no longer in this browser. Use Change art to pick a new one.");
      return;
    }
    artTarget = null;
    await frameAndKeep(source, false);
  });

  $('pc-change-art').addEventListener('click', () => {
    editingArt = true;
    render();
    $('pc-art-camera').focus();
  });

  // Deleting the card being played goes back to the menu (or to a new card when it was the last).
  const deleteCurrent = () => {
    if (player && currentId) deleteCard(currentId, player);
  };
  $('pc-reset').addEventListener('click', deleteCurrent);
  $('pc-reset-card').addEventListener('click', deleteCurrent);

  /* ----- Counters ----- */
  function changeCounters(by) {
    if (!player || animating) return;
    player = withCounters(player, (player.counters || 0) + by);
    save();
    render();
  }
  $('pc-counter-up').addEventListener('click', () => changeCounters(1));
  $('pc-counter-down').addEventListener('click', () => changeCounters(-1));

  function changeBonus(power, toughness) {
    if (!player || animating) return;
    player = withBonus(player, power, toughness);
    save();
    render();
  }
  const bonus = () => [player.bonusPower || 0, player.bonusToughness || 0];
  $('pc-bonus-power-up').addEventListener('click', () => { const [p, t] = bonus(); changeBonus(p + 1, t); });
  $('pc-bonus-power-down').addEventListener('click', () => { const [p, t] = bonus(); changeBonus(p - 1, t); });
  $('pc-bonus-toughness-up').addEventListener('click', () => { const [p, t] = bonus(); changeBonus(p, t + 1); });
  $('pc-bonus-toughness-down').addEventListener('click', () => { const [p, t] = bonus(); changeBonus(p, t - 1); });
  // Combat over: the bonuses go, the spells come back from the graveyard, and
  // every card turned over turns back.
  $('pc-bonus-clear').addEventListener('click', async () => {
    if (!player || animating) return;
    const turnBack = (player.transforms || []).some((entry) => entry.transformed);
    player = putBackOn(returnSpells(withBonus(player, 0, 0)));
    save();
    render();
    if (turnBack) await turnOver(untransformAll);
  });

  /* ----- Equipment, Auras and spells ----- */
  function gearButton(label, quiet, onClick) {
    const button = el('button', quiet ? 'action action--quiet gear__action' : 'action gear__action', label);
    button.type = 'button';
    button.addEventListener('click', () => {
      if (!animating) onClick();
    });
    return button;
  }

  /** One Equipment, item or Aura: what it gives, and its buttons. list is 'equipment' or 'auras'. */
  function gearItem(entry, index, list) {
    const grants = grantsOf(entry.name) || {};
    const item = el('li', entry.off ? 'gear__item is-cast' : 'gear__item');
    const head = el('div', 'gear__head');
    head.append(el('strong', null, entry.name));
    if (list === 'auras') head.append(el('span', 'gear__tag', 'Aura'));
    if (grants.toggle) {
      head.append(gearButton(entry.off ? 'Put back' : grants.toggle.label, entry.off, () => {
        player = withOff(player, list, index, !entry.off);
        save();
        render();
      }));
    }
    if (list === 'equipment') {
      const label = grants.remove || 'Destroyed';
      head.append(gearButton(label, true, () => {
        const question = label === 'Destroyed'
          ? `Was ${entry.name} destroyed? You lose what it gives you.`
          : `Did you use ${entry.name}? It's gone for good.`;
        if (!confirm(question)) return;
        player = withoutEquipment(player, index);
        save();
        render();
      }));
    }
    item.append(head);
    const summary = describeGrants(entry.name);
    if (summary) item.append(el('p', 'gear__summary', summary));
    if (entry.off && grants.toggle) item.append(el('p', 'gear__summary', grants.toggle.note));
    for (const ability of grants.abilities || []) {
      const paragraph = el('p', 'gear__text');
      paragraph.append(...abilityNodes(ability));
      item.append(paragraph);
    }
    return item;
  }

  function renderGear() {
    const items = [
      ...(player.equipment || []).map((entry, index) => gearItem(entry, index, 'equipment')),
      ...(player.auras || []).map((entry, index) => gearItem(entry, index, 'auras')),
    ];
    $('pc-gear-list').replaceChildren(...items);
    $('pc-gear').hidden = !items.length;

    const spells = (player.spells || []).map((spell, index) => {
      const item = el('li', spell.cast ? 'gear__item is-cast' : 'gear__item');
      const head = el('div', 'gear__head');
      head.append(el('strong', null, spell.name), manaCostNode(spell.manaCost));
      const cast = el('button', spell.cast ? 'action action--quiet gear__action' : 'action gear__action', spell.cast ? 'Take back' : 'Cast');
      cast.type = 'button';
      cast.addEventListener('click', () => {
        if (animating) return;
        player = withSpellCast(player, index, !spell.cast);
        save();
        render();
      });
      head.append(cast);
      item.append(head);
      if (spell.cast) item.append(el('p', 'gear__summary', 'In the graveyard until combat is over.'));
      for (const line of String(spell.text || '').split('\n')) {
        const paragraph = el('p', 'gear__text');
        paragraph.append(...abilityNodes(line));
        item.append(paragraph);
      }
      return item;
    });
    $('pc-spell-list').replaceChildren(...spells);
    $('pc-spells').hidden = !spells.length;
  }

  /* ----- Cards that transform ----- */
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /** Turns the card over: it spins and shows change(player) halfway through. */
  async function turnOver(change) {
    if (!player || animating) return;
    if (reducedMotion()) {
      player = change(player);
      save();
      render();
      return;
    }
    animating = true;
    card.classList.add('is-flipping');
    try {
      await wait(FLIP_MS / 2);
      player = change(player);
      save();
      drawCard();
      render();
      await wait(FLIP_MS / 2);
    } finally {
      card.classList.remove('is-flipping');
      animating = false;
      render();
    }
  }

  /** One row of buttons per card that transforms. */
  function renderTransforms() {
    const rows = (player.transforms || []).map((entry, index) => {
      const flip = el('button', 'action', entry.transformed ? 'Turn back' : 'Transform');
      flip.type = 'button';
      flip.addEventListener('click', () => turnOver((sheet) => withTransformed(sheet, index, !entry.transformed)));
      const edit = el('button', 'action action--quiet', 'Edit other face');
      edit.type = 'button';
      edit.addEventListener('click', () => openTransformDialog(index));
      return [flip, edit];
    });
    $('pc-transforms').replaceChildren(...rows.flat());
  }

  const transformDialog = $('pc-transform');
  const transformName = $('pc-transform-name');
  let transformIndex = -1; // the face the dialog is editing

  function renderTransformDialog() {
    const entry = player && player.transforms[transformIndex];
    if (!entry) return;
    $('pc-transform-intro').textContent =
      `${entry.front} can transform into ${entry.back}, and your card turns over with it. Give that face its own name and art if you like.`;
    transformName.placeholder = player.name;
    $('pc-transform-art-status').textContent = entry.hasArt ? 'That face has its own art.' : 'That face uses your usual art.';
    $('pc-transform-same-art').hidden = !entry.hasArt;
  }

  function openTransformDialog(index) {
    transformIndex = index;
    transformName.value = player.transforms[index].name || '';
    renderTransformDialog();
    transformDialog.showModal();
    transformName.focus();
  }

  transformName.addEventListener('input', () => {
    if (!player || transformIndex < 0) return;
    player = withTransformName(player, transformIndex, transformName.value);
    save();
    render();
  });
  $('pc-transform-form').addEventListener('submit', (event) => {
    event.preventDefault();
    transformDialog.close();
  });
  $('pc-transform-camera').addEventListener('click', () => {
    artTarget = transformIndex;
    if (!camera.open()) captureInput.click();
  });
  $('pc-transform-upload').addEventListener('click', () => {
    artTarget = transformIndex;
    fileInput.click();
  });
  $('pc-transform-same-art').addEventListener('click', async () => {
    const keys = transformKeys(transformIndex);
    await deleteImage(keys.art);
    await deleteImage(keys.artSource);
    player = withoutTransformArt(player, transformIndex);
    setTransformArtUrl(transformIndex, null);
    save();
    renderTransformDialog();
    render();
  });

  /* ----- Boosters and absorbing ----- */
  const boosterDialog = $('pc-booster');
  const confirmButton = $('pc-booster-confirm');
  let absorbablePool = null; // the cards of the pool that can be absorbed so far
  let boosterCards = [];
  let boosterControls = null;
  let picked = null;       // the card clicked in the booster
  let absorbing = null;    // the card being absorbed, on the second step

  async function loadAbsorbable() {
    if (!absorbablePool) absorbablePool = (await loadPool(POOL_URL)).filter(isAbsorbable);
    return absorbablePool;
  }

  /** The cards of the open booster, or a new booster if none is open (or its cards left the pool). */
  function currentBooster(pool) {
    if (player.booster) {
      const byId = new Map(pool.map((poolCard) => [poolCard.id, poolCard]));
      const cards = player.booster.cardIds.map((id) => byId.get(id));
      if (cards.length && cards.every(Boolean)) return cards;
    }
    const cards = makeBooster(boosterPool(pool, player));
    if (!cards.length) return cards; // nothing left to deal
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

  async function openBooster() {
    if (animating) return;
    showError('');
    let pool;
    try {
      pool = await withBusy('Opening your booster\u2026', loadAbsorbable);
    } catch {
      showError("Couldn't load the card pool. Check your connection and try again.");
      return;
    }
    boosterCards = currentBooster(pool);
    if (!boosterCards.length) {
      showError('You have absorbed every card in the pool. There is nothing left to open.');
      return;
    }
    picked = null;
    confirmButton.hidden = true;
    $('pc-booster-status').textContent = 'Pick one card to absorb.';
    boosterControls = renderBooster($('pc-booster-cards'), boosterCards, pickCard);
    showPickStep();
    render();
    boosterDialog.showModal();
  }
  // The first one from the sheet, the next ones from under the card.
  $('pc-open-booster').addEventListener('click', openBooster);
  $('pc-open-another').addEventListener('click', openBooster);

  $('pc-booster-close').addEventListener('click', () => boosterDialog.close());

  /* Second step: show what changes, and ask for any stat the card doesn't print as a number. */
  function absorbChoices() {
    const power = $('pc-absorb-power');
    const toughness = $('pc-absorb-toughness');
    return { power: power ? power.value : undefined, toughness: toughness ? toughness.value : undefined };
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
    const after = absorbCard(player, absorbing, absorbChoices());
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
      const strong = el('strong');
      strong.append(...abilityNodes(keyword));
      item.append(strong, ` — ${keywordRule(keyword) || 'Not defined yet.'}`);
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
    if (preview.bonus) {
      const item = el('li');
      item.append(
        el('strong', null, `+${preview.bonus.power}/+${preview.bonus.toughness}`),
        ' \u2014 You become a Sliver, so its bonus to Slivers is yours too. It\u2019s already in your power and toughness.',
      );
      items.push(item);
    }
    if (preview.grants) {
      const item = el('li');
      const how = {
        equipment: 'You equip it. It stays its own card: if something destroys it, you lose what it gives you.',
        item: 'You keep it with your Equipment. Sacrificing it only lasts the combat: it\u2019s back when combat is over.',
        aura: 'You enchant yourself with it, for good.',
      }[preview.kind];
      const summary = describeGrants(preview.name);
      item.append(el('strong', null, summary ? `${preview.name}: ${summary}` : preview.name), ` \u2014 ${how}`);
      items.push(item);
      for (const keyword of preview.grants.keywords || []) {
        const line = el('li');
        line.append(el('strong', null, keyword), ` \u2014 ${keywordRule(keyword) || 'Not defined yet.'}`);
        items.push(line);
      }
      for (const ability of preview.grants.abilities || []) {
        const line = el('li');
        line.append(...abilityNodes(ability));
        items.push(line);
      }
    }
    if (preview.spell) {
      const item = el('li');
      item.append(el('strong', null, 'It joins your spell list'), ' \u2014 Cast it once per combat; after that it\u2019s in the graveyard until combat is over.');
      items.push(item);
      for (const line of preview.spell.text.split('\n')) {
        const text = el('li');
        text.append(...abilityNodes(line));
        items.push(text);
      }
    }
    if (preview.transform) {
      const back = preview.transform;
      const item = el('li');
      const gains = [
        ...(back.keywords || []).map((keyword) => keyword.toLowerCase()),
        ...(back.abilities || []).map((ability) => ability.split(' \u2014 ')[0]),
      ];
      item.append(
        el('strong', null, `Transforms into ${back.name}`),
        ` \u2014 Your card can turn over. Transformed, you lose what this card gives you and get +${back.power || 0}/+${back.toughness || 0}${gains.length ? `, ${gains.join(', ')}` : ''}. You can give that face its own name and art.`,
      );
      items.push(item);
    }
    $('pc-absorb-ability-list').replaceChildren(...items);

    let note = '';
    if (!preview.textReviewed) note = 'Its rules text isn’t part of the game yet, so you don’t gain it.';
    else if (preview.hasText && !items.length) note = 'Its rules text does nothing in the dungeon.';
    const noteEl = $('pc-absorb-ability-note');
    noteEl.textContent = note;
    noteEl.hidden = !note;
    $('pc-absorb-abilities-title').textContent = !items.length ? 'Rules text' : preview.kind === 'creature' ? 'Abilities you gain' : 'What you gain';
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

    showAbilities(preview);
    renderChanges();
    $('pc-booster-pick').hidden = true;
    $('pc-absorb').hidden = false;
    (stats.length ? stats[0].querySelector('input') : $('pc-absorb-go')).focus();
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
    player = absorbCard(player, creature, absorbChoices());
    save();
    absorbing = null;
    picked = null;
    boosterDialog.close();
    // From here the animation owns the card, so nothing draws the new values early.
    animating = true;

    // A card that transforms: ask for its other face's name and art right away. The card
    // is already saved, so a reload now loses nothing ("Edit other face" is under the card).
    if ((player.transforms || []).length > (before.transforms || []).length) {
      await new Promise((resolve) => {
        transformDialog.addEventListener('close', resolve, { once: true });
        openTransformDialog(player.transforms.length - 1);
      });
    }

    // Switch to the card-only page, then load the new values into the card.
    render();
    window.scrollTo(0, 0);
    card.focus({ preventScroll: true });
    try {
      await playAbsorb({
        cardEl: card,
        ghostEl: $('pc-absorb-ghost'),
        captionEl: $('pc-absorb-caption'),
        before: toCardData(before, artUrl, transformArtUrls),
        after: toCardData(player, artUrl, transformArtUrls),
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
  // Coming to the Player Card opens the menu of cards (or a new card when there are none).
  window.addEventListener('hashchange', () => {
    if (location.hash !== '#player-card' || animating) return;
    loadRoster();
    showMenu();
    render();
  });
  window.addEventListener('resize', refitText);
  if (document.fonts) {
    // ready can resolve before the card's fonts even start loading, so also
    // refit every time a font finishes loading.
    document.fonts.ready.then(refitText);
    document.fonts.addEventListener('loadingdone', refitText);
  }

  // Another tab changed the cards.
  window.addEventListener('storage', async (event) => {
    if (event.key !== null && event.key !== ROSTER_KEY && !(currentId && event.key === sheetKey(currentId))) return;
    loadRoster();
    if (currentId && !roster.ids.includes(currentId)) showMenu();
    editingArt = false;
    await load();
    render();
  });

  await moveOldCard();
  loadRoster();
  render();
}
