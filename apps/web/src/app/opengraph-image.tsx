import { OG_SIZE, renderOgImage } from '@/lib/ogImage'

export const alt = 'Remote365: remote access, support, meetings and chat'
export const size = OG_SIZE
export const contentType = 'image/png'

// Default link preview for every page without its own.
export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: 'Remote access · Meetings · Support',
    title: 'Remote access to any device, from anywhere',
    subtitle: 'Support sessions with a code, unattended access by ID, meetings and chat. Windows, Android and the web.',
  })
}
