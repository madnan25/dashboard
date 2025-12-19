"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell, Surface } from "@/components/ds/Surface";
import { AppButton } from "@/components/ds/AppButton";
import { AppInput } from "@/components/ds/AppInput";
import { createClient } from "@/lib/supabase/browser";

function canonicalOrigin() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  return typeof window !== "undefined" ? window.location.origin : "";
}

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
      const supabase = createClient();
      const origin = canonicalOrigin();
      const emailRedirectTo = `${origin}/auth/callback?redirectTo=${encodeURIComponent(
        redirectTo
      )}`;

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo,
          shouldCreateUser: false
        }
      });

      if (otpError) {
        const msg = (otpError.message ?? "").toLowerCase();
        if (msg.includes("user not found") || msg.includes("signup") || msg.includes("sign up") || msg.includes("not allowed")) {
          setStatus("error");
          setError("User does not exist. Ask an admin to invite you.");
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
    <main className="relative min-h-screen overflow-hidden p-4 sm:p-6">
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

      {/* Ambient "electric traces" traveling exactly ON grid lines (42px spacing) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-75 mix-blend-screen motion-reduce:hidden">
        {/* Horizontal traces pinned to Y grid lines: 42 * n */}
        <span
          className="absolute left-[-30vw] h-px w-[260px] rounded-full"
          style={{
            top: "calc(42px * 4)",
            background:
              "linear-gradient(90deg, transparent, rgba(34,211,238,0), rgba(34,211,238,0.92), rgba(16,185,129,0.70), rgba(124,58,237,0.35), transparent)",
            filter: "drop-shadow(0 0 10px rgba(34,211,238,0.28)) drop-shadow(0 0 18px rgba(16,185,129,0.14))",
            animation: "trace-x 10.8s ease-in-out infinite",
            animationDelay: "0.8s"
          }}
        />
        <span
          className="absolute left-[-35vw] h-px w-[210px] rounded-full"
          style={{
            top: "calc(42px * 9)",
            background:
              "linear-gradient(90deg, transparent, rgba(16,185,129,0), rgba(16,185,129,0.85), rgba(34,211,238,0.55), transparent)",
            filter: "drop-shadow(0 0 10px rgba(16,185,129,0.22))",
            animation: "trace-x 13.6s ease-in-out infinite",
            animationDelay: "3.1s"
          }}
        />

        {/* Vertical trace pinned to X grid line: 42 * n */}
        <span
          className="absolute top-[-30vh] w-px h-[280px] rounded-full"
          style={{
            left: "calc(42px * 13)",
            background:
              "linear-gradient(180deg, transparent, rgba(34,211,238,0), rgba(34,211,238,0.88), rgba(16,185,129,0.55), transparent)",
            filter: "drop-shadow(0 0 12px rgba(34,211,238,0.22))",
            animation: "trace-y 12.4s ease-in-out infinite",
            animationDelay: "1.9s"
          }}
        />

        {/* Subtle flicker node (tiny pulse) pinned to intersection */}
        <span
          className="absolute h-[6px] w-[6px] rounded-full"
          style={{
            left: "calc(42px * 9)",
            top: "calc(42px * 7)",
            background: "radial-gradient(circle, rgba(34,211,238,0.95), rgba(34,211,238,0.0) 70%)",
            filter: "drop-shadow(0 0 10px rgba(34,211,238,0.25))",
            animation: "trace-node 5.2s steps(2, end) infinite",
            opacity: 0.35
          }}
        />
      </div>

      <style jsx global>{`
        @keyframes trace-x {
          0% {
            transform: translateX(0);
            opacity: 0;
          }
          7% {
            opacity: 0.95;
          }
          55% {
            opacity: 0.82;
          }
          93% {
            opacity: 0.9;
          }
          100% {
            transform: translateX(170vw);
            opacity: 0;
          }
        }
        @keyframes trace-y {
          0% {
            transform: translateY(0);
            opacity: 0;
          }
          8% {
            opacity: 0.9;
          }
          55% {
            opacity: 0.78;
          }
          92% {
            opacity: 0.88;
          }
          100% {
            transform: translateY(170vh);
            opacity: 0;
          }
        }
        @keyframes trace-node {
          0%,
          70% {
            opacity: 0.22;
          }
          72% {
            opacity: 0.65;
          }
          74% {
            opacity: 0.28;
          }
          76% {
            opacity: 0.58;
          }
          78%,
          100% {
            opacity: 0.22;
          }
        }
      `}</style>

      <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-6xl items-center justify-center">
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
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-white/55">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/70 shadow-[0_0_18px_rgba(16,185,129,0.35)]" />
                    Secure console
                  </div>
                  <div className="text-3xl font-semibold tracking-tight text-white/95 sm:text-[34px]">Sign in</div>
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
                    <AppInput
                      type="email"
                      value={email}
                      onValueChange={setEmail}
                      isRequired
                      autoComplete="email"
                      placeholder="name@company.com"
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

                  <AppButton
                    type="submit"
                    intent="primary"
                    effect="wow"
                    isDisabled={envMissing || status === "loading"}
                    className="w-full rounded-2xl shadow-[0_10px_40px_rgba(59,130,246,0.15)] h-11"
                  >
                    {status === "loading" ? "Sending..." : "Send magic link"}
                  </AppButton>

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

