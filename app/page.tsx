import { NavCard } from "@/components/ds/NavCard";
import { createServerDbClient } from "@/lib/db/client/server";
import { createDashboardRepo } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createServerDbClient();
  const repo = createDashboardRepo(supabase);
  const profile = await repo.getCurrentProfile();
  const planningDisabled = profile?.role === "viewer" || profile?.role === "member";
  const canSeeTasks =
    profile?.role === "cmo" ||
    (profile?.role != null &&
      profile.role !== "sales_ops" &&
      (profile.role === "brand_manager" || profile.role === "member" || profile.is_marketing_team === true));

  return (
    <main className="min-h-screen px-4 md:px-6 pb-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* Mobile-only "native" page header */}
        <div className="md:hidden px-1">
          <div className="text-2xl font-semibold tracking-tight text-white/95">Home</div>
          <div className="mt-1 text-sm text-white/55">Choose where you want to start.</div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <NavCard
            href="/projects"
            title="Projects"
            description="Open a project to view Master + channel reports."
            meta="Browse active projects"
          />
          <NavCard
            href="/tasks"
            title="Tasks"
            description="A conveyor belt for execution. One card, one owner, one state."
            meta={canSeeTasks ? "Kanban control surface" : "Marketing team only"}
            isDisabled={!canSeeTasks}
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


