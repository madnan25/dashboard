"use client";

import { useEffect, useMemo, useState } from "react";
import { AppButton } from "@/components/ds/AppButton";
import { PillSelect } from "@/components/ds/PillSelect";
import { Surface } from "@/components/ds/Surface";
import { formatNumber } from "@/lib/format";
import type { Project, SalesOpsActualsAuditEntry } from "@/lib/dashboardDb";
import { listSalesOpsActualsAudit } from "@/lib/dashboardDb";

type Scope = "project" | "all";
type MonthScope = "selected" | "all";

const FIELD_LABELS: Record<string, string> = {
  leads: "Leads",
  not_contacted: "Not contacted",
  qualified_leads: "Qualified",
  meetings_scheduled: "Meetings scheduled",
  meetings_done: "Meetings done",
  deals_won: "Deals won",
  sqft_won: "Sqft won",
  bucket: "Bucket",
  source_kind: "Source kind",
  source_campaign: "Campaign",
  source_project_id: "Source project"
};

const TABLE_LABELS: Record<string, string> = {
  project_actuals_channels: "Channel actuals",
  project_actuals_digital_sources: "Digital sources",
  sales_attribution_events: "Attribution events"
};

function isNumericValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim() !== "" && Number.isFinite(Number(value));
  return false;
}

function formatValue(value: unknown, projectsById: Record<string, string>) {
  if (value == null || value === "") return "—";
  if (typeof value === "string" && projectsById[value]) return projectsById[value];
  if (isNumericValue(value)) return formatNumber(Number(value));
  return String(value);
}

function getDiffs(entry: SalesOpsActualsAuditEntry) {
  const fields =
    entry.table_name === "sales_attribution_events"
      ? ["bucket", "source_kind", "source_campaign", "source_project_id", "deals_won", "sqft_won"]
      : ["leads", "not_contacted", "qualified_leads", "meetings_scheduled", "meetings_done", "deals_won", "sqft_won"];

  const oldRow = entry.old_row ?? {};
  const newRow = entry.new_row ?? {};

  return fields
    .map((field) => {
      const oldVal = (oldRow as Record<string, unknown>)[field];
      const newVal = (newRow as Record<string, unknown>)[field];
      if (entry.action === "insert") {
        if (newVal == null || newVal === "") return null;
        return { field, oldVal: null, newVal };
      }
      if (entry.action === "delete") {
        if (oldVal == null || oldVal === "") return null;
        return { field, oldVal, newVal: null };
      }
      if (oldVal === newVal) return null;
      return { field, oldVal, newVal };
    })
    .filter(Boolean) as Array<{ field: string; oldVal: unknown; newVal: unknown }>;
}

export function CmoSalesOpsAuditPanel(props: { projects: Project[]; projectId: string; year: number; month: number }) {
  const { projects, projectId, year, month } = props;
  const [scope, setScope] = useState<Scope>("project");
  const [monthScope, setMonthScope] = useState<MonthScope>("selected");
  const [rows, setRows] = useState<SalesOpsActualsAuditEntry[]>([]);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const projectsById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of projects) map[p.id] = p.name;
    return map;
  }, [projects]);

  const selectedProjectName = projectId ? projectsById[projectId] ?? "Selected project" : "Select a project";

  async function load() {
    if (scope === "project" && !projectId) return;
    setStatus("");
    setLoading(true);
    try {
      const rows = await listSalesOpsActualsAudit({
        projectId: scope === "project" ? projectId : null,
        year: monthScope === "selected" ? year : null,
        month: monthScope === "selected" ? month : null,
        limit: 200,
        sinceDays: 7
      });
      setRows(rows);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load audit log");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, scope, monthScope, year, month]);

  return (
    <Surface>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-white/90">Sales Ops audit (last 7 days)</div>
          <div className="mt-1 text-sm text-white/55">
            Tracks edits to channel actuals, digital sources, and attribution events.
          </div>
          <div className="mt-1 text-xs text-white/45">
            Project: <span className="text-white/70">{scope === "project" ? selectedProjectName : "All projects"}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PillSelect value={scope} onChange={(v) => setScope(v as Scope)} ariaLabel="Project scope" className="min-w-[170px]">
            <option value="project">Selected project</option>
            <option value="all">All projects</option>
          </PillSelect>
          <PillSelect value={monthScope} onChange={(v) => setMonthScope(v as MonthScope)} ariaLabel="Month scope" className="min-w-[150px]">
            <option value="selected">Selected month</option>
            <option value="all">All months</option>
          </PillSelect>
          <AppButton intent="secondary" onPress={() => void load()} isDisabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </AppButton>
        </div>
      </div>

      {status ? <div className="mt-3 text-sm text-rose-200/90">{status}</div> : null}
      {loading ? <div className="mt-3 text-sm text-white/60">Loading audit log…</div> : null}

      <div className="mt-4 space-y-3">
        {!loading && rows.length === 0 ? <div className="text-sm text-white/55">No audit entries found.</div> : null}
        {rows.map((row) => {
          const diffs = getDiffs(row);
          const label = TABLE_LABELS[row.table_name] ?? row.table_name;
          const subKey = row.channel ?? row.source ?? row.bucket;
          const actor = row.actor_name || row.actor_email || row.actor_role || (row.actor_id ? row.actor_id.slice(0, 8) + "…" : "Unknown");
          const projectName = row.project_id ? projectsById[row.project_id] ?? row.project_id.slice(0, 8) + "…" : "—";
          return (
            <div key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm text-white/80">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white/90">{row.action.toUpperCase()}</span>
                    <span className="text-white/60">•</span>
                    <span>{label}</span>
                    {subKey ? <span className="text-white/60">•</span> : null}
                    {subKey ? <span className="text-white/80">{subKey}</span> : null}
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    {projectName} • {row.year ?? "—"}/{row.month ?? "—"}
                  </div>
                </div>
                <div className="text-right text-xs text-white/55">
                  <div>{new Date(row.event_time).toLocaleString()}</div>
                  <div className="mt-1 text-white/70">{actor}</div>
                </div>
              </div>

              {diffs.length > 0 ? (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {diffs.map((diff) => (
                    <div key={diff.field} className="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-2 text-xs text-white/70">
                      <span className="text-white/60">{FIELD_LABELS[diff.field] ?? diff.field}</span>
                      <span className="font-semibold text-white/85">
                        {formatValue(diff.oldVal, projectsById)} → {formatValue(diff.newVal, projectsById)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-xs text-white/45">No tracked field changes.</div>
              )}
            </div>
          );
        })}
      </div>
    </Surface>
  );
}
