/**
 * The math behind the art editor. Pure functions, no DOM.
 *
 * A crop is { zoom, cx, cy }:
 *   zoom    1 means the photo just covers the frame; up to ZOOM_MAX
 *   cx, cy  the point of the photo at the center of the frame, as fractions (0..1)
 *           of the photo's width and height
 * Keeping it in fractions makes the crop independent of how big the frame is on screen.
 *
 * frame and image are sizes: { w, h }.
 */

export const ZOOM_MAX = 4;
export const DEFAULT_CROP = Object.freeze({ zoom: 1, cx: 0.5, cy: 0.5 });

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Screen pixels per photo pixel. */
export function scaleFor(crop, frame, image) {
  return Math.max(frame.w / image.w, frame.h / image.h) * crop.zoom;
}

/** Keeps zoom in range and the photo covering the whole frame. */
export function clampCrop(crop, frame, image) {
  const zoom = clamp(crop.zoom, 1, ZOOM_MAX);
  const scale = scaleFor({ zoom }, frame, image);
  const halfW = frame.w / 2 / scale;
  const halfH = frame.h / 2 / scale;
  return {
    zoom,
    cx: clamp(crop.cx * image.w, halfW, image.w - halfW) / image.w,
    cy: clamp(crop.cy * image.h, halfH, image.h - halfH) / image.h,
  };
}

/** Moves the photo by (dx, dy) screen pixels. */
export function panCrop(crop, frame, image, dx, dy) {
  const scale = scaleFor(crop, frame, image);
  return clampCrop(
    { zoom: crop.zoom, cx: crop.cx - dx / (image.w * scale), cy: crop.cy - dy / (image.h * scale) },
    frame,
    image,
  );
}

/** Changes zoom while keeping the photo point under (px, py) in place. Defaults to the frame center. */
export function zoomCrop(crop, frame, image, zoom, px = frame.w / 2, py = frame.h / 2) {
  const before = scaleFor(crop, frame, image);
  const ix = crop.cx * image.w + (px - frame.w / 2) / before;
  const iy = crop.cy * image.h + (py - frame.h / 2) / before;
  const next = clamp(zoom, 1, ZOOM_MAX);
  const after = scaleFor({ zoom: next }, frame, image);
  return clampCrop(
    {
      zoom: next,
      cx: (ix - (px - frame.w / 2) / after) / image.w,
      cy: (iy - (py - frame.h / 2) / after) / image.h,
    },
    frame,
    image,
  );
}

/** Where to draw the photo inside the frame, in screen pixels. */
export function imageBox(crop, frame, image) {
  const scale = scaleFor(crop, frame, image);
  return {
    width: image.w * scale,
    height: image.h * scale,
    x: frame.w / 2 - crop.cx * image.w * scale,
    y: frame.h / 2 - crop.cy * image.h * scale,
  };
}

/** The part of the photo that is visible in the frame, in photo pixels. */
export function sourceRect(crop, frame, image) {
  const scale = scaleFor(crop, frame, image);
  const w = frame.w / scale;
  const h = frame.h / scale;
  return { x: crop.cx * image.w - w / 2, y: crop.cy * image.h - h / 2, w, h };
}
