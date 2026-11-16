import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ZOOM_MAX, DEFAULT_CROP,
  scaleFor, clampCrop, panCrop, zoomCrop, imageBox, sourceRect,
} from '../js/player/crop.js';

const frame = { w: 400, h: 300 };
const wide = { w: 1600, h: 600 };  // wider than the frame
const tall = { w: 600, h: 1200 };  // taller than the frame

const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ''} ${actual} != ${expected}`);

test('at zoom 1 the photo just covers the frame', () => {
  assert.equal(scaleFor(DEFAULT_CROP, frame, wide), 0.5);  // limited by height
  assert.equal(scaleFor(DEFAULT_CROP, frame, tall), 400 / 600); // limited by width
  const box = imageBox(DEFAULT_CROP, frame, wide);
  assert.deepEqual(box, { width: 800, height: 300, x: -200, y: 0 });
});

test('the default crop takes the centered part of the photo', () => {
  assert.deepEqual(sourceRect(DEFAULT_CROP, frame, wide), { x: 400, y: 0, w: 800, h: 600 });
});

test('the crop always has the shape of the frame', () => {
  const crop = clampCrop({ zoom: 2.3, cx: 0.2, cy: 0.9 }, frame, tall);
  const rect = sourceRect(crop, frame, tall);
  near(rect.w / rect.h, frame.w / frame.h);
});

test('clampCrop keeps the photo covering the frame and zoom in range', () => {
  for (const image of [wide, tall]) {
    for (const input of [{ zoom: 1, cx: -3, cy: 9 }, { zoom: 99, cx: 1, cy: 0 }, { zoom: 0.1, cx: 0.5, cy: 0.5 }]) {
      const crop = clampCrop(input, frame, image);
      assert.ok(crop.zoom >= 1 && crop.zoom <= ZOOM_MAX);
      const rect = sourceRect(crop, frame, image);
      assert.ok(rect.x >= -1e-9 && rect.y >= -1e-9, 'starts inside the photo');
      assert.ok(rect.x + rect.w <= image.w + 1e-9 && rect.y + rect.h <= image.h + 1e-9, 'ends inside the photo');
    }
  }
});

test('panning moves the photo with the pointer and stops at the edges', () => {
  const moved = panCrop(DEFAULT_CROP, frame, wide, 100, 0); // drag right by 100 screen px
  near(imageBox(moved, frame, wide).x, -100);
  const stuck = panCrop(DEFAULT_CROP, frame, wide, 5000, 0);
  near(imageBox(stuck, frame, wide).x, 0);
  // No room to move vertically at zoom 1.
  near(panCrop(DEFAULT_CROP, frame, wide, 0, 50).cy, 0.5);
});

test('zooming keeps the point under the pointer in place', () => {
  const px = 300, py = 100;
  const start = { zoom: 1.5, cx: 0.5, cy: 0.5 };
  const pointOnPhoto = (crop) => {
    const box = imageBox(crop, frame, wide);
    const scale = scaleFor(crop, frame, wide);
    return { x: (px - box.x) / scale, y: (py - box.y) / scale };
  };
  const before = pointOnPhoto(start);
  const after = pointOnPhoto(zoomCrop(start, frame, wide, 3, px, py));
  near(after.x, before.x);
  near(after.y, before.y);
});

test('zooming without a point zooms on the center, within limits', () => {
  const zoomed = zoomCrop(DEFAULT_CROP, frame, wide, 2);
  assert.deepEqual(zoomed, { zoom: 2, cx: 0.5, cy: 0.5 });
  assert.equal(zoomCrop(DEFAULT_CROP, frame, wide, 50).zoom, ZOOM_MAX);
  assert.equal(zoomCrop(DEFAULT_CROP, frame, wide, 0).zoom, 1);
});

test('a crop saved as fractions gives the same cut at any frame size', () => {
  const crop = { zoom: 2, cx: 0.3, cy: 0.5 };
  const small = sourceRect(crop, frame, wide);
  const big = sourceRect(crop, { w: 800, h: 600 }, wide);
  for (const key of ['x', 'y', 'w', 'h']) near(big[key], small[key], key);
});
