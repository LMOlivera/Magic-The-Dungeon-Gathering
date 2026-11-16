/**
 * Turns whatever the player gives us (a file, a camera frame) into a JPEG Blob
 * small enough to keep in the browser.
 */

const SOURCE_MAX_SIDE = 1280; // the original photo, kept so the crop can be redone
const JPEG_QUALITY = 0.85;

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image'))), 'image/jpeg', JPEG_QUALITY);
  });
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the image'));
    img.src = url;
  });
}

function scaledCanvas(source, width, height, mirror) {
  const scale = Math.min(1, SOURCE_MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** An uploaded file, shrunk. Rejects if the file can't be read as an image. */
export async function fileToSource(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return await canvasToBlob(scaledCanvas(img, img.naturalWidth, img.naturalHeight, false));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The current frame of a playing <video>. mirror matches a selfie preview. */
export function videoFrameToSource(video, mirror) {
  return canvasToBlob(scaledCanvas(video, video.videoWidth, video.videoHeight, mirror));
}
