// src/components/ProtectedRoute.jsx  (new — customer-facing, e.g. guards /account)
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, isLoggedIn, openAuthModal } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user === null) {
      openAuthModal({ mode: "login" });
      navigate("/", { replace: true });
    }
  }, [user]);

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) return null;

  return children;
}