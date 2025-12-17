"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function LogoutButton({
  className,
  size = "sm",
  variant = "flat"
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "flat" | "solid" | "bordered" | "light" | "faded" | "shadow" | "ghost";
}) {
  const router = useRouter();

  async function onLogout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // If env vars are missing locally, just fall through to redirect.
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <Button onPress={onLogout} size={size} variant={variant} className={className}>
      Logout
    </Button>
  );
}

