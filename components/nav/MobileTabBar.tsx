"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Surface } from "@/components/ds/Surface";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getCurrentProfile, type Profile } from "@/lib/dashboardDb";

function roleLabel(role: Profile["role"] | null) {
  switch (role) {
    case "cmo":
      return "CMO";
    case "brand_manager":
      return "Brand";
    case "member":
      return "Member";
    case "sales_ops":
      return "Sales";
    case "viewer":
      return "View";
    default:
      return "—";
  }
}

function Icon({
  d,
  active
}: {
  d: string;
  active: boolean;
}) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      className={active ? "text-white" : "text-white/70"}
      aria-hidden="true"
    >
      <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  return pathname.startsWith(href + "/");
}

export function MobileTabBar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);

  const hide = pathname === "/login" || pathname.startsWith("/auth/");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createSupabaseBrowserClient();
        // ensure auth cookie exists (ignore error)
        await supabase.auth.getUser().catch(() => null);
        const p = await getCurrentProfile();
        if (cancelled) return;
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

  const isCmo = profile?.role === "cmo";
  const canSeePlanning = profile?.role != null && profile.role !== "viewer" && profile.role !== "member";
  const canAccessTasks =
    profile?.role != null &&
    (profile.role === "cmo" ||
      (profile.role !== "sales_ops" && (profile.role === "member" || profile.role === "brand_manager" || profile.is_marketing_team === true)));

  const tabs = useMemo(() => {
    const base: Array<
      | { key: string; href: string; label: string; icon: string; disabled?: false }
      | { key: string; href: string; label: string; icon: string; disabled: true; title?: string }
    > = [
      { key: "home", href: "/", label: "Home", icon: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" },
      // Projects: grid
      { key: "projects", href: "/projects", label: "Projects", icon: "M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" },
      // Calendar: view-only master calendar
      {
        key: "calendar",
        href: "/master-calendar",
        label: "Calendar",
        icon: "M7 4v2m10-2v2M6 8h12M6 20h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2Z"
      },
      ...(profile?.role == null
        ? []
        : canAccessTasks
          ? [
              {
                key: "tasks",
                href: "/tasks",
                label: "Tasks",
                icon: "M8 7h12M8 12h12M8 17h12M4.5 7h.01M4.5 12h.01M4.5 17h.01"
              }
            ]
          : [
              {
                key: "tasks",
                href: "/tasks",
                label: "Tasks",
                icon: "M8 7h12M8 12h12M8 17h12M4.5 7h.01M4.5 12h.01M4.5 17h.01",
                disabled: true,
                title: profile.role === "sales_ops" ? "Tasks are not available for Sales Ops." : "Marketing team only."
              }
            ]),
      canSeePlanning
        // Planning: clipboard/checklist
        ? { key: "planning", href: "/brand/data-entry", label: "Planning", icon: "M9 4h6m-7 4h8M8 12h8M8 16h5M7 8h.01M7 12h.01M7 16h.01" }
        : {
            key: "planning",
            href: "/brand/data-entry",
            label: "Planning",
            icon: "M9 4h6m-7 4h8M8 12h8M8 16h5M7 8h.01M7 12h.01M7 16h.01",
            disabled: true,
            title: "View-only access: Planning & Actuals is disabled for this role."
          },
      { key: "account", href: "/account", label: "Account", icon: "M12 12a4 4 0 1 0-0.001-8.001A4 4 0 0 0 12 12Zm-7.5 9a7.5 7.5 0 0 1 15 0" }
    ];

    if (isCmo) {
      const insertAt = 4;
      base.splice(insertAt, 0, { key: "cmo", href: "/cmo/projects", label: "CMO", icon: "M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" });
    }

    return base;
  }, [canAccessTasks, canSeePlanning, isCmo, profile?.role]);

  // Hide on auth-only routes
  if (hide) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2">
        <Surface className="p-2 border border-white/10" style={{ backdropFilter: "blur(18px)" }}>
          <nav
            className={`grid ${
              tabs.length >= 7
                ? "grid-cols-7"
                : tabs.length === 6
                  ? "grid-cols-6"
                  : tabs.length === 5
                    ? "grid-cols-5"
                    : "grid-cols-4"
            } gap-1`}
            aria-label="Primary"
          >
            {tabs.map((t) => {
              const active = isActivePath(pathname, t.href);
              const content = (
                <div
                  className={[
                    "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5",
                    active ? "bg-white/[0.06] border border-white/15" : "border border-transparent",
                    "transition-colors"
                  ].join(" ")}
                >
                  <Icon d={t.icon} active={active} />
                  <div className={active ? "text-[11px] font-semibold text-white" : "text-[11px] font-medium text-white/70"}>
                    {t.label}
                  </div>
                </div>
              );

              if ("disabled" in t && t.disabled) {
                return (
                  <div key={t.key} className="opacity-55" title={t.title} aria-disabled="true">
                    {content}
                  </div>
                );
              }

              return (
                <Link key={t.key} href={t.href} prefetch className="min-w-0">
                  {content}
                </Link>
              );
            })}
          </nav>
        </Surface>
      </div>
    </div>
  );
}

