"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Atualiza a página sem tirar o foco de quem está digitando. */
export function AutoRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    function refreshIfIdle() {
      if (document.visibilityState !== "visible") return;
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)
      ) {
        return;
      }
      router.refresh();
    }

    const timer = window.setInterval(refreshIfIdle, intervalMs);
    document.addEventListener("visibilitychange", refreshIfIdle);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfIdle);
    };
  }, [intervalMs, router]);

  return (
    <span className="text-xs text-ink-soft">
      Atualiza automaticamente a cada {Math.max(1, Math.round(intervalMs / 1000))}s
    </span>
  );
}
