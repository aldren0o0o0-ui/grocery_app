import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
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
        if (supRes.status === "success") {
          setSuppliersList(supRes.data.items || []);
        }
        if (prodRes.status === "success") {
          setProductsList(prodRes.data?.items || prodRes.items || []);
        }
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
          if (res.status === "success") {
            setPurchases(res.data.items || []);
            setPagination(res.data.pagination || { page: 1, per_page: 20, total: 0, pages: 1 });
          } else {
            setError(res.message || "Failed to load purchases.");
          }
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
    // Pick the first product not already in items
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

  const handleItemFieldChange = (idx, field, val) => {
    setCreateForm((prev) => {
      const newItems = [...prev.items];
      newItems[idx] = { ...newItems[idx], [field]: val };

      // If product changed, update default unit_cost from product
      if (field === "product_id") {
        const prod = productsList.find((p) => String(p.id) === String(val));
        if (prod && prod.cost_price) {
          newItems[idx].unit_cost = String(prod.cost_price);
        }
      }
      return { ...prev, items: newItems };
    });
  };

  const computeModalTotal = () => {
    return createForm.items.reduce((acc, it) => {
      const q = parseFloat(it.quantity) || 0;
      const c = parseFloat(it.unit_cost) || 0;
      return acc + q * c;
    }, 0);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError("");

    if (!createForm.supplier_id) {
      setCreateError("Please select a supplier.");
      return;
    }
    if (!createForm.purchase_date) {
      setCreateError("Please select a purchase date.");
      return;
    }

    // Validate unique products in line items
    const productIds = createForm.items.map((it) => it.product_id);
    if (new Set(productIds).size !== productIds.length) {
      setCreateError("Duplicate products detected in line items. Each product must appear at most once.");
      return;
    }

    for (let i = 0; i < createForm.items.length; i++) {
      const it = createForm.items[i];
      const q = parseFloat(it.quantity);
      const c = parseFloat(it.unit_cost);
      if (isNaN(q) || q <= 0) {
        setCreateError(`Item #${i + 1}: Quantity must be greater than 0.`);
        return;
      }
      if (isNaN(c) || c < 0) {
        setCreateError(`Item #${i + 1}: Unit cost cannot be negative.`);
        return;
      }
    }

    setCreating(true);
    try {
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
        payload.reference_number = createForm.reference_number.trim().toUpperCase();
      }

      const res = await createPurchaseApi(payload);
      if (res.status === "success") {
        closeCreateModal();
        setRefreshTrigger((prev) => prev + 1);
      } else {
        setCreateError(res.message || "Failed to create purchase.");
      }
    } catch (err) {
      setCreateError(err.response?.data?.error?.message || "Failed to create purchase.");
    } finally {
      setCreating(false);
    }
  };

  // Action Confirmation Handlers
  const openConfirmModal = (type, purchase) => {
    setConfirmModal({
      isOpen: true,
      type,
      purchase,
      loading: false,
    });
  };

  const closeConfirmModal = () => {
    setConfirmModal({ isOpen: false, type: null, purchase: null, loading: false });
  };

  const handleConfirmAction = async () => {
    if (!confirmModal.purchase) return;
    setConfirmModal((prev) => ({ ...prev, loading: true }));
    try {
      const id = confirmModal.purchase.id;
      if (confirmModal.type === "RECEIVE") {
        await receivePurchaseApi(id);
      } else if (confirmModal.type === "CANCEL") {
        await cancelPurchaseApi(id);
      } else if (confirmModal.type === "DELETE") {
        await deletePurchaseApi(id);
      }
      closeConfirmModal();
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      alert(err.response?.data?.error?.message || `Failed to ${confirmModal.type.toLowerCase()} purchase.`);
      setConfirmModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case "RECEIVED":
        return { backgroundColor: "#d1fae5", color: "#065f46", border: "1px solid #a7f3d0" };
      case "CANCELLED":
        return { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" };
      case "DRAFT":
      default:
        return { backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" };
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      <Navbar />

      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* Header section */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>
              Purchases & Goods Receiving
            </h1>
            <p style={{ color: "#64748b", margin: "0.25rem 0 0", fontSize: "0.95rem" }}>
              Create, track, and receive stock purchase orders from suppliers.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            style={{
              backgroundColor: "#2563eb",
              color: "#ffffff",
              padding: "0.625rem 1.25rem",
              borderRadius: "0.5rem",
              fontWeight: "600",
              fontSize: "0.875rem",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>+</span> New Purchase
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "1.25rem",
            borderRadius: "0.75rem",
            boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)",
            border: "1px solid #e2e8f0",
            marginBottom: "1.5rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Status Tabs */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {["ALL", "DRAFT", "RECEIVED", "CANCELLED"].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "0.375rem",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  border: "none",
                  backgroundColor: statusFilter === st ? "#2563eb" : "#f1f5f9",
                  color: statusFilter === st ? "#ffffff" : "#475569",
                  transition: "all 0.15s ease",
                }}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Search and Date Controls */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search ref # or supplier..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{
                padding: "0.5rem 0.85rem",
                borderRadius: "0.375rem",
                border: "1px solid #cbd5e1",
                fontSize: "0.875rem",
                outline: "none",
                minWidth: "220px",
              }}
            />

            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              title="Start Date"
              style={{
                padding: "0.5rem 0.85rem",
                borderRadius: "0.375rem",
                border: "1px solid #cbd5e1",
                fontSize: "0.875rem",
                outline: "none",
              }}
            />

            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              title="End Date"
              style={{
                padding: "0.5rem 0.85rem",
                borderRadius: "0.375rem",
                border: "1px solid #cbd5e1",
                fontSize: "0.875rem",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Content Section */}
        {error && (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "0.5rem",
              color: "#991b1b",
              marginBottom: "1.5rem",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "0.75rem",
            boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
          }}
        >
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
              Loading purchase records...
            </div>
          ) : purchases.length === 0 ? (
            <div style={{ padding: "3.5rem 1rem", textAlign: "center" }}>
              <p style={{ fontSize: "1.1rem", fontWeight: "600", color: "#334155", margin: 0 }}>
                No purchase orders found.
              </p>
              <p style={{ color: "#64748b", margin: "0.5rem 0 1.25rem", fontSize: "0.9rem" }}>
                {search || statusFilter !== "ALL" || startDate || endDate
                  ? "Try adjusting your search criteria or date filters."
                  : "Get started by recording your first purchase order."}
              </p>
              {!search && statusFilter === "ALL" && (
                <button
                  onClick={openCreateModal}
                  style={{
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    padding: "0.5rem 1.25rem",
                    borderRadius: "0.375rem",
                    fontWeight: "600",
                    fontSize: "0.875rem",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Create Purchase
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "0.85rem 1.25rem", fontSize: "0.75rem", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>
                      Reference #
                    </th>
                    <th style={{ padding: "0.85rem 1.25rem", fontSize: "0.75rem", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>
                      Date
                    </th>
                    <th style={{ padding: "0.85rem 1.25rem", fontSize: "0.75rem", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>
                      Supplier
                    </th>
                    <th style={{ padding: "0.85rem 1.25rem", fontSize: "0.75rem", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>
                      Status
                    </th>
                    <th style={{ padding: "0.85rem 1.25rem", fontSize: "0.75rem", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>
                      Items
                    </th>
                    <th style={{ padding: "0.85rem 1.25rem", fontSize: "0.75rem", fontWeight: "700", color: "#475569", textTransform: "uppercase", textAlign: "right" }}>
                      Total Amount
                    </th>
                    <th style={{ padding: "0.85rem 1.25rem", fontSize: "0.75rem", fontWeight: "700", color: "#475569", textTransform: "uppercase", textAlign: "right" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody style={{ divideY: "1px solid #f1f5f9" }}>
                  {purchases.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s" }}>
                      <td style={{ padding: "0.85rem 1.25rem", fontWeight: "600", fontSize: "0.875rem" }}>
                        <Link
                          to={`/purchases/${p.id}`}
                          style={{ color: "#2563eb", textDecoration: "none" }}
                          onMouseOver={(e) => (e.target.style.textDecoration = "underline")}
                          onMouseOut={(e) => (e.target.style.textDecoration = "none")}
                        >
                          {p.reference_number}
                        </Link>
                      </td>
                      <td style={{ padding: "0.85rem 1.25rem", fontSize: "0.875rem", color: "#475569" }}>
                        {p.purchase_date}
                      </td>
                      <td style={{ padding: "0.85rem 1.25rem", fontSize: "0.875rem", color: "#0f172a", fontWeight: "500" }}>
                        {p.supplier?.name || "—"}
                      </td>
                      <td style={{ padding: "0.85rem 1.25rem" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.2rem 0.55rem",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                            ...getStatusBadgeStyle(p.status),
                          }}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding: "0.85rem 1.25rem", fontSize: "0.875rem", color: "#475569" }}>
                        {p.item_count} items
                      </td>
                      <td style={{ padding: "0.85rem 1.25rem", fontSize: "0.9rem", fontWeight: "700", color: "#0f172a", textAlign: "right" }}>
                        ₱{parseFloat(p.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
                          <Link
                            to={`/purchases/${p.id}`}
                            style={{
                              padding: "0.35rem 0.65rem",
                              backgroundColor: "#f1f5f9",
                              color: "#334155",
                              borderRadius: "0.375rem",
                              fontSize: "0.8rem",
                              fontWeight: "600",
                              textDecoration: "none",
                            }}
                          >
                            Details
                          </Link>

                          {p.status === "DRAFT" && (
                            <>
                              <button
                                onClick={() => openConfirmModal("RECEIVE", p)}
                                title="Receive stock into inventory"
                                style={{
                                  padding: "0.35rem 0.65rem",
                                  backgroundColor: "#10b981",
                                  color: "#ffffff",
                                  border: "none",
                                  borderRadius: "0.375rem",
                                  fontSize: "0.8rem",
                                  fontWeight: "600",
                                  cursor: "pointer",
                                }}
                              >
                                Receive
                              </button>

                              <button
                                onClick={() => openConfirmModal("CANCEL", p)}
                                title="Cancel purchase"
                                style={{
                                  padding: "0.35rem 0.65rem",
                                  backgroundColor: "#f1f5f9",
                                  color: "#dc2626",
                                  border: "none",
                                  borderRadius: "0.375rem",
                                  fontSize: "0.8rem",
                                  fontWeight: "600",
                                  cursor: "pointer",
                                }}
                              >
                                Cancel
                              </button>

                              {isOwner && (
                                <button
                                  onClick={() => openConfirmModal("DELETE", p)}
                                  title="Delete draft purchase"
                                  style={{
                                    padding: "0.35rem 0.65rem",
                                    backgroundColor: "#fee2e2",
                                    color: "#991b1b",
                                    border: "none",
                                    borderRadius: "0.375rem",
                                    fontSize: "0.8rem",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                  }}
                                >
                                  Delete
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && purchases.length > 0 && pagination.pages > 1 && (
            <div
              style={{
                padding: "0.85rem 1.25rem",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.875rem",
                color: "#64748b",
              }}
            >
              <div>
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #cbd5e1",
                    backgroundColor: pagination.page <= 1 ? "#f8fafc" : "#ffffff",
                    color: pagination.page <= 1 ? "#94a3b8" : "#334155",
                    cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Previous
                </button>
                <button
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #cbd5e1",
                    backgroundColor: pagination.page >= pagination.pages ? "#f8fafc" : "#ffffff",
                    color: pagination.page >= pagination.pages ? "#94a3b8" : "#334155",
                    cursor: pagination.page >= pagination.pages ? "not-allowed" : "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* New Purchase Modal */}
      {isCreateModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 50,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              maxWidth: "760px",
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "1.25rem 1.5rem",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "700", color: "#0f172a" }}>
                Create Purchase Order
              </h2>
              <button
                onClick={closeCreateModal}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.5rem",
                  color: "#94a3b8",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateSubmit} style={{ overflowY: "auto", padding: "1.5rem" }}>
              {createError && (
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "0.375rem",
                    color: "#991b1b",
                    fontSize: "0.875rem",
                    marginBottom: "1rem",
                  }}
                >
                  {createError}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.35rem" }}>
                    Supplier *
                  </label>
                  <select
                    value={createForm.supplier_id}
                    onChange={(e) => setCreateForm({ ...createForm, supplier_id: e.target.value })}
                    required
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.75rem",
                      borderRadius: "0.375rem",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.875rem",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliersList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.35rem" }}>
                    Purchase Date *
                  </label>
                  <input
                    type="date"
                    value={createForm.purchase_date}
                    onChange={(e) => setCreateForm({ ...createForm, purchase_date: e.target.value })}
                    required
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.75rem",
                      borderRadius: "0.375rem",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.875rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.35rem" }}>
                  Reference Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. PUR-20260908-0001 (leave blank for auto-generation)"
                  value={createForm.reference_number}
                  onChange={(e) => setCreateForm({ ...createForm, reference_number: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.75rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.875rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Line Items Section */}
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1rem", marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: "700", color: "#0f172a" }}>
                    Line Items
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    style={{
                      backgroundColor: "#f1f5f9",
                      color: "#2563eb",
                      border: "1px solid #bfdbfe",
                      padding: "0.35rem 0.75rem",
                      borderRadius: "0.375rem",
                      fontSize: "0.8rem",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    + Add Product
                  </button>
                </div>

                {createForm.items.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: "0.85rem", fontStyle: "italic", margin: "0.5rem 0" }}>
                    No line items added yet. You can add items now or later in draft mode.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                    {createForm.items.map((it, idx) => {
                      const lineSubtotal = (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_cost) || 0);
                      return (
                        <div
                          key={idx}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "3fr 1.2fr 1.5fr 1.5fr auto",
                            gap: "0.5rem",
                            alignItems: "center",
                            backgroundColor: "#f8fafc",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.375rem",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div>
                            <select
                              value={it.product_id}
                              onChange={(e) => handleItemFieldChange(idx, "product_id", e.target.value)}
                              style={{ width: "100%", padding: "0.35rem", fontSize: "0.8rem", borderRadius: "0.25rem", border: "1px solid #cbd5e1" }}
                            >
                              {productsList.map((prod) => (
                                <option key={prod.id} value={prod.id}>
                                  {prod.name} ({prod.sku})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <input
                              type="number"
                              step="0.001"
                              min="0.001"
                              placeholder="Qty"
                              value={it.quantity}
                              onChange={(e) => handleItemFieldChange(idx, "quantity", e.target.value)}
                              style={{ width: "100%", padding: "0.35rem", fontSize: "0.8rem", borderRadius: "0.25rem", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                            />
                          </div>

                          <div>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Unit Cost"
                              value={it.unit_cost}
                              onChange={(e) => handleItemFieldChange(idx, "unit_cost", e.target.value)}
                              style={{ width: "100%", padding: "0.35rem", fontSize: "0.8rem", borderRadius: "0.25rem", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                            />
                          </div>

                          <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#0f172a", textAlign: "right" }}>
                            ₱{lineSubtotal.toFixed(2)}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#ef4444",
                              fontSize: "1.1rem",
                              cursor: "pointer",
                              padding: "0.2rem 0.4rem",
                            }}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}

                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "1rem", marginTop: "0.5rem" }}>
                      <span style={{ fontSize: "0.875rem", color: "#64748b" }}>Order Total:</span>
                      <span style={{ fontSize: "1.1rem", fontWeight: "700", color: "#0f172a" }}>
                        ₱{computeModalTotal().toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: "1rem",
                }}
              >
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={creating}
                  style={{
                    padding: "0.55rem 1rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#475569",
                    fontWeight: "600",
                    fontSize: "0.875rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    padding: "0.55rem 1.25rem",
                    borderRadius: "0.375rem",
                    border: "none",
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    fontWeight: "600",
                    fontSize: "0.875rem",
                    cursor: creating ? "not-allowed" : "pointer",
                  }}
                >
                  {creating ? "Saving..." : "Create Purchase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Action Modal */}
      {confirmModal.isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 60,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.15rem", fontWeight: "700", color: "#0f172a" }}>
              {confirmModal.type === "RECEIVE" && "Confirm Goods Receipt"}
              {confirmModal.type === "CANCEL" && "Cancel Purchase Order"}
              {confirmModal.type === "DELETE" && "Delete Draft Purchase"}
            </h3>

            <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "#475569", lineHeight: 1.5 }}>
              {confirmModal.type === "RECEIVE" && (
                <>
                  Are you sure you want to receive purchase{" "}
                  <strong>{confirmModal.purchase?.reference_number}</strong>?
                  <br />
                  <br />
                  <span style={{ color: "#059669", fontWeight: "600" }}>
                    This will permanently add the items to stock and update latest cost prices.
                  </span>
                </>
              )}
              {confirmModal.type === "CANCEL" && (
                <>
                  Are you sure you want to cancel purchase{" "}
                  <strong>{confirmModal.purchase?.reference_number}</strong>?
                  This action is terminal and cannot be undone.
                </>
              )}
              {confirmModal.type === "DELETE" && (
                <>
                  Are you sure you want to delete draft purchase{" "}
                  <strong>{confirmModal.purchase?.reference_number}</strong>?
                  All line items will be removed permanently.
                </>
              )}
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={closeConfirmModal}
                disabled={confirmModal.loading}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#475569",
                  fontWeight: "600",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                Back
              </button>

              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={confirmModal.loading}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "0.375rem",
                  border: "none",
                  backgroundColor:
                    confirmModal.type === "RECEIVE"
                      ? "#10b981"
                      : confirmModal.type === "DELETE"
                      ? "#dc2626"
                      : "#64748b",
                  color: "#ffffff",
                  fontWeight: "600",
                  fontSize: "0.875rem",
                  cursor: confirmModal.loading ? "not-allowed" : "pointer",
                }}
              >
                {confirmModal.loading
                  ? "Processing..."
                  : confirmModal.type === "RECEIVE"
                  ? "Confirm & Receive"
                  : confirmModal.type === "DELETE"
                  ? "Delete Purchase"
                  : "Cancel Purchase"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchasesPage;
