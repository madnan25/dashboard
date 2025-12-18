"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import { KpiCard } from "@/components/ds/KpiCard";
import { Surface } from "@/components/ds/Surface";
import { formatNumber } from "@/lib/format";
import type { ProjectActuals } from "@/lib/dashboardDb";
import type { OverallFunnelTargets } from "@/lib/reports/projectHubTargets";

export function ProjectActualsPanel(props: {
  actuals: ProjectActuals | null;
  role: string | null;
  targets: OverallFunnelTargets;
}) {
  const { actuals, role, targets } = props;

  return (
    <Surface className="md:col-span-5">
      <div className="text-lg font-semibold text-white/90">Actuals (Sales Ops)</div>
      <div className="mt-1 text-sm text-white/55">Month-level actual performance.</div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <KpiCard label="Leads" value={formatNumber(actuals?.leads ?? 0)} helper={`Target: ${formatNumber(targets.leads)}`} />
        <KpiCard label="Qualified" value={formatNumber(actuals?.qualified_leads ?? 0)} helper={`Target: ${formatNumber(targets.qualified)}`} />
        <KpiCard
          label="Meetings scheduled"
          value={formatNumber(actuals?.meetings_scheduled ?? 0)}
          helper={`Target: ${formatNumber(targets.meetings_scheduled)}`}
        />
        <KpiCard label="Meetings done" value={formatNumber(actuals?.meetings_done ?? 0)} helper={`Target: ${formatNumber(targets.meetings_done)}`} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <KpiCard label="Deals concluded" value={formatNumber(actuals?.deals_won ?? 0)} helper={`Target: ${formatNumber(targets.deals)}`} />
        <KpiCard label="Sqft won" value={formatNumber(actuals?.sqft_won ?? 0)} helper="Sales Ops actual" />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button as={Link} href="/brand/data-entry" variant="flat" className="glass-inset text-white/80">
          Open planning & actuals entry
        </Button>
        {role === "cmo" ? (
          <Button as={Link} href="/cmo/projects" variant="flat" className="glass-inset text-white/80">
            Manage targets/projects
          </Button>
        ) : null}
      </div>
    </Surface>
  );
}
