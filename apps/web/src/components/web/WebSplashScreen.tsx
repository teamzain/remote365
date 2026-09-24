import React, { useEffect, useRef, useState } from 'react';
import logo from '../../assets/logo.png';

export const WebSplashScreen: React.FC<{ isReady: boolean; onFinished?: () => void }> = ({ isReady, onFinished }) => {
  const [shouldRender, setShouldRender] = useState(true);
  const [fadeStatus, setFadeStatus] = useState<'in' | 'out'>('in');
  const startedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, []);

  useEffect(() => {
    if (!isReady || startedRef.current) return;
    startedRef.current = true;

    const fadeTimer = window.setTimeout(() => setFadeStatus('out'), 1200);
    const finishTimer = window.setTimeout(() => {
      setShouldRender(false);
      onFinishedRef.current?.();
    }, 2000);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(finishTimer);
      // React StrictMode intentionally mounts/cleans effects once in
      // development. If that cleanup clears our timers but this flag stays
      // true, the splash never finishes and the dashboard remains covered.
      startedRef.current = false;
    };
  }, [isReady]);

  if (!shouldRender) return null;

  return (
    <div className={`fixed inset-0 z-[9999] overflow-hidden bg-white font-['Mona_Sans',system-ui,sans-serif] text-[#1A1D21] transition-opacity duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${fadeStatus === 'out' ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
      <div className={`pointer-events-none absolute left-1/2 top-1/2 h-[1000px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(255,138,0,0.54)_0%,rgba(255,179,71,0.54)_28.1%,rgba(255,255,255,0.54)_100%)] blur-[37.5px] transition-transform duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${fadeStatus === 'out' ? 'scale-110' : 'scale-100'}`} />
      <div className={`absolute left-1/2 top-1/2 flex w-[459px] max-w-[calc(100vw-40px)] -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${fadeStatus === 'out' ? 'scale-[0.985] opacity-0' : 'scale-100 opacity-100'}`}>
        <div className="flex w-full flex-col items-center gap-3">
          <div className="flex h-[187px] w-[211px] flex-col items-center justify-center gap-4">
            <img src={logo} alt="Remote365" className="h-[120px] w-[120px] object-contain" />
            <h1 className="m-0 h-[51px] w-[211px] text-center text-[36px] font-semibold leading-[51px] text-[#111315]">Remote365</h1>
          </div>
          <div className="flex h-[31px] w-[431px] max-w-full items-center justify-center gap-3">
            <div className="h-0 w-[100px] border-t-2 border-[#1A1D21]" />
            <span className="h-[31px] w-[199px] whitespace-nowrap text-center text-[22px] font-semibold leading-[31px]">Secure Node Mesh</span>
            <div className="h-0 w-[100px] border-t-2 border-[#1A1D21]" />
          </div>
        </div>
      </div>
    </div>
  );
};
