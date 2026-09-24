import React, { useEffect, useMemo, useState } from 'react';
import { MoreVertical, X, Loader2, RefreshCw, Eye, Code } from 'lucide-react';
import api from '../../../lib/api';

/**
 * Settings → Email Settings.
 * Real platform templates from `GET /api/admin/email-templates` (gated by
 * `settings:emailTemplates`). Defaults live in the auth-service; editing a
 * template stores an override the backend renders for every real send
 * (verification, password reset, org invite, meeting/session invite) —
 * desktop and mobile both trigger those through this backend. The editor
 * supports `{{variable}}` placeholders, a live preview with sample values,
 * enable/disable, reset-to-default, and a real test send.
 */

type ApiTemplate = {
  key: string;
  name: string;
  description: string;
  subject: string;
  html: string;
  enabled: boolean;
  customized: boolean;
  updatedAt: string | null;
  variables: string[];
  sample: Record<string, string>;
};

const dateLabel = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Default';

const renderSample = (tpl: string, sample: Record<string, string>) =>
  tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => sample[k] ?? '');

const EmailSettings: React.FC = () => {
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [smtpReady, setSmtpReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowMenu, setRowMenu] = useState<{ key: string; x: number; bottom: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<ApiTemplate | null>(null);
  const [testFor, setTestFor] = useState<ApiTemplate | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ templates: ApiTemplate[]; smtpConfigured: boolean }>('/api/admin/email-templates');
      setTemplates(res.data.templates);
      setSmtpReady(res.data.smtpConfigured);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load email templates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const patchRow = (row: ApiTemplate) => setTemplates((prev) => prev.map((t) => (t.key === row.key ? row : t)));

  const openRowMenu = (e: React.MouseEvent<HTMLButtonElement>, key: string) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setRowMenu((cur) => (cur?.key === key ? null : { key, x: r.right, bottom: r.bottom }));
  };

  const toggleEnabled = async (t: ApiTemplate) => {
    setRowMenu(null);
    setBusyKey(t.key);
    try {
      const res = await api.put<{ template: ApiTemplate }>(`/api/admin/email-templates/${t.key}`, { enabled: !t.enabled });
      patchRow(res.data.template);
      setNotice(`${t.name} is now ${res.data.template.enabled ? 'active — this email will be sent' : 'inactive — this email will be skipped'}.`);
    } catch (e: any) {
      setNotice(e?.response?.data?.error || 'Update failed.');
    } finally {
      setBusyKey(null);
    }
  };

  const resetTemplate = async (t: ApiTemplate) => {
    setRowMenu(null);
    setBusyKey(t.key);
    try {
      const res = await api.post<{ template: ApiTemplate }>(`/api/admin/email-templates/${t.key}/reset`);
      patchRow(res.data.template);
      setNotice(`${t.name} was reset to the built-in default.`);
    } catch (e: any) {
      setNotice(e?.response?.data?.error || 'Reset failed.');
    } finally {
      setBusyKey(null);
    }
  };

  const sendTest = async (t: ApiTemplate, to: string) => {
    setTestFor(null);
    setBusyKey(t.key);
    try {
      const res = await api.post<{ success: boolean; to: string }>(`/api/admin/email-templates/${t.key}/test`, { to });
      try { localStorage.setItem('r365_test_email_to', to); } catch { /* storage unavailable */ }
      setNotice(`Test "${t.name}" email sent to ${res.data.to}.`);
    } catch (e: any) {
      setNotice(e?.response?.data?.error || 'Test send failed.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {!loading && !error && !smtpReady && (
        <div className="rounded-[4px] border border-[#FFE2BF] bg-[#FFF6ED] px-4 py-3 text-sm text-[#B45309]">
          SMTP is not configured on this server — emails are skipped and test sends are unavailable. Template changes still save.
        </div>
      )}

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-[4px] border border-[#FFE2BF] bg-[#FFF6ED] px-4 py-3 text-sm text-[#B45309]">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="shrink-0 text-[#B45309]/70 hover:text-[#B45309]"><X size={16} /></button>
        </div>
      )}

      {/* Templates table */}
      <div className="overflow-x-auto rounded-xl border border-[rgba(26,29,33,0.3)]">
        <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: '260px' }} />
            <col />
            <col style={{ width: '150px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '68px' }} />
          </colgroup>
          <thead>
            <tr className="h-11 bg-[#F3F4F6]">
              <th className="rounded-tl-xl px-6 text-left text-[12px] font-medium leading-[17px] text-[#111315]">Template</th>
              <th className="px-6 text-center text-[12px] font-medium leading-[17px] text-[#111315]">Subject</th>
              <th className="px-6 text-center text-[12px] font-medium leading-[17px] text-[#111315]">Last Updated</th>
              <th className="px-6 text-center text-[12px] font-medium leading-[17px] text-[#111315]">Status</th>
              <th className="rounded-tr-xl px-6" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]">
                <td colSpan={5} className="px-6 py-12 text-center">
                  <span className="inline-flex items-center gap-2 text-sm text-[rgba(17,19,21,0.6)]"><Loader2 size={16} className="animate-spin" /> Loading Templates…</span>
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr className="border-t border-[rgba(26,29,33,0.3)]">
                <td colSpan={5} className="px-6 py-12 text-center">
                  <p className="text-sm text-[#D92D20]">{error}</p>
                  <button onClick={load} className="mt-3 inline-flex h-9 items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-3 text-sm font-medium text-[#111315] hover:bg-[#F3F4F6]"><RefreshCw size={14} /> Retry</button>
                </td>
              </tr>
            )}
            {!loading && !error && templates.map((t) => (
              <tr key={t.key} className="h-[72px] border-t border-[rgba(26,29,33,0.3)] hover:bg-[#FAFAFA]">
                <td className="px-6 align-middle">
                  <p className="truncate text-sm font-medium text-[#111315]">{t.name}</p>
                  <p className="truncate text-sm text-[rgba(17,19,21,0.6)]">{t.customized ? 'Customized' : 'Default'}</p>
                </td>
                <td className="px-6 text-center align-middle text-sm text-[#111315]">{renderSample(t.subject, t.sample)}</td>
                <td className="px-6 text-center align-middle text-sm font-medium text-[#111315]">{dateLabel(t.updatedAt)}</td>
                <td className="px-6 text-center align-middle">
                  <span className={`inline-flex items-center rounded-[16px] px-2 py-1 text-[10px] font-normal ${t.enabled ? 'bg-[#ECFDF3] text-[#34C759]' : 'bg-[#F5F5F5] text-[#414651]'}`}>
                    {t.enabled ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 align-middle">
                  <button
                    onClick={(e) => openRowMenu(e, t.key)}
                    disabled={busyKey === t.key}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#F3F4F6] ${
                      rowMenu?.key === t.key ? 'bg-[#F3F4F6] text-[#FF8A00]' : 'text-[rgba(26,29,33,0.6)]'
                    }`}
                  >
                    {busyKey === t.key ? <Loader2 size={16} className="animate-spin" /> : <MoreVertical size={18} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Row actions menu */}
      {rowMenu && (() => {
        const t = templates.find((x) => x.key === rowMenu.key);
        if (!t) return null;
        const items = 3 + (t.customized ? 1 : 0);
        const menuH = items * 40;
        const topPos = Math.min(rowMenu.bottom + 6, window.innerHeight - menuH - 8);
        return (
          <>
            <div className="fixed inset-0 z-[110]" onClick={() => setRowMenu(null)} />
            <div
              className="fixed z-[120] w-[170px] overflow-hidden rounded-[4px] bg-white shadow-[-4px_4px_12px_rgba(0,0,0,0.25)]"
              style={{ top: topPos, left: Math.max(8, rowMenu.x - 170) }}
            >
              <MenuItem label="Edit Template" onClick={() => { setEditing(t); setRowMenu(null); }} />
              <MenuItem label="Send Test Email" onClick={() => { setTestFor(t); setRowMenu(null); }} />
              <MenuItem label={t.enabled ? 'Disable' : 'Enable'} onClick={() => toggleEnabled(t)} />
              {t.customized && <MenuItem label="Reset To Default" onClick={() => resetTemplate(t)} />}
            </div>
          </>
        );
      })()}

      {/* Editor */}
      {editing && (
        <TemplateEditor
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={(row) => { patchRow(row); setEditing(null); setNotice(`${row.name} saved — real sends now use your version.`); }}
        />
      )}

      {/* Test-send recipient */}
      {testFor && (
        <TestSendDialog
          template={testFor}
          onClose={() => setTestFor(null)}
          onSend={(to) => sendTest(testFor, to)}
        />
      )}
    </div>
  );
};

const TestSendDialog: React.FC<{
  template: ApiTemplate;
  onClose: () => void;
  onSend: (to: string) => void;
}> = ({ template, onClose, onSend }) => {
  const [to, setTo] = useState(() => {
    // Default to the last address used on this machine; never a hardcoded
    // personal inbox. Empty forces the admin to type where the test goes.
    try { return localStorage.getItem('r365_test_email_to') || ''; } catch { return ''; }
  });
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[440px] overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(26,29,33,0.1)] px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-black">Send Test Email</h3>
            <p className="mt-0.5 text-sm text-[rgba(17,19,21,0.6)]">{template.name} — rendered with sample values.</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded p-1 text-[#1A1D21] hover:bg-[#F3F4F6]"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-[#111315]">Send To</span>
            <input
              value={to}
              autoFocus
              onChange={(e) => setTo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && valid) onSend(to.trim()); }}
              placeholder="name@example.com"
              className="h-10 w-full rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-sm text-[#111315] outline-none placeholder:text-[rgba(17,19,21,0.3)] focus:border-[#FF8A00]"
            />
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[rgba(26,29,33,0.1)] px-6 py-4">
          <button
            onClick={onClose}
            className="inline-flex h-10 w-[120px] items-center justify-center rounded-[32px] border border-[#F3F4F6] bg-white text-sm font-medium text-[rgba(26,29,33,0.7)] hover:bg-[#F3F4F6]"
          >
            Cancel
          </button>
          <button
            onClick={() => onSend(to.trim())}
            disabled={!valid}
            className="inline-flex h-10 w-[120px] items-center justify-center rounded-[32px] text-sm font-medium text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

const TemplateEditor: React.FC<{
  template: ApiTemplate;
  onClose: () => void;
  onSaved: (row: ApiTemplate) => void;
}> = ({ template, onClose, onSaved }) => {
  const [subject, setSubject] = useState(template.subject);
  const [html, setHtml] = useState(template.html);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = subject !== template.subject || html !== template.html;
  const preview = useMemo(() => renderSample(html, template.sample), [html, template.sample]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    if (!subject.trim()) { setError('Subject is required.'); return; }
    if (!html.trim()) { setError('Body is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await api.put<{ template: ApiTemplate }>(`/api/admin/email-templates/${template.key}`, { subject, html });
      onSaved(res.data.template);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Save failed.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[90vh] w-full max-w-[820px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(26,29,33,0.1)] px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-black">{template.name}</h3>
            <p className="mt-0.5 text-sm text-[rgba(17,19,21,0.6)]">{template.description}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded p-1 text-[#1A1D21] hover:bg-[#F3F4F6]"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-6 py-5">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-[#111315]">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-10 w-full rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 text-sm text-[#111315] outline-none focus:border-[#FF8A00]"
            />
          </label>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-[rgba(17,19,21,0.6)]">Variables:</span>
            {template.variables.map((v) => (
              <code key={v} className="rounded bg-[#F3F4F6] px-1.5 py-0.5 text-[11px] text-[#111315]">{`{{${v}}}`}</code>
            ))}
          </div>

          <div className="flex min-h-0 flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#111315]">Body (HTML)</span>
              <button
                onClick={() => setShowPreview((p) => !p)}
                className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-3 text-xs font-medium text-[#111315] hover:bg-[#F3F4F6]"
              >
                {showPreview ? <><Code size={13} /> Edit HTML</> : <><Eye size={13} /> Preview</>}
              </button>
            </div>
            {showPreview ? (
              <iframe
                title="Template Preview"
                sandbox=""
                srcDoc={preview}
                className="h-[340px] w-full rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white"
              />
            ) : (
              <textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                spellCheck={false}
                className="h-[340px] w-full resize-none rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white p-3 font-mono text-xs leading-5 text-[#1D2026] outline-none focus:border-[#FF8A00]"
              />
            )}
          </div>

          {error && <p className="text-sm text-[#D92D20]">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[rgba(26,29,33,0.1)] px-6 py-4">
          <button
            onClick={onClose}
            className="inline-flex h-10 w-[150px] items-center justify-center rounded-[32px] border border-[#F3F4F6] bg-white text-sm font-medium text-[rgba(26,29,33,0.7)] hover:bg-[#F3F4F6]"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="inline-flex h-10 w-[150px] items-center justify-center gap-2 rounded-[32px] text-sm font-medium text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />} Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const MenuItem: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button onClick={onClick} className="flex h-10 w-full items-center px-4 text-sm font-medium text-[#111315] hover:bg-[#F9FAFB]">
    {label}
  </button>
);

export default EmailSettings;
