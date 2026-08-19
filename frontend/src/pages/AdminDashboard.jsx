import { useEffect, useState } from 'react';
import api from '../api';

function formatPrice(cents, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(cents / 100);
}

const STATUS_OPTIONS = ['PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'FAILED'];

function StatsTab() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get('/admin/stats').then(({ data }) => setStats(data)); }, []);
  if (!stats) return <p style={{ color: 'var(--text-dim)' }}>Loading...</p>;

  return (
    <div>
      <div className="stats-grid">
        <div className="card stat-card">
          <div className="label">Total users</div>
          <div className="value">{stats.total_users}</div>
        </div>
        <div className="card stat-card">
          <div className="label">Total orders</div>
          <div className="value">{stats.total_orders}</div>
        </div>
        <div className="card stat-card">
          <div className="label">Revenue (paid+)</div>
          <div className="value">{formatPrice(stats.total_revenue_cents)}</div>
        </div>
        <div className="card stat-card">
          <div className="label">Low stock items</div>
          <div className="value">{stats.low_stock_products.length}</div>
        </div>
      </div>
      {stats.low_stock_products.length > 0 && (
        <div className="card">
          <h2>Low stock (&lt; 5 units)</h2>
          <table>
            <thead><tr><th>Product</th><th>Stock</th></tr></thead>
            <tbody>
              {stats.low_stock_products.map((p) => (
                <tr key={p.id}><td>{p.name}</td><td>{p.stock}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  const load = () => api.get('/admin/orders').then(({ data }) => setOrders(data.orders));
  useEffect(() => { load(); }, []);

  const changeStatus = async (id, status) => {
    setError('');
    try {
      await api.put(`/admin/orders/${id}/status`, { status });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update status');
    }
  };

  return (
    <div className="card">
      {error && <div className="error-box">{error}</div>}
      <table>
        <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Change status</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.id.slice(0, 8)}...</td>
              <td>{o.customer_name}<br /><span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{o.customer_email}</span></td>
              <td>{formatPrice(o.total_cents, o.currency)}</td>
              <td><span className={`status-pill status-${o.status}`}>{o.status}</span></td>
              <td>
                <select value={o.status} onChange={(e) => changeStatus(o.id, e.target.value)} style={{ marginBottom: 0 }}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  useEffect(() => { api.get('/admin/users').then(({ data }) => setUsers(data.users)); }, []);

  return (
    <div className="card">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td><td>{u.email}</td><td>{u.role}</td>
              <td>{new Date(u.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ name: '', price_cents: '', category: '', stock: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = () => api.get('/products', { params: { limit: 100 } }).then(({ data }) => setProducts(data.products));
  useEffect(() => { load(); }, []);

  const createProduct = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      await api.post('/products', {
        name: form.name,
        price_cents: Math.round(parseFloat(form.price_cents) * 100),
        category: form.category || null,
        stock: parseInt(form.stock, 10) || 0,
      });
      setForm({ name: '', price_cents: '', category: '', stock: '' });
      setMessage('Product created.');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create product');
    }
  };

  const deleteProduct = async (id) => {
    try {
      await api.delete(`/products/${id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete product');
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Add product</h2>
        {error && <div className="error-box">{error}</div>}
        {message && <div className="success-box">{message}</div>}
        <form onSubmit={createProduct} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'start' }}>
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="Price (₹)" type="number" step="0.01" value={form.price_cents} onChange={(e) => setForm({ ...form, price_cents: e.target.value })} required />
          <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input placeholder="Stock" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required />
          <button className="btn btn-primary">Add</button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td><td>{p.category || '—'}</td>
                <td>{formatPrice(p.price_cents, p.currency)}</td><td>{p.stock}</td>
                <td><button className="btn btn-danger" onClick={() => deleteProduct(p.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('stats');

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <div className="tabs">
        {['stats', 'orders', 'products', 'users'].map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'stats' && <StatsTab />}
      {tab === 'orders' && <OrdersTab />}
      {tab === 'products' && <ProductsTab />}
      {tab === 'users' && <UsersTab />}
    </div>
  );
}
