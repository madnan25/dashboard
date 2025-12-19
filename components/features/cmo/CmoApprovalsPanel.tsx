"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { AppButton } from "@/components/ds/AppButton";
import { Surface } from "@/components/ds/Surface";
import type { PlanChannel, PlanChannelInputs, PlanVersion, Profile, ProjectTargets } from "@/lib/dashboardDb";
import { getPlanChannelInputs, listProfilesByIds } from "@/lib/dashboardDb";
import { computeChannelFunnelFromInputs } from "@/lib/reports/funnelMath";

function planDisplayName(monthLabel: string, status: PlanVersion["status"], active: boolean) {
  if (status === "approved") return `${monthLabel} – Approved plan`;
  if (status === "submitted") return `${monthLabel} – Submitted for approval`;
  if (status === "rejected") return `${monthLabel} – Rejected plan`;
  if (active) return `${monthLabel} – Active plan`;
  return `${monthLabel} – Draft plan`;
}

export function CmoApprovalsPanel(props: {
  monthLabel: string;
  targets: ProjectTargets | null;
  planVersions: PlanVersion[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { monthLabel, targets, planVersions, onApprove, onReject, onDelete } = props;

  const [viewId, setViewId] = useState<string | null>(null);
  const [viewRows, setViewRows] = useState<PlanChannelInputs[] | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string>("");
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});

  const viewing = useMemo(() => (viewId ? planVersions.find((v) => v.id === viewId) ?? null : null), [planVersions, viewId]);

  useEffect(() => {
    let cancelled = false;
    async function loadProfiles() {
      const ids = planVersions.map((v) => v.created_by).filter(Boolean);
      if (ids.length === 0) return;
      try {
        const rows = await listProfilesByIds(ids);
        if (cancelled) return;
        const map: Record<string, Profile> = {};
        for (const r of rows) map[r.id] = r;
        setProfilesById(map);
      } catch {
        // ignore; UI falls back to id
      }
    }
    loadProfiles();
    return () => {
      cancelled = true;
    };
  }, [planVersions]);

  function displayUser(id: string) {
    const p = profilesById[id];
    const name = p?.full_name?.trim();
    const email = p?.email?.trim();
    if (name && email) return `${name} (${email})`;
    if (name) return name;
    if (email) return email;
    return `${id.slice(0, 8)}…`;
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!viewId) return;
      try {
        setViewError("");
        setViewLoading(true);
        const rows = await getPlanChannelInputs(viewId);
        if (cancelled) return;
        setViewRows(rows ?? []);
      } catch (e) {
        if (cancelled) return;
        setViewError(e instanceof Error ? e.message : "Failed to load plan details");
        setViewRows(null);
      } finally {
        if (cancelled) return;
        setViewLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [viewId]);

  const byChannel = useMemo(() => {
    const out: Record<PlanChannel, PlanChannelInputs | null> = { digital: null, inbound: null, activations: null };
    for (const r of viewRows ?? []) out[r.channel] = r;
    return out;
  }, [viewRows]);

  const channels: PlanChannel[] = ["digital", "inbound", "activations"];
  const channelLabel = (ch: PlanChannel) => (ch === "digital" ? "Digital" : ch === "inbound" ? "Inbound" : "Activations");

  return (
    <Surface>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-white/90">Approvals</div>
          <div className="mt-1 text-sm text-white/55">
            Brand Managers must <span className="text-white/80">Submit for approval</span> from{" "}
            <Link className="underline text-white/75" href="/brand/data-entry">
              Data Entry
            </Link>
            .
          </div>
        </div>
        <AppButton as={Link} href="/brand/data-entry" size="sm" intent="secondary">
          Open planning
        </AppButton>
      </div>

      <div className="mt-4 space-y-3">
        {planVersions.filter((v) => v.status === "submitted").length === 0 ? (
          <div className="glass-inset rounded-xl p-4 text-sm text-white/60">No submitted plans for this project/month yet.</div>
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
                    <div className="font-semibold text-white/90">{planDisplayName(monthLabel, v.status, v.active)}</div>
                    {v.active ? (
                      <span className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/75">ACTIVE</span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-white/55">Submitted by: {displayUser(v.created_by)}</div>
                  <div className="mt-1 text-white/55">Created: {new Date(v.created_at).toLocaleString()}</div>
                  <div className="text-white/55">ID: {v.id.slice(0, 8)}…</div>
                </div>

                <div className="flex items-center gap-2">
                  {v.status !== "approved" ? (
                    <>
                      <AppButton intent="primary" onPress={() => onApprove(v.id)}>
                        Approve now
                      </AppButton>
                      <AppButton intent="secondary" onPress={() => setViewId(v.id)}>
                        View details
                      </AppButton>
                      {v.status !== "rejected" ? (
                        <AppButton intent="secondary" onPress={() => onReject(v.id)}>
                          Reject
                        </AppButton>
                      ) : null}
                      {v.status === "draft" || v.status === "rejected" ? (
                        <AppButton intent="danger" onPress={() => onDelete(v.id)}>
                          Delete
                        </AppButton>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <AppButton intent="secondary" onPress={() => setViewId(v.id)}>
                        View details
                      </AppButton>
                      <AppButton intent="secondary" onPress={() => onReject(v.id)}>
                        Reject approved
                      </AppButton>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {viewId ? (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur"
            onClick={() => {
              setViewId(null);
              setViewRows(null);
              setViewError("");
            }}
          />
          <div className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-black/75 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold text-white/90">
                  {viewing ? planDisplayName(monthLabel, viewing.status, viewing.active) : "Plan details"}
                </div>
                <div className="mt-1 text-sm text-white/55">
                  {viewing ? `Submitted by: ${displayUser(viewing.created_by)} · Created: ${new Date(viewing.created_at).toLocaleString()} · ID: ${viewing.id.slice(0, 8)}…` : ""}
                </div>
              </div>
              <AppButton
                intent="ghost"
                onPress={() => {
                  setViewId(null);
                  setViewRows(null);
                  setViewError("");
                }}
              >
                Close
              </AppButton>
            </div>

            <div className="p-5">
              {!targets ? (
                <div className="text-sm text-amber-200/90">Set CMO targets/rates for this month to view computed requirements.</div>
              ) : null}
              {viewError ? <div className="text-sm text-rose-200/90">{viewError}</div> : null}
              {viewLoading ? <div className="text-sm text-white/60">Loading…</div> : null}

              {!viewLoading && viewRows ? (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {channels.map((ch) => {
                    const row = byChannel[ch];
                    const computed = computeChannelFunnelFromInputs({ targets, inputs: row });
                    return (
                      <div key={ch} className="glass-inset rounded-2xl p-4">
                        <div className="text-sm font-semibold text-white/85">{channelLabel(ch)}</div>
                        <div className="mt-2 space-y-1 text-xs text-white/70">
                          <div className="flex items-center justify-between">
                            <span>Contribution</span>
                            <span className="font-semibold text-white/85">{Number(row?.target_contribution_percent ?? 0).toFixed(2)}%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Qualification</span>
                            <span className="font-semibold text-white/85">{Number(row?.qualification_percent ?? 0).toFixed(2)}%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Budget</span>
                            <span className="font-semibold text-white/85">{Number(row?.allocated_budget ?? 0).toLocaleString()}</span>
                          </div>
                          <div className="mt-2 border-t border-white/10 pt-2 space-y-1">
                            <div className="flex items-center justify-between">
                              <span>Target sqft</span>
                              <span className="font-semibold text-white/85">{computed.targetSqft.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Deals required</span>
                              <span className="font-semibold text-white/85">{computed.dealsRequired.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Meetings done</span>
                              <span className="font-semibold text-white/85">{computed.meetingsDoneRequired.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Qualified</span>
                              <span className="font-semibold text-white/85">{computed.qualifiedRequired.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Leads</span>
                              <span className="font-semibold text-white/85">{computed.leadsRequired.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </Surface>
  );
}
