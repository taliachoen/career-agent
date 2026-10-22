import type { ReactNode } from "react";

interface NoticeProps {
  tone: "error" | "info";
  children: ReactNode;
}

const TONES = {
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-accent-700/30 bg-accent-50 text-accent-800",
} as const;

export function Notice({ tone, children }: NoticeProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border px-3 py-2 text-sm ${TONES[tone]}`}
    >
      {children}
    </div>
  );
}
