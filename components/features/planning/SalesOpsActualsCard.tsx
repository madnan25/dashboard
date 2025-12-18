"use client";

import { Button } from "@heroui/react";
import { NumberInput } from "@/components/ds/NumberInput";
import { Surface } from "@/components/ds/Surface";
import type { ProjectActuals } from "@/lib/dashboardDb";

export function SalesOpsActualsCard(props: {
  isCmo: boolean;
  actuals: ProjectActuals | null;
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
  onSaveActuals: () => void;
}) {
  const { isCmo, actuals, actualsForm, setActualsForm, onSaveActuals } = props;

  return (
    <Surface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-white/90">{isCmo ? "Sales Ops – Actuals (CMO override)" : "Sales Ops – Actuals"}</div>
          <div className="mt-1 text-sm text-white/55">{isCmo ? "CMO can edit actuals if needed." : "These are locked from Brand edits."}</div>
        </div>
        <Button color="primary" onPress={onSaveActuals}>
          Save actuals
        </Button>
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
