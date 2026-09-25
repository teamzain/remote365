import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

// Port of Cult UI's "Expandable Screen" (MIT, github.com/nolly-studio/cult-ui,
// registry item cult-ui.com/r/expandable-screen.json): a trigger whose
// background morphs, via a shared layoutId, into a full-screen panel.
// Changed for this site:
//  - framer-motion instead of `motion/react` (same API), plain classes
//    instead of Tailwind / shadcn tokens
//  - the panel is portalled to <body>: the fixed glass header uses
//    backdrop-filter, which would otherwise clip a position:fixed panel
//    opened from a trigger inside it — and it sits above that header
//  - the trigger is a real <button>; Escape closes; focus moves to the close
//    button on open and back to the trigger on close; dialog semantics
//  - body scroll lock restores the previous value instead of forcing "unset"
//  - the content scrolls inside the panel, so the close button stays visible

interface ExpandableScreenContextValue {
  isExpanded: boolean
  expand: () => void
  collapse: () => void
  layoutId: string
  triggerRadius: string
  contentRadius: string
  animationDuration: number
  triggerId: string
  restoreFocus: React.MutableRefObject<boolean>
}

const ExpandableScreenContext = createContext<ExpandableScreenContextValue | null>(null)

export function useExpandableScreen() {
  const context = useContext(ExpandableScreenContext)
  if (!context) throw new Error('useExpandableScreen must be used within an ExpandableScreen')
  return context
}

interface ExpandableScreenProps {
  children: ReactNode
  defaultExpanded?: boolean
  onExpandChange?: (expanded: boolean) => void
  /** Must be unique per instance on the page; generated when omitted. */
  layoutId?: string
  triggerRadius?: string
  contentRadius?: string
  animationDuration?: number
  lockScroll?: boolean
}

export function ExpandableScreen({
  children,
  defaultExpanded = false,
  onExpandChange,
  layoutId: layoutIdProp,
  triggerRadius = '100px',
  contentRadius = '24px',
  animationDuration = 0.3,
  lockScroll = true,
}: ExpandableScreenProps) {
  const autoId = useId()
  const layoutId = layoutIdProp ?? `expandable-screen-${autoId}`
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const restoreFocus = useRef(false)

  const expand = useCallback(() => {
    setIsExpanded(true)
    onExpandChange?.(true)
  }, [onExpandChange])

  const collapse = useCallback(() => {
    restoreFocus.current = true
    setIsExpanded(false)
    onExpandChange?.(false)
  }, [onExpandChange])

  useEffect(() => {
    if (!isExpanded) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') collapse() }
    window.addEventListener('keydown', onKey)
    if (!lockScroll) return () => window.removeEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [isExpanded, lockScroll, collapse])

  return (
    <ExpandableScreenContext.Provider
      value={{
        isExpanded,
        expand,
        collapse,
        layoutId,
        triggerRadius,
        contentRadius,
        animationDuration,
        triggerId: `${layoutId}-trigger`,
        restoreFocus,
      }}
    >
      {children}
    </ExpandableScreenContext.Provider>
  )
}

interface ExpandableScreenTriggerProps {
  children: ReactNode
  className?: string
  /** Accessible name when the children are not plain text. */
  ariaLabel?: string
}

export function ExpandableScreenTrigger({
  children,
  className = '',
  ariaLabel,
}: ExpandableScreenTriggerProps) {
  const { isExpanded, expand, layoutId, triggerRadius, triggerId, restoreFocus } = useExpandableScreen()
  const buttonRef = useRef<HTMLButtonElement>(null)

  // The trigger unmounts while the screen is open; hand focus back to it
  // when it returns after a close.
  useEffect(() => {
    if (!isExpanded && restoreFocus.current) {
      restoreFocus.current = false
      buttonRef.current?.focus()
    }
  }, [isExpanded, restoreFocus])

  return (
    <>
      <style>{TRIGGER_STYLES}</style>
      <AnimatePresence initial={false}>
        {!isExpanded && (
          <motion.div className={`xs-trigger ${className}`}>
            {/* Background layer with the shared layoutId: this is what morphs */}
            <motion.div
              style={{ borderRadius: triggerRadius }}
              layout
              layoutId={layoutId}
              className="xs-trigger-bg"
            />
            {/* Content layer, faded out while the background expands */}
            <motion.button
              ref={buttonRef}
              id={triggerId}
              type="button"
              aria-haspopup="dialog"
              aria-label={ariaLabel}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              exit={{ opacity: 0, scale: 0.8 }}
              layout={false}
              onClick={expand}
              className="xs-trigger-button"
            >
              {children}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

interface ExpandableScreenContentProps {
  children: ReactNode
  className?: string
  showCloseButton?: boolean
  closeButtonClassName?: string
  /** Accessible name of the dialog. */
  ariaLabel?: string
}

export function ExpandableScreenContent({
  children,
  className = '',
  showCloseButton = true,
  closeButtonClassName = '',
  ariaLabel,
}: ExpandableScreenContentProps) {
  const { isExpanded, collapse, layoutId, contentRadius, animationDuration } = useExpandableScreen()

  return createPortal(
    <AnimatePresence initial={false}>
      {isExpanded && (
        <div className="xs-overlay" role="dialog" aria-modal="true" aria-label={ariaLabel}>
          {/* Morphing background with the shared layoutId */}
          <motion.div
            layoutId={layoutId}
            transition={{ duration: animationDuration }}
            style={{ borderRadius: contentRadius }}
            layout
            className={`xs-panel ${className}`}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="xs-panel-body"
            >
              {children}
            </motion.div>

            {showCloseButton && (
              <motion.button
                type="button"
                onClick={collapse}
                autoFocus
                className={`xs-close ${closeButtonClassName}`}
                aria-label="Close"
              >
                <X size={20} />
              </motion.button>
            )}
          </motion.div>
          <style>{CONTENT_STYLES}</style>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

const TRIGGER_STYLES = `
  .xs-trigger {
    position: relative;
    display: inline-block;
  }
  .xs-trigger-bg {
    position: absolute;
    inset: 0;
    transform: translateZ(0);
    will-change: transform;
  }
  .xs-trigger-button {
    position: relative;
    display: block;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .xs-trigger-button:focus-visible {
    outline: 2px solid #ff8a00;
    outline-offset: 3px;
    border-radius: 9999px;
  }
`

const CONTENT_STYLES = `
  .xs-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
  }
  .xs-panel {
    position: relative;
    display: flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
    transform: translateZ(0);
    will-change: transform;
  }
  /* The body scrolls rather than the panel, so the close button stays put on
     short screens instead of scrolling away with the content. */
  .xs-panel-body {
    position: relative;
    z-index: 20;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .xs-close {
    position: absolute;
    top: 24px;
    right: 24px;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: 0;
    border-radius: 9999px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    transition: background 0.3s;
  }
  .xs-close:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  @media (max-width: 640px) {
    .xs-overlay { padding: 8px; }
    .xs-close { top: 14px; right: 14px; }
  }
`

export default ExpandableScreen
