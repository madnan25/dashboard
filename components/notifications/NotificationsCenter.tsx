"use client";

import { useEffect, useMemo } from "react";
import { Surface } from "@/components/ds/Surface";
import { NotificationList } from "@/components/notifications/NotificationList";
import { useNotificationsContext } from "@/components/notifications/NotificationsProvider";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { deleteNotificationsBefore } from "@/lib/db/repo/notifications";

export function NotificationsCenter() {
  const notifications = useNotificationsContext();
  const userId = notifications?.userId ?? null;
  const items = notifications?.items ?? [];
  const unreadCount = notifications?.unreadCount ?? 0;
  const loading = notifications?.loading ?? false;
  const markAllRead = notifications?.markAllRead;
  const markRead = notifications?.markRead;
  const refresh = notifications?.refresh;
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    if (!userId || !refresh) return;
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    deleteNotificationsBefore(supabase, userId, cutoff)
      .then(() => refresh({ silent: true }))
      .catch(() => {});
  }, [refresh, supabase, userId]);

  return (
    <Surface className="border border-white/10 p-4 md:p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white/90">
          {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        </div>
        {unreadCount > 0 ? (
          <button type="button" onClick={() => markAllRead?.()} className="text-xs font-medium text-white/60 hover:text-white/80">
            Mark all read
          </button>
        ) : null}
      </div>
      <div className="mt-4">
        <NotificationList items={items} onMarkRead={markRead} emptyMessage="No notifications yet." />
        {loading ? <div className="mt-2 text-[11px] text-white/45">Refreshing...</div> : null}
      </div>
    </Surface>
  );
}
