"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ds/PageHeader";
import { Surface } from "@/components/ds/Surface";
import { MonthYearPicker } from "@/components/ds/MonthYearPicker";
import { PlanningProjectBar } from "@/components/features/planning/PlanningProjectBar";
import { BrandTargetsCard } from "@/components/features/planning/BrandTargetsCard";
import { PlanInputsCard } from "@/components/features/planning/PlanInputsCard";
import { BrandSpendCard } from "@/components/features/planning/BrandSpendCard";
import { SalesOpsActualsCard } from "@/components/features/planning/SalesOpsActualsCard";
import { planDisplayName, usePlanningData } from "@/components/features/planning/usePlanningData";

export default function BrandDataEntryClient() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [monthIndex, setMonthIndex] = useState(() => new Date().getMonth());

  const {
    envMissing,
    monthLabel,
    profile,
    projects,
    projectId,
    setProjectId,
    targets,
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
    actuals,
    actualsForm,
    setActualsForm,
    allocatedTotal,
    budgetCap,
    remainingBudget,
    isCmo,
    canEditPlan,
    status,
    onCreateDraft,
    onSavePlanInputs,
    onSubmitForApproval,
    onSaveSalesOpsActuals,
    onSaveSpendActuals
  } = usePlanningData({ year, monthIndex });

  return (
    <main className="min-h-screen px-6 pb-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader title="Planning & Actuals" subtitle="Role-based entry with approvals (Supabase-backed)." showBack />

        <PlanningProjectBar
          status={status}
          projects={projects}
          projectId={projectId}
          setProjectId={setProjectId}
          isDisabled={envMissing}
          snapshotHref={
            projectId
              ? `/projects/${projectId}?year=${encodeURIComponent(String(year))}&monthIndex=${encodeURIComponent(String(monthIndex))}`
              : "/projects"
          }
          right={
            <MonthYearPicker
              monthIndex={monthIndex}
              year={year}
              label={monthLabel}
              buttonClassName="min-w-[118px]"
              onChange={(next) => {
                setMonthIndex(next.monthIndex);
                setYear(next.year);
              }}
            />
          }
        />

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
              You’re signed in, but your <code>profiles</code> row doesn’t exist yet (or RLS is blocking it). Once we apply migrations + seed users/roles,
              this page will light up.
            </div>
          </Surface>
        ) : null}

        {profile?.role === "brand_manager" || isCmo ? (
          <div className="grid gap-4 md:grid-cols-12">
            <BrandTargetsCard
              isCmo={isCmo}
              profileId={profile?.id}
              targets={targets}
              planVersions={planVersions}
              monthLabel={monthLabel}
              activePlanVersionId={activePlanVersionId}
              setActivePlanVersionId={setActivePlanVersionId}
              onCreateDraft={onCreateDraft}
              planDisplayName={planDisplayName}
            />
            <PlanInputsCard
              activeVersion={activeVersion}
              isCmo={isCmo}
              canEditPlan={canEditPlan}
              targets={targets}
              allocatedTotal={allocatedTotal}
              budgetCap={budgetCap}
              remainingBudget={remainingBudget}
              channelInputs={channelInputs}
              setChannelInputs={setChannelInputs}
              planInputsDirty={planInputsDirty}
              planInputsSavedAt={planInputsSavedAt}
              onSavePlanInputs={onSavePlanInputs}
              onSubmitForApproval={onSubmitForApproval}
            />
          </div>
        ) : null}

        {profile?.role === "brand_manager" || isCmo ? (
          <BrandSpendCard
            isCmo={isCmo}
            actuals={actuals}
            spendDirty={spendDirty}
            spendSavedAt={spendSavedAt}
            actualsForm={{
              spend_digital: actualsForm.spend_digital,
              spend_inbound: actualsForm.spend_inbound,
              spend_activations: actualsForm.spend_activations
            }}
            setActualsForm={(updater) =>
              setActualsForm((prev) => ({
                ...prev,
                ...updater({
                  spend_digital: prev.spend_digital,
                  spend_inbound: prev.spend_inbound,
                  spend_activations: prev.spend_activations
                })
              }))
            }
            onSaveSpend={onSaveSpendActuals}
          />
        ) : null}

        {profile?.role === "sales_ops" || isCmo ? (
          <SalesOpsActualsCard isCmo={isCmo} actuals={actuals} actualsForm={actualsForm} setActualsForm={setActualsForm} onSaveActuals={onSaveSalesOpsActuals} />
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

