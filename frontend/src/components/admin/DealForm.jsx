import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api';
import { useSite } from '../../context/SiteContext';

const EMPTY = {
  title: '',
  affiliate_url: '',
  store: '',
  price: '',
  mrp: '',
  image_url: '',
  category: '',
  brand: '',
  rating: '',
  coupon_code: '',
  description: '',
  is_featured: false,
  is_active: true,
};

// Same host list the backend enforces — used only to pre-fill the store dropdown.
const STORE_HINTS = [
  { store: 'amazon', match: ['amazon.', 'amzn.'] },
  { store: 'flipkart', match: ['flipkart.', 'fkrt.'] },
  { store: 'meesho', match: ['meesho.'] },
];

const guessStore = (url) =>
  STORE_HINTS.find((h) => h.match.some((m) => url.toLowerCase().includes(m)))?.store || '';

/**
 * Add / edit form. Pass `deal` to edit an existing one, or nothing to add.
 * The same component covers both so the fields can never drift apart.
 */
export default function DealForm({ deal, categories = [], onSaved, onCancel }) {
  const { stores } = useSite();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const isEdit = Boolean(deal?.id);

  useEffect(() => {
    setError('');
    setOkMsg('');
    if (!deal) {
      setForm(EMPTY);
      return;
    }
    // Nulls from the API would make the inputs uncontrolled — coerce to ''.
    setForm({
      ...EMPTY,
      ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, deal[k] ?? EMPTY[k]])),
      is_featured: Boolean(deal.is_featured),
      is_active: Boolean(deal.is_active),
    });
  }, [deal]);

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => {
      // Pasting a link fills in the store automatically.
      if (key === 'affiliate_url' && !prev.store) {
        return { ...prev, affiliate_url: value, store: guessStore(value) };
      }
      return { ...prev, [key]: value };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setOkMsg('');
    setSaving(true);

    try {
      const payload = { ...form };
      // Send empty optional fields as null so the API stores "not set", not "".
      ['mrp', 'rating', 'image_url', 'brand', 'coupon_code', 'description'].forEach((k) => {
        if (payload[k] === '') payload[k] = null;
      });
      if (!payload.store) delete payload.store; // let the backend detect it from the link

      const { data } = isEdit
        ? await api.put(`/admin/deals/${deal.id}`, payload)
        : await api.post('/admin/deals', payload);

      setOkMsg(isEdit ? 'Deal updated.' : `"${data.deal.title}" is live.`);
      if (!isEdit) setForm(EMPTY);
      onSaved?.(data.deal);
    } catch (err) {
      setError(errMsg(err, 'Could not save the deal'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="spread" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>{isEdit ? `Edit deal #${deal.id}` : 'Add a deal'}</h2>
        {isEdit && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            Cancel edit
          </button>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}
      {okMsg && <div className="success-box">{okMsg}</div>}

      <label htmlFor="title">Product title *</label>
      <input
        id="title"
        value={form.title}
        onChange={set('title')}
        placeholder="boAt Airdopes 141 Wireless Earbuds"
        required
      />

      <label htmlFor="affiliate_url">Affiliate link *</label>
      <input
        id="affiliate_url"
        value={form.affiliate_url}
        onChange={set('affiliate_url')}
        placeholder="https://www.amazon.in/dp/B09N3ZNHTY"
        required
      />
      <p className="field-hint">
        Paste the product link from Amazon / Flipkart / Meesho, or a shortlink from EarnKaro,
        INRDeals or Cuelinks. Your affiliate ID is added automatically on click.
      </p>

      <div className="form-grid">
        <div>
          <label htmlFor="store">Store</label>
          <select id="store" value={form.store} onChange={set('store')}>
            <option value="">Detect from link</option>
            {stores.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="category">Category</label>
          <input
            id="category"
            list="category-options"
            value={form.category}
            onChange={set('category')}
            placeholder="Mobiles"
          />
          <datalist id="category-options">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="form-grid">
        <div>
          <label htmlFor="price">Deal price (₹) *</label>
          <input id="price" type="number" min="0" step="1" value={form.price} onChange={set('price')} required />
        </div>
        <div>
          <label htmlFor="mrp">MRP (₹)</label>
          <input id="mrp" type="number" min="0" step="1" value={form.mrp} onChange={set('mrp')} />
        </div>
      </div>

      <div className="form-grid">
        <div>
          <label htmlFor="brand">Brand</label>
          <input id="brand" value={form.brand} onChange={set('brand')} placeholder="boAt" />
        </div>
        <div>
          <label htmlFor="rating">Rating (0-5)</label>
          <input
            id="rating"
            type="number"
            min="0"
            max="5"
            step="0.1"
            value={form.rating}
            onChange={set('rating')}
          />
        </div>
      </div>

      <label htmlFor="image_url">Image URL</label>
      <input
        id="image_url"
        value={form.image_url}
        onChange={set('image_url')}
        placeholder="https://m.media-amazon.com/images/I/xxxx.jpg"
      />
      <p className="field-hint">
        Right-click the product photo on the store page → "Copy image address".
      </p>

      <label htmlFor="coupon_code">Coupon code</label>
      <input id="coupon_code" value={form.coupon_code} onChange={set('coupon_code')} placeholder="SAVE200" />

      <label htmlFor="description">Why it is a good deal</label>
      <textarea
        id="description"
        value={form.description}
        onChange={set('description')}
        placeholder="42H playtime, ENx noise cancellation. Lowest price in 3 months."
      />

      <div className="checkbox-row">
        <input id="is_featured" type="checkbox" checked={form.is_featured} onChange={set('is_featured')} />
        <label htmlFor="is_featured">Feature in "Today's top picks"</label>
      </div>
      <div className="checkbox-row">
        <input id="is_active" type="checkbox" checked={form.is_active} onChange={set('is_active')} />
        <label htmlFor="is_active">Visible on the site</label>
      </div>

      <button className="btn btn-primary btn-block" disabled={saving}>
        {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add deal'}
      </button>
    </form>
  );
}
