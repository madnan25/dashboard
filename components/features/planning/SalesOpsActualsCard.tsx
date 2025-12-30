"use client";

import { useEffect, useMemo, useState } from "react";
import { NumberInput } from "@/components/ds/NumberInput";
import { AppButton } from "@/components/ds/AppButton";
import { Surface } from "@/components/ds/Surface";
import { AppInput } from "@/components/ds/AppInput";
import { PillSelect } from "@/components/ds/PillSelect";
import { createSalesAttributionEvent, deleteSalesAttributionEvent, listSalesAttributionEvents } from "@/lib/dashboardDb";
import type { PlanChannel, Project, ProjectActuals } from "@/lib/dashboardDb";
import type { SalesAttributionEvent } from "@/lib/db/types";

type FormRow = {
  leads: string;
  qualified_leads: string;
  meetings_scheduled: string;
  meetings_done: string;
  deals_won: string;
  sqft_won: string;
};

type DigitalSourceRow = FormRow & { not_contacted: string };
type ChannelRow = FormRow & { not_contacted?: string };

export function SalesOpsActualsCard(props: {
  isCmo: boolean;
  actuals: ProjectActuals | null;
  metricsDirty: boolean;
  metricsSavedAt: number | null;
  projects: Project[];
  projectId: string;
  year: number;
  month: number; // 1-12
  refresh: () => Promise<void>;
  salesOpsByChannel: Record<PlanChannel, ChannelRow>;
  digitalSources: Record<"meta" | "web", DigitalSourceRow>;
  setDigitalSources: (updater: (prev: Record<"meta" | "web", DigitalSourceRow>) => Record<"meta" | "web", DigitalSourceRow>) => void;
  setSalesOpsByChannel: (updater: (prev: Record<PlanChannel, ChannelRow>) => Record<PlanChannel, ChannelRow>) => void;
  actualsForm: {
    leads: string;
    qualified_leads: string;
    meetings_scheduled: string;
    meetings_done: string;
    deals_won: string;
    sqft_won: string;
    spend_digital: string;
    spend_inbound: string;
    spend_activations: string;
  };
  setActualsForm: (updater: (prev: {
    leads: string;
    qualified_leads: string;
    meetings_scheduled: string;
    meetings_done: string;
    deals_won: string;
    sqft_won: string;
    spend_digital: string;
    spend_inbound: string;
    spend_activations: string;
  }) => {
    leads: string;
    qualified_leads: string;
    meetings_scheduled: string;
    meetings_done: string;
    deals_won: string;
    sqft_won: string;
    spend_digital: string;
    spend_inbound: string;
    spend_activations: string;
  }) => void;
  onSaveActuals: () => Promise<void> | void;
}) {
  const {
    isCmo,
    actuals,
    metricsDirty,
    metricsSavedAt,
    projects,
    projectId,
    year,
    month,
    refresh,
    salesOpsByChannel,
    digitalSources,
    setDigitalSources,
    setSalesOpsByChannel,
    actualsForm,
    setActualsForm,
    onSaveActuals
  } = props;

  const [saveFlash, setSaveFlash] = useState<"idle" | "saving" | "saved">("idle");
  const saveLabel = useMemo(() => {
    if (saveFlash === "saving") return "Saving…";
    if (saveFlash === "saved") return "Saved";
    return metricsDirty ? "Save actuals" : "Saved";
  }, [metricsDirty, saveFlash]);

  const canSave = metricsDirty && saveFlash !== "saving";

  const channels = useMemo<PlanChannel[]>(() => ["digital", "inbound", "activations"], []);
  const label = (ch: PlanChannel) => (ch === "digital" ? "Digital" : ch === "inbound" ? "Inbound" : "Activations");
  const sourceLabel = (s: "meta" | "web") => (s === "meta" ? "Meta" : "Website / WhatsApp / Google");

  function toNumber(v: string) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  const digitalTotals = useMemo(() => {
    const sum = (k: keyof DigitalSourceRow) => toNumber(digitalSources.meta[k]) + toNumber(digitalSources.web[k]);
    return {
      leads: sum("leads"),
      notContacted: sum("not_contacted"),
      qualified: sum("qualified_leads"),
      meetingsScheduled: sum("meetings_scheduled"),
      meetingsDone: sum("meetings_done"),
      dealsWon: sum("deals_won"),
      sqftWon: sum("sqft_won")
    };
  }, [digitalSources]);

  const totals = useMemo(() => {
    const inbound = salesOpsByChannel.inbound;
    const activations = salesOpsByChannel.activations;
    return {
      leads: digitalTotals.leads + toNumber(inbound.leads) + toNumber(activations.leads),
      qualified: digitalTotals.qualified + toNumber(inbound.qualified_leads) + toNumber(activations.qualified_leads),
      meetingsScheduled:
        digitalTotals.meetingsScheduled + toNumber(inbound.meetings_scheduled) + toNumber(activations.meetings_scheduled),
      meetingsDone: digitalTotals.meetingsDone + toNumber(inbound.meetings_done) + toNumber(activations.meetings_done),
      dealsWon: digitalTotals.dealsWon + toNumber(inbound.deals_won) + toNumber(activations.deals_won),
      sqftWon: digitalTotals.sqftWon + toNumber(inbound.sqft_won) + toNumber(activations.sqft_won)
    };
  }, [digitalTotals, salesOpsByChannel.activations, salesOpsByChannel.inbound]);

  // ---- Adjustments (non-pipeline closes): Misc + Transfers
  const canAdjust = Boolean(projectId);
  const [adjustments, setAdjustments] = useState<SalesAttributionEvent[]>([]);
  const [adjStatus, setAdjStatus] = useState<string>("");
  const [adjSaving, setAdjSaving] = useState(false);

  const [miscDeals, setMiscDeals] = useState("0");
  const [miscSqft, setMiscSqft] = useState("0");
  const [miscNotes, setMiscNotes] = useState("");

  const [transferSourceProjectId, setTransferSourceProjectId] = useState("");
  const [transferDeals, setTransferDeals] = useState("1");
  const [transferSqft, setTransferSqft] = useState("0");

  async function refreshAdjustments() {
    if (!canAdjust) return;
    const rows = await listSalesAttributionEvents(projectId, year, month);
    setAdjustments(rows);
  }

  useEffect(() => {
    setAdjStatus("");
    setTransferSourceProjectId("");
    refreshAdjustments().catch((e) => setAdjStatus(e instanceof Error ? e.message : "Failed to load adjustments"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, year, month]);

  const miscList = useMemo(() => adjustments.filter((e) => e.bucket === "misc"), [adjustments]);
  const transferInList = useMemo(() => adjustments.filter((e) => e.bucket === "transfer"), [adjustments]);

  return (
    <Surface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-white/90">{isCmo ? "Sales Ops – Actuals (CMO override)" : "Sales Ops – Actuals"}</div>
          <div className="mt-1 text-sm text-white/55">{isCmo ? "CMO can edit actuals if needed." : "These are locked from Brand edits."}</div>
          <div className="mt-2 text-xs text-white/45">
            {metricsSavedAt ? (
              <>
                Last saved: {new Date(metricsSavedAt).toLocaleTimeString()}
                {metricsDirty ? <span className="ml-2 text-amber-200/80">Unsaved changes</span> : null}
              </>
            ) : metricsDirty ? (
              <span className="text-amber-200/80">Unsaved changes</span>
            ) : (
              <span> </span>
            )}
          </div>
        </div>
        <AppButton
          intent="primary"
          className="h-11 px-6"
          isDisabled={!canSave}
          onPress={async () => {
            setSaveFlash("saving");
            try {
              await onSaveActuals();
              setSaveFlash("saved");
              window.setTimeout(() => setSaveFlash("idle"), 900);
            } catch {
              setSaveFlash("idle");
            }
          }}
        >
          {saveLabel}
        </AppButton>
      </div>

      <div className="mt-4">
        <div className="text-xs uppercase tracking-widest text-white/45">Actuals by channel</div>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {channels.map((ch) => (
            <div key={ch} className="glass-inset rounded-2xl p-4">
              <div className="text-sm font-semibold text-white/85">{label(ch)}</div>
              <div className="mt-3 grid gap-3">
                {ch === "digital" ? (
                  <>
                    {(["meta", "web"] as const).map((src) => (
                      <div key={src} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <div className="text-xs font-semibold text-white/70">{sourceLabel(src)}</div>
                        <div className="mt-3 grid gap-3">
                          <NumberInput
                            label="Leads"
                            unit="leads"
                            value={digitalSources[src].leads}
                            onValueChange={(v) => setDigitalSources((s) => ({ ...s, [src]: { ...s[src], leads: v } }))}
                            integerOnly
                          />
                          <NumberInput
                            label="Not contacted"
                            unit="leads"
                            value={digitalSources[src].not_contacted}
                            onValueChange={(v) =>
                              setDigitalSources((s) => ({ ...s, [src]: { ...s[src], not_contacted: v } }))
                            }
                            integerOnly
                          />
                          <NumberInput
                            label="Qualified"
                            unit="leads"
                            value={digitalSources[src].qualified_leads}
                            onValueChange={(v) => setDigitalSources((s) => ({ ...s, [src]: { ...s[src], qualified_leads: v } }))}
                            integerOnly
                          />
                          <NumberInput
                            label="Meetings scheduled"
                            unit="meetings"
                            value={digitalSources[src].meetings_scheduled}
                            onValueChange={(v) =>
                              setDigitalSources((s) => ({ ...s, [src]: { ...s[src], meetings_scheduled: v } }))
                            }
                            integerOnly
                          />
                          <NumberInput
                            label="Meetings done"
                            unit="meetings"
                            value={digitalSources[src].meetings_done}
                            onValueChange={(v) => setDigitalSources((s) => ({ ...s, [src]: { ...s[src], meetings_done: v } }))}
                            integerOnly
                          />
                          <NumberInput
                            label="Deals won"
                            unit="deals"
                            value={digitalSources[src].deals_won}
                            onValueChange={(v) => setDigitalSources((s) => ({ ...s, [src]: { ...s[src], deals_won: v } }))}
                            integerOnly
                          />
                          <NumberInput
                            label="Sqft won"
                            unit="sqft"
                            value={digitalSources[src].sqft_won}
                            onValueChange={(v) => setDigitalSources((s) => ({ ...s, [src]: { ...s[src], sqft_won: v } }))}
                            integerOnly
                          />
                        </div>
                      </div>
                    ))}
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="text-xs font-semibold text-white/60">Digital totals (computed)</div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-white/70">
                        <div className="flex items-center justify-between">
                          <span>Leads</span>
                          <span className="font-semibold text-white/85">{digitalTotals.leads}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Not contacted</span>
                          <span className="font-semibold text-white/85">{digitalTotals.notContacted}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Qualified</span>
                          <span className="font-semibold text-white/85">{digitalTotals.qualified}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Meetings done</span>
                          <span className="font-semibold text-white/85">{digitalTotals.meetingsDone}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Deals won</span>
                          <span className="font-semibold text-white/85">{digitalTotals.dealsWon}</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <NumberInput
                      label="Leads"
                      unit="leads"
                      value={salesOpsByChannel[ch].leads}
                      onValueChange={(v) => setSalesOpsByChannel((s) => ({ ...s, [ch]: { ...s[ch], leads: v } }))}
                      integerOnly
                    />
                    <NumberInput
                      label="Not contacted"
                      unit="leads"
                      value={salesOpsByChannel[ch].not_contacted ?? "0"}
                      onValueChange={(v) =>
                        setSalesOpsByChannel((s) => ({ ...s, [ch]: { ...s[ch], not_contacted: v } }))
                      }
                      integerOnly
                    />
                    <NumberInput
                      label="Qualified"
                      unit="leads"
                      value={salesOpsByChannel[ch].qualified_leads}
                      onValueChange={(v) =>
                        setSalesOpsByChannel((s) => ({ ...s, [ch]: { ...s[ch], qualified_leads: v } }))
                      }
                      integerOnly
                    />
                    <NumberInput
                      label="Meetings scheduled"
                      unit="meetings"
                      value={salesOpsByChannel[ch].meetings_scheduled}
                      onValueChange={(v) =>
                        setSalesOpsByChannel((s) => ({ ...s, [ch]: { ...s[ch], meetings_scheduled: v } }))
                      }
                      integerOnly
                    />
                    <NumberInput
                      label="Meetings done"
                      unit="meetings"
                      value={salesOpsByChannel[ch].meetings_done}
                      onValueChange={(v) => setSalesOpsByChannel((s) => ({ ...s, [ch]: { ...s[ch], meetings_done: v } }))}
                      integerOnly
                    />
                    <NumberInput
                      label="Deals won"
                      unit="deals"
                      value={salesOpsByChannel[ch].deals_won}
                      onValueChange={(v) => setSalesOpsByChannel((s) => ({ ...s, [ch]: { ...s[ch], deals_won: v } }))}
                      integerOnly
                    />
                    <NumberInput
                      label="Sqft won"
                      unit="sqft"
                      value={salesOpsByChannel[ch].sqft_won}
                      onValueChange={(v) => setSalesOpsByChannel((s) => ({ ...s, [ch]: { ...s[ch], sqft_won: v } }))}
                      integerOnly
                    />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <NumberInput label="Total leads (computed)" unit="leads" value={String(totals.leads)} onValueChange={() => {}} isDisabled />
          <NumberInput label="Total qualified (computed)" unit="leads" value={String(totals.qualified)} onValueChange={() => {}} isDisabled />
          <NumberInput label="Total meetings scheduled (computed)" unit="meetings" value={String(totals.meetingsScheduled)} onValueChange={() => {}} isDisabled />
          <NumberInput label="Total meetings done (computed)" unit="meetings" value={String(totals.meetingsDone)} onValueChange={() => {}} isDisabled />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <NumberInput label="Total deals won (computed)" unit="deals" value={String(totals.dealsWon)} onValueChange={() => {}} isDisabled />
        <NumberInput label="Total sqft won (computed)" unit="sqft" value={String(totals.sqftWon)} onValueChange={() => {}} isDisabled />
      </div>

      {actuals ? (
        <div className="mt-3 text-xs text-white/45">Last loaded values are from Supabase.</div>
      ) : (
        <div className="mt-3 text-xs text-white/45">No actuals saved yet for this month.</div>
      )}

      <div className="mt-6 border-t border-white/10 pt-5">
        <div className="text-sm font-semibold text-white/85">Non-pipeline closes</div>
        <div className="mt-1 text-xs text-white/45">
          Use these when a close happened for this project but it wasn’t created by this month’s channel leads.
        </div>

        {adjStatus ? <div className="mt-3 text-sm text-amber-200/90">{adjStatus}</div> : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="glass-inset rounded-2xl p-4">
            <div className="text-sm font-semibold text-white/85">Misc deals won</div>
            <div className="mt-1 text-xs text-white/45">Older leads, outbound, or other sources.</div>
            <div className="mt-4 grid gap-3">
              <NumberInput label="Deals won" unit="deals" value={miscDeals} onValueChange={setMiscDeals} integerOnly />
              <NumberInput label="SQFT won" unit="sqft" value={miscSqft} onValueChange={setMiscSqft} integerOnly />
              <AppInput
                label="Notes"
                placeholder="Optional context"
                value={miscNotes}
                onValueChange={setMiscNotes}
              />
              <div className="flex items-center justify-end">
                <AppButton
                  intent="primary"
                  effect="wow"
                  isDisabled={!canAdjust || adjSaving}
                  onPress={async () => {
                    try {
                      setAdjStatus("");
                      setAdjSaving(true);
                      const deals = Math.trunc(Number(miscDeals || "0"));
                      const sqft = Math.trunc(Number(miscSqft || "0"));
                      if (!Number.isFinite(deals) || deals < 0) throw new Error("Misc deals won must be a valid integer.");
                      if (!Number.isFinite(sqft) || sqft < 0) throw new Error("Misc SQFT won must be a valid integer.");
                      if (deals === 0 && sqft === 0) throw new Error("Enter at least deals or sqft for misc.");

                      await createSalesAttributionEvent({
                        closed_project_id: projectId,
                        close_year: year,
                        close_month: month,
                        deals_won: deals,
                        sqft_won: sqft,
                        bucket: "misc",
                        source_kind: "unknown",
                        notes: miscNotes || null
                      });
                      setMiscDeals("0");
                      setMiscSqft("0");
                      setMiscNotes("");
                      await Promise.all([refreshAdjustments(), refresh()]);
                      setAdjStatus("Saved.");
                    } catch (e) {
                      setAdjStatus(e instanceof Error ? e.message : "Failed to save misc");
                    } finally {
                      setAdjSaving(false);
                    }
                  }}
                >
                  Add misc
                </AppButton>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {miscList.length === 0 ? (
                <div className="text-sm text-white/45">No misc entries yet.</div>
              ) : (
                miscList.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                    <div className="min-w-0 text-xs text-white/70">
                      {e.deals_won} deals • {e.sqft_won} sqft{e.notes ? ` • ${e.notes}` : ""}
                    </div>
                    <AppButton
                      intent="ghost"
                      isDisabled={adjSaving}
                      onPress={async () => {
                        try {
                          setAdjStatus("");
                          setAdjSaving(true);
                          await deleteSalesAttributionEvent(e.id);
                          await Promise.all([refreshAdjustments(), refresh()]);
                          setAdjStatus("Deleted.");
                        } catch (err) {
                          setAdjStatus(err instanceof Error ? err.message : "Failed to delete misc");
                        } finally {
                          setAdjSaving(false);
                        }
                      }}
                    >
                      Delete
                    </AppButton>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="glass-inset rounded-2xl p-4">
            <div className="text-sm font-semibold text-white/85">Transfers (from another project)</div>
            <div className="mt-1 text-xs text-white/45">A lead from Project A closed as a deal for this project.</div>

            <div className="mt-4 grid gap-3">
              <div>
                <div className="mb-2 text-xs text-white/55">Source project (required)</div>
                <PillSelect
                  value={transferSourceProjectId}
                  onChange={setTransferSourceProjectId}
                  ariaLabel="Source project"
                  disabled={!canAdjust}
                >
                  <option value="">Select a source project…</option>
                  {projects
                    .filter((p) => p.is_active && p.id !== projectId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </PillSelect>
              </div>
              <NumberInput label="Deals won" unit="deals" value={transferDeals} onValueChange={setTransferDeals} integerOnly />
              <NumberInput label="SQFT won" unit="sqft" value={transferSqft} onValueChange={setTransferSqft} integerOnly />
              <div className="flex items-center justify-end">
                <AppButton
                  intent="primary"
                  effect="wow"
                  isDisabled={!canAdjust || adjSaving}
                  onPress={async () => {
                    try {
                      setAdjStatus("");
                      setAdjSaving(true);
                      if (!transferSourceProjectId) throw new Error("Source project is required for transfers.");
                      const deals = Math.trunc(Number(transferDeals || "0"));
                      const sqft = Math.trunc(Number(transferSqft || "0"));
                      if (!Number.isFinite(deals) || deals <= 0) throw new Error("Transfer deals won must be a positive integer.");
                      if (!Number.isFinite(sqft) || sqft < 0) throw new Error("Transfer SQFT won must be a valid integer.");

                      await createSalesAttributionEvent({
                        closed_project_id: projectId,
                        close_year: year,
                        close_month: month,
                        deals_won: deals,
                        sqft_won: sqft,
                        bucket: "transfer",
                        source_kind: "project",
                        source_project_id: transferSourceProjectId
                      });

                      setTransferDeals("1");
                      setTransferSqft("0");
                      setTransferSourceProjectId("");
                      await Promise.all([refreshAdjustments(), refresh()]);
                      setAdjStatus("Saved.");
                    } catch (e) {
                      setAdjStatus(e instanceof Error ? e.message : "Failed to save transfer");
                    } finally {
                      setAdjSaving(false);
                    }
                  }}
                >
                  Add transfer
                </AppButton>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {transferInList.length === 0 ? (
                <div className="text-sm text-white/45">No transfers yet.</div>
              ) : (
                transferInList.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                    <div className="min-w-0 text-xs text-white/70">
                      {e.deals_won} deals • {e.sqft_won} sqft
                      {e.source_project_id ? ` • from ${projects.find((p) => p.id === e.source_project_id)?.name ?? "—"}` : ""}
                    </div>
                    <AppButton
                      intent="ghost"
                      isDisabled={adjSaving}
                      onPress={async () => {
                        try {
                          setAdjStatus("");
                          setAdjSaving(true);
                          await deleteSalesAttributionEvent(e.id);
                          await Promise.all([refreshAdjustments(), refresh()]);
                          setAdjStatus("Deleted.");
                        } catch (err) {
                          setAdjStatus(err instanceof Error ? err.message : "Failed to delete transfer");
                        } finally {
                          setAdjSaving(false);
                        }
                      }}
                    >
                      Delete
                    </AppButton>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Surface>
  );
}
