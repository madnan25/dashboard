"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { MonthYearPicker } from "@/components/ds/MonthYearPicker";
import { KpiCard } from "@/components/ds/KpiCard";
import { PageShell, Surface } from "@/components/ds/Surface";
import { MONTHS } from "@/lib/digitalSnapshot";
import { formatNumber, formatPKRCompact } from "@/lib/format";
import {
  PlanChannel,
  PlanChannelInputs,
  PlanVersion,
  Project,
  ProjectActuals,
  ProjectTargets,
  getCurrentProfile,
  getPlanChannelInputs,
  getProjectActuals,
  getProjectTargets,
  listPlanVersions,
  listProjects
} from "@/lib/dashboardDb";

function monthNumber(monthIndex: number) {
  return monthIndex + 1;
}

const CHANNELS: PlanChannel[] = ["digital", "inbound", "activations"];

function channelLabel(ch: PlanChannel) {
  switch (ch) {
    case "digital":
      return "Digital";
    case "inbound":
      return "Inbound";
    case "activations":
      return "Activations";
  }
}

export function ProjectHub(props: { projectId: string }) {
  const projectId = props.projectId;

  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(11);
  const month = useMemo(() => monthNumber(selectedMonthIndex), [selectedMonthIndex]);
  const monthLabel = useMemo(() => `${MONTHS[selectedMonthIndex]} ${selectedYear}`, [selectedMonthIndex, selectedYear]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectName, setProjectName] = useState("—");
  const [targets, setTargets] = useState<ProjectTargets | null>(null);
  const [activePlanVersion, setActivePlanVersion] = useState<PlanVersion | null>(null);
  const [inputsByChannel, setInputsByChannel] = useState<Record<PlanChannel, PlanChannelInputs | null>>({
    digital: null,
    inbound: null,
    activations: null
  });
  const [actuals, setActuals] = useState<ProjectActuals | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  const envMissing =
    typeof window !== "undefined" &&
    (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (envMissing) return;
      try {
        const [p, projs] = await Promise.all([getCurrentProfile(), listProjects()]);
        if (cancelled) return;
        setRole(p?.role ?? null);
        setProjects(projs);
        setProjectName(projs.find((x) => x.id === projectId)?.name ?? "—");
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load project");
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [envMissing, projectId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (envMissing) return;
      try {
        setStatus("");
        const [t, versions, a] = await Promise.all([
          getProjectTargets(projectId, selectedYear, month),
          listPlanVersions(projectId, selectedYear, month),
          getProjectActuals(projectId, selectedYear, month)
        ]);

        const active = versions.find((v) => v.active && v.status === "approved") ?? null;
        const inputs = active ? await getPlanChannelInputs(active.id) : [];

        if (cancelled) return;

        setTargets(t);
        setActivePlanVersion(active);
        setActuals(a);

        const map: Record<PlanChannel, PlanChannelInputs | null> = { digital: null, inbound: null, activations: null };
        for (const row of inputs ?? []) map[row.channel] = row;
        setInputsByChannel(map);
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load project data");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [envMissing, month, projectId, selectedMonthIndex, selectedYear]);

  const totalBudgetCap = targets?.total_budget ?? 0;
  const allocatedBudgetTotal = CHANNELS.reduce((sum, ch) => sum + (inputsByChannel[ch]?.allocated_budget ?? 0), 0);
  const remainingBudget = Math.max(0, totalBudgetCap - allocatedBudgetTotal);

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageShell>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-2xl font-semibold tracking-tight text-white/95">{projectName}</div>
              <div className="text-sm text-white/55">Master dashboard for this project.</div>
            </div>
            <div className="flex items-center gap-2">
              <MonthYearPicker
                monthIndex={selectedMonthIndex}
                year={selectedYear}
                label={monthLabel}
                onChange={(next) => {
                  setSelectedMonthIndex(next.monthIndex);
                  setSelectedYear(next.year);
                }}
              />
              <Button as={Link} href="/projects" size="sm" variant="flat" className="glass-inset text-white/80">
                All projects
              </Button>
              <Button as={Link} href="/" size="sm" variant="flat" className="glass-inset text-white/80">
                Home
              </Button>
            </div>
          </div>
        </PageShell>

        {status ? (
          <Surface>
            <div className="text-sm text-amber-200/90">{status}</div>
          </Surface>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard label="Sales target (sqft)" value={formatNumber(targets?.sales_target_sqft ?? 0)} />
          <KpiCard label="Avg deal size (sqft)" value={formatNumber(targets?.avg_sqft_per_deal ?? 0)} />
          <KpiCard label="Budget cap" value={formatPKRCompact(totalBudgetCap)} />
          <KpiCard
            label="Allocated / remaining"
            value={formatPKRCompact(allocatedBudgetTotal)}
            helper={`${formatPKRCompact(remainingBudget)} remaining`}
          />
        </div>

        <Surface>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white/90">Reports</div>
              <div className="mt-1 text-sm text-white/55">Digital, Inbound, and Activations drilldowns.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button as={Link} href={`/projects/${projectId}/digital`} color="primary">
                Digital Report
              </Button>
              <Button as={Link} href={`/projects/${projectId}/inbound`} variant="flat" className="glass-inset text-white/80">
                Inbound Report
              </Button>
              <Button
                as={Link}
                href={`/projects/${projectId}/activations`}
                variant="flat"
                className="glass-inset text-white/80"
              >
                Activations Report
              </Button>
            </div>
          </div>
        </Surface>

        <div className="grid gap-4 md:grid-cols-12">
          <Surface className="md:col-span-7">
            <div className="text-lg font-semibold text-white/90">Plan allocations (approved)</div>
            <div className="mt-1 text-sm text-white/55">
              {activePlanVersion ? "Active approved plan is applied." : "No active approved plan for this month yet."}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {CHANNELS.map((ch) => (
                <div key={ch} className="glass-inset rounded-2xl p-4">
                  <div className="text-sm font-semibold text-white/85">{channelLabel(ch)}</div>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="flex items-center justify-between text-white/70">
                      <span>Budget</span>
                      <span className="font-semibold text-white/90">{formatPKRCompact(inputsByChannel[ch]?.allocated_budget ?? 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-white/70">
                      <span>% target</span>
                      <span className="font-semibold text-white/90">{inputsByChannel[ch]?.target_contribution_percent ?? 0}%</span>
                    </div>
                    <div className="flex items-center justify-between text-white/70">
                      <span>Expected leads</span>
                      <span className="font-semibold text-white/90">{formatNumber(inputsByChannel[ch]?.expected_leads ?? 0)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Surface>

          <Surface className="md:col-span-5">
            <div className="text-lg font-semibold text-white/90">Actuals (Sales Ops)</div>
            <div className="mt-1 text-sm text-white/55">Month-level actual performance.</div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <KpiCard label="Leads" value={formatNumber(actuals?.leads ?? 0)} />
              <KpiCard label="Qualified" value={formatNumber(actuals?.qualified_leads ?? 0)} />
              <KpiCard label="Meetings scheduled" value={formatNumber(actuals?.meetings_scheduled ?? 0)} />
              <KpiCard label="Meetings done" value={formatNumber(actuals?.meetings_done ?? 0)} />
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
        </div>
      </div>
    </main>
  );
}

