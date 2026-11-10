import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  RotateCcw,
  Package,
  Boxes,
  Truck,
  TrendingDown,
  Users,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Store,
} from "lucide-react";
import useAuth from "../../context/AuthContext";

export const Sidebar = ({ isCollapsed, onToggleCollapse }) => {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role || "STAFF";

  const getNavSections = () => {
    if (role === "CASHIER") {
      return [
        {
          title: "Point of Sale",
          items: [
            { path: "/pos", label: "POS Terminal", icon: ShoppingCart, highlight: true },
            { path: "/sales", label: "Sales Receipts", icon: Receipt },
            { path: "/returns", label: "Returns & Refund", icon: RotateCcw },
          ],
        },
        {
          title: "General",
          items: [{ path: "/dashboard", label: "Shift Summary", icon: LayoutDashboard }],
        },
      ];
    }

    if (role === "STAFF") {
      return [
        {
          title: "Overview",
          items: [{ path: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
        },
        {
          title: "Inventory & Catalog",
          items: [
            { path: "/products", label: "Products", icon: Package },
            { path: "/categories", label: "Categories", icon: Store },
            { path: "/inventory", label: "Stock Levels", icon: Boxes },
          ],
        },
        {
          title: "Procurement",
          items: [
            { path: "/purchases", label: "Stock-In (Purchases)", icon: Truck },
            { path: "/suppliers", label: "Suppliers", icon: Store },
          ],
        },
        {
          title: "Expenses",
          items: [{ path: "/expenses", label: "Store Expenses", icon: TrendingDown }],
        },
      ];
    }

    // OWNER (Full ERP)
    return [
      {
        title: "Overview",
        items: [{ path: "/dashboard", label: "Command Center", icon: LayoutDashboard }],
      },
      {
        title: "Retail Operations",
        items: [
          { path: "/pos", label: "POS Terminal", icon: ShoppingCart, highlight: true },
          { path: "/sales", label: "Sales History", icon: Receipt },
          { path: "/returns", label: "Returns & Refunds", icon: RotateCcw },
        ],
      },
      {
        title: "Catalog & Stock",
        items: [
          { path: "/products", label: "Products Catalog", icon: Package },
          { path: "/categories", label: "Categories", icon: Store },
          { path: "/inventory", label: "Inventory Control", icon: Boxes },
        ],
      },
      // {
      //   title: "Procurement",
      //   items: [
      //     { path: "/purchases", label: "Purchase Orders", icon: Truck },
      //     { path: "/suppliers", label: "Suppliers", icon: Store },
      //   ],
      // },
      {
        title: "Finance & Admin",
        items: [
          // { path: "/expenses", label: "Operating Expenses", icon: TrendingDown },
          { path: "/users", label: "Team & Staff", icon: Users },
        ],
      },
    ];
  };

  const sections = getNavSections();

  return (
    <aside
      style={{
        width: isCollapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)",
        backgroundColor: "var(--bg-sidebar)",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        transition: "width var(--transition-normal)",
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderRight: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          height: "var(--topbar-height)",
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "space-between",
          padding: isCollapsed ? "0" : "0 20px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-primary-600)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow: "0 2px 8px rgba(5, 150, 105, 0.4)",
              flexShrink: 0,
            }}
          >
            <Sparkles size={20} />
          </div>
          {!isCollapsed && (
            <div>
              <div style={{ fontWeight: 800, fontSize: "16px", letterSpacing: "-0.02em" }}>
                Lean Grocery
              </div>
              <div style={{ fontSize: "11px", color: "var(--color-slate-400)", fontWeight: 500 }}>
                Grocery Enterprise
              </div>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <button
            onClick={onToggleCollapse}
            style={{
              color: "var(--color-slate-400)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "6px",
              borderRadius: "var(--radius-sm)",
              transition: "color var(--transition-fast)",
            }}
            title="Collapse Sidebar"
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      {/* Nav List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: isCollapsed ? "16px 8px" : "16px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        {sections.map((sec, idx) => (
          <div key={idx}>
            {!isCollapsed && sec.title && (
              <div
                style={{
                  fontSize: "11px",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "var(--color-slate-500)",
                  padding: "0 12px 6px",
                }}
              >
                {sec.title}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.path ||
                  (item.path !== "/" && location.pathname.startsWith(`${item.path}/`));

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={isCollapsed ? item.label : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: isCollapsed ? "10px 0" : "10px 14px",
                      justifyContent: isCollapsed ? "center" : "flex-start",
                      borderRadius: "var(--radius-md)",
                      color: isActive
                        ? "#ffffff"
                        : item.highlight
                          ? "var(--color-primary-400)"
                          : "var(--color-slate-300)",
                      backgroundColor: isActive
                        ? "var(--color-primary-600)"
                        : item.highlight
                          ? "rgba(5, 150, 105, 0.12)"
                          : "transparent",
                      fontWeight: isActive ? 600 : 500,
                      fontSize: "13.5px",
                      transition: "all var(--transition-fast)",
                      position: "relative",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.06)";
                        e.currentTarget.style.color = "#ffffff";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = item.highlight
                          ? "rgba(5, 150, 105, 0.12)"
                          : "transparent";
                        e.currentTarget.style.color = item.highlight
                          ? "var(--color-primary-400)"
                          : "var(--color-slate-300)";
                      }
                    }}
                  >
                    <Icon size={18} style={{ flexShrink: 0 }} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Toggle (When collapsed) */}
      {isCollapsed && (
        <div
          style={{
            padding: "12px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            onClick={onToggleCollapse}
            style={{
              color: "var(--color-slate-400)",
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Expand Sidebar"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
