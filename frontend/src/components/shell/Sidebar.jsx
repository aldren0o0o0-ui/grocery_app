import { Link, useLocation } from "react-router-dom";
import useAuth from "../../modules/auth/useAuth";

export const Sidebar = ({ isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile }) => {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role || "STAFF";

  const isCurrent = (path) => {
    if (path === "/products" && (location.pathname === "/products" || location.pathname === "/categories")) {
      return true;
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  // Role-scoped navigation definition without any icons or emojis
  const getNavSections = () => {
    if (role === "CASHIER") {
      return [
        {
          title: "Main",
          items: [
            { path: "/dashboard", label: "Dashboard", short: "DB" },
            { path: "/pos", label: "POS Checkout", short: "PO" },
            { path: "/sales", label: "Sales History", short: "SH" },
            { path: "/returns", label: "Returns", short: "RT" },
          ],
        },
      ];
    }

    if (role === "STAFF") {
      return [
        {
          title: "Overview",
          items: [{ path: "/dashboard", label: "Dashboard", short: "DB" }],
        },
        {
          title: "Catalog & Stock",
          items: [
            { path: "/products", label: "Products", short: "PR" },
            { path: "/inventory", label: "Inventory", short: "IN" },
          ],
        },
        {
          title: "Purchasing",
          items: [
            { path: "/purchases", label: "Purchases", short: "PU" },
            { path: "/suppliers", label: "Suppliers", short: "SU" },
          ],
        },
        {
          title: "Finance",
          items: [{ path: "/expenses", label: "Expenses", short: "EX" }],
        },
      ];
    }

    // OWNER (Full system)
    return [
      {
        title: "Overview",
        items: [{ path: "/dashboard", label: "Dashboard", short: "DB" }],
      },
      {
        title: "Catalog & Stock",
        items: [
          { path: "/products", label: "Products", short: "PR" },
          { path: "/inventory", label: "Inventory", short: "IN" },
        ],
      },
      {
        title: "Purchasing & Vendors",
        items: [
          { path: "/purchases", label: "Purchases", short: "PU" },
          { path: "/suppliers", label: "Suppliers", short: "SU" },
        ],
      },
      {
        title: "Sales & Checkout",
        items: [
          { path: "/pos", label: "Point of Sale", short: "PO" },
          { path: "/sales", label: "Sales History", short: "SH" },
          { path: "/returns", label: "Returns", short: "RT" },
        ],
      },
      {
        title: "Finance & Team",
        items: [
          { path: "/expenses", label: "Expenses", short: "EX" },
          { path: "/users", label: "Users & Team", short: "US" },
        ],
      },
    ];
  };

  const navSections = getNavSections();

  return (
    <>
      <aside
        id="app-sidebar"
        className={`app-sidebar ${isCollapsed ? "collapsed" : ""} ${isMobileOpen ? "mobile-open" : ""}`}
      >
        {/* Brand Header */}
        <Link to="/dashboard" className="sidebar-brand" onClick={onCloseMobile}>
          <div className="brand-icon">G</div>
          {!isCollapsed && (
            <div>
              <span className="brand-text">Grocery SME</span>
              <span className="brand-subtitle">Management System</span>
            </div>
          )}
        </Link>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          {navSections.map((section, idx) => (
            <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {!isCollapsed && <div className="nav-group-title">{section.title}</div>}
              {section.items.map((item) => {
                const active = isCurrent(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`nav-item ${active ? "active" : ""}`}
                    onClick={onCloseMobile}
                    title={isCollapsed ? item.label : undefined}
                    style={{
                      justifyContent: isCollapsed ? "center" : "flex-start",
                      padding: isCollapsed ? "8px 0" : "8px 12px",
                    }}
                  >
                    {isCollapsed ? (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: "700",
                          color: active ? "var(--color-primary)" : "var(--color-muted)",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {item.short}
                      </span>
                    ) : (
                      <span className="nav-item-label" style={{ marginLeft: 0 }}>
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer: User Profile & Collapse */}
        <div className="sidebar-footer">
          {!isCollapsed ? (
            <div className="user-profile-badge">
              <div className="user-avatar">
                {user?.first_name ? user.first_name[0].toUpperCase() : "U"}
              </div>
              <div className="user-info">
                <div className="user-name">{user?.first_name} {user?.last_name}</div>
                <div className="user-role-tag">{role}</div>
              </div>
            </div>
          ) : (
            <div
              style={{ textAlign: "center", padding: "4px 0" }}
              title={`${user?.first_name || "User"} (${role})`}
            >
              <div className="user-avatar" style={{ margin: "0 auto" }}>
                {user?.first_name ? user.first_name[0].toUpperCase() : "U"}
              </div>
            </div>
          )}

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            id="btn-sidebar-collapse"
            style={{
              padding: "6px 10px",
              backgroundColor: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--color-muted)",
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              width: "100%",
            }}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span>{isCollapsed ? "»" : "« Collapse"}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      <div
        className={`mobile-drawer-overlay ${isMobileOpen ? "open" : ""}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />
    </>
  );
};

export default Sidebar;
