"use client";

import { KpiCard } from "@/components/ds/KpiCard";
import { Surface } from "@/components/ds/Surface";
import { TargetActualBars } from "@/components/charts/TargetActualBars";
import { formatNumber } from "@/lib/format";
import type { ProjectActuals } from "@/lib/dashboardDb";
import type { OverallFunnelTargets } from "@/lib/reports/projectHubTargets";

export function ProjectActualsPanel(props: {
  actuals: ProjectActuals | null;
  role: string | null;
  targets: OverallFunnelTargets;
}) {
  const { actuals, targets } = props;

  return (
    <Surface className="md:col-span-5">
      <div className="text-lg font-semibold text-white/90">Actuals (Sales Ops)</div>
      <div className="mt-1 text-sm text-white/55">Month-level actual performance.</div>

      <div className="mt-4">
        <TargetActualBars
          items={[
            { stage: "Leads", target: targets.leads, actual: actuals?.leads ?? 0 },
            { stage: "Qualified", target: targets.qualified, actual: actuals?.qualified_leads ?? 0 },
            { stage: "Meetings scheduled", target: targets.meetings_scheduled, actual: actuals?.meetings_scheduled ?? 0 },
            { stage: "Meetings done", target: targets.meetings_done, actual: actuals?.meetings_done ?? 0 },
            { stage: "Deals concluded", target: targets.deals, actual: actuals?.deals_won ?? 0 }
          ]}
          formatNumber={formatNumber}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-1">
        <KpiCard label="Sqft won" value={formatNumber(actuals?.sqft_won ?? 0)} helper="Sales Ops actual" />
      </div>
    </Surface>
  );
}
