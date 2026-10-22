"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { PageSkeleton } from "../../components/PageSkeleton";
import { useAuth } from "../../lib/auth";
import { he } from "../../lib/strings.he";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "authenticated") router.replace("/jobs");
  }, [state.status, router]);

  if (state.status !== "anonymous") return <PageSkeleton />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-8">
      <p className="mb-6 font-semibold text-accent-700">{he.appName}</p>
      {children}
    </main>
  );
}
