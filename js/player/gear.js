/**
 * Cards absorbed that aren't creatures: Equipment, Auras and spells. Plain data,
 * no DOM: tests can import it. Rules in DESIGN.md, section 5.
 *
 *   Equipment  the player equips it on absorbing it and gets what it grants. It
 *              stays its own object, so something can destroy it, and then that's lost.
 *              player.equipment: [{ id, name, off }]
 *   Items      other artifacts and enchantments that aren't Auras (like Seal of Fire):
 *              kept with the Equipment, and gone once used.
 *   Auras      a permanent bonus: the player enchants themselves for good.
 *              player.auras: [{ id, name, off }]
 *   off        an Equipment or Aura with a `toggle` (rules/cards.js) can be taken off
 *              for the rest of the combat, like Blinding Powder ("Unattach") or Carapace;
 *              while off it grants nothing, and "Combat over" puts it back.
 *   Spells     join the spell list. Each can be cast once per combat; after that it's
 *              in the graveyard until combat is over.
 *              player.spells: [{ id, name, manaCost, typeLine, text, cast }]
 *
 * What an Equipment or an Aura grants is its `grants` entry in rules/cards.js, worked
 * out each time the card is drawn (so a bonus "for each of its colors" follows the colors).
 */

import { CARD_RULES } from '../rules/cards.js';
import { addKeywords } from '../rules/keywords.js';

/**
 * 'creature', 'equipment', 'aura', 'spell', 'item' (an artifact or enchantment that
 * isn't an Equipment or Aura) or 'other' (not absorbable yet), from the front face.
 */
export function kindOf(card) {
  const face = card.faces && card.faces.length ? card.faces[0] : card;
  const typeLine = String(face.typeLine || card.typeLine || '');
  const [types, subtypes = ''] = typeLine.split(' — ');
  if (/\bCreature\b/.test(types)) return 'creature';
  if (/\bEquipment\b/.test(subtypes)) return 'equipment';
  if (/\bAura\b/.test(subtypes)) return 'aura';
  if (/\b(Instant|Sorcery)\b/.test(types)) return 'spell';
  if (/\b(Artifact|Enchantment)\b/.test(types)) return 'item';
  return 'other';
}

/** What an Equipment or Aura grants (rules/cards.js), or null when nobody decided yet. */
export function grantsOf(name) {
  const rules = Object.hasOwn(CARD_RULES, name) ? CARD_RULES[name] : null;
  return rules && rules.grants ? rules.grants : null;
}

/**
 * What everything attached to the player adds to their card:
 * { power, toughness, keywords, abilities } to add on top of the rest.
 * colors are the player's colors (for bonuses "for each of its colors").
 */
export function attachedEffects(player, colors = player.colors || []) {
  const attached = [...(player.equipment || []), ...(player.auras || [])];
  const enchantments = (player.auras || []).length;
  let power = 0;
  let toughness = 0;
  let keywords = [];
  const abilities = [];
  for (const { name, off } of attached) {
    if (off) continue;
    const grants = grantsOf(name);
    if (!grants) continue;
    power += grants.power || 0;
    toughness += grants.toughness || 0;
    if (grants.perColor) {
      power += grants.perColor.power * colors.length;
      toughness += grants.perColor.toughness * colors.length;
    }
    if (grants.perEnchantment) {
      power += grants.perEnchantment.power * enchantments;
      toughness += grants.perEnchantment.toughness * enchantments;
    }
    keywords = addKeywords(keywords, grants.keywords || []);
    for (const ability of grants.abilities || []) if (!abilities.includes(ability)) abilities.push(ability);
  }
  return { power, toughness, keywords, abilities };
}

/** "+2/+2, vigilance": a short line about what one Equipment or Aura grants. */
export function describeGrants(name) {
  const grants = grantsOf(name);
  if (!grants) return '';
  const parts = [];
  if (grants.power || grants.toughness) parts.push(`+${grants.power || 0}/+${grants.toughness || 0}`);
  if (grants.perColor) parts.push(`+${grants.perColor.power}/+${grants.perColor.toughness} for each of your colors`);
  if (grants.perEnchantment) parts.push(`+${grants.perEnchantment.power}/+${grants.perEnchantment.toughness} for each of your Auras`);
  parts.push(...(grants.keywords || []).map((keyword) => keyword.toLowerCase()));
  if ((grants.abilities || []).length) parts.push(grants.abilities.length === 1 ? 'an ability' : `${grants.abilities.length} abilities`);
  return parts.join(', ');
}

/** An Equipment was destroyed (or sacrificed): it comes off and what it gave is lost. */
export function withoutEquipment(player, index) {
  return { ...player, equipment: (player.equipment || []).filter((_, i) => i !== index) };
}

/** An Equipment ('equipment') or Aura ('auras') taken off for the rest of the combat, or put back. */
export function withOff(player, list, index, off) {
  return { ...player, [list]: (player[list] || []).map((entry, i) => (i === index ? { ...entry, off: Boolean(off) } : entry)) };
}

/** Combat is over: everything taken off is put back on. */
export function putBackOn(player) {
  const on = (entry) => ({ ...entry, off: false });
  return { ...player, equipment: (player.equipment || []).map(on), auras: (player.auras || []).map(on) };
}

/** A spell was cast (it goes to the graveyard) or taken back. */
export function withSpellCast(player, index, cast) {
  return {
    ...player,
    spells: (player.spells || []).map((spell, i) => (i === index ? { ...spell, cast: Boolean(cast) } : spell)),
  };
}

/** Combat is over: every spell comes back from the graveyard. */
export function returnSpells(player) {
  return { ...player, spells: (player.spells || []).map((spell) => ({ ...spell, cast: false })) };
}
