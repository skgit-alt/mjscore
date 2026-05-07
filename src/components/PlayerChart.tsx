"use client";

import { useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Player, Game } from "@/lib/types";

interface PlayerChartProps {
  players: Player[];
  games: Game[];
}

const COLORS = [
  "#fbbf24", "#60a5fa", "#f87171", "#34d399",
  "#a78bfa", "#fb923c", "#f472b6", "#2dd4bf",
  "#facc15", "#818cf8", "#4ade80", "#e879f9",
];

const PX_PER_POINT = 19;
const Y_AXIS_WIDTH = 55;

export default function PlayerChart({ players, games }: PlayerChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [games.length]);

  if (games.length === 0) {
    return (
      <div className="card p-8 text-center text-gray-400">
        記録がまだありません
      </div>
    );
  }

  const sortedGames = [...games].reverse();

  const data: Record<string, number | string>[] = [];
  const cumulative: Record<string, number> = {};
  players.forEach((p) => (cumulative[p.id] = 0));

  sortedGames.forEach((game, idx) => {
    const d = game.playedAt.toDate();
    const row: Record<string, number | string> = {
      name: String(idx + 1),
      date: `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`,
    };
    game.results.forEach((r) => {
      if (cumulative[r.playerId] !== undefined) {
        cumulative[r.playerId] += r.point;
        row[r.playerId] = cumulative[r.playerId];
        row[`${r.playerId}_delta`] = r.point;
      }
    });
    data.push(row);
  });

  const chartWidth = Math.max(600, data.length * PX_PER_POINT + Y_AXIS_WIDTH);

  // 凡例：通算ポイント降順
  const sortedPlayers = [...players].sort((a, b) =>
    (cumulative[b.id] ?? 0) - (cumulative[a.id] ?? 0)
  );

  return (
    <div className="card p-4">
      <h2 className="text-lg font-semibold mb-2 gold-text">通算ポイント推移</h2>
      <div className="flex gap-3">
        {/* スクロール可能なグラフエリア */}
        <div ref={scrollRef} style={{ overflowX: "auto", overflowY: "hidden", flex: 1 }}>
          <LineChart
            width={chartWidth}
            height={520}
            data={data}
            margin={{ top: 5, right: 24, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,162,39,0.15)" />
            <XAxis
              dataKey="name"
              stroke="#a0a0a0"
              tick={{ fill: "#a0a0a0", fontSize: 11 }}
              interval={0}
            />
            <YAxis
              stroke="#a0a0a0"
              tick={{ fill: "#a0a0a0", fontSize: 12 }}
              width={Y_AXIS_WIDTH}
            />
            <ReferenceLine y={0} stroke="rgba(201,162,39,0.4)" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a3a2a",
                border: "1px solid rgba(201,162,39,0.4)",
                borderRadius: "6px",
              }}
              labelStyle={{ color: "#c9a227", fontWeight: 600 }}
              labelFormatter={(label, payload) => {
                const date = (payload?.[0]?.payload as Record<string, string>)?.date ?? "";
                return `第${label}回　${date}`;
              }}
              formatter={(value, name, props) => {
                const nameStr = String(name ?? "");
                const player = players.find((p) => p.id === nameStr);
                const delta = (props.payload as Record<string, number>)[`${nameStr}_delta`];
                const v = delta !== undefined ? delta : Number(value);
                return [`${v > 0 ? "+" : ""}${v}p`, player?.name ?? nameStr];
              }}
            />
            {players.map((p, i) => (
              <Line
                key={p.id}
                type="monotone"
                dataKey={p.id}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </div>

        {/* 右側の凡例（通算ポイント降順） */}
        <div className="flex flex-col justify-center gap-5 py-4 shrink-0" style={{ minWidth: "80px" }}>
          {sortedPlayers.map((p, i) => {
            const colorIdx = players.findIndex((pl) => pl.id === p.id);
            const color = COLORS[colorIdx % COLORS.length];
            const pt = cumulative[p.id] ?? 0;
            return (
              <div key={p.id} className="flex items-center gap-1.5">
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: color,
                    flexShrink: 0,
                  }}
                />
                <div className="flex flex-col leading-tight">
                  <span style={{ color, fontSize: "0.75rem", fontWeight: 600 }}>{p.name}</span>
                  <span style={{ fontSize: "0.65rem", color: pt >= 0 ? "#34d399" : "#f87171" }}>
                    {pt > 0 ? "+" : ""}{pt}p
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-right text-gray-500 mt-1 pr-1">回数</p>
    </div>
  );
}
