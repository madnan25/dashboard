"use client";

import { Button } from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";

function fallbackForPath(pathname: string) {
  if (pathname.startsWith("/projects/")) return "/projects";
  if (pathname.startsWith("/cmo/")) return "/projects";
  if (pathname.startsWith("/brand/")) return "/projects";
  if (pathname.startsWith("/account")) return "/";
  if (pathname.startsWith("/design")) return "/";
  return "/";
}

export function BackButton({
  className = "",
  size = "sm",
  label = "Back"
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const fallbackHref = useMemo(() => fallbackForPath(pathname), [pathname]);

  const isRoot = pathname === "/";

  return (
    <Button
      size={size}
      variant="flat"
      isDisabled={isRoot}
      className={className}
      onPress={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
    >
      {label}
    </Button>
  );
}

