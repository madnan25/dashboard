"use client";

import { useEffect, useState } from "react";
import { Button, Input } from "@heroui/react";
import { PageHeader } from "@/components/ds/PageHeader";
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
              <Input
                value={name}
                onValueChange={setName}
                placeholder="e.g. Mohammad Adnan"
                variant="bordered"
                classNames={{
                  inputWrapper: "glass-inset rounded-2xl border-white/10 bg-white/[0.02]",
                  input: "text-white/90 placeholder:text-white/25"
                }}
              />
              <div className="mt-2 text-xs text-white/45">Tip: keep it short; it will be truncated in the nav bar.</div>
            </div>
            <div className="flex justify-end">
              <Button color="primary" onPress={onSave}>
                Save
              </Button>
            </div>
          </div>
        </Surface>
      </div>
    </main>
  );
}

