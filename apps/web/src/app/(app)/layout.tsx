"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { PageSkeleton } from "../../components/PageSkeleton";
import { TopBar } from "../../components/TopBar";
import { useAuth } from "../../lib/auth";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "anonymous") {
      router.replace(state.expired ? "/login?reason=expired" : "/login");
    }
  }, [state, router]);

  if (state.status !== "authenticated") return <PageSkeleton />;

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </>
  );
}
