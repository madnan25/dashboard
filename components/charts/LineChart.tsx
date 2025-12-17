"use client";

import * as React from "react";

type Series = {
  name: string;
  values: number[];
  colorClassName: string; // e.g. "stroke-primary"
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getDomain(series: Series[]) {
  const all = series.flatMap((s) => s.values);
  const min = Math.min(...all);
  const max = Math.max(...all);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (min === max) return { min: min - 1, max: max + 1 };
  return { min, max };
}

export function LineChart({
  labels,
  series,
  height = 180
}: {
  labels: string[];
  series: Series[];
  height?: number;
}) {
  const width = 600;
  const padding = 14;
  const { min, max } = getDomain(series);

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const pointsCount = Math.max(labels.length, ...series.map((s) => s.values.length));

  const xForIndex = (i: number) =>
    padding + (pointsCount <= 1 ? 0 : (i / (pointsCount - 1)) * innerW);
  const yForValue = (v: number) => {
    const t = (v - min) / (max - min);
    return padding + (1 - clamp(t, 0, 1)) * innerH;
  };

  const gridLines = 4;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[180px] w-full"
        role="img"
        aria-label="Trend line chart"
        preserveAspectRatio="none"
      >
        {/* grid */}
        {Array.from({ length: gridLines + 1 }).map((_, idx) => {
          const y = padding + (idx / gridLines) * innerH;
          return (
            <line
              key={idx}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              className="stroke-default-200"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
          );
        })}

        {/* series */}
        {series.map((s) => {
          const d = s.values
            .slice(0, pointsCount)
            .map((v, i) => `${i === 0 ? "M" : "L"} ${xForIndex(i)} ${yForValue(v)}`)
            .join(" ");
          return (
            <g key={s.name}>
              <path d={d} className={`${s.colorClassName} fill-none`} strokeWidth="2.5" />
              {s.values.slice(0, pointsCount).map((v, i) => (
                <circle
                  key={i}
                  cx={xForIndex(i)}
                  cy={yForValue(v)}
                  r="3.5"
                  className={`${s.colorClassName} fill-content1`}
                  strokeWidth="2"
                />
              ))}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex items-center justify-between text-xs text-default-500">
        <span className="truncate">{labels[0] ?? ""}</span>
        <span className="truncate">{labels[Math.max(0, labels.length - 1)] ?? ""}</span>
      </div>
    </div>
  );
}


