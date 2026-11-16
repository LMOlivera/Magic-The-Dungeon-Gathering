/**
 * The busy overlay (#busy): a grey veil with a spinner that blocks the page
 * while the browser works on something the player has to wait for.
 * It's a modal <dialog>, so it also covers other open dialogs.
 */

import { $ } from './dom.js';

let depth = 0;
let wired = false;

/**
 * Shows the overlay with a message while task() runs, and returns its result.
 * The overlay is removed when the task ends, also if it throws.
 */
export async function withBusy(message, task) {
  const dialog = $('busy');
  if (!wired) {
    // Escape must not dismiss it: the work is still running.
    dialog.addEventListener('cancel', (event) => event.preventDefault());
    wired = true;
  }
  $('busy-text').textContent = message;
  depth++;
  if (!dialog.open) dialog.showModal();
  try {
    return await task();
  } finally {
    depth--;
    if (depth === 0 && dialog.open) dialog.close();
  }
}
