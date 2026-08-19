import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Only an authenticated admin can reach /admin. */
export function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}
