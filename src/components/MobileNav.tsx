"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function MobileNav() {
  const { user, isAdmin, isParticipant } = useAuth();
  const pathname = usePathname();
  if (!user) return null;

  const tabs = [
    { href: "/", label: "成績", icon: "🏆" },
    { href: "/history", label: "履歴", icon: "📋" },
    ...((isAdmin || isParticipant) ? [{ href: "/input", label: "入力", icon: "✏️" }] : []),
    ...(isAdmin ? [{ href: "/settings", label: "設定", icon: "⚙️" }] : []),
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 sm:hidden"
      style={{
        background: "rgba(8, 20, 13, 0.95)",
        borderTop: "1px solid rgba(201,162,39,0.2)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex">
        {tabs.map((tab) => {
          const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
              style={{
                color: isActive ? "var(--gold)" : "rgba(240,234,214,0.4)",
              }}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span
                className="text-xs"
                style={{
                  fontWeight: isActive ? 700 : 400,
                  fontSize: "0.65rem",
                  letterSpacing: "0.05em",
                }}
              >
                {tab.label}
              </span>
              {isActive && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "env(safe-area-inset-bottom, 0px)",
                    width: "1.5rem",
                    height: "2px",
                    background: "var(--gold)",
                    borderRadius: "1px",
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
