import { useState, useEffect } from "react";
import useAuth from "../modules/auth/useAuth";
import {
  getInventoryApi,
  getStockMovementsApi,
  createStockAdjustmentApi,
} from "../modules/inventory/api";
import { getCategoriesApi } from "../modules/categories/api";
import {
  PageHeader,
  Button,
  DataTable,
  Pagination,
  StatusBadge,
  Modal,
  Drawer,
  FormField,
  Input,
  Select,
  Textarea,
  Toast,
} from "../components/common";

export const InventoryPage = () => {
  const { user } = useAuth();
  const canAdjust = user?.role === "OWNER" || user?.role?.name === "OWNER";

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 10, total: 0, pages: 1 });
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState(null);

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

  // Load categories for filter dropdown
  useEffect(() => {
    let ignore = false;
    const fetchCats = async () => {
      try {
        const res = await getCategoriesApi({ is_active: true, per_page: 100 });
        if (!ignore) {
          const catList = res?.data?.items || res?.items || (Array.isArray(res) ? res : []);
          setCategories(catList);
        }
      } catch {
        // Non-blocking category fetch error
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
        setLoading(true);
        setError("");
        const params = {
          page: pagination.page || 1,
          per_page: 10,
          stock_status: stockStatusFilter,
        };
        if (activeSearch.trim()) params.search = activeSearch.trim();
        if (categoryFilter) params.category_id = parseInt(categoryFilter, 10);

        const res = await getInventoryApi(params);
        if (!ignore) {
          const rawItems = res?.data?.items || res?.items || (Array.isArray(res) ? res : []);
          const pag = res?.data?.pagination || res?.pagination || {
            page: pagination.page,
            per_page: 10,
            total: rawItems.length,
            pages: 1,
          };
          setItems(rawItems);
          setPagination(pag);
        }
      } catch (err) {
        if (!ignore) {
          const errMsg =
            err.response?.data?.error?.message ||
            err.response?.data?.message ||
            err.message ||
            "Network error loading inventory.";
          setError(errMsg);
          setItems([]);
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
  }, [pagination.page, stockStatusFilter, activeSearch, categoryFilter, refreshTrigger]);

  // Load movement history for a selected product
  useEffect(() => {
    const prodId = historyProduct?.id || historyProduct?.product?.id;
    if (!isHistoryOpen || !prodId) return;

    let ignore = false;
    const fetchHistory = async () => {
      try {
        setHistoryLoading(true);
        setHistoryError("");
        const params = {
          page: historyPagination.page || 1,
          per_page: 10,
        };
        if (movementTypeFilter) params.movement_type = movementTypeFilter;

        const res = await getStockMovementsApi(prodId, params);
        if (!ignore) {
          if (res?.status === "error") {
            setHistoryError(res?.error?.message || "Failed to load stock history.");
            setMovements([]);
          } else {
            const historyItems = res?.data?.items || res?.items || (Array.isArray(res) ? res : []);
            const pag = res?.data?.pagination || res?.pagination || {
              page: 1,
              per_page: 10,
              total: historyItems.length,
              pages: 1,
            };
            setMovements(historyItems);
            setHistoryPagination(pag);
          }
        }
      } catch (err) {
        if (!ignore) {
          if (err.response?.status === 404) {
            setHistoryError("Product record not found. The inventory catalog has been refreshed.");
            setRefreshTrigger((prev) => prev + 1);
          } else {
            const errMsg =
              err.response?.data?.error?.message ||
              err.response?.data?.message ||
              err.message ||
              "Failed to load stock history.";
            setHistoryError(errMsg);
          }
          setMovements([]);
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
    setActiveSearch(searchTerm.trim());
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSearchClear = () => {
    setSearchTerm("");
    setActiveSearch("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleOpenAdjust = (itemOrProduct) => {
    const p = itemOrProduct?.product || itemOrProduct;
    const stockQty = itemOrProduct?.stock_quantity ?? p?.stock_quantity ?? "0.000";
    setSelectedProduct({ ...p, stock_quantity: stockQty });
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

  const handleOpenHistory = (itemOrProduct) => {
    const p = itemOrProduct?.product || itemOrProduct;
    const stockQty = itemOrProduct?.stock_quantity ?? p?.stock_quantity ?? "0.000";
    setHistoryProduct({ ...p, stock_quantity: stockQty });
    setHistoryError("");
    setMovements([]);
    setMovementTypeFilter("");
    setHistoryPagination({ page: 1, per_page: 10, total: 0, pages: 1 });
    setIsHistoryOpen(true);
  };

  const handleCloseHistory = () => {
    setIsHistoryOpen(false);
    setHistoryProduct(null);
    setHistoryError("");
    setMovements([]);
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    const qty = parseFloat(adjustData.quantity);
    if (isNaN(qty) || qty <= 0) {
      setAdjustError("Please enter a valid positive quantity greater than zero.");
      return;
    }

    const currentStock = parseFloat(selectedProduct?.stock_quantity ?? 0);
    if (adjustData.direction === "OUT") {
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
      // Defensively map reasons to certified backend enum VALID_REASONS
      const normalizedReason =
        adjustData.reason === "DAMAGE"
          ? "DAMAGED"
          : adjustData.reason === "EXPIRY"
          ? "EXPIRED"
          : adjustData.reason === "THEFT"
          ? "OTHER"
          : adjustData.reason;

      await createStockAdjustmentApi({
        product_id: selectedProduct.id,
        direction: adjustData.direction,
        quantity: qty.toFixed(3),
        reason: normalizedReason,
        remarks: adjustData.remarks?.trim() || null,
      });

      setToastMessage({
        type: "success",
        text: `Stock adjusted for "${selectedProduct.name}" successfully.`,
      });
      setIsAdjustModalOpen(false);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      const errMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        "Failed to adjust stock.";
      setAdjustError(errMsg);
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // Projected stock preview calculation
  const calculateProjectedStock = () => {
    if (!selectedProduct) return null;
    const current = parseFloat(selectedProduct.stock_quantity) || 0;
    const qty = parseFloat(adjustData.quantity);
    if (isNaN(qty) || qty <= 0) return null;
    if (adjustData.direction === "IN") {
      return (current + qty).toFixed(3);
    }
    return (current - qty).toFixed(3);
  };

  const projectedStock = calculateProjectedStock();

  const columns = [
    {
      header: "Product",
      accessor: (row) => {
        const p = row.product || row;
        return (
          <div>
            <div style={{ fontWeight: 600, color: "var(--color-text)" }}>{p.name || "Unnamed Product"}</div>
            {p.barcode && (
              <div style={{ fontSize: "11px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                {p.barcode}
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: "SKU",
      accessor: (row) => {
        const p = row.product || row;
        return (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-text-secondary)" }}>
            {p.sku || "—"}
          </span>
        );
      },
    },
    {
      header: "Category",
      accessor: (row) => {
        const p = row.product || row;
        return (
          <span
            style={{
              backgroundColor: "var(--color-bg)",
              border: "1px solid var(--color-border-subtle)",
              color: "var(--color-text)",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            {p.category?.name || "Uncategorized"}
          </span>
        );
      },
    },
    {
      header: "Unit",
      accessor: (row) => {
        const p = row.product || row;
        return p.unit || "pcs";
      },
    },
    {
      header: "Current Stock",
      align: "right",
      accessor: (row) => {
        const isOut = Boolean(row.is_out_of_stock);
        const isLow = Boolean(row.is_low_stock);
        return (
          <strong
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "14px",
              color: isOut ? "var(--color-danger)" : isLow ? "var(--color-warning)" : "var(--color-success)",
            }}
          >
            {row.stock_quantity ?? "0.000"}
          </strong>
        );
      },
    },
    {
      header: "Reorder Level",
      align: "right",
      accessor: (row) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--color-text-secondary)" }}>
          {row.reorder_level ?? "0.000"}
        </span>
      ),
    },
    {
      header: "Stock Status",
      accessor: (row) => {
        if (row.is_out_of_stock) {
          return <StatusBadge status="OUT OF STOCK" variant="danger" />;
        }
        if (row.is_low_stock) {
          return <StatusBadge status="LOW STOCK" variant="warning" />;
        }
        return <StatusBadge status="IN STOCK" variant="success" />;
      },
    },
    {
      header: "Actions",
      align: "right",
      accessor: (row) => {
        const p = row.product || row;
        return (
          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
            {canAdjust && (
              <Button
                id={`btn-adjust-${p.id}`}
                variant="primary"
                size="sm"
                onClick={() => handleOpenAdjust({ ...p, stock_quantity: row.stock_quantity })}
              >
                Adjust
              </Button>
            )}
            <Button
              id={`btn-history-${p.id}`}
              variant="secondary"
              size="sm"
              onClick={() => handleOpenHistory({ ...p, stock_quantity: row.stock_quantity })}
            >
              History
            </Button>
          </div>
        );
      },
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
        title="Inventory Management"
        subtitle="Authoritative stock ledger balances, low-stock detection, and audit history."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAnalytics((prev) => !prev)}
          >
            {showAnalytics ? "Hide Stock Bar Chart" : "Show Stock Bar Chart"}
          </Button>
        }
      />

      {/* Stock Level & Safety Threshold Bar Chart Section */}
      {showAnalytics && (
        <StockLevelBarChart
          items={items}
          hoveredPoint={hoveredPoint}
          setHoveredPoint={setHoveredPoint}
        />
      )}

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
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "8px", flex: 1, minWidth: "260px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              id="inventory-search-input"
              type="text"
              placeholder="Search product name, SKU, or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                height: "38px",
                padding: "0 28px 0 12px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                fontSize: "13px",
                color: "var(--color-text)",
                backgroundColor: "var(--color-surface)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleSearchClear}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                  fontSize: "14px",
                  padding: "2px",
                }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <Button
            type="submit"
            id="btn-inventory-search"
            variant="secondary"
            size="md"
          >
            Search
          </Button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="inventory-category-filter" style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
            Category:
          </label>
          <select
            id="inventory-category-filter"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
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
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="inventory-status-filter" style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
            Status:
          </label>
          <select
            id="inventory-status-filter"
            value={stockStatusFilter}
            onChange={(e) => {
              setStockStatusFilter(e.target.value);
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
            <option value="ALL">All Stock Statuses</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Error Notice */}
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
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{error}</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRefreshTrigger((prev) => prev + 1)}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Inventory Table */}
      <DataTable
        id="inventory-data-table"
        columns={columns}
        data={items}
        keyExtractor={(row, idx) => row.product?.id || row.id || idx}
        loading={loading}
        emptyTitle="No inventory records found"
        emptyMessage="No items match your search or filter criteria."
      />

      {/* Pagination */}
      {!loading && items.length > 0 && pagination.pages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.pages}
          totalItems={pagination.total}
          onPageChange={(p) => {
            setPagination((prev) => ({ ...prev, page: p }));
          }}
        />
      )}

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={isAdjustModalOpen && Boolean(selectedProduct)}
        onClose={handleCloseAdjust}
        title="Manual Stock Adjustment"
        maxWidth="500px"
      >
        {selectedProduct && (
          <>
            <div
              style={{
                fontSize: "13px",
                color: "var(--color-text)",
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                padding: "12px 16px",
                marginBottom: "16px",
              }}
            >
              <div>
                Product: <strong>{selectedProduct.name}</strong> ({selectedProduct.sku})
              </div>
              <div style={{ marginTop: "4px" }}>
                Current Stock:{" "}
                <strong style={{ fontFamily: "var(--font-mono)", color: "var(--color-primary)" }}>
                  {selectedProduct.stock_quantity} {selectedProduct.unit}
                </strong>
              </div>
            </div>

            {adjustError && (
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
                {adjustError}
              </div>
            )}

            <form onSubmit={handleAdjustSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--color-text)", marginBottom: "6px" }}>
                  Adjustment Direction *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <Button
                    type="button"
                    variant={adjustData.direction === "IN" ? "primary" : "secondary"}
                    size="md"
                    onClick={() => setAdjustData({ ...adjustData, direction: "IN" })}
                  >
                    + Stock In (Increase)
                  </Button>
                  <Button
                    type="button"
                    variant={adjustData.direction === "OUT" ? "danger" : "secondary"}
                    size="md"
                    onClick={() => setAdjustData({ ...adjustData, direction: "OUT" })}
                  >
                    - Stock Out (Deduct)
                  </Button>
                </div>
              </div>

              <FormField label={`Quantity (${selectedProduct.unit || "pcs"})`} required id="modal-adjust-qty">
                <Input
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  placeholder="0.000"
                  value={adjustData.quantity}
                  onChange={(e) => setAdjustData({ ...adjustData, quantity: e.target.value })}
                />
              </FormField>

              {/* Projected Balance Card */}
              {projectedStock !== null && (
                <div
                  style={{
                    padding: "10px 14px",
                    backgroundColor: parseFloat(projectedStock) < 0 ? "var(--color-danger-soft)" : "var(--color-surface)",
                    border: `1px solid ${parseFloat(projectedStock) < 0 ? "var(--color-danger)" : "var(--color-border)"}`,
                    borderRadius: "var(--radius-md)",
                    marginBottom: "16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "13px",
                  }}
                >
                  <span style={{ color: "var(--color-text-secondary)" }}>Projected Balance:</span>
                  <strong
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "14px",
                      color: parseFloat(projectedStock) < 0 ? "var(--color-danger)" : "var(--color-primary)",
                    }}
                  >
                    {projectedStock} {selectedProduct.unit}
                  </strong>
                </div>
              )}

              <FormField label="Reason for Adjustment" required id="modal-adjust-reason">
                <Select
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                >
                  <option value="PHYSICAL_COUNT">Physical Inventory Count Reconciliation</option>
                  <option value="DAMAGED">Damaged Goods / Breakage</option>
                  <option value="EXPIRED">Expired Stock Disposal</option>
                  <option value="CORRECTION">Ledger Correction</option>
                  <option value="OTHER">Other Reason / Discrepancy</option>
                </Select>
              </FormField>

              <FormField label="Audit Remarks / Notes" id="modal-adjust-remarks">
                <Textarea
                  rows={2}
                  placeholder="Optional audit justification note..."
                  value={adjustData.remarks}
                  onChange={(e) => setAdjustData({ ...adjustData, remarks: e.target.value })}
                />
              </FormField>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                <Button
                  id="btn-adjust-cancel"
                  variant="secondary"
                  size="md"
                  onClick={handleCloseAdjust}
                  disabled={adjustSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  id="btn-modal-adjust-submit"
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={adjustSubmitting}
                  disabled={adjustSubmitting || (adjustData.direction === "OUT" && parseFloat(projectedStock) < 0)}
                >
                  {adjustSubmitting ? "Adjusting..." : "Confirm Adjustment"}
                </Button>
              </div>
            </form>
          </>
        )}
      </Modal>

      {/* Movement History Drawer */}
      <Drawer
        isOpen={isHistoryOpen && Boolean(historyProduct)}
        onClose={handleCloseHistory}
        title={historyProduct ? `Ledger: ${historyProduct.name}` : "Stock Movements"}
        subtitle={
          historyProduct ? (
            <span>
              SKU: <strong style={{ fontFamily: "var(--font-mono)" }}>{historyProduct.sku}</strong> | Current:{" "}
              <strong>{historyProduct.stock_quantity} {historyProduct.unit}</strong>
            </span>
          ) : null
        }
        width="680px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Movement Type Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label htmlFor="history-movement-type-filter" style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
              Filter:
            </label>
            <select
              id="history-movement-type-filter"
              value={movementTypeFilter}
              onChange={(e) => {
                setMovementTypeFilter(e.target.value);
                setHistoryPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{
                height: "36px",
                padding: "0 10px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                fontSize: "13px",
                backgroundColor: "var(--color-surface)",
                color: "var(--color-text)",
              }}
            >
              <option value="">All Movement Types</option>
              <option value="ADJUSTMENT_IN">Adjustment In (+)</option>
              <option value="ADJUSTMENT_OUT">Adjustment Out (-)</option>
              <option value="PURCHASE">Purchase Receipt (+)</option>
              <option value="SALE">Sale Deduction (-)</option>
              <option value="RETURN">Return Restock (+)</option>
              <option value="DAMAGED">Damaged Goods (-)</option>
              <option value="EXPIRED">Expired Stock (-)</option>
            </select>
          </div>

          {historyError && (
            <div
              role="alert"
              style={{
                padding: "10px 14px",
                backgroundColor: "var(--color-danger-soft)",
                border: "1px solid var(--color-danger)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-danger)",
                fontSize: "13px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span>{historyError}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setHistoryPagination((prev) => ({ ...prev }))}
              >
                Retry
              </Button>
            </div>
          )}

          {/* Movements Table */}
          <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--color-bg)", borderBottom: "1px solid var(--color-border)" }}>
                  <th style={{ padding: "8px 10px", color: "var(--color-text-secondary)" }}>Timestamp</th>
                  <th style={{ padding: "8px 10px", color: "var(--color-text-secondary)" }}>Type</th>
                  <th style={{ padding: "8px 10px", color: "var(--color-text-secondary)", textAlign: "right" }}>Qty</th>
                  <th style={{ padding: "8px 10px", color: "var(--color-text-secondary)", textAlign: "right" }}>Balance</th>
                  <th style={{ padding: "8px 10px", color: "var(--color-text-secondary)" }}>User</th>
                  <th style={{ padding: "8px 10px", color: "var(--color-text-secondary)" }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "var(--color-text-secondary)" }}>
                      Loading movement history...
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "var(--color-text-muted)" }}>
                      No stock movements found.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => {
                    const isPositive = ["ADJUSTMENT_IN", "PURCHASE", "RETURN"].includes(m.movement_type);
                    return (
                      <tr key={m.id} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                        <td style={{ padding: "8px 10px", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                          {m.created_at ? new Date(m.created_at).toLocaleString() : "—"}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <StatusBadge
                            status={m.movement_type}
                            variant={isPositive ? "success" : "danger"}
                          />
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            textAlign: "right",
                            fontFamily: "var(--font-mono)",
                            fontWeight: 700,
                            color: isPositive ? "var(--color-success)" : "var(--color-danger)",
                          }}
                        >
                          {isPositive ? `+${m.quantity}` : `-${m.quantity}`}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--color-text)" }}>
                          {m.quantity_before} &rarr; <strong>{m.quantity_after}</strong>
                        </td>
                        <td style={{ padding: "8px 10px", color: "var(--color-text)" }}>
                          {m.created_by ? m.created_by.name || m.created_by.email : "System"}
                        </td>
                        <td style={{ padding: "8px 10px", color: "var(--color-text-secondary)", maxWidth: "180px" }}>
                          {m.remarks || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* History Pagination */}
          {!historyLoading && movements.length > 0 && historyPagination.pages > 1 && (
            <Pagination
              currentPage={historyPagination.page}
              totalPages={historyPagination.pages}
              totalItems={historyPagination.total}
              onPageChange={(p) => setHistoryPagination((prev) => ({ ...prev, page: p }))}
            />
          )}
        </div>
      </Drawer>
    </div>
  );
};

/* Subcomponents */

const StockLevelBarChart = ({ items = [], hoveredPoint, setHoveredPoint }) => {
  const list = Array.isArray(items) ? items : [];

  // Determine maximum value across stock and reorder levels safely
  const rawMax =
    list.length > 0
      ? Math.max(
          ...list.map((it) =>
            Math.max(parseFloat(it.stock_quantity) || 0, parseFloat(it.reorder_level) || 0)
          )
        )
      : 0;
  const maxVal = Math.max(10, Math.ceil((rawMax * 1.25) / 5) * 5);

  const chartWidth = Math.max(800, list.length * 65);
  const chartHeight = 280;
  const padLeft = 60;
  const padRight = 40;
  const padTop = 30;
  const padBottom = 65;
  const usableWidth = chartWidth - padLeft - padRight;
  const usableHeight = chartHeight - padTop - padBottom;

  const yTiers = [0, 0.25, 0.5, 0.75, 1];

  const slotWidth = list.length > 0 ? usableWidth / list.length : usableWidth;
  const groupWidth = Math.min(70, Math.max(26, slotWidth * 0.65));
  const barWidth = Math.max(8, (groupWidth - 6) / 2);

  const hp = hoveredPoint?.product || hoveredPoint;
  const hProdId = hp?.id || hoveredPoint?.id;
  const hName = hp?.name || "Product";
  const hSku = hp?.sku || "";
  const hCat = hp?.category?.name || "Uncategorized";
  const hUnit = hp?.unit || "units";
  const hStock = parseFloat(hoveredPoint?.stock_quantity ?? 0);
  const hReorder = parseFloat(hoveredPoint?.reorder_level ?? 0);
  const hIsOut = Boolean(hoveredPoint?.is_out_of_stock);
  const hIsLow = Boolean(hoveredPoint?.is_low_stock);

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        padding: "20px 24px",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Chart Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
            Stock Level & Safety Reorder Threshold
          </h2>
          <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
            Comparative bar chart displaying on-hand stock quantities against safety reorder thresholds
          </span>
        </div>

        {/* Legend & Summary Badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          {/* Legend 1: Current Stock */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--color-text)" }}>
            <span
              style={{
                width: "14px",
                height: "14px",
                backgroundColor: "#10B981",
                borderRadius: "3px",
                display: "inline-block",
              }}
            />
            <span style={{ fontWeight: 600 }}>Current Stock</span>
          </div>

          {/* Legend 2: Reorder Level */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--color-text)" }}>
            <span
              style={{
                width: "14px",
                height: "14px",
                backgroundColor: "rgba(245, 158, 11, 0.25)",
                border: "1.5px solid #F59E0B",
                borderRadius: "3px",
                display: "inline-block",
              }}
            />
            <span style={{ fontWeight: 600 }}>Reorder Threshold</span>
          </div>

          {/* Quick Status Pill */}
          <div
            style={{
              fontSize: "12px",
              padding: "3px 10px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)",
              display: "flex",
              gap: "6px",
              alignItems: "center",
            }}
          >
            <span>{list.length} items plotted</span>
          </div>
        </div>
      </div>

      {/* Interactive Inspection Bar */}
      <div
        style={{
          padding: "8px 14px",
          borderRadius: "var(--radius-md)",
          backgroundColor: hoveredPoint ? "var(--color-bg)" : "transparent",
          border: hoveredPoint ? "1px solid var(--color-border-subtle)" : "1px dashed var(--color-border-subtle)",
          minHeight: "38px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "12px",
          transition: "all 0.2s ease",
        }}
      >
        {hoveredPoint ? (
          <div style={{ display: "flex", alignItems: "center", gap: "16px", width: "100%", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <strong style={{ color: "var(--color-text)", fontSize: "13px" }}>
                {hName}
              </strong>
              {hSku && (
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-muted)", fontSize: "11px" }}>
                  ({hSku})
                </span>
              )}
              <span
                style={{
                  fontSize: "11px",
                  padding: "1px 6px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border-subtle)",
                }}
              >
                {hCat}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div>
                <span style={{ color: "var(--color-text-secondary)" }}>Stock: </span>
                <strong
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: hIsOut
                      ? "var(--color-danger)"
                      : hIsLow
                      ? "var(--color-warning)"
                      : "var(--color-success)",
                  }}
                >
                  {hStock.toFixed(1)} {hUnit}
                </strong>
              </div>
              <div>
                <span style={{ color: "var(--color-text-secondary)" }}>Threshold: </span>
                <strong style={{ fontFamily: "var(--font-mono)", color: "var(--color-warning)" }}>
                  {hReorder.toFixed(1)} {hUnit}
                </strong>
              </div>
              <div>
                <StatusBadge
                  status={
                    hIsOut
                      ? "OUT OF STOCK"
                      : hIsLow
                      ? "LOW STOCK"
                      : "IN STOCK"
                  }
                  variant={
                    hIsOut
                      ? "danger"
                      : hIsLow
                      ? "warning"
                      : "success"
                  }
                />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
            Tip: Hover over any product bar group to inspect on-hand stock and safety reorder thresholds.
          </div>
        )}
      </div>

      {/* SVG Bar Chart Canvas */}
      {list.length === 0 ? (
        <div
          style={{
            padding: "60px 0",
            textAlign: "center",
            color: "var(--color-text-muted)",
            fontSize: "13px",
          }}
        >
          No inventory data available to render the bar chart.
        </div>
      ) : (
        <div style={{ width: "100%", overflowX: "auto" }}>
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            style={{ width: "100%", height: "280px", minWidth: "500px", display: "block" }}
            onMouseLeave={() => setHoveredPoint(null)}
          >
            {/* Horizontal Gridlines & Y-Axis Labels */}
            {yTiers.map((tier) => {
              const y = padTop + (1 - tier) * usableHeight;
              const labelVal = Math.round(maxVal * tier);
              return (
                <g key={tier}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={padLeft + usableWidth}
                    y2={y}
                    stroke="var(--color-border-subtle)"
                    strokeWidth="1"
                    strokeDasharray={tier === 0 ? "none" : "3 3"}
                    opacity={tier === 0 ? 0.9 : 0.6}
                  />
                  <text
                    x={padLeft - 10}
                    y={y + 4}
                    textAnchor="end"
                    fill="var(--color-text-secondary)"
                    fontSize="11px"
                    fontFamily="var(--font-mono)"
                  >
                    {labelVal}
                  </text>
                </g>
              );
            })}

            {/* Grouped Bars per Product */}
            {list.map((it, idx) => {
              const p = it.product || it;
              const prodId = p?.id || it?.id || idx;
              const prodName = p?.name || "Product";
              const prodSku = p?.sku || "";

              const isHovered = hProdId === prodId;
              const current = Math.max(0, parseFloat(it.stock_quantity) || 0);
              const reorder = Math.max(0, parseFloat(it.reorder_level) || 0);

              const currentHeight = Math.max(current > 0 ? 4 : 2, (current / maxVal) * usableHeight);
              const reorderHeight = Math.max(reorder > 0 ? 4 : 2, (reorder / maxVal) * usableHeight);

              const slotCenterX = padLeft + idx * slotWidth + slotWidth / 2;
              const bar1X = slotCenterX - groupWidth / 2;
              const bar1Y = padTop + usableHeight - currentHeight;

              const bar2X = bar1X + barWidth + 6;
              const bar2Y = padTop + usableHeight - reorderHeight;

              const bar1Color = it.is_out_of_stock
                ? "#EF4444"
                : it.is_low_stock
                ? "#F59E0B"
                : "#10B981";

              return (
                <g
                  key={prodId}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredPoint(it)}
                >
                  {/* Hover Background Card */}
                  {isHovered && (
                    <rect
                      x={slotCenterX - groupWidth / 2 - 8}
                      y={padTop - 8}
                      width={groupWidth + 16}
                      height={usableHeight + 14}
                      rx="6"
                      fill="var(--color-text)"
                      opacity="0.04"
                    />
                  )}

                  {/* Bar 1: Current Stock */}
                  <rect
                    x={bar1X}
                    y={bar1Y}
                    width={barWidth}
                    height={currentHeight}
                    rx="4"
                    ry="4"
                    fill={bar1Color}
                    opacity={isHovered ? 1 : 0.9}
                    style={{ transition: "all 0.2s ease" }}
                  />

                  {/* Bar 1 Numeric Top Label */}
                  <text
                    x={bar1X + barWidth / 2}
                    y={bar1Y - 4}
                    textAnchor="middle"
                    fill={bar1Color}
                    fontSize="10px"
                    fontWeight={700}
                    fontFamily="var(--font-mono)"
                  >
                    {current.toFixed(1)}
                  </text>

                  {/* Bar 2: Reorder Threshold */}
                  <rect
                    x={bar2X}
                    y={bar2Y}
                    width={barWidth}
                    height={reorderHeight}
                    rx="4"
                    ry="4"
                    fill="rgba(245, 158, 11, 0.2)"
                    stroke="#F59E0B"
                    strokeWidth="1.5"
                    opacity={isHovered ? 1 : 0.85}
                    style={{ transition: "all 0.2s ease" }}
                  />

                  {/* Bar 2 Numeric Top Label */}
                  {reorder > 0 && (
                    <text
                      x={bar2X + barWidth / 2}
                      y={bar2Y - 4}
                      textAnchor="middle"
                      fill="#F59E0B"
                      fontSize="10px"
                      fontWeight={600}
                      fontFamily="var(--font-mono)"
                    >
                      {reorder.toFixed(1)}
                    </text>
                  )}

                  {/* X-Axis Product Label */}
                  <text
                    x={slotCenterX}
                    y={padTop + usableHeight + 20}
                    textAnchor="middle"
                    fill={isHovered ? "var(--color-text)" : "var(--color-text-secondary)"}
                    fontSize="11px"
                    fontWeight={isHovered ? 700 : 500}
                  >
                    {prodName.length > 14 ? `${prodName.slice(0, 13)}…` : prodName}
                  </text>

                  {/* X-Axis SKU Subtitle */}
                  {prodSku && (
                    <text
                      x={slotCenterX}
                      y={padTop + usableHeight + 35}
                      textAnchor="middle"
                      fill="var(--color-text-muted)"
                      fontSize="10px"
                      fontFamily="var(--font-mono)"
                    >
                      {prodSku}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
