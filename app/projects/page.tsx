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
import { TopEfficiencyPanel, type EfficiencyRow } from "@/components/projects/TopEfficiencyPanel";

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
  sqft_won_transfer_in?: number;
  sqft_won_transfer_out?: number;
  sqft_won_misc?: number;
  qualified_leads: number;
  deals_won?: number;
  deals_won_transfer_in?: number;
  deals_won_transfer_out?: number;
  deals_won_misc?: number;
  spend_digital: number;
  spend_inbound: number;
  spend_activations: number;
};

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
  let totalSqftPipeline = 0;
  let totalSqftTransfer = 0;
  let totalSqftMisc = 0;
  let totalSqftTransferOut = 0;
  let totalQualifiedPipelineSqft = 0;
  let totalDeals = 0;
  let totalDealsPipeline = 0;
  let totalDealsTransfer = 0;
  let totalDealsMisc = 0;
  let totalDealsTransferOut = 0;
  let totalSpend = 0;

  let topImpact: Array<{ id: string; name: string; sqft: number; momDelta?: number }> = [];
  let topEfficiency: EfficiencyRow[] = [];

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
            .select(
              "project_id, year, month, sqft_won, sqft_won_transfer_in, sqft_won_transfer_out, sqft_won_misc, deals_won, deals_won_transfer_in, deals_won_transfer_out, deals_won_misc, qualified_leads, spend_digital, spend_inbound, spend_activations"
            )
            .eq("year", y)
            .eq("month", m)
            .in("project_id", projectIds);
          if (error) throw error;
          return ((data as ActualRow[]) ?? []).map((r) => ({
            ...r,
            sqft_won: r.sqft_won ?? 0,
            sqft_won_transfer_in: r.sqft_won_transfer_in ?? 0,
            sqft_won_transfer_out: r.sqft_won_transfer_out ?? 0,
            sqft_won_misc: r.sqft_won_misc ?? 0,
            deals_won: r.deals_won ?? 0,
            deals_won_transfer_in: r.deals_won_transfer_in ?? 0,
            deals_won_transfer_out: r.deals_won_transfer_out ?? 0,
            deals_won_misc: r.deals_won_misc ?? 0,
            qualified_leads: (r as unknown as { qualified_leads?: number }).qualified_leads ?? 0,
            spend_digital: r.spend_digital ?? 0,
            spend_inbound: r.spend_inbound ?? 0,
            spend_activations: r.spend_activations ?? 0
          }));
        }

        type TargetRow = { project_id: string; year: number; month: number; avg_sqft_per_deal: number };

        async function fetchTargetsMonth(y: number, m: number) {
          const { data, error } = await supabase
            .from("project_targets")
            .select("project_id, year, month, avg_sqft_per_deal")
            .eq("year", y)
            .eq("month", m)
            .in("project_id", projectIds);
          if (error) throw error;
          return ((data as TargetRow[]) ?? []).map((r) => ({
            ...r,
            avg_sqft_per_deal: r.avg_sqft_per_deal ?? 0
          }));
        }

        async function fetchActualsYtd() {
          const { data, error } = await supabase
            .from("project_actuals")
            .select(
              "project_id, year, month, sqft_won, sqft_won_transfer_in, sqft_won_transfer_out, sqft_won_misc, deals_won, deals_won_transfer_in, deals_won_transfer_out, deals_won_misc, qualified_leads, spend_digital, spend_inbound, spend_activations"
            )
            .eq("year", year)
            .lte("month", month)
            .in("project_id", projectIds);
          if (error) throw error;
          return ((data as ActualRow[]) ?? []).map((r) => ({
            ...r,
            sqft_won: r.sqft_won ?? 0,
            sqft_won_transfer_in: r.sqft_won_transfer_in ?? 0,
            sqft_won_transfer_out: r.sqft_won_transfer_out ?? 0,
            sqft_won_misc: r.sqft_won_misc ?? 0,
            deals_won: r.deals_won ?? 0,
            deals_won_transfer_in: r.deals_won_transfer_in ?? 0,
            deals_won_transfer_out: r.deals_won_transfer_out ?? 0,
            deals_won_misc: r.deals_won_misc ?? 0,
            qualified_leads: (r as unknown as { qualified_leads?: number }).qualified_leads ?? 0,
            spend_digital: r.spend_digital ?? 0,
            spend_inbound: r.spend_inbound ?? 0,
            spend_activations: r.spend_activations ?? 0
          }));
        }

        const [actualsRows, prevRows, targetsRows] =
          mode === "month"
            ? await Promise.all([
                fetchActualsMonth(year, month),
                fetchActualsMonth(prevMonthOf(year, month).year, prevMonthOf(year, month).month),
                fetchTargetsMonth(year, month)
              ])
            : await Promise.all([
                fetchActualsYtd(),
                Promise.resolve([] as ActualRow[]),
                // For YTD, pull targets month-by-month so we can compute:
                // qualified_pipeline = Σ (qualified_leads_month × avg_sqft_per_deal_month)
                (async () => {
                  const { data, error } = await supabase
                    .from("project_targets")
                    .select("project_id, year, month, avg_sqft_per_deal")
                    .eq("year", year)
                    .lte("month", month)
                    .in("project_id", projectIds);
                  if (error) throw error;
                  return ((data as TargetRow[]) ?? []).map((r) => ({
                    ...r,
                    avg_sqft_per_deal: r.avg_sqft_per_deal ?? 0
                  }));
                })()
              ]);

        const avgSqftByProjectMonth = new Map<string, number>();
        for (const t of targetsRows ?? []) {
          avgSqftByProjectMonth.set(`${t.project_id}:${t.month}`, Math.max(0, Number(t.avg_sqft_per_deal ?? 0)));
        }

        // Aggregate actuals by project
        const actualByProject = new Map<
          string,
          {
            sqftPipeline: number;
            sqftTransfer: number;
            sqftMisc: number;
            sqftAll: number;
            sqftTransferOut: number;
            dealsPipeline: number;
            dealsTransfer: number;
            dealsMisc: number;
            dealsAll: number;
            dealsTransferOut: number;
            spend: number;
            qualifiedLeads: number;
            qualifiedPipelineSqft: number;
          }
        >();
        if (mode === "month") {
          for (const r of actualsRows) {
            const spend = (r.spend_digital ?? 0) + (r.spend_inbound ?? 0) + (r.spend_activations ?? 0);
            const avgSqft = avgSqftByProjectMonth.get(`${r.project_id}:${r.month}`) ?? 0;
            const qualifiedLeads = r.qualified_leads ?? 0;
            const sqftPipeline = r.sqft_won ?? 0;
            const sqftTransfer = r.sqft_won_transfer_in ?? 0;
            const sqftMisc = r.sqft_won_misc ?? 0;
            const sqftAll = sqftPipeline + sqftTransfer + sqftMisc;
            const sqftTransferOut = r.sqft_won_transfer_out ?? 0;
            const dealsPipeline = r.deals_won ?? 0;
            const dealsTransfer = r.deals_won_transfer_in ?? 0;
            const dealsMisc = r.deals_won_misc ?? 0;
            const dealsAll = dealsPipeline + dealsTransfer + dealsMisc;
            const dealsTransferOut = r.deals_won_transfer_out ?? 0;
            actualByProject.set(r.project_id, {
              sqftPipeline,
              sqftTransfer,
              sqftMisc,
              sqftAll,
              sqftTransferOut,
              dealsPipeline,
              dealsTransfer,
              dealsMisc,
              dealsAll,
              dealsTransferOut,
              spend,
              qualifiedLeads,
              qualifiedPipelineSqft: qualifiedLeads * avgSqft
            });
          }
        } else {
          for (const r of actualsRows) {
            const spend = (r.spend_digital ?? 0) + (r.spend_inbound ?? 0) + (r.spend_activations ?? 0);
            const cur =
              actualByProject.get(r.project_id) ?? {
                sqftPipeline: 0,
                sqftTransfer: 0,
                sqftMisc: 0,
                sqftAll: 0,
                sqftTransferOut: 0,
                dealsPipeline: 0,
                dealsTransfer: 0,
                dealsMisc: 0,
                dealsAll: 0,
                dealsTransferOut: 0,
                spend: 0,
                qualifiedLeads: 0,
                qualifiedPipelineSqft: 0
              };
            const avgSqft = avgSqftByProjectMonth.get(`${r.project_id}:${r.month}`) ?? 0;
            const sqftPipeline = r.sqft_won ?? 0;
            const sqftTransfer = r.sqft_won_transfer_in ?? 0;
            const sqftMisc = r.sqft_won_misc ?? 0;
            cur.sqftPipeline += sqftPipeline;
            cur.sqftTransfer += sqftTransfer;
            cur.sqftMisc += sqftMisc;
            cur.sqftAll += sqftPipeline + sqftTransfer + sqftMisc;
            cur.sqftTransferOut += r.sqft_won_transfer_out ?? 0;
            cur.spend += spend;
            const qualifiedLeads = r.qualified_leads ?? 0;
            cur.qualifiedLeads += qualifiedLeads;
            cur.qualifiedPipelineSqft += qualifiedLeads * avgSqft;
            const dealsPipeline = r.deals_won ?? 0;
            const dealsTransfer = r.deals_won_transfer_in ?? 0;
            const dealsMisc = r.deals_won_misc ?? 0;
            cur.dealsPipeline += dealsPipeline;
            cur.dealsTransfer += dealsTransfer;
            cur.dealsMisc += dealsMisc;
            cur.dealsAll += dealsPipeline + dealsTransfer + dealsMisc;
            cur.dealsTransferOut += r.deals_won_transfer_out ?? 0;
            actualByProject.set(r.project_id, cur);
          }
        }

        // Prev month sqft by project (for MoM delta)
        const prevSqftByProject = new Map<string, number>();
        for (const r of prevRows ?? []) {
          const all = (r.sqft_won ?? 0) + (r.sqft_won_transfer_in ?? 0) + (r.sqft_won_misc ?? 0);
          prevSqftByProject.set(r.project_id, all);
        }

        // Totals
        totalSqft = 0;
        totalSqftPipeline = 0;
        totalSqftTransfer = 0;
        totalSqftMisc = 0;
        totalSqftTransferOut = 0;
        totalQualifiedPipelineSqft = 0;
        totalDeals = 0;
        totalDealsPipeline = 0;
        totalDealsTransfer = 0;
        totalDealsMisc = 0;
        totalDealsTransferOut = 0;
        totalSpend = 0;
        for (const p of projects) {
          const a =
            actualByProject.get(p.id) ?? {
              sqftPipeline: 0,
              sqftTransfer: 0,
              sqftMisc: 0,
              sqftAll: 0,
              sqftTransferOut: 0,
              dealsPipeline: 0,
              dealsTransfer: 0,
              dealsMisc: 0,
              dealsAll: 0,
              dealsTransferOut: 0,
              spend: 0,
              qualifiedLeads: 0,
              qualifiedPipelineSqft: 0
            };
          totalSqft += a.sqftAll;
          totalSqftPipeline += a.sqftPipeline;
          totalSqftTransfer += a.sqftTransfer;
          totalSqftMisc += a.sqftMisc;
          totalSqftTransferOut += a.sqftTransferOut;
          totalQualifiedPipelineSqft += a.qualifiedPipelineSqft;
          totalDeals += a.dealsAll;
          totalDealsPipeline += a.dealsPipeline;
          totalDealsTransfer += a.dealsTransfer;
          totalDealsMisc += a.dealsMisc;
          totalDealsTransferOut += a.dealsTransferOut;
          totalSpend += a.spend;
        }

        // Ranked: Impact
        topImpact = [...projects]
          .map((p) => {
            const a =
              actualByProject.get(p.id) ?? {
                sqftPipeline: 0,
                sqftTransfer: 0,
                sqftMisc: 0,
                sqftAll: 0,
                dealsAll: 0,
                spend: 0,
                qualifiedLeads: 0,
                qualifiedPipelineSqft: 0
              };
            const prevSqft = prevSqftByProject.get(p.id) ?? 0;
            const momDelta = mode === "month" ? a.sqftAll - prevSqft : undefined;
            return { id: p.id, name: p.name, sqft: a.sqftAll, momDelta };
          })
          .sort((a, b) => b.sqft - a.sqft)
          .slice(0, 5);

        // Ranked: Efficiency (full list; client panel handles sorting/toggle)
        topEfficiency = [...projects]
          .map((p) => {
            const a =
              actualByProject.get(p.id) ?? {
                sqftPipeline: 0,
                sqftTransfer: 0,
                sqftMisc: 0,
                sqftAll: 0,
                dealsAll: 0,
                spend: 0,
                qualifiedLeads: 0,
                qualifiedPipelineSqft: 0
              };
            const costPerSqft = a.sqftAll > 0 ? a.spend / a.sqftAll : Number.POSITIVE_INFINITY;
            const costPerQualifiedLead = a.qualifiedLeads > 0 ? a.spend / a.qualifiedLeads : Number.POSITIVE_INFINITY;
            return {
              id: p.id,
              name: p.name,
              sqft: a.sqftAll,
              spend: a.spend,
              qualifiedLeads: a.qualifiedLeads,
              costPerSqft,
              costPerQualifiedLead
            };
          })
          .filter((x) => Number.isFinite(x.costPerSqft) || Number.isFinite(x.costPerQualifiedLead));
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

            <div className="grid gap-4 md:grid-cols-4">
              <KpiCard
                label="Qualified pipeline created (SQFT)"
                value={formatNumber(totalQualifiedPipelineSqft)}
                helper={mode === "ytd" ? "Year to date" : "This month"}
              />
              <KpiCard
                label="Pipeline actualized (SQFT)"
                value={formatNumber(totalSqft)}
                helper={mode === "ytd" ? "Year to date" : "This month"}
              />
              <KpiCard label="Total spend" value={formatNumber(totalSpend)} helper="Digital + Inbound + Activations" />
              <KpiCard
                label="Efficiency (spend / SQFT)"
                value={costPerSqft != null ? format2(costPerSqft) : "—"}
                helper={costPerSqft != null ? "All closes (includes transfers + misc)." : "No SQFT won recorded"}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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

              <TopEfficiencyPanel rows={topEfficiency} qs={qs} />
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

