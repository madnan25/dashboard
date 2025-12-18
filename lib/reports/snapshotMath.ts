import type { PlanChannelInputs, ProjectTargets } from "@/lib/dashboardDb";

export function computeTargetsFrom(
  targets: ProjectTargets | null,
  inputs: PlanChannelInputs | null
): {
  dealsRequired: number;
  channelDealsRequired: number;
  targetLeads: number;
  targetQualifiedLeads: number;
  meetingsDoneRequired: number;
  meetingsScheduledRequired: number;
} {
  const salesTargetSqft = targets?.sales_target_sqft ?? 0;
  const avgSqft = targets?.avg_sqft_per_deal ?? 0;
  const dealsRequired = Math.max(0, Math.ceil(salesTargetSqft / Math.max(avgSqft, 1)));

  const pct = inputs?.target_contribution_percent ?? 0;
  const channelDealsRequired = Math.max(0, Math.ceil(dealsRequired * (pct / 100)));
  const meetingsDoneRequired = Math.max(0, channelDealsRequired * 2);
  const meetingsScheduledRequired = Math.max(0, Math.ceil(meetingsDoneRequired * 1.5));

  const targetLeads = Math.max(0, Math.round(inputs?.expected_leads ?? 0));
  const qPct = inputs?.qualification_percent ?? 0;
  const targetQualifiedLeads = Math.max(0, Math.round(targetLeads * (qPct / 100)));

  return { dealsRequired, channelDealsRequired, targetLeads, targetQualifiedLeads, meetingsDoneRequired, meetingsScheduledRequired };
}

