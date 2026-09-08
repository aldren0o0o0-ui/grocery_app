import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import useAuth from "../modules/auth/useAuth";
import {
  getProductsApi,
  createProductApi,
  updateProductApi,
  setProductStatusApi,
} from "../modules/products/api";
import { getCategoriesApi } from "../modules/categories/api";

export const ProductsPage = () => {
  const { user } = useAuth();
  const canManage = user?.role === "OWNER";

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 10, total: 0, pages: 1 });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" | "edit"
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    barcode: "",
    category_id: "",
    unit: "PCS",
    cost_price: "",
    selling_price: "",
    reorder_level: "0.000",
    description: "",
    is_active: true,
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch active categories for dropdowns
  useEffect(() => {
    let ignore = false;
    const fetchCategoryList = async () => {
      try {
        const res = await getCategoriesApi({ is_active: true, per_page: 100 });
        if (!ignore && res.status === "success") {
          setCategories(res.data.items || []);
        }
      } catch {
        // Fallback silently if categories fail to load
      }
    };

    fetchCategoryList();
    return () => {
      ignore = true;
    };
  }, []);

  // Fetch products with filters
  useEffect(() => {
    let ignore = false;
    const fetchProducts = async () => {
      try {
        const params = { page: pagination.page, per_page: 10 };
        if (search.trim()) params.search = search.trim();
        if (categoryFilter) params.category_id = categoryFilter;
        if (statusFilter === "active") params.is_active = true;
        if (statusFilter === "inactive") params.is_active = false;

        const res = await getProductsApi(params);
        if (!ignore) {
          if (res.status === "success") {
            setProducts(res.data.items || []);
            setPagination(res.data.pagination || { page: 1, per_page: 10, total: 0, pages: 1 });
          } else {
            setError(res.message || "Failed to load products.");
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.message || err.message || "Network error loading products.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchProducts();
    return () => {
      ignore = true;
    };
  }, [search, categoryFilter, statusFilter, pagination.page, refreshTrigger]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setPagination((prev) => ({ ...prev, page: 1 }));
    setRefreshTrigger((prev) => prev + 1);
  };

  const handlePageChange = (newPage) => {
    setLoading(true);
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleOpenCreate = () => {
    setModalMode("create");
    setSelectedProduct(null);
    setFormData({
      name: "",
      sku: "",
      barcode: "",
      category_id: categories.length > 0 ? categories[0].id : "",
      unit: "PCS",
      cost_price: "",
      selling_price: "",
      reorder_level: "0.000",
      description: "",
      is_active: true,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product) => {
    setModalMode("edit");
    setSelectedProduct(product);
    setFormData({
      name: product.name || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      category_id: product.category_id || "",
      unit: product.unit || "PCS",
      cost_price: product.cost_price ?? "",
      selling_price: product.selling_price ?? "",
      reorder_level: product.reorder_level ?? "0.000",
      description: product.description || "",
      is_active: product.is_active ?? true,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormError("");
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");

    // Prepare payload (Never include stock_quantity)
    const payload = {
      name: formData.name.trim(),
      sku: formData.sku.trim(),
      barcode: formData.barcode?.trim() || null,
      category_id: Number(formData.category_id),
      unit: formData.unit.trim().toUpperCase(),
      cost_price: parseFloat(formData.cost_price),
      selling_price: parseFloat(formData.selling_price),
      reorder_level: formData.reorder_level ? parseFloat(formData.reorder_level) : 0,
      description: formData.description?.trim() || null,
    };

    if (modalMode === "edit") {
      payload.is_active = formData.is_active;
    }

    try {
      if (modalMode === "create") {
        await createProductApi(payload);
      } else {
        await updateProductApi(selectedProduct.id, payload);
      }
      setIsModalOpen(false);
      setLoading(true);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || "Failed to save product.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (product) => {
    const action = product.is_active ? "deactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} "${product.name}"?`)) {
      return;
    }

    try {
      await setProductStatusApi(product.id, !product.is_active);
      setLoading(true);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      alert(err.response?.data?.message || `Failed to ${action} product.`);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Navbar />

      <main style={{ maxWidth: "1280px", margin: "2rem auto", padding: "0 1.5rem" }}>
        {/* Header section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>Product Catalog</h1>
            <p style={{ color: "#64748b", margin: "0.25rem 0 0 0", fontSize: "0.875rem" }}>
              Manage master grocery products, SKU identifiers, categories, and pricing.
            </p>
          </div>
          {canManage && (
            <button
              id="btn-add-product"
              onClick={handleOpenCreate}
              style={{
                backgroundColor: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "0.6rem 1.25rem",
                fontWeight: "600",
                fontSize: "0.875rem",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
              }}
            >
              + Add Product
            </button>
          )}
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
              id="product-search-input"
              type="text"
              placeholder="Search by name, SKU, or barcode..."
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
              id="btn-product-search"
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
              id="product-category-filter"
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
            <span style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: "500" }}>Status:</span>
            <select
              id="product-status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
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
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
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

        {/* Products Table */}
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
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600" }}>Barcode</th>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600" }}>Category</th>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600" }}>Unit</th>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600", textAlign: "right" }}>
                  Selling Price
                </th>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600", textAlign: "right" }}>
                  Stock Qty
                </th>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600" }}>Status</th>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600", textAlign: "right" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: "2.5rem", textAlign: "center", color: "#64748b" }}>
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: "2.5rem", textAlign: "center", color: "#64748b" }}>
                    No products found matching criteria.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <div style={{ fontWeight: "600", color: "#1e293b" }}>{p.name}</div>
                      {p.description && (
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.15rem" }}>
                          {p.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "0.875rem 1rem", fontFamily: "monospace", color: "#334155" }}>{p.sku}</td>
                    <td style={{ padding: "0.875rem 1rem", color: "#64748b", fontSize: "0.8125rem" }}>
                      {p.barcode || "—"}
                    </td>
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
                    <td style={{ padding: "0.875rem 1rem", textAlign: "right", fontWeight: "600", color: "#0f172a" }}>
                      ${p.selling_price}
                    </td>
                    <td style={{ padding: "0.875rem 1rem", textAlign: "right" }}>
                      <span
                        title="Stock is strictly read-only in Catalog management"
                        style={{
                          fontFamily: "monospace",
                          fontWeight: "600",
                          color: Number(p.stock_quantity) > 0 ? "#15803d" : "#64748b",
                          backgroundColor: Number(p.stock_quantity) > 0 ? "#dcfce7" : "#f1f5f9",
                          padding: "0.15rem 0.45rem",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                        }}
                      >
                        {p.stock_quantity}
                      </span>
                    </td>
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.2rem 0.55rem",
                          borderRadius: "9999px",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          backgroundColor: p.is_active ? "#dcfce7" : "#f1f5f9",
                          color: p.is_active ? "#15803d" : "#64748b",
                        }}
                      >
                        {p.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "0.875rem 1rem", textAlign: "right" }}>
                      {canManage ? (
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => handleOpenEdit(p)}
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
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleStatus(p)}
                            style={{
                              padding: "0.35rem 0.75rem",
                              backgroundColor: p.is_active ? "#fef2f2" : "#f0fdf4",
                              border: p.is_active ? "1px solid #fecaca" : "1px solid #bbf7d0",
                              borderRadius: "6px",
                              fontSize: "0.75rem",
                              fontWeight: "600",
                              color: p.is_active ? "#dc2626" : "#16a34a",
                              cursor: "pointer",
                            }}
                          >
                            {p.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontStyle: "italic" }}>
                          View Only
                        </span>
                      )}
                    </td>
                  </tr>
                ))
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
              Showing {products.length} of {pagination.total} products
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
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
                onClick={() => handlePageChange(pagination.page + 1)}
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

      {/* Modal Dialog for Create/Edit */}
      {isModalOpen && (
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
              maxWidth: "580px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#0f172a", marginTop: 0, marginBottom: "1rem" }}>
              {modalMode === "create" ? "Add New Product" : "Edit Product"}
            </h2>

            {/* Read-Only Stock Notice on Edit */}
            {modalMode === "edit" && (
              <div
                style={{
                  padding: "0.6rem 0.85rem",
                  backgroundColor: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "6px",
                  color: "#1d4ed8",
                  fontSize: "0.8125rem",
                  marginBottom: "1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Stock Quantity (Ledger Managed):</span>
                <strong style={{ fontFamily: "monospace", fontSize: "0.95rem" }}>
                  {selectedProduct?.stock_quantity} {selectedProduct?.unit}
                </strong>
              </div>
            )}

            {formError && (
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
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.25rem" }}>
                  Product Name *
                </label>
                <input
                  id="modal-product-name"
                  type="text"
                  required
                  placeholder="e.g. Organic Whole Milk"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.25rem" }}>
                    SKU *
                  </label>
                  <input
                    id="modal-product-sku"
                    type="text"
                    required
                    placeholder="e.g. MILK-ORG-1L"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
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
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.25rem" }}>
                    Barcode (Optional)
                  </label>
                  <input
                    id="modal-product-barcode"
                    type="text"
                    placeholder="e.g. 7501031311309"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
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
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.25rem" }}>
                    Category *
                  </label>
                  <select
                    id="modal-product-category"
                    required
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "0.5rem 0.75rem",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      outline: "none",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <option value="">Select a category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.25rem" }}>
                    Unit of Measure *
                  </label>
                  <select
                    id="modal-product-unit"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "0.5rem 0.75rem",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      outline: "none",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <option value="PCS">PCS</option>
                    <option value="KG">KG</option>
                    <option value="G">G</option>
                    <option value="L">L</option>
                    <option value="ML">ML</option>
                    <option value="PACK">PACK</option>
                    <option value="BOX">BOX</option>
                    <option value="CAN">CAN</option>
                    <option value="BOTTLE">BOTTLE</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.25rem" }}>
                    Cost Price ($) *
                  </label>
                  <input
                    id="modal-product-cost-price"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
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
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.25rem" }}>
                    Selling Price ($) *
                  </label>
                  <input
                    id="modal-product-selling-price"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
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
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.25rem" }}>
                  Reorder Level
                </label>
                <input
                  id="modal-product-reorder-level"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="0.000"
                  value={formData.reorder_level}
                  onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
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

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.25rem" }}>
                  Description
                </label>
                <textarea
                  id="modal-product-description"
                  rows={2}
                  placeholder="Optional product description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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

              {modalMode === "edit" && (
                <div style={{ marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="checkbox"
                    id="modal-product-isactive"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{ width: "1rem", height: "1rem", cursor: "pointer" }}
                  />
                  <label htmlFor="modal-product-isactive" style={{ fontSize: "0.875rem", color: "#334155", cursor: "pointer" }}>
                    Active Product
                  </label>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
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
                  id="btn-modal-product-submit"
                  disabled={submitting}
                  style={{
                    padding: "0.5rem 1.25rem",
                    backgroundColor: "#2563eb",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    fontWeight: "600",
                    color: "#ffffff",
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting ? "Saving..." : modalMode === "create" ? "Create Product" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;
