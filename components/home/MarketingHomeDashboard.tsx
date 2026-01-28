import Link from "next/link";
import type { ReactNode } from "react";
import type { MarketingHomeInbox } from "@/lib/dashboardDb";
import { isoDate, statusLabel } from "@/components/tasks/taskModel";

type InboxTask = MarketingHomeInbox["items"][number];

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

function Section({
  title,
  count,
  helper,
  defaultOpen = false,
  children
}: {
  title: string;
  count?: number;
  helper?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-white/35">{">"}</span>
          <div className="text-sm font-semibold text-white/90">{title}</div>
        </div>
        {typeof count === "number" ? <span className="text-xs text-white/55">{count}</span> : null}
      </summary>
      {helper ? <div className="mt-1 pl-5 text-xs text-white/50">{helper}</div> : null}
      <div className="mt-3 space-y-2 pl-5 pb-2">{children}</div>
    </details>
  );
}

function badgeClass(tone: "accent" | "approval" | "created" | "muted") {
  switch (tone) {
    case "accent":
      return "border-sky-400/25 bg-sky-500/[0.12] text-sky-100";
    case "approval":
      return "border-fuchsia-400/30 bg-fuchsia-500/[0.12] text-fuchsia-100";
    case "created":
      return "border-purple-400/25 bg-purple-500/[0.12] text-purple-100";
    default:
      return "border-white/10 bg-white/[0.06] text-white/70";
  }
}

function TaskRow({
  task,
  badge,
  badgeTone,
  todayIso
}: {
  task: InboxTask;
  badge?: string;
  badgeTone?: "accent" | "approval" | "created" | "muted";
  todayIso: string;
}) {
  const isOverdue = task.due_at ? task.due_at < todayIso : false;
  const dueTone = isOverdue ? "text-rose-200" : "text-white/70";

  return (
    <Link
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
          {badge ? (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${badgeClass(badgeTone ?? "muted")}`}>
              {badge}
            </span>
          ) : null}
          {task.due_at ? <span className={`text-[11px] tabular-nums ${dueTone}`}>Due {task.due_at}</span> : null}
        </div>
      </div>
    </Link>
  );
}

function toTime(value: string | null | undefined) {
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

export function MarketingHomeDashboard({ inbox, userId }: { inbox: MarketingHomeInbox; userId: string }) {
  const todayIso = isoDate(new Date());
  const maxItems = 6;

  const awaitingApprovalAll = inbox.items.filter(
    (task) => task.approver_user_id === userId && task.approval_state === "pending" && task.status === "submitted"
  );
  const awaitingApprovalIds = new Set(awaitingApprovalAll.map((t) => t.id));

  const assignedAll = inbox.items.filter((task) => task.assignee_id === userId && !awaitingApprovalIds.has(task.id));
  const assignedIds = new Set(assignedAll.map((t) => t.id));

  const createdAll = inbox.items.filter(
    (task) => task.created_by === userId && !awaitingApprovalIds.has(task.id) && !assignedIds.has(task.id)
  );
  const createdIds = new Set(createdAll.map((t) => t.id));

  const collaboratingAll = inbox.items.filter(
    (task) => !awaitingApprovalIds.has(task.id) && !assignedIds.has(task.id) && !createdIds.has(task.id)
  );

  const byUpdatedDesc = (a: InboxTask, b: InboxTask) => toTime(b.updated_at) - toTime(a.updated_at);
  const byAssignedPriority = (a: InboxTask, b: InboxTask) => {
    const aOverdue = a.due_at ? a.due_at < todayIso : false;
    const bOverdue = b.due_at ? b.due_at < todayIso : false;
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    const aDue = a.due_at ?? "";
    const bDue = b.due_at ?? "";
    if (aDue && bDue && aDue !== bDue) return aDue < bDue ? -1 : 1;
    if (aDue && !bDue) return -1;
    if (!aDue && bDue) return 1;
    return byUpdatedDesc(a, b);
  };

  const awaitingApproval = awaitingApprovalAll.sort(byUpdatedDesc).slice(0, maxItems);
  const assigned = assignedAll.sort(byAssignedPriority).slice(0, maxItems);
  const created = createdAll.sort(byUpdatedDesc).slice(0, maxItems);
  const collaborating = collaboratingAll.sort(byUpdatedDesc).slice(0, maxItems);
  const createdHelper = created.length > 0 ? `Showing the latest ${created.length}.` : undefined;
  const collaboratingHelper = collaborating.length > 0 ? `Showing the latest ${collaborating.length}.` : undefined;

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
            <div className="text-sm font-semibold text-white/90">Your work buckets</div>
            <div className="text-xs text-white/55">Expand a category to focus on what matters now.</div>
          </div>
          <Link href="/tasks" className="text-xs font-medium text-white/60 hover:text-white/85">
            View all
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {inbox.items.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/55">
              No open tickets yet.
            </div>
          ) : (
            <>
              <Section title="Assigned to you" count={inbox.assigned_count} helper="Overdue items bubble to the top." defaultOpen>
                {assigned.length === 0 ? (
                  <div className="text-sm text-white/55">Nothing assigned right now.</div>
                ) : (
                  assigned.map((task) => <TaskRow key={task.id} task={task} badge="Assigned to you" badgeTone="accent" todayIso={todayIso} />)
                )}
              </Section>

              <Section title="Awaiting your approval" count={inbox.approval_count} defaultOpen>
                {awaitingApproval.length === 0 ? (
                  <div className="text-sm text-white/55">No approvals waiting.</div>
                ) : (
                  awaitingApproval.map((task) => (
                    <TaskRow key={task.id} task={task} badge="Approval needed" badgeTone="approval" todayIso={todayIso} />
                  ))
                )}
              </Section>

              <Section title="Created by you" helper={createdHelper}>
                {created.length === 0 ? (
                  <div className="text-sm text-white/55">Nothing new from you yet.</div>
                ) : (
                  created.map((task) => <TaskRow key={task.id} task={task} badge="Created by you" badgeTone="created" todayIso={todayIso} />)
                )}
              </Section>

              <Section title="Collaborating" helper={collaboratingHelper}>
                {collaborating.length === 0 ? (
                  <div className="text-sm text-white/55">No shared tickets yet.</div>
                ) : (
                  collaborating.map((task) => <TaskRow key={task.id} task={task} badge="Collaborating" badgeTone="muted" todayIso={todayIso} />)
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
