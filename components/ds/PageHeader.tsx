"use client";

import * as React from "react";
import { BackButton } from "@/components/nav/BackButton";

export function PageHeader({
  title,
  subtitle,
  right,
  backHref,
  showBack = true
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  backHref?: string;
  showBack?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 min-w-0">
        {showBack ? (
          <BackButton
            fallbackHref={backHref}
            label="← Back"
            className="glass-inset rounded-2xl border border-white/10 bg-white/[0.02] text-white/85 hover:bg-white/[0.04] hover:border-white/15 whitespace-nowrap"
          />
        ) : null}

        <div className="min-w-0">
          <div className="text-lg sm:text-xl font-semibold tracking-tight text-white/95 leading-tight break-words">
            {title}
          </div>
          {subtitle ? <div className="mt-0.5 text-sm text-white/55">{subtitle}</div> : null}
        </div>
      </div>

      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

