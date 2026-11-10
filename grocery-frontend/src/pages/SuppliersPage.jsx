import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Truck, Edit2, Phone, Mail, MapPin } from "lucide-react";
import {
  getSuppliersApi,
  createSupplierApi,
  updateSupplierApi,
  setSupplierStatusApi,
} from "../api/suppliers";
import {
  Button,
  Badge,
  Input,
  Modal,
  Table,
  useToast,
  ConfirmDialog,
} from "../components/ui";

export const SuppliersPage = () => {
  const { showToast } = useToast();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [activeSupplier, setActiveSupplier] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Confirm Status Dialog
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    supplier: null,
    loading: false,
  });

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      const res = await getSuppliersApi(params);
      const supList = res?.items || res?.suppliers || (Array.isArray(res) ? res : []);
      setSuppliers(supList);
    } catch (err) {
      showToast(err.response?.data?.error?.message || "Failed to load suppliers.", "error");
    } finally {
      setLoading(false);
    }
  }, [search, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuppliers();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchSuppliers]);

  const handleOpenCreate = () => {
    setModalMode("create");
    setActiveSupplier(null);
    setFormData({
      name: "",
      contact_person: "",
      phone: "",
      email: "",
      address: "",
    });
    setModalError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sup) => {
    setModalMode("edit");
    setActiveSupplier(sup);
    setFormData({
      name: sup.name || "",
      contact_person: sup.contact_person || "",
      phone: sup.phone || "",
      email: sup.email || "",
      address: sup.address || "",
    });
    setModalError("");
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setModalError("");

    if (!formData.name.trim()) {
      setModalError("Supplier / Vendor name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        contact_person: formData.contact_person.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
      };

      if (modalMode === "create") {
        await createSupplierApi(payload);
        showToast("Supplier registered successfully.", "success");
      } else {
        await updateSupplierApi(activeSupplier.id, payload);
        showToast("Supplier details updated.", "success");
      }

      setIsModalOpen(false);
      fetchSuppliers();
    } catch (err) {
      setModalError(err.response?.data?.error?.message || "Failed to save supplier.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!confirmDialog.supplier) return;
    setConfirmDialog((prev) => ({ ...prev, loading: true }));

    try {
      const nextStatus = !confirmDialog.supplier.is_active;
      await setSupplierStatusApi(confirmDialog.supplier.id, nextStatus);
      showToast(
        `Supplier marked as ${nextStatus ? "Active" : "Archived"}.`,
        "success"
      );
      setConfirmDialog({ isOpen: false, supplier: null, loading: false });
      fetchSuppliers();
    } catch (err) {
      showToast(err.response?.data?.error?.message || "Failed to update supplier status.", "error");
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
            Vendor & Supplier Directory
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Maintain merchant distributors, delivery representatives, and wholesale procurement contacts.
          </p>
        </div>

        <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
          Add Supplier
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
        <div style={{ flex: 1, maxWidth: "380px" }}>
          <Input
            placeholder="Search suppliers by company or contact person..."
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
            header: "Company Name",
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
                  <Truck size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{val}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {row.address || "No address provided"}
                  </div>
                </div>
              </div>
            ),
          },
          {
            header: "Contact Person",
            key: "contact_person",
            render: (val) => val || "-",
          },
          {
            header: "Phone",
            key: "phone",
            render: (val) => (val ? <span style={{ fontWeight: 500 }}>{val}</span> : "-"),
          },
          {
            header: "Email",
            key: "email",
            render: (val) => val || "-",
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
                      supplier: row,
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
        data={suppliers}
        loading={loading}
        emptyMessage="No suppliers registered yet."
        emptyIcon={Truck}
      />

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === "create" ? "Add New Supplier" : "Edit Supplier Details"}
        subtitle="Wholesale distributor and goods delivery contact information."
        maxWidth="500px"
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
              label="Company / Vendor Name"
              placeholder="e.g. Universal Robina Corporation / Nestle PH"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              autoFocus
            />

            <Input
              label="Contact Representative"
              placeholder="e.g. Maria Santos (Account Rep)"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Input
                label="Phone / Mobile"
                placeholder="e.g. 0917-123-4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />

              <Input
                label="Email Address"
                type="email"
                placeholder="e.g. sales@vendor.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <Input
              label="Warehouse / Delivery Address"
              placeholder="e.g. Pasig Logistics Hub, Warehouse 4"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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
              {modalMode === "create" ? "Save Supplier" : "Update Details"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Status Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, supplier: null, loading: false })}
        onConfirm={handleToggleStatus}
        title={confirmDialog.supplier?.is_active ? "Archive Supplier?" : "Reactivate Supplier?"}
        message={
          confirmDialog.supplier?.is_active
            ? `Archiving "${confirmDialog.supplier?.name}" will hide them from the new purchase order dropdown.`
            : `Reactivating "${confirmDialog.supplier?.name}" will make them available for purchase orders.`
        }
        variant={confirmDialog.supplier?.is_active ? "danger" : "primary"}
        confirmText={confirmDialog.supplier?.is_active ? "Archive" : "Reactivate"}
        loading={confirmDialog.loading}
      />
    </div>
  );
};

export default SuppliersPage;
