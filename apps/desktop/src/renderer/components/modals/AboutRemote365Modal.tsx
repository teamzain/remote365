import React from 'react';
import { X } from 'lucide-react';
import logo from '../../../logo.png';
import { Modal } from '../ui/Modal';

interface AboutRemote365ModalProps {
  open: boolean;
  version: string;
  releaseDate: string;
  onClose: () => void;
}

export const AboutRemote365Modal: React.FC<AboutRemote365ModalProps> = ({ open, version, releaseDate, onClose }) => (
  <Modal open={open} onClose={onClose} className="z-[230] bg-white/35 p-0 backdrop-blur-[6px]">
    <div className="flex h-[196px] w-[468px] flex-col items-start gap-[22px] rounded-[12px] bg-white p-6 font-['Mona_Sans',system-ui,sans-serif] shadow-2xl">
      <div className="flex h-[50px] w-[420px] items-center justify-between gap-[112px]">
        <div className="flex h-[50px] w-[200px] items-center gap-2">
          <img src={logo} alt="Remote365" className="h-[50px] w-[50px] object-contain" />
          <h2 className="m-0 h-[34px] w-[142px] text-[24px] font-bold leading-[34px] text-[#111315]">Remote365</h2>
        </div>
        <button type="button" onClick={onClose} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[rgba(17,19,21,0.45)] hover:bg-[#F3F4F6]" title="Close">
          <X size={24} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex h-[76px] w-[420px] flex-col items-start gap-2">
        <div className="flex h-12 w-[255px] flex-col items-start gap-2">
          <p className="m-0 h-5 w-[255px] text-[14px] font-normal leading-5 text-[#111315]">Version: {version}</p>
          <p className="m-0 h-5 w-[255px] text-[14px] font-normal leading-5 text-[#111315]">Date: {releaseDate}</p>
        </div>
        <p className="m-0 h-5 w-[420px] text-[14px] font-normal leading-5 text-[rgba(26,29,33,0.5)]">Copyright 2026 © Remote365. All Rights Reserved.</p>
      </div>
    </div>
  </Modal>
);

export default AboutRemote365Modal;
