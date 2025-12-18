import type { PlanChannel, PlanChannelInputs, ProjectTargets } from "@/lib/dashboardDb";

export type OverallFunnelTargets = {
  leads: number;
  qualified: number;
  meetings_scheduled: number;
  meetings_done: number;
  deals: number;
};

export type ChannelDistributions = {
  budgetByChannel: Record<PlanChannel, number>;
  leadsByChannel: Record<PlanChannel, number>;
  targetSqftByChannel: Record<PlanChannel, number>;
};

const CHANNELS: PlanChannel[] = ["digital", "inbound", "activations"];

export function computeOverallFunnelTargets(targets: ProjectTargets | null, inputsByChannel: Record<PlanChannel, PlanChannelInputs | null>) {
  const salesTargetSqft = targets?.sales_target_sqft ?? 0;
  const avgSqft = targets?.avg_sqft_per_deal ?? 0;

  const deals = Math.max(0, Math.ceil(salesTargetSqft / Math.max(avgSqft, 1)));
  const meetings = deals * 2; // current business rule used elsewhere in the app

  let leads = 0;
  let qualified = 0;
  for (const ch of CHANNELS) {
    const expected = inputsByChannel[ch]?.expected_leads ?? 0;
    const qPct = inputsByChannel[ch]?.qualification_percent ?? 0;
    leads += expected;
    qualified += Math.round(expected * (qPct / 100));
  }

  const out: OverallFunnelTargets = {
    leads: Math.max(0, Math.round(leads)),
    qualified: Math.max(0, Math.round(qualified)),
    meetings_scheduled: Math.max(0, Math.round(meetings)),
    meetings_done: Math.max(0, Math.round(meetings)),
    deals: Math.max(0, Math.round(deals))
  };
  return out;
}

export function computeChannelDistributions(targets: ProjectTargets | null, inputsByChannel: Record<PlanChannel, PlanChannelInputs | null>) {
  const salesTargetSqft = targets?.sales_target_sqft ?? 0;

  const budgetByChannel: Record<PlanChannel, number> = { digital: 0, inbound: 0, activations: 0 };
  const leadsByChannel: Record<PlanChannel, number> = { digital: 0, inbound: 0, activations: 0 };
  const targetSqftByChannel: Record<PlanChannel, number> = { digital: 0, inbound: 0, activations: 0 };

  for (const ch of CHANNELS) {
    budgetByChannel[ch] = Math.max(0, inputsByChannel[ch]?.allocated_budget ?? 0);
    leadsByChannel[ch] = Math.max(0, inputsByChannel[ch]?.expected_leads ?? 0);
    const pct = inputsByChannel[ch]?.target_contribution_percent ?? 0;
    targetSqftByChannel[ch] = Math.max(0, Math.round(salesTargetSqft * (pct / 100)));
  }

  const out: ChannelDistributions = { budgetByChannel, leadsByChannel, targetSqftByChannel };
  return out;
}

