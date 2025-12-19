"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ds/PageHeader";
import { AppButton } from "@/components/ds/AppButton";
import { AppInput } from "@/components/ds/AppInput";
import { Surface } from "@/components/ds/Surface";
import { getCurrentProfile, updateMyFullName } from "@/lib/dashboardDb";

export default function AccountPage() {
  const [status, setStatus] = useState<string>("");
  const [name, setName] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const p = await getCurrentProfile();
        if (cancelled) return;
        setName(p?.full_name ?? "");
      } catch (e) {
        if (cancelled) return;
        setStatus(e instanceof Error ? e.message : "Failed to load profile");
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSave() {
    setStatus("");
    try {
      setStatus("Saving...");
      await updateMyFullName(name.trim());
      setStatus("Saved.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to save");
    }
  }

  return (
    <main className="min-h-screen px-6 pb-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <PageHeader title="Account" subtitle="Set your display name (shown in the top bar)." showBack />

        <Surface>
          <div className="space-y-4">
            <div className="text-sm text-white/60">{status || " "}</div>
            <div>
              <div className="text-xs uppercase tracking-widest text-white/45">Full name</div>
              <AppInput
                value={name}
                onValueChange={setName}
                placeholder="e.g. Mohammad Adnan"
              />
              <div className="mt-2 text-xs text-white/45">Tip: keep it short; it will be truncated in the nav bar.</div>
            </div>
            <div className="flex justify-end">
              <AppButton intent="primary" onPress={onSave}>
                Save
              </AppButton>
            </div>
          </div>
        </Surface>
      </div>
    </main>
  );
}

