import { MonthlySnapshotReport } from "@/components/reports/MonthlySnapshotReport";

function defaultYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

export default async function ProjectInboundReportPage({
  params,
  searchParams
}: {
  params?: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = (await params) ?? { projectId: "" };
  const sp = (await searchParams) ?? {};
  const defaults = defaultYearMonth();
  const year = Number(sp.year ?? defaults.year);
  const monthIndex = Number(sp.monthIndex ?? defaults.monthIndex);
  const safeYear = Number.isFinite(year) ? year : defaults.year;
  const safeMonthIndex = Number.isFinite(monthIndex) ? monthIndex : defaults.monthIndex;
  const backHref = `/projects/${resolved.projectId}?year=${encodeURIComponent(String(safeYear))}&monthIndex=${encodeURIComponent(
    String(safeMonthIndex)
  )}`;

  return (
    <MonthlySnapshotReport
      channel="inbound"
      fixedProjectId={resolved.projectId}
      initialYear={safeYear}
      initialMonthIndex={safeMonthIndex}
      backHref={backHref}
    />
  );
}

