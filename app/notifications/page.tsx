import { Surface } from "@/components/ds/Surface";
import { NotificationsCenter } from "@/components/notifications/NotificationsCenter";
import { isMarketingTeamProfile } from "@/components/tasks/taskModel";
import { createServerDbClient } from "@/lib/db/client/server";
import { createDashboardRepo } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createServerDbClient();
  const repo = createDashboardRepo(supabase);
  const profile = await repo.getCurrentProfile();

  return (
    <main className="min-h-screen px-4 md:px-6 pb-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="px-1">
          <div className="text-2xl font-semibold tracking-tight text-white/95">Notifications</div>
          <div className="mt-1 text-sm text-white/55">Assignments, approvals, and updates that need your attention.</div>
        </div>

        {profile && isMarketingTeamProfile(profile) ? (
          <NotificationsCenter />
        ) : (
          <Surface className="border border-white/10">
            <div className="text-sm text-white/70">
              {profile ? "Notifications are available to marketing team members only." : "Sign in to view notifications."}
            </div>
          </Surface>
        )}
      </div>
    </main>
  );
}
