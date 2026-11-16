/**
 * Tooltips for any element with data-tip (and an optional data-tip-title).
 * Shown on mouse hover and on keyboard focus, and toggled by a tap, because
 * phones can't hover. One bubble for the whole page, styled in css/base.css.
 *
 * Call initTooltips() once. Elements can come and go afterwards: the listeners
 * are on the document.
 */

import { el } from './dom.js';

const GAP_PX = 8;     // between the bubble and its element
const MARGIN_PX = 8;  // between the bubble and the edge of the screen

let bubble = null;
let current = null;       // the element whose tip is showing
let lastPointer = 'mouse';
// A popover sits in the top layer, so the bubble also shows over an open dialog.
const usePopover = typeof HTMLElement !== 'undefined' && Object.hasOwn(HTMLElement.prototype, 'popover');

function place(target) {
  const anchor = target.getBoundingClientRect();
  const box = bubble.getBoundingClientRect();
  const left = Math.max(MARGIN_PX, Math.min(anchor.left + anchor.width / 2 - box.width / 2, innerWidth - box.width - MARGIN_PX));
  let top = anchor.top - box.height - GAP_PX;
  if (top < MARGIN_PX) top = anchor.bottom + GAP_PX; // no room above: below
  bubble.style.left = `${left}px`;
  bubble.style.top = `${top}px`;
}

function show(target) {
  if (current === target) return;
  hide();
  current = target;
  bubble.replaceChildren();
  if (target.dataset.tipTitle) bubble.append(el('strong', null, target.dataset.tipTitle));
  bubble.append(el('span', null, target.dataset.tip));
  if (usePopover) bubble.showPopover();
  else bubble.hidden = false;
  target.setAttribute('aria-describedby', bubble.id);
  place(target);
}

function hide() {
  if (!current) return;
  current.removeAttribute('aria-describedby');
  current = null;
  if (usePopover) {
    if (bubble.matches(':popover-open')) bubble.hidePopover();
  } else {
    bubble.hidden = true;
  }
}

const tipOf = (node) => (node instanceof Element ? node.closest('[data-tip]') : null);

export function initTooltips() {
  if (bubble) return;
  bubble = el('div', 'tooltip');
  bubble.id = 'tooltip';
  bubble.setAttribute('role', 'tooltip');
  if (usePopover) bubble.popover = 'manual';
  else bubble.hidden = true;
  document.body.append(bubble);

  document.addEventListener('pointerdown', (event) => { lastPointer = event.pointerType || 'mouse'; }, true);

  document.addEventListener('pointerover', (event) => {
    const target = tipOf(event.target);
    if (target && event.pointerType === 'mouse') show(target);
  });
  document.addEventListener('pointerout', (event) => {
    if (event.pointerType !== 'mouse' || !current) return;
    if (tipOf(event.target) === current && tipOf(event.relatedTarget) !== current) hide();
  });

  // A tap shows the tip, a second tap on it or a tap anywhere else hides it.
  // A mouse click leaves it as hovering showed it.
  document.addEventListener('click', (event) => {
    const target = tipOf(event.target);
    if (!target) hide();
    else if (lastPointer === 'mouse') show(target);
    else if (current === target) hide();
    else show(target);
  });

  // Keyboard focus only: a tap focuses the button too, and the click above handles that.
  document.addEventListener('focusin', (event) => {
    const target = tipOf(event.target);
    if (target && target.matches(':focus-visible')) show(target);
  });
  document.addEventListener('focusout', (event) => {
    if (current && tipOf(event.target) === current) hide();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });
  // The bubble doesn't follow its element, so it goes away when the page moves.
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
}
