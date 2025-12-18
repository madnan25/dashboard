"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { Surface } from "@/components/ds/Surface";
import { Profile, getCurrentProfile } from "@/lib/dashboardDb";

export default function HomePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const p = await getCurrentProfile();
        if (!cancelled) setProfile(p);
      } catch {
        // ignore
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen px-6 pb-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center justify-end">
          <Button as={Link} href="/design" size="sm" variant="flat" className="glass-inset text-white/80">
            Design System
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {profile?.role === "cmo" ? (
            <Surface>
              <div className="flex h-full flex-col justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.28em] text-white/45">Admin</div>
                  <div className="mt-1 text-lg font-semibold text-white/90">CMO Console</div>
                  <div className="mt-1 text-sm text-white/55">
                    Create projects, set targets/budget, approve plans — full access.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button as={Link} href="/cmo/projects" color="primary">
                    Open CMO console
                  </Button>
                </div>
              </div>
            </Surface>
          ) : null}

          <Surface>
            <div className="flex h-full flex-col justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-white/90">Projects</div>
                <div className="mt-1 text-sm text-white/55">Open a project to view Master + channel reports.</div>
              </div>
              <div className="flex items-center gap-2">
                <Button as={Link} href="/projects" color="primary">
                  Open projects
                </Button>
              </div>
            </div>
          </Surface>

          <Surface>
            <div className="flex h-full flex-col justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-white/90">Planning & Actuals</div>
                <div className="mt-1 text-sm text-white/55">
                  Brand enters plan inputs; Sales Ops enters actuals; CMO can override and approve.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button as={Link} href="/brand/data-entry" variant="flat" className="glass-inset text-white/90">
                  Open data entry
                </Button>
              </div>
            </div>
          </Surface>
        </div>
      </div>
    </main>
  );
}


