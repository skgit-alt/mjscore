"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push("/");
    }
  }, [loading, isAdmin, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="inline-block w-8 h-8 border-4 rounded-full animate-spin"
          style={{ borderColor: "var(--gold)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (!isAdmin) return null;

  return <>{children}</>;
}
