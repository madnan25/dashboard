"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { MonthYearPicker } from "@/components/ds/MonthYearPicker";
import { KpiCard } from "@/components/ds/KpiCard";
import { PageShell, Surface } from "@/components/ds/Surface";
import { MONTHS, clampPercent } from "@/lib/digitalSnapshot";
import { formatNumber, formatPKRCompact } from "@/lib/format";
import {
  PlanChannel,
  PlanChannelInputs,
  PlanVersion,
  Project,
  ProjectActuals,
  ProjectTargets,
  getPlanChannelInputs,
  getProjectActuals,
  getProjectTargets,
  listPlanVersions,
  listProjects
} from "@/lib/dashboardDb";

function monthNumber(monthIndex: number) {
  return monthIndex + 1;
}

function channelLabel(channel: PlanChannel) {
  switch (channel) {
    case "digital":
      return "Digital";
    case "inbound":
      return "Inbound";
    case "activations":
      return "Activations";
  }
}

function computeTargetsFrom(
  targets: ProjectTargets | null,
  channelInputs: PlanChannelInputs | null
): {
  dealsRequired: number;
  channelDealsRequired: number;
  targetLeads: number;
  targetQualifiedLeads: number;
  qualifiedMeetingsRequired: number;
} {
  const salesTargetSqft = targets?.sales_target_sqft ?? 0;
  const avgSqft = targets?.avg_sqft_per_deal ?? 0;
  const dealsRequired = Math.max(0, Math.ceil(salesTargetSqft / Math.max(avgSqft, 1)));

  const pct = channelInputs?.target_contribution_percent ?? 0;
  const channelDealsRequired = Math.max(0, Math.ceil(dealsRequired * (pct / 100)));

  const qualifiedMeetingsRequired = Math.max(0, channelDealsRequired * 2);

  const targetLeads = Math.max(0, Math.round(channelInputs?.expected_leads ?? 0));
  const qPct = channelInputs?.qualification_percent ?? 0;
  const targetQualifiedLeads = Math.max(0, Math.round(targetLeads * (qPct / 100)));

  return { dealsRequired, channelDealsRequired, targetLeads, targetQualifiedLeads, qualifiedMeetingsRequired };
}

export function ChannelReport(props: { projectId: string; channel: PlanChannel }) {
  const { projectId, channel } = props;

  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(11);
  const month = useMemo(() => monthNumber(selectedMonthIndex), [selectedMonthIndex]);
  const monthLabel = useMemo(() => `${MONTHS[selectedMonthIndex]} ${selectedYear}`, [selectedMonthIndex, selectedYear]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [targets, setTargets] = useState<ProjectTargets | null>(null);
  const [activePlanVersion, setActivePlanVersion] = useState<PlanVersion | null>(null);
  const [channelInputs, setChannelInputs] = useState<PlanChannelInputs | null>(null);
  const [actuals, setActuals] = useState<ProjectActuals | null>(null);
  const [status, setStatus] = useState<string>("");

  const envMissing =
    typeof window !== "undefined" &&
    (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (envMissing) return;
      try {
        const projs = await listProjects();
        if (cancelled) return;
        setProjects(projs);
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load projects");
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [envMissing]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!projectId || envMissing) return;
      try {
        setStatus("");
        const [t, versions, a] = await Promise.all([
          getProjectTargets(projectId, selectedYear, month),
          listPlanVersions(projectId, selectedYear, month),
          getProjectActuals(projectId, selectedYear, month)
        ]);

        const active = versions.find((v) => v.active && v.status === "approved") ?? null;
        const inputs = active ? await getPlanChannelInputs(active.id) : [];
        const row = (inputs ?? []).find((r) => r.channel === channel) ?? null;

        if (cancelled) return;
        setTargets(t);
        setActivePlanVersion(active);
        setChannelInputs(row);
        setActuals(a);
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load report data");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [channel, envMissing, month, projectId, selectedMonthIndex, selectedYear]);

  const computed = useMemo(() => computeTargetsFrom(targets, channelInputs), [targets, channelInputs]);
  const projectName = projects.find((p) => p.id === projectId)?.name ?? "—";

  const budgetAllocated = channelInputs?.allocated_budget ?? 0;
  const leads = actuals?.leads ?? 0;
  const qualified = actuals?.qualified_leads ?? 0;
  const meetings = actuals?.meetings_done ?? 0;

  const leadToQualifiedPct = clampPercent((qualified / Math.max(leads, 1)) * 100);
  const qualifiedToMeetingPct = clampPercent((meetings / Math.max(qualified, 1)) * 100);

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-6xl">
        <PageShell>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="text-2xl font-semibold tracking-tight text-white/95">
                {channelLabel(channel)} – Report
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-sm text-white/60">{projectName}</div>
                <span className="h-1 w-1 rounded-full bg-white/25" />
                <MonthYearPicker
                  monthIndex={selectedMonthIndex}
                  year={selectedYear}
                  label={monthLabel}
                  onChange={(next) => {
                    setSelectedMonthIndex(next.monthIndex);
                    setSelectedYear(next.year);
                  }}
                />
              </div>
              {status ? <div className="text-sm text-amber-200/90">{status}</div> : null}
            </div>

            <div className="flex items-center gap-2">
              <Button as={Link} href={`/projects/${projectId}`} size="sm" variant="flat" className="glass-inset text-white/80">
                Back to project
              </Button>
              <Button as={Link} href="/" size="sm" variant="flat" className="glass-inset text-white/80">
                Home
              </Button>
            </div>
          </div>

          {!activePlanVersion ? (
            <div className="mt-6">
              <Surface>
                <div className="text-sm text-white/70">No active approved plan version found for this project/month yet.</div>
              </Surface>
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <KpiCard label="Budget allocated" value={formatPKRCompact(budgetAllocated)} helper="From approved plan" />
            <KpiCard label="Expected leads" value={formatNumber(channelInputs?.expected_leads ?? 0)} helper="From plan" />
            <KpiCard
              label="Qualification %"
              value={`${channelInputs?.qualification_percent ?? 0}%`}
              helper="From plan"
            />
            <KpiCard
              label="% target contribution"
              value={`${channelInputs?.target_contribution_percent ?? 0}%`}
              helper="From plan"
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <KpiCard label="Leads (actual)" value={formatNumber(leads)} helper={`${formatNumber(computed.targetLeads)} target`} />
            <KpiCard
              label="Qualified (actual)"
              value={formatNumber(qualified)}
              helper={`${leadToQualifiedPct.toFixed(0)}% of leads`}
            />
            <KpiCard
              label="Meetings done (actual)"
              value={formatNumber(meetings)}
              helper={`${qualifiedToMeetingPct.toFixed(0)}% of qualified`}
            />
            <KpiCard label="Deals required" value={formatNumber(computed.channelDealsRequired)} helper="Computed from sales target" />
          </div>
        </PageShell>
      </div>
    </main>
  );
}

