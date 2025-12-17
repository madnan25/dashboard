"use client";

import * as React from "react";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function domain(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (min === max) return { min: min - 1, max: max + 1 };
  return { min, max };
}

export function Sparkline({
  values,
  strokeClassName = "stroke-emerald-400",
  fillClassName = "fill-emerald-400/15",
  height = 44
}: {
  values: number[];
  strokeClassName?: string;
  fillClassName?: string;
  height?: number;
}) {
  const width = 120;
  const pad = 6;
  const { min, max } = domain(values);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const xForIndex = (i: number) =>
    pad + (values.length <= 1 ? 0 : (i / (values.length - 1)) * innerW);
  const yForValue = (v: number) => {
    const t = (v - min) / (max - min);
    return pad + (1 - clamp(t, 0, 1)) * innerH;
  };

  const d = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xForIndex(i)} ${yForValue(v)}`)
    .join(" ");

  const area = `${d} L ${xForIndex(values.length - 1)} ${height - pad} L ${xForIndex(0)} ${height - pad} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-11 w-[120px]"
      preserveAspectRatio="none"
      role="img"
      aria-label="sparkline"
    >
      <path d={area} className={fillClassName} />
      <path d={d} className={`${strokeClassName} fill-none`} strokeWidth="2.2" />
    </svg>
  );
}


