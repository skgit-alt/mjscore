"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function LoginScreen() {
  const { signIn, signInAsParticipant } = useAuth();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleParticipantLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInAsParticipant(loginId.trim(), password);
    } catch {
      setError("IDまたはパスワードが正しくありません");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <div className="text-4xl mb-2">🀄</div>
          <h1 className="text-2xl font-bold gold-text">麻雀記録</h1>
          <p className="text-gray-400 mt-1 text-sm">ログインしてください</p>
        </div>

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
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full disabled:opacity-50"
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </form>
        </div>

        {/* 管理者ログイン */}
        <div className="card p-4 space-y-2">
          <p className="text-xs text-gray-500 text-center">管理者の方</p>
          <button
            onClick={signIn}
            className="btn-outline w-full text-sm"
          >
            Googleでログイン（管理者）
          </button>
        </div>
      </div>
    </div>
  );
}
