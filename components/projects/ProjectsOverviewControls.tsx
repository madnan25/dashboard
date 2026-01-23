"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MonthYearPicker } from "@/components/ds/MonthYearPicker";
import { PillSelect } from "@/components/ds/PillSelect";

export type OverviewMode = "month" | "ytd";

export function ProjectsOverviewControls(props: { year: number; monthIndex: number; mode: OverviewMode }) {
  const { year, monthIndex, mode } = props;
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  // Keep UI snappy even when router.replace triggers a server refresh.
  const [local, setLocal] = useState<{ year: number; monthIndex: number; mode: OverviewMode }>({
    year,
    monthIndex,
    mode
  });

  useEffect(() => {
    setLocal({ year, monthIndex, mode });
  }, [year, monthIndex, mode]);

  function setQs(next: { year: number; monthIndex: number; mode: OverviewMode }) {
    setLocal(next);
    const qs = new URLSearchParams(sp ? sp.toString() : "");
    qs.set("year", String(next.year));
    qs.set("monthIndex", String(next.monthIndex));
    qs.set("mode", next.mode);
    const href = `${pathname}?${qs.toString()}`;
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PillSelect
        value={local.mode}
        onChange={(v) => setQs({ year: local.year, monthIndex: local.monthIndex, mode: v as OverviewMode })}
        ariaLabel="Overview mode"
      >
        <option value="month" className="bg-zinc-900">
          This month
        </option>
        <option value="ytd" className="bg-zinc-900">
          YTD
        </option>
      </PillSelect>

      <MonthYearPicker
        monthIndex={local.monthIndex}
        year={local.year}
        label=" "
        showJumpToCurrent
        onChange={(next) => setQs({ year: next.year, monthIndex: next.monthIndex, mode: local.mode })}
      />
    </div>
  );
}


