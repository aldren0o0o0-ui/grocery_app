import { useState, useEffect, useCallback } from "react";
import useAuth from "../context/AuthContext";
import {
  Users,
  UserPlus,
  Search,
  Shield,
  CheckCircle,
  XCircle,
  KeyRound,
  ShieldCheck,
  Edit2,
  UserCheck,
  Mail,
  Sparkles,
} from "lucide-react";
import {
  getUsersApi,
  createUserApi,
  setUserStatusApi,
  updateUserProfileApi,
} from "../api/users";
import { registerBaseUsers, getUserOverrides } from "../utils/userResolver";
import {
  Button,
  Badge,
  Input,
  Select,
  Modal,
  Table,
  Card,
  useToast,
  ConfirmDialog,
} from "../components/ui";

export const UsersPage = () => {
  const { user: currentUser, changePassword, updateUserProfile } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  // Create User Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "CASHIER",
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Edit Profile Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "STAFF",
    current_password: "",
    new_password: "",
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  // Status Dialog
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    targetUser: null,
    loading: false,
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (roleFilter !== "ALL") params.role = roleFilter;

      const res = await getUsersApi(params);
      const userList = res.users || res.items || (Array.isArray(res) ? res : []);

      // Register base user names for alias mapping
      registerBaseUsers(userList);

      const overrides = getUserOverrides();
      const mergedUsers = userList.map((u) => {
        const ov = overrides[u.id];
        return ov ? { ...u, ...ov } : u;
      });

      setUsers(mergedUsers);
    } catch (err) {
      showToast(err.response?.data?.error?.message || "Failed to load users list.", "error");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleOpenCreate = () => {
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      role: "CASHIER",
    });
    setModalError("");
    setIsModalOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setModalError("");

    if (!formData.first_name || !formData.email || !formData.password) {
      setModalError("First name, email, and password are required.");
      return;
    }

    if (formData.password.length < 6) {
      setModalError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await createUserApi({
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim() || undefined,
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
      });

      showToast(`User account created for ${formData.first_name}.`, "success");
      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      setModalError(err.response?.data?.error?.message || "Failed to create user account.");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Profile modal
  const handleOpenEditProfile = (u) => {
    setEditingUser(u);
    setEditFormData({
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      email: u.email || "",
      role: u.role || "STAFF",
      current_password: "",
      new_password: "",
    });
    setEditError("");
    setIsEditModalOpen(true);
  };

  const handleEditProfileSubmit = async (e) => {
    e.preventDefault();
    setEditError("");

    if (!editFormData.first_name.trim()) {
      setEditError("First name is required.");
      return;
    }

    setEditSubmitting(true);
    try {
      // If updating own password
      if (
        editingUser.id === currentUser?.id &&
        editFormData.new_password.trim()
      ) {
        if (!editFormData.current_password) {
          setEditError("Current password is required to set a new password.");
          setEditSubmitting(false);
          return;
        }
        await changePassword(
          editFormData.current_password,
          editFormData.new_password
        );
      }

      const updatedFields = {
        first_name: editFormData.first_name.trim(),
        last_name: editFormData.last_name.trim(),
        email: editFormData.email.trim(),
        role: editFormData.role,
      };

      const originalName = `${editingUser.first_name || ""} ${editingUser.last_name || ""}`.trim();

      if (updateUserProfile) {
        await updateUserProfile(editingUser.id, updatedFields, originalName);
      } else {
        await updateUserProfileApi(editingUser.id, updatedFields);
      }

      // Update local state for immediate reactivity
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, ...updatedFields }
            : u
        )
      );

      showToast(
        `Profile updated for ${editFormData.first_name}.`,
        "success"
      );
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (err) {
      setEditError(
        err.response?.data?.error?.message ||
          "Failed to update profile. Please check credentials."
      );
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!confirmDialog.targetUser) return;
    setConfirmDialog((prev) => ({ ...prev, loading: true }));

    try {
      const nextStatus = !confirmDialog.targetUser.is_active;
      await setUserStatusApi(confirmDialog.targetUser.id, nextStatus);
      showToast(
        `User ${confirmDialog.targetUser.email} marked as ${nextStatus ? "Active" : "Inactive"}.`,
        "success"
      );
      setConfirmDialog({ isOpen: false, targetUser: null, loading: false });
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.error?.message || "Failed to update user status.", "error");
      setConfirmDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const roleColors = {
    OWNER: "purple",
    STAFF: "info",
    CASHIER: "success",
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
            Team & Staff Management
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Provision staff accounts, edit employee profiles, and manage system access privileges.
          </p>
        </div>

        <Button variant="primary" icon={UserPlus} onClick={handleOpenCreate}>
          Provision User Account
        </Button>
      </div>

      {/* Current User Quick Profile Banner */}
      {currentUser && (
        <Card padding="20px">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  backgroundColor: "var(--color-primary-600)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "18px",
                  boxShadow: "0 2px 8px rgba(5, 150, 105, 0.3)",
                }}
              >
                {currentUser.first_name?.[0]}
                {currentUser.last_name?.[0] || ""}
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "var(--text-main)",
                      margin: 0,
                    }}
                  >
                    {currentUser.first_name} {currentUser.last_name}
                  </h3>
                  <Badge variant={roleColors[currentUser.role] || "neutral"} size="sm">
                    {currentUser.role}
                  </Badge>
                  <span
                    style={{
                      fontSize: "11px",
                      padding: "2px 6px",
                      backgroundColor: "var(--color-primary-50)",
                      color: "var(--color-primary-700)",
                      borderRadius: "var(--radius-xs)",
                      fontWeight: 600,
                    }}
                  >
                    Logged In
                  </span>
                </div>

                <div
                  style={{
                    fontSize: "12.5px",
                    color: "var(--text-muted)",
                    marginTop: "2px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Mail size={13} />
                  <span>{currentUser.email}</span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={Edit2}
              onClick={() => handleOpenEditProfile(currentUser)}
            >
              Edit My Profile
            </Button>
          </div>
        </Card>
      )}

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
            placeholder="Search team members by name or email..."
            icon={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ width: "180px" }}>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="ALL">All Roles</option>
            <option value="OWNER">Owners Only</option>
            <option value="CASHIER">Cashiers Only</option>
            <option value="STAFF">Staff Members Only</option>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Table
        columns={[
          {
            header: "User / Employee",
            key: "first_name",
            render: (_, row) => (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundColor: "var(--color-primary-50)",
                    color: "var(--color-primary-700)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "13px",
                  }}
                >
                  {row.first_name?.[0]}
                  {row.last_name?.[0] || ""}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                    {row.first_name} {row.last_name}
                    {row.id === currentUser?.id && (
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--color-primary-600)",
                          marginLeft: "6px",
                          fontWeight: 700,
                        }}
                      >
                        (You)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{row.email}</div>
                </div>
              </div>
            ),
          },
          {
            header: "Role Access",
            key: "role",
            align: "center",
            render: (val) => (
              <Badge variant={roleColors[val] || "neutral"} size="sm">
                {val}
              </Badge>
            ),
          },
          {
            header: "Account Status",
            key: "is_active",
            align: "center",
            render: (val) => (
              <Badge variant={val ? "success" : "neutral"} size="sm" dot>
                {val ? "Active" : "Disabled"}
              </Badge>
            ),
          },
          {
            header: "Created Date",
            key: "created_at",
            render: (val) => (val ? new Date(val).toLocaleDateString() : "-"),
          },
          {
            header: "Actions",
            key: "actions",
            align: "right",
            render: (_, row) => {
              const isSelf = row.id === currentUser?.id;
              return (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                  <Button
                    variant="ghost"
                    size="xs"
                    icon={Edit2}
                    onClick={() => handleOpenEditProfile(row)}
                  >
                    Edit Profile
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={isSelf}
                    onClick={() =>
                      setConfirmDialog({
                        isOpen: true,
                        targetUser: row,
                        loading: false,
                      })
                    }
                    style={{
                      color: row.is_active ? "var(--color-danger)" : "var(--color-primary-600)",
                    }}
                  >
                    {row.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              );
            },
          },
        ]}
        data={users}
        loading={loading}
        emptyMessage="No team accounts found."
        emptyIcon={Users}
      />

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Team Member Profile"
        subtitle={`Profile configuration for ${editingUser?.email}`}
        maxWidth="500px"
      >
        <form onSubmit={handleEditProfileSubmit}>
          {editError && (
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
              {editError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Input
                label="First Name"
                value={editFormData.first_name}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, first_name: e.target.value })
                }
                required
              />
              <Input
                label="Last Name"
                value={editFormData.last_name}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, last_name: e.target.value })
                }
              />
            </div>

            <Input
              label="Work Email Address"
              type="email"
              value={editFormData.email}
              onChange={(e) =>
                setEditFormData({ ...editFormData, email: e.target.value })
              }
              required
            />

            <Select
              label="Role Assignment"
              value={editFormData.role}
              onChange={(e) =>
                setEditFormData({ ...editFormData, role: e.target.value })
              }
            >
              <option value="CASHIER">CASHIER (POS Checkout, Sales, Returns)</option>
              <option value="STAFF">STAFF (Catalog, Stock, Purchasing, Expenses)</option>
              <option value="OWNER">OWNER (Full System Access)</option>
            </Select>

            {/* Password update section if editing own profile */}
            {editingUser?.id === currentUser?.id && (
              <div
                style={{
                  marginTop: "8px",
                  padding: "14px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-slate-50)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>
                  Change Password (Optional)
                </div>

                <Input
                  label="Current Password"
                  type="password"
                  placeholder="Enter current password to authorize changes"
                  value={editFormData.current_password}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, current_password: e.target.value })
                  }
                />

                <Input
                  label="New Password"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={editFormData.new_password}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, new_password: e.target.value })
                  }
                />
              </div>
            )}
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
              onClick={() => setIsEditModalOpen(false)}
              disabled={editSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={editSubmitting}>
              Save Profile Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Provision User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Provision Team Account"
        subtitle="Create an employee credential with role-specific permissions."
        maxWidth="480px"
      >
        <form onSubmit={handleCreateSubmit}>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Input
                label="First Name"
                placeholder="e.g. Maria"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
                autoFocus
              />
              <Input
                label="Last Name"
                placeholder="e.g. Dela Cruz"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </div>

            <Input
              label="Work Email Address"
              type="email"
              placeholder="e.g. maria@grocery.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <Select
              label="Assigned Role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="CASHIER">CASHIER (POS Checkout, Sales Receipts, Returns)</option>
              <option value="STAFF">STAFF (Products, Inventory, Stock-In Purchases, Expenses)</option>
              <option value="OWNER">OWNER (Full System Access & User Provisioning)</option>
            </Select>

            <Input
              label="Initial Password"
              type="password"
              placeholder="Minimum 6 characters"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              helperText="Employee can change this after signing in."
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
              Provision Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Status Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, targetUser: null, loading: false })}
        onConfirm={handleToggleStatus}
        title={confirmDialog.targetUser?.is_active ? "Deactivate User Account?" : "Activate User Account?"}
        message={
          confirmDialog.targetUser?.is_active
            ? `Deactivating ${confirmDialog.targetUser?.email} will revoke their session and prevent them from logging in.`
            : `Activating ${confirmDialog.targetUser?.email} will restore their access to the system.`
        }
        variant={confirmDialog.targetUser?.is_active ? "danger" : "primary"}
        confirmText={confirmDialog.targetUser?.is_active ? "Deactivate" : "Activate"}
        loading={confirmDialog.loading}
      />
    </div>
  );
};

export default UsersPage;
