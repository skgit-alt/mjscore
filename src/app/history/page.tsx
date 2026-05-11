"use client";

import { useEffect, useState } from "react";
import { getPlayers, getGames, deleteGame } from "@/lib/firestore";
import { Player, Game } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import PointBadge from "@/components/PointBadge";

export default function HistoryPage() {
  const { isAdmin } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const load = async () => {
    const [p, g] = await Promise.all([getPlayers(), getGames()]);
    setPlayers(p);
    setGames(g);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const playerName = (id: string) =>
    players.find((p) => p.id === id)?.name ?? id;

  const handleDelete = async (id: string) => {
    if (!confirm("この記録を削除しますか？")) return;
    setDeletingId(id);
    await deleteGame(id);
    setGames((prev) => prev.filter((g) => g.id !== id));
    setDeletingId(null);
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold gold-text">対局履歴</h1>

      {games.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">
          まだ対局記録がありません
        </div>
      ) : (
        <div className="space-y-4">
          {games.map((game, gameIdx) => {
            const date = game.playedAt.toDate();
            const dateStr = date.toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });
            const sortedResults = [...game.results].sort(
              (a, b) => a.rank - b.rank
            );

            const isExpanded = expandedIds.has(game.id);
            const hasRounds = game.rounds && game.rounds.length > 0;

            return (
              <div key={game.id} className="card p-4">
                {/* 役満祝儀バッジ */}
                {game.rounds?.filter((r) => r.yakuman).map((r, ri) => {
                  const winner = r.results.find((x) => x.point > 0);
                  if (!winner) return null;
                  return (
                    <div
                      key={ri}
                      className="mb-2 px-3 py-1 rounded text-sm font-semibold inline-block"
                      style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.5)", color: "#fbbf24" }}
                    >
                      🎊 役満：{playerName(winner.playerId)}
                    </div>
                  );
                })}

                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-sm text-gray-400">{dateStr}</span>
                    <span className="ml-3 text-sm" style={{ color: "var(--gold)" }}>
                      第{games.length - gameIdx}回　{game.numPlayers}人戦　{game.numGames}半荘
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasRounds && (
                      <button
                        onClick={() => toggleExpand(game.id)}
                        className="btn-outline text-xs py-1 px-3"
                      >
                        {isExpanded ? "▲ 詳細を閉じる" : "▼ 半荘詳細"}
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(game.id)}
                        disabled={deletingId === game.id}
                        className="btn-danger"
                      >
                        {deletingId === game.id ? "削除中..." : "削除"}
                      </button>
                    )}
                  </div>
                </div>

                {/* 日次合計テーブル */}
                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>順位</th>
                        <th>プレイヤー</th>
                        <th>合計P</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedResults.map((r) => (
                        <tr key={r.playerId}>
                          <td><span className={`rank-${r.rank}`}>{r.rank}位</span></td>
                          <td className="font-semibold">{playerName(r.playerId)}</td>
                          <td><PointBadge point={r.point} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 半荘詳細（展開時） */}
                {isExpanded && game.rounds && (() => {
                  // プレイヤー列の順序：日次合計の順位順
                  const colPlayers = sortedResults.map((r) => r.playerId);
                  // 各プレイヤーの半荘合計
                  const roundTotals: Record<string, number> = {};
                  colPlayers.forEach((id) => (roundTotals[id] = 0));
                  game.rounds!.forEach((round) => {
                    round.results.forEach((r) => {
                      if (roundTotals[r.playerId] !== undefined) roundTotals[r.playerId] += r.point;
                    });
                  });

                  return (
                    <div className="mt-4">
                      <div
                        className="text-xs font-semibold mb-2 pb-1"
                        style={{ color: "var(--gold)", borderBottom: "1px solid rgba(201,162,39,0.3)" }}
                      >
                        各半荘の詳細
                      </div>
                      <div className="overflow-x-auto">
                        <table style={{ fontSize: "0.8rem" }}>
                          <thead>
                            <tr>
                              <th className="w-8">回</th>
                              {colPlayers.map((id) => (
                                <th key={id}>{playerName(id)}</th>
                              ))}
                              <th>場</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              let regularCount = 0;
                              return game.rounds!.map((round, ri) => {
                                if (round.yakuman) {
                                  return (
                                    <tr key={ri} style={{ background: "rgba(251,191,36,0.07)" }}>
                                      <td className="text-xs font-semibold" style={{ color: "#fbbf24" }}>役満<br/>祝儀</td>
                                      {colPlayers.map((id) => {
                                        const r = round.results.find((x) => x.playerId === id);
                                        if (!r) return <td key={id}>—</td>;
                                        return (
                                          <td key={id}>
                                            <PointBadge point={r.point} />
                                          </td>
                                        );
                                      })}
                                      <td className="text-xs" style={{ color: "#fbbf24" }}>+{round.ba}p</td>
                                    </tr>
                                  );
                                }
                                regularCount++;
                                return (
                                  <tr key={ri}>
                                    <td className="text-gray-400">{regularCount}</td>
                                    {colPlayers.map((id) => {
                                      const r = round.results.find((x) => x.playerId === id);
                                      if (!r) return <td key={id}>—</td>;
                                      return (
                                        <td key={id}>
                                          <div className="flex flex-col items-center gap-0.5">
                                            <span className="text-xs text-gray-300">{r.rank}位</span>
                                            <PointBadge point={r.point} />
                                            {r.tobi && (
                                              <span className="text-xs font-bold" style={{ color: "#f87171" }}>飛び</span>
                                            )}
                                          </div>
                                        </td>
                                      );
                                    })}
                                    <td className="positive text-xs">+{round.ba}p</td>
                                  </tr>
                                );
                              });
                            })()}
                            {/* 合計行 */}
                            <tr style={{ background: "rgba(26,58,42,0.7)", borderTop: "1px solid rgba(201,162,39,0.3)" }}>
                              <td className="font-semibold gold-text text-xs">合計</td>
                              {colPlayers.map((id) => (
                                <td key={id}><PointBadge point={roundTotals[id]} /></td>
                              ))}
                              <td></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
