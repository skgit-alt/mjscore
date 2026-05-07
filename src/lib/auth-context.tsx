"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
  signIn: () => Promise<void>;
  signInAsParticipant: (loginId: string, password: string) => Promise<void>;
  createParticipant: (loginId: string, password: string) => Promise<string>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  isParticipant: false,
  participantInfo: null,
  signIn: async () => {},
  signInAsParticipant: async () => {},
  createParticipant: async () => "",
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [participantInfo, setParticipantInfo] = useState<ParticipantAccount | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (u && u.uid !== process.env.NEXT_PUBLIC_ADMIN_UID) {
        const info = await getParticipantAccount(u.uid);
        if (!info) {
          // アカウント登録のないユーザーは自動サインアウト
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
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const isAdmin = user?.uid === process.env.NEXT_PUBLIC_ADMIN_UID;
  const isParticipant = !!user && !isAdmin && !!participantInfo;

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
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

  return (
    <AuthContext.Provider
      value={{ user, loading, isAdmin, isParticipant, participantInfo, signIn, signInAsParticipant, createParticipant, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
