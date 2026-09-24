import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Bell,
  ChevronRight,
  Monitor,
  MousePointer2,
  Palette,
  Settings as SettingsIcon,
  Shield,
  Sliders,
  Video,
  Wifi,
} from 'lucide-react';
import { SnowPremiumSettings } from '../SnowPremiumSettings';

const initials = (name?: string | null) =>
  String(name || '?')
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

const GROUPS: { title: string; items: { section: string; label: string; icon: React.ComponentType<any> }[] }[] = [
  {
    title: 'Account',
    items: [
      { section: 'Security', label: 'Security', icon: Shield },
      { section: 'Active sign-ins', label: 'Active sign-ins', icon: Monitor },
      { section: 'Licenses', label: 'Licenses', icon: Award },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { section: 'General', label: 'General', icon: SettingsIcon },
      { section: 'Customization', label: 'Customization', icon: Palette },
      { section: 'Audio and video', label: 'Audio and video', icon: Video },
      { section: 'Notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    title: 'This device',
    items: [
      { section: 'Device management', label: 'Device management', icon: Monitor },
      { section: 'Remote control', label: 'Remote control', icon: MousePointer2 },
      { section: 'Network', label: 'Network', icon: Wifi },
      { section: 'Advanced settings', label: 'Advanced settings', icon: Sliders },
    ],
  },
];

/**
 * Phone settings: a grouped root list that drills into the EXISTING
 * SnowPremiumSettings sections one full page at a time (initialSection +
 * hideSectionNav) — same forms, same save endpoints, mobile chrome only.
 */
export const WebMobileSettings: React.FC<{ user: any; logout?: () => void }> = ({ user, logout }) => {
  const [section, setSection] = useState<string | null>(null);
  const sectionRef = useRef(section);
  useEffect(() => { sectionRef.current = section; }, [section]);

  // Phone back gesture pops the drill-in instead of leaving Settings.
  useEffect(() => {
    const onPop = () => { if (sectionRef.current) setSection(null); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const open = (next: string) => {
    window.history.pushState({ settingsSection: next }, '');
    setSection(next);
  };

  if (section) {
    return (
      <div className="flex h-full w-full flex-col bg-white" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
        <div className="flex h-14 flex-none items-center gap-2 border-b border-[rgba(26,29,33,0.1)] px-2">
          <button type="button" onClick={() => window.history.back()} aria-label="Back to settings" className="flex h-10 w-10 items-center justify-center rounded-full text-[#111315] active:bg-[#F3F4F6]">
            <ArrowLeft size={20} />
          </button>
          <span className="text-[15px] font-semibold text-[#111315]">{section === 'Profile' ? 'Profile' : section}</span>
        </div>
        <div className="mobile-embed min-h-0 flex-1 overflow-y-auto">
          <SnowPremiumSettings key={section} user={user} logout={logout} initialSection={section} hideSectionNav />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-white" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
      <div className="px-4 pb-8 pt-4">
        <h2 className="m-0 text-[20px] font-semibold text-[#111315]">Settings</h2>

        <button
          type="button"
          onClick={() => open('Profile')}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-[rgba(26,29,33,0.1)] p-3.5 text-left active:bg-[#F9FAFB]"
        >
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[#FFF1E0] text-[14px] font-semibold text-[#9A5400]">
            {initials(user?.name || user?.email)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-[#111315]">{user?.name || 'Account'}</span>
            <span className="block text-[12px] text-[#111315]/50">Edit profile</span>
          </span>
          <ChevronRight size={17} className="flex-none text-[#111315]/30" />
        </button>

        {GROUPS.map((group) => (
          <div key={group.title} className="mt-5">
            <p className="m-0 mb-1.5 px-1 text-[12px] font-medium text-[#111315]/45">{group.title}</p>
            <div className="overflow-hidden rounded-2xl border border-[rgba(26,29,33,0.1)]">
              {group.items.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.section}
                    type="button"
                    onClick={() => open(item.section)}
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

export default WebMobileSettings;
