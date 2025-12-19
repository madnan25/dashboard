"use client";

import type * as React from "react";
import { cn } from "@/lib/cn";

export function PillSelect(props: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const { value, onChange, disabled, className, ariaLabel, children } = props;

  return (
    <div className={cn("relative", className)}>
      <select
        aria-label={ariaLabel}
        className={cn(
          [
            "glass-inset h-10 w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.02] px-4 pr-10 text-sm text-white/85 hover:bg-white/[0.04]",
            // premium focus (avoid default outline rectangle)
            "focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:border-white/20 focus:shadow-[0_0_0_1px_rgba(255,255,255,0.10)]"
          ].join(" "),
          disabled ? "opacity-60" : ""
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/45" aria-hidden="true">
        ▾
      </div>
    </div>
  );
}

