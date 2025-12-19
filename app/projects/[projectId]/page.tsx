import { ProjectHub } from "@/components/projects/ProjectHub";
import { createServerDbClient } from "@/lib/db/client/server";
import { createDashboardRepo } from "@/lib/db/repo";
import type { PlanChannel, PlanChannelInputs, PlanVersion, ProjectActuals, ProjectTargets } from "@/lib/db/types";

export const dynamic = "force-dynamic";

function defaultYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

export default async function ProjectHubPage({
  params,
  searchParams
}: {
  params?: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = (await params) ?? { projectId: "" };
  const projectId = resolved.projectId;
  const sp = (await searchParams) ?? {};
  const defaults = defaultYearMonth();
  const year = Number(sp.year ?? defaults.year);
  const monthIndex = Number(sp.monthIndex ?? defaults.monthIndex);
  const safeYear = Number.isFinite(year) ? year : defaults.year;
  const safeMonthIndex = Number.isFinite(monthIndex) ? monthIndex : defaults.monthIndex;

  const envMissing = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (envMissing) {
    return <ProjectHub projectId={projectId} />;
  }

  const supabase = await createServerDbClient();
  const repo = createDashboardRepo(supabase);

  const month = safeMonthIndex + 1;

  const [{ data: proj }, profile, targets, versions, actuals] = await Promise.all([
    supabase.from("projects").select("name").eq("id", projectId).maybeSingle(),
    repo.getCurrentProfile(),
    repo.getProjectTargets(projectId, safeYear, month),
    repo.listPlanVersions(projectId, safeYear, month),
    repo.getProjectActuals(projectId, safeYear, month)
  ]);

  const active: PlanVersion | null = versions.find((v) => v.active && v.status === "approved") ?? null;
  const inputs = active ? await repo.getPlanChannelInputs(active.id) : [];
  const map: Record<PlanChannel, PlanChannelInputs | null> = { digital: null, inbound: null, activations: null };
  for (const row of inputs ?? []) map[row.channel] = row;

  return (
    <ProjectHub
      projectId={projectId}
      initial={{
        year: safeYear,
        monthIndex: safeMonthIndex,
        projectName: proj?.name ?? "—",
        role: profile?.role ?? null,
        targets: (targets as ProjectTargets | null) ?? null,
        activePlanVersion: active,
        inputsByChannel: map,
        actuals: (actuals as ProjectActuals | null) ?? null
      }}
    />
  );
}

