import { useCallback, useEffect, useRef, useState } from 'react';

interface ScrollState {
  isAtBottom: boolean;
  autoScrollEnabled: boolean;
}

interface UseAutoScrollOptions {
  offset?: number;
  smooth?: boolean;
  content?: React.ReactNode;
}

export function useAutoScroll(options: UseAutoScrollOptions = {}) {
  const { offset = 20, smooth = false, content } = options;
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastContentHeight = useRef(0);
  const userHasScrolled = useRef(false);

  const [scrollState, setScrollState] = useState<ScrollState>({
    isAtBottom: true,
    autoScrollEnabled: true,
  });

  const checkIsAtBottom = useCallback(
    (element: HTMLElement) => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      const distanceToBottom = Math.abs(
        scrollHeight - scrollTop - clientHeight,
      );
      return distanceToBottom <= offset;
    },
    [offset],
  );

  const scrollToBottom = useCallback(
    (instant?: boolean) => {
      if (!scrollRef.current) return;

      const targetScrollTop =
        scrollRef.current.scrollHeight - scrollRef.current.clientHeight;

      if (instant) {
        scrollRef.current.scrollTop = targetScrollTop;
      } else {
        scrollRef.current.scrollTo({
          top: targetScrollTop,
          behavior: smooth ? 'smooth' : 'auto',
        });
      }

      // Only update state if it's actually changing
      setScrollState((prev) => {
        if (!prev.isAtBottom || !prev.autoScrollEnabled) {
          return {
            isAtBottom: true,
            autoScrollEnabled: true,
          };
        }
        return prev;
      });
      userHasScrolled.current = false;
    },
    [smooth], // Added scrollState.isAtBottom, scrollState.autoScrollEnabled to dependencies
  );

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const atBottom = checkIsAtBottom(scrollRef.current);

    setScrollState((prev) => {
      // Only update if 'atBottom' status changes or if autoScroll needs to be re-enabled
      if (prev.isAtBottom !== atBottom || (atBottom && !prev.autoScrollEnabled)) {
        return {
          isAtBottom: atBottom,
          autoScrollEnabled: atBottom ? true : prev.autoScrollEnabled,
        };
      }
      return prev; // Return previous state if no change
    });
  }, [checkIsAtBottom]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => element.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const currentHeight = scrollElement.scrollHeight;
    const hasNewContent = currentHeight !== lastContentHeight.current;

    if (hasNewContent) {
      if (scrollState.autoScrollEnabled) {
        requestAnimationFrame(() => {
          scrollToBottom(lastContentHeight.current === 0);
        });
      }
      lastContentHeight.current = currentHeight;
    }
  }, [content, scrollState.autoScrollEnabled, scrollToBottom]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver(() => {
      if (scrollState.autoScrollEnabled) {
        scrollToBottom(true);
      }
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [scrollState.autoScrollEnabled, scrollToBottom]);

  const disableAutoScroll = useCallback(() => {
    const atBottom = scrollRef.current
      ? checkIsAtBottom(scrollRef.current)
      : false;

    // Only disable if not at bottom
    if (!atBottom) {
      userHasScrolled.current = true;
      setScrollState((prev) => {
        if (prev.autoScrollEnabled) { // Only update if it's currently enabled
          return {
            ...prev,
            autoScrollEnabled: false,
          };
        }
        return prev;
      });
    }
  }, [checkIsAtBottom]);

  return {
    scrollRef,
    isAtBottom: scrollState.isAtBottom,
    autoScrollEnabled: scrollState.autoScrollEnabled,
    // Ensure the returned scrollToBottom function has a stable reference
    scrollToBottom: useCallback(() => scrollToBottom(false), [scrollToBottom]),
    disableAutoScroll,
  };
}
