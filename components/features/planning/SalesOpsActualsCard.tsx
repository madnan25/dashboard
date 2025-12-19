"use client";

import { useMemo, useState } from "react";
import { NumberInput } from "@/components/ds/NumberInput";
import { AppButton } from "@/components/ds/AppButton";
import { Surface } from "@/components/ds/Surface";
import type { ProjectActuals } from "@/lib/dashboardDb";

export function SalesOpsActualsCard(props: {
  isCmo: boolean;
  actuals: ProjectActuals | null;
  metricsDirty: boolean;
  metricsSavedAt: number | null;
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
  const { isCmo, actuals, metricsDirty, metricsSavedAt, actualsForm, setActualsForm, onSaveActuals } = props;

  const [saveFlash, setSaveFlash] = useState<"idle" | "saving" | "saved">("idle");
  const saveLabel = useMemo(() => {
    if (saveFlash === "saving") return "Saving…";
    if (saveFlash === "saved") return "Saved";
    return metricsDirty ? "Save actuals" : "Saved";
  }, [metricsDirty, saveFlash]);

  const canSave = metricsDirty && saveFlash !== "saving";

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

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <NumberInput label="Actual leads" unit="leads" value={actualsForm.leads} onValueChange={(v) => setActualsForm((s) => ({ ...s, leads: v }))} />
        <NumberInput
          label="Qualified leads"
          unit="leads"
          value={actualsForm.qualified_leads}
          onValueChange={(v) => setActualsForm((s) => ({ ...s, qualified_leads: v }))}
        />
        <NumberInput
          label="Meetings scheduled"
          unit="meetings"
          value={actualsForm.meetings_scheduled}
          onValueChange={(v) => setActualsForm((s) => ({ ...s, meetings_scheduled: v }))}
        />
        <NumberInput
          label="Meetings done"
          unit="meetings"
          value={actualsForm.meetings_done}
          onValueChange={(v) => setActualsForm((s) => ({ ...s, meetings_done: v }))}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <NumberInput label="Deals won" unit="deals" value={actualsForm.deals_won} onValueChange={(v) => setActualsForm((s) => ({ ...s, deals_won: v }))} />
        <NumberInput label="Sqft won" unit="sqft" value={actualsForm.sqft_won} onValueChange={(v) => setActualsForm((s) => ({ ...s, sqft_won: v }))} />
      </div>

      {actuals ? (
        <div className="mt-3 text-xs text-white/45">Last loaded values are from Supabase.</div>
      ) : (
        <div className="mt-3 text-xs text-white/45">No actuals saved yet for this month.</div>
      )}
    </Surface>
  );
}
