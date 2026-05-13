"use client";

import { useEffect, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
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

const PX_PER_POINT = 22;
const Y_AXIS_WIDTH = 58;

export default function PlayerChart({ players, games }: PlayerChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [games.length]);

  useEffect(() => {
    const el = scrollRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  const minChartWidth = Math.max(containerWidth - 110, 300);
  const chartWidth = Math.max(minChartWidth, data.length * PX_PER_POINT + Y_AXIS_WIDTH);
  const chartHeight = containerWidth < 500 ? 320 : 420;

  // 凡例：通算ポイント降順
  const sortedPlayers = [...players].sort((a, b) =>
    (cumulative[b.id] ?? 0) - (cumulative[a.id] ?? 0)
  );

  return (
    <div className="card p-4">
      <h2 className="text-lg font-bold mb-3 gold-text">通算ポイント推移</h2>

      {/* 凡例（上部・横並び） */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3 px-1">
        {sortedPlayers.map((p) => {
          const colorIdx = players.findIndex((pl) => pl.id === p.id);
          const color = COLORS[colorIdx % COLORS.length];
          const pt = cumulative[p.id] ?? 0;
          return (
            <div key={p.id} className="flex items-center gap-1.5">
              <span
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color, fontSize: "0.875rem", fontWeight: 700 }}>{p.name}</span>
              <span
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: pt >= 0 ? "#5fd48a" : "#f87171",
                }}
              >
                {pt > 0 ? "+" : ""}{pt}p
              </span>
            </div>
          );
        })}
      </div>

      {/* グラフ（横スクロール） */}
      <div ref={scrollRef} style={{ overflowX: "auto", overflowY: "hidden" }}>
        <LineChart
          width={chartWidth}
          height={chartHeight}
          data={data}
          margin={{ top: 8, right: 24, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,162,39,0.15)" />
          <XAxis
            dataKey="name"
            stroke="#a0a0a0"
            tick={{ fill: "#a0a0a0", fontSize: 12 }}
            interval={Math.floor(data.length / 20)}
          />
          <YAxis
            stroke="#a0a0a0"
            tick={{ fill: "#a0a0a0", fontSize: 13 }}
            width={Y_AXIS_WIDTH}
          />
          <ReferenceLine y={0} stroke="rgba(201,162,39,0.5)" strokeDasharray="4 4" />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(13, 32, 24, 0.97)",
              border: "1px solid rgba(201,162,39,0.45)",
              borderRadius: "8px",
              fontSize: "0.875rem",
              padding: "8px 12px",
            }}
            labelStyle={{ color: "#c9a227", fontWeight: 700, marginBottom: "4px" }}
            labelFormatter={(label, payload) => {
              const date = (payload?.[0]?.payload as Record<string, string>)?.date ?? "";
              return `第${label}回　${date}`;
            }}
            formatter={(value, name, props) => {
              const nameStr = String(name ?? "");
              const player = players.find((p) => p.id === nameStr);
              const delta = (props.payload as Record<string, number>)[`${nameStr}_delta`];
              const v = delta !== undefined ? delta : Number(value);
              const total = Number(value);
              return [
                `${v > 0 ? "+" : ""}${v}p　(累計: ${total > 0 ? "+" : ""}${total}p)`,
                player?.name ?? nameStr,
              ];
            }}
          />
          {players.map((p, i) => (
            <Line
              key={p.id}
              type="monotone"
              dataKey={p.id}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          ))}
        </LineChart>
      </div>

      <p className="text-xs text-right text-gray-500 mt-1 pr-1">← 左右スクロール可　回数 →</p>
    </div>
  );
}
