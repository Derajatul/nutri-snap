"use client";

import React from "react";
import { cn } from "@/lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLElement> & {
  rounded?: string; // e.g., "rounded-md"
  as?: "div" | "span";
};

export function Skeleton({
  className,
  rounded = "rounded-md",
  as = "div",
  ...props
}: SkeletonProps) {
  const Comp = as as any;
  return (
    <Comp
      className={cn("animate-pulse bg-muted inline-block", rounded, className)}
      aria-hidden="true"
      {...props}
    />
  );
}
