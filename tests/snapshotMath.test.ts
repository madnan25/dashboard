import { describe, expect, it } from "vitest";

import { computeTargetsFrom } from "../lib/reports/snapshotMath";

describe("computeTargetsFrom", () => {
  it("computes dealsRequired and channel targets", () => {
    const targets = {
      project_id: "p",
      year: 2025,
      month: 12,
      sales_target_sqft: 15000,
      avg_sqft_per_deal: 925,
      total_budget: 2500000
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

    // 15000/925 = 16.21 -> ceil 17
    expect(out.dealsRequired).toBe(17);
    // 50% of 17 = 8.5 -> ceil 9
    expect(out.channelDealsRequired).toBe(9);
    // meetings required = 2x deals
    expect(out.qualifiedMeetingsRequired).toBe(18);
    expect(out.targetLeads).toBe(1000);
    expect(out.targetQualifiedLeads).toBe(200);
  });

  it("handles missing inputs safely", () => {
    const out = computeTargetsFrom(null, null);
    expect(out.dealsRequired).toBe(0);
    expect(out.channelDealsRequired).toBe(0);
    expect(out.targetLeads).toBe(0);
    expect(out.targetQualifiedLeads).toBe(0);
    expect(out.qualifiedMeetingsRequired).toBe(0);
  });
});
