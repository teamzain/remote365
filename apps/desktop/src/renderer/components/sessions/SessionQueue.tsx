import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, SignalHigh } from 'lucide-react';
import { SupportSession } from '../../lib/sessionsApi';

type Props = {
  queue: SupportSession[];
  history: SupportSession[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onRefresh: () => void;
};

type QueueTab = 'waiting' | 'active' | 'recent';

const formatElapsed = (createdAt: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
};

const getInitials = (session: SupportSession) => {
  const name = session.customerName || session.customerEmail || session.code;
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'EX';
};

const statusClass = (status: string) => {
  if (status === 'CONNECTED') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
  if (status === 'ASSIGNED' || status === 'RINGING') return 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300';
  if (status === 'QUEUED' || status === 'CREATED') return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
  return 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400';
};

const statusLabel = (status: string) => {
  if (status === 'QUEUED' || status === 'CREATED') return 'WAITING';
  return status;
};

export const SessionQueue: React.FC<Props> = ({ queue, history, selectedId, loading, onSelect, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<QueueTab>('waiting');
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const waiting = useMemo(() => queue.filter((session) => ['QUEUED', 'CREATED', 'ASSIGNED'].includes(session.status)), [queue]);
  const active = useMemo(() => queue.filter((session) => ['RINGING', 'CONNECTED'].includes(session.status)), [queue]);
  const visibleRows = activeTab === 'waiting' ? waiting : activeTab === 'active' ? active : history.slice(0, 20);

  return (
    <section className="h-full min-h-0 rounded-2xl border border-gray-100 dark:border-white/5 bg-white dark:bg-[#0F0F0F] overflow-hidden flex flex-col">
      <div className="px-4 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">Session Queue</h2>
            <p className="text-[11px] text-gray-400">{queue.length} active sessions</p>
          </div>
          <button onClick={onRefresh} className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10" title="Refresh Sessions">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 dark:bg-white/5 p-1">
          {[
            ['waiting', `Waiting ${waiting.length}`],
            ['active', `Active ${active.length}`],
            ['recent', `Recent ${history.length}`],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as QueueTab)}
              className={`rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors ${activeTab === id ? 'bg-white text-gray-900 shadow-sm dark:bg-[#1A1A1A] dark:text-white' : 'text-gray-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {visibleRows.length === 0 ? (
        <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center px-5">
          <SignalHigh size={28} className="text-gray-300 mb-3" />
          <p className="text-[13px] font-bold text-gray-700 dark:text-gray-200">No {activeTab} sessions</p>
          <p className="text-[11px] text-gray-400 mt-1">Customer help requests will appear here.</p>
        </div>
      ) : visibleRows.map((session) => (
        <button
          key={session.id}
          onClick={() => onSelect(session.id)}
          className={`w-full rounded-xl border p-3 text-left transition-all ${
            selectedId === session.id
              ? 'border-blue-200 bg-blue-50/80 dark:border-blue-500/30 dark:bg-blue-500/10'
              : 'border-gray-100 bg-white hover:bg-gray-50 dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]'
          } ${session.status === 'QUEUED' || session.status === 'CREATED' ? 'animate-pulse' : ''}`}
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00193F] text-white flex items-center justify-center text-[11px] font-black shrink-0">
              {getInitials(session)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold text-gray-900 dark:text-white truncate">
                  {session.customerName || session.customerEmail || `External - code ${session.code}`}
                </span>
                <span className="text-[10px] font-mono text-gray-400">{formatElapsed(session.createdAt)}</span>
              </div>
              <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {session.deviceName ? `${session.deviceName} - ` : ''}{session.issueSummary || session.issueCategory || 'General Support'}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(session.status)}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {statusLabel(session.status)}
                </span>
                <span className="text-[10px] font-mono text-gray-400">{session.code}</span>
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  </section>
  );
};
