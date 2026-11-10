import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Filter,
  Package,
  Edit2,
  CheckCircle,
  XCircle,
  Barcode,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  getProductsApi,
  createProductApi,
  updateProductApi,
  setProductStatusApi,
} from "../api/products";
import { getCategoriesApi } from "../api/categories";
import {
  Button,
  Badge,
  Input,
  Select,
  Modal,
  Table,
  useToast,
  ConfirmDialog,
} from "../components/ui";

export const ProductsPage = () => {
  const { showToast } = useToast();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" | "edit"
  const [activeProduct, setActiveProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Form Fields
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    barcode: "",
    category_id: "",
    cost_price: "",
    selling_price: "",
    reorder_level: "10",
    description: "",
  });

  // Confirm Status Toggle Dialog
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    product: null,
    loading: false,
  });

  const fetchCategories = useCallback(async () => {
    try {
      const res = await getCategoriesApi({ is_active: true, per_page: 100 });
      const catList = res?.items || res?.categories || (Array.isArray(res) ? res : []);
      setCategories(catList);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (selectedCategory !== "ALL") params.category_id = selectedCategory;
      if (selectedStatus !== "ALL") params.is_active = selectedStatus === "ACTIVE";

      const res = await getProductsApi(params);
      const prodList = res?.items || res?.products || (Array.isArray(res) ? res : []);
      setProducts(prodList);
    } catch (err) {
      showToast(err.response?.data?.error?.message || "Failed to load products.", "error");
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, selectedStatus, showToast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const handleOpenCreate = () => {
    setModalMode("create");
    setActiveProduct(null);
    setFormData({
      name: "",
      sku: "",
      barcode: "",
      category_id: categories[0]?.id || "",
      cost_price: "",
      selling_price: "",
      reorder_level: "10",
      description: "",
    });
    setModalError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (prod) => {
    setModalMode("edit");
    setActiveProduct(prod);
    setFormData({
      name: prod.name || "",
      sku: prod.sku || "",
      barcode: prod.barcode || "",
      category_id: prod.category_id || "",
      cost_price: String(prod.cost_price || ""),
      selling_price: String(prod.selling_price || ""),
      reorder_level: String(prod.reorder_level || 10),
      description: prod.description || "",
    });
    setModalError("");
    setIsModalOpen(true);
  };

  const handleGenerateBarcode = () => {
    const randomBarcode = "880" + Math.floor(100000000 + Math.random() * 900000000);
    setFormData((prev) => ({ ...prev, barcode: randomBarcode }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setModalError("");

    if (!formData.name.trim() || !formData.selling_price) {
      setModalError("Product name and selling price are required.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        sku: formData.sku.trim() || undefined,
        barcode: formData.barcode.trim() || undefined,
        category_id: formData.category_id ? Number(formData.category_id) : null,
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : 0,
        selling_price: parseFloat(formData.selling_price),
        reorder_level: formData.reorder_level ? parseInt(formData.reorder_level) : 10,
        description: formData.description.trim() || undefined,
      };

      if (modalMode === "create") {
        await createProductApi(payload);
        showToast("Product added to catalog successfully.", "success");
      } else {
        await updateProductApi(activeProduct.id, payload);
        showToast("Product updated successfully.", "success");
      }

      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      setModalError(err.response?.data?.error?.message || "Failed to save product.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!confirmDialog.product) return;
    setConfirmDialog((prev) => ({ ...prev, loading: true }));

    try {
      const nextStatus = !confirmDialog.product.is_active;
      await setProductStatusApi(confirmDialog.product.id, nextStatus);
      showToast(
        `Product marked as ${nextStatus ? "Active" : "Archived/Inactive"}.`,
        "success"
      );
      setConfirmDialog({ isOpen: false, product: null, loading: false });
      fetchProducts();
    } catch (err) {
      showToast(err.response?.data?.error?.message || "Failed to update status.", "error");
      setConfirmDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "₱0.00";
    return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Page Header */}
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
            Product Catalog
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Maintain grocery inventory items, barcodes, pricing, and gross margins.
          </p>
        </div>

        <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
          Add New Product
        </Button>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "16px",
          backgroundColor: "#ffffff",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-xs)",
        }}
      >
        <div style={{ flex: 1, minWidth: "220px" }}>
          <Input
            placeholder="Search by name, SKU, or barcode..."
            icon={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ width: "200px" }}>
          <Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div style={{ width: "160px" }}>
          <Select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive / Archived</option>
          </Select>
        </div>
      </div>

      {/* Data Table */}
      <Table
        columns={[
          {
            header: "Product Details",
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
                    flexShrink: 0,
                  }}
                >
                  <Package size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{val}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    SKU: {row.sku || "N/A"} • Barcode: {row.barcode || "N/A"}
                  </div>
                </div>
              </div>
            ),
          },
          {
            header: "Category",
            key: "category",
            render: (_, row) => row.category?.name || row.category_name || "Uncategorized",
          },
          {
            header: "Cost Price",
            key: "cost_price",
            align: "right",
            render: (val) => (
              <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>
                {formatCurrency(val)}
              </span>
            ),
          },
          {
            header: "Selling Price",
            key: "selling_price",
            align: "right",
            render: (val) => (
              <span className="tabular-nums" style={{ fontWeight: 700, color: "var(--color-primary-700)" }}>
                {formatCurrency(val)}
              </span>
            ),
          },
          {
            header: "Stock Level",
            key: "stock_quantity",
            align: "center",
            render: (_, row) => {
              const stock = parseFloat(row.stock_quantity ?? row.current_stock ?? 0);
              const reorder = parseFloat(row.reorder_level || 10);
              const variant = stock <= 0 ? "danger" : stock <= reorder ? "warning" : "success";
              return (
                <Badge variant={variant} size="sm">
                  {stock} units
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
                  title="Edit Product"
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    setConfirmDialog({
                      isOpen: true,
                      product: row,
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
        data={products}
        loading={loading}
        emptyMessage="No products match your filters."
        emptyIcon={Package}
      />

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === "create" ? "Add New Grocery Product" : "Edit Product Details"}
        subtitle="Configure barcode, stock threshold, cost, and retail pricing."
        maxWidth="540px"
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
              label="Product Name"
              placeholder="e.g. San Miguel Pale Pilsen 330ml"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Input
                label="SKU Code"
                placeholder="e.g. BEV-SMPP-330"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              />

              <div>
                <Input
                  label="Barcode / EAN"
                  placeholder="e.g. 480001234567"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  suffix={
                    <button
                      type="button"
                      onClick={handleGenerateBarcode}
                      title="Auto-Generate Barcode"
                      style={{
                        color: "var(--color-primary-600)",
                        padding: "2px",
                        fontSize: "11px",
                        fontWeight: 600,
                      }}
                    >
                      Gen
                    </button>
                  }
                />
              </div>
            </div>

            <Select
              label="Product Category"
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Input
                label="Cost / Purchase Price (₱)"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
              />

              <Input
                label="Selling / Retail Price (₱)"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                required
              />
            </div>

            <Input
              label="Reorder / Low Stock Threshold"
              type="number"
              min="0"
              placeholder="10"
              value={formData.reorder_level}
              onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
              helperText="Alerts trigger when stock falls to or below this level."
            />

            <Input
              label="Item Description / Notes"
              placeholder="Optional description, supplier details, or packaging notes"
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
              {modalMode === "create" ? "Save Product" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Status Toggle */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, product: null, loading: false })}
        onConfirm={handleToggleStatus}
        title={confirmDialog.product?.is_active ? "Archive Product?" : "Reactivate Product?"}
        message={
          confirmDialog.product?.is_active
            ? `Archiving "${confirmDialog.product?.name}" will hide it from the POS terminal and catalog lookups.`
            : `Reactivating "${confirmDialog.product?.name}" will make it available for checkout again.`
        }
        variant={confirmDialog.product?.is_active ? "danger" : "primary"}
        confirmText={confirmDialog.product?.is_active ? "Yes, Archive" : "Yes, Reactivate"}
        loading={confirmDialog.loading}
      />
    </div>
  );
};

export default ProductsPage;
