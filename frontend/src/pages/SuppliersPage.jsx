import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import useAuth from "../modules/auth/useAuth";
import {
  getSuppliersApi,
  createSupplierApi,
  updateSupplierApi,
  setSupplierStatusApi,
} from "../modules/suppliers/api";

export const SuppliersPage = () => {
  const { user } = useAuth();
  const canManage = user?.role === "OWNER";

  const [suppliers, setSuppliers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 1 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
          if (res.status === "success") {
            setSuppliers(res.data.items || []);
            setPagination(res.data.pagination || { page: 1, per_page: 20, total: 0, pages: 1 });
          } else {
            setError(res.message || "Failed to load suppliers.");
          }
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
      email: formData.email?.trim() || null,
      address: formData.address?.trim() || null,
    };

    try {
      if (modalMode === "create") {
        await createSupplierApi(payload);
      } else {
        await updateSupplierApi(selectedId, payload);
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

  const handleToggleStatus = async (supplier) => {
    const action = supplier.is_active ? "deactivate" : "activate";
    const confirmMessage = supplier.is_active
      ? `Deactivate "${supplier.name}"? It will no longer be available for new purchases. Historical records remain unaffected.`
      : `Reactivate "${supplier.name}" for purchases?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await setSupplierStatusApi(supplier.id, !supplier.is_active);
      setLoading(true);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      alert(err.response?.data?.message || `Failed to ${action} supplier.`);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Navbar />

      <main style={{ maxWidth: "1280px", margin: "2rem auto", padding: "0 1.5rem" }}>
        {/* Header section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>
              Supplier Management
            </h1>
            <p style={{ color: "#64748b", margin: "0.25rem 0 0 0", fontSize: "0.875rem" }}>
              Maintain authorized supplier identities, vendor contacts, and purchasing status.
            </p>
          </div>
          {canManage && (
            <button
              id="btn-add-supplier"
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
              + Add Supplier
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
              id="supplier-search-input"
              type="text"
              placeholder="Search by supplier name, contact, phone, or email..."
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
              id="btn-supplier-search"
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
              id="supplier-status-filter"
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
              <option value="all">All Suppliers</option>
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

        {/* Suppliers Table */}
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
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600" }}>Supplier Name</th>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600" }}>Contact Person</th>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600" }}>Phone</th>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600" }}>Email</th>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600" }}>Status</th>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600", textAlign: "center" }}>
                  Purchases
                </th>
                <th style={{ padding: "0.875rem 1rem", color: "#475569", fontWeight: "600", textAlign: "right" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: "2.5rem", textAlign: "center", color: "#64748b" }}>
                    Loading suppliers...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "2.5rem", textAlign: "center", color: "#64748b" }}>
                    No suppliers found matching criteria.
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <div style={{ fontWeight: "600", color: "#1e293b" }}>{s.name}</div>
                      {s.address && (
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.15rem" }}>
                          {s.address}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "0.875rem 1rem", color: "#334155" }}>
                      {s.contact_person || "—"}
                    </td>
                    <td style={{ padding: "0.875rem 1rem", fontFamily: "monospace", color: "#475569" }}>
                      {s.phone || "—"}
                    </td>
                    <td style={{ padding: "0.875rem 1rem", color: "#2563eb", fontSize: "0.8125rem" }}>
                      {s.email || "—"}
                    </td>
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.2rem 0.55rem",
                          borderRadius: "9999px",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          backgroundColor: s.is_active ? "#dcfce7" : "#f1f5f9",
                          color: s.is_active ? "#15803d" : "#64748b",
                        }}
                      >
                        {s.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "0.875rem 1rem", textAlign: "center", color: "#475569" }}>
                      <span
                        style={{
                          backgroundColor: "#f1f5f9",
                          padding: "0.15rem 0.45rem",
                          borderRadius: "4px",
                          fontFamily: "monospace",
                          fontSize: "0.75rem",
                        }}
                      >
                        {s.purchase_count ?? 0}
                      </span>
                    </td>
                    <td style={{ padding: "0.875rem 1rem", textAlign: "right" }}>
                      {canManage ? (
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                          <button
                            id={`btn-edit-supplier-${s.id}`}
                            onClick={() => handleOpenEdit(s)}
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
                            id={`btn-status-supplier-${s.id}`}
                            onClick={() => handleToggleStatus(s)}
                            style={{
                              padding: "0.35rem 0.75rem",
                              backgroundColor: s.is_active ? "#fef2f2" : "#f0fdf4",
                              border: s.is_active ? "1px solid #fecaca" : "1px solid #bbf7d0",
                              borderRadius: "6px",
                              fontSize: "0.75rem",
                              fontWeight: "600",
                              color: s.is_active ? "#dc2626" : "#16a34a",
                              cursor: "pointer",
                            }}
                          >
                            {s.is_active ? "Deactivate" : "Activate"}
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
              Showing {suppliers.length} of {pagination.total} suppliers
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                disabled={pagination.page <= 1}
                onClick={() => {
                  setPagination((prev) => ({ ...prev, page: prev.page - 1 }));
                  setLoading(true);
                }}
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
                onClick={() => {
                  setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
                  setLoading(true);
                }}
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

      {/* Add / Edit Supplier Modal */}
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
              maxWidth: "520px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#0f172a", marginTop: 0, marginBottom: "1rem" }}>
              {modalMode === "create" ? "Add New Supplier" : "Edit Supplier Profile"}
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
                  Supplier Name *
                </label>
                <input
                  id="modal-supplier-name"
                  type="text"
                  required
                  placeholder="e.g. San Miguel Foods Inc."
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
                    Contact Person
                  </label>
                  <input
                    id="modal-supplier-contact"
                    type="text"
                    placeholder="e.g. Juan Dela Cruz"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
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
                    Phone Number
                  </label>
                  <input
                    id="modal-supplier-phone"
                    type="text"
                    placeholder="e.g. +63 2 8632 3000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                  Email Address
                </label>
                <input
                  id="modal-supplier-email"
                  type="email"
                  placeholder="e.g. orders@supplier.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.25rem" }}>
                  Physical / Billing Address
                </label>
                <textarea
                  id="modal-supplier-address"
                  rows={2}
                  placeholder="Street, City, Province / Postal..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
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
                  id="btn-modal-supplier-submit"
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
                  {submitting ? "Saving..." : modalMode === "create" ? "Create Supplier" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersPage;
