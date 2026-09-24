import React, { useEffect, useState } from 'react';
import { X, Monitor, RefreshCw } from 'lucide-react';

/**
 * "Screen Sharing" picker (Figma: screen sharing modal, 522 x 334).
 * Lists the available screens / windows (via Electron desktopCapturer) and
 * lets the user pick one to share. Falls back to the browser display-media
 * prompt when no source list is available (non-Electron / empty list).
 */

export interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
  isScreen?: boolean;
}

interface ScreenShareModalProps {
  open: boolean;
  onClose: () => void;
  onShare: (sourceId?: string) => void;
}

export const ScreenShareModal: React.FC<ScreenShareModalProps> = ({ open, onClose, onShare }) => {
  const [sources, setSources] = useState<ScreenSource[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const electronApi = (window as any).electronAPI;

    setSelectedId(null);
    if (!electronApi?.getScreenSources) {
      setSources([]);
      return;
    }

    setLoading(true);
    electronApi
      .getScreenSources()
      .then((result: ScreenSource[]) => {
        if (cancelled) return;
        const list = Array.isArray(result) ? result : [];
        setSources(list);
        setSelectedId(list[0]?.id ?? null);
      })
      .catch(() => !cancelled && setSources([]))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const hasSources = sources.length > 0;

  return (
    <div className="absolute bottom-[92px] right-6 z-[120] w-[522px] max-w-[calc(100vw-48px)] animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex flex-col gap-6 rounded-[12px] bg-white px-6 py-3 font-['Mona_Sans',system-ui,sans-serif] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
        {/* Header */}
        <div className="flex items-center gap-2 pt-2">
          <h3 className="flex-1 text-center text-[24px] font-bold leading-[34px] text-[#111315]">Screen Sharing</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-[#111315]/70 transition-colors hover:bg-black/5 hover:text-[#111315]"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Thumbnails */}
        <div className="grid grid-cols-3 gap-3">
          {loading && !hasSources
            ? [0, 1, 2].map((i) => (
                <div key={i} className="flex h-[100px] items-center justify-center rounded bg-[#F3F4F6] text-[#111315]/30">
                  <RefreshCw size={18} className="animate-spin" />
                </div>
              ))
            : hasSources
            ? sources.slice(0, 6).map((source) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => setSelectedId(source.id)}
                  title={source.name}
                  className={`group relative flex h-[100px] items-center justify-center overflow-hidden rounded bg-[#F3F4F6] transition-all ${
                    selectedId === source.id
                      ? 'ring-2 ring-[#FF8A00] ring-offset-1'
                      : 'hover:ring-2 hover:ring-[#FF8A00]/40'
                  }`}
                >
                  {source.thumbnail ? (
                    <img src={source.thumbnail} alt={source.name} className="h-full w-full object-cover" />
                  ) : (
                    <Monitor size={22} className="text-[#111315]/40" />
                  )}
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {source.name}
                  </span>
                </button>
              ))
            : [0, 1, 2].map((i) => <div key={i} className="h-[100px] rounded bg-[#F3F4F6]" />)}
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-5">
          <p className="text-center text-[14px] font-normal leading-5 text-[#111315]">
            {hasSources ? 'Select a screen or window to share.' : 'No screen is currently shared.'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-[124px] items-center justify-center rounded-[32px] border border-[#1A1D21]/30 bg-white text-[14px] font-medium text-[#111315] transition-colors hover:bg-black/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onShare(selectedId || undefined)}
              className="flex h-10 w-[124px] items-center justify-center rounded-[32px] text-[14px] font-medium text-white transition hover:brightness-105"
              style={{ background: 'linear-gradient(118.29deg, #FF8A00 38.71%, #FFB347 88.95%)' }}
            >
              Share Screen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
