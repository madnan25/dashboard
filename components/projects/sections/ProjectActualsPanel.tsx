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

  const breakdownCards = useMemo(() => {
    return [
      {
        key: "pipeline",
        label: "Pipeline",
        hint: "From this month’s channel leads",
        dotClass: "bg-white/60",
        deals: dealsPipeline,
        sqft: sqftPipeline
      },
      {
        key: "transfers",
        label: "Transfers in",
        hint: "Closed here, originated elsewhere",
        dotClass: "bg-sky-300/80",
        deals: dealsTransferIn,
        sqft: sqftTransferIn
      },
      {
        key: "misc",
        label: "Misc",
        hint: "Older leads / outbound / other",
        dotClass: "bg-fuchsia-300/80",
        deals: dealsMisc,
        sqft: sqftMisc
      }
    ];
  }, [dealsMisc, dealsPipeline, dealsTransferIn, sqftMisc, sqftPipeline, sqftTransferIn]);

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

        <div className="mt-4">
          <div className="text-xs uppercase tracking-widest text-white/45">Close breakdown</div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {breakdownCards.map((c) => {
              const muted = (c.deals ?? 0) <= 0 && (c.sqft ?? 0) <= 0;
              return (
                <div
                  key={c.key}
                  className={[
                    "glass-inset rounded-2xl border border-white/10 bg-white/[0.02] p-4",
                    muted ? "opacity-70" : ""
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${c.dotClass}`} aria-hidden="true" />
                        <div className="text-sm font-semibold text-white/85">{c.label}</div>
                      </div>
                      <div className="mt-1 text-xs text-white/45">{c.hint}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-widest text-white/45">Deals</div>
                      <div className="mt-1 text-lg font-semibold text-white/90 tabular-nums">{formatNumber(c.deals)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-widest text-white/45">Sqft</div>
                      <div className="mt-1 text-lg font-semibold text-white/90 tabular-nums">{formatNumber(c.sqft)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {dealsTransferOut > 0 || sqftTransferOut > 0 ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 shadow-[0_0_28px_rgba(255,255,255,0.06)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white/85">Transfers out</div>
                  <div className="mt-1 text-xs text-white/45">Closed in another project, originated here.</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right">
                    <div className="text-[11px] uppercase tracking-widest text-white/45">Deals</div>
                    <div className="mt-1 text-base font-semibold text-white/90 tabular-nums">{formatNumber(dealsTransferOut)}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right">
                    <div className="text-[11px] uppercase tracking-widest text-white/45">Sqft</div>
                    <div className="mt-1 text-base font-semibold text-white/90 tabular-nums">{formatNumber(sqftTransferOut)}</div>
                  </div>
                </div>
              </div>

              {transferOutStatus ? <div className="mt-3 text-sm text-amber-200/90">{transferOutStatus}</div> : null}

              {transferOutByDest.length > 0 ? (
                <div className="mt-3 text-xs text-white/55">
                  Top destinations:{" "}
                  <span className="text-white/70">
                    {transferOutByDest
                      .map((r) => `${r.name} (${formatNumber(r.deals)} deals, ${formatNumber(r.sqft)} sqft)`)
                      .join(" • ")}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Surface>
  );
}
