"use client";

import { useEffect, useState } from "react";
import type { HealthStatus } from "@career-agent/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type State = "checking" | "connected" | "unavailable";

export function BackendStatus() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_URL}/health`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Unexpected status ${res.status}`);
        return res.json() as Promise<HealthStatus>;
      })
      .then((body) => setState(body.status === "ok" ? "connected" : "unavailable"))
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error("Health check failed", err);
          setState("unavailable");
        }
      });

    return () => controller.abort();
  }, []);

  const label = {
    checking: "Checking backend…",
    connected: "Backend connected",
    unavailable: "Backend unavailable",
  }[state];

  return (
    <section>
      <h2>Backend status</h2>
      <p role="status">{label}</p>
    </section>
  );
}
