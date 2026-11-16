/**
 * Image store: photos live in IndexedDB as Blobs, apart from the game state,
 * so they aren't rewritten on every change and don't hit localStorage's ~5 MB cap.
 * If IndexedDB is unavailable the images are kept in memory for the session
 * and imagesPersist() turns false so the view can warn the player.
 */

const DB_NAME = 'mtdg';
const STORE = 'images';

const memory = new Map();
let dbPromise = null;
let persistent = true;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      let request;
      try {
        request = indexedDB.open(DB_NAME, 1);
      } catch (error) {
        reject(error);
        return;
      }
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB is blocked'));
    });
  }
  return dbPromise;
}

async function run(mode, operation) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = operation(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Saves a Blob under a key. Returns true if it will survive a reload. */
export async function putImage(key, blob) {
  try {
    await run('readwrite', (store) => store.put(blob, key));
    memory.delete(key);
    return true;
  } catch {
    persistent = false;
    memory.set(key, blob);
    return false;
  }
}

/** Returns the Blob saved under a key, or null. */
export async function getImage(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    return (await run('readonly', (store) => store.get(key))) || null;
  } catch {
    persistent = false;
    return null;
  }
}

export async function deleteImage(key) {
  memory.delete(key);
  try {
    await run('readwrite', (store) => store.delete(key));
  } catch {
    /* nothing stored */
  }
}

/** False once a read or write has failed: photos are only in memory. */
export function imagesPersist() {
  return persistent;
}

/** Converts a data URL (how photos were saved before IndexedDB) to a Blob. */
export function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const type = (dataUrl.slice(0, comma).match(/^data:([^;,]+)/) || [])[1] || 'image/jpeg';
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}
