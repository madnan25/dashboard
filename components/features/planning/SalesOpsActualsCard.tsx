"use client";

import { useMemo, useState } from "react";
import { NumberInput } from "@/components/ds/NumberInput";
import { AppButton } from "@/components/ds/AppButton";
import { Surface } from "@/components/ds/Surface";
import type { PlanChannel, ProjectActuals } from "@/lib/dashboardDb";

export function SalesOpsActualsCard(props: {
  isCmo: boolean;
  actuals: ProjectActuals | null;
  metricsDirty: boolean;
  metricsSavedAt: number | null;
  salesOpsByChannel: Record<
    PlanChannel,
    {
      leads: string;
      qualified_leads: string;
      meetings_scheduled: string;
      meetings_done: string;
      deals_won: string;
      sqft_won: string;
    }
  >;
  setSalesOpsByChannel: (
    updater: (
      prev: Record<
        PlanChannel,
        {
          leads: string;
          qualified_leads: string;
          meetings_scheduled: string;
          meetings_done: string;
          deals_won: string;
          sqft_won: string;
        }
      >
    ) => Record<
      PlanChannel,
      {
        leads: string;
        qualified_leads: string;
        meetings_scheduled: string;
        meetings_done: string;
        deals_won: string;
        sqft_won: string;
      }
    >
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
  const { isCmo, actuals, metricsDirty, metricsSavedAt, salesOpsByChannel, setSalesOpsByChannel, actualsForm, setActualsForm, onSaveActuals } = props;

  const [saveFlash, setSaveFlash] = useState<"idle" | "saving" | "saved">("idle");
  const saveLabel = useMemo(() => {
    if (saveFlash === "saving") return "Saving…";
    if (saveFlash === "saved") return "Saved";
    return metricsDirty ? "Save actuals" : "Saved";
  }, [metricsDirty, saveFlash]);

  const canSave = metricsDirty && saveFlash !== "saving";

  const channels = useMemo<PlanChannel[]>(() => ["digital", "inbound", "activations"], []);
  const label = (ch: PlanChannel) => (ch === "digital" ? "Digital" : ch === "inbound" ? "Inbound" : "Activations");

  function toNumber(v: string) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  const totals = useMemo(() => {
    return channels.reduce(
      (acc, ch) => {
        acc.leads += toNumber(salesOpsByChannel[ch].leads);
        acc.qualified += toNumber(salesOpsByChannel[ch].qualified_leads);
        acc.meetingsScheduled += toNumber(salesOpsByChannel[ch].meetings_scheduled);
        acc.meetingsDone += toNumber(salesOpsByChannel[ch].meetings_done);
        acc.dealsWon += toNumber(salesOpsByChannel[ch].deals_won);
        acc.sqftWon += toNumber(salesOpsByChannel[ch].sqft_won);
        return acc;
      },
      { leads: 0, qualified: 0, meetingsScheduled: 0, meetingsDone: 0, dealsWon: 0, sqftWon: 0 }
    );
  }, [channels, salesOpsByChannel]);

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
                  onValueChange={(v) => setSalesOpsByChannel((s) => ({ ...s, [ch]: { ...s[ch], qualified_leads: v } }))}
                  integerOnly
                />
                <NumberInput
                  label="Meetings scheduled"
                  unit="meetings"
                  value={salesOpsByChannel[ch].meetings_scheduled}
                  onValueChange={(v) => setSalesOpsByChannel((s) => ({ ...s, [ch]: { ...s[ch], meetings_scheduled: v } }))}
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
