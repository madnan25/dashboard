"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Surface } from "@/components/ds/Surface";
import { NotificationList } from "@/components/notifications/NotificationList";
import { useNotifications } from "@/components/notifications/useNotifications";

function BellIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M15 17H9m6 0a3 3 0 0 1-6 0m6 0h3.2a1 1 0 0 0 .8-1.6l-1.4-1.9a3 3 0 0 1-.6-1.7V9a4.8 4.8 0 1 0-9.6 0v2.8a3 3 0 0 1-.6 1.7l-1.4 1.9a1 1 0 0 0 .8 1.6H9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NotificationBell({
  userId,
  variant = "nav",
  className = ""
}: {
  userId: string | null;
  variant?: "nav" | "tab";
  className?: string;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const openModeRef = useRef<"auto" | "manual" | null>(null);
  const autoCloseRef = useRef<number | null>(null);

  const { items, unreadCount, loading, markAllRead, markRead } = useNotifications({
    userId,
    limit: variant === "nav" ? 6 : 30,
    unreadOnly: variant === "nav",
    onNewNotification: () => {
      if (variant !== "nav") return;
      setIsOpen(true);
      openModeRef.current = "auto";
      if (autoCloseRef.current) window.clearTimeout(autoCloseRef.current);
      autoCloseRef.current = window.setTimeout(() => {
        if (openModeRef.current === "auto") {
          setIsOpen(false);
          openModeRef.current = null;
        }
      }, 3200);
    }
  });

  useEffect(() => {
    if (!isOpen) return;
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        openModeRef.current = null;
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [isOpen]);

  const badgeLabel = unreadCount > 9 ? "9+" : unreadCount.toString();
  const showBadge = unreadCount > 0;

  if (!userId) return null;

  if (variant === "tab") {
    const active = pathname === "/notifications" || pathname.startsWith("/notifications/");
    return (
      <Link href="/notifications" className="min-w-0">
        <div
          className={[
            "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5",
            active ? "bg-white/[0.06] border border-white/15" : "border border-transparent",
            "transition-colors"
          ].join(" ")}
        >
          <div className="relative">
            <BellIcon className={active ? "text-white" : "text-white/70"} />
            {showBadge ? (
              <span className="absolute -right-2 -top-1 min-w-[16px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-semibold text-white">
                {badgeLabel}
              </span>
            ) : null}
          </div>
          <div className={active ? "text-[11px] font-semibold text-white" : "text-[11px] font-medium text-white/70"}>Alerts</div>
        </div>
      </Link>
    );
  }

  const buttonClass =
    className ||
    "glass-inset rounded-2xl border border-white/10 bg-white/[0.02] text-white/85 hover:bg-white/[0.04] hover:border-white/15";

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => {
            const next = !prev;
            openModeRef.current = next ? "manual" : null;
            return next;
          });
          if (autoCloseRef.current) {
            window.clearTimeout(autoCloseRef.current);
            autoCloseRef.current = null;
          }
        }}
        className={`relative inline-flex items-center justify-center px-3 py-2 text-sm ${buttonClass}`}
        aria-label="Notifications"
      >
        <BellIcon className="text-white/80" />
        {showBadge ? (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-semibold text-white shadow-[0_0_10px_rgba(244,63,94,0.45)]">
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 mt-2 w-[360px]">
          <Surface className="p-3 border border-white/10">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white/90">Notifications</div>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    markAllRead();
                    if (variant === "nav") setIsOpen(false);
                  }}
                  className="text-[11px] font-medium text-white/60 hover:text-white/80"
                >
                  Mark all read
                </button>
              ) : null}
            </div>
            <div className="mt-3">
              <NotificationList items={items} onMarkRead={markRead} onItemClick={() => setIsOpen(false)} />
              <div className="mt-3 flex justify-end">
                <Link href="/notifications" onClick={() => setIsOpen(false)} className="text-[11px] text-white/60 hover:text-white/85">
                  View all
                </Link>
              </div>
              {loading ? <div className="mt-2 text-[11px] text-white/45">Refreshing...</div> : null}
            </div>
          </Surface>
        </div>
      ) : null}
    </div>
  );
}
