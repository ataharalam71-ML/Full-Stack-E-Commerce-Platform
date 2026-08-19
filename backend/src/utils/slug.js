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
function uniqueSlug(title, ignoreId = null) {
  const base = slugify(title) || 'deal';
  let candidate = base;
  let n = 2;

  while (get('SELECT id FROM deals WHERE slug = ? AND id IS NOT ?', candidate, ignoreId)) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}

module.exports = { slugify, uniqueSlug };
