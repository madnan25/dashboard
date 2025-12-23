"use client";

import * as React from "react";

type Point = {
  label: string;
  target: number;
  actual: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function FunnelComparisonLineChart({
  points,
  formatNumber
}: {
  points: Point[];
  formatNumber: (n: number) => string;
}) {
  const width = 900;
  const height = 320;
  const padX = 36;
  const padY = 26;

  const maxY = Math.max(1, ...points.flatMap((p) => [p.target, p.actual]));
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const xForIndex = (i: number) =>
    padX + (points.length <= 1 ? 0 : (i / (points.length - 1)) * innerW);
  const yForValue = (v: number) => {
    const t = v / maxY;
    return padY + (1 - clamp(t, 0, 1)) * innerH;
  };

  const dFor = (key: "target" | "actual") =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xForIndex(i)} ${yForValue(p[key])}`)
      .join(" ");

  const targetD = dFor("target");
  const actualD = dFor("actual");

  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const setFromClientX = React.useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const t = clamp(x / rect.width, 0, 1);
      const idx = Math.round(t * Math.max(0, points.length - 1));
      setActiveIndex(idx);
    },
    [points.length]
  );

  const active = activeIndex == null ? null : points[activeIndex];
  const activeX = activeIndex == null ? null : xForIndex(activeIndex);

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-4 text-xs text-white/60">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-slate-300/80" />
          Target
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Actual
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative w-full select-none aspect-[900/320] md:aspect-auto md:h-[320px]"
        onPointerLeave={() => setActiveIndex(null)}
        onPointerMove={(e) => setFromClientX(e.clientX)}
        onPointerDown={(e) => setFromClientX(e.clientX)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Target vs Actual funnel comparison chart"
        >
        {/* grid */}
        {Array.from({ length: 4 }).map((_, i) => {
          const y = padY + ((i + 1) / 4) * innerH;
          return (
            <line
              key={i}
              x1={padX}
              x2={width - padX}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
          );
        })}

        {/* lines */}
        <path d={targetD} fill="none" stroke="rgba(148,163,184,0.9)" strokeWidth="2.2" />
        <path d={actualD} fill="none" stroke="rgba(52,211,153,0.95)" strokeWidth="2.6" />

        {/* points */}
        {points.map((p, i) => (
          <g key={p.label}>
            <circle cx={xForIndex(i)} cy={yForValue(p.target)} r="3.5" fill="rgba(148,163,184,0.9)" />
            <circle cx={xForIndex(i)} cy={yForValue(p.actual)} r="4.0" fill="rgba(52,211,153,0.95)" />
          </g>
        ))}

        {/* hover vertical */}
        {activeX != null ? (
          <line
            x1={activeX}
            x2={activeX}
            y1={padY}
            y2={height - padY}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
          />
        ) : null}

        {/* x labels */}
        {points.map((p, i) => (
          <text
            key={p.label}
            x={xForIndex(i)}
            y={height - 8}
            textAnchor="middle"
            fontSize="13"
            fill="rgba(255,255,255,0.45)"
          >
            {p.label}
          </text>
        ))}
        </svg>

        {active && activeIndex != null ? (
          <div
            className="pointer-events-none absolute top-0 rounded-xl bg-black/60 px-3 py-2 text-xs text-white/85 shadow-lg ring-1 ring-white/10 backdrop-blur"
            style={{
              left: `${(xForIndex(activeIndex) / width) * 100}%`,
              transform: "translateX(-50%)"
            }}
          >
            <div className="font-medium text-white/90">{active.label}</div>
            <div className="mt-0.5 flex items-center justify-between gap-4">
              <span className="text-white/60">Target</span>
              <span className="font-medium">{formatNumber(active.target)}</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-4">
              <span className="text-white/60">Actual</span>
              <span className="font-medium">{formatNumber(active.actual)}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}


