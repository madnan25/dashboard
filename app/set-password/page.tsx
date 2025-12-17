"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input } from "@heroui/react";
import { PageShell, Surface } from "@/components/ds/Surface";
import { createClient } from "@/lib/supabase/browser";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      const supabase = createClient();
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        setStatus("error");
        setError(updateErr.message);
        return;
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to set password.");
    }
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-md space-y-6">
        <PageShell>
          <div className="space-y-1">
            <div className="text-2xl font-semibold tracking-tight text-white/95">Set your password</div>
            <div className="text-sm text-white/55">You can now sign in with email + password.</div>
          </div>
        </PageShell>

        <Surface>
          {status === "success" ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                Password updated successfully.
              </div>
              <Button as={Link} href="/" color="primary">
                Go to dashboard
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <Input
                type="password"
                label="New password"
                value={password}
                onValueChange={setPassword}
                isRequired
                autoComplete="new-password"
              />

              {status === "error" && error ? <div className="text-sm text-red-300">{error}</div> : null}

              <Button type="submit" color="primary" isDisabled={status === "loading"}>
                {status === "loading" ? "Saving..." : "Save password"}
              </Button>
            </form>
          )}
        </Surface>
      </div>
    </main>
  );
}

