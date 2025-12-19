import { NavCard } from "@/components/ds/NavCard";
import { createServerDbClient } from "@/lib/db/client/server";
import { createDashboardRepo } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createServerDbClient();
  const repo = createDashboardRepo(supabase);
  const profile = await repo.getCurrentProfile();
  const planningDisabled = profile?.role === "viewer";

  return (
    <main className="min-h-screen px-6 pb-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <NavCard
            href="/projects"
            title="Projects"
            description="Open a project to view Master + channel reports."
            meta="Browse active projects"
          />
          <NavCard
            href="/brand/data-entry"
            title="Planning & Actuals"
            description="Brand enters plan inputs; Sales Ops enters actuals; CMO can override and approve."
            meta={planningDisabled ? "View-only access" : "Enter plan + actuals"}
            isDisabled={planningDisabled}
          />
        </div>
      </div>
    </main>
  );
}


