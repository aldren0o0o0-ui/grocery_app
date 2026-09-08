import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import useAuth from "../modules/auth/useAuth";
import {
  getCategoriesApi,
  createCategoryApi,
  updateCategoryApi,
  setCategoryStatusApi,
} from "../modules/categories/api";

export const CategoriesPage = () => {
  const { user } = useAuth();
  const canManage = ["OWNER", "ADMIN"].includes(user?.role);

  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 10, total: 0, pages: 1 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" | "edit"
  const [selectedId, setSelectedId] = useState(null);
  const [formData, setFormData] = useState({ name: "", description: "", is_active: true });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    const loadCategories = async () => {
      try {
        const params = { page: pagination.page, per_page: 10 };
        if (search.trim()) params.search = search.trim();
        if (statusFilter === "active") params.is_active = true;
        if (statusFilter === "inactive") params.is_active = false;

        const res = await getCategoriesApi(params);
        if (!ignore) {
          if (res.status === "success") {
            setCategories(res.data.items || []);
            setPagination(res.data.pagination || { page: 1, per_page: 10, total: 0, pages: 1 });
          } else {
            setError(res.message || "Failed to load categories.");
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.message || err.message || "Network error loading categories.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadCategories();
    return () => {
      ignore = true;
    };
  }, [search, statusFilter, pagination.page, refreshTrigger]);

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
    setSelectedId(null);
    setFormData({ name: "", description: "", is_active: true });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (category) => {
    setModalMode("edit");
    setSelectedId(category.id);
    setFormData({
      name: category.name || "",
      description: category.description || "",
      is_active: category.is_active ?? true,
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
    if (!formData.name.trim()) {
      setFormError("Category name is required.");
      return;
    }
    setSubmitting(true);
    setFormError("");

    try {
      if (modalMode === "create") {
        await createCategoryApi({
          name: formData.name.trim(),
          description: formData.description?.trim() || null,
        });
      } else {
        await updateCategoryApi(selectedId, {
          name: formData.name.trim(),
          description: formData.description?.trim() || null,
          is_active: formData.is_active,
        });
      }
      setIsModalOpen(false);
      setLoading(true);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || "Failed to save category.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (category) => {
    const action = category.is_active ? "deactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} "${category.name}"?`)) {
      return;
    }

    try {
      await setCategoryStatusApi(category.id, !category.is_active);
      setLoading(true);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      alert(err.response?.data?.message || `Failed to ${action} category.`);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Navbar />

      <main style={{ maxWidth: "1100px", margin: "2rem auto", padding: "0 1.5rem" }}>
        {/* Header section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>Categories</h1>
            <p style={{ color: "#64748b", margin: "0.25rem 0 0 0", fontSize: "0.875rem" }}>
              Organize catalog items into structured grocery categories.
            </p>
          </div>
          {canManage && (
            <button
              id="btn-add-category"
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
              + Add Category
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
              id="category-search-input"
              type="text"
              placeholder="Search category name..."
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
              id="btn-category-search"
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
            <span style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: "500" }}>Status:</span>
            <select
              id="category-status-filter"
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
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
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

        {/* Categories Table */}
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
                <th style={{ padding: "0.875rem 1.25rem", color: "#475569", fontWeight: "600" }}>Name</th>
                <th style={{ padding: "0.875rem 1.25rem", color: "#475569", fontWeight: "600" }}>Description</th>
                <th style={{ padding: "0.875rem 1.25rem", color: "#475569", fontWeight: "600" }}>Status</th>
                <th style={{ padding: "0.875rem 1.25rem", color: "#475569", fontWeight: "600" }}>Products</th>
                <th style={{ padding: "0.875rem 1.25rem", color: "#475569", fontWeight: "600", textAlign: "right" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: "2.5rem", textAlign: "center", color: "#64748b" }}>
                    Loading categories...
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "2.5rem", textAlign: "center", color: "#64748b" }}>
                    No categories found.
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr
                    key={cat.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    <td style={{ padding: "0.875rem 1.25rem", fontWeight: "600", color: "#1e293b" }}>{cat.name}</td>
                    <td style={{ padding: "0.875rem 1.25rem", color: "#64748b", maxWidth: "300px" }}>
                      {cat.description || "—"}
                    </td>
                    <td style={{ padding: "0.875rem 1.25rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.2rem 0.55rem",
                          borderRadius: "9999px",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          backgroundColor: cat.is_active ? "#dcfce7" : "#f1f5f9",
                          color: cat.is_active ? "#15803d" : "#64748b",
                        }}
                      >
                        {cat.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "0.875rem 1.25rem", color: "#475569" }}>
                      {cat.products_count ?? 0}
                    </td>
                    <td style={{ padding: "0.875rem 1.25rem", textAlign: "right" }}>
                      {canManage ? (
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => handleOpenEdit(cat)}
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
                            onClick={() => handleToggleStatus(cat)}
                            style={{
                              padding: "0.35rem 0.75rem",
                              backgroundColor: cat.is_active ? "#fef2f2" : "#f0fdf4",
                              border: cat.is_active ? "1px solid #fecaca" : "1px solid #bbf7d0",
                              borderRadius: "6px",
                              fontSize: "0.75rem",
                              fontWeight: "600",
                              color: cat.is_active ? "#dc2626" : "#16a34a",
                              cursor: "pointer",
                            }}
                          >
                            {cat.is_active ? "Deactivate" : "Activate"}
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
              Showing {categories.length} of {pagination.total} categories
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
              maxWidth: "480px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#0f172a", marginTop: 0, marginBottom: "1rem" }}>
              {modalMode === "create" ? "Add New Category" : "Edit Category"}
            </h2>

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
                  Category Name *
                </label>
                <input
                  id="modal-category-name"
                  type="text"
                  required
                  placeholder="e.g. Dairy & Eggs"
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

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.25rem" }}>
                  Description
                </label>
                <textarea
                  id="modal-category-description"
                  rows={3}
                  placeholder="Optional brief description..."
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
                    id="modal-category-isactive"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{ width: "1rem", height: "1rem", cursor: "pointer" }}
                  />
                  <label htmlFor="modal-category-isactive" style={{ fontSize: "0.875rem", color: "#334155", cursor: "pointer" }}>
                    Active Category
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
                  id="btn-modal-category-submit"
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
                  {submitting ? "Saving..." : modalMode === "create" ? "Create Category" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesPage;
