import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  GripVertical,
  Lock,
} from 'lucide-react';
import {
  SidebarPreferences,
  getSidebarPreferences,
  saveSidebarPreferences,
  resetSidebarPreferences,
} from '../lib/sidebarPreferences';

export interface CustomizableItem {
  id: string;
  label: string;
  group: 'main' | 'utility';
  protected?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: CustomizableItem[];
  preferenceScope?: string | null;
  onApply: (prefs: SidebarPreferences) => void;
}

const arrayMove = <T,>(arr: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const next = [...arr];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

export const SidebarCustomizationModal: React.FC<Props> = ({ open, onClose, items, preferenceScope, onApply }) => {
  const initial = useMemo(() => getSidebarPreferences(preferenceScope), [open, preferenceScope]);
  const [hidden, setHidden] = useState<string[]>(initial.hidden);
  const [order, setOrder] = useState<string[]>(() => {
    if (initial.order.length === 0) return items.map((i) => i.id);
    const itemIds = items.map((i) => i.id);
    const ordered = initial.order.filter((id) => itemIds.includes(id));
    const missing = itemIds.filter((id) => !ordered.includes(id));
    return [...ordered, ...missing];
  });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Re-sync state whenever the modal opens or items change
  useEffect(() => {
    if (!open) return;
    const fresh = getSidebarPreferences(preferenceScope);
    setHidden(fresh.hidden);
    const itemIds = items.map((i) => i.id);
    const ordered = fresh.order.length === 0 ? itemIds : fresh.order.filter((id) => itemIds.includes(id));
    const missing = itemIds.filter((id) => !ordered.includes(id));
    setOrder([...ordered, ...missing]);
  }, [open, items, preferenceScope]);

  if (!open) return null;

  const orderedItems = order
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is CustomizableItem => Boolean(item));

  const toggleHidden = (id: string, isProtected: boolean) => {
    if (isProtected) return;
    setHidden((current) => (current.includes(id) ? current.filter((v) => v !== id) : [...current, id]));
  };

  const move = (id: string, direction: -1 | 1) => {
    const idx = order.indexOf(id);
    if (idx === -1) return;
    setOrder((current) => arrayMove(current, idx, idx + direction));
  };

  const handleSave = () => {
    const prefs: SidebarPreferences = {
      hidden: hidden.filter((id) => {
        const item = items.find((entry) => entry.id === id);
        return item && !item.protected;
      }),
      order,
    };
    saveSidebarPreferences(prefs, preferenceScope);
    onApply(prefs);
    onClose();
  };

  const handleReset = () => {
    resetSidebarPreferences(preferenceScope);
    setHidden([]);
    setOrder(items.map((i) => i.id));
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, id: string) => {
    setDraggingId(id);
    try {
      event.dataTransfer.setData('text/plain', id);
      event.dataTransfer.effectAllowed = 'move';
    } catch {}
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>, id: string) => {
    if (!draggingId || draggingId === id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) setDragOverId(id);
  };

  const handleDragLeave = (id: string) => {
    if (dragOverId === id) setDragOverId(null);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault();
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    setOrder((current) => {
      const fromIdx = current.indexOf(draggingId);
      const toIdx = current.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return current;
      const next = [...current];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const renderRow = (item: CustomizableItem, index: number, total: number) => {
    const isHidden = hidden.includes(item.id);
    const isProtected = !!item.protected;
    const isDragging = draggingId === item.id;
    const isDragTarget = dragOverId === item.id && draggingId !== item.id;
    return (
      <div
        key={item.id}
        draggable
        onDragStart={(e) => handleDragStart(e, item.id)}
        onDragOver={(e) => handleDragOver(e, item.id)}
        onDragLeave={() => handleDragLeave(item.id)}
        onDrop={(e) => handleDrop(e, item.id)}
        onDragEnd={handleDragEnd}
        className={`flex h-10 w-[420px] items-center rounded-[4px] border px-4 py-2.5 font-['Mona_Sans',system-ui,sans-serif] transition-colors ${
          isDragging
            ? 'opacity-40 border-dashed border-blue-300 dark:border-blue-500/40'
            : isDragTarget
              ? 'border-blue-400 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-500/10 ring-2 ring-blue-200 dark:ring-blue-500/20'
              : isHidden
                ? 'border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/0 opacity-60'
                : 'border-[rgba(26,29,33,0.3)] bg-white'
        }`}
      >
        <div className="flex h-5 w-[388px] items-center justify-between">
          <div className="flex h-5 w-[254px] items-center gap-3">
            <GripVertical size={16} className="shrink-0 cursor-grab text-[rgba(17,19,21,0.35)] active:cursor-grabbing" />
            <span className="h-5 w-[226px] truncate text-[14px] font-medium leading-5 text-[#111315]">
              {item.label}
            </span>
          </div>
          <div className={`flex items-center gap-2 ${isProtected ? 'h-[17px] w-[103px]' : 'h-4 w-16'}`}>
            {isProtected ? (
              <span className="flex h-[17px] w-[79px] items-center gap-1 text-[12px] font-medium leading-[17px] text-[rgba(17,19,21,0.3)]">
                <Lock size={16} strokeWidth={1.5} /> Required
              </span>
            ) : (
              <button
                type="button"
                onClick={() => toggleHidden(item.id, isProtected)}
                className={`flex h-4 w-4 items-center justify-center rounded transition-colors ${
                  isHidden
                    ? 'text-[rgba(17,19,21,0.3)] hover:text-gray-700'
                    : 'text-[#1D5CFF] hover:bg-blue-50'
                }`}
                title={isHidden ? 'Show In Sidebar' : 'Hide From Sidebar'}
              >
                {isHidden ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
              </button>
            )}
            <div className={`flex h-4 items-center gap-2 ${isProtected && index === 0 ? 'w-4' : 'w-10'}`}>
              <button
                type="button"
                onClick={() => move(item.id, -1)}
                disabled={index === 0}
                className={`${index === 0 ? 'hidden' : 'flex'} h-4 w-4 items-center justify-center text-[rgba(17,19,21,0.45)] transition-colors hover:text-[#111315] disabled:cursor-not-allowed disabled:opacity-30`}
                title="Move Up"
              >
                <ArrowUp size={16} strokeWidth={1.6} />
              </button>
              <button
                type="button"
                onClick={() => move(item.id, 1)}
                disabled={index === total - 1}
                className="flex h-4 w-4 items-center justify-center text-[rgba(17,19,21,0.45)] transition-colors hover:text-[#111315] disabled:cursor-not-allowed disabled:opacity-30"
                title="Move Down"
              >
                <ArrowDown size={16} strokeWidth={1.6} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const mainItems = orderedItems.filter((item) => item.group === 'main');
  const utilityItems = orderedItems.filter((item) => item.group === 'utility');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex h-[640px] w-[463px] max-h-[calc(100vh-32px)] max-w-[calc(100vw-32px)] flex-col items-center justify-center gap-[22px] rounded-[12px] bg-white p-6 font-['Mona_Sans',system-ui,sans-serif] shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex h-[54px] w-[415px] items-center justify-center gap-6">
          <div className="flex h-[54px] w-[371px] flex-col items-start">
            <h2 className="m-0 h-[34px] w-[416px] text-[24px] font-bold leading-[34px] text-[#111315]">Customize Sidebar</h2>
            <p className="m-0 h-5 w-[416px] text-[14px] font-normal leading-5 text-[rgba(17,19,21,0.55)]">
              Drag the grip handle to reorder, or click the eye to hide an item.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[rgba(17,19,21,0.45)] hover:bg-gray-100"
          >
            <X size={24} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex h-[454px] w-[415px] flex-col items-start gap-[22px] overflow-visible">
          <div className="flex h-[264px] w-[415px] flex-col items-start gap-3">
            <p className="m-0 h-5 w-[415px] text-[14px] font-semibold leading-5 text-[rgba(17,19,21,0.45)]">Main Navigation</p>
            <div className="flex h-[232px] w-[415px] flex-col items-start gap-2">
              {mainItems.length === 0 ? (
                <p className="text-[12px] text-gray-400 px-1">No main items.</p>
              ) : (
                mainItems.map((item) => {
                  const overallIndex = order.indexOf(item.id);
                  return renderRow(item, overallIndex, order.length);
                })
              )}
            </div>
          </div>
          <div className="flex h-[168px] w-[415px] flex-col items-start gap-3">
            <p className="m-0 h-5 w-[415px] text-[14px] font-semibold leading-5 text-[rgba(17,19,21,0.45)]">Utility</p>
            <div className="flex h-[136px] w-[415px] flex-col items-start gap-2">
              {utilityItems.length === 0 ? (
                <p className="text-[12px] text-gray-400 px-1">No utility items.</p>
              ) : (
                utilityItems.map((item) => {
                  const overallIndex = order.indexOf(item.id);
                  return renderRow(item, overallIndex, order.length);
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex h-10 w-[415px] items-end justify-end gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex h-10 w-[151px] items-center justify-end gap-2 whitespace-nowrap rounded-[4px] px-2 py-2.5 text-[14px] font-medium leading-5 text-[#1A1D21] transition-colors hover:bg-gray-50"
          >
            <RotateCcw size={16} strokeWidth={1.5} className="h-4 w-4 shrink-0" />
            <span className="h-5">Reset To Default</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-[124px] items-center justify-center rounded-[32px] border border-[rgba(26,29,33,0.3)] bg-white px-4 py-2.5 text-[14px] font-medium leading-5 text-[rgba(26,29,33,0.7)] transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex h-10 w-[124px] items-center justify-center whitespace-nowrap rounded-[32px] bg-[linear-gradient(118.29deg,#FF8A00_38.71%,#FFB347_88.95%)] px-4 py-2.5 text-[14px] font-medium leading-5 text-white transition-opacity hover:opacity-90"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
