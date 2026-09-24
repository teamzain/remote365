import React from 'react';
import { X } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface SupportIdentifierModalProps {
  open: boolean;
  identifier: string;
  version: string;
  onClose: () => void;
}

export const SupportIdentifierModal: React.FC<SupportIdentifierModalProps> = ({ open, identifier, version, onClose }) => (
  <Modal open={open} className="z-[230] bg-white/35 p-0 backdrop-blur-[6px]">
    <div className="flex h-[160px] w-[468px] flex-col items-start gap-[22px] rounded-[12px] bg-white px-6 py-3 font-['Mona_Sans',system-ui,sans-serif] shadow-2xl">
      <div className="flex h-11 w-[420px] items-center justify-center gap-[22px]">
        <div className="flex h-11 w-[382px] items-center gap-2">
          <div className="flex h-11 w-[337px] items-center justify-center gap-2.5 p-[5px]">
            <h2 className="m-0 h-[34px] w-[336px] text-[24px] font-bold leading-[34px] text-[#111315]">Customer Support Identifier</h2>
          </div>
        </div>
        <button type="button" onClick={onClose} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[rgba(17,19,21,0.45)] hover:bg-[#F3F4F6]" title="Close">
          <X size={24} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex h-[70px] w-[420px] flex-col items-start gap-[22px]">
        <div className="flex h-[70px] w-[420px] items-center justify-center gap-[7px] rounded bg-[#F3F4F6]">
          <div className="flex h-[70px] w-[200px] items-center gap-[60px] rounded bg-[#F3F4F6] px-4 py-2">
            <div className="flex h-[54px] w-[138px] flex-col items-start">
              <span className="flex h-5 w-[138px] items-center text-[14px] font-normal leading-5 text-[rgba(26,29,33,0.7)]">Support Identifier</span>
              <span className="flex h-[34px] w-[138px] items-center whitespace-nowrap text-[24px] font-medium leading-[34px] text-[#111315]">{identifier}</span>
            </div>
          </div>
          <div className="h-11 w-px shrink-0 bg-[rgba(26,29,33,0.3)]" />
          <div className="flex h-[70px] w-[200px] items-center gap-[30px] rounded bg-[#F3F4F6] px-4 py-2">
            <div className="flex h-[54px] w-[138px] flex-col items-start">
              <span className="flex h-5 w-[138px] items-center text-[14px] font-normal leading-5 text-[rgba(26,29,33,0.7)]">Remote365 Versions</span>
              <span className="flex h-[34px] w-[138px] items-center text-[24px] font-medium leading-[34px] text-[#111315]">{version}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Modal>
);

export default SupportIdentifierModal;
