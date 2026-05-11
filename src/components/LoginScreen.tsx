"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";

export default function LoginScreen() {
  const { signIn, signInAsParticipant, authError } = useAuth();

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [participantError, setParticipantError] = useState("");
  const [participantLoading, setParticipantLoading] = useState(false);

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const handleParticipantLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setParticipantError("");
    setParticipantLoading(true);
    try {
      await signInAsParticipant(loginId.trim(), password);
    } catch {
      setParticipantError("IDまたはパスワードが正しくありません");
    } finally {
      setParticipantLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError("");
    setAdminLoading(true);
    try {
      await signIn(adminEmail.trim(), adminPassword);
    } catch {
      setAdminError("メールアドレスまたはパスワードが正しくありません");
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      {/* Logo & title */}
      <div className="flex flex-col items-center mb-8">
        <div
          className="mb-4 rounded-2xl overflow-hidden"
          style={{
            width: 96,
            height: 96,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,162,39,0.2)",
          }}
        >
          <Image
            src="/icon.png"
            alt="Mj Score"
            width={96}
            height={96}
            priority
          />
        </div>
        <h1
          className="text-3xl font-bold tracking-widest"
          style={{
            color: "var(--gold)",
            textShadow: "0 2px 12px rgba(201,162,39,0.3)",
            letterSpacing: "0.15em",
          }}
        >
          Mj Score
        </h1>
        <p className="text-gray-500 mt-2 text-sm tracking-wide">対局記録・成績管理</p>
      </div>

      {/* Auth error */}
      {authError && (
        <div className="w-full max-w-sm mb-4 px-4 py-2 rounded-lg bg-red-950/40 border border-red-500/30">
          <p className="text-xs text-red-400 break-all">{authError}</p>
        </div>
      )}

      {/* Participant login card */}
      <div
        className="w-full max-w-sm mb-4 p-6 rounded-2xl space-y-4"
        style={{
          background: "rgba(20, 50, 35, 0.6)",
          border: "1px solid rgba(201, 162, 39, 0.2)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(201,162,39,0.1)",
        }}
      >
        <h2 className="font-semibold text-center" style={{ color: "var(--gold)", letterSpacing: "0.05em" }}>
          ログイン
        </h2>
        <form onSubmit={handleParticipantLogin} className="space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-gray-400 tracking-wide">ログインID</span>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="IDを入力"
              autoComplete="username"
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-gray-400 tracking-wide">パスワード</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力"
              autoComplete="current-password"
              required
            />
          </label>
          {participantError && (
            <p className="text-sm text-red-400 text-center">{participantError}</p>
          )}
          <button
            type="submit"
            disabled={participantLoading}
            className="btn-gold w-full mt-1 disabled:opacity-50"
          >
            {participantLoading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </div>

      {/* Admin login */}
      <div className="w-full max-w-sm">
        <button
          onClick={() => setShowAdmin((v) => !v)}
          className="text-xs text-gray-600 w-full text-center py-1 hover:text-gray-400 transition-colors"
        >
          管理者の方はこちら {showAdmin ? "▲" : "▼"}
        </button>
        {showAdmin && (
          <div
            className="mt-3 p-5 rounded-xl space-y-3"
            style={{
              background: "rgba(15, 35, 25, 0.7)",
              border: "1px solid rgba(201, 162, 39, 0.15)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-gray-400">メールアドレス</span>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="email"
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-gray-400">パスワード</span>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="パスワード"
                  autoComplete="current-password"
                  required
                />
              </label>
              {adminError && (
                <p className="text-sm text-red-400 text-center">{adminError}</p>
              )}
              <button
                type="submit"
                disabled={adminLoading}
                className="btn-outline w-full text-sm disabled:opacity-50"
              >
                {adminLoading ? "ログイン中..." : "管理者としてログイン"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
