"use client";

import Link from "next/link";
import type { Notification } from "@/lib/dashboardDb";

function formatRelativeTime(iso: string) {
  const delta = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(delta)) return "";
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return "Just now";
  if (delta < hour) return `${Math.floor(delta / minute)}m`;
  if (delta < day) return `${Math.floor(delta / hour)}h`;
  return `${Math.floor(delta / day)}d`;
}

export function NotificationList({
  items,
  onMarkRead,
  onItemClick,
  emptyMessage = "You're all caught up.",
  className = ""
}: {
  items: Notification[];
  onMarkRead?: (id: string) => void;
  onItemClick?: () => void;
  emptyMessage?: string;
  className?: string;
}) {
  if (items.length === 0) {
    return <div className={`rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/55 ${className}`}>{emptyMessage}</div>;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {items.map((n) => {
        const isUnread = !n.read_at;
        const href = n.related_task_id ? `/tasks/${n.related_task_id}` : "/tasks";
        return (
          <Link
            key={n.id}
            href={href}
            onPointerDown={() => {
              // Marking read on pointer down prevents "badge sticks until refresh"
              // because navigation can interrupt click handlers on some devices.
              if (isUnread) onMarkRead?.(n.id);
            }}
            onClick={() => {
              onItemClick?.();
            }}
            className={[
              "block rounded-2xl border px-3 py-2 transition-colors",
              isUnread
                ? "border-white/20 bg-white/[0.06] hover:bg-white/[0.08]"
                : "border-white/15 bg-white/[0.04] hover:bg-white/[0.06]"
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-white/90 truncate">{n.title}</div>
                  {isUnread ? <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.6)]" /> : null}
                </div>
                {n.body ? <div className="mt-0.5 text-xs text-white/60 truncate">{n.body}</div> : null}
              </div>
              <div className="shrink-0 text-[11px] text-white/45">{formatRelativeTime(n.created_at)}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
