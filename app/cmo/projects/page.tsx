"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, Input } from "@heroui/react";
import { PageHeader } from "@/components/ds/PageHeader";
import { MonthYearPicker } from "@/components/ds/MonthYearPicker";
import { Surface } from "@/components/ds/Surface";
import { CmoApprovalsPanel } from "@/components/features/cmo/CmoApprovalsPanel";
import { CmoProjectsPanel } from "@/components/features/cmo/CmoProjectsPanel";
import { CmoTargetsPanel } from "@/components/features/cmo/CmoTargetsPanel";
import { MONTHS } from "@/lib/digitalSnapshot";
import {
  Project,
  ProjectTargets,
  PlanVersion,
  approvePlanVersion,
  createProject,
  getCurrentProfile,
  getProjectTargets,
  listPlanVersions,
  listProjects,
  purgeDraftPlanVersion,
  rejectPlanVersion,
  updateProject,
  upsertProjectTargets
} from "@/lib/dashboardDb";

function monthNumber(monthIndex: number) {
  return monthIndex + 1;
}

function toNumber(value: string) {
  const v = Number(value);
  return Number.isFinite(v) ? v : null;
}

export default function CmoProjectsPage() {
  const [year, setYear] = useState(2025);
  const [monthIndex, setMonthIndex] = useState(11);
  const month = useMemo(() => monthNumber(monthIndex), [monthIndex]);
  const monthLabel = useMemo(() => `${MONTHS[monthIndex]} ${year}`, [monthIndex, year]);

  const [status, setStatus] = useState<string>("");
  const [profileRole, setProfileRole] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");

  const [newProjectName, setNewProjectName] = useState("");

  const [targets, setTargets] = useState<ProjectTargets | null>(null);
  const [targetsForm, setTargetsForm] = useState({
    sales_target_sqft: "0",
    avg_sqft_per_deal: "0",
    total_budget: "0"
  });

  const [planVersions, setPlanVersions] = useState<PlanVersion[]>([]);

  const envMissing =
    typeof window !== "undefined" &&
    (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  async function refreshProjects(nextProjectId?: string) {
    const projs = await listProjects();
    setProjects(projs);
    if (nextProjectId) setProjectId(nextProjectId);
    else if (!projectId && projs.length > 0) setProjectId(projs[0]!.id);
  }

  async function refreshTargets(pid: string) {
    const t = await getProjectTargets(pid, year, month);
    setTargets(t);
    setTargetsForm({
      sales_target_sqft: String(t?.sales_target_sqft ?? 0),
      avg_sqft_per_deal: String(t?.avg_sqft_per_deal ?? 0),
      total_budget: String(t?.total_budget ?? 0)
    });
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (envMissing) return;
      try {
        const [p, projs] = await Promise.all([getCurrentProfile(), listProjects()]);
        if (cancelled) return;
        setProfileRole(p?.role ?? null);
        setProjects(projs);
        if (!projectId && projs.length > 0) setProjectId(projs[0]!.id);
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load");
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envMissing]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!projectId || envMissing) return;
      try {
        const [t, versions] = await Promise.all([
          getProjectTargets(projectId, year, month),
          listPlanVersions(projectId, year, month)
        ]);
        if (cancelled) return;
        setTargets(t);
        setTargetsForm({
          sales_target_sqft: String(t?.sales_target_sqft ?? 0),
          avg_sqft_per_deal: String(t?.avg_sqft_per_deal ?? 0),
          total_budget: String(t?.total_budget ?? 0)
        });
        setPlanVersions(versions);
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load targets");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [envMissing, month, projectId, year]);

  async function onCreateProject() {
    setStatus("");
    try {
      setStatus("Creating project...");
      const created = await createProject(newProjectName);
      setNewProjectName("");
      await refreshProjects(created.id);
      setStatus("Project created.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to create project");
    }
  }

  async function onToggleActive(pid: string, next: boolean) {
    setStatus("");
    try {
      setStatus("Saving...");
      await updateProject(pid, { is_active: next });
      await refreshProjects();
      setStatus("Saved.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to update project");
    }
  }

  async function onSaveTargets() {
    if (!projectId) return;
    setStatus("");
    const sales_target_sqft = toNumber(targetsForm.sales_target_sqft);
    const avg_sqft_per_deal = toNumber(targetsForm.avg_sqft_per_deal);
    const total_budget = toNumber(targetsForm.total_budget);
    if (sales_target_sqft == null || avg_sqft_per_deal == null || total_budget == null) {
      setStatus("Please enter valid numbers for targets.");
      return;
    }
    try {
      setStatus("Saving targets...");
      await upsertProjectTargets({ project_id: projectId, year, month, sales_target_sqft, avg_sqft_per_deal, total_budget });
      setStatus("Targets saved.");
      await refreshTargets(projectId);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to save targets");
    }
  }

  async function refreshVersions() {
    if (!projectId) return;
    const versions = await listPlanVersions(projectId, year, month);
    setPlanVersions(versions);
  }

  async function onApprove(versionId: string) {
    try {
      setStatus("Approving...");
      await approvePlanVersion(versionId);
      setStatus("Approved and activated.");
      await refreshVersions();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to approve");
    }
  }

  async function onReject(versionId: string) {
    try {
      setStatus("Rejecting...");
      await rejectPlanVersion(versionId);
      setStatus("Rejected.");
      await refreshVersions();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to reject");
    }
  }

  async function onDelete(versionId: string) {
    if (!confirm("Delete this draft? This cannot be undone.")) return;
    try {
      setStatus("Deleting...");
      await purgeDraftPlanVersion(versionId);
      setStatus("Deleted.");
      await refreshVersions();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  if (envMissing) {
    return (
      <main className="min-h-screen p-6">
        <div className="mx-auto w-full max-w-4xl">
          <Surface>
            <div className="text-sm text-amber-200/90">
              Supabase env vars are missing. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
            </div>
          </Surface>
        </div>
      </main>
    );
  }

  if (profileRole && profileRole !== "cmo") {
    return (
      <main className="min-h-screen p-6">
        <div className="mx-auto w-full max-w-4xl space-y-4">
          <Surface>
            <div className="text-lg font-semibold text-white/90">CMO only</div>
            <div className="mt-2 text-sm text-white/60">You don’t have access to manage projects.</div>
          </Surface>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 pb-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader
          title="CMO Console"
          subtitle="Projects, targets/budget, approvals."
          showBack
          right={
            <MonthYearPicker
              monthIndex={monthIndex}
              year={year}
              label={monthLabel}
              onChange={(next) => {
                setMonthIndex(next.monthIndex);
                setYear(next.year);
              }}
            />
          }
        />

        <Surface>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-white/60">{status || " "}</div>
            <Button as={Link} href={`/projects/${projectId}`} variant="flat" className="glass-inset text-white/80">
              Open project hub
            </Button>
          </div>
        </Surface>

        <div className="grid gap-4 md:grid-cols-12">
          <CmoProjectsPanel
            projects={projects}
            projectId={projectId}
            onSelectProject={setProjectId}
            onToggleActive={onToggleActive}
            newProjectName={newProjectName}
            setNewProjectName={setNewProjectName}
            onCreateProject={onCreateProject}
          />

          <div className="md:col-span-7 grid gap-4">
            <CmoTargetsPanel
              monthLabel={monthLabel}
              targets={targets}
              targetsForm={targetsForm}
              setTargetsForm={setTargetsForm}
              onSaveTargets={onSaveTargets}
              isDisabled={!projectId}
            />
            <CmoApprovalsPanel
              monthLabel={monthLabel}
              planVersions={planVersions}
              onApprove={onApprove}
              onReject={onReject}
              onDelete={onDelete}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

