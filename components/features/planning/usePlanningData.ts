"use client";

import { useEffect, useMemo, useState } from "react";
import { MONTHS } from "@/lib/digitalSnapshot";
import { computeChannelFunnelFromTargetSqft, computeChannelTargetSqft } from "@/lib/reports/funnelMath";
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
  listProjectActualsChannels,
  listPlanVersions,
  listProjects,
  rejectPlanVersion,
  updatePlanVersionStatus,
  upsertPlanChannelInputs,
  upsertProjectActualsChannels,
  upsertProjectActualsMetrics,
  upsertProjectActualsSpend,
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
  target_sqft: string;
  allocated_budget: string;
};

export type SalesOpsChannelForm = {
  leads: string;
  qualified_leads: string;
  meetings_scheduled: string;
  meetings_done: string;
  deals_won: string;
  sqft_won: string;
};

function emptyChannelForm(): ChannelForm {
  return {
    expected_leads: "0",
    qualification_percent: "0",
    target_contribution_percent: "0",
    target_sqft: "0",
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
    total_budget: "0",
    qualified_to_meeting_done_percent: "10",
    meeting_done_to_close_percent: "40"
  });

  const [planVersions, setPlanVersions] = useState<PlanVersion[]>([]);
  const [activePlanVersionId, setActivePlanVersionId] = useState<string | null>(null);

  const [channelInputs, setChannelInputs] = useState<Record<PlanChannel, ChannelForm>>({
    digital: emptyChannelForm(),
    activations: emptyChannelForm(),
    inbound: emptyChannelForm()
  });

  const [planInputsSavedJson, setPlanInputsSavedJson] = useState<string>("");
  const [planInputsSavedAt, setPlanInputsSavedAt] = useState<number | null>(null);

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

  const [salesOpsByChannel, setSalesOpsByChannel] = useState<Record<PlanChannel, SalesOpsChannelForm>>({
    digital: { leads: "0", qualified_leads: "0", meetings_scheduled: "0", meetings_done: "0", deals_won: "0", sqft_won: "0" },
    activations: { leads: "0", qualified_leads: "0", meetings_scheduled: "0", meetings_done: "0", deals_won: "0", sqft_won: "0" },
    inbound: { leads: "0", qualified_leads: "0", meetings_scheduled: "0", meetings_done: "0", deals_won: "0", sqft_won: "0" }
  });

  const [spendSavedJson, setSpendSavedJson] = useState<string>("");
  const [spendSavedAt, setSpendSavedAt] = useState<number | null>(null);

  const [metricsSavedJson, setMetricsSavedJson] = useState<string>("");
  const [metricsSavedAt, setMetricsSavedAt] = useState<number | null>(null);

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
    const [t, versions, a, channelRows] = await Promise.all([
      getProjectTargets(projectId, year, month),
      listPlanVersions(projectId, year, month),
      getProjectActuals(projectId, year, month),
      listProjectActualsChannels(projectId, year, month)
    ]);

    setTargets(t);
    setTargetsForm({
      sales_target_sqft: String(t?.sales_target_sqft ?? 0),
      avg_sqft_per_deal: String(t?.avg_sqft_per_deal ?? 0),
      total_budget: String(t?.total_budget ?? 0),
      qualified_to_meeting_done_percent: String(t?.qualified_to_meeting_done_percent ?? 10),
      meeting_done_to_close_percent: String(t?.meeting_done_to_close_percent ?? 40)
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

    const nextCh: Record<PlanChannel, SalesOpsChannelForm> = {
      digital: { leads: "0", qualified_leads: "0", meetings_scheduled: "0", meetings_done: "0", deals_won: "0", sqft_won: "0" },
      activations: { leads: "0", qualified_leads: "0", meetings_scheduled: "0", meetings_done: "0", deals_won: "0", sqft_won: "0" },
      inbound: { leads: "0", qualified_leads: "0", meetings_scheduled: "0", meetings_done: "0", deals_won: "0", sqft_won: "0" }
    };
    for (const r of channelRows) {
      nextCh[r.channel] = {
        leads: String(r.leads ?? 0),
        qualified_leads: String(r.qualified_leads ?? 0),
        meetings_scheduled: String(r.meetings_scheduled ?? 0),
        meetings_done: String(r.meetings_done ?? 0),
        deals_won: String(r.deals_won ?? 0),
        sqft_won: String(r.sqft_won ?? 0)
      };
    }
    setSalesOpsByChannel(nextCh);

    const lastChannelUpdatedAt = channelRows.reduce((max, r) => {
      const ms = r.updated_at ? Date.parse(r.updated_at) : 0;
      return Number.isFinite(ms) ? Math.max(max, ms) : max;
    }, 0);

    // Derived totals for display only
    const totalLeads = PLANNING_CHANNELS.reduce((sum, ch) => sum + (toNumber(nextCh[ch].leads) ?? 0), 0);
    const totalQualified = PLANNING_CHANNELS.reduce((sum, ch) => sum + (toNumber(nextCh[ch].qualified_leads) ?? 0), 0);
    const totalMeetingsSched = PLANNING_CHANNELS.reduce((sum, ch) => sum + (toNumber(nextCh[ch].meetings_scheduled) ?? 0), 0);
    const totalMeetingsDone = PLANNING_CHANNELS.reduce((sum, ch) => sum + (toNumber(nextCh[ch].meetings_done) ?? 0), 0);
    const totalDeals = PLANNING_CHANNELS.reduce((sum, ch) => sum + (toNumber(nextCh[ch].deals_won) ?? 0), 0);
    const totalSqft = PLANNING_CHANNELS.reduce((sum, ch) => sum + (toNumber(nextCh[ch].sqft_won) ?? 0), 0);
    setActualsForm((prev) => ({
      ...prev,
      leads: String(totalLeads),
      qualified_leads: String(totalQualified),
      meetings_scheduled: String(totalMeetingsSched),
      meetings_done: String(totalMeetingsDone),
      deals_won: String(totalDeals),
      sqft_won: String(totalSqft)
    }));

    setSpendSavedJson(
      JSON.stringify({
        spend_digital: String(a?.spend_digital ?? 0),
        spend_inbound: String(a?.spend_inbound ?? 0),
        spend_activations: String(a?.spend_activations ?? 0)
      })
    );
    setSpendSavedAt(Date.now());

    setMetricsSavedJson(JSON.stringify({ channels: nextCh }));
    setMetricsSavedAt(lastChannelUpdatedAt ? lastChannelUpdatedAt : null);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      if (!projectId || envMissing) return;
      try {
        setStatus("");
        const [t, versions, a, channelRows] = await Promise.all([
          getProjectTargets(projectId, year, month),
          listPlanVersions(projectId, year, month),
          getProjectActuals(projectId, year, month),
          listProjectActualsChannels(projectId, year, month)
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

        const preferred =
          profile?.role === "brand_manager"
            ? versions.find((v) => v.created_by === profile.id && (v.status === "draft" || v.status === "rejected")) ??
              versions.find((v) => v.active && v.status === "approved") ??
              versions[0]
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

        setSpendSavedJson(
          JSON.stringify({
            spend_digital: String(a?.spend_digital ?? 0),
            spend_inbound: String(a?.spend_inbound ?? 0),
            spend_activations: String(a?.spend_activations ?? 0)
          })
        );
        setSpendSavedAt(Date.now());

        const nextCh: Record<PlanChannel, SalesOpsChannelForm> = {
          digital: { leads: "0", qualified_leads: "0", meetings_scheduled: "0", meetings_done: "0", deals_won: "0", sqft_won: "0" },
          activations: { leads: "0", qualified_leads: "0", meetings_scheduled: "0", meetings_done: "0", deals_won: "0", sqft_won: "0" },
          inbound: { leads: "0", qualified_leads: "0", meetings_scheduled: "0", meetings_done: "0", deals_won: "0", sqft_won: "0" }
        };
        for (const r of channelRows) {
          nextCh[r.channel] = {
            leads: String(r.leads ?? 0),
            qualified_leads: String(r.qualified_leads ?? 0),
            meetings_scheduled: String(r.meetings_scheduled ?? 0),
            meetings_done: String(r.meetings_done ?? 0),
        deals_won: String(r.deals_won ?? 0),
        sqft_won: String(r.sqft_won ?? 0)
          };
        }
        setSalesOpsByChannel(nextCh);

        // Derived totals for display only
        const totalLeads = PLANNING_CHANNELS.reduce((sum, ch) => sum + (toNumber(nextCh[ch].leads) ?? 0), 0);
        const totalQualified = PLANNING_CHANNELS.reduce((sum, ch) => sum + (toNumber(nextCh[ch].qualified_leads) ?? 0), 0);
        const totalMeetingsSched = PLANNING_CHANNELS.reduce((sum, ch) => sum + (toNumber(nextCh[ch].meetings_scheduled) ?? 0), 0);
        const totalMeetingsDone = PLANNING_CHANNELS.reduce((sum, ch) => sum + (toNumber(nextCh[ch].meetings_done) ?? 0), 0);
        const totalDeals = PLANNING_CHANNELS.reduce((sum, ch) => sum + (toNumber(nextCh[ch].deals_won) ?? 0), 0);
        const totalSqft = PLANNING_CHANNELS.reduce((sum, ch) => sum + (toNumber(nextCh[ch].sqft_won) ?? 0), 0);
        setActualsForm((prev) => ({
          ...prev,
          leads: String(totalLeads),
          qualified_leads: String(totalQualified),
          meetings_scheduled: String(totalMeetingsSched),
          meetings_done: String(totalMeetingsDone),
          deals_won: String(totalDeals),
          sqft_won: String(totalSqft)
        }));

        setMetricsSavedJson(JSON.stringify({ channels: nextCh }));
        const lastChannelUpdatedAt = channelRows.reduce((max, r) => {
          const ms = r.updated_at ? Date.parse(r.updated_at) : 0;
          return Number.isFinite(ms) ? Math.max(max, ms) : max;
        }, 0);
        setMetricsSavedAt(lastChannelUpdatedAt ? lastChannelUpdatedAt : null);
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
          const total = Number(targets?.sales_target_sqft ?? 0);
          const pct = Number(row.target_contribution_percent ?? 0);
          const sqft = computeChannelTargetSqft({ totalTargetSqft: total, contributionPercent: pct });
          const computed = computeChannelFunnelFromTargetSqft({
            targets,
            targetSqft: sqft,
            qualificationPercent: Number(row.qualification_percent ?? 0)
          });
          next[row.channel] = {
            expected_leads: String(computed.leadsRequired),
            qualification_percent: String(row.qualification_percent ?? 0),
            target_contribution_percent: String(row.target_contribution_percent ?? 0),
            target_sqft: String(sqft),
            allocated_budget: String(row.allocated_budget ?? 0)
          };
        }

        setChannelInputs(next);
        setPlanInputsSavedJson(JSON.stringify(next));
        setPlanInputsSavedAt(Date.now());
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load channel inputs");
      }
    }

    loadChannels();
    return () => {
      cancelled = true;
    };
  }, [
    activePlanVersionId,
    envMissing,
    targets,
    targets?.sales_target_sqft,
    targets?.avg_sqft_per_deal,
    targets?.qualified_to_meeting_done_percent,
    targets?.meeting_done_to_close_percent
  ]);

  const activeVersion = useMemo(
    () => (activePlanVersionId ? planVersions.find((v) => v.id === activePlanVersionId) ?? null : null),
    [activePlanVersionId, planVersions]
  );

  const planInputsDirty = useMemo(() => {
    if (!activeVersion) return false;
    const current = JSON.stringify(channelInputs);
    return planInputsSavedJson ? current !== planInputsSavedJson : current !== JSON.stringify({
      digital: emptyChannelForm(),
      activations: emptyChannelForm(),
      inbound: emptyChannelForm()
    });
  }, [activeVersion, channelInputs, planInputsSavedJson]);

  const spendDirty = useMemo(() => {
    const current = JSON.stringify({
      spend_digital: actualsForm.spend_digital,
      spend_inbound: actualsForm.spend_inbound,
      spend_activations: actualsForm.spend_activations
    });
    return spendSavedJson ? current !== spendSavedJson : current !== JSON.stringify({
      spend_digital: "0",
      spend_inbound: "0",
      spend_activations: "0"
    });
  }, [actualsForm.spend_activations, actualsForm.spend_digital, actualsForm.spend_inbound, spendSavedJson]);

  const metricsDirty = useMemo(() => {
    const current = JSON.stringify({ channels: salesOpsByChannel });
    return metricsSavedJson ? current !== metricsSavedJson : current !== JSON.stringify({
      channels: {
        digital: { leads: "0", qualified_leads: "0", meetings_scheduled: "0", meetings_done: "0", deals_won: "0", sqft_won: "0" },
        activations: { leads: "0", qualified_leads: "0", meetings_scheduled: "0", meetings_done: "0", deals_won: "0", sqft_won: "0" },
        inbound: { leads: "0", qualified_leads: "0", meetings_scheduled: "0", meetings_done: "0", deals_won: "0", sqft_won: "0" }
      }
    });
  }, [
    metricsSavedJson,
    salesOpsByChannel
  ]);

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
    await refresh();
  }

  async function onCreateDraft() {
    if (!projectId) return;
    setStatus("Creating draft...");
    const v = await createDraftPlanVersion(projectId, year, month);
    setStatus("Draft created.");
    await refresh();
    setActivePlanVersionId(v.id);
    // New draft starts as "saved" with empty values
    const empty = { digital: emptyChannelForm(), activations: emptyChannelForm(), inbound: emptyChannelForm() } as const;
    setPlanInputsSavedJson(JSON.stringify(empty));
    setPlanInputsSavedAt(Date.now());
  }

  async function onSavePlanInputs() {
    if (!activeVersion) return;

    const payloads: PlanChannelInputs[] = [];
    let totalPct = 0;
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
      totalPct += target_contribution_percent;
      if (target_contribution_percent < 0) {
        setStatus("Target contribution % must be >= 0.");
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
    if (totalPct > 100.0001) {
      setStatus(`Total target contribution is ${totalPct.toFixed(2)}% (must be <= 100%).`);
      return;
    }

    setStatus("Saving plan inputs...");
    await Promise.all(payloads.map((p) => upsertPlanChannelInputs(p)));
    setStatus("Plan inputs saved.");
    setPlanInputsSavedJson(JSON.stringify(channelInputs));
    setPlanInputsSavedAt(Date.now());
  }

  async function onSubmitForApproval() {
    if (!activeVersion) return;
    // Must be exactly 100% total to submit (brand requirement)
    const totalPct = PLANNING_CHANNELS.reduce((sum, ch) => sum + (toNumber(channelInputs[ch].target_contribution_percent) ?? 0), 0);
    if (Math.abs(totalPct - 100) > 0.01) {
      setStatus(`Total target contribution must equal 100% to submit (currently ${totalPct.toFixed(2)}%).`);
      return;
    }
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

  async function onSaveSalesOpsActuals() {
    if (!projectId) return;

    const channelPayloads = PLANNING_CHANNELS.map((ch) => {
      const row = salesOpsByChannel[ch];
      const leads = toNumber(row.leads);
      const qualified_leads = toNumber(row.qualified_leads);
      const meetings_scheduled = toNumber(row.meetings_scheduled);
      const meetings_done = toNumber(row.meetings_done);
      const deals_won = toNumber(row.deals_won);
      const sqft_won = toNumber(row.sqft_won);
      if (leads == null || qualified_leads == null || meetings_scheduled == null || meetings_done == null || deals_won == null || sqft_won == null) return null;
      return { project_id: projectId, year, month, channel: ch, leads, qualified_leads, meetings_scheduled, meetings_done, deals_won, sqft_won };
    }).filter(Boolean) as Array<{
      project_id: string;
      year: number;
      month: number;
      channel: PlanChannel;
      leads: number;
      qualified_leads: number;
      meetings_scheduled: number;
      meetings_done: number;
      deals_won: number;
      sqft_won: number;
    }>;

    if (channelPayloads.length !== PLANNING_CHANNELS.length) {
      setStatus("Please enter valid numbers for channel actuals.");
      return;
    }

    setStatus("Saving actuals...");
    await upsertProjectActualsChannels(channelPayloads);
    setStatus("Actuals saved.");

    setMetricsSavedJson(JSON.stringify({ channels: salesOpsByChannel }));
    setMetricsSavedAt(Date.now());
    await refresh();
  }

  async function onSaveSpendActuals() {
    if (!projectId) return;

    const spend_digital = toNumber(actualsForm.spend_digital);
    const spend_inbound = toNumber(actualsForm.spend_inbound);
    const spend_activations = toNumber(actualsForm.spend_activations);

    if (spend_digital == null || spend_inbound == null || spend_activations == null) {
      setStatus("Please enter valid numbers for spend.");
      return;
    }

    setStatus("Saving spend...");
    await upsertProjectActualsSpend({
      project_id: projectId,
      year,
      month,
      spend_digital,
      spend_inbound,
      spend_activations
    });
    setStatus("Spend saved.");

    setSpendSavedJson(
      JSON.stringify({
        spend_digital: String(spend_digital),
        spend_inbound: String(spend_inbound),
        spend_activations: String(spend_activations)
      })
    );
    setSpendSavedAt(Date.now());
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
    planInputsDirty,
    planInputsSavedAt,
    spendDirty,
    spendSavedAt,
    metricsDirty,
    metricsSavedAt,
    actuals,
    actualsForm,
    setActualsForm,
    salesOpsByChannel,
    setSalesOpsByChannel,
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
    onSaveSalesOpsActuals,
    onSaveSpendActuals
  };
}

