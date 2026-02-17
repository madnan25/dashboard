import { redirect } from "next/navigation";
import { Surface } from "@/components/ds/Surface";
import { createServerDbClient } from "@/lib/db/client/server";
import { createDashboardRepo } from "@/lib/db/repo";
import { withTimeout } from "@/lib/runtime/withTimeout";
import BrandDataEntryClient from "./ui";

export const dynamic = "force-dynamic";

export default async function BrandDataEntryPage() {
  try {
    const supabase = await withTimeout("createServerDbClient()", createServerDbClient(), 8000);
    const repo = createDashboardRepo(supabase);
    const profile = await withTimeout("repo.getCurrentProfile()", repo.getCurrentProfile(), 8000);

    // View-only roles: can see project dashboards but not Planning/Actuals entry.
    if (profile?.role === "viewer" || profile?.role === "admin_viewer") redirect("/projects");

    return <BrandDataEntryClient />;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load Planning & Actuals";
    console.error("BrandDataEntryPage error:", message);
    return (
      <main className="min-h-screen px-4 md:px-6 pb-10">
        <div className="mx-auto w-full max-w-4xl space-y-6 pt-10">
          <Surface>
            <div className="text-lg font-semibold text-white/90">Planning & Actuals didn’t load</div>
            <div className="mt-1 text-sm text-white/60">This is likely a session/cookie or server data fetch issue.</div>
            <div className="mt-4 text-xs text-amber-200/90">{message}</div>
          </Surface>
        </div>
      </main>
    );
  }
}
