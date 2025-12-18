"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Surface } from "@/components/ds/Surface";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getCurrentProfile, Profile } from "@/lib/dashboardDb";

function roleLabel(role: Profile["role"] | null) {
  switch (role) {
    case "cmo":
      return "CMO";
    case "brand_manager":
      return "Brand";
    case "sales_ops":
      return "Sales Ops";
    default:
      return "—";
  }
}

export function TopNav() {
  const pathname = usePathname();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createSupabaseBrowserClient();
        const [{ data: userRes }, p] = await Promise.all([supabase.auth.getUser(), getCurrentProfile()]);
        if (cancelled) return;
        setEmail(userRes.user?.email ?? null);
        setProfile(p);
      } catch {
        // ignore
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = useMemo(() => {
    const name = profile?.full_name?.trim();
    if (name) return name;
    return email ?? "Account";
  }, [email, profile?.full_name]);

  const isCmo = profile?.role === "cmo";

  // Hide on auth-only routes
  if (pathname === "/login" || pathname.startsWith("/auth/")) return null;

  return (
    <div className="sticky top-0 z-40 p-4 md:p-6">
      <Surface className="px-4 py-3 md:px-5 md:py-4 border border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href="/" className="group inline-flex items-center gap-2">
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xs font-semibold text-white/90"
                aria-hidden="true"
              >
                D
              </span>
              <span className="text-sm font-semibold tracking-tight text-white/90 group-hover:text-white">
                Dashboard
              </span>
            </Link>

            <span className="mx-2 hidden h-5 w-px bg-white/10 md:block" aria-hidden="true" />

            <div className="hidden items-center gap-2 md:flex">
              <Button as={Link} href="/projects" size="sm" variant="flat" className="glass-inset text-white/85">
                Projects
              </Button>
              <Button as={Link} href="/brand/data-entry" size="sm" variant="flat" className="glass-inset text-white/85">
                Planning
              </Button>
              {isCmo ? (
                <Button
                  as={Link}
                  href="/cmo/projects"
                  size="sm"
                  className="rounded-2xl border border-white/12 bg-white/[0.06] text-white/90 shadow-[0_10px_40px_rgba(59,130,246,0.12)] hover:bg-white/[0.08]"
                >
                  CMO Console
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              as={Link}
              href="/account"
              size="sm"
              variant="flat"
              className="glass-inset text-white/85"
            >
              <span className="max-w-[180px] truncate">{displayName}</span>
              <span className="ml-2 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/60">
                {roleLabel(profile?.role ?? null)}
              </span>
            </Button>
            <LogoutButton size="sm" variant="flat" className="glass-inset text-white/85" />
          </div>
        </div>
      </Surface>
    </div>
  );
}

