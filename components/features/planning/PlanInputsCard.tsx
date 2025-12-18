"use client";

import { Button } from "@heroui/react";
import { NumberInput } from "@/components/ds/NumberInput";
import { Surface } from "@/components/ds/Surface";
import type { PlanChannel, PlanVersion } from "@/lib/dashboardDb";

const CHANNELS: PlanChannel[] = ["digital", "activations", "inbound"];

function channelLabel(channel: PlanChannel) {
  switch (channel) {
    case "digital":
      return "Digital";
    case "activations":
      return "Activations";
    case "inbound":
      return "Inbound";
  }
}

export function PlanInputsCard(props: {
  activeVersion: PlanVersion | null;
  isCmo: boolean;
  canEditPlan: boolean;
  allocatedTotal: number;
  budgetCap: number;
  remainingBudget: number;
  channelInputs: Record<PlanChannel, { expected_leads: string; qualification_percent: string; target_contribution_percent: string; allocated_budget: string }>;
  setChannelInputs: (updater: (prev: Record<PlanChannel, { expected_leads: string; qualification_percent: string; target_contribution_percent: string; allocated_budget: string }>) => Record<PlanChannel, { expected_leads: string; qualification_percent: string; target_contribution_percent: string; allocated_budget: string }>) => void;
  onSavePlanInputs: () => void;
  onSubmitForApproval: () => void;
}) {
  const { activeVersion, isCmo, canEditPlan, allocatedTotal, budgetCap, remainingBudget, channelInputs, setChannelInputs, onSavePlanInputs, onSubmitForApproval } = props;

  return (
    <Surface className="md:col-span-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-white/90">Plan inputs</div>
          <div className="mt-1 text-sm text-white/55">Version: {activeVersion ? `${activeVersion.status}${activeVersion.active ? " (active)" : ""}` : "—"}</div>
        </div>

        <div className="text-sm text-white/60">Allocated: {allocatedTotal.toLocaleString()} / {budgetCap.toLocaleString()} (Remaining: {remainingBudget.toLocaleString()})</div>
      </div>

      {!activeVersion ? (
        <div className="mt-4 text-sm text-white/60">No editable version selected. Create a new draft to start entering your plan.</div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {CHANNELS.map((ch) => (
              <div key={ch} className="glass-inset rounded-2xl p-4">
                <div className="text-sm font-semibold text-white/85">{channelLabel(ch)}</div>
                <div className="mt-3 grid gap-3">
                  <NumberInput
                    label="Expected leads"
                    unit="leads"
                    value={channelInputs[ch].expected_leads}
                    onValueChange={(v) => setChannelInputs((s) => ({ ...s, [ch]: { ...s[ch], expected_leads: v } }))}
                    isDisabled={!canEditPlan}
                  />
                  <NumberInput
                    label="Qualification %"
                    unit="%"
                    value={channelInputs[ch].qualification_percent}
                    onValueChange={(v) => setChannelInputs((s) => ({ ...s, [ch]: { ...s[ch], qualification_percent: v } }))}
                    isDisabled={!canEditPlan}
                  />
                  <NumberInput
                    label="Target contribution"
                    unit="%"
                    value={channelInputs[ch].target_contribution_percent}
                    onValueChange={(v) => setChannelInputs((s) => ({ ...s, [ch]: { ...s[ch], target_contribution_percent: v } }))}
                    isDisabled={!canEditPlan}
                  />
                  <NumberInput
                    label="Allocated budget"
                    unit="PKR"
                    value={channelInputs[ch].allocated_budget}
                    onValueChange={(v) => setChannelInputs((s) => ({ ...s, [ch]: { ...s[ch], allocated_budget: v } }))}
                    isDisabled={!canEditPlan}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <Button variant="flat" className="glass-inset text-white/80" onPress={onSavePlanInputs} isDisabled={!canEditPlan}>
              Save draft
            </Button>
            {!isCmo ? (
              <Button color="primary" onPress={onSubmitForApproval} isDisabled={!canEditPlan}>
                Submit for approval
              </Button>
            ) : null}
          </div>
        </>
      )}
    </Surface>
  );
}
