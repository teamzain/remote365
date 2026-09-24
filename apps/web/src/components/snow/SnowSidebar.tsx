import React from 'react';
import {
  Link as LucideLink,
  Monitor,
  Settings,
  CreditCard,
  User,
  PieChart,
  LogOut,
  LifeBuoy,
  Users,
  ScreenShare
} from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface SnowSidebarProps {
  isCollapsed?: boolean;
}

export const SnowSidebar: React.FC<SnowSidebarProps> = ({ isCollapsed = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const isActive = (path: string) => location.pathname === path;

  const navItemClass = (active: boolean) => `
    relative flex items-center h-8 px-3 rounded-lg transition-all duration-300 group
    ${active ? 'bg-[rgba(28,28,28,0.05)] text-[#1C1C1C]' : 'hover:bg-[rgba(28,28,28,0.02)] text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C]'}
    ${isCollapsed ? 'justify-center w-8 mx-auto px-0' : 'w-full'}
  `;

  const textClass = (_active: boolean) => `
    text-sm font-semibold leading-5 transition-all duration-300 whitespace-nowrap overflow-hidden
    ${isCollapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100 ml-2.5'}
  `;

  const indicatorClass = (active: boolean) => `
    absolute left-0 top-2 w-1.5 h-4 bg-[#1C1C1C] rounded-r-lg transition-all duration-300
    ${active && !isCollapsed ? 'opacity-100' : 'opacity-0'}
  `;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 bg-white border-r border-[rgba(28,28,28,0.08)] flex flex-col font-inter z-30 shadow-sm transition-all duration-300 overflow-hidden ${isCollapsed ? 'w-[72px]' : 'w-[212px]'}`}
    >

      {/* Brand Logo Section */}
      <NavLink to="/dashboard" className={`flex items-center gap-3 pt-8 mb-10 transition-all duration-300 ${isCollapsed ? 'px-0 justify-center' : 'px-5'}`}>
        <div className="w-8 h-8 rounded-xl bg-[#1C1C1C] flex items-center justify-center shadow-lg shadow-black/10 transition-transform hover:scale-105 shrink-0">
          <LucideLink size={18} className="text-white" />
        </div>
        {!isCollapsed && (
          <div className="flex flex-col animate-in fade-in duration-500">
            <span className="text-lg font-black text-[#1C1C1C] leading-none tracking-tighter">Remote365</span>
          </div>
        )}
      </NavLink>

      {/* Main Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 custom-scrollbar pb-10 space-y-9 overflow-x-hidden">

        {/* Dashboards Section */}
        <div className="flex flex-col gap-2">
          {!isCollapsed && (
            <span className="px-3 text-[10px] font-black text-[rgba(28,28,28,0.2)] uppercase tracking-[0.2em] animate-in fade-in duration-300">Dashboards</span>
          )}
          <div className="flex flex-col gap-1">
            <NavLink to="/dashboard" end className={({ isActive: active }) => navItemClass(active)}>
              <div className={indicatorClass(isActive('/dashboard'))} />
              <PieChart size={18} className="shrink-0" />
              <span className={textClass(isActive('/dashboard'))}>Overview</span>
            </NavLink>

            <NavLink to="/dashboard/sessions" className={({ isActive: active }) => navItemClass(active)}>
              <div className={indicatorClass(isActive('/dashboard/sessions'))} />
              <ScreenShare size={18} className="shrink-0" />
              <span className={textClass(isActive('/dashboard/sessions'))}>Remote Support</span>
            </NavLink>

            <NavLink to="/dashboard/devices" className={({ isActive: active }) => navItemClass(active)}>
              <div className={indicatorClass(isActive('/dashboard/devices'))} />
              <Monitor size={18} className="shrink-0" />
              <span className={textClass(isActive('/dashboard/devices'))}>All Devices</span>
            </NavLink>

            <NavLink to="/dashboard/members" className={({ isActive: active }) => navItemClass(active)}>
              <div className={indicatorClass(isActive('/dashboard/members'))} />
              <Users size={18} className="shrink-0" />
              <span className={textClass(isActive('/dashboard/members'))}>Team Management</span>
              {(user?.plan === 'FREE' || user?.plan === 'PRO') && !isCollapsed && (
                <div className="ml-auto bg-[rgba(28,28,28,0.04)] px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-tight text-[rgba(28,28,28,0.3)]">PRO+</div>
              )}
            </NavLink>
          </div>
        </div>

        {/* System & Pages Section */}
        <div className="flex flex-col gap-2">
          {!isCollapsed && (
            <span className="px-3 text-[10px] font-black text-[rgba(28,28,28,0.2)] uppercase tracking-[0.2em] animate-in fade-in duration-300">Config</span>
          )}
          <div className="flex flex-col gap-1">
            <NavLink to="/dashboard/profile" className={({ isActive: active }) => navItemClass(active)}>
              <div className={indicatorClass(isActive('/dashboard/profile'))} />
              <User size={18} className="shrink-0" />
              <span className={textClass(isActive('/dashboard/profile'))}>Account</span>
            </NavLink>

            <NavLink to="/dashboard/settings" className={({ isActive: active }) => navItemClass(active)}>
              <div className={indicatorClass(isActive('/dashboard/settings'))} />
              <Settings size={18} className="shrink-0" />
              <span className={textClass(isActive('/dashboard/settings'))}>Settings</span>
            </NavLink>
          </div>
        </div>

        {/* Account Section */}
        <div className="flex flex-col gap-2">
          {!isCollapsed && (
            <span className="px-3 text-[10px] font-black text-[rgba(28,28,28,0.2)] uppercase tracking-[0.2em] animate-in fade-in duration-300">Service</span>
          )}
          <div className="flex flex-col gap-1">
            <NavLink to="/dashboard/billing" className={({ isActive: active }) => navItemClass(active)}>
              <div className={indicatorClass(isActive('/dashboard/billing'))} />
              <CreditCard size={18} className="shrink-0" />
              <span className={textClass(isActive('/dashboard/billing'))}>Billing</span>
            </NavLink>

            <NavLink to="/dashboard/support" className={({ isActive: active }) => navItemClass(active)}>
              <div className={indicatorClass(isActive('/dashboard/support'))} />
              <LifeBuoy size={18} className="shrink-0" />
              <span className={textClass(isActive('/dashboard/support'))}>Help Center</span>
            </NavLink>
          </div>
        </div>

      </div>

      {/* Footer Branding & Logout */}
      <div className={`mt-auto p-4 border-t border-[rgba(28,28,28,0.04)] bg-[#F8F9FA]/30 transition-all duration-300 ${isCollapsed ? 'px-2' : 'px-4'}`}>
        <button
          onClick={handleLogout}
          className={`group flex items-center justify-center rounded-xl border border-[rgba(28,28,28,0.06)] hover:border-[rgba(28,28,28,0.2)] transition-all bg-white shadow-sm ${isCollapsed ? 'w-10 h-10 mx-auto' : 'w-full py-2.5 gap-2.5 px-3'}`}
        >
          <LogOut size={14} className="text-[rgba(28,28,28,0.4)] group-hover:text-[#1C1C1C]" />
          {!isCollapsed && (
            <span className="text-[11px] font-bold text-[rgba(28,28,28,0.4)] group-hover:text-[#1C1C1C] whitespace-nowrap">Close Session</span>
          )}
        </button>
      </div>

    </aside>
  );
};
