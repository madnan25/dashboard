"use client";

import { Button } from "@heroui/react";
import { NumberInput } from "@/components/ds/NumberInput";
import { Surface } from "@/components/ds/Surface";
import type { ProjectTargets } from "@/lib/dashboardDb";

export function CmoTargetsPanel(props: {
  monthLabel: string;
  targets: ProjectTargets | null;
  targetsForm: {
    sales_target_sqft: string;
    avg_sqft_per_deal: string;
    total_budget: string;
    qualified_to_meeting_done_percent: string;
    meeting_done_to_close_percent: string;
  };
  setTargetsForm: (
    updater: (
      prev: {
        sales_target_sqft: string;
        avg_sqft_per_deal: string;
        total_budget: string;
        qualified_to_meeting_done_percent: string;
        meeting_done_to_close_percent: string;
      }
    ) => {
    sales_target_sqft: string;
    avg_sqft_per_deal: string;
    total_budget: string;
    qualified_to_meeting_done_percent: string;
    meeting_done_to_close_percent: string;
  }) => void;
  onSaveTargets: () => void;
  isDisabled: boolean;
}) {
  const { monthLabel, targets, targetsForm, setTargetsForm, onSaveTargets, isDisabled } = props;

  return (
    <Surface>
      <div className="text-lg font-semibold text-white/90">Targets & Budget</div>
      <div className="mt-1 text-sm text-white/55">
        For {monthLabel}. Brand team will allocate budgets across Digital, Inbound, Activations (cannot exceed cap).
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <NumberInput
          label="Sales target"
          unit="sqft"
          value={targetsForm.sales_target_sqft}
          onValueChange={(v) => setTargetsForm((s) => ({ ...s, sales_target_sqft: v }))}
        />
        <NumberInput
          label="Avg sqft per deal"
          unit="sqft"
          value={targetsForm.avg_sqft_per_deal}
          onValueChange={(v) => setTargetsForm((s) => ({ ...s, avg_sqft_per_deal: v }))}
        />
        <NumberInput
          label="Total budget cap"
          unit="PKR"
          value={targetsForm.total_budget}
          onValueChange={(v) => setTargetsForm((s) => ({ ...s, total_budget: v }))}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <NumberInput
          label="Qualified → meetings done"
          unit="%"
          value={targetsForm.qualified_to_meeting_done_percent}
          onValueChange={(v) => setTargetsForm((s) => ({ ...s, qualified_to_meeting_done_percent: v }))}
        />
        <NumberInput
          label="Meetings done → close"
          unit="%"
          value={targetsForm.meeting_done_to_close_percent}
          onValueChange={(v) => setTargetsForm((s) => ({ ...s, meeting_done_to_close_percent: v }))}
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-white/45">Last saved: {targets ? `${targets.month}/${targets.year}` : "—"}</div>
        <Button color="primary" onPress={onSaveTargets} isDisabled={isDisabled}>
          Save targets
        </Button>
      </div>
    </Surface>
  );
}
