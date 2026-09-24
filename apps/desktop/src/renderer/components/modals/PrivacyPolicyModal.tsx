import React from 'react';
import { X } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface PrivacyPolicyModalProps {
  open: boolean;
  onClose: () => void;
}

const sections = [
  {
    title: '1. Introduction',
    body: `Welcome to Remote365. Remote365 ("Remote365", "we", "our", or "us") provides secure remote desktop access, device management, collaboration, and support services for individuals, businesses, and enterprise organizations.

This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you:
Access our website
Create an account
Use our desktop or mobile applications
Initiate or receive remote support sessions
Communicate with our support team
Use any related services offered by Remote365

By using Remote365, you agree to the practices described in this Privacy Policy.`,
  },
  {
    title: '2. Information We Collect',
    body: `We collect information necessary to provide secure, reliable, and high-quality remote access services.

2.1 Account Information
When you create an account, we may collect:
Full name
Email address
Password (encrypted and securely stored)
Organization or company name
Billing information
Phone number (optional)
Profile image (optional)

2.2 Device & Technical Information
To enable remote connectivity and security features, we may collect:
Device identifiers
IP addresses
Operating system information
Browser type and version
Device names and tags
Session timestamps
Connection logs

2.3 Session Information
During remote access sessions, we may process:
Session duration
Session participants
File transfer activity
Audit logs
Session recordings (if enabled by the organization)
Chat messages exchanged during a session

Remote365 does not actively monitor or view the contents of your remote sessions.

2.4 Payment Information
Payments are processed securely through trusted third-party payment providers. Remote365 does not store complete credit card information on our servers.

2.5 Support & Communication Data
If you contact support or communicate with us, we may collect:
Support tickets
Email conversations
Feedback submissions
Feature requests
Technical troubleshooting information`,
  },
  {
    title: '3. Remote Sessions & Privacy',
    body: `Remote365 is designed with privacy and security as core principles.

End-to-End Encryption
All remote sessions are encrypted using industry-standard encryption technologies.

Session Visibility
Remote365 employees cannot access your sessions unless:
You explicitly request technical support
Access is legally required
Access is necessary to investigate abuse, fraud, or security threats

Session Recording
Some organizations may enable session recording for:
Compliance purposes
Employee training
Quality assurance
Internal auditing

Organizations are responsible for notifying their users if session recording is enabled.`,
  },
  {
    title: '4. Cookies & Tracking Technologies',
    body: `We may use cookies and similar technologies to:
Keep users logged in
Remember preferences
Improve website performance
Analyze usage trends
Enhance security

Users can manage cookie preferences through their browser settings.`,
  },
  {
    title: '5. Your Privacy Rights',
    body: `Depending on your location, you may have the right to:
Access your personal information
Correct inaccurate data
Request deletion of your information
Restrict or object to processing
Export your data
Withdraw consent where applicable`,
  },
  {
    title: '6. Third-Party Services',
    body: `Remote365 may integrate with third-party services including:
Google authentication
Payment providers
Analytics tools

These third-party services have their own privacy policies and practices.`,
  },
  {
    title: '7. Contact Us',
    body: `If you have questions about this Privacy Policy or our privacy practices, please contact us:
Remote365
Email: privacy@remote365.com
Phone: xxx-xxx-x`,
  },
];

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ open, onClose }) => (
  <Modal open={open} onClose={onClose} className="z-[230] bg-white/35 p-0 backdrop-blur-[6px]">
    <div className="flex h-[700px] w-[884px] flex-col items-center gap-6 rounded-[12px] bg-white py-6 font-['Mona_Sans',system-ui,sans-serif] text-black shadow-2xl">
      <div className="flex h-[44px] w-[842px] flex-col items-start gap-3">
        <div className="flex h-[34px] w-[842px] items-center justify-between gap-6">
          <div className="flex h-[34px] w-[371px] flex-col items-start">
            <h2 className="m-0 h-[34px] w-[416px] text-[24px] font-bold leading-[34px] text-[#111315]">Privacy Policy Of Remote365</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[rgba(17,19,21,0.45)] hover:bg-[#F3F4F6]" title="Close">
            <X size={24} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="flex h-[580px] w-[748px] flex-col items-start gap-6 overflow-y-auto overflow-x-hidden pr-2">
        {sections.map((section, index) => (
          <React.Fragment key={section.title}>
            {index > 0 && <div className="h-px w-full bg-[rgba(26,29,33,0.3)]" />}
            <section className="flex w-full flex-col items-start gap-2">
              <h3 className="m-0 w-full text-[18px] font-medium leading-[25px]">{section.title}</h3>
              <p className="m-0 w-full whitespace-pre-line break-words text-[14px] font-normal leading-5">{section.body}</p>
            </section>
          </React.Fragment>
        ))}
      </div>
    </div>
  </Modal>
);

export default PrivacyPolicyModal;
