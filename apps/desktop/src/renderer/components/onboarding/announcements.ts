// One announcement at a time. The "What's New" carousel and a page's
// FirstRunGuide tour both fire on first sight of the dashboard, and used to
// stack on top of each other (two modals, two Next buttons). A modal that is
// about to show claims the slot; anything else waits for the release.
let activeAnnouncement: string | null = null;
const waiters = new Set<() => void>();

export function claimAnnouncement(id: string): void {
  activeAnnouncement = id;
}

export function releaseAnnouncement(id: string): void {
  if (activeAnnouncement !== id) return;
  activeAnnouncement = null;
  for (const notify of Array.from(waiters)) notify();
}

export function isAnnouncementActive(): boolean {
  return activeAnnouncement !== null;
}

// Resolves once no announcement holds the slot (immediately if none does).
export function whenAnnouncementsClear(callback: () => void): () => void {
  if (!activeAnnouncement) {
    callback();
    return () => {};
  }
  const notify = () => {
    if (activeAnnouncement) return;
    waiters.delete(notify);
    callback();
  };
  waiters.add(notify);
  return () => waiters.delete(notify);
}
