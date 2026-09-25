import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import SuperAdminConsole from '../../components/superadmin/SuperAdminConsole';

/**
 * Web home for the platform Super Admin — the same console the desktop app
 * ships (components/superadmin is a straight port of the desktop renderer
 * folder; keep the two in sync when the desktop console changes).
 *
 * Guards: unauthenticated → /login; any non-SUPER_ADMIN role → their normal
 * dashboard. Super admins landing on /dashboard/* are bounced here by the
 * redirect in App.tsx, so this page is the only shell they ever see.
 */
export default function SuperAdminPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isLoading = useAuthStore((state) => state.isLoading);
  const logout = useAuthStore((state) => state.logout);

  if (isLoading || !isInitialized) return null;
  if (!accessToken) return <Navigate to="/login" replace />;
  // While /me is still resolving the user there is nothing to render yet.
  if (!user) return null;
  if (String(user.role || '').toUpperCase() !== 'SUPER_ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="h-screen w-full overflow-hidden">
      <SuperAdminConsole user={user} onLogout={handleLogout} />
    </div>
  );
}
