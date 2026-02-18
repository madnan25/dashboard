"use client";

import { HeroUIProvider } from "@heroui/react";
import { ScrollToTop } from "@/components/nav/ScrollToTop";
import { AuthBootstrapper } from "@/components/auth/AuthBootstrapper";
import { ClientErrorReporter } from "@/components/system/ClientErrorReporter";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIProvider locale="en-US">
      <ClientErrorReporter />
      <AuthBootstrapper />
      <ScrollToTop />
      {children}
    </HeroUIProvider>
  );
}


