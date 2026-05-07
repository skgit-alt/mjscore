"use client";

import dynamic from "next/dynamic";
import { useAuth } from "@/lib/auth-context";
import LoginScreen from "@/components/LoginScreen";

const AuthProvider = dynamic(
  () => import("@/lib/auth-context").then((m) => m.AuthProvider),
  { ssr: false }
);

const NavBar = dynamic(() => import("@/components/NavBar"), { ssr: false });

function LoginGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

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

  if (!user) return <LoginScreen />;
  return <>{children}</>;
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NavBar />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
        <LoginGate>{children}</LoginGate>
      </main>
    </AuthProvider>
  );
}
