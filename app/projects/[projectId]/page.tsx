import { ProjectHub } from "@/components/projects/ProjectHub";
import { createServerDbClient } from "@/lib/db/client/server";
import { createDashboardRepo } from "@/lib/db/repo";
import type { PlanChannel, PlanChannelInputs, PlanVersion, ProjectActuals, ProjectTargets } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const DEFAULT_YEAR = 2025;
const DEFAULT_MONTH_INDEX = 11; // Dec

export default async function ProjectHubPage({ params }: { params?: Promise<{ projectId: string }> }) {
  const resolved = (await params) ?? { projectId: "" };
  const projectId = resolved.projectId;

  const envMissing = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (envMissing) {
    return <ProjectHub projectId={projectId} />;
  }

  const supabase = await createServerDbClient();
  const repo = createDashboardRepo(supabase);

  const month = DEFAULT_MONTH_INDEX + 1;

  const [{ data: proj }, profile, targets, versions, actuals] = await Promise.all([
    supabase.from("projects").select("name").eq("id", projectId).maybeSingle(),
    repo.getCurrentProfile(),
    repo.getProjectTargets(projectId, DEFAULT_YEAR, month),
    repo.listPlanVersions(projectId, DEFAULT_YEAR, month),
    repo.getProjectActuals(projectId, DEFAULT_YEAR, month)
  ]);

  const active: PlanVersion | null = versions.find((v) => v.active && v.status === "approved") ?? null;
  const inputs = active ? await repo.getPlanChannelInputs(active.id) : [];
  const map: Record<PlanChannel, PlanChannelInputs | null> = { digital: null, inbound: null, activations: null };
  for (const row of inputs ?? []) map[row.channel] = row;

  return (
    <ProjectHub
      projectId={projectId}
      initial={{
        year: DEFAULT_YEAR,
        monthIndex: DEFAULT_MONTH_INDEX,
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

