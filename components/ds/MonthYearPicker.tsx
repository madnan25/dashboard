"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { MONTHS } from "@/lib/digitalSnapshot";
import { cn } from "@/lib/cn";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function MonthYearPicker({
  monthIndex,
  year,
  onChange,
  label,
  buttonClassName
}: {
  monthIndex: number;
  year: number;
  label: string;
  onChange: (next: { monthIndex: number; year: number }) => void;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const width = 320;
    const gutter = 12;

    const compute = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Prefer aligning the popover to the right edge of the trigger
      const preferredLeft = r.right - width;
      const left = clamp(preferredLeft, gutter, window.innerWidth - width - gutter);
      const top = clamp(r.bottom + 8, gutter, window.innerHeight - gutter);
      setPos({ left, top, width });
    };

    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open]);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => current - 3 + i);
  }, []);

  return (
    <div className="relative z-[1000] isolate" ref={ref}>
      <Button
        ref={anchorRef as unknown as never}
        size="sm"
        variant="flat"
        className={cn(
          "glass-inset rounded-2xl border border-white/10 bg-white/[0.02] text-white/85 hover:bg-white/[0.04] hover:border-white/15",
          // normalize sizing so it matches select pills
          "h-10 px-4 py-0",
          buttonClassName
        )}
        onPress={() => setOpen((v) => !v)}
      >
        {label}
      </Button>

      {open ? (
        <div
          className="fixed z-[2000] rounded-2xl border border-white/10 bg-black/70 p-3 shadow-2xl backdrop-blur pointer-events-auto"
          style={{
            left: pos?.left ?? 12,
            top: pos?.top ?? 56,
            width: pos?.width ?? 320,
            maxWidth: "calc(100vw - 24px)"
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-2 text-xs font-medium text-white/50">Month</div>
              <div className="grid grid-cols-3 gap-1">
                {MONTHS.map((m, idx) => (
                  <button
                    key={m}
                    type="button"
                    className={`rounded-lg px-2 py-2 text-xs ${
                      idx === monthIndex ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
                    }`}
                    onClick={() => onChange({ monthIndex: idx, year })}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-white/50">Year</div>
              <div className="grid grid-cols-2 gap-1">
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={`rounded-lg px-2 py-2 text-xs ${
                      y === year ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
                    }`}
                    onClick={() => onChange({ monthIndex, year: y })}
                  >
                    {y}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <Button size="sm" variant="flat" className="glass-inset text-white/80" onPress={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


