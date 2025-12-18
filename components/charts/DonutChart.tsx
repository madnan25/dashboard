"use client";

import * as React from "react";

export type DonutDatum = {
  key: string;
  label: string;
  value: number;
  color: string; // css color string (rgba/hex)
};

function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatCompact(n: number) {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

export function DonutChart({
  title,
  data,
  centerLabel,
  centerValue,
  className = ""
}: {
  title?: string;
  data: DonutDatum[];
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}) {
  const total = sum(data.map((d) => d.value));
  const safeTotal = total > 0 ? total : 1;

  let acc = 0;
  const stops = data
    .map((d) => {
      const start = acc;
      const pct = clamp(d.value / safeTotal, 0, 1);
      acc += pct;
      const end = acc;
      return { ...d, start, end };
    })
    .filter((d) => d.value > 0);

  const conic = stops.length
    ? `conic-gradient(${stops
        .map((d) => `${d.color} ${(d.start * 100).toFixed(3)}% ${(d.end * 100).toFixed(3)}%`)
        .join(", ")})`
    : "conic-gradient(rgba(255,255,255,0.08) 0 100%)";

  return (
    <div className={["glass-inset rounded-2xl p-4", className].join(" ")}>
      {title ? <div className="text-sm font-semibold text-white/85">{title}</div> : null}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="relative h-[140px] w-[140px] shrink-0">
          <div
            className="absolute inset-0 rounded-full border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
            style={{ backgroundImage: conic }}
          />
          <div className="absolute inset-[16px] rounded-full border border-white/10 bg-black/50 backdrop-blur" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerLabel ? <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">{centerLabel}</div> : null}
            <div className="mt-1 text-xl font-semibold text-white/90">{centerValue ?? formatCompact(total)}</div>
          </div>
        </div>

        <div className="min-w-[180px] flex-1 space-y-2">
          {data.map((d) => {
            const pct = total > 0 ? (d.value / total) * 100 : 0;
            return (
              <div key={d.key} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full border border-white/10" style={{ backgroundColor: d.color }} />
                  <span className="truncate text-white/75">{d.label}</span>
                </div>
                <div className="shrink-0 text-white/70">
                  <span className="font-semibold text-white/85">{formatCompact(d.value)}</span>
                  <span className="ml-2 text-white/45">{pct.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
          {total <= 0 ? <div className="text-xs text-white/45">No data yet.</div> : null}
        </div>
      </div>
    </div>
  );
}

