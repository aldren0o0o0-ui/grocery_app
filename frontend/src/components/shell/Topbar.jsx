import { useLocation } from "react-router-dom";
import useAuth from "../../modules/auth/useAuth";

const ROUTE_TITLES = {
  "/dashboard": "Dashboard",
  "/products": "Products & Catalog",
  "/categories": "Categories",
  "/inventory": "Inventory",
  "/suppliers": "Suppliers",
  "/purchases": "Purchasing",
  "/pos": "Point of Sale",
  "/sales": "Sales History",
  "/returns": "Returns & Refunds",
  "/expenses": "Expenses",
  "/users": "Users & Team",
};

export const Topbar = ({ onOpenMobile }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const role = user?.role || "STAFF";

  // Match current route title
  const currentPath = Object.keys(ROUTE_TITLES).find(
    (path) => location.pathname === path || (path !== "/" && location.pathname.startsWith(path))
  );
  const pageTitle = ROUTE_TITLES[currentPath] || "Grocery SME";

  const getRoleBadgeStyle = () => {
    switch (role) {
      case "OWNER":
        return { backgroundColor: "var(--color-warning-soft)", color: "var(--color-warning-text)", border: "1px solid var(--color-warning-border)" };
      case "CASHIER":
        return { backgroundColor: "var(--color-success-soft)", color: "var(--color-success-text)", border: "1px solid var(--color-success-border)" };
      default:
        return { backgroundColor: "var(--color-info-soft)", color: "var(--color-info-text)", border: "1px solid var(--color-info-border)" };
    }
  };

  return (
    <header className="app-topbar" id="app-topbar">
      <div className="topbar-left">
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={onOpenMobile}
          id="btn-mobile-menu"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "36px",
            height: "36px",
            background: "none",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            fontSize: "1.1rem",
            color: "var(--color-text)",
          }}
          aria-label="Open navigation menu"
        >
          ☰
        </button>

        <span style={{ fontSize: "var(--text-lg)", fontWeight: "700", color: "var(--color-text)" }}>
          {pageTitle}
        </span>
      </div>

      <div className="topbar-right">
        {/* Business Date & Timezone */}
        <div className="topbar-badge" title="Business operational timezone">
          <span>🕒</span>
          <span>Asia/Manila (PHT)</span>
        </div>

        {/* Role Badge */}
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: "700",
            padding: "2px 8px",
            borderRadius: "var(--radius-pill)",
            letterSpacing: "0.03em",
            ...getRoleBadgeStyle(),
          }}
        >
          {role}
        </span>

        {/* Sign Out Action */}
        <button
          type="button"
          onClick={logout}
          id="btn-sign-out"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "5px 12px",
            backgroundColor: "#FFFFFF",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--text-xs)",
            fontWeight: "600",
            color: "var(--color-muted)",
            cursor: "pointer",
            transition: "all var(--transition-fast)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--color-danger)";
            e.currentTarget.style.borderColor = "var(--color-danger-border)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--color-muted)";
            e.currentTarget.style.borderColor = "var(--color-border)";
          }}
        >
          <span>🚪</span>
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
};

export default Topbar;
