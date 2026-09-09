import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import useAuth from "../modules/auth/useAuth";
import {
  getPurchaseApi,
  addPurchaseItemApi,
  updatePurchaseItemApi,
  removePurchaseItemApi,
  receivePurchaseApi,
  cancelPurchaseApi,
  deletePurchaseApi,
} from "../modules/purchasing/api";
import { getProductsApi } from "../modules/products/api";
import {
  PageHeader,
  Button,
  DataTable,
  StatusBadge,
  Modal,
  FormField,
  Input,
  Select,
  ConfirmDialog,
  Toast,
  PageLoading,
  ErrorState,
} from "../components/common";

export const PurchaseDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";

  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Products available to add
  const [productsList, setProductsList] = useState([]);

  // Add Item Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({ product_id: "", quantity: "1.000", unit_cost: "0.00" });
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  // Edit Item Modal
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({ quantity: "", unit_cost: "" });
  const [editError, setEditError] = useState("");
  const [editing, setEditing] = useState(false);

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: null, // "RECEIVE" | "CANCEL" | "DELETE" | "REMOVE_ITEM"
    item: null,
    loading: false,
  });

  // Fetch Purchase
  useEffect(() => {
    let ignore = false;
    const fetchPurchase = async () => {
      try {
        const res = await getPurchaseApi(id);
        if (!ignore) {
          if (res.status === "success") {
            setPurchase(res.data);
          } else {
            setError(res.message || "Failed to load purchase.");
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error?.message || "Failed to load purchase details.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchPurchase();
    return () => {
      ignore = true;
    };
  }, [id, refreshTrigger]);

  // Load Active Products for adding items
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await getProductsApi({ is_active: true, per_page: 100 });
        setProductsList(res.data?.items || res.items || []);
      } catch (err) {
        console.error("Failed to load products list", err);
      }
    };
    loadProducts();
  }, []);

  const openAddModal = () => {
    if (!purchase) return;
    const existingProductIds = new Set((purchase.items || []).map((it) => String(it.product_id)));
    const available = productsList.find((p) => !existingProductIds.has(String(p.id))) || productsList[0];

    setAddForm({
      product_id: available ? String(available.id) : "",
      quantity: "1.000",
      unit_cost: available?.cost_price ? String(available.cost_price) : "0.00",
    });
    setAddError("");
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddError("");
    const q = parseFloat(addForm.quantity);
    const c = parseFloat(addForm.unit_cost);
    if (isNaN(q) || q <= 0) {
      setAddError("Quantity must be greater than 0.");
      return;
    }
    if (isNaN(c) || c < 0) {
      setAddError("Unit cost cannot be negative.");
      return;
    }

    setAdding(true);
    try {
      await addPurchaseItemApi(purchase.id, {
        product_id: parseInt(addForm.product_id, 10),
        quantity: addForm.quantity,
        unit_cost: addForm.unit_cost,
      });
      setIsAddModalOpen(false);
      setToastMessage({ type: "success", text: "Product line item added." });
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setAddError(err.response?.data?.error?.message || "Failed to add item to purchase.");
    } finally {
      setAdding(false);
    }
  };

  const openEditModal = (item) => {
    setEditItem(item);
    setEditForm({
      quantity: item.quantity,
      unit_cost: item.unit_cost,
    });
    setEditError("");
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError("");

    const q = parseFloat(editForm.quantity);
    const c = parseFloat(editForm.unit_cost);
    if (isNaN(q) || q <= 0) {
      setEditError("Quantity must be greater than 0.");
      return;
    }
    if (isNaN(c) || c < 0) {
      setEditError("Unit cost cannot be negative.");
      return;
    }

    setEditing(true);
    try {
      await updatePurchaseItemApi(purchase.id, editItem.id, {
        quantity: editForm.quantity,
        unit_cost: editForm.unit_cost,
      });
      setEditItem(null);
      setToastMessage({ type: "success", text: "Line item updated." });
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setEditError(err.response?.data?.error?.message || "Failed to update item.");
    } finally {
      setEditing(false);
    }
  };

  const openConfirmModal = (type, item = null) => {
    setConfirmModal({
      isOpen: true,
      type,
      item,
      loading: false,
    });
  };

  const closeConfirmModal = () => {
    setConfirmModal({ isOpen: false, type: null, item: null, loading: false });
  };

  const handleConfirmAction = async () => {
    if (!purchase) return;
    setConfirmModal((prev) => ({ ...prev, loading: true }));
    try {
      if (confirmModal.type === "RECEIVE") {
        await receivePurchaseApi(purchase.id);
        setToastMessage({ type: "success", text: `Purchase ${purchase.purchase_number} marked as RECEIVED. Stock updated!` });
        closeConfirmModal();
        setRefreshTrigger((prev) => prev + 1);
      } else if (confirmModal.type === "CANCEL") {
        await cancelPurchaseApi(purchase.id);
        setToastMessage({ type: "info", text: `Purchase ${purchase.purchase_number} has been CANCELLED.` });
        closeConfirmModal();
        setRefreshTrigger((prev) => prev + 1);
      } else if (confirmModal.type === "DELETE") {
        await deletePurchaseApi(purchase.id);
        closeConfirmModal();
        navigate("/purchases");
      } else if (confirmModal.type === "REMOVE_ITEM" && confirmModal.item) {
        await removePurchaseItemApi(purchase.id, confirmModal.item.id);
        setToastMessage({ type: "info", text: "Line item removed." });
        closeConfirmModal();
        setRefreshTrigger((prev) => prev + 1);
      }
    } catch (err) {
      setToastMessage({
        type: "error",
        text: err.response?.data?.error?.message || `Failed to perform ${confirmModal.type.toLowerCase()} action.`,
      });
      setConfirmModal((prev) => ({ ...prev, loading: false }));
    }
  };

  if (loading) {
    return <PageLoading message="Loading purchase order details..." />;
  }

  if (error || !purchase) {
    return (
      <ErrorState
        title="Unable to Load Purchase"
        message={error || "The requested purchase order was not found."}
        onRetry={() => navigate("/purchases")}
      />
    );
  }

  const isDraft = purchase.status === "DRAFT";
  const items = purchase.items || [];
  const totalQuantity = items.reduce((acc, it) => acc + (parseFloat(it.quantity) || 0), 0);

  const columns = [
    {
      header: "Product",
      accessor: (it) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--color-text)" }}>{it.product?.name || `Product #${it.product_id}`}</div>
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
            SKU: {it.product?.sku || "—"}
          </div>
        </div>
      ),
    },
    {
      header: "Unit",
      accessor: (it) => it.product?.unit || "PCS",
    },
    {
      header: "Quantity",
      align: "right",
      accessor: (it) => (
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--color-text)" }}>
          {parseFloat(it.quantity).toFixed(3)}
        </span>
      ),
    },
    {
      header: "Unit Cost",
      align: "right",
      accessor: (it) => (
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text)" }}>
          ₱{parseFloat(it.unit_cost).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: "Total Cost",
      align: "right",
      accessor: (it) => (
        <strong style={{ fontFamily: "var(--font-mono)", color: "var(--color-primary)" }}>
          ₱{parseFloat(it.total_cost).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </strong>
      ),
    },
    {
      header: "Actions",
      align: "right",
      accessor: (it) =>
        isDraft ? (
          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openEditModal(it)}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => openConfirmModal("REMOVE_ITEM", it)}
            >
              Remove
            </Button>
          </div>
        ) : (
          <span style={{ fontSize: "12px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
            Locked
          </span>
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
        title={
          <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span>{purchase.purchase_number}</span>
            <StatusBadge
              status={purchase.status}
              variant={purchase.status === "RECEIVED" ? "success" : purchase.status === "DRAFT" ? "warning" : "danger"}
            />
          </span>
        }
        subtitle={
          <span>
            <Link to="/purchases" style={{ color: "var(--color-primary)", textDecoration: "none", fontWeight: 600 }}>
              ← Purchases
            </Link>{" "}
            / PO Details & Stock-In
          </span>
        }
        actions={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {isDraft && (
              <>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => openConfirmModal("RECEIVE")}
                >
                  ✓ Receive Stock
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={openAddModal}
                >
                  + Add Product Line
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => openConfirmModal("CANCEL")}
                >
                  Cancel PO
                </Button>
                {isOwner && (
                  <Button
                    variant="danger"
                    size="md"
                    onClick={() => openConfirmModal("DELETE")}
                  >
                    Delete PO
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      {/* Metadata Cards Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Supplier Info */}
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            padding: "20px",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase" }}>
            Supplier Details
          </span>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-text)", margin: "8px 0 4px" }}>
            {purchase.supplier?.name || "—"}
          </h3>
          <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
            {purchase.supplier?.contact_person && <div>Contact: {purchase.supplier.contact_person}</div>}
            {purchase.supplier?.phone && <div>Phone: {purchase.supplier.phone}</div>}
            {purchase.supplier?.email && <div>Email: {purchase.supplier.email}</div>}
          </div>
        </div>

        {/* PO Metadata */}
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            padding: "20px",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase" }}>
            Order Overview
          </span>
          <div style={{ marginTop: "8px", fontSize: "13px", lineHeight: 1.8 }}>
            <div>
              Purchase Date: <strong>{purchase.purchase_date}</strong>
            </div>
            <div>
              Supplier Ref #: <strong>{purchase.reference_number || "—"}</strong>
            </div>
            <div>
              Created: <strong>{purchase.created_at ? new Date(purchase.created_at).toLocaleString() : "—"}</strong>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            padding: "20px",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase" }}>
              Total Value
            </span>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--color-primary)", marginTop: "4px" }}>
              ₱{parseFloat(purchase.total_amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "8px" }}>
            {items.length} line items ({totalQuantity.toFixed(3)} units)
          </div>
        </div>
      </div>

      {/* Items Table */}
      <DataTable
        columns={columns}
        data={items}
        emptyTitle="No items in this purchase order"
        emptyMessage="Click '+ Add Product Line' above to add items to this order."
      />

      {/* Add Item Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Product Line Item"
        maxWidth="500px"
      >
        {addError && (
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
            {addError}
          </div>
        )}

        <form onSubmit={handleAddSubmit}>
          <FormField label="Product" required>
            <Select
              value={addForm.product_id}
              onChange={(e) => {
                const pid = e.target.value;
                const prod = productsList.find((p) => String(p.id) === String(pid));
                setAddForm({
                  ...addForm,
                  product_id: pid,
                  unit_cost: prod?.cost_price ? String(prod.cost_price) : addForm.unit_cost,
                });
              }}
              required
            >
              <option value="">-- Select Product --</option>
              {productsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </Select>
          </FormField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <FormField label="Quantity" required>
              <Input
                type="number"
                step="0.001"
                min="0.001"
                required
                value={addForm.quantity}
                onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })}
              />
            </FormField>

            <FormField label="Unit Cost ($)" required>
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                value={addForm.unit_cost}
                onChange={(e) => setAddForm({ ...addForm, unit_cost: e.target.value })}
              />
            </FormField>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setIsAddModalOpen(false)}
              disabled={adding}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={adding}
            >
              {adding ? "Adding..." : "Add Item"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Item Modal */}
      <Modal
        isOpen={Boolean(editItem)}
        onClose={() => setEditItem(null)}
        title={editItem ? `Edit Item: ${editItem.product?.name || ""}` : "Edit Item"}
        maxWidth="460px"
      >
        {editError && (
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
            {editError}
          </div>
        )}

        <form onSubmit={handleEditSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <FormField label="Quantity" required>
              <Input
                type="number"
                step="0.001"
                min="0.001"
                required
                value={editForm.quantity}
                onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
              />
            </FormField>

            <FormField label="Unit Cost ($)" required>
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                value={editForm.unit_cost}
                onChange={(e) => setEditForm({ ...editForm, unit_cost: e.target.value })}
              />
            </FormField>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setEditItem(null)}
              disabled={editing}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={editing}
            >
              {editing ? "Saving..." : "Update Item"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmModal.isOpen}
        title={
          confirmModal.type === "RECEIVE"
            ? "Receive Purchase Order"
            : confirmModal.type === "CANCEL"
            ? "Cancel Purchase Order"
            : confirmModal.type === "DELETE"
            ? "Delete Purchase Order"
            : "Remove Line Item"
        }
        message={
          confirmModal.type === "RECEIVE"
            ? `Are you sure you want to mark ${purchase.purchase_number} as RECEIVED? All quantities will be immediately added to stock balances.`
            : confirmModal.type === "CANCEL"
            ? `Are you sure you want to cancel ${purchase.purchase_number}? This action is irreversible.`
            : confirmModal.type === "DELETE"
            ? `Are you sure you want to permanently delete draft purchase ${purchase.purchase_number}?`
            : `Are you sure you want to remove ${confirmModal.item?.product?.name || "this item"} from the order?`
        }
        confirmLabel={
          confirmModal.type === "RECEIVE"
            ? "Confirm Receipt & Stock In"
            : confirmModal.type === "CANCEL"
            ? "Cancel PO"
            : confirmModal.type === "DELETE"
            ? "Delete PO"
            : "Remove Item"
        }
        variant={confirmModal.type === "RECEIVE" ? "primary" : "danger"}
        loading={confirmModal.loading}
        onConfirm={handleConfirmAction}
        onCancel={closeConfirmModal}
      />
    </div>
  );
};

export default PurchaseDetailPage;
