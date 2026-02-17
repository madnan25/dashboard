"use client";

import { useEffect } from "react";
import { Surface } from "@/components/ds/Surface";
import { AppButton } from "@/components/ds/AppButton";

export default function PlanningError(props: { error: Error & { digest?: string }; reset: () => void }) {
  const { error, reset } = props;

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Planning route error:", { message: error?.message, digest: error?.digest });
  }, [error]);

  return (
    <main className="min-h-screen px-4 md:px-6 pb-10">
      <div className="mx-auto w-full max-w-4xl space-y-6 pt-10">
        <Surface>
          <div className="text-lg font-semibold text-white/90">Planning & Actuals didn’t load</div>
          <div className="mt-1 text-sm text-white/60">
            If you’re signed in and this persists, we’ll need to inspect the server error digest.
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <AppButton intent="primary" onPress={reset}>
              Retry
            </AppButton>
            <AppButton
              intent="secondary"
              onPress={() => {
                window.location.assign("/logout");
              }}
            >
              Logout
            </AppButton>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/55">
            <div>
              <span className="text-white/70">Digest:</span> {error?.digest ?? "—"}
            </div>
          </div>
        </Surface>
      </div>
    </main>
  );
}

