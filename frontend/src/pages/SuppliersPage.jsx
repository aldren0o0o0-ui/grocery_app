import { useState, useEffect } from "react";
import useAuth from "../modules/auth/useAuth";
import {
  getSuppliersApi,
  createSupplierApi,
  updateSupplierApi,
  setSupplierStatusApi,
} from "../modules/suppliers/api";
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

export const SuppliersPage = () => {
  const { user } = useAuth();
  const canManage = user?.role === "OWNER";

  const [suppliers, setSuppliers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 1 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" | "edit"
  const [selectedId, setSelectedId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    supplier: null,
    loading: false,
  });

  // Load suppliers
  useEffect(() => {
    let ignore = false;
    const fetchSuppliers = async () => {
      try {
        const params = {
          page: pagination.page,
          per_page: 20,
        };
        if (search.trim()) params.search = search.trim();
        if (statusFilter === "active") params.is_active = true;
        if (statusFilter === "inactive") params.is_active = false;

        const res = await getSuppliersApi(params);
        if (!ignore) {
          const items = res?.data?.items || res?.items || (Array.isArray(res) ? res : []);
          const pag = res?.data?.pagination || res?.pagination || {
            page: pagination.page,
            per_page: 20,
            total: items.length,
            pages: 1,
          };
          setSuppliers(items);
          setPagination(pag);
          setError("");
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.message || err.message || "Network error loading suppliers.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchSuppliers();
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

  const handleOpenCreate = () => {
    setModalMode("create");
    setSelectedId(null);
    setFormData({
      name: "",
      contact_person: "",
      phone: "",
      email: "",
      address: "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (supplier) => {
    setModalMode("edit");
    setSelectedId(supplier.id);
    setFormData({
      name: supplier.name || "",
      contact_person: supplier.contact_person || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedId(null);
    setFormError("");
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Supplier name is required.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    const payload = {
      name: formData.name.trim(),
      contact_person: formData.contact_person?.trim() || null,
      phone: formData.phone?.trim() || null,
      email: formData.email?.trim() ? formData.email.trim().toLowerCase() : null,
      address: formData.address?.trim() || null,
    };

    try {
      if (modalMode === "create") {
        await createSupplierApi(payload);
        setToastMessage({ type: "success", text: `Supplier "${payload.name}" created successfully.` });
      } else {
        await updateSupplierApi(selectedId, payload);
        setToastMessage({ type: "success", text: `Supplier "${payload.name}" updated successfully.` });
      }
      setIsModalOpen(false);
      setLoading(true);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || "Failed to save supplier.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatusClick = (supplier) => {
    setConfirmDialog({
      isOpen: true,
      supplier,
      loading: false,
    });
  };

  const handleConfirmToggleStatus = async () => {
    const supplier = confirmDialog.supplier;
    if (!supplier) return;

    setConfirmDialog((prev) => ({ ...prev, loading: true }));
    const newStatus = !supplier.is_active;
    const action = newStatus ? "activated" : "deactivated";

    try {
      await setSupplierStatusApi(supplier.id, newStatus);
      setToastMessage({ type: "success", text: `Supplier "${supplier.name}" ${action}.` });
      setConfirmDialog({ isOpen: false, supplier: null, loading: false });
      setLoading(true);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setToastMessage({
        type: "error",
        text: err.response?.data?.message || `Failed to update supplier status.`,
      });
      setConfirmDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const columns = [
    {
      header: "Supplier Name",
      accessor: (s) => (
        <div style={{ fontWeight: 600, color: "var(--color-text)" }}>{s.name}</div>
      ),
    },
    {
      header: "Contact Person",
      accessor: (s) => (
        <span style={{ color: "var(--color-text-secondary)", fontSize: "13px" }}>
          {s.contact_person || "—"}
        </span>
      ),
    },
    {
      header: "Phone",
      accessor: (s) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-text)" }}>
          {s.phone || "—"}
        </span>
      ),
    },
    {
      header: "Email",
      accessor: (s) => (
        <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
          {s.email || "—"}
        </span>
      ),
    },
    {
      header: "Address",
      accessor: (s) => (
        <span style={{ fontSize: "12px", color: "var(--color-text-muted)", maxWidth: "200px" }}>
          {s.address || "—"}
        </span>
      ),
    },
    {
      header: "Status",
      accessor: (s) => (
        <StatusBadge
          status={s.is_active ? "Active" : "Inactive"}
          variant={s.is_active ? "success" : "neutral"}
        />
      ),
    },
    {
      header: "Actions",
      align: "right",
      accessor: (s) =>
        canManage ? (
          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleOpenEdit(s)}
            >
              Edit
            </Button>
            <Button
              variant={s.is_active ? "danger" : "secondary"}
              size="sm"
              onClick={() => handleToggleStatusClick(s)}
            >
              {s.is_active ? "Deactivate" : "Activate"}
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
        title="Supplier Directory"
        subtitle="Maintain vendor partner profiles, contact info, and purchasing integration."
        actions={
          canManage && (
            <Button
              id="btn-add-supplier"
              variant="primary"
              size="md"
              onClick={handleOpenCreate}
            >
              + Add Supplier
            </Button>
          )
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
            id="supplier-search-input"
            type="text"
            placeholder="Search supplier name, contact, phone, email..."
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
            id="btn-supplier-search"
            variant="secondary"
            size="md"
          >
            Search
          </Button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="supplier-status-filter" style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
            Status:
          </label>
          <select
            id="supplier-status-filter"
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

      {/* Suppliers Table */}
      <DataTable
        columns={columns}
        data={suppliers}
        loading={loading}
        emptyTitle="No suppliers found"
        emptyMessage="There are no suppliers matching your search or filter criteria."
        emptyAction={
          canManage && (
            <Button variant="primary" size="sm" onClick={handleOpenCreate}>
              + Add First Supplier
            </Button>
          )
        }
      />

      {/* Pagination */}
      {!loading && suppliers.length > 0 && pagination.pages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.pages}
          totalItems={pagination.total}
          onPageChange={(p) => {
            setPagination((prev) => ({ ...prev, page: p }));
            setLoading(true);
          }}
        />
      )}

      {/* Modal Dialog for Create/Edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={modalMode === "create" ? "Add New Supplier" : "Edit Supplier"}
        maxWidth="520px"
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
          <FormField label="Supplier Name" required id="modal-supplier-name">
            <Input
              required
              placeholder="e.g. Fresh Valley Farms Inc."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </FormField>

          <FormField label="Contact Person (Optional)" id="modal-supplier-contact">
            <Input
              placeholder="e.g. Maria Santos"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
            />
          </FormField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <FormField label="Phone (Optional)" id="modal-supplier-phone">
              <Input
                placeholder="e.g. +63 917 123 4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </FormField>

            <FormField label="Email (Optional)" id="modal-supplier-email">
              <Input
                type="email"
                placeholder="e.g. sales@freshvalley.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label="Business Address (Optional)" id="modal-supplier-address">
            <Textarea
              rows={3}
              placeholder="e.g. Building 4, Food Terminal Complex, Taguig City"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </FormField>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button
              id="btn-supplier-cancel"
              variant="secondary"
              size="md"
              onClick={handleCloseModal}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              id="btn-supplier-save"
              type="submit"
              variant="primary"
              size="md"
              loading={submitting}
            >
              {submitting ? "Saving..." : modalMode === "create" ? "Create Supplier" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Deactivate / Activate Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.supplier?.is_active ? "Deactivate Supplier" : "Activate Supplier"}
        message={`Are you sure you want to ${
          confirmDialog.supplier?.is_active ? "deactivate" : "activate"
        } "${confirmDialog.supplier?.name}"?`}
        confirmLabel={confirmDialog.supplier?.is_active ? "Deactivate" : "Activate"}
        variant={confirmDialog.supplier?.is_active ? "danger" : "primary"}
        loading={confirmDialog.loading}
        onConfirm={handleConfirmToggleStatus}
        onCancel={() => setConfirmDialog({ isOpen: false, supplier: null, loading: false })}
      />
    </div>
  );
};

export default SuppliersPage;
