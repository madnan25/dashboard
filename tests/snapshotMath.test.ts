import { describe, expect, it } from "vitest";

import { computeTargetsFrom } from "../lib/reports/snapshotMath";

describe("computeTargetsFrom", () => {
  it("computes dealsRequired and channel targets", () => {
    const targets = {
      project_id: "p",
      year: 2025,
      month: 12,
      sales_target_sqft: 15000,
      avg_sqft_per_deal: 1000,
      total_budget: 2500000,
      qualified_to_meeting_done_percent: 10,
      meeting_done_to_close_percent: 40
    };

    const inputs = {
      plan_version_id: "v",
      channel: "digital" as const,
      expected_leads: 1000,
      qualification_percent: 20,
      target_contribution_percent: 50,
      allocated_budget: 1500000
    };

    const out = computeTargetsFrom(targets, inputs);

    // total deals required: 15000/1000 = 15
    expect(out.dealsRequired).toBe(15);
    // channel sqft = 50% of 15000 = 7500 => channel deals = ceil(7500/1000) = 8
    expect(out.channelDealsRequired).toBe(8);
    // funnel (CMO rates): close 40% => meetings done = ceil(8/0.4)=20, scheduled = 1.5× done => 30
    expect(out.meetingsDoneRequired).toBe(20);
    expect(out.meetingsScheduledRequired).toBe(30);
    // meeting rate 10% => qualified = ceil(20/0.1)=200; qualification 20% => leads=ceil(200/0.2)=1000
    expect(out.targetLeads).toBe(1000);
    expect(out.targetQualifiedLeads).toBe(200);
  });

  it("handles missing inputs safely", () => {
    const out = computeTargetsFrom(null, null);
    expect(out.dealsRequired).toBe(0);
    expect(out.channelDealsRequired).toBe(0);
    expect(out.targetLeads).toBe(0);
    expect(out.targetQualifiedLeads).toBe(0);
    expect(out.meetingsDoneRequired).toBe(0);
    expect(out.meetingsScheduledRequired).toBe(0);
  });
});
