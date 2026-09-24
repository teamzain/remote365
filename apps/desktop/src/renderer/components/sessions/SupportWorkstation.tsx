import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Search } from 'lucide-react';
import { useSessionsStore } from '../../store/sessionsStore';
import { useAuthStore } from '../../store/authStore';
import { SessionQueue } from './SessionQueue';
import { SessionDetails } from './SessionDetails';
import { SupportSession, SupportTechnician, sessionsApi } from '../../lib/sessionsApi';

type Props = {
  serverIP: string;
};

export const SupportWorkstation: React.FC<Props> = ({ serverIP }) => {
  const { accessToken, user } = useAuthStore();
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [technicians, setTechnicians] = useState<SupportTechnician[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const {
    queue,
    history,
    selectedId,
    loading,
    error,
    fetchQueue,
    selectSession,
    acceptSession,
    markConnected,
    updateNotes,
    endSession,
    assignSession,
    startPolling,
    stopPolling,
  } = useSessionsStore();
  const normalizedRole = String(user?.role || '').toUpperCase();
  const isTechnician = normalizedRole === 'TECHNICIAN';

  useEffect(() => {
    startPolling();
    sessionsApi.technicians().then(setTechnicians).catch(() => setTechnicians([]));
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const selectedSession = useMemo(
    () => queue.find((session) => session.id === selectedId) || history.find((session) => session.id === selectedId) || queue[0] || null,
    [history, queue, selectedId]
  );

  const handleNotesChange = useCallback((id: string, notes: string) => {
    updateNotes(id, notes);
  }, [updateNotes]);

  const customerHistory = useMemo(() => {
    if (!selectedSession) return [];
    const customerKey = selectedSession.customerUserId || selectedSession.customerEmail || selectedSession.customerName;
    if (!customerKey) return history;
    return history.filter((session) =>
      session.customerUserId === customerKey ||
      session.customerEmail === customerKey ||
      session.customerName === customerKey
    );
  }, [history, selectedSession]);

  const handleConnect = useCallback(async (id: string) => {
    const current = queue.find((session) => session.id === id) || history.find((session) => session.id === id);
    if (!current) return;
    setConnectingId(id);
    try {
      let sessionForConnection = current;
      if (current.status === 'QUEUED' || current.status === 'CREATED') {
        sessionForConnection = await acceptSession(id) || current;
      }
      const tokenResult = await (window as any).electronAPI?.getToken?.();
      const token = accessToken || tokenResult?.token || '';
      await (window as any).electronAPI?.connectToHost?.(sessionForConnection.code, serverIP, token);
      await markConnected(id);
      await fetchQueue();
    } finally {
      setConnectingId(null);
    }
  }, [acceptSession, accessToken, fetchQueue, history, markConnected, queue, serverIP]);

  const handleEndSession = useCallback(async (id: string) => {
    const selected = queue.find((session) => session.id === id) || history.find((session) => session.id === id);
    const defaultResolution = selected?.notes?.split('\n').slice(-1)[0] || '';
    const resolution = window.prompt('Resolution Summary For This Support Request', defaultResolution);
    if (resolution === null) return;
    await endSession(id, resolution?.trim() || undefined);
  }, [endSession, history, queue]);

  const allRows = useMemo(() => [...queue, ...history], [queue, history]);
  const managerRows = useMemo(() => {
    const lower = search.trim().toLowerCase();
    return allRows.filter((session) => {
      if (statusFilter !== 'ALL' && session.status !== statusFilter) return false;
      if (!lower) return true;
      return [
        session.id,
        session.customerName,
        session.customerEmail,
        session.issueSummary,
        session.deviceName,
        session.technicianId,
      ].some((value) => String(value || '').toLowerCase().includes(lower));
    });
  }, [allRows, search, statusFilter]);

  const technicianName = useCallback((id?: string | null) => {
    if (!id) return 'Unassigned';
    const technician = technicians.find((item) => item.id === id);
    return technician?.name || technician?.email || `Technician ${id.slice(0, 8)}`;
  }, [technicians]);

  if (!isTechnician) {
    return (
      <div className="w-full h-full min-h-0 flex flex-col bg-white dark:bg-[#080808] animate-in fade-in duration-500">
        <div className="px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-black text-gray-900 dark:text-white tracking-tight">Support Requests</h1>
            <p className="text-[13px] text-gray-500 dark:text-gray-400">Track requests, assign technicians, and monitor progress.</p>
          </div>
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-500/10 px-3 py-2 text-[12px] font-semibold text-red-600 dark:text-red-300 flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        <div className="px-6 pb-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by user, issue, device, or request ID"
              className="h-11 w-full rounded-xl border border-gray-100 bg-gray-50 pl-9 pr-3 text-[13px] outline-none focus:border-blue-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-11 rounded-xl border border-gray-100 bg-gray-50 px-3 text-[13px] outline-none focus:border-blue-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
          >
            {['ALL', 'CREATED', 'ASSIGNED', 'CONNECTED', 'RESOLVED', 'ENDED', 'EXPIRED'].map((status) => (
              <option key={status} value={status}>{status === 'ALL' ? 'All Statuses' : status}</option>
            ))}
          </select>
          <button onClick={() => fetchQueue()} className="h-11 rounded-xl bg-gray-900 px-4 text-[13px] font-bold text-white dark:bg-white dark:text-black">Refresh</button>
        </div>

        <div className="min-h-0 flex-1 px-6 pb-6 overflow-auto">
          <table className="min-w-[980px] w-full overflow-hidden rounded-2xl border border-gray-100 bg-white text-left text-[13px] dark:border-white/5 dark:bg-[#0F0F0F]">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 dark:bg-white/[0.04]">
              <tr>
                <th className="px-4 py-3">Request ID</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Issue Title</th>
                <th className="px-4 py-3">Technician</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created Date</th>
                <th className="px-4 py-3">Completed Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {managerRows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No support requests found.</td></tr>
              ) : managerRows.map((session: SupportSession) => (
                <tr key={session.id} className="align-top hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-mono text-[11px] text-gray-500">{session.id.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-gray-900 dark:text-white">{session.customerName || 'Unknown User'}</div>
                    <div className="text-[11px] text-gray-400">{session.customerEmail}</div>
                  </td>
                  <td className="px-4 py-3 max-w-[280px]">
                    <div className="font-semibold text-gray-900 dark:text-white">{session.issueSummary || session.issueCategory || 'General Support'}</div>
                    <div className="mt-1 text-[11px] text-gray-400">{session.deviceName || 'No Device Selected'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={session.technicianId || ''}
                      onChange={(event) => event.target.value && assignSession(session.id, event.target.value)}
                      disabled={['RESOLVED', 'ENDED', 'EXPIRED'].includes(session.status)}
                      className="h-9 min-w-[170px] rounded-lg border border-gray-100 bg-gray-50 px-2 text-[12px] outline-none disabled:opacity-50 dark:border-white/10 dark:bg-black/20 dark:text-white"
                    >
                      <option value="">{technicianName(session.technicianId)}</option>
                      {technicians.map((technician) => (
                        <option key={technician.id} value={technician.id}>{technician.name || technician.email || technician.id.slice(0, 8)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">{session.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(session.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500">{session.endedAt ? new Date(session.endedAt).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 flex flex-col animate-in fade-in duration-500">
      <div className="px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-black text-gray-900 dark:text-white tracking-tight">Technician Sessions</h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-400">Assigned requests, remote connection controls, and resolution notes.</p>
        </div>
        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-500/10 px-3 py-2 text-[12px] font-semibold text-red-600 dark:text-red-300 flex items-center gap-2">
            <AlertCircle size={14} />
            {error}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 px-6 pb-6 grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-4">
        <SessionQueue
          queue={queue}
          history={history}
          selectedId={selectedSession?.id || null}
          loading={loading}
          onSelect={selectSession}
          onRefresh={fetchQueue}
        />
        <SessionDetails
          session={selectedSession}
          customerHistory={customerHistory}
          connecting={connectingId === selectedSession?.id}
          onConnect={handleConnect}
          onMarkDone={handleEndSession}
          onNotesChange={handleNotesChange}
        />
      </div>
    </div>
  );
};
