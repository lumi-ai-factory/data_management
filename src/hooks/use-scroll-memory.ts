import * as React from "react";

/**
 * In-memory scroll position store, keyed by page slug. Lives for the lifetime
 * of the window/tab so switching between chapters and coming back restores the
 * reading position. It is intentionally NOT persisted to storage — it only
 * remembers positions visited in the current session.
 */
type Anchor = { index: number; offset: number };
const store = new Map<string, Anchor>();

/** Selectors for "content" elements we can anchor to. */
const CANDIDATE_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,pre,img,table,blockquote,figure";

/** Sticky header is h-14 (56px). Reading "top" sits just below it. */
const HEADER_OFFSET = 56;

function useIsomorphicLayoutEffect(effect: React.EffectCallback, deps?: React.DependencyList) {
  const useEffectImpl = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

  useEffectImpl(effect, deps);
}

/**
 * Remembers the reading position within a page and restores it when the user
 * navigates back to that page in the same session.
 *
 * Strategy: instead of saving a raw pixel offset (which drifts when images
 * above load and change the page height), we save the *content element*
 * currently crossing the top of the viewport plus a small intra-element
 * offset. On restore we locate that same element by its index and scroll it
 * back to the same spot — re-applying as images load so layout shifts above
 * the anchor don't throw the position off.
 */
export function useScrollMemory(slug: string, containerRef: React.RefObject<HTMLElement | null>) {
  // Save position as the user scrolls.
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;

    let raf = 0;
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const els = container.querySelectorAll<HTMLElement>(CANDIDATE_SELECTOR);
        const threshold = HEADER_OFFSET;
        if (window.scrollY <= 0) {
          store.delete(slug);
          return;
        }
        for (let i = 0; i < els.length; i++) {
          const r = els[i].getBoundingClientRect();
          if (r.bottom > threshold + 1) {
            store.set(slug, { index: i, offset: threshold - r.top });
            return;
          }
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [slug, containerRef]);

  // Restore position when the page mounts / slug changes.
  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;

    const saved = store.get(slug);
    if (!saved) return;

    let cancelled = false;
    let userInteracted = false;

    const stop = () => {
      userInteracted = true;
    };

    const apply = () => {
      if (cancelled || userInteracted) return;
      const els = container.querySelectorAll<HTMLElement>(CANDIDATE_SELECTOR);
      const el = els[saved.index];
      if (!el) return;
      const threshold = HEADER_OFFSET;
      const r = el.getBoundingClientRect();
      const delta = r.top - (threshold - saved.offset);
      if (Math.abs(delta) > 1) {
        window.scrollBy(0, delta);
      }
    };

    apply();

    // Re-apply as images and async layout settle, so shifts above the anchor
    // don't leave us in the wrong place.
    const timers = [50, 150, 300, 600, 1000].map((t) => setTimeout(apply, t));
    const imgs = Array.from(container.querySelectorAll("img"));
    imgs.forEach((img) => {
      if (!img.complete) img.addEventListener("load", apply);
    });

    // If the user scrolls themselves, stop fighting them.
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchmove", stop, { passive: true });
    window.addEventListener("keydown", stop);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      imgs.forEach((img) => img.removeEventListener("load", apply));
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchmove", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [slug]);
}
