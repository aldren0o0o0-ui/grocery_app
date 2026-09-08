import { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar";
import useAuth from "../modules/auth/useAuth";
import { getUsersApi, createUserApi, setUserStatusApi } from "../modules/users/api";

const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      setUsers(data.users || []);
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

      handleCloseModal();
      fetchUsers();
    } catch (err) {
      setFormError(err.response?.data?.error?.message || err.response?.data?.message || "Failed to create user account.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user) => {
    if (user.id === currentUser?.id) {
      alert("You cannot deactivate your own account.");
      return;
    }

    const action = user.is_active ? "deactivate" : "reactivate";
    const confirmed = window.confirm(
      `Are you sure you want to ${action} account for "${user.first_name} ${user.last_name}" (${user.email})?`
    );
    if (!confirmed) return;

    try {
      await setUserStatusApi(user.id, !user.is_active);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error?.message || err.response?.data?.message || "Failed to update user status.");
    }
  };

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case "OWNER":
      case "ADMIN":
        return { backgroundColor: "#e0e7ff", color: "#3730a3", border: "1px solid #c7d2fe" };
      case "STAFF":
        return { backgroundColor: "#dbeafe", color: "#1e40af", border: "1px solid #bfdbfe" };
      case "CASHIER":
        return { backgroundColor: "#d1fae5", color: "#065f46", border: "1px solid #a7f3d0" };
      default:
        return { backgroundColor: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" };
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      <Navbar />

      <main style={{ maxWidth: "1200px", margin: "2rem auto", padding: "0 1.5rem" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "1.5rem",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: "700", color: "#0f172a", margin: "0 0 0.25rem" }}>
              Team & User Accounts
            </h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.95rem" }}>
              Provision and manage Staff, Cashier, and Owner accounts for your grocery store.
            </p>
          </div>

          <button
            onClick={handleOpenAddModal}
            style={{
              padding: "0.65rem 1.25rem",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>+</span>
            <span>Add Team Member</span>
          </button>
        </div>

        {/* Filters & Search Toolbar */}
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "1rem 1.25rem",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            marginBottom: "1.5rem",
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: "1rem", flex: 1, minWidth: "280px", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                minWidth: "220px",
                padding: "0.55rem 0.85rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
              }}
            />

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                padding: "0.55rem 0.85rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
                backgroundColor: "#ffffff",
                cursor: "pointer",
              }}
            >
              <option value="ALL">All Roles</option>
              <option value="OWNER">Owner</option>
              <option value="STAFF">Staff</option>
              <option value="CASHIER">Cashier</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "0.55rem 0.85rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
                backgroundColor: "#ffffff",
                cursor: "pointer",
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>

          <div style={{ color: "#64748b", fontSize: "0.875rem" }}>
            Total Members: <strong>{users.length}</strong>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div
            style={{
              padding: "0.85rem 1rem",
              backgroundColor: "#fee2e2",
              color: "#991b1b",
              borderRadius: "8px",
              marginBottom: "1.5rem",
              border: "1px solid #fecaca",
            }}
          >
            {error}
          </div>
        )}

        {/* Users Table */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>Loading team members...</div>
          ) : users.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
              <p style={{ margin: "0 0 0.5rem", fontSize: "1.1rem", fontWeight: "600", color: "#334155" }}>
                No team members found
              </p>
              <p style={{ margin: 0, fontSize: "0.9rem" }}>
                {search || roleFilter !== "ALL" || statusFilter !== "ALL"
                  ? "Try adjusting your search or role filters."
                  : "Click '+ Add Team Member' to create the first account."}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                    <th style={{ padding: "0.85rem 1.25rem", fontWeight: "600" }}>Name</th>
                    <th style={{ padding: "0.85rem 1.25rem", fontWeight: "600" }}>Email</th>
                    <th style={{ padding: "0.85rem 1.25rem", fontWeight: "600" }}>Role</th>
                    <th style={{ padding: "0.85rem 1.25rem", fontWeight: "600" }}>Status</th>
                    <th style={{ padding: "0.85rem 1.25rem", fontWeight: "600" }}>Created</th>
                    <th style={{ padding: "0.85rem 1.25rem", fontWeight: "600", textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr
                        key={u.id}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          backgroundColor: isSelf ? "#f0fdf4" : "transparent",
                        }}
                      >
                        <td style={{ padding: "0.85rem 1.25rem", color: "#0f172a", fontWeight: "500" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <div
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "50%",
                                backgroundColor: "#e2e8f0",
                                color: "#334155",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: "600",
                                fontSize: "0.8rem",
                              }}
                            >
                              {u.first_name?.[0]?.toUpperCase() || "U"}
                            </div>
                            <div>
                              <span>
                                {u.first_name} {u.last_name}
                              </span>
                              {isSelf && (
                                <span
                                  style={{
                                    marginLeft: "0.5rem",
                                    fontSize: "0.75rem",
                                    color: "#16a34a",
                                    fontWeight: "600",
                                  }}
                                >
                                  (You)
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "0.85rem 1.25rem", color: "#334155" }}>{u.email}</td>
                        <td style={{ padding: "0.85rem 1.25rem" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "0.2rem 0.6rem",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: "600",
                              ...getRoleBadgeStyle(u.role),
                            }}
                          >
                            {u.role === "ADMIN" ? "OWNER" : u.role}
                          </span>
                        </td>
                        <td style={{ padding: "0.85rem 1.25rem" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              padding: "0.2rem 0.55rem",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: "600",
                              backgroundColor: u.is_active ? "#dcfce7" : "#fee2e2",
                              color: u.is_active ? "#15803d" : "#b91c1c",
                            }}
                          >
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                backgroundColor: u.is_active ? "#16a34a" : "#dc2626",
                              }}
                            />
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ padding: "0.85rem 1.25rem", color: "#64748b", fontSize: "0.85rem" }}>
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                          {isSelf ? (
                            <span style={{ color: "#94a3b8", fontSize: "0.8rem", fontStyle: "italic" }}>
                              Self Account
                            </span>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(u)}
                              style={{
                                padding: "0.35rem 0.75rem",
                                borderRadius: "6px",
                                border: "1px solid",
                                borderColor: u.is_active ? "#fca5a5" : "#86efac",
                                backgroundColor: u.is_active ? "#fef2f2" : "#f0fdf4",
                                color: u.is_active ? "#dc2626" : "#16a34a",
                                fontSize: "0.8rem",
                                fontWeight: "600",
                                cursor: "pointer",
                              }}
                            >
                              {u.is_active ? "Deactivate" : "Activate"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add User Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "1rem",
            zIndex: 50,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "1.25rem 1.5rem",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2 style={{ fontSize: "1.2rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                Add New Team Member
              </h2>
              <button
                onClick={handleCloseModal}
                disabled={submitting}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  color: "#94a3b8",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitUser} style={{ padding: "1.5rem" }}>
              {formError && (
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    backgroundColor: "#fee2e2",
                    color: "#991b1b",
                    borderRadius: "6px",
                    marginBottom: "1rem",
                    fontSize: "0.875rem",
                  }}
                >
                  {formError}
                </div>
              )}

              {/* Role Picker */}
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.35rem" }}>
                  Role & Permissions *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                  {[
                    { key: "STAFF", title: "Staff", desc: "Catalog & inventory" },
                    { key: "CASHIER", title: "Cashier", desc: "Checkout & sales" },
                    { key: "OWNER", title: "Owner", desc: "Full control" },
                  ].map((r) => {
                    const isSelected = formData.role === r.key;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setFormData({ ...formData, role: r.key })}
                        style={{
                          padding: "0.65rem 0.5rem",
                          borderRadius: "8px",
                          border: isSelected ? "2px solid #2563eb" : "1px solid #cbd5e1",
                          backgroundColor: isSelected ? "#eff6ff" : "#ffffff",
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                      >
                        <div style={{ fontWeight: "600", fontSize: "0.9rem", color: isSelected ? "#1d4ed8" : "#1e293b" }}>
                          {r.title}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "0.15rem" }}>{r.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name Fields Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.35rem" }}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maria"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "0.55rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.9rem",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.35rem" }}>
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Santos"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "0.55rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.9rem",
                    }}
                  />
                </div>
              </div>

              {/* Email Field */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "#334155", marginBottom: "0.35rem" }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. maria.santos@grocery.local"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "0.55rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              {/* Password Field */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                  <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#334155" }}>
                    Initial Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#2563eb",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "0.55rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.9rem",
                  }}
                />
                <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                  The team member will use this password to sign into the system.
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  style={{
                    padding: "0.6rem 1.25rem",
                    backgroundColor: "#f1f5f9",
                    color: "#334155",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "0.6rem 1.5rem",
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: "600",
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
