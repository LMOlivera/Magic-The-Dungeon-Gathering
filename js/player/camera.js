/**
 * The live camera dialog (#pc-camera). Needs a secure context: https or localhost.
 * Where the live camera can't be used, the caller falls back to a file input with
 * `capture`, which opens the camera app on phones and a file picker on desktops.
 */

import { $ } from '../shared/dom.js';
import { withBusy } from '../shared/busy.js';
import { videoFrameToSource } from './photo.js';

/**
 * onPhoto(blob)  the player took a photo
 * onUseFile()    the camera failed and the player asked to choose a file instead
 */
export function createCamera({ onPhoto, onUseFile }) {
  const dialog = $('pc-camera');
  const video = $('pc-video');
  const status = $('pc-camera-status');
  const snapButton = $('pc-snap');
  const flipButton = $('pc-flip');
  const fallbackButton = $('pc-camera-fallback');

  let stream = null;
  let facing = 'user';

  function setStatus(message) {
    status.textContent = message || '';
    status.hidden = !message;
  }

  function stop() {
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
    snapButton.disabled = true;
  }

  async function start() {
    stop();
    fallbackButton.hidden = true;
    setStatus('Starting camera…');
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      if (!dialog.open) {
        // Closed while the permission prompt was up.
        next.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = next;
      video.srcObject = next;
      video.classList.toggle('mirror', facing === 'user');
      setStatus('');
      snapButton.disabled = false;
      const devices = await navigator.mediaDevices.enumerateDevices();
      flipButton.hidden = devices.filter((device) => device.kind === 'videoinput').length < 2;
    } catch (error) {
      const blocked = error && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      setStatus(blocked
        ? 'Camera access was blocked. You can allow it in the browser settings, or choose a photo instead.'
        : "Couldn't find a camera on this device.");
      fallbackButton.hidden = false;
    }
  }

  snapButton.addEventListener('click', async () => {
    if (!stream || !video.videoWidth) return;
    try {
      const photo = await withBusy('Reading your photo…', () => videoFrameToSource(video, facing === 'user'));
      dialog.close();
      onPhoto(photo);
    } catch {
      setStatus("Couldn't take the photo. Try again.");
    }
  });
  flipButton.addEventListener('click', () => {
    facing = facing === 'user' ? 'environment' : 'user';
    start();
  });
  fallbackButton.addEventListener('click', () => {
    dialog.close();
    onUseFile();
  });
  $('pc-camera-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', stop);

  return {
    /** Opens the live camera. Returns false if this browser or page can't use it. */
    open() {
      const supported = window.isSecureContext
        && navigator.mediaDevices
        && typeof navigator.mediaDevices.getUserMedia === 'function'
        && typeof dialog.showModal === 'function';
      if (!supported) return false;
      dialog.showModal();
      start();
      return true;
    },
  };
}
