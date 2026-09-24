import React from 'react';
import { ArrowRight, ChevronRight, Folder, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface ArchivedDevicesModalProps {
  open: boolean;
  archivedDeviceKeys: string[];
  filteredArchivedDeviceKeys: string[];
  search: string;
  onSearchChange: (value: string) => void;
  onClose: () => void;
  onRestore: () => void;
  onDelete: () => void;
  formatCode: (code: string) => string;
}

export const ArchivedDevicesModal: React.FC<ArchivedDevicesModalProps> = ({
  open,
  archivedDeviceKeys,
  filteredArchivedDeviceKeys,
  search,
  onSearchChange,
  onClose,
  onRestore,
  onDelete,
  formatCode,
}) => (
  <Modal open={open} className="z-[230] bg-white/35 p-0 backdrop-blur-[6px]">
    <div className="flex h-[380px] w-[628px] flex-col items-start gap-[22px] rounded-[12px] bg-white p-6 font-['Mona_Sans',system-ui,sans-serif] shadow-2xl">
      <div className="flex h-[136px] w-[580px] flex-col items-start gap-[22px]">
        <div className="flex h-[74px] w-[580px] items-center justify-between gap-6">
          <div className="flex h-[74px] w-[371px] flex-col items-start">
            <h2 className="m-0 h-[34px] w-[416px] text-[24px] font-bold leading-[34px] text-[#111315]">Archived Devices</h2>
            <p className="m-0 h-10 w-[371px] text-[14px] font-normal leading-5 text-[rgba(26,29,33,0.7)]">
              Overview of all archived devices that were migrated with their previous state.
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded text-[rgba(17,19,21,0.45)] hover:bg-[#F3F4F6]" title="Close">
            <X size={24} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex h-10 w-[580px] items-center justify-between gap-[63px]">
          <div className="flex h-10 w-[219px] items-center gap-3">
            <button type="button" onClick={onRestore} disabled={archivedDeviceKeys.length === 0} className="flex h-10 w-[108px] items-center justify-center gap-2 rounded-[4px] px-4 py-2.5 text-[14px] font-medium leading-5 text-[#111315] transition-colors hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-40">
              <RefreshCw size={16} strokeWidth={1.5} className="h-4 w-4 shrink-0" />
              Restore
            </button>
            <button type="button" onClick={onDelete} disabled={archivedDeviceKeys.length === 0} className="flex h-10 w-[99px] items-center justify-center gap-2 rounded-[4px] px-4 py-2.5 text-[14px] font-medium leading-5 text-[#111315] transition-colors hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-40">
              <Trash2 size={16} strokeWidth={1.5} className="h-4 w-4 shrink-0" />
              Delete
            </button>
          </div>

          <label className="flex h-10 w-[299px] flex-col items-start">
            <div className="flex h-10 w-[299px] items-center gap-2 rounded-[4px] border border-[rgba(26,29,33,0.3)] bg-white px-4 py-2.5">
              <Search size={16} strokeWidth={1.5} className="h-4 w-4 shrink-0 text-[rgba(26,29,33,0.3)]" />
              <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search Archived Devices" className="h-5 min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] font-medium leading-5 text-[#111315] outline-none placeholder:text-[rgba(17,19,21,0.3)]" />
            </div>
          </label>
        </div>
      </div>

      <div className="h-0 w-[580px] border-t border-[rgba(26,29,33,0.3)]" />

      <div className="flex h-[152px] w-[580px] flex-col items-start gap-4 overflow-y-auto overflow-x-hidden pr-1">
        {filteredArchivedDeviceKeys.length === 0 ? (
          <div className="flex h-10 w-[580px] items-center rounded-[4px] bg-[#F3F4F6] px-4 py-2.5 text-[14px] font-medium leading-5 text-[rgba(17,19,21,0.45)]">
            {archivedDeviceKeys.length === 0 ? 'No archived devices.' : 'No archived devices match your search.'}
          </div>
        ) : (
          filteredArchivedDeviceKeys.map((key) => (
            <button key={key} type="button" className="flex h-10 w-[580px] shrink-0 flex-col items-start rounded-[4px] bg-[#F3F4F6] px-4 py-2.5 transition-colors hover:bg-[#ECEEF2]">
              <div className="flex h-5 w-[548px] items-center justify-between gap-[88px]">
                <div className="flex h-5 w-[378px] items-center gap-3">
                  <ChevronRight size={18} strokeWidth={1.6} className="h-[18px] w-[9px] shrink-0 text-[rgba(17,19,21,0.55)]" />
                  <Folder size={16} strokeWidth={1.5} className="h-4 w-4 shrink-0 text-[#111315]" />
                  <span className="h-5 w-[320px] truncate text-left text-[14px] font-medium leading-5 text-[#111315]">Device ID {formatCode(key)}</span>
                </div>
                <ArrowRight size={16} strokeWidth={1.6} className="h-4 w-4 shrink-0 -rotate-45 text-[rgba(17,19,21,0.55)]" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  </Modal>
);

export default ArchivedDevicesModal;
