import { Navigate, useLocation } from "react-router-dom";
import useAuth from "../../context/AuthContext";

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg-app)",
        gap: "16px"
      }}>
        <div style={{
          width: "36px",
          height: "36px",
          border: "3px solid var(--color-slate-200)",
          borderTopColor: "var(--color-primary-600)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <span style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: 500 }}>
          Authenticating FreshFlow...
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
