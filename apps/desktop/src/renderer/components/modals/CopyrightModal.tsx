import React from 'react';
import { X } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface CopyrightModalProps {
  open: boolean;
  onClose: () => void;
}

const copyrightText = `Copyright © 2026 Remote365. All rights reserved.

Remote365, the Remote365 logo, Remote365 ID, and related product names, designs, interfaces, icons, features, software components, documentation, and service materials are owned by Remote365 or its licensors and are protected by applicable copyright, trademark, and intellectual property laws.

You may use Remote365 only according to the license, subscription, or service terms that apply to your account or organization. No part of the Remote365 application, website, documentation, branding, or user interface may be copied, reproduced, modified, distributed, reverse engineered, republished, uploaded, posted, transmitted, sold, or used to create derivative works without prior written permission from Remote365, except where permitted by law or by an active written agreement.

Third-party names, logos, services, and trademarks shown inside Remote365 belong to their respective owners. Their appearance does not imply endorsement, sponsorship, or affiliation unless clearly stated.

Remote365 may include open-source software or third-party components. Those components remain subject to their own license terms. Where required, applicable notices and license information are provided within the application package, documentation, or related distribution materials.

Unauthorized use of Remote365 materials may violate copyright, trademark, privacy, security, and other laws. Remote365 reserves all rights not expressly granted.

For copyright permissions, licensing questions, or intellectual property notices, contact Remote365 support.`;

export const CopyrightModal: React.FC<CopyrightModalProps> = ({ open, onClose }) => (
  <Modal open={open} onClose={onClose} className="z-[230] bg-white/35 p-0 backdrop-blur-[6px]">
    <div className="flex h-[700px] w-[884px] flex-col items-center gap-6 rounded-[12px] bg-white py-6 font-['Mona_Sans',system-ui,sans-serif] text-black shadow-2xl">
      <div className="flex h-[44px] w-[842px] flex-col items-start gap-3">
        <div className="flex h-[34px] w-[842px] items-center justify-between gap-6">
          <div className="flex h-[34px] w-[371px] flex-col items-start">
            <h2 className="m-0 h-[34px] w-[416px] text-[24px] font-bold leading-[34px] text-[#111315]">Copyright</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[rgba(17,19,21,0.45)] hover:bg-[#F3F4F6]" title="Close">
            <X size={24} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="flex h-[580px] w-[748px] flex-col items-start gap-2 overflow-y-auto overflow-x-hidden pr-2">
        <p className="m-0 w-full whitespace-pre-line break-words text-[14px] font-normal leading-5 text-black">{copyrightText}</p>
      </div>
    </div>
  </Modal>
);

export default CopyrightModal;
