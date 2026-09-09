import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useAuth from "../modules/auth/useAuth";
import {
  getCategoriesApi,
  createCategoryApi,
  updateCategoryApi,
  setCategoryStatusApi,
} from "../modules/categories/api";
import {
  PageHeader,
  Button,
  DataTable,
  Pagination,
  StatusBadge,
  Modal,
  FormField,
  Input,
  Textarea,
  ConfirmDialog,
  Toast,
} from "../components/common";

export const CategoriesPage = () => {
  const { user } = useAuth();
  const canManage = user?.role === "OWNER";

  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 10, total: 0, pages: 1 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" | "edit"
  const [selectedId, setSelectedId] = useState(null);
  const [formData, setFormData] = useState({ name: "", description: "", is_active: true });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    category: null,
    loading: false,
  });

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
          const items = res?.data?.items || res?.items || (Array.isArray(res) ? res : []);
          const pag = res?.data?.pagination || res?.pagination || {
            page: pagination.page,
            per_page: 10,
            total: items.length,
            pages: 1,
          };
          setCategories(items);
          setPagination(pag);
          setError("");
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
        setToastMessage({ type: "success", text: `Category "${formData.name.trim()}" created successfully.` });
      } else {
        await updateCategoryApi(selectedId, {
          name: formData.name.trim(),
          description: formData.description?.trim() || null,
          is_active: formData.is_active,
        });
        setToastMessage({ type: "success", text: `Category "${formData.name.trim()}" updated successfully.` });
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

  const handleToggleStatusClick = (category) => {
    setConfirmDialog({
      isOpen: true,
      category,
      loading: false,
    });
  };

  const handleConfirmToggleStatus = async () => {
    const category = confirmDialog.category;
    if (!category) return;

    setConfirmDialog((prev) => ({ ...prev, loading: true }));
    const newStatus = !category.is_active;
    const action = newStatus ? "activated" : "deactivated";

    try {
      await setCategoryStatusApi(category.id, newStatus);
      setToastMessage({ type: "success", text: `Category "${category.name}" ${action}.` });
      setConfirmDialog({ isOpen: false, category: null, loading: false });
      setLoading(true);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setToastMessage({
        type: "error",
        text: err.response?.data?.message || `Failed to update category status.`,
      });
      setConfirmDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const columns = [
    {
      header: "Name",
      accessor: (c) => (
        <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{c.name}</span>
      ),
    },
    {
      header: "Description",
      accessor: (c) => (
        <span style={{ color: "var(--color-text-secondary)", fontSize: "13px" }}>
          {c.description || "—"}
        </span>
      ),
    },
    {
      header: "Status",
      accessor: (c) => (
        <StatusBadge
          status={c.is_active ? "Active" : "Inactive"}
          variant={c.is_active ? "success" : "neutral"}
        />
      ),
    },
    {
      header: "Products",
      accessor: (c) => (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--color-text-secondary)",
            backgroundColor: "var(--color-bg)",
            padding: "2px 8px",
            borderRadius: "var(--radius-sm)",
          }}
        >
          {c.product_count ?? 0} items
        </span>
      ),
    },
    {
      header: "Actions",
      align: "right",
      accessor: (c) =>
        canManage ? (
          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleOpenEdit(c)}
            >
              Edit
            </Button>
            <Button
              variant={c.is_active ? "danger" : "secondary"}
              size="sm"
              onClick={() => handleToggleStatusClick(c)}
            >
              {c.is_active ? "Deactivate" : "Activate"}
            </Button>
          </div>
        ) : (
          <span style={{ fontSize: "12px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
            View Only
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
        title="Product Categories"
        subtitle="Organize catalog items into structured grocery categories."
        actions={
          <div style={{ display: "flex", gap: "10px" }}>
            <Link
              to="/products"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "8px 14px",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-text)",
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              ← Back to Products
            </Link>
            {canManage && (
              <Button
                id="btn-add-category"
                variant="primary"
                size="md"
                onClick={handleOpenCreate}
              >
                + Add Category
              </Button>
            )}
          </div>
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
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "8px", flex: 1, minWidth: "260px" }}>
          <input
            id="category-search-input"
            type="text"
            placeholder="Search category name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
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
          <Button
            type="submit"
            id="btn-category-search"
            variant="secondary"
            size="md"
          >
            Search
          </Button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="category-status-filter" style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
            Status:
          </label>
          <select
            id="category-status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
              setLoading(true);
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
            <option value="all">All</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
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

      {/* Categories Table */}
      <DataTable
        columns={columns}
        data={categories}
        loading={loading}
        emptyTitle="No categories found"
        emptyMessage="There are no categories matching your search or filter criteria."
        emptyAction={
          canManage && (
            <Button variant="primary" size="sm" onClick={handleOpenCreate}>
              + Add First Category
            </Button>
          )
        }
      />

      {/* Pagination Controls */}
      {!loading && categories.length > 0 && pagination.pages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.pages}
          totalItems={pagination.total}
          onPageChange={handlePageChange}
        />
      )}

      {/* Modal Dialog for Create/Edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={modalMode === "create" ? "Add New Category" : "Edit Category"}
        maxWidth="500px"
      >
        {formError && (
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
            {formError}
          </div>
        )}

        <form onSubmit={handleFormSubmit}>
          <FormField label="Category Name" required id="modal-category-name">
            <Input
              required
              placeholder="e.g. Dairy & Eggs"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </FormField>

          <FormField label="Description (Optional)" id="modal-category-desc">
            <Textarea
              rows={3}
              placeholder="Brief description of this category..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </FormField>

          {modalMode === "edit" && (
            <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                id="modal-category-active"
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                style={{ width: "16px", height: "16px", accentColor: "var(--color-primary)", cursor: "pointer" }}
              />
              <label htmlFor="modal-category-active" style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)", cursor: "pointer" }}>
                Active category (available for product assignment)
              </label>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button
              id="btn-category-cancel"
              variant="secondary"
              size="md"
              onClick={handleCloseModal}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              id="btn-category-save"
              type="submit"
              variant="primary"
              size="md"
              loading={submitting}
            >
              {submitting ? "Saving..." : modalMode === "create" ? "Create Category" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Deactivate / Activate Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.category?.is_active ? "Deactivate Category" : "Activate Category"}
        message={`Are you sure you want to ${
          confirmDialog.category?.is_active ? "deactivate" : "activate"
        } "${confirmDialog.category?.name}"?`}
        confirmLabel={confirmDialog.category?.is_active ? "Deactivate" : "Activate"}
        variant={confirmDialog.category?.is_active ? "danger" : "primary"}
        loading={confirmDialog.loading}
        onConfirm={handleConfirmToggleStatus}
        onCancel={() => setConfirmDialog({ isOpen: false, category: null, loading: false })}
      />
    </div>
  );
};

export default CategoriesPage;
