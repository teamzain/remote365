import React from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface UpdateCheckModalProps {
  open: boolean;
  message: string;
  busy: boolean;
  onClose: () => void;
}

export const UpdateCheckModal: React.FC<UpdateCheckModalProps> = ({ open, message, busy, onClose }) => (
  <Modal open={open} className="z-[230] bg-white/35 p-0 backdrop-blur-[6px]">
    <div className="flex h-[172px] w-[468px] flex-col items-start gap-[22px] rounded-[12px] bg-white px-6 py-3 font-['Mona_Sans',system-ui,sans-serif] shadow-2xl">
      <div className="flex h-11 w-[420px] items-center justify-center gap-[22px]">
        <div className="flex h-11 w-[382px] items-center gap-2">
          <div className="flex h-11 w-[273px] items-center justify-center gap-2.5 p-[5px]">
            <h2 className="m-0 h-[34px] w-[263px] flex-1 text-[24px] font-bold leading-[34px] text-[#111315]">Remote365 Update</h2>
          </div>
        </div>
        <button type="button" onClick={onClose} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[rgba(17,19,21,0.45)] hover:bg-[#F3F4F6]" title="Close">
          <X size={24} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex h-[82px] w-[420px] flex-col items-start gap-[22px]">
        <p className="m-0 h-5 w-[420px] text-[14px] font-normal leading-5 text-[#111315]">{message}</p>
        <div className="flex h-10 w-[420px] flex-col items-end gap-[22px]">
          <div className="flex h-10 w-[124px] items-center gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="flex h-10 w-[124px] items-center justify-center gap-2.5 rounded-[32px] bg-[linear-gradient(118.29deg,#FF8A00_38.71%,#FFB347_88.95%)] px-4 py-2.5 text-[14px] font-medium leading-5 text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70">
              {busy ? <RefreshCw size={16} className="animate-spin" /> : 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Modal>
);

export default UpdateCheckModal;
