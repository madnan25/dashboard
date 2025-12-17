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

export function AreaChart({
  labels,
  values,
  strokeClassName = "stroke-emerald-400",
  gradientFrom = "rgba(16,185,129,0.35)",
  gradientTo = "rgba(16,185,129,0.00)",
  height = 280,
  interactive = false,
  formatValue
}: {
  labels: string[];
  values: number[];
  strokeClassName?: string;
  gradientFrom?: string;
  gradientTo?: string;
  height?: number;
  interactive?: boolean;
  formatValue?: (value: number) => string;
}) {
  const width = 900;
  const padX = 18;
  const padY = 16;

  const { min, max } = domain(values);
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const xForIndex = (i: number) =>
    padX + (values.length <= 1 ? 0 : (i / (values.length - 1)) * innerW);
  const yForValue = (v: number) => {
    const t = (v - min) / (max - min);
    return padY + (1 - clamp(t, 0, 1)) * innerH;
  };

  const d = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xForIndex(i)} ${yForValue(v)}`)
    .join(" ");

  const area = `${d} L ${xForIndex(values.length - 1)} ${height - padY} L ${xForIndex(0)} ${height - padY} Z`;
  const gid = React.useId().replace(/:/g, "");

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  const setFromClientX = React.useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const t = clamp((x / rect.width) * width - padX, 0, innerW) / innerW;
      const idx = Math.round(t * Math.max(0, values.length - 1));
      setActiveIndex(idx);
    },
    [innerW, padX, values.length, width]
  );

  const active =
    activeIndex == null
      ? null
      : {
          index: activeIndex,
          label: labels[activeIndex] ?? "",
          value: values[activeIndex] ?? 0,
          x: xForIndex(activeIndex),
          y: yForValue(values[activeIndex] ?? 0)
        };

  return (
    <div
      ref={containerRef}
      className={`w-full ${interactive ? "relative select-none" : ""}`}
      onPointerLeave={interactive ? () => setActiveIndex(null) : undefined}
      onPointerMove={
        interactive
          ? (e) => {
              setFromClientX(e.clientX);
            }
          : undefined
      }
      onPointerDown={
        interactive
          ? (e) => {
              setFromClientX(e.clientX);
            }
          : undefined
      }
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={`h-[280px] w-full ${interactive ? "cursor-crosshair" : ""}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="area chart"
      >
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={gradientFrom} />
            <stop offset="100%" stopColor={gradientTo} />
          </linearGradient>
        </defs>

        {/* subtle horizontal grid */}
        {Array.from({ length: 4 }).map((_, idx) => {
          const y = padY + ((idx + 1) / 4) * innerH;
          return (
            <line
              key={idx}
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

        <path d={area} fill={`url(#${gid})`} />
        <path d={d} className={`${strokeClassName} fill-none`} strokeWidth="2.6" />

        {interactive && active ? (
          <g>
            <line
              x1={active.x}
              x2={active.x}
              y1={padY}
              y2={height - padY}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth="1"
            />
            <circle cx={active.x} cy={active.y} r="4.5" fill="rgba(255,255,255,0.95)" />
            <circle cx={active.x} cy={active.y} r="8" fill="rgba(255,255,255,0.10)" />
          </g>
        ) : null}
      </svg>

      <div className="mt-3 flex items-center justify-between text-xs text-white/45">
        <span className="truncate">{labels[0] ?? ""}</span>
        <span className="truncate">{labels[Math.max(0, labels.length - 1)] ?? ""}</span>
      </div>

      {interactive && active ? (
        <div
          className="pointer-events-none absolute top-4 rounded-xl bg-black/60 px-3 py-2 text-xs text-white/80 shadow-lg ring-1 ring-white/10 backdrop-blur"
          style={{
            left: `${(active.x / width) * 100}%`,
            transform: "translateX(-50%)"
          }}
        >
          <div className="font-medium text-white/90">{active.label}</div>
          <div className="mt-0.5">
            {formatValue ? formatValue(active.value) : active.value.toLocaleString()}
          </div>
        </div>
      ) : null}
    </div>
  );
}


