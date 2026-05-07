import { Settings } from "./types";

export const UMA5 = { 1: 10, 2: 5, 3: 0, 4: -5, 5: -10 } as const;

export interface InputRow {
  playerId: string;
  score: string;
}

export interface CalcResult {
  playerId: string;
  score: number | null;
  point: number;
  rank: number;
  tobi?: boolean;
  tied?: boolean; // 同点で入力順に順位決定された場合
}

function floorToThousand(score: number): number {
  return Math.floor(score / 1000) * 1000;
}

export function calculatePoints(
  rows: InputRow[],
  ba: number,
  settings: Settings,
  numPlayers: 3 | 4
): CalcResult[] {
  const { kaeshine, uma4, uma3, oka } = settings;
  const uma = numPlayers === 4 ? uma4 : uma3;

  const parsed = rows.map((r) => ({
    playerId: r.playerId,
    score: r.score === "" ? null : Number(r.score),
  }));

  const withScores = parsed.filter((r) => r.score !== null);

  if (withScores.length === 0) {
    return parsed.map((r) => ({ playerId: r.playerId, score: null, point: 0, rank: 0 }));
  }

  const firstPlayer = parsed.find((r) => r.score === null);
  const others = parsed.filter((r) => r.score !== null);
  const sorted = [...others].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const results: CalcResult[] = [];
  let sumOtherPoints = 0;

  sorted.forEach((player, idx) => {
    const rank = idx + 2;
    const score = player.score!;
    const floored = floorToThousand(score);
    const souten = Math.round((floored - kaeshine) / 1000);
    const umaVal = (uma as Record<number, number>)[rank] ?? 0;
    const point = souten + umaVal;
    sumOtherPoints += point;
    results.push({ playerId: player.playerId, score, point, rank });
  });

  const firstPoint = -(sumOtherPoints + ba);
  if (firstPlayer) {
    results.unshift({ playerId: firstPlayer.playerId, score: null, point: firstPoint, rank: 1 });
  }

  return results;
}

// firstPlayerId を明示指定できる版
// - rank 1 は指定されたプレイヤー（チェックした人）
// - rank 2〜4 は残りのプレイヤーを得点の高い順に決定
export function calcAllRanks(
  scores: Record<string, number>,
  ba: number,
  settings: Settings,
  numPlayers: 3 | 4 | 5,
  playerIds: string[],
  firstPlayerId?: string,
  rankOverrides?: Record<string, number>,
  tobiKillerIds?: Record<string, string>  // 飛びプレイヤーID → 飛ばしたプレイヤーID
): CalcResult[] {
  const { kaeshine, uma4, uma3, oka } = settings;
  const uma = numPlayers === 5 ? UMA5 : numPlayers === 4 ? uma4 : uma3;

  const entries = playerIds.map((id) => ({ playerId: id, score: scores[id] ?? 0 }));

  let firstEntry: typeof entries[0];
  let otherEntries: typeof entries;

  if (firstPlayerId) {
    // ユーザーが指定した1位を優先
    firstEntry = entries.find((e) => e.playerId === firstPlayerId) ?? entries[0];
    otherEntries = entries.filter((e) => e.playerId !== firstEntry.playerId);
  } else {
    // 指定なし：最高得点が1位
    const sorted = [...entries].sort((a, b) => b.score - a.score);
    firstEntry = sorted[0];
    otherEntries = sorted.slice(1);
  }

  // 残りを得点の高い順にソート。同点の場合は rankOverrides で指定された順位で決定。
  const sortedOthers = [...otherEntries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // 同点：rankOverrides があれば従う
    const ra = rankOverrides?.[a.playerId];
    const rb = rankOverrides?.[b.playerId];
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return 0;
  });

  // 同点プレイヤーを検出（隣接する同スコアを持つプレイヤーを tied としてマーク）
  const tiedScores = new Set<number>(
    sortedOthers
      .map((p) => p.score)
      .filter((s, i, arr) => arr.indexOf(s) !== i || arr.lastIndexOf(s) !== i)
  );

  const results: CalcResult[] = [];
  let sumOtherPoints = 0;

  sortedOthers.forEach((player, idx) => {
    const rank = idx + 2; // 2, 3, 4
    const floored = floorToThousand(player.score);
    const souten = Math.round((floored - kaeshine) / 1000);
    const umaVal = (uma as Record<number, number>)[rank] ?? 0;
    const isTobi = player.score < 0;
    const isTied = tiedScores.has(player.score);
    // 飛ばしたプレイヤーにはボーナス加算（飛ばしの人数 × tobiPenalty）
    const killBonus = Object.values(tobiKillerIds ?? {})
      .filter((id) => id === player.playerId).length * settings.tobiPenalty;
    const point = souten + umaVal - (isTobi ? settings.tobiPenalty : 0) + killBonus;
    sumOtherPoints += point;
    results.push({ playerId: player.playerId, score: player.score, rank, point, tobi: isTobi || undefined, tied: isTied || undefined });
  });

  // 1位：他全員 + 場 の合計をマイナス（ゼロサム）。トビペナルティも含む。
  const firstPoint = -(sumOtherPoints + ba);
  results.unshift({
    playerId: firstEntry.playerId,
    score: firstEntry.score,
    point: firstPoint,
    rank: 1,
  });

  return results;
}
