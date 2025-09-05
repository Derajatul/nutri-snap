"use client";

import Link from "next/link";
import React from "react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
          Nutri Snap
        </Link>
        <nav className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => {
              window.open(
                "https://github.com/Derajatul/nutri-snap",
                "_blank",
                "noreferrer"
              );
            }}
          >
            GitHub
          </Button>
        </nav>
      </div>
    </header>
  );
}
