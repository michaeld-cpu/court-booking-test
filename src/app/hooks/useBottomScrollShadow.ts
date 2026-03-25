import { DependencyList, RefObject, useEffect, useState } from 'react';

interface UseBottomScrollShadowOptions {
  enabled?: boolean;
  threshold?: number;
  deps?: DependencyList;
}

export const useBottomScrollShadow = (
  containerRef: RefObject<HTMLElement | null>,
  options?: UseBottomScrollShadowOptions,
) => {
  const { enabled = true, threshold = 2, deps = [] } = options ?? {};
  const [showBottomShadow, setShowBottomShadow] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) {
      setShowBottomShadow(false);
      return;
    }

    const updateBottomShadow = () => {
      const remainingScroll =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowBottomShadow(remainingScroll > threshold);
    };

    const rafId = window.requestAnimationFrame(() => {
      updateBottomShadow();
      window.requestAnimationFrame(updateBottomShadow);
    });
    const timeoutId = window.setTimeout(updateBottomShadow, 60);
    container.addEventListener('scroll', updateBottomShadow, { passive: true });
    window.addEventListener('resize', updateBottomShadow);

    const resizeObserver = new ResizeObserver(updateBottomShadow);
    resizeObserver.observe(container);

    const mutationObserver = new MutationObserver(updateBottomShadow);
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      container.removeEventListener('scroll', updateBottomShadow);
      window.removeEventListener('resize', updateBottomShadow);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [containerRef, enabled, threshold, ...deps]);

  return showBottomShadow;
};
