import { PageHeader } from "@/components/ds/PageHeader";
import { NavCard } from "@/components/ds/NavCard";
import { Surface } from "@/components/ds/Surface";
import { createServerDbClient } from "@/lib/db/client/server";
import { createDashboardRepo } from "@/lib/db/repo";
import type { Project } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function ProjectsIndexPage() {
  const envMissing =
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let projects: Project[] = [];
  let status = "";

  if (!envMissing) {
    try {
      const supabase = await createServerDbClient();
      const repo = createDashboardRepo(supabase);
      projects = (await repo.listProjects()).filter((x) => x.is_active);
    } catch (e) {
      status = e instanceof Error ? e.message : "Failed to load projects";
    }
  }

  return (
    <main className="min-h-screen px-6 pb-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageHeader title="Projects" subtitle="Open a project to view reports." showBack />

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

        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <NavCard
              key={p.id}
              href={`/projects/${p.id}`}
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

