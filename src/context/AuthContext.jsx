// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/Config";

const AuthContext = createContext();

async function createUserProfile(uid, { name, email }) {
  const userRef = doc(db, "users", uid);
  await setDoc(
    userRef,
    {
      name: name || "",
      email: email || "",
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out
  const [isAdmin, setIsAdmin] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("login");
  const [onAuthSuccess, setOnAuthSuccess] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser ?? null);

      if (firebaseUser) {
        const tokenResult = await firebaseUser.getIdTokenResult();
        setIsAdmin(!!tokenResult.claims.admin);

        if (!firebaseUser.isAnonymous) {
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          setProfile(snap.exists() ? snap.data() : null);
        } else {
          setProfile(null);
        }
      } else {
        setIsAdmin(false);
        setProfile(null);
      }
    });
    return unsubscribe;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user || user.isAnonymous) return;
    const snap = await getDoc(doc(db, "users", user.uid));
    setProfile(snap.exists() ? snap.data() : null);
  }, [user]);

  async function signup({ name, email, password }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
    await createUserProfile(cred.user.uid, { name, email });
    await refreshProfile();
    return cred.user;
  }

  async function login({ email, password }) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const existing = await getDoc(doc(db, "users", cred.user.uid));
    if (!existing.exists()) {
      await createUserProfile(cred.user.uid, {
        name: cred.user.displayName,
        email: cred.user.email,
      });
    }
    await refreshProfile();
    return cred.user;
  }

  function logout() {
    setProfile(null);
    return signOut(auth);
  }

  function openAuthModal({ mode = "login", onSuccess = null } = {}) {
    setModalMode(mode);
    setOnAuthSuccess(() => onSuccess);
    setModalOpen(true);
  }

  function closeAuthModal() {
    setModalOpen(false);
    setOnAuthSuccess(null);
  }

  function handleAuthSuccess() {
    setModalOpen(false);
    if (onAuthSuccess) onAuthSuccess();
    setOnAuthSuccess(null);
  }

  const value = {
    user,
    profile,
    isAdmin,
    isLoggedIn: !!user && !user.isAnonymous,
    signup,
    login,
    loginWithGoogle,
    logout,
    refreshProfile,
    modalOpen,
    modalMode,
    openAuthModal,
    closeAuthModal,
    handleAuthSuccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}