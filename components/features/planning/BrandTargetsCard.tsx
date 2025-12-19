"use client";

import { Surface } from "@/components/ds/Surface";
import { AppButton } from "@/components/ds/AppButton";
import { PillSelect } from "@/components/ds/PillSelect";
import type { PlanVersion, ProjectTargets } from "@/lib/dashboardDb";

export function BrandTargetsCard(props: {
  isCmo: boolean;
  profileId?: string | null;
  targets: ProjectTargets | null;
  planVersions: PlanVersion[];
  monthLabel: string;
  activePlanVersionId: string | null;
  setActivePlanVersionId: (id: string | null) => void;
  onCreateDraft: () => void;
  planDisplayName: (monthLabel: string, status: PlanVersion["status"], active: boolean) => string;
}) {
  const { isCmo, profileId, targets, planVersions, monthLabel, activePlanVersionId, setActivePlanVersionId, onCreateDraft, planDisplayName } = props;

  const visibleVersions = isCmo ? planVersions : planVersions.filter((v) => (profileId ? v.created_by === profileId : false));
  const selected = activePlanVersionId ? visibleVersions.find((v) => v.id === activePlanVersionId) ?? null : null;
  const statusTone =
    selected?.status === "approved"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100/90"
      : selected?.status === "rejected"
        ? "border-rose-300/20 bg-rose-500/10 text-rose-100/90"
        : selected?.status === "submitted"
          ? "border-blue-300/20 bg-blue-500/10 text-blue-100/90"
          : "border-white/10 bg-white/[0.03] text-white/75";

  return (
    <Surface className="md:col-span-5">
      <div className="text-lg font-semibold text-white/90">{isCmo ? "Brand Plan – Targets" : "Brand Manager – Targets"}</div>
      <div className="mt-1 text-sm text-white/55">{isCmo ? "View caps and create/select plan versions." : "Read-only caps set by CMO."}</div>

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
        <AppButton intent="primary" onPress={onCreateDraft}>
          Create new draft
        </AppButton>

        {isCmo || !!profileId ? (
          <div className="glass-inset rounded-xl p-3">
            <div className="text-xs uppercase tracking-widest text-white/45">{isCmo ? "Plan version" : "Your plan versions"}</div>
            <PillSelect
              className="mt-2"
              value={activePlanVersionId ?? ""}
              onChange={(next) => setActivePlanVersionId(next || null)}
              ariaLabel="Plan version"
            >
              <option value="" className="bg-zinc-900">
                — Select —
              </option>
              {visibleVersions.map((v) => (
                <option key={v.id} value={v.id} className="bg-zinc-900">
                  {planDisplayName(monthLabel, v.status, v.active)} · {new Date(v.created_at).toLocaleString()}
                </option>
              ))}
            </PillSelect>
            {selected ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[12px] ${statusTone}`}>{selected.status.toUpperCase()}</span>
                {selected.active ? (
                  <span className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/75">ACTIVE</span>
                ) : null}
              </div>
            ) : null}
            <div className="mt-2 text-xs text-white/45">
              {isCmo ? "CMO can edit any version (including approved). Changes apply immediately." : "Select which draft to edit/submit for this month."}
            </div>
          </div>
        ) : null}
      </div>
    </Surface>
  );
}
