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
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const envMissing = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          redirectTo,
          origin: window.location.origin
        })
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        setStatus("error");
        setError("Login is misconfigured (auth endpoint was redirected). Refresh and try again.");
        return;
      }

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as null | { error?: string };
        const code = payload?.error;
        if (res.status === 404 || code === "user_not_found") {
          setStatus("error");
          setError("User does not exist. Ask an admin to invite you.");
          return;
        }
        if (code === "missing_public_env") {
          setStatus("error");
          setError("Supabase env vars are missing on the server. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
          return;
        }
        setStatus("error");
        setError("Could not send magic link. Please try again.");
        return;
      }

      setStatus("success");
      setSuccess("Magic link sent. Check your email to finish signing in.");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Login failed.");
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden p-6">
      {/* Futuristic grid + glow (keeps within our existing backdrop theme) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(700px 420px at 20% 10%, rgba(124,58,237,0.22), transparent 60%), radial-gradient(700px 420px at 82% 0%, rgba(59,130,246,0.18), transparent 62%), radial-gradient(700px 420px at 55% 100%, rgba(16,185,129,0.10), transparent 60%), linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "cover, cover, cover, 42px 42px, 42px 42px",
          backgroundPosition: "center, center, center, center, center"
        }}
      />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center justify-center">
        <div className="w-full max-w-[460px]">
          <PageShell className="relative overflow-hidden">
            {/* Neon border */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-3xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(124,58,237,0.35), rgba(59,130,246,0.22), rgba(16,185,129,0.18))",
                opacity: 0.65,
                maskImage:
                  "linear-gradient(#000, #000), linear-gradient(#000, #000)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
                padding: "1px"
              }}
            />

            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-white/55">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/70 shadow-[0_0_18px_rgba(16,185,129,0.35)]" />
                    Secure console
                  </div>
                  <div className="text-3xl font-semibold tracking-tight text-white/95">Sign in</div>
                  <div className="text-sm leading-relaxed text-white/55">
                  Enter your email and we’ll send a magic link to verify your session.
                  </div>
                </div>
                <div className="hidden sm:block text-right text-xs text-white/45">
                  <div className="font-semibold text-white/60">Dashboard</div>
                  <div className="mt-1">CMO · Brand · Sales Ops</div>
                </div>
              </div>

              <Surface className="relative">
                {envMissing ? (
                  <div className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200/90">
                    Supabase env vars are missing. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                    <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
                  </div>
                ) : null}

                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-widest text-white/45">Email</div>
                    <Input
                      type="email"
                      value={email}
                      onValueChange={setEmail}
                      isRequired
                      autoComplete="email"
                      placeholder="name@company.com"
                      variant="bordered"
                      classNames={{
                        base: "w-full",
                        inputWrapper:
                          "glass-inset rounded-2xl border-white/10 bg-white/[0.02] hover:bg-white/[0.03] focus-within:ring-1 focus-within:ring-white/15",
                        input: "text-white/90 placeholder:text-white/25",
                        label: "hidden"
                      }}
                    />
                  </div>

                  {status === "success" && success ? (
                    <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                      {success}
                    </div>
                  ) : null}

                  {status === "error" && error ? (
                    <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {error}
                    </div>
                  ) : null}

                  <Button
                    type="submit"
                    color="primary"
                    isDisabled={envMissing || status === "loading"}
                    className="w-full rounded-2xl shadow-[0_10px_40px_rgba(59,130,246,0.15)]"
                  >
                    {status === "loading" ? "Sending..." : "Send magic link"}
                  </Button>

                  <div className="flex items-center justify-between pt-1 text-xs text-white/45">
                    <div>Session protected by RLS</div>
                    <div className="text-white/35">v0</div>
                  </div>
                </form>
              </Surface>
            </div>
          </PageShell>
        </div>
      </div>
    </main>
  );
}

