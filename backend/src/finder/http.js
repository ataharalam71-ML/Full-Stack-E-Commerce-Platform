// One place for every outbound request the finder makes.
//
// The stores serve ordinary browsers and block obvious bots, so requests carry the headers
// a browser sends and nothing more — there is no proxy rotation and no CAPTCHA solving
// here. When a store does decide to block us, that is reported plainly rather than worked
// around: `blocked` comes back true and the admin panel says so.
//
// It is also deliberately unhurried: results are cached, pages are size-capped, and the
// same store is never hit twice in quick succession.

const CACHE_TTL_MS = Number(process.env.FINDER_CACHE_TTL_MS || 10 * 60 * 1000);
const MAX_BYTES = Number(process.env.FINDER_MAX_BYTES || 4 * 1024 * 1024);
const TIMEOUT_MS = Number(process.env.FINDER_TIMEOUT_MS || 20000);
const MIN_GAP_MS = Number(process.env.FINDER_MIN_GAP_MS || 700);

// A bot-check interstitial is tiny; a real search page is hundreds of KB.
const BLOCK_PAGE_MAX_BYTES = 60 * 1024;

// Chrome on Windows. A blank or scripted-looking User-Agent gets a block immediately.
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-IN,en-GB;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  'Upgrade-Insecure-Requests': '1',
};

const cache = new Map(); // url -> { at, value }
const lastHit = new Map(); // hostname -> timestamp

/** Phrases the stores use on an interstitial instead of the page we asked for. */
const BLOCK_SIGNS = [
  'enter the characters you see below',
  'type the characters you see in this image',
  'to discuss automated access',
  'are you a human',
  'robot check',
  'access denied',
  'request blocked',
  'unusual traffic',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.at > CACHE_TTL_MS) cache.delete(key);
  }
}

/** Being polite to one host at a time, so a multi-store search does not hammer anyone. */
async function throttle(hostname) {
  const previous = lastHit.get(hostname) || 0;
  const wait = MIN_GAP_MS - (Date.now() - previous);
  if (wait > 0) await sleep(wait);
  lastHit.set(hostname, Date.now());
}

/**
 * Fetches a page and returns { ok, html, status, blocked, error }.
 *
 * It never throws for an HTTP-level problem — a store being unavailable is an expected
 * outcome the UI has to explain, not an exception.
 */
async function getHtml(url) {
  pruneCache();
  const cached = cache.get(url);
  if (cached) return { ...cached.value, cached: true };

  const { hostname } = new URL(url);
  await throttle(hostname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let result;
  try {
    const response = await fetch(url, {
      headers: HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    });

    // A 503 with a body is Amazon's bot wall; 403 and 429 are the other stores'. All are
    // deliberate blocks rather than outages.
    const blockedStatus = response.status === 403 || response.status === 503 || response.status === 429;
    const body = await readCapped(response);

    // A block page is an interstitial: a couple of KB and nothing else. Phrases like
    // "access denied" also appear harmlessly inside the scripts of a real 1 MB search
    // page, so the size check is what stops a good page being thrown away.
    const looksBlocked =
      body.length < BLOCK_PAGE_MAX_BYTES &&
      BLOCK_SIGNS.some((sign) => body.toLowerCase().includes(sign));

    result = {
      ok: response.ok && !looksBlocked,
      status: response.status,
      html: body,
      blocked: blockedStatus || looksBlocked,
      error: null,
    };

    if (!response.ok && !blockedStatus) {
      result.error = `The store returned HTTP ${response.status}.`;
    } else if (looksBlocked || blockedStatus) {
      result.error = 'The store served a bot check instead of the page.';
    }
  } catch (err) {
    result = {
      ok: false,
      status: 0,
      html: '',
      blocked: false,
      error:
        err.name === 'AbortError'
          ? `The store did not respond within ${Math.round(TIMEOUT_MS / 1000)} seconds.`
          : `Could not reach the store: ${err.message}`,
    };
  } finally {
    clearTimeout(timer);
  }

  // Only successes are cached: a block should be retried, not remembered.
  if (result.ok) cache.set(url, { at: Date.now(), value: result });
  return result;
}

/** Stops a surprise multi-megabyte response from becoming a memory problem. */
async function readCapped(response) {
  const reader = response.body?.getReader?.();
  if (!reader) return (await response.text()).slice(0, MAX_BYTES);

  const decoder = new TextDecoder('utf-8');
  let text = '';
  let size = 0;

  for (;;) {
    // eslint-disable-next-line no-await-in-loop -- streaming is sequential
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    text += decoder.decode(value, { stream: true });
    if (size >= MAX_BYTES) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  return text;
}

module.exports = { getHtml, cacheSize: () => cache.size };
