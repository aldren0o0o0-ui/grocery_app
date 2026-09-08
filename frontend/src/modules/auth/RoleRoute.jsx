import { Navigate } from "react-router-dom";
import useAuth from "./useAuth";


export const RoleRoute = ({ allowedRoles = [], children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p>Loading session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const effectiveRoles = [...allowedRoles];
  if (effectiveRoles.includes("OWNER") && !effectiveRoles.includes("ADMIN")) {
    effectiveRoles.push("ADMIN");
  }
  if (effectiveRoles.includes("ADMIN") && !effectiveRoles.includes("OWNER")) {
    effectiveRoles.push("OWNER");
  }

  if (!effectiveRoles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default RoleRoute;
