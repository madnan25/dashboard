"use client";

import { NavCard } from "@/components/ds/NavCard";

export function ProjectReportNav(props: { projectId: string }) {
  const { projectId } = props;

  return (
    <>
      <div className="space-y-2 px-1">
        <div className="text-lg font-semibold text-white/90">Reports</div>
        <div className="text-sm text-white/55">Digital, Inbound, and Activations drilldowns.</div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <NavCard href={`/projects/${projectId}/digital`} title="Digital" description="Monthly snapshot + funnel performance." meta="Open report" size="sm" />
        <NavCard href={`/projects/${projectId}/inbound`} title="Inbound" description="Monthly snapshot + funnel performance." meta="Open report" size="sm" />
        <NavCard
          href={`/projects/${projectId}/activations`}
          title="Activations"
          description="Monthly snapshot + funnel performance."
          meta="Open report"
          size="sm"
        />
      </div>
    </>
  );
}
