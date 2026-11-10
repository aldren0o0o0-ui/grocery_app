import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  PackageCheck,
} from "lucide-react";
import {
  getPurchaseApi,
  addPurchaseItemApi,
  removePurchaseItemApi,
  receivePurchaseApi,
  cancelPurchaseApi,
} from "../api/purchasing";
import { getProductsApi } from "../api/products";
import {
  Button,
  Badge,
  Input,
  Select,
  Card,
  Table,
  useToast,
  ConfirmDialog,
} from "../components/ui";

export const PurchaseDetailPage = () => {
  const { id } = useParams();
  const { showToast } = useToast();

  const [purchase, setPurchase] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add Item State
  const [selectedProductId, setSelectedProductId] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemCost, setItemCost] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [itemError, setItemError] = useState("");

  // Dialogs
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);

  const fetchPurchaseDetail = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getPurchaseApi(id);
      const pData = res.purchase || res;
      setPurchase(pData);
    } catch (err) {
      showToast(err.response?.data?.error?.message || "Failed to load purchase details.", "error");
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await getProductsApi({ per_page: 200, is_active: true });
        setProducts(res.products || res || []);
      } catch (err) {
        console.error("Failed to load products:", err);
      }
    };
    loadProducts();
    fetchPurchaseDetail();
  }, [fetchPurchaseDetail]);

  // When product changes in selector, pre-fill its cost price
  const handleProductSelect = (pId) => {
    setSelectedProductId(pId);
    const prod = products.find((p) => String(p.id) === String(pId));
    if (prod && prod.cost_price) {
      setItemCost(String(prod.cost_price));
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    setItemError("");

    if (!selectedProductId || !itemQty || !itemCost) {
      setItemError("Please select product, quantity, and unit cost.");
      return;
    }

    const q = parseFloat(itemQty);
    const c = parseFloat(itemCost);
    if (q <= 0 || c < 0) {
      setItemError("Quantity must be positive and cost cannot be negative.");
      return;
    }

    setAddingItem(true);
    try {
      await addPurchaseItemApi(id, {
        product_id: Number(selectedProductId),
        quantity: q,
        unit_cost: c,
      });

      showToast("Item added to purchase order.", "success");
      setSelectedProductId("");
      setItemQty("1");
      setItemCost("");
      fetchPurchaseDetail();
    } catch (err) {
      setItemError(err.response?.data?.error?.message || "Failed to add line item.");
    } finally {
      setAddingItem(false);
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      await removePurchaseItemApi(id, itemId);
      showToast("Item removed from order.", "success");
      fetchPurchaseDetail();
    } catch (err) {
      showToast(err.response?.data?.error?.message || "Failed to remove item.", "error");
    }
  };

  const handleReceiveOrder = async () => {
    setDialogLoading(true);
    try {
      await receivePurchaseApi(id);
      showToast("Order received! Inventory stock has been atomically updated.", "success");
      setIsReceiveDialogOpen(false);
      fetchPurchaseDetail();
    } catch (err) {
      showToast(err.response?.data?.error?.message || "Failed to receive order.", "error");
    } finally {
      setDialogLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    setDialogLoading(true);
    try {
      await cancelPurchaseApi(id);
      showToast("Purchase Order cancelled.", "info");
      setIsCancelDialogOpen(false);
      fetchPurchaseDetail();
    } catch (err) {
      showToast(err.response?.data?.error?.message || "Failed to cancel order.", "error");
    } finally {
      setDialogLoading(false);
    }
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "₱0.00";
    return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading && !purchase) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>
        Loading purchase order details...
      </div>
    );
  }

  const isDraft = purchase?.status === "DRAFT";
  const isReceived = purchase?.status === "RECEIVED";
  const isCancelled = purchase?.status === "CANCELLED";
  const items = purchase?.items || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Breadcrumb & Actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link
          to="/purchases"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "var(--color-slate-600)",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} />
          Back to Purchase Orders
        </Link>

        {isDraft && (
          <div style={{ display: "flex", gap: "10px" }}>
            <Button
              variant="danger"
              size="sm"
              icon={XCircle}
              onClick={() => setIsCancelDialogOpen(true)}
            >
              Cancel PO
            </Button>
            <Button
              variant="success"
              size="sm"
              icon={PackageCheck}
              disabled={items.length === 0}
              onClick={() => setIsReceiveDialogOpen(true)}
            >
              Receive Items into Stock
            </Button>
          </div>
        )}
      </div>

      {/* Status Notice Banner */}
      {isReceived && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--color-success-bg)",
            border: "1px solid var(--color-success-border)",
            color: "var(--color-success-text)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontWeight: 600,
            fontSize: "13.5px",
          }}
        >
          <CheckCircle size={20} />
          <span>
            This purchase order was RECEIVED on{" "}
            {purchase.received_at ? new Date(purchase.received_at).toLocaleDateString() : "record"}.
            All quantities have been added to inventory stock.
          </span>
        </div>
      )}

      {isCancelled && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--color-danger-bg)",
            border: "1px solid var(--color-danger-border)",
            color: "var(--color-danger-text)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontWeight: 600,
            fontSize: "13.5px",
          }}
        >
          <XCircle size={20} />
          <span>This purchase order has been CANCELLED and closed.</span>
        </div>
      )}

      {/* PO Overview Header Card */}
      <Card padding="24px">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                  color: "var(--text-main)",
                  margin: 0,
                }}
              >
                {purchase?.reference_number || `PO-#${purchase?.id}`}
              </h2>
              <Badge
                variant={isDraft ? "warning" : isReceived ? "success" : "danger"}
                size="md"
              >
                {purchase?.status}
              </Badge>
            </div>

            <div
              style={{
                display: "flex",
                gap: "24px",
                marginTop: "12px",
                fontSize: "13px",
                color: "var(--text-muted)",
              }}
            >
              <div>
                <strong>Supplier:</strong> {purchase?.supplier_name || "Vendor"}
              </div>
              <div>
                <strong>Date:</strong> {purchase?.purchase_date || "-"}
              </div>
              <div>
                <strong>Created by:</strong> {purchase?.created_by_name || "Owner/Staff"}
              </div>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Total Order Cost:</div>
            <div
              className="tabular-nums"
              style={{
                fontSize: "26px",
                fontWeight: 800,
                color: "var(--color-primary-700)",
                marginTop: "2px",
              }}
            >
              {formatCurrency(purchase?.total_amount)}
            </div>
          </div>
        </div>
      </Card>

      {/* Add Line Item Form (Only when Draft) */}
      {isDraft && (
        <Card title="Add Stock-In Line Item" subtitle="Select grocery item, deliverable quantity, and agreed unit cost.">
          <form onSubmit={handleAddItem}>
            {itemError && (
              <div
                style={{
                  padding: "10px 14px",
                  marginBottom: "14px",
                  backgroundColor: "var(--color-danger-bg)",
                  color: "var(--color-danger-text)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                {itemError}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr auto",
                gap: "12px",
                alignItems: "flex-end",
              }}
            >
              <Select
                label="Product to Stock In"
                value={selectedProductId}
                onChange={(e) => handleProductSelect(e.target.value)}
                required
              >
                <option value="">Select a product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Current: {p.current_stock || p.stock || 0} left)
                  </option>
                ))}
              </Select>

              <Input
                label="Quantity Delivered"
                type="number"
                min="0.01"
                step="any"
                value={itemQty}
                onChange={(e) => setItemQty(e.target.value)}
                required
              />

              <Input
                label="Agreed Unit Cost (₱)"
                type="number"
                min="0"
                step="0.01"
                value={itemCost}
                onChange={(e) => setItemCost(e.target.value)}
                required
              />

              <Button type="submit" variant="primary" icon={Plus} loading={addingItem}>
                Add Item
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Line Items Table */}
      <Card title="Ordered Line Items" subtitle="Verified stock received from supplier">
        <Table
          columns={[
            {
              header: "Item Description",
              key: "product_name",
              render: (val, row) => (
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                    {val || row.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    SKU: {row.sku || "N/A"}
                  </div>
                </div>
              ),
            },
            {
              header: "Quantity",
              key: "quantity",
              align: "center",
              render: (val) => (
                <span className="tabular-nums" style={{ fontWeight: 600 }}>
                  {val} units
                </span>
              ),
            },
            {
              header: "Unit Cost",
              key: "unit_cost",
              align: "right",
              render: (val) => (
                <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {formatCurrency(val)}
                </span>
              ),
            },
            {
              header: "Subtotal",
              key: "subtotal",
              align: "right",
              render: (val, row) => {
                const total = val || (parseFloat(row.quantity) || 0) * (parseFloat(row.unit_cost) || 0);
                return (
                  <span className="tabular-nums" style={{ fontWeight: 700, color: "var(--text-main)" }}>
                    {formatCurrency(total)}
                  </span>
                );
              },
            },
            ...(isDraft
              ? [
                  {
                    header: "Action",
                    key: "action",
                    align: "right",
                    render: (_, row) => (
                      <button
                        onClick={() => handleRemoveItem(row.id)}
                        style={{
                          color: "var(--color-slate-400)",
                          padding: "4px",
                          borderRadius: "var(--radius-xs)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-danger)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-slate-400)")}
                        title="Remove item"
                      >
                        <Trash2 size={16} />
                      </button>
                    ),
                  },
                ]
              : []),
          ]}
          data={items}
          emptyMessage="No line items added to this purchase order yet."
        />
      </Card>

      {/* Receive Confirm Dialog */}
      <ConfirmDialog
        isOpen={isReceiveDialogOpen}
        onClose={() => setIsReceiveDialogOpen(false)}
        onConfirm={handleReceiveOrder}
        title="Receive Order into Stock?"
        message="This action will atomically increase inventory stock levels for all listed items and mark the purchase order as RECEIVED."
        variant="primary"
        confirmText="Yes, Receive Items"
        loading={dialogLoading}
      />

      {/* Cancel Confirm Dialog */}
      <ConfirmDialog
        isOpen={isCancelDialogOpen}
        onClose={() => setIsCancelDialogOpen(false)}
        onConfirm={handleCancelOrder}
        title="Cancel Purchase Order?"
        message="This will mark the purchase order as CANCELLED. No stock adjustments will be made."
        variant="danger"
        confirmText="Yes, Cancel Order"
        loading={dialogLoading}
      />
    </div>
  );
};

export default PurchaseDetailPage;
