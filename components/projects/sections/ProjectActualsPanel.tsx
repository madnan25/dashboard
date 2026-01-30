"use client";

import { Surface } from "@/components/ds/Surface";
import { TargetActualBars } from "@/components/charts/TargetActualBars";
import { formatNumber } from "@/lib/format";
import type { ProjectActuals } from "@/lib/dashboardDb";
import type { OverallFunnelTargets } from "@/lib/reports/projectHubTargets";

export function ProjectActualsPanel(props: {
  actuals: ProjectActuals | null;
  targets: OverallFunnelTargets;
  sqftTarget: number;
}) {
  const { actuals, targets, sqftTarget } = props;

  const dealsPipeline = actuals?.deals_won ?? 0;
  const dealsTransferIn = (actuals as unknown as { deals_won_transfer_in?: number })?.deals_won_transfer_in ?? 0;
  const dealsTransferOut = (actuals as unknown as { deals_won_transfer_out?: number })?.deals_won_transfer_out ?? 0;
  const dealsMisc = (actuals as unknown as { deals_won_misc?: number })?.deals_won_misc ?? 0;
  const dealsAll = dealsPipeline + dealsTransferIn + dealsMisc;

  const sqftPipeline = actuals?.sqft_won ?? 0;
  const sqftTransferIn = (actuals as unknown as { sqft_won_transfer_in?: number })?.sqft_won_transfer_in ?? 0;
  const sqftTransferOut = (actuals as unknown as { sqft_won_transfer_out?: number })?.sqft_won_transfer_out ?? 0;
  const sqftMisc = (actuals as unknown as { sqft_won_misc?: number })?.sqft_won_misc ?? 0;
  const sqftAll = sqftPipeline + sqftTransferIn + sqftMisc;

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
            { stage: "Deals concluded", target: targets.deals, actual: dealsAll },
            {
              stage: "Sqft won",
              target: sqftTarget,
              actual: sqftAll,
              actualSecondary: sqftTransferOut,
              actualSecondaryLabel: "transfer out"
            }
          ]}
          formatNumber={formatNumber}
        />
      </div>
    </Surface>
  );
}
