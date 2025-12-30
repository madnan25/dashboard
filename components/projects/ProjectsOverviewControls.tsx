"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MonthYearPicker } from "@/components/ds/MonthYearPicker";
import { PillSelect } from "@/components/ds/PillSelect";

export type OverviewMode = "month" | "ytd";

export function ProjectsOverviewControls(props: { year: number; monthIndex: number; mode: OverviewMode }) {
  const { year, monthIndex, mode } = props;
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setQs(next: { year: number; monthIndex: number; mode: OverviewMode }) {
    const qs = new URLSearchParams(sp ? sp.toString() : "");
    qs.set("year", String(next.year));
    qs.set("monthIndex", String(next.monthIndex));
    qs.set("mode", next.mode);
    router.replace(`${pathname}?${qs.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PillSelect value={mode} onChange={(v) => setQs({ year, monthIndex, mode: v as OverviewMode })} ariaLabel="Overview mode">
        <option value="month" className="bg-zinc-900">
          This month
        </option>
        <option value="ytd" className="bg-zinc-900">
          YTD
        </option>
      </PillSelect>

      <MonthYearPicker
        monthIndex={monthIndex}
        year={year}
        label=" "
        showJumpToCurrent
        onChange={(next) => setQs({ year: next.year, monthIndex: next.monthIndex, mode })}
      />
    </div>
  );
}


