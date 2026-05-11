"use client";

import Link from "next/link";
import Image from "next/image";
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
        className="transition-colors text-sm"
        style={isActive
          ? { color: "var(--gold)", fontWeight: 600, borderBottom: "2px solid var(--gold)", paddingBottom: "2px" }
          : { color: "rgba(240,234,214,0.7)" }
        }
      >
        {label}
      </Link>
    );
  };

  const displayName = isAdmin
    ? "管理者"
    : participantInfo?.displayName ?? "";

  return (
    <nav
      className="sticky top-0 z-50 px-4 py-2.5 flex items-center justify-between"
      style={{
        background: "rgba(10, 26, 18, 0.85)",
        borderBottom: "1px solid rgba(201, 162, 39, 0.2)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
      }}
    >
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="rounded-lg overflow-hidden" style={{ width: 28, height: 28, flexShrink: 0 }}>
            <Image src="/icon.png" alt="logo" width={28} height={28} priority />
          </div>
          <span
            className="text-lg font-bold tracking-wider hidden sm:block"
            style={{ color: "var(--gold)", letterSpacing: "0.08em" }}
          >
            Mj Score
          </span>
        </Link>
        {user && (
          <div className="hidden sm:flex gap-5">
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
            <span className="text-xs hidden sm:block" style={{ color: "rgba(201,162,39,0.7)" }}>
              {isAdmin ? "👑 " : ""}{displayName}
            </span>
            <button onClick={signOut} className="btn-outline text-xs py-1 px-3">
              ログアウト
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
