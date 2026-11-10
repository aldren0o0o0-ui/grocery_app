import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  RotateCcw,
  Search,
  Plus,
  Eye,
  AlertCircle,
  TrendingDown,
  Receipt,
  Boxes,
} from "lucide-react";
import {
  getReturnsApi,
  getReturnDetailApi,
  createReturnApi,
} from "../api/returns";
import { getSaleDetailApi } from "../api/sales";
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

export const ReturnsPage = () => {
  const { showToast } = useToast();
  const location = useLocation();

  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Process Return Modal
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [saleLookupId, setSaleLookupId] = useState("");
  const [lookingUpSale, setLookingUpSale] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [saleData, setSaleData] = useState(null);
  const [returnItems, setReturnItems] = useState({}); // { [sale_item_id]: qty }
  const [refundMethod, setRefundMethod] = useState("CASH");
  const [returnReason, setReturnReason] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState("");

  // Detail Modal
  const [selectedReturn, setSelectedReturn] = useState(null);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      const res = await getReturnsApi(params);
      const returnList = res.returns || res.data?.returns || res.items || (Array.isArray(res) ? res : []);
      setReturns(returnList);
    } catch (err) {
      showToast(err.response?.data?.error?.message || "Failed to load returns history.", "error");
    } finally {
      setLoading(false);
    }
  }, [search, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReturns();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchReturns]);

  // Handle auto-open if navigated from Sales page with state: { saleId }
  useEffect(() => {
    if (location.state?.saleId) {
      setSaleLookupId(String(location.state.saleId));
      setIsProcessModalOpen(true);
      handleLookupSale(String(location.state.saleId));
    }
  }, [location.state]);

  const handleOpenProcessModal = () => {
    setSaleLookupId("");
    setSaleData(null);
    setReturnItems({});
    setRefundMethod("CASH");
    setReturnReason("");
    setLookupError("");
    setReturnError("");
    setIsProcessModalOpen(true);
  };

  const handleLookupSale = async (idQuery) => {
    const cleanId = idQuery.trim().replace(/^#|^SAL-|^REC-/, "");
    if (!cleanId) {
      setLookupError("Please specify a receipt or invoice ID.");
      return;
    }

    setLookingUpSale(true);
    setLookupError("");
    try {
      const res = await getSaleDetailApi(cleanId);
      const s = res.sale || res.data?.sale || res;
      if (!s || !s.id) {
        setLookupError("Sale transaction not found. Please check invoice number.");
        setSaleData(null);
      } else {
        setSaleData(s);
        // Initialize return items map to 0
        const initial = {};
        (s.items || []).forEach((it) => {
          initial[it.id] = 0;
        });
        setReturnItems(initial);
      }
    } catch (err) {
      setLookupError(err.response?.data?.error?.message || "Receipt not found in database.");
      setSaleData(null);
    } finally {
      setLookingUpSale(false);
    }
  };

  const handleExecuteReturn = async (e) => {
    e?.preventDefault();
    setReturnError("");

    if (!saleData) {
      setReturnError("Please look up a valid completed sale first.");
      return;
    }

    const itemsPayload = Object.entries(returnItems)
      .filter(([_, qty]) => parseFloat(qty) > 0)
      .map(([saleItemId, qty]) => ({
        sale_item_id: Number(saleItemId),
        quantity: parseFloat(qty),
      }));

    if (itemsPayload.length === 0) {
      setReturnError("Please specify a return quantity of at least 1 item.");
      return;
    }

    if (!returnReason.trim()) {
      setReturnError("Please state the reason for this customer return.");
      return;
    }

    setSubmittingReturn(true);
    try {
      await createReturnApi({
        sale_id: saleData.id,
        items: itemsPayload,
        refund_method: refundMethod,
        reason: returnReason.trim(),
      });

      showToast("Return processed. Inventory stock has been restored.", "success");
      setIsProcessModalOpen(false);
      fetchReturns();
    } catch (err) {
      setReturnError(err.response?.data?.error?.message || "Failed to process return.");
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleOpenDetail = async (ret) => {
    try {
      const res = await getReturnDetailApi(ret.id);
      setSelectedReturn(res.return || res.data?.return || res);
    } catch (err) {
      showToast("Failed to load return details.", "error");
    }
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "₱0.00";
    return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Aggregated totals
  const totalRefundAmount = returns.reduce((sum, r) => sum + parseFloat(r.refund_amount ?? r.total_refund_amount ?? 0), 0);
  const totalReturnsCount = returns.length;

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
            Returns & Refund Processing
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Audit return requests, issue customer cash/credit refunds, and automatically restore shelf inventory.
          </p>
        </div>

        <Button variant="primary" icon={Plus} onClick={handleOpenProcessModal}>
          Process Item Return
        </Button>
      </div>

      {/* Summary KPI Cards */}
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
                Total Refunds Disbursed
              </div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: "24px",
                  fontWeight: 800,
                  color: "var(--color-danger)",
                  marginTop: "4px",
                }}
              >
                -{formatCurrency(totalRefundAmount)}
              </div>
            </div>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-danger-bg)",
                color: "var(--color-danger)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TrendingDown size={18} />
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
            Across {totalReturnsCount} processed returns
          </div>
        </Card>

        <Card padding="18px">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                Total Return Transactions
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
                {totalReturnsCount}
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
              <RotateCcw size={18} />
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
            Audited customer returns
          </div>
        </Card>

        <Card padding="18px">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                Stock Reconciliation
              </div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: "20px",
                  fontWeight: 800,
                  color: "var(--color-success)",
                  marginTop: "4px",
                }}
              >
                Auto-Restored
              </div>
            </div>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-success-bg)",
                color: "var(--color-success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Boxes size={18} />
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
            Inventory synced with return ledger
          </div>
        </Card>
      </div>

      {/* Filter / Search Bar */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          padding: "16px",
          backgroundColor: "#ffffff",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-xs)",
        }}
      >
        <div style={{ flex: 1, maxWidth: "380px" }}>
          <Input
            placeholder="Search by return #, original invoice #, reason..."
            icon={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <Table
        columns={[
          {
            header: "Return #",
            key: "return_number",
            render: (val, row) => (
              <span style={{ fontWeight: 700, color: "var(--color-danger)" }}>
                {val || row.return_number || `#${row.id}`}
              </span>
            ),
          },
          {
            header: "Original Invoice #",
            key: "original_invoice_number",
            render: (val, row) => (
              <span style={{ fontWeight: 600, color: "var(--color-primary-700)" }}>
                {val || row.original_invoice_number || row.sale_receipt_number || `Sale #${row.sale_id}`}
              </span>
            ),
          },
          {
            header: "Date & Time",
            key: "created_at",
            render: (val) => (val ? new Date(val).toLocaleString() : "-"),
          },
          {
            header: "Refund Method",
            key: "refund_method",
            align: "center",
            render: (val) => (
              <Badge variant={val === "CASH" ? "success" : "info"} size="sm">
                {val || "CASH"}
              </Badge>
            ),
          },
          {
            header: "Refund Amount",
            key: "refund_amount",
            align: "right",
            render: (val, row) => {
              const amount = val ?? row.refund_amount ?? row.total_refund_amount ?? 0;
              return (
                <span className="tabular-nums" style={{ fontWeight: 700, color: "var(--color-danger)" }}>
                  -{formatCurrency(amount)}
                </span>
              );
            },
          },
          {
            header: "Return Reason",
            key: "reason",
            render: (val, row) => (
              <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                {val || row.reason || "Customer return"}
              </span>
            ),
          },
          {
            header: "Processed By",
            key: "processor_name",
            render: (val, row) => resolveUserName(row.processor?.id || row.processor_id || row.processor || val || row.processor_name || row.processed_by || row.processed_by_name, "Cashier/Owner"),
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
        data={returns}
        loading={loading}
        emptyMessage="No returns have been processed."
        emptyIcon={RotateCcw}
      />

      {/* Process Return Modal */}
      <Modal
        isOpen={isProcessModalOpen}
        onClose={() => setIsProcessModalOpen(false)}
        title="Process Customer Return"
        subtitle="Lookup original receipt to select items and calculate refund."
        maxWidth="540px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Sale lookup input */}
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Enter Original Sale / Invoice #"
                placeholder="e.g. SAL-20260922-0001 or 344"
                value={saleLookupId}
                onChange={(e) => setSaleLookupId(e.target.value)}
                autoFocus
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => handleLookupSale(saleLookupId)}
              loading={lookingUpSale}
            >
              Lookup Sale
            </Button>
          </div>

          {lookupError && (
            <div
              style={{
                padding: "10px 14px",
                backgroundColor: "var(--color-danger-bg)",
                color: "var(--color-danger-text)",
                borderRadius: "var(--radius-md)",
                fontSize: "13px",
              }}
            >
              {lookupError}
            </div>
          )}

          {returnError && (
            <div
              style={{
                padding: "10px 14px",
                backgroundColor: "var(--color-danger-bg)",
                color: "var(--color-danger-text)",
                borderRadius: "var(--radius-md)",
                fontSize: "13px",
                fontWeight: 500,
              }}
            >
              {returnError}
            </div>
          )}

          {saleData && (
            <form onSubmit={handleExecuteReturn} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-slate-50)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "12.5px",
                }}
              >
                <div>
                  <strong>Invoice:</strong> {saleData.invoice_number || saleData.receipt_number || `#${saleData.id}`}
                </div>
                <div>
                  <strong>Date:</strong> {new Date(saleData.created_at).toLocaleDateString()}
                </div>
                <div>
                  <strong>Total Paid:</strong> {formatCurrency(saleData.total ?? saleData.total_amount)}
                </div>
              </div>

              {/* Items to return table */}
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "8px" }}>
                  Select Items & Return Quantities:
                </label>
                <div
                  style={{
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                  }}
                >
                  {(saleData.items || []).map((it) => (
                    <div
                      key={it.id}
                      style={{
                        padding: "10px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottom: "1px solid var(--color-slate-100)",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "13px" }}>
                          {it.product_name || it.name}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                          Purchased: {it.quantity} @ {formatCurrency(it.unit_price)}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Return Qty:</span>
                        <input
                          type="number"
                          min="0"
                          max={it.quantity}
                          value={returnItems[it.id] || 0}
                          onChange={(e) =>
                            setReturnItems({
                              ...returnItems,
                              [it.id]: Math.min(Number(e.target.value), it.quantity),
                            })
                          }
                          style={{
                            width: "60px",
                            textAlign: "center",
                            padding: "4px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--color-slate-300)",
                            fontSize: "13px",
                            fontWeight: 600,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Select
                label="Refund Method"
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value)}
              >
                <option value="CASH">Cash Refund</option>
                <option value="GCASH">GCash / Digital Tender</option>
                <option value="CARD">Card Reversal</option>
              </Select>

              <Input
                label="Reason for Return"
                placeholder="e.g. Expired product, damaged packaging, customer changed mind"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                required
              />

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "8px",
                }}
              >
                <Button
                  variant="secondary"
                  onClick={() => setIsProcessModalOpen(false)}
                  disabled={submittingReturn}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={submittingReturn}>
                  Confirm & Process Refund
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* View Return Detail Modal */}
      <Modal
        isOpen={Boolean(selectedReturn)}
        onClose={() => setSelectedReturn(null)}
        title="Return Record Details"
        subtitle={`Return: ${selectedReturn?.return_number || `#${selectedReturn?.id}`} for Sale #${selectedReturn?.sale_id}`}
        maxWidth="460px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-slate-50)",
              border: "1px solid var(--border-subtle)",
              fontSize: "13px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div>
              <strong>Date:</strong> {selectedReturn?.created_at ? new Date(selectedReturn.created_at).toLocaleString() : "-"}
            </div>
            <div>
              <strong>Original Invoice:</strong> {selectedReturn?.original_invoice_number || `Sale #${selectedReturn?.sale_id}`}
            </div>
            <div>
              <strong>Refund Method:</strong> {selectedReturn?.refund_method}
            </div>
            <div>
              <strong>Processed By:</strong> {resolveUserName(selectedReturn?.processor?.id || selectedReturn?.processor || selectedReturn?.processor_name, "Cashier/Staff")}
            </div>
            <div>
              <strong>Reason:</strong> {selectedReturn?.reason}
            </div>
            <div>
              <strong>Total Refund:</strong>{" "}
              <span className="tabular-nums" style={{ fontWeight: 800, color: "var(--color-danger)" }}>
                -{formatCurrency(selectedReturn?.refund_amount ?? selectedReturn?.total_refund_amount ?? 0)}
              </span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>Returned Items</div>
            <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
              {(selectedReturn?.items || []).map((it, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: idx === selectedReturn.items.length - 1 ? "none" : "1px solid var(--color-slate-100)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px" }}>{it.product_name || "Item"}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {it.quantity} {it.product_unit || "pcs"} @ {formatCurrency(it.unit_price)}
                    </div>
                  </div>
                  <div className="tabular-nums" style={{ fontWeight: 700, color: "var(--color-danger)" }}>
                    -{formatCurrency(it.refund_subtotal || it.refund_amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ReturnsPage;
