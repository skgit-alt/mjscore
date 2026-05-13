"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import { getPlayers, getSettings, addGame, addPlayer } from "@/lib/firestore";
import { Player, Settings, DEFAULT_SETTINGS } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { calcAllRanks, CalcResult, UMA5 } from "@/lib/calculate";

interface RoundRow {
  id: number;
  scores: Record<string, string>;
  ba: number;
  firstPlayerId: string | null;
  isConfirmed: boolean;
  rankOverrides: Record<string, number>;
  absentId: string | null;
  roundMode: "5" | "4";
  tobiKillerIds: Record<string, string>;
}

interface HiruRow {
  points: Record<string, string>;
  firstPlayerId: string | null;
  isConfirmed: boolean;
}

interface YakumanRow {
  id: number;
  winnerId: string | null;
  bonusPerPlayer: number;
  isConfirmed: boolean;
}

function calcRow(
  row: RoundRow,
  playerIds: string[],
  settings: Settings,
  numSelected: number
): CalcResult[] | null {
  const activeIds =
    numSelected === 5 && row.roundMode === "4" && row.absentId
      ? playerIds.filter((id) => id !== row.absentId)
      : playerIds;
  const np = activeIds.length as 3 | 4 | 5;

  if (!row.firstPlayerId) return null;
  if (!activeIds.includes(row.firstPlayerId)) return null;

  const otherIds = activeIds.filter((id) => id !== row.firstPlayerId);
  const filledIds = otherIds.filter(
    (id) => row.scores[id] != null && row.scores[id] !== ""
  );
  if (filledIds.length < np - 1) return null;

  const rawScores: Record<string, number> = {};
  filledIds.forEach((id) => { rawScores[id] = Number(row.scores[id]); });
  const scoreGroups: Record<number, string[]> = {};
  filledIds.forEach((id) => {
    const s = rawScores[id];
    if (!scoreGroups[s]) scoreGroups[s] = [];
    scoreGroups[s].push(id);
  });
  const hasUnresolved = Object.values(scoreGroups).some((group) =>
    group.length > 1 && !group.every((id) => (row.rankOverrides ?? {})[id] !== undefined)
  );
  if (hasUnresolved) return null;

  const scoreMap: Record<string, number> = {};
  filledIds.forEach((id) => { scoreMap[id] = Number(row.scores[id]) * 100; });

  const total = settings.kaeshine * np - settings.oka * 1000 - row.ba * 1000;
  const sumOthers = filledIds.reduce((s, id) => s + scoreMap[id], 0);
  scoreMap[row.firstPlayerId] = total - sumOthers;

  return calcAllRanks(
    scoreMap,
    row.ba,
    settings,
    np,
    activeIds,
    row.firstPlayerId ?? undefined,
    row.rankOverrides ?? {},
    row.tobiKillerIds ?? {}
  );
}

function calcHiru(
  hiru: HiruRow,
  playerIds: string[]
): { playerId: string; point: number; rank: number }[] | null {
  if (!hiru.firstPlayerId) return null;
  const otherIds = playerIds.filter((id) => id !== hiru.firstPlayerId);
  const filled = otherIds.filter((id) => hiru.points[id] != null && hiru.points[id] !== "");
  if (filled.length < playerIds.length - 1) return null;

  const pointMap: Record<string, number> = {};
  filled.forEach((id) => { pointMap[id] = -Math.abs(Number(hiru.points[id])); });
  const sumOthers = filled.reduce((s, id) => s + pointMap[id], 0);
  pointMap[hiru.firstPlayerId] = -sumOthers;

  const sorted = Object.entries(pointMap).sort((a, b) => b[1] - a[1]);
  return sorted.map(([playerId, point], idx) => ({ playerId, point, rank: idx + 1 }));
}

function calcYakumanResults(
  yaku: YakumanRow,
  playerIds: string[]
): { playerId: string; point: number }[] | null {
  if (!yaku.winnerId || !playerIds.includes(yaku.winnerId)) return null;
  return playerIds.map((id) => ({
    playerId: id,
    point:
      id === yaku.winnerId
        ? (playerIds.length - 1) * yaku.bonusPerPlayer
        : -yaku.bonusPerPlayer,
  }));
}

function getUmaLabel(rank: number, numPlayers: 3 | 4 | 5, settings: Settings): string {
  const uma =
    numPlayers === 5 ? UMA5 : numPlayers === 4 ? settings.uma4 : settings.uma3;
  const val = (uma as Record<number, number>)[rank] ?? 0;
  return val > 0 ? `+${val}p` : `${val}p`;
}

const STORAGE_KEY = "mjscore_input";

function todayStr() {
  return new Date().toLocaleDateString("sv");
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as {
      selectedIds: string[];
      confirmed: boolean;
      rows: RoundRow[];
      playedAt?: string;
      hiruRow?: HiruRow;
      yakumanRows?: YakumanRow[];
    };
  } catch { return null; }
}

function saveDraft(
  selectedIds: string[],
  confirmed: boolean,
  rows: RoundRow[],
  playedAt: string,
  hiruRow: HiruRow | null,
  yakumanRows: YakumanRow[]
) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ selectedIds, confirmed, rows, playedAt, hiruRow, yakumanRows })
  );
}

function clearDraft() {
  localStorage.removeItem(STORAGE_KEY);
}

function PointDisplay({ point, size = "lg" }: { point: number; size?: "lg" | "sm" }) {
  const cls = point > 0 ? "positive" : point < 0 ? "negative" : "text-gray-400";
  const prefix = point > 0 ? "+" : "";
  const textSize = size === "lg" ? "text-xl font-bold" : "text-base font-semibold";
  return <span className={`${textSize} ${cls}`}>{prefix}{point}p</span>;
}

function RankBadge({ rank }: { rank: number }) {
  return <span className={`rank-${rank} font-bold text-base`}>{rank}位</span>;
}

export default function InputPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [rows, setRows] = useState<RoundRow[]>([]);
  const [hiruRow, setHiruRow] = useState<HiruRow | null>(null);
  const [yakumanRows, setYakumanRows] = useState<YakumanRow[]>([]);
  const [playedAt, setPlayedAt] = useState<string>(todayStr());
  const [saving, setSaving] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    Promise.all([getPlayers(), getSettings()]).then(([p, s]) => {
      setAllPlayers(p);
      setSettings(s);
      const draft = loadDraft();
      if (draft) {
        setSelectedIds(draft.selectedIds);
        setConfirmed(draft.confirmed);
        setRows(draft.rows.map((r) => ({ ...r, absentId: r.absentId ?? null, roundMode: r.roundMode ?? "5", tobiKillerIds: r.tobiKillerIds ?? {} })));
        if (draft.playedAt) setPlayedAt(draft.playedAt);
        if (draft.hiruRow) setHiruRow(draft.hiruRow);
        if (draft.yakumanRows) setYakumanRows(draft.yakumanRows);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedIds.length > 0 || rows.length > 0) {
      saveDraft(selectedIds, confirmed, rows, playedAt, hiruRow, yakumanRows);
      setLastSaved(new Date());
    }
  }, [selectedIds, confirmed, rows, playedAt, hiruRow, yakumanRows]);

  const numSelected = selectedIds.length;
  const activePlayers = allPlayers.filter((p) => selectedIds.includes(p.id));
  const activePlayerIds = activePlayers.map((p) => p.id);

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAddPlayer = async () => {
    const name = newPlayerName.trim();
    if (!name) return;
    setAddingPlayer(true);
    try {
      const id = await addPlayer(name, allPlayers.length);
      const updated = await getPlayers();
      setAllPlayers(updated);
      setSelectedIds((prev) => prev.length < 5 ? [...prev, id] : prev);
      setNewPlayerName("");
    } finally {
      setAddingPlayer(false);
    }
  };

  const handleConfirm = () => {
    setRows([{
      id: 1,
      scores: {},
      ba: settings.defaultBa,
      firstPlayerId: null,
      isConfirmed: false,
      rankOverrides: {},
      absentId: null,
      roundMode: "5",
      tobiKillerIds: {},
    }]);
    setConfirmed(true);
  };

  const addRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        scores: {},
        ba: settings.defaultBa,
        firstPlayerId: null,
        isConfirmed: false,
        rankOverrides: {},
        absentId: null,
        roundMode: "5",
        tobiKillerIds: {},
      },
    ]);
  }, [settings.defaultBa]);

  const removeRow = useCallback((id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // --- Yakuman callbacks ---
  const addYakumanRow = useCallback(() => {
    setYakumanRows((prev) => [
      ...prev,
      { id: Date.now(), winnerId: null, bonusPerPlayer: 10, isConfirmed: false },
    ]);
  }, []);

  const removeYakumanRow = useCallback((id: number) => {
    setYakumanRows((prev) => prev.filter((y) => y.id !== id));
  }, []);

  const updateYakumanWinner = useCallback((id: number, winnerId: string) => {
    setYakumanRows((prev) =>
      prev.map((y) => (y.id === id ? { ...y, winnerId } : y))
    );
  }, []);

  const updateYakumanBonus = useCallback((id: number, bonusPerPlayer: number) => {
    setYakumanRows((prev) =>
      prev.map((y) => (y.id === id ? { ...y, bonusPerPlayer } : y))
    );
  }, []);

  const confirmYakumanRow = useCallback((id: number) => {
    setYakumanRows((prev) =>
      prev.map((y) => (y.id === id ? { ...y, isConfirmed: true } : y))
    );
  }, []);

  const unconfirmYakumanRow = useCallback((id: number) => {
    setYakumanRows((prev) =>
      prev.map((y) => (y.id === id ? { ...y, isConfirmed: false } : y))
    );
  }, []);

  // --- Score callbacks ---
  const updateScore = useCallback((rowId: number, playerId: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const newOverrides = { ...(r.rankOverrides ?? {}) };
        delete newOverrides[playerId];
        const newKillers = { ...r.tobiKillerIds };
        if (value === "" || value == null || Number(value) >= 0) {
          delete newKillers[playerId];
        }
        return { ...r, scores: { ...r.scores, [playerId]: value }, rankOverrides: newOverrides, tobiKillerIds: newKillers };
      })
    );
  }, []);

  const updateBa = useCallback((rowId: number, value: number) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ba: value } : r)));
  }, []);

  const updateFirst = useCallback((rowId: number, playerId: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, firstPlayerId: playerId, rankOverrides: {} } : r))
    );
  }, []);

  const updateAbsent = useCallback((rowId: number, absentId: string | null) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const newFirst = absentId === r.firstPlayerId ? null : r.firstPlayerId;
        return { ...r, absentId, firstPlayerId: newFirst, rankOverrides: {}, scores: {}, tobiKillerIds: {} };
      })
    );
  }, []);

  const updateRoundMode = useCallback((rowId: number, mode: "5" | "4") => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        return { ...r, roundMode: mode, absentId: mode === "5" ? null : r.absentId, rankOverrides: {}, scores: {}, tobiKillerIds: {} };
      })
    );
  }, []);

  const confirmRow = useCallback((rowId: number) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, isConfirmed: true } : r)));
  }, []);

  const unconfirmRow = useCallback((rowId: number) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, isConfirmed: false } : r)));
  }, []);

  const updateTobiKiller = useCallback((rowId: number, tobiId: string, killerId: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const newKillers = { ...r.tobiKillerIds };
        if (newKillers[tobiId] === killerId) {
          delete newKillers[tobiId];
        } else {
          newKillers[tobiId] = killerId;
        }
        return { ...r, tobiKillerIds: newKillers };
      })
    );
  }, []);

  const setTieBreak = useCallback((rowId: number, overrides: Record<string, number>) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, rankOverrides: { ...(r.rankOverrides ?? {}), ...overrides } } : r
      )
    );
  }, []);

  // --- Totals (regular + yakuman) ---
  const totals: Record<string, number> = {};
  activePlayerIds.forEach((id) => (totals[id] = 0));
  rows.forEach((row) => {
    const results = calcRow(row, activePlayerIds, settings, numSelected);
    if (results) {
      results.forEach((r) => {
        if (totals[r.playerId] !== undefined) totals[r.playerId] += r.point;
      });
    }
  });
  yakumanRows.forEach((yaku) => {
    const results = calcYakumanResults(yaku, activePlayerIds);
    if (results) {
      results.forEach((r) => {
        if (totals[r.playerId] !== undefined) totals[r.playerId] += r.point;
      });
    }
  });

  const hiruResults = hiruRow ? calcHiru(hiruRow, activePlayerIds) : null;

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const totalPoints: Record<string, number> = {};
      const rankCounts: Record<string, Record<number, number>> = {};
      const tobiCounts: Record<string, number> = {};
      activePlayerIds.forEach((id) => {
        totalPoints[id] = 0;
        rankCounts[id] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        tobiCounts[id] = 0;
      });
      let validRowCount = 0;
      let totalBa = 0;
      const roundDetails: {
        ba: number;
        yakuman?: boolean;
        results: { playerId: string; score: number | null; point: number; rank: number; tobi?: boolean }[];
      }[] = [];

      // Regular rounds
      rows.forEach((row) => {
        const results = calcRow(row, activePlayerIds, settings, numSelected);
        if (!results) return;
        validRowCount++;
        totalBa += row.ba;
        results.forEach((r) => {
          totalPoints[r.playerId] += r.point;
          rankCounts[r.playerId][r.rank] = (rankCounts[r.playerId][r.rank] ?? 0) + 1;
          if (r.tobi) tobiCounts[r.playerId]++;
        });
        roundDetails.push({
          ba: row.ba,
          results: results.map((r) => ({
            playerId: r.playerId,
            score: r.score,
            point: r.point,
            rank: r.rank,
            ...(r.tobi ? { tobi: true } : {}),
          })),
        });
      });

      // Yakuman rounds
      yakumanRows.forEach((yaku) => {
        if (!yaku.isConfirmed || !yaku.winnerId) return;
        const results = calcYakumanResults(yaku, activePlayerIds);
        if (!results) return;
        results.forEach((r) => {
          totalPoints[r.playerId] += r.point;
        });
        roundDetails.push({
          ba: yaku.bonusPerPlayer,
          yakuman: true,
          results: results.map((r) => ({
            playerId: r.playerId,
            score: null,
            point: r.point,
            rank: r.playerId === yaku.winnerId ? 1 : 2,
          })),
        });
      });

      if (validRowCount === 0) return;

      const sorted = [...activePlayerIds].sort((a, b) => totalPoints[b] - totalPoints[a]);
      const dailyResults = sorted.map((playerId, idx) => ({
        playerId,
        score: null,
        point: totalPoints[playerId],
        rank: idx + 1,
        rankCounts: rankCounts[playerId] as { 1?: number; 2?: number; 3?: number; 4?: number; 5?: number },
        tobiCount: tobiCounts[playerId],
      }));

      await addGame({
        playedAt: Timestamp.fromDate(new Date(playedAt + "T00:00:00")),
        numPlayers: numSelected as 3 | 4 | 5,
        ba: totalBa,
        numGames: validRowCount,
        results: dailyResults,
        rounds: roundDetails,
        createdBy: user.uid,
      });

      clearDraft();
      router.push("/history");
    } finally {
      setSaving(false);
    }
  };

  const canSave = rows.some((row) => calcRow(row, activePlayerIds, settings, numSelected) !== null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold gold-text">半荘入力</h1>

      {/* ステップ1：メンバー選択 */}
      {!confirmed ? (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-5 items-start">

          {/* 左列：プレイヤー一覧 */}
          <div className="card p-5 space-y-4">
            <h2 className="text-lg font-semibold gold-text">今日のメンバーを選択</h2>
            <p className="text-sm text-gray-400">3〜5人選んでください</p>

            <div className="space-y-2">
              {allPlayers.map((p) => {
                const selected = selectedIds.includes(p.id);
                const disabled = !selected && selectedIds.length >= 5;
                return (
                  <button
                    key={p.id}
                    onClick={() => !disabled && togglePlayer(p.id)}
                    disabled={disabled}
                    className="w-full text-left px-4 py-3 rounded transition-all"
                    style={{
                      background: selected ? "rgba(201,162,39,0.2)" : "rgba(26,58,42,0.6)",
                      border: selected ? "1px solid var(--gold)" : "1px solid rgba(201,162,39,0.2)",
                      color: disabled ? "#555" : "#f0ead6",
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    <span className="mr-2">{selected ? "✓" : "　"}</span>
                    {p.name}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddPlayer(); }}
                placeholder="新しいメンバーを追加..."
                className="flex-1 text-sm py-1.5"
              />
              <button
                onClick={handleAddPlayer}
                disabled={!newPlayerName.trim() || addingPlayer}
                className="btn-outline text-sm py-1 px-3 disabled:opacity-40"
              >
                {addingPlayer ? "追加中..." : "追加"}
              </button>
            </div>

            {/* モバイルのみ：下部にボタン */}
            <div className="md:hidden flex items-center justify-between pt-2 border-t" style={{ borderColor: "rgba(201,162,39,0.15)" }}>
              <span className="text-sm text-gray-400">
                {numSelected >= 3
                  ? <span style={{ color: "var(--gold)", fontWeight: 600 }}>{numSelected}人戦</span>
                  : `${numSelected}人選択中`}
              </span>
              <button
                onClick={handleConfirm}
                disabled={numSelected < 3}
                className="btn-gold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {numSelected >= 3 ? `この${numSelected}人で決定` : "3人以上選択してください"}
              </button>
            </div>
          </div>

          {/* 右列（デスクトップのみ）：選択中メンバー + 決定ボタン（sticky固定） */}
          <div className="hidden md:block sticky top-16 self-start">
            <div className="card p-5 space-y-4">
              <h3 className="font-semibold gold-text">選択中のメンバー</h3>

              {numSelected === 0 ? (
                <p className="text-sm text-gray-500 py-3 text-center">← 左からメンバーを選択</p>
              ) : (
                <div className="space-y-0.5">
                  {activePlayers.map((p, i) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between py-2"
                      style={{ borderBottom: "1px solid rgba(201,162,39,0.12)" }}
                    >
                      <span className="font-semibold">
                        <span className="text-gray-400 text-sm mr-2">{i + 1}.</span>
                        {p.name}
                      </span>
                      <button
                        onClick={() => togglePlayer(p.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors px-2 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">対局日</span>
                <input
                  type="date"
                  value={playedAt}
                  onChange={(e) => setPlayedAt(e.target.value)}
                />
              </label>

              <button
                onClick={handleConfirm}
                disabled={numSelected < 3}
                className="btn-gold w-full disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ fontSize: "1rem" }}
              >
                {numSelected >= 3
                  ? `この${numSelected}人で決定 →`
                  : numSelected === 0
                  ? "メンバーを選択してください"
                  : `あと${3 - numSelected}人選択してください`}
              </button>
              {numSelected >= 3 && (
                <p className="text-xs text-center text-gray-500">{numSelected}人戦</p>
              )}
            </div>
          </div>

        </div>
      ) : (
        <>
          {/* メンバー確認バー */}
          <div
            className="flex items-center justify-between px-4 py-2 rounded gap-3"
            style={{ background: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.3)" }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="date"
                value={playedAt}
                onChange={(e) => setPlayedAt(e.target.value)}
                className="text-sm py-0.5"
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid rgba(201,162,39,0.5)",
                  borderRadius: 0,
                  padding: "0 2px",
                }}
              />
              <span className="text-sm">
                <span className="gold-text font-semibold">{numSelected}人戦：</span>
                {activePlayers.map((p) => p.name).join("　")}
              </span>
            </div>
            <button
              onClick={() => { setConfirmed(false); setRows([]); setYakumanRows([]); clearDraft(); }}
              className="text-xs btn-outline py-1 px-2 shrink-0"
            >
              変更
            </button>
          </div>

          <div
            className="card"
            style={{
              maxHeight: "calc(100vh - 230px)",
              minHeight: "300px",
              overflow: "auto",
            }}
          >
            <table>
              <thead className="sticky-thead">
                <tr>
                  <th className="w-10">回</th>
                  {activePlayers.map((p) => (
                    <th key={p.id} className="min-w-[110px]">{p.name}</th>
                  ))}
                  <th className="min-w-[70px]">場</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => {
                  const rowActiveIds =
                    numSelected === 5 && row.roundMode === "4" && row.absentId
                      ? activePlayerIds.filter((id) => id !== row.absentId)
                      : activePlayerIds;
                  const rowNp = rowActiveIds.length as 3 | 4 | 5;
                  const results = calcRow(row, activePlayerIds, settings, numSelected);
                  const rowReady = results !== null;

                  const nonFirstFilled = rowActiveIds.filter(
                    (id) => id !== row.firstPlayerId && row.scores[id] != null && row.scores[id] !== ""
                  );
                  const rawScoreMap: Record<string, number> = {};
                  nonFirstFilled.forEach((id) => { rawScoreMap[id] = Number(row.scores[id]); });
                  const tiedGroupMap: Record<string, { group: string[]; availableRanks: number[] }> = {};
                  const visited = new Set<string>();
                  nonFirstFilled.forEach((id) => {
                    if (visited.has(id)) return;
                    const s = rawScoreMap[id];
                    const group = nonFirstFilled.filter((x) => rawScoreMap[x] === s);
                    if (group.length < 2) return;
                    const higherCount = nonFirstFilled.filter((x) => rawScoreMap[x] > s).length;
                    const startRank = 2 + higherCount;
                    const availableRanks = group.map((_, i) => startRank + i);
                    group.forEach((gid) => {
                      tiedGroupMap[gid] = { group, availableRanks };
                      visited.add(gid);
                    });
                  });
                  const hasTie = Object.keys(tiedGroupMap).length > 0;

                  return (
                    <tr key={row.id}>
                      <td className="text-center align-top pt-2">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm text-gray-400">{rowIdx + 1}</span>
                          {numSelected === 5 && (
                            <div className="flex flex-col gap-0.5 items-center">
                              <button
                                onClick={() => !row.isConfirmed && updateRoundMode(row.id, "5")}
                                disabled={row.isConfirmed}
                                style={{
                                  background: row.roundMode !== "4" ? "var(--gold)" : "transparent",
                                  color: row.roundMode !== "4" ? "#1a1a1a" : "#666",
                                  border: "1px solid rgba(201,162,39,0.6)",
                                  fontSize: "0.7rem",
                                  padding: "2px 5px",
                                  borderRadius: "3px",
                                  cursor: row.isConfirmed ? "default" : "pointer",
                                  fontWeight: row.roundMode !== "4" ? 700 : 400,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                ①5人
                              </button>
                              <button
                                onClick={() => !row.isConfirmed && updateRoundMode(row.id, "4")}
                                disabled={row.isConfirmed}
                                style={{
                                  background: row.roundMode === "4" ? "var(--gold)" : "transparent",
                                  color: row.roundMode === "4" ? "#1a1a1a" : "#666",
                                  border: "1px solid rgba(201,162,39,0.6)",
                                  fontSize: "0.7rem",
                                  padding: "2px 5px",
                                  borderRadius: "3px",
                                  cursor: row.isConfirmed ? "default" : "pointer",
                                  fontWeight: row.roundMode === "4" ? 700 : 400,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                ②1抜
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {activePlayers.map((p) => {
                        const isFirst = row.firstPlayerId === p.id;
                        const isAbsent = row.absentId === p.id;
                        const result = results?.find((r) => r.playerId === p.id);

                        if (isAbsent && row.roundMode === "4") {
                          return (
                            <td key={p.id} className="p-2">
                              <div
                                className="flex flex-col items-center gap-1 rounded py-2 px-1"
                                style={{ background: "rgba(0,0,0,0.25)", opacity: 0.65 }}
                              >
                                <span className="text-xs text-gray-500">この回</span>
                                <span className="text-sm font-bold text-gray-500">抜け</span>
                                {!row.isConfirmed && (
                                  <button
                                    onClick={() => updateAbsent(row.id, null)}
                                    className="text-xs mt-0.5"
                                    style={{ color: "#f87171" }}
                                  >
                                    戻す
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        }

                        if (row.isConfirmed && result) {
                          const umaLabel = getUmaLabel(result.rank, rowNp, settings);
                          return (
                            <td key={p.id} className="p-2">
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="flex items-center gap-1 flex-wrap justify-center">
                                  <RankBadge rank={result.rank} />
                                  <span className="text-xs text-gray-400">{umaLabel}</span>
                                  {result.tobi && (
                                    <span className="text-xs font-bold" style={{ color: "#f87171" }}>飛び</span>
                                  )}
                                  {result.tied && (
                                    <span className="text-xs font-bold" style={{ color: "#c9a227" }}>同点</span>
                                  )}
                                </div>
                                <PointDisplay point={result.point} />
                                {result.score != null && (
                                  <span className="text-xs text-gray-500">
                                    {result.score.toLocaleString()}点
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td key={p.id} className="p-2">
                            <div className="flex flex-col items-center gap-1">
                              {numSelected === 5 && row.roundMode === "4" && !row.isConfirmed && (
                                <button
                                  onClick={() => updateAbsent(row.id, p.id)}
                                  className="transition-colors"
                                  style={{
                                    fontSize: "0.85rem",
                                    padding: "3px 8px",
                                    borderRadius: "4px",
                                    border: "1px solid rgba(248,113,113,0.5)",
                                    color: row.absentId === p.id ? "#f0ead6" : "#f87171",
                                    background: row.absentId === p.id ? "rgba(248,113,113,0.3)" : "transparent",
                                    fontWeight: row.absentId === p.id ? 700 : 400,
                                    cursor: "pointer",
                                  }}
                                >
                                  {row.absentId === p.id ? "✓ 抜け" : "抜ける"}
                                </button>
                              )}

                              {/* 1位ラジオ ＋ 得点入力 横並び */}
                              <div className="flex items-center gap-1.5 justify-center flex-wrap py-1">
                                <label
                                  className="flex items-center gap-0.5 cursor-pointer shrink-0"
                                  style={{
                                    color: isFirst ? "var(--gold)" : "#888",
                                    fontSize: "0.875rem",
                                    fontWeight: isFirst ? 700 : 500,
                                  }}
                                >
                                  <input
                                    type="radio"
                                    name={`first-${row.id}`}
                                    checked={isFirst}
                                    onChange={() => updateFirst(row.id, p.id)}
                                    className="accent-yellow-400"
                                  />
                                  1位
                                </label>
                                {isFirst ? (
                                  <div className="flex items-center gap-0.5">
                                    <div
                                      className="text-center text-sm px-2 py-1 rounded"
                                      style={{
                                        background: "rgba(201,162,39,0.08)",
                                        border: "1px dashed rgba(201,162,39,0.4)",
                                        color: "var(--gold)",
                                        minWidth: "56px",
                                        width: "62px",
                                      }}
                                    >
                                      {result?.score != null ? Math.floor(result.score / 100) : "—"}
                                    </div>
                                    <span className="text-gray-400 text-sm font-mono">00</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-0.5">
                                    <input
                                      type="number"
                                      value={row.scores[p.id] ?? ""}
                                      onChange={(e) => updateScore(row.id, p.id, e.target.value)}
                                      placeholder="250"
                                      className="text-center"
                                      style={{ minWidth: "56px", width: "62px" }}
                                    />
                                    <span className="text-gray-400 text-sm font-mono">00</span>
                                  </div>
                                )}
                              </div>

                              {!isFirst &&
                                row.scores[p.id] != null &&
                                row.scores[p.id] !== "" &&
                                Number(row.scores[p.id]) < 0 && (
                                <div
                                  className="flex flex-col items-center gap-1 mt-1 p-1.5 rounded w-full"
                                  style={{
                                    background: "rgba(248,113,113,0.08)",
                                    border: "1px solid rgba(248,113,113,0.35)",
                                  }}
                                >
                                  <span className="text-xs font-bold" style={{ color: "#f87171" }}>
                                    飛び −{settings.tobiPenalty}p
                                  </span>
                                  <span className="text-xs text-gray-400">飛ばした人：</span>
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {rowActiveIds
                                      .filter((id) => id !== p.id)
                                      .map((killerId) => {
                                        const killerName = activePlayers.find((ap) => ap.id === killerId)?.name;
                                        const isSelected = (row.tobiKillerIds ?? {})[p.id] === killerId;
                                        return (
                                          <button
                                            key={killerId}
                                            onClick={() => updateTobiKiller(row.id, p.id, killerId)}
                                            style={{
                                              fontSize: "0.8rem",
                                              padding: "2px 8px",
                                              borderRadius: "4px",
                                              border: "1px solid rgba(248,113,113,0.5)",
                                              background: isSelected ? "rgba(248,113,113,0.35)" : "transparent",
                                              color: isSelected ? "#fca5a5" : "#888",
                                              fontWeight: isSelected ? 700 : 400,
                                              cursor: "pointer",
                                            }}
                                          >
                                            {isSelected ? `✓ ${killerName}` : killerName}
                                          </button>
                                        );
                                      })}
                                  </div>
                                </div>
                              )}

                              {!isFirst && tiedGroupMap[p.id] && (() => {
                                const { group, availableRanks } = tiedGroupMap[p.id];
                                const currentOverride = (row.rankOverrides ?? {})[p.id];
                                return (
                                  <div className="flex flex-col items-center gap-1 mt-0.5">
                                    <span className="text-xs" style={{ color: "#c9a227" }}>同点・順位を選択</span>
                                    <div className="flex gap-1 flex-wrap justify-center">
                                      {availableRanks.map((rank) => {
                                        const selected = currentOverride === rank;
                                        return (
                                          <button
                                            key={rank}
                                            onClick={() => {
                                              const newOverrides: Record<string, number> = { [p.id]: rank };
                                              const others = group.filter((id) => id !== p.id);
                                              const remaining = availableRanks.filter((r) => r !== rank);
                                              if (others.length === 1 && remaining.length === 1) {
                                                newOverrides[others[0]] = remaining[0];
                                              } else {
                                                const existingOverrides = { ...(row.rankOverrides ?? {}), [p.id]: rank };
                                                others.forEach((oid) => {
                                                  if (existingOverrides[oid] === rank) {
                                                    newOverrides[oid] = undefined as unknown as number;
                                                  }
                                                });
                                                const allOverrides = { ...existingOverrides, ...newOverrides };
                                                const unset = group.filter((id) => allOverrides[id] === undefined);
                                                const taken = new Set(group.map((id) => allOverrides[id]).filter(Boolean));
                                                const free = availableRanks.filter((r) => !taken.has(r));
                                                if (unset.length === 1 && free.length === 1) {
                                                  newOverrides[unset[0]] = free[0];
                                                }
                                              }
                                              const clean: Record<string, number> = {};
                                              Object.entries(newOverrides).forEach(([k, v]) => {
                                                if (v !== undefined) clean[k] = v;
                                              });
                                              setTieBreak(row.id, clean);
                                            }}
                                            style={{
                                              background: selected ? "var(--gold)" : "transparent",
                                              border: "1px solid rgba(201,162,39,0.7)",
                                              color: selected ? "#1a1a1a" : "var(--gold)",
                                              fontSize: "0.75rem",
                                              padding: "2px 8px",
                                              borderRadius: "4px",
                                              cursor: "pointer",
                                              fontWeight: selected ? 700 : 400,
                                            }}
                                          >
                                            {rank}位
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })()}

                              {result && (
                                <div className="flex flex-col items-center gap-0.5">
                                  <div className="flex items-center gap-1 flex-wrap justify-center">
                                    <RankBadge rank={result.rank} />
                                    <span className="text-xs text-gray-400">
                                      {getUmaLabel(result.rank, rowNp, settings)}
                                    </span>
                                    {result.tobi && (
                                      <span className="text-xs font-bold" style={{ color: "#f87171" }}>飛び</span>
                                    )}
                                    {result.tied && (
                                      <span className="text-xs font-bold" style={{ color: "#c9a227" }}>同点</span>
                                    )}
                                  </div>
                                  <PointDisplay point={result.point} />
                                  {result.score != null && !isFirst && (
                                    <span className="text-xs text-gray-500">
                                      {result.score.toLocaleString()}点
                                    </span>
                                  )}
                                  {(() => {
                                    const killCount = Object.values(row.tobiKillerIds ?? {}).filter((id) => id === p.id).length;
                                    return killCount > 0 ? (
                                      <span className="text-xs font-bold" style={{ color: "#34d399" }}>
                                        飛ばし +{killCount * settings.tobiPenalty}p
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* 場代 */}
                      <td className="p-1">
                        {row.isConfirmed ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-bold positive">+{row.ba}p</span>
                            <span className="text-xs text-gray-500">{(row.ba * 1000).toLocaleString()}点</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="number"
                              value={row.ba}
                              onChange={(e) => updateBa(row.id, Number(e.target.value))}
                              className="w-14 text-center"
                            />
                            <span className="text-sm font-bold positive">+{row.ba}p</span>
                            <span className="text-xs text-gray-500">{(row.ba * 1000).toLocaleString()}点</span>
                          </div>
                        )}
                      </td>

                      {/* 確定・削除ボタン */}
                      <td className="p-1">
                        <div className="flex flex-col items-center gap-1">
                          {row.isConfirmed ? (
                            <button
                              onClick={() => unconfirmRow(row.id)}
                              className="text-xs btn-outline py-1 px-2"
                            >
                              修正
                            </button>
                          ) : (
                            <button
                              onClick={() => confirmRow(row.id)}
                              disabled={!rowReady}
                              className="btn-gold text-xs py-1 px-2 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              確定
                            </button>
                          )}
                          {rows.length > 1 && (
                            <button
                              onClick={() => removeRow(row.id)}
                              className="text-gray-500 hover:text-red-400 transition-colors text-sm"
                            >
                              削除
                            </button>
                          )}
                          {hasTie && !rowReady && (
                            <span
                              className="text-xs text-center leading-tight mt-0.5"
                              style={{ color: "#c9a227", fontSize: "0.65rem" }}
                            >
                              同点：<br />順位を<br />選択して
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* 役満祝儀行 */}
                {yakumanRows.map((yaku) => {
                  const results = calcYakumanResults(yaku, activePlayerIds);
                  const canConfirm = !!yaku.winnerId && yaku.bonusPerPlayer > 0;
                  return (
                    <tr
                      key={`yaku-${yaku.id}`}
                      style={{ background: "rgba(251,191,36,0.07)", borderTop: "1px solid rgba(251,191,36,0.3)" }}
                    >
                      {/* 回ラベル */}
                      <td>
                        <div
                          className="flex flex-col items-center gap-0.5 py-1"
                          style={{ color: "#fbbf24", fontSize: "0.7rem", fontWeight: 700, lineHeight: 1.3 }}
                        >
                          🎊<br />役満<br />祝儀
                        </div>
                      </td>

                      {/* プレイヤーセル */}
                      {activePlayers.map((p) => {
                        const isWinner = yaku.winnerId === p.id;
                        const result = results?.find((r) => r.playerId === p.id);
                        return (
                          <td key={p.id} className="p-2">
                            <div className="flex flex-col items-center gap-1">
                              {/* 上がりボタン */}
                              {!yaku.isConfirmed ? (
                                <button
                                  onClick={() => updateYakumanWinner(yaku.id, p.id)}
                                  style={{
                                    background: isWinner ? "rgba(251,191,36,0.25)" : "transparent",
                                    border: `1px solid ${isWinner ? "#fbbf24" : "rgba(201,162,39,0.25)"}`,
                                    color: isWinner ? "#fbbf24" : "#666",
                                    borderRadius: "6px",
                                    padding: "4px 10px",
                                    cursor: "pointer",
                                    fontWeight: isWinner ? 700 : 400,
                                    fontSize: "0.8rem",
                                    width: "100%",
                                    transition: "all 0.15s",
                                  }}
                                >
                                  {isWinner ? "🎊 上がり" : "上がり"}
                                </button>
                              ) : (
                                isWinner && (
                                  <span style={{ color: "#fbbf24", fontSize: "0.75rem", fontWeight: 700 }}>
                                    🎊 役満
                                  </span>
                                )
                              )}
                              {/* ポイント表示 */}
                              {result && (
                                <span
                                  className={`font-bold text-sm ${result.point >= 0 ? "positive" : "negative"}`}
                                >
                                  {result.point >= 0 ? "+" : ""}{result.point}p
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* 祝儀額 */}
                      <td className="p-1">
                        {yaku.isConfirmed ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs font-bold" style={{ color: "#fbbf24" }}>
                              +{yaku.bonusPerPlayer}p
                            </span>
                            <span className="text-xs text-gray-500">／人</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="number"
                              value={yaku.bonusPerPlayer}
                              onChange={(e) => updateYakumanBonus(yaku.id, Number(e.target.value))}
                              className="w-14 text-center"
                              min="1"
                            />
                            <span className="text-xs text-gray-500">p／人</span>
                          </div>
                        )}
                      </td>

                      {/* 確定・削除 */}
                      <td className="p-1">
                        <div className="flex flex-col items-center gap-1">
                          {yaku.isConfirmed ? (
                            <button
                              onClick={() => unconfirmYakumanRow(yaku.id)}
                              className="text-xs btn-outline py-1 px-2"
                            >
                              修正
                            </button>
                          ) : (
                            <button
                              onClick={() => confirmYakumanRow(yaku.id)}
                              disabled={!canConfirm}
                              className="btn-gold text-xs py-1 px-2 disabled:opacity-30 disabled:cursor-not-allowed"
                              style={{ background: canConfirm ? "rgba(251,191,36,0.9)" : undefined }}
                            >
                              確定
                            </button>
                          )}
                          <button
                            onClick={() => removeYakumanRow(yaku.id)}
                            className="text-gray-500 hover:text-red-400 transition-colors text-sm"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* 合計行 */}
                <tr style={{ background: "rgba(26,58,42,0.7)" }}>
                  <td className="text-right text-sm font-semibold gold-text">合計</td>
                  {activePlayers.map((p) => (
                    <td key={p.id} className="text-center">
                      <PointDisplay point={totals[p.id] ?? 0} />
                    </td>
                  ))}
                  <td className="text-center">
                    <PointDisplay point={rows.reduce((s, r) => s + r.ba, 0)} />
                  </td>
                  <td></td>
                </tr>

                {/* スペーサー行 */}
                <tr>
                  <td colSpan={activePlayers.length + 3} style={{ height: "36px", background: "transparent" }} />
                </tr>

                {/* 昼行 */}
                {(() => {
                  const hiru = hiruRow;
                  const hiruCalc = hiru ? calcHiru(hiru, activePlayerIds) : null;
                  const hiruReady = hiruCalc !== null;

                  if (!hiru) {
                    return (
                      <tr>
                        <td colSpan={activePlayers.length + 3} className="text-center py-2">
                          <button
                            onClick={() => setHiruRow({ points: {}, firstPlayerId: null, isConfirmed: false })}
                            className="text-xs btn-outline py-1 px-3"
                          >
                            ＋ 昼を追加
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr style={{ background: "rgba(201,162,39,0.05)", borderTop: "1px dashed rgba(201,162,39,0.3)" }}>
                      <td className="text-right text-sm font-semibold" style={{ color: "var(--gold)" }}>昼</td>

                      {activePlayers.map((p) => {
                        const isFirst = hiru.firstPlayerId === p.id;
                        const result = hiruCalc?.find((r) => r.playerId === p.id);

                        if (hiru.isConfirmed && result) {
                          return (
                            <td key={p.id} className="p-2 text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <PointDisplay point={result.point} />
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td key={p.id} className="p-2">
                            <div className="flex flex-col items-center gap-1">
                              <label
                                className="flex items-center gap-1 cursor-pointer text-xs"
                                style={{ color: isFirst ? "var(--gold)" : hiru.firstPlayerId ? "#f87171" : "#888" }}
                              >
                                <input
                                  type="radio"
                                  name="hiru-first"
                                  checked={isFirst}
                                  onChange={() =>
                                    setHiruRow((prev) => prev ? { ...prev, firstPlayerId: p.id, points: {} } : prev)
                                  }
                                  className="accent-yellow-400"
                                />
                                {isFirst ? "貰う" : hiru.firstPlayerId ? "払う" : "貰う"}
                              </label>
                              {isFirst ? (
                                <div
                                  className="text-center text-sm px-2 py-1 rounded"
                                  style={{
                                    background: "rgba(201,162,39,0.08)",
                                    border: "1px dashed rgba(201,162,39,0.4)",
                                    color: "var(--gold)",
                                    minWidth: "60px",
                                  }}
                                >
                                  {result ? (result.point > 0 ? `+${result.point}` : result.point) : "—"}
                                </div>
                              ) : (
                                <div className="flex items-center gap-0.5">
                                  <span className="text-sm font-bold" style={{ color: "#f87171" }}>−</span>
                                  <input
                                    type="number"
                                    value={hiru.points[p.id] ?? ""}
                                    onChange={(e) =>
                                      setHiruRow((prev) =>
                                        prev ? { ...prev, points: { ...prev.points, [p.id]: e.target.value } } : prev
                                      )
                                    }
                                    placeholder="0"
                                    className="text-center"
                                    style={{ minWidth: "52px", width: "60px" }}
                                    min="0"
                                  />
                                </div>
                              )}
                              {result && !isFirst && (
                                <PointDisplay point={result.point} size="sm" />
                              )}
                            </div>
                          </td>
                        );
                      })}

                      <td className="p-1 text-center text-xs text-gray-500">ba=0</td>
                      <td className="p-1">
                        <div className="flex flex-col items-center gap-1">
                          {hiru.isConfirmed ? (
                            <button
                              onClick={() => setHiruRow((prev) => prev ? { ...prev, isConfirmed: false } : prev)}
                              className="text-xs btn-outline py-1 px-2"
                            >
                              修正
                            </button>
                          ) : (
                            <button
                              onClick={() => setHiruRow((prev) => prev ? { ...prev, isConfirmed: true } : prev)}
                              disabled={!hiruReady}
                              className="btn-gold text-xs py-1 px-2 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              確定
                            </button>
                          )}
                          <button
                            onClick={() => setHiruRow(null)}
                            className="text-gray-500 hover:text-red-400 transition-colors text-sm"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })()}

                {/* 昼込み合計行 */}
                {hiruResults && (
                  <tr style={{ background: "rgba(201,162,39,0.12)", borderTop: "2px solid rgba(201,162,39,0.4)" }}>
                    <td className="text-right text-sm font-semibold" style={{ color: "var(--gold)" }}>
                      昼込み<br />合計
                    </td>
                    {activePlayers.map((p) => {
                      const hiruPoint = hiruResults.find((r) => r.playerId === p.id)?.point ?? 0;
                      const combined = (totals[p.id] ?? 0) + hiruPoint;
                      return (
                        <td key={p.id} className="text-center p-2">
                          <PointDisplay point={combined} />
                        </td>
                      );
                    })}
                    <td colSpan={2}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 自動保存インジケーター */}
          {lastSaved && (
            <div className="flex items-center gap-1.5 text-sm" style={{ color: "rgba(95,212,138,0.8)" }}>
              <span>✓</span>
              <span>
                自動保存済み（{lastSaved.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}）
              </span>
              <span className="text-xs text-gray-500">― リセットor保存するまで消えません</span>
            </div>
          )}

          <div className="flex gap-3 justify-between flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <button onClick={addRow} className="btn-outline">
                ＋ 行を追加
              </button>
              <button
                onClick={addYakumanRow}
                className="text-xs font-semibold px-3 py-2 rounded transition-all"
                style={{
                  background: "rgba(251,191,36,0.12)",
                  border: "1px solid rgba(251,191,36,0.5)",
                  color: "#fbbf24",
                }}
              >
                🎊 役満祝儀
              </button>
              <button
                onClick={() => {
                  if (!confirm("入力内容をすべてリセットしますか？")) return;
                  setSelectedIds([]);
                  setConfirmed(false);
                  setRows([]);
                  setHiruRow(null);
                  setYakumanRows([]);
                  setPlayedAt(todayStr());
                  clearDraft();
                }}
                className="text-sm text-red-400 border border-red-800 rounded px-3 py-1"
              >
                リセット
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => router.back()} className="btn-outline">
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave || saving}
                className="btn-gold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "保存中..." : "成績に保存する"}
              </button>
            </div>
          </div>

          <div
            className="text-xs text-gray-400 p-3 rounded"
            style={{ border: "1px solid rgba(201,162,39,0.15)" }}
          >
            <p>
              返し点: {settings.kaeshine.toLocaleString()} ／
              ウマ({numSelected}人):{" "}
              {numSelected === 5
                ? `1位+${UMA5[1]} 2位+${UMA5[2]} 3位${UMA5[3]} 4位${UMA5[4]} 5位${UMA5[5]}`
                : numSelected === 4
                ? `1位+${settings.uma4[1]} 2位+${settings.uma4[2]} 3位${settings.uma4[3]} 4位${settings.uma4[4]}`
                : `1位+${settings.uma3[1]} 2位${settings.uma3[2]} 3位${settings.uma3[3]}`
              } ／ オカ: +{settings.oka} ／ 飛びペナルティ: -{settings.tobiPenalty}p
            </p>
            <p className="mt-1">
              ※ 1位の人にチェックを入れ、残り
              {numSelected === 5 ? "3〜4" : numSelected - 1}
              人の得点を入力して「確定」を押してください
              {numSelected === 5 && (
                <span>（5人戦：「この回抜け」で1人休ませて4人打ちにできます）</span>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
