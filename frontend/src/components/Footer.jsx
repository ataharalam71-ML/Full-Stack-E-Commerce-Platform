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
            {site.name} is a participant in the Amazon Associates, Flipkart Affiliate and Meesho
            partner programmes. We earn a commission when you buy through our links — at no extra
            cost to you. Prices and availability shown are indicative and change on the retailer's
            site.
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
