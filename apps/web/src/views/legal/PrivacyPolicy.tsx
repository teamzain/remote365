import React from 'react'
import { Eye, Database, Lock, Cookie, UserCheck, Shield, MessageSquare } from 'lucide-react'
import LegalPage, { type LegalSection } from '../../components/landing/LegalPage'

const SECTIONS: LegalSection[] = [
  {
    id: 'introduction',
    navLabel: 'Overview',
    Icon: Eye,
    heading: '1. Introduction',
    blocks: [
      { text: 'Welcome to Remote365. Remote365 (“Remote365”, “we”, “our”, or “us”) provides secure remote desktop access, device management, collaboration, and support services for individuals, businesses, and enterprise organizations.' },
      { text: 'This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you:' },
      {
        list: [
          'Access our website',
          'Create an account',
          'Use our desktop or mobile applications',
          'Initiate or receive remote support sessions',
          'Communicate with our support team',
          'Use any related services offered by Remote365',
        ],
      },
      { text: 'By using Remote365, you agree to the practices described in this Privacy Policy.' },
    ],
  },
  {
    id: 'information-we-collect',
    navLabel: 'Information We Collect',
    Icon: Database,
    heading: '2. Information We Collect',
    blocks: [
      { text: 'We collect information necessary to provide secure, reliable, and high-quality remote access services.' },
      { sub: '2.1 Account Information' },
      { text: 'When you create an account, we may collect:' },
      {
        list: [
          'Full name',
          'Email address',
          'Password (encrypted and securely stored)',
          'Organization or company name',
          'Billing information',
          'Phone number (optional)',
          'Profile image (optional)',
        ],
      },
      { sub: '2.2 Device & Technical Information' },
      { text: 'To enable remote connectivity and security features, we may collect:' },
      {
        list: [
          'Device identifiers',
          'IP addresses',
          'Operating system information',
          'Browser type and version',
          'Device names and tags',
          'Session timestamps',
          'Connection logs',
        ],
      },
      { sub: '2.3 Session Information' },
      { text: 'During remote access sessions, we may process:' },
      {
        list: [
          'Session duration',
          'Session participants',
          'File transfer activity',
          'Audit logs',
          'Session recordings (if enabled by the organization)',
          'Chat messages exchanged during a session',
        ],
      },
      { text: 'Remote365 does not actively monitor or view the contents of your remote sessions.' },
      { sub: '2.4 Payment Information' },
      { text: 'Payments are processed securely through trusted third-party payment providers. Remote365 does not store complete credit card information on our servers.' },
      { sub: '2.5 Support & Communication Data' },
      { text: 'If you contact support or communicate with us, we may collect:' },
      {
        list: [
          'Support tickets',
          'Email conversations',
          'Feedback submissions',
          'Feature requests',
          'Technical troubleshooting information',
        ],
      },
    ],
  },
  {
    id: 'remote-sessions',
    navLabel: 'Remote Sessions & Privacy',
    Icon: Lock,
    heading: '3. Remote Sessions & Privacy',
    blocks: [
      { text: 'Remote365 is designed with privacy and security as core principles.' },
      { sub: 'End-to-End Encryption' },
      { text: 'All remote sessions are encrypted using industry-standard encryption technologies.' },
      { sub: 'Session Visibility' },
      { text: 'Remote365 employees cannot access your sessions unless:' },
      {
        list: [
          'You explicitly request technical support',
          'Access is legally required',
          'Access is necessary to investigate abuse, fraud, or security threats',
        ],
      },
      { sub: 'Session Recording' },
      { text: 'Some organizations may enable session recording for:' },
      {
        list: [
          'Compliance purposes',
          'Employee training',
          'Quality assurance',
          'Internal auditing',
        ],
      },
      { text: 'Organizations are responsible for notifying their users if session recording is enabled.' },
    ],
  },
  {
    id: 'cookies',
    navLabel: 'Cookies & Tracking',
    Icon: Cookie,
    heading: '4. Cookies & Tracking Technologies',
    blocks: [
      { text: 'We may use cookies and similar technologies to:' },
      {
        list: [
          'Keep users logged in',
          'Remember preferences',
          'Improve website performance',
          'Analyze usage trends',
          'Enhance security',
        ],
      },
      { text: 'Users can manage cookie preferences through their browser settings.' },
    ],
  },
  {
    id: 'privacy-rights',
    navLabel: 'Your Privacy Rights',
    Icon: UserCheck,
    heading: '5. Your Privacy Rights',
    blocks: [
      { text: 'Depending on your location, you may have the right to:' },
      {
        list: [
          'Access your personal information',
          'Correct inaccurate data',
          'Request deletion of your information',
          'Restrict or object to processing',
          'Export your data',
          'Withdraw consent where applicable',
        ],
      },
    ],
  },
  {
    id: 'third-party',
    navLabel: 'Third-Party Services',
    Icon: Shield,
    heading: '6. Third-Party Services',
    blocks: [
      { text: 'Remote365 may integrate with third-party services including:' },
      {
        list: [
          'Google authentication',
          'Payment providers',
          'Analytics tools',
        ],
      },
      { text: 'These third-party services have their own privacy policies and practices.' },
    ],
  },
  {
    id: 'contact',
    navLabel: 'Contact Us',
    Icon: MessageSquare,
    heading: '7. Contact Us',
    blocks: [
      { text: 'If you have questions about this Privacy Policy or our privacy practices, please contact us:' },
      {
        list: [
          'Remote365',
          'Email: privacy@remote365.ai',
        ],
      },
    ],
  },
]

const PrivacyPolicy: React.FC = () => (
  <LegalPage
    title="Remote365: Privacy Policy"
    intro="At Remote365, your privacy and security are fundamental to everything we build. This Privacy Policy explains how we collect, use, store, and protect your information when you use our remote access platform and related services."
    effectiveDate="May 23, 2026"
    sections={SECTIONS}
  />
)

export default PrivacyPolicy
