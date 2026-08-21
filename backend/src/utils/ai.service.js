// The "AI finder": given a search term ("t shirt") it goes and finds real products on
// Amazon / Flipkart / Meesho and hands back deal drafts for the admin to approve.
//
// Two things keep this from being a hallucination machine:
//   1. Whichever provider is used, the model gets a web search restricted to the store
//      domains, so every link it proposes is one it actually saw in a search result.
//   2. Nothing it returns is written to the database. suggest() is read-only — the admin
//      approves each card, and the approved ones go through the same /deals/bulk
//      validation that hand-typed deals already go through.
//
// Two providers are supported. Groq is free and is preferred when both keys are present;
// set AI_PROVIDER to pin one explicitly.
const groq = require('./ai/groq');
const anthropic = require('./ai/anthropic');
const { MAX_SUGGESTIONS } = require('./ai/shared');

// Order matters: the free provider is tried first.
const PROVIDERS = [groq, anthropic];

/**
 * Picks the provider to use. An explicit AI_PROVIDER wins even if its key is missing, so
 * a typo in the dashboard produces a clear "add this key" message rather than silently
 * billing the other provider.
 */
function activeProvider() {
  const pinned = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (pinned) return PROVIDERS.find((p) => p.key === pinned) || null;
  return PROVIDERS.find((p) => p.isConfigured()) || null;
}

function isConfigured() {
  const provider = activeProvider();
  return Boolean(provider && provider.isConfigured());
}

/** What the admin page needs to render either the finder or a "how to switch it on" card. */
function describe() {
  const provider = activeProvider();
  const pinned = String(process.env.AI_PROVIDER || '').trim().toLowerCase();

  if (!provider) {
    return {
      configured: false,
      maxSuggestions: MAX_SUGGESTIONS,
      // No key anywhere: point at the free option.
      provider: groq.key,
      providerLabel: groq.label,
      envKey: groq.envKey,
      consoleUrl: groq.consoleUrl,
      free: true,
      unknownProvider: pinned || null,
      options: PROVIDERS.map((p) => ({
        provider: p.key,
        label: p.label,
        envKey: p.envKey,
        consoleUrl: p.consoleUrl,
        free: p.free,
      })),
    };
  }

  return {
    configured: provider.isConfigured(),
    maxSuggestions: MAX_SUGGESTIONS,
    provider: provider.key,
    providerLabel: provider.label,
    envKey: provider.envKey,
    consoleUrl: provider.consoleUrl,
    free: provider.free,
    model: provider.model,
    options: PROVIDERS.map((p) => ({
      provider: p.key,
      label: p.label,
      envKey: p.envKey,
      consoleUrl: p.consoleUrl,
      free: p.free,
    })),
  };
}

/**
 * Turns a provider SDK error into something an admin can act on.
 *
 * This matters more than it looks: SDK errors carry `.status`, not `.statusCode`, so
 * without this every one of them reached the error handler as an unlabelled 500 and got
 * masked as "Internal server error" — which tells you nothing about what to fix.
 */
function translateProviderError(err, provider) {
  // Already one of ours (a config problem) — pass it through untouched.
  if (err.statusCode) return err;

  const status = err.status;
  if (!status) {
    // Network / timeout / anything that never reached the provider.
    const wrapped = new Error(
      `Could not reach ${provider.label}: ${err.message}. If this keeps happening, the ` +
        'search may simply be taking too long — try asking for fewer products.'
    );
    wrapped.statusCode = 504;
    return wrapped;
  }

  // The provider's own explanation, which is usually the actually useful part.
  const detail = err.error?.error?.message || err.error?.message || err.message || '';

  const messages = {
    401: `${provider.label} rejected the API key. Check ${provider.envKey} in your ` +
      `environment — copy it again from ${provider.consoleUrl} if you are unsure.`,
    403: `${provider.label} refused the request: ${detail}`,
    404: `${provider.label} does not recognise the model "${provider.model}". It may have ` +
      `been renamed — check ${provider.consoleUrl} and set the model override in your ` +
      'environment variables.',
    429: `${provider.label} rate limit reached. Wait a minute and try again — the free ` +
      'tier allows roughly 30 requests a minute and 250 searches a day.',
  };

  const wrapped = new Error(
    messages[status] || `${provider.label} returned an error (${status}): ${detail}`
  );
  // 4xx from the provider is a bad request on our side or a limit on theirs — either way
  // it is not an unexplained server fault, so it keeps its own message.
  wrapped.statusCode = status === 429 ? 429 : status === 401 || status === 403 ? 502 : 502;
  return wrapped;
}

/**
 * Runs the finder. Returns { products, note, searches, model } — raw model output, still
 * to be validated by the caller. Throws with a `statusCode` on a configuration problem.
 */
async function suggest(options) {
  const provider = activeProvider();

  if (!provider) {
    const pinned = process.env.AI_PROVIDER;
    const err = new Error(
      `AI_PROVIDER is set to "${pinned}", which is not a provider. Use "groq" or ` +
        '"anthropic", or remove it to pick automatically.'
    );
    err.statusCode = 500;
    throw err;
  }

  if (!provider.isConfigured()) {
    const err = new Error(
      `The AI finder needs an API key. Add ${provider.envKey} to your environment ` +
        `(get one at ${provider.consoleUrl}) and restart the API.`
    );
    err.statusCode = 503;
    throw err;
  }

  try {
    return await provider.suggest(options);
  } catch (err) {
    // Log the raw body once, server-side: it is the only place the provider's full
    // response survives, and it is what makes a Render log worth reading.
    console.error(
      `[ai:${provider.key}] ${err.status || 'no-status'} ${err.message}`,
      err.error ? JSON.stringify(err.error) : ''
    );
    throw translateProviderError(err, provider);
  }
}

module.exports = { isConfigured, describe, suggest, MAX_SUGGESTIONS };
