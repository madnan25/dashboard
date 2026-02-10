"use client";

import { HeroUIProvider } from "@heroui/react";
import { ScrollToTop } from "@/components/nav/ScrollToTop";
import { NotificationsProvider } from "@/components/notifications/NotificationsProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIProvider>
      <ScrollToTop />
      <NotificationsProvider>{children}</NotificationsProvider>
    </HeroUIProvider>
  );
}


