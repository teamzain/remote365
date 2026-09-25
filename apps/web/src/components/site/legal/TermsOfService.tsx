'use client'

import React from 'react'
import {
  FileText, Monitor, UserCheck, ShieldAlert, CreditCard,
  Copyright, XCircle, AlertTriangle, MessageSquare,
} from 'lucide-react'
import LegalPage, { type LegalSection } from '@/components/landing/LegalPage'

const SECTIONS: LegalSection[] = [
  {
    id: 'acceptance',
    navLabel: 'Acceptance of Terms',
    Icon: FileText,
    heading: '1. Acceptance of Terms',
    blocks: [
      { text: 'These Terms of Service (“Terms”) govern your access to and use of the Remote365 website, desktop and mobile applications, and related services (collectively, the “Service”).' },
      { text: 'By creating an account, installing our applications, or using the Service in any way, you agree to be bound by these Terms and our Privacy Policy. If you are using the Service on behalf of an organization, you represent that you have the authority to bind that organization to these Terms.' },
    ],
  },
  {
    id: 'service',
    navLabel: 'The Service',
    Icon: Monitor,
    heading: '2. Description of the Service',
    blocks: [
      { text: 'Remote365 provides secure remote desktop access, unattended device management, remote support sessions, file transfer, chat, and meeting tools for individuals, teams, and enterprise organizations.' },
      { text: 'We may add, change, or remove features from time to time. Where a change materially reduces the functionality of a paid plan, we will provide reasonable advance notice.' },
    ],
  },
  {
    id: 'accounts',
    navLabel: 'Accounts & Responsibilities',
    Icon: UserCheck,
    heading: '3. Accounts & Responsibilities',
    blocks: [
      { text: 'To use most features you must create an account. You agree to:' },
      {
        list: [
          'Provide accurate and complete registration information',
          'Keep your password and two-factor credentials confidential',
          'Only register and access devices you own or are authorized to manage',
          'Notify us promptly of any unauthorized use of your account',
        ],
      },
      { text: 'Organization owners and admins are responsible for the members they invite and the permissions they grant, including device access and session recording settings.' },
    ],
  },
  {
    id: 'acceptable-use',
    navLabel: 'Acceptable Use',
    Icon: ShieldAlert,
    heading: '4. Acceptable Use',
    blocks: [
      { text: 'You agree not to misuse the Service. In particular, you must not:' },
      {
        list: [
          'Access any device or account without the owner’s explicit authorization',
          'Use the Service to distribute malware or conduct fraud, scams, or social-engineering attacks',
          'Attempt to probe, disrupt, or bypass the security of the Service or of any connected device',
          'Resell or provide the Service to third parties except as permitted by your plan',
          'Use the Service in violation of applicable laws or regulations',
        ],
      },
      { text: 'We may suspend or terminate accounts involved in abuse, and may report unlawful activity to law enforcement.' },
    ],
  },
  {
    id: 'billing',
    navLabel: 'Subscriptions & Billing',
    Icon: CreditCard,
    heading: '5. Subscriptions & Billing',
    blocks: [
      { text: 'Paid plans are billed monthly per workspace through our third-party payment provider. By subscribing you authorize recurring charges until you cancel.' },
      {
        list: [
          'Trials convert to a locked workspace unless a plan is chosen before the trial ends',
          'Upgrades and downgrades take effect immediately and are prorated on the next invoice',
          'You can cancel at any time from billing settings; access continues until the end of the paid period',
          'Fees are non-refundable except where required by law',
        ],
      },
    ],
  },
  {
    id: 'intellectual-property',
    navLabel: 'Intellectual Property',
    Icon: Copyright,
    heading: '6. Intellectual Property',
    blocks: [
      { text: 'The Service, including its software, design, and branding, is owned by Remote365 and protected by intellectual-property laws. We grant you a limited, non-exclusive, non-transferable license to use the applications for the purpose of using the Service.' },
      { text: 'You retain all rights to the content you transfer or access through the Service. We do not claim ownership of your files, screens, or session content.' },
    ],
  },
  {
    id: 'termination',
    navLabel: 'Termination',
    Icon: XCircle,
    heading: '7. Termination',
    blocks: [
      { text: 'You may stop using the Service and delete your account at any time. We may suspend or terminate your access if you materially breach these Terms, create risk or legal exposure for us, or if required by law.' },
      { text: 'Upon termination, your right to use the Service ends. Provisions that by their nature should survive (including intellectual-property, disclaimer, and liability sections) survive termination.' },
    ],
  },
  {
    id: 'disclaimers',
    navLabel: 'Disclaimers & Liability',
    Icon: AlertTriangle,
    heading: '8. Disclaimers & Limitation of Liability',
    blocks: [
      { text: 'The Service is provided “as is” and “as available”. While we work hard to keep the Service secure and reliable, we do not warrant that it will be uninterrupted or error-free.' },
      { text: 'To the maximum extent permitted by law, Remote365 will not be liable for indirect, incidental, special, consequential, or punitive damages, or for loss of data, profits, or business, arising from your use of the Service. Our total liability for any claim is limited to the amounts you paid us in the twelve months preceding the claim.' },
    ],
  },
  {
    id: 'contact',
    navLabel: 'Contact Us',
    Icon: MessageSquare,
    heading: '9. Contact Us',
    blocks: [
      { text: 'If you have questions about these Terms, please contact us:' },
      {
        list: [
          'Remote365',
          'Email: legal@remote365.ai',
        ],
      },
    ],
  },
]

const TermsOfService: React.FC = () => (
  <LegalPage
    title="Remote365: Terms of Service"
    intro="These Terms of Service describe the rules for using Remote365’s remote access platform and related services. Please read them carefully — by using Remote365 you agree to these terms."
    effectiveDate="May 23, 2026"
    sections={SECTIONS}
  />
)

export default TermsOfService
