/**
 * The art editor dialog (#pc-editor): move, zoom and crop a photo to the shape
 * of the card's art box. The math lives in crop.js; this file is the DOM around it.
 */

import { $ } from '../shared/dom.js';
import { DEFAULT_CROP, clampCrop, panCrop, zoomCrop, imageBox, sourceRect } from './crop.js';

const ART_WIDTH = 600; // pixel width of the cropped art saved for the card

export function createArtEditor() {
  const dialog = $('pc-editor');
  const frame = $('pc-editor-frame');
  const img = $('pc-editor-img');
  const zoomInput = $('pc-zoom');

  let crop = { ...DEFAULT_CROP };
  let ready = false;    // the photo has loaded and can be measured
  let session = null;   // { resolve, reject, url } while the dialog is open
  const pointers = new Map();
  let pinch = null;

  const frameSize = () => ({ w: frame.clientWidth, h: frame.clientHeight });
  const imageSize = () => ({ w: img.naturalWidth, h: img.naturalHeight });

  function apply(next) {
    if (!ready) return;
    crop = clampCrop(next, frameSize(), imageSize());
    const box = imageBox(crop, frameSize(), imageSize());
    img.style.width = `${box.width}px`;
    img.style.height = `${box.height}px`;
    img.style.transform = `translate(${box.x}px, ${box.y}px)`;
    zoomInput.value = crop.zoom;
  }
  const pan = (dx, dy) => ready && apply(panCrop(crop, frameSize(), imageSize(), dx, dy));
  const zoom = (value, px, py) => ready && apply(zoomCrop(crop, frameSize(), imageSize(), value, px, py));

  /** Ends the session. settle receives it and resolves or rejects the promise. */
  function finish(settle) {
    const current = session;
    session = null;
    ready = false;
    pointers.clear();
    pinch = null;
    frame.classList.remove('is-dragging');
    if (dialog.open) dialog.close();
    if (!current) return;
    img.onload = img.onerror = null;
    img.removeAttribute('src');
    URL.revokeObjectURL(current.url);
    settle(current);
  }

  /* ----- Pointer, wheel and keyboard ----- */
  function framePoint(event) {
    const rect = frame.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function pinchState() {
    const [a, b] = [...pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  frame.addEventListener('pointerdown', (event) => {
    frame.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, framePoint(event));
    frame.classList.add('is-dragging');
    pinch = pointers.size === 2 ? pinchState() : null;
  });
  frame.addEventListener('pointermove', (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const point = framePoint(event);
    pointers.set(event.pointerId, point);
    if (pinch && pointers.size === 2) {
      const now = pinchState();
      pan(now.x - pinch.x, now.y - pinch.y);
      if (pinch.dist > 0) zoom(crop.zoom * now.dist / pinch.dist, now.x, now.y);
      pinch = now;
    } else if (pointers.size === 1) {
      pan(point.x - previous.x, point.y - previous.y);
    }
  });
  function endPointer(event) {
    pointers.delete(event.pointerId);
    pinch = pointers.size === 2 ? pinchState() : null;
    if (!pointers.size) frame.classList.remove('is-dragging');
  }
  frame.addEventListener('pointerup', endPointer);
  frame.addEventListener('pointercancel', endPointer);

  frame.addEventListener('wheel', (event) => {
    event.preventDefault();
    const point = framePoint(event);
    zoom(crop.zoom * Math.exp(-event.deltaY * 0.0015), point.x, point.y);
  }, { passive: false });

  frame.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 40 : 10;
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[event.key]) {
      event.preventDefault();
      pan(...moves[event.key]);
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoom(crop.zoom * 1.1);
    } else if (event.key === '-') {
      event.preventDefault();
      zoom(crop.zoom / 1.1);
    }
  });

  /* ----- Controls ----- */
  zoomInput.addEventListener('input', () => zoom(parseFloat(zoomInput.value)));
  $('pc-editor-reset').addEventListener('click', () => apply({ ...DEFAULT_CROP }));
  $('pc-editor-cancel').addEventListener('click', () => finish((s) => s.resolve(null)));
  // Escape or the browser closed the dialog. The event arrives late, so if the
  // dialog is open again it belongs to an earlier session and must not end this one.
  dialog.addEventListener('close', () => {
    if (!dialog.open) finish((s) => s.resolve(null));
  });
  window.addEventListener('resize', () => apply(crop));

  // Drawing the crop is instant, so the dialog closes on the click. Encoding and
  // storing it is the slow part, and the caller does that behind a busy overlay.
  $('pc-editor-save').addEventListener('click', () => {
    if (!ready || !session) return;
    const size = frameSize();
    const rect = sourceRect(crop, size, imageSize());
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.min(ART_WIDTH, Math.round(rect.w)));
    canvas.height = Math.max(1, Math.round(canvas.width * size.h / size.w));
    canvas.getContext('2d').drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, canvas.width, canvas.height);
    const result = { canvas, crop: { ...crop } };
    finish((s) => s.resolve(result));
  });

  return {
    /**
     * Opens the editor on a photo.
     *   source  Blob, the uncropped photo
     *   crop    a previous crop to start from, or null
     *   ratio   width / height of the card's art box
     * Resolves to { canvas, crop } when the player saves (canvas holds the cropped
     * art, not yet encoded), or null if they cancel.
     * Rejects if the photo can't be opened.
     */
    edit(source, initialCrop, ratio) {
      if (session) finish((s) => s.resolve(null));
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(source);
        session = { resolve, reject, url };
        crop = { ...(initialCrop || DEFAULT_CROP) };
        frame.style.aspectRatio = String(ratio);
        img.style.width = img.style.height = '0';
        img.onload = () => {
          ready = true;
          requestAnimationFrame(() => apply(crop));
        };
        img.onerror = () => finish((s) => s.reject(new Error('Could not open the photo')));
        img.src = url;
        dialog.showModal();
        frame.focus();
      });
    },
  };
}
