import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { AccountUnavailable, AuthLoading } from './AuthStatus.jsx';

export default function ProtectedRoute({
  children,
  onboarding = false,
  allowedRoles,
}) {
  const location = useLocation();
  const {
    isAuthenticated,
    loading,
    onboardingRequired,
    profile,
    profileError,
  } = useAuth();

  if (loading) {
    return <AuthLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (profileError) {
    return <AccountUnavailable message={profileError.message} />;
  }

  if (onboarding) {
    return profile ? <Navigate to="/account" replace /> : children;
  }

  if (onboardingRequired) {
    return <Navigate to="/onboarding" replace />;
  }

  if (profile && allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/account" replace />;
  }

  return profile ? children : <AuthLoading />;
}
