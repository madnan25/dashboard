"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Notification } from "@/lib/dashboardDb";
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "@/lib/db/repo/notifications";

const NOTIFICATIONS_SYNC_EVENT = "dashboard:notifications-sync";
const PENDING_READ_WINDOW_MS = 30000;
const REALTIME_STALE_AFTER_MS = 45000;

type NotificationsSyncDetail = {
  userId: string;
  origin: string;
  at: string;
  kind: "mark_read" | "mark_all_read";
  id?: string;
};

type UseNotificationsOptions = {
  userId?: string | null;
  limit?: number;
  initialItems?: Notification[];
  initialUnreadCount?: number;
  unreadOnly?: boolean;
  onNewNotification?: (notification: Notification) => void;
  pollIntervalMs?: number; // fallback if realtime misses events (only used when realtime unhealthy)
};

export function useNotifications({
  userId,
  limit = 6,
  initialItems,
  initialUnreadCount,
  unreadOnly = false,
  onNewNotification,
  pollIntervalMs = 20000
}: UseNotificationsOptions) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [items, setItems] = useState<Notification[]>(initialItems ?? []);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount ?? 0);
  const [loading, setLoading] = useState(false);
  const didInitialRefreshRef = useRef(false);
  const latestIdRef = useRef<string | null>(null);
  const realtimeHealthyRef = useRef(false);
  const lastRealtimeMessageAtMsRef = useRef<number>(0);
  const instanceIdRef = useRef<string>("");
  const itemsRef = useRef<Notification[]>(items);
  const lastMarkAllAtRef = useRef<string | null>(null);
  const lastMarkAllAtMsRef = useRef<number>(0);
  const pendingReadRef = useRef<Map<string, { at: string; atMs: number }>>(new Map());
  const lastOptimisticAtRef = useRef<string | null>(null);
  const lastOptimisticCountRef = useRef<number | null>(null);
  const unreadCountRef = useRef<number>(unreadCount);

  if (!instanceIdRef.current) {
    try {
      instanceIdRef.current =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Math.random()}`;
    } catch {
      instanceIdRef.current = `${Math.random()}`;
    }
  }

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    unreadCountRef.current = unreadCount;
  }, [unreadCount]);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent);
    if (!userId) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const [list, count] = await Promise.all([
        listNotifications(supabase, { userId, limit, unreadOnly }),
        countUnreadNotifications(supabase, userId)
      ]);

      const nowMs = Date.now();
      const pending = pendingReadRef.current;
      if (pending.size > 0) {
        for (const [id, info] of pending) {
          if (nowMs - info.atMs > PENDING_READ_WINDOW_MS) {
            pending.delete(id);
            continue;
          }
          const confirmed = list.find((n) => n.id === id);
          if (confirmed && confirmed.read_at) pending.delete(id);
        }
      }

      const lastMarkAllAt = lastMarkAllAtRef.current;
      const lastMarkAllMs = lastMarkAllAtMsRef.current;
      const shouldOverrideCount = lastMarkAllAt && Date.now() - lastMarkAllMs < 5000;
      let nextList = list;
      let nextCount = count;
      if (lastMarkAllAt) {
        const cutoffMs = new Date(lastMarkAllAt).getTime();
        if (Number.isFinite(cutoffMs)) {
          nextList = list.map((n) => {
            const createdMs = new Date(n.created_at).getTime();
            if (createdMs <= cutoffMs && !n.read_at) {
              return { ...n, read_at: lastMarkAllAt };
            }
            return n;
          });
          if (unreadOnly) {
            nextList = nextList.filter((n) => !n.read_at);
          }
          if (shouldOverrideCount) {
            nextCount = nextList.filter((n) => !n.read_at).length;
          }
        }
      }

      if (pending.size > 0) {
        nextList = nextList.map((n) => {
          const pendingInfo = pending.get(n.id);
          if (pendingInfo && nowMs - pendingInfo.atMs <= PENDING_READ_WINDOW_MS) {
            return n.read_at ? n : { ...n, read_at: pendingInfo.at };
          }
          return n;
        });
        if (unreadOnly) {
          nextList = nextList.filter((n) => !n.read_at);
        }
      }

      const lastOptimisticAt = lastOptimisticAtRef.current;
      const lastOptimisticCount = lastOptimisticCountRef.current;
      const currentItems = itemsRef.current;
      const hasNewUnreadIds = nextList.some(
        (n) => !n.read_at && !currentItems.some((existing) => existing.id === n.id)
      );
      if (!hasNewUnreadIds) {
        const floorCount = unreadCountRef.current;
        if (floorCount != null) nextCount = Math.min(nextCount, floorCount);
      } else if (lastOptimisticAt && lastOptimisticCount != null && nowMs - Date.parse(lastOptimisticAt) < PENDING_READ_WINDOW_MS) {
        // If we got new unread rows, still avoid jumping above optimistic count within the pending window.
        nextCount = Math.min(nextCount, lastOptimisticCount + 1);
      }

      // If realtime is unavailable/missed events, detect newly arrived notifications on refresh
      // and trigger the same UX (bell auto-open).
      if (didInitialRefreshRef.current && nextList.length > 0) {
        const newest = nextList[0];
        const prevTopId = latestIdRef.current;
        if (prevTopId && newest.id !== prevTopId && !newest.read_at) onNewNotification?.(newest);
      }

      setItems(nextList);
      setUnreadCount(nextCount);
      latestIdRef.current = nextList[0]?.id ?? null;
    } catch {
      // ignore
    } finally {
      if (!silent) setLoading(false);
      didInitialRefreshRef.current = true;
    }
    },
    [limit, onNewNotification, supabase, unreadOnly, userId]
  );

  const refreshUnreadCountOnly = useCallback(async () => {
    if (!userId) return;
    try {
      const count = await countUnreadNotifications(supabase, userId);
      const prev = unreadCountRef.current;
      // If count changed, do a full refresh to keep list + count coherent.
      if (count !== prev) {
        await refresh({ silent: true });
      }
    } catch {
      // ignore
    }
  }, [refresh, supabase, userId]);

  useEffect(() => {
    // Initial load should be silent to avoid "Refreshing..." flicker in the bell dropdown.
    refresh({ silent: true });
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;

    // Refresh when the user returns to the tab/window.
    function onFocus() {
      refreshUnreadCountOnly();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") refreshUnreadCountOnly();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshUnreadCountOnly, userId]);

  useEffect(() => {
    if (!userId) return;
    if (!pollIntervalMs || pollIntervalMs < 5000) return;

    // Low-frequency polling fallback (avoid polling while tab is hidden).
    // Only poll when realtime is unhealthy or stale to save resources.
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      const stale =
        realtimeHealthyRef.current &&
        lastRealtimeMessageAtMsRef.current > 0 &&
        now - lastRealtimeMessageAtMsRef.current > REALTIME_STALE_AFTER_MS;
      if (realtimeHealthyRef.current && !stale) return;
      refreshUnreadCountOnly();
    }, pollIntervalMs);
    return () => window.clearInterval(id);
  }, [pollIntervalMs, refreshUnreadCountOnly, userId]);

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
          latestIdRef.current = next.id;
          lastRealtimeMessageAtMsRef.current = Date.now();
          onNewNotification?.(next);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const next = payload.new as Notification;
          const prevRow = (payload.old ?? null) as Notification | null;
          lastRealtimeMessageAtMsRef.current = Date.now();
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
          lastRealtimeMessageAtMsRef.current = Date.now();
          setItems((prev) => {
            const existing = prev.find((n) => n.id === prevRow.id);
            if (!existing) return prev;
            if (!existing.read_at) setUnreadCount((count) => Math.max(0, count - 1));
            return prev.filter((n) => n.id !== prevRow.id);
          });
        }
      )
      .subscribe((status) => {
        realtimeHealthyRef.current = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") lastRealtimeMessageAtMsRef.current = Date.now();
        // If we just (re)subscribed, do a silent refresh to reconcile any missed events.
        if (status === "SUBSCRIBED") refresh({ silent: true });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit, onNewNotification, refresh, supabase, unreadOnly, userId]);

  useEffect(() => {
    if (!userId) return;
    function onSync(e: Event) {
      const detail = (e as CustomEvent<NotificationsSyncDetail>).detail;
      if (!detail || detail.userId !== userId) return;
      if (detail.origin === instanceIdRef.current) return;

      if (detail.kind === "mark_all_read") {
        setItems((prev) => (unreadOnly ? [] : prev.map((n) => (n.read_at ? n : { ...n, read_at: detail.at }))));
        setUnreadCount(0);
      lastMarkAllAtRef.current = detail.at;
      lastMarkAllAtMsRef.current = Date.now();
        lastOptimisticAtRef.current = detail.at;
        lastOptimisticCountRef.current = 0;
        return;
      }

      if (detail.kind === "mark_read" && detail.id) {
        setItems((prev) => {
          if (unreadOnly) return prev.filter((n) => n.id !== detail.id);
          return prev.map((n) => (n.id === detail.id ? { ...n, read_at: n.read_at ?? detail.at } : n));
        });
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    }

    window.addEventListener(NOTIFICATIONS_SYNC_EVENT, onSync as EventListener);
    return () => window.removeEventListener(NOTIFICATIONS_SYNC_EVENT, onSync as EventListener);
  }, [unreadOnly, userId]);

  const markRead = useCallback(
    async (id: string) => {
      if (!userId) return;
      const now = new Date().toISOString();
      const cur = itemsRef.current;
      const existing = cur.find((n) => n.id === id) ?? null;
      const wasUnread = unreadOnly ? true : existing ? !existing.read_at : true;

      setItems((prev) => {
        if (unreadOnly) {
          return prev.filter((n) => n.id !== id);
        }
        return prev.map((n) => {
          if (n.id !== id) return n;
          return { ...n, read_at: n.read_at ?? now };
        });
      });
      if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
      if (wasUnread) {
        pendingReadRef.current.set(id, { at: now, atMs: Date.now() });
        lastOptimisticAtRef.current = now;
        lastOptimisticCountRef.current = Math.max(0, unreadCountRef.current - 1);
      }

      // Broadcast so other mounted notification widgets update instantly (no waiting for realtime/refresh).
      window.dispatchEvent(
        new CustomEvent<NotificationsSyncDetail>(NOTIFICATIONS_SYNC_EVENT, {
          detail: { userId, origin: instanceIdRef.current, at: now, kind: "mark_read", id }
        })
      );
      try {
        await markNotificationRead(supabase, id, userId);
      } catch {
        refresh({ silent: true });
      }
    },
    [refresh, supabase, unreadOnly, userId]
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    setItems((prev) => (unreadOnly ? [] : prev.map((n) => (n.read_at ? n : { ...n, read_at: now }))));
    setUnreadCount(0);
    lastMarkAllAtRef.current = now;
    lastMarkAllAtMsRef.current = Date.now();
    lastOptimisticAtRef.current = now;
    lastOptimisticCountRef.current = 0;

    // Broadcast so other mounted notification widgets update instantly (no waiting for realtime/refresh).
    window.dispatchEvent(
      new CustomEvent<NotificationsSyncDetail>(NOTIFICATIONS_SYNC_EVENT, {
        detail: { userId, origin: instanceIdRef.current, at: now, kind: "mark_all_read" }
      })
    );
    try {
      await markAllNotificationsRead(supabase, userId);
    } catch {
      refresh({ silent: true });
    }
  }, [refresh, supabase, unreadOnly, userId]);

  return { items, unreadCount, loading, refresh, markRead, markAllRead };
}
