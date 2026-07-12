// src/components/AdminProtectedRoute.jsx  (renamed from ProtectedRoute.jsx)
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminProtectedRoute({ children }) {
  const { user, isAdmin } = useAuth();

  if (user === undefined || (user && isAdmin === undefined)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin" />
      </div>
    );
  }

  if (user === null || !isAdmin) {
    return <Navigate to="/admin27-login" replace />;
  }

  return children;
}