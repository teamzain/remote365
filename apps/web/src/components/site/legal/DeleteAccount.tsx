'use client'

import React from 'react'
import { UserX, ListChecks, Database, Clock, Mail } from 'lucide-react'
import LegalPage, { type LegalSection } from '@/components/landing/LegalPage'

// Account deletion instructions.
//
// This page exists to satisfy Google Play's Data safety requirement for a "Delete account
// URL": it must name the app, prominently show the steps to request deletion, and state
// exactly what is deleted, what is kept, and for how long. A privacy policy that merely
// mentions a right to deletion does not qualify — the steps and the retention period have
// to be on the linked page itself.
//
// Anything stated here is a commitment the backend has to honour, so keep it in step with
// what account deletion actually does before changing the wording.

const SECTIONS: LegalSection[] = [
  {
    id: 'overview',
    navLabel: 'Overview',
    Icon: UserX,
    heading: '1. Deleting your Remote365 account',
    blocks: [
      {
        text: 'You can delete your Remote365 account at any time. Deleting your account removes your profile, your devices, and the data associated with them from the Remote365 platform.',
      },
      {
        text: 'Account deletion is permanent. Once the deletion is complete, your account cannot be restored, and any devices paired to it must be set up again from scratch if you return to Remote365 later.',
      },
      {
        text: 'If you are a member of an organization rather than its owner, deleting your account removes you from that organization. It does not delete the organization or the devices owned by it.',
      },
    ],
  },
  {
    id: 'how-to-delete',
    navLabel: 'How to Delete',
    Icon: ListChecks,
    heading: '2. How to request deletion',
    blocks: [
      { sub: '2.1 From the Remote365 mobile app' },
      {
        list: [
          'Open the Remote365 app and sign in',
          'Go to Settings',
          'Select Account',
          'Choose Delete account',
          'Confirm when prompted',
        ],
      },
      { sub: '2.2 From the Remote365 desktop app or web dashboard' },
      {
        list: [
          'Sign in at remote365.ai',
          'Open Settings, then Account',
          'Choose Delete account',
          'Confirm when prompted',
        ],
      },
      { sub: '2.3 By email' },
      {
        text: 'If you cannot sign in — for example because you have lost access to your device or credentials — email support@remote365.ai from the address registered to your account and ask us to delete it. We may ask you to confirm ownership of the account before proceeding, to make sure nobody else can delete it on your behalf.',
      },
      {
        text: 'We action email deletion requests within 30 days of verifying the request.',
      },
    ],
  },
  {
    id: 'what-is-deleted',
    navLabel: 'What Is Deleted',
    Icon: Database,
    heading: '3. What is deleted and what is kept',
    blocks: [
      { sub: '3.1 Deleted' },
      {
        list: [
          'Your name, email address, and profile details',
          'Your password and authentication credentials, including two-factor settings',
          'Devices registered to your account, and their names, tags, and groups',
          'Chat messages and any images you attached to them',
          'Session history and connection logs tied to your account',
          'Push notification tokens and device identifiers',
          'Your subscription record and plan assignment',
        ],
      },
      { sub: '3.2 Kept' },
      {
        text: 'A small amount of information is retained after deletion because we are required to keep it, or because it no longer identifies you:',
      },
      {
        list: [
          'Records of payments and invoices, which financial and tax law requires us to retain',
          'Security and abuse logs needed to protect the platform and other users',
          'Aggregated or anonymised statistics that cannot be linked back to you',
        ],
      },
      {
        text: 'Subscriptions purchased through Google Play are billed by Google, not by Remote365. Deleting your Remote365 account does not cancel a Google Play subscription — cancel it in the Google Play Store, otherwise billing continues.',
      },
    ],
  },
  {
    id: 'retention',
    navLabel: 'Retention Period',
    Icon: Clock,
    heading: '4. How long deletion takes',
    blocks: [
      {
        text: 'Your account and its data are removed from live Remote365 systems immediately when the deletion is confirmed. You are signed out on every device, and your devices stop being reachable straight away.',
      },
      {
        text: 'Copies held in encrypted backups are erased within 30 days. Backups exist so that we can recover from failures and are not used to restore individual deleted accounts.',
      },
      {
        text: 'Data we are legally required to keep, such as payment records, is retained for the period the applicable law requires and is then deleted.',
      },
    ],
  },
  {
    id: 'contact',
    navLabel: 'Contact',
    Icon: Mail,
    heading: '5. Questions',
    blocks: [
      {
        text: 'If you have a question about deleting your account or about what happens to your data afterwards, contact us at support@remote365.ai and we will help.',
      },
      {
        text: 'For a full description of how Remote365 handles personal information, see our Privacy Policy at remote365.ai/privacy.',
      },
    ],
  },
]

const DeleteAccount: React.FC = () => (
  <LegalPage
    title="Remote365: Delete Your Account"
    intro="You can delete your Remote365 account and its associated data at any time. This page explains how to request deletion, exactly what is removed, what we are required to keep, and how long the process takes."
    effectiveDate="August 21, 2026"
    sections={SECTIONS}
  />
)

export default DeleteAccount
