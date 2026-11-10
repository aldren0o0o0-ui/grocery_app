import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Store, Edit2, Package } from "lucide-react";
import {
  getCategoriesApi,
  createCategoryApi,
  updateCategoryApi,
  setCategoryStatusApi,
} from "../api/categories";
import { getProductsApi } from "../api/products";
import {
  Button,
  Badge,
  Input,
  Modal,
  Table,
  useToast,
  ConfirmDialog,
  Card,
} from "../components/ui";

export const CategoriesPage = () => {
  const { showToast } = useToast();

  const [categories, setCategories] = useState([]);
  const [productCounts, setProductCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [activeCategory, setActiveCategory] = useState(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Status confirm
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    category: null,
    loading: false,
  });

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      const [catRes, prodRes] = await Promise.allSettled([
        getCategoriesApi(params),
        getProductsApi({ per_page: 500 }),
      ]);

      const catList = catRes.status === "fulfilled"
        ? (catRes.value?.items || catRes.value?.categories || (Array.isArray(catRes.value) ? catRes.value : []))
        : [];

      const prodList = prodRes.status === "fulfilled"
        ? (prodRes.value?.products || prodRes.value?.items || (Array.isArray(prodRes.value) ? prodRes.value : []))
        : [];

      // Calculate real product counts for each category
      const counts = {};
      prodList.forEach((p) => {
        const catId = p.category_id || p.category?.id;
        if (catId) {
          counts[catId] = (counts[catId] || 0) + 1;
        }
      });
      setProductCounts(counts);
      setCategories(catList);
    } catch (err) {
      showToast(err.response?.data?.error?.message || "Failed to load categories.", "error");
    } finally {
      setLoading(false);
    }
  }, [search, showToast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleOpenCreate = () => {
    setModalMode("create");
    setActiveCategory(null);
    setFormData({ name: "", description: "" });
    setModalError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setModalMode("edit");
    setActiveCategory(cat);
    setFormData({ name: cat.name || "", description: cat.description || "" });
    setModalError("");
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setModalError("");

    if (!formData.name.trim()) {
      setModalError("Category name is required.");
      return;
    }

    setSubmitting(true);
    try {
      if (modalMode === "create") {
        await createCategoryApi({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        });
        showToast("Category created successfully.", "success");
      } else {
        await updateCategoryApi(activeCategory.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        });
        showToast("Category updated successfully.", "success");
      }

      setIsModalOpen(false);
      fetchCategories();
    } catch (err) {
      setModalError(err.response?.data?.error?.message || "Failed to save category.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!confirmDialog.category) return;
    setConfirmDialog((prev) => ({ ...prev, loading: true }));

    try {
      const nextStatus = !confirmDialog.category.is_active;
      await setCategoryStatusApi(confirmDialog.category.id, nextStatus);
      showToast(
        `Category marked as ${nextStatus ? "Active" : "Archived"}.`,
        "success"
      );
      setConfirmDialog({ isOpen: false, category: null, loading: false });
      fetchCategories();
    } catch (err) {
      showToast(err.response?.data?.error?.message || "Failed to update status.", "error");
      setConfirmDialog((prev) => ({ ...prev, loading: false }));
    }
  };

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
            Product Categories
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Organize aisles and grocery product groupings for quick cashier POS checkout.
          </p>
        </div>

        <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
          Add Category
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          padding: "16px",
          backgroundColor: "#ffffff",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-xs)",
        }}
      >
        <div style={{ flex: 1, maxWidth: "360px" }}>
          <Input
            placeholder="Search categories..."
            icon={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <Table
        columns={[
          {
            header: "Category",
            key: "name",
            render: (val, row) => (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--color-primary-50)",
                    color: "var(--color-primary-700)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Store size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{val}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {row.description || "No description provided"}
                  </div>
                </div>
              </div>
            ),
          },
          {
            header: "Products Count",
            key: "product_count",
            align: "center",
            render: (_, row) => {
              const count = productCounts[row.id] ?? row.product_count ?? 0;
              return (
                <Badge variant={count > 0 ? "primary" : "neutral"} size="sm">
                  {count} {count === 1 ? "product" : "products"}
                </Badge>
              );
            },
          },
          {
            header: "Status",
            key: "is_active",
            align: "center",
            render: (val) => (
              <Badge variant={val ? "success" : "neutral"} size="sm" dot>
                {val ? "Active" : "Archived"}
              </Badge>
            ),
          },
          {
            header: "Actions",
            key: "actions",
            align: "right",
            render: (_, row) => (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                <Button
                  variant="ghost"
                  size="xs"
                  icon={Edit2}
                  onClick={() => handleOpenEdit(row)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    setConfirmDialog({
                      isOpen: true,
                      category: row,
                      loading: false,
                    })
                  }
                  style={{
                    color: row.is_active ? "var(--color-danger)" : "var(--color-primary-600)",
                  }}
                >
                  {row.is_active ? "Archive" : "Activate"}
                </Button>
              </div>
            ),
          },
        ]}
        data={categories}
        loading={loading}
        emptyMessage="No categories created yet."
        emptyIcon={Store}
      />

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === "create" ? "Add New Category" : "Edit Category"}
        subtitle="Categories group items on the POS terminal and sales reports."
        maxWidth="460px"
      >
        <form onSubmit={handleFormSubmit}>
          {modalError && (
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
              {modalError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Input
              label="Category Name"
              placeholder="e.g. Beverages, Dairy, Snacks, Canned Goods"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              autoFocus
            />

            <Input
              label="Description / Aisle Note"
              placeholder="e.g. Aisle 3, Refrigerated cooler section"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {modalMode === "create" ? "Create Category" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, category: null, loading: false })}
        onConfirm={handleToggleStatus}
        title={confirmDialog.category?.is_active ? "Archive Category?" : "Reactivate Category?"}
        message={
          confirmDialog.category?.is_active
            ? `Archiving "${confirmDialog.category?.name}" will remove it from the POS quick filter.`
            : `Reactivating "${confirmDialog.category?.name}" will make it visible again.`
        }
        variant={confirmDialog.category?.is_active ? "danger" : "primary"}
        confirmText={confirmDialog.category?.is_active ? "Archive" : "Reactivate"}
        loading={confirmDialog.loading}
      />
    </div>
  );
};

export default CategoriesPage;
