"use client";

import { NavCard } from "@/components/ds/NavCard";
import { useEffect, useState } from "react";
import { getCurrentProfile, type Profile } from "@/lib/dashboardDb";

export default function HomePage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const p = await getCurrentProfile();
        if (cancelled) return;
        setProfile(p);
      } catch {
        // ignore
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

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


