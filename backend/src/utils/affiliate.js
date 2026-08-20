// Everything store-specific lives here: which stores exist, how to recognise one from a
// URL, and how to stamp your affiliate ID onto an outgoing link.
const { all, get, run } = require('../config/db');

const STORES = {
  amazon: {
    key: 'amazon',
    label: 'Amazon',
    color: '#ff9900',
    // Amazon Associates: https://affiliate-program.amazon.in
    tagParam: 'tag',
    subIdParam: 'ascsubtag',
    settingKey: 'amazon_tag',
    envKey: 'AMAZON_TAG',
    domains: ['amazon.in', 'amazon.com', 'amzn.to', 'amzn.in'],
  },
  flipkart: {
    key: 'flipkart',
    label: 'Flipkart',
    color: '#2874f0',
    // Flipkart Affiliate / EarnKaro: https://affiliate.flipkart.com
    tagParam: 'affid',
    subIdParam: 'affExtParam1',
    settingKey: 'flipkart_affid',
    envKey: 'FLIPKART_AFFID',
    domains: ['flipkart.com', 'fkrt.it', 'fkrt.cc', 'dl.flipkart.com'],
  },
  meesho: {
    key: 'meesho',
    label: 'Meesho',
    color: '#f43397',
    // Meesho has no open affiliate API — links come from your partner dashboard or
    // from a free network like EarnKaro, so we only add UTM attribution.
    tagParam: 'utm_source',
    subIdParam: 'utm_content',
    settingKey: 'meesho_tag',
    envKey: 'MEESHO_TAG',
    domains: ['meesho.com', 'meesho.in'],
  },
};

const STORE_KEYS = Object.keys(STORES);

// Free Indian affiliate networks that accept sign-ups without a registered company.
// Their shortened links are legitimate destinations, so they are allowed too.
const NETWORK_DOMAINS = [
  'earnkaro.com', 'ekaro.in',        // EarnKaro
  'inrdeals.com', 'ind.deals',       // INRDeals
  'linksredirect.com',               // Cuelinks
  'bitli.in',                        // BitLi
  'wishlink.com',
  'extp.in',
  'clnk.in',
];

const ALLOWED_HOSTS = [...STORE_KEYS.flatMap((k) => STORES[k].domains), ...NETWORK_DOMAINS];

const hostMatches = (host, domain) => host === domain || host.endsWith(`.${domain}`);

/**
 * Parses a URL and rejects anything that is not an http(s) link to a store or a known
 * affiliate network. This is what stops /go/:id from becoming an open redirect.
 */
function validateAffiliateUrl(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl).trim());
  } catch {
    return { ok: false, error: 'Affiliate link is not a valid URL' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'Affiliate link must start with http:// or https://' };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!ALLOWED_HOSTS.some((domain) => hostMatches(host, domain))) {
    return {
      ok: false,
      error: `Links from "${host}" are not allowed. Use an Amazon / Flipkart / Meesho link, or one from EarnKaro, INRDeals or Cuelinks.`,
    };
  }

  return { ok: true, url, host };
}

/** Guesses the store from the link so the admin form can auto-fill it. */
function detectStore(rawUrl) {
  const parsed = validateAffiliateUrl(rawUrl);
  if (!parsed.ok) return null;
  return (
    STORE_KEYS.find((key) => STORES[key].domains.some((d) => hostMatches(parsed.host, d))) || null
  );
}

/** Affiliate IDs come from the settings table, falling back to .env. */
async function getAffiliateIds() {
  const rows = await all('SELECT key, value FROM settings');
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const ids = {};
  for (const key of STORE_KEYS) {
    const config = STORES[key];
    ids[key] = (stored[config.settingKey] || process.env[config.envKey] || '').trim();
  }
  return ids;
}

async function setSetting(key, value) {
  await run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    key,
    String(value ?? '')
  );
}

async function getSetting(key, fallback = '') {
  const row = await get('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? fallback;
}

/**
 * Adds your affiliate ID + a per-deal sub-ID to a link, without ever overwriting an ID
 * that is already in the URL (links copied out of an affiliate dashboard keep working).
 */
async function withAffiliateTag(rawUrl, store, dealId) {
  const config = STORES[store];
  const parsed = validateAffiliateUrl(rawUrl);
  if (!config || !parsed.ok) return rawUrl;

  const { url, host } = parsed;

  // Network shortlinks (EarnKaro etc.) already carry the tracking — leave them alone.
  const isStoreLink = config.domains.some((d) => hostMatches(host, d));
  if (!isStoreLink) return url.toString();

  const affiliateId = (await getAffiliateIds())[store];
  if (affiliateId && !url.searchParams.has(config.tagParam)) {
    url.searchParams.set(config.tagParam, affiliateId);
  }
  if (dealId && !url.searchParams.has(config.subIdParam)) {
    url.searchParams.set(config.subIdParam, `deal-${dealId}`);
  }
  if (store === 'meesho' && affiliateId && !url.searchParams.has('utm_medium')) {
    url.searchParams.set('utm_medium', 'affiliate');
  }

  return url.toString();
}

/** Public store list for the frontend (labels + brand colours). */
function publicStores() {
  return STORE_KEYS.map((key) => ({
    key,
    label: STORES[key].label,
    color: STORES[key].color,
  }));
}

module.exports = {
  STORES,
  STORE_KEYS,
  ALLOWED_HOSTS,
  validateAffiliateUrl,
  detectStore,
  getAffiliateIds,
  getSetting,
  setSetting,
  withAffiliateTag,
  publicStores,
};
