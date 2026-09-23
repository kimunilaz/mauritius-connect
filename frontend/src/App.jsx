import OwnersPage, { OwnerDetailPage } from './pages/agent/OwnersPage.jsx';
import OwnerHub, {
  PortfolioPage,
  GlobalOperationPage,
} from './pages/owner/OwnerHub.jsx';
import Property360 from './pages/owner/Property360.jsx';
import OwnerReports from './pages/owner/OwnerReports.jsx';
import TenantHome from './pages/owner/TenantHome.jsx';
import { lazy, Suspense } from 'react';
import PageLoading from './components/common/PageLoading.jsx';
import { Route, Routes } from 'react-router-dom';
import WorkspaceLayout from './components/common/WorkspaceLayout.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import PublicOnlyRoute from './components/auth/PublicOnlyRoute.jsx';
import SessionRoute from './components/auth/SessionRoute.jsx';
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
const AccountPage = lazy(() => import('./pages/account/AccountPage.jsx'));
const LandlordVerificationPage = lazy(
  () => import('./pages/profile/LandlordVerificationPage.jsx'),
);
const LandlordProfilePage = lazy(
  () => import('./pages/profile/LandlordProfilePage.jsx'),
);
const TenantProfilePage = lazy(
  () => import('./pages/profile/TenantProfilePage.jsx'),
);
const CreatePropertyPage = lazy(
  () => import('./pages/property/CreatePropertyPage.jsx'),
);
const PropertyDetailPage = lazy(
  () => import('./pages/property/PropertyDetailPage.jsx'),
);
const PropertyListPage = lazy(
  () => import('./pages/property/PropertyListPage.jsx'),
);
const CreateListingPage = lazy(
  () => import('./pages/listing/CreateListingPage.jsx'),
);
const ListingDetailPage = lazy(
  () => import('./pages/listing/ListingDetailPage.jsx'),
);
const ListingListPage = lazy(
  () => import('./pages/listing/ListingListPage.jsx'),
);
const SavedListingListPage = lazy(
  () => import('./pages/saved/SavedListingListPage.jsx'),
);
const ApplicationDraftPage = lazy(
  () => import('./pages/application/ApplicationDraftPage.jsx'),
);
const TenantApplicationListPage = lazy(
  () => import('./pages/application/TenantApplicationListPage.jsx'),
);
const TenantApplicationDetailPage = lazy(
  () => import('./pages/application/TenantApplicationDetailPage.jsx'),
);
const LandlordApplicantListPage = lazy(
  () => import('./pages/application/LandlordApplicantListPage.jsx'),
);
const LandlordApplicationDetailPage = lazy(
  () => import('./pages/application/LandlordApplicationDetailPage.jsx'),
);
const ConversationListPage = lazy(
  () => import('./pages/conversation/ConversationListPage.jsx'),
);
const ConversationDetailPage = lazy(
  () => import('./pages/conversation/ConversationDetailPage.jsx'),
);
const NotificationPage = lazy(
  () => import('./pages/notification/NotificationPage.jsx'),
);
const AdminReportListPage = lazy(
  () => import('./pages/admin/AdminReportListPage.jsx'),
);
const AdminReportDetailPage = lazy(
  () => import('./pages/admin/AdminReportDetailPage.jsx'),
);
const AdminVerificationListPage = lazy(
  () => import('./pages/admin/AdminVerificationListPage.jsx'),
);
const AdminVerificationDetailPage = lazy(
  () => import('./pages/admin/AdminVerificationDetailPage.jsx'),
);
const AdminListingListPage = lazy(
  () => import('./pages/admin/AdminListingListPage.jsx'),
);
const AdminListingDetailPage = lazy(
  () => import('./pages/admin/AdminListingDetailPage.jsx'),
);
const AdminUserListPage = lazy(
  () => import('./pages/admin/AdminUserListPage.jsx'),
);
const AdminUserDetailPage = lazy(
  () => import('./pages/admin/AdminUserDetailPage.jsx'),
);

export default function App() {
  return (
    <WorkspaceLayout>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route
            path="/agent/owners"
            element={
              <ProtectedRoute allowedRoles={['AGENT']}>
                <OwnersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agent/owners/:ownerId"
            element={
              <ProtectedRoute allowedRoles={['AGENT']}>
                <OwnerDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner"
            element={
              <ProtectedRoute allowedRoles={['LANDLORD', 'AGENT']}>
                <OwnerHub />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/properties"
            element={
              <ProtectedRoute allowedRoles={['LANDLORD', 'AGENT']}>
                <PortfolioPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/properties/:propertyId"
            element={
              <ProtectedRoute allowedRoles={['LANDLORD', 'AGENT']}>
                <Property360 />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/reports"
            element={
              <ProtectedRoute allowedRoles={['LANDLORD', 'AGENT']}>
                <OwnerReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/:domain"
            element={
              <ProtectedRoute allowedRoles={['LANDLORD', 'AGENT']}>
                <GlobalOperationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tenant/home"
            element={
              <ProtectedRoute allowedRoles={['TENANT']}>
                <TenantHome />
              </ProtectedRoute>
            }
          />
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
              <ProtectedRoute allowedRoles={['TENANT', 'LANDLORD', 'AGENT']}>
                <ConversationListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/conversations/:conversationId"
            element={
              <ProtectedRoute allowedRoles={['TENANT', 'LANDLORD', 'AGENT']}>
                <ConversationDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute allowedRoles={['TENANT', 'LANDLORD', 'AGENT']}>
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
              <ProtectedRoute allowedRoles={['LANDLORD', 'AGENT']}>
                <LandlordProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/landlord/properties"
            element={
              <ProtectedRoute allowedRoles={['LANDLORD', 'AGENT']}>
                <PropertyListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/landlord/verifications"
            element={
              <ProtectedRoute allowedRoles={['LANDLORD', 'AGENT']}>
                <LandlordVerificationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/landlord/properties/new"
            element={
              <ProtectedRoute allowedRoles={['LANDLORD', 'AGENT']}>
                <CreatePropertyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/landlord/properties/:propertyId"
            element={
              <ProtectedRoute allowedRoles={['LANDLORD', 'AGENT']}>
                <PropertyDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/landlord/listings"
            element={
              <ProtectedRoute allowedRoles={['LANDLORD', 'AGENT']}>
                <ListingListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/landlord/listings/new"
            element={
              <ProtectedRoute allowedRoles={['LANDLORD', 'AGENT']}>
                <CreateListingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/landlord/listings/:listingId"
            element={
              <ProtectedRoute allowedRoles={['LANDLORD', 'AGENT']}>
                <ListingDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/landlord/listings/:listingId/applications"
            element={
              <ProtectedRoute allowedRoles={['LANDLORD', 'AGENT']}>
                <LandlordApplicantListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/landlord/applications/:applicationId"
            element={
              <ProtectedRoute allowedRoles={['LANDLORD', 'AGENT']}>
                <LandlordApplicationDetailPage />
              </ProtectedRoute>
            }
          />
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </WorkspaceLayout>
  );
}
