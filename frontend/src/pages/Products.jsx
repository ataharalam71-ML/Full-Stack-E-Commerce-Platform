import { useEffect, useState, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

function formatPrice(cents, currency = 'INR') {
  const amount = cents / 100;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);
}

export default function Products({ onCartChange }) {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/products', { params: { search, category } });
      setProducts(data.products);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 300); // debounce search typing
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const addToCart = async (productId) => {
    if (!user) {
      setError('Please log in to add items to your cart.');
      return;
    }
    setMessage('');
    setError('');
    try {
      await api.post('/cart/items', { product_id: productId, quantity: 1 });
      setMessage('Added to cart!');
      onCartChange?.();
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not add to cart');
    }
  };

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];

  return (
    <div>
      <h1>Products</h1>
      {message && <div className="success-box">{message}</div>}
      {error && <div className="error-box">{error}</div>}

      <div className="toolbar">
        <input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-dim)' }}>Loading...</p>
      ) : products.length === 0 ? (
        <div className="empty-state">No products found.</div>
      ) : (
        <div className="grid">
          {products.map((p) => (
            <div key={p.id} className="card product-card">
              <div className="name">{p.name}</div>
              {p.category && <div className="category">{p.category}</div>}
              <div className="price">{formatPrice(p.price_cents, p.currency)}</div>
              <div className="stock">{p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</div>
              <button
                className="btn btn-primary"
                disabled={p.stock === 0}
                onClick={() => addToCart(p.id)}
              >
                Add to cart
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
