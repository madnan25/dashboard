import type { PlanChannelInputs, ProjectTargets } from "@/lib/dashboardDb";

export type FunnelRates = {
  qualified_to_meeting_done_percent: number; // 0-100
  meeting_done_to_close_percent: number; // 0-100
};

export type ChannelFunnelComputed = {
  targetSqft: number;
  dealsRequired: number;
  meetingsDoneRequired: number;
  meetingsScheduledRequired: number;
  qualifiedRequired: number;
  leadsRequired: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function ceilDiv(a: number, b: number) {
  const denom = Math.max(b, 1e-9);
  return Math.ceil(a / denom);
}

export function getFunnelRates(targets: ProjectTargets | null): FunnelRates {
  return {
    qualified_to_meeting_done_percent: clamp(Number(targets?.qualified_to_meeting_done_percent ?? 10), 0, 100),
    meeting_done_to_close_percent: clamp(Number(targets?.meeting_done_to_close_percent ?? 40), 0, 100)
  };
}

export function computeChannelTargetSqft(props: { totalTargetSqft: number; contributionPercent: number }) {
  const total = Math.max(0, props.totalTargetSqft);
  const pct = clamp(props.contributionPercent, 0, 100);
  return Math.max(0, Math.round(total * (pct / 100)));
}

// Uncapped variant: allows >100% for validation/UX (but should be blocked on save)
export function computeChannelTargetSqftUncapped(props: { totalTargetSqft: number; contributionPercent: number }) {
  const total = Math.max(0, props.totalTargetSqft);
  const pct = Number.isFinite(props.contributionPercent) ? props.contributionPercent : 0;
  return Math.max(0, Math.round(total * (pct / 100)));
}

export function computeContributionPercentFromSqft(props: { totalTargetSqft: number; targetSqft: number }) {
  const total = Math.max(0, props.totalTargetSqft);
  if (total <= 0) return 0;
  return clamp((Math.max(0, props.targetSqft) / total) * 100, 0, 100);
}

// Uncapped variant: allows >100% for validation/UX (but should be blocked on save)
export function computeContributionPercentFromSqftUncapped(props: { totalTargetSqft: number; targetSqft: number }) {
  const total = Math.max(0, props.totalTargetSqft);
  if (total <= 0) return 0;
  return (Math.max(0, props.targetSqft) / total) * 100;
}

export function computeChannelFunnelFromTargetSqft(props: {
  targets: ProjectTargets | null;
  targetSqft: number;
  qualificationPercent: number;
}): ChannelFunnelComputed {
  const targetSqft = Math.max(0, props.targetSqft);
  const qPct = clamp(props.qualificationPercent, 0, 100);
  const q = qPct / 100;

  const avgDealSqft = Math.max(0, Number(props.targets?.avg_sqft_per_deal ?? 0));
  const dealsRequired = targetSqft > 0 ? ceilDiv(targetSqft, Math.max(avgDealSqft, 1)) : 0;

  const rates = getFunnelRates(props.targets);
  const close = (rates.meeting_done_to_close_percent ?? 40) / 100;
  const mtg = (rates.qualified_to_meeting_done_percent ?? 10) / 100;

  const meetingsDoneRequired = dealsRequired > 0 && close > 0 ? ceilDiv(dealsRequired, close) : 0;
  // Keep prior business rule: scheduled = 1.5× done
  const meetingsScheduledRequired = Math.ceil(meetingsDoneRequired * 1.5);

  const qualifiedRequired = meetingsDoneRequired > 0 && mtg > 0 ? ceilDiv(meetingsDoneRequired, mtg) : 0;
  const leadsRequired = qualifiedRequired > 0 && q > 0 ? ceilDiv(qualifiedRequired, q) : 0;

  return {
    targetSqft,
    dealsRequired,
    meetingsDoneRequired,
    meetingsScheduledRequired,
    qualifiedRequired,
    leadsRequired
  };
}

export function computeChannelFunnelFromInputs(props: {
  targets: ProjectTargets | null;
  inputs: PlanChannelInputs | null;
}): ChannelFunnelComputed {
  const total = Math.max(0, Number(props.targets?.sales_target_sqft ?? 0));
  const pct = Number(props.inputs?.target_contribution_percent ?? 0);
  const targetSqft = computeChannelTargetSqft({ totalTargetSqft: total, contributionPercent: pct });
  const qPct = Number(props.inputs?.qualification_percent ?? 0);
  return computeChannelFunnelFromTargetSqft({ targets: props.targets, targetSqft, qualificationPercent: qPct });
}
