import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

function formatPrice(cents, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(cents / 100);
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/orders')
      .then(({ data }) => setOrders(data.orders))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load orders'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: 'var(--text-dim)' }}>Loading orders...</p>;

  return (
    <div>
      <h1>Your Orders</h1>
      {error && <div className="error-box">{error}</div>}

      {orders.length === 0 ? (
        <div className="empty-state">No orders yet.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr><th>Order</th><th>Date</th><th>Total</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.id.slice(0, 8)}...</td>
                  <td>{new Date(o.created_at).toLocaleDateString()}</td>
                  <td>{formatPrice(o.total_cents, o.currency)}</td>
                  <td><span className={`status-pill status-${o.status}`}>{o.status}</span></td>
                  <td><Link to={`/orders/${o.id}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
