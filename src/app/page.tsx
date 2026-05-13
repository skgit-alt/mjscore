"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPlayers, getGames } from "@/lib/firestore";
import { Player, Game, PlayerStats } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import PlayerChart from "@/components/PlayerChart";
import PointBadge from "@/components/PointBadge";

function buildStats(players: Player[], games: Game[]): PlayerStats[] {
  return players.map((player) => {
    const playerGames = games.filter((g) =>
      g.results.some((r) => r.playerId === player.id)
    );

    if (playerGames.length === 0) {
      return {
        playerId: player.id,
        name: player.name,
        totalPoint: 0,
        gameCount: 0,
        avgRank: 0,
        firstRate: 0,
        secondRate: 0,
        thirdRate: 0,
        fourthRate: 0,
        tobiRate: 0,
        pointHistory: [],
      };
    }

    const totalPoint = playerGames.reduce((s, g) => {
      const r = g.results.find((r) => r.playerId === player.id)!;
      return s + r.point;
    }, 0);

    let gameCount = 0;
    let rankSum = 0;
    let rc1 = 0, rc2 = 0, rc3 = 0, rc4 = 0, tobiCount = 0;

    playerGames.forEach((g) => {
      const r = g.results.find((r) => r.playerId === player.id)!;
      if (r.rankCounts) {
        const c = r.rankCounts;
        const rounds = (c[1] ?? 0) + (c[2] ?? 0) + (c[3] ?? 0) + (c[4] ?? 0);
        gameCount += rounds;
        rc1 += c[1] ?? 0;
        rc2 += c[2] ?? 0;
        rc3 += c[3] ?? 0;
        rc4 += c[4] ?? 0;
        tobiCount += r.tobiCount ?? 0;
        rankSum += (c[1] ?? 0) * 1 + (c[2] ?? 0) * 2 + (c[3] ?? 0) * 3 + (c[4] ?? 0) * 4;
      } else {
        // 旧データ：セッション単位でカウント
        gameCount += 1;
        rankSum += r.rank;
        if (r.rank === 1) rc1++;
        else if (r.rank === 2) rc2++;
        else if (r.rank === 3) rc3++;
        else if (r.rank === 4) rc4++;
      }
    });

    const pct = (n: number) => Math.round((n / gameCount) * 1000) / 10;

    const sortedGames = [...games].reverse();
    let cum = 0;
    const pointHistory = sortedGames.map((g) => {
      const r = g.results.find((r) => r.playerId === player.id);
      if (r) cum += r.point;
      return cum;
    });

    return {
      playerId: player.id,
      name: player.name,
      totalPoint,
      gameCount,
      avgRank: Math.round((rankSum / gameCount) * 100) / 100,
      firstRate: pct(rc1),
      secondRate: pct(rc2),
      thirdRate: pct(rc3),
      fourthRate: pct(rc4),
      tobiRate: pct(tobiCount),
      pointHistory,
    };
  });
}

export default function HomePage() {
  const { isAdmin } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPlayers(), getGames()]).then(([p, g]) => {
      setPlayers(p);
      setGames(g);
      setLoading(false);
    });
  }, []);

  const stats = buildStats(players, games).sort(
    (a, b) => b.totalPoint - a.totalPoint
  );

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gold-text">通算成績</h1>
          {games.length > 0 && (() => {
            const dates = games.map((g) => g.playedAt.toDate());
            const fmt = (d: Date) => `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;
            const oldest = new Date(Math.min(...dates.map((d) => d.getTime())));
            const newest = new Date(Math.max(...dates.map((d) => d.getTime())));
            return (
              <p className="text-sm text-gray-400 mt-1">{fmt(oldest)} 〜 {fmt(newest)}　全{games.length}回</p>
            );
          })()}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>順位</th>
              <th>プレイヤー</th>
              <th>通算P</th>
              <th>平均順位</th>
              <th>1位率</th>
              <th className="hidden sm:table-cell">2位率</th>
              <th className="hidden sm:table-cell">3位率</th>
              <th className="hidden sm:table-cell">4位率</th>
              <th className="hidden sm:table-cell">飛び率</th>
              <th className="hidden sm:table-cell">半荘数</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => {
              const no = s.gameCount === 0;
              const f = (rate: number) => {
                const count = Math.round(rate * s.gameCount / 100);
                return (
                  <div className="flex flex-col items-center leading-tight">
                    <span>{rate}%</span>
                    <span className="text-xs text-gray-400">{count}回</span>
                  </div>
                );
              };
              return (
                <tr key={s.playerId}>
                  <td>
                    <span className={`rank-${i + 1}`}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </span>
                  </td>
                  <td className="font-semibold">{s.name}</td>
                  <td><PointBadge point={s.totalPoint} /></td>
                  <td>{no ? "—" : s.avgRank.toFixed(2)}</td>
                  <td className="rank-1">{no ? "—" : f(s.firstRate)}</td>
                  <td className="hidden sm:table-cell rank-2">{no ? "—" : f(s.secondRate)}</td>
                  <td className="hidden sm:table-cell rank-3">{no ? "—" : f(s.thirdRate)}</td>
                  <td className="hidden sm:table-cell rank-4">{no ? "—" : f(s.fourthRate)}</td>
                  <td className="hidden sm:table-cell negative">{no ? "—" : f(s.tobiRate)}</td>
                  <td className="hidden sm:table-cell">{s.gameCount}</td>
                </tr>
              );
            })}
            {stats.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-gray-400">
                  プレイヤーが登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PlayerChart players={players} games={games} />

      {games.length > 0 && (
        <p className="text-center text-sm text-gray-400">
          総対局回数：{games.length} 回
        </p>
      )}
    </div>
  );
}
