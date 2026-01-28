import { NavCard } from "@/components/ds/NavCard";
import { MarketingHomeDashboard } from "@/components/home/MarketingHomeDashboard";
import { isMarketingTeamProfile } from "@/components/tasks/taskModel";
import { createServerDbClient } from "@/lib/db/client/server";
import { createDashboardRepo } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createServerDbClient();
  const repo = createDashboardRepo(supabase);
  const profile = await repo.getCurrentProfile();
  const planningDisabled = profile?.role === "viewer" || profile?.role === "member";
  const isMarketingTeam = isMarketingTeamProfile(profile);
  const canSeeTasks =
    profile?.role === "cmo" ||
    (profile?.role != null &&
      profile.role !== "sales_ops" &&
      (profile.role === "brand_manager" || profile.role === "member" || profile.is_marketing_team === true));
  const marketingInbox = isMarketingTeam && profile ? await repo.getMarketingHomeInbox(30) : null;

  return (
    <main className="min-h-screen px-4 md:px-6 pb-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* Mobile-only "native" page header */}
        <div className="md:hidden px-1">
          <div className="text-2xl font-semibold tracking-tight text-white/95">Home</div>
          <div className="mt-1 text-sm text-white/55">Choose where you want to start.</div>
        </div>

        {isMarketingTeam && marketingInbox ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
              <div className="text-xs uppercase tracking-[0.25em] text-white/50">Marketing Command</div>
              <div className="mt-2 text-2xl font-semibold text-white/95">Your execution control room</div>
              <div className="mt-1 text-sm text-white/60">
                Live assignments, approvals, and focus work - tuned for speed and clarity.
              </div>
            </div>
            <MarketingHomeDashboard inbox={marketingInbox} userId={profile.id} />
          </div>
        ) : null}

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
            href="/master-calendar"
            title="Master Calendar"
            description="Major deadlines across Marketing + Sales."
            meta="View-only timeline"
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


