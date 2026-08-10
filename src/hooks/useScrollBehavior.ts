import { useState, useRef, useCallback, useEffect } from "react";

interface ScrollBehaviorState {
  showHeader: boolean;
  showInput: boolean;
  showNavBar: boolean;
}

export const useScrollBehavior = (scrollRef: React.RefObject<HTMLDivElement | null>) => {
  const [state, setState] = useState<ScrollBehaviorState>({
    showHeader: true,
    showInput: true,
    showNavBar: true,
  });

  const lastScrollY = useRef(0);
  const accumulatedUp = useRef(0);
  const accumulatedDown = useRef(0);
  const lastDirection = useRef<"up" | "down" | null>(null);
  const ticking = useRef(false);
  const lastDirectionTime = useRef(0);
  const consecutiveCount = useRef(0);

  const THRESHOLD = 80;
  const DOUBLE_SCROLL_WINDOW = 600;
  const BOTTOM_PROXIMITY = 50;

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || ticking.current) return;

    ticking.current = true;
    requestAnimationFrame(() => {
      const currentY = el.scrollTop;
      const delta = currentY - lastScrollY.current;
      const distFromBottom = el.scrollHeight - currentY - el.clientHeight;

      // Near bottom - restore everything
      if (distFromBottom < BOTTOM_PROXIMITY) {
        setState({ showHeader: true, showInput: true, showNavBar: true });
        accumulatedUp.current = 0;
        accumulatedDown.current = 0;
        consecutiveCount.current = 0;
        lastScrollY.current = currentY;
        ticking.current = false;
        return;
      }

      const now = Date.now();

      if (delta > 0) {
        // Scrolling DOWN (towards newer)
        if (lastDirection.current !== "down") {
          consecutiveCount.current = 1;
          accumulatedDown.current = 0;
          lastDirectionTime.current = now;
        }
        accumulatedDown.current += delta;
        accumulatedUp.current = 0;
        lastDirection.current = "down";

        if (accumulatedDown.current > THRESHOLD) {
          setState(prev => ({ ...prev, showHeader: false, showInput: true, showNavBar: true }));
        }
      } else if (delta < 0) {
        // Scrolling UP (towards older)
        if (lastDirection.current !== "up") {
          consecutiveCount.current = 1;
          accumulatedUp.current = 0;
          lastDirectionTime.current = now;
        }
        accumulatedUp.current += Math.abs(delta);
        accumulatedDown.current = 0;
        lastDirection.current = "up";

        if (accumulatedUp.current > THRESHOLD) {
          setState(prev => ({ ...prev, showInput: false, showNavBar: false, showHeader: true }));
        }
      }

      lastScrollY.current = currentY;
      ticking.current = false;
    });
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll, scrollRef]);

  // Restore all on tap (for use as a callback)
  const restoreAll = useCallback(() => {
    setState({ showHeader: true, showInput: true, showNavBar: true });
    accumulatedUp.current = 0;
    accumulatedDown.current = 0;
    consecutiveCount.current = 0;
  }, []);

  return { ...state, restoreAll };
};
