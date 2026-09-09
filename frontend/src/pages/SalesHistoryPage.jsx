import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useAuth from "../modules/auth/useAuth";
import { getSalesApi, getSaleDetailApi } from "../modules/sales/api";
import { createReturnApi } from "../modules/returns/api";
import {
  PageHeader,
  Button,
  DataTable,
  Pagination,
  StatusBadge,
  Modal,
  Drawer,
  FormField,
  Select,
  Textarea,
  Toast,
} from "../components/common";

export const SalesHistoryPage = () => {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";

  const [sales, setSales] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 1 });
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState(null);

  // Sale detail drawer
  const [selectedSale, setSelectedSale] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  // Return Processing modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState({});
  const [returnRefundMethod, setReturnRefundMethod] = useState("CASH");
  const [returnReason, setReturnReason] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnModalError, setReturnModalError] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let ignore = false;
    const fetchSales = async () => {
      try {
        setLoading(true);
        const params = {
          page: pagination.page,
          per_page: 20,
          search: search?.trim() || undefined,
          payment_method: paymentMethod && paymentMethod !== "ALL" ? paymentMethod : undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        };

        const res = await getSalesApi(params);
        if (!ignore) {
          const items = res?.sales || res?.data?.items || res?.items || (Array.isArray(res) ? res : []);
          const pag = res?.pagination || res?.data?.pagination || { page: 1, per_page: 20, total: items.length, pages: 1 };
          setSales(items);
          setPagination(pag);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error?.message || err.response?.data?.message || "Failed to load sales history.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchSales();
    return () => {
      ignore = true;
    };
  }, [pagination.page, search, paymentMethod, dateFrom, dateTo, refreshTrigger]);

  const handleOpenDetail = async (saleId) => {
    try {
      setDetailLoading(true);
      setDetailError("");
      const res = await getSaleDetailApi(saleId);
      setSelectedSale(res.sale);
    } catch (err) {
      setDetailError(err.response?.data?.error?.message || err.response?.data?.message || "Failed to load sale details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setPaymentMethod("ALL");
    setDateFrom("");
    setDateTo("");
  };

  const handleOpenReturnModal = () => {
    if (!selectedSale) return;
    const initialQtys = {};
    selectedSale.items?.forEach((it) => {
      initialQtys[it.id] = "";
    });
    setReturnQuantities(initialQtys);
    setReturnRefundMethod(selectedSale.payments?.[0]?.payment_method || "CASH");
    setReturnReason("");
    setReturnModalError("");
    setShowReturnModal(true);
  };

  // Calculate live preview of refund for each line and total
  const calculateRefundPreview = () => {
    if (!selectedSale) return { lineRefunds: {}, totalRefund: 0, hasItems: false };

    const saleSubtotal = parseFloat(selectedSale.subtotal) || 0;
    const saleDiscount = parseFloat(selectedSale.discount) || 0;
    const saleTotal = parseFloat(selectedSale.total) || 0;
    const totalRefunded = parseFloat(selectedSale.total_refunded) || 0;

    let totalCalc = 0;
    let hasItems = false;
    const lineRefunds = {};
    let isFullReturn = true;

    selectedSale.items?.forEach((it) => {
      const inputQty = parseFloat(returnQuantities[it.id]) || 0;
      const soldQty = parseFloat(it.quantity) || 0;
      const alreadyRet = parseFloat(it.returned_quantity) || 0;

      if (inputQty > 0) {
        hasItems = true;
        const itemSubtotal = parseFloat(it.subtotal) || 0;
        let lineRef;

        if (saleDiscount > 0 && saleSubtotal > 0 && soldQty > 0) {
          const ratio = itemSubtotal / saleSubtotal;
          const netItemSubtotal = itemSubtotal - (saleDiscount * ratio);
          lineRef = (inputQty / soldQty) * netItemSubtotal;
        } else {
          lineRef = inputQty * (parseFloat(it.unit_price) || 0);
        }

        lineRefunds[it.id] = Math.round(lineRef * 100) / 100;
        totalCalc += lineRefunds[it.id];
      }

      if (Math.abs((alreadyRet + inputQty) - soldQty) > 0.0001) {
        isFullReturn = false;
      }
    });

    if (isFullReturn && hasItems) {
      const exactRemaining = Math.max(0, saleTotal - totalRefunded);
      totalCalc = Math.round(exactRemaining * 100) / 100;
    } else {
      totalCalc = Math.min(totalCalc, Math.max(0, saleTotal - totalRefunded));
      totalCalc = Math.round(totalCalc * 100) / 100;
    }

    return { lineRefunds, totalRefund: totalCalc, hasItems };
  };

  const { lineRefunds, totalRefund, hasItems } = calculateRefundPreview();

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    setReturnModalError("");

    if (!hasItems || totalRefund <= 0) {
      setReturnModalError("Please specify a valid return quantity for at least one item.");
      return;
    }

    const itemsToReturn = [];
    for (const it of selectedSale.items || []) {
      const q = parseFloat(returnQuantities[it.id]) || 0;
      if (q > 0) {
        const available = parseFloat(it.returnable_quantity ?? it.quantity);
        if (q > available) {
          setReturnModalError(
            `Quantity for ${it.product_name} exceeds returnable balance (${available}).`
          );
          return;
        }
        itemsToReturn.push({
          sale_item_id: it.id,
          quantity: q.toFixed(3),
        });
      }
    }

    setReturnSubmitting(true);
    try {
      await createReturnApi(selectedSale.id, {
        refund_method: returnRefundMethod,
        reason: returnReason.trim() || null,
        items: itemsToReturn,
      });

      setShowReturnModal(false);
      setSelectedSale(null);
      setToastMessage({
        type: "success",
        text: `Return processed successfully! Refund amount: ₱${totalRefund.toFixed(2)}.`,
      });
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setReturnModalError(err.response?.data?.error?.message || err.message || "Failed to process return.");
    } finally {
      setReturnSubmitting(false);
    }
  };

  const columns = [
    {
      header: "Invoice #",
      accessor: (s) => (
        <span style={{ fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--color-primary)" }}>
          {s.invoice_number}
        </span>
      ),
    },
    {
      header: "Date / Time",
      accessor: (s) => (
        <div>
          <div style={{ fontSize: "13px", color: "var(--color-text)" }}>
            {s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}
          </div>
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
            {s.created_at ? new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
          </div>
        </div>
      ),
    },
    {
      header: "Items",
      accessor: (s) => `${s.item_count || 0} items`,
    },
    {
      header: "Method",
      accessor: (s) => (
        <span
          style={{
            backgroundColor: "var(--color-bg)",
            border: "1px solid var(--color-border-subtle)",
            color: "var(--color-text)",
            padding: "2px 8px",
            borderRadius: "var(--radius-sm)",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          {s.payment_method || "CASH"}
        </span>
      ),
    },
    {
      header: "Total Paid",
      align: "right",
      accessor: (s) => (
        <strong style={{ fontFamily: "var(--font-mono)", fontSize: "14px", color: "var(--color-text)" }}>
          ₱{parseFloat(s.total).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </strong>
      ),
    },
    {
      header: "Status",
      accessor: (s) => {
        const isReturned = s.status === "RETURNED";
        const hasRefunds = parseFloat(s.total_refunded || 0) > 0;
        return (
          <StatusBadge
            status={isReturned ? "RETURNED" : hasRefunds ? "PARTIAL RETURN" : "COMPLETED"}
            variant={isReturned ? "danger" : hasRefunds ? "warning" : "success"}
          />
        );
      },
    },
    {
      header: "Cashier",
      accessor: (s) => (
        <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
          {s.cashier?.name || s.cashier_name || "Cashier"}
        </span>
      ),
    },
    {
      header: "Actions",
      align: "right",
      accessor: (s) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleOpenDetail(s.id)}
        >
          Inspect
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Toast */}
      {toastMessage && (
        <Toast
          type={toastMessage.type}
          message={toastMessage.text}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Page Header */}
      <PageHeader
        title="Sales History & Receipts"
        subtitle="Review completed retail transactions, inspect itemized receipts, and process customer returns."
        actions={
          <div style={{ display: "flex", gap: "10px" }}>
            <Link
              to="/returns"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "8px 14px",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-text)",
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              View Returns History →
            </Link>
            <Link
              to="/pos"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "8px 14px",
                backgroundColor: "var(--color-primary)",
                color: "#ffffff",
                borderRadius: "var(--radius-md)",
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Open POS
            </Link>
          </div>
        }
      />

      {/* Filters Bar */}
      <div
        style={{
          backgroundColor: "var(--color-surface)",
          padding: "16px 20px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          display: "flex",
          gap: "14px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: "200px" }}>
          <input
            type="text"
            placeholder="Search invoice number, cashier..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            style={{
              width: "100%",
              height: "38px",
              padding: "0 12px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              fontSize: "13px",
              color: "var(--color-text)",
              backgroundColor: "var(--color-surface)",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="sales-payment-method" style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
            Method:
          </label>
          <select
            id="sales-payment-method"
            value={paymentMethod}
            onChange={(e) => {
              setPaymentMethod(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            style={{
              height: "38px",
              padding: "0 12px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              fontSize: "13px",
              color: "var(--color-text)",
              backgroundColor: "var(--color-surface)",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="ALL">All Methods</option>
            <option value="CASH">Cash</option>
            <option value="GCASH">GCash</option>
            <option value="CARD">Card</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="sales-date-from" style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
            From:
          </label>
          <input
            id="sales-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            style={{
              height: "38px",
              padding: "0 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              fontSize: "13px",
              color: "var(--color-text)",
              backgroundColor: "var(--color-surface)",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="sales-date-to" style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
            To:
          </label>
          <input
            id="sales-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            style={{
              height: "38px",
              padding: "0 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              fontSize: "13px",
              color: "var(--color-text)",
              backgroundColor: "var(--color-surface)",
              outline: "none",
            }}
          />
        </div>

        {(search || paymentMethod !== "ALL" || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={handleResetFilters}>
            Clear Filters
          </Button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            backgroundColor: "var(--color-danger-soft)",
            border: "1px solid var(--color-danger)",
            borderRadius: "var(--radius-md)",
            color: "var(--color-danger)",
            fontSize: "13px",
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {/* Sales Table */}
      <DataTable
        columns={columns}
        data={sales}
        loading={loading}
        emptyTitle="No sales found"
        emptyMessage="There are no completed sales transactions matching your search criteria."
      />

      {/* Pagination */}
      {!loading && sales.length > 0 && pagination.pages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.pages}
          totalItems={pagination.total}
          onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
        />
      )}

      {/* Sale Detail Drawer */}
      <Drawer
        isOpen={Boolean(selectedSale)}
        onClose={() => setSelectedSale(null)}
        title={selectedSale ? `Receipt: ${selectedSale.invoice_number}` : "Sale Details"}
        subtitle={selectedSale ? `Completed on ${new Date(selectedSale.created_at).toLocaleString()}` : ""}
        width="540px"
      >
        {detailLoading && <div>Loading sale details...</div>}
        {detailError && <div style={{ color: "var(--color-danger)" }}>{detailError}</div>}
        {selectedSale && !detailLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Amount Summary Box */}
            <div
              style={{
                backgroundColor: "var(--color-bg)",
                padding: "16px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px" }}>
                <span style={{ color: "var(--color-text-secondary)" }}>Subtotal:</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>₱{parseFloat(selectedSale.subtotal || selectedSale.total).toFixed(2)}</span>
              </div>
              {parseFloat(selectedSale.discount || 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px", color: "var(--color-danger)" }}>
                  <span>Discount:</span>
                  <span style={{ fontFamily: "var(--font-mono)" }}>-₱{parseFloat(selectedSale.discount).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", fontWeight: 800, color: "var(--color-text)", borderTop: "1px solid var(--color-border)", paddingTop: "8px" }}>
                <span>Total Net Paid:</span>
                <span style={{ color: "var(--color-primary)", fontFamily: "var(--font-mono)" }}>₱{parseFloat(selectedSale.total).toFixed(2)}</span>
              </div>
              {parseFloat(selectedSale.total_refunded || 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "13px", color: "var(--color-danger)" }}>
                  <span>Refunded:</span>
                  <span style={{ fontFamily: "var(--font-mono)" }}>-₱{parseFloat(selectedSale.total_refunded).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Sale Line Items */}
            <div>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text)", display: "block", marginBottom: "8px" }}>
                Purchased Line Items
              </span>
              <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ backgroundColor: "var(--color-bg)", borderBottom: "1px solid var(--color-border)" }}>
                      <th style={{ padding: "8px 10px" }}>Product</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Qty</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Price</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedSale.items || []).map((it) => (
                      <tr key={it.id} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                        <td style={{ padding: "8px 10px" }}>
                          <div style={{ fontWeight: 600 }}>{it.product_name}</div>
                          {isOwner && it.cost_price !== undefined && (
                            <div style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
                              Cost: ₱{parseFloat(it.cost_price).toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                          {it.quantity}
                          {parseFloat(it.returned_quantity || 0) > 0 && (
                            <span style={{ display: "block", fontSize: "10px", color: "var(--color-danger)" }}>
                              (-{it.returned_quantity} ret)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                          ₱{parseFloat(it.unit_price).toFixed(2)}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                          ₱{parseFloat(it.subtotal).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Return Action */}
            {selectedSale.status !== "RETURNED" && (
              <div style={{ marginTop: "12px" }}>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleOpenReturnModal}
                  style={{ width: "100%" }}
                >
                  Process Return / Refund for this Sale
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Return Processing Modal */}
      <Modal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        title={selectedSale ? `Process Return: ${selectedSale.invoice_number}` : "Process Return"}
        maxWidth="620px"
      >
        {returnModalError && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              backgroundColor: "var(--color-danger-soft)",
              border: "1px solid var(--color-danger)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-danger)",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {returnModalError}
          </div>
        )}

        <form onSubmit={handleReturnSubmit}>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: 0, marginBottom: "14px" }}>
            Enter returned quantity for the items. Refund amount is automatically computed with prorated discounts.
          </p>

          <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: "16px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--color-bg)", borderBottom: "1px solid var(--color-border)" }}>
                  <th style={{ padding: "8px 10px" }}>Product</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>Sold</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>Returnable</th>
                  <th style={{ padding: "8px 10px", width: "90px" }}>Return Qty</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>Refund</th>
                </tr>
              </thead>
              <tbody>
                {(selectedSale?.items || []).map((it) => {
                  const returnable = parseFloat(it.returnable_quantity ?? it.quantity);
                  const isFullyReturned = returnable <= 0;

                  return (
                    <tr key={it.id} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ fontWeight: 600 }}>{it.product_name}</div>
                        <div style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>₱{parseFloat(it.unit_price).toFixed(2)}</div>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {it.quantity}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {returnable.toFixed(3)}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          max={returnable}
                          disabled={isFullyReturned}
                          placeholder="0"
                          value={returnQuantities[it.id] || ""}
                          onChange={(e) =>
                            setReturnQuantities({ ...returnQuantities, [it.id]: e.target.value })
                          }
                          style={{
                            width: "100%",
                            height: "28px",
                            padding: "0 6px",
                            fontSize: "12px",
                            textAlign: "center",
                            border: "1px solid var(--color-border)",
                            borderRadius: "var(--radius-sm)",
                          }}
                        />
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--color-danger)" }}>
                        ₱{(lineRefunds[it.id] || 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Refund Method & Total */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
            <FormField label="Refund Payment Method" required>
              <Select
                value={returnRefundMethod}
                onChange={(e) => setReturnRefundMethod(e.target.value)}
              >
                <option value="CASH">CASH</option>
                <option value="GCASH">GCASH</option>
                <option value="CARD">CARD</option>
              </Select>
            </FormField>

            <div
              style={{
                backgroundColor: "var(--color-bg)",
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: "11px", color: "var(--color-text-secondary)", fontWeight: 600 }}>
                CALCULATED REFUND TOTAL
              </span>
              <strong style={{ fontSize: "20px", fontFamily: "var(--font-mono)", color: "var(--color-danger)" }}>
                ₱{totalRefund.toFixed(2)}
              </strong>
            </div>
          </div>

          <FormField label="Reason for Return (Optional)">
            <Textarea
              rows={2}
              placeholder="e.g. Expired product, damaged seal, customer bought wrong item..."
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
            />
          </FormField>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowReturnModal(false)}
              disabled={returnSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={returnSubmitting}
              disabled={returnSubmitting || !hasItems || totalRefund <= 0}
            >
              {returnSubmitting ? "Processing..." : `Confirm Refund (₱${totalRefund.toFixed(2)})`}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SalesHistoryPage;
