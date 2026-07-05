import { useEffect, useRef, useState } from "react";

export function useDelayedLoading(isLoading, delay = 200, minVisible = 300) {
  const [show, setShow] = useState(false);
  const t = useRef({ show: null, hide: null, shownAt: null });

  // Clear timers on unmount to prevent setState after unmount
  useEffect(
    () => () => {
      clearTimeout(t.current.show);
      clearTimeout(t.current.hide);
    },
    [],
  );

  useEffect(() => {
    if (isLoading) {
      clearTimeout(t.current.hide);
      t.current.hide = null;
      t.current.show = setTimeout(() => {
        setShow(true);
        t.current.shownAt = performance.now();
        t.current.show = null;
      }, delay);
      return () => clearTimeout(t.current.show);
    } else {
      clearTimeout(t.current.show);
      t.current.show = null;
      if (t.current.shownAt !== null) {
        const elapsed = performance.now() - t.current.shownAt;
        const wait = Math.max(0, minVisible - elapsed);
        t.current.hide = setTimeout(() => {
          setShow(false);
          t.current.shownAt = null;
          t.current.hide = null;
        }, wait);
      }
    }
  }, [isLoading, delay, minVisible]);

  return show;
}
