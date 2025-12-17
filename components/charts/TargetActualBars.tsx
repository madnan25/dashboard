"use client";

import * as React from "react";

type Item = {
  stage: string;
  target: number;
  actual: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function TargetActualBars({
  items,
  formatNumber
}: {
  items: Item[];
  formatNumber: (n: number) => string;
}) {
  return (
    <div className="space-y-5">
      {items.map((it) => {
        const target = Math.max(1, it.target);
        const ratio = it.actual / target;
        const pctRaw = ratio * 100;
        const pctFill = clamp(pctRaw, 0, 100); // never overflow the container
        const variance = it.actual - it.target;
        const varianceSign = variance > 0 ? "+" : variance < 0 ? "−" : "±";
        const varianceAbs = Math.abs(variance);
        const isGood = variance >= 0;
        const overByPct = Math.max(0, pctRaw - 100);

        return (
          <div key={it.stage} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white/90">{it.stage}</div>
              <div className="flex items-center gap-4 text-xs text-white/60">
                <span>
                  Target <span className="text-white/85 font-medium">{formatNumber(it.target)}</span>
                </span>
                <span>
                  Actual <span className="text-white/85 font-medium">{formatNumber(it.actual)}</span>
                </span>
                <span className={isGood ? "text-emerald-300" : "text-rose-300"}>
                  {varianceSign} {formatNumber(varianceAbs)}
                </span>
              </div>
            </div>

            {/* bar: target track + actual fill */}
            <div className="relative h-2 w-full rounded-full bg-white/10">
              <div
                className={`h-2 rounded-full ${isGood ? "bg-emerald-400" : "bg-rose-400"}`}
                style={{ width: `${pctFill}%` }}
                aria-label={`${it.stage}: ${clamp(pctRaw, 0, 999).toFixed(0)}% of target`}
              />
              {/* Over-target marker */}
              {pctRaw > 100 ? (
                <div
                  className="absolute right-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-emerald-300/70 shadow-[0_0_16px_rgba(52,211,153,0.45)]"
                  aria-hidden="true"
                />
              ) : null}
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">{clamp(pctRaw, 0, 999).toFixed(0)}% of target</span>
              {pctRaw > 100 ? (
                <span className="text-emerald-300/90">
                  +{overByPct.toFixed(0)}% over
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}


