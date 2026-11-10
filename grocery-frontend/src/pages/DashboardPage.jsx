import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import useAuth from "../context/AuthContext";
import { getDashboardOverviewApi } from "../api/dashboard";
import {
  DollarSign,
  ShoppingCart,
  Boxes,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  Package,
  Calendar,
  RotateCcw,
  Receipt,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { Card, Badge, Button, Table } from "../components/ui";
import { resolveUserName } from "../utils/userResolver";

export const DashboardPage = () => {
  const { user } = useAuth();
  const role = user?.role || "STAFF";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [activeTab, setActiveTab] = useState("sales"); // "sales" | "returns" | "expenses"
  const [hoveredTrendDay, setHoveredTrendDay] = useState(null);

  const fetchDashboard = useCallback(async (dateFilter) => {
    try {
      setLoading(true);
      setError("");
      const res = await getDashboardOverviewApi(dateFilter ? { date: dateFilter } : {});
      setData(res);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Failed to load dashboard overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(selectedDate);
  }, [fetchDashboard, selectedDate]);

  const formatCurrency = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "₱0.00";
    const formatted = Math.abs(num).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return num < 0 ? `-₱${formatted}` : `₱${formatted}`;
  };

  const formatQty = (val, unit = "") => {
    const num = parseFloat(val);
    if (isNaN(num)) return "0";
    const formatted = num % 1 === 0 ? num.toLocaleString() : num.toFixed(2);
    return unit ? `${formatted} ${unit}` : formatted;
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

  const formatDate = (isoStr) => {
    if (!isoStr) return "-";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return isoStr;
    }
  };

  // Extract backend payload fields
  const sales = data?.sales || {};
  const profit = data?.profit || {};
  const inventory = data?.inventory || {};
  const cashierSales = data?.cashier_sales || {};
  const trend = data?.trend || [];
  const topProducts = data?.top_products || [];
  const inventoryAlerts = data?.inventory_alerts || [];
  const recentSales = data?.recent_sales || [];
  const recentReturns = data?.recent_returns || [];
  const recentExpenses = data?.recent_expenses || [];

  // Computed metrics
  const netSalesVal = role === "CASHIER"
    ? parseFloat(cashierSales.today_sales || 0)
    : parseFloat(sales.net_sales || 0);

  const grossSalesVal = parseFloat(sales.gross_sales || 0);
  const refundsVal = parseFloat(sales.refunds || 0);

  const transactionsCount = role === "CASHIER"
    ? (cashierSales.transactions || 0)
    : (sales.transactions || 0);

  const avgOrderValue = transactionsCount > 0
    ? netSalesVal / transactionsCount
    : 0;

  const grossProfitVal = parseFloat(profit.estimated_gross_profit || 0);
  const netProfitVal = parseFloat(profit.estimated_net_profit || 0);
  const operatingExpensesVal = parseFloat(profit.operating_expenses || 0);

  const profitMarginPercent = netSalesVal > 0
    ? ((grossProfitVal / netSalesVal) * 100).toFixed(1)
    : "0.0";

  const activeProductsCount = inventory.active_products || 0;
  const lowStockCount = inventory.low_stock || inventoryAlerts.filter(a => a.status === "LOW_STOCK").length || 0;
  const outOfStockCount = inventory.out_of_stock || inventoryAlerts.filter(a => a.status === "OUT_OF_STOCK").length || 0;

  // Max value for 7-day trend chart scaling
  const maxTrendNet = Math.max(100, ...trend.map((d) => parseFloat(d.net_sales || 0)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Page Title & Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: 800,
                color: "var(--text-main)",
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              {role === "OWNER"
                ? "Command Center"
                : role === "CASHIER"
                ? "Cashier Operations"
                : "Store & Inventory Overview"}
            </h1>
            <Badge variant="primary" size="sm">
              {role}
            </Badge>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            {role === "OWNER"
              ? "Real-time enterprise metrics, sales volume, margin analysis, and stock intelligence."
              : role === "CASHIER"
              ? "Daily shift performance, register transaction tracking, and quick checkout actions."
              : "Catalog stock levels, low-stock threshold monitoring, and store inventory health."}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Date Picker Filter */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: "#ffffff",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "4px 10px",
              fontSize: "13px",
            }}
          >
            <Calendar size={15} style={{ color: "var(--color-slate-400)" }} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              title="Filter by business date"
              style={{
                border: "none",
                outline: "none",
                backgroundColor: "transparent",
                fontSize: "13px",
                color: "var(--text-main)",
                cursor: "pointer",
              }}
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate("")}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "11px",
                  color: "var(--color-primary-600)",
                  cursor: "pointer",
                  fontWeight: 600,
                  padding: "0 2px",
                }}
              >
                Clear
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            loading={loading}
            onClick={() => fetchDashboard(selectedDate)}
          >
            Refresh
          </Button>

          {["OWNER", "CASHIER"].includes(role) && (
            <Link to="/pos">
              <Button variant="primary" size="sm" icon={ShoppingCart}>
                Open POS Terminal
              </Button>
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "14px 16px",
            backgroundColor: "var(--color-danger-bg)",
            color: "var(--color-danger-text)",
            borderRadius: "var(--radius-md)",
            fontSize: "13.5px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* ================================================================= */}
      {/* 1. PRIMARY KPI CARDS                                              */}
      {/* ================================================================= */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
        }}
      >
        {/* KPI 1: Net Sales / Daily Revenue */}
        <Card padding="20px">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-muted)" }}>
                {role === "CASHIER" ? "My Daily Sales" : "Net Sales"}
              </span>
              <div
                className="tabular-nums"
                style={{
                  fontSize: "26px",
                  fontWeight: 800,
                  color: "var(--text-main)",
                  marginTop: "6px",
                  letterSpacing: "-0.02em",
                }}
              >
                {loading ? "..." : formatCurrency(netSalesVal)}
              </div>
            </div>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-primary-50)",
                color: "var(--color-primary-600)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <DollarSign size={20} />
            </div>
          </div>
          <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Badge variant="success" size="sm">
              {role === "CASHIER" ? "Shift" : "Today"}
            </Badge>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {role === "OWNER"
                ? `Gross: ${formatCurrency(grossSalesVal)} | Ref: ${formatCurrency(refundsVal)}`
                : `${transactionsCount} orders processed`}
            </span>
          </div>
        </Card>

        {/* KPI 2: Completed Transactions */}
        <Card padding="20px">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-muted)" }}>
                {role === "CASHIER" ? "My Completed Checkouts" : "Transactions Completed"}
              </span>
              <div
                className="tabular-nums"
                style={{
                  fontSize: "26px",
                  fontWeight: 800,
                  color: "var(--text-main)",
                  marginTop: "6px",
                  letterSpacing: "-0.02em",
                }}
              >
                {loading ? "..." : transactionsCount}
              </div>
            </div>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-info-bg)",
                color: "var(--color-info-text)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShoppingCart size={20} />
            </div>
          </div>
          <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Badge variant="info" size="sm">
              Average
            </Badge>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {formatCurrency(avgOrderValue)} per checkout
            </span>
          </div>
        </Card>

        {/* KPI 3: Profit / Margins (Owner) or Items Sold (Cashier) or Active Items (Staff) */}
        {role === "OWNER" && (
          <Card padding="20px">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-muted)" }}>
                  Est. Gross Profit
                </span>
                <div
                  className="tabular-nums"
                  style={{
                    fontSize: "26px",
                    fontWeight: 800,
                    color: "var(--color-primary-600)",
                    marginTop: "6px",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {loading ? "..." : formatCurrency(grossProfitVal)}
                </div>
              </div>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "#f5f3ff",
                  color: "#7c3aed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <TrendingUp size={20} />
              </div>
            </div>
            <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Badge variant="purple" size="sm">
                {profitMarginPercent}% Margin
              </Badge>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Net Profit: {formatCurrency(netProfitVal)}
              </span>
            </div>
          </Card>
        )}

        {role === "CASHIER" && (
          <Card padding="20px">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-muted)" }}>
                  POS Terminal Status
                </span>
                <div
                  style={{
                    fontSize: "22px",
                    fontWeight: 800,
                    color: "var(--color-success)",
                    marginTop: "8px",
                  }}
                >
                  Online & Active
                </div>
              </div>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-success-bg)",
                  color: "var(--color-success)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckCircle2 size={20} />
              </div>
            </div>
            <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Badge variant="success" size="sm">
                Ready
              </Badge>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Cash drawer & scanner synced
              </span>
            </div>
          </Card>
        )}

        {role === "STAFF" && (
          <Card padding="20px">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-muted)" }}>
                  Active Catalog Items
                </span>
                <div
                  className="tabular-nums"
                  style={{
                    fontSize: "26px",
                    fontWeight: 800,
                    color: "var(--color-primary-600)",
                    marginTop: "6px",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {loading ? "..." : activeProductsCount}
                </div>
              </div>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-primary-50)",
                  color: "var(--color-primary-600)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Package size={20} />
              </div>
            </div>
            <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Badge variant="primary" size="sm">
                Catalog
              </Badge>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Available store products
              </span>
            </div>
          </Card>
        )}

        {/* KPI 4: Inventory Alerts / Restock Attention */}
        <Card padding="20px">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-muted)" }}>
                Stock Alerts
              </span>
              <div
                className="tabular-nums"
                style={{
                  fontSize: "26px",
                  fontWeight: 800,
                  color: lowStockCount > 0 ? "var(--color-warning)" : "var(--color-success)",
                  marginTop: "6px",
                  letterSpacing: "-0.02em",
                }}
              >
                {loading ? "..." : lowStockCount + outOfStockCount}
              </div>
            </div>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "var(--radius-md)",
                backgroundColor:
                  lowStockCount + outOfStockCount > 0
                    ? "var(--color-warning-bg)"
                    : "var(--color-success-bg)",
                color:
                  lowStockCount + outOfStockCount > 0
                    ? "var(--color-warning)"
                    : "var(--color-success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Boxes size={20} />
            </div>
          </div>
          <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Badge variant={outOfStockCount > 0 ? "danger" : lowStockCount > 0 ? "warning" : "success"} size="sm">
              {outOfStockCount > 0 ? `${outOfStockCount} Out of Stock` : lowStockCount > 0 ? `${lowStockCount} Low Stock` : "Healthy"}
            </Badge>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {activeProductsCount} total products
            </span>
          </div>
        </Card>
      </div>

      {/* ================================================================= */}
      {/* 2. OWNER SECONDARY STATS BAR & 7-DAY TREND CHART                  */}
      {/* ================================================================= */}
      {role === "OWNER" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "24px",
          }}
        >
          {/* 7-Day Net Sales Trend Bar Chart */}
          <Card
            title="7-Day Sales Trend"
            subtitle="Daily Net Sales performance tracking over the last 7 business days"
            icon={TrendingUp}
          >
            {trend.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px 16px", color: "var(--text-muted)" }}>
                No historical trend data available yet.
              </div>
            ) : (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    height: "140px",
                    paddingBottom: "24px",
                    borderBottom: "1px solid var(--border-subtle)",
                    gap: "10px",
                  }}
                >
                  {trend.map((day) => {
                    const netVal = parseFloat(day.net_sales || 0);
                    const heightPct = Math.max(10, Math.min(100, Math.round((netVal / maxTrendNet) * 100)));
                    const isHovered = hoveredTrendDay?.date === day.date;

                    return (
                      <div
                        key={day.date}
                        onMouseEnter={() => setHoveredTrendDay(day)}
                        onMouseLeave={() => setHoveredTrendDay(null)}
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
                            maxWidth: "36px",
                            height: `${heightPct}%`,
                            backgroundColor: isHovered
                              ? "var(--color-primary-700)"
                              : netVal > 0
                              ? "var(--color-primary-600)"
                              : "var(--color-slate-200)",
                            borderRadius: "4px 4px 0 0",
                            transition: "all 0.15s ease",
                          }}
                        />
                        <span
                          style={{
                            position: "absolute",
                            bottom: "-20px",
                            fontSize: "11px",
                            color: isHovered ? "var(--color-primary-700)" : "var(--text-muted)",
                            fontWeight: isHovered ? 700 : 500,
                          }}
                        >
                          {day.date.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Hover / Status Banner */}
                <div
                  style={{
                    marginTop: "24px",
                    minHeight: "36px",
                    backgroundColor: "var(--color-slate-50)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    padding: "8px 12px",
                    fontSize: "12.5px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  {hoveredTrendDay ? (
                    <>
                      <span>
                        <strong>{hoveredTrendDay.date}</strong>: Net Sales{" "}
                        <strong style={{ color: "var(--color-primary-700)" }}>
                          {formatCurrency(hoveredTrendDay.net_sales)}
                        </strong>
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>
                        Gross: {formatCurrency(hoveredTrendDay.gross_sales)} | Refunds: {formatCurrency(hoveredTrendDay.refunds)}
                      </span>
                    </>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>
                      Hover over any day bar to view detailed daily gross, refunds, and net revenue.
                    </span>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Financial Breakdown & Secondary Metrics */}
          <Card
            title="Operating Breakdown"
            subtitle="Financial health summary and store operational figures"
            icon={DollarSign}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  backgroundColor: "var(--color-slate-50)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>
                    Gross Sales Revenue
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    Total register sales before deductions
                  </div>
                </div>
                <div className="tabular-nums" style={{ fontSize: "14px", fontWeight: 700 }}>
                  {formatCurrency(grossSalesVal)}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  backgroundColor: "var(--color-slate-50)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-danger)" }}>
                    Customer Refunds
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    Processed return adjustments
                  </div>
                </div>
                <div className="tabular-nums" style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-danger)" }}>
                  -{formatCurrency(refundsVal)}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  backgroundColor: "var(--color-slate-50)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>
                    Cost of Goods Sold (COGS)
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    Net cost of items sold from inventory
                  </div>
                </div>
                <div className="tabular-nums" style={{ fontSize: "14px", fontWeight: 700 }}>
                  {formatCurrency(profit.net_cogs || 0)}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  backgroundColor: "var(--color-primary-50)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-primary-100)",
                }}
              >
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-primary-800)" }}>
                    Estimated Net Profit
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--color-primary-700)" }}>
                    After COGS and operating deductions
                  </div>
                </div>
                <div className="tabular-nums" style={{ fontSize: "16px", fontWeight: 800, color: "var(--color-primary-800)" }}>
                  {formatCurrency(netProfitVal)}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. PRODUCT & INVENTORY INTELLIGENCE                               */}
      {/* ================================================================= */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
          gap: "24px",
        }}
      >
        {/* Top Selling Products */}
        <Card
          title="Top Selling Products"
          subtitle="Highest grossing grocery items sold today"
          icon={Package}
        >
          {topProducts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 16px", color: "var(--text-muted)" }}>
              No item sales recorded for the selected period.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {topProducts.slice(0, 6).map((item, idx) => (
                <div
                  key={item.product_id || idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--color-slate-50)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "26px",
                        height: "26px",
                        borderRadius: "50%",
                        backgroundColor: idx === 0 ? "var(--color-primary-100)" : "var(--color-slate-200)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: idx === 0 ? "var(--color-primary-700)" : "var(--color-slate-700)",
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13.5px", color: "var(--text-main)" }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        SKU: {item.sku || "N/A"}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div className="tabular-nums" style={{ fontWeight: 700, fontSize: "13.5px" }}>
                      {formatCurrency(item.net_sales)}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--color-primary-700)", fontWeight: 600 }}>
                      {formatQty(item.net_quantity_sold)} {item.unit || "pcs"} sold
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Critical Low Stock Items */}
        <Card
          title="Stock Alerts & Reorder Points"
          subtitle="Products below minimum safe operating inventory"
          icon={AlertTriangle}
          action={
            <Link to="/inventory">
              <span
                style={{
                  fontSize: "12.5px",
                  color: "var(--color-primary-600)",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                }}
              >
                Inventory Manager <ArrowUpRight size={14} />
              </span>
            </Link>
          }
        >
          {inventoryAlerts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 16px", color: "var(--color-success)", fontWeight: 500 }}>
              All inventory levels are safely above reorder thresholds!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {inventoryAlerts.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: item.status === "OUT_OF_STOCK" ? "var(--color-danger-bg)" : "var(--color-warning-bg)",
                    border: `1px solid ${item.status === "OUT_OF_STOCK" ? "var(--color-danger-border)" : "var(--color-warning-border)"}`,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "13.5px",
                        color: item.status === "OUT_OF_STOCK" ? "var(--color-danger-text)" : "var(--color-warning-text)",
                      }}
                    >
                      {item.name}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: item.status === "OUT_OF_STOCK" ? "var(--color-danger-text)" : "var(--color-warning-text)",
                        opacity: 0.85,
                      }}
                    >
                      SKU: {item.sku} • Reorder point: {formatQty(item.reorder_level)} {item.unit || ""}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <Badge variant={item.status === "OUT_OF_STOCK" ? "danger" : "warning"} size="sm">
                      {formatQty(item.stock_quantity)} {item.unit || ""} in stock
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ================================================================= */}
      {/* 4. RECENT ACTIVITY LEDGER (SALES, RETURNS, EXPENSES)              */}
      {/* ================================================================= */}
      <Card
        title="Store Operations Ledger"
        subtitle="Recent customer checkouts, refund adjustments, and operating expenses"
        action={
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              onClick={() => setActiveTab("sales")}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-sm)",
                fontSize: "12px",
                fontWeight: 600,
                border: "1px solid",
                borderColor: activeTab === "sales" ? "var(--color-primary-600)" : "var(--border-subtle)",
                backgroundColor: activeTab === "sales" ? "var(--color-primary-50)" : "#ffffff",
                color: activeTab === "sales" ? "var(--color-primary-700)" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              Sales ({recentSales.length})
            </button>
            {role === "OWNER" && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab("returns")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "12px",
                    fontWeight: 600,
                    border: "1px solid",
                    borderColor: activeTab === "returns" ? "var(--color-primary-600)" : "var(--border-subtle)",
                    backgroundColor: activeTab === "returns" ? "var(--color-primary-50)" : "#ffffff",
                    color: activeTab === "returns" ? "var(--color-primary-700)" : "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  Returns ({recentReturns.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("expenses")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "12px",
                    fontWeight: 600,
                    border: "1px solid",
                    borderColor: activeTab === "expenses" ? "var(--color-primary-600)" : "var(--border-subtle)",
                    backgroundColor: activeTab === "expenses" ? "var(--color-primary-50)" : "#ffffff",
                    color: activeTab === "expenses" ? "var(--color-primary-700)" : "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  Expenses ({recentExpenses.length})
                </button>
              </>
            )}
          </div>
        }
      >
        {activeTab === "sales" && (
          <Table
            columns={[
              {
                header: "Invoice #",
                key: "invoice_number",
                render: (val) => (
                  <span style={{ fontWeight: 600, color: "var(--color-primary-700)" }}>
                    {val}
                  </span>
                ),
              },
              {
                header: "Cashier",
                key: "cashier",
                render: (val) => resolveUserName(val, "Cashier"),
              },
              {
                header: "Items",
                key: "item_count",
                align: "center",
                render: (val) => `${val || 1} item${val === 1 ? "" : "s"}`,
              },
              {
                header: "Status",
                key: "status",
                render: (val) => (
                  <Badge variant={val === "COMPLETED" ? "success" : "danger"} size="sm">
                    {val || "COMPLETED"}
                  </Badge>
                ),
              },
              {
                header: "Total",
                key: "total",
                align: "right",
                render: (val) => (
                  <span className="tabular-nums" style={{ fontWeight: 700 }}>
                    {formatCurrency(val)}
                  </span>
                ),
              },
              {
                header: "Time",
                key: "created_at",
                align: "right",
                render: (val) => formatTime(val),
              },
            ]}
            data={recentSales.slice(0, 8)}
            emptyMessage="No sales transactions recorded yet."
          />
        )}

        {activeTab === "returns" && (
          <Table
            columns={[
              {
                header: "Return #",
                key: "return_number",
                render: (val) => (
                  <span style={{ fontWeight: 600, color: "var(--color-danger)" }}>
                    {val}
                  </span>
                ),
              },
              {
                header: "Original Invoice",
                key: "invoice_number",
                render: (val) => (
                  <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>
                    {val}
                  </span>
                ),
              },
              {
                header: "Processed By",
                key: "processed_by",
                render: (val) => resolveUserName(val, "Staff"),
              },
              {
                header: "Refund Amount",
                key: "refund_amount",
                align: "right",
                render: (val) => (
                  <span className="tabular-nums" style={{ fontWeight: 700, color: "var(--color-danger)" }}>
                    -{formatCurrency(val)}
                  </span>
                ),
              },
              {
                header: "Time",
                key: "created_at",
                align: "right",
                render: (val) => formatTime(val),
              },
            ]}
            data={recentReturns.slice(0, 8)}
            emptyMessage="No returns processed yet."
          />
        )}

        {activeTab === "expenses" && (
          <Table
            columns={[
              {
                header: "Category",
                key: "category",
                render: (val) => (
                  <Badge variant="purple" size="sm">
                    {val}
                  </Badge>
                ),
              },
              {
                header: "Description",
                key: "description",
                render: (val) => val || "-",
              },
              {
                header: "Logged By",
                key: "recorded_by",
                render: (val) => resolveUserName(val, "Admin"),
              },
              {
                header: "Date",
                key: "expense_date",
                render: (val) => formatDate(val),
              },
              {
                header: "Amount",
                key: "amount",
                align: "right",
                render: (val) => (
                  <span className="tabular-nums" style={{ fontWeight: 700 }}>
                    {formatCurrency(val)}
                  </span>
                ),
              },
            ]}
            data={recentExpenses.slice(0, 8)}
            emptyMessage="No store operating expenses logged yet."
          />
        )}
      </Card>
    </div>
  );
};

export default DashboardPage;
