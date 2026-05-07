"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function NavBar() {
  const { user, isAdmin, isParticipant, participantInfo, signOut } = useAuth();
  const pathname = usePathname();

  const navLink = (href: string, label: string) => {
    const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        href={href}
        className="transition-colors"
        style={isActive
          ? { color: "var(--gold)", fontWeight: 600, borderBottom: "2px solid var(--gold)", paddingBottom: "2px" }
          : { color: "inherit" }
        }
      >
        {label}
      </Link>
    );
  };

  const displayName = isAdmin
    ? user?.displayName ?? "管理者"
    : participantInfo?.displayName ?? "";

  return (
    <nav
      className="sticky top-0 z-50 px-4 py-3 flex items-center justify-between"
      style={{
        background: "rgba(26, 58, 42, 0.95)",
        borderBottom: "1px solid rgba(201, 162, 39, 0.4)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="flex items-center gap-6">
        <Link href="/" className="text-xl font-bold" style={{ color: "var(--gold)" }}>
          🀄 麻雀記録
        </Link>
        {user && (
          <div className="flex gap-4 text-sm">
            {navLink("/", "成績")}
            {navLink("/history", "履歴")}
            {(isAdmin || isParticipant) && navLink("/input", "入力")}
            {isAdmin && navLink("/settings", "設定")}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <>
            <span className="text-sm text-gray-300 hidden sm:block">
              {isAdmin ? "👑 " : ""}{displayName}
            </span>
            <button onClick={signOut} className="btn-outline text-sm py-1 px-3">
              ログアウト
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
