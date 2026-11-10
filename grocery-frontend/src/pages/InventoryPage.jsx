import { useState, useEffect, useCallback } from "react";
import {
  Boxes,
  Search,
  AlertTriangle,
  History,
  Sliders,
  TrendingDown,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
} from "lucide-react";
import {
  getInventoryApi,
  getLowStockApi,
  getStockMovementsApi,
  createStockAdjustmentApi,
} from "../api/inventory";
import {
  Button,
  Badge,
  Input,
  Select,
  Modal,
  Drawer,
  Table,
  Card,
  useToast,
} from "../components/ui";

export const InventoryPage = () => {
  const { showToast } = useToast();

  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("ALL"); // "ALL" | "LOW_STOCK"

  // Stock Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustDirection, setAdjustDirection] = useState("OUT"); // "IN" | "OUT"
  const [adjustReason, setAdjustReason] = useState("DAMAGED"); // "PHYSICAL_COUNT", "DAMAGED", "EXPIRED", "CORRECTION", "OTHER"
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustRemarks, setAdjustRemarks] = useState("");
  const [submittingAdjust, setSubmittingAdjust] = useState(false);
  const [adjustError, setAdjustError] = useState("");

  // Audit Movement Drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerProduct, setDrawerProduct] = useState(null);
  const [movements, setMovements] = useState([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      if (filterMode === "LOW_STOCK") {
        const res = await getLowStockApi({ search: search.trim() });
        const items = res.data?.items || res.items || res.data || res || [];
        setInventory(Array.isArray(items) ? items : []);
      } else {
        const res = await getInventoryApi({ search: search.trim(), per_page: 50 });
        const items = res.data?.items || res.items || res.data || res || [];
        setInventory(Array.isArray(items) ? items : []);
      }
    } catch (err) {
      showToast(err.response?.data?.error?.message || "Failed to load inventory.", "error");
    } finally {
      setLoading(false);
    }
  }, [search, filterMode, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInventory();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchInventory]);

  // Helper to extract product entity safely
  const getProduct = (row) => row?.product || row || {};
  const getStock = (row) => parseFloat(row?.stock_quantity ?? row?.current_stock ?? row?.stock ?? 0);
  const getReorder = (row) => parseFloat(row?.reorder_level ?? getProduct(row)?.reorder_level ?? 10);
  const getCost = (row) => parseFloat(getProduct(row)?.cost_price ?? row?.cost_price ?? 0);
  const getUnit = (row) => getProduct(row)?.unit || row?.unit || "units";

  // Handle open movement drawer
  const handleOpenDrawer = async (row) => {
    const p = getProduct(row);
    const prodId = p.id || row.id || row.product_id;
    setDrawerProduct({ ...row, ...p });
    setIsDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const res = await getStockMovementsApi(prodId);
      const mList = res.data?.items || res.items || res.movements || res.data || res || [];
      setMovements(Array.isArray(mList) ? mList : []);
    } catch (err) {
      showToast("Failed to load stock movement audit log.", "error");
    } finally {
      setDrawerLoading(false);
    }
  };

  // Open adjust modal
  const handleOpenAdjust = (row) => {
    const p = getProduct(row);
    setSelectedProduct({ ...row, ...p });
    setAdjustDirection("OUT");
    setAdjustReason("DAMAGED");
    setAdjustQty("");
    setAdjustRemarks("");
    setAdjustError("");
    setIsAdjustModalOpen(true);
  };

  const handleExecuteAdjust = async (e) => {
    e?.preventDefault();
    setAdjustError("");

    const qtyNum = parseFloat(adjustQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setAdjustError("Please specify a valid positive adjustment quantity.");
      return;
    }

    const prodId = selectedProduct?.id || selectedProduct?.product_id;
    if (!prodId) {
      setAdjustError("Product ID is missing.");
      return;
    }

    setSubmittingAdjust(true);
    try {
      await createStockAdjustmentApi({
        product_id: prodId,
        direction: adjustDirection,
        quantity: qtyNum.toFixed(3),
        reason: adjustReason,
        remarks: adjustRemarks.trim() || null,
      });

      showToast(`Stock level adjusted for "${selectedProduct.name}" successfully.`, "success");
      setIsAdjustModalOpen(false);
      fetchInventory();
    } catch (err) {
      setAdjustError(err.response?.data?.error?.message || "Adjustment failed.");
    } finally {
      setSubmittingAdjust(false);
    }
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "₱0.00";
    return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Aggregated metrics
  const totalValuation = inventory.reduce((sum, item) => {
    return sum + getStock(item) * getCost(item);
  }, 0);

  const totalUnits = inventory.reduce((sum, item) => {
    return sum + getStock(item);
  }, 0);

  const lowStockCount = inventory.filter((item) => {
    const stock = getStock(item);
    const reorder = getReorder(item);
    return stock <= reorder;
  }).length;

  // Projected stock preview
  const currentOnHand = selectedProduct ? getStock(selectedProduct) : 0;
  const inputQty = parseFloat(adjustQty) || 0;
  const projectedStock = adjustDirection === "IN"
    ? currentOnHand + inputQty
    : Math.max(0, currentOnHand - inputQty);

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
            Inventory Control & Valuation
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Track current stock levels, calculate FIFO inventory value, and record audited adjustments.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
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
                Total Stock Valuation
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
                {formatCurrency(totalValuation)}
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
              <Boxes size={18} />
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
            Based on unit cost valuation
          </div>
        </Card>

        <Card padding="18px">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                Total Physical Units
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
                {totalUnits.toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
              <Boxes size={18} />
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
            Across {inventory.length} store items
          </div>
        </Card>

        <Card padding="18px">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                Restock Attention
              </div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: "24px",
                  fontWeight: 800,
                  color: lowStockCount > 0 ? "var(--color-warning)" : "var(--color-success)",
                  marginTop: "4px",
                }}
              >
                {lowStockCount} items
              </div>
            </div>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                backgroundColor: lowStockCount > 0 ? "var(--color-warning-bg)" : "var(--color-success-bg)",
                color: lowStockCount > 0 ? "var(--color-warning)" : "var(--color-success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
            At or below minimum reorder point
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
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
        <div style={{ flex: 1, minWidth: "240px" }}>
          <Input
            placeholder="Search inventory items by name, barcode, or SKU..."
            icon={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setFilterMode("ALL")}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-md)",
              fontSize: "13px",
              fontWeight: 600,
              backgroundColor:
                filterMode === "ALL" ? "var(--color-primary-600)" : "var(--color-slate-100)",
              color: filterMode === "ALL" ? "#ffffff" : "var(--color-slate-700)",
              border: "1px solid",
              borderColor:
                filterMode === "ALL" ? "var(--color-primary-700)" : "var(--color-slate-200)",
              cursor: "pointer",
            }}
          >
            All Stock
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("LOW_STOCK")}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-md)",
              fontSize: "13px",
              fontWeight: 600,
              backgroundColor:
                filterMode === "LOW_STOCK"
                  ? "var(--color-danger)"
                  : "var(--color-slate-100)",
              color: filterMode === "LOW_STOCK" ? "#ffffff" : "var(--color-slate-700)",
              border: "1px solid",
              borderColor:
                filterMode === "LOW_STOCK" ? "#dc2626" : "var(--color-slate-200)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
            }}
          >
            <AlertTriangle size={14} />
            Low Stock Alerts
          </button>
        </div>
      </div>

      {/* Table */}
      <Table
        columns={[
          {
            header: "Product Item",
            key: "product_name",
            render: (_, row) => {
              const p = getProduct(row);
              return (
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                    {p.name || row.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    SKU: {p.sku || row.sku || "N/A"} • Barcode: {p.barcode || row.barcode || "N/A"}
                  </div>
                </div>
              );
            },
          },
          {
            header: "Category",
            key: "category_name",
            render: (_, row) => {
              const p = getProduct(row);
              return p.category?.name || row.category_name || row.category || "General";
            },
          },
          {
            header: "Unit Cost",
            key: "cost_price",
            align: "right",
            render: (_, row) => (
              <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>
                {formatCurrency(getCost(row))}
              </span>
            ),
          },
          {
            header: "On Hand Stock",
            key: "stock_quantity",
            align: "center",
            render: (_, row) => {
              const stock = getStock(row);
              const reorder = getReorder(row);
              const unit = getUnit(row);
              const variant = stock <= 0 ? "danger" : stock <= reorder ? "warning" : "success";
              return (
                <Badge variant={variant} size="md">
                  {stock.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}
                </Badge>
              );
            },
          },
          {
            header: "Total Stock Value",
            key: "total_value",
            align: "right",
            render: (_, row) => {
              const stock = getStock(row);
              const cost = getCost(row);
              return (
                <span className="tabular-nums" style={{ fontWeight: 700, color: "var(--text-main)" }}>
                  {formatCurrency(stock * cost)}
                </span>
              );
            },
          },
          {
            header: "Actions",
            key: "actions",
            align: "right",
            render: (_, row) => (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                <Button
                  variant="outline"
                  size="xs"
                  icon={Sliders}
                  onClick={() => handleOpenAdjust(row)}
                  title="Adjust Stock Quantity"
                >
                  Adjust
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  icon={History}
                  onClick={() => handleOpenDrawer(row)}
                  title="View Stock Movement Audit Log"
                >
                  Movements
                </Button>
              </div>
            ),
          },
        ]}
        data={inventory}
        loading={loading}
        emptyMessage="No inventory items found matching filter."
        emptyIcon={Boxes}
      />

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Adjust Stock Quantity"
        subtitle={`Product: ${selectedProduct?.name || "Selected Product"}`}
        maxWidth="460px"
      >
        <form onSubmit={handleExecuteAdjust}>
          {adjustError && (
            <div
              style={{
                padding: "10px 14px",
                marginBottom: "16px",
                backgroundColor: "var(--color-danger-bg)",
                color: "var(--color-danger-text)",
                borderRadius: "var(--radius-md)",
                fontSize: "13px",
                fontWeight: 500,
              }}
            >
              {adjustError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Current Stock vs Projected Preview */}
            <div
              style={{
                padding: "12px 14px",
                backgroundColor: "var(--color-slate-50)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>
                  Current On Hand:
                </span>
                <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>
                  {currentOnHand.toLocaleString()} {selectedProduct ? getUnit(selectedProduct) : "units"}
                </span>
              </div>
              {inputQty > 0 && (
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>
                    Projected Balance:
                  </span>
                  <span
                    style={{
                      fontSize: "15px",
                      fontWeight: 800,
                      color: adjustDirection === "IN" ? "var(--color-success)" : "var(--color-danger)",
                    }}
                  >
                    {projectedStock.toLocaleString()} {selectedProduct ? getUnit(selectedProduct) : "units"}
                  </span>
                </div>
              )}
            </div>

            {/* Direction Toggle */}
            <div>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)", display: "block", marginBottom: "6px" }}>
                Adjustment Type (Direction)
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setAdjustDirection("OUT")}
                  style={{
                    padding: "10px",
                    borderRadius: "var(--radius-md)",
                    border: "2px solid",
                    borderColor: adjustDirection === "OUT" ? "var(--color-danger)" : "var(--border-subtle)",
                    backgroundColor: adjustDirection === "OUT" ? "var(--color-danger-bg)" : "#ffffff",
                    color: adjustDirection === "OUT" ? "var(--color-danger-text)" : "var(--text-main)",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <ArrowDownRight size={16} /> Deduct Stock (OUT)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustDirection("IN")}
                  style={{
                    padding: "10px",
                    borderRadius: "var(--radius-md)",
                    border: "2px solid",
                    borderColor: adjustDirection === "IN" ? "var(--color-success)" : "var(--border-subtle)",
                    backgroundColor: adjustDirection === "IN" ? "var(--color-success-bg)" : "#ffffff",
                    color: adjustDirection === "IN" ? "var(--color-success)" : "var(--text-main)",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <ArrowUpRight size={16} /> Add Stock (IN)
                </button>
              </div>
            </div>

            {/* Reason Select */}
            <Select
              label="Adjustment Reason Code"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
            >
              <option value="DAMAGED">DAMAGED — Broken or spoiled goods (Write-off)</option>
              <option value="EXPIRED">EXPIRED — Past expiration date</option>
              <option value="PHYSICAL_COUNT">PHYSICAL_COUNT — Physical inventory audit count</option>
              <option value="CORRECTION">CORRECTION — Clerical or barcode scanning correction</option>
              <option value="OTHER">OTHER — General / miscellaneous adjustment</option>
            </Select>

            {/* Quantity */}
            <Input
              label="Adjustment Quantity"
              type="number"
              min="0.001"
              step="any"
              placeholder="e.g. 5"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              helperText="Enter a positive quantity value."
              required
              autoFocus
            />

            {/* Remarks / Notes */}
            <Input
              label="Audit Remarks (Optional)"
              placeholder="e.g. Broken packaging discovered on Shelf B-3"
              value={adjustRemarks}
              onChange={(e) => setAdjustRemarks(e.target.value)}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              marginTop: "24px",
            }}
          >
            <Button
              variant="secondary"
              onClick={() => setIsAdjustModalOpen(false)}
              disabled={submittingAdjust}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submittingAdjust}>
              Confirm Adjustment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Movement Audit History Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Stock Movement Audit Trail"
        subtitle={`Item: ${drawerProduct?.name || "Selected Product"}`}
        width="520px"
      >
        {drawerLoading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
            Loading historical audit records...
          </div>
        ) : movements.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
            No stock movements recorded for this item yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {movements.map((m, idx) => {
              const qtyVal = parseFloat(m.quantity || 0);
              const isOut = m.movement_type?.includes("OUT") || m.movement_type === "DAMAGED" || m.movement_type === "EXPIRED" || m.movement_type === "SALE";

              return (
                <div
                  key={m.id || idx}
                  style={{
                    padding: "14px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--color-slate-50)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {!isOut ? (
                        <TrendingUp size={16} style={{ color: "var(--color-success)" }} />
                      ) : (
                        <TrendingDown size={16} style={{ color: "var(--color-danger)" }} />
                      )}
                      <span style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--text-main)" }}>
                        {m.movement_type || "MOVEMENT"}
                      </span>
                    </div>

                    <span
                      className="tabular-nums"
                      style={{
                        fontWeight: 800,
                        fontSize: "14px",
                        color: !isOut ? "var(--color-success)" : "var(--color-danger)",
                      }}
                    >
                      {!isOut ? `+${qtyVal}` : `-${qtyVal}`} units
                    </span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)" }}>
                    <span>
                      Balance: {parseFloat(m.quantity_before || 0)} → <strong>{parseFloat(m.quantity_after || 0)}</strong>
                    </span>
                    {m.reference_type && (
                      <span>Ref: {m.reference_type}</span>
                    )}
                  </div>

                  {m.remarks && (
                    <div style={{ fontSize: "12.5px", color: "var(--text-main)", backgroundColor: "#ffffff", padding: "6px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                      {m.remarks}
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      color: "var(--color-slate-400)",
                      marginTop: "4px",
                      paddingTop: "6px",
                      borderTop: "1px solid var(--color-slate-200)",
                    }}
                  >
                    <span>By: {m.created_by?.name || m.created_by?.email || "System"}</span>
                    <span>
                      {m.created_at ? new Date(m.created_at).toLocaleString() : "-"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default InventoryPage;
