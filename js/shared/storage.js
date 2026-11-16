/**
 * localStorage wrappers that never throw. Browsers can block storage
 * (private windows, site settings), so every call is guarded.
 * Photos don't go here: see images.js.
 */

export function storageWorks() {
  try {
    localStorage.setItem('mtdg.test', '1');
    localStorage.removeItem('mtdg.test');
    return true;
  } catch {
    return false;
  }
}

/** Returns the parsed value, or null if the key is missing or unreadable. */
export function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Returns true if the value was saved. */
export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to remove */
  }
}
