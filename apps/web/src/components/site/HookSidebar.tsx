'use client'

// Hook Sidebar, from Rare UI (https://rareui.com/components/hooksidebar,
// `npx shadcn add swamimalode07/rare-ui/hook-sidebar`).
// Copyright (c) 2026 Swami Malode. MIT + Commons Clause + Attribution:
// https://github.com/swamimalode07/rare-ui/blob/main/LICENSE — this credit and
// the notice must stay, and the site links to rareui.com (footer credits).
//
// A list whose active row is marked by a dashed rail that runs down from the
// top and hooks into it; hovering another row draws a faint rail to that row
// too. Changed for this site:
//  - framer-motion instead of motion/react (same API), no cn() helper, plain
//    CSS for the dark site instead of shadcn colour tokens
//  - in-page links: a "#id" href renders a plain anchor with
//    aria-current="location"; route hrefs keep following the pathname
//  - onChange also gets the click event, so a page can scroll smoothly itself
//  - optional icon before the group label, and `landmark={false}` for a
//    labelled group when several sidebars share one <nav>

import { useEffect, useId, useRef, useState, type ComponentProps, type MouseEvent, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import SiteLink from './SiteLink'

const CORNER = 6
const DASH = 'repeating-linear-gradient(to top, transparent 0 2px, currentColor 2px 4px)'

export type HookSidebarItem = string | { label: string; href?: string }

export type HookSidebarProps = Omit<ComponentProps<'nav'>, 'onChange' | 'ref'> & {
  items: HookSidebarItem[]
  label?: string
  icon?: ReactNode
  value?: number
  defaultValue?: number
  onChange?: (index: number, event: MouseEvent<HTMLElement>) => void
  color?: string
  dashed?: boolean
  /** A <nav> of its own (default), or a labelled group inside a shared nav. */
  landmark?: boolean
}

const hrefOf = (item: HookSidebarItem) => (typeof item === 'string' ? undefined : item.href)
const labelOf = (item: HookSidebarItem) => (typeof item === 'string' ? item : item.label)
const isRoute = (href?: string) => !!href && href.startsWith('/')

function Rail({
  from = 0,
  y,
  visible,
  color,
  dashed,
  className,
}: {
  from?: number
  y: number | null
  visible: boolean
  color?: string
  dashed: boolean
  className?: string
}) {
  const reduced = useReducedMotion()
  const travel = reduced ? { duration: 0 } : { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.7 }

  return (
    <motion.span
      aria-hidden
      initial={false}
      style={{ color }}
      animate={{ opacity: visible && y !== null ? 1 : 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.2 }}
      className={`hs-rail${className ? ` ${className}` : ''}`}
    >
      <motion.span
        initial={false}
        animate={{ top: from, height: Math.max(0, (y ?? 0) - CORNER - from) }}
        transition={travel}
        style={dashed ? { backgroundImage: DASH } : { backgroundColor: 'currentColor' }}
        className="hs-line"
      />
      <motion.svg
        initial={false}
        animate={{ top: (y ?? 0) - CORNER }}
        transition={travel}
        width="12"
        height="7"
        viewBox="0 0 12 7"
        fill="none"
        className="hs-hook"
      >
        <path d="M0.5 0a6 6 0 0 0 6 6H12" stroke="currentColor" strokeDasharray={dashed ? '2 2' : undefined} />
      </motion.svg>
    </motion.span>
  )
}

export function HookSidebar({
  items,
  label,
  icon,
  value,
  defaultValue = 0,
  onChange,
  color = '#ff8a00',
  dashed = true,
  landmark = true,
  className,
  ...props
}: HookSidebarProps) {
  const pathname = usePathname()
  const labelId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLElement | null)[]>([])
  const [centers, setCenters] = useState<number[]>([])
  const [internalValue, setInternalValue] = useState(defaultValue)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [pointerInside, setPointerInside] = useState(false)
  const [focusInside, setFocusInside] = useState(false)

  const routed = items.some(item => isRoute(hrefOf(item)))
  const routeIndex = items.findIndex(item => hrefOf(item) === pathname)
  const activeIndex = value ?? (routed ? routeIndex : internalValue)

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => setCenters(itemRefs.current.map(el => (el ? el.offsetTop + el.offsetHeight / 2 : 0)))
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [items.length])

  const activeY = activeIndex < 0 ? null : (centers[activeIndex] ?? null)
  const hoverY = hoverIndex === null ? null : (centers[hoverIndex] ?? null)

  // Above the active row the accent line already covers the span, so draw only the corner.
  const hoverFrom = activeY !== null && hoverY !== null && hoverY <= activeY ? Math.max(0, hoverY - CORNER) : (activeY ?? 0)

  const select = (index: number, event: MouseEvent<HTMLElement>) => {
    if (value === undefined) setInternalValue(index)
    onChange?.(index, event)
  }

  const Root = landmark ? 'nav' : 'div'
  const rootLabel = landmark
    ? { 'aria-label': label }
    : { role: 'group', 'aria-labelledby': label ? labelId : undefined }

  return (
    <Root data-slot="hook-sidebar" className={`hs${className ? ` ${className}` : ''}`} {...rootLabel} {...props}>
      {label && (
        <span data-slot="hook-sidebar-label" id={labelId} className="hs-label">
          {icon}
          {label}
        </span>
      )}

      <div ref={listRef} onMouseLeave={() => setPointerInside(false)} className="hs-list">
        <Rail
          from={hoverFrom}
          y={hoverY}
          visible={(pointerInside || focusInside) && hoverIndex !== activeIndex}
          dashed={dashed}
          className="hs-rail--hover"
        />
        <Rail y={activeY} visible={activeY !== null} color={color} dashed={dashed} />

        {items.map((item, index) => {
          const text = labelOf(item)
          const href = hrefOf(item)
          const isActive = index === activeIndex
          const setRef = (el: HTMLElement | null) => {
            itemRefs.current[index] = el
          }
          const rowProps = {
            'data-slot': 'hook-sidebar-item',
            'data-active': isActive,
            onMouseEnter: () => {
              setHoverIndex(index)
              setPointerInside(true)
            },
            onFocus: () => {
              setHoverIndex(index)
              setFocusInside(true)
            },
            onBlur: () => setFocusInside(false),
            onClick: (event: MouseEvent<HTMLElement>) => select(index, event),
            className: `hs-item${isActive ? ' is-active' : ''}`,
          }

          if (href && isRoute(href)) {
            return (
              <SiteLink key={`${index}-${text}`} {...rowProps} ref={setRef} href={href} aria-current={isActive ? 'page' : undefined}>
                {text}
              </SiteLink>
            )
          }
          if (href) {
            return (
              <a key={`${index}-${text}`} {...rowProps} ref={setRef} href={href} aria-current={isActive ? 'location' : undefined}>
                {text}
              </a>
            )
          }
          return (
            <button key={`${index}-${text}`} {...rowProps} ref={setRef} type="button" aria-current={isActive ? 'true' : undefined}>
              {text}
            </button>
          )
        })}
      </div>

      <style>{`
        .hs { display: flex; flex-direction: column; }
        .hs-label {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 8px 8px 2px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.5);
        }
        .hs-list { position: relative; display: flex; flex-direction: column; gap: 2px; }
        .hs-rail { position: absolute; inset: 0; pointer-events: none; }
        .hs-rail--hover { color: rgba(255, 255, 255, 0.3); }
        .hs-line { position: absolute; left: 2px; width: 1px; }
        .hs-hook { position: absolute; left: 2px; }
        .hs-item {
          display: block;
          padding: 5px 8px 5px 20px;
          border: 0;
          border-radius: 8px;
          background: none;
          font: inherit;
          font-size: 14px;
          line-height: 1.45;
          text-align: left;
          text-decoration: none;
          color: rgba(255, 255, 255, 0.55);
          cursor: pointer;
          transition: color 0.2s;
        }
        .hs-item:hover { color: rgba(255, 255, 255, 0.85); }
        .hs-item.is-active { color: #fff; }
        .hs-item:focus-visible { outline: 2px solid #ff8a00; outline-offset: 1px; }
        @media (prefers-reduced-motion: reduce) {
          .hs-item { transition: none; }
        }
      `}</style>
    </Root>
  )
}

export default HookSidebar
