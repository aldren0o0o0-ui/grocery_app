import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useAuth from "../modules/auth/useAuth";
import {
  getProductsApi,
  createProductApi,
  updateProductApi,
  setProductStatusApi,
} from "../modules/products/api";
import { getCategoriesApi } from "../modules/categories/api";
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
  Textarea,
  ConfirmDialog,
  Toast,
} from "../components/common";

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
  const [toastMessage, setToastMessage] = useState(null);
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

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    product: null,
    loading: false,
  });

  // Fetch active categories for dropdowns
  useEffect(() => {
    let ignore = false;
    const fetchCategoryList = async () => {
      try {
        const res = await getCategoriesApi({ is_active: true, per_page: 100 });
        if (!ignore) {
          const items = res?.data?.items || res?.items || (Array.isArray(res) ? res : []);
          setCategories(items);
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
          const items = res?.data?.items || res?.items || (Array.isArray(res) ? res : []);
          const pag = res?.data?.pagination || res?.pagination || {
            page: pagination.page,
            per_page: 10,
            total: items.length,
            pages: 1,
          };
          setProducts(items);
          setPagination(pag);
          setError("");
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
        setToastMessage({ type: "success", text: `Product "${payload.name}" created successfully.` });
      } else {
        await updateProductApi(selectedProduct.id, payload);
        setToastMessage({ type: "success", text: `Product "${payload.name}" updated successfully.` });
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

  const handleToggleStatusClick = (product) => {
    setConfirmDialog({
      isOpen: true,
      product,
      loading: false,
    });
  };

  const handleConfirmToggleStatus = async () => {
    const product = confirmDialog.product;
    if (!product) return;

    setConfirmDialog((prev) => ({ ...prev, loading: true }));
    const newStatus = !product.is_active;
    const action = newStatus ? "activated" : "deactivated";

    try {
      await setProductStatusApi(product.id, newStatus);
      setToastMessage({ type: "success", text: `Product "${product.name}" ${action}.` });
      setConfirmDialog({ isOpen: false, product: null, loading: false });
      setLoading(true);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setToastMessage({
        type: "error",
        text: err.response?.data?.message || `Failed to update product status.`,
      });
      setConfirmDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // DataTable columns definition
  const columns = [
    {
      header: "Product",
      accessor: (p) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--color-text)" }}>{p.name}</div>
          {p.description && (
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
              {p.description}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "SKU",
      accessor: (p) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-text-secondary)" }}>
          {p.sku}
        </span>
      ),
    },
    {
      header: "Barcode",
      accessor: (p) => (
        <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
          {p.barcode || "—"}
        </span>
      ),
    },
    {
      header: "Category",
      accessor: (p) => (
        <span
          style={{
            backgroundColor: "var(--color-bg)",
            border: "1px solid var(--color-border-subtle)",
            color: "var(--color-text)",
            padding: "2px 8px",
            borderRadius: "var(--radius-sm)",
            fontSize: "12px",
            fontWeight: 500,
          }}
        >
          {p.category?.name || "Uncategorized"}
        </span>
      ),
    },
    {
      header: "Unit",
      accessor: "unit",
    },
    {
      header: "Selling Price",
      align: "right",
      accessor: (p) => (
        <span style={{ fontWeight: 700, color: "var(--color-text)" }}>
          ${parseFloat(p.selling_price).toFixed(2)}
        </span>
      ),
    },
    {
      header: "Stock Qty",
      align: "right",
      accessor: (p) => (
        <span
          title="Stock is strictly read-only in Catalog management"
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            fontSize: "12px",
            color: Number(p.stock_quantity) > 0 ? "var(--color-success)" : "var(--color-text-muted)",
            backgroundColor: Number(p.stock_quantity) > 0 ? "var(--color-success-soft)" : "var(--color-bg)",
            padding: "2px 6px",
            borderRadius: "var(--radius-sm)",
          }}
        >
          {p.stock_quantity}
        </span>
      ),
    },
    {
      header: "Status",
      accessor: (p) => (
        <StatusBadge
          status={p.is_active ? "Active" : "Inactive"}
          variant={p.is_active ? "success" : "neutral"}
        />
      ),
    },
    {
      header: "Actions",
      align: "right",
      accessor: (p) =>
        canManage ? (
          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleOpenEdit(p)}
            >
              Edit
            </Button>
            <Button
              variant={p.is_active ? "danger" : "secondary"}
              size="sm"
              onClick={() => handleToggleStatusClick(p)}
            >
              {p.is_active ? "Deactivate" : "Activate"}
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
      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          type={toastMessage.type}
          message={toastMessage.text}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Page Header */}
      <PageHeader
        title="Product Catalog"
        subtitle="Manage master grocery products, SKU identifiers, categories, and pricing."
        actions={
          <div style={{ display: "flex", gap: "10px" }}>
            <Link
              to="/categories"
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
              Manage Categories
            </Link>
            {canManage && (
              <Button
                id="btn-add-product"
                variant="primary"
                size="md"
                onClick={handleOpenCreate}
              >
                + Add Product
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
            id="product-search-input"
            type="text"
            placeholder="Search by name, SKU, or barcode..."
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
            id="btn-product-search"
            variant="secondary"
            size="md"
          >
            Search
          </Button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="product-category-filter" style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
            Category:
          </label>
          <select
            id="product-category-filter"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
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
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="product-status-filter" style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
            Status:
          </label>
          <select
            id="product-status-filter"
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
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Error Notice */}
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

      {/* Products Table */}
      <DataTable
        columns={columns}
        data={products}
        loading={loading}
        emptyTitle="No products found"
        emptyMessage="There are no products matching your selected search or filter criteria."
        emptyAction={
          canManage && (
            <Button variant="primary" size="sm" onClick={handleOpenCreate}>
              + Add First Product
            </Button>
          )
        }
      />

      {/* Pagination */}
      {!loading && products.length > 0 && pagination.pages > 1 && (
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
        title={modalMode === "create" ? "Add New Product" : "Edit Product"}
        maxWidth="600px"
      >
        {/* Read-Only Stock Notice on Edit */}
        {modalMode === "edit" && (
          <div
            style={{
              padding: "10px 14px",
              backgroundColor: "var(--color-primary-soft)",
              border: "1px solid var(--color-primary)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-primary-hover)",
              fontSize: "13px",
              marginBottom: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Stock Quantity (Ledger Managed):</span>
            <strong style={{ fontFamily: "var(--font-mono)", fontSize: "14px" }}>
              {selectedProduct?.stock_quantity} {selectedProduct?.unit}
            </strong>
          </div>
        )}

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
          <FormField label="Product Name" required id="modal-product-name">
            <Input
              required
              placeholder="e.g. Organic Whole Milk"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </FormField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <FormField label="SKU" required id="modal-product-sku">
              <Input
                required
                placeholder="e.g. MILK-ORG-1L"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              />
            </FormField>

            <FormField label="Barcode (Optional)" id="modal-product-barcode">
              <Input
                placeholder="e.g. 7501031311309"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              />
            </FormField>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <FormField label="Category" required id="modal-product-category">
              <Select
                required
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Unit of Measure" required id="modal-product-unit">
              <Select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
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
              </Select>
            </FormField>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <FormField label="Cost Price ($)" required id="modal-product-cost-price">
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
              />
            </FormField>

            <FormField label="Selling Price ($)" required id="modal-product-selling-price">
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label="Reorder Level" id="modal-product-reorder-level">
            <Input
              type="number"
              step="0.001"
              min="0"
              placeholder="0.000"
              value={formData.reorder_level}
              onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
            />
          </FormField>

          <FormField label="Description (Optional)" id="modal-product-description">
            <Textarea
              rows={3}
              placeholder="Detailed description of the product..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </FormField>

          {modalMode === "edit" && (
            <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                id="modal-product-active"
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                style={{ width: "16px", height: "16px", accentColor: "var(--color-primary)", cursor: "pointer" }}
              />
              <label htmlFor="modal-product-active" style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)", cursor: "pointer" }}>
                Active product (visible in inventory and POS)
              </label>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button
              id="btn-modal-cancel"
              variant="secondary"
              size="md"
              onClick={handleCloseModal}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              id="btn-modal-save"
              type="submit"
              variant="primary"
              size="md"
              loading={submitting}
            >
              {submitting ? "Saving..." : modalMode === "create" ? "Create Product" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Deactivate / Activate Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.product?.is_active ? "Deactivate Product" : "Activate Product"}
        message={`Are you sure you want to ${
          confirmDialog.product?.is_active ? "deactivate" : "activate"
        } "${confirmDialog.product?.name}"? ${
          confirmDialog.product?.is_active
            ? "Deactivated products will not appear in the POS catalog for sales."
            : "Activated products will be available for new transactions."
        }`}
        confirmLabel={confirmDialog.product?.is_active ? "Deactivate" : "Activate"}
        variant={confirmDialog.product?.is_active ? "danger" : "primary"}
        loading={confirmDialog.loading}
        onConfirm={handleConfirmToggleStatus}
        onCancel={() => setConfirmDialog({ isOpen: false, product: null, loading: false })}
      />
    </div>
  );
};

export default ProductsPage;
