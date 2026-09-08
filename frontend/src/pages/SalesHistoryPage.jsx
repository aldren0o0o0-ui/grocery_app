import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import useAuth from "../modules/auth/useAuth";
import { getSalesApi, getSaleDetailApi } from "../modules/sales/api";

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

  // Sale detail modal
  const [selectedSale, setSelectedSale] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    let ignore = false;
    const fetchSales = async () => {
      try {
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
          setError(err.response?.data?.message || "Failed to load sales history.");
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
  }, [pagination.page, search, paymentMethod, dateFrom, dateTo]);

  const handleOpenDetail = async (saleId) => {
    try {
      setDetailLoading(true);
      setDetailError("");
      const res = await getSaleDetailApi(saleId);
      setSelectedSale(res.sale);
    } catch (err) {
      setDetailError(err.response?.data?.message || "Failed to load sale details.");
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
              }}
            >
              <option value="ALL">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="GCASH">GCash</option>
              <option value="CARD">Card</option>
            </select>
          </div>

          {/* Date Range */}
          <div style={{ width: "140px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#4b5563", marginBottom: "0.3rem" }}>
              From Date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.5rem",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "0.875rem",
              }}
            />
          </div>

          <div style={{ width: "140px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#4b5563", marginBottom: "0.3rem" }}>
              To Date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.5rem",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "0.875rem",
              }}
            />
          </div>

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
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600", textAlign: "center" }}>Status</th>
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
                        {sale.status}
                      </span>
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
      {selectedSale && (
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
              width: "550px",
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
                  <div><strong>Status:</strong> <span style={{ color: "#059669", fontWeight: "600" }}>{selectedSale.status}</span></div>
                  <div><strong>Cashier:</strong> {selectedSale.cashier?.name} ({selectedSale.cashier?.email})</div>
                </div>

                {/* Items breakdown table */}
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", marginBottom: "1rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left", color: "#374151" }}>
                      <th style={{ padding: "0.5rem" }}>Product</th>
                      <th style={{ padding: "0.5rem", textAlign: "center" }}>Qty</th>
                      <th style={{ padding: "0.5rem", textAlign: "right" }}>Price</th>
                      {isOwner && <th style={{ padding: "0.5rem", textAlign: "right", color: "#6b7280" }}>Cost</th>}
                      <th style={{ padding: "0.5rem", textAlign: "right" }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSale.items?.map((it) => (
                      <tr key={it.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "0.5rem" }}>
                          <div>{it.product_name}</div>
                          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{it.product_sku}</div>
                        </td>
                        <td style={{ padding: "0.5rem", textAlign: "center" }}>
                          {parseFloat(it.quantity)} {it.product_unit}
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

                <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setSelectedSale(null)}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: "#f3f4f6",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      fontWeight: "600",
                      cursor: "pointer",
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
    </div>
  );
};

export default SalesHistoryPage;
