import { Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import PublicOnlyRoute from './components/auth/PublicOnlyRoute.jsx';
import SessionRoute from './components/auth/SessionRoute.jsx';
import AccountPage from './pages/account/AccountPage.jsx';
import AuthCallbackPage from './pages/auth/AuthCallbackPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import OnboardingPage from './pages/auth/OnboardingPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import HomePage from './pages/public/HomePage.jsx';
import NotFoundPage from './pages/public/NotFoundPage.jsx';
import LandlordProfilePage from './pages/profile/LandlordProfilePage.jsx';
import TenantProfilePage from './pages/profile/TenantProfilePage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnlyRoute>
            <ForgotPasswordPage />
          </PublicOnlyRoute>
        }
      />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route
        path="/reset-password"
        element={
          <SessionRoute>
            <ResetPasswordPage />
          </SessionRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute onboarding>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tenant/profile"
        element={
          <ProtectedRoute allowedRoles={['TENANT']}>
            <TenantProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/landlord/profile"
        element={
          <ProtectedRoute allowedRoles={['LANDLORD']}>
            <LandlordProfilePage />
          </ProtectedRoute>
        }
      />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
