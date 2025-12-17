"use client";

import * as React from "react";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type Step = {
  from: string;
  to: string;
  percent: number; // 0-100
  colorClassName: string; // e.g. "bg-emerald-400"
};

export function ConversionFlow({ steps }: { steps: Step[] }) {
  return (
    <div className="space-y-4">
      {steps.map((s) => {
        const pct = clamp(s.percent, 0, 100);
        return (
          <div key={`${s.from}-${s.to}`} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/70">{s.from}</span>
                <span className="text-white/35">→</span>
                <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/70">{s.to}</span>
              </div>
              <div className="font-semibold text-white/90">{pct.toFixed(0)}%</div>
            </div>

            <div className="relative h-2 w-full rounded-full bg-white/10">
              <div className={`h-2 rounded-full ${s.colorClassName}`} style={{ width: `${pct}%` }} />
              <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/10" />
            </div>
          </div>
        );
      })}
    </div>
  );
}


