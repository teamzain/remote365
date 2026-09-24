import { create } from 'zustand';
import { CreateSupportSessionInput, SupportSession, sessionsApi } from '../lib/sessionsApi';

type SessionsState = {
  queue: SupportSession[];
  history: SupportSession[];
  selectedId: string | null;
  myActiveSession: SupportSession | null;
  recentlyClosedMySession: SupportSession | null;
  loading: boolean;
  error: string | null;
  fetchQueue: (options?: { skipHistory?: boolean }) => Promise<void>;
  selectSession: (id: string) => void;
  acceptSession: (id: string) => Promise<SupportSession | null>;
  markConnected: (id: string) => Promise<SupportSession | null>;
  updateNotes: (id: string, notes: string) => Promise<void>;
  endSession: (id: string, resolution?: string) => Promise<void>;
  assignSession: (id: string, technicianId: string) => Promise<void>;
  createMySession: (input: CreateSupportSessionInput | string) => Promise<SupportSession>;
  endMySession: () => Promise<void>;
  rateSession: (id: string, rating: number, comment?: string) => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
};

let pollTimer: ReturnType<typeof setInterval> | null = null;

const activeStatuses = 'CREATED,QUEUED,ASSIGNED,RINGING,CONNECTED';

const upsertSession = (items: SupportSession[], session: SupportSession) => {
  const exists = items.some((item) => item.id === session.id);
  return exists ? items.map((item) => (item.id === session.id ? session : item)) : [session, ...items];
};

export const useSessionsStore = create<SessionsState>((set, get) => ({
  queue: [],
  history: [],
  selectedId: null,
  myActiveSession: null,
  recentlyClosedMySession: null,
  loading: false,
  error: null,

  fetchQueue: async (options?: { skipHistory?: boolean }) => {
    set({ loading: true, error: null });
    try {
      // The closed-session history changes rarely; background ticks reuse the
      // copy already in the store instead of re-downloading it every 5 s.
      const [queue, history] = await Promise.all([
        sessionsApi.list({ status: activeStatuses }),
        options?.skipHistory ? Promise.resolve(get().history) : sessionsApi.list({ status: 'ENDED,RESOLVED,EXPIRED' }),
      ]);

      const nextQueue = queue;
      const currentSelectedId = get().selectedId;
      const selectedId =
        (currentSelectedId && (nextQueue.some((session) => session.id === currentSelectedId) || history.some((session) => session.id === currentSelectedId)))
          ? currentSelectedId
          : nextQueue[0]?.id || history[0]?.id || null;
      const myActiveSession = get().myActiveSession;
      const endedMine = myActiveSession ? history.find((session) => session.id === myActiveSession.id) : null;
      const refreshedMine = myActiveSession
        ? nextQueue.find((session) => session.id === myActiveSession.id) || (endedMine ? null : myActiveSession)
        : null;

      set({
        queue: nextQueue,
        history: history.slice(0, 20),
        selectedId,
        myActiveSession: refreshedMine,
        recentlyClosedMySession: endedMine || get().recentlyClosedMySession,
        loading: false,
      });
    } catch (error: any) {
      set({ loading: false, error: error?.response?.data?.error || error?.message || 'Failed To Load Sessions' });
    }
  },

  selectSession: (id: string) => set({ selectedId: id }),

  acceptSession: async (id: string) => {
    const session = get().queue.find((item) => item.id === id);
    if (!session) return null;
    const accepted = await sessionsApi.accept(session);
    set((state) => ({
      queue: upsertSession(state.queue, accepted),
      selectedId: accepted.id,
    }));
    return accepted;
  },

  markConnected: async (id: string) => {
    const connected = await sessionsApi.connected(id);
    set((state) => ({
      queue: upsertSession(state.queue, connected),
      selectedId: connected.id,
      myActiveSession: state.myActiveSession?.id === connected.id ? connected : state.myActiveSession,
    }));
    return connected;
  },

  updateNotes: async (id: string, notes: string) => {
    set((state) => ({
      queue: state.queue.map((session) => (session.id === id ? { ...session, notes } : session)),
    }));
    try {
      const updated = await sessionsApi.update(id, { notes });
      set((state) => ({ queue: upsertSession(state.queue, updated) }));
    } catch (error: any) {
      set({ error: error?.response?.data?.error || error?.message || 'Failed To Save Notes' });
    }
  },

  endSession: async (id: string, resolution?: string) => {
    const ended = await sessionsApi.end(id, resolution);
    set((state) => ({
      queue: state.queue.filter((session) => session.id !== id),
      history: upsertSession(state.history, ended).slice(0, 20),
      selectedId: state.selectedId === id ? state.queue.find((session) => session.id !== id)?.id || null : state.selectedId,
    }));
  },

  createMySession: async (input: CreateSupportSessionInput | string) => {
    const session = await sessionsApi.create(input);
    set((state) => ({
      myActiveSession: session,
      queue: upsertSession(state.queue, session),
      selectedId: state.selectedId || session.id,
      recentlyClosedMySession: null,
    }));
    return session;
  },

  endMySession: async () => {
    const session = get().myActiveSession;
    if (!session) return;
    const ended = await sessionsApi.end(session.id);
    set((state) => ({
      myActiveSession: null,
      queue: state.queue.filter((item) => item.id !== session.id),
      history: upsertSession(state.history, ended).slice(0, 20),
      recentlyClosedMySession: ended,
    }));
  },

  assignSession: async (id: string, technicianId: string) => {
    const assigned = await sessionsApi.assign(id, technicianId);
    set((state) => ({
      queue: upsertSession(state.queue, assigned),
      history: state.history.map((session) => (session.id === assigned.id ? assigned : session)),
      selectedId: assigned.id,
    }));
  },

  rateSession: async (id: string, rating: number, comment?: string) => {
    const rated = await sessionsApi.rate(id, rating, comment);
    set((state) => ({
      history: upsertSession(state.history, rated).slice(0, 20),
      recentlyClosedMySession: state.recentlyClosedMySession?.id === id ? null : state.recentlyClosedMySession,
    }));
  },

  startPolling: () => {
    if (pollTimer) return;
    get().fetchQueue();
    // Was two REST calls every 5 s (~1,440 requests an hour) no matter what.
    // Now: nothing while the window is hidden, the live queue every 5 s while
    // it is visible, and the history list only on every sixth tick (30 s).
    let tick = 0;
    pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      tick += 1;
      get().fetchQueue({ skipHistory: tick % 6 !== 0 });
    }, 5000);
  },

  stopPolling: () => {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  },
}));
