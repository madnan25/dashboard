"use client";

import { Button } from "@heroui/react";
import { Surface } from "@/components/ds/Surface";
import type { PlanVersion, ProjectTargets } from "@/lib/dashboardDb";

export function BrandTargetsCard(props: {
  isCmo: boolean;
  targets: ProjectTargets | null;
  planVersions: PlanVersion[];
  monthLabel: string;
  activePlanVersionId: string | null;
  setActivePlanVersionId: (id: string | null) => void;
  onCreateDraft: () => void;
  planDisplayName: (monthLabel: string, status: PlanVersion["status"], active: boolean) => string;
}) {
  const { isCmo, targets, planVersions, monthLabel, activePlanVersionId, setActivePlanVersionId, onCreateDraft, planDisplayName } = props;

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
        <Button color="primary" onPress={onCreateDraft}>
          Create new draft
        </Button>

        {isCmo ? (
          <div className="glass-inset rounded-xl p-3">
            <div className="text-xs uppercase tracking-widest text-white/45">Plan version</div>
            <select
              className="mt-2 w-full glass-inset rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/85"
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
            <div className="mt-2 text-xs text-white/45">CMO can edit any version (including approved). Changes apply immediately.</div>
          </div>
        ) : null}
      </div>
    </Surface>
  );
}
