import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import useAuth from "../modules/auth/useAuth";
import { getSalesApi, getSaleDetailApi } from "../modules/sales/api";
import { createReturnApi } from "../modules/returns/api";

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
  const [globalSuccess, setGlobalSuccess] = useState("");

  // Sale detail modal
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
          search,
          payment_method: paymentMethod,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        };

        const res = await getSalesApi(params);
        if (!ignore) {
          setSales(res.sales || []);
          setPagination(res.pagination || { page: 1, per_page: 20, total: 0, pages: 1 });
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

  // Open Return Processing Modal
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

  const refundPreview = calculateRefundPreview();

  const handleProcessReturn = async (e) => {
    e.preventDefault();
    if (!selectedSale) return;

    try {
      setReturnSubmitting(true);
      setReturnModalError("");

      if (!returnReason.trim()) {
        setReturnModalError("Please enter a return reason.");
        setReturnSubmitting(false);
        return;
      }

      const itemsToReturn = [];
      for (const it of selectedSale.items || []) {
        const qtyVal = parseFloat(returnQuantities[it.id]) || 0;
        if (qtyVal > 0) {
          const returnable = parseFloat(it.returnable_quantity) || 0;
          if (qtyVal > returnable) {
            setReturnModalError(`Quantity for "${it.product_name}" exceeds returnable limit of ${returnable}.`);
            setReturnSubmitting(false);
            return;
          }
          itemsToReturn.push({
            sale_item_id: it.id,
            quantity: qtyVal.toFixed(3),
          });
        }
      }

      if (itemsToReturn.length === 0) {
        setReturnModalError("Please specify a quantity greater than zero for at least one item.");
        setReturnSubmitting(false);
        return;
      }

      const payload = {
        sale_id: selectedSale.id,
        reason: returnReason.trim(),
        refund_method: returnRefundMethod,
        items: itemsToReturn,
      };

      const res = await createReturnApi(payload);
      const retData = res.return;

      setShowReturnModal(false);
      setGlobalSuccess(`Return ${retData.return_number} processed successfully! ₱${parseFloat(retData.refund_amount).toFixed(2)} refunded and stock restored.`);

      // Refresh sale detail and main list
      await handleOpenDetail(selectedSale.id);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setReturnModalError(
        err.response?.data?.error?.message || err.response?.data?.message || "Failed to process return."
      );
    } finally {
      setReturnSubmitting(false);
    }
  };

  const renderReturnStateBadge = (returnState) => {
    if (returnState === "FULL") {
      return (
        <span
          style={{
            display: "inline-block",
            padding: "0.2rem 0.5rem",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: "700",
            backgroundColor: "#fee2e2",
            color: "#991b1b",
          }}
        >
          FULL RETURN
        </span>
      );
    }
    if (returnState === "PARTIAL") {
      return (
        <span
          style={{
            display: "inline-block",
            padding: "0.2rem 0.5rem",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: "700",
            backgroundColor: "#fef3c7",
            color: "#92400e",
          }}
        >
          PARTIAL RETURN
        </span>
      );
    }
    return (
      <span
        style={{
          display: "inline-block",
          padding: "0.2rem 0.5rem",
          borderRadius: "9999px",
          fontSize: "0.75rem",
          fontWeight: "600",
          backgroundColor: "#ecfdf5",
          color: "#065f46",
        }}
      >
        COMPLETED
      </span>
    );
  };

  const canReturnSale =
    selectedSale &&
    selectedSale.status === "COMPLETED" &&
    selectedSale.return_state !== "FULL" &&
    (isOwner || user?.id === selectedSale.cashier?.id);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f9fafb" }}>
      <Navbar />

      <main style={{ maxWidth: "1200px", margin: "2rem auto", padding: "0 1.5rem" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#111827", fontWeight: "700" }}>Sales History</h1>
            <p style={{ margin: "0.25rem 0 0", color: "#6b7280", fontSize: "0.875rem" }}>
              {isOwner ? "All recorded store transactions" : "Transactions completed by you"}
            </p>
          </div>
        </div>

        {/* Global Success Alert */}
        {globalSuccess && (
          <div
            style={{
              padding: "0.75rem 1rem",
              backgroundColor: "#ecfdf5",
              color: "#065f46",
              borderRadius: "6px",
              marginBottom: "1rem",
              border: "1px solid #a7f3d0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{globalSuccess}</span>
            <button
              onClick={() => setGlobalSuccess("")}
              style={{ background: "none", border: "none", color: "#065f46", cursor: "pointer", fontWeight: "700" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "1rem",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            marginBottom: "1.5rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            alignItems: "flex-end",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          {/* Invoice Search */}
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#4b5563", marginBottom: "0.3rem" }}>
              Invoice Number
            </label>
            <input
              type="text"
              placeholder="e.g. SAL-2026..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Payment Method Filter */}
          <div style={{ width: "160px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#4b5563", marginBottom: "0.3rem" }}>
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "0.875rem",
                backgroundColor: "#ffffff",
                boxSizing: "border-box",
              }}
            >
              <option value="ALL">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="GCASH">GCash</option>
              <option value="CARD">Card</option>
            </select>
          </div>

          {/* Date From */}
          <div style={{ width: "150px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#4b5563", marginBottom: "0.3rem" }}>
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Date To */}
          <div style={{ width: "150px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#4b5563", marginBottom: "0.3rem" }}>
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Reset button */}
          <button
            onClick={handleResetFilters}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#f3f4f6",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.875rem",
              color: "#374151",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Reset
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ padding: "0.75rem", backgroundColor: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        {/* Sales Table */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb", color: "#374151" }}>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600" }}>Invoice #</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600" }}>Date & Time</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600" }}>Cashier</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600" }}>Items</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600" }}>Payment</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600", textAlign: "right" }}>Total</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600", textAlign: "center" }}>Status / Returns</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600", textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ padding: "3rem", textAlign: "center", color: "#6b7280" }}>
                    Loading transactions...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>
                    No sales recorded matching your filters.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: "600", color: "#111827" }}>
                      {sale.invoice_number}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", color: "#4b5563" }}>
                      {new Date(sale.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", color: "#4b5563" }}>
                      {sale.cashier_name}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", color: "#4b5563" }}>
                      {sale.item_count} items
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          backgroundColor: "#f3f4f6",
                          color: "#374151",
                        }}
                      >
                        {sale.payment_method}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: "700", color: "#111827" }}>
                      ₱{parseFloat(sale.total).toFixed(2)}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
                      {renderReturnStateBadge(sale.return_state || (sale.status === "RETURNED" ? "FULL" : "NONE"))}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
                      <button
                        onClick={() => handleOpenDetail(sale.id)}
                        style={{
                          padding: "0.3rem 0.75rem",
                          backgroundColor: "#eff6ff",
                          color: "#2563eb",
                          border: "1px solid #bfdbfe",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          cursor: "pointer",
                        }}
                      >
                        View Receipt
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div
            style={{
              padding: "0.75rem 1rem",
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.875rem",
              color: "#4b5563",
            }}
          >
            <span>
              Showing {sales.length} of {pagination.total} sales
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                style={{
                  padding: "0.3rem 0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  backgroundColor: "#ffffff",
                  cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
                  opacity: pagination.page <= 1 ? 0.5 : 1,
                }}
              >
                Previous
              </button>
              <span style={{ padding: "0.3rem 0.5rem" }}>
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                style={{
                  padding: "0.3rem 0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  backgroundColor: "#ffffff",
                  cursor: pagination.page >= pagination.pages ? "not-allowed" : "pointer",
                  opacity: pagination.page >= pagination.pages ? 0.5 : 1,
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Sale Detail / Receipt Modal */}
      {selectedSale && !showReturnModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              padding: "1.5rem",
              width: "600px",
              maxWidth: "95%",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#111827" }}>
                Sale Details — {selectedSale.invoice_number}
              </h2>
              <button
                onClick={() => setSelectedSale(null)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {detailError && (
              <div style={{ padding: "0.75rem", backgroundColor: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "1rem" }}>
                {detailError}
              </div>
            )}

            {detailLoading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>Loading details...</div>
            ) : (
              <div>
                {/* Meta details */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.85rem", marginBottom: "1rem", color: "#4b5563" }}>
                  <div><strong>Date:</strong> {new Date(selectedSale.created_at).toLocaleString()}</div>
                  <div>
                    <strong>Status:</strong>{" "}
                    {renderReturnStateBadge(selectedSale.return_state || (selectedSale.status === "RETURNED" ? "FULL" : "NONE"))}
                  </div>
                  <div><strong>Cashier:</strong> {selectedSale.cashier?.name} ({selectedSale.cashier?.email})</div>
                  {parseFloat(selectedSale.total_refunded || 0) > 0 && (
                    <div>
                      <strong>Total Refunded:</strong>{" "}
                      <span style={{ color: "#dc2626", fontWeight: "700" }}>₱{parseFloat(selectedSale.total_refunded).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Items breakdown table */}
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", marginBottom: "1rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left", color: "#374151" }}>
                      <th style={{ padding: "0.5rem" }}>Product</th>
                      <th style={{ padding: "0.5rem", textAlign: "center" }}>Sold</th>
                      <th style={{ padding: "0.5rem", textAlign: "center" }}>Returned</th>
                      <th style={{ padding: "0.5rem", textAlign: "right" }}>Price</th>
                      {isOwner && <th style={{ padding: "0.5rem", textAlign: "right", color: "#6b7280" }}>Cost</th>}
                      <th style={{ padding: "0.5rem", textAlign: "right" }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSale.items?.map((it) => (
                      <tr key={it.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "0.5rem" }}>
                          <div style={{ fontWeight: "600", color: "#111827" }}>{it.product_name}</div>
                          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{it.product_sku}</div>
                        </td>
                        <td style={{ padding: "0.5rem", textAlign: "center" }}>
                          {parseFloat(it.quantity)} {it.product_unit}
                        </td>
                        <td style={{ padding: "0.5rem", textAlign: "center", color: parseFloat(it.returned_quantity) > 0 ? "#dc2626" : "#6b7280", fontWeight: parseFloat(it.returned_quantity) > 0 ? "600" : "normal" }}>
                          {parseFloat(it.returned_quantity || 0)} {it.product_unit}
                        </td>
                        <td style={{ padding: "0.5rem", textAlign: "right" }}>
                          ₱{parseFloat(it.unit_price).toFixed(2)}
                        </td>
                        {isOwner && (
                          <td style={{ padding: "0.5rem", textAlign: "right", color: "#6b7280" }}>
                            ₱{it.cost_price ? parseFloat(it.cost_price).toFixed(2) : "0.00"}
                          </td>
                        )}
                        <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: "600" }}>
                          ₱{parseFloat(it.subtotal).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals Summary */}
                <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "0.5rem", fontSize: "0.875rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Subtotal:</span>
                    <span>₱{parseFloat(selectedSale.subtotal).toFixed(2)}</span>
                  </div>
                  {parseFloat(selectedSale.discount) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#15803d" }}>
                      <span>Discount:</span>
                      <span>-₱{parseFloat(selectedSale.discount).toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "700", fontSize: "1rem", color: "#111827", marginTop: "0.25rem" }}>
                    <span>Total Amount:</span>
                    <span>₱{parseFloat(selectedSale.total).toFixed(2)}</span>
                  </div>
                </div>

                {/* Returns History if any */}
                {selectedSale.returns && selectedSale.returns.length > 0 && (
                  <div style={{ marginTop: "1rem", padding: "0.75rem", backgroundColor: "#fef2f2", borderRadius: "6px", border: "1px solid #fee2e2" }}>
                    <div style={{ fontWeight: "700", fontSize: "0.8rem", color: "#991b1b", marginBottom: "0.3rem", textTransform: "uppercase" }}>
                      Returns Applied to this Sale
                    </div>
                    {selectedSale.returns.map((r) => (
                      <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#7f1d1d", padding: "0.2rem 0" }}>
                        <span><strong>{r.return_number}</strong> ({r.refund_method}) — {r.reason}</span>
                        <span style={{ fontWeight: "700" }}>-₱{parseFloat(r.refund_amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Payments info */}
                {selectedSale.payments && selectedSale.payments.length > 0 && (
                  <div style={{ marginTop: "1rem", padding: "0.75rem", backgroundColor: "#f9fafb", borderRadius: "6px", fontSize: "0.85rem" }}>
                    <div style={{ fontWeight: "600", marginBottom: "0.3rem", color: "#374151" }}>Payment Details</div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Method: <strong>{selectedSale.payments[0].payment_method}</strong></span>
                      <span>Paid: <strong>₱{parseFloat(selectedSale.payments[0].amount_paid).toFixed(2)}</strong></span>
                      <span>Change: <strong>₱{parseFloat(selectedSale.payments[0].change_amount).toFixed(2)}</strong></span>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {canReturnSale ? (
                    <button
                      onClick={handleOpenReturnModal}
                      style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: "#dc2626",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: "600",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                      }}
                    >
                      Process Return
                    </button>
                  ) : (
                    <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                      {selectedSale.return_state === "FULL" ? "This sale is fully returned." : ""}
                    </span>
                  )}
                  <button
                    onClick={() => setSelectedSale(null)}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: "#f3f4f6",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      fontWeight: "600",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Return Processing Flow Modal */}
      {showReturnModal && selectedSale && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1050,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              padding: "1.5rem",
              width: "680px",
              maxWidth: "95%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#111827" }}>
                  Process Return & Refund
                </h2>
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                  Original Invoice: <strong>{selectedSale.invoice_number}</strong>
                </div>
              </div>
              <button
                onClick={() => setShowReturnModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {returnModalError && (
              <div style={{ padding: "0.75rem", backgroundColor: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.875rem" }}>
                {returnModalError}
              </div>
            )}

            <form onSubmit={handleProcessReturn}>
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontWeight: "600", fontSize: "0.875rem", marginBottom: "0.5rem", color: "#374151" }}>
                  Specify Quantities to Return
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb", color: "#374151", textAlign: "left" }}>
                      <th style={{ padding: "0.5rem" }}>Item</th>
                      <th style={{ padding: "0.5rem", textAlign: "center" }}>Sold / Ret.</th>
                      <th style={{ padding: "0.5rem", textAlign: "center" }}>Available</th>
                      <th style={{ padding: "0.5rem", width: "110px", textAlign: "center" }}>Return Qty</th>
                      <th style={{ padding: "0.5rem", textAlign: "right" }}>Est. Refund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSale.items?.map((it) => {
                      const returnable = parseFloat(it.returnable_quantity) || 0;
                      const isReturnable = returnable > 0;
                      return (
                        <tr key={it.id} style={{ borderBottom: "1px solid #f3f4f6", opacity: isReturnable ? 1 : 0.5 }}>
                          <td style={{ padding: "0.5rem" }}>
                            <div style={{ fontWeight: "600", color: "#111827" }}>{it.product_name}</div>
                            <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                              ₱{parseFloat(it.unit_price).toFixed(2)} / {it.product_unit}
                            </div>
                          </td>
                          <td style={{ padding: "0.5rem", textAlign: "center", color: "#6b7280" }}>
                            {parseFloat(it.quantity)} / {parseFloat(it.returned_quantity || 0)}
                          </td>
                          <td style={{ padding: "0.5rem", textAlign: "center", fontWeight: "600", color: isReturnable ? "#059669" : "#9ca3af" }}>
                            {returnable} {it.product_unit}
                          </td>
                          <td style={{ padding: "0.5rem", textAlign: "center" }}>
                            <input
                              type="number"
                              min="0"
                              max={returnable}
                              step="any"
                              disabled={!isReturnable || returnSubmitting}
                              placeholder="0"
                              value={returnQuantities[it.id] || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setReturnQuantities((prev) => ({ ...prev, [it.id]: val }));
                              }}
                              style={{
                                width: "90px",
                                padding: "0.35rem 0.5rem",
                                borderRadius: "4px",
                                border: "1px solid #d1d5db",
                                fontSize: "0.85rem",
                                textAlign: "center",
                                boxSizing: "border-box",
                              }}
                            />
                          </td>
                          <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: "600", color: "#dc2626" }}>
                            ₱{(refundPreview.lineRefunds[it.id] || 0).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Total Refund Summary & Proration Notice */}
              <div
                style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fee2e2",
                  borderRadius: "6px",
                  padding: "0.75rem 1rem",
                  marginBottom: "1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: "700", color: "#991b1b", fontSize: "0.875rem" }}>
                    Total Estimated Refund:
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#7f1d1d" }}>
                    {parseFloat(selectedSale.discount) > 0 ? "Includes prorated discount adjustments" : "Based on original sale price"}
                  </div>
                </div>
                <div style={{ fontSize: "1.25rem", fontWeight: "700", color: "#dc2626" }}>
                  ₱{refundPreview.totalRefund.toFixed(2)}
                </div>
              </div>

              {/* Refund Method & Reason */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1rem", marginBottom: "1.25rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#374151", marginBottom: "0.3rem" }}>
                    Refund Method
                  </label>
                  <select
                    value={returnRefundMethod}
                    onChange={(e) => setReturnRefundMethod(e.target.value)}
                    disabled={returnSubmitting}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid #d1d5db",
                      fontSize: "0.875rem",
                      backgroundColor: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="CASH">Cash</option>
                    <option value="GCASH">GCash</option>
                    <option value="CARD">Card</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#374151", marginBottom: "0.3rem" }}>
                    Return Reason <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Defective item, expired, customer change of mind..."
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    disabled={returnSubmitting}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid #d1d5db",
                      fontSize: "0.875rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  disabled={returnSubmitting}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#f3f4f6",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontWeight: "600",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={returnSubmitting || !refundPreview.hasItems}
                  style={{
                    padding: "0.5rem 1.25rem",
                    backgroundColor: refundPreview.hasItems ? "#dc2626" : "#9ca3af",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: "600",
                    cursor: refundPreview.hasItems && !returnSubmitting ? "pointer" : "not-allowed",
                    fontSize: "0.875rem",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                  }}
                >
                  {returnSubmitting ? "Processing..." : `Confirm Refund ₱${refundPreview.totalRefund.toFixed(2)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistoryPage;
