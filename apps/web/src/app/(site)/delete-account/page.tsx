import DeleteAccount from '@/components/site/legal/DeleteAccount'
import { pageMetadata } from '@/lib/seo'

// Linked from Google Play's Data safety form as the account-deletion URL.
export const metadata = pageMetadata({
  title: 'Delete your account',
  description:
    'How to delete your Remote365 account from the mobile app, the desktop app, the web dashboard or by email, what is deleted and what is kept, and how long deletion takes.',
  path: '/delete-account',
})

export default function DeleteAccountPage() {
  return <DeleteAccount />
}
