"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { PageShell, Surface } from "@/components/ds/Surface";
import { Project, getCurrentProfile, listProjects } from "@/lib/dashboardDb";

export default function ProjectsIndexPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<string>("");
  const [role, setRole] = useState<string | null>(null);

  const envMissing =
    typeof window !== "undefined" &&
    (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (envMissing) return;
      try {
        const [p, projs] = await Promise.all([getCurrentProfile(), listProjects()]);
        if (cancelled) return;
        setRole(p?.role ?? null);
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

  const cta = useMemo(() => {
    if (role !== "cmo") return null;
    return (
      <Button as={Link} href="/cmo/projects" size="sm" color="primary">
        Manage projects
      </Button>
    );
  }, [role]);

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageShell>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="text-2xl font-semibold tracking-tight text-white/95">Projects</div>
              <div className="text-sm text-white/55">Open a project to view reports.</div>
            </div>
            <div className="flex items-center gap-2">
              {cta}
              <Button as={Link} href="/" size="sm" variant="flat" className="glass-inset text-white/80">
                Back to home
              </Button>
            </div>
          </div>
        </PageShell>

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
            <Surface key={p.id}>
              <div className="flex h-full flex-col justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-white/90">{p.name}</div>
                  <div className="mt-1 text-sm text-white/55">Master dashboard + channel reports.</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button as={Link} href={`/projects/${p.id}`} color="primary">
                    Open project
                  </Button>
                </div>
              </div>
            </Surface>
          ))}
        </div>
      </div>
    </main>
  );
}

