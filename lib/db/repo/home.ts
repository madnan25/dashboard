import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketingHomeInbox } from "@/lib/db/types";

const emptyInbox: MarketingHomeInbox = {
  assigned_count: 0,
  approval_count: 0,
  overdue_count: 0,
  involved_count: 0,
  items: []
};

export async function getMarketingHomeInbox(supabase: SupabaseClient, limit = 6): Promise<MarketingHomeInbox> {
  const { data, error } = await supabase.rpc("get_marketing_home_inbox", { p_limit: limit });
  if (error) throw error;
  if (!data || typeof data !== "object") return emptyInbox;
  const payload = data as MarketingHomeInbox;
  return {
    assigned_count: Number(payload.assigned_count ?? 0),
    approval_count: Number(payload.approval_count ?? 0),
    overdue_count: Number(payload.overdue_count ?? 0),
    involved_count: Number(payload.involved_count ?? 0),
    items: Array.isArray(payload.items) ? payload.items : []
  };
}
