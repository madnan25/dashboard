"use client";

import * as React from "react";

export function FunnelBars({
  title,
  items
}: {
  title: string;
  items: { label: string; value: number; colorClassName: string }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="space-y-3">
        {items.map((i) => {
          const pct = Math.round((i.value / max) * 100);
          return (
            <div key={i.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-default-600">{i.label}</span>
                <span className="font-medium text-foreground">{i.value.toLocaleString()}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-default-100">
                <div
                  className={`h-2 rounded-full ${i.colorClassName}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


