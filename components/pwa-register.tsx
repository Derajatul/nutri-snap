"use client";
import React from "react";

export function PWARegister() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      const register = async () => {
        try {
          await navigator.serviceWorker.register("/service-worker.js", {
            scope: "/",
          });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("SW registration failed", e);
        }
      };
      // wait a tick to avoid blocking initial paint
      setTimeout(register, 300);
    }
  }, []);
  return null;
}