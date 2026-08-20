const { get } = require('../config/db');

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    .replace(/^-|-$/g, '');
}

/**
 * Builds a slug that is unique in the deals table. `ignoreId` lets an edit keep its own slug.
 */
async function uniqueSlug(title, ignoreId = null) {
  const base = slugify(title) || 'deal';
  let candidate = base;
  let n = 2;

  // eslint-disable-next-line no-await-in-loop -- collisions are rare, so this loops once
  while (await slugTaken(candidate, ignoreId)) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}

async function slugTaken(slug, ignoreId) {
  const row = ignoreId
    ? await get('SELECT id FROM deals WHERE slug = ? AND id <> ?', slug, ignoreId)
    : await get('SELECT id FROM deals WHERE slug = ?', slug);
  return Boolean(row);
}

module.exports = { slugify, uniqueSlug };
