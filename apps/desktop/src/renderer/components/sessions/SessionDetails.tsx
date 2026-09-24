import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, HardDrive, Monitor, NotebookPen, PlugZap, UserRound } from 'lucide-react';
import { SupportSession } from '../../lib/sessionsApi';

type DetailTab = 'notes' | 'system';

type Props = {
  session: SupportSession | null;
  customerHistory: SupportSession[];
  connecting: boolean;
  onConnect: (id: string) => void;
  onMarkDone: (id: string) => void;
  onNotesChange: (id: string, notes: string) => void;
};

const canConnect = (session: SupportSession) => ['CREATED', 'QUEUED', 'ASSIGNED'].includes(session.status);
const canEditNotes = (session: SupportSession) => ['ASSIGNED', 'RINGING', 'CONNECTED'].includes(session.status);

export const SessionDetails: React.FC<Props> = ({ session, customerHistory, connecting, onConnect, onMarkDone, onNotesChange }) => {
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState<DetailTab>('notes');

  useEffect(() => {
    setNotes(session?.notes || '');
    setActiveTab('notes');
  }, [session?.id, session?.notes]);

  useEffect(() => {
    if (!session) return;
    if (!canEditNotes(session)) return;
    if (notes === (session.notes || '')) return;
    const timer = setTimeout(() => onNotesChange(session.id, notes), 1000);
    return () => clearTimeout(timer);
  }, [notes, onNotesChange, session]);

  const systemInfo = session?.systemInfo || {};
  const previousCount = useMemo(() => customerHistory.filter((item) => item.id !== session?.id).length, [customerHistory, session?.id]);

  if (!session) {
    return (
      <section className="h-full rounded-2xl border border-gray-100 dark:border-white/5 bg-white dark:bg-[#0F0F0F] flex items-center justify-center text-center p-8">
        <div>
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
            <UserRound size={34} className="text-[#1D6DF5]" />
          </div>
          <h2 className="text-[16px] font-bold text-gray-900 dark:text-white">Select A Session From The Queue</h2>
          <p className="text-[12px] text-gray-400 mt-1 max-w-sm">Customer profile, notes, chat, system information, and history will appear here.</p>
        </div>
      </section>
    );
  }

  const doneEnabled = !['ENDED', 'RESOLVED', 'EXPIRED'].includes(session.status);

  return (
    <section className="h-full min-h-0 rounded-2xl border border-gray-100 dark:border-white/5 bg-white dark:bg-[#0F0F0F] overflow-hidden flex flex-col">
      <div className="px-6 py-5 border-b border-gray-100 dark:border-white/5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
              <UserRound size={19} className="text-[#1D6DF5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[20px] font-black text-gray-900 dark:text-white truncate">{session.customerName || `External - ${session.code}`}</h2>
                <span className="rounded-full bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold uppercase text-[#1D6DF5]">{session.status}</span>
              </div>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate">
                {session.customerEmail || 'No Email'} - {session.deviceName || 'No Device Selected'} - Code {session.code}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onConnect(session.id)}
            disabled={!canConnect(session) || connecting}
            className="min-w-[136px] px-5 py-3 rounded-xl bg-[#1D6DF5] text-white text-[13px] font-bold hover:bg-blue-700 disabled:opacity-45 flex items-center justify-center gap-2"
          >
            <PlugZap size={15} />
            {connecting ? 'Connecting' : 'Connect'}
          </button>
          {doneEnabled && (
            <button onClick={() => onMarkDone(session.id)} className="min-w-[136px] px-5 py-3 rounded-xl bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 flex items-center justify-center gap-2">
              <CheckCircle2 size={15} />
              Mark As Done
            </button>
          )}
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 dark:bg-white/5 p-1">
          {[
            ['notes', NotebookPen, 'Notes'],
            ['system', Monitor, 'System Info'],
          ].map(([id, Icon, label]: any) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`rounded-lg px-2 py-2 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${activeTab === id ? 'bg-white text-gray-900 shadow-sm dark:bg-[#1A1A1A] dark:text-white' : 'text-gray-500'}`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        {activeTab === 'notes' && (
          <div className="h-full min-h-[360px] flex flex-col gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 p-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#1D6DF5]"><HardDrive size={13} /> Device</div>
                <div className="mt-1 text-[14px] font-bold text-gray-900 dark:text-white">{session.deviceName || 'No Device Selected'}</div>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-white/[0.04] p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Issue Type</div>
                <div className="mt-1 text-[14px] font-bold text-gray-900 dark:text-white">{session.issueCategory || 'General Support'}</div>
              </div>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-white/[0.04] p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Customer Issue</div>
              <p className="mt-2 text-[13px] leading-5 text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{session.issueSummary || 'No issue description provided.'}</p>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-white/[0.04] p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Session Status</div>
              <div className="mt-2 flex flex-wrap gap-2 text-[12px] font-semibold text-gray-700 dark:text-gray-200">
                <span className="rounded-full bg-white px-3 py-1 dark:bg-black/20">{session.status}</span>
                <span className="rounded-full bg-white px-3 py-1 dark:bg-black/20">{previousCount} previous request{previousCount === 1 ? '' : 's'}</span>
              </div>
            </div>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Issue, Actions Taken, Next Steps..."
              className="flex-1 min-h-[180px] resize-none rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-black/20 p-4 text-[13px] text-gray-900 dark:text-white outline-none focus:border-blue-400"
            />
          </div>
        )}

        {activeTab === 'system' && (
          <div className="grid grid-cols-2 gap-3">
            {[
              ['OS', systemInfo.os || systemInfo.osVersion || 'Pending Probe'],
              ['CPU', systemInfo.cpu || 'Pending Probe'],
              ['RAM', systemInfo.ram || 'Pending Probe'],
              ['Local IP', systemInfo.ip || systemInfo.ipLocal || 'Pending Probe'],
              ['Uptime', systemInfo.uptime || 'Pending Probe'],
              ['Captured', systemInfo.capturedAt ? new Date(systemInfo.capturedAt).toLocaleString() : 'Pending Probe'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 dark:bg-white/[0.04] p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
                <div className="mt-1 text-[13px] font-semibold text-gray-800 dark:text-gray-100 break-words">{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
