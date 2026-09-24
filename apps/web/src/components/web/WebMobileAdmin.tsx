import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  CreditCard,
  FileText,
  LayoutGrid,
  Monitor,
  Receipt,
  Settings as SettingsIcon,
  Shield,
  Users,
} from 'lucide-react';
import { SnowAdminSettings } from '../SnowAdminSettings';
import { WebMobileMembers } from './WebMobileMembers';

// Mirrors SIDEBAR_SECTIONS in SnowAdminSettings; a section the member can't
// see falls back to Overview inside the component itself.
const GROUPS: { title: string; items: { id: string; label: string; icon: React.ComponentType<any> }[] }[] = [
  {
    title: 'Organization',
    items: [
      { id: 'overview', label: 'Dashboard', icon: LayoutGrid },
      { id: 'general', label: 'Settings', icon: SettingsIcon },
      { id: 'security', label: 'Security', icon: Shield },
    ],
  },
  {
    title: 'Team',
    items: [
      { id: 'members', label: 'Members', icon: Users },
      { id: 'roles', label: 'Roles and permissions', icon: Shield },
    ],
  },
  {
    title: 'Devices',
    items: [
      { id: 'devices', label: 'Devices', icon: Monitor },
      { id: 'groups', label: 'Device groups', icon: LayoutGrid },
      { id: 'policies', label: 'Policy', icon: FileText },
    ],
  },
  {
    title: 'Billing',
    items: [
      { id: 'license', label: 'License usage', icon: CreditCard },
      { id: 'subs', label: 'Subscription', icon: Receipt },
    ],
  },
];

/**
 * Phone admin console: grouped root list drilling into the EXISTING
 * SnowAdminSettings sections one full page at a time (initialSection +
 * hideSectionNav) — same panels and actions, mobile chrome only.
 */
export const WebMobileAdmin: React.FC<{ user: any; setCurrentView: (v: any) => void }> = ({ user, setCurrentView }) => {
  const [section, setSection] = useState<{ id: string; label: string } | null>(null);
  const sectionRef = useRef(section);
  useEffect(() => { sectionRef.current = section; }, [section]);

  useEffect(() => {
    const onPop = () => { if (sectionRef.current) setSection(null); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const open = (next: { id: string; label: string }) => {
    window.history.pushState({ adminSection: next.id }, '');
    setSection(next);
  };

  if (section) {
    return (
      <div className="flex h-full w-full flex-col bg-white" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
        <div className="flex h-14 flex-none items-center gap-2 border-b border-[rgba(26,29,33,0.1)] px-2">
          <button type="button" onClick={() => window.history.back()} aria-label="Back to admin settings" className="flex h-10 w-10 items-center justify-center rounded-full text-[#111315] active:bg-[#F3F4F6]">
            <ArrowLeft size={20} />
          </button>
          <span className="text-[15px] font-semibold text-[#111315]">{section.label}</span>
        </div>
        {section.id === 'members' ? (
          // The desktop members table is seven columns wide; the phone
          // Members screen is the same data as a list.
          <div className="min-h-0 flex-1"><WebMobileMembers /></div>
        ) : (
          <div className="mobile-embed min-h-0 flex-1 overflow-y-auto">
            <SnowAdminSettings key={section.id} user={user} setCurrentView={setCurrentView} initialSection={section.id} hideSectionNav />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-white" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
      <div className="px-4 pb-8 pt-4">
        <h2 className="m-0 text-[20px] font-semibold text-[#111315]">Admin settings</h2>
        {GROUPS.map((group) => (
          <div key={group.title} className="mt-5">
            <p className="m-0 mb-1.5 px-1 text-[12px] font-medium text-[#111315]/45">{group.title}</p>
            <div className="overflow-hidden rounded-2xl border border-[rgba(26,29,33,0.1)]">
              {group.items.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => open(item)}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-[#F9FAFB] ${
                      index > 0 ? 'border-t border-[rgba(26,29,33,0.08)]' : ''
                    }`}
                  >
                    <Icon size={17} className="flex-none text-[#111315]/55" />
                    <span className="flex-1 text-[14px] font-medium text-[#111315]">{item.label}</span>
                    <ChevronRight size={16} className="flex-none text-[#111315]/30" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WebMobileAdmin;
