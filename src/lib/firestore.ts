import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { Player, Game, Settings, DEFAULT_SETTINGS, ParticipantAccount } from "./types";

// --- Settings ---

export async function getSettings(): Promise<Settings> {
  const snap = await getDoc(doc(db, "settings", "main"));
  if (!snap.exists()) return DEFAULT_SETTINGS;
  return snap.data() as Settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await setDoc(doc(db, "settings", "main"), settings);
}

// --- Players ---

export async function getPlayers(): Promise<Player[]> {
  const q = query(collection(db, "players"), orderBy("order", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Player));
}

export async function addPlayer(name: string, order: number): Promise<string> {
  const ref = await addDoc(collection(db, "players"), {
    name,
    order,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updatePlayer(id: string, name: string): Promise<void> {
  await updateDoc(doc(db, "players", id), { name });
}

export async function deletePlayer(id: string): Promise<void> {
  await deleteDoc(doc(db, "players", id));
}

export async function updatePlayerOrder(id: string, order: number): Promise<void> {
  await updateDoc(doc(db, "players", id), { order });
}

// --- Games ---

export async function getGames(): Promise<Game[]> {
  const q = query(collection(db, "games"), orderBy("playedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Game));
}

export async function addGame(
  game: Omit<Game, "id">
): Promise<string> {
  const ref = await addDoc(collection(db, "games"), game);
  return ref.id;
}

export async function deleteGame(id: string): Promise<void> {
  await deleteDoc(doc(db, "games", id));
}

export async function deleteAllGames(): Promise<number> {
  const snap = await getDocs(collection(db, "games"));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  return snap.docs.length;
}

// --- Participant Accounts ---

export async function getParticipantAccounts(): Promise<ParticipantAccount[]> {
  const snap = await getDocs(collection(db, "participantAccounts"));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as ParticipantAccount));
}

export async function getParticipantAccount(uid: string): Promise<ParticipantAccount | null> {
  const snap = await getDoc(doc(db, "participantAccounts", uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as ParticipantAccount;
}

export async function setParticipantAccount(
  uid: string,
  data: Omit<ParticipantAccount, "uid">
): Promise<void> {
  await setDoc(doc(db, "participantAccounts", uid), data);
}

export async function deleteParticipantAccount(uid: string): Promise<void> {
  await deleteDoc(doc(db, "participantAccounts", uid));
}
