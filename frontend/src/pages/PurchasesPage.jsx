import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useAuth from "../modules/auth/useAuth";
import {
  getPurchasesApi,
  createPurchaseApi,
  receivePurchaseApi,
  cancelPurchaseApi,
  deletePurchaseApi,
} from "../modules/purchasing/api";
import { getSuppliersApi } from "../modules/suppliers/api";
import { getProductsApi } from "../modules/products/api";
import {
  PageHeader,
  Button,
  DataTable,
  Pagination,
  StatusBadge,
  Modal,
  FormField,
  Input,
  Select,
  ConfirmDialog,
  Toast,
} from "../components/common";

export const PurchasesPage = () => {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";

  const [purchases, setPurchases] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 1 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Dropdown reference data
  const [suppliersList, setSuppliersList] = useState([]);
  const [productsList, setProductsList] = useState([]);

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    supplier_id: "",
    purchase_date: new Date().toISOString().split("T")[0],
    reference_number: "",
    items: [],
  });
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: null, // "RECEIVE" | "CANCEL" | "DELETE"
    purchase: null,
    loading: false,
  });

  // Load Reference Data (Active Suppliers and Active Products)
  useEffect(() => {
    const loadReferences = async () => {
      try {
        const [supRes, prodRes] = await Promise.all([
          getSuppliersApi({ is_active: true, per_page: 100 }),
          getProductsApi({ is_active: true, per_page: 100 }),
        ]);
        const supItems = supRes?.data?.items || supRes?.items || (Array.isArray(supRes) ? supRes : []);
        const prodItems = prodRes?.data?.items || prodRes?.items || (Array.isArray(prodRes) ? prodRes : []);
        setSuppliersList(supItems);
        setProductsList(prodItems);
      } catch (err) {
        console.error("Failed to load reference data for purchases", err);
      }
    };
    loadReferences();
  }, []);

  // Fetch Purchases
  useEffect(() => {
    let ignore = false;
    const fetchPurchases = async () => {
      try {
        const params = {
          page: pagination.page,
          per_page: 20,
        };
        if (search.trim()) params.search = search.trim();
        if (statusFilter !== "ALL") params.status = statusFilter;
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;

        const res = await getPurchasesApi(params);
        if (!ignore) {
          const items = res?.data?.items || res?.items || (Array.isArray(res) ? res : []);
          const pag = res?.data?.pagination || res?.pagination || {
            page: pagination.page,
            per_page: 20,
            total: items.length,
            pages: 1,
          };
          setPurchases(items);
          setPagination(pag);
          setError("");
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error?.message || "Failed to connect to purchasing service.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchPurchases();
    return () => {
      ignore = true;
    };
  }, [pagination.page, search, statusFilter, startDate, endDate, refreshTrigger]);

  const openCreateModal = () => {
    setCreateForm({
      supplier_id: suppliersList.length > 0 ? String(suppliersList[0].id) : "",
      purchase_date: new Date().toISOString().split("T")[0],
      reference_number: "",
      items: [],
    });
    setCreateError("");
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setCreateError("");
  };

  const handleAddItemRow = () => {
    if (productsList.length === 0) return;
    const usedProductIds = new Set(createForm.items.map((it) => String(it.product_id)));
    const availableProd = productsList.find((p) => !usedProductIds.has(String(p.id))) || productsList[0];

    setCreateForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_id: String(availableProd.id),
          quantity: "1.000",
          unit_cost: availableProd.cost_price ? String(availableProd.cost_price) : "0.00",
        },
      ],
    }));
  };

  const handleRemoveItemRow = (idx) => {
    setCreateForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const handleItemFieldChange = (idx, field, value) => {
    setCreateForm((prev) => {
      const nextItems = [...prev.items];
      nextItems[idx] = { ...nextItems[idx], [field]: value };

      if (field === "product_id") {
        const prod = productsList.find((p) => String(p.id) === String(value));
        if (prod && prod.cost_price) {
          nextItems[idx].unit_cost = String(prod.cost_price);
        }
      }
      return { ...prev, items: nextItems };
    });
  };

  const computeOrderTotal = () => {
    return createForm.items.reduce((sum, it) => {
      const q = parseFloat(it.quantity) || 0;
      const c = parseFloat(it.unit_cost) || 0;
      return sum + Math.round(q * c * 100) / 100;
    }, 0);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.supplier_id) {
      setCreateError("Please select a supplier.");
      return;
    }
    if (!createForm.purchase_date) {
      setCreateError("Please select a purchase date.");
      return;
    }

    const seenProds = new Set();
    for (let i = 0; i < createForm.items.length; i++) {
      const it = createForm.items[i];
      if (!it.product_id) {
        setCreateError(`Item #${i + 1} has no product selected.`);
        return;
      }
      if (seenProds.has(it.product_id)) {
        setCreateError(`Item #${i + 1}: Duplicate product in purchase order.`);
        return;
      }
      seenProds.add(it.product_id);

      const q = parseFloat(it.quantity);
      if (isNaN(q) || q <= 0) {
        setCreateError(`Item #${i + 1} quantity must be greater than zero.`);
        return;
      }
      const c = parseFloat(it.unit_cost);
      if (isNaN(c) || c < 0) {
        setCreateError(`Item #${i + 1} unit cost cannot be negative.`);
        return;
      }
    }

    setCreating(true);
    setCreateError("");

    const payload = {
      supplier_id: parseInt(createForm.supplier_id, 10),
      purchase_date: createForm.purchase_date,
      items: createForm.items.map((it) => ({
        product_id: parseInt(it.product_id, 10),
        quantity: it.quantity,
        unit_cost: it.unit_cost,
      })),
    };
    if (createForm.reference_number.trim()) {
      payload.reference_number = createForm.reference_number.trim();
    }

    try {
      await createPurchaseApi(payload);
      setToastMessage({ type: "success", text: "Purchase order created successfully." });
      setIsCreateModalOpen(false);
      setLoading(true);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setCreateError(err.response?.data?.error?.message || err.message || "Failed to create purchase order.");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenConfirm = (type, purchase) => {
    setConfirmModal({
      isOpen: true,
      type,
      purchase,
      loading: false,
    });
  };

  const handleExecuteConfirm = async () => {
    const { type, purchase } = confirmModal;
    if (!purchase) return;

    setConfirmModal((prev) => ({ ...prev, loading: true }));
    try {
      if (type === "RECEIVE") {
        await receivePurchaseApi(purchase.id);
        setToastMessage({
          type: "success",
          text: `Purchase ${purchase.purchase_number} marked as RECEIVED. Stock added to inventory!`,
        });
      } else if (type === "CANCEL") {
        await cancelPurchaseApi(purchase.id);
        setToastMessage({
          type: "info",
          text: `Purchase ${purchase.purchase_number} has been CANCELLED.`,
        });
      } else if (type === "DELETE") {
        await deletePurchaseApi(purchase.id);
        setToastMessage({
          type: "info",
          text: `Purchase ${purchase.purchase_number} was permanently deleted.`,
        });
      }
      setConfirmModal({ isOpen: false, type: null, purchase: null, loading: false });
      setLoading(true);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setToastMessage({
        type: "error",
        text: err.response?.data?.error?.message || `Failed to process purchase action.`,
      });
      setConfirmModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const columns = [
    {
      header: "Purchase Order",
      accessor: (p) => (
        <div>
          <Link
            to={`/purchases/${p.id}`}
            style={{ fontWeight: 700, color: "var(--color-primary)", textDecoration: "none" }}
          >
            {p.purchase_number}
          </Link>
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
            {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
          </div>
        </div>
      ),
    },
    {
      header: "Supplier",
      accessor: (p) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--color-text)" }}>{p.supplier?.name || "—"}</div>
          {p.supplier?.contact_person && (
            <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
              {p.supplier.contact_person}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Purchase Date",
      accessor: (p) => (
        <span style={{ fontSize: "13px", color: "var(--color-text)" }}>{p.purchase_date}</span>
      ),
    },
    {
      header: "Reference #",
      accessor: (p) => (
        <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>
          {p.reference_number || "—"}
        </span>
      ),
    },
    {
      header: "Total Amount",
      align: "right",
      accessor: (p) => (
        <strong style={{ fontFamily: "var(--font-mono)", fontSize: "14px", color: "var(--color-text)" }}>
          ₱{parseFloat(p.total_amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </strong>
      ),
    },
    {
      header: "Status",
      accessor: (p) => (
        <StatusBadge
          status={p.status}
          variant={p.status === "RECEIVED" ? "success" : p.status === "DRAFT" ? "warning" : "danger"}
        />
      ),
    },
    {
      header: "Actions",
      align: "right",
      accessor: (p) => (
        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
          <Link
            to={`/purchases/${p.id}`}
            style={{
              padding: "4px 10px",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--color-text)",
              textDecoration: "none",
            }}
          >
            Details
          </Link>
          {p.status === "DRAFT" && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleOpenConfirm("RECEIVE", p)}
              >
                Receive
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleOpenConfirm("CANCEL", p)}
              >
                Cancel
              </Button>
              {isOwner && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleOpenConfirm("DELETE", p)}
                >
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
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
        title="Purchasing & Stock In"
        subtitle="Manage supplier purchase orders, stock-in receipt confirmations, and cost records."
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={openCreateModal}
          >
            + Create Purchase Order
          </Button>
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
        <div style={{ flex: 1, minWidth: "220px" }}>
          <input
            type="text"
            placeholder="Search PO #, supplier, reference..."
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
          <label htmlFor="purchase-status-filter" style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
            Status:
          </label>
          <select
            id="purchase-status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
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
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="purchase-start-date" style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
            From:
          </label>
          <input
            id="purchase-start-date"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
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
          <label htmlFor="purchase-end-date" style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
            To:
          </label>
          <input
            id="purchase-end-date"
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
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
          ⚠️ {error}
        </div>
      )}

      {/* Purchases Table */}
      <DataTable
        columns={columns}
        data={purchases}
        loading={loading}
        emptyTitle="No purchase records found"
        emptyMessage="There are no purchase orders matching your search or date criteria."
        emptyAction={
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            + Create First Purchase Order
          </Button>
        }
      />

      {/* Pagination */}
      {!loading && purchases.length > 0 && pagination.pages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.pages}
          totalItems={pagination.total}
          onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
        />
      )}

      {/* Create Purchase Order Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        title="Create Purchase Order"
        maxWidth="740px"
      >
        {createError && (
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
            {createError}
          </div>
        )}

        <form onSubmit={handleCreateSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <FormField label="Supplier" required>
              <Select
                value={createForm.supplier_id}
                onChange={(e) => setCreateForm({ ...createForm, supplier_id: e.target.value })}
                required
              >
                <option value="">-- Select Supplier --</option>
                {suppliersList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Purchase Date" required>
              <Input
                type="date"
                value={createForm.purchase_date}
                onChange={(e) => setCreateForm({ ...createForm, purchase_date: e.target.value })}
                required
              />
            </FormField>
          </div>

          <FormField label="Supplier Invoice / Reference # (Optional)">
            <Input
              placeholder="e.g. INV-SUPP-8821"
              value={createForm.reference_number}
              onChange={(e) => setCreateForm({ ...createForm, reference_number: e.target.value })}
            />
          </FormField>

          {/* Line Items Section */}
          <div style={{ marginTop: "16px", marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-text)" }}>
                Order Line Items
              </span>
              <Button variant="secondary" size="sm" onClick={handleAddItemRow}>
                + Add Product Line
              </Button>
            </div>

            {createForm.items.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", backgroundColor: "var(--color-bg)", borderRadius: "var(--radius-md)", color: "var(--color-text-secondary)", fontSize: "13px" }}>
                No items added yet. Click &quot;+ Add Product Line&quot; to begin building your order.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {createForm.items.map((item, idx) => {
                  const lineSubtotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0);

                  return (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                        gap: "10px",
                        alignItems: "center",
                        backgroundColor: "var(--color-bg)",
                        padding: "10px 12px",
                        borderRadius: "var(--radius-md)",
                      }}
                    >
                      <div>
                        <select
                          value={item.product_id}
                          onChange={(e) => handleItemFieldChange(idx, "product_id", e.target.value)}
                          required
                          style={{
                            width: "100%",
                            height: "36px",
                            padding: "0 8px",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--color-border)",
                            fontSize: "13px",
                            backgroundColor: "var(--color-surface)",
                          }}
                        >
                          {productsList.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          required
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleItemFieldChange(idx, "quantity", e.target.value)}
                          style={{
                            width: "100%",
                            height: "36px",
                            padding: "0 8px",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--color-border)",
                            fontSize: "13px",
                            backgroundColor: "var(--color-surface)",
                          }}
                        />
                      </div>

                      <div>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          placeholder="Unit Cost"
                          value={item.unit_cost}
                          onChange={(e) => handleItemFieldChange(idx, "unit_cost", e.target.value)}
                          style={{
                            width: "100%",
                            height: "36px",
                            padding: "0 8px",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--color-border)",
                            fontSize: "13px",
                            backgroundColor: "var(--color-surface)",
                          }}
                        />
                      </div>

                      <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 600 }}>
                        ₱{lineSubtotal.toFixed(2)}
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          style={{
                            backgroundColor: "transparent",
                            border: "none",
                            color: "var(--color-danger)",
                            cursor: "pointer",
                            padding: "4px",
                            fontSize: "16px",
                            lineHeight: 1,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Total Summary */}
            <div
              style={{
                marginTop: "16px",
                padding: "12px 16px",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 600 }}>
                Estimated Order Total:
              </span>
              <strong style={{ fontSize: "18px", fontFamily: "var(--font-mono)", color: "var(--color-primary)" }}>
                ₱{computeOrderTotal().toFixed(2)}
              </strong>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button
              variant="secondary"
              size="md"
              onClick={closeCreateModal}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={creating}
            >
              {creating ? "Creating PO..." : "Create Purchase Order"}
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
            : "Delete Purchase Order"
        }
        message={
          confirmModal.type === "RECEIVE"
            ? `Are you sure you want to mark ${confirmModal.purchase?.purchase_number} as RECEIVED? All line item quantities will be permanently added to current inventory balances.`
            : confirmModal.type === "CANCEL"
            ? `Are you sure you want to cancel ${confirmModal.purchase?.purchase_number}? This status change is permanent.`
            : `Are you sure you want to permanently delete draft order ${confirmModal.purchase?.purchase_number}? This cannot be undone.`
        }
        confirmLabel={
          confirmModal.type === "RECEIVE"
            ? "Confirm Receipt & Stock In"
            : confirmModal.type === "CANCEL"
            ? "Cancel PO"
            : "Delete PO"
        }
        variant={confirmModal.type === "RECEIVE" ? "primary" : "danger"}
        loading={confirmModal.loading}
        onConfirm={handleExecuteConfirm}
        onCancel={() => setConfirmModal({ isOpen: false, type: null, purchase: null, loading: false })}
      />
    </div>
  );
};

export default PurchasesPage;
