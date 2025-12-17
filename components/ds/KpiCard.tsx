"use client";

import type { ReactNode } from "react";

export type KpiDelta = { value: string; direction: "up" | "down" | "flat"; tone: "good" | "bad" | "neutral" };

export function KpiCard({
  label,
  value,
  helper,
  delta,
  deltaLabel,
  deltaShowArrow = true,
  right
}: {
  label: string;
  value: string;
  helper?: string;
  delta?: KpiDelta;
  deltaLabel?: string;
  deltaShowArrow?: boolean;
  right?: ReactNode;
}) {
  const deltaTone =
    delta?.tone === "good"
      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/20"
      : delta?.tone === "bad"
        ? "bg-rose-500/15 text-rose-300 border border-rose-400/20"
        : "bg-white/5 text-white/60 border border-white/10";

  const deltaArrow = delta?.direction === "up" ? "↗" : delta?.direction === "down" ? "↘" : "→";

  return (
    <div className="glass-surface rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-white/60">{label}</div>
            {delta ? (
              <>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${deltaTone}`}>
                  {deltaShowArrow ? <span>{deltaArrow}</span> : null}
                  <span>{delta.value}</span>
                </span>
                {deltaLabel ? <span className="text-xs text-white/45">{deltaLabel}</span> : null}
              </>
            ) : null}
          </div>
          <div className="text-4xl font-semibold tracking-tight text-white/95">{value}</div>
          {helper ? <div className="text-sm text-white/55">{helper}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  );
}


