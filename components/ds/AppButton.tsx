"use client";

import * as React from "react";
import { Button } from "@heroui/react";
import { cn } from "@/lib/cn";

export type AppButtonIntent = "primary" | "secondary" | "danger" | "ghost";
export type AppButtonEffect = "default" | "wow";

export function AppButton(
  props: React.ComponentProps<typeof Button> & {
    intent?: AppButtonIntent;
    effect?: AppButtonEffect;
  }
) {
  const { intent = "secondary", effect = "default", className, ...rest } = props;

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

  const wowClass =
    intent === "primary" && effect === "wow"
      ? cn(
          // structure
          "relative overflow-hidden",
          // a bit more premium motion + depth
          "transition-[transform,box-shadow,filter] duration-200 ease-out",
          "hover:-translate-y-[1px] active:translate-y-0",
          "hover:shadow-[0_18px_70px_rgba(59,130,246,0.28)]",
          // subtle highlight sweep (shine)
          "after:pointer-events-none after:absolute after:inset-0 after:opacity-0 after:transition-opacity after:duration-200",
          "after:bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.22),transparent)]",
          "after:translate-x-[-140%] after:transition-transform after:duration-700 after:ease-out",
          "hover:after:opacity-100 hover:after:translate-x-[140%]",
          // faint inner sparkle (keeps it 'premium' not 'neon')
          "before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-200",
          "before:bg-[radial-gradient(900px_220px_at_50%_-30%,rgba(255,255,255,0.22),transparent_55%)]",
          "hover:before:opacity-100"
        )
      : "";

  return <Button {...rest} className={cn(base, intentClass, wowClass, className)} />;
}

