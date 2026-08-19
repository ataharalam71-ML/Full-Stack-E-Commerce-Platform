import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

function formatPrice(cents, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(cents / 100);
}

export default function Cart({ onCartChange }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  const fetchCart = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/cart');
      setItems(data.items);
      setTotal(data.total_cents);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load cart');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCart(); }, []);

  const updateQty = async (itemId, quantity) => {
    if (quantity < 1) return;
    try {
      await api.put(`/cart/items/${itemId}`, { quantity });
      fetchCart();
      onCartChange?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update quantity');
    }
  };

  const removeItem = async (itemId) => {
    try {
      await api.delete(`/cart/items/${itemId}`);
      fetchCart();
      onCartChange?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not remove item');
    }
  };

  const checkout = async () => {
    setError('');
    setCheckingOut(true);
    try {
      // 1. Create the order — backend locks stock, creates a payment-provider order
      //    (or a mock one if no Razorpay keys are configured).
      const { data: orderData } = await api.post('/orders', {});
      const { order, payment, mock_payment_mode } = orderData;

      // 2. In a real app, this is where Razorpay Checkout.js would open and the user
      //    would enter card/UPI details. In mock mode we simulate an instant success.
      const fakePaymentId = mock_payment_mode
        ? `mock_pay_${Date.now()}`
        : prompt('Enter the Razorpay payment ID from checkout:');

      if (!fakePaymentId) throw new Error('Payment cancelled');

      await api.post('/orders/confirm-payment', {
        order_id: order.id,
        provider_payment_id: fakePaymentId,
      });

      onCartChange?.();
      navigate(`/orders/${order.id}`, { state: { justPaid: true } });
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-dim)' }}>Loading cart...</p>;

  return (
    <div>
      <h1>Your Cart</h1>
      {error && <div className="error-box">{error}</div>}

      {items.length === 0 ? (
        <div className="empty-state">Your cart is empty. Go add some products!</div>
      ) : (
        <div className="card">
          {items.map((item) => (
            <div key={item.id} className="cart-row">
              <div>
                <div style={{ fontWeight: 600 }}>{item.name}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                  {formatPrice(item.price_cents, item.currency)} each
                </div>
              </div>
              <div className="qty-controls">
                <button onClick={() => updateQty(item.id, item.quantity - 1)}>−</button>
                <span>{item.quantity}</span>
                <button onClick={() => updateQty(item.id, item.quantity + 1)}>+</button>
              </div>
              <div style={{ fontWeight: 600, minWidth: 90, textAlign: 'right' }}>
                {formatPrice(item.line_total_cents, item.currency)}
              </div>
              <button className="btn btn-danger" onClick={() => removeItem(item.id)}>Remove</button>
            </div>
          ))}

          <div className="summary-total">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>

          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 16 }}
            disabled={checkingOut}
            onClick={checkout}
          >
            {checkingOut ? 'Processing...' : 'Checkout'}
          </button>
        </div>
      )}
    </div>
  );
}
