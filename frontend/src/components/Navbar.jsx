import { Link, useLocation } from "react-router-dom";
import useAuth from "../modules/auth/useAuth";

export const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isCurrent = (path) => location.pathname === path;

  return (
    <header
      style={{
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
        padding: "0.75rem 1.5rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
        <Link
          to="/products"
          style={{
            fontSize: "1.125rem",
            fontWeight: "700",
            color: "#111827",
            textDecoration: "none",
          }}
        >
          Grocery SME
        </Link>
        <nav style={{ display: "flex", gap: "1rem" }}>
          <Link
            to="/products"
            style={{
              fontSize: "0.875rem",
              fontWeight: "600",
              color: isCurrent("/products") ? "#2563eb" : "#4b5563",
              textDecoration: "none",
              borderBottom: isCurrent("/products") ? "2px solid #2563eb" : "2px solid transparent",
              paddingBottom: "0.25rem",
            }}
          >
            Products
          </Link>
          <Link
            to="/inventory"
            style={{
              fontSize: "0.875rem",
              fontWeight: "600",
              color: isCurrent("/inventory") ? "#2563eb" : "#4b5563",
              textDecoration: "none",
              borderBottom: isCurrent("/inventory") ? "2px solid #2563eb" : "2px solid transparent",
              paddingBottom: "0.25rem",
            }}
          >
            Inventory
          </Link>
          <Link
            to="/categories"
            style={{
              fontSize: "0.875rem",
              fontWeight: "600",
              color: isCurrent("/categories") ? "#2563eb" : "#4b5563",
              textDecoration: "none",
              borderBottom: isCurrent("/categories") ? "2px solid #2563eb" : "2px solid transparent",
              paddingBottom: "0.25rem",
            }}
          >
            Categories
          </Link>
          {["OWNER", "ADMIN", "STAFF"].includes(user?.role) && (
            <Link
              to="/suppliers"
              style={{
                fontSize: "0.875rem",
                fontWeight: "600",
                color: isCurrent("/suppliers") ? "#2563eb" : "#4b5563",
                textDecoration: "none",
                borderBottom: isCurrent("/suppliers") ? "2px solid #2563eb" : "2px solid transparent",
                paddingBottom: "0.25rem",
              }}
            >
              Suppliers
            </Link>
          )}
          {["OWNER", "ADMIN"].includes(user?.role) && (
            <Link
              to="/users"
              style={{
                fontSize: "0.875rem",
                fontWeight: "600",
                color: isCurrent("/users") ? "#2563eb" : "#4b5563",
                textDecoration: "none",
                borderBottom: isCurrent("/users") ? "2px solid #2563eb" : "2px solid transparent",
                paddingBottom: "0.25rem",
              }}
            >
              Users
            </Link>
          )}
        </nav>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <span style={{ fontSize: "0.875rem", color: "#4b5563" }}>
          {user?.first_name} ({user?.email})
        </span>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: "700",
            padding: "0.15rem 0.5rem",
            borderRadius: "9999px",
            backgroundColor: "#e0e7ff",
            color: "#3730a3",
          }}
        >
          {user?.role}
        </span>
        <button
          onClick={logout}
          style={{
            padding: "0.35rem 0.75rem",
            backgroundColor: "#f3f4f6",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "0.75rem",
            fontWeight: "600",
            color: "#374151",
            cursor: "pointer",
          }}
        >
          Sign Out
        </button>
      </div>
    </header>
  );
};

export default Navbar;
