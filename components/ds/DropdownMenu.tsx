"use client";

import type * as React from "react";
import { cn } from "@/lib/cn";

export function DropdownMenu({
  title,
  children,
  className = ""
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("glass-inset rounded-2xl p-2", className)}
      style={{
        backgroundColor: "rgba(18, 23, 40, 0.97)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)"
      }}
    >
      {title ? <div className="px-2 py-1 text-[11px] uppercase tracking-widest text-white/45">{title}</div> : null}
      <div className="max-h-60 overflow-y-auto">{children}</div>
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  trailing,
  className = ""
}: {
  children: React.ReactNode;
  onClick?: () => void;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-white/85 hover:bg-white/[0.04]",
        className
      )}
    >
      <span className="truncate">{children}</span>
      {trailing ? <span className="text-[11px] text-white/45">{trailing}</span> : null}
    </button>
  );
}
