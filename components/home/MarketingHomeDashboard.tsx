import Link from "next/link";
import type { MarketingHomeInbox } from "@/lib/dashboardDb";
import { isoDate, statusLabel } from "@/components/tasks/taskModel";

function SummaryCard({
  label,
  value,
  helper,
  tone = "default"
}: {
  label: string;
  value: number;
  helper: string;
  tone?: "default" | "alert" | "accent";
}) {
  const toneClass =
    tone === "alert"
      ? "border-rose-400/20 bg-rose-500/[0.08] text-rose-100"
      : tone === "accent"
        ? "border-sky-400/20 bg-sky-500/[0.08] text-sky-100"
        : "border-white/10 bg-white/[0.03] text-white/90";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-xs uppercase tracking-[0.2em] text-white/50">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-white/60">{helper}</div>
    </div>
  );
}

export function MarketingHomeDashboard({ inbox, userId }: { inbox: MarketingHomeInbox; userId: string }) {
  const todayIso = isoDate(new Date());

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Assigned" value={inbox.assigned_count} helper="Tickets with you" tone="accent" />
        <SummaryCard label="Awaiting approval" value={inbox.approval_count} helper="Needs your sign-off" />
        <SummaryCard label="Overdue" value={inbox.overdue_count} helper="Past due items" tone={inbox.overdue_count > 0 ? "alert" : "default"} />
        <SummaryCard label="Involved" value={inbox.involved_count} helper="Tickets you touch" />
      </div>

      <div className="glass-inset rounded-3xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white/90">My queue</div>
            <div className="text-xs text-white/55">Most recent tickets you are involved with.</div>
          </div>
          <Link href="/tasks" className="text-xs font-medium text-white/60 hover:text-white/85">
            View all
          </Link>
        </div>

        <div className="mt-4 space-y-2">
          {inbox.items.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/55">
              No open tickets yet.
            </div>
          ) : (
            inbox.items.map((task) => {
              const isAssigned = task.assignee_id === userId;
              const needsApproval = task.approver_user_id === userId && task.approval_state === "pending" && task.status === "submitted";
              const isOverdue = task.due_at ? task.due_at < todayIso : false;
              const dueTone = isOverdue ? "text-rose-200" : "text-white/70";

              return (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="block rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white/90 truncate">{task.title}</div>
                      <div className="mt-0.5 text-xs text-white/55">
                        {statusLabel(task.status)} - {task.priority.toUpperCase()}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {needsApproval ? (
                        <span className="inline-flex items-center rounded-full border border-fuchsia-400/30 bg-fuchsia-500/[0.12] px-2 py-0.5 text-[11px] text-fuchsia-100">
                          Approval needed
                        </span>
                      ) : null}
                      {isAssigned ? (
                        <span className="inline-flex items-center rounded-full border border-sky-400/25 bg-sky-500/[0.12] px-2 py-0.5 text-[11px] text-sky-100">
                          Assigned to you
                        </span>
                      ) : null}
                      {task.due_at ? (
                        <span className={`text-[11px] tabular-nums ${dueTone}`}>Due {task.due_at}</span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
