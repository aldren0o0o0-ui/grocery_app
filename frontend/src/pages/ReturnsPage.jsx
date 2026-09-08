import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import useAuth from "../modules/auth/useAuth";
import { getReturnsApi, getReturnDetailApi } from "../modules/returns/api";

export const ReturnsPage = () => {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";

  const [returns, setReturns] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 1 });
  const [search, setSearch] = useState("");
  const [refundMethod, setRefundMethod] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Return detail modal
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    let ignore = false;
    const fetchReturns = async () => {
      try {
        setLoading(true);
        setError("");
        const params = {
          page: pagination.page,
          per_page: 20,
          search,
          refund_method: refundMethod,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        };

        const res = await getReturnsApi(params);
        if (!ignore) {
          setReturns(res.returns || []);
          setPagination(res.pagination || { page: 1, per_page: 20, total: 0, pages: 1 });
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error?.message || err.response?.data?.message || "Failed to load returns history.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchReturns();
    return () => {
      ignore = true;
    };
  }, [pagination.page, search, refundMethod, dateFrom, dateTo]);

  const handleOpenDetail = async (returnId) => {
    try {
      setDetailLoading(true);
      setDetailError("");
      const res = await getReturnDetailApi(returnId);
      setSelectedReturn(res.return);
    } catch (err) {
      setDetailError(err.response?.data?.error?.message || err.response?.data?.message || "Failed to load return details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setRefundMethod("ALL");
    setDateFrom("");
    setDateTo("");
  };

  const totalRefundedSum = returns.reduce((acc, r) => acc + (parseFloat(r.refund_amount) || 0), 0);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f9fafb" }}>
      <Navbar />

      <main style={{ maxWidth: "1200px", margin: "2rem auto", padding: "0 1.5rem" }}>
        {/* Header & Quick Action */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#111827", fontWeight: "700" }}>Sales Returns & Refunds</h1>
            <p style={{ margin: "0.25rem 0 0", color: "#6b7280", fontSize: "0.875rem" }}>
              {isOwner ? "Audit trail of returned items and customer refunds" : "Returns processed by your register"}
            </p>
          </div>
          <Link
            to="/sales"
            style={{
              padding: "0.6rem 1.2rem",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              textDecoration: "none",
              borderRadius: "6px",
              fontWeight: "600",
              fontSize: "0.875rem",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            ← Back to Sales History
          </Link>
        </div>

        {/* Metric Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ backgroundColor: "#ffffff", padding: "1.25rem", borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "0.8rem", color: "#6b7280", fontWeight: "600", textTransform: "uppercase" }}>Total Returns Logged</div>
            <div style={{ fontSize: "1.75rem", fontWeight: "700", color: "#111827", marginTop: "0.25rem" }}>
              {pagination.total}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem" }}>Across all business dates</div>
          </div>

          <div style={{ backgroundColor: "#ffffff", padding: "1.25rem", borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "0.8rem", color: "#6b7280", fontWeight: "600", textTransform: "uppercase" }}>Current View Refunds</div>
            <div style={{ fontSize: "1.75rem", fontWeight: "700", color: "#dc2626", marginTop: "0.25rem" }}>
              ₱{totalRefundedSum.toFixed(2)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem" }}>Sum of current page results</div>
          </div>

          <div style={{ backgroundColor: "#ffffff", padding: "1.25rem", borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "0.8rem", color: "#6b7280", fontWeight: "600", textTransform: "uppercase" }}>Inventory Status</div>
            <div style={{ fontSize: "1.25rem", fontWeight: "600", color: "#059669", marginTop: "0.5rem" }}>
              ✓ Stock Auto-Restored
            </div>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem" }}>Audited by InventoryService</div>
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
            gap: "1rem",
            flexWrap: "wrap",
            alignItems: "flex-end",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#374151", marginBottom: "0.25rem" }}>
              Search
            </label>
            <input
              type="text"
              placeholder="Return #, invoice, or reason..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
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

          <div style={{ width: "160px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#374151", marginBottom: "0.25rem" }}>
              Refund Method
            </label>
            <select
              value={refundMethod}
              onChange={(e) => {
                setRefundMethod(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
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
              <option value="ALL">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="GCASH">GCash</option>
              <option value="CARD">Card</option>
            </select>
          </div>

          <div style={{ width: "150px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#374151", marginBottom: "0.25rem" }}>
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
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

          <div style={{ width: "150px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#374151", marginBottom: "0.25rem" }}>
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
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

        {/* Returns Table */}
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
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600" }}>Return #</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600" }}>Original Invoice #</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600" }}>Date & Time</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600" }}>Processed By</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600" }}>Method</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600", textAlign: "right" }}>Refund Amount</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600" }}>Reason</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600", textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ padding: "3rem", textAlign: "center", color: "#6b7280" }}>
                    Loading returns history...
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>
                    No return records found matching your filters.
                  </td>
                </tr>
              ) : (
                returns.map((ret) => (
                  <tr key={ret.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: "600", color: "#b91c1c" }}>
                      {ret.return_number}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: "500", color: "#2563eb" }}>
                      {ret.sale_invoice_number}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", color: "#4b5563" }}>
                      {new Date(ret.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", color: "#4b5563" }}>
                      {ret.processor_name}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          backgroundColor: "#fef2f2",
                          color: "#991b1b",
                        }}
                      >
                        {ret.refund_method}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: "700", color: "#dc2626" }}>
                      ₱{parseFloat(ret.refund_amount).toFixed(2)}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", color: "#4b5563", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ret.reason}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
                      <button
                        onClick={() => handleOpenDetail(ret.id)}
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
                        View Items
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
              Showing {returns.length} of {pagination.total} returns
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

      {/* Return Detail Modal */}
      {selectedReturn && (
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
                Return Receipt — {selectedReturn.return_number}
              </h2>
              <button
                onClick={() => setSelectedReturn(null)}
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
              <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>Loading return items...</div>
            ) : (
              <div>
                {/* Meta details */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.85rem", marginBottom: "1rem", color: "#4b5563", backgroundColor: "#f9fafb", padding: "0.75rem", borderRadius: "6px" }}>
                  <div><strong>Invoice #:</strong> {selectedReturn.sale?.invoice_number}</div>
                  <div><strong>Processed Date:</strong> {new Date(selectedReturn.created_at).toLocaleString()}</div>
                  <div><strong>Processed By:</strong> {selectedReturn.processor?.name}</div>
                  <div><strong>Refund Method:</strong> {selectedReturn.refund_method}</div>
                  <div style={{ gridColumn: "1 / -1" }}><strong>Reason:</strong> {selectedReturn.reason}</div>
                </div>

                {/* Items breakdown table */}
                <div style={{ fontWeight: "600", fontSize: "0.875rem", marginBottom: "0.5rem", color: "#111827" }}>
                  Restored Inventory & Refund Breakdown
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", marginBottom: "1rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left", color: "#374151", backgroundColor: "#f3f4f6" }}>
                      <th style={{ padding: "0.5rem" }}>Product</th>
                      <th style={{ padding: "0.5rem", textAlign: "center" }}>Returned Qty</th>
                      <th style={{ padding: "0.5rem", textAlign: "right" }}>Unit Price</th>
                      {isOwner && <th style={{ padding: "0.5rem", textAlign: "right", color: "#6b7280" }}>Cost</th>}
                      <th style={{ padding: "0.5rem", textAlign: "right" }}>Refund Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReturn.items?.map((it) => (
                      <tr key={it.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "0.5rem" }}>
                          <div style={{ fontWeight: "600", color: "#111827" }}>{it.product_name}</div>
                          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{it.product_sku}</div>
                        </td>
                        <td style={{ padding: "0.5rem", textAlign: "center", fontWeight: "600", color: "#059669" }}>
                          +{parseFloat(it.quantity)} {it.product_unit}
                        </td>
                        <td style={{ padding: "0.5rem", textAlign: "right" }}>
                          ₱{parseFloat(it.unit_price).toFixed(2)}
                        </td>
                        {isOwner && (
                          <td style={{ padding: "0.5rem", textAlign: "right", color: "#6b7280" }}>
                            ₱{it.cost_price ? parseFloat(it.cost_price).toFixed(2) : "0.00"}
                          </td>
                        )}
                        <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: "700", color: "#dc2626" }}>
                          ₱{parseFloat(it.refund_subtotal).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Total Refund Summary */}
                <div style={{ borderTop: "2px solid #e5e7eb", paddingTop: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "1rem", fontWeight: "600", color: "#374151" }}>Total Refund Issued:</span>
                  <span style={{ fontSize: "1.25rem", fontWeight: "700", color: "#dc2626" }}>
                    ₱{parseFloat(selectedReturn.refund_amount).toFixed(2)}
                  </span>
                </div>

                <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setSelectedReturn(null)}
                    style={{
                      padding: "0.5rem 1.25rem",
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

export default ReturnsPage;
