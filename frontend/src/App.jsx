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
import PublicListingDetailPage from './pages/public/PublicListingDetailPage.jsx';
import PublicListingSearchPage from './pages/public/PublicListingSearchPage.jsx';
import LandlordProfilePage from './pages/profile/LandlordProfilePage.jsx';
import TenantProfilePage from './pages/profile/TenantProfilePage.jsx';
import CreatePropertyPage from './pages/property/CreatePropertyPage.jsx';
import PropertyDetailPage from './pages/property/PropertyDetailPage.jsx';
import PropertyListPage from './pages/property/PropertyListPage.jsx';
import CreateListingPage from './pages/listing/CreateListingPage.jsx';
import ListingDetailPage from './pages/listing/ListingDetailPage.jsx';
import ListingListPage from './pages/listing/ListingListPage.jsx';
import SavedListingListPage from './pages/saved/SavedListingListPage.jsx';
import ApplicationDraftPage from './pages/application/ApplicationDraftPage.jsx';
import TenantApplicationListPage from './pages/application/TenantApplicationListPage.jsx';
import TenantApplicationDetailPage from './pages/application/TenantApplicationDetailPage.jsx';
import LandlordApplicantListPage from './pages/application/LandlordApplicantListPage.jsx';
import LandlordApplicationDetailPage from './pages/application/LandlordApplicationDetailPage.jsx';
import ConversationListPage from './pages/conversation/ConversationListPage.jsx';
import ConversationDetailPage from './pages/conversation/ConversationDetailPage.jsx';
import NotificationPage from './pages/notification/NotificationPage.jsx';
import AdminReportListPage from './pages/admin/AdminReportListPage.jsx';
import AdminReportDetailPage from './pages/admin/AdminReportDetailPage.jsx';
import AdminVerificationListPage from './pages/admin/AdminVerificationListPage.jsx';
import AdminVerificationDetailPage from './pages/admin/AdminVerificationDetailPage.jsx';
import AdminListingListPage from './pages/admin/AdminListingListPage.jsx';
import AdminListingDetailPage from './pages/admin/AdminListingDetailPage.jsx';
import AdminUserListPage from './pages/admin/AdminUserListPage.jsx';
import AdminUserDetailPage from './pages/admin/AdminUserDetailPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/listings" element={<PublicListingSearchPage />} />
      <Route
        path="/listings/:listingId"
        element={<PublicListingDetailPage />}
      />
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
        path="/conversations"
        element={
          <ProtectedRoute allowedRoles={['TENANT', 'LANDLORD']}>
            <ConversationListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/conversations/:conversationId"
        element={
          <ProtectedRoute allowedRoles={['TENANT', 'LANDLORD']}>
            <ConversationDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute allowedRoles={['TENANT', 'LANDLORD']}>
            <NotificationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/listings"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminListingListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/listings/:listingId"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminListingDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminUserListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users/:userId"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminUserDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminReportListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports/:reportId"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminReportDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/verifications"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminVerificationListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/verifications/:verificationId"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminVerificationDetailPage />
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
        path="/tenant/saved-listings"
        element={
          <ProtectedRoute allowedRoles={['TENANT']}>
            <SavedListingListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/listings/:listingId/apply"
        element={
          <ProtectedRoute allowedRoles={['TENANT']}>
            <ApplicationDraftPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tenant/applications"
        element={
          <ProtectedRoute allowedRoles={['TENANT']}>
            <TenantApplicationListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tenant/applications/:applicationId"
        element={
          <ProtectedRoute allowedRoles={['TENANT']}>
            <TenantApplicationDetailPage />
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
      <Route
        path="/landlord/properties"
        element={
          <ProtectedRoute allowedRoles={['LANDLORD']}>
            <PropertyListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/landlord/properties/new"
        element={
          <ProtectedRoute allowedRoles={['LANDLORD']}>
            <CreatePropertyPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/landlord/properties/:propertyId"
        element={
          <ProtectedRoute allowedRoles={['LANDLORD']}>
            <PropertyDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/landlord/listings"
        element={
          <ProtectedRoute allowedRoles={['LANDLORD']}>
            <ListingListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/landlord/listings/new"
        element={
          <ProtectedRoute allowedRoles={['LANDLORD']}>
            <CreateListingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/landlord/listings/:listingId"
        element={
          <ProtectedRoute allowedRoles={['LANDLORD']}>
            <ListingDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/landlord/listings/:listingId/applications"
        element={
          <ProtectedRoute allowedRoles={['LANDLORD']}>
            <LandlordApplicantListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/landlord/applications/:applicationId"
        element={
          <ProtectedRoute allowedRoles={['LANDLORD']}>
            <LandlordApplicationDetailPage />
          </ProtectedRoute>
        }
      />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
