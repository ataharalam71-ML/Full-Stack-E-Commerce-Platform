import { Link } from 'react-router-dom';
import { useSite } from '../context/SiteContext';

export default function Footer() {
  const { site } = useSite();

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="stack" style={{ gap: 10, maxWidth: '46ch' }}>
          <strong>{site.name}</strong>
          <p className="fine" style={{ margin: 0 }}>
            Handpicked price drops from Amazon and Flipkart. You buy on the retailer's own site
            at their price, and the price at checkout is always the one that applies. As an
            affiliate we may earn a commission on qualifying purchases, at no cost to you.
          </p>
        </div>
        <nav>
          <Link to="/">Deals</Link>
          <Link to="/about">About</Link>
          <Link to="/affiliate-disclosure">Affiliate Disclosure</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/login">Admin</Link>
        </nav>
      </div>
    </footer>
  );
}
