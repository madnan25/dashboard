"use client";

import { useMemo, useRef } from "react";
import { cn } from "@/lib/cn";
import { AppButton } from "@/components/ds/AppButton";

function formatIsoDate(iso: string) {
  const parts = iso.split("-").map((p) => Number(p));
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return iso;
  // Use UTC to avoid timezone shifting the calendar day.
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function CalendarIcon(props: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cn("h-4 w-4", props.className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2v3M16 2v3" />
      <path d="M3 9h18" />
      <path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function DayDatePicker(props: {
  value: string;
  onChange: (nextIso: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
  className?: string;
  showClear?: boolean;
}) {
  const { value, onChange, placeholder, isDisabled, className, showClear } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);

  const label = useMemo(() => {
    if (value) return formatIsoDate(value);
    return placeholder ?? "Select date";
  }, [placeholder, value]);

  const isEmpty = !value;

  function open() {
    if (isDisabled) return;
    const el = inputRef.current;
    if (!el) return;
    // Safari/Chrome support showPicker; fallback to click.
    const maybeShowPicker = (el as HTMLInputElement & { showPicker?: () => void }).showPicker;
    if (typeof maybeShowPicker === "function") maybeShowPicker.call(el);
    else el.click();
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative flex-1">
        <button
          type="button"
          onClick={open}
          disabled={isDisabled}
          className={cn(
            [
              "w-full glass-inset rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.03]",
              "px-4 py-3 text-sm text-left",
              "transition-colors",
              isDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
              isEmpty ? "text-white/40" : "text-white/90"
            ].join(" ")
          )}
        >
          <span className="inline-flex items-center gap-2">
            <CalendarIcon className="text-white/60" />
            <span className="tabular-nums">{label}</span>
          </span>
        </button>

        <input
          ref={inputRef}
          type="date"
          value={value}
          disabled={isDisabled}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {showClear ? (
        <AppButton
          intent="secondary"
          size="sm"
          className="h-11 px-4 whitespace-nowrap"
          onPress={() => onChange("")}
          isDisabled={isDisabled || isEmpty}
        >
          Clear
        </AppButton>
      ) : null}
    </div>
  );
}

