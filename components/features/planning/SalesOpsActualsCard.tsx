"use client";

import { useMemo, useState } from "react";
import { NumberInput } from "@/components/ds/NumberInput";
import { AppButton } from "@/components/ds/AppButton";
import { Surface } from "@/components/ds/Surface";
import type { PlanChannel, ProjectActuals } from "@/lib/dashboardDb";

type FormRow = {
  leads: string;
  qualified_leads: string;
  meetings_scheduled: string;
  meetings_done: string;
  deals_won: string;
  sqft_won: string;
};

type DigitalSourceRow = FormRow & { not_contacted: string };

export function SalesOpsActualsCard(props: {
  isCmo: boolean;
  actuals: ProjectActuals | null;
  metricsDirty: boolean;
  metricsSavedAt: number | null;
  salesOpsByChannel: Record<
    PlanChannel,
    FormRow
  >;
  digitalSources: Record<"meta" | "web", DigitalSourceRow>;
  setDigitalSources: (updater: (prev: Record<"meta" | "web", DigitalSourceRow>) => Record<"meta" | "web", DigitalSourceRow>) => void;
  setSalesOpsByChannel: (
    updater: (
      prev: Record<
        PlanChannel,
        FormRow
      >
    ) => Record<PlanChannel, FormRow>
  ) => void;
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
    </Surface>
  );
}
