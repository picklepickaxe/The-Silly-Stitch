// src/components/AuthModal.jsx  (new)
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function AuthModal() {
  const { modalOpen, modalMode, isLoggedIn, closeAuthModal, handleAuthSuccess, signup, login, loginWithGoogle } = useAuth();

  const [mode, setMode] = useState(modalMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(modalMode);
  }, [modalMode]);

  useEffect(() => {
    if (!modalOpen || !isLoggedIn) return;
    resetFields();
    closeAuthModal();
  }, [modalOpen, isLoggedIn]);

  if (!modalOpen) return null;

  function resetFields() {
    setName("");
    setEmail("");
    setPassword("");
    setError("");
  }

  function handleClose() {
    resetFields();
    closeAuthModal();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");
        await signup({ name, email, password });
      } else {
        await login({ email, password });
      }
      resetFields();
      handleAuthSuccess();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      await loginWithGoogle();
      resetFields();
      handleAuthSuccess();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-sm rounded-2xl border border-yarn/20 bg-[#FFFDF7] dark:bg-[#16122a] dark:border-[#3d2f5a] p-6 shadow-xl">
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 text-text/40 dark:text-[#9b82b0] hover:text-text dark:hover:text-white text-lg leading-none"
          aria-label="Close"
        >
          ×
        </button>

        <h3 className="text-lg font-semibold text-text dark:text-[#e0d4f0] mb-1">
          {mode === "signup" ? "Create your account" : "Log in"}
        </h3>
        <p className="text-xs text-text/55 dark:text-[#9b82b0] mb-4">
          {mode === "signup" ? "Save your order history for easy reordering." : "Welcome back."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              required
              className="w-full rounded-xl border border-gray-200 dark:border-[#3a3050] bg-white dark:bg-[#1e1a30] px-3.5 py-2.5 text-sm text-gray-900 dark:text-[#e0d4f0] placeholder-gray-300 dark:placeholder-[#4a3868] focus:outline-none focus:ring-2 focus:ring-yarn/40 focus:border-yarn transition"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full rounded-xl border border-gray-200 dark:border-[#3a3050] bg-white dark:bg-[#1e1a30] px-3.5 py-2.5 text-sm text-gray-900 dark:text-[#e0d4f0] placeholder-gray-300 dark:placeholder-[#4a3868] focus:outline-none focus:ring-2 focus:ring-yarn/40 focus:border-yarn transition"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "Create a password (6+ characters)" : "Password"}
            required
            className="w-full rounded-xl border border-gray-200 dark:border-[#3a3050] bg-white dark:bg-[#1e1a30] px-3.5 py-2.5 text-sm text-gray-900 dark:text-[#e0d4f0] placeholder-gray-300 dark:placeholder-[#4a3868] focus:outline-none focus:ring-2 focus:ring-yarn/40 focus:border-yarn transition"
          />
          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yarn dark:bg-[#2a1f3d] text-white py-2.5 rounded-full text-sm font-semibold tracking-wide disabled:opacity-50 hover:bg-yarn/90 dark:hover:bg-[#3a2e50] active:scale-[0.98] transition-all"
          >
            {loading ? "Please wait..." : mode === "signup" ? "Sign up" : "Log in"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="mt-2 w-full border border-gray-200 dark:border-[#3a3050] py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-[#c0aad8] hover:bg-gray-50 dark:hover:bg-[#1e1a30] transition disabled:opacity-50"
        >
          Continue with Google
        </button>

        <p className="mt-4 text-center text-xs text-text/55 dark:text-[#9b82b0]">
          {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            onClick={() => {
              setError("");
              setMode(mode === "signup" ? "login" : "signup");
            }}
            className="text-yarn font-medium hover:underline"
          >
            {mode === "signup" ? "Log in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}

function friendlyError(err) {
  const code = err?.code || "";
  if (code.includes("email-already-in-use")) return "That email is already registered — try logging in.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Incorrect email or password.";
  }
  if (code.includes("weak-password")) return "Password must be at least 6 characters.";
  if (code.includes("popup-closed-by-user")) return "Google sign-in was cancelled.";
  return err?.message || "Something went wrong. Please try again.";
}