"use client";

import { useEffect, useMemo, useState } from "react";
import { MONTHS } from "@/lib/digitalSnapshot";
import type {
  PlanChannel,
  PlanChannelInputs,
  PlanStatus,
  PlanVersion,
  Profile,
  Project,
  ProjectActuals,
  ProjectTargets
} from "@/lib/dashboardDb";
import {
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

export type ChannelForm = {
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

export const PLANNING_CHANNELS: PlanChannel[] = ["digital", "activations", "inbound"];

export function planDisplayName(monthLabel: string, status: PlanVersion["status"], active: boolean) {
  if (status === "approved") return `${monthLabel} – Approved plan`;
  if (status === "submitted") return `${monthLabel} – Submitted for approval`;
  if (status === "rejected") return `${monthLabel} – Rejected plan`;
  if (active) return `${monthLabel} – Active plan`;
  return `${monthLabel} – Draft plan`;
}

export function usePlanningData(props: { year: number; monthIndex: number }) {
  const { year, monthIndex } = props;
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
    return PLANNING_CHANNELS.reduce((sum, ch) => {
      const v = toNumber(channelInputs[ch].allocated_budget);
      return sum + (v ?? 0);
    }, 0);
  }, [channelInputs]);

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
    for (const ch of PLANNING_CHANNELS) {
      const row = channelInputs[ch];
      const expected_leads = toNumber(row.expected_leads);
      const qualification_percent = toNumber(row.qualification_percent);
      const target_contribution_percent = toNumber(row.target_contribution_percent);
      const allocated_budget = toNumber(row.allocated_budget);

      if (expected_leads == null || qualification_percent == null || target_contribution_percent == null || allocated_budget == null) {
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

  return {
    envMissing,
    month,
    monthLabel,
    profile,
    projects,
    projectId,
    setProjectId,
    targets,
    targetsForm,
    setTargetsForm,
    planVersions,
    activePlanVersionId,
    setActivePlanVersionId,
    activeVersion,
    channelInputs,
    setChannelInputs,
    actuals,
    actualsForm,
    setActualsForm,
    allocatedTotal,
    budgetCap,
    remainingBudget,
    isCmo,
    canEditPlan,
    status,
    setStatus,
    onSaveTargets,
    onCreateDraft,
    onSavePlanInputs,
    onSubmitForApproval,
    onApprove,
    onReject,
    onSaveActuals
  };
}

