/**
 * Builds a small card pool JSON from a deck list and Scryfall's "Oracle Cards" bulk file.
 *
 *   node scripts/build-pool.js <list.txt> <oracle-cards.jsonl> <out.json>
 *   node scripts/build-pool.js level1.txt oracle-cards-20261116100201.jsonl data/level1.json
 *
 * The list has one card per line: "1 Aegis Turtle (IKO) 39". Only the name is used
 * to find the card. The Oracle Cards file has one printing per card, so the image
 * can come from a different set than the one in the list.
 *
 * The bulk file is read line by line (it is over 200 MB) and never loaded whole.
 */

import { createReadStream } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const NOT_REAL_CARDS = new Set(['token', 'double_faced_token', 'emblem', 'art_series', 'vanguard', 'scheme', 'planar']);

/** "1 Cecil, Dark Knight / Cecil, Redeemed Paladin (FIN) 91" -> name, set, number */
export function parseListLine(line) {
  const match = line.trim().match(/^(\d+)\s+(.+?)\s+\(([^)]+)\)\s+(\S+)$/);
  if (!match) return null;
  return { count: Number(match[1]), name: match[2], set: match[3], number: match[4] };
}

/** Lists write two-part cards as "A / B"; Scryfall writes "A // B". */
export function nameKeys(name) {
  const full = name.replace(/\s+\/\/?\s+/g, ' // ').toLowerCase();
  return [full, full.split(' // ')[0]];
}

function pickImages(source) {
  const uris = source.image_uris;
  return uris ? { small: uris.small, normal: uris.normal, artCrop: uris.art_crop } : null;
}

function pickFace(face) {
  return {
    name: face.name,
    manaCost: face.mana_cost ?? '',
    typeLine: face.type_line ?? '',
    text: face.oracle_text ?? '',
    power: face.power ?? null,
    toughness: face.toughness ?? null,
    colors: face.colors ?? null,
    images: pickImages(face),
  };
}

/** Keeps only the fields the game uses. */
export function toPoolCard(card) {
  const faces = (card.card_faces ?? []).map(pickFace);
  return {
    id: card.id,
    name: card.name,
    layout: card.layout,
    manaCost: card.mana_cost ?? faces[0]?.manaCost ?? '',
    manaValue: card.cmc ?? 0,
    colors: card.colors ?? faces[0]?.colors ?? [],
    typeLine: card.type_line ?? '',
    text: card.oracle_text ?? '',
    power: card.power ?? faces[0]?.power ?? null,
    toughness: card.toughness ?? faces[0]?.toughness ?? null,
    keywords: card.keywords ?? [],
    artist: card.artist ?? faces[0]?.artist ?? '',
    // Cards with two printed sides keep their images on each face.
    images: pickImages(card) ?? faces[0]?.images ?? null,
    faces,
  };
}

async function main() {
  const [listPath, bulkPath, outPath] = process.argv.slice(2);
  if (!listPath || !bulkPath || !outPath) {
    console.error('Usage: node scripts/build-pool.js <list.txt> <oracle-cards.jsonl> <out.json>');
    process.exit(1);
  }

  const wanted = (await readFile(listPath, 'utf8')).split('\n').map(parseListLine).filter(Boolean);
  const byKey = new Map(); // name key -> list entry
  for (const entry of wanted) for (const key of nameKeys(entry.name)) if (!byKey.has(key)) byKey.set(key, entry);

  const found = new Map(); // list entry -> Scryfall card
  const lines = createInterface({ input: createReadStream(bulkPath), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.startsWith('{')) continue;
    // Cheap pre-check before parsing: most lines are not in the list.
    const nameMatch = line.match(/"name":"((?:[^"\\]|\\.)*)"/);
    if (!nameMatch) continue;
    const card = JSON.parse(line);
    if (NOT_REAL_CARDS.has(card.layout)) continue;
    const entry = nameKeys(card.name).map((key) => byKey.get(key)).find(Boolean);
    if (!entry) continue;
    // Prefer an exact name match over a front-face match.
    const exact = nameKeys(card.name)[0] === nameKeys(entry.name)[0];
    if (!found.has(entry) || exact) found.set(entry, card);
  }

  const missing = wanted.filter((entry) => !found.has(entry));
  const cards = wanted.filter((entry) => found.has(entry)).map((entry) => toPoolCard(found.get(entry)));
  const noImage = cards.filter((card) => !card.images?.normal);

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify({ source: 'Scryfall Oracle Cards', cards }, null, 1)}\n`);

  console.log(`${cards.length} of ${wanted.length} cards written to ${outPath}`);
  if (missing.length) console.log(`Not found: ${missing.map((entry) => entry.name).join('; ')}`);
  if (noImage.length) console.log(`No image: ${noImage.map((card) => card.name).join('; ')}`);
}

// Run only when called from the command line, not when imported by a test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
