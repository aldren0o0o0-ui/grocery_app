import { useState, useEffect, useCallback } from "react";
import useAuth from "../modules/auth/useAuth";
import { getUsersApi, createUserApi, setUserStatusApi } from "../modules/users/api";
import {
  PageHeader,
  Button,
  DataTable,
  StatusBadge,
  Modal,
  FormField,
  Input,
  Select,
  ConfirmDialog,
  Toast,
} from "../components/common";

export const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    role: "STAFF",
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  });

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    user: null,
    loading: false,
  });

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (roleFilter !== "ALL") params.role = roleFilter;
      if (statusFilter === "ACTIVE") params.is_active = true;
      if (statusFilter === "INACTIVE") params.is_active = false;
      if (search.trim()) params.search = search.trim();

      const data = await getUsersApi(params);
      const userList = data?.users || data?.data?.users || (Array.isArray(data) ? data : []);
      setUsers(userList);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || "Failed to load team users.");
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleOpenAddModal = () => {
    setFormData({
      role: "STAFF",
      first_name: "",
      last_name: "",
      email: "",
      password: "",
    });
    setFormError(null);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormError(null);
  };

  const handleSubmitUser = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.first_name.trim()) {
      setFormError("First name is required.");
      return;
    }
    if (!formData.last_name.trim()) {
      setFormError("Last name is required.");
      return;
    }
    if (!formData.email.trim()) {
      setFormError("Email address is required.");
      return;
    }
    if (!formData.password || formData.password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }

    try {
      setSubmitting(true);
      await createUserApi({
        role: formData.role,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });

      setToastMessage({
        type: "success",
        text: `User account for ${formData.first_name.trim()} created successfully.`,
      });
      handleCloseModal();
      fetchUsers();
    } catch (err) {
      setFormError(err.response?.data?.error?.message || err.response?.data?.message || "Failed to create user account.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatusClick = (targetUser) => {
    if (targetUser.id === currentUser?.id) {
      setToastMessage({
        type: "warning",
        text: "You cannot deactivate your own account.",
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      user: targetUser,
      loading: false,
    });
  };

  const handleConfirmToggleStatus = async () => {
    const targetUser = confirmDialog.user;
    if (!targetUser) return;

    setConfirmDialog((prev) => ({ ...prev, loading: true }));
    const newStatus = !targetUser.is_active;
    const action = newStatus ? "reactivated" : "deactivated";

    try {
      await setUserStatusApi(targetUser.id, newStatus);
      setToastMessage({
        type: "success",
        text: `Account for ${targetUser.first_name} ${targetUser.last_name} ${action}.`,
      });
      setConfirmDialog({ isOpen: false, user: null, loading: false });
      fetchUsers();
    } catch (err) {
      setToastMessage({
        type: "error",
        text: err.response?.data?.error?.message || "Failed to update user status.",
      });
      setConfirmDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const columns = [
    {
      header: "Team Member",
      accessor: (u) => {
        const isSelf = u.id === currentUser?.id;
        const initials = `${u.first_name?.[0] || ""}${u.last_name?.[0] || ""}`.toUpperCase();
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                backgroundColor: "var(--color-primary-soft)",
                color: "var(--color-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: "var(--color-text)", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>{u.first_name} {u.last_name}</span>
                {isSelf && (
                  <span style={{ fontSize: "10px", padding: "1px 6px", backgroundColor: "var(--color-primary-soft)", color: "var(--color-primary)", borderRadius: "var(--radius-full)", fontWeight: 700 }}>
                    You
                  </span>
                )}
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                {u.email}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: "Assigned Role",
      accessor: (u) => (
        <StatusBadge
          status={u.role}
          variant={u.role === "OWNER" ? "purple" : u.role === "STAFF" ? "neutral" : "success"}
        />
      ),
    },
    {
      header: "Status",
      accessor: (u) => (
        <StatusBadge
          status={u.is_active ? "Active" : "Inactive"}
          variant={u.is_active ? "success" : "danger"}
        />
      ),
    },
    {
      header: "Created",
      accessor: (u) => (
        <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
          {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      header: "Actions",
      align: "right",
      accessor: (u) => {
        const isSelf = u.id === currentUser?.id;
        return (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant={u.is_active ? "danger" : "secondary"}
              size="sm"
              disabled={isSelf}
              onClick={() => handleToggleStatusClick(u)}
              title={isSelf ? "Self-deactivation is prevented" : undefined}
            >
              {u.is_active ? "Deactivate" : "Reactivate"}
            </Button>
          </div>
        );
      },
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
        title="Team & User Management"
        subtitle="Manage staff accounts, assign operational roles, and enforce security policies."
        actions={
          <Button
            id="btn-add-user"
            variant="primary"
            size="md"
            onClick={handleOpenAddModal}
          >
            + Add Team Member
          </Button>
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
        <div style={{ flex: 1, minWidth: "220px" }}>
          <input
            type="text"
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
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
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="user-role-filter" style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
            Role:
          </label>
          <select
            id="user-role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
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
            <option value="ALL">All Roles</option>
            <option value="OWNER">Owner (Authority)</option>
            <option value="STAFF">Staff (Operations)</option>
            <option value="CASHIER">Cashier (POS & Sales)</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="user-status-filter" style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
            Status:
          </label>
          <select
            id="user-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
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

      {/* Users Table */}
      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        emptyTitle="No team members found"
        emptyMessage="There are no user accounts matching your search or filter criteria."
      />

      {/* Add User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Add New Team Member"
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

        <form onSubmit={handleSubmitUser}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <FormField label="First Name" required>
              <Input
                required
                placeholder="e.g. Maria"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              />
            </FormField>

            <FormField label="Last Name" required>
              <Input
                required
                placeholder="e.g. Santos"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label="Email Address" required>
            <Input
              type="email"
              required
              placeholder="e.g. maria.santos@grocery.local"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </FormField>

          <FormField label="Password" required helperText="Minimum 8 characters.">
            <div style={{ position: "relative" }}>
              <Input
                type={showPassword ? "text" : "password"}
                required
                placeholder="At least 8 characters..."
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                style={{ paddingRight: "60px" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "var(--color-text-secondary)",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </FormField>

          <FormField label="Operational Role" required helperText="OWNER is sole administrative authority. STAFF operates inventory & purchasing. CASHIER operates POS checkout.">
            <Select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="STAFF">STAFF — Inventory, Purchasing, Expenses</option>
              <option value="CASHIER">CASHIER — POS Terminal, Checkouts, Returns</option>
              <option value="OWNER">OWNER — Full Administrative Authority</option>
            </Select>
          </FormField>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button
              variant="secondary"
              size="md"
              onClick={handleCloseModal}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={submitting}
            >
              {submitting ? "Creating..." : "Create Account"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Deactivate / Reactivate Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.user?.is_active ? "Deactivate User Account" : "Reactivate User Account"}
        message={`Are you sure you want to ${
          confirmDialog.user?.is_active ? "deactivate" : "reactivate"
        } account for "${confirmDialog.user?.first_name} ${confirmDialog.user?.last_name}" (${confirmDialog.user?.email})?`}
        confirmLabel={confirmDialog.user?.is_active ? "Deactivate Account" : "Reactivate Account"}
        variant={confirmDialog.user?.is_active ? "danger" : "primary"}
        loading={confirmDialog.loading}
        onConfirm={handleConfirmToggleStatus}
        onCancel={() => setConfirmDialog({ isOpen: false, user: null, loading: false })}
      />
    </div>
  );
};

export default UsersPage;
