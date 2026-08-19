import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { errMsg } from '../api';
import DealCard from '../components/DealCard';
import { useSite } from '../context/SiteContext';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'discount', label: 'Biggest discount' },
  { value: 'popular', label: 'Most clicked' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
];

const PER_PAGE = 12;

export default function Home() {
  const { site, stores } = useSite();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState({ categories: [], storeCounts: [], priceRange: { min: 0, max: 0 } });
  const [deals, setDeals] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // The URL is the single source of truth for filters, so links and the back button work.
  const q = searchParams.get('q') || '';
  const store = searchParams.get('store') || '';
  const category = searchParams.get('category') || '';
  const sort = searchParams.get('sort') || 'newest';
  const page = Number(searchParams.get('page')) || 1;

  const setParam = useCallback(
    (patch) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      // Any filter change resets pagination — page 3 of the old result set is meaningless.
      if (!('page' in patch)) next.delete('page');
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    api
      .get('/deals/filters')
      .then(({ data }) => setFilters(data))
      .catch(() => setFilters({ categories: [], storeCounts: [], priceRange: { min: 0, max: 0 } }));

    api
      .get('/deals', { params: { featured: 'true', limit: 4, sort: 'discount' } })
      .then(({ data }) => setFeatured(data.deals))
      .catch(() => setFeatured([]));
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');

    api
      .get('/deals', { params: { q, store, category, sort, page, limit: PER_PAGE } })
      .then(({ data }) => {
        if (!alive) return;
        setDeals(data.deals);
        setPagination(data.pagination);
      })
      .catch((err) => alive && setError(errMsg(err, 'Could not load deals')))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [q, store, category, sort, page]);

  const isFiltered = Boolean(q || store || category);
  const countFor = (key) => filters.storeCounts.find((s) => s.store === key)?.count || 0;

  return (
    <>
      {!isFiltered && page === 1 && (
        <section className="hero">
          <h1>{site.tagline}</h1>
          <p>
            Every deal here is checked by hand before it goes live. Tap through to Amazon, Flipkart
            or Meesho to buy — the price you see there is the price you pay.
          </p>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="n">{pagination.total}</div>
              <div className="l">Live deals</div>
            </div>
            {stores.map((s) => (
              <div className="hero-stat" key={s.key}>
                <div className="n">{countFor(s.key)}</div>
                <div className="l">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!isFiltered && page === 1 && featured.length > 0 && (
        <section>
          <div className="section-head" style={{ marginTop: 0 }}>
            <h2>⚡ Today's top picks</h2>
          </div>
          <div className="deal-grid">
            {featured.map((deal) => (
              <DealCard key={`f-${deal.id}`} deal={deal} />
            ))}
          </div>
        </section>
      )}

      <div className="section-head">
        <h2>{q ? `Results for "${q}"` : category || 'All deals'}</h2>
        <span className="muted">{pagination.total} deals</span>
      </div>

      <div className="chips" style={{ marginBottom: 14 }}>
        <button className={`chip ${!store ? 'active' : ''}`} onClick={() => setParam({ store: '' })}>
          All stores
        </button>
        {stores.map((s) => (
          <button
            key={s.key}
            className={`chip ${store === s.key ? 'active' : ''}`}
            onClick={() => setParam({ store: store === s.key ? '' : s.key })}
          >
            <span className="dot" style={{ background: s.color }} />
            {s.label}
            <span className="count">{countFor(s.key)}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <select value={category} onChange={(e) => setParam({ category: e.target.value })}>
          <option value="">All categories</option>
          {filters.categories.map((c) => (
            <option key={c.category} value={c.category}>
              {c.category} ({c.count})
            </option>
          ))}
        </select>

        <select value={sort} onChange={(e) => setParam({ sort: e.target.value })}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {isFiltered && (
          <button className="btn btn-ghost" onClick={() => setSearchParams(new URLSearchParams())}>
            Clear filters
          </button>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}

      {loading ? (
        <div className="deal-grid">
          {Array.from({ length: PER_PAGE }).map((_, i) => (
            <div className="skeleton skeleton-card" key={i} />
          ))}
        </div>
      ) : deals.length === 0 ? (
        <div className="empty-state">
          <div className="big">🔍</div>
          <h3>No deals match that</h3>
          <p>Try a different store, category or search term.</p>
        </div>
      ) : (
        <div className="deal-grid">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="pagination">
          <button
            className="btn"
            disabled={page <= 1}
            onClick={() => setParam({ page: String(page - 1) })}
          >
            ← Previous
          </button>
          <span className="page-info">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            className="btn"
            disabled={page >= pagination.pages}
            onClick={() => setParam({ page: String(page + 1) })}
          >
            Next →
          </button>
        </div>
      )}
    </>
  );
}
