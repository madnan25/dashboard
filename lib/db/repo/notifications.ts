import type { SupabaseClient } from "@supabase/supabase-js";
import type { Notification } from "@/lib/db/types";

export type ListNotificationsFilters = {
  userId?: string;
  limit?: number;
  unreadOnly?: boolean;
};

const notificationSelect = "id, user_id, type, title, body, related_task_id, created_at, read_at";

export async function listNotifications(
  supabase: SupabaseClient,
  filters?: ListNotificationsFilters
): Promise<Notification[]> {
  let q = supabase.from("notifications").select(notificationSelect).order("created_at", { ascending: false });
  if (filters?.userId) q = q.eq("user_id", filters.userId);
  if (filters?.unreadOnly) q = q.is("read_at", null);
  if (filters?.limit) q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data as Notification[]) ?? [];
}

export async function countUnreadNotifications(supabase: SupabaseClient, userId?: string): Promise<number> {
  let q = supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  if (userId) q = q.eq("user_id", userId);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(supabase: SupabaseClient, id: string, userId?: string): Promise<void> {
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (userId) q = q.eq("user_id", userId);
  const { error } = await q;
  if (error) throw error;
}

export async function markAllNotificationsRead(supabase: SupabaseClient, userId?: string): Promise<void> {
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (userId) q = q.eq("user_id", userId);
  const { error } = await q;
  if (error) throw error;
}

export async function deleteNotificationsBefore(supabase: SupabaseClient, userId: string, beforeIso: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", userId)
    .lt("created_at", beforeIso);
  if (error) throw error;
}
