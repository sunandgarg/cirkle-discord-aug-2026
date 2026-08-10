import { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface UseVirtualListOptions {
  itemCount: number;
  estimatedItemHeight?: number;
  overscan?: number;
  containerRef: React.RefObject<HTMLElement>;
}

interface VirtualItem {
  index: number;
  start: number;
  size: number;
}

/**
 * Virtual list hook - only renders visible items + overscan.
 * Supports variable height items via measured heights.
 */
export function useVirtualList({
  itemCount,
  estimatedItemHeight = 80,
  overscan = 3,
  containerRef,
}: UseVirtualListOptions) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const heightCache = useRef(new Map<number, number>());
  const rafRef = useRef<number>(0);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    setContainerHeight(el.clientHeight);

    return () => observer.disconnect();
  }, [containerRef]);

  // Scroll handler with rAF throttle
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setScrollTop(el.scrollTop);
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [containerRef]);

  const getItemHeight = useCallback((index: number) => {
    return heightCache.current.get(index) ?? estimatedItemHeight;
  }, [estimatedItemHeight]);

  const measureItem = useCallback((index: number, height: number) => {
    const prev = heightCache.current.get(index);
    if (prev !== height) {
      heightCache.current.set(index, height);
    }
  }, []);

  const virtualItems: VirtualItem[] = useMemo(() => {
    if (itemCount === 0 || containerHeight === 0) return [];

    // Calculate visible range
    let accumulatedHeight = 0;
    let startIndex = 0;

    for (let i = 0; i < itemCount; i++) {
      const h = getItemHeight(i);
      if (accumulatedHeight + h > scrollTop) {
        startIndex = i;
        break;
      }
      accumulatedHeight += h;
    }

    startIndex = Math.max(0, startIndex - overscan);

    // Calculate start offset for the first visible item
    let startOffset = 0;
    for (let i = 0; i < startIndex; i++) {
      startOffset += getItemHeight(i);
    }

    const items: VirtualItem[] = [];
    let currentOffset = startOffset;

    for (let i = startIndex; i < itemCount; i++) {
      const h = getItemHeight(i);
      items.push({ index: i, start: currentOffset, size: h });
      currentOffset += h;

      if (currentOffset > scrollTop + containerHeight + (overscan * estimatedItemHeight)) {
        break;
      }
    }

    return items;
  }, [itemCount, containerHeight, scrollTop, overscan, getItemHeight, estimatedItemHeight]);

  // Total list height
  const totalHeight = useMemo(() => {
    let total = 0;
    for (let i = 0; i < itemCount; i++) {
      total += getItemHeight(i);
    }
    return total;
  }, [itemCount, getItemHeight]);

  return {
    virtualItems,
    totalHeight,
    measureItem,
    containerHeight,
    scrollTop,
  };
}
