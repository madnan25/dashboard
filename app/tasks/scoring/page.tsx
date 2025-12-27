"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ds/PageHeader";
import { Surface } from "@/components/ds/Surface";

export const dynamic = "force-dynamic";

export default function TaskScoringPage() {
  return (
    <main className="min-h-screen px-4 md:px-6 pb-10">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <PageHeader title="Task scoring" subtitle="A quick reference for how points are calculated." showBack backHref="/tasks" />

        <Surface>
          <div className="text-sm text-white/80">
            Points are designed to reward <span className="font-semibold text-white/90">impact over busyness</span>. They are awarded{" "}
            <span className="font-semibold text-white/90">once</span> when a ticket becomes <span className="font-semibold text-white/90">Approved</span>.
          </div>

          <div className="mt-4 space-y-4 text-sm text-white/75">
            <div>
              <div className="text-xs uppercase tracking-widest text-white/45">When points are awarded</div>
              <div className="mt-2">
                Points are written to the ledger only on the transition to <span className="text-white/90">approval_state = approved</span>. Rework
                doesn’t add or remove points.
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-widest text-white/45">What affects points</div>
              <div className="mt-2 space-y-1">
                <div>
                  - <span className="text-white/90">Weight tier</span> (Small/Medium/Large/Critical)
                </div>
                <div>
                  - <span className="text-white/90">Priority multiplier</span> (P0–P3)
                </div>
                <div>
                  - <span className="text-white/90">Due date timing</span> (early/on-time/late multipliers)
                </div>
                <div>
                  - <span className="text-white/90">Small-ticket weekly cap</span> (soft cap reduces points after a threshold)
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-widest text-white/45">Who gets the points</div>
              <div className="mt-2">
                If contribution roles are set, points are split across Primary / Secondary / Manager. If not, the system falls back to the ticket owner and
                creator defaults.
              </div>
            </div>

            <div className="text-xs text-white/50">
              Want the exact formula and configurable constants? Ask the CMO (or engineering) to share the scoring config.
            </div>
          </div>
        </Surface>

        <div className="text-xs text-white/50">
          Back to <Link href="/tasks" className="underline text-white/70">Tasks</Link>
        </div>
      </div>
    </main>
  );
}


