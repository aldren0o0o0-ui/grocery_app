import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import useAuth from "../modules/auth/useAuth";
import {
  getExpensesApi,
  getExpenseDetailApi,
  createExpenseApi,
  updateExpenseApi,
  getExpenseCategoriesApi,
  createExpenseCategoryApi,
  updateExpenseCategoryApi,
  setExpenseCategoryStatusApi,
} from "../modules/expenses/api";

export const ExpensesPage = () => {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const todayStr = new Date().toISOString().split("T")[0];

  // Expenses state
  const [expenses, setExpenses] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 1 });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Categories state
  const [categories, setCategories] = useState([]);

  // Expense Modal (Create or Edit)
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [modalMode, setModalMode] = useState("CREATE"); // "CREATE" | "EDIT"
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [formData, setFormData] = useState({
    category_id: "",
    amount: "",
    expense_date: todayStr,
    description: "",
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Expense Detail Modal
  const [selectedExpense, setSelectedExpense] = useState(null);

  // Category Management Modal (OWNER only)
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [catSubmitting, setCatSubmitting] = useState(false);
  const [catError, setCatError] = useState("");
  const [editingCatId, setEditingCatId] = useState(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatDesc, setEditCatDesc] = useState("");

  // Load categories
  useEffect(() => {
    let ignore = false;
    const fetchCats = async () => {
      try {
        const res = await getExpenseCategoriesApi();
        if (!ignore) {
          setCategories(res.categories || []);
        }
      } catch {
        // Silently keep empty categories
      }
    };
    fetchCats();
    return () => {
      ignore = true;
    };
  }, [refreshTrigger]);

  // Load expenses
  useEffect(() => {
    let ignore = false;
    const fetchExpenses = async () => {
      try {
        setLoading(true);
        setError("");
        const params = {
          page: pagination.page,
          per_page: 20,
          search,
          category_id: categoryFilter,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        };
        const res = await getExpensesApi(params);
        if (!ignore) {
          setExpenses(res.expenses || []);
          setPagination(res.pagination || { page: 1, per_page: 20, total: 0, pages: 1 });
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error?.message || err.response?.data?.message || "Failed to load expenses.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchExpenses();
    return () => {
      ignore = true;
    };
  }, [pagination.page, search, categoryFilter, dateFrom, dateTo, refreshTrigger]);

  const handleResetFilters = () => {
    setSearch("");
    setCategoryFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };

  // Open Create Expense Modal
  const handleOpenCreateModal = () => {
    const activeCats = categories.filter((c) => c.is_active);
    const defaultCatId = activeCats.length > 0 ? activeCats[0].id : "";
    setModalMode("CREATE");
    setEditingExpenseId(null);
    setFormData({
      category_id: defaultCatId,
      amount: "",
      expense_date: todayStr,
      description: "",
    });
    setFormError("");
    setShowExpenseModal(true);
  };

  // Open Edit Expense Modal (OWNER only)
  const handleOpenEditModal = async (expId) => {
    try {
      const res = await getExpenseDetailApi(expId);
      const exp = res.expense;
      setModalMode("EDIT");
      setEditingExpenseId(exp.id);
      setFormData({
        category_id: exp.category_id,
        amount: exp.amount,
        expense_date: exp.expense_date,
        description: exp.description || "",
      });
      setFormError("");
      setShowExpenseModal(true);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Failed to load expense details for editing.");
    }
  };

  // View read-only detail
  const handleViewDetail = async (expId) => {
    try {
      const res = await getExpenseDetailApi(expId);
      setSelectedExpense(res.expense);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Failed to load expense details.");
    }
  };

  // Submit Expense Form
  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    try {
      setFormSubmitting(true);
      setFormError("");

      const amountVal = parseFloat(formData.amount);
      if (isNaN(amountVal) || amountVal <= 0) {
        setFormError("Amount must be greater than zero.");
        setFormSubmitting(false);
        return;
      }

      if (formData.expense_date > todayStr) {
        setFormError("Expense date cannot be in the future.");
        setFormSubmitting(false);
        return;
      }

      const payload = {
        category_id: parseInt(formData.category_id, 10),
        amount: amountVal.toFixed(2),
        expense_date: formData.expense_date,
        description: formData.description.trim() || undefined,
      };

      if (modalMode === "CREATE") {
        await createExpenseApi(payload);
        setSuccessMsg("Expense recorded successfully!");
      } else {
        await updateExpenseApi(editingExpenseId, payload);
        setSuccessMsg("Expense record updated successfully!");
      }

      setShowExpenseModal(false);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setFormError(err.response?.data?.error?.message || err.response?.data?.message || "Failed to save expense.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Category management handlers
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      setCatError("Category name is required.");
      return;
    }
    try {
      setCatSubmitting(true);
      setCatError("");
      await createExpenseCategoryApi({
        name: newCatName.trim(),
        description: newCatDesc.trim() || undefined,
      });
      setNewCatName("");
      setNewCatDesc("");
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setCatError(err.response?.data?.error?.message || "Failed to create category.");
    } finally {
      setCatSubmitting(false);
    }
  };

  const handleToggleCategoryStatus = async (cat) => {
    try {
      await setExpenseCategoryStatusApi(cat.id, !cat.is_active);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setCatError(err.response?.data?.error?.message || "Failed to update category status.");
    }
  };

  const handleStartEditCat = (cat) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatDesc(cat.description || "");
  };

  const handleSaveEditCat = async (catId) => {
    if (!editCatName.trim()) {
      setCatError("Category name cannot be empty.");
      return;
    }
    try {
      await updateExpenseCategoryApi(catId, {
        name: editCatName.trim(),
        description: editCatDesc.trim() || undefined,
      });
      setEditingCatId(null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setCatError(err.response?.data?.error?.message || "Failed to update category.");
    }
  };

  const totalFilteredAmount = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const activeCategoriesCount = categories.filter((c) => c.is_active).length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f9fafb" }}>
      <Navbar />

      <main style={{ maxWidth: "1200px", margin: "2rem auto", padding: "0 1.5rem" }}>
        {/* Header and Quick Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#111827", fontWeight: "700" }}>Operating Expenses</h1>
            <p style={{ margin: "0.25rem 0 0", color: "#6b7280", fontSize: "0.875rem" }}>
              {isOwner ? "Track, manage, and audit store operational costs" : "Record operational store expenses"}
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            {isOwner && (
              <button
                onClick={() => {
                  setCatError("");
                  setShowCategoryModal(true);
                }}
                style={{
                  padding: "0.6rem 1rem",
                  backgroundColor: "#ffffff",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontWeight: "600",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                Manage Categories
              </button>
            )}

            <button
              onClick={handleOpenCreateModal}
              style={{
                padding: "0.6rem 1.2rem",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontWeight: "600",
                fontSize: "0.875rem",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              + Record Expense
            </button>
          </div>
        </div>

        {/* Global Success Banner */}
        {successMsg && (
          <div
            style={{
              padding: "0.75rem 1rem",
              backgroundColor: "#ecfdf5",
              color: "#065f46",
              borderRadius: "6px",
              marginBottom: "1rem",
              border: "1px solid #a7f3d0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{successMsg}</span>
            <button
              onClick={() => setSuccessMsg("")}
              style={{ background: "none", border: "none", color: "#065f46", cursor: "pointer", fontWeight: "700" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ backgroundColor: "#ffffff", padding: "1.25rem", borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "0.8rem", color: "#6b7280", fontWeight: "600", textTransform: "uppercase" }}>
              Total Filtered Expenses
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: "700", color: "#111827", marginTop: "0.25rem" }}>
              ₱{totalFilteredAmount.toFixed(2)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem" }}>
              Based on current filter view
            </div>
          </div>

          <div style={{ backgroundColor: "#ffffff", padding: "1.25rem", borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "0.8rem", color: "#6b7280", fontWeight: "600", textTransform: "uppercase" }}>
              Expense Entries
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: "700", color: "#2563eb", marginTop: "0.25rem" }}>
              {pagination.total}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem" }}>
              Matching transactions logged
            </div>
          </div>

          <div style={{ backgroundColor: "#ffffff", padding: "1.25rem", borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "0.8rem", color: "#6b7280", fontWeight: "600", textTransform: "uppercase" }}>
              Active Categories
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: "700", color: "#059669", marginTop: "0.25rem" }}>
              {activeCategoriesCount}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem" }}>
              Available for operational coding
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "1rem",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            marginBottom: "1.5rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            alignItems: "flex-end",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#374151", marginBottom: "0.25rem" }}>
              Search Description or Category
            </label>
            <input
              type="text"
              placeholder="Search keyword..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ width: "200px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#374151", marginBottom: "0.25rem" }}>
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                fontSize: "0.875rem",
                backgroundColor: "#ffffff",
                boxSizing: "border-box",
              }}
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {!c.is_active ? "(Inactive)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: "150px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#374151", marginBottom: "0.25rem" }}>
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ width: "150px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#374151", marginBottom: "0.25rem" }}>
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            onClick={handleResetFilters}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#f3f4f6",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "0.875rem",
              color: "#374151",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Reset
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ padding: "0.75rem", backgroundColor: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        {/* Expenses Table */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb", color: "#374151" }}>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600" }}>Date</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600" }}>Category</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600" }}>Description</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600", textAlign: "right" }}>Amount</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600" }}>Recorded By</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: "600", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ padding: "3rem", textAlign: "center", color: "#6b7280" }}>
                    Loading operating expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>
                    No expenses found matching the specified filters.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: "600", color: "#111827", whiteSpace: "nowrap" }}>
                      {exp.expense_date}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          backgroundColor: "#f3e8ff",
                          color: "#6b21a8",
                        }}
                      >
                        {exp.category_name}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", color: "#4b5563", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {exp.description || <span style={{ color: "#9ca3af", fontStyle: "italic" }}>No description</span>}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: "700", color: "#111827", whiteSpace: "nowrap" }}>
                      ₱{parseFloat(exp.amount).toFixed(2)}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", color: "#4b5563", whiteSpace: "nowrap" }}>
                      {exp.creator_name}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "center", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                        <button
                          onClick={() => handleViewDetail(exp.id)}
                          style={{
                            padding: "0.25rem 0.6rem",
                            backgroundColor: "#eff6ff",
                            color: "#2563eb",
                            border: "1px solid #bfdbfe",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                            cursor: "pointer",
                          }}
                        >
                          View
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => handleOpenEditModal(exp.id)}
                            style={{
                              padding: "0.25rem 0.6rem",
                              backgroundColor: "#fffbeb",
                              color: "#d97706",
                              border: "1px solid #fde68a",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: "600",
                              cursor: "pointer",
                            }}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div
            style={{
              padding: "0.75rem 1rem",
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.875rem",
              color: "#4b5563",
            }}
          >
            <span>
              Showing {expenses.length} of {pagination.total} expenses
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                style={{
                  padding: "0.3rem 0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  backgroundColor: "#ffffff",
                  cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
                  opacity: pagination.page <= 1 ? 0.5 : 1,
                }}
              >
                Previous
              </button>
              <span style={{ padding: "0.3rem 0.5rem" }}>
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                style={{
                  padding: "0.3rem 0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  backgroundColor: "#ffffff",
                  cursor: pagination.page >= pagination.pages ? "not-allowed" : "pointer",
                  opacity: pagination.page >= pagination.pages ? 0.5 : 1,
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Record / Edit Expense Modal */}
      {showExpenseModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              padding: "1.5rem",
              width: "500px",
              maxWidth: "95%",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#111827" }}>
                {modalMode === "CREATE" ? "Record New Expense" : "Edit Expense Record"}
              </h2>
              <button
                onClick={() => setShowExpenseModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ padding: "0.75rem", backgroundColor: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.875rem" }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitExpense}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {/* Category Select */}
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#374151", marginBottom: "0.3rem" }}>
                    Category <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select
                    required
                    value={formData.category_id}
                    onChange={(e) => setFormData((prev) => ({ ...prev, category_id: e.target.value }))}
                    disabled={formSubmitting}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid #d1d5db",
                      fontSize: "0.875rem",
                      backgroundColor: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="" disabled>Select an active category...</option>
                    {categories
                      .filter((c) => c.is_active || (modalMode === "EDIT" && c.id === formData.category_id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {!c.is_active ? "(Inactive)" : ""}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Amount and Expense Date side-by-side */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#374151", marginBottom: "0.3rem" }}>
                      Amount (₱) <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                      disabled={formSubmitting}
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "6px",
                        border: "1px solid #d1d5db",
                        fontSize: "0.875rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#374151", marginBottom: "0.3rem" }}>
                      Expense Date <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      type="date"
                      required
                      max={todayStr}
                      value={formData.expense_date}
                      onChange={(e) => setFormData((prev) => ({ ...prev, expense_date: e.target.value }))}
                      disabled={formSubmitting}
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "6px",
                        border: "1px solid #d1d5db",
                        fontSize: "0.875rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#374151", marginBottom: "0.3rem" }}>
                    Description / Remarks (Optional)
                  </label>
                  <textarea
                    rows="3"
                    placeholder="e.g. Electric power bill for March store operations..."
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    disabled={formSubmitting}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid #d1d5db",
                      fontSize: "0.875rem",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                {/* Audit notice */}
                <div style={{ fontSize: "0.75rem", color: "#6b7280", fontStyle: "italic" }}>
                  ℹ Changes to expense records are logged with your user identity for financial integrity.
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setShowExpenseModal(false)}
                    disabled={formSubmitting}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: "#f3f4f6",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      fontWeight: "600",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    style={{
                      padding: "0.5rem 1.25rem",
                      backgroundColor: "#2563eb",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: "600",
                      cursor: formSubmitting ? "not-allowed" : "pointer",
                      fontSize: "0.875rem",
                    }}
                  >
                    {formSubmitting ? "Saving..." : modalMode === "CREATE" ? "Save Expense" : "Update Record"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Detail View Modal */}
      {selectedExpense && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              padding: "1.5rem",
              width: "480px",
              maxWidth: "95%",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#111827" }}>
                Expense Details #{selectedExpense.id}
              </h2>
              <button
                onClick={() => setSelectedExpense(null)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.875rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", paddingBottom: "0.5rem" }}>
                <span style={{ color: "#6b7280" }}>Category:</span>
                <span style={{ fontWeight: "600", color: "#111827" }}>{selectedExpense.category?.name}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", paddingBottom: "0.5rem" }}>
                <span style={{ color: "#6b7280" }}>Amount:</span>
                <span style={{ fontWeight: "700", color: "#111827", fontSize: "1.1rem" }}>₱{parseFloat(selectedExpense.amount).toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", paddingBottom: "0.5rem" }}>
                <span style={{ color: "#6b7280" }}>Expense Date:</span>
                <span style={{ fontWeight: "500" }}>{selectedExpense.expense_date}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", paddingBottom: "0.5rem" }}>
                <span style={{ color: "#6b7280" }}>Recorded By:</span>
                <span>{selectedExpense.creator?.name} ({selectedExpense.creator?.email})</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6", paddingBottom: "0.5rem" }}>
                <span style={{ color: "#6b7280" }}>Created Timestamp:</span>
                <span>{new Date(selectedExpense.created_at).toLocaleString()}</span>
              </div>
              <div>
                <span style={{ color: "#6b7280", display: "block", marginBottom: "0.25rem" }}>Description / Remarks:</span>
                <div style={{ padding: "0.5rem", backgroundColor: "#f9fafb", borderRadius: "4px", color: "#374151" }}>
                  {selectedExpense.description || "No description provided."}
                </div>
              </div>
            </div>

            <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setSelectedExpense(null)}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#f3f4f6",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Categories Modal (OWNER only) */}
      {showCategoryModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              padding: "1.5rem",
              width: "620px",
              maxWidth: "95%",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#111827" }}>
                Manage Expense Categories
              </h2>
              <button
                onClick={() => setShowCategoryModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {catError && (
              <div style={{ padding: "0.75rem", backgroundColor: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.875rem" }}>
                {catError}
              </div>
            )}

            {/* Inline Create Category Form */}
            <form onSubmit={handleAddCategory} style={{ backgroundColor: "#f9fafb", padding: "1rem", borderRadius: "6px", marginBottom: "1.5rem", border: "1px solid #e5e7eb" }}>
              <div style={{ fontWeight: "600", fontSize: "0.875rem", color: "#374151", marginBottom: "0.5rem" }}>
                Add New Category
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.5rem", alignItems: "flex-end" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "#4b5563", marginBottom: "0.2rem" }}>Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cleaning Supplies"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    disabled={catSubmitting}
                    style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "#4b5563", marginBottom: "0.2rem" }}>Description</label>
                  <input
                    type="text"
                    placeholder="Optional details"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    disabled={catSubmitting}
                    style={{ width: "100%", padding: "0.4rem 0.6rem", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={catSubmitting}
                  style={{
                    padding: "0.45rem 1rem",
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "4px",
                    fontWeight: "600",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Add
                </button>
              </div>
            </form>

            {/* Category List */}
            <div style={{ fontWeight: "600", fontSize: "0.875rem", color: "#374151", marginBottom: "0.5rem" }}>
              Existing Categories ({categories.length})
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "6px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb", textAlign: "left", color: "#374151" }}>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Category</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Status</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        {editingCatId === c.id ? (
                          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                            <input
                              type="text"
                              value={editCatName}
                              onChange={(e) => setEditCatName(e.target.value)}
                              style={{ padding: "0.2rem 0.4rem", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "0.85rem" }}
                            />
                            <input
                              type="text"
                              placeholder="Description"
                              value={editCatDesc}
                              onChange={(e) => setEditCatDesc(e.target.value)}
                              style={{ padding: "0.2rem 0.4rem", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "0.85rem" }}
                            />
                            <button
                              onClick={() => handleSaveEditCat(c.id)}
                              style={{ padding: "0.2rem 0.5rem", backgroundColor: "#059669", color: "#ffffff", border: "none", borderRadius: "4px", fontSize: "0.75rem", cursor: "pointer" }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingCatId(null)}
                              style={{ padding: "0.2rem 0.5rem", backgroundColor: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "0.75rem", cursor: "pointer" }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontWeight: "600", color: "#111827" }}>{c.name}</div>
                            {c.description && <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{c.description}</div>}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                            backgroundColor: c.is_active ? "#ecfdf5" : "#f3f4f6",
                            color: c.is_active ? "#065f46" : "#6b7280",
                          }}
                        >
                          {c.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                          {editingCatId !== c.id && (
                            <button
                              onClick={() => handleStartEditCat(c)}
                              style={{
                                padding: "0.2rem 0.5rem",
                                backgroundColor: "#f3f4f6",
                                border: "1px solid #d1d5db",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                cursor: "pointer",
                              }}
                            >
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleCategoryStatus(c)}
                            style={{
                              padding: "0.2rem 0.5rem",
                              backgroundColor: c.is_active ? "#fee2e2" : "#ecfdf5",
                              color: c.is_active ? "#991b1b" : "#065f46",
                              border: "none",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: "600",
                              cursor: "pointer",
                            }}
                          >
                            {c.is_active ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCategoryModal(false)}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#f3f4f6",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesPage;
