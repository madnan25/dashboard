"use client";

import { useEffect, useMemo, useState } from "react";
import { Surface } from "@/components/ds/Surface";
import { TargetActualBars } from "@/components/charts/TargetActualBars";
import { AppButton } from "@/components/ds/AppButton";
import { NumberInput } from "@/components/ds/NumberInput";
import { PillSelect } from "@/components/ds/PillSelect";
import { formatNumber } from "@/lib/format";
import type { ProjectActuals } from "@/lib/dashboardDb";
import type { OverallFunnelTargets } from "@/lib/reports/projectHubTargets";
import { createSalesAttributionEvent, deleteSalesAttributionEvent, listSalesAttributionEvents } from "@/lib/dashboardDb";
import type { SalesAttributionBucket, SalesAttributionEvent, SalesAttributionSourceKind } from "@/lib/db/types";

export function ProjectActualsPanel(props: {
  actuals: ProjectActuals | null;
  role: string | null;
  projectId: string;
  year: number;
  month: number;
  onRefresh?: () => Promise<void>;
  targets: OverallFunnelTargets;
  sqftTarget: number;
}) {
  const { actuals, targets, sqftTarget, role, projectId, year, month, onRefresh } = props;

  const canEdit = role === "sales_ops" || role === "cmo";

  const dealsPipeline = actuals?.deals_won ?? 0;
  const dealsTransfer = (actuals as unknown as { deals_won_transfer_in?: number })?.deals_won_transfer_in ?? 0;
  const dealsMisc = (actuals as unknown as { deals_won_misc?: number })?.deals_won_misc ?? 0;
  const dealsAll = dealsPipeline + dealsTransfer + dealsMisc;

  const sqftPipeline = actuals?.sqft_won ?? 0;
  const sqftTransfer = (actuals as unknown as { sqft_won_transfer_in?: number })?.sqft_won_transfer_in ?? 0;
  const sqftMisc = (actuals as unknown as { sqft_won_misc?: number })?.sqft_won_misc ?? 0;
  const sqftAll = sqftPipeline + sqftTransfer + sqftMisc;

  const [events, setEvents] = useState<SalesAttributionEvent[]>([]);
  const [status, setStatus] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const [bucket, setBucket] = useState<SalesAttributionBucket>("transfer");
  const [sourceKind, setSourceKind] = useState<SalesAttributionSourceKind>("campaign");
  const [sourceCampaign, setSourceCampaign] = useState<string>("");
  const [dealsWon, setDealsWon] = useState<string>("1");
  const [sqftWon, setSqftWon] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  async function refreshEvents() {
    try {
      const rows = await listSalesAttributionEvents(projectId, year, month);
      setEvents(rows);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load adjustments");
    }
  }

  useEffect(() => {
    refreshEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, year, month]);

  const breakdownCopy = useMemo(() => {
    const dealsParts = [
      `Pipeline ${formatNumber(dealsPipeline)}`,
      `Transfers ${formatNumber(dealsTransfer)}`,
      `Misc ${formatNumber(dealsMisc)}`
    ];
    const sqftParts = [
      `Pipeline ${formatNumber(sqftPipeline)}`,
      `Transfers ${formatNumber(sqftTransfer)}`,
      `Misc ${formatNumber(sqftMisc)}`
    ];
    return { deals: dealsParts.join(" • "), sqft: sqftParts.join(" • ") };
  }, [dealsMisc, dealsPipeline, dealsTransfer, sqftMisc, sqftPipeline, sqftTransfer]);

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
          <div>Deals: {breakdownCopy.deals}</div>
          <div>SQFT: {breakdownCopy.sqft}</div>
        </div>
      </div>

      <div className="mt-6 border-t border-white/10 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white/85">Attribution & misc adjustments</div>
            <div className="mt-1 text-xs text-white/45">
              Use this for cross-campaign closes and non-pipeline wins (outbound, old leads, corrections).
            </div>
          </div>
        </div>

        {status ? <div className="mt-3 text-sm text-amber-200/90">{status}</div> : null}

        {canEdit ? (
          <div className="mt-4 grid gap-3 md:grid-cols-12">
            <div className="md:col-span-3">
              <div className="text-xs text-white/55 mb-2">Type</div>
              <PillSelect value={bucket} onChange={(v) => setBucket(v as SalesAttributionBucket)} ariaLabel="Adjustment type">
                <option value="transfer">Transfer (from another campaign/project)</option>
                <option value="misc">Misc (outbound/old/correction)</option>
              </PillSelect>
            </div>
            <div className="md:col-span-3">
              <div className="text-xs text-white/55 mb-2">Source</div>
              <PillSelect value={sourceKind} onChange={(v) => setSourceKind(v as SalesAttributionSourceKind)} ariaLabel="Source kind">
                <option value="campaign">Campaign</option>
                <option value="project">Project</option>
                <option value="unknown">Unknown</option>
              </PillSelect>
            </div>
            <div className="md:col-span-6">
              <NumberInput
                label={sourceKind === "campaign" ? "Source campaign name" : "Source label (optional)"}
                value={sourceCampaign}
                onValueChange={setSourceCampaign}
                placeholder={sourceKind === "campaign" ? "e.g. V3 Full" : "Optional"}
              />
            </div>

            <NumberInput className="md:col-span-3" label="Deals won" value={dealsWon} onValueChange={setDealsWon} integerOnly />
            <NumberInput className="md:col-span-3" label="SQFT won" value={sqftWon} onValueChange={setSqftWon} integerOnly unit="sqft" />
            <div className="md:col-span-6">
              <NumberInput label="Notes (optional)" value={notes} onValueChange={setNotes} placeholder="Short context for the adjustment" />
            </div>

            <div className="md:col-span-12 flex items-center justify-end gap-2">
              <AppButton
                intent="primary"
                effect="wow"
                isDisabled={isSaving}
                onPress={async () => {
                  try {
                    setStatus("");
                    setIsSaving(true);
                    const deals = Number(dealsWon);
                    const sqft = sqftWon ? Number(sqftWon) : 0;
                    if (!Number.isFinite(deals) || deals < 0) throw new Error("Deals won must be a valid integer.");
                    if (!Number.isFinite(sqft) || sqft < 0) throw new Error("SQFT won must be a valid integer.");

                    await createSalesAttributionEvent({
                      closed_project_id: projectId,
                      close_year: year,
                      close_month: month,
                      deals_won: Math.trunc(deals),
                      sqft_won: Math.trunc(sqft),
                      source_kind: sourceKind,
                      source_campaign: sourceCampaign || null,
                      bucket,
                      notes: notes || null
                    });

                    setDealsWon("1");
                    setSqftWon("");
                    setNotes("");
                    await Promise.all([refreshEvents(), onRefresh?.()]);
                    setStatus("Saved.");
                  } catch (e) {
                    setStatus(e instanceof Error ? e.message : "Failed to save adjustment");
                  } finally {
                    setIsSaving(false);
                  }
                }}
              >
                Add adjustment
              </AppButton>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-white/45">Only Sales Ops (or CMO) can add adjustments.</div>
        )}

        <div className="mt-5 space-y-2">
          {events.length === 0 ? (
            <div className="text-sm text-white/45">No adjustments yet.</div>
          ) : (
            events.map((e) => (
              <div key={e.id} className="glass-inset flex items-start justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm text-white/85">
                    <span className="font-semibold">{e.bucket === "transfer" ? "Transfer" : "Misc"}</span>
                    <span className="text-white/45"> • </span>
                    <span className="text-white/70">{formatNumber(e.deals_won)} deals</span>
                    <span className="text-white/45"> • </span>
                    <span className="text-white/70">{formatNumber(e.sqft_won)} sqft</span>
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    {e.source_kind === "campaign" && e.source_campaign ? `Source: ${e.source_campaign}` : `Source: ${e.source_kind}`}
                    {e.notes ? ` • ${e.notes}` : ""}
                  </div>
                </div>
                {canEdit ? (
                  <AppButton
                    intent="ghost"
                    isDisabled={isSaving}
                    onPress={async () => {
                      try {
                        setStatus("");
                        setIsSaving(true);
                        await deleteSalesAttributionEvent(e.id);
                        await Promise.all([refreshEvents(), onRefresh?.()]);
                        setStatus("Deleted.");
                      } catch (err) {
                        setStatus(err instanceof Error ? err.message : "Failed to delete adjustment");
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                  >
                    Delete
                  </AppButton>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </Surface>
  );
}
