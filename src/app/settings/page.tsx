"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import {
  getPlayers,
  updatePlayer,
  deletePlayer,
  getSettings,
  saveSettings,
  getParticipantAccounts,
  setParticipantAccount,
  deleteParticipantAccount,
} from "@/lib/firestore";
import { Player, Settings, DEFAULT_SETTINGS, ParticipantAccount } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

export default function SettingsPage() {
  const { createParticipant, changePassword } = useAuth();

  // パスワード変更
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword1, setNewPassword1] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    if (newPassword1.length < 6) { setPwError("新しいパスワードは6文字以上にしてください"); return; }
    if (newPassword1 !== newPassword2) { setPwError("新しいパスワードが一致しません"); return; }
    setChangingPw(true);
    try {
      await changePassword(currentPassword, newPassword1);
      setPwSuccess("パスワードを変更しました");
      setCurrentPassword(""); setNewPassword1(""); setNewPassword2("");
      setTimeout(() => setPwSuccess(""), 3000);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setPwError("現在のパスワードが正しくありません");
      } else {
        setPwError("変更に失敗しました");
      }
    } finally {
      setChangingPw(false);
    }
  };
  const [players, setPlayers] = useState<Player[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // 参加者アカウント
  const [accounts, setAccounts] = useState<ParticipantAccount[]>([]);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newLoginId, setNewLoginId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPlayerId, setNewPlayerId] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [accountSuccess, setAccountSuccess] = useState("");

  const load = async () => {
    const [p, s, a] = await Promise.all([getPlayers(), getSettings(), getParticipantAccounts()]);
    setPlayers(p);
    setSettings(s);
    setAccounts(a);
  };

  useEffect(() => { load(); }, []);

  const handleUpdatePlayer = async (id: string) => {
    const name = editingName.trim();
    if (!name) return;
    await updatePlayer(id, name);
    setEditingId(null);
    load();
  };

  const handleDeletePlayer = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？\n（過去の記録は残ります）`)) return;
    await deletePlayer(id);
    load();
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    await saveSettings(settings);
    setSavingSettings(false);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const updateUma4 = (rank: 1 | 2 | 3 | 4, value: number) => {
    setSettings((prev) => ({
      ...prev,
      uma4: { ...prev.uma4, [rank]: value },
    }));
  };

  const updateUma3 = (rank: 1 | 2 | 3, value: number) => {
    setSettings((prev) => ({
      ...prev,
      uma3: { ...prev.uma3, [rank]: value },
    }));
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError("");
    setAccountSuccess("");

    const loginId = newLoginId.trim();
    const displayName = newDisplayName.trim();
    const password = newPassword.trim();

    if (!loginId || !displayName || !password) return;
    if (password.length < 6) {
      setAccountError("パスワードは6文字以上にしてください");
      return;
    }
    if (accounts.some((a) => a.loginId === loginId)) {
      setAccountError("このIDはすでに使用されています");
      return;
    }

    setCreatingAccount(true);
    try {
      const uid = await createParticipant(loginId, password);
      await setParticipantAccount(uid, {
        loginId,
        displayName,
        ...(newPlayerId ? { playerId: newPlayerId } : {}),
      });
      setNewDisplayName("");
      setNewLoginId("");
      setNewPassword("");
      setNewPlayerId("");
      setAccountSuccess(`「${displayName}」のアカウントを作成しました（ID: ${loginId}）`);
      setTimeout(() => setAccountSuccess(""), 4000);
      load();
    } catch (err: unknown) {
      const msg = (err as { code?: string })?.code;
      if (msg === "auth/email-already-in-use") {
        setAccountError("このIDはすでに使用されています");
      } else {
        setAccountError(`アカウントの作成に失敗しました（${msg ?? String(err)}）`);
      }
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleDeleteAccount = async (uid: string, displayName: string) => {
    if (!confirm(`「${displayName}」のアカウントを無効化しますか？`)) return;
    await deleteParticipantAccount(uid);
    load();
  };

  return (
    <AuthGuard>
      <div className="space-y-8 max-w-2xl">
        <h1 className="text-2xl font-bold gold-text">設定</h1>

        {/* Player Management */}
        <section className="card p-5 space-y-4">
          <h2 className="text-lg font-semibold gold-text border-b border-yellow-900/40 pb-2">
            プレイヤー管理
          </h2>

          <div className="space-y-2">
            {players.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 py-2 border-b border-yellow-900/20"
              >
                {editingId === p.id ? (
                  <>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUpdatePlayer(p.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1"
                      autoFocus
                    />
                    <button
                      onClick={() => handleUpdatePlayer(p.id)}
                      className="btn-gold text-sm py-1 px-3"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="btn-outline text-sm py-1 px-3"
                    >
                      キャンセル
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium">{p.name}</span>
                    <button
                      onClick={() => {
                        setEditingId(p.id);
                        setEditingName(p.name);
                      }}
                      className="btn-outline text-sm py-1 px-3"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDeletePlayer(p.id, p.name)}
                      className="btn-danger"
                    >
                      削除
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Participant Account Management */}
        <section className="card p-5 space-y-5">
          <h2 className="text-lg font-semibold gold-text border-b border-yellow-900/40 pb-2">
            参加者アカウント管理
          </h2>

          {/* 既存アカウント一覧 */}
          {accounts.length > 0 && (
            <div className="space-y-2">
              {accounts.map((acc) => {
                const linkedPlayer = players.find((p) => p.id === acc.playerId);
                return (
                  <div
                    key={acc.uid}
                    className="flex items-center gap-2 py-2 border-b border-yellow-900/20"
                  >
                    <div className="flex-1">
                      <span className="font-medium">{acc.displayName}</span>
                      <span className="ml-3 text-sm text-gray-400">ID: {acc.loginId}</span>
                      {linkedPlayer && (
                        <span className="ml-2 text-xs text-gray-500">
                          （{linkedPlayer.name}）
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteAccount(acc.uid, acc.displayName)}
                      className="btn-danger"
                    >
                      無効化
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {accounts.length === 0 && (
            <p className="text-sm text-gray-400">アカウントがまだ登録されていません</p>
          )}

          {/* 新規アカウント作成 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">新規アカウント作成</h3>
            <form onSubmit={handleCreateAccount} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400">表示名</span>
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="例：田中"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400">ログインID</span>
                  <input
                    type="text"
                    value={newLoginId}
                    onChange={(e) => setNewLoginId(e.target.value)}
                    placeholder="例：tanaka"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400">パスワード（6文字以上）</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="パスワード"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400">プレイヤーと紐付け（任意）</span>
                  <select
                    value={newPlayerId}
                    onChange={(e) => setNewPlayerId(e.target.value)}
                  >
                    <option value="">紐付けない</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              {accountError && (
                <p className="text-sm text-red-400">{accountError}</p>
              )}
              {accountSuccess && (
                <p className="text-sm text-green-400">✓ {accountSuccess}</p>
              )}

              <button
                type="submit"
                disabled={creatingAccount}
                className="btn-gold disabled:opacity-50"
              >
                {creatingAccount ? "作成中..." : "アカウントを作成"}
              </button>
            </form>
          </div>

          <p className="text-xs text-gray-500">
            ※ 「無効化」はアプリへのアクセスを停止します。Firebase Authアカウントの完全削除はFirebaseコンソールから行ってください。
          </p>
        </section>

        {/* Rule Settings */}
        <section className="card p-5 space-y-5">
          <h2 className="text-lg font-semibold gold-text border-b border-yellow-900/40 pb-2">
            ゲームルール設定
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-300">返し点</span>
              <input
                type="number"
                value={settings.kaeshine}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    kaeshine: Number(e.target.value),
                  }))
                }
                step={1000}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-300">オカ (1位加算)</span>
              <input
                type="number"
                value={settings.oka}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, oka: Number(e.target.value) }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-300">場代（デフォルト）</span>
              <input
                type="number"
                value={settings.defaultBa}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultBa: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-300">飛びペナルティ (p)</span>
              <input
                type="number"
                value={settings.tobiPenalty}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    tobiPenalty: Number(e.target.value),
                  }))
                }
              />
            </label>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">
              4人ウマ（順位点）
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {([1, 2, 3, 4] as const).map((rank) => (
                <label key={rank} className="flex flex-col gap-1">
                  <span className={`text-xs rank-${rank}`}>{rank}位</span>
                  <input
                    type="number"
                    value={settings.uma4[rank]}
                    onChange={(e) => updateUma4(rank, Number(e.target.value))}
                    className="w-full"
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">
              3人ウマ（順位点）
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {([1, 2, 3] as const).map((rank) => (
                <label key={rank} className="flex flex-col gap-1">
                  <span className={`text-xs rank-${rank}`}>{rank}位</span>
                  <input
                    type="number"
                    value={settings.uma3[rank]}
                    onChange={(e) => updateUma3(rank, Number(e.target.value))}
                    className="w-full"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="btn-gold disabled:opacity-50"
            >
              {savingSettings ? "保存中..." : "ルールを保存"}
            </button>
            {settingsSaved && (
              <span className="text-sm text-green-400">✓ 保存しました</span>
            )}
          </div>
        </section>
      {/* パスワード変更 */}
        <section className="card p-5 space-y-4">
          <h2 className="text-lg font-semibold gold-text border-b border-yellow-900/40 pb-2">
            パスワード変更
          </h2>
          <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-300">現在のパスワード</span>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-300">新しいパスワード</span>
              <input type="password" value={newPassword1} onChange={(e) => setNewPassword1(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-300">新しいパスワード（確認）</span>
              <input type="password" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} required />
            </label>
            {pwError && <p className="text-sm text-red-400">{pwError}</p>}
            {pwSuccess && <p className="text-sm text-green-400">✓ {pwSuccess}</p>}
            <button type="submit" disabled={changingPw} className="btn-gold disabled:opacity-50">
              {changingPw ? "変更中..." : "パスワードを変更"}
            </button>
          </form>
        </section>
      </div>
    </AuthGuard>
  );
}
