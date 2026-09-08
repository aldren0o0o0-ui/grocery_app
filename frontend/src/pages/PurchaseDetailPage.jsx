import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
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

export const PurchaseDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";

  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Products available to add
  const [productsList, setProductsList] = useState([]);

  // Add Item Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({ product_id: "", quantity: "1.000", unit_cost: "0.00" });
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  // Edit Item Modal
  const [editItem, setEditItem] = useState(null); // { id, product, quantity, unit_cost }
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
      unit_cost: available && available.cost_price ? String(available.cost_price) : "0.00",
    });
    setAddError("");
    setIsAddModalOpen(true);
  };

  const handleProductSelectChange = (e) => {
    const pId = e.target.value;
    const prod = productsList.find((p) => String(p.id) === String(pId));
    setAddForm((prev) => ({
      ...prev,
      product_id: pId,
      unit_cost: prod && prod.cost_price ? String(prod.cost_price) : prev.unit_cost,
    }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddError("");

    if (!addForm.product_id) {
      setAddError("Please select a product.");
      return;
    }
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
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setAddError(err.response?.data?.error?.message || "Failed to add item.");
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
        closeConfirmModal();
        setRefreshTrigger((prev) => prev + 1);
      } else if (confirmModal.type === "CANCEL") {
        await cancelPurchaseApi(purchase.id);
        closeConfirmModal();
        setRefreshTrigger((prev) => prev + 1);
      } else if (confirmModal.type === "DELETE") {
        await deletePurchaseApi(purchase.id);
        closeConfirmModal();
        navigate("/purchases");
      } else if (confirmModal.type === "REMOVE_ITEM" && confirmModal.item) {
        await removePurchaseItemApi(purchase.id, confirmModal.item.id);
        closeConfirmModal();
        setRefreshTrigger((prev) => prev + 1);
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || `Failed to perform ${confirmModal.type.toLowerCase()} action.`);
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

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
        <Navbar />
        <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "3rem 1.5rem", textAlign: "center", color: "#64748b" }}>
          Loading purchase order details...
        </main>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
        <Navbar />
        <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "2rem 1.5rem" }}>
          <div
            style={{
              padding: "1.5rem",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "0.75rem",
              color: "#991b1b",
              textAlign: "center",
            }}
          >
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem" }}>Unable to Load Purchase</h2>
            <p style={{ margin: "0 0 1rem" }}>{error || "The requested purchase order was not found."}</p>
            <Link
              to="/purchases"
              style={{
                display: "inline-block",
                padding: "0.5rem 1rem",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                borderRadius: "0.375rem",
                textDecoration: "none",
                fontWeight: "600",
                fontSize: "0.875rem",
              }}
            >
              ← Back to Purchases
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isDraft = purchase.status === "DRAFT";
  const items = purchase.items || [];
  const totalQuantity = items.reduce((acc, it) => acc + (parseFloat(it.quantity) || 0), 0);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      <Navbar />

      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* Navigation Breadcrumb & Actions Bar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Link
              to="/purchases"
              style={{
                color: "#64748b",
                textDecoration: "none",
                fontSize: "0.9rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              ← Purchases
            </Link>
            <span style={{ color: "#cbd5e1" }}>/</span>
            <span style={{ color: "#0f172a", fontWeight: "600", fontSize: "0.9rem" }}>
              {purchase.reference_number}
            </span>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            {isDraft && (
              <>
                <button
                  onClick={() => openConfirmModal("RECEIVE")}
                  style={{
                    backgroundColor: "#10b981",
                    color: "#ffffff",
                    padding: "0.55rem 1.15rem",
                    borderRadius: "0.5rem",
                    fontWeight: "600",
                    fontSize: "0.875rem",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
                  }}
                >
                  ✓ Receive Stock
                </button>

                <button
                  onClick={() => openConfirmModal("CANCEL")}
                  style={{
                    backgroundColor: "#ffffff",
                    color: "#dc2626",
                    border: "1px solid #fecaca",
                    padding: "0.55rem 1.15rem",
                    borderRadius: "0.5rem",
                    fontWeight: "600",
                    fontSize: "0.875rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel Order
                </button>

                {isOwner && (
                  <button
                    onClick={() => openConfirmModal("DELETE")}
                    style={{
                      backgroundColor: "#fee2e2",
                      color: "#991b1b",
                      border: "none",
                      padding: "0.55rem 1rem",
                      borderRadius: "0.5rem",
                      fontWeight: "600",
                      fontSize: "0.875rem",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Status Banner */}
        {purchase.status === "DRAFT" && (
          <div
            style={{
              padding: "0.85rem 1.25rem",
              backgroundColor: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "0.5rem",
              color: "#92400e",
              fontSize: "0.875rem",
              marginBottom: "1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontWeight: "700" }}>DRAFT ORDER:</span> Line items may be added, updated, or removed. Click "Receive Stock" when the shipment arrives to increment authoritative inventory balances.
          </div>
        )}

        {purchase.status === "RECEIVED" && (
          <div
            style={{
              padding: "0.85rem 1.25rem",
              backgroundColor: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: "0.5rem",
              color: "#065f46",
              fontSize: "0.875rem",
              marginBottom: "1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontWeight: "700" }}>ORDER RECEIVED:</span> This purchase is final. Items have been added to inventory stock and product cost prices have been updated.
          </div>
        )}

        {purchase.status === "CANCELLED" && (
          <div
            style={{
              padding: "0.85rem 1.25rem",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "0.5rem",
              color: "#991b1b",
              fontSize: "0.875rem",
              marginBottom: "1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontWeight: "700" }}>CANCELLED ORDER:</span> This purchase was cancelled. No stock movements were created and inventory was not affected.
          </div>
        )}

        {/* Order Details Header Card */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "0.75rem",
            padding: "1.5rem",
            boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)",
            border: "1px solid #e2e8f0",
            marginBottom: "1.5rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.5rem",
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
              Reference Number
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: "700", color: "#0f172a", marginTop: "0.25rem" }}>
              {purchase.reference_number}
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "0.2rem 0.55rem",
                  borderRadius: "9999px",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  ...getStatusBadgeStyle(purchase.status),
                }}
              >
                {purchase.status}
              </span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
              Supplier
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: "600", color: "#0f172a", marginTop: "0.25rem" }}>
              {purchase.supplier?.name || "Unknown Supplier"}
            </div>
            <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.2rem" }}>
              {purchase.supplier?.contact_person && `Contact: ${purchase.supplier.contact_person}`}
              {purchase.supplier?.phone && ` • ${purchase.supplier.phone}`}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
              Dates & Creator
            </div>
            <div style={{ fontSize: "0.95rem", color: "#0f172a", marginTop: "0.25rem" }}>
              Purchase Date: <strong>{purchase.purchase_date}</strong>
            </div>
            <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.2rem" }}>
              Created by: {purchase.creator ? `${purchase.creator.first_name} ${purchase.creator.last_name}` : "System"}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
              Total Order Amount
            </div>
            <div style={{ fontSize: "1.6rem", fontWeight: "800", color: "#0f172a", marginTop: "0.25rem" }}>
              ₱{parseFloat(purchase.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.2rem" }}>
              {items.length} line items ({totalQuantity.toFixed(3)} units)
            </div>
          </div>
        </div>

        {/* Line Items Table Card */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "0.75rem",
            boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "1.25rem 1.5rem",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700", color: "#0f172a" }}>
                Purchase Line Items
              </h2>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                Individual goods, quantities, and agreed purchase cost.
              </p>
            </div>

            {isDraft && (
              <button
                onClick={openAddModal}
                style={{
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  padding: "0.45rem 1rem",
                  borderRadius: "0.375rem",
                  fontWeight: "600",
                  fontSize: "0.85rem",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                + Add Item
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
              <p style={{ fontSize: "1rem", fontWeight: "600", color: "#334155", margin: 0 }}>
                No line items in this purchase order.
              </p>
              {isDraft && (
                <button
                  onClick={openAddModal}
                  style={{
                    marginTop: "1rem",
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    padding: "0.45rem 1rem",
                    borderRadius: "0.375rem",
                    fontWeight: "600",
                    fontSize: "0.85rem",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Add First Item
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "0.85rem 1.25rem", fontSize: "0.75rem", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>
                      Product / SKU
                    </th>
                    <th style={{ padding: "0.85rem 1.25rem", fontSize: "0.75rem", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>
                      Unit
                    </th>
                    <th style={{ padding: "0.85rem 1.25rem", fontSize: "0.75rem", fontWeight: "700", color: "#475569", textTransform: "uppercase", textAlign: "right" }}>
                      Quantity
                    </th>
                    <th style={{ padding: "0.85rem 1.25rem", fontSize: "0.75rem", fontWeight: "700", color: "#475569", textTransform: "uppercase", textAlign: "right" }}>
                      Unit Cost
                    </th>
                    <th style={{ padding: "0.85rem 1.25rem", fontSize: "0.75rem", fontWeight: "700", color: "#475569", textTransform: "uppercase", textAlign: "right" }}>
                      Subtotal
                    </th>
                    {isDraft && (
                      <th style={{ padding: "0.85rem 1.25rem", fontSize: "0.75rem", fontWeight: "700", color: "#475569", textTransform: "uppercase", textAlign: "right" }}>
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.85rem 1.25rem" }}>
                        <div style={{ fontWeight: "600", fontSize: "0.875rem", color: "#0f172a" }}>
                          {it.product?.name || `Product ID ${it.product_id}`}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", fontFamily: "monospace" }}>
                          {it.product?.sku}
                        </div>
                      </td>
                      <td style={{ padding: "0.85rem 1.25rem", fontSize: "0.875rem", color: "#475569" }}>
                        {it.product?.unit || "piece"}
                      </td>
                      <td style={{ padding: "0.85rem 1.25rem", fontSize: "0.875rem", fontWeight: "600", color: "#0f172a", textAlign: "right" }}>
                        {it.quantity}
                      </td>
                      <td style={{ padding: "0.85rem 1.25rem", fontSize: "0.875rem", color: "#475569", textAlign: "right" }}>
                        ₱{parseFloat(it.unit_cost).toFixed(2)}
                      </td>
                      <td style={{ padding: "0.85rem 1.25rem", fontSize: "0.9rem", fontWeight: "700", color: "#0f172a", textAlign: "right" }}>
                        ₱{parseFloat(it.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      {isDraft && (
                        <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                            <button
                              onClick={() => openEditModal(it)}
                              style={{
                                padding: "0.25rem 0.6rem",
                                backgroundColor: "#f1f5f9",
                                color: "#334155",
                                border: "1px solid #cbd5e1",
                                borderRadius: "0.25rem",
                                fontSize: "0.75rem",
                                fontWeight: "600",
                                cursor: "pointer",
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => openConfirmModal("REMOVE_ITEM", it)}
                              style={{
                                padding: "0.25rem 0.6rem",
                                backgroundColor: "#fee2e2",
                                color: "#991b1b",
                                border: "none",
                                borderRadius: "0.25rem",
                                fontSize: "0.75rem",
                                fontWeight: "600",
                                cursor: "pointer",
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                    <td colSpan={2} style={{ padding: "1rem 1.25rem", fontWeight: "700", fontSize: "0.95rem", color: "#0f172a" }}>
                      Total ({items.length} items)
                    </td>
                    <td style={{ padding: "1rem 1.25rem", textAlign: "right", fontWeight: "700", fontSize: "0.95rem", color: "#0f172a" }}>
                      {totalQuantity.toFixed(3)}
                    </td>
                    <td></td>
                    <td style={{ padding: "1rem 1.25rem", textAlign: "right", fontWeight: "800", fontSize: "1.1rem", color: "#0f172a" }}>
                      ₱{parseFloat(purchase.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    {isDraft && <td></td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add Line Item Modal */}
      {isAddModalOpen && (
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
              padding: "1.5rem",
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <h3 style={{ margin: "0 0 1rem", fontSize: "1.15rem", fontWeight: "700", color: "#0f172a" }}>
              Add Item to Purchase
            </h3>

            {addError && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "0.375rem",
                  color: "#991b1b",
                  fontSize: "0.85rem",
                  marginBottom: "1rem",
                }}
              >
                {addError}
              </div>
            )}

            <form onSubmit={handleAddSubmit}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#334155", marginBottom: "0.35rem" }}>
                  Product *
                </label>
                <select
                  value={addForm.product_id}
                  onChange={handleProductSelectChange}
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
                  <option value="">-- Select Product --</option>
                  {productsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#334155", marginBottom: "0.35rem" }}>
                    Quantity *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={addForm.quantity}
                    onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })}
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

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#334155", marginBottom: "0.35rem" }}>
                    Unit Cost (₱) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addForm.unit_cost}
                    onChange={(e) => setAddForm({ ...addForm, unit_cost: e.target.value })}
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

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={adding}
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  style={{
                    padding: "0.5rem 1.25rem",
                    borderRadius: "0.375rem",
                    border: "none",
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    fontWeight: "600",
                    fontSize: "0.875rem",
                    cursor: adding ? "not-allowed" : "pointer",
                  }}
                >
                  {adding ? "Adding..." : "Add to Purchase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Line Item Modal */}
      {editItem && (
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
              padding: "1.5rem",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.15rem", fontWeight: "700", color: "#0f172a" }}>
              Edit Line Item
            </h3>
            <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#64748b" }}>
              {editItem.product?.name} ({editItem.product?.sku})
            </p>

            {editError && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "0.375rem",
                  color: "#991b1b",
                  fontSize: "0.85rem",
                  marginBottom: "1rem",
                }}
              >
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#334155", marginBottom: "0.35rem" }}>
                    Quantity *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
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

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#334155", marginBottom: "0.35rem" }}>
                    Unit Cost (₱) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.unit_cost}
                    onChange={(e) => setEditForm({ ...editForm, unit_cost: e.target.value })}
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

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  disabled={editing}
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editing}
                  style={{
                    padding: "0.5rem 1.25rem",
                    borderRadius: "0.375rem",
                    border: "none",
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    fontWeight: "600",
                    fontSize: "0.875rem",
                    cursor: editing ? "not-allowed" : "pointer",
                  }}
                >
                  {editing ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
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
              {confirmModal.type === "REMOVE_ITEM" && "Remove Line Item"}
            </h3>

            <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "#475569", lineHeight: 1.5 }}>
              {confirmModal.type === "RECEIVE" && (
                <>
                  Are you sure you want to receive purchase{" "}
                  <strong>{purchase.reference_number}</strong>?
                  <br />
                  <br />
                  <span style={{ color: "#059669", fontWeight: "600" }}>
                    Stock balances will be incremented and product cost prices will be updated to the received unit costs.
                  </span>
                </>
              )}
              {confirmModal.type === "CANCEL" && (
                <>
                  Are you sure you want to cancel purchase <strong>{purchase.reference_number}</strong>?
                  This action is terminal and cannot be undone.
                </>
              )}
              {confirmModal.type === "DELETE" && (
                <>
                  Are you sure you want to delete draft purchase <strong>{purchase.reference_number}</strong>?
                  This action cannot be undone.
                </>
              )}
              {confirmModal.type === "REMOVE_ITEM" && (
                <>
                  Are you sure you want to remove item <strong>{confirmModal.item?.product?.name}</strong> from this order?
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
                      : confirmModal.type === "CANCEL"
                      ? "#64748b"
                      : "#dc2626",
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
                  : confirmModal.type === "CANCEL"
                  ? "Cancel Order"
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseDetailPage;
