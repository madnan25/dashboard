"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input } from "@heroui/react";
import { PageShell, Surface } from "@/components/ds/Surface";
import { createClient } from "@/lib/supabase/browser";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectTo = useMemo(() => searchParams.get("redirectTo") ?? "/", [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const envMissing = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (signInError) {
        setStatus("error");
        setError(signInError.message);
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Login failed.");
    }
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-md space-y-6">
        <PageShell>
          <div className="space-y-1">
            <div className="text-2xl font-semibold tracking-tight text-white/95">Sign in</div>
            <div className="text-sm text-white/55">Use your Supabase Auth credentials.</div>
          </div>
        </PageShell>

        <Surface>
          {envMissing ? (
            <div className="text-sm text-amber-200/90">
              Supabase env vars are missing. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable login.
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            <Input
              type="email"
              label="Email"
              value={email}
              onValueChange={setEmail}
              isRequired
              autoComplete="email"
            />
            <Input
              type="password"
              label="Password"
              value={password}
              onValueChange={setPassword}
              isRequired
              autoComplete="current-password"
            />

            {status === "error" && error ? <div className="text-sm text-red-300">{error}</div> : null}

            <Button type="submit" color="primary" isDisabled={envMissing || status === "loading"}>
              {status === "loading" ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </Surface>
      </div>
    </main>
  );
}

