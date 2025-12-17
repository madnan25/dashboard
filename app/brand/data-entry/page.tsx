"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { PageShell, Surface } from "@/components/ds/Surface";
import { MonthYearPicker } from "@/components/ds/MonthYearPicker";
import { NumberInput } from "@/components/ds/NumberInput";
import { MONTHS } from "@/lib/digitalSnapshot";
import {
  PlanChannel,
  PlanChannelInputs,
  PlanVersion,
  Profile,
  Project,
  ProjectActuals,
  ProjectTargets,
  approvePlanVersion,
  createDraftPlanVersion,
  getCurrentProfile,
  getPlanChannelInputs,
  getProjectActuals,
  getProjectTargets,
  listPlanVersions,
  listProjects,
  rejectPlanVersion,
  updatePlanVersionStatus,
  upsertPlanChannelInputs,
  upsertProjectActuals,
  upsertProjectTargets
} from "@/lib/dashboardDb";

function toNumber(value: string) {
  const v = Number(value);
  return Number.isFinite(v) ? v : null;
}

function monthNumber(monthIndex: number) {
  return monthIndex + 1; // 1-12
}

const CHANNELS: PlanChannel[] = ["digital", "activations", "inbound"];

function channelLabel(channel: PlanChannel) {
  switch (channel) {
    case "digital":
      return "Digital";
    case "activations":
      return "Activations";
    case "inbound":
      return "Inbound";
  }
}

function planDisplayName(monthLabel: string, status: PlanVersion["status"], active: boolean) {
  if (status === "approved") return `${monthLabel} – Approved plan`;
  if (status === "submitted") return `${monthLabel} – Submitted for approval`;
  if (status === "rejected") return `${monthLabel} – Rejected plan`;
  if (active) return `${monthLabel} – Active plan`;
  return `${monthLabel} – Draft plan`;
}

type ChannelForm = {
  expected_leads: string;
  qualification_percent: string;
  target_contribution_percent: string;
  allocated_budget: string;
};

function emptyChannelForm(): ChannelForm {
  return {
    expected_leads: "0",
    qualification_percent: "0",
    target_contribution_percent: "0",
    allocated_budget: "0"
  };
}

export default function BrandDataEntryPage() {
  const [year, setYear] = useState(2025);
  const [monthIndex, setMonthIndex] = useState(11);
  const monthLabel = useMemo(() => `${MONTHS[monthIndex]} ${year}`, [monthIndex, year]);
  const month = useMemo(() => monthNumber(monthIndex), [monthIndex]);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");

  const [targets, setTargets] = useState<ProjectTargets | null>(null);
  const [targetsForm, setTargetsForm] = useState({
    sales_target_sqft: "0",
    avg_sqft_per_deal: "0",
    total_budget: "0"
  });

  const [planVersions, setPlanVersions] = useState<PlanVersion[]>([]);
  const [activePlanVersionId, setActivePlanVersionId] = useState<string | null>(null);

  const [channelInputs, setChannelInputs] = useState<Record<PlanChannel, ChannelForm>>({
    digital: emptyChannelForm(),
    activations: emptyChannelForm(),
    inbound: emptyChannelForm()
  });

  const [actuals, setActuals] = useState<ProjectActuals | null>(null);
  const [actualsForm, setActualsForm] = useState({
    leads: "0",
    qualified_leads: "0",
    meetings_scheduled: "0",
    meetings_done: "0",
    deals_won: "0",
    sqft_won: "0",
    spend_digital: "0",
    spend_inbound: "0",
    spend_activations: "0"
  });

  const [status, setStatus] = useState<string>("");

  const envMissing =
    typeof window !== "undefined" &&
    (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const [p, projs] = await Promise.all([getCurrentProfile(), listProjects()]);
        if (cancelled) return;
        setProfile(p);
        setProjects(projs);
        if (!projectId && projs.length > 0) setProjectId(projs[0]!.id);
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load profile/projects");
      }
    }
    if (!envMissing) boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envMissing]);

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      if (!projectId || envMissing) return;
      try {
        setStatus("");
        const [t, versions, a] = await Promise.all([
          getProjectTargets(projectId, year, month),
          listPlanVersions(projectId, year, month),
          getProjectActuals(projectId, year, month)
        ]);
        if (cancelled) return;

        setTargets(t);
        setTargetsForm({
          sales_target_sqft: String(t?.sales_target_sqft ?? 0),
          avg_sqft_per_deal: String(t?.avg_sqft_per_deal ?? 0),
          total_budget: String(t?.total_budget ?? 0)
        });

        setPlanVersions(versions);

        // Pick an "active" plan version for the current user to edit/view.
        const preferred =
          profile?.role === "brand_manager"
            ? versions.find((v) => v.created_by === profile.id && (v.status === "draft" || v.status === "rejected"))
            : versions[0];
        setActivePlanVersionId(preferred?.id ?? null);

        setActuals(a);
        setActualsForm({
          leads: String(a?.leads ?? 0),
          qualified_leads: String(a?.qualified_leads ?? 0),
          meetings_scheduled: String(a?.meetings_scheduled ?? 0),
          meetings_done: String(a?.meetings_done ?? 0),
          deals_won: String(a?.deals_won ?? 0),
          sqft_won: String(a?.sqft_won ?? 0),
          spend_digital: String(a?.spend_digital ?? 0),
          spend_inbound: String(a?.spend_inbound ?? 0),
          spend_activations: String(a?.spend_activations ?? 0)
        });
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load data");
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [envMissing, month, projectId, profile?.id, profile?.role, year]);

  useEffect(() => {
    let cancelled = false;
    async function loadChannels() {
      if (!activePlanVersionId || envMissing) return;
      try {
        const rows = await getPlanChannelInputs(activePlanVersionId);
        if (cancelled) return;

        const next: Record<PlanChannel, ChannelForm> = {
          digital: emptyChannelForm(),
          activations: emptyChannelForm(),
          inbound: emptyChannelForm()
        };

        for (const row of rows) {
          next[row.channel] = {
            expected_leads: String(row.expected_leads ?? 0),
            qualification_percent: String(row.qualification_percent ?? 0),
            target_contribution_percent: String(row.target_contribution_percent ?? 0),
            allocated_budget: String(row.allocated_budget ?? 0)
          };
        }

        setChannelInputs(next);
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load channel inputs");
      }
    }

    loadChannels();
    return () => {
      cancelled = true;
    };
  }, [activePlanVersionId, envMissing]);

  const activeVersion = useMemo(
    () => (activePlanVersionId ? planVersions.find((v) => v.id === activePlanVersionId) ?? null : null),
    [activePlanVersionId, planVersions]
  );

  const allocatedTotal = useMemo(() => {
    return CHANNELS.reduce((sum, ch) => {
      const v = toNumber(channelInputs[ch].allocated_budget);
      return sum + (v ?? 0);
    }, 0);
  }, [channelInputs]);

  async function refresh() {
    if (!projectId) return;
    const [t, versions, a] = await Promise.all([
      getProjectTargets(projectId, year, month),
      listPlanVersions(projectId, year, month),
      getProjectActuals(projectId, year, month)
    ]);

    setTargets(t);
    setTargetsForm({
      sales_target_sqft: String(t?.sales_target_sqft ?? 0),
      avg_sqft_per_deal: String(t?.avg_sqft_per_deal ?? 0),
      total_budget: String(t?.total_budget ?? 0)
    });

    setPlanVersions(versions);
    setActuals(a);
    setActualsForm({
      leads: String(a?.leads ?? 0),
      qualified_leads: String(a?.qualified_leads ?? 0),
      meetings_scheduled: String(a?.meetings_scheduled ?? 0),
      meetings_done: String(a?.meetings_done ?? 0),
      deals_won: String(a?.deals_won ?? 0),
      sqft_won: String(a?.sqft_won ?? 0),
      spend_digital: String(a?.spend_digital ?? 0),
      spend_inbound: String(a?.spend_inbound ?? 0),
      spend_activations: String(a?.spend_activations ?? 0)
    });
  }

  async function onSaveTargets() {
    if (!projectId) return;

    const sales_target_sqft = toNumber(targetsForm.sales_target_sqft);
    const avg_sqft_per_deal = toNumber(targetsForm.avg_sqft_per_deal);
    const total_budget = toNumber(targetsForm.total_budget);

    if (sales_target_sqft == null || avg_sqft_per_deal == null || total_budget == null) {
      setStatus("Please enter valid numbers for targets.");
      return;
    }

    setStatus("Saving targets...");
    await upsertProjectTargets({
      project_id: projectId,
      year,
      month,
      sales_target_sqft,
      avg_sqft_per_deal,
      total_budget
    });

    setStatus("Targets saved.");
    await refresh();
  }

  async function onCreateDraft() {
    if (!projectId) return;
    setStatus("Creating draft...");
    const v = await createDraftPlanVersion(projectId, year, month);
    setStatus("Draft created.");
    await refresh();
    setActivePlanVersionId(v.id);
  }

  async function onSavePlanInputs() {
    if (!activeVersion) return;

    const payloads: PlanChannelInputs[] = [];
    for (const ch of CHANNELS) {
      const row = channelInputs[ch];
      const expected_leads = toNumber(row.expected_leads);
      const qualification_percent = toNumber(row.qualification_percent);
      const target_contribution_percent = toNumber(row.target_contribution_percent);
      const allocated_budget = toNumber(row.allocated_budget);

      if (
        expected_leads == null ||
        qualification_percent == null ||
        target_contribution_percent == null ||
        allocated_budget == null
      ) {
        setStatus("Please enter valid numbers for all channel fields.");
        return;
      }

      payloads.push({
        plan_version_id: activeVersion.id,
        channel: ch,
        expected_leads,
        qualification_percent,
        target_contribution_percent,
        allocated_budget
      });
    }

    setStatus("Saving plan inputs...");
    await Promise.all(payloads.map((p) => upsertPlanChannelInputs(p)));
    setStatus("Plan inputs saved.");
  }

  async function onSubmitForApproval() {
    if (!activeVersion) return;
    setStatus("Submitting for approval...");
    await updatePlanVersionStatus(activeVersion.id, "submitted");
    setStatus("Submitted. Waiting for CMO approval.");
    await refresh();
  }

  async function onApprove(versionId: string) {
    setStatus("Approving...");
    await approvePlanVersion(versionId);
    setStatus("Approved and activated.");
    await refresh();
  }

  async function onReject(versionId: string) {
    setStatus("Rejecting...");
    await rejectPlanVersion(versionId);
    setStatus("Rejected.");
    await refresh();
  }

  async function onSaveActuals() {
    if (!projectId) return;

    const leads = toNumber(actualsForm.leads);
    const qualified_leads = toNumber(actualsForm.qualified_leads);
    const meetings_scheduled = toNumber(actualsForm.meetings_scheduled);
    const meetings_done = toNumber(actualsForm.meetings_done);
    const deals_won = toNumber(actualsForm.deals_won);
    const sqft_won = toNumber(actualsForm.sqft_won);
    const spend_digital = toNumber(actualsForm.spend_digital);
    const spend_inbound = toNumber(actualsForm.spend_inbound);
    const spend_activations = toNumber(actualsForm.spend_activations);

    if (
      leads == null ||
      qualified_leads == null ||
      meetings_scheduled == null ||
      meetings_done == null ||
      deals_won == null ||
      sqft_won == null ||
      spend_digital == null ||
      spend_inbound == null ||
      spend_activations == null
    ) {
      setStatus("Please enter valid numbers for actuals.");
      return;
    }

    setStatus("Saving actuals...");
    await upsertProjectActuals({
      project_id: projectId,
      year,
      month,
      leads,
      qualified_leads,
      meetings_scheduled,
      meetings_done,
      deals_won,
      sqft_won,
      spend_digital,
      spend_inbound,
      spend_activations
    });
    setStatus("Actuals saved.");
    await refresh();
  }

  const budgetCap = targets?.total_budget ?? 0;
  const remainingBudget = Math.max(0, budgetCap - allocatedTotal);

  const isCmo = profile?.role === "cmo";
  const canEditPlan = isCmo || activeVersion?.status === "draft" || activeVersion?.status === "rejected";

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageShell>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-2xl font-semibold tracking-tight text-white/95">Brand / Sales Ops Data</div>
              <div className="text-sm text-white/55">Role-based entry with approvals (Supabase-backed).</div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
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
            <div className="flex items-center gap-2">
              <div className="text-sm text-white/60">Project</div>
              <select
                className="glass-inset rounded-lg px-3 py-2 text-sm text-white/85"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={envMissing}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-zinc-900">
                    {p.name}
                  </option>
                ))}
              </select>
              <Button
                as={Link}
                href={projectId ? `/projects/${projectId}/digital` : "/projects"}
                variant="flat"
                className="glass-inset text-white/80"
              >
                Open Digital Snapshot
              </Button>
            </div>
          </div>
        </Surface>

        {envMissing ? (
          <Surface>
            <div className="text-sm text-amber-200/90">
              Supabase env vars are missing. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
            </div>
          </Surface>
        ) : null}

        {!profile && !envMissing ? (
          <Surface>
            <div className="text-sm text-white/70">
              You’re signed in, but your <code>profiles</code> row doesn’t exist yet (or RLS is blocking it). Once we apply
              migrations + seed users/roles, this page will light up.
            </div>
          </Surface>
        ) : null}

        {profile?.role === "cmo" ? (
          <div className="grid gap-4 md:grid-cols-12">
            <Surface className="md:col-span-5">
              <div className="text-lg font-semibold text-white/90">CMO – Targets & Budget</div>
              <div className="mt-1 text-sm text-white/55">Sets caps for the selected project/month.</div>

              <div className="mt-4 grid gap-4">
                <NumberInput
                  label="Sales target"
                  unit="sqft"
                  value={targetsForm.sales_target_sqft}
                  onValueChange={(v) => setTargetsForm((s) => ({ ...s, sales_target_sqft: v }))}
                />
                <NumberInput
                  label="Average sqft per deal"
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

                <Button color="primary" onPress={onSaveTargets}>
                  Save targets
                </Button>
              </div>
            </Surface>

            <Surface className="md:col-span-7">
              <div className="text-lg font-semibold text-white/90">CMO – Approvals</div>
              <div className="mt-1 text-sm text-white/55">Approve/reject submitted plan versions.</div>

              <div className="mt-4 space-y-3">
                {planVersions.length === 0 ? (
                  <div className="text-sm text-white/60">No plan versions for this project/month yet.</div>
                ) : (
                  planVersions.map((v) => (
                    <div key={v.id} className="glass-inset rounded-xl p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm text-white/80">
                          <div className="font-semibold">{v.status.toUpperCase()}</div>
                          <div className="text-white/55">Created: {new Date(v.created_at).toLocaleString()}</div>
                          <div className="text-white/55">Active: {v.active ? "Yes" : "No"}</div>
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
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Surface>
          </div>
        ) : null}

        {profile?.role === "brand_manager" || isCmo ? (
          <div className="grid gap-4 md:grid-cols-12">
            <Surface className="md:col-span-5">
              <div className="text-lg font-semibold text-white/90">
                {isCmo ? "Brand Plan – Targets" : "Brand Manager – Targets"}
              </div>
              <div className="mt-1 text-sm text-white/55">
                {isCmo ? "View caps and create/select plan versions." : "Read-only caps set by CMO."}
              </div>

              <div className="mt-4 grid gap-3 text-sm">
                <div className="glass-inset rounded-xl p-3">
                  <div className="text-white/55">Sales target</div>
                  <div className="mt-1 text-lg font-semibold text-white/90">{targets?.sales_target_sqft ?? "—"}</div>
                </div>
                <div className="glass-inset rounded-xl p-3">
                  <div className="text-white/55">Avg sqft per deal</div>
                  <div className="mt-1 text-lg font-semibold text-white/90">{targets?.avg_sqft_per_deal ?? "—"}</div>
                </div>
                <div className="glass-inset rounded-xl p-3">
                  <div className="text-white/55">Budget cap</div>
                  <div className="mt-1 text-lg font-semibold text-white/90">{targets?.total_budget ?? "—"}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                <Button color="primary" onPress={onCreateDraft}>
                  Create new draft
                </Button>

                {isCmo ? (
                  <div className="glass-inset rounded-xl p-3">
                    <div className="text-xs uppercase tracking-widest text-white/45">Plan version</div>
                    <select
                      className="mt-2 w-full glass-inset rounded-lg px-3 py-2 text-sm text-white/85"
                      value={activePlanVersionId ?? ""}
                      onChange={(e) => setActivePlanVersionId(e.target.value || null)}
                    >
                      <option value="" className="bg-zinc-900">
                        — Select —
                      </option>
                      {planVersions.map((v) => (
                        <option key={v.id} value={v.id} className="bg-zinc-900">
                          {planDisplayName(monthLabel, v.status, v.active)} · {new Date(v.created_at).toLocaleString()}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 text-xs text-white/45">
                      CMO can edit any version (including approved). Changes apply immediately.
                    </div>
                  </div>
                ) : null}
              </div>
            </Surface>

            <Surface className="md:col-span-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-white/90">Plan inputs</div>
                  <div className="mt-1 text-sm text-white/55">
                    Version: {activeVersion ? `${activeVersion.status}${activeVersion.active ? " (active)" : ""}` : "—"}
                  </div>
                </div>

                <div className="text-sm text-white/60">
                  Allocated: {allocatedTotal.toLocaleString()} / {budgetCap.toLocaleString()} (Remaining: {remainingBudget.toLocaleString()})
                </div>
              </div>

              {!activeVersion ? (
                <div className="mt-4 text-sm text-white/60">
                  No editable version selected. Create a new draft to start entering your plan.
                </div>
              ) : (
                <>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    {CHANNELS.map((ch) => (
                      <div key={ch} className="glass-inset rounded-2xl p-4">
                        <div className="text-sm font-semibold text-white/85">{channelLabel(ch)}</div>
                        <div className="mt-3 grid gap-3">
                          <NumberInput
                            label="Expected leads"
                            unit="leads"
                            value={channelInputs[ch].expected_leads}
                            onValueChange={(v) =>
                              setChannelInputs((s) => ({ ...s, [ch]: { ...s[ch], expected_leads: v } }))
                            }
                            isDisabled={!canEditPlan}
                          />
                          <NumberInput
                            label="Qualification %"
                            unit="%"
                            value={channelInputs[ch].qualification_percent}
                            onValueChange={(v) =>
                              setChannelInputs((s) => ({ ...s, [ch]: { ...s[ch], qualification_percent: v } }))
                            }
                            isDisabled={!canEditPlan}
                          />
                          <NumberInput
                            label="Target contribution"
                            unit="%"
                            value={channelInputs[ch].target_contribution_percent}
                            onValueChange={(v) =>
                              setChannelInputs((s) => ({ ...s, [ch]: { ...s[ch], target_contribution_percent: v } }))
                            }
                            isDisabled={!canEditPlan}
                          />
                          <NumberInput
                            label="Allocated budget"
                            unit="PKR"
                            value={channelInputs[ch].allocated_budget}
                            onValueChange={(v) =>
                              setChannelInputs((s) => ({ ...s, [ch]: { ...s[ch], allocated_budget: v } }))
                            }
                            isDisabled={!canEditPlan}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant="flat"
                      className="glass-inset text-white/80"
                      onPress={onSavePlanInputs}
                      isDisabled={!canEditPlan}
                    >
                      Save draft
                    </Button>
                    {!isCmo ? (
                      <Button color="primary" onPress={onSubmitForApproval} isDisabled={!canEditPlan}>
                        Submit for approval
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
            </Surface>
          </div>
        ) : null}

        {profile?.role === "sales_ops" || isCmo ? (
          <Surface>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white/90">
                  {isCmo ? "Sales Ops – Actuals (CMO override)" : "Sales Ops – Actuals"}
                </div>
                <div className="mt-1 text-sm text-white/55">
                  {isCmo ? "CMO can edit actuals if needed." : "These are locked from Brand edits."}
                </div>
              </div>
              <Button color="primary" onPress={onSaveActuals}>
                Save actuals
              </Button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <NumberInput
                label="Actual leads"
                unit="leads"
                value={actualsForm.leads}
                onValueChange={(v) => setActualsForm((s) => ({ ...s, leads: v }))}
              />
              <NumberInput
                label="Qualified leads"
                unit="leads"
                value={actualsForm.qualified_leads}
                onValueChange={(v) => setActualsForm((s) => ({ ...s, qualified_leads: v }))}
              />
              <NumberInput
                label="Meetings scheduled"
                unit="meetings"
                value={actualsForm.meetings_scheduled}
                onValueChange={(v) => setActualsForm((s) => ({ ...s, meetings_scheduled: v }))}
              />
              <NumberInput
                label="Meetings done"
                unit="meetings"
                value={actualsForm.meetings_done}
                onValueChange={(v) => setActualsForm((s) => ({ ...s, meetings_done: v }))}
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <NumberInput
                label="Deals won"
                unit="deals"
                value={actualsForm.deals_won}
                onValueChange={(v) => setActualsForm((s) => ({ ...s, deals_won: v }))}
              />
              <NumberInput
                label="Sqft won"
                unit="sqft"
                value={actualsForm.sqft_won}
                onValueChange={(v) => setActualsForm((s) => ({ ...s, sqft_won: v }))}
              />
            </div>

            <div className="mt-4">
              <div className="text-xs uppercase tracking-widest text-white/45">Spend (actual)</div>
              <div className="mt-3 grid gap-4 md:grid-cols-3">
                <NumberInput
                  label="Digital spend"
                  unit="PKR"
                  value={actualsForm.spend_digital}
                  onValueChange={(v) => setActualsForm((s) => ({ ...s, spend_digital: v }))}
                />
                <NumberInput
                  label="Inbound spend"
                  unit="PKR"
                  value={actualsForm.spend_inbound}
                  onValueChange={(v) => setActualsForm((s) => ({ ...s, spend_inbound: v }))}
                />
                <NumberInput
                  label="Activations spend"
                  unit="PKR"
                  value={actualsForm.spend_activations}
                  onValueChange={(v) => setActualsForm((s) => ({ ...s, spend_activations: v }))}
                />
              </div>
            </div>

            {actuals ? (
              <div className="mt-3 text-xs text-white/45">Last loaded values are from Supabase.</div>
            ) : (
              <div className="mt-3 text-xs text-white/45">No actuals saved yet for this month.</div>
            )}
          </Surface>
        ) : null}

        {profile && profile.role !== "cmo" && profile.role !== "brand_manager" && profile.role !== "sales_ops" ? (
          <Surface>
            <div className="text-sm text-white/70">Unknown role: {String(profile.role)}</div>
          </Surface>
        ) : null}
      </div>
    </main>
  );
}
