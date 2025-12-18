"use client";

import { Button } from "@heroui/react";
import { NumberInput } from "@/components/ds/NumberInput";
import { Surface } from "@/components/ds/Surface";

export function CmoTargetsBudgetCard(props: {
  targetsForm: { sales_target_sqft: string; avg_sqft_per_deal: string; total_budget: string };
  setTargetsForm: (updater: (prev: { sales_target_sqft: string; avg_sqft_per_deal: string; total_budget: string }) => {
    sales_target_sqft: string;
    avg_sqft_per_deal: string;
    total_budget: string;
  }) => void;
  onSaveTargets: () => void;
}) {
  const { targetsForm, setTargetsForm, onSaveTargets } = props;

  return (
    <Surface className="md:col-span-5">
      <div className="text-lg font-semibold text-white/90">CMO – Targets & Budget</div>
      <div className="mt-1 text-sm text-white/55">Sets caps for the selected project/month.</div>

      <div className="mt-4 grid gap-4">
        <NumberInput
          label="Sales target"
          unit="sqft"
          value={targetsForm.sales_target_sqft}
          onValueChange={(v) => setTargetsForm((s) => ({ ...s, sales_target_sqft: v }))}
        />
        <NumberInput
          label="Average sqft per deal"
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

        <Button color="primary" onPress={onSaveTargets}>
          Save targets
        </Button>
      </div>
    </Surface>
  );
}
