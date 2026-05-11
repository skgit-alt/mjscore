"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword as firebaseUpdatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  getRedirectResult,
} from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { auth, firebaseConfig } from "./firebase";
import { getParticipantAccount } from "./firestore";
import { ParticipantAccount } from "./types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isParticipant: boolean;
  participantInfo: ParticipantAccount | null;
  authError: string;
  signIn: (email: string, password: string) => Promise<void>;
  signInAsParticipant: (loginId: string, password: string) => Promise<void>;
  createParticipant: (loginId: string, password: string) => Promise<string>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  isParticipant: false,
  participantInfo: null,
  authError: "",
  signIn: async () => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  signInAsParticipant: async () => {},
  createParticipant: async () => "",
  signOut: async () => {},
  changePassword: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [participantInfo, setParticipantInfo] = useState<ParticipantAccount | null>(null);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    // リダイレクトログイン後の結果を処理
    getRedirectResult(auth).catch((err) => {
      setAuthError(`redirect error: ${err?.code ?? err?.message ?? String(err)}`);
    });

    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      try {
        const adminUid = process.env.NEXT_PUBLIC_ADMIN_UID;
        if (u && u.uid !== adminUid) {
          const info = await getParticipantAccount(u.uid);
          if (!info) {
            // アカウント登録のないユーザーは自動サインアウト
            setAuthError(`uid=${u.uid} adminUid=${adminUid ?? "UNSET"} → signed out`);
            await firebaseSignOut(auth);
            setUser(null);
            setParticipantInfo(null);
          } else {
            setUser(u);
            setParticipantInfo(info);
          }
        } else {
          setUser(u);
          setParticipantInfo(null);
        }
      } catch (err: unknown) {
        const msg = (err as { code?: string; message?: string })?.code ?? (err as { message?: string })?.message ?? String(err);
        setAuthError(`auth error: ${msg}`);
        await firebaseSignOut(auth).catch(() => {});
        setUser(null);
        setParticipantInfo(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const isAdmin = user?.uid === process.env.NEXT_PUBLIC_ADMIN_UID;
  const isParticipant = !!user && !isAdmin && !!participantInfo;

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInAsParticipant = async (loginId: string, password: string) => {
    await signInWithEmailAndPassword(auth, `${loginId}@mj.local`, password);
  };

  const createParticipant = async (loginId: string, password: string): Promise<string> => {
    // セカンダリアプリを使って管理者をサインアウトさせずにアカウント作成
    let secondaryApp = getApps().find((a) => a.name === "secondary");
    if (!secondaryApp) {
      secondaryApp = initializeApp(firebaseConfig, "secondary");
    }
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      `${loginId}@mj.local`,
      password
    );
    const uid = cred.user.uid;
    await firebaseSignOut(secondaryAuth);
    return uid;
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setParticipantInfo(null);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!auth.currentUser || !auth.currentUser.email) throw new Error("not logged in");
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await firebaseUpdatePassword(auth.currentUser, newPassword);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, isAdmin, isParticipant, participantInfo, authError, signIn, signInAsParticipant, createParticipant, signOut, changePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
