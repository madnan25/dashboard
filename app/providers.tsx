"use client";

import { HeroUIProvider } from "@heroui/react";
import { ScrollToTop } from "@/components/nav/ScrollToTop";
import { NotificationsProvider } from "@/components/notifications/NotificationsProvider";
import { AuthBootstrapper } from "@/components/auth/AuthBootstrapper";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIProvider>
      <AuthBootstrapper />
      <ScrollToTop />
      <NotificationsProvider>{children}</NotificationsProvider>
    </HeroUIProvider>
  );
}


