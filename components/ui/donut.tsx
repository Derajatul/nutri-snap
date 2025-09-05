"use client";

import React from "react";

type DonutProps = {
  value: number;
  max: number;
  label: string;
  unit?: string;
  size?: number; // px
  thickness?: number; // stroke width px
  className?: string;
  colorClassName?: string; // stroke color for progress
  trackClassName?: string; // stroke color for track
};

export function Donut({
  value,
  max,
  label,
  unit = "",
  size = 96,
  thickness = 10,
  className = "",
  colorClassName = "text-primary",
  trackClassName = "text-muted-foreground/20",
}: DonutProps) {
  const safeMax = Math.max(0, max || 0);
  const progress = safeMax > 0 ? Math.min(1, Math.max(0, value / safeMax)) : 0;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const dash = c;
  const offset = c * (1 - progress);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          className={trackClassName}
          stroke="currentColor"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          className={colorClassName}
          stroke="currentColor"
          strokeLinecap="round"
          strokeDasharray={dash}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center leading-tight">
          <div className="text-sm font-semibold">
            {Math.round(value).toLocaleString()} {unit}
          </div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}
