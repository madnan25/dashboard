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
  unreadOnly?: boolean;
  onNewNotification?: (notification: Notification) => void;
};

export function useNotifications({
  userId,
  limit = 6,
  initialItems,
  initialUnreadCount,
  unreadOnly = false,
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
        listNotifications(supabase, { userId, limit, unreadOnly }),
        countUnreadNotifications(supabase, userId)
      ]);
      setItems(list);
      setUnreadCount(count);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [limit, supabase, unreadOnly, userId]);

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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const next = payload.new as Notification;
          const prevRow = (payload.old ?? null) as Notification | null;
          setItems((prev) => {
            const existing = prev.find((n) => n.id === next.id);
            const wasUnread = existing ? !existing.read_at : prevRow ? !prevRow.read_at : false;
            if (unreadOnly) {
              if (next.read_at) {
                if (existing && wasUnread) setUnreadCount((count) => Math.max(0, count - 1));
                return prev.filter((n) => n.id !== next.id);
              }
              if (existing) {
                return prev.map((n) => (n.id === next.id ? next : n));
              }
              return [next, ...prev].slice(0, limit);
            }
            if (existing) {
              if (wasUnread && next.read_at) setUnreadCount((count) => Math.max(0, count - 1));
              return prev.map((n) => (n.id === next.id ? next : n));
            }
            if (!next.read_at) {
              return [next, ...prev].slice(0, limit);
            }
            return prev;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const prevRow = (payload.old ?? null) as Notification | null;
          if (!prevRow) return;
          setItems((prev) => {
            const existing = prev.find((n) => n.id === prevRow.id);
            if (!existing) return prev;
            if (!existing.read_at) setUnreadCount((count) => Math.max(0, count - 1));
            return prev.filter((n) => n.id !== prevRow.id);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit, onNewNotification, supabase, unreadOnly, userId]);

  const markRead = useCallback(
    async (id: string) => {
      if (!userId) return;
      let shouldDecrement = false;
      setItems((prev) => {
        if (unreadOnly) {
          const target = prev.find((n) => n.id === id);
          if (target && !target.read_at) shouldDecrement = true;
          return prev.filter((n) => n.id !== id);
        }
        return prev.map((n) => {
          if (n.id !== id) return n;
          if (!n.read_at) shouldDecrement = true;
          return { ...n, read_at: n.read_at ?? new Date().toISOString() };
        });
      });
      if (shouldDecrement) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      try {
        await markNotificationRead(supabase, id, userId);
      } catch {
        refresh();
      }
    },
    [refresh, supabase, unreadOnly, userId]
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    setItems((prev) => (unreadOnly ? [] : prev.map((n) => (n.read_at ? n : { ...n, read_at: now }))));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead(supabase, userId);
    } catch {
      refresh();
    }
  }, [refresh, supabase, unreadOnly, userId]);

  return { items, unreadCount, loading, refresh, markRead, markAllRead };
}
