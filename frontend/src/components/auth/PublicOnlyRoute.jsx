import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { AuthLoading } from './AuthStatus.jsx';

export default function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading, onboardingRequired } = useAuth();

  if (loading) {
    return <AuthLoading />;
  }

  if (isAuthenticated) {
    return (
      <Navigate to={onboardingRequired ? '/onboarding' : '/account'} replace />
    );
  }

  return children;
}
