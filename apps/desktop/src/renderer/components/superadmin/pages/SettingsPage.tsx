import React, { useState } from 'react';
import {
  Palette, Mail, Bell, CircleDot,
} from 'lucide-react';
import BrandingSettings from '../settings/BrandingSettings';
import EmailSettings from '../settings/EmailSettings';
import NotificationSettings from '../settings/NotificationSettings';
import SessionSettings from '../settings/SessionSettings';

/**
 * Super Admin → Settings shell.
 * Figma "Settings" screen: a 220px sub-sidebar of setting categories inside
 * the white content card (active item gets the orange gradient) with the
 * selected category's title + support line to its right. Each category's
 * content lives in its own component under ../settings/; categories without a
 * design yet render a placeholder line.
 */

// Security + Payment Settings tabs removed — they only rendered a "coming
// soon" placeholder with no backing UI. Re-add them here when built.
type TabKey = 'branding' | 'email' | 'notifications' | 'sessions';

type IconType = React.ComponentType<{ size?: number; className?: string }>;

const TABS: { key: TabKey; label: string; icon: IconType }[] = [
  { key: 'branding', label: 'Branding', icon: Palette },
  { key: 'email', label: 'Email Settings', icon: Mail },
  { key: 'notifications', label: 'Notification', icon: Bell },
  { key: 'sessions', label: 'Recording Policies', icon: CircleDot },
];

const TAB_COPY: Record<TabKey, { title: string; support: string }> = {
  branding: { title: 'Branding', support: 'Customize the platform logo and identity shown across the product.' },
  email: { title: 'Email Settings', support: 'Manage the templates used for platform emails.' },
  notifications: { title: 'Notification', support: 'Choose which platform events trigger notifications.' },
  sessions: { title: 'Recording Policies', support: 'Recording policies for remote sessions across the platform.' },
};

const CONTENT: Partial<Record<TabKey, React.ComponentType>> = {
  branding: BrandingSettings,
  email: EmailSettings,
  notifications: NotificationSettings,
  sessions: SessionSettings,
};

const SettingsPage: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('branding');
  const copy = TAB_COPY[tab];
  const Content = CONTENT[tab];

  return (
    <div className="flex min-h-full">
      {/* Settings categories */}
      <aside className="w-[220px] shrink-0 border-r border-[rgba(26,29,33,0.3)] px-3 py-6">
        <nav className="flex flex-col gap-1">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex h-10 w-full items-center gap-2 rounded-[4px] px-4 text-left transition-colors ${
                  active ? 'text-white' : 'text-[#111315] hover:bg-[#F3F4F6]'
                }`}
                style={active ? { background: 'linear-gradient(110.89deg, #FF8A00 36.19%, #FFB347 93.55%)' } : undefined}
              >
                <Icon size={16} className="shrink-0" />
                <span className="truncate text-sm font-medium">{label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Active category */}
      <div className="min-w-0 flex-1 px-9 py-8">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-medium leading-[25px] text-black">{copy.title}</h2>
            <p className="text-sm text-black">{copy.support}</p>
          </div>

          {Content ? (
            <Content />
          ) : (
            <p className="text-sm text-[rgba(26,29,33,0.5)]">Configuration for this section is coming soon.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
