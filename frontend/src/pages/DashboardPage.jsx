import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import useAuth from "../modules/auth/useAuth";
import { getDashboardOverviewApi } from "../modules/dashboard/api";

export const DashboardPage = () => {
  const { user } = useAuth();
  const role = user?.role || "STAFF";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTab, setSelectedTab] = useState("sales"); // "sales" | "returns" | "expenses"
  const [hoveredTrendDay, setHoveredTrendDay] = useState(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getDashboardOverviewApi();
      setData(res);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError(
        err.response?.data?.error?.message ||
          "Failed to load operational dashboard. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const loadInitial = async () => {
      try {
        const res = await getDashboardOverviewApi();
        if (!ignore) {
          setData(res);
        }
      } catch (err) {
        if (!ignore) {
          console.error("Dashboard initial load error:", err);
          setError(
            err.response?.data?.error?.message ||
              "Failed to load operational dashboard. Please try again."
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };
    loadInitial();
    return () => {
      ignore = true;
    };
  }, []);

  const formatCurrency = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "₱0.00";
    const absFormatted = Math.abs(num).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return num < 0 ? `-₱${absFormatted}` : `₱${absFormatted}`;
  };

  const formatNumber = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "0";
    return num.toLocaleString();
  };

  const formatTime = (isoStr) => {
    if (!isoStr) return "-";
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return isoStr;
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <Navbar />

      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "1.5rem 1.25rem 3rem" }}>
        {/* Header Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.75rem",
                fontWeight: "800",
                color: "#0f172a",
                margin: "0 0 0.25rem 0",
                letterSpacing: "-0.025em",
              }}
            >
              {role === "OWNER" && "SME Command Center"}
              {role === "STAFF" && "Operations & Inventory Dashboard"}
              {role === "CASHIER" && "Cashier Operations Hub"}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "0.875rem",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                📅 Business Date:{" "}
                <strong style={{ color: "#334155" }}>
                  {data?.period?.date || new Date().toISOString().split("T")[0]}
                </strong>
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "0.15rem 0.5rem",
                  backgroundColor: "#e2e8f0",
                  color: "#475569",
                  borderRadius: "9999px",
                  fontWeight: "600",
                }}
              >
                {data?.period?.timezone || "Asia/Manila"} (PHT)
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "0.15rem 0.5rem",
                  backgroundColor:
                    role === "OWNER" ? "#fef3c7" : role === "STAFF" ? "#e0e7ff" : "#dcfce7",
                  color:
                    role === "OWNER" ? "#92400e" : role === "STAFF" ? "#3730a3" : "#166534",
                  borderRadius: "9999px",
                  fontWeight: "700",
                }}
              >
                ROLE: {role}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={fetchDashboard}
              disabled={loading}
              id="btn-refresh-dashboard"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                backgroundColor: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                color: "#334155",
                fontSize: "0.875rem",
                fontWeight: "600",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                transition: "all 0.15s ease",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  animation: loading ? "spin 1s linear infinite" : "none",
                }}
              >
                🔄
              </span>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              padding: "1rem",
              borderRadius: "8px",
              marginBottom: "1.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>⚠️ {error}</span>
            <button
              onClick={fetchDashboard}
              style={{
                backgroundColor: "#ef4444",
                color: "#ffffff",
                border: "none",
                padding: "0.25rem 0.75rem",
                borderRadius: "4px",
                fontSize: "0.8125rem",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && !data && (
          <div style={{ padding: "4rem 0", textAlign: "center", color: "#64748b" }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
            <p style={{ fontWeight: "600" }}>Loading operational metrics...</p>
          </div>
        )}

        {/* Content based on Role */}
        {data && (
          <>
            {/* ================================================================= */}
            {/* 1. OWNER VIEW                                                     */}
            {/* ================================================================= */}
            {role === "OWNER" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Financial KPI Cards */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  <KpiCard
                    title="Net Sales"
                    value={formatCurrency(data.sales?.net_sales)}
                    subtext={`Gross: ${formatCurrency(data.sales?.gross_sales)} - Ref: ${formatCurrency(data.sales?.refunds)}`}
                    accentColor="#2563eb"
                    badge="Today"
                    id="kpi-net-sales"
                  />
                  <KpiCard
                    title="Transactions"
                    value={data.sales?.transactions || 0}
                    subtext="Sales completed today"
                    accentColor="#4f46e5"
                    badge="Today"
                    id="kpi-transactions"
                  />
                  <KpiCard
                    title="Estimated Gross Profit"
                    value={formatCurrency(data.profit?.estimated_gross_profit)}
                    subtext={`Net Sales - COGS (${formatCurrency(data.profit?.net_cogs)})`}
                    accentColor="#059669"
                    badge="Estimate"
                    id="kpi-gross-profit"
                  />
                  <KpiCard
                    title="Estimated Net Profit"
                    value={formatCurrency(data.profit?.estimated_net_profit)}
                    subtext={`Gross Profit - Exp (${formatCurrency(data.profit?.operating_expenses)})`}
                    accentColor={parseFloat(data.profit?.estimated_net_profit || 0) >= 0 ? "#16a34a" : "#dc2626"}
                    badge="Estimate"
                    id="kpi-net-profit"
                  />
                  <KpiCard
                    title="Operating Expenses"
                    value={formatCurrency(data.profit?.operating_expenses)}
                    subtext="Business date expenses"
                    accentColor="#dc2626"
                    badge="Today"
                    id="kpi-operating-expenses"
                  />
                </div>

                {/* Secondary Operational Row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  <OperationalBadgeCard
                    label="Low Stock Items"
                    value={data.inventory?.low_stock || 0}
                    color="#d97706"
                    bgColor="#fffbeb"
                    linkTo="/inventory"
                    id="kpi-low-stock"
                  />
                  <OperationalBadgeCard
                    label="Out of Stock Items"
                    value={data.inventory?.out_of_stock || 0}
                    color="#dc2626"
                    bgColor="#fef2f2"
                    linkTo="/inventory"
                    id="kpi-out-of-stock"
                  />
                  <OperationalBadgeCard
                    label="Active Products"
                    value={data.inventory?.active_products || 0}
                    color="#2563eb"
                    bgColor="#eff6ff"
                    linkTo="/products"
                    id="kpi-active-products"
                  />
                  <OperationalBadgeCard
                    label="Refunds Processed"
                    value={formatCurrency(data.sales?.refunds)}
                    color="#9333ea"
                    bgColor="#faf5ff"
                    linkTo="/returns"
                    id="kpi-refunds"
                  />
                </div>

                {/* Analytics Row: 7-Day Trend + Top Products + Expense Breakdown */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
                    gap: "1.25rem",
                  }}
                >
                  {/* 7-Day Sales Trend */}
                  <div
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "12px",
                      padding: "1.25rem",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                      <div>
                        <h2 style={{ fontSize: "1rem", fontWeight: "700", color: "#1e293b", margin: 0 }}>
                          📈 7-Day Sales Trend
                        </h2>
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          Daily Net Sales (PHT)
                        </span>
                      </div>
                    </div>

                    {/* Chart Visualization */}
                    <SalesTrendBarChart
                      trend={data.trend || []}
                      formatCurrency={formatCurrency}
                      hoveredDay={hoveredTrendDay}
                      setHoveredDay={setHoveredTrendDay}
                    />
                  </div>

                  {/* Top Selling Products */}
                  <div
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "12px",
                      padding: "1.25rem",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    <h2 style={{ fontSize: "1rem", fontWeight: "700", color: "#1e293b", margin: "0 0 0.25rem" }}>
                      🏆 Top Selling Products
                    </h2>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      Ranked by net quantity sold (sales minus returns)
                    </span>

                    <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {!data.top_products || data.top_products.length === 0 ? (
                        <div style={{ padding: "2rem 0", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
                          No product sales recorded for today.
                        </div>
                      ) : (
                        data.top_products.map((p, idx) => {
                          const maxQty = parseFloat(data.top_products[0].net_quantity_sold) || 1;
                          const currentQty = parseFloat(p.net_quantity_sold) || 0;
                          const pct = Math.min(100, Math.round((currentQty / maxQty) * 100));

                          return (
                            <div key={p.product_id} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
                                <span style={{ fontWeight: "600", color: "#334155" }}>
                                  #{idx + 1} {p.name}
                                  <span style={{ color: "#94a3b8", marginLeft: "0.35rem", fontSize: "0.75rem" }}>
                                    ({p.sku})
                                  </span>
                                </span>
                                <span style={{ fontWeight: "700", color: "#0f172a" }}>
                                  {formatNumber(p.net_quantity_sold)} {p.unit} ({formatCurrency(p.net_sales)})
                                </span>
                              </div>
                              <div style={{ height: "6px", backgroundColor: "#f1f5f9", borderRadius: "9999px", overflow: "hidden" }}>
                                <div
                                  style={{
                                    height: "100%",
                                    width: `${pct}%`,
                                    backgroundColor: idx === 0 ? "#2563eb" : "#60a5fa",
                                    borderRadius: "9999px",
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Expense Breakdown */}
                  <div
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "12px",
                      padding: "1.25rem",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    <h2 style={{ fontSize: "1rem", fontWeight: "700", color: "#1e293b", margin: "0 0 0.25rem" }}>
                      💳 Expense Breakdown
                    </h2>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      Today&apos;s expenses grouped by category
                    </span>

                    <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {!data.expense_breakdown || data.expense_breakdown.length === 0 ? (
                        <div style={{ padding: "2rem 0", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
                          No operating expenses recorded for today.
                        </div>
                      ) : (
                        data.expense_breakdown.map((exp) => (
                          <div key={exp.category} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
                              <span style={{ fontWeight: "600", color: "#334155" }}>
                                {exp.category}
                              </span>
                              <span style={{ fontWeight: "700", color: "#dc2626" }}>
                                {formatCurrency(exp.amount)}{" "}
                                <span style={{ color: "#64748b", fontWeight: "500", fontSize: "0.75rem" }}>
                                  ({exp.percentage}%)
                                </span>
                              </span>
                            </div>
                            <div style={{ height: "6px", backgroundColor: "#f1f5f9", borderRadius: "9999px", overflow: "hidden" }}>
                              <div
                                style={{
                                  height: "100%",
                                  width: `${Math.min(100, parseFloat(exp.percentage) || 0)}%`,
                                  backgroundColor: "#ef4444",
                                  borderRadius: "9999px",
                                }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Operations Section: Inventory Alerts + Recent Feeds */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))",
                    gap: "1.25rem",
                  }}
                >
                  {/* Inventory Alerts Table */}
                  <div
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "12px",
                      padding: "1.25rem",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                      <h2 style={{ fontSize: "1rem", fontWeight: "700", color: "#1e293b", margin: 0 }}>
                        🚨 Critical Inventory Alerts
                      </h2>
                      <Link
                        to="/inventory"
                        style={{ fontSize: "0.8125rem", color: "#2563eb", fontWeight: "600", textDecoration: "none" }}
                      >
                        View Inventory →
                      </Link>
                    </div>

                    {!data.inventory_alerts || data.inventory_alerts.length === 0 ? (
                      <div style={{ padding: "2rem 0", textAlign: "center", color: "#10b981", fontSize: "0.875rem" }}>
                        ✅ All stock levels are healthy! No critical alerts.
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b", textAlign: "left" }}>
                              <th style={{ padding: "0.5rem 0.5rem 0.5rem 0" }}>Product</th>
                              <th style={{ padding: "0.5rem" }}>Stock</th>
                              <th style={{ padding: "0.5rem" }}>Reorder</th>
                              <th style={{ padding: "0.5rem 0 0.5rem 0.5rem" }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.inventory_alerts.map((a) => (
                              <tr key={a.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "0.6rem 0.5rem 0.6rem 0" }}>
                                  <div style={{ fontWeight: "600", color: "#1e293b" }}>{a.name}</div>
                                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{a.sku}</div>
                                </td>
                                <td style={{ padding: "0.6rem 0.5rem", fontWeight: "700", color: "#0f172a" }}>
                                  {formatNumber(a.stock_quantity)} {a.unit}
                                </td>
                                <td style={{ padding: "0.6rem 0.5rem", color: "#64748b" }}>
                                  {formatNumber(a.reorder_level)} {a.unit}
                                </td>
                                <td style={{ padding: "0.6rem 0 0.6rem 0.5rem" }}>
                                  <span
                                    style={{
                                      padding: "0.2rem 0.5rem",
                                      borderRadius: "9999px",
                                      fontSize: "0.6875rem",
                                      fontWeight: "700",
                                      backgroundColor: a.status === "OUT_OF_STOCK" ? "#fee2e2" : "#fef3c7",
                                      color: a.status === "OUT_OF_STOCK" ? "#991b1b" : "#92400e",
                                    }}
                                  >
                                    {a.status === "OUT_OF_STOCK" ? "OUT OF STOCK" : "LOW STOCK"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Recent Activity Tabs */}
                  <div
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "12px",
                      padding: "1.25rem",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                      <h2 style={{ fontSize: "1rem", fontWeight: "700", color: "#1e293b", margin: 0 }}>
                        🕒 Recent Activity
                      </h2>
                      <div style={{ display: "flex", gap: "0.25rem", backgroundColor: "#f1f5f9", padding: "0.2rem", borderRadius: "6px" }}>
                        <button
                          onClick={() => setSelectedTab("sales")}
                          style={{
                            padding: "0.25rem 0.6rem",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            backgroundColor: selectedTab === "sales" ? "#ffffff" : "transparent",
                            color: selectedTab === "sales" ? "#2563eb" : "#64748b",
                            boxShadow: selectedTab === "sales" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                          }}
                        >
                          Sales
                        </button>
                        <button
                          onClick={() => setSelectedTab("returns")}
                          style={{
                            padding: "0.25rem 0.6rem",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            backgroundColor: selectedTab === "returns" ? "#ffffff" : "transparent",
                            color: selectedTab === "returns" ? "#dc2626" : "#64748b",
                            boxShadow: selectedTab === "returns" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                          }}
                        >
                          Returns
                        </button>
                        <button
                          onClick={() => setSelectedTab("expenses")}
                          style={{
                            padding: "0.25rem 0.6rem",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            backgroundColor: selectedTab === "expenses" ? "#ffffff" : "transparent",
                            color: selectedTab === "expenses" ? "#9333ea" : "#64748b",
                            boxShadow: selectedTab === "expenses" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                          }}
                        >
                          Expenses
                        </button>
                      </div>
                    </div>

                    {/* Tab 1: Sales */}
                    {selectedTab === "sales" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {!data.recent_sales || data.recent_sales.length === 0 ? (
                          <div style={{ padding: "2rem 0", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
                            No recent sales found.
                          </div>
                        ) : (
                          data.recent_sales.map((s) => (
                            <div
                              key={s.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "0.5rem 0",
                                borderBottom: "1px solid #f1f5f9",
                                fontSize: "0.8125rem",
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: "600", color: "#1e293b" }}>{s.invoice_number}</div>
                                <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                                  {formatTime(s.created_at)} • Cashier: {s.cashier} ({s.item_count} items)
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontWeight: "700", color: "#0f172a" }}>{formatCurrency(s.total)}</div>
                                <span
                                  style={{
                                    fontSize: "0.6875rem",
                                    fontWeight: "600",
                                    color: s.status === "COMPLETED" ? "#16a34a" : s.status === "RETURNED" ? "#9333ea" : "#dc2626",
                                  }}
                                >
                                  {s.status}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Tab 2: Returns */}
                    {selectedTab === "returns" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {!data.recent_returns || data.recent_returns.length === 0 ? (
                          <div style={{ padding: "2rem 0", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
                            No recent returns found.
                          </div>
                        ) : (
                          data.recent_returns.map((r) => (
                            <div
                              key={r.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "0.5rem 0",
                                borderBottom: "1px solid #f1f5f9",
                                fontSize: "0.8125rem",
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: "600", color: "#1e293b" }}>{r.return_number}</div>
                                <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                                  {formatTime(r.created_at)} • Inv: {r.invoice_number} • By: {r.processed_by}
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontWeight: "700", color: "#dc2626" }}>-{formatCurrency(r.refund_amount)}</div>
                                <span style={{ fontSize: "0.6875rem", fontWeight: "600", color: "#16a34a" }}>COMPLETED</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Tab 3: Expenses */}
                    {selectedTab === "expenses" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {!data.recent_expenses || data.recent_expenses.length === 0 ? (
                          <div style={{ padding: "2rem 0", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
                            No recent expenses recorded.
                          </div>
                        ) : (
                          data.recent_expenses.map((e) => (
                            <div
                              key={e.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "0.5rem 0",
                                borderBottom: "1px solid #f1f5f9",
                                fontSize: "0.8125rem",
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: "600", color: "#1e293b" }}>
                                  {e.category}
                                  {e.description && <span style={{ fontWeight: "400", color: "#64748b" }}> — {e.description}</span>}
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                                  {e.expense_date} • By: {e.recorded_by}
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontWeight: "700", color: "#dc2626" }}>{formatCurrency(e.amount)}</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* 2. STAFF VIEW                                                     */}
            {/* ================================================================= */}
            {role === "STAFF" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Operational Counts */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  <KpiCard
                    title="Low Stock Items"
                    value={data.inventory?.low_stock || 0}
                    subtext="Requires replenishment order"
                    accentColor="#d97706"
                    id="staff-kpi-low-stock"
                  />
                  <KpiCard
                    title="Out of Stock Items"
                    value={data.inventory?.out_of_stock || 0}
                    subtext="Urgent stock depleted"
                    accentColor="#dc2626"
                    id="staff-kpi-out-of-stock"
                  />
                  <KpiCard
                    title="Active Products"
                    value={data.inventory?.active_products || 0}
                    subtext="Catalog items available for sale"
                    accentColor="#2563eb"
                    id="staff-kpi-active-products"
                  />
                </div>

                {/* Critical Inventory Alerts */}
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    padding: "1.25rem",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <div>
                      <h2 style={{ fontSize: "1.125rem", fontWeight: "700", color: "#1e293b", margin: 0 }}>
                        🚨 Critical Stock Alerts
                      </h2>
                      <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                        Prioritized list of items needing attention
                      </span>
                    </div>
                    <Link
                      to="/inventory"
                      style={{
                        padding: "0.4rem 0.8rem",
                        backgroundColor: "#2563eb",
                        color: "#ffffff",
                        borderRadius: "6px",
                        fontSize: "0.8125rem",
                        fontWeight: "600",
                        textDecoration: "none",
                      }}
                    >
                      Open Inventory Manager
                    </Link>
                  </div>

                  {!data.inventory_alerts || data.inventory_alerts.length === 0 ? (
                    <div style={{ padding: "3rem 0", textAlign: "center", color: "#10b981" }}>
                      ✅ No low stock or out of stock items detected!
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b", textAlign: "left" }}>
                            <th style={{ padding: "0.75rem 0.5rem 0.75rem 0" }}>Product Name</th>
                            <th style={{ padding: "0.75rem 0.5rem" }}>SKU</th>
                            <th style={{ padding: "0.75rem 0.5rem" }}>Current Stock</th>
                            <th style={{ padding: "0.75rem 0.5rem" }}>Reorder Level</th>
                            <th style={{ padding: "0.75rem 0.5rem" }}>Alert Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.inventory_alerts.map((item) => (
                            <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "0.75rem 0.5rem 0.75rem 0", fontWeight: "600", color: "#1e293b" }}>
                                {item.name}
                              </td>
                              <td style={{ padding: "0.75rem 0.5rem", color: "#64748b" }}>{item.sku}</td>
                              <td style={{ padding: "0.75rem 0.5rem", fontWeight: "700", color: item.status === "OUT_OF_STOCK" ? "#dc2626" : "#d97706" }}>
                                {formatNumber(item.stock_quantity)} {item.unit}
                              </td>
                              <td style={{ padding: "0.75rem 0.5rem", color: "#64748b" }}>
                                {formatNumber(item.reorder_level)} {item.unit}
                              </td>
                              <td style={{ padding: "0.75rem 0.5rem" }}>
                                <span
                                  style={{
                                    padding: "0.25rem 0.6rem",
                                    borderRadius: "9999px",
                                    fontSize: "0.75rem",
                                    fontWeight: "700",
                                    backgroundColor: item.status === "OUT_OF_STOCK" ? "#fee2e2" : "#fef3c7",
                                    color: item.status === "OUT_OF_STOCK" ? "#991b1b" : "#92400e",
                                  }}
                                >
                                  {item.status === "OUT_OF_STOCK" ? "OUT OF STOCK" : "LOW STOCK"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Operational Quick Actions & Recent Expenses */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                    gap: "1.25rem",
                  }}
                >
                  {/* Quick Links */}
                  <div
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "12px",
                      padding: "1.25rem",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    <h2 style={{ fontSize: "1rem", fontWeight: "700", color: "#1e293b", margin: "0 0 1rem" }}>
                      ⚡ Operational Shortcuts
                    </h2>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                      <QuickLinkButton to="/inventory" title="Manage Inventory" icon="📦" color="#2563eb" />
                      <QuickLinkButton to="/purchases" title="Purchase Orders" icon="🛒" color="#4f46e5" />
                      <QuickLinkButton to="/expenses" title="Record Expense" icon="📝" color="#059669" />
                      <QuickLinkButton to="/suppliers" title="Supplier Directory" icon="🏢" color="#7c3aed" />
                    </div>
                  </div>

                  {/* Recent Operating Expenses */}
                  <div
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "12px",
                      padding: "1.25rem",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    <h2 style={{ fontSize: "1rem", fontWeight: "700", color: "#1e293b", margin: "0 0 0.25rem" }}>
                      📋 Recent Expenses
                    </h2>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      Recently logged store expenses
                    </span>

                    <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {!data.recent_expenses || data.recent_expenses.length === 0 ? (
                        <div style={{ padding: "2rem 0", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
                          No expenses recorded yet.
                        </div>
                      ) : (
                        data.recent_expenses.map((e) => (
                          <div
                            key={e.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              padding: "0.5rem 0",
                              borderBottom: "1px solid #f1f5f9",
                              fontSize: "0.8125rem",
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: "600", color: "#1e293b" }}>{e.category}</div>
                              <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                                {e.expense_date} • {e.recorded_by}
                              </div>
                            </div>
                            <div style={{ fontWeight: "700", color: "#334155" }}>{formatCurrency(e.amount)}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* 3. CASHIER VIEW                                                   */}
            {/* ================================================================= */}
            {role === "CASHIER" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Cashier Personal KPIs */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  <KpiCard
                    title="My Sales Today"
                    value={formatCurrency(data.cashier_sales?.today_sales)}
                    subtext="Transactions processed by you today"
                    accentColor="#16a34a"
                    badge="Today"
                    id="cashier-kpi-today-sales"
                  />
                  <KpiCard
                    title="My Transactions"
                    value={data.cashier_sales?.transactions || 0}
                    subtext="Completed checkout sessions"
                    accentColor="#2563eb"
                    badge="Count"
                    id="cashier-kpi-transactions"
                  />
                </div>

                {/* Cashier Quick Actions */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  <Link
                    to="/pos"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      backgroundColor: "#16a34a",
                      color: "#ffffff",
                      padding: "1.25rem",
                      borderRadius: "12px",
                      textDecoration: "none",
                      boxShadow: "0 4px 6px -1px rgba(22, 163, 74, 0.2)",
                      transition: "transform 0.15s ease",
                    }}
                  >
                    <div style={{ fontSize: "2rem" }}>🛒</div>
                    <div>
                      <div style={{ fontSize: "1.125rem", fontWeight: "700" }}>Open POS Terminal</div>
                      <div style={{ fontSize: "0.8125rem", opacity: 0.9 }}>Process customer checkouts</div>
                    </div>
                  </Link>

                  <Link
                    to="/returns"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      backgroundColor: "#dc2626",
                      color: "#ffffff",
                      padding: "1.25rem",
                      borderRadius: "12px",
                      textDecoration: "none",
                      boxShadow: "0 4px 6px -1px rgba(220, 38, 38, 0.2)",
                      transition: "transform 0.15s ease",
                    }}
                  >
                    <div style={{ fontSize: "2rem" }}>↩️</div>
                    <div>
                      <div style={{ fontSize: "1.125rem", fontWeight: "700" }}>Process Return / Refund</div>
                      <div style={{ fontSize: "0.8125rem", opacity: 0.9 }}>Handle customer returns</div>
                    </div>
                  </Link>

                  <Link
                    to="/sales"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      backgroundColor: "#2563eb",
                      color: "#ffffff",
                      padding: "1.25rem",
                      borderRadius: "12px",
                      textDecoration: "none",
                      boxShadow: "0 4px 6px -1px rgba(37, 99, 235, 0.2)",
                      transition: "transform 0.15s ease",
                    }}
                  >
                    <div style={{ fontSize: "2rem" }}>📄</div>
                    <div>
                      <div style={{ fontSize: "1.125rem", fontWeight: "700" }}>View Sales History</div>
                      <div style={{ fontSize: "0.8125rem", opacity: 0.9 }}>Inspect past receipts</div>
                    </div>
                  </Link>
                </div>

                {/* My Recent Sales */}
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    padding: "1.25rem",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h2 style={{ fontSize: "1rem", fontWeight: "700", color: "#1e293b", margin: 0 }}>
                      🕒 My Recent Checkouts
                    </h2>
                    <Link
                      to="/sales"
                      style={{ fontSize: "0.8125rem", color: "#2563eb", fontWeight: "600", textDecoration: "none" }}
                    >
                      All Sales →
                    </Link>
                  </div>

                  {!data.recent_sales || data.recent_sales.length === 0 ? (
                    <div style={{ padding: "3rem 0", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
                      No sales processed yet today. Ready for customers!
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b", textAlign: "left" }}>
                            <th style={{ padding: "0.6rem 0.5rem 0.6rem 0" }}>Invoice #</th>
                            <th style={{ padding: "0.6rem 0.5rem" }}>Time</th>
                            <th style={{ padding: "0.6rem 0.5rem" }}>Items</th>
                            <th style={{ padding: "0.6rem 0.5rem" }}>Total</th>
                            <th style={{ padding: "0.6rem 0 0.6rem 0.5rem" }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.recent_sales.map((s) => (
                            <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "0.6rem 0.5rem 0.6rem 0", fontWeight: "600", color: "#1e293b" }}>
                                {s.invoice_number}
                              </td>
                              <td style={{ padding: "0.6rem 0.5rem", color: "#64748b" }}>{formatTime(s.created_at)}</td>
                              <td style={{ padding: "0.6rem 0.5rem", color: "#64748b" }}>{s.item_count}</td>
                              <td style={{ padding: "0.6rem 0.5rem", fontWeight: "700", color: "#0f172a" }}>
                                {formatCurrency(s.total)}
                              </td>
                              <td style={{ padding: "0.6rem 0 0.6rem 0.5rem" }}>
                                <span
                                  style={{
                                    padding: "0.2rem 0.5rem",
                                    borderRadius: "9999px",
                                    fontSize: "0.6875rem",
                                    fontWeight: "700",
                                    backgroundColor: s.status === "COMPLETED" ? "#dcfce7" : "#fee2e2",
                                    color: s.status === "COMPLETED" ? "#166534" : "#991b1b",
                                  }}
                                >
                                  {s.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

/* Subcomponents */

const KpiCard = ({ title, value, subtext, accentColor = "#2563eb", badge, id }) => (
  <div
    id={id}
    style={{
      backgroundColor: "#ffffff",
      borderRadius: "12px",
      padding: "1.25rem",
      border: "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      borderTop: `4px solid ${accentColor}`,
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
      <span style={{ fontSize: "0.8125rem", fontWeight: "600", color: "#64748b" }}>{title}</span>
      {badge && (
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: "700",
            backgroundColor: "#f1f5f9",
            color: "#475569",
            padding: "0.1rem 0.4rem",
            borderRadius: "4px",
          }}
        >
          {badge}
        </span>
      )}
    </div>
    <div style={{ fontSize: "1.625rem", fontWeight: "800", color: "#0f172a", letterSpacing: "-0.03em" }}>
      {value}
    </div>
    {subtext && (
      <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.4rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {subtext}
      </div>
    )}
  </div>
);

const OperationalBadgeCard = ({ label, value, color, bgColor, linkTo, id }) => (
  <Link
    to={linkTo}
    id={id}
    style={{
      backgroundColor: "#ffffff",
      borderRadius: "10px",
      padding: "1rem",
      border: "1px solid #e2e8f0",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      textDecoration: "none",
      transition: "border-color 0.15s ease",
    }}
  >
    <div>
      <div style={{ fontSize: "0.75rem", fontWeight: "600", color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0f172a" }}>{value}</div>
    </div>
    <span
      style={{
        backgroundColor: bgColor,
        color: color,
        padding: "0.35rem 0.6rem",
        borderRadius: "8px",
        fontWeight: "700",
        fontSize: "0.75rem",
      }}
    >
      View →
    </span>
  </Link>
);

const QuickLinkButton = ({ to, title, icon, color }) => (
  <Link
    to={to}
    style={{
      display: "flex",
      alignItems: "center",
      gap: "0.75rem",
      padding: "0.85rem",
      backgroundColor: "#f8fafc",
      border: "1px solid #e2e8f0",
      borderRadius: "8px",
      textDecoration: "none",
      color: "#1e293b",
      fontWeight: "600",
      fontSize: "0.875rem",
      transition: "background-color 0.15s ease",
    }}
  >
    <span style={{ fontSize: "1.25rem" }}>{icon}</span>
    <span style={{ color }}>{title}</span>
  </Link>
);

const SalesTrendBarChart = ({ trend, formatCurrency, hoveredDay, setHoveredDay }) => {
  if (!trend || trend.length === 0) {
    return <div style={{ padding: "2rem 0", textAlign: "center", color: "#94a3b8" }}>No trend data available.</div>;
  }

  // Find max sales value to scale bars
  const maxNet = Math.max(...trend.map((d) => parseFloat(d.net_sales) || 0), 100);

  return (
    <div style={{ position: "relative", marginTop: "1rem" }}>
      {/* Bar visual container */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          height: "140px",
          paddingBottom: "1.5rem",
          borderBottom: "1px solid #e2e8f0",
          gap: "0.5rem",
        }}
      >
        {trend.map((day) => {
          const val = parseFloat(day.net_sales) || 0;
          const heightPct = Math.max(8, Math.min(100, Math.round((val / maxNet) * 100)));
          const isHovered = hoveredDay?.date === day.date;

          return (
            <div
              key={day.date}
              onMouseEnter={() => setHoveredDay(day)}
              onMouseLeave={() => setHoveredDay(null)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                height: "100%",
                justifyContent: "flex-end",
                cursor: "pointer",
                position: "relative",
              }}
            >
              {/* Bar */}
              <div
                style={{
                  width: "100%",
                  maxWidth: "32px",
                  height: `${heightPct}%`,
                  backgroundColor: isHovered ? "#1d4ed8" : val > 0 ? "#2563eb" : "#e2e8f0",
                  borderRadius: "4px 4px 0 0",
                  transition: "all 0.15s ease",
                }}
              />
              {/* Day Label */}
              <span
                style={{
                  position: "absolute",
                  bottom: "-1.5rem",
                  fontSize: "0.6875rem",
                  color: isHovered ? "#1e293b" : "#64748b",
                  fontWeight: isHovered ? "700" : "500",
                }}
              >
                {day.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tooltip detail bar */}
      <div
        style={{
          marginTop: "1.75rem",
          minHeight: "2rem",
          backgroundColor: "#f8fafc",
          borderRadius: "6px",
          padding: "0.4rem 0.75rem",
          fontSize: "0.75rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#475569",
        }}
      >
        {hoveredDay ? (
          <>
            <span>
              <strong>{hoveredDay.date}</strong>: Net Sales{" "}
              <strong style={{ color: "#2563eb" }}>{formatCurrency(hoveredDay.net_sales)}</strong>
            </span>
            <span>
              (Gross: {formatCurrency(hoveredDay.gross_sales)} | Refunds: {formatCurrency(hoveredDay.refunds)})
            </span>
          </>
        ) : (
          <span style={{ color: "#94a3b8" }}>Hover over a bar to inspect daily breakdown</span>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
