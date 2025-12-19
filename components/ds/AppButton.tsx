"use client";

import * as React from "react";
import { Button } from "@heroui/react";
import { cn } from "@/lib/cn";

export type AppButtonIntent = "primary" | "secondary" | "danger" | "ghost";

export function AppButton(
  props: React.ComponentProps<typeof Button> & {
    intent?: AppButtonIntent;
  }
) {
  const { intent = "secondary", className, ...rest } = props;

  const base =
    "rounded-2xl border border-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20";

  const intentClass =
    intent === "primary"
      ? "bg-gradient-to-r from-blue-500/90 to-violet-500/90 text-white shadow-[0_12px_40px_rgba(59,130,246,0.18)] hover:from-blue-500 hover:to-violet-500"
      : intent === "danger"
        ? "bg-gradient-to-r from-rose-500/90 to-orange-500/80 text-white shadow-[0_12px_40px_rgba(244,63,94,0.16)] hover:from-rose-500 hover:to-orange-500"
        : intent === "ghost"
          ? "bg-transparent text-white/80 hover:bg-white/[0.04] hover:border-white/15"
          : "glass-inset bg-white/[0.02] text-white/85 hover:bg-white/[0.04] hover:border-white/15";

  return <Button {...rest} className={cn(base, intentClass, className)} />;
}

