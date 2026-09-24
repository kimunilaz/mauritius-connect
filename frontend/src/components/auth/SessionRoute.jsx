import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { AuthLoading } from './AuthStatus.jsx';

export default function SessionRoute({ children }) {
  const location = useLocation();
  const { isAuthenticated, loading, recoveryPending } = useAuth();

  if (loading) {
    return <AuthLoading />;
  }

  if (!isAuthenticated || !recoveryPending) {
    return (
      <Navigate
        to="/forgot-password"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
}
