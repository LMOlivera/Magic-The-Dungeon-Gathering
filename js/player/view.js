/**
 * The Player Card view (#view-player-card): the player's character sheet.
 * A browser can keep several cards. With none, the page starts a new one; with
 * some, it opens on the menu of cards ("Your cards") to play, delete or make one.
 * Flow of a new card: name it, pick its art, then the finished sheet, where the
 * player picks their first card from every card in data/akashicos.json. Once the
 * card has absorbed something the page shows only the card, and boosters come
 * from data/level1.json.
 *
 * Everything stays in this browser, under the keys of player/roster.js: the list
 * of cards and each card's sheet in localStorage, the photos in the image store.
 */

import { $, el } from '../shared/dom.js';
import { renderCard, fitCardText, artBoxRatio, fillManaCost, abilityNodes, fillCardText } from '../shared/card.js';
import { storageWorks, readJSON, writeJSON, removeKey } from '../shared/storage.js';
import { putImage, getImage, deleteImage, imagesPersist, dataUrlToBlob } from '../shared/images.js';
import {
  SAVE_VERSION, FLAVOR_MAX,
  cleanName, newPlayer, withName, withFlavor, withArt, withoutArt, withBooster, withCounters, describeCounters,
  withBonus, describeBonus,
  toCardData, upgradeSave,
} from './model.js';
import { isAbsorbable, absorbPreview, absorbCard, describeColors, typeLineOf, chosenX, textToAbsorb } from './absorb.js';
import {
  picksSpells, cardPoints, maxX, affordableCreatures, startSpells, withStartPick, withStartDone,
} from './start.js';
import { describeGrants, grantsOf, withoutEquipment, withOff, putBackOn, withSpellCast, returnSpells } from './gear.js';
import {
  attachmentsOf, inheritedCreatures, emptySlots, xpSegments, printedStats, MIN_ATTACHMENT_SLOTS, MIN_CREATURE_SLOTS,
} from './board.js';
import { keywordRule, parseKeyword } from '../rules/keywords.js';
import { makeBooster } from './booster.js';
import { withXp, xpToLevelUp, nextLevelBooster, withLevelBoosterUsed, levelBoosterPool } from './level.js';
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
const FIRST_POOL_URL = 'data/akashicos.json'; // the first card is picked from all of these
const SPELLS_POOL_URL = 'data/akashicos_spells.json'; // then spells, with the points left (player/start.js)
// Every pool a card can have been absorbed from, for the board's images (older cards used level1.json).
const CARD_INDEX_URLS = [FIRST_POOL_URL, SPELLS_POOL_URL, 'data/level1.json'];

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
    const data = toCardData(player || newPlayer(cleanName(nameInput.value)), artUrl, transformArtUrls);
    renderCard(card, data);
    renderCardText(data);
  }

  /**
   * "Text on card": everything the card says, at a size that's easy to read. The card's
   * own text box shrinks its font to fit, which gets hard to read as the card grows.
   */
  function renderCardText(data) {
    const body = $('pc-card-text-body');
    const head = el('div', 'card-text__head');
    head.append(
      el('strong', 'card-text__name', `${data.transformed ? '\u263E ' : ''}${data.name || 'Unnamed card'}`),
      el('span', 'card-text__pt', `${data.power}/${data.toughness}`),
    );
    const rules = el('div', 'card-text__rules');
    fillCardText(rules, data);
    if (!rules.childElementCount) rules.append(el('p', 'card-text__empty', 'No abilities yet.'));
    body.replaceChildren(head, el('p', 'card-text__type', typeLineOf(data)), rules);
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
    $('pc-side').hidden = step !== 'card';
    $('pc-board').hidden = step !== 'card';
    $('pc-hud-level').hidden = step !== 'card';
    $('pc-banner').hidden = step !== 'card';
    $('pc-reset-card').hidden = step !== 'card';
    if (step !== 'card') for (const dialog of [$('pc-detail'), $('pc-card-text')]) if (dialog.open) dialog.close();

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
      renderStart();
      renderLevel();
      trackerValue('pc-counter-value', describeCounters(player.counters || 0));
      trackerValue('pc-bonus-power-value', describeBonus(player.bonusPower));
      trackerValue('pc-bonus-toughness-value', describeBonus(player.bonusToughness));
      const anyTransformed = (player.transforms || []).some((entry) => entry.transformed);
      const anyCast = (player.spells || []).some((spell) => spell.cast);
      const anyOff = [...(player.equipment || []), ...(player.auras || [])].some((entry) => entry.off);
      $('pc-bonus-clear').disabled = !player.bonusPower && !player.bonusToughness && !anyTransformed && !anyCast && !anyOff;
      renderTransforms();
      loadCardIndex();
      renderBoard();
    } else if (step === 'sheet') {
      $('pc-edit-art').hidden = !player.hasArtSource;
      if (document.activeElement !== flavorInput) flavorInput.value = player.flavor || '';
      $('pc-flavor-count').textContent = `${flavorInput.value.length}/${FLAVOR_MAX}`;
      $('pc-summary').replaceChildren(
        el('strong', null, player.name),
        ` walks in as a ${describeColors(player.colors)} ${player.power}/${player.toughness} ${player.types.join(' ')}.`,
        player.start ? ` You have ${points(player.start.points)} to spend: first a creature, then spells of its colors. Each card costs its mana value.` : '',
      );
    }
  }

  /** A value in "Status". Long ones ("+10/+10") get a smaller font so they fit a phone's box. */
  function trackerValue(id, text) {
    $(id).textContent = text;
    $(id).classList.toggle('is-long', text.length > 4);
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
          renderRenameFaces();
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

  /* ----- Experience and levels (player/level.js) ----- */
  function renderLevel() {
    const level = player.level || 1;
    $('pc-level-value').textContent = String(level);
    trackerValue('pc-xp-value', `${player.xp || 0}/${xpToLevelUp(level)}`);
    $('pc-xp-down').disabled = !player.xp;
    // The header shows the same, with a bar.
    $('pc-hud-level-value').textContent = String(level);
    $('pc-hud-xp').textContent = `${player.xp || 0}/${xpToLevelUp(level)}`;
    const bar = xpSegments(player.xp || 0, xpToLevelUp(level));
    const xpbar = $('pc-hud-xpbar');
    xpbar.classList.toggle('xpbar--whole', !bar.segments);
    xpbar.style.setProperty('--share', String(bar.share));
    xpbar.replaceChildren(...(bar.segments || []).map((earned) => el('span', earned ? 'is-earned' : null)));
    // Boosters wait while the starting points are being spent.
    const next = nextLevelBooster(player);
    const button = $('pc-open-another');
    button.hidden = !next || Boolean(player.start);
    if (next) {
      const waiting = (player.levelBoosters || []).length;
      button.textContent = `Open your level ${next.level} booster${waiting > 1 ? ` (${waiting} waiting)` : ''}`;
    }
  }

  async function changeXp(by) {
    if (!player || animating) return;
    const before = player.level || 1;
    player = withXp(player, by);
    save();
    render();
    if (player.level > before) {
      $('pc-absorb-caption').textContent = `Level up! You're level ${player.level}.`;
      if (!player.start) await openBooster();
    }
  }
  $('pc-xp-up').addEventListener('click', () => changeXp(1));
  $('pc-xp-down').addEventListener('click', () => changeXp(-1));

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

  /* ----- The board: attachments, inherited creatures and the spellbook (player/board.js) ----- */
  // Every card the player can have absorbed, by id, for its image and printed stats.
  // Loaded once, in the background; the board works without it and fills in when it arrives.
  const cardById = new Map();
  let cardIndexLoading = null;

  function loadCardIndex() {
    if (cardIndexLoading) return;
    cardIndexLoading = Promise.all(CARD_INDEX_URLS.map((url) => loadPool(url).catch(() => null))).then((pools) => {
      for (const pool of pools) for (const poolCard of pool || []) if (!cardById.has(poolCard.id)) cardById.set(poolCard.id, poolCard);
      if (pools.every((pool) => !pool)) cardIndexLoading = null; // offline: try again on the next render
      if (player) render();
    });
  }

  /** A card image from Scryfall, or nothing when it's not known or doesn't load. size: 'small', 'normal' or 'artCrop'. */
  function cardImage(poolCard, size) {
    const url = poolCard ? cardImageUrl(poolCard, 0, size) : null;
    if (!url) return [];
    const img = el('img');
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('error', () => img.remove());
    img.src = url;
    return [img];
  }

  const KIND_LABELS = { equipment: 'Equipment', item: 'Item', aura: 'Aura' };

  /** One Equipment, item or Aura on the board: a small card that opens its details. */
  function attachmentSlot(entry) {
    const slot = el('li');
    const button = el('button', entry.off ? 'mini is-off' : 'mini');
    button.type = 'button';
    button.title = entry.name;
    button.setAttribute('aria-label', `${entry.name}, ${KIND_LABELS[entry.kind]}${entry.off ? ', taken off for this combat' : ''}`);
    const art = el('span', 'mini__art');
    art.append(...cardImage(cardById.get(entry.id), 'small'));
    button.append(el('span', 'mini__name', entry.name), art, el('span', 'mini__type', KIND_LABELS[entry.kind]));
    if (entry.off) button.append(el('span', 'mini__badge', 'Off'));
    button.addEventListener('click', () => openDetail(() => attachmentDetail(entry.list, entry.index)));
    slot.append(button);
    return slot;
  }

  /** One creature the card inherited: its art in a circle, with its printed power/toughness. */
  function creatureToken(entry) {
    const slot = el('li');
    const button = el('button', 'token');
    button.type = 'button';
    const stats = printedStats(entry.card);
    const artist = entry.card && entry.card.artist ? ` — art by ${entry.card.artist}` : '';
    button.title = `${entry.name}${artist}`;
    button.setAttribute('aria-label', `${entry.name}${stats ? `, ${stats}` : ''}`);
    const art = el('span', 'token__art');
    art.append(...cardImage(entry.card, 'artCrop'));
    button.append(art);
    if (stats) button.append(el('span', 'token__pt', stats));
    button.append(el('span', 'token__name', entry.name));
    button.addEventListener('click', () => openDetail(() => creatureDetail(entry.absorbedAt)));
    slot.append(button);
    return slot;
  }

  const emptySlot = (className) => {
    const slot = el('li', className);
    slot.setAttribute('aria-hidden', 'true');
    return slot;
  };

  function renderBoard() {
    const attachments = attachmentsOf(player, cardById);
    $('pc-attach-count').textContent = String(attachments.length);
    $('pc-attach-list').replaceChildren(
      ...attachments.map(attachmentSlot),
      ...Array.from({ length: emptySlots(attachments.length, MIN_ATTACHMENT_SLOTS) }, () => emptySlot('mini mini--empty')),
    );

    const creatures = inheritedCreatures(player, cardById);
    $('pc-creatures-count').textContent = String(creatures.length);
    $('pc-creature-list').replaceChildren(
      ...creatures.map((entry) => creatureToken(entry)),
      ...Array.from({ length: emptySlots(creatures.length, MIN_CREATURE_SLOTS) }, () => emptySlot('token token--empty')),
    );

    const spells = (player.spells || []).map(spellRow);
    $('pc-spell-list').replaceChildren(...spells);
    $('pc-spell-list').hidden = !spells.length;
    $('pc-spells-empty').hidden = Boolean(spells.length);

    if (detailDialog.open) renderDetail();
  }

  function castButton(spell, index) {
    const cast = el('button', spell.cast ? 'action action--quiet spell__cast' : 'action spell__cast', spell.cast ? 'Take back' : 'Cast');
    cast.type = 'button';
    cast.addEventListener('click', () => {
      if (animating) return;
      player = withSpellCast(player, index, !spell.cast);
      save();
      render();
    });
    return cast;
  }

  /** One spell in the spellbook: its card, cost, text, whether it's ready, and Cast. */
  function spellRow(spell, index) {
    const row = el('li', spell.cast ? 'spell is-cast' : 'spell');
    const thumb = el('button', 'spell__thumb');
    thumb.type = 'button';
    thumb.setAttribute('aria-label', `Show the card ${spell.name}`);
    thumb.append(...cardImage(cardById.get(spell.id), 'small'));
    thumb.addEventListener('click', () => openDetail(() => spellDetail(index)));

    const info = el('div', 'spell__info');
    const head = el('div', 'spell__head');
    head.append(el('strong', 'spell__name', spell.name), manaCostNode(spell.manaCost));
    info.append(head, el('span', 'spell__type', spell.typeLine || ''));
    for (const line of String(spell.text || '').split('\n')) {
      const paragraph = el('p', 'spell__text');
      paragraph.append(...abilityNodes(line));
      info.append(paragraph);
    }
    if (spell.cast) info.append(el('p', 'spell__note', 'In the graveyard until combat is over.'));

    const side = el('div', 'spell__side');
    const uses = el('span', 'spell__uses', spell.cast ? '0/1' : '1/1');
    uses.title = spell.cast ? 'Cast this combat' : 'Ready to cast';
    uses.setAttribute('aria-label', uses.title);
    side.append(uses, castButton(spell, index));
    row.append(thumb, info, side);
    return row;
  }

  /* The details of a card on the board, in a dialog: its full image, what it gives and its buttons. */
  const detailDialog = $('pc-detail');
  let detailOf = null; // () => the details to show, or null when the card is gone

  function openDetail(build) {
    if (animating) return;
    detailOf = build;
    renderDetail();
    if (!detailDialog.open) detailDialog.showModal();
  }

  function detailButton(label, className, onClick) {
    const button = el('button', className, label);
    button.type = 'button';
    button.addEventListener('click', () => {
      if (!animating) onClick();
    });
    return button;
  }

  function renderDetail() {
    const detail = detailOf && player ? detailOf() : null;
    if (!detail) {
      if (detailDialog.open) detailDialog.close();
      return;
    }
    $('pc-detail-title').textContent = detail.title;
    const image = $('pc-detail-image');
    const img = cardImage(detail.card, 'normal');
    if (img.length) img[0].alt = detail.title;
    image.replaceChildren(...img);
    image.hidden = !img.length;
    $('pc-detail-info').replaceChildren(...detail.info);
    $('pc-detail-actions').replaceChildren(
      ...detail.actions,
      detailButton('Close', 'action action--quiet', () => detailDialog.close()),
    );
  }

  /** A line of text with keywords and mana symbols, as on the card. */
  function textLine(text, className = 'detail__text') {
    const paragraph = el('p', className);
    paragraph.append(...abilityNodes(text));
    return paragraph;
  }

  function attachmentDetail(list, index) {
    const entry = (player[list] || [])[index];
    if (!entry) return null;
    const grants = grantsOf(entry.name) || {};
    const kind = attachmentsOf(player, cardById).find((item) => item.list === list && item.index === index).kind;
    const info = [el('p', 'detail__kind', KIND_LABELS[kind])];
    const summary = describeGrants(entry.name);
    if (summary) info.push(el('p', 'detail__summary', `Gives you ${summary}.`));
    for (const ability of grants.abilities || []) info.push(textLine(ability));
    if (entry.off && grants.toggle) info.push(el('p', 'detail__note', grants.toggle.note));
    info.push(el('p', 'detail__note', {
      equipment: 'It stays its own card: if something destroys it, you lose what it gives you.',
      item: 'Sacrificing it only lasts the combat: it’s back when combat is over.',
      aura: 'You’re enchanted with it for good.',
    }[kind]));

    const actions = [];
    if (grants.toggle) {
      actions.push(detailButton(entry.off ? 'Put back' : grants.toggle.label, entry.off ? 'action' : 'action action--primary', () => {
        player = withOff(player, list, index, !entry.off);
        save();
        render();
      }));
    }
    if (list === 'equipment') {
      const label = grants.remove || 'Destroyed';
      actions.push(detailButton(label, 'action', () => {
        const question = label === 'Destroyed'
          ? `Was ${entry.name} destroyed? You lose what it gives you.`
          : `Did you use ${entry.name}? It's gone for good.`;
        if (!confirm(question)) return;
        player = withoutEquipment(player, index);
        detailOf = null;
        save();
        render();
      }));
    }
    return { title: entry.name, card: cardById.get(entry.id), info, actions };
  }

  function creatureDetail(absorbedIndex) {
    const entry = (player.absorbed || [])[absorbedIndex];
    if (!entry) return null;
    const poolCard = cardById.get(entry.id) || null;
    const info = [];
    if (poolCard) {
      const stats = printedStats(poolCard);
      info.push(el('p', 'detail__kind', `${poolCard.typeLine}${stats ? ` · ${stats}` : ''}`));
    }
    const gave = [...(entry.keywords || []), ...(entry.abilities || [])];
    if (gave.length) {
      info.push(el('p', 'detail__summary', 'Abilities it gave you:'));
      for (const line of gave) info.push(textLine(line));
    } else {
      info.push(el('p', 'detail__note', 'It gave you no abilities, only what every creature gives: its power and toughness, colors, cost and creature types.'));
    }
    return { title: entry.name, card: poolCard, info, actions: [] };
  }

  function spellDetail(index) {
    const spell = (player.spells || [])[index];
    if (!spell) return null;
    const head = el('p', 'detail__kind');
    head.append(spell.typeLine || '', ' ', manaCostNode(spell.manaCost));
    const info = [head, ...String(spell.text || '').split('\n').map((line) => textLine(line))];
    info.push(el('p', 'detail__note', spell.cast ? 'In the graveyard until combat is over.' : 'Ready: it can be cast once this combat.'));
    return { title: spell.name, card: cardById.get(spell.id), info, actions: [castButton(spell, index)] };
  }

  /* Phones: the spellbook and status share a sheet, one tab each. Wide screens show both. */
  const tabs = [$('pc-tab-spells'), $('pc-tab-status')];
  function selectTab(tab, focus = false) {
    for (const other of tabs) {
      const selected = other === tab;
      other.setAttribute('aria-selected', String(selected));
      other.tabIndex = selected ? 0 : -1;
      $(other.getAttribute('aria-controls')).classList.toggle('is-inactive', !selected);
    }
    if (focus) tab.focus();
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      selectTab(tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length], true);
    });
  }
  selectTab(tabs[0]);

  /* "Text on card", in a dialog from under the card. */
  const cardTextDialog = $('pc-card-text');
  $('pc-card-text-open').addEventListener('click', () => cardTextDialog.showModal());
  $('pc-card-text-close').addEventListener('click', () => cardTextDialog.close());

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

  /**
   * One row per card that transforms. With more than one, each button names its card,
   * "Transform (Cecil)", so the player knows which one turns over. Its other face is
   * named, and given art, on the rename screen after absorbing a card.
   */
  function renderTransforms() {
    const transforms = player.transforms || [];
    const names = transformLabels(transforms);
    const rows = transforms.map((entry, index) => {
      const which = transforms.length > 1 ? ` (${names[index]})` : '';
      const flip = el('button', 'action', `${entry.transformed ? 'Turn back' : 'Transform'}${which}`);
      flip.type = 'button';
      flip.addEventListener('click', () => turnOver((sheet) => withTransformed(sheet, index, !entry.transformed)));
      const row = el('div', 'transforms__row');
      row.append(flip);
      return row;
    });
    $('pc-transforms').replaceChildren(...rows);
  }

  /** A short name for each card that transforms: "Cecil" for "Cecil, Dark Knight", unless two would read the same. */
  function transformLabels(transforms) {
    const short = transforms.map((entry) => entry.front.split(',')[0]);
    return short.map((name, i) => (short.filter((other) => other === name).length > 1 ? transforms[i].front : name));
  }

  /* ----- Renaming: each time the card absorbs one ----- */
  // The card's name, and the name and art of each other face (cards that transform).
  const renameDialog = $('pc-rename');
  const renameInput = $('pc-rename-name');
  const faceInput = (index) => $(`pc-rename-face-${index}`);

  /** One section per other face: its name, and its art. Typed names survive a redraw (after new art). */
  function renderRenameFaces() {
    const transforms = (player && player.transforms) || [];
    const typed = transforms.map((entry, index) => (faceInput(index) ? faceInput(index).value : entry.name || ''));
    const sections = transforms.map((entry, index) => {
      const section = el('fieldset', 'rename-face');
      const legend = el('legend', null, `When transformed into ${entry.back}`);
      const field = el('div', 'field');
      const label = el('label', null, `Name of that face (from ${entry.front})`);
      label.htmlFor = `pc-rename-face-${index}`;
      const input = el('input', 'input');
      Object.assign(input, { id: `pc-rename-face-${index}`, value: typed[index], autocomplete: 'off', spellcheck: false });
      input.placeholder = `${cleanName(renameInput.value) || player.name} (your usual name)`;
      field.append(label, input);

      const art = el('p', 'note', entry.hasArt ? 'That face has its own art.' : 'That face uses your usual art.');
      const actions = el('div', 'actions');
      const photo = el('button', 'action', 'Take a photo');
      photo.type = 'button';
      photo.addEventListener('click', () => {
        artTarget = index;
        if (!camera.open()) captureInput.click();
      });
      const upload = el('button', 'action', 'Upload a photo');
      upload.type = 'button';
      upload.addEventListener('click', () => {
        artTarget = index;
        fileInput.click();
      });
      actions.append(photo, upload);
      if (entry.hasArt) {
        const same = el('button', 'action action--quiet', 'Use my usual art');
        same.type = 'button';
        same.addEventListener('click', async () => {
          const keys = transformKeys(index);
          await deleteImage(keys.art);
          await deleteImage(keys.artSource);
          player = withoutTransformArt(player, index);
          setTransformArtUrl(index, null);
          save();
          renderRenameFaces();
        });
        actions.append(same);
      }
      section.append(legend, field, art, actions);
      return section;
    });
    $('pc-rename-faces').replaceChildren(...sections);
    $('pc-rename-faces').hidden = !sections.length;
    $('pc-rename-go').textContent = sections.length ? 'Save the names' : 'Rename';
    $('pc-rename-keep').textContent = sections.length ? 'Keep the names' : 'Keep the name';
  }

  /** Asks whether to rename the card after absorbing `absorbedName`; resolves once the dialog is closed. */
  function askRename(absorbedName) {
    $('pc-rename-intro').textContent = `${player.name} absorbed ${absorbedName}. You can give your card a new name, or keep the one it has.`;
    renameInput.value = player.name;
    $('pc-rename-faces').replaceChildren(); // fresh fields from the save
    renderRenameFaces();
    return new Promise((resolve) => {
      renameDialog.addEventListener('close', resolve, { once: true });
      renameDialog.showModal();
      renameInput.select();
    });
  }
  // The other faces show the card's name when they have none of their own.
  renameInput.addEventListener('input', () => {
    const usual = `${cleanName(renameInput.value) || player.name} (your usual name)`;
    (player.transforms || []).forEach((_, index) => { if (faceInput(index)) faceInput(index).placeholder = usual; });
  });
  $('pc-rename-form').addEventListener('submit', (event) => {
    event.preventDefault();
    let renamed = withName(player, renameInput.value);
    (renamed.transforms || []).forEach((_, index) => {
      if (faceInput(index)) renamed = withTransformName(renamed, index, faceInput(index).value);
    });
    player = renamed;
    save();
    renameDialog.close();
  });
  // Escape keeps the names too. Art chosen for a face is already kept.
  $('pc-rename-keep').addEventListener('click', () => renameDialog.close());

  /* ----- Starting points: a creature, then spells (player/start.js) ----- */
  const points = (n) => `${n} point${n === 1 ? '' : 's'}`;
  let startNote = ''; // why picking spells ended by itself, until the next booster

  function renderStart() {
    const spending = picksSpells(player);
    $('pc-start').hidden = !spending;
    if (spending) {
      $('pc-start-text').textContent = `You have ${points(player.start.points)} left. Pick spells of your creature's colors (${describeColors(player.start.colors)}).`;
    }
    $('pc-start-note').textContent = startNote;
    $('pc-start-note').hidden = !startNote;
  }

  /** The spells the player can still pick. auto: opened by itself after absorbing a card. */
  async function openSpellPick({ auto = false } = {}) {
    if (animating || !picksSpells(player)) return;
    showError('');
    let pool;
    try {
      pool = await withBusy('Gathering the spells\u2026', () => loadAbsorbable(SPELLS_POOL_URL));
    } catch {
      showError("Couldn't load the spells. Check your connection and try again.");
      return;
    }
    const cards = startSpells(pool, player);
    if (!cards.length) {
      // Nothing left the player could pick: the card is ready, and the rest of the points are lost.
      startNote = `No spell left that costs ${player.start.points === 1 ? '1 point' : `${player.start.points} points or less`} and is of your creature's colors. Your card is ready.`;
      player = withStartDone(player);
      save();
      render();
      return;
    }
    showPick(cards, {
      title: 'Choose a spell',
      all: true,
      mode: 'start',
      points: { left: true, rule: 'Each spell costs its mana value.' },
      note: auto ? 'You can close this and pick later, from under your card.' : 'You can close this and pick later.',
    });
  }
  $('pc-start-spell').addEventListener('click', () => openSpellPick());
  $('pc-start-done').addEventListener('click', () => {
    if (!picksSpells(player)) return;
    if (!confirm(`Finish with ${points(player.start.points)} left? The points you don't spend are lost.`)) return;
    player = withStartDone(player);
    save();
    render();
  });

  /* ----- Boosters and absorbing ----- */
  const boosterDialog = $('pc-booster');
  const confirmButton = $('pc-booster-confirm');
  const absorbablePools = new Map(); // pool URL -> the cards of that pool that can be absorbed so far
  let boosterCards = [];
  let boosterControls = null;
  let pickTitle = 'Booster'; // the dialog's title while picking
  let pickMode = 'booster';  // 'start' while spending the starting points, so absorbing costs points
  let pickMandatory = false; // the dialog can't be closed until a card is absorbed
  let picked = null;       // the card clicked in the booster
  let absorbing = null;    // the card being absorbed, on the second step

  async function loadAbsorbable(url) {
    if (!absorbablePools.has(url)) absorbablePools.set(url, (await loadPool(url)).filter(isAbsorbable));
    return absorbablePools.get(url);
  }

  /**
   * The cards of the open booster of that level, or a new one if none is open (or its
   * cards left the pool).
   */
  function currentBooster(pool, { level, kind }) {
    if (player.booster && player.booster.level === level) {
      const byId = new Map(pool.map((poolCard) => [poolCard.id, poolCard]));
      const cards = player.booster.cardIds.map((id) => byId.get(id));
      if (cards.length && cards.every(Boolean)) return cards;
    }
    const cards = makeBooster(levelBoosterPool(pool, player, kind));
    if (!cards.length) return cards; // nothing left to deal
    player = withBooster(player, cards.map((poolCard) => poolCard.id), level);
    save();
    return cards;
  }

  function showPickStep() {
    absorbing = null;
    $('pc-booster-pick').hidden = false;
    $('pc-absorb').hidden = true;
    $('pc-booster-title').textContent = pickTitle;
  }

  /**
   * While spending the starting points: how many the player would have left after
   * this card, for the Confirm button. A card with {X} costs more once X is picked.
   */
  function pointsAfter(boosterCard) {
    if (!spendsPoints()) return '';
    const left = player.start.points - cardPoints(boosterCard);
    return ` (${points(left)} left${textToAbsorb(boosterCard).chooseX ? ', before X' : ''})`;
  }

  function pickCard(boosterCard) {
    picked = boosterCard;
    boosterControls.setPicked(boosterCard);
    confirmButton.textContent = `Confirm ${boosterCard.name}${pointsAfter(boosterCard)}`;
    confirmButton.hidden = false;
    $('pc-booster-status').textContent = `${boosterCard.name} picked. Confirm it, or pick another card.`;
  }

  /**
   * Shows the cards to pick one from. all: every card of a pool, instead of a 3-card booster.
   * mode 'start' spends the starting points on the card picked.
   * mandatory: the player can't close it without absorbing a card (a new card's first pick).
   * points: { left, rule } shows the starting points the player has, big, above the cards.
   */
  function showPick(cards, { title, all, mode = 'booster', status = 'Pick one card to absorb.', note, mandatory = false, points: pointsLine }) {
    boosterCards = cards;
    pickTitle = title;
    pickMode = mode;
    pickMandatory = mandatory;
    $('pc-booster-close').hidden = mandatory;
    picked = null;
    confirmButton.hidden = true;
    $('pc-booster-status').textContent = status;
    // Its own line, so it stays while a card is picked (the status line changes then).
    const pointsEl = $('pc-booster-points');
    pointsEl.hidden = !pointsLine || !player.start;
    if (!pointsEl.hidden) {
      const count = player.start.points;
      pointsEl.replaceChildren(
        'You have ',
        el('span', 'booster-points__value', String(count)),
        ` point${count === 1 ? '' : 's'}${pointsLine.left ? ' left' : ''}. `,
        el('span', 'booster-points__rule', pointsLine.rule),
      );
    }
    $('pc-booster-cards').classList.toggle('booster--all', all);
    $('pc-booster-cards').setAttribute('aria-label', all ? 'Cards to pick from' : 'Booster');
    const noteText = mandatory ? '' : note || (all
      ? 'You can close this and pick later.'
      : "Closing keeps this booster open. You'll see the same cards when you come back.");
    $('pc-booster-note').textContent = noteText;
    $('pc-booster-note').hidden = !noteText;
    boosterControls = renderBooster($('pc-booster-cards'), boosterCards, pickCard);
    showPickStep();
    render();
    boosterDialog.showModal();
    boosterDialog.scrollTop = 0;
  }

  /** The booster the oldest level waiting earned: spells on even levels, creatures on odd ones. */
  async function openBooster() {
    const next = nextLevelBooster(player);
    if (animating || !next || player.start) return;
    showError('');
    let pool;
    try {
      pool = await withBusy('Opening your booster\u2026', () => loadAbsorbable(next.kind === 'spells' ? SPELLS_POOL_URL : FIRST_POOL_URL));
    } catch {
      showError("Couldn't load the card pool. Check your connection and try again.");
      return;
    }
    const cards = currentBooster(pool, next);
    startNote = '';
    if (!cards.length) {
      // Nothing left it could deal: that level's booster is used up.
      player = withLevelBoosterUsed(player);
      save();
      render();
      showError(next.kind === 'spells'
        ? `There's no spell left of your colors, so your level ${next.level} booster is empty.`
        : `You have absorbed every creature, so your level ${next.level} booster is empty.`);
      return;
    }
    showPick(cards, {
      title: `Level ${next.level} booster`,
      all: false,
      mode: 'level',
      status: `Pick one ${next.kind === 'spells' ? 'spell' : 'creature'} to absorb.`,
    });
  }

  /** A new card's first pick: every card of the first pool, not a booster. */
  async function openFirstPick() {
    if (animating) return;
    showError('');
    let pool;
    try {
      pool = await withBusy('Gathering the cards\u2026', () => loadAbsorbable(FIRST_POOL_URL));
    } catch {
      showError("Couldn't load the cards. Check your connection and try again.");
      return;
    }
    if (!player.start) {
      showPick(pool, { title: 'Choose your first card', all: true, mandatory: true });
      return;
    }
    showPick(affordableCreatures(pool, player), {
      title: 'Choose your first card',
      all: true,
      mode: 'start',
      points: { left: false, rule: 'Each card costs its mana value; what\u2019s left goes to spells.' },
      mandatory: true,
    });
  }
  // The first card from the sheet, the boosters levels earn from under the card.
  $('pc-open-booster').addEventListener('click', openFirstPick);
  $('pc-open-another').addEventListener('click', openBooster);

  $('pc-booster-close').addEventListener('click', () => {
    if (!pickMandatory) boosterDialog.close();
  });

  // The first card is mandatory: Escape doesn't close it, and if the browser closes it
  // anyway (Chrome lets a second Escape through), it opens again.
  boosterDialog.addEventListener('cancel', (event) => {
    if (pickMandatory) event.preventDefault();
  });
  boosterDialog.addEventListener('close', () => {
    if (pickMandatory && player && !(player.absorbed || []).length) boosterDialog.showModal();
  });

  /* Second step: show what changes, and ask for any stat the card doesn't print as a number. */
  function absorbChoices() {
    const power = $('pc-absorb-power');
    const toughness = $('pc-absorb-toughness');
    const x = $('pc-absorb-x');
    // X costs points too, so it can't go above what's left.
    const cap = spendsPoints() && absorbing ? maxX(absorbing, player.start.points) : Infinity;
    return {
      power: power ? power.value : undefined,
      toughness: toughness ? toughness.value : undefined,
      x: x ? Math.min(chosenX(x.value), cap) : undefined,
    };
  }

  /** The card being absorbed is paid with the starting points. */
  function spendsPoints() {
    return pickMode === 'start' && Boolean(player.start);
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
    if (spendsPoints()) {
      const left = player.start.points;
      $('pc-absorb-changes').append(changeRow('Points', String(left), String(left - cardPoints(absorbing, absorbChoices().x))));
    }
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
        ` \u2014 ${preview.bonusNote || 'You become a Sliver, so its bonus to Slivers is yours too.'} It\u2019s already in your power and toughness.`,
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
      // A face that keeps the front's text (Erayo) adds to it instead of replacing it.
      const how = back.keepFront ? 'you keep what this card gives you and also get' : 'you lose what this card gives you and get';
      const stats = back.power || back.toughness || !back.keepFront ? [`+${back.power || 0}/+${back.toughness || 0}`] : [];
      item.append(
        el('strong', null, `Transforms into ${back.name}`),
        ` \u2014 Your card can turn over. Transformed, ${how} ${[...stats, ...gains].join(', ')}. You can give that face its own name and art.`,
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
    return numberField(id, `${cardName}'s ${label} is ${raw}. How much ${label} does it add?`, renderChanges);
  }

  function numberField(id, text, onInput, min) {
    const field = el('div', 'field');
    const labelEl = el('label', null, text);
    labelEl.htmlFor = id;
    const input = el('input', 'input');
    Object.assign(input, { id, type: 'number', inputMode: 'numeric', step: '1', value: '0' });
    if (min !== undefined) input.min = String(min);
    input.addEventListener('input', onInput);
    field.append(labelEl, input);
    return field;
  }

  function showAbsorbStep(boosterCard) {
    absorbing = boosterCard;
    const preview = absorbPreview(player, boosterCard);
    $('pc-booster-title').textContent = `Absorb ${preview.name}`;

    const stats = [];
    if (preview.chooseX) {
      // X changes the cost and the text: show both again as it changes.
      stats.push(numberField('pc-absorb-x', `${preview.name} has X in its mana cost. Pick X: it's added to your mana cost as generic mana, and it's the X in its text.`, () => {
        showAbilities(absorbPreview(player, absorbing, absorbChoices()));
        renderChanges();
      }, 0));
      if (spendsPoints()) {
        const most = maxX(boosterCard, player.start.points);
        stats[0].querySelector('input').max = String(most);
        stats[0].append(el('p', 'note', `X costs points too: you can pick up to ${most}.`));
      }
    }
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
    const choices = absorbChoices();
    const paid = spendsPoints();
    const fromLevel = pickMode === 'level';
    player = absorbCard(player, creature, choices);
    if (paid) player = withStartPick(player, creature, choices.x);
    if (fromLevel) player = withLevelBoosterUsed(player);
    save();
    absorbing = null;
    picked = null;
    pickMandatory = false; // a card was absorbed: the dialog may close now
    boosterDialog.close();
    // From here the animation owns the card, so nothing draws the new values early.
    animating = true;

    // Each card absorbed is a chance to rename the player's card, and its other faces
    // (cards that transform). The card is already saved, so a reload now loses nothing.
    await askRename(absorbPreview(before, creature).name);

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
    // Making a new card: on to the spells, while there are points left.
    if (paid && picksSpells(player)) await openSpellPick({ auto: true });
    // Several levels at once: on to the next booster.
    else if (fromLevel && nextLevelBooster(player)) await openBooster();
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
