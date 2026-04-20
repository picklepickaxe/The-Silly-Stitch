import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();

  // Still checking auth state — show nothing to avoid flash
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin" />
      </div>
    );
  }

  // Not logged in — send to login page
  if (user === null) {
    return <Navigate to="/admin27-login" replace />;
  }

  // Logged in — render the protected page
  return children;
}