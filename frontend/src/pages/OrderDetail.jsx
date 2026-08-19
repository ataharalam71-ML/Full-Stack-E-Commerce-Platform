import { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import api from '../api';

function formatPrice(cents, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(cents / 100);
}

export default function OrderDetail() {
  const { id } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/orders/${id}`)
      .then(({ data }) => { setOrder(data.order); setItems(data.items); })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load order'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p style={{ color: 'var(--text-dim)' }}>Loading order...</p>;
  if (error) return <div className="error-box">{error}</div>;
  if (!order) return null;

  return (
    <div>
      <Link to="/orders">← Back to orders</Link>
      <h1 style={{ marginTop: 12 }}>Order {order.id.slice(0, 8)}...</h1>

      {location.state?.justPaid && (
        <div className="success-box">Payment confirmed! Your order is now {order.status}.</div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="summary-row">
          <span>Status</span>
          <span className={`status-pill status-${order.status}`}>{order.status}</span>
        </div>
        <div className="summary-row">
          <span>Placed on</span>
          <span>{new Date(order.created_at).toLocaleString()}</span>
        </div>
      </div>

      <div className="card">
        <h2>Items</h2>
        <table>
          <thead>
            <tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Subtotal</th></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.product_name}</td>
                <td>{item.quantity}</td>
                <td>{formatPrice(item.unit_price_cents, order.currency)}</td>
                <td>{formatPrice(item.unit_price_cents * item.quantity, order.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="summary-total">
          <span>Total</span>
          <span>{formatPrice(order.total_cents, order.currency)}</span>
        </div>
      </div>
    </div>
  );
}
