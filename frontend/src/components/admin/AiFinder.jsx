import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { errMsg } from '../../api';
import { useSite } from '../../context/SiteContext';
import { money } from '../../format';

const COUNTS = [4, 8, 12, 16, 24];

/** A placeholder keeps a card from looking broken when no product image was found. */
const placeholderImage = (title) =>
  `https://picsum.photos/seed/${encodeURIComponent(title.slice(0, 24))}/600/600`;

const discount = (price, mrp) =>
  mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

/**
 * Admin -> AI finder.
 *
 * Search a term, the backend goes and finds real product pages, and every result lands
 * here as a *suggestion* — nothing is published until you tick it and press Add. Each
 * card is editable first, so a wrong price or a missing image is a two-second fix rather
 * than a reason to reject the whole thing.
 */
export default function AiFinder({ categories = [], onImported }) {
  const { stores: allStores } = useSite();

  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({
    query: '',
    category: '',
    newCategory: '',
    count: 8,
    stores: [],
  });

  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null);
  const [items, setItems] = useState([]); // { ...deal, _key, _approved, _open }
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api
      .get('/admin/ai/status')
      .then(({ data }) => setStatus(data))
      .catch(() => setStatus({ configured: false }));
  }, []);

  const category = (form.newCategory.trim() || form.category).trim();

  const toggleStore = (key) =>
    setForm((prev) => ({
      ...prev,
      stores: prev.stores.includes(key)
        ? prev.stores.filter((s) => s !== key)
        : [...prev.stores, key],
    }));

  const search = async (e) => {
    e.preventDefault();
    setError('');
    setImportResult(null);
    setResult(null);
    setItems([]);
    setSearching(true);

    try {
      const { data } = await api.post(
        '/admin/ai/suggest',
        { query: form.query.trim(), category: category || 'Other', count: form.count, stores: form.stores },
        { timeout: 300000 } // the search runs several web lookups; give it real time
      );
      setResult(data);
      setItems(
        data.suggestions.map((s, i) => ({
          ...s,
          _key: `${s.affiliate_url}-${i}`,
          // Anything already on the site starts unticked so it is never re-added by accident.
          _approved: !s.already_published,
          _open: false,
        }))
      );
    } catch (err) {
      setError(errMsg(err, 'The search failed'));
    } finally {
      setSearching(false);
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
    setImportResult(null);
    setAdding(true);

    // Approved suggestions go through the ordinary bulk-import endpoint, so they are
    // validated by the same code as a deal typed in by hand.
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
      setImportResult(data);
      if (data.created > 0) {
        // Clear out what went in; anything that failed stays on screen to be fixed.
        const failedTitles = new Set((data.errors || []).map((e) => e.title));
        setItems((prev) => prev.filter((it) => !it._approved || failedTitles.has(it.title)));
        onImported?.();
      }
    } catch (err) {
      if (err.response?.data?.errors) setImportResult(err.response.data);
      else setError(errMsg(err, 'Could not add the approved deals'));
    } finally {
      setAdding(false);
    }
  };

  if (status && !status.configured) {
    return (
      <div className="card">
        <h2>AI finder</h2>
        <p className="muted">
          This page finds products for you: pick a category, type what you are looking for
          (&ldquo;t shirt&rdquo;), and it searches Amazon, Flipkart and Meesho and shows you
          real listings to approve.
        </p>
        <div className="error-box" style={{ marginBottom: 0 }}>
          <strong>Not switched on yet.</strong>

          {status.unknownProvider ? (
            <p style={{ margin: '8px 0 0' }}>
              <code>AI_PROVIDER</code> is set to <code>{status.unknownProvider}</code>, which is
              not a provider. Set it to <code>groq</code> or <code>anthropic</code>, or remove
              it to pick automatically.
            </p>
          ) : (
            <>
              <p style={{ margin: '8px 0 0' }}>
                Add an API key called <code>{status.envKey}</code> to your environment
                variables, then restart the API:
              </p>
              <pre className="code-block">{status.envKey}=your-key-here</pre>
              <p style={{ margin: 0 }}>
                Get one at{' '}
                <a href={status.consoleUrl} target="_blank" rel="noreferrer">
                  {status.consoleUrl.replace(/^https:\/\//, '')}
                </a>
                {status.free
                  ? ' — the free tier needs no card and no payment.'
                  : ' — pay-as-you-go, a few cents per search.'}
              </p>
              <p style={{ margin: '8px 0 0' }}>
                On Render: <strong>your service → Environment → Add Environment Variable</strong>,
                then <strong>Save</strong>. It redeploys on its own.
              </p>
            </>
          )}

          {status.options?.length > 1 && (
            <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.82rem' }}>
              Supported:{' '}
              {status.options
                .map((o) => `${o.label} (${o.envKey})${o.free ? ' — free' : ''}`)
                .join(' · ')}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <form className="card" onSubmit={search}>
        <div className="spread" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>AI finder</h2>
          {status?.providerLabel && (
            <span className="muted" title={status.model}>
              {status.providerLabel}
              {status.free && <span className="pill pill-live" style={{ marginLeft: 8 }}>free</span>}
            </span>
          )}
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Pick a category and say what you want. Nothing is published until you approve it.
        </p>

        <div className="form-grid">
          <div>
            <label htmlFor="ai-cat">Category</label>
            <select
              id="ai-cat"
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

          <div>
            <label htmlFor="ai-q">What to look for *</label>
            <input
              id="ai-q"
              value={form.query}
              onChange={(e) => setForm({ ...form, query: e.target.value })}
              placeholder="cotton t shirt under 700"
              required
            />
            <span className="field-hint">
              Be specific if you can — a brand, a budget, or a use case all help.
            </span>
          </div>
        </div>

        <label>Search which stores?</label>
        <div className="chips" style={{ marginBottom: 12 }}>
          {allStores.map((s) => {
            const on = form.stores.includes(s.key);
            return (
              <button
                type="button"
                key={s.key}
                className={`chip ${on ? 'active' : ''}`}
                onClick={() => toggleStore(s.key)}
              >
                <span className="dot" style={{ background: s.color }} />
                {s.label}
              </button>
            );
          })}
          {!form.stores.length && <span className="muted">All stores</span>}
        </div>

        <label htmlFor="ai-count">How many to find</label>
        <select
          id="ai-count"
          value={form.count}
          onChange={(e) => setForm({ ...form, count: Number(e.target.value) })}
        >
          {COUNTS.map((n) => (
            <option key={n} value={n}>
              {n} products
            </option>
          ))}
        </select>

        {error && <div className="error-box">{error}</div>}

        <button className="btn btn-primary" disabled={searching || !form.query.trim()}>
          {searching ? 'Searching the stores…' : 'Find products'}
        </button>
        {searching && (
          <span className="muted" style={{ marginLeft: 12 }}>
            This takes 30–60 seconds — it is doing real searches.
          </span>
        )}
      </form>

      {importResult && (
        <div className={importResult.created ? 'success-box' : 'error-box'}>
          <strong>
            {importResult.created} deal{importResult.created === 1 ? '' : 's'} added to your site
          </strong>
          {importResult.errors?.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {importResult.errors.map((e) => (
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
                  {items.length} suggestion{items.length === 1 ? '' : 's'} for &ldquo;
                  {result.query}&rdquo;
                </strong>
                <span className="muted">
                  {result.searches} web search{result.searches === 1 ? '' : 'es'} · filed under{' '}
                  {result.category}
                  {approved.length > 0 && ` · ${approved.length} approved`}
                </span>
              </div>
              <div className="row">
                <button
                  className="btn btn-sm"
                  onClick={() => setItems((p) => p.map((i) => ({ ...i, _approved: true })))}
                >
                  Approve all
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

            {result.note && (
              <p className="muted" style={{ margin: '12px 0 0' }}>
                {result.note}
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
                      {r.title} — {r.reason}
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
                Nothing left to review. Try a different search term, or widen the stores you
                are searching.
              </p>
            </div>
          )}

          <div className="suggest-grid">
            {items.map((it) => (
              <SuggestionCard
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

/** One proposed deal: approve it, edit it, open the real link, or throw it away. */
function SuggestionCard({ item, categories, onPatch, onRemove }) {
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
          <div className="no-img">No image found</div>
        )}
        {off > 0 && <span className="off-badge">{off}% off</span>}
      </div>

      <div className="suggest-body">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          <span className={`pill pill-${item.store}`}>{item.store}</span>
          <span className={`pill pill-conf-${item.confidence}`}>{item.confidence} confidence</span>
          {item.already_published && <span className="pill pill-hidden">already on site</span>}
        </div>

        <strong className="suggest-title">{item.title}</strong>

        <div className="price-row">
          <span className="price">{money(item.price)}</span>
          {item.mrp > item.price && <span className="mrp">{money(item.mrp)}</span>}
          {item.rating ? <span className="rating">★ {item.rating}</span> : null}
        </div>

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
          Open the real product page ↗
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
            <input value={item.category} onChange={set('category')} list="ai-cat-list" />
            <datalist id="ai-cat-list">
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
            {item._approved ? '✓ Approved' : 'Approve'}
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
