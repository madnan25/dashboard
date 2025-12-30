import type { SupabaseClient } from "@supabase/supabase-js";
import type { SalesAttributionBucket, SalesAttributionEvent, SalesAttributionSourceKind } from "@/lib/db/types";

export type CreateSalesAttributionEventInput = {
  closed_project_id: string;
  close_year: number;
  close_month: number; // 1-12
  deals_won: number;
  sqft_won: number;
  source_kind: SalesAttributionSourceKind;
  source_campaign?: string | null;
  source_project_id?: string | null;
  bucket: SalesAttributionBucket;
  notes?: string | null;
};

export async function listSalesAttributionEvents(
  supabase: SupabaseClient,
  closedProjectId: string,
  year: number,
  month: number
): Promise<SalesAttributionEvent[]> {
  const { data, error } = await supabase
    .from("sales_attribution_events")
    .select(
      "id, closed_project_id, close_year, close_month, deals_won, sqft_won, source_kind, source_campaign, source_project_id, bucket, notes, created_by, created_at, updated_at"
    )
    .eq("closed_project_id", closedProjectId)
    .eq("close_year", year)
    .eq("close_month", month)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as SalesAttributionEvent[]) ?? [];
}

export async function createSalesAttributionEvent(
  supabase: SupabaseClient,
  input: CreateSalesAttributionEventInput
): Promise<SalesAttributionEvent> {
  const { data, error } = await supabase
    .from("sales_attribution_events")
    .insert({
      ...input,
      source_campaign: input.source_campaign ?? null,
      source_project_id: input.source_project_id ?? null,
      notes: input.notes ?? null
    })
    .select(
      "id, closed_project_id, close_year, close_month, deals_won, sqft_won, source_kind, source_campaign, source_project_id, bucket, notes, created_by, created_at, updated_at"
    )
    .single();
  if (error) throw error;
  return data as SalesAttributionEvent;
}

export async function deleteSalesAttributionEvent(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("sales_attribution_events").delete().eq("id", id);
  if (error) throw error;
}


