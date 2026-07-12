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
import { doc, setDoc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/Config";

const AuthContext = createContext();

// Excludes 0/O and 1/I to avoid user confusion when typing a referral code
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

async function createUserProfile(uid, { name, email, referredByCode = null }) {
  const userRef = doc(db, "users", uid);
  let assignedCode = null;

  for (let attempt = 0; attempt < 6 && !assignedCode; attempt++) {
    const candidate = generateCode();
    const codeRef = doc(db, "referralCodes", candidate);
    try {
      await runTransaction(db, async (tx) => {
        const codeSnap = await tx.get(codeRef);
        if (codeSnap.exists()) throw new Error("collision");
        tx.set(codeRef, { uid, createdAt: serverTimestamp() });
        tx.set(userRef, {
          name: name || "",
          email: email || "",
          referralCode: candidate,
          referredBy: referredByCode || null,
          referralSignupDiscountUsed: false,
          successfulReferralCount: 0,
          rewardsAvailable: 0,
          createdAt: serverTimestamp(),
        });
      });
      assignedCode = candidate;
    } catch {
      // collision — loop retries with a fresh candidate
    }
  }

  if (!assignedCode) {
    // Fallback so signup never hard-fails; code can be backfilled later.
    await setDoc(
      userRef,
      {
        name: name || "",
        email: email || "",
        referralCode: null,
        referredBy: referredByCode || null,
        referralSignupDiscountUsed: false,
        successfulReferralCount: 0,
        rewardsAvailable: 0,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
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
        console.log("admin claim:", tokenResult.claims.admin, "full claims:", tokenResult.claims); // ← add this line
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

  async function signup({ name, email, password, referredByCode }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
    await createUserProfile(cred.user.uid, { name, email, referredByCode });
    await refreshProfile();
    return cred.user;
  }

  async function login({ email, password }) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  }

  async function loginWithGoogle({ referredByCode } = {}) {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const existing = await getDoc(doc(db, "users", cred.user.uid));
    if (!existing.exists()) {
      await createUserProfile(cred.user.uid, {
        name: cred.user.displayName,
        email: cred.user.email,
        referredByCode,
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