"use client";

import { useEffect, useState } from "react";
import { Timestamp } from "firebase/firestore";
import AuthGuard from "@/components/AuthGuard";
import { getPlayers, addPlayer, addGame, deleteAllGames } from "@/lib/firestore";
import { Player } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

interface ImportRound {
  ba: number;
  yakuman?: boolean;
  results: { name: string; rank: number; point: number }[];
}
interface ImportGame {
  date: string;
  numPlayers: 3 | 4;
  rounds: ImportRound[];
}

export default function ImportPage() {
  const { user, isAdmin } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [importData, setImportData] = useState<ImportGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    Promise.all([
      getPlayers(),
      fetch("/import_data.json").then((r) => r.json()),
    ]).then(([p, data]) => {
      setPlayers(p);
      setImportData(data);
      setLoading(false);
    });
  }, []);

  const existingNames = new Set(players.map((p) => p.name));
  const allNamesInData = [
    ...new Set(
      importData.flatMap((g) =>
        g.rounds.flatMap((r) => r.results.map((x) => x.name))
      )
    ),
  ].sort();
  const newNames = allNamesInData.filter((n) => !existingNames.has(n));
  const regularRoundCount = importData.reduce(
    (s, g) => s + g.rounds.filter((r) => !r.yakuman).length,
    0
  );
  const yakumanCount = importData.reduce(
    (s, g) => s + g.rounds.filter((r) => r.yakuman).length,
    0
  );

  const handleImport = async () => {
    if (!user || !isAdmin) return;
    setImporting(true);
    setProgress(0);
    try {

    // 1. 新規プレイヤーを登録
    const maxOrder =
      players.length > 0 ? Math.max(...players.map((p) => p.order)) : 0;
    for (let i = 0; i < newNames.length; i++) {
      setStatus(`新規プレイヤー登録: ${newNames[i]}`);
      await addPlayer(newNames[i], maxOrder + i + 1);
    }

    // 2. 最新プレイヤー一覧を取得して名前→ID マップ作成
    const freshPlayers = await getPlayers();
    const nameToId: Record<string, string> = {};
    freshPlayers.forEach((p) => { nameToId[p.name] = p.id; });

    // 3. 各セッションをインポート（日付昇順）
    const sorted = [...importData].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    for (let gi = 0; gi < sorted.length; gi++) {
      const game = sorted[gi];
      setStatus(`インポート中 ${gi + 1} / ${sorted.length}: ${game.date}`);
      setProgress(Math.round(((gi + 1) / sorted.length) * 100));

      const regularRounds = game.rounds.filter((r) => !r.yakuman);
      const yakumanRounds = game.rounds.filter((r) => r.yakuman);

      // プレイヤーID収集（全ラウンドから）
      const gamePlayerNames = [
        ...new Set(game.rounds.flatMap((r) => r.results.map((x) => x.name))),
      ];

      // 合計ポイント・順位カウント集計
      const totalPoints: Record<string, number> = {};
      const rankCounts: Record<string, { 1: number; 2: number; 3: number; 4: number }> = {};
      gamePlayerNames.forEach((name) => {
        const id = nameToId[name];
        if (!id) return;
        totalPoints[id] = 0;
        rankCounts[id] = { 1: 0, 2: 0, 3: 0, 4: 0 };
      });

      let totalBa = 0;
      const tobiCounts: Record<string, number> = {};
      gamePlayerNames.forEach((name) => {
        const id = nameToId[name];
        if (id) tobiCounts[id] = 0;
      });

      // 通常ラウンド: ポイント・順位カウント・場代・トビすべて集計
      regularRounds.forEach((round) => {
        totalBa += round.ba;
        round.results.forEach((r) => {
          const id = nameToId[r.name];
          if (!id) return;
          totalPoints[id] += r.point;
          rankCounts[id][r.rank as 1 | 2 | 3 | 4]++;
          if (r.point <= -50) tobiCounts[id]++;
        });
      });

      // 役満ラウンド: ポイントのみ加算（順位カウント・場代・トビは含めない）
      yakumanRounds.forEach((round) => {
        round.results.forEach((r) => {
          const id = nameToId[r.name];
          if (!id) return;
          totalPoints[id] += r.point;
        });
      });

      // 日次順位（合計ポイント降順）
      const sortedIds = Object.keys(totalPoints).sort(
        (a, b) => totalPoints[b] - totalPoints[a]
      );
      const dailyResults = sortedIds.map((id, idx) => ({
        playerId: id,
        score: null,
        point: totalPoints[id],
        rank: idx + 1,
        rankCounts: rankCounts[id],
        tobiCount: tobiCounts[id] ?? 0,
      }));

      // 半荘詳細（役満フラグ付きで全ラウンド保存）
      const rounds = game.rounds.map((round) => ({
        ba: round.ba,
        ...(round.yakuman ? { yakuman: true } : {}),
        results: round.results.map((r) => ({
          playerId: nameToId[r.name] ?? "",
          score: null as null,
          point: r.point,
          rank: r.rank,
          ...(!round.yakuman && r.point <= -50 ? { tobi: true } : {}),
        })),
      }));

      // 日本時間午前0時のTimestamp
      const playedAt = Timestamp.fromDate(
        new Date(game.date + "T00:00:00+09:00")
      );

      await addGame({
        playedAt,
        numPlayers: game.numPlayers,
        ba: totalBa,
        numGames: regularRounds.length, // 役満は半荘数に含めない
        results: dailyResults,
        rounds,
        createdBy: user.uid,
      });
    }

      setStatus(`✓ ${sorted.length} 回分のデータをインポートしました`);
      setDone(true);
    } catch (err) {
      setStatus(`❌ エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  };

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

  return (
    <AuthGuard>
      <div className="space-y-6 max-w-xl">
        <h1 className="text-2xl font-bold gold-text">過去データ インポート</h1>

        {!isAdmin ? (
          <div className="card p-6 text-center text-gray-400">
            管理者のみアクセスできます
          </div>
        ) : done ? (
          <div className="card p-6 text-center space-y-3">
            <p className="text-lg" style={{ color: "var(--gold)" }}>{status}</p>
            <p className="text-sm text-gray-400">
              成績ページと履歴ページに反映されました
            </p>
            <a href="/" className="btn-gold inline-block mt-2">
              成績ページへ
            </a>
          </div>
        ) : (
          <>
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold gold-text">インポート内容の確認</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded" style={{ background: "rgba(26,58,42,0.6)" }}>
                  <div className="text-gray-400">対局セッション数</div>
                  <div className="text-xl font-bold gold-text">{importData.length} 回</div>
                </div>
                <div className="p-3 rounded" style={{ background: "rgba(26,58,42,0.6)" }}>
                  <div className="text-gray-400">総半荘数</div>
                  <div className="text-xl font-bold gold-text">{regularRoundCount} 半荘</div>
                </div>
              </div>

              {yakumanCount > 0 && (
                <div className="text-sm" style={{ color: "#fbbf24" }}>
                  🎊 役満祝儀データ: {yakumanCount} 件（半荘カウント外）
                </div>
              )}

              <div>
                <div className="text-sm text-gray-400 mb-2">
                  期間: {importData[0]?.date} 〜{" "}
                  {importData[importData.length - 1]?.date}
                </div>
              </div>

              {newNames.length > 0 && (
                <div
                  className="p-3 rounded text-sm"
                  style={{ background: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.3)" }}
                >
                  <div className="gold-text font-semibold mb-1">
                    新規登録するプレイヤー ({newNames.length}名)
                  </div>
                  <div>{newNames.join("、")}</div>
                </div>
              )}

              <div>
                <div className="text-sm text-gray-400 mb-1">登場プレイヤー一覧</div>
                <div className="text-sm">{allNamesInData.join("、")}</div>
              </div>
            </div>

            {importing && (
              <div className="card p-4 space-y-2">
                <div className="text-sm text-gray-300">{status}</div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: "rgba(26,58,42,0.8)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%`, background: "var(--gold)" }}
                  />
                </div>
                <div className="text-xs text-gray-400 text-right">{progress}%</div>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={importing}
              className="btn-gold w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? "インポート中..." : "インポート開始"}
            </button>

            <button
              onClick={async () => {
                if (!confirm("全ての対局データを削除しますか？この操作は取り消せません。")) return;
                setStatus("削除中...");
                const n = await deleteAllGames();
                setStatus(`✓ ${n} 件の対局データを削除しました`);
              }}
              disabled={importing}
              className="w-full py-2 text-sm text-red-400 border border-red-800 rounded disabled:opacity-50"
            >
              全データ削除（リセット用）
            </button>

            <p className="text-xs text-gray-500 text-center">
              ※ インポートは一度だけ実行してください。再実行する場合は先に全データ削除してください。
            </p>
          </>
        )}
      </div>
    </AuthGuard>
  );
}
