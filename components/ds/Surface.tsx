"use client";

import * as React from "react";

export function Surface({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`glass-inset rounded-3xl p-5 ${className}`}>{children}</div>;
}

export function PageShell({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`rounded-3xl p-6 md:p-8 border border-white/10 ${className}`}>{children}</div>;
}


