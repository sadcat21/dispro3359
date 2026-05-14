import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll immediately
    window.scrollTo({ top: 0, left: 0 });
    // Re-scroll after layout/focus (Radix Tabs/Dialog autofocus may scroll element into view)
    const r1 = requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 }));
    const r2 = setTimeout(() => window.scrollTo({ top: 0, left: 0 }), 50);
    const r3 = setTimeout(() => window.scrollTo({ top: 0, left: 0 }), 200);
    return () => {
      cancelAnimationFrame(r1);
      clearTimeout(r2);
      clearTimeout(r3);
    };
  }, [pathname]);

  return null;
};

export default ScrollToTop;
