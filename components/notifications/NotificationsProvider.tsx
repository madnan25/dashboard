"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Notification } from "@/lib/dashboardDb";
import { getCurrentProfile } from "@/lib/dashboardDb";
import { isMarketingTeamProfile } from "@/components/tasks/taskModel";
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

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [lastNewNotificationId, setLastNewNotificationId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const profile = await getCurrentProfile();
        if (cancelled) return;
        if (profile && isMarketingTeamProfile(profile)) {
          setUserId(profile.id);
        } else {
          setUserId(null);
        }
      } catch {
        if (!cancelled) setUserId(null);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

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
