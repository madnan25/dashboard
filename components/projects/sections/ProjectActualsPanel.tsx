"use client";

import { useEffect, useMemo, useState } from "react";
import { Surface } from "@/components/ds/Surface";
import { TargetActualBars } from "@/components/charts/TargetActualBars";
import { formatNumber } from "@/lib/format";
import { listProjects, listTransferOutEvents } from "@/lib/dashboardDb";
import type { ProjectActuals } from "@/lib/dashboardDb";
import type { OverallFunnelTargets } from "@/lib/reports/projectHubTargets";
import type { SalesAttributionEvent } from "@/lib/db/types";

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

  const breakdownCopy = useMemo(() => {
    const dealsParts = [
      `Pipeline ${formatNumber(dealsPipeline)}`,
      `Transfers in ${formatNumber(dealsTransferIn)}`,
      `Misc ${formatNumber(dealsMisc)}`
    ];
    const sqftParts = [
      `Pipeline ${formatNumber(sqftPipeline)}`,
      `Transfers in ${formatNumber(sqftTransferIn)}`,
      `Misc ${formatNumber(sqftMisc)}`
    ];
    return {
      dealsIn: dealsParts.join(" • "),
      sqftIn: sqftParts.join(" • "),
      dealsOut: `Transferred out ${formatNumber(dealsTransferOut)} deals`,
      sqftOut: `Transferred out ${formatNumber(sqftTransferOut)} sqft`
    };
  }, [dealsMisc, dealsPipeline, dealsTransferIn, dealsTransferOut, sqftMisc, sqftPipeline, sqftTransferIn, sqftTransferOut]);

  const [transferOutByDest, setTransferOutByDest] = useState<Array<{ projectId: string; name: string; deals: number; sqft: number }>>([]);
  const [transferOutStatus, setTransferOutStatus] = useState<string>("");

  useEffect(() => {
    // Optional detail: where did transfers go?
    async function load() {
      try {
        setTransferOutStatus("");
        if (!actuals || dealsTransferOut <= 0 && sqftTransferOut <= 0) {
          setTransferOutByDest([]);
          return;
        }
        const [events, projects] = await Promise.all([
          listTransferOutEvents(actuals.project_id, actuals.year, actuals.month),
          listProjects()
        ]);
        const nameById = new Map(projects.map((p) => [p.id, p.name] as const));
        const byDest = new Map<string, { projectId: string; deals: number; sqft: number }>();
        for (const e of (events as SalesAttributionEvent[]) ?? []) {
          const cur = byDest.get(e.closed_project_id) ?? { projectId: e.closed_project_id, deals: 0, sqft: 0 };
          cur.deals += e.deals_won ?? 0;
          cur.sqft += e.sqft_won ?? 0;
          byDest.set(e.closed_project_id, cur);
        }
        const rows = [...byDest.values()]
          .sort((a, b) => b.sqft - a.sqft || b.deals - a.deals)
          .slice(0, 3)
          .map((r) => ({ ...r, name: nameById.get(r.projectId) ?? "—" }));
        setTransferOutByDest(rows);
      } catch (e) {
        setTransferOutStatus(e instanceof Error ? e.message : "Failed to load transfer-out details");
      }
    }
    load();
  }, [actuals, dealsTransferOut, sqftTransferOut]);

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
            { stage: "Sqft won", target: sqftTarget, actual: sqftAll }
          ]}
          formatNumber={formatNumber}
        />
        <div className="mt-3 space-y-1 text-xs text-white/45">
          <div>Deals (in): {breakdownCopy.dealsIn}</div>
          <div>SQFT (in): {breakdownCopy.sqftIn}</div>
          {dealsTransferOut > 0 || sqftTransferOut > 0 ? (
            <>
              <div>{breakdownCopy.dealsOut}</div>
              <div>{breakdownCopy.sqftOut}</div>
              {transferOutStatus ? <div className="text-amber-200/90">{transferOutStatus}</div> : null}
              {transferOutByDest.length > 0 ? (
                <div>
                  To:{" "}
                  {transferOutByDest
                    .map((r) => {
                      return `${r.name} (${formatNumber(r.deals)} deals, ${formatNumber(r.sqft)} sqft)`;
                    })
                    .join(" • ")}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </Surface>
  );
}
