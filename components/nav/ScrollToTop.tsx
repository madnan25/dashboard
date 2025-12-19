"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    // Force browsers to not restore scroll position on history navigation.
    if (typeof window !== "undefined") {
      try {
        window.history.scrollRestoration = "manual";
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    // Always start at the top when navigating to a new route (including back/forward).
    // Use instant scroll to avoid jank.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return null;
}

