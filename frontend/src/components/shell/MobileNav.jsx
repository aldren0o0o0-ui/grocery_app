import { Link, useLocation } from "react-router-dom";
import useAuth from "../../modules/auth/useAuth";

export const MobileNav = ({ onOpenMore }) => {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role || "STAFF";

  const isCurrent = (path) => location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  const getMobileNavItems = () => {
    if (role === "CASHIER") {
      return [
        { path: "/dashboard", label: "Overview" },
        { path: "/pos", label: "POS" },
        { path: "/sales", label: "Sales" },
        { path: "/returns", label: "Returns" },
      ];
    }

    if (role === "STAFF") {
      return [
        { path: "/dashboard", label: "Overview" },
        { path: "/inventory", label: "Inventory" },
        { path: "/purchases", label: "Purchases" },
        { path: "/expenses", label: "Expenses" },
        { action: "more", label: "Menu" },
      ];
    }

    // OWNER
    return [
      { path: "/dashboard", label: "Overview" },
      { path: "/pos", label: "POS" },
      { path: "/inventory", label: "Inventory" },
      { path: "/purchases", label: "Purchases" },
      { action: "more", label: "Menu" },
    ];
  };

  const items = getMobileNavItems();

  return (
    <nav className="mobile-bottom-nav" id="mobile-bottom-nav" aria-label="Mobile Navigation">
      <div className="mobile-nav-items">
        {items.map((item) => {
          if (item.action === "more") {
            return (
              <button
                key="more-btn"
                type="button"
                onClick={onOpenMore}
                className="mobile-nav-link"
                style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                aria-label="Open full menu"
              >
                <span>{item.label}</span>
              </button>
            );
          }

          const active = isCurrent(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`mobile-nav-link ${active ? "active" : ""}`}
              style={{ fontWeight: active ? 700 : 500 }}
            >
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
