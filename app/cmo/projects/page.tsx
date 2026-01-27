"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { PageHeader } from "@/components/ds/PageHeader";
import { MonthYearPicker } from "@/components/ds/MonthYearPicker";
import { Surface } from "@/components/ds/Surface";
import { CmoApprovalsPanel } from "@/components/features/cmo/CmoApprovalsPanel";
import { CmoProjectsPanel } from "@/components/features/cmo/CmoProjectsPanel";
import { CmoTargetsPanel } from "@/components/features/cmo/CmoTargetsPanel";
import { CmoUsersPanel } from "@/components/features/cmo/CmoUsersPanel";
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
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [monthIndex, setMonthIndex] = useState(() => new Date().getMonth());
  const month = useMemo(() => monthNumber(monthIndex), [monthIndex]);
  const monthLabel = useMemo(() => `${MONTHS[monthIndex]} ${year}`, [monthIndex, year]);

  const [status, setStatus] = useState<string>("");
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [intelligenceSyncTime, setIntelligenceSyncTime] = useState("12:00");
  const [intelligenceSyncMeta, setIntelligenceSyncMeta] = useState<{
    timezone: string;
    schedule_utc: string | null;
    updated_at: string | null;
  } | null>(null);
  const [intelligenceSyncStatus, setIntelligenceSyncStatus] = useState<string>("");
  const [intelligenceSyncSaving, setIntelligenceSyncSaving] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");

  const [newProjectName, setNewProjectName] = useState("");

  const [targets, setTargets] = useState<ProjectTargets | null>(null);
  const [targetsForm, setTargetsForm] = useState({
    sales_target_sqft: "0",
    avg_sqft_per_deal: "0",
    total_budget: "0",
    qualified_to_meeting_done_percent: "10",
    meeting_done_to_close_percent: "40"
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
      total_budget: String(t?.total_budget ?? 0),
      qualified_to_meeting_done_percent: String(t?.qualified_to_meeting_done_percent ?? 10),
      meeting_done_to_close_percent: String(t?.meeting_done_to_close_percent ?? 40)
    });
  }

  async function loadIntelligenceSync() {
    setIntelligenceSyncStatus("");
    try {
      const res = await fetch("/api/cmo/intelligence-sync", { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as
        | null
        | { error?: string; sync_time?: string; timezone?: string; schedule_utc?: string | null; updated_at?: string | null };
      if (!res.ok || !body || body.error) throw new Error(body?.error || "Failed to load sync settings");
      if (typeof body.sync_time === "string" && body.sync_time) setIntelligenceSyncTime(body.sync_time);
      setIntelligenceSyncMeta({
        timezone: typeof body.timezone === "string" ? body.timezone : "Asia/Karachi",
        schedule_utc: (body.schedule_utc as string | null) ?? null,
        updated_at: (body.updated_at as string | null) ?? null
      });
    } catch (e) {
      setIntelligenceSyncStatus(e instanceof Error ? e.message : "Failed to load sync settings");
      setIntelligenceSyncMeta(null);
    }
  }

  async function onSaveIntelligenceSync() {
    setIntelligenceSyncStatus("");
    setIntelligenceSyncSaving(true);
    try {
      const res = await fetch("/api/cmo/intelligence-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sync_time: intelligenceSyncTime, timezone: "Asia/Karachi" })
      });
      const body = (await res.json().catch(() => null)) as
        | null
        | { ok?: boolean; error?: string; sync_time?: string; timezone?: string; schedule_utc?: string | null; updated_at?: string | null };
      if (!res.ok || !body || body.error) throw new Error(body?.error || "Failed to update schedule");
      setIntelligenceSyncStatus("Saved.");
      if (typeof body.sync_time === "string" && body.sync_time) setIntelligenceSyncTime(body.sync_time);
      setIntelligenceSyncMeta({
        timezone: typeof body.timezone === "string" ? body.timezone : "Asia/Karachi",
        schedule_utc: (body.schedule_utc as string | null) ?? null,
        updated_at: (body.updated_at as string | null) ?? null
      });
    } catch (e) {
      setIntelligenceSyncStatus(e instanceof Error ? e.message : "Failed to update schedule");
    } finally {
      setIntelligenceSyncSaving(false);
    }
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
        if (p?.role === "cmo") {
          await loadIntelligenceSync();
        }
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
          total_budget: String(t?.total_budget ?? 0),
          qualified_to_meeting_done_percent: String(t?.qualified_to_meeting_done_percent ?? 10),
          meeting_done_to_close_percent: String(t?.meeting_done_to_close_percent ?? 40)
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
    const qualified_to_meeting_done_percent = toNumber(targetsForm.qualified_to_meeting_done_percent);
    const meeting_done_to_close_percent = toNumber(targetsForm.meeting_done_to_close_percent);
    if (sales_target_sqft == null || avg_sqft_per_deal == null || total_budget == null) {
      setStatus("Please enter valid numbers for targets.");
      return;
    }
    if (qualified_to_meeting_done_percent == null || meeting_done_to_close_percent == null) {
      setStatus("Please enter valid funnel rates.");
      return;
    }
    if (qualified_to_meeting_done_percent < 0 || qualified_to_meeting_done_percent > 100 || meeting_done_to_close_percent < 0 || meeting_done_to_close_percent > 100) {
      setStatus("Funnel rates must be between 0 and 100.");
      return;
    }
    try {
      setStatus("Saving targets...");
      await upsertProjectTargets({
        project_id: projectId,
        year,
        month,
        sales_target_sqft,
        avg_sqft_per_deal,
        total_budget,
        qualified_to_meeting_done_percent,
        meeting_done_to_close_percent
      });
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
    if (!confirm("Delete this plan version? Only draft/rejected plans can be deleted. This cannot be undone.")) return;
    try {
      setStatus("Deleting...");
      await purgeDraftPlanVersion(versionId);
      setStatus("Deleted.");
      await refreshVersions();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete";
      setStatus(msg);
      // Make failures impossible to miss
      alert(msg);
    }
  }

  if (envMissing) {
    return (
      <main className="min-h-screen p-4 md:p-6">
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
      <main className="min-h-screen p-4 md:p-6">
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
    <main className="min-h-screen px-4 md:px-6 pb-10">
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

        {status ? (
          <Surface>
            <div className="text-sm text-white/60">{status}</div>
          </Surface>
        ) : null}

        <Surface>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-white/45">Intelligence Desk sync</div>
              <div className="mt-1 text-sm text-white/80">Controls the daily cached snapshot used by Intelligence Desk.</div>
              <div className="mt-1 text-xs text-white/50">
                Timezone: <span className="text-white/70">PKT (Asia/Karachi)</span>
                {intelligenceSyncMeta?.schedule_utc ? (
                  <>
                    {" "}
                    • UTC schedule: <span className="text-white/70">{intelligenceSyncMeta.schedule_utc}</span>
                  </>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={intelligenceSyncTime}
                onChange={(e) => setIntelligenceSyncTime(e.target.value)}
                className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white/85 outline-none focus:border-white/20"
              />
              <Button
                color="primary"
                onPress={() => void onSaveIntelligenceSync()}
                isDisabled={intelligenceSyncSaving || !/^\d{2}:\d{2}$/.test(intelligenceSyncTime)}
              >
                {intelligenceSyncSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
          {intelligenceSyncStatus ? (
            <div className="mt-2 text-xs text-white/55">{intelligenceSyncStatus}</div>
          ) : null}
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
              targets={targets}
              planVersions={planVersions}
              onApprove={onApprove}
              onReject={onReject}
              onDelete={onDelete}
            />
          </div>
        </div>

        <CmoUsersPanel onStatus={setStatus} />
      </div>
    </main>
  );
}

