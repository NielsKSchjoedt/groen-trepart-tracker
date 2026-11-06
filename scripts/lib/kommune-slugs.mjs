/**
 * Mirror of src/lib/kommune-slugs.ts for Node build scripts.
 * Keep in sync when slug rules change.
 */

const CHAR_MAP = {
  æ: 'ae', ø: 'oe', å: 'aa',
  Æ: 'ae', Ø: 'oe', Å: 'aa',
};

/** @param {string} navn */
export function kommuneToSlug(navn) {
  return navn
    .split('')
    .map((c) => CHAR_MAP[c] ?? c)
    .join('')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}
