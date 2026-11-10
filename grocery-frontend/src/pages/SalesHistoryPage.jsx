import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Receipt,
  Search,
  Eye,
  Printer,
  RotateCcw,
  DollarSign,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { getSalesApi, getSaleDetailApi } from "../api/sales";
import { resolveUserName } from "../utils/userResolver";
import {
  Button,
  Badge,
  Input,
  Select,
  Modal,
  Table,
  Card,
  useToast,
} from "../components/ui";

export const SalesHistoryPage = () => {
  const { showToast } = useToast();

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Sale Detail Modal
  const [selectedSale, setSelectedSale] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (paymentFilter !== "ALL") params.payment_method = paymentFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await getSalesApi(params);
      const salesList = res.sales || res.data?.sales || res.items || (Array.isArray(res) ? res : []);
      setSales(salesList);
    } catch (err) {
      showToast(err.response?.data?.error?.message || "Failed to load sales log.", "error");
    } finally {
      setLoading(false);
    }
  }, [search, paymentFilter, dateFrom, dateTo, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSales();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchSales]);

  const handleOpenDetail = async (sale) => {
    setDetailLoading(true);
    try {
      const res = await getSaleDetailApi(sale.id);
      setSelectedSale(res.sale || res.data?.sale || res);
    } catch (err) {
      showToast("Failed to fetch detailed sale receipt.", "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "₱0.00";
    return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Aggregated Summary
  const totalVolume = sales.reduce((sum, s) => sum + parseFloat(s.total ?? s.total_amount ?? 0), 0);
  const totalOrders = sales.length;
  const avgTicket = totalOrders > 0 ? totalVolume / totalOrders : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
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
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 800,
              color: "var(--text-main)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Sales Transactions & Audit
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Audit completed customer purchases, tender records, and print duplicate receipts.
          </p>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        <Card padding="18px">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                Total Sales Volume
              </div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: "24px",
                  fontWeight: 800,
                  color: "var(--color-primary-600)",
                  marginTop: "4px",
                }}
              >
                {formatCurrency(totalVolume)}
              </div>
            </div>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-primary-50)",
                color: "var(--color-primary-600)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
            Across {totalOrders} checkout sessions
          </div>
        </Card>

        <Card padding="18px">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                Transactions Count
              </div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: "24px",
                  fontWeight: 800,
                  color: "var(--text-main)",
                  marginTop: "4px",
                }}
              >
                {totalOrders}
              </div>
            </div>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-slate-100)",
                color: "var(--color-slate-700)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShoppingCart size={18} />
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
            Recorded completed receipts
          </div>
        </Card>

        <Card padding="18px">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                Average Basket Size
              </div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: "24px",
                  fontWeight: 800,
                  color: "var(--color-info-text)",
                  marginTop: "4px",
                }}
              >
                {formatCurrency(avgTicket)}
              </div>
            </div>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-info-bg)",
                color: "var(--color-info-text)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
            Average revenue per receipt
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "16px",
          backgroundColor: "#ffffff",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-xs)",
        }}
      >
        <div style={{ flex: 1, minWidth: "220px" }}>
          <Input
            placeholder="Search invoice #, cashier name..."
            icon={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ width: "160px" }}>
          <Select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="ALL">All Payments</option>
            <option value="CASH">Cash</option>
            <option value="GCASH">GCash</option>
            <option value="CARD">Card Tender</option>
          </Select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ width: "140px" }}
          />
          <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ width: "140px" }}
          />
        </div>
      </div>

      {/* Table */}
      <Table
        columns={[
          {
            header: "Receipt #",
            key: "invoice_number",
            render: (val, row) => (
              <button
                type="button"
                onClick={() => handleOpenDetail(row)}
                style={{
                  fontWeight: 700,
                  color: "var(--color-primary-700)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                }}
              >
                <Receipt size={16} />
                {val || row.invoice_number || row.receipt_number || `#${row.id}`}
              </button>
            ),
          },
          {
            header: "Date & Time",
            key: "created_at",
            render: (val) => (val ? new Date(val).toLocaleString() : "-"),
          },
          {
            header: "Cashier",
            key: "cashier_name",
            render: (val, row) => resolveUserName(row.cashier_id || row.cashier || val || row.cashier_name || row.user?.first_name, "Cashier"),
          },
          {
            header: "Payment",
            key: "payment_method",
            align: "center",
            render: (val, row) => {
              const method = val || (row.payments && row.payments[0]?.payment_method) || "CASH";
              return (
                <Badge variant={method === "CASH" ? "success" : "info"} size="sm">
                  {method}
                </Badge>
              );
            },
          },
          {
            header: "Total Amount",
            key: "total",
            align: "right",
            render: (val, row) => {
              const amount = val ?? row.total ?? row.total_amount ?? 0;
              return (
                <span className="tabular-nums" style={{ fontWeight: 800, color: "var(--text-main)" }}>
                  {formatCurrency(amount)}
                </span>
              );
            },
          },
          {
            header: "Status",
            key: "status",
            align: "center",
            render: (val, row) => {
              const st = val || row.status || "COMPLETED";
              return (
                <Badge variant={st === "REFUNDED" || row.return_state === "FULL" ? "danger" : row.return_state === "PARTIAL" ? "warning" : "success"} size="sm">
                  {st}
                </Badge>
              );
            },
          },
          {
            header: "Actions",
            key: "actions",
            align: "right",
            render: (_, row) => (
              <Button
                variant="ghost"
                size="xs"
                icon={Eye}
                onClick={() => handleOpenDetail(row)}
              >
                View
              </Button>
            ),
          },
        ]}
        data={sales}
        loading={loading}
        emptyMessage="No sales transactions found for this period."
        emptyIcon={Receipt}
      />

      {/* Sale Detail / Receipt Modal */}
      <Modal
        isOpen={Boolean(selectedSale)}
        onClose={() => setSelectedSale(null)}
        title="Transaction Breakdown"
        subtitle={`Invoice: ${selectedSale?.invoice_number || selectedSale?.receipt_number || `#${selectedSale?.id}`}`}
        maxWidth="480px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Metadata */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-slate-50)",
              border: "1px solid var(--border-subtle)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              fontSize: "12.5px",
            }}
          >
            <div>
              <span style={{ color: "var(--text-muted)" }}>Date:</span>{" "}
              <strong>{selectedSale?.created_at ? new Date(selectedSale.created_at).toLocaleString() : "-"}</strong>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Cashier:</span>{" "}
              <strong>{resolveUserName(selectedSale?.cashier?.id || selectedSale?.cashier_id || selectedSale?.cashier || selectedSale?.cashier_name, "Cashier")}</strong>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Payment Method:</span>{" "}
              <Badge variant={selectedSale?.payment_method === "CASH" ? "success" : "info"} size="sm">
                {selectedSale?.payment_method || (selectedSale?.payments && selectedSale.payments[0]?.payment_method) || "CASH"}
              </Badge>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Status:</span>{" "}
              <strong>{selectedSale?.status || "COMPLETED"}</strong>
            </div>
          </div>

          {/* Purchased Line Items */}
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)", marginBottom: "8px" }}>
              Purchased Items
            </div>
            <div
              style={{
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
              }}
            >
              {(selectedSale?.items || []).map((it, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: idx === selectedSale.items.length - 1 ? "none" : "1px solid var(--color-slate-100)",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px" }}>{it.product_name || it.name}</div>
                    <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                      {it.quantity} x {formatCurrency(it.unit_price)}
                    </div>
                  </div>
                  <div className="tabular-nums" style={{ fontWeight: 700, fontSize: "13.5px" }}>
                    {formatCurrency(it.subtotal || it.quantity * it.unit_price)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial summary */}
          <div
            style={{
              padding: "14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-slate-50)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "13px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Subtotal:</span>
              <span className="tabular-nums" style={{ fontWeight: 600 }}>
                {formatCurrency(selectedSale?.subtotal || selectedSale?.total || selectedSale?.total_amount)}
              </span>
            </div>

            {parseFloat(selectedSale?.discount || 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-danger)" }}>
                <span>Discount Applied:</span>
                <span className="tabular-nums">-{formatCurrency(selectedSale?.discount)}</span>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: "6px",
                borderTop: "1px solid var(--border-subtle)",
                fontWeight: 800,
                fontSize: "15px",
                color: "var(--color-primary-700)",
              }}
            >
              <span>Total Paid:</span>
              <span className="tabular-nums">
                {formatCurrency(selectedSale?.total ?? selectedSale?.total_amount ?? 0)}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)" }}>
              <span>Tendered:</span>
              <span>
                {formatCurrency(
                  (selectedSale?.payments && selectedSale.payments[0]?.amount_paid) ||
                  selectedSale?.payment?.amount_paid ||
                  selectedSale?.amount_paid ||
                  selectedSale?.total ||
                  selectedSale?.total_amount
                )}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)" }}>
              <span>Change Returned:</span>
              <span>
                {formatCurrency(
                  (selectedSale?.payments && selectedSale.payments[0]?.change_given) ||
                  selectedSale?.payment?.change ||
                  selectedSale?.change_amount ||
                  0
                )}
              </span>
            </div>
          </div>

          {/* Quick link to Returns if customer wants refund */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
            <Link to="/returns" state={{ saleId: selectedSale?.id }}>
              <Button variant="outline" size="sm" icon={RotateCcw}>
                Process Return / Refund
              </Button>
            </Link>

            <Button
              variant="secondary"
              size="sm"
              icon={Printer}
              onClick={() => window.print()}
            >
              Print Receipt
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SalesHistoryPage;
