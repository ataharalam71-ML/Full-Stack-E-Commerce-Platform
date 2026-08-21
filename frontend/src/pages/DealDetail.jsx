import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errMsg, goUrl } from '../api';
import DealCard from '../components/DealCard';
import { money, shortDate } from '../format';
import { useSite } from '../context/SiteContext';

export default function DealDetail() {
  const { slug } = useParams();
  const { site, stores } = useSite();
  const [deal, setDeal] = useState(null);
  const [related, setRelated] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    window.scrollTo(0, 0);

    api
      .get(`/deals/${encodeURIComponent(slug)}`)
      .then(({ data }) => {
        if (!alive) return;
        setDeal(data.deal);
        setRelated(data.related);
        document.title = `${data.deal.title} — ${site.name}`;
      })
      .catch((err) => alive && setError(errMsg(err, 'Deal not found')))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [slug, site.name]);

  if (loading) {
    return (
      <div className="detail">
        <div className="skeleton" style={{ aspectRatio: '1 / 1' }} />
        <div className="stack" style={{ gap: 14 }}>
          <div className="skeleton" style={{ height: 32 }} />
          <div className="skeleton" style={{ height: 20, width: '60%' }} />
          <div className="skeleton" style={{ height: 90 }} />
        </div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="empty-state">
        <div className="big">😕</div>
        <h3>{error || 'Deal not found'}</h3>
        <p>It may have been removed or expired.</p>
        <Link className="btn btn-primary" to="/">
          Browse all deals
        </Link>
      </div>
    );
  }

  const store = stores.find((s) => s.key === deal.store) || { label: deal.store, color: '#888' };
  const saving = deal.mrp && deal.mrp > deal.price ? deal.mrp - deal.price : 0;

  return (
    <>
      <nav className="breadcrumb">
        <Link to="/">Deals</Link> {' / '}
        <Link to={`/?category=${encodeURIComponent(deal.category)}`}>{deal.category}</Link>
        {' / '}
        {deal.title}
      </nav>

      <div className="detail">
        <div>
          {deal.image_url ? (
            <img className="detail-img" src={deal.image_url} alt={deal.title} />
          ) : (
            <div className="detail-img" style={{ display: 'grid', placeItems: 'center', fontSize: '3rem' }}>
              🛍️
            </div>
          )}
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <div className="row">
            <span className={`pill pill-${deal.store}`}>{store.label}</span>
            {deal.brand && <span className="muted">{deal.brand}</span>}
            {deal.rating ? (
              <span className="rating">
                <span className="star">★</span> {deal.rating.toFixed(1)}
              </span>
            ) : null}
          </div>

          <h1>{deal.title}</h1>

          <div className="price-row">
            <span className="price">{money(deal.price)}</span>
            {saving > 0 && (
              <>
                <span className="mrp">{money(deal.mrp)}</span>
                <span className="save">
                  {deal.discount_percent}% off · save {money(saving)}
                </span>
              </>
            )}
          </div>

          {deal.coupon_code && (
            <div>
              <span className="coupon">Apply coupon: {deal.coupon_code}</span>
            </div>
          )}

          <a
            className={`btn btn-buy ${deal.store}`}
            style={{ padding: '13px 22px', fontSize: '1rem', alignSelf: 'flex-start' }}
            href={goUrl(deal.id)}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
          >
            Buy on {store.label} →
          </a>

          {deal.description && <p style={{ marginBottom: 0 }}>{deal.description}</p>}

          <div className="muted">
            Added {shortDate(deal.created_at)}
            {deal.clicks > 0 && ` · ${deal.clicks} people clicked through`}
          </div>

          <ul className="buy-notes">
            <li>Same price as going to {store.label} yourself — nothing is added.</li>
            <li>{store.label} handles payment, delivery, returns and warranty.</li>
            <li>Prices move fast. Whatever {store.label} shows at checkout is what applies.</li>
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section>
          <div className="section-head">
            <h2>You may also like</h2>
          </div>
          <div className="deal-grid">
            {related.map((r) => (
              <DealCard key={r.id} deal={r} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
