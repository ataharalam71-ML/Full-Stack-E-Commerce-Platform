import { Link } from 'react-router-dom';
import { goUrl } from '../api';
import { money } from '../format';
import { useSite } from '../context/SiteContext';

/** One product tile. The buy button always goes through the backend redirect. */
export default function DealCard({ deal }) {
  const { stores } = useSite();
  const store = stores.find((s) => s.key === deal.store) || { label: deal.store, color: '#888' };
  const saving = deal.mrp && deal.mrp > deal.price ? deal.mrp - deal.price : 0;

  return (
    <article className="deal-card">
      <Link to={`/deal/${deal.slug}`} className="deal-thumb">
        {deal.image_url ? (
          <img src={deal.image_url} alt={deal.title} loading="lazy" />
        ) : (
          <div className="no-img">🛍️</div>
        )}
        {deal.discount_percent > 0 && <span className="off-badge">{deal.discount_percent}% OFF</span>}
        <span className="store-badge">
          <span className="dot" style={{ background: store.color }} />
          {store.label}
        </span>
      </Link>

      <div className="deal-body">
        <span className="cat">{deal.category}</span>
        <Link to={`/deal/${deal.slug}`} className="title">
          {deal.title}
        </Link>

        <div className="price-row">
          <span className="price">{money(deal.price)}</span>
          {saving > 0 && <span className="mrp">{money(deal.mrp)}</span>}
        </div>
        {saving > 0 && <span className="save">You save {money(saving)}</span>}

        <div className="row" style={{ gap: 10 }}>
          {deal.rating ? (
            <span className="rating">
              <span className="star">★</span> {deal.rating.toFixed(1)}
            </span>
          ) : null}
          {deal.clicks > 0 && <span className="rating">{deal.clicks} clicks</span>}
        </div>

        {deal.coupon_code && <span className="coupon">Code: {deal.coupon_code}</span>}

        <div className="deal-actions">
          <a
            className={`btn btn-buy btn-block ${deal.store}`}
            href={goUrl(deal.id)}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
          >
            Buy on {store.label}
          </a>
        </div>
      </div>
    </article>
  );
}
