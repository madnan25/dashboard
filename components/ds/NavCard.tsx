"use client";

import Link from "next/link";
import * as React from "react";
import { Surface } from "@/components/ds/Surface";

export function NavCard({
  href,
  title,
  description,
  meta
}: {
  href: string;
  title: string;
  description?: string;
  meta?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0"
    >
      <Surface className="relative overflow-hidden transition hover:-translate-y-[1px] hover:border-white/15 hover:bg-white/[0.03]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(600px 120px at 12% 0%, rgba(59,130,246,0.18), transparent 60%), radial-gradient(600px 120px at 92% 100%, rgba(124,58,237,0.14), transparent 60%)"
          }}
        />

        <div className="relative flex h-full flex-col justify-between gap-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="text-lg font-semibold text-white/90">{title}</div>
              <div className="text-white/35 transition group-hover:text-white/55" aria-hidden="true">
                →
              </div>
            </div>
            {description ? <div className="mt-1 text-sm text-white/55">{description}</div> : null}
          </div>

          {meta ? <div className="text-sm text-white/70">{meta}</div> : <div className="text-sm text-white/60">Open</div>}
        </div>
      </Surface>
    </Link>
  );
}

