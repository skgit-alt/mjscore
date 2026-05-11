"use client";

import { useState } from "react";
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
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold gold-text">Mj Score</h1>
          <p className="text-gray-400 mt-1 text-sm">ログインしてください</p>
        </div>

        {authError && (
          <p className="text-xs text-red-400 break-all bg-red-950/30 p-2 rounded">{authError}</p>
        )}

        {/* 参加者ログイン */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold gold-text">参加者ログイン</h2>
          <form onSubmit={handleParticipantLogin} className="space-y-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-400">ログインID</span>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="IDを入力"
                autoComplete="username"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-400">パスワード</span>
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
              <p className="text-sm text-red-400">{participantError}</p>
            )}
            <button
              type="submit"
              disabled={participantLoading}
              className="btn-gold w-full disabled:opacity-50"
            >
              {participantLoading ? "ログイン中..." : "ログイン"}
            </button>
          </form>
        </div>

        {/* 管理者ログイン */}
        <div className="card p-4 space-y-3">
          <button
            onClick={() => setShowAdmin((v) => !v)}
            className="text-xs text-gray-500 w-full text-center"
          >
            管理者の方 {showAdmin ? "▲" : "▼"}
          </button>
          {showAdmin && (
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-400">メールアドレス</span>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="email"
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-400">パスワード</span>
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
                <p className="text-sm text-red-400">{adminError}</p>
              )}
              <button
                type="submit"
                disabled={adminLoading}
                className="btn-outline w-full text-sm disabled:opacity-50"
              >
                {adminLoading ? "ログイン中..." : "管理者としてログイン"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
