import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { site } = useSite();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [term, setTerm] = useState(searchParams.get('q') || '');

  // Keep the box in sync when the URL changes (back button, category links, etc).
  useEffect(() => {
    setTerm(searchParams.get('q') || '');
  }, [searchParams]);

  const submitSearch = (e) => {
    e.preventDefault();
    navigate(term.trim() ? `/?q=${encodeURIComponent(term.trim())}` : '/');
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">%</span>
          {site.name}
        </Link>

        {!location.pathname.startsWith('/admin') && (
          <form className="search-inline" onSubmit={submitSearch}>
            <span className="icon">🔍</span>
            <input
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search deals, brands, categories…"
              aria-label="Search deals"
            />
          </form>
        )}

        <nav>
          <NavLink to="/" end>
            Deals
          </NavLink>
          <NavLink to="/about">About</NavLink>
          {user ? (
            <>
              <NavLink to="/admin">Admin</NavLink>
              <button onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <NavLink to="/login">Admin</NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
