import Link from 'next/link'
import type { AnchorHTMLAttributes } from 'react'
import { isAppPath } from '@/lib/routes'

type SiteLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string }

// Links on the website. Site pages get next/link (client-side transitions,
// prefetch); app routes (/login, /dashboard …), external URLs and in-page
// anchors get a plain <a>, because the app is a separate React tree that
// needs a full page load.
export default function SiteLink({ href, ...rest }: SiteLinkProps) {
  if (isAppPath(href) || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) {
    return <a href={href} {...rest} />
  }
  return <Link href={href} {...rest} />
}
