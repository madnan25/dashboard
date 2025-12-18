"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import { Surface } from "@/components/ds/Surface";
import type { PlanVersion } from "@/lib/dashboardDb";

function planDisplayName(monthLabel: string, status: PlanVersion["status"], active: boolean) {
  if (status === "approved") return `${monthLabel} – Approved plan`;
  if (status === "submitted") return `${monthLabel} – Submitted for approval`;
  if (status === "rejected") return `${monthLabel} – Rejected plan`;
  if (active) return `${monthLabel} – Active plan`;
  return `${monthLabel} – Draft plan`;
}

export function CmoApprovalsPanel(props: {
  monthLabel: string;
  planVersions: PlanVersion[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { monthLabel, planVersions, onApprove, onReject, onDelete } = props;

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
        <Button as={Link} href="/brand/data-entry" size="sm" variant="flat" className="glass-inset text-white/80">
          Open data entry
        </Button>
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
                  <div className="mt-1 text-white/55">Created: {new Date(v.created_at).toLocaleString()}</div>
                  <div className="text-white/55">ID: {v.id.slice(0, 8)}…</div>
                </div>

                <div className="flex items-center gap-2">
                  {v.status !== "approved" ? (
                    <>
                      <Button color="primary" onPress={() => onApprove(v.id)}>
                        Approve now
                      </Button>
                      {v.status !== "rejected" ? (
                        <Button variant="flat" className="glass-inset text-white/80" onPress={() => onReject(v.id)}>
                          Reject
                        </Button>
                      ) : null}
                      {v.status === "draft" ? (
                        <Button variant="flat" className="glass-inset text-white/80" onPress={() => onDelete(v.id)}>
                          Delete
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Button variant="flat" className="glass-inset text-white/80" onPress={() => onReject(v.id)}>
                        Reject approved
                      </Button>
                      <Button as={Link} href="/brand/data-entry" variant="flat" className="glass-inset text-white/80">
                        View / edit
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Surface>
  );
}
