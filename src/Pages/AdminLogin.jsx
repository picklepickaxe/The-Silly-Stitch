import { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/Config";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    if (user && isAdmin) {
      navigate("/admin27", { replace: true });
    }
  }, [user, isAdmin, navigate]);

  async function handleLogin(e) {
    e.preventDefault();
    if (!email || !password || loading) return;

    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate("/admin27", { replace: true });
    } catch (err) {
      switch (err.code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          setError("Wrong email or password.");
          break;
        case "auth/too-many-requests":
          setError("Too many attempts. Try again later.");
          break;
        default:
          setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF6E8] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Brand mark */}
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-2">
            Admin Access
          </p>
          <h1 className="text-2xl font-semibold text-gray-900">
            The{" "}
            <span className="font-poiret text-3xl">Silly</span>{" "}
            Stitch
          </h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">
            Sign in
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#6b4e71]/30 focus:border-[#6b4e71] transition"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#6b4e71]/30 focus:border-[#6b4e71] transition"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-xl px-4 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full mt-2 py-3 rounded-xl bg-[#6b4e71] text-white text-sm font-semibold tracking-wide hover:bg-[#5a3f60] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-300 mt-6">
          This page is for store admins only.
        </p>
      </div>
    </div>
  );
}