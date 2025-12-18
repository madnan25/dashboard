"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ds/PageHeader";
import { NavCard } from "@/components/ds/NavCard";
import { Surface } from "@/components/ds/Surface";
import { Project, listProjects } from "@/lib/dashboardDb";

export default function ProjectsIndexPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<string>("");

  const envMissing =
    typeof window !== "undefined" &&
    (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (envMissing) return;
      try {
        if (cancelled) return;
        const projs = await listProjects();
        setProjects(projs.filter((x) => x.is_active));
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load projects");
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [envMissing]);

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

