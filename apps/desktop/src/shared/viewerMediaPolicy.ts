/** Keep connection/control state alive while only the selected visible tab streams. */
export function isViewerMediaActive(tabId: string, activeId: string, visible: boolean, minimized: boolean): boolean {
  return tabId === activeId && visible && !minimized;
}

/** Missing flags belong to older clients, which continue streaming normally. */
export function hasActiveMediaViewer(peers: Iterable<{ mediaPaused?: boolean }>): boolean {
  for (const peer of peers) if (!peer.mediaPaused) return true;
  return false;
}

export function updateHostMediaActivity(
  peers: Iterable<{ mediaPaused?: boolean }>,
  peer: { mediaPaused?: boolean },
  active: boolean,
): 'none' | 'pause' | 'resume' | 'keyframe' {
  if (Boolean(peer.mediaPaused) === !active) return 'none';
  const viewers = Array.from(peers);
  const hadActiveViewer = hasActiveMediaViewer(viewers);
  peer.mediaPaused = !active;
  if (!hasActiveMediaViewer(viewers)) return 'pause';
  if (active) return hadActiveViewer ? 'keyframe' : 'resume';
  return 'none';
}
