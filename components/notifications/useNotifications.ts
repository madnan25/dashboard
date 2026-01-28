"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Notification } from "@/lib/dashboardDb";
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "@/lib/db/repo/notifications";

type UseNotificationsOptions = {
  userId?: string | null;
  limit?: number;
  initialItems?: Notification[];
  initialUnreadCount?: number;
  onNewNotification?: (notification: Notification) => void;
};

export function useNotifications({
  userId,
  limit = 6,
  initialItems,
  initialUnreadCount,
  onNewNotification
}: UseNotificationsOptions) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [items, setItems] = useState<Notification[]>(initialItems ?? []);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount ?? 0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        listNotifications(supabase, { userId, limit }),
        countUnreadNotifications(supabase, userId)
      ]);
      setItems(list);
      setUnreadCount(count);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [limit, supabase, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const next = payload.new as Notification;
          setItems((prev) => [next, ...prev].slice(0, limit));
          setUnreadCount((prev) => prev + 1);
          onNewNotification?.(next);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit, onNewNotification, supabase, userId]);

  const markRead = useCallback(
    async (id: string) => {
      if (!userId) return;
      let shouldDecrement = false;
      setItems((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n;
          if (!n.read_at) shouldDecrement = true;
          return { ...n, read_at: n.read_at ?? new Date().toISOString() };
        })
      );
      if (shouldDecrement) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      try {
        await markNotificationRead(supabase, id, userId);
      } catch {
        refresh();
      }
    },
    [refresh, supabase, userId]
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead(supabase, userId);
    } catch {
      refresh();
    }
  }, [refresh, supabase, userId]);

  return { items, unreadCount, loading, refresh, markRead, markAllRead };
}
