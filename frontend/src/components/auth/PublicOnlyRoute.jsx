import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { AuthLoading } from './AuthStatus.jsx';

export default function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading, onboardingRequired, recoveryPending } =
    useAuth();

  if (loading) {
    return <AuthLoading />;
  }

  if (recoveryPending) {
    return <Navigate to="/reset-password" replace />;
  }

  if (isAuthenticated) {
    return (
      <Navigate to={onboardingRequired ? '/onboarding' : '/account'} replace />
    );
  }

  return children;
}
