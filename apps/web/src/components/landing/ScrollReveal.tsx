import React from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'

interface ScrollRevealProps {
  children: React.ReactNode
  width?: 'fit-content' | '100%'
  delay?: number
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({ children, width = '100%', delay = 0.1 }) => {
  const ref = useRef(null)
  // Reveal as soon as a small part of the section enters the viewport, and
  // pull the trigger 120px before the bottom edge so content is already
  // visible by the time the user scrolls to it.
  const isInView = useInView(ref, { once: true, amount: 0.15, margin: '0px 0px -120px 0px' })

  return (
    <div ref={ref} style={{ position: 'relative', width }}>
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 50 },
          visible: { opacity: 1, y: 0 },
        }}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </div>
  )
}
