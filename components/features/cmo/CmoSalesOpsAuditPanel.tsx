"use client";

import { useEffect, useMemo, useState } from "react";
import { AppButton } from "@/components/ds/AppButton";
import { PillSelect } from "@/components/ds/PillSelect";
import { Surface } from "@/components/ds/Surface";
import { formatNumber } from "@/lib/format";
import type { Project, SalesOpsActualsAuditEntry } from "@/lib/dashboardDb";
import { listSalesOpsActualsAudit } from "@/lib/dashboardDb";

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

function fmtTimeLabel(iso: string) {
  const d = new Date(iso);
  const isValid = Number.isFinite(d.getTime());
  return isValid ? d.toLocaleString() : iso;
}

function truncToSecondIso(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  d.setMilliseconds(0);
  return d.toISOString();
}

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

type ChangeRow = {
  entry: SalesOpsActualsAuditEntry;
  label: string;
  diffs: Array<{ field: string; oldVal: unknown; newVal: unknown }>;
};

type ChangeSet = {
  key: string;
  timeIso: string; // truncated to second
  timeLabel: string;
  actor: string;
  projectName: string;
  yyyymm: string;
  changed: ChangeRow[];
  unchanged: ChangeRow[];
  total: number;
};

export function CmoSalesOpsAuditPanel(props: { projects: Project[]; projectId: string; year: number; month: number }) {
  const { projects, projectId, year, month } = props;
  const [monthScope, setMonthScope] = useState<MonthScope>("selected");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => projectId || "all");
  const [rows, setRows] = useState<SalesOpsActualsAuditEntry[]>([]);
  const [sets, setSets] = useState<ChangeSet[]>([]);
  const [selectedSetKey, setSelectedSetKey] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const projectsById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of projects) map[p.id] = p.name;
    return map;
  }, [projects]);

  const effectiveProjectId = selectedProjectId === "all" ? "" : selectedProjectId;
  const selectedProjectName = effectiveProjectId ? projectsById[effectiveProjectId] ?? "Selected project" : "All projects";

  async function load() {
    if (selectedProjectId !== "all" && !effectiveProjectId) return;
    setStatus("");
    setLoading(true);
    try {
      const rows = await listSalesOpsActualsAudit({
        projectId: selectedProjectId === "all" ? null : effectiveProjectId,
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
    // keep in sync when the parent selection changes
    if (projectId && selectedProjectId === "all") {
      // leave as is
    } else if (projectId && selectedProjectId !== projectId && selectedProjectId !== "all") {
      // don't override explicit user selection
    } else if (projectId && selectedProjectId === "all") {
      // keep all
    } else if (projectId && !selectedProjectId) {
      setSelectedProjectId(projectId);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, selectedProjectId, monthScope, year, month]);

  useEffect(() => {
    const grouped = new Map<string, ChangeSet>();
    for (const entry of rows) {
      const timeIso = truncToSecondIso(entry.event_time);
      const actor = entry.actor_name || entry.actor_email || entry.actor_role || (entry.actor_id ? entry.actor_id.slice(0, 8) + "…" : "Unknown");
      const pid = entry.project_id ?? "";
      const y = entry.year ?? 0;
      const m = entry.month ?? 0;
      const yyyymm = y && m ? `${y}/${m}` : "—";
      const projectName = pid ? projectsById[pid] ?? pid.slice(0, 8) + "…" : "—";
      const key = `${timeIso}|${actor}|${pid}|${y}|${m}`;

      const label = (() => {
        const tableLabel = TABLE_LABELS[entry.table_name] ?? entry.table_name;
        const subKey = entry.channel ?? entry.source ?? entry.bucket;
        return subKey ? `${tableLabel} • ${subKey}` : tableLabel;
      })();
      const diffs = getDiffs(entry);
      const row: ChangeRow = { entry, label, diffs };

      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          key,
          timeIso,
          timeLabel: fmtTimeLabel(timeIso),
          actor,
          projectName,
          yyyymm,
          changed: diffs.length ? [row] : [],
          unchanged: diffs.length ? [] : [row],
          total: 1
        });
      } else {
        existing.total += 1;
        if (diffs.length) existing.changed.push(row);
        else existing.unchanged.push(row);
      }
    }
    const nextSets = Array.from(grouped.values()).sort((a, b) => (a.timeIso < b.timeIso ? 1 : a.timeIso > b.timeIso ? -1 : 0));
    setSets(nextSets);
    if (!selectedSetKey && nextSets.length > 0) setSelectedSetKey(nextSets[0]!.key);
    // if current selected key disappeared, pick latest
    if (selectedSetKey && nextSets.length > 0 && !nextSets.some((s) => s.key === selectedSetKey)) {
      setSelectedSetKey(nextSets[0]!.key);
    }
  }, [projectsById, rows, selectedSetKey]);

  const selectedSet = useMemo(() => sets.find((s) => s.key === selectedSetKey) ?? null, [sets, selectedSetKey]);

  return (
    <Surface>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-white/90">Sales Ops audit (last 7 days)</div>
          <div className="mt-1 text-sm text-white/55">
            Tracks edits to channel actuals, digital sources, and attribution events.
          </div>
          <div className="mt-1 text-xs text-white/45">
            Project: <span className="text-white/70">{selectedProjectName}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PillSelect
            value={selectedProjectId || "all"}
            onChange={(v) => setSelectedProjectId(v)}
            ariaLabel="Audit project"
            className="min-w-[220px]"
          >
            <option value="all">All projects</option>
            {projects
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
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

      <div className="mt-4">
        {!loading && sets.length === 0 ? <div className="text-sm text-white/55">No audit entries found.</div> : null}

        {sets.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-white/45">Change time</span>
              <PillSelect
                value={selectedSetKey || sets[0]!.key}
                onChange={(v) => setSelectedSetKey(v)}
                ariaLabel="Audit change time"
                className="min-w-[260px]"
              >
                {sets.slice(0, 80).map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.timeLabel}
                  </option>
                ))}
              </PillSelect>
            </div>
            {selectedSet ? (
              <div className="text-xs text-white/55">
                <span className="text-white/70">{selectedSet.actor}</span>
                <span className="text-white/40"> • </span>
                <span className="text-white/70">{selectedSet.projectName}</span>
                <span className="text-white/40"> • </span>
                <span className="text-white/70">{selectedSet.yyyymm}</span>
                <span className="text-white/40"> • </span>
                <span className="text-white/70">{selectedSet.total} row(s)</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {selectedSet ? (
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold text-white/85">{selectedSet.timeLabel}</div>
              <div className="text-xs text-white/55">
                {selectedSet.changed.length} change(s) • {selectedSet.unchanged.length} unchanged row(s)
              </div>
            </div>

            <div className="max-h-[520px] overflow-auto p-4">
              {selectedSet.changed.length > 0 ? (
                <div className="space-y-3">
                  {selectedSet.changed.map((cr) => {
                    const action = cr.entry.action.toUpperCase();
                    return (
                      <div key={cr.entry.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-white/70">
                            <span className="font-semibold text-white/85">{action}</span>
                            <span className="text-white/40"> • </span>
                            <span>{cr.label}</span>
                          </div>
                          <div className="text-[11px] text-white/45">{fmtTimeLabel(cr.entry.event_time)}</div>
                        </div>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          {cr.diffs.map((diff) => (
                            <div
                              key={diff.field}
                              className="flex items-center justify-between gap-3 rounded-lg bg-black/25 px-3 py-2 text-xs text-white/70"
                            >
                              <span className="text-white/60">{FIELD_LABELS[diff.field] ?? diff.field}</span>
                              <span className="font-semibold text-white/85">
                                {formatValue(diff.oldVal, projectsById)} → {formatValue(diff.newVal, projectsById)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-white/55">No tracked field changes in this save.</div>
              )}

              {selectedSet.unchanged.length > 0 ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs font-semibold text-white/75">Unchanged rows (tracked fields)</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/60">
                    {selectedSet.unchanged.slice(0, 24).map((cr) => (
                      <span key={cr.entry.id} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
                        {cr.label}
                      </span>
                    ))}
                    {selectedSet.unchanged.length > 24 ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
                        +{selectedSet.unchanged.length - 24} more
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 text-[11px] text-white/45">
                    Note: “unchanged” means the tracked fields didn’t change; metadata fields may still have updated.
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </Surface>
  );
}
