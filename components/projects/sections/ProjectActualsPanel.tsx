"use client";

import { Surface } from "@/components/ds/Surface";
import { TargetActualBars } from "@/components/charts/TargetActualBars";
import { formatNumber } from "@/lib/format";
import type { ProjectActuals } from "@/lib/dashboardDb";
import type { OverallFunnelTargets } from "@/lib/reports/projectHubTargets";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

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
  const sqftMarketingAttributed = sqftPipeline + sqftTransferOut;

  function SqftRow(props: {
    label: string;
    helper?: string;
    target?: number;
    actual: number;
    barClassName: string;
    showDelta?: boolean;
  }) {
    const targetForScale = Math.max(1, props.target ?? (sqftTarget || 1));
    const pctRaw = (props.actual / targetForScale) * 100;
    const pctFill = clamp(pctRaw, 0, 100);

    const showDelta = props.showDelta ?? Boolean(props.target);
    const variance = showDelta && props.target != null ? props.actual - props.target : 0;
    const varianceSign = variance > 0 ? "+" : variance < 0 ? "−" : "±";
    const varianceAbs = Math.abs(variance);
    const isGood = variance >= 0;

    return (
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white/90">{props.label}</div>
            {props.helper ? <div className="mt-1 text-xs text-white/45">{props.helper}</div> : null}
          </div>
          <div className="flex shrink-0 items-center gap-4 text-xs text-white/60">
            {props.target != null ? (
              <span>
                Target <span className="text-white/85 font-medium">{formatNumber(props.target)}</span>
              </span>
            ) : null}
            <span>
              Actual <span className="text-white/85 font-medium">{formatNumber(props.actual)}</span>
            </span>
            {showDelta && props.target != null ? (
              <span className={isGood ? "text-emerald-300" : "text-rose-300"}>
                {varianceSign} {formatNumber(varianceAbs)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="relative h-2 w-full rounded-full bg-white/10">
          <div className={`h-2 rounded-full ${props.barClassName}`} style={{ width: `${pctFill}%` }} aria-hidden="true" />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40">{clamp(pctRaw, 0, 999).toFixed(0)}% of target</span>
          {props.target != null && pctRaw > 100 ? (
            <span className="text-emerald-300/90">+{Math.max(0, pctRaw - 100).toFixed(0)}% over</span>
          ) : null}
        </div>
      </div>
    );
  }

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
            { stage: "Deals concluded", target: targets.deals, actual: dealsAll }
          ]}
          formatNumber={formatNumber}
        />
      </div>

      <div className="mt-6 border-t border-white/10 pt-5">
        <div className="text-sm font-semibold text-white/85">Sqft impact</div>
        <div className="mt-1 text-xs text-white/45">Marketing performance vs plan, plus total sold for context.</div>

        <div className="mt-4 space-y-5">
          <SqftRow
            label="Marketing-attributed sqft"
            helper="Sqft won from this project’s channel leads + transfer-out (campaign leads that closed elsewhere)."
            target={sqftTarget}
            actual={sqftMarketingAttributed}
            barClassName="bg-sky-400"
          />
          <SqftRow
            label="Total product sqft sold (context)"
            helper="Includes transfers in + misc closes; not a marketing-controlled metric."
            actual={sqftAll}
            barClassName="bg-white/35"
            showDelta={false}
          />
        </div>
      </div>
    </Surface>
  );
}
