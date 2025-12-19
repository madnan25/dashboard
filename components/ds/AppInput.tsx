"use client";

import * as React from "react";
import { Input } from "@heroui/react";
import { cn } from "@/lib/cn";

export function AppInput(
  props: React.ComponentProps<typeof Input> & {
    classNames?: React.ComponentProps<typeof Input>["classNames"];
  }
) {
  const { classNames, ...rest } = props;

  const safe = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

  const mergedClassNames: React.ComponentProps<typeof Input>["classNames"] = {
    ...classNames,
    base: cn("w-full", safe(classNames?.base)),
    inputWrapper: cn(
      [
        "glass-inset rounded-2xl border-white/10 bg-white/[0.02] hover:bg-white/[0.03]",
        // premium focus (avoid harsh blue rectangle)
        "group-data-[focus=true]:border-white/20 group-data-[focus=true]:shadow-[0_0_0_1px_rgba(255,255,255,0.10)]"
      ].join(" "),
      safe(classNames?.inputWrapper)
    ),
    input: cn(
      "text-white/90 placeholder:text-white/25 !outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0",
      safe(classNames?.input)
    ),
    label: cn("hidden", safe(classNames?.label))
  };

  return <Input {...rest} variant={rest.variant ?? "bordered"} classNames={mergedClassNames} />;
}


