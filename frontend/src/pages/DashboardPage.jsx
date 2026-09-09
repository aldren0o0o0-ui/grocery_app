import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import useAuth from "../modules/auth/useAuth";
import { getDashboardOverviewApi } from "../modules/dashboard/api";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/common/Button";
import { StatusBadge } from "../components/common/StatusBadge";
import { PageLoading, ErrorState } from "../components/common/FeedbackStates";

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
    const absFormatted = Math.abs(num).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
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

  const getPageTitle = () => {
    if (role === "OWNER") return "SME Command Center";
    if (role === "CASHIER") return "Cashier Operations Hub";
    return "Operations & Inventory Dashboard";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Page Header */}
      <PageHeader
        title={getPageTitle()}
        subtitle={
          <span style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span>
              Business Date:{" "}
              <strong style={{ color: "var(--color-text)" }}>
                {data?.period?.date || new Date().toISOString().split("T")[0]}
              </strong>
            </span>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 8px",
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-full)",
                color: "var(--color-text-secondary)",
                fontWeight: 600,
              }}
            >
              {data?.period?.timezone || "Asia/Manila"} (PHT)
            </span>
          </span>
        }
        actions={
          <Button
            id="btn-refresh-dashboard"
            variant="secondary"
            size="sm"
            onClick={fetchDashboard}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />

      {/* Error State */}
      {error && (
        <ErrorState
          title="Dashboard unavailable"
          message={error}
          onRetry={fetchDashboard}
        />
      )}

      {/* Loading State */}
      {loading && !data && (
        <PageLoading message="Loading operational metrics..." />
      )}

      {/* Dashboard Content */}
      {data && (
        <>
          {/* ================================================================= */}
          {/* 1. OWNER VIEW                                                     */}
          {/* ================================================================= */}
          {role === "OWNER" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Financial KPI Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "16px",
                }}
              >
                <KpiCard
                  title="Net Sales"
                  value={formatCurrency(data.sales?.net_sales)}
                  subtext={`Gross: ${formatCurrency(data.sales?.gross_sales)} - Ref: ${formatCurrency(data.sales?.refunds)}`}
                  accentColor="var(--color-primary)"
                  badge="Today"
                  id="kpi-net-sales"
                />
                <KpiCard
                  title="Transactions"
                  value={data.sales?.transactions || 0}
                  subtext="Sales completed today"
                  accentColor="#3B82F6"
                  badge="Today"
                  id="kpi-transactions"
                />
                <KpiCard
                  title="Estimated Gross Profit"
                  value={formatCurrency(data.profit?.estimated_gross_profit)}
                  subtext={`Net Sales - COGS (${formatCurrency(data.profit?.net_cogs)})`}
                  accentColor="var(--color-primary)"
                  badge="Estimate"
                  id="kpi-gross-profit"
                />
                <KpiCard
                  title="Estimated Net Profit"
                  value={formatCurrency(data.profit?.estimated_net_profit)}
                  subtext={`Gross Profit - Exp (${formatCurrency(data.profit?.operating_expenses)})`}
                  accentColor={
                    parseFloat(data.profit?.estimated_net_profit || 0) >= 0
                      ? "var(--color-primary)"
                      : "var(--color-danger)"
                  }
                  badge="Estimate"
                  id="kpi-net-profit"
                />
                <KpiCard
                  title="Operating Expenses"
                  value={formatCurrency(data.profit?.operating_expenses)}
                  subtext="Business date expenses"
                  accentColor="var(--color-danger)"
                  badge="Today"
                  id="kpi-operating-expenses"
                />
              </div>

              {/* Secondary Operational Row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "16px",
                }}
              >
                <OperationalBadgeCard
                  label="Low Stock Items"
                  value={data.inventory?.low_stock || 0}
                  color="var(--color-warning)"
                  bgColor="var(--color-warning-soft)"
                  linkTo="/inventory"
                  id="kpi-low-stock"
                />
                <OperationalBadgeCard
                  label="Out of Stock Items"
                  value={data.inventory?.out_of_stock || 0}
                  color="var(--color-danger)"
                  bgColor="var(--color-danger-soft)"
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
                  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                  gap: "20px",
                }}
              >
                {/* 7-Day Sales Trend */}
                <div
                  style={{
                    backgroundColor: "var(--color-surface)",
                    borderRadius: "var(--radius-lg)",
                    padding: "20px",
                    border: "1px solid var(--color-border)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                    <div>
                      <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
                        7-Day Sales Trend
                      </h2>
                      <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                        Daily Net Sales (PHT)
                      </span>
                    </div>
                  </div>

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
                    backgroundColor: "var(--color-surface)",
                    borderRadius: "var(--radius-lg)",
                    padding: "20px",
                    border: "1px solid var(--color-border)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text)", margin: "0 0 4px" }}>
                    Top Selling Products
                  </h2>
                  <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                    Ranked by net quantity sold (sales minus returns)
                  </span>

                  <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {!data.top_products || data.top_products.length === 0 ? (
                      <div style={{ padding: "32px 0", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
                        No product sales recorded for today.
                      </div>
                    ) : (
                      data.top_products.map((p, idx) => {
                        const maxQty = parseFloat(data.top_products[0].net_quantity_sold) || 1;
                        const currentQty = parseFloat(p.net_quantity_sold) || 0;
                        const pct = Math.min(100, Math.round((currentQty / maxQty) * 100));

                        return (
                          <div key={p.product_id} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                              <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
                                #{idx + 1} {p.name}
                                <span style={{ color: "var(--color-text-muted)", marginLeft: "6px", fontSize: "11px" }}>
                                  ({p.sku})
                                </span>
                              </span>
                              <span style={{ fontWeight: 700, color: "var(--color-text)" }}>
                                {formatNumber(p.net_quantity_sold)} {p.unit} ({formatCurrency(p.net_sales)})
                              </span>
                            </div>
                            <div style={{ height: "6px", backgroundColor: "var(--color-bg)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                              <div
                                style={{
                                  height: "100%",
                                  width: `${pct}%`,
                                  backgroundColor: idx === 0 ? "var(--color-primary)" : "var(--color-primary-soft)",
                                  borderRadius: "var(--radius-full)",
                                  transition: "width 0.3s ease",
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
                    backgroundColor: "var(--color-surface)",
                    borderRadius: "var(--radius-lg)",
                    padding: "20px",
                    border: "1px solid var(--color-border)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text)", margin: "0 0 4px" }}>
                    Expense Breakdown
                  </h2>
                  <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                    Today&apos;s expenses grouped by category
                  </span>

                  <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {!data.expense_breakdown || data.expense_breakdown.length === 0 ? (
                      <div style={{ padding: "32px 0", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
                        No operating expenses recorded for today.
                      </div>
                    ) : (
                      data.expense_breakdown.map((exp) => (
                        <div key={exp.category} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                            <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
                              {exp.category}
                            </span>
                            <span style={{ fontWeight: 700, color: "var(--color-danger)" }}>
                              {formatCurrency(exp.amount)}{" "}
                              <span style={{ color: "var(--color-text-secondary)", fontWeight: 500, fontSize: "12px" }}>
                                ({exp.percentage}%)
                              </span>
                            </span>
                          </div>
                          <div style={{ height: "6px", backgroundColor: "var(--color-bg)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.min(100, parseFloat(exp.percentage) || 0)}%`,
                                backgroundColor: "var(--color-danger)",
                                borderRadius: "var(--radius-full)",
                                transition: "width 0.3s ease",
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
                  gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
                  gap: "20px",
                }}
              >
                {/* Inventory Alerts Table */}
                <div
                  style={{
                    backgroundColor: "var(--color-surface)",
                    borderRadius: "var(--radius-lg)",
                    padding: "20px",
                    border: "1px solid var(--color-border)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
                      Critical Inventory Alerts
                    </h2>
                    <Link
                      to="/inventory"
                      style={{ fontSize: "13px", color: "var(--color-primary)", fontWeight: 600, textDecoration: "none" }}
                    >
                      View Inventory →
                    </Link>
                  </div>

                  {!data.inventory_alerts || data.inventory_alerts.length === 0 ? (
                    <div style={{ padding: "32px 0", textAlign: "center", color: "var(--color-success)", fontSize: "13px", fontWeight: 500 }}>
                      All stock levels are healthy! No critical alerts.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-secondary)", textAlign: "left" }}>
                            <th style={{ padding: "8px 8px 8px 0" }}>Product</th>
                            <th style={{ padding: "8px" }}>Stock</th>
                            <th style={{ padding: "8px" }}>Reorder</th>
                            <th style={{ padding: "8px 0 8px 8px" }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.inventory_alerts.map((a) => (
                            <tr key={a.id} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                              <td style={{ padding: "10px 8px 10px 0" }}>
                                <div style={{ fontWeight: 600, color: "var(--color-text)" }}>{a.name}</div>
                                <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{a.sku}</div>
                              </td>
                              <td style={{ padding: "10px 8px", fontWeight: 700, color: "var(--color-text)" }}>
                                {formatNumber(a.stock_quantity)} {a.unit}
                              </td>
                              <td style={{ padding: "10px 8px", color: "var(--color-text-secondary)" }}>
                                {formatNumber(a.reorder_level)} {a.unit}
                              </td>
                              <td style={{ padding: "10px 0 10px 8px" }}>
                                <StatusBadge
                                  status={a.status === "OUT_OF_STOCK" ? "OUT OF STOCK" : "LOW STOCK"}
                                  variant={a.status === "OUT_OF_STOCK" ? "danger" : "warning"}
                                />
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
                    backgroundColor: "var(--color-surface)",
                    borderRadius: "var(--radius-lg)",
                    padding: "20px",
                    border: "1px solid var(--color-border)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
                      Recent Activity
                    </h2>
                    <div style={{ display: "flex", gap: "4px", backgroundColor: "var(--color-bg)", padding: "3px", borderRadius: "var(--radius-md)" }}>
                      <button
                        type="button"
                        onClick={() => setSelectedTab("sales")}
                        style={{
                          padding: "4px 10px",
                          fontSize: "12px",
                          fontWeight: 600,
                          border: "none",
                          borderRadius: "var(--radius-sm)",
                          cursor: "pointer",
                          backgroundColor: selectedTab === "sales" ? "var(--color-surface)" : "transparent",
                          color: selectedTab === "sales" ? "var(--color-primary)" : "var(--color-text-secondary)",
                          boxShadow: selectedTab === "sales" ? "var(--shadow-sm)" : "none",
                        }}
                      >
                        Sales
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTab("returns")}
                        style={{
                          padding: "4px 10px",
                          fontSize: "12px",
                          fontWeight: 600,
                          border: "none",
                          borderRadius: "var(--radius-sm)",
                          cursor: "pointer",
                          backgroundColor: selectedTab === "returns" ? "var(--color-surface)" : "transparent",
                          color: selectedTab === "returns" ? "var(--color-danger)" : "var(--color-text-secondary)",
                          boxShadow: selectedTab === "returns" ? "var(--shadow-sm)" : "none",
                        }}
                      >
                        Returns
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTab("expenses")}
                        style={{
                          padding: "4px 10px",
                          fontSize: "12px",
                          fontWeight: 600,
                          border: "none",
                          borderRadius: "var(--radius-sm)",
                          cursor: "pointer",
                          backgroundColor: selectedTab === "expenses" ? "var(--color-surface)" : "transparent",
                          color: selectedTab === "expenses" ? "#9333ea" : "var(--color-text-secondary)",
                          boxShadow: selectedTab === "expenses" ? "var(--shadow-sm)" : "none",
                        }}
                      >
                        Expenses
                      </button>
                    </div>
                  </div>

                  {/* Tab 1: Sales */}
                  {selectedTab === "sales" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {!data.recent_sales || data.recent_sales.length === 0 ? (
                        <div style={{ padding: "32px 0", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
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
                              padding: "8px 0",
                              borderBottom: "1px solid var(--color-border-subtle)",
                              fontSize: "13px",
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, color: "var(--color-text)" }}>{s.invoice_number}</div>
                              <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                                {formatTime(s.created_at)} • Cashier: {s.cashier} ({s.item_count} items)
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 700, color: "var(--color-text)" }}>{formatCurrency(s.total)}</div>
                              <StatusBadge
                                status={s.status}
                                variant={s.status === "COMPLETED" ? "success" : s.status === "RETURNED" ? "purple" : "danger"}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Tab 2: Returns */}
                  {selectedTab === "returns" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {!data.recent_returns || data.recent_returns.length === 0 ? (
                        <div style={{ padding: "32px 0", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
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
                              padding: "8px 0",
                              borderBottom: "1px solid var(--color-border-subtle)",
                              fontSize: "13px",
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, color: "var(--color-text)" }}>{r.return_number}</div>
                              <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                                {formatTime(r.created_at)} • Inv: {r.invoice_number} • By: {r.processed_by}
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 700, color: "var(--color-danger)" }}>-{formatCurrency(r.refund_amount)}</div>
                              <StatusBadge status="COMPLETED" variant="success" />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Tab 3: Expenses */}
                  {selectedTab === "expenses" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {!data.recent_expenses || data.recent_expenses.length === 0 ? (
                        <div style={{ padding: "32px 0", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
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
                              padding: "8px 0",
                              borderBottom: "1px solid var(--color-border-subtle)",
                              fontSize: "13px",
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, color: "var(--color-text)" }}>
                                {e.category}
                                {e.description && <span style={{ fontWeight: 400, color: "var(--color-text-secondary)" }}> — {e.description}</span>}
                              </div>
                              <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                                {e.expense_date} • By: {e.recorded_by}
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 700, color: "var(--color-danger)" }}>{formatCurrency(e.amount)}</div>
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
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Operational Counts */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "16px",
                }}
              >
                <KpiCard
                  title="Low Stock Items"
                  value={data.inventory?.low_stock || 0}
                  subtext="Requires replenishment order"
                  accentColor="var(--color-warning)"
                  id="staff-kpi-low-stock"
                />
                <KpiCard
                  title="Out of Stock Items"
                  value={data.inventory?.out_of_stock || 0}
                  subtext="Urgent stock depleted"
                  accentColor="var(--color-danger)"
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
                  backgroundColor: "var(--color-surface)",
                  borderRadius: "var(--radius-lg)",
                  padding: "20px",
                  border: "1px solid var(--color-border)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div>
                    <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
                      Critical Stock Alerts
                    </h2>
                    <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                      Prioritized list of items needing attention
                    </span>
                  </div>
                  <Link
                    to="/inventory"
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "var(--color-primary)",
                      color: "#ffffff",
                      borderRadius: "var(--radius-md)",
                      fontSize: "13px",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Open Inventory Manager
                  </Link>
                </div>

                {!data.inventory_alerts || data.inventory_alerts.length === 0 ? (
                  <div style={{ padding: "40px 0", textAlign: "center", color: "var(--color-success)", fontWeight: 500 }}>
                    No low stock or out of stock items detected!
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-secondary)", textAlign: "left" }}>
                          <th style={{ padding: "10px 8px 10px 0" }}>Product Name</th>
                          <th style={{ padding: "10px 8px" }}>SKU</th>
                          <th style={{ padding: "10px 8px" }}>Current Stock</th>
                          <th style={{ padding: "10px 8px" }}>Reorder Level</th>
                          <th style={{ padding: "10px 8px" }}>Alert Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.inventory_alerts.map((item) => (
                          <tr key={item.id} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                            <td style={{ padding: "10px 8px 10px 0", fontWeight: 600, color: "var(--color-text)" }}>
                              {item.name}
                            </td>
                            <td style={{ padding: "10px 8px", color: "var(--color-text-secondary)" }}>{item.sku}</td>
                            <td style={{ padding: "10px 8px", fontWeight: 700, color: item.status === "OUT_OF_STOCK" ? "var(--color-danger)" : "var(--color-warning)" }}>
                              {formatNumber(item.stock_quantity)} {item.unit}
                            </td>
                            <td style={{ padding: "10px 8px", color: "var(--color-text-secondary)" }}>
                              {formatNumber(item.reorder_level)} {item.unit}
                            </td>
                            <td style={{ padding: "10px 8px" }}>
                              <StatusBadge
                                status={item.status === "OUT_OF_STOCK" ? "OUT OF STOCK" : "LOW STOCK"}
                                variant={item.status === "OUT_OF_STOCK" ? "danger" : "warning"}
                              />
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
                  gap: "20px",
                }}
              >
                {/* Quick Links */}
                <div
                  style={{
                    backgroundColor: "var(--color-surface)",
                    borderRadius: "var(--radius-lg)",
                    padding: "20px",
                    border: "1px solid var(--color-border)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text)", margin: "0 0 16px" }}>
                    Operational Shortcuts
                  </h2>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <QuickLinkButton to="/inventory" title="Manage Inventory" color="var(--color-primary)" />
                    <QuickLinkButton to="/purchases" title="Purchase Orders" color="#4f46e5" />
                    <QuickLinkButton to="/expenses" title="Record Expense" color="#059669" />
                    <QuickLinkButton to="/suppliers" title="Supplier Directory" color="#7c3aed" />
                  </div>
                </div>

                {/* Recent Operating Expenses */}
                <div
                  style={{
                    backgroundColor: "var(--color-surface)",
                    borderRadius: "var(--radius-lg)",
                    padding: "20px",
                    border: "1px solid var(--color-border)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text)", margin: "0 0 4px" }}>
                    Recent Expenses
                  </h2>
                  <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                    Recently logged store expenses
                  </span>

                  <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {!data.recent_expenses || data.recent_expenses.length === 0 ? (
                      <div style={{ padding: "32px 0", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
                        No expenses recorded yet.
                      </div>
                    ) : (
                      data.recent_expenses.map((e) => (
                        <div
                          key={e.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "8px 0",
                            borderBottom: "1px solid var(--color-border-subtle)",
                            fontSize: "13px",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--color-text)" }}>{e.category}</div>
                            <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                              {e.expense_date} • {e.recorded_by}
                            </div>
                          </div>
                          <div style={{ fontWeight: 700, color: "var(--color-text)" }}>{formatCurrency(e.amount)}</div>
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
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Cashier Personal KPIs */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "16px",
                }}
              >
                <KpiCard
                  title="My Sales Today"
                  value={formatCurrency(data.cashier_sales?.today_sales)}
                  subtext="Transactions processed by you today"
                  accentColor="var(--color-primary)"
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
                  gap: "16px",
                }}
              >
                <Link
                  to="/pos"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    backgroundColor: "var(--color-primary)",
                    color: "#ffffff",
                    padding: "18px 20px",
                    borderRadius: "var(--radius-lg)",
                    textDecoration: "none",
                    boxShadow: "var(--shadow-md)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 700 }}>Open POS Terminal</div>
                    <div style={{ fontSize: "12px", opacity: 0.9 }}>Process customer checkouts</div>
                  </div>
                </Link>

                <Link
                  to="/returns"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-danger)",
                    border: "1px solid var(--color-danger-soft)",
                    padding: "18px 20px",
                    borderRadius: "var(--radius-lg)",
                    textDecoration: "none",
                    boxShadow: "var(--shadow-sm)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-danger)" }}>Process Return / Refund</div>
                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Handle customer returns</div>
                  </div>
                </Link>

                <Link
                  to="/sales"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-text)",
                    border: "1px solid var(--color-border)",
                    padding: "18px 20px",
                    borderRadius: "var(--radius-lg)",
                    textDecoration: "none",
                    boxShadow: "var(--shadow-sm)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 700 }}>View Sales History</div>
                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Inspect past receipts</div>
                  </div>
                </Link>
              </div>

              {/* My Recent Sales */}
              <div
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderRadius: "var(--radius-lg)",
                  padding: "20px",
                  border: "1px solid var(--color-border)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
                    My Recent Checkouts
                  </h2>
                  <Link
                    to="/sales"
                    style={{ fontSize: "13px", color: "var(--color-primary)", fontWeight: 600, textDecoration: "none" }}
                  >
                    All Sales →
                  </Link>
                </div>

                {!data.recent_sales || data.recent_sales.length === 0 ? (
                  <div style={{ padding: "40px 0", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
                    No sales processed yet today. Ready for customers!
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-secondary)", textAlign: "left" }}>
                          <th style={{ padding: "10px 8px 10px 0" }}>Invoice #</th>
                          <th style={{ padding: "10px 8px" }}>Time</th>
                          <th style={{ padding: "10px 8px" }}>Items</th>
                          <th style={{ padding: "10px 8px" }}>Total</th>
                          <th style={{ padding: "10px 0 10px 8px" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recent_sales.map((s) => (
                          <tr key={s.id} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                            <td style={{ padding: "10px 8px 10px 0", fontWeight: 600, color: "var(--color-text)" }}>
                              {s.invoice_number}
                            </td>
                            <td style={{ padding: "10px 8px", color: "var(--color-text-secondary)" }}>{formatTime(s.created_at)}</td>
                            <td style={{ padding: "10px 8px", color: "var(--color-text-secondary)" }}>{s.item_count}</td>
                            <td style={{ padding: "10px 8px", fontWeight: 700, color: "var(--color-text)" }}>
                              {formatCurrency(s.total)}
                            </td>
                            <td style={{ padding: "10px 0 10px 8px" }}>
                              <StatusBadge
                                status={s.status}
                                variant={s.status === "COMPLETED" ? "success" : "danger"}
                              />
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
    </div>
  );
};

/* Subcomponents */

const KpiCard = ({ title, value, subtext, accentColor = "var(--color-primary)", badge, id }) => (
  <div
    id={id}
    style={{
      backgroundColor: "var(--color-surface)",
      borderRadius: "var(--radius-lg)",
      padding: "20px",
      border: "1px solid var(--color-border)",
      boxShadow: "var(--shadow-sm)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      borderLeft: `4px solid ${accentColor}`,
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)" }}>{title}</span>
      {badge && (
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            backgroundColor: "var(--color-bg)",
            color: "var(--color-text-secondary)",
            padding: "2px 6px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          {badge}
        </span>
      )}
    </div>
    <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-text)", letterSpacing: "-0.02em" }}>
      {value}
    </div>
    {subtext && (
      <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
      backgroundColor: "var(--color-surface)",
      borderRadius: "var(--radius-md)",
      padding: "16px",
      border: "1px solid var(--color-border)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      textDecoration: "none",
      transition: "border-color 0.15s ease",
    }}
  >
    <div>
      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>{label}</div>
      <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--color-text)" }}>{value}</div>
    </div>
    <span
      style={{
        backgroundColor: bgColor,
        color: color,
        padding: "4px 10px",
        borderRadius: "var(--radius-full)",
        fontWeight: 700,
        fontSize: "12px",
      }}
    >
      View →
    </span>
  </Link>
);

const QuickLinkButton = ({ to, title, color }) => (
  <Link
    to={to}
    style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "12px 14px",
      backgroundColor: "var(--color-bg)",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-md)",
      textDecoration: "none",
      color: "var(--color-text)",
      fontWeight: 600,
      fontSize: "13px",
      transition: "background-color 0.15s ease",
    }}
  >
    <span style={{ color }}>{title}</span>
  </Link>
);

const SalesTrendBarChart = ({ trend, formatCurrency, hoveredDay, setHoveredDay }) => {
  if (!trend || trend.length === 0) {
    return <div style={{ padding: "32px 0", textAlign: "center", color: "var(--color-text-muted)" }}>No trend data available.</div>;
  }

  const maxNet = Math.max(...trend.map((d) => parseFloat(d.net_sales) || 0), 100);

  return (
    <div style={{ position: "relative", marginTop: "16px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          height: "140px",
          paddingBottom: "24px",
          borderBottom: "1px solid var(--color-border)",
          gap: "8px",
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
              <div
                style={{
                  width: "100%",
                  maxWidth: "32px",
                  height: `${heightPct}%`,
                  backgroundColor: isHovered
                    ? "var(--color-primary-hover)"
                    : val > 0
                    ? "var(--color-primary)"
                    : "var(--color-border)",
                  borderRadius: "4px 4px 0 0",
                  transition: "all 0.15s ease",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  bottom: "-20px",
                  fontSize: "11px",
                  color: isHovered ? "var(--color-text)" : "var(--color-text-secondary)",
                  fontWeight: isHovered ? 700 : 500,
                }}
              >
                {day.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: "24px",
          minHeight: "32px",
          backgroundColor: "var(--color-bg)",
          borderRadius: "var(--radius-md)",
          padding: "6px 12px",
          fontSize: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "var(--color-text-secondary)",
        }}
      >
        {hoveredDay ? (
          <>
            <span>
              <strong>{hoveredDay.date}</strong>: Net Sales{" "}
              <strong style={{ color: "var(--color-primary)" }}>{formatCurrency(hoveredDay.net_sales)}</strong>
            </span>
            <span>
              (Gross: {formatCurrency(hoveredDay.gross_sales)} | Refunds: {formatCurrency(hoveredDay.refunds)})
            </span>
          </>
        ) : (
          <span style={{ color: "var(--color-text-muted)" }}>Hover over a bar to inspect daily breakdown</span>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
