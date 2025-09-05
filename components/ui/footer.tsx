import React from "react";

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Nutri Snap
      </div>
    </footer>
  );
}
