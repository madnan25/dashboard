"use client";

import { useMemo, useState } from "react";
import { NumberInput } from "@/components/ds/NumberInput";
import { AppButton } from "@/components/ds/AppButton";
import { Surface } from "@/components/ds/Surface";
import type { ProjectActuals } from "@/lib/dashboardDb";

export function BrandSpendCard(props: {
  isCmo: boolean;
  actuals: ProjectActuals | null;
  spendDirty: boolean;
  spendSavedAt: number | null;
  actualsForm: {
    spend_digital: string;
    spend_inbound: string;
    spend_activations: string;
  };
  setActualsForm: (updater: (prev: {
    spend_digital: string;
    spend_inbound: string;
    spend_activations: string;
  }) => {
    spend_digital: string;
    spend_inbound: string;
    spend_activations: string;
  }) => void;
  onSaveSpend: () => Promise<void> | void;
}) {
  const { isCmo, actuals, spendDirty, spendSavedAt, actualsForm, setActualsForm, onSaveSpend } = props;

  const [saveFlash, setSaveFlash] = useState<"idle" | "saving" | "saved">("idle");

  const saveLabel = useMemo(() => {
    if (saveFlash === "saving") return "Saving…";
    if (saveFlash === "saved") return "Saved";
    return spendDirty ? "Save spend" : "Saved";
  }, [saveFlash, spendDirty]);

  const canSave = spendDirty && saveFlash !== "saving";

  return (
    <Surface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-white/90">{isCmo ? "Brand – Spend (CMO override)" : "Brand – Spend"}</div>
          <div className="mt-1 text-sm text-white/55">
            Track channel spend here. (Actuals metrics remain in Sales Ops.)
          </div>
          <div className="mt-2 text-xs text-white/45">
            {spendSavedAt ? (
              <>
                Last saved: {new Date(spendSavedAt).toLocaleTimeString()}
                {spendDirty ? <span className="ml-2 text-amber-200/80">Unsaved changes</span> : null}
              </>
            ) : spendDirty ? (
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
              await onSaveSpend();
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
        <div className="text-xs uppercase tracking-widest text-white/45">Spend (actual)</div>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <NumberInput
            label="Digital spend"
            unit="PKR"
            value={actualsForm.spend_digital}
            onValueChange={(v) => setActualsForm((s) => ({ ...s, spend_digital: v }))}
          />
          <NumberInput
            label="Inbound spend"
            unit="PKR"
            value={actualsForm.spend_inbound}
            onValueChange={(v) => setActualsForm((s) => ({ ...s, spend_inbound: v }))}
          />
          <NumberInput
            label="Activations spend"
            unit="PKR"
            value={actualsForm.spend_activations}
            onValueChange={(v) => setActualsForm((s) => ({ ...s, spend_activations: v }))}
          />
        </div>
      </div>

      {actuals ? (
        <div className="mt-3 text-xs text-white/45">Last loaded values are from Supabase.</div>
      ) : (
        <div className="mt-3 text-xs text-white/45">No actuals saved yet for this month.</div>
      )}
    </Surface>
  );
}


