"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Surface } from "@/components/ds/Surface";
import { PillSelect } from "@/components/ds/PillSelect";
import { formatNumber } from "@/lib/format";

export type EfficiencyRow = {
  id: string;
  name: string;
  spend: number;
  sqft: number;
  qualifiedLeads: number;
  costPerSqft: number; // spend / sqft
  costPerQualifiedLead: number; // spend / qualifiedLeads
};

type Metric = "cost_sqft" | "cost_ql";

function format2(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

export function TopEfficiencyPanel(props: { rows: EfficiencyRow[]; qs: string }) {
  const { rows, qs } = props;
  const [metric, setMetric] = useState<Metric>("cost_sqft");

  const ranked = useMemo(() => {
    const cleaned = rows
      .map((r) => ({
        ...r,
        spend: r.spend ?? 0,
        sqft: r.sqft ?? 0,
        qualifiedLeads: r.qualifiedLeads ?? 0
      }))
      // Hide “free wins” (0 spend) from rankings; they dominate and aren't useful for efficiency review.
      .filter((r) => r.spend > 0);

    const usable =
      metric === "cost_ql" ? cleaned.filter((r) => r.qualifiedLeads > 0 && Number.isFinite(r.costPerQualifiedLead)) : cleaned.filter((r) => r.sqft > 0 && Number.isFinite(r.costPerSqft));

    const sorted =
      metric === "cost_ql"
        ? [...usable].sort((a, b) => a.costPerQualifiedLead - b.costPerQualifiedLead)
        : [...usable].sort((a, b) => a.costPerSqft - b.costPerSqft);

    return sorted.slice(0, 5);
  }, [metric, rows]);

  const subtitle =
    metric === "cost_ql" ? "Lowest cost per qualified lead (includes volume)." : "Lowest cost per sqft (includes volume).";

  return (
    <Surface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white/90">Top 5: Efficiency</div>
          <div className="mt-1 text-xs text-white/55">{subtitle}</div>
        </div>
        <div className="min-w-[220px]">
          <PillSelect value={metric} onChange={(v) => setMetric(v as Metric)} ariaLabel="Efficiency metric">
            <option value="cost_sqft" className="bg-zinc-900">
              Cost per sqft
            </option>
            <option value="cost_ql" className="bg-zinc-900">
              Cost per qualified lead
            </option>
          </PillSelect>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {ranked.length === 0 ? (
          <div className="text-sm text-white/50">No comparable data yet.</div>
        ) : (
          ranked.map((x, i) => {
            const primary =
              metric === "cost_ql" ? format2(x.costPerQualifiedLead) : format2(x.costPerSqft);
            const secondary =
              metric === "cost_ql" ? `Cost/Sqft ${format2(x.costPerSqft)}` : `Cost/QL ${x.qualifiedLeads > 0 ? format2(x.costPerQualifiedLead) : "—"}`;

            return (
              <div key={x.id} className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm text-white/85">
                    {i + 1}.{" "}
                    <Link className="underline text-white/80" href={`/projects/${x.id}${qs}`}>
                      {x.name}
                    </Link>
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    Spend {formatNumber(x.spend)} · Sqft {formatNumber(x.sqft)} · QL {formatNumber(x.qualifiedLeads)}
                  </div>
                  <div className="mt-1 text-xs text-white/45">{secondary}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-white/90 tabular-nums">{primary}</div>
                  <div className="text-xs text-white/45">{metric === "cost_ql" ? "per QL" : "per sqft"}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Surface>
  );
}


