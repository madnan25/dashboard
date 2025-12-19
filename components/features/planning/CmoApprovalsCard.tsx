"use client";

import { Button } from "@heroui/react";
import { Surface } from "@/components/ds/Surface";
import type { PlanVersion } from "@/lib/dashboardDb";

export function CmoApprovalsCard(props: {
  planVersions: PlanVersion[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDeleteDraft: (id: string) => void;
}) {
  const { planVersions, onApprove, onReject, onDeleteDraft } = props;

  return (
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
                  {v.status === "draft" ? (
                    <Button
                      variant="flat"
                      className="glass-inset text-white/80"
                      onPress={() => {
                        if (!confirm("Delete this draft? This cannot be undone.")) return;
                        onDeleteDraft(v.id);
                      }}
                    >
                      Delete draft
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Surface>
  );
}
