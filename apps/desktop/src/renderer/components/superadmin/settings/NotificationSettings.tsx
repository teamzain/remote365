import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Toggle } from './fields';

/**
 * Settings → Notification.
 * Figma notification-preferences screen: three sections (Email Notifications,
 * Push Notifications, Admin Alerts) of plain label + toggle rows separated by
 * hairline dividers, with rounded Cancel / Save Changes actions. Toggles are
 * the 31×19.5 Figma pill — orange gradient when on, outlined grey when off.
 * No persistence endpoint yet — Save keeps a local snapshot that Cancel
 * restores.
 */

type ToggleRow = { id: string; label: string; enabled: boolean };
type Section = { title: string; rows: ToggleRow[] };

const SEED: Section[] = [
  {
    title: 'Email Notifications',
    rows: [
      { id: 'user-registration', label: 'User Registration', enabled: true },
      { id: 'organization-created', label: 'Organization Created', enabled: true },
      { id: 'ticket-assigned', label: 'Ticket Assigned', enabled: false },
      { id: 'trial-expiry', label: 'Trial Expiry', enabled: true },
      { id: 'subscription-renewal', label: 'Subscription Renewal', enabled: true },
      { id: 'failed-payment-email', label: 'Failed Payment', enabled: true },
    ],
  },
  {
    title: 'Push Notifications',
    rows: [
      { id: 'session-started', label: 'Remote Session Started', enabled: true },
      { id: 'session-ended', label: 'Remote Session Ended', enabled: false },
      { id: 'device-registered', label: 'Device Registered', enabled: true },
      { id: 'device-offline', label: 'Device Offline', enabled: true },
    ],
  },
  {
    title: 'Admin Alerts',
    rows: [
      { id: 'security-incident', label: 'Security Incident', enabled: true },
      { id: 'failed-payment-alert', label: 'Failed Payment', enabled: true },
      { id: 'high-cpu', label: 'High CPU Usage', enabled: true },
      { id: 'storage-limit', label: 'Storage Limit Reached', enabled: true },
    ],
  },
];

const NotificationSettings: React.FC = () => {
  const [sections, setSections] = useState<Section[]>(SEED);
  const [saved, setSaved] = useState<Section[]>(SEED);
  const [savedFlash, setSavedFlash] = useState(false);

  const dirty = sections.some((s, i) => s.rows.some((r, j) => r.enabled !== saved[i].rows[j].enabled));

  const toggle = (id: string) =>
    setSections((prev) => prev.map((s) => ({
      ...s,
      rows: s.rows.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    })));

  const cancel = () => setSections(saved);
  const save = () => { setSaved(sections); setSavedFlash(true); };

  useEffect(() => {
    if (!savedFlash) return;
    const t = setTimeout(() => setSavedFlash(false), 2500);
    return () => clearTimeout(t);
  }, [savedFlash]);

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section, i) => (
        <React.Fragment key={section.title}>
          {i > 0 && <div className="h-px w-full bg-[rgba(26,29,33,0.3)]" />}
          <section className="flex flex-col gap-6">
            <h3 className="text-base font-semibold leading-[23px] text-black">{section.title}</h3>
            <div className="flex flex-col gap-3">
              {section.rows.map((row) => (
                <div key={row.id} className="flex h-[30px] items-center justify-between">
                  <span className="text-sm font-medium text-black">{row.label}</span>
                  <Toggle checked={row.enabled} label={row.label} onChange={() => toggle(row.id)} />
                </div>
              ))}
            </div>
          </section>
        </React.Fragment>
      ))}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        {savedFlash && (
          <span className="mr-2 inline-flex items-center gap-1 text-sm font-medium text-[#B54708]">
            <Check size={16} /> Applied for this session (server storage coming soon)
          </span>
        )}
        <button
          onClick={cancel}
          disabled={!dirty}
          className="inline-flex h-10 w-[150px] items-center justify-center rounded-[32px] border border-[#F3F4F6] bg-white text-sm font-medium text-[rgba(26,29,33,0.7)] hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={!dirty}
          className="inline-flex h-10 w-[150px] items-center justify-center rounded-[32px] text-sm font-medium text-white disabled:opacity-60"
          style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default NotificationSettings;
