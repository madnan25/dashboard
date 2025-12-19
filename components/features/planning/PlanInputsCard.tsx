"use client";

import { Button } from "@heroui/react";
import { NumberInput } from "@/components/ds/NumberInput";
import { Surface } from "@/components/ds/Surface";
import type { PlanChannel, PlanVersion, ProjectTargets } from "@/lib/dashboardDb";
import {
  computeChannelFunnelFromTargetSqft,
  computeContributionPercentFromSqftUncapped,
  computeChannelTargetSqftUncapped,
  getFunnelRates
} from "@/lib/reports/funnelMath";

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
  targets: ProjectTargets | null;
  allocatedTotal: number;
  budgetCap: number;
  remainingBudget: number;
  channelInputs: Record<
    PlanChannel,
    {
      expected_leads: string;
      qualification_percent: string;
      target_contribution_percent: string;
      target_sqft: string;
      allocated_budget: string;
    }
  >;
  setChannelInputs: (
    updater: (
      prev: Record<
        PlanChannel,
        {
          expected_leads: string;
          qualification_percent: string;
          target_contribution_percent: string;
          target_sqft: string;
          allocated_budget: string;
        }
      >
    ) => Record<
      PlanChannel,
      {
        expected_leads: string;
        qualification_percent: string;
        target_contribution_percent: string;
        target_sqft: string;
        allocated_budget: string;
      }
    >
  ) => void;
  onSavePlanInputs: () => void;
  onSubmitForApproval: () => void;
}) {
  const {
    activeVersion,
    isCmo,
    canEditPlan,
    targets,
    allocatedTotal,
    budgetCap,
    remainingBudget,
    channelInputs,
    setChannelInputs,
    onSavePlanInputs,
    onSubmitForApproval
  } = props;

  function toNumber(value: string) {
    const v = Number(value);
    return Number.isFinite(v) ? v : null;
  }

  const totalTargetSqft = Number(targets?.sales_target_sqft ?? 0);

  const totalContributionPct = CHANNELS.reduce((sum, ch) => {
    const v = toNumber(channelInputs[ch].target_contribution_percent);
    return sum + (v ?? 0);
  }, 0);

  const isOverTotalTarget = totalContributionPct > 100.0001;

  return (
    <Surface className="md:col-span-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-white/90">Plan inputs</div>
          <div className="mt-1 text-sm text-white/55">Version: {activeVersion ? `${activeVersion.status}${activeVersion.active ? " (active)" : ""}` : "—"}</div>
        </div>

        <div className="text-sm text-white/60">
          Allocated: {allocatedTotal.toLocaleString()} / {budgetCap.toLocaleString()} (Remaining: {remainingBudget.toLocaleString()})
          {targets ? (
            <span className={isOverTotalTarget ? "ml-3 text-rose-200/90" : "ml-3 text-white/45"}>
              Target total: {totalContributionPct.toFixed(2)}%
              {isOverTotalTarget ? ` (over by ${(totalContributionPct - 100).toFixed(2)}%)` : ""}
            </span>
          ) : null}
        </div>
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
                  {(() => {
                    const sqft = toNumber(channelInputs[ch].target_sqft) ?? 0;
                    const pctRaw = totalTargetSqft > 0 ? computeContributionPercentFromSqftUncapped({ totalTargetSqft, targetSqft: sqft }) : 0;
                    const pctInput = toNumber(channelInputs[ch].target_contribution_percent) ?? pctRaw;
                    const isOverChannel = pctInput > 100.0001 || (totalTargetSqft > 0 && sqft > totalTargetSqft + 0.5);
                    return (
                      <>
                  <NumberInput
                    label="Target (sqft)"
                    unit="sqft"
                    value={channelInputs[ch].target_sqft}
                    onValueChange={(v) => {
                      const sqft = toNumber(v) ?? 0;
                      const pct = totalTargetSqft > 0 ? computeContributionPercentFromSqftUncapped({ totalTargetSqft, targetSqft: sqft }) : 0;
                      const q = toNumber(channelInputs[ch].qualification_percent) ?? 0;
                      const computed = computeChannelFunnelFromTargetSqft({ targets, targetSqft: sqft, qualificationPercent: q });
                      setChannelInputs((s) => ({
                        ...s,
                        [ch]: {
                          ...s[ch],
                          target_sqft: v,
                          target_contribution_percent: String(Number.isFinite(pct) ? Number(pct.toFixed(2)) : 0),
                          expected_leads: String(computed.leadsRequired)
                        }
                      }));
                    }}
                    description={
                      targets && totalTargetSqft > 0
                        ? `${pctRaw.toFixed(2)}% of target`
                        : "Set CMO sales target to enable % conversion."
                    }
                    descriptionTone={isOverChannel ? "danger" : "muted"}
                    isDisabled={!canEditPlan}
                  />
                  <NumberInput
                    label="Leads required (computed)"
                    unit="leads"
                    value={channelInputs[ch].expected_leads}
                    onValueChange={() => {}}
                    description={
                      (toNumber(channelInputs[ch].qualification_percent) ?? 0) <= 0
                        ? "Set qualification % > 0 to compute leads."
                        : undefined
                    }
                    descriptionTone={(toNumber(channelInputs[ch].qualification_percent) ?? 0) <= 0 ? "danger" : "muted"}
                    isDisabled
                  />
                  <NumberInput
                    label="Qualification %"
                    unit="%"
                    value={channelInputs[ch].qualification_percent}
                    onValueChange={(v) => {
                      const q = toNumber(v) ?? 0;
                      const sqft = toNumber(channelInputs[ch].target_sqft) ?? 0;
                      const computed = computeChannelFunnelFromTargetSqft({ targets, targetSqft: sqft, qualificationPercent: q });
                      setChannelInputs((s) => ({
                        ...s,
                        [ch]: { ...s[ch], qualification_percent: v, expected_leads: String(computed.leadsRequired) }
                      }));
                    }}
                    isDisabled={!canEditPlan}
                  />
                  <NumberInput
                    label="Target contribution"
                    unit="%"
                    value={channelInputs[ch].target_contribution_percent}
                    onValueChange={(v) => {
                      const pct = Math.max(0, toNumber(v) ?? 0);
                      const sqft = computeChannelTargetSqftUncapped({ totalTargetSqft, contributionPercent: pct });
                      const q = toNumber(channelInputs[ch].qualification_percent) ?? 0;
                      const computed = computeChannelFunnelFromTargetSqft({ targets, targetSqft: sqft, qualificationPercent: q });
                      setChannelInputs((s) => ({
                        ...s,
                        [ch]: {
                          ...s[ch],
                          target_contribution_percent: v,
                          target_sqft: String(sqft),
                          expected_leads: String(computed.leadsRequired)
                        }
                      }));
                    }}
                    description={targets ? `${pctInput.toFixed(2)}% of target` : undefined}
                    descriptionTone={isOverChannel ? "danger" : "muted"}
                    isDisabled={!canEditPlan}
                  />
                  <NumberInput
                    label="Allocated budget"
                    unit="PKR"
                    value={channelInputs[ch].allocated_budget}
                    onValueChange={(v) => setChannelInputs((s) => ({ ...s, [ch]: { ...s[ch], allocated_budget: v } }))}
                    isDisabled={!canEditPlan}
                  />
                      </>
                    );
                  })()}
                </div>

                {targets ? (
                  (() => {
                    const q = toNumber(channelInputs[ch].qualification_percent) ?? 0;
                    const sqft = toNumber(channelInputs[ch].target_sqft) ?? 0;
                    const computed = computeChannelFunnelFromTargetSqft({ targets, targetSqft: sqft, qualificationPercent: q });
                    const rates = getFunnelRates(targets);
                    return (
                      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/70">
                        <div className="flex items-center justify-between">
                          <span>Deals required</span>
                          <span className="font-semibold text-white/85">{computed.dealsRequired.toLocaleString()}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span>Meetings done required</span>
                          <span className="font-semibold text-white/85">{computed.meetingsDoneRequired.toLocaleString()}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span>Meetings scheduled (1.5×)</span>
                          <span className="font-semibold text-white/85">{computed.meetingsScheduledRequired.toLocaleString()}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span>Qualified required</span>
                          <span className="font-semibold text-white/85">{computed.qualifiedRequired.toLocaleString()}</span>
                        </div>
                        <div className="mt-2 text-[11px] text-white/45">
                          Rates (CMO): qualified→meeting done {rates.qualified_to_meeting_done_percent.toFixed(0)}% · meeting done→close{" "}
                          {rates.meeting_done_to_close_percent.toFixed(0)}%
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="mt-3 text-xs text-white/45">Set CMO targets + funnel rates to enable computed requirements.</div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="flat"
              className="glass-inset text-white/80"
              onPress={onSavePlanInputs}
              isDisabled={!canEditPlan || isOverTotalTarget}
            >
              Save draft
            </Button>
            {!isCmo ? (
              <Button color="primary" onPress={onSubmitForApproval} isDisabled={!canEditPlan || isOverTotalTarget}>
                Submit for approval
              </Button>
            ) : null}
          </div>
        </>
      )}
    </Surface>
  );
}
