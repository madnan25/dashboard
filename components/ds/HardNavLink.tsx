"use client";

import * as React from "react";

export function HardNavLink({
  href,
  className = "",
  children,
  title,
  "aria-disabled": ariaDisabled,
  ...rest
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
  "aria-disabled"?: boolean | "true" | "false";
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "title" | "children" | "onClick">) {
  return (
    <a
      href={href}
      className={className}
      title={title}
      aria-disabled={ariaDisabled}
      {...rest}
      onClick={(e) => {
        const isModified =
          e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (typeof e.button === "number" && e.button !== 0);
        if (isModified) return;
        // Force a full navigation to avoid App Router getting stuck
        // when middleware redirects internal RSC requests.
        e.preventDefault();
        window.location.assign(href);
      }}
    >
      {children}
    </a>
  );
}

