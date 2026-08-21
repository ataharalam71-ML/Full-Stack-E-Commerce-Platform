import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import DealForm from '../components/admin/DealForm';
import DealTable from '../components/admin/DealTable';
import BulkImport from '../components/admin/BulkImport';
import ProductFinder from '../components/admin/ProductFinder';
import Analytics from '../components/admin/Analytics';
import SettingsPanel from '../components/admin/SettingsPanel';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';

const TABS = [
  { key: 'deals', label: 'Deals' },
  { key: 'find', label: '🔍 Find products' },
  { key: 'import', label: 'Bulk import' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'settings', label: 'Settings' },
];

const PER_PAGE = 20;

export default function Admin() {
  const { user } = useAuth();
  const { stores } = useSite();

  const [tab, setTab] = useState('deals');
  const [deals, setDeals] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState({ q: '', store: '', status: 'all', sort: 'newest', page: 1 });

  const loadDeals = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/deals', { params: { ...query, limit: PER_PAGE } });
      setDeals(data.deals);
      setPagination(data.pagination);
    } catch (err) {
      setError(errMsg(err, 'Could not load deals'));
    } finally {
      setLoading(false);
    }
  }, [query]);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/stats');
      setStats(data);
    } catch {
      /* the dashboard still works without the numbers */
    }
  }, []);

  // Category suggestions for the form come from what is already published.
  const loadCategories = useCallback(async () => {
    try {
      const { data } = await api.get('/deals/filters');
      setCategories(data.categories.map((c) => c.category));
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  useEffect(() => {
    loadStats();
    loadCategories();
  }, [loadStats, loadCategories]);

  /** Anything that changes the catalogue refreshes the list and the counters together. */
  const refresh = useCallback(() => {
    loadDeals();
    loadStats();
    loadCategories();
  }, [loadDeals, loadStats, loadCategories]);

  const setQ = (patch) => setQuery((prev) => ({ ...prev, page: 1, ...patch }));

  const handleSaved = () => {
    setEditing(null);
    refresh();
  };

  const deleteSelected = async () => {
    if (!selected.length) return;
    if (!window.confirm(`Delete ${selected.length} deal(s) permanently?`)) return;
    try {
      await api.delete('/admin/deals', { data: { ids: selected } });
      setSelected([]);
      refresh();
    } catch (err) {
      setError(errMsg(err, 'Could not delete the selected deals'));
    }
  };

  const startEdit = (deal) => {
    setEditing(deal);
    setTab('deals');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div className="spread" style={{ marginBottom: 18 }}>
        <div className="stack">
          <h1 style={{ marginBottom: 2 }}>Admin</h1>
          <span className="muted">Signed in as {user.email}</span>
        </div>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="label">Total deals</div>
            <div className="value">{stats.totals.deals}</div>
          </div>
          <div className="stat-card">
            <div className="label">Live</div>
            <div className="value">{stats.totals.active}</div>
          </div>
          <div className="stat-card">
            <div className="label">Hidden</div>
            <div className="value">{stats.totals.hidden}</div>
          </div>
          <div className="stat-card">
            <div className="label">Featured</div>
            <div className="value">{stats.totals.featured}</div>
          </div>
          <div className="stat-card">
            <div className="label">Total clicks</div>
            <div className="value">{stats.totals.clicks}</div>
          </div>
        </div>
      )}

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'deals' && (
        <div className="admin-layout">
          <div className="sticky-panel">
            <DealForm
              deal={editing}
              categories={categories}
              onSaved={handleSaved}
              onCancel={() => setEditing(null)}
            />
          </div>

          <div>
            <div className="toolbar">
              <input
                className="grow"
                placeholder="Search title, brand, link…"
                value={query.q}
                onChange={(e) => setQ({ q: e.target.value })}
              />
              <select value={query.store} onChange={(e) => setQ({ store: e.target.value })}>
                <option value="">All stores</option>
                {stores.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select value={query.status} onChange={(e) => setQ({ status: e.target.value })}>
                <option value="all">All statuses</option>
                <option value="active">Live only</option>
                <option value="hidden">Hidden only</option>
                <option value="featured">Featured only</option>
              </select>
              <select value={query.sort} onChange={(e) => setQ({ sort: e.target.value })}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="clicks">Most clicked</option>
                <option value="price_desc">Price: high to low</option>
                <option value="price_asc">Price: low to high</option>
                <option value="title">Title A-Z</option>
              </select>
            </div>

            <div className="spread" style={{ marginBottom: 12 }}>
              <span className="muted">
                {pagination.total} deal{pagination.total === 1 ? '' : 's'}
                {selected.length > 0 && ` · ${selected.length} selected`}
              </span>
              {selected.length > 0 && (
                <div className="row">
                  <button className="btn btn-sm btn-ghost" onClick={() => setSelected([])}>
                    Clear selection
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={deleteSelected}>
                    Delete {selected.length} selected
                  </button>
                </div>
              )}
            </div>

            {error && <div className="error-box">{error}</div>}

            <DealTable
              deals={deals}
              loading={loading}
              selected={selected}
              setSelected={setSelected}
              onEdit={startEdit}
              onChanged={refresh}
            />

            {pagination.pages > 1 && (
              <div className="pagination">
                <button
                  className="btn"
                  disabled={query.page <= 1}
                  onClick={() => setQuery((p) => ({ ...p, page: p.page - 1 }))}
                >
                  ← Previous
                </button>
                <span className="page-info">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  className="btn"
                  disabled={query.page >= pagination.pages}
                  onClick={() => setQuery((p) => ({ ...p, page: p.page + 1 }))}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'find' && <ProductFinder categories={categories} onImported={refresh} />}
      {tab === 'import' && <BulkImport onImported={refresh} />}
      {tab === 'analytics' && <Analytics stats={stats} />}
      {tab === 'settings' && <SettingsPanel />}
    </>
  );
}
