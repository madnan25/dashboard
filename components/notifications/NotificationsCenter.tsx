"use client";

import { Surface } from "@/components/ds/Surface";
import { NotificationList } from "@/components/notifications/NotificationList";
import { useNotifications } from "@/components/notifications/useNotifications";
import type { Notification } from "@/lib/dashboardDb";

export function NotificationsCenter({
  userId,
  initialItems,
  initialUnreadCount
}: {
  userId: string;
  initialItems: Notification[];
  initialUnreadCount: number;
}) {
  const { items, unreadCount, loading, markAllRead, markRead } = useNotifications({
    userId,
    limit: 50,
    initialItems,
    initialUnreadCount
  });

  return (
    <Surface className="border border-white/10 p-4 md:p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white/90">
          {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        </div>
        {unreadCount > 0 ? (
          <button type="button" onClick={() => markAllRead()} className="text-xs font-medium text-white/60 hover:text-white/80">
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
