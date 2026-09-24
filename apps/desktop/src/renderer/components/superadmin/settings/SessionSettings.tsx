import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import api from '../../../lib/api';
import { Field, SelectInput, Toggle } from './fields';

/**
 * Settings → Recording Policies.
 * Persisted platform-wide via GET/PATCH /api/admin/settings (PlatformSettings
 * singleton). Viewers pull the effective policy from
 * /api/auth/recording-policy at session start and enforce it client-side:
 * auto-record mode, recorder bitrate tier, watermark, and download gating.
 * Storage/retention + the delete/view permissions persist here and take effect
 * in the server-side recording library when it lands.
 */

type SessionForm = {
  autoRecord: string;
  quality: string;
  storage: string;
  retention: string;
  adminsDownload: boolean;
  ownersDelete: boolean;
  techsViewOwn: boolean;
  watermark: boolean;
};

const DEFAULTS: SessionForm = {
  autoRecord: 'Never',
  quality: '1080p (Full HD)',
  storage: 'Local (Viewer Device)',
  retention: '30 days',
  adminsDownload: true,
  ownersDelete: true,
  techsViewOwn: true,
  watermark: true,
};

// UI label <-> API value maps. The API stores the compact values.
const AUTO_RECORD_LABELS: Record<string, string> = { always: 'Always', ask: 'Ask Before Recording', never: 'Never' };
const QUALITY_LABELS: Record<string, string> = { '720p': '720p (HD)', '1080p': '1080p (Full HD)', '1440p': '1440p (2K)' };
const STORAGE_LABELS: Record<string, string> = { local: 'Local (Viewer Device)' };
const RETENTION_LABELS: Record<string, string> = { 7: '7 days', 30: '30 days', 90: '90 days', 365: '1 year', 0: 'Keep Forever' };
const invert = (map: Record<string, string>) =>
  Object.fromEntries(Object.entries(map).map(([value, label]) => [label, value]));
const AUTO_RECORD_VALUES = invert(AUTO_RECORD_LABELS);
const QUALITY_VALUES = invert(QUALITY_LABELS);
const STORAGE_VALUES = invert(STORAGE_LABELS);
const RETENTION_VALUES = invert(RETENTION_LABELS);

const formFromSettings = (s: any): SessionForm => ({
  autoRecord: AUTO_RECORD_LABELS[s?.recordingAutoRecord] || DEFAULTS.autoRecord,
  quality: QUALITY_LABELS[s?.recordingQuality] || DEFAULTS.quality,
  storage: STORAGE_LABELS[s?.recordingStorage] || DEFAULTS.storage,
  retention: RETENTION_LABELS[String(s?.recordingRetentionDays ?? 30)] || DEFAULTS.retention,
  adminsDownload: Boolean(s?.recordingOnlyAdminsDownload ?? true),
  ownersDelete: Boolean(s?.recordingOnlyOwnersDelete ?? true),
  techsViewOwn: Boolean(s?.recordingTechsViewOwn ?? true),
  watermark: Boolean(s?.recordingWatermark ?? true),
});

const payloadFromForm = (f: SessionForm) => ({
  recordingAutoRecord: AUTO_RECORD_VALUES[f.autoRecord] || 'never',
  recordingQuality: QUALITY_VALUES[f.quality] || '1080p',
  recordingStorage: STORAGE_VALUES[f.storage] || 'local',
  recordingRetentionDays: Number(RETENTION_VALUES[f.retention] ?? 30),
  recordingOnlyAdminsDownload: f.adminsDownload,
  recordingOnlyOwnersDelete: f.ownersDelete,
  recordingTechsViewOwn: f.techsViewOwn,
  recordingWatermark: f.watermark,
});

const SessionSettings: React.FC = () => {
  const [form, setForm] = useState<SessionForm>(DEFAULTS);
  const [saved, setSaved] = useState<SessionForm>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/api/admin/settings');
        if (cancelled) return;
        const loaded = formFromSettings(data);
        setForm(loaded);
        setSaved(loaded);
      } catch {
        if (!cancelled) setError('Could not load recording policies. Check your connection and reload.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const set = <K extends keyof SessionForm>(k: K) => (v: SessionForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const flip = (k: 'adminsDownload' | 'ownersDelete' | 'techsViewOwn' | 'watermark') => () =>
    setForm((f) => ({ ...f, [k]: !f[k] }));
  const dirty = (Object.keys(form) as (keyof SessionForm)[]).some((k) => form[k] !== saved[k]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.patch('/api/admin/settings', payloadFromForm(form));
      const persisted = formFromSettings(data);
      setForm(persisted);
      setSaved(persisted);
      setSavedFlash(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Saving failed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!savedFlash) return;
    const t = setTimeout(() => setSavedFlash(false), 2500);
    return () => clearTimeout(t);
  }, [savedFlash]);

  return (
    <div className={`flex flex-col gap-6 ${loading ? 'pointer-events-none opacity-60' : ''}`}>
      {/* Recording */}
      <section className="flex flex-col gap-6">
        <h3 className="text-base font-semibold leading-[23px] text-black">Recording</h3>
        <div className="grid grid-cols-1 gap-x-12 gap-y-7 md:grid-cols-2">
          <Field label="Auto-Record Sessions">
            <SelectInput
              value={form.autoRecord}
              onChange={set('autoRecord')}
              placeholder="Select Recording Mode"
              options={Object.values(AUTO_RECORD_LABELS)}
            />
          </Field>
          <Field label="Recording Quality">
            <SelectInput
              value={form.quality}
              onChange={set('quality')}
              placeholder="Select Quality"
              options={Object.values(QUALITY_LABELS)}
            />
          </Field>
          <Field label="Storage Location">
            <SelectInput
              value={form.storage}
              onChange={set('storage')}
              placeholder="Select Where Recordings Are Stored"
              options={Object.values(STORAGE_LABELS)}
            />
          </Field>
          <Field label="Retention Period">
            <SelectInput
              value={form.retention}
              onChange={set('retention')}
              options={Object.values(RETENTION_LABELS)}
            />
          </Field>
        </div>
        <p className="m-0 -mt-3 text-xs leading-4 text-[rgba(17,19,21,0.45)]">
          Recordings currently save on the viewer&apos;s device. Auto-record, quality, watermark and download
          gating apply to viewers immediately; storage, retention and the delete/view permissions come into
          force with the server-side recording library.
        </p>
      </section>

      {/* Permissions + Watermark */}
      <div className="grid grid-cols-1 gap-x-12 gap-y-7 md:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-2">
          <h3 className="text-base font-semibold leading-[23px] text-black">Permissions</h3>
          <div className="flex flex-col gap-1.5">
            <CheckboxRow label="Only Admins Can Download" checked={form.adminsDownload} onChange={flip('adminsDownload')} />
            <CheckboxRow label="Only Owners Can Delete" checked={form.ownersDelete} onChange={flip('ownersDelete')} />
            <CheckboxRow label="Technicians Can View Own Recordings" checked={form.techsViewOwn} onChange={flip('techsViewOwn')} />
          </div>
        </section>

        <section className="flex min-w-0 items-start justify-between">
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-semibold leading-[23px] text-black">Watermark</h3>
            <span className="text-sm text-black">Enable Watermark</span>
          </div>
          <Toggle checked={form.watermark} label="Enable Watermark" onChange={flip('watermark')} />
        </section>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {error && <span className="mr-2 text-sm font-medium text-[#D92D20]">{error}</span>}
        {savedFlash && !error && (
          <span className="mr-2 inline-flex items-center gap-1 text-sm font-medium text-[#12B76A]">
            <Check size={16} /> Saved — viewers pick this up on their next session
          </span>
        )}
        <button
          onClick={() => setForm(saved)}
          disabled={!dirty || saving}
          className="inline-flex h-10 w-[120px] items-center justify-center rounded-[32px] border border-[rgba(26,29,33,0.3)] text-sm font-medium text-[#111315] disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex h-10 w-[150px] items-center justify-center rounded-[32px] text-sm font-medium text-white disabled:opacity-60"
          style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

const CheckboxRow: React.FC<{ label: string; checked: boolean; onChange: () => void }> = ({ label, checked, onChange }) => (
  <div className="flex h-[26px] items-center justify-between">
    <span className="text-sm text-black">{label}</span>
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border border-[rgba(26,29,33,0.4)] bg-white"
    >
      {checked && <Check size={14} strokeWidth={2.5} className="text-[rgba(26,29,33,0.5)]" />}
    </button>
  </div>
);

export default SessionSettings;
