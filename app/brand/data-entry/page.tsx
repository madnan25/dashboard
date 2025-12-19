import { redirect } from "next/navigation";
import { createServerDbClient } from "@/lib/db/client/server";
import { createDashboardRepo } from "@/lib/db/repo";
import BrandDataEntryClient from "./ui";

export const dynamic = "force-dynamic";

export default async function BrandDataEntryPage() {
  const supabase = await createServerDbClient();
  const repo = createDashboardRepo(supabase);
  const profile = await repo.getCurrentProfile();

  // Viewers are read-only: they can see project dashboards but not Planning/Actuals entry.
  if (profile?.role === "viewer") redirect("/projects");

  return <BrandDataEntryClient />;
}
