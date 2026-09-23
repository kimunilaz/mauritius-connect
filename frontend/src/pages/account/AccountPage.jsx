import { useAuth } from '../../context/AuthContext.jsx';
import TenantDashboard from './TenantDashboard.jsx';
import OwnerHub from '../owner/OwnerHub.jsx';
import AdminDashboard from './AdminDashboard.jsx';

export default function AccountPage() {
  const { profile } = useAuth();
  if (profile.role === 'TENANT') return <TenantDashboard />;
  if (['LANDLORD', 'AGENT'].includes(profile.role)) return <OwnerHub />;
  return <AdminDashboard />;
}
