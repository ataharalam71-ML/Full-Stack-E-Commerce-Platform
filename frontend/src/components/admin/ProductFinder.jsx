import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api, { errMsg } from '../../api';
import { useSite } from '../../context/SiteContext';
import { money } from '../../format';
import { bookmarkletHref } from './bookmarklet';

const LIMITS = [8, 12, 20, 30, 40];

// Products sent over by the bookmarklet wait here, so clicking it on ten products in a row
// collects all ten instead of each one replacing the last.
const QUEUE_KEY = 'dealdost.importQueue';

function readQueue() {
  try {
    const raw = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return []; // a private window or cleared storage is normal, not an error
  }
}

function writeQueue(items) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(0, 25)));
  } catch {
    /* storage unavailable — the queue just does not survive a reload */
  }
}

/** Pulls ?import=… out of the URL and adds it to the queue, newest last, no duplicates. */
function drainUrlImport() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('import');
  if (!raw) return readQueue();

  let queue = readQueue();
  try {
    const item = JSON.parse(raw);
    if (item?.url && !queue.some((q) => q.url === item.url)) queue = [...queue, item];
    writeQueue(queue);
  } catch {
    /* a mangled link is not worth surfacing — the queue is simply unchanged */
  }

  // Take the parameter back out so a refresh does not re-add the same product.
  params.delete('import');
  const search = params.toString();
  window.history.replaceState({}, '', `${window.location.pathname}${search ? `?${search}` : ''}`);
  return queue;
}

/** A placeholder keeps a card from looking broken when the store gave no image. */
const placeholderImage = (title) =>
  `https://picsum.photos/seed/${encodeURIComponent(title.slice(0, 24))}/600/600`;

const discount = (price, mrp) =>
  mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

/**
 * Admin -> Find products.
 *
 * Two ways in, one review grid:
 *   Search      — type a term, the server searches the stores and parses the results.
 *   Paste links — paste product links; the server reads each page's own product data.
 *
 * Either way nothing is published until you press Add on a card. There is no model
 * involved anywhere: every field shown came from the store's page.
 */
export default function ProductFinder({ categories = [], onImported }) {
  const { stores: allStores } = useSite();

  const [mode, setMode] = useState('search');
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({
    query: '',
    category: '',
    newCategory: '',
    limit: 12,
    stores: [],
    urls: '',
  });

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [addResult, setAddResult] = useState(null);
  const [adding, setAdding] = useState(false);

  const [queue, setQueue] = useState([]);

  useEffect(() => {
    api
      .get('/admin/finder/status')
      .then(({ data }) => setStatus(data))
      .catch(() => setStatus({ stores: [] }));
  }, []);

  const clearQueue = () => {
    writeQueue([]);
    setQueue([]);
    setResult(null);
    setItems([]);
  };

  const category = (form.newCategory.trim() || form.category).trim();

  const toggleStore = (key) =>
    setForm((prev) => ({
      ...prev,
      stores: prev.stores.includes(key)
        ? prev.stores.filter((s) => s !== key)
        : [...prev.stores, key],
    }));

  const load = (data) => {
    setResult(data);
    setItems(
      data.results.map((r, i) => ({
        ...r,
        _key: `${r.affiliate_url}-${i}`,
        // Anything already on the site starts unticked so it is never re-added by accident.
        _approved: !r.already_published,
        _open: false,
      }))
    );
  };

  /**
   * Vets whatever the bookmarklet has queued up and shows it in the review grid. The queue
   * is re-vetted every time rather than cached, so "already on site" is always current.
   */
  const loadQueue = useCallback(async (items, cat) => {
    setQueue(items);
    if (!items.length) return;

    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/admin/finder/import', {
        items,
        category: cat || 'Other',
      });
      setResult(data);
      setItems(
        data.results.map((r, i) => ({
          ...r,
          _key: `${r.affiliate_url}-${i}`,
          _approved: !r.already_published,
          _open: false,
        }))
      );
    } catch (err) {
      setError(errMsg(err, 'Could not read the queued products'));
    } finally {
      setBusy(false);
    }
  }, []);

  // On arrival, absorb anything the bookmarklet handed over via ?import=.
  useEffect(() => {
    const cameFromBookmarklet = new URLSearchParams(window.location.search).has('import');
    const pending = drainUrlImport();
    setQueue(pending);
    if (cameFromBookmarklet) setMode('oneclick');
    if (pending.length) loadQueue(pending, category);
    // Deliberately mount-only: re-running this on every category change would re-post the
    // whole queue on each keystroke. "Re-check" below does it on demand instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadQueue]);

  const runSearch = async (e) => {
    e.preventDefault();
    setError('');
    setAddResult(null);
    setResult(null);
    setItems([]);
    setBusy(true);
    try {
      const { data } = await api.post(
        '/admin/finder/search',
        {
          query: form.query.trim(),
          category: category || 'Other',
          limit: form.limit,
          stores: form.stores,
        },
        { timeout: 120000 }
      );
      load(data);
    } catch (err) {
      setError(errMsg(err, 'The search failed'));
    } finally {
      setBusy(false);
    }
  };

  const runResolve = async (e) => {
    e.preventDefault();
    setError('');
    setAddResult(null);
    setResult(null);
    setItems([]);
    setBusy(true);
    try {
      const { data } = await api.post(
        '/admin/finder/resolve',
        { urls: form.urls, category: category || 'Other' },
        { timeout: 180000 }
      );
      load(data);
    } catch (err) {
      setError(errMsg(err, 'Could not read those links'));
    } finally {
      setBusy(false);
    }
  };

  const patch = useCallback(
    (key, changes) =>
      setItems((prev) => prev.map((it) => (it._key === key ? { ...it, ...changes } : it))),
    []
  );

  const remove = (key) => setItems((prev) => prev.filter((it) => it._key !== key));

  const approved = useMemo(() => items.filter((it) => it._approved), [items]);

  const addApproved = async () => {
    if (!approved.length) return;
    setError('');
    setAddResult(null);
    setAdding(true);

    // Approved items go through the ordinary bulk endpoint, so they are validated by the
    // same code as a deal typed in by hand.
    const deals = approved.map((it) => ({
      title: it.title,
      affiliate_url: it.affiliate_url,
      store: it.store,
      price: it.price,
      mrp: it.mrp,
      rating: it.rating,
      brand: it.brand,
      description: it.description,
      image_url: it.image_url || placeholderImage(it.title),
      category: it.category,
      is_featured: false,
      is_active: true,
    }));

    try {
      const { data } = await api.post('/admin/deals/bulk', { deals });
      setAddResult(data);
      if (data.created > 0) {
        const failed = new Set((data.errors || []).map((e) => e.title));
        setItems((prev) => prev.filter((it) => !it._approved || failed.has(it.title)));

        // Anything published is done with, so it leaves the bookmarklet queue too —
        // otherwise it would come back as "already on site" on every future visit.
        const published = new Set(
          approved.filter((it) => !failed.has(it.title)).map((it) => it.affiliate_url)
        );
        if (published.size) {
          const left = readQueue().filter((q) => !published.has(q.url));
          writeQueue(left);
          setQueue(left);
        }

        onImported?.();
      }
    } catch (err) {
      if (err.response?.data?.errors) setAddResult(err.response.data);
      else setError(errMsg(err, 'Could not add the selected products'));
    } finally {
      setAdding(false);
    }
  };

  const categoryFields = (
    <div>
      <label htmlFor="pf-cat">Category</label>
      <select
        id="pf-cat"
        value={form.category}
        onChange={(e) => setForm({ ...form, category: e.target.value, newCategory: '' })}
      >
        <option value="">Choose a category…</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input
        placeholder="…or type a new category"
        value={form.newCategory}
        onChange={(e) => setForm({ ...form, newCategory: e.target.value, category: '' })}
      />
    </div>
  );

  return (
    <>
      <div className="card">
        <div className="spread" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Find products</h2>
          <span className="muted">Live store data · no AI</span>
        </div>

        <div className="tabs tabs-inner">
          <button className={mode === 'search' ? 'active' : ''} onClick={() => setMode('search')}>
            Search the stores
          </button>
          <button className={mode === 'paste' ? 'active' : ''} onClick={() => setMode('paste')}>
            Paste links
          </button>
          <button
            className={mode === 'oneclick' ? 'active' : ''}
            onClick={() => setMode('oneclick')}
          >
            One-click add{queue.length > 0 && ` (${queue.length})`}
          </button>
        </div>

        {mode === 'oneclick' ? (
          <OneClickMode
            queue={queue}
            busy={busy}
            error={error}
            categoryFields={categoryFields}
            onRecheck={() => loadQueue(readQueue(), category)}
            onClear={clearQueue}
          />
        ) : mode === 'search' ? (
          <form onSubmit={runSearch}>
            <p className="muted" style={{ marginTop: 0 }}>
              Type what you want. Results come straight from the stores&rsquo; own pages —
              nothing is published until you press Add.
            </p>

            <div className="form-grid">
              {categoryFields}
              <div>
                <label htmlFor="pf-q">What to look for *</label>
                <input
                  id="pf-q"
                  value={form.query}
                  onChange={(e) => setForm({ ...form, query: e.target.value })}
                  placeholder="cotton t shirt"
                  required
                />
                <span className="field-hint">
                  Plain keywords work best — the same words you would type on Flipkart.
                </span>
              </div>
            </div>

            <label>Search which stores?</label>
            <div className="chips" style={{ marginBottom: 4 }}>
              {allStores.map((s) => {
                const on = form.stores.includes(s.key);
                const note = status?.stores?.find((c) => c.store === s.key)?.note;
                return (
                  <button
                    type="button"
                    key={s.key}
                    className={`chip ${on ? 'active' : ''}`}
                    onClick={() => toggleStore(s.key)}
                    title={note || `Search ${s.label}`}
                  >
                    <span className="dot" style={{ background: s.color }} />
                    {s.label}
                    {note && <span className="chip-warn">!</span>}
                  </button>
                );
              })}
              {!form.stores.length && <span className="muted">All stores</span>}
            </div>

            {status?.stores?.some((s) => s.note) && (
              <p className="field-hint" style={{ marginBottom: 12 }}>
                {status.stores
                  .filter((s) => s.note)
                  .map((s) => s.note)
                  .join(' ')}
              </p>
            )}

            <label htmlFor="pf-limit">How many results</label>
            <select
              id="pf-limit"
              value={form.limit}
              onChange={(e) => setForm({ ...form, limit: Number(e.target.value) })}
            >
              {LIMITS.map((n) => (
                <option key={n} value={n}>
                  Up to {n}
                </option>
              ))}
            </select>

            {error && <div className="error-box">{error}</div>}

            <button className="btn btn-primary" disabled={busy || !form.query.trim()}>
              {busy ? 'Searching the stores…' : 'Search'}
            </button>
          </form>
        ) : (
          <form onSubmit={runResolve}>
            <p className="muted" style={{ marginTop: 0 }}>
              Paste product links — one per line. Each page is read for its own title, price
              and image. This works for every store, including the ones that block search.
            </p>

            <div className="form-grid">{categoryFields}</div>

            <label htmlFor="pf-urls">Product links *</label>
            <textarea
              id="pf-urls"
              value={form.urls}
              onChange={(e) => setForm({ ...form, urls: e.target.value })}
              placeholder={
                'https://www.flipkart.com/some-product/p/itm123456\n' +
                'https://www.amazon.in/dp/B0XXXXXXXX\n' +
                'https://www.meesho.com/some-product/p/abc123'
              }
              style={{ minHeight: 130, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '0.82rem' }}
              required
            />
            <span className="field-hint">
              Up to {status?.maxUrls ?? 25} links at a time.
            </span>

            {error && <div className="error-box">{error}</div>}

            <button className="btn btn-primary" disabled={busy || !form.urls.trim()}>
              {busy ? 'Reading the pages…' : 'Read links'}
            </button>
          </form>
        )}
      </div>

      {addResult && (
        <div className={addResult.created ? 'success-box' : 'error-box'}>
          <strong>
            {addResult.created} product{addResult.created === 1 ? '' : 's'} added to your site
          </strong>
          {addResult.errors?.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {addResult.errors.map((e) => (
                <li key={`${e.row}-${e.title}`}>
                  {e.title}: {e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {result && (
        <>
          <div className="card">
            <div className="spread">
              <div className="stack">
                <strong>
                  {items.length} result{items.length === 1 ? '' : 's'}
                  {result.query ? ` for “${result.query}”` : ''}
                </strong>
                <span className="muted">
                  Filed under {result.category}
                  {approved.length > 0 && ` · ${approved.length} selected to add`}
                </span>
              </div>
              <div className="row">
                <button
                  className="btn btn-sm"
                  onClick={() => setItems((p) => p.map((i) => ({ ...i, _approved: true })))}
                >
                  Select all
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => setItems((p) => p.map((i) => ({ ...i, _approved: false })))}
                >
                  Clear
                </button>
                <button
                  className="btn btn-primary"
                  disabled={adding || !approved.length}
                  onClick={addApproved}
                >
                  {adding ? 'Adding…' : `Add ${approved.length} to my site`}
                </button>
              </div>
            </div>

            {/* Per-store outcome. A blocked store is expected, not a failure of the page. */}
            {result.reports?.length > 0 && (
              <div className="store-reports">
                {result.reports.map((r) => (
                  <div
                    key={r.store}
                    className={`store-report ${r.blocked || r.unavailable ? 'blocked' : ''}`}
                  >
                    <strong>{r.label}</strong>
                    {r.error ? (
                      <span>
                        {r.blocked ? 'blocked this search — use Paste links instead' : r.error}
                      </span>
                    ) : (
                      <span>{r.found} found</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {result.searchLinks?.length > 0 && (
              <p className="field-hint" style={{ marginBottom: 0 }}>
                Or open the store search yourself and copy the links you like:{' '}
                {result.searchLinks.map((l, i) => (
                  <span key={l.store}>
                    {i > 0 && ' · '}
                    <a href={l.url} target="_blank" rel="noreferrer noopener">
                      {l.label} ↗
                    </a>
                  </span>
                ))}
              </p>
            )}

            {result.rejected?.length > 0 && (
              <details style={{ marginTop: 12 }}>
                <summary className="muted">
                  {result.rejected.length} result{result.rejected.length === 1 ? '' : 's'} thrown
                  away before you saw them
                </summary>
                <ul style={{ margin: '8px 0 0', paddingLeft: 18 }} className="muted">
                  {result.rejected.map((r, i) => (
                    <li key={`${r.title}-${i}`}>
                      {String(r.title).slice(0, 80)} — {r.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {items.length === 0 && (
            <div className="empty-state">
              <div className="big">🔍</div>
              <p>
                Nothing left to review. Try different keywords, or use <strong>Paste links</strong>{' '}
                with product links copied from the store.
              </p>
            </div>
          )}

          <div className="suggest-grid">
            {items.map((it) => (
              <ResultCard
                key={it._key}
                item={it}
                categories={categories}
                onPatch={patch}
                onRemove={remove}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/**
 * The bookmarklet mode: install it once, then collect products from any store.
 *
 * This is the answer to Amazon and Meesho refusing to serve their pages to a server. The
 * bookmarklet runs in the admin's own browser, on the page they are already looking at, so
 * there is no request from us to the store and nothing for the store to block.
 */
function OneClickMode({ queue, busy, error, categoryFields, onRecheck, onClear }) {
  const linkRef = useRef(null);

  // React refuses to render a `javascript:` href, so it is set on the element directly.
  // Dragging the link to the bookmarks bar is what installs it.
  useEffect(() => {
    if (linkRef.current) {
      linkRef.current.setAttribute('href', bookmarkletHref(window.location.origin));
    }
  }, []);

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        Works on <strong>every</strong> store — Amazon and Meesho included. They refuse to
        show their pages to a server, but your browser is already showing them, so this
        reads the page you are looking at.
      </p>

      <div className="bookmarklet-box">
        <div className="stack">
          <strong>Step 1 — install it once</strong>
          <span className="muted">
            Show your bookmarks bar (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>), then drag
            this button onto it:
          </span>
        </div>
        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
        <a
          ref={linkRef}
          className="bookmarklet-btn"
          onClick={(e) => {
            e.preventDefault();
            window.alert(
              'Do not click it here — drag it up onto your bookmarks bar.\n\n' +
                'Then open a product page on Amazon, Flipkart or Meesho and click it there.'
            );
          }}
          title="Drag me to the bookmarks bar"
        >
          + Add to DealDost
        </a>
      </div>

      <div className="stack" style={{ marginBottom: 14 }}>
        <strong>Step 2 — use it</strong>
        <ol className="tight-list muted">
          <li>Browse Amazon, Flipkart or Meesho as normal and open a product page.</li>
          <li>
            Click <strong>+ Add to DealDost</strong> in your bookmarks bar. The product is
            collected and this page opens with it queued.
          </li>
          <li>
            Keep going — click it on as many products as you like. They stack up in one tab.
          </li>
          <li>Come back here, check the cards, and press <strong>Add</strong>.</li>
        </ol>
      </div>

      <div className="form-grid">{categoryFields}</div>

      {error && <div className="error-box">{error}</div>}

      <div className="spread">
        <span className="muted">
          {busy
            ? 'Checking the queue…'
            : queue.length
              ? `${queue.length} product${queue.length === 1 ? '' : 's'} queued`
              : 'Nothing queued yet.'}
        </span>
        {queue.length > 0 && (
          <div className="row">
            <button type="button" className="btn btn-sm" onClick={onRecheck} disabled={busy}>
              Re-check with this category
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={onClear}>
              Empty the queue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** One found product: add it, edit it, open the real link, or remove it from the list. */
function ResultCard({ item, categories, onPatch, onRemove }) {
  const off = discount(item.price, item.mrp);
  const set = (key) => (e) => {
    const raw = e.target.value;
    const numeric = key === 'price' || key === 'mrp' || key === 'rating';
    onPatch(item._key, { [key]: numeric ? (raw === '' ? null : Number(raw)) : raw });
  };

  return (
    <div className={`suggest-card ${item._approved ? 'approved' : ''}`}>
      <div className="suggest-thumb">
        {item.image_url ? (
          <img src={item.image_url} alt="" loading="lazy" />
        ) : (
          <div className="no-img">No image on the page</div>
        )}
        {off > 0 && <span className="off-badge">{off}% off</span>}
      </div>

      <div className="suggest-body">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          <span className={`pill pill-${item.store}`}>{item.store}</span>
          {item.already_published && <span className="pill pill-hidden">already on site</span>}
        </div>

        <strong className="suggest-title">{item.title}</strong>

        <div className="price-row">
          <span className="price">{money(item.price)}</span>
          {item.mrp > item.price && <span className="mrp">{money(item.mrp)}</span>}
          {item.rating ? <span className="rating">★ {item.rating}</span> : null}
        </div>

        {item.brand && <span className="muted" style={{ fontSize: '0.8rem' }}>{item.brand}</span>}

        {item.warnings?.map((w) => (
          <p key={w} className="suggest-warn">
            ⚠ {w}
          </p>
        ))}

        {item.already_published && (
          <p className="suggest-warn">
            ⚠ Deal #{item.already_published.id} already points at this product.
          </p>
        )}

        <a
          className="suggest-link"
          href={item.affiliate_url}
          target="_blank"
          rel="noreferrer noopener"
        >
          Open the product page ↗
        </a>

        {item._open && (
          <div className="suggest-edit">
            <label>Title</label>
            <input value={item.title} onChange={set('title')} />

            <div className="row">
              <div className="grow">
                <label>Price ₹</label>
                <input type="number" value={item.price ?? ''} onChange={set('price')} />
              </div>
              <div className="grow">
                <label>MRP ₹</label>
                <input type="number" value={item.mrp ?? ''} onChange={set('mrp')} />
              </div>
            </div>

            <label>Category</label>
            <input value={item.category} onChange={set('category')} list="pf-cat-list" />
            <datalist id="pf-cat-list">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>

            <label>Image URL</label>
            <input
              value={item.image_url || ''}
              onChange={set('image_url')}
              placeholder="Left blank, a placeholder image is used"
            />

            <label>Description</label>
            <textarea
              value={item.description || ''}
              onChange={set('description')}
              style={{ minHeight: 70 }}
            />
          </div>
        )}

        <div className="suggest-actions">
          <button
            className={`btn btn-sm ${item._approved ? 'btn-primary' : ''}`}
            onClick={() => onPatch(item._key, { _approved: !item._approved })}
          >
            {item._approved ? '✓ Added' : 'Add'}
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => onPatch(item._key, { _open: !item._open })}
          >
            {item._open ? 'Done' : 'Edit'}
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => onRemove(item._key)}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
