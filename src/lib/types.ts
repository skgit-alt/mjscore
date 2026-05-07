import { Timestamp } from "firebase/firestore";

export interface Player {
  id: string;
  name: string;
  order: number;
  createdAt: Timestamp;
}

export interface GameResult {
  playerId: string;
  score: number | null;
  point: number;
  rank: number;
  tobi?: boolean;
  rankCounts?: { 1?: number; 2?: number; 3?: number; 4?: number; 5?: number };
  tobiCount?: number;
}

export interface RoundDetail {
  ba: number;
  yakuman?: boolean;
  results: {
    playerId: string;
    score: number | null;
    point: number;
    rank: number;
    tobi?: boolean;
  }[];
}

export interface Game {
  id: string;
  playedAt: Timestamp;
  numPlayers: 3 | 4 | 5;
  ba: number;
  numGames: number;
  results: GameResult[];
  rounds?: RoundDetail[];
  createdBy: string;
}

export interface Settings {
  kaeshine: number;
  uma4: { 1: number; 2: number; 3: number; 4: number };
  uma3: { 1: number; 2: number; 3: number };
  oka: number;
  defaultBa: number;
  tobiPenalty: number;
}

export const DEFAULT_SETTINGS: Settings = {
  kaeshine: 30000,
  uma4: { 1: 10, 2: 5, 3: -5, 4: -10 },
  uma3: { 1: 15, 2: 0, 3: -15 },
  oka: 20,
  defaultBa: 4,
  tobiPenalty: 10,
};

export interface ParticipantAccount {
  uid: string;
  loginId: string;
  displayName: string;
  playerId?: string;
}

export interface PlayerStats {
  playerId: string;
  name: string;
  totalPoint: number;
  gameCount: number;
  avgRank: number;
  firstRate: number;
  secondRate: number;
  thirdRate: number;
  fourthRate: number;
  tobiRate: number;
  pointHistory: number[];
}
