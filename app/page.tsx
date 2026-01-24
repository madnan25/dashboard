import { NavCard } from "@/components/ds/NavCard";
import { Surface } from "@/components/ds/Surface";
import { createServerDbClient } from "@/lib/db/client/server";
import { createDashboardRepo } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

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

  const upcomingMaster = await repo
    .listMasterCalendarTasks({
      dueFrom: isoDate(new Date()),
      dueTo: isoDate(addDays(new Date(), 45))
    })
    .catch(() => []);
  const upcomingPreview = upcomingMaster.slice(0, 6);

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

        <Surface>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white/90">Master Calendar</div>
              <div className="mt-1 text-sm text-white/55">Major ticket deadlines. Color-coded by Marketing vs Sales.</div>
            </div>
            <div className="text-sm text-white/60">{isoDate(new Date())}</div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {upcomingPreview.length === 0 ? (
              <div className="text-sm text-white/50">No master deadlines tagged yet.</div>
            ) : (
              upcomingPreview.map((t) => (
                <div
                  key={t.id}
                  className={[
                    "flex items-center justify-between gap-3 rounded-2xl border bg-white/[0.02] px-4 py-3",
                    t.master_calendar_tag === "sales"
                      ? "border-amber-500/20"
                      : "border-sky-500/20"
                  ].join(" ")}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white/90">{t.title}</div>
                    <div className="mt-1 text-xs text-white/55">Due {t.due_at ?? "—"}</div>
                  </div>
                  <div
                    className={[
                      "shrink-0 rounded-full border px-3 py-1 text-[11px]",
                      t.master_calendar_tag === "sales"
                        ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
                        : "border-sky-500/20 bg-sky-500/10 text-sky-200"
                    ].join(" ")}
                  >
                    {t.master_calendar_tag === "sales" ? "Sales" : "Marketing"}
                  </div>
                </div>
              ))
            )}
          </div>
        </Surface>
      </div>
    </main>
  );
}


