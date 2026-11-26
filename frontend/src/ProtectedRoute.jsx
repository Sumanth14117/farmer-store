import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";
export default function ProtectedRoute({
  children,
  adminOnly = false,
  allowedRoles
}) {
  const {
    user,
    loading
  } = useAuth();
  if (loading) return <main className="page-state" role="status">Checking your session…</main>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin" || allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/store" replace />;
  return children;
}
