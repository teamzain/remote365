export type Session = { accessToken: string; refreshToken?: string; user: { id: string; email: string; name?: string | null } };

// One refresh per session, even when foreground checks and data requests overlap.
// The generation guard prevents a late response from undoing logout/new sign-in.
export function createSessionManager(deps: {
  refresh: (token: string) => Promise<Session>;
  persist: (session: Session | null) => Promise<void>;
  onChange: (session: Session | null) => void;
}) {
  let current: Session | null = null;
  let remember = true;
  let generation = 0;
  let pending: Promise<Session | null> | null = null;
  let writes = Promise.resolve();
  const persist = () => {
    const saved = remember ? current : null;
    writes = writes.catch(() => {}).then(() => deps.persist(saved));
    return writes;
  };
  return {
    get: () => current,
    version: () => generation,
    async set(session: Session | null, shouldRemember = true) {
      generation++; pending = null; current = session; remember = shouldRemember;
      deps.onChange(current);
      await persist();
    },
    async refresh() {
      if (!current?.refreshToken) throw Object.assign(new Error('Your session has expired. Please sign in again.'), { status: 401 });
      if (pending) return pending;
      const version = generation;
      const token = current.refreshToken;
      const operation = (async () => {
        const result = await deps.refresh(token);
        if (version !== generation) return null;
        if (!result?.accessToken || !result?.user?.id) throw new Error('Invalid session refresh response. Please try again.');
        current = { ...result, refreshToken: result.refreshToken || token };
        deps.onChange(current);
        await persist();
        return current;
      })();
      pending = operation;
      try { return await operation; } finally { if (pending === operation) pending = null; }
    },
  };
}
