"use client";

import { useEffect } from "react";

export function MemoryHashScroller() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) {
      return;
    }
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    const scrollToHash = () => {
      document.getElementById(decodeURIComponent(hash))?.scrollIntoView({
        block: "start",
      });
    };

    const animationFrame = window.requestAnimationFrame(scrollToHash);
    const timeouts = [50, 150, 400, 800].map((delay) =>
      window.setTimeout(scrollToHash, delay),
    );

    return () => {
      window.cancelAnimationFrame(animationFrame);
      for (const timeout of timeouts) {
        window.clearTimeout(timeout);
      }
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  return null;
}
