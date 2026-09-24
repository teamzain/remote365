import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Don't let the browser restore a mid-page scroll position on reload
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
}

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

export default ScrollToTop
