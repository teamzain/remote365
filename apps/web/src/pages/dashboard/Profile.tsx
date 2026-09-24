import React from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { SnowProfile } from '../../components/snow/SnowProfile';
import { useAuthStore } from '../../store/authStore';

const Profile: React.FC = () => {
  const { user, logout } = useAuthStore();

  return (
    <DashboardLayout title="Account Identity">
      <div className="w-full animate-in fade-in duration-700">
        <SnowProfile user={user} logout={logout} />
      </div>
    </DashboardLayout>
  );
};

export default Profile;
