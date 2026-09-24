import React, { useState, useRef, useEffect } from 'react';
import logo from '../../logo.png';
import {
  Link,
  LayoutGrid,
  Monitor,
  Settings,
  CreditCard,
  User,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Users,
  MessageSquare,
  ShoppingBag,
  PieChart,
  Radio,
  LifeBuoy,
  LogOut,
  Building2,
  TrendingUp,
  Zap
} from 'lucide-react';
import { hasUserFeature, hasUserPermission } from '../lib/permissions';

type SidebarView = 'home' | 'dashboard' | 'devices' | 'settings' | 'host' | 'billing' | 'profile' | 'support' | 'members' | 'organizations' | 'analytics' | 'connect' | 'org-detail' | 'meetings' | 'support_workstation' | 'end_user_home';

interface SnowSidebarProps {
  currentView: SidebarView;
  selectedDevice: any;
  setCurrentView: (view: SidebarView) => void;
  setSelectedDevice: (device: any) => void;
  handleLogout: () => void;
  user: any;
  isOpen?: boolean;
  onClose?: () => void;
}

export const SnowSidebar: React.FC<SnowSidebarProps> = ({
  currentView,
  selectedDevice,
  setCurrentView,
  setSelectedDevice,
  handleLogout,
  user,
  isOpen,
  onClose
}) => {
  const isDashboard = currentView === 'dashboard' && !selectedDevice;
  const isDevices = currentView === 'devices' && !selectedDevice;
  const isSettings = currentView === 'settings' && !selectedDevice;
  const isHost = currentView === 'host' && !selectedDevice;
  const isBilling = currentView === 'billing' && !selectedDevice;
  const isProfile = currentView === 'profile' && !selectedDevice;
  const isSupport = currentView === 'support' && !selectedDevice;
  const isOrgs = currentView === 'organizations' && !selectedDevice;
  const isAnalytics = currentView === 'analytics' && !selectedDevice;
  const isSessions = currentView === 'support_workstation' && !selectedDevice;
  const isGetHelp = currentView === 'end_user_home' && !selectedDevice;

  const userRole = String(user?.role || 'VIEWER').toUpperCase();
  const canManageOrgs = userRole === 'SUPER_ADMIN';
  // Effective per-user permissions (owner-editable), not the raw role.
  const canViewBilling = hasUserPermission(user, 'billing:view') && hasUserFeature(user, 'licenses');
  const showSupportWorkstation = hasUserPermission(user, 'sessions:viewHistoryAll');
  const showEndUserHome = userRole === 'VIEWER';

  const initials = user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : (user?.email ? user.email.substring(0, 2).toUpperCase() : 'U');
  const formattedRole = user?.role?.replace(/_/g, ' ') || 'VIEWER';

  const navItemClass = (isActive: boolean) => `
    relative flex items-center w-full h-8 px-3 rounded-lg transition-all duration-200 group
    ${isActive ? 'bg-amber-50 shadow-sm border border-amber-100/50' : 'hover:bg-[rgba(28,28,28,0.02)]'}
  `;

  const textClass = (isActive: boolean) => `
    text-sm font-semibold leading-5 transition-colors whitespace-nowrap
    ${isActive ? 'text-[#D4A017]' : 'text-[#1C1C1C] opacity-80 group-hover:opacity-100'}
  `;

  const indicatorClass = (isActive: boolean) => `
    absolute left-0 top-2 w-1 h-4 bg-[#D4A017] rounded-r-lg transition-opacity
    ${isActive ? 'opacity-100' : 'opacity-0'}
  `;

  return (
    <aside className={`fixed left-0 top-0 bottom-0 w-[240px] bg-white border-r border-[rgba(28,28,28,0.08)] flex flex-col font-lato z-30 shadow-sm overflow-hidden transition-transform duration-300 md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>

      {/* Brand Logo Section */}
      <div className="flex items-center gap-3 px-5 pt-8 mb-10 group cursor-pointer" onClick={() => setCurrentView('dashboard')}>
        <div className="w-10 h-10 rounded-xl bg-[#D4A017] flex items-center justify-center shadow-lg shadow-amber-500/20 overflow-hidden border border-white/5">
          <img src={logo} alt="Sync" className="w-8 h-8 object-contain" />
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-bold text-[#1C1C1C] leading-none tracking-tighter">Remote365</span>
        </div>
      </div>

      {/* Main Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 custom-scrollbar pb-10 space-y-9">


        {/* Dashboards Section */}
        <div className="flex flex-col gap-2">
          <span className="px-3 text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-[0.1em]">Dashboards</span>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => { setCurrentView('dashboard'); setSelectedDevice(null); }}
              className={navItemClass(isDashboard)}
            >
              <div className={indicatorClass(isDashboard)} />
              <div className="flex items-center gap-2.5 min-w-0">
                <PieChart size={16} className={isDashboard ? 'text-[#D4A017]' : 'text-[rgba(28,28,28,0.4)]'} />
                <span className={textClass(isDashboard)}>Overview</span>
              </div>
            </button>

            <button
              onClick={() => { setCurrentView('host'); setSelectedDevice(null); }}
              className={navItemClass(isHost)}
            >
              <div className={indicatorClass(isHost)} />
              <div className="flex items-center gap-2.5 min-w-0">
                <Radio size={16} className={isHost ? 'text-[#D4A017]' : 'text-[rgba(28,28,28,0.4)]'} />
                <span className={textClass(isHost)}>Host Device</span>
              </div>
            </button>

            {showSupportWorkstation && (
              <button
                onClick={() => { setCurrentView('support_workstation'); setSelectedDevice(null); }}
                className={navItemClass(isSessions)}
              >
                <div className={indicatorClass(isSessions)} />
                <div className="flex items-center gap-2.5 min-w-0">
                  <LifeBuoy size={16} className={isSessions ? 'text-[#D4A017]' : 'text-[rgba(28,28,28,0.4)]'} />
                  <span className={textClass(isSessions)}>Sessions</span>
                </div>
              </button>
            )}

            {showEndUserHome && (
              <button
                onClick={() => { setCurrentView('end_user_home'); setSelectedDevice(null); }}
                className={navItemClass(isGetHelp)}
              >
                <div className={indicatorClass(isGetHelp)} />
                <div className="flex items-center gap-2.5 min-w-0">
                  <LifeBuoy size={16} className={isGetHelp ? 'text-[#D4A017]' : 'text-[rgba(28,28,28,0.4)]'} />
                  <span className={textClass(isGetHelp)}>Get Help</span>
                </div>
              </button>
            )}

            <button
              onClick={() => { setCurrentView('connect'); setSelectedDevice(null); }}
              className={navItemClass(currentView === 'connect')}
            >
              <div className={indicatorClass(currentView === 'connect')} />
              <div className="flex items-center gap-2.5 min-w-0">
                <Zap size={16} className={currentView === 'connect' ? 'text-[#D4A017]' : 'text-[rgba(28,28,28,0.4)]'} />
                <span className={textClass(currentView === 'connect')}>Quick Connect</span>
              </div>
            </button>

            <button
              onClick={() => { setCurrentView('devices'); setSelectedDevice(null); }}
              className={navItemClass(isDevices)}
            >
              <div className={indicatorClass(isDevices)} />
              <div className="flex items-center gap-2.5 min-w-0">
                <Monitor size={16} className={isDevices ? 'text-[#D4A017]' : 'text-[rgba(28,28,28,0.4)]'} />
                <span className={textClass(isDevices)}>All Devices</span>
              </div>
            </button>
          </div>
        </div>

        {/* System & Pages Section */}
        <div className="flex flex-col gap-2">
          <span className="px-3 text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-[0.1em]">System</span>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => { setCurrentView('settings'); setSelectedDevice(null); }}
              className={navItemClass(isSettings || isProfile)}
            >
              <div className={indicatorClass(isSettings || isProfile)} />
              <div className="flex items-center gap-2.5 min-w-0">
                <Settings size={16} className={isSettings || isProfile ? 'text-[#D4A017]' : 'text-[rgba(28,28,28,0.4)]'} />
                <span className={textClass(isSettings || isProfile)}>Settings</span>
              </div>
            </button>

            {canManageOrgs && (
              <>
                <button
                  onClick={() => { setCurrentView('organizations'); setSelectedDevice(null); }}
                  className={navItemClass(isOrgs)}
                >
                  <div className={indicatorClass(isOrgs)} />
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Building2 size={16} className={isOrgs ? 'text-[#D4A017]' : 'text-[rgba(28,28,28,0.4)]'} />
                    <span className={textClass(isOrgs)}>Organizations</span>
                  </div>
                </button>

                <button
                  onClick={() => { setCurrentView('analytics'); setSelectedDevice(null); }}
                  className={navItemClass(isAnalytics)}
                >
                  <div className={indicatorClass(isAnalytics)} />
                  <div className="flex items-center gap-2.5 min-w-0">
                    <TrendingUp size={16} className={isAnalytics ? 'text-[#D4A017]' : 'text-[rgba(28,28,28,0.4)]'} />
                    <span className={textClass(isAnalytics)}>Platform Analytics</span>
                  </div>
                </button>
              </>
            )}

          </div>
        </div>

        {/* Account Section */}
        <div className="flex flex-col gap-2">
          <span className="px-3 text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-[0.1em]">Account</span>
          <div className="flex flex-col gap-1">
            {canViewBilling && (
              <button
                onClick={() => { setCurrentView('billing'); setSelectedDevice(null); }}
                className={navItemClass(isBilling)}
              >
                <div className={indicatorClass(isBilling)} />
                <div className="flex items-center gap-2.5 min-w-0">
                  <CreditCard size={16} className={isBilling ? 'text-[#D4A017]' : 'text-[rgba(28,28,28,0.4)]'} />
                  <span className={textClass(isBilling)}>Subscriptions</span>
                </div>
              </button>
            )}

            <button
              onClick={() => { setCurrentView('support'); setSelectedDevice(null); }}
              className={navItemClass(isSupport)}
            >
              <div className={indicatorClass(isSupport)} />
              <div className="flex items-center gap-2.5 min-w-0">
                <LifeBuoy size={16} className={isSupport ? 'text-[#D4A017]' : 'text-[rgba(28,28,28,0.4)]'} />
                <span className={textClass(isSupport)}>Support Hub</span>
              </div>
            </button>
          </div>
        </div>

      </div>

      {/* Footer Logout Section */}
      <div className="mt-auto p-4 border-t border-[rgba(28,28,28,0.04)] bg-[#F8F9FA]/30">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-600 hover:bg-red-50 transition-all text-left group font-bold text-sm"
        >
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0 group-hover:bg-red-100 transition-colors">
            <LogOut size={16} />
          </div>
          <span className="flex-1">Logout Session</span>
        </button>
      </div>

    </aside>
  );
};
