"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, Input } from "@heroui/react";
import { MonthYearPicker } from "@/components/ds/MonthYearPicker";
import { NumberInput } from "@/components/ds/NumberInput";
import { PageShell, Surface } from "@/components/ds/Surface";
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
            <div className="mt-4">
              <Button as={Link} href="/" variant="flat" className="glass-inset text-white/80">
                Back to home
              </Button>
            </div>
          </Surface>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageShell>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-2xl font-semibold tracking-tight text-white/95">CMO – Projects</div>
              <div className="text-sm text-white/55">Create projects, and set targets/budget per month.</div>
            </div>
            <div className="flex items-center gap-2">
              <MonthYearPicker
                monthIndex={monthIndex}
                year={year}
                label={monthLabel}
                onChange={(next) => {
                  setMonthIndex(next.monthIndex);
                  setYear(next.year);
                }}
              />
              <Button as={Link} href="/" size="sm" variant="flat" className="glass-inset text-white/80">
                Back to home
              </Button>
            </div>
          </div>
        </PageShell>

        <Surface>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-white/60">{status || " "}</div>
            <Button as={Link} href={`/projects/${projectId}`} variant="flat" className="glass-inset text-white/80">
              Open project hub
            </Button>
          </div>
        </Surface>

        <div className="grid gap-4 md:grid-cols-12">
          <Surface className="md:col-span-5">
            <div className="text-lg font-semibold text-white/90">Projects</div>
            <div className="mt-1 text-sm text-white/55">Only active projects should be used for planning/reporting.</div>

            <div className="mt-4 flex gap-2">
              <Input
                value={newProjectName}
                onValueChange={setNewProjectName}
                placeholder="New project name"
                variant="bordered"
                classNames={{
                  inputWrapper: "glass-inset rounded-2xl border-white/10 bg-white/[0.02]",
                  input: "text-white/90 placeholder:text-white/25"
                }}
              />
              <Button color="primary" onPress={onCreateProject} isDisabled={!newProjectName.trim()}>
                Create
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {projects.length === 0 ? (
                <div className="text-sm text-white/60">No projects yet.</div>
              ) : (
                projects.map((p) => (
                  <div
                    key={p.id}
                    className={[
                      "group relative w-full overflow-hidden rounded-2xl border text-left transition",
                      "hover:-translate-y-[1px] hover:border-white/15 hover:bg-white/[0.03]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0",
                      p.id === projectId
                        ? "border-white/25 bg-white/[0.035] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_14px_50px_rgba(59,130,246,0.12)]"
                        : "border-white/5 bg-white/[0.02]"
                    ].join(" ")}
                    role="option"
                    tabIndex={0}
                    aria-selected={p.id === projectId}
                    onClick={() => setProjectId(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setProjectId(p.id);
                      }
                    }}
                  >
                    {/* selected accent */}
                    <div
                      aria-hidden="true"
                      className={[
                        "pointer-events-none absolute inset-0 opacity-0 transition-opacity",
                        p.id === projectId ? "opacity-100" : "group-hover:opacity-60"
                      ].join(" ")}
                      style={{
                        background:
                          "radial-gradient(600px 120px at 20% 0%, rgba(59,130,246,0.22), transparent 60%), radial-gradient(600px 120px at 85% 100%, rgba(124,58,237,0.18), transparent 60%)"
                      }}
                    />

                    <div className="flex items-center justify-between gap-3">
                      <div className="relative p-3">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-white/90">{p.name}</div>
                          {p.id === projectId ? (
                            <span className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/75">
                              Selected
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs text-white/45">ID: {p.id.slice(0, 8)}…</div>
                      </div>
                      <div className="relative flex items-center gap-2 pr-3">
                        <div
                          className={[
                            "rounded-full border px-2 py-0.5 text-[11px]",
                            p.is_active
                              ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-200"
                              : "border-white/10 bg-white/[0.03] text-white/50"
                          ].join(" ")}
                        >
                          {p.is_active ? "Active" : "Inactive"}
                        </div>
                        <Button
                          size="sm"
                          variant="flat"
                          className="glass-inset text-white/80"
                          onPress={(ev) => {
                            // don't change selection when toggling
                            // @ts-expect-error heroui event type
                            ev?.stopPropagation?.();
                            onToggleActive(p.id, !p.is_active);
                          }}
                        >
                          {p.is_active ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Surface>

          <div className="md:col-span-7 grid gap-4">
            <Surface>
              <div className="text-lg font-semibold text-white/90">Targets & Budget</div>
              <div className="mt-1 text-sm text-white/55">
                For {monthLabel}. Brand team will allocate budgets across Digital, Inbound, Activations (cannot exceed cap).
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <NumberInput
                  label="Sales target"
                  unit="sqft"
                  value={targetsForm.sales_target_sqft}
                  onValueChange={(v) => setTargetsForm((s) => ({ ...s, sales_target_sqft: v }))}
                />
                <NumberInput
                  label="Avg sqft per deal"
                  unit="sqft"
                  value={targetsForm.avg_sqft_per_deal}
                  onValueChange={(v) => setTargetsForm((s) => ({ ...s, avg_sqft_per_deal: v }))}
                />
                <NumberInput
                  label="Total budget cap"
                  unit="PKR"
                  value={targetsForm.total_budget}
                  onValueChange={(v) => setTargetsForm((s) => ({ ...s, total_budget: v }))}
                />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-xs text-white/45">
                  Last saved: {targets ? `${targets.month}/${targets.year}` : "—"}
                </div>
                <Button color="primary" onPress={onSaveTargets} isDisabled={!projectId}>
                  Save targets
                </Button>
              </div>
            </Surface>

            <Surface>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-white/90">Approvals</div>
                  <div className="mt-1 text-sm text-white/55">
                    Brand Managers must <span className="text-white/80">Submit for approval</span> from{" "}
                    <Link className="underline text-white/75" href="/brand/data-entry">
                      Data Entry
                    </Link>
                    . Only <span className="text-white/80">SUBMITTED</span> plans can be approved/rejected.
                  </div>
                </div>
                <Button as={Link} href="/brand/data-entry" size="sm" variant="flat" className="glass-inset text-white/80">
                  Open data entry
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {planVersions.filter((v) => v.status === "submitted").length === 0 ? (
                  <div className="glass-inset rounded-xl p-4 text-sm text-white/60">
                    No submitted plans for this project/month yet.
                  </div>
                ) : null}

                {planVersions.map((v) => {
                  const tone =
                    v.status === "approved"
                      ? "border-emerald-300/20 bg-emerald-500/10"
                      : v.status === "submitted"
                        ? "border-blue-300/20 bg-blue-500/10"
                        : v.status === "rejected"
                          ? "border-red-300/20 bg-red-500/10"
                          : "border-white/10 bg-white/[0.03]";

                  return (
                    <div key={v.id} className={`rounded-2xl border ${tone} p-4`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="text-sm text-white/80">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-white/90">{v.status.toUpperCase()}</div>
                            {v.active ? (
                              <span className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/75">
                                ACTIVE
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-white/55">Created: {new Date(v.created_at).toLocaleString()}</div>
                          <div className="text-white/55">ID: {v.id.slice(0, 8)}…</div>
                        </div>

                        <div className="flex items-center gap-2">
                          {v.status === "submitted" ? (
                            <>
                              <Button color="primary" onPress={() => onApprove(v.id)}>
                                Approve
                              </Button>
                              <Button variant="flat" className="glass-inset text-white/80" onPress={() => onReject(v.id)}>
                                Reject
                              </Button>
                            </>
                          ) : (
                            <Button as={Link} href={`/brand/data-entry`} variant="flat" className="glass-inset text-white/80">
                              View / edit
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Surface>
          </div>
        </div>
      </div>
    </main>
  );
}

