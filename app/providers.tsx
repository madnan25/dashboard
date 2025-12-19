"use client";

import { HeroUIProvider } from "@heroui/react";
import { ScrollToTop } from "@/components/nav/ScrollToTop";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIProvider>
      <ScrollToTop />
      {children}
    </HeroUIProvider>
  );
}


