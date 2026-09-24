import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { SnowBilling } from '../../components/snow/SnowBilling';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const Billing: React.FC = () => {
  const { user } = useAuthStore();
  const [billingInfo, setBillingInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBilling = async () => {
      try {
        const billingUrl = import.meta.env.VITE_BILLING_URL || import.meta.env.VITE_API_URL;
        const { data } = await api.get(`${billingUrl}/billing/current`);
        setBillingInfo(data);
      } catch (err) {
        console.error('Failed to fetch billing status', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBilling();
  }, []);

  const handleUpgrade = () => {
    // Navigate to pricing or open checkout
    window.location.href = '/pricing';
  };

  const handleManagePortal = async () => {
    try {
      const billingUrl = import.meta.env.VITE_BILLING_URL || import.meta.env.VITE_API_URL;
      const { data } = await api.post(`${billingUrl}/billing/portal`);
      window.location.href = data.url;
    } catch (err) {
      console.error('Failed to open billing portal', err);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Billing">
        <div className="w-full flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-[rgba(28,28,28,0.1)] border-t-[#1C1C1C] animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Billing & Subscription">
      <div className="w-full animate-in fade-in duration-700">
        <SnowBilling user={user} />
      </div>
    </DashboardLayout>
  );
};

export default Billing;
