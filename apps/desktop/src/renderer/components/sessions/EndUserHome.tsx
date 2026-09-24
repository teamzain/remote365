import React, { useEffect, useRef, useState } from 'react';
import { PauseCircle, ShieldAlert, Volume2, XCircle } from 'lucide-react';
import { useSessionsStore } from '../../store/sessionsStore';
import { CreateSupportSessionInput, SupportSession, sessionsApi } from '../../lib/sessionsApi';
import { GetHelpCard } from './GetHelpCard';
import { RatingModal } from './RatingModal';

export const EndUserHome: React.FC = () => {
  const { myActiveSession, recentlyClosedMySession, history, loading, createMySession, endMySession, rateSession, startPolling, stopPolling } = useSessionsStore();
  const [ratingSessionId, setRatingSessionId] = useState<string | null>(null);
  const hostedSessionRef = useRef<string | null>(null);
  const lastActiveSessionRef = useRef<string | null>(null);
  const promptedRatingRef = useRef<Set<string>>(new Set());
  const resolvedNotificationRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const createAndAttachSystemInfo = async (input: CreateSupportSessionInput | string) => {
    const session = await createMySession(input);
    const systemInfo = await (window as any).electronAPI?.getSystemInfo?.();
    if (systemInfo) {
      await sessionsApi.systemInfo(session.id, systemInfo);
    }
    return session;
  };

  useEffect(() => {
    if (!myActiveSession) return;
    lastActiveSessionRef.current = myActiveSession.id;
    if (!['ASSIGNED', 'RINGING', 'CONNECTED'].includes(myActiveSession.status)) return;
    if (hostedSessionRef.current === myActiveSession.id) return;
    hostedSessionRef.current = myActiveSession.id;
    (window as any).electronAPI?.startHosting?.(myActiveSession.code, {
      supportSessionId: myActiveSession.id,
      supportSessionCode: myActiveSession.code,
    }).catch((error: any) => {
      hostedSessionRef.current = null;
      console.warn('[SupportSession] Failed to auto-start hosting', error);
    });
  }, [myActiveSession]);

  useEffect(() => {
    const lastActiveSessionId = lastActiveSessionRef.current;
    if (!lastActiveSessionId || promptedRatingRef.current.has(lastActiveSessionId)) return;
    const endedSession = [recentlyClosedMySession, ...history].find((session) =>
      session?.id === lastActiveSessionId &&
      (session.status === 'ENDED' || session.status === 'RESOLVED') &&
      session.rating == null
    );
    if (!endedSession) return;
    promptedRatingRef.current.add(endedSession.id);
    hostedSessionRef.current = null;
    if (!resolvedNotificationRef.current.has(endedSession.id)) {
      resolvedNotificationRef.current.add(endedSession.id);
      const title = 'Support Request Resolved';
      const body = 'Your support request has been resolved by a technician. Please review and confirm that the issue has been fixed.';
      window.dispatchEvent(new CustomEvent('remote365:support-resolved', {
        detail: {
          sessionId: endedSession.id,
          title,
          message: body,
        },
      }));
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') new Notification(title, { body });
        });
      }
    }
    setRatingSessionId(endedSession.id);
  }, [history, recentlyClosedMySession]);

  const endAndRate = async () => {
    const id = myActiveSession?.id || null;
    await endMySession();
    if (id) {
      promptedRatingRef.current.add(id);
      setRatingSessionId(id);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto p-6 animate-in fade-in duration-500">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-black text-gray-900 dark:text-white tracking-tight">End User Home</h1>
            <p className="text-[13px] text-gray-500 dark:text-gray-400">Request help, review privacy controls, and end support any time.</p>
          </div>
        </div>

        <div className="space-y-5">
          <GetHelpCard session={myActiveSession} loading={loading} onCreate={createAndAttachSystemInfo} onEnd={endAndRate} />

          <section className="rounded-2xl bg-white dark:bg-[#0F0F0F] border border-gray-100 dark:border-white/5 p-5 max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert size={18} className="text-[#1D6DF5]" />
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">Before A Session</h2>
            </div>
            <div className="space-y-3 text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">
              <p>The technician can see your screen, control your computer, and transfer files after you approve the support request.</p>
              <p>You can end the session at any time. Recording must be visible while active.</p>
            </div>
          </section>
        </div>

        {myActiveSession && (
          <div className="rounded-2xl bg-[#00193F] text-white px-4 py-3 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[13px] font-bold">Support Request Active</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-[12px] font-bold flex items-center gap-2"><Volume2 size={14} /> Mute</button>
              <button className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-[12px] font-bold flex items-center gap-2"><PauseCircle size={14} /> Pause Sharing</button>
              <button onClick={endAndRate} className="px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-[12px] font-bold flex items-center gap-2"><XCircle size={14} /> End Session</button>
            </div>
          </div>
        )}

        <section className="rounded-2xl bg-white dark:bg-[#0F0F0F] border border-gray-100 dark:border-white/5 p-5">
          <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">Recent Help Sessions</h2>
          <div className="space-y-2">
            {history.slice(0, 3).length === 0 ? (
              <p className="text-[12px] text-gray-400">No completed support sessions yet.</p>
            ) : history.slice(0, 3).map((session: SupportSession) => (
              <div key={session.id} className="rounded-xl bg-gray-50 dark:bg-white/[0.04] p-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-gray-900 dark:text-white truncate">Technician {session.technicianId ? session.technicianId.slice(0, 8) : 'unassigned'}</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{session.notes || session.issueSummary || 'No notes captured.'}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">{new Date(session.createdAt).toLocaleDateString()}</div>
                  <div className="text-[10px] text-gray-400">{session.durationSec ? `${Math.round(session.durationSec / 60)} min` : session.status}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <RatingModal sessionId={ratingSessionId} onClose={() => setRatingSessionId(null)} onSubmit={rateSession} />
    </div>
  );
};
