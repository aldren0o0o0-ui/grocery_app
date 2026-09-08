import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import useAuth from "../modules/auth/useAuth";
import {
  getInventoryApi,
  getStockMovementsApi,
  createStockAdjustmentApi,
} from "../modules/inventory/api";
import { getCategoriesApi } from "../modules/categories/api";

export const InventoryPage = () => {
  const { user } = useAuth();
  const canAdjust = ["OWNER", "ADMIN"].includes(user?.role);

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 10, total: 0, pages: 1 });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Adjustment Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustData, setAdjustData] = useState({
    direction: "IN",
    quantity: "",
    reason: "PHYSICAL_COUNT",
    remarks: "",
  });
  const [adjustError, setAdjustError] = useState("");
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Movement History Drawer State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [movements, setMovements] = useState([]);
  const [movementTypeFilter, setMovementTypeFilter] = useState("");
  const [historyPagination, setHistoryPagination] = useState({ page: 1, per_page: 10, total: 0, pages: 1 });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  // Load categories for dropdown
  useEffect(() => {
    let ignore = false;
    const fetchCats = async () => {
      try {
        const res = await getCategoriesApi({ is_active: true, per_page: 100 });
        if (!ignore && res.status === "success") {
          setCategories(res.data.items || []);
        }
      } catch {
        // Ignore category load error silently
      }
    };
    fetchCats();
    return () => {
      ignore = true;
    };
  }, []);

  // Load inventory items
  useEffect(() => {
    let ignore = false;
    const fetchInventory = async () => {
      try {
        const params = {
          page: pagination.page,
          per_page: 10,
          stock_status: stockStatusFilter,
        };
        if (search.trim()) params.search = search.trim();
        if (categoryFilter) params.category_id = categoryFilter;

        const res = await getInventoryApi(params);
        if (!ignore) {
          if (res.status === "success") {
            setItems(res.data.items || []);
            setPagination(res.data.pagination || { page: 1, per_page: 10, total: 0, pages: 1 });
          } else {
            setError(res.message || "Failed to load inventory.");
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.message || err.message || "Network error loading inventory.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchInventory();
    return () => {
      ignore = true;
    };
  }, [search, categoryFilter, stockStatusFilter, pagination.page, refreshTrigger]);

  // Load movement history for a selected product
  useEffect(() => {
    if (!isHistoryOpen || !historyProduct) return;

    let ignore = false;
    const fetchHistory = async () => {
      try {
        setHistoryLoading(true);
        setHistoryError("");
        const params = {
          page: historyPagination.page,
          per_page: 10,
        };
        if (movementTypeFilter) params.movement_type = movementTypeFilter;

        const res = await getStockMovementsApi(historyProduct.id, params);
        if (!ignore) {
          if (res.status === "success") {
            setMovements(res.data.items || []);
            setHistoryPagination(res.data.pagination || { page: 1, per_page: 10, total: 0, pages: 1 });
          } else {
            setHistoryError(res.message || "Failed to load stock movements.");
          }
        }
      } catch (err) {
        if (!ignore) {
          setHistoryError(err.response?.data?.message || err.message || "Failed to load stock history.");
        }
      } finally {
        if (!ignore) {
          setHistoryLoading(false);
        }
      }
    };

    fetchHistory();
    return () => {
      ignore = true;
    };
  }, [isHistoryOpen, historyProduct, movementTypeFilter, historyPagination.page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setPagination((prev) => ({ ...prev, page: 1 }));
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleOpenAdjust = (product) => {
    setSelectedProduct(product);
    setAdjustData({
      direction: "IN",
      quantity: "",
      reason: "PHYSICAL_COUNT",
      remarks: "",
    });
    setAdjustError("");
    setIsAdjustModalOpen(true);
  };

  const handleCloseAdjust = () => {
    setIsAdjustModalOpen(false);
    setSelectedProduct(null);
    setAdjustError("");
  };

  const handleOpenHistory = (product) => {
    setHistoryProduct(product);
    setMovementTypeFilter("");
    setHistoryPagination({ page: 1, per_page: 10, total: 0, pages: 1 });
    setIsHistoryOpen(true);
  };

  const handleCloseHistory = () => {
    setIsHistoryOpen(false);
    setHistoryProduct(null);
    setMovements([]);
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    const qty = parseFloat(adjustData.quantity);
    if (isNaN(qty) || qty <= 0) {
      setAdjustError("Please enter a valid positive quantity.");
      return;
    }

    if (adjustData.direction === "OUT") {
      const currentStock = parseFloat(selectedProduct.stock_quantity);
      if (qty > currentStock) {
        setAdjustError(
          `Cannot deduct ${qty.toFixed(3)}. Available stock is only ${currentStock.toFixed(3)}.`
        );
        return;
      }
    }

    setAdjustSubmitting(true);
    setAdjustError("");

    try {
      await createStockAdjustmentApi({
        product_id: selectedProduct.id,
        direction: adjustData.direction,
        quantity: adjustData.quantity.trim(),
        reason: adjustData.reason,
        remarks: adjustData.remarks.trim() || null,
      });
      setIsAdjustModalOpen(false);
      setLoading(true);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setAdjustError(err.response?.data?.message || err.message || "Failed to adjust stock.");
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // Projected stock preview calculation
  const calculateProjectedStock = () => {
    if (!selectedProduct) return null;
    const current = parseFloat(selectedProduct.stock_quantity) || 0;
    const qty = parseFloat(adjustData.quantity) || 0;
    if (adjustData.direction === "IN") {
      return (current + qty).toFixed(3);
    }
    return (current - qty).toFixed(3);
  };

  const projectedStock = calculateProjectedStock();

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Navbar />

      <main style={{ maxWidth: "1280px", margin: "2rem auto", padding: "0 1.5rem" }}>
        {/* Header section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>
              Inventory Management
            </h1>
            <p style={{ color: "#64748b", margin: "0.25rem 0 0 0", fontSize: "0.875rem" }}>
              Authoritative stock ledger balances, low-stock detection, and audit history.
            </p>
          </div>
        </div>

        {/* Filters Bar */}
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "1rem 1.25rem",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            marginBottom: "1.5rem",
            display: "flex",
            gap: "1rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "0.5rem", flex: 1, minWidth: "260px" }}>
            <input
              id="inventory-search-input"
              type="text"
              placeholder="Search product name, SKU, or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                padding: "0.5rem 0.75rem",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "0.875rem",
                outline: "none",
              }}
            />
            <button
              type="submit"
              id="btn-inventory-search"
              style={{
                backgroundColor: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                fontWeight: "600",
                color: "#334155",
                cursor: "pointer",
              }}
            >
              Search
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: "500" }}>Category:</span>
            <select
              id="inventory-category-filter"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
                setLoading(true);
              }}
              style={{
                padding: "0.5rem 0.75rem",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "0.875rem",
                backgroundColor: "#ffffff",
                color: "#334155",
                cursor: "pointer",
              }}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: "500" }}>Stock Status:</span>
            <select
              id="inventory-status-filter"
              value={stockStatusFilter}
              onChange={(e) => {
                setStockStatusFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
                setLoading(true);
              }}
              style={{
                padding: "0.5rem 0.75rem",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "0.875rem",
                backgroundColor: "#ffffff",
                color: "#334155",
                cursor: "pointer",
              }}
            >
              <option value="ALL">All Items</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              padding: "0.75rem 1rem",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              color: "#b91c1c",
              fontSize: "0.875rem",
              marginBottom: "1.5rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Inventory Table */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600" }}>Product</th>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600" }}>SKU</th>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600" }}>Category</th>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600" }}>Unit</th>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600", textAlign: "right" }}>
                  Current Stock
                </th>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600", textAlign: "right" }}>
                  Reorder Level
                </th>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600" }}>Stock Status</th>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600", textAlign: "right" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: "2.5rem", textAlign: "center", color: "#64748b" }}>
                    Loading inventory balances...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "2.5rem", textAlign: "center", color: "#64748b" }}>
                    No inventory records match current criteria.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const p = row.product;
                  const isOut = row.is_out_of_stock;
                  const isLow = row.is_low_stock;

                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background-color 0.15s ease",
                      }}
                    >
                      <td style={{ padding: "0.875rem 1rem" }}>
                        <div style={{ fontWeight: "600", color: "#1e293b" }}>{p.name}</div>
                        {p.barcode && (
                          <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontFamily: "monospace" }}>
                            {p.barcode}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "0.875rem 1rem", fontFamily: "monospace", color: "#334155" }}>{p.sku}</td>
                      <td style={{ padding: "0.875rem 1rem" }}>
                        <span
                          style={{
                            backgroundColor: "#f1f5f9",
                            color: "#334155",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: "500",
                          }}
                        >
                          {p.category?.name || "Uncategorized"}
                        </span>
                      </td>
                      <td style={{ padding: "0.875rem 1rem", color: "#475569" }}>{p.unit}</td>
                      <td style={{ padding: "0.875rem 1rem", textAlign: "right" }}>
                        <strong
                          style={{
                            fontFamily: "monospace",
                            fontSize: "0.95rem",
                            color: isOut ? "#dc2626" : isLow ? "#d97706" : "#15803d",
                          }}
                        >
                          {row.stock_quantity}
                        </strong>
                      </td>
                      <td style={{ padding: "0.875rem 1rem", textAlign: "right", fontFamily: "monospace", color: "#64748b" }}>
                        {row.reorder_level}
                      </td>
                      <td style={{ padding: "0.875rem 1rem" }}>
                        {isOut ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "0.2rem 0.55rem",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: "600",
                              backgroundColor: "#fee2e2",
                              color: "#b91c1c",
                            }}
                          >
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "0.2rem 0.55rem",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: "600",
                              backgroundColor: "#fef3c7",
                              color: "#b45309",
                            }}
                          >
                            Low Stock
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "0.2rem 0.55rem",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: "600",
                              backgroundColor: "#dcfce7",
                              color: "#15803d",
                            }}
                          >
                            In Stock
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.875rem 1rem", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                          {canAdjust && (
                            <button
                              id={`btn-adjust-${p.id}`}
                              onClick={() => handleOpenAdjust({ ...p, stock_quantity: row.stock_quantity })}
                              style={{
                                padding: "0.35rem 0.75rem",
                                backgroundColor: "#2563eb",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "0.75rem",
                                fontWeight: "600",
                                color: "#ffffff",
                                cursor: "pointer",
                              }}
                            >
                              Adjust
                            </button>
                          )}
                          <button
                            id={`btn-history-${p.id}`}
                            onClick={() => handleOpenHistory({ ...p, stock_quantity: row.stock_quantity })}
                            style={{
                              padding: "0.35rem 0.75rem",
                              backgroundColor: "#f8fafc",
                              border: "1px solid #cbd5e1",
                              borderRadius: "6px",
                              fontSize: "0.75rem",
                              fontWeight: "600",
                              color: "#334155",
                              cursor: "pointer",
                            }}
                          >
                            History
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.875rem 1.25rem",
              backgroundColor: "#fafafa",
              borderTop: "1px solid #e2e8f0",
              fontSize: "0.875rem",
              color: "#64748b",
            }}
          >
            <span>
              Showing {items.length} of {pagination.total} inventory items
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                disabled={pagination.page <= 1}
                onClick={() => {
                  setPagination((prev) => ({ ...prev, page: prev.page - 1 }));
                  setLoading(true);
                }}
                style={{
                  padding: "0.35rem 0.75rem",
                  backgroundColor: pagination.page <= 1 ? "#f1f5f9" : "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  color: pagination.page <= 1 ? "#94a3b8" : "#334155",
                  cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
                }}
              >
                Previous
              </button>
              <span style={{ padding: "0.35rem 0.5rem", fontWeight: "600" }}>
                Page {pagination.page} of {pagination.pages || 1}
              </span>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => {
                  setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
                  setLoading(true);
                }}
                style={{
                  padding: "0.35rem 0.75rem",
                  backgroundColor: pagination.page >= pagination.pages ? "#f1f5f9" : "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  color: pagination.page >= pagination.pages ? "#94a3b8" : "#334155",
                  cursor: pagination.page >= pagination.pages ? "not-allowed" : "pointer",
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && selectedProduct && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "1.75rem",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#0f172a", marginTop: 0, marginBottom: "0.5rem" }}>
              Manual Stock Adjustment
            </h2>
            <div
              style={{
                fontSize: "0.875rem",
                color: "#475569",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                padding: "0.6rem 0.85rem",
                marginBottom: "1rem",
              }}
            >
              <div>
                Product: <strong>{selectedProduct.name}</strong> ({selectedProduct.sku})
              </div>
              <div style={{ marginTop: "0.25rem" }}>
                Current Stock:{" "}
                <strong style={{ fontFamily: "monospace", color: "#0f172a" }}>
                  {selectedProduct.stock_quantity} {selectedProduct.unit}
                </strong>
              </div>
            </div>

            {adjustError && (
              <div
                style={{
                  padding: "0.5rem 0.75rem",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "6px",
                  color: "#b91c1c",
                  fontSize: "0.8125rem",
                  marginBottom: "1rem",
                }}
              >
                {adjustError}
              </div>
            )}

            <form onSubmit={handleAdjustSubmit}>
              {/* Direction Toggle */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.35rem" }}>
                  Adjustment Direction *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setAdjustData({ ...adjustData, direction: "IN" })}
                    style={{
                      padding: "0.6rem",
                      borderRadius: "6px",
                      border: adjustData.direction === "IN" ? "2px solid #16a34a" : "1px solid #cbd5e1",
                      backgroundColor: adjustData.direction === "IN" ? "#f0fdf4" : "#ffffff",
                      color: adjustData.direction === "IN" ? "#16a34a" : "#475569",
                      fontWeight: "700",
                      fontSize: "0.875rem",
                      cursor: "pointer",
                    }}
                  >
                    + Add Stock (IN)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustData({ ...adjustData, direction: "OUT" })}
                    style={{
                      padding: "0.6rem",
                      borderRadius: "6px",
                      border: adjustData.direction === "OUT" ? "2px solid #dc2626" : "1px solid #cbd5e1",
                      backgroundColor: adjustData.direction === "OUT" ? "#fef2f2" : "#ffffff",
                      color: adjustData.direction === "OUT" ? "#dc2626" : "#475569",
                      fontWeight: "700",
                      fontSize: "0.875rem",
                      cursor: "pointer",
                    }}
                  >
                    - Deduct Stock (OUT)
                  </button>
                </div>
              </div>

              {/* Quantity Input */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.25rem" }}>
                  Quantity ({selectedProduct.unit}) *
                </label>
                <input
                  id="modal-adjust-quantity"
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  placeholder="0.000"
                  value={adjustData.quantity}
                  onChange={(e) => setAdjustData({ ...adjustData, quantity: e.target.value })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "0.5rem 0.75rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    outline: "none",
                  }}
                />
              </div>

              {/* Reason Selector */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.25rem" }}>
                  Reason *
                </label>
                <select
                  id="modal-adjust-reason"
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "0.5rem 0.75rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    backgroundColor: "#ffffff",
                    outline: "none",
                  }}
                >
                  <option value="PHYSICAL_COUNT">Physical Count Correction</option>
                  {adjustData.direction === "OUT" && (
                    <>
                      <option value="DAMAGED">Damaged Goods</option>
                      <option value="EXPIRED">Expired Inventory</option>
                    </>
                  )}
                  <option value="CORRECTION">General Ledger Correction</option>
                  <option value="OTHER">Other Reason</option>
                </select>
              </div>

              {/* Remarks */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.25rem" }}>
                  Remarks / Justification
                </label>
                <textarea
                  id="modal-adjust-remarks"
                  rows={2}
                  placeholder="Optional audit explanation..."
                  value={adjustData.remarks}
                  onChange={(e) => setAdjustData({ ...adjustData, remarks: e.target.value })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "0.5rem 0.75rem",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Projected Stock Preview */}
              {adjustData.quantity && !isNaN(parseFloat(adjustData.quantity)) && (
                <div
                  style={{
                    padding: "0.5rem 0.75rem",
                    backgroundColor: parseFloat(projectedStock) < 0 ? "#fef2f2" : "#f0fdf4",
                    border: parseFloat(projectedStock) < 0 ? "1px solid #fecaca" : "1px solid #bbf7d0",
                    borderRadius: "6px",
                    fontSize: "0.8125rem",
                    marginBottom: "1.25rem",
                    color: parseFloat(projectedStock) < 0 ? "#b91c1c" : "#15803d",
                  }}
                >
                  Projected Stock Balance: <strong>{projectedStock} {selectedProduct.unit}</strong>
                  {parseFloat(projectedStock) < 0 && " (Error: Cannot result in negative stock)"}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={handleCloseAdjust}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    fontWeight: "600",
                    color: "#475569",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-modal-adjust-submit"
                  disabled={adjustSubmitting || (adjustData.direction === "OUT" && parseFloat(projectedStock) < 0)}
                  style={{
                    padding: "0.5rem 1.25rem",
                    backgroundColor: "#2563eb",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    fontWeight: "600",
                    color: "#ffffff",
                    cursor: adjustSubmitting ? "not-allowed" : "pointer",
                  }}
                >
                  {adjustSubmitting ? "Adjusting..." : "Confirm Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Movement History Drawer / Modal */}
      {isHistoryOpen && historyProduct && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "1.75rem",
              width: "100%",
              maxWidth: "760px",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                  Movement History: {historyProduct.name}
                </h2>
                <div style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.25rem" }}>
                  SKU: <strong style={{ fontFamily: "monospace" }}>{historyProduct.sku}</strong> | Current Stock:{" "}
                  <strong>{historyProduct.stock_quantity} {historyProduct.unit}</strong>
                </div>
              </div>
              <button
                onClick={handleCloseHistory}
                style={{
                  backgroundColor: "transparent",
                  border: "none",
                  fontSize: "1.25rem",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                &times;
              </button>
            </div>

            {/* Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: "500" }}>Filter Type:</span>
              <select
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
                style={{
                  padding: "0.35rem 0.6rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  fontSize: "0.8125rem",
                  backgroundColor: "#ffffff",
                }}
              >
                <option value="">All Movement Types</option>
                <option value="ADJUSTMENT_IN">ADJUSTMENT_IN</option>
                <option value="ADJUSTMENT_OUT">ADJUSTMENT_OUT</option>
                <option value="DAMAGED">DAMAGED</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="PURCHASE">PURCHASE</option>
                <option value="SALE">SALE</option>
                <option value="RETURN">RETURN</option>
              </select>
            </div>

            {historyError && (
              <div
                style={{
                  padding: "0.5rem 0.75rem",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "6px",
                  color: "#b91c1c",
                  fontSize: "0.8125rem",
                  marginBottom: "1rem",
                }}
              >
                {historyError}
              </div>
            )}

            {/* History Table Container */}
            <div style={{ flex: 1, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "0.6rem 0.75rem", color: "#475569" }}>Timestamp</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "#475569" }}>Type</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "#475569", textAlign: "right" }}>Qty</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "#475569", textAlign: "right" }}>Balance</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "#475569" }}>Performed By</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "#475569" }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                        Loading movement history...
                      </td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                        No stock movement ledger records found.
                      </td>
                    </tr>
                  ) : (
                    movements.map((m) => {
                      const isPositive = ["ADJUSTMENT_IN", "PURCHASE", "RETURN"].includes(m.movement_type);
                      return (
                        <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "0.6rem 0.75rem", color: "#64748b", whiteSpace: "nowrap" }}>
                            {m.created_at ? new Date(m.created_at).toLocaleString() : "—"}
                          </td>
                          <td style={{ padding: "0.6rem 0.75rem" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.15rem 0.45rem",
                                borderRadius: "4px",
                                fontSize: "0.7rem",
                                fontWeight: "600",
                                backgroundColor: isPositive ? "#f0fdf4" : "#fef2f2",
                                color: isPositive ? "#16a34a" : "#dc2626",
                              }}
                            >
                              {m.movement_type}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "0.6rem 0.75rem",
                              textAlign: "right",
                              fontFamily: "monospace",
                              fontWeight: "700",
                              color: isPositive ? "#16a34a" : "#dc2626",
                            }}
                          >
                            {isPositive ? `+${m.quantity}` : `-${m.quantity}`}
                          </td>
                          <td style={{ padding: "0.6rem 0.75rem", textAlign: "right", fontFamily: "monospace", color: "#475569" }}>
                            {m.quantity_before} &rarr; <strong>{m.quantity_after}</strong>
                          </td>
                          <td style={{ padding: "0.6rem 0.75rem", color: "#475569" }}>
                            {m.created_by ? m.created_by.name || m.created_by.email : "System"}
                          </td>
                          <td style={{ padding: "0.6rem 0.75rem", color: "#64748b", maxWidth: "200px" }}>
                            {m.remarks || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Close Button */}
            <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleCloseHistory}
                style={{
                  padding: "0.5rem 1.25rem",
                  backgroundColor: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  fontSize: "0.875rem",
                  fontWeight: "600",
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
