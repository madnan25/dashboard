"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { Notification } from "@/lib/dashboardDb";
import { useNotifications } from "@/components/notifications/useNotifications";

type NotificationsContextValue = {
  userId: string | null;
  items: Notification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  refresh: (opts?: { silent?: boolean }) => void;
  lastNewNotificationId: string | null;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider(props: { userId: string | null; children: React.ReactNode }) {
  const { userId, children } = props;
  const [lastNewNotificationId, setLastNewNotificationId] = useState<string | null>(null);

  const { items, unreadCount, loading, markRead, markAllRead, refresh } = useNotifications({
    userId,
    limit: 50,
    unreadOnly: false,
    onNewNotification: (n) => setLastNewNotificationId(n.id)
  });

  const value = useMemo<NotificationsContextValue>(
    () => ({
      userId,
      items,
      unreadCount,
      loading,
      markRead,
      markAllRead,
      refresh,
      lastNewNotificationId
    }),
    [items, lastNewNotificationId, loading, markAllRead, markRead, refresh, unreadCount, userId]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotificationsContext() {
  return useContext(NotificationsContext);
}
