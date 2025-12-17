"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import { PageShell, Surface } from "@/components/ds/Surface";

export default function HomePage() {
  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <PageShell>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="text-2xl font-semibold tracking-tight text-white/95">Dashboard</div>
              <div className="text-sm text-white/55">Choose where you want to start.</div>
            </div>
            <div className="flex items-center gap-2">
              <Button as={Link} href="/design" size="sm" variant="flat" className="glass-inset text-white/80">
                Design System
              </Button>
              <Button as={Link} href="/logout" size="sm" variant="flat" className="glass-inset text-white/80">
                Logout
              </Button>
            </div>
          </div>
        </PageShell>

        <div className="grid gap-4 md:grid-cols-2">
          <Surface>
            <div className="flex h-full flex-col justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-white/90">Digital – Monthly Snapshot</div>
                <div className="mt-1 text-sm text-white/55">
                  View KPIs and funnel contribution for a selected month (uses saved inputs if provided).
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button as={Link} href="/digital/monthly-snapshot" color="primary">
                  Open dashboard
                </Button>
              </div>
            </div>
          </Surface>

          <Surface>
            <div className="flex h-full flex-col justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-white/90">Brand Team – Data Entry</div>
                <div className="mt-1 text-sm text-white/55">
                  Enter month-level inputs once; dashboards will compute and reflect the results automatically.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button as={Link} href="/brand/data-entry" variant="flat" className="glass-inset text-white/90">
                  Enter data
                </Button>
              </div>
            </div>
          </Surface>
        </div>
      </div>
    </main>
  );
}


