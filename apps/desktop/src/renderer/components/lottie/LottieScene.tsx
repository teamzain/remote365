import React, { useEffect, useRef, useState } from 'react';
import { LottieSvg, LottieSubscription, type LottieHandle } from 'lottie-react';

interface LottieSceneProps {
  animationData: unknown;
  /**
   * Natural width in px -- the size the animation was authored for. The box
   * fills its parent up to this, so it never overflows a narrow window, and the
   * height follows the width so the art is never distorted. Scenes with baked
   * text must be given their authored size or the text renders too small to read.
   */
  size?: number;
  /** false (default): play once and hold the final frame. true: loop forever. */
  loop?: boolean;
  /**
   * Trims empty canvas above and below without scaling the art. 1 keeps the
   * whole square; 0.72 keeps the middle 72% of the height. Measure the ink
   * bounds across the timeline before lowering this or the art gets clipped.
   */
  visibleHeightRatio?: number;
  /**
   * Where to park the playhead (0-100) when the viewer prefers reduced motion.
   * A play-once scene resolves, so its final frame is the right still; a
   * looping one usually fades in and out, so its middle is.
   */
  staticPercent?: number;
  className?: string;
  /** Accessible description; omit for purely decorative art. */
  label?: string;
  /**
   * Width / height of the animation canvas. Most scenes are square; a 16:9
   * export passes 16 / 9 so the box is not letterboxed inside a square.
   */
  canvasAspect?: number;
}

const usePrefersReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
};

/** A page-level Lottie illustration. */
export const LottieScene: React.FC<LottieSceneProps> = ({
  animationData,
  size = 260,
  loop = false,
  visibleHeightRatio = 1,
  staticPercent,
  className,
  label,
  canvasAspect = 1,
}) => {
  const lottieRef = useRef<LottieHandle>(null);
  const reduceMotion = usePrefersReducedMotion();
  const still = staticPercent ?? (loop ? 50 : 100);

  const holdStill = () => {
    if (!reduceMotion) return;
    lottieRef.current?.pause();
    lottieRef.current?.seek({ percent: still });
  };

  useEffect(holdStill, [reduceMotion, still]);

  // Pause while the window is hidden (tray, minimized, another tab in front)
  // and resume when it comes back. A looping SVG scene otherwise rewrites
  // hundreds of DOM nodes every frame for nobody.
  useEffect(() => {
    if (reduceMotion || !loop) return;
    const sync = () => {
      if (document.hidden) lottieRef.current?.pause();
      else lottieRef.current?.play();
    };
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [reduceMotion, loop]);

  // Width-driven so a narrow window shrinks the whole thing instead of cropping
  // it: the box keeps width/height = 1/visibleHeightRatio, and the square canvas
  // inside is pulled up by half the trimmed band. A percentage margin resolves
  // against the container's width, which here is the canvas width -- so the
  // offset tracks the element as it scales.
  // The margin is a share of the WIDTH, so a non-square canvas scales it by its
  // height-to-width ratio.
  const offsetPercent = ((1 - visibleHeightRatio) / 2) * (100 / canvasAspect);

  return (
    <div
      className={className}
      style={{
        width: '100%',
        maxWidth: size,
        aspectRatio: String(canvasAspect / visibleHeightRatio),
        overflow: 'hidden',
      }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <LottieSvg
        src={animationData as object}
        lottieRef={lottieRef}
        autoplay={!reduceMotion}
        loop={loop}
        // The seek has to wait for the frames to exist.
        subscriptions={{ [LottieSubscription.ready]: holdStill }}
        style={{ width: '100%', aspectRatio: String(canvasAspect), marginTop: `-${offsetPercent}%` }}
      />
    </div>
  );
};
