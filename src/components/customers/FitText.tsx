import React, { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface FitTextProps {
  children: React.ReactNode;
  className?: string;
  /** max font size in px */
  max?: number;
  /** min font size in px */
  min?: number;
}

/**
 * Scales its single-line text down so the content fits the parent width.
 * Avoids truncation/wrapping by adjusting font-size dynamically.
 */
const FitText: React.FC<FitTextProps> = ({ children, className, max = 14, min = 8 }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(max);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const text = textRef.current;
    if (!wrap || !text) return;

    const fit = () => {
      let lo = min;
      let hi = max;
      let best = min;
      // binary search the largest font-size that fits
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        text.style.fontSize = `${mid}px`;
        if (text.scrollWidth <= wrap.clientWidth) {
          best = mid;
          lo = mid;
        } else {
          hi = mid;
        }
      }
      text.style.fontSize = `${best}px`;
      setSize(best);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [children, min, max]);

  return (
    <div ref={wrapRef} className={cn('w-full overflow-hidden', className)}>
      <span
        ref={textRef}
        className="block whitespace-nowrap leading-tight"
        style={{ fontSize: size }}
      >
        {children}
      </span>
    </div>
  );
};

export default FitText;
