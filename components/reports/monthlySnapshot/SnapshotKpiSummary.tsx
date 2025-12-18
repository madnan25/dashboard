"use client";

import { KpiCard } from "@/components/ds/KpiCard";
import { formatNumber, formatPKRCompact } from "@/lib/format";

export function SnapshotKpiSummary(props: {
  snapshot: {
    budgetAllocated: number;
    budgetSpent: number;
    leadsGenerated: number;
    qualifiedLeads: number;
    meetingsCompleted: number;
    dealsWon: number;
    sqftWon: number;
  };
  budgetUtilizedDisplay: string;
  leadToQualifiedPct: number;
  qualifiedToMeetingPct: number;
}) {
  const { snapshot, budgetUtilizedDisplay, leadToQualifiedPct, qualifiedToMeetingPct } = props;

  return (
    <>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <KpiCard label="Budget Allocated" value={formatPKRCompact(snapshot.budgetAllocated)} helper="Monthly cap" />
        <KpiCard label="Budget Spent" value={formatPKRCompact(snapshot.budgetSpent)} helper={`${budgetUtilizedDisplay} of allocated`} />
        <KpiCard
          label="Qualified Leads"
          value={formatNumber(snapshot.qualifiedLeads)}
          helper={`${leadToQualifiedPct.toFixed(0)}% of ${formatNumber(snapshot.leadsGenerated)} leads`}
        />
        <KpiCard
          label="Meetings Completed"
          value={formatNumber(snapshot.meetingsCompleted)}
          helper={`${qualifiedToMeetingPct.toFixed(0)}% of ${formatNumber(snapshot.qualifiedLeads)} qualified`}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <KpiCard label="Deals Won" value={formatNumber(snapshot.dealsWon)} helper="Sales Ops actual" />
        <KpiCard label="Sqft Won" value={formatNumber(snapshot.sqftWon)} helper="Sales Ops actual" />
      </div>
    </>
  );
}
