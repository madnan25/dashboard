"use client";

import { useEffect, useMemo, useState } from "react";
import { Surface } from "@/components/ds/Surface";
import { formatNumber } from "@/lib/format";
import { listProjects, listTransferOutEvents } from "@/lib/dashboardDb";
import type { ProjectActuals } from "@/lib/dashboardDb";
import type { SalesAttributionEvent } from "@/lib/db/types";

export function ProjectCloseBreakdownPanel(props: { actuals: ProjectActuals | null }) {
  const { actuals } = props;

  const dealsPipeline = actuals?.deals_won ?? 0;
  const dealsTransferIn = (actuals as unknown as { deals_won_transfer_in?: number })?.deals_won_transfer_in ?? 0;
  const dealsTransferOut = (actuals as unknown as { deals_won_transfer_out?: number })?.deals_won_transfer_out ?? 0;
  const dealsMisc = (actuals as unknown as { deals_won_misc?: number })?.deals_won_misc ?? 0;

  const sqftPipeline = actuals?.sqft_won ?? 0;
  const sqftTransferIn = (actuals as unknown as { sqft_won_transfer_in?: number })?.sqft_won_transfer_in ?? 0;
  const sqftTransferOut = (actuals as unknown as { sqft_won_transfer_out?: number })?.sqft_won_transfer_out ?? 0;
  const sqftMisc = (actuals as unknown as { sqft_won_misc?: number })?.sqft_won_misc ?? 0;

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
        if (!actuals || (dealsTransferOut <= 0 && sqftTransferOut <= 0)) {
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
    <Surface className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[720px] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(56,189,248,0.14), rgba(217,70,239,0.10), rgba(255,255,255,0.0) 70%)"
        }}
      />

      <div className="relative flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-white/95">Deals won breakdown</div>
          <div className="mt-1 text-sm text-white/55">Where the deals came from this month (pipeline vs transfers vs misc).</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {breakdownCards.map((c) => {
          const muted = (c.deals ?? 0) <= 0 && (c.sqft ?? 0) <= 0;
          return (
            <div
              key={c.key}
              className={[
                "relative glass-inset rounded-2xl border border-white/10 bg-white/[0.02] p-4",
                muted ? "opacity-70" : ""
              ].join(" ")}
            >
              <div
                className="pointer-events-none absolute inset-x-6 -top-10 h-20 rounded-full blur-2xl"
                style={{
                  background:
                    c.key === "pipeline"
                      ? "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.10), rgba(255,255,255,0.0) 70%)"
                      : c.key === "transfers"
                        ? "radial-gradient(circle at 50% 50%, rgba(56,189,248,0.18), rgba(56,189,248,0.0) 70%)"
                        : "radial-gradient(circle at 50% 50%, rgba(217,70,239,0.16), rgba(217,70,239,0.0) 70%)"
                }}
              />

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
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 shadow-[0_0_36px_rgba(56,189,248,0.10)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white/85">Transfers out</div>
              <div className="mt-1 text-xs text-white/45">Deals won elsewhere that originated from this project.</div>
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
    </Surface>
  );
}


