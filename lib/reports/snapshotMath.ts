import type { PlanChannelInputs, ProjectTargets } from "@/lib/dashboardDb";
import { computeChannelFunnelFromInputs } from "./funnelMath";

export function computeTargetsFrom(
  targets: ProjectTargets | null,
  inputs: PlanChannelInputs | null
): {
  targetSqft: number;
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

  const computed = computeChannelFunnelFromInputs({ targets, inputs });
  const targetSqft = Math.max(0, Math.round(computed.targetSqft));
  const channelDealsRequired = Math.max(0, Math.round(computed.dealsRequired));
  const meetingsDoneRequired = Math.max(0, Math.round(computed.meetingsDoneRequired));
  const meetingsScheduledRequired = Math.max(0, Math.round(computed.meetingsScheduledRequired));
  const targetQualifiedLeads = Math.max(0, Math.round(computed.qualifiedRequired));
  const targetLeads = Math.max(0, Math.round(computed.leadsRequired));

  return { targetSqft, dealsRequired, channelDealsRequired, targetLeads, targetQualifiedLeads, meetingsDoneRequired, meetingsScheduledRequired };
}

