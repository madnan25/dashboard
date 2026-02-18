"use client";

import { HeroUIProvider } from "@heroui/react";
import { ScrollToTop } from "@/components/nav/ScrollToTop";
import { AuthBootstrapper } from "@/components/auth/AuthBootstrapper";
import { ClientErrorReporter } from "@/components/system/ClientErrorReporter";
import { NotificationsProvider } from "@/components/notifications/NotificationsProvider";

export function Providers({ children, marketingUserId }: { children: React.ReactNode; marketingUserId?: string | null }) {
  return (
    <HeroUIProvider locale="en-US">
      <ClientErrorReporter />
      <AuthBootstrapper />
      <ScrollToTop />
      {marketingUserId ? <NotificationsProvider userId={marketingUserId}>{children}</NotificationsProvider> : children}
    </HeroUIProvider>
  );
}


