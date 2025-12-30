import { PageHeader } from "@/components/ds/PageHeader";
import { NavCard } from "@/components/ds/NavCard";
import { Surface } from "@/components/ds/Surface";
import { KpiCard } from "@/components/ds/KpiCard";
import { createServerDbClient } from "@/lib/db/client/server";
import { createDashboardRepo } from "@/lib/db/repo";
import type { Project } from "@/lib/db/types";
import Link from "next/link";
import { ProjectsOverviewControls, type OverviewMode } from "@/components/projects/ProjectsOverviewControls";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = { year?: string; monthIndex?: string; mode?: string };

function clampInt(x: number, lo: number, hi: number) {
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, Math.trunc(x)));
}

function monthNum(monthIndex: number) {
  return monthIndex + 1; // 1-12
}

function prevMonthOf(year: number, month: number) {
  // month: 1-12
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function format2(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

type ActualRow = {
  project_id: string;
  year: number;
  month: number;
  sqft_won: number;
  spend_digital: number;
  spend_inbound: number;
  spend_activations: number;
};

type TargetRow = {
  project_id: string;
  year: number;
  month: number;
  sales_target_sqft: number;
  total_budget: number;
};

type PlanVersionRow = { id: string; project_id: string; month: number };
type PlanInputRow = { plan_version_id: string; allocated_budget: number };

export default async function ProjectsIndexPage(props: { searchParams?: Promise<SearchParams> }) {
  const envMissing =
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const sp: SearchParams = (await props.searchParams?.catch(() => ({} as SearchParams))) ?? ({} as SearchParams);
  const now = new Date();
  const year = clampInt(Number(sp.year ?? now.getFullYear()), 2000, 2100);
  const monthIndex = clampInt(Number(sp.monthIndex ?? now.getMonth()), 0, 11);
  const month = monthNum(monthIndex);
  const mode: OverviewMode = sp.mode === "ytd" ? "ytd" : "month";

  let projects: Project[] = [];
  let status = "";
  let overviewError = "";

  // Overview data
  let totalSqft = 0;
  let totalSpend = 0;

  let topImpact: Array<{ id: string; name: string; sqft: number; momDelta?: number }> = [];
  let topEfficiency: Array<{ id: string; name: string; sqft: number; spend: number; costPerSqft: number }> = [];
  let atRisk: Array<{ id: string; name: string; reasons: string[] }> = [];

  if (!envMissing) {
    try {
      const supabase = await createServerDbClient();
      const repo = createDashboardRepo(supabase);
      projects = (await repo.listProjects()).filter((x) => x.is_active);

      const projectIds = projects.map((p) => p.id);
      if (projectIds.length > 0) {
        const isCurrentMonth = year === now.getFullYear() && monthIndex === now.getMonth();
        const monthRatio = isCurrentMonth ? Math.min(1, Math.max(0, now.getDate() / daysInMonth(year, month))) : 1;

        async function fetchActualsMonth(y: number, m: number) {
          const { data, error } = await supabase
            .from("project_actuals")
            .select("project_id, year, month, sqft_won, spend_digital, spend_inbound, spend_activations")
            .eq("year", y)
            .eq("month", m)
            .in("project_id", projectIds);
          if (error) throw error;
          return ((data as ActualRow[]) ?? []).map((r) => ({
            ...r,
            sqft_won: r.sqft_won ?? 0,
            spend_digital: r.spend_digital ?? 0,
            spend_inbound: r.spend_inbound ?? 0,
            spend_activations: r.spend_activations ?? 0
          }));
        }

        async function fetchActualsYtd() {
          const { data, error } = await supabase
            .from("project_actuals")
            .select("project_id, year, month, sqft_won, spend_digital, spend_inbound, spend_activations")
            .eq("year", year)
            .lte("month", month)
            .in("project_id", projectIds);
          if (error) throw error;
          return ((data as ActualRow[]) ?? []).map((r) => ({
            ...r,
            sqft_won: r.sqft_won ?? 0,
            spend_digital: r.spend_digital ?? 0,
            spend_inbound: r.spend_inbound ?? 0,
            spend_activations: r.spend_activations ?? 0
          }));
        }

        async function fetchTargetsRange(ytd: boolean) {
          let q = supabase
            .from("project_targets")
            .select("project_id, year, month, sales_target_sqft, total_budget")
            .eq("year", year)
            .in("project_id", projectIds);
          q = ytd ? q.lte("month", month) : q.eq("month", month);
          const { data, error } = await q;
          if (error) throw error;
          return ((data as TargetRow[]) ?? []).map((r) => ({
            ...r,
            sales_target_sqft: r.sales_target_sqft ?? 0,
            total_budget: r.total_budget ?? 0
          }));
        }

        async function fetchApprovedPlanAllocations(ytd: boolean) {
          let vq = supabase
            .from("project_plan_versions")
            .select("id, project_id, month")
            .eq("year", year)
            .eq("status", "approved")
            .eq("active", true)
            .in("project_id", projectIds);
          vq = ytd ? vq.lte("month", month) : vq.eq("month", month);
          const { data: versions, error: vErr } = await vq;
          if (vErr) throw vErr;
          const vs = (versions as PlanVersionRow[]) ?? [];
          const versionIds = vs.map((v) => v.id);
          if (versionIds.length === 0) return { versions: vs, inputs: [] as PlanInputRow[] };
          const { data: inputs, error: iErr } = await supabase
            .from("project_plan_channel_inputs")
            .select("plan_version_id, allocated_budget")
            .in("plan_version_id", versionIds);
          if (iErr) throw iErr;
          return { versions: vs, inputs: ((inputs as PlanInputRow[]) ?? []).map((r) => ({ ...r, allocated_budget: r.allocated_budget ?? 0 })) };
        }

        const [actualsRows, prevRows, targetsRows, planPack] =
          mode === "month"
            ? await Promise.all([
                fetchActualsMonth(year, month),
                fetchActualsMonth(prevMonthOf(year, month).year, prevMonthOf(year, month).month),
                fetchTargetsRange(false),
                fetchApprovedPlanAllocations(false)
              ])
            : await Promise.all([fetchActualsYtd(), Promise.resolve([] as ActualRow[]), fetchTargetsRange(true), fetchApprovedPlanAllocations(true)]);

        // Aggregate actuals by project
        const actualByProject = new Map<string, { sqft: number; spend: number; monthSpendByMonth?: Map<number, number> }>();
        if (mode === "month") {
          for (const r of actualsRows) {
            const spend = (r.spend_digital ?? 0) + (r.spend_inbound ?? 0) + (r.spend_activations ?? 0);
            actualByProject.set(r.project_id, { sqft: r.sqft_won ?? 0, spend });
          }
        } else {
          for (const r of actualsRows) {
            const spend = (r.spend_digital ?? 0) + (r.spend_inbound ?? 0) + (r.spend_activations ?? 0);
            const cur = actualByProject.get(r.project_id) ?? { sqft: 0, spend: 0 };
            cur.sqft += r.sqft_won ?? 0;
            cur.spend += spend;
            actualByProject.set(r.project_id, cur);
          }
        }

        // Prev month sqft by project (for MoM delta)
        const prevSqftByProject = new Map<string, number>();
        for (const r of prevRows ?? []) prevSqftByProject.set(r.project_id, r.sqft_won ?? 0);

        // Targets (month or ytd)
        const targetByProject = new Map<string, { sqft: number; budget: number; byMonth?: Map<number, { sqft: number; budget: number }> }>();
        if (mode === "month") {
          for (const t of targetsRows) targetByProject.set(t.project_id, { sqft: t.sales_target_sqft ?? 0, budget: t.total_budget ?? 0 });
        } else {
          for (const t of targetsRows) {
            const cur = targetByProject.get(t.project_id) ?? { sqft: 0, budget: 0, byMonth: new Map() };
            cur.byMonth!.set(t.month, { sqft: t.sales_target_sqft ?? 0, budget: t.total_budget ?? 0 });
            cur.sqft += t.sales_target_sqft ?? 0;
            cur.budget += t.total_budget ?? 0;
            targetByProject.set(t.project_id, cur);
          }
        }

        // Plan allocations
        const planVersionToProject = new Map<string, { projectId: string; month: number }>();
        for (const v of planPack.versions) planVersionToProject.set(v.id, { projectId: v.project_id, month: v.month });

        const planAllocByProject = new Map<string, number>();
        const planAllocByProjectMonth = new Map<string, Map<number, number>>();
        for (const inp of planPack.inputs) {
          const meta = planVersionToProject.get(inp.plan_version_id);
          if (!meta) continue;
          const pid = meta.projectId;
          planAllocByProject.set(pid, (planAllocByProject.get(pid) ?? 0) + (inp.allocated_budget ?? 0));
          const mm = planAllocByProjectMonth.get(pid) ?? new Map<number, number>();
          mm.set(meta.month, (mm.get(meta.month) ?? 0) + (inp.allocated_budget ?? 0));
          planAllocByProjectMonth.set(pid, mm);
        }

        // Totals
        totalSqft = 0;
        totalSpend = 0;
        for (const p of projects) {
          const a = actualByProject.get(p.id) ?? { sqft: 0, spend: 0 };
          totalSqft += a.sqft;
          totalSpend += a.spend;
        }

        // Ranked: Impact
        topImpact = [...projects]
          .map((p) => {
            const a = actualByProject.get(p.id) ?? { sqft: 0, spend: 0 };
            const prevSqft = prevSqftByProject.get(p.id) ?? 0;
            const momDelta = mode === "month" ? a.sqft - prevSqft : undefined;
            return { id: p.id, name: p.name, sqft: a.sqft, momDelta };
          })
          .sort((a, b) => b.sqft - a.sqft)
          .slice(0, 5);

        // Ranked: Efficiency
        topEfficiency = [...projects]
          .map((p) => {
            const a = actualByProject.get(p.id) ?? { sqft: 0, spend: 0 };
            const costPerSqft = a.sqft > 0 ? a.spend / a.sqft : Number.POSITIVE_INFINITY;
            return { id: p.id, name: p.name, sqft: a.sqft, spend: a.spend, costPerSqft };
          })
          .filter((x) => Number.isFinite(x.costPerSqft))
          .sort((a, b) => a.costPerSqft - b.costPerSqft)
          .slice(0, 5);

        // At-risk
        const atRiskRows = [...projects].map((p) => {
          const a = actualByProject.get(p.id) ?? { sqft: 0, spend: 0 };
          const t = targetByProject.get(p.id) ?? { sqft: 0, budget: 0, byMonth: undefined };

          let expectedSqft = 0;
          let expectedBudget = 0;
          let expectedPlanAlloc = 0;

          if (mode === "month") {
            expectedSqft = t.sqft * monthRatio;
            expectedBudget = t.budget * monthRatio;
            expectedPlanAlloc = (planAllocByProject.get(p.id) ?? 0) * monthRatio;
          } else {
            // YTD: full months before selected, plus partial current month if applicable.
            const byMonth = t.byMonth ?? new Map<number, { sqft: number; budget: number }>();
            for (let m = 1; m <= month; m++) {
              const row = byMonth.get(m) ?? { sqft: 0, budget: 0 };
              const r = isCurrentMonth && m === month ? monthRatio : 1;
              expectedSqft += row.sqft * r;
              expectedBudget += row.budget * r;
            }

            const planByMonth = planAllocByProjectMonth.get(p.id) ?? new Map<number, number>();
            for (let m = 1; m <= month; m++) {
              const alloc = planByMonth.get(m) ?? 0;
              const r = isCurrentMonth && m === month ? monthRatio : 1;
              expectedPlanAlloc += alloc * r;
            }
          }

          const reasons: string[] = [];
          if (expectedSqft > 0 && a.sqft < expectedSqft * 0.9) reasons.push("behind pace");

          const budgetRef = expectedPlanAlloc > 0 ? expectedPlanAlloc : expectedBudget;
          if (budgetRef > 0 && a.spend > budgetRef * 1.05) reasons.push("over spend");

          return { id: p.id, name: p.name, reasons, gap: expectedSqft > 0 ? (expectedSqft - a.sqft) / expectedSqft : 0, over: budgetRef > 0 ? (a.spend - budgetRef) / budgetRef : 0 };
        });

        atRisk = atRiskRows
          .filter((r) => r.reasons.length > 0)
          .sort((a, b) => Math.max(b.gap, b.over) - Math.max(a.gap, a.over))
          .slice(0, 5)
          .map((r) => ({ id: r.id, name: r.name, reasons: r.reasons }));
      }
    } catch (e) {
      status = e instanceof Error ? e.message : "Failed to load projects";
      overviewError = status;
    }
  }

  const roiSqftPerSpend = totalSpend > 0 ? totalSqft / totalSpend : null;
  const costPerSqft = totalSqft > 0 ? totalSpend / totalSqft : null;

  const qs = `?year=${encodeURIComponent(String(year))}&monthIndex=${encodeURIComponent(String(monthIndex))}&mode=${encodeURIComponent(mode)}`;
  const qsProject = `?year=${encodeURIComponent(String(year))}&monthIndex=${encodeURIComponent(String(monthIndex))}`;

  return (
    <main className="min-h-screen px-4 md:px-6 pb-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader
          title="Projects"
          subtitle="Master dashboard, then deep dive by project."
          showBack
          right={!envMissing ? <ProjectsOverviewControls year={year} monthIndex={monthIndex} mode={mode} /> : null}
        />

        {status ? (
          <Surface>
            <div className="text-sm text-amber-200/90">{status}</div>
          </Surface>
        ) : null}

        {envMissing ? (
          <Surface>
            <div className="text-sm text-amber-200/90">
              Supabase env vars are missing. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
            </div>
          </Surface>
        ) : null}

        {!envMissing ? (
          <div className="space-y-4">
            <div className="px-1">
              <div className="text-lg font-semibold text-white/90">Marketing overview</div>
              <div className="mt-1 text-sm text-white/55">Totals + where to look next.</div>
            </div>

            {overviewError && !envMissing ? (
              <Surface>
                <div className="text-sm text-amber-200/90">{overviewError}</div>
              </Surface>
            ) : null}

            <div className="grid gap-4 md:grid-cols-3">
              <KpiCard
                label="Total pipeline created (SQFT)"
                value={formatNumber(totalSqft)}
                helper={mode === "ytd" ? "Year to date" : "This month"}
              />
              <KpiCard label="Total spend" value={formatNumber(totalSpend)} helper="Digital + Inbound + Activations" />
              <KpiCard
                label="Efficiency (spend per sqft)"
                value={costPerSqft != null ? format2(costPerSqft) : "—"}
                helper={costPerSqft != null ? "How much we spent per 1 sqft won." : "No sqft won recorded"}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Surface>
                <div className="text-sm font-semibold text-white/90">Top 5: Impact</div>
                <div className="mt-1 text-xs text-white/55">Highest sqft won{mode === "month" ? " with MoM delta" : ""}.</div>
                <div className="mt-4 space-y-2">
                  {topImpact.length === 0 ? (
                    <div className="text-sm text-white/50">No data yet.</div>
                  ) : (
                    topImpact.map((x, i) => (
                      <div key={x.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-white/85">
                            {i + 1}.{" "}
                            <Link className="underline text-white/80" href={`/projects/${x.id}${qs}`}>
                              {x.name}
                            </Link>
                          </div>
                          {mode === "month" && typeof x.momDelta === "number" ? (
                            <div className="text-xs text-white/45">MoM: {x.momDelta >= 0 ? "+" : ""}{formatNumber(x.momDelta)}</div>
                          ) : null}
                        </div>
                        <div className="text-sm font-semibold text-white/90 tabular-nums">{formatNumber(x.sqft)}</div>
                      </div>
                    ))
                  )}
                </div>
              </Surface>

              <Surface>
                <div className="text-sm font-semibold text-white/90">Top 5: Efficiency</div>
                <div className="mt-1 text-xs text-white/55">Lowest cost per sqft.</div>
                <div className="mt-4 space-y-2">
                  {topEfficiency.length === 0 ? (
                    <div className="text-sm text-white/50">No data yet.</div>
                  ) : (
                    topEfficiency.map((x, i) => (
                      <div key={x.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-white/85">
                            {i + 1}.{" "}
                            <Link className="underline text-white/80" href={`/projects/${x.id}${qs}`}>
                              {x.name}
                            </Link>
                          </div>
                          <div className="text-xs text-white/45">
                            Spend {formatNumber(x.spend)} · Sqft {formatNumber(x.sqft)}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-white/90 tabular-nums">{format2(x.costPerSqft)}</div>
                      </div>
                    ))
                  )}
                </div>
              </Surface>

              <Surface>
                <div className="text-sm font-semibold text-white/90">At-risk projects</div>
                <div className="mt-1 text-xs text-white/55">Behind pace or over spend vs plan/budget.</div>
                <div className="mt-4 space-y-2">
                  {atRisk.length === 0 ? (
                    <div className="text-sm text-white/50">No at-risk projects.</div>
                  ) : (
                    atRisk.map((x, i) => (
                      <div key={x.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-white/85">
                            {i + 1}.{" "}
                            <Link className="underline text-white/80" href={`/projects/${x.id}${qs}`}>
                              {x.name}
                            </Link>
                          </div>
                          <div className="text-xs text-white/45">{x.reasons.join(" · ")}</div>
                        </div>
                        <div className="text-xs text-white/50">Review</div>
                      </div>
                    ))
                  )}
                </div>
              </Surface>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <NavCard
              key={p.id}
              href={`/projects/${p.id}${qsProject}`}
              title={p.name}
              description="Master dashboard + channel reports."
              meta="Open project"
              size="md"
            />
          ))}
        </div>
      </div>
    </main>
  );
}

