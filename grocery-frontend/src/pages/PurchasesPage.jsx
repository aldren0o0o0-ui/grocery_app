import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Truck,
  Plus,
  Search,
  FileText,
  ArrowRight,
} from "lucide-react";
import { getPurchasesApi, createPurchaseApi } from "../api/purchasing";
import { getSuppliersApi } from "../api/suppliers";
import {
  Button,
  Badge,
  Input,
  Select,
  Modal,
  Table,
  useToast,
} from "../components/ui";

export const PurchasesPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // Create PO Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const res = await getPurchasesApi(params);
      const poList = res?.items || res?.purchases || (Array.isArray(res) ? res : []);
      setPurchases(poList);
    } catch (err) {
      showToast(err.response?.data?.error?.message || "Failed to load purchases.", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, showToast]);

  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const res = await getSuppliersApi({ is_active: true, per_page: 100 });
        const supList = res?.items || res?.suppliers || (Array.isArray(res) ? res : []);
        setSuppliers(supList);
      } catch (err) {
        console.error("Failed to load suppliers:", err);
      }
    };
    loadSuppliers();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPurchases();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchPurchases]);

  const handleOpenCreate = () => {
    setSupplierId(suppliers[0]?.id || "");
    const randomRef = "PO-" + Math.floor(100000 + Math.random() * 900000);
    setRefNumber(randomRef);
    setPurchaseDate(new Date().toISOString().split("T")[0]);
    setCreateError("");
    setIsModalOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError("");

    if (!supplierId) {
      setCreateError("Please select a supplier.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createPurchaseApi({
        supplier_id: Number(supplierId),
        reference_number: refNumber.trim() || undefined,
        purchase_date: purchaseDate,
        items: [],
      });

      showToast("Purchase Order created in Draft status.", "success");
      setIsModalOpen(false);
      const newId = res.purchase?.id || res.id;
      if (newId) {
        navigate(`/purchases/${newId}`);
      } else {
        fetchPurchases();
      }
    } catch (err) {
      setCreateError(err.response?.data?.error?.message || "Failed to create purchase order.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "₱0.00";
    return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const statusVariants = {
    DRAFT: "warning",
    RECEIVED: "success",
    CANCELLED: "danger",
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
            Stock-In Purchases & Procurement
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Create purchase orders, track vendor deliveries, and execute atomic stock-in reception.
          </p>
        </div>

        <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
          Create Purchase Order
        </Button>
      </div>

      {/* Filter and Tab Bar */}
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
            placeholder="Search PO reference # or supplier..."
            icon={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status Tabs */}
        <div style={{ display: "flex", gap: "6px" }}>
          {["ALL", "DRAFT", "RECEIVED", "CANCELLED"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              style={{
                padding: "8px 14px",
                borderRadius: "var(--radius-md)",
                fontSize: "12.5px",
                fontWeight: 600,
                backgroundColor:
                  statusFilter === st ? "var(--color-primary-600)" : "var(--color-slate-100)",
                color: statusFilter === st ? "#ffffff" : "var(--color-slate-700)",
                border: "1px solid",
                borderColor:
                  statusFilter === st ? "var(--color-primary-700)" : "var(--color-slate-200)",
                cursor: "pointer",
                transition: "all var(--transition-fast)",
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Table
        columns={[
          {
            header: "PO Reference #",
            key: "reference_number",
            render: (val, row) => (
              <Link
                to={`/purchases/${row.id}`}
                style={{
                  fontWeight: 700,
                  color: "var(--color-primary-700)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FileText size={16} />
                {val || `PO-#${row.id}`}
              </Link>
            ),
          },
          {
            header: "Supplier",
            key: "supplier_name",
            render: (val) => val || "Vendor",
          },
          {
            header: "Purchase Date",
            key: "purchase_date",
            render: (val) => val || "-",
          },
          {
            header: "Line Items",
            key: "items_count",
            align: "center",
            render: (val, row) => (
              <span style={{ fontSize: "13px", fontWeight: 500 }}>
                {val || (row.items ? row.items.length : 0)} items
              </span>
            ),
          },
          {
            header: "Total Cost",
            key: "total_amount",
            align: "right",
            render: (val) => (
              <span className="tabular-nums" style={{ fontWeight: 700, color: "var(--text-main)" }}>
                {formatCurrency(val)}
              </span>
            ),
          },
          {
            header: "Status",
            key: "status",
            align: "center",
            render: (val) => (
              <Badge variant={statusVariants[val] || "neutral"} size="sm">
                {val || "DRAFT"}
              </Badge>
            ),
          },
          {
            header: "Action",
            key: "actions",
            align: "right",
            render: (_, row) => (
              <Link to={`/purchases/${row.id}`}>
                <Button variant="ghost" size="xs" iconRight={ArrowRight}>
                  View / Manage
                </Button>
              </Link>
            ),
          },
        ]}
        data={purchases}
        loading={loading}
        emptyMessage="No purchase orders found."
        emptyIcon={Truck}
      />

      {/* Create PO Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Purchase Order"
        subtitle="Initialize a draft order to add vendor products before stock-in."
        maxWidth="480px"
      >
        <form onSubmit={handleCreateSubmit}>
          {createError && (
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
              {createError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Select
              label="Supplier Vendor"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              required
            >
              <option value="">Select a supplier vendor</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.contact_person || "Contact"})
                </option>
              ))}
            </Select>

            <Input
              label="PO Reference Number"
              placeholder="e.g. PO-892110"
              value={refNumber}
              onChange={(e) => setRefNumber(e.target.value)}
              required
            />

            <Input
              label="Purchase / Delivery Date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
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
              Create Draft PO
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PurchasesPage;
