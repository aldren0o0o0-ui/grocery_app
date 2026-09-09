import { useState, useEffect } from "react";
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
import {
  PageHeader,
  Button,
  DataTable,
  Pagination,
  Modal,
  Drawer,
  FormField,
  Input,
  Select,
  Textarea,
  Toast,
} from "../components/common";

export const ExpensesPage = () => {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const canRecord = ["OWNER", "STAFF"].includes(user?.role);
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
  const [toastMessage, setToastMessage] = useState(null);
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

  // Expense Detail Drawer
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
          const catList = res?.categories || res?.data?.items || res?.items || (Array.isArray(res) ? res : []);
          setCategories(catList);
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
          search: search?.trim() || undefined,
          category_id: categoryFilter && categoryFilter !== "ALL" ? categoryFilter : undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        };
        const res = await getExpensesApi(params);
        if (!ignore) {
          const items = res?.expenses || res?.data?.items || res?.items || (Array.isArray(res) ? res : []);
          const pag = res?.pagination || res?.data?.pagination || { page: 1, per_page: 20, total: items.length, pages: 1 };
          setExpenses(items);
          setPagination(pag);
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
      setToastMessage({
        type: "error",
        text: err.response?.data?.error?.message || "Failed to fetch expense details for editing.",
      });
    }
  };

  const handleExpenseFormSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!formData.category_id) {
      setFormError("Category is required.");
      return;
    }
    if (!formData.expense_date) {
      setFormError("Expense date is required.");
      return;
    }
    if (formData.expense_date > todayStr) {
      setFormError("Expense date cannot be in the future.");
      return;
    }

    const val = parseFloat(formData.amount);
    if (isNaN(val) || val <= 0) {
      setFormError("Amount must be greater than zero.");
      return;
    }
    const parts = formData.amount.toString().split(".");
    if (parts.length > 1 && parts[1].length > 2) {
      setFormError("Amount exceeds maximum 2 decimal places.");
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        category_id: parseInt(formData.category_id, 10),
        amount: val.toFixed(2),
        expense_date: formData.expense_date,
        description: formData.description?.trim() || null,
      };

      if (modalMode === "CREATE") {
        await createExpenseApi(payload);
        setToastMessage({ type: "success", text: "Expense recorded successfully." });
      } else {
        await updateExpenseApi(editingExpenseId, payload);
        setToastMessage({ type: "success", text: "Expense updated successfully." });
      }

      setShowExpenseModal(false);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setFormError(err.response?.data?.error?.message || err.response?.data?.message || "Failed to save expense.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      setCatError("Category name is required.");
      return;
    }
    setCatSubmitting(true);
    setCatError("");
    try {
      await createExpenseCategoryApi({
        name: newCatName.trim(),
        description: newCatDesc.trim() || null,
      });
      setNewCatName("");
      setNewCatDesc("");
      setToastMessage({ type: "success", text: "Expense category created." });
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setCatError(err.response?.data?.error?.message || err.response?.data?.message || "Failed to create category.");
    } finally {
      setCatSubmitting(false);
    }
  };

  const handleStartEditCat = (cat) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatDesc(cat.description || "");
  };

  const handleSaveEditCat = async (catId) => {
    if (!editCatName.trim()) {
      setCatError("Category name is required.");
      return;
    }
    setCatSubmitting(true);
    setCatError("");
    try {
      await updateExpenseCategoryApi(catId, {
        name: editCatName.trim(),
        description: editCatDesc.trim() || null,
      });
      setEditingCatId(null);
      setToastMessage({ type: "success", text: "Expense category updated." });
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setCatError(err.response?.data?.error?.message || err.response?.data?.message || "Failed to update category.");
    } finally {
      setCatSubmitting(false);
    }
  };

  const handleToggleCatStatus = async (catId, currentStatus) => {
    try {
      await setExpenseCategoryStatusApi(catId, !currentStatus);
      setToastMessage({
        type: "success",
        text: `Category ${!currentStatus ? "activated" : "deactivated"}.`,
      });
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setCatError(err.response?.data?.error?.message || err.response?.data?.message || "Failed to toggle status.");
    }
  };

  // Filter available categories based on modal mode
  const availableCategories =
    modalMode === "CREATE"
      ? categories.filter((c) => c.is_active)
      : categories.filter((c) => c.is_active || c.id === formData.category_id);

  const columns = [
    {
      header: "Expense Date",
      accessor: "expense_date",
    },
    {
      header: "Category",
      accessor: (exp) => (
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
          {exp.category_name}
        </span>
      ),
    },
    {
      header: "Amount",
      align: "right",
      accessor: (exp) => (
        <strong style={{ fontFamily: "var(--font-mono)", fontSize: "14px", color: "var(--color-danger)" }}>
          ₱{parseFloat(exp.amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </strong>
      ),
    },
    {
      header: "Description",
      accessor: (exp) => (
        <span style={{ fontSize: "13px", color: "var(--color-text-secondary)", maxWidth: "260px" }}>
          {exp.description || "—"}
        </span>
      ),
    },
    {
      header: "Recorded By",
      accessor: (exp) => (
        <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
          {exp.creator_name || exp.creator?.name || exp.recorded_by?.name || "System"}
        </span>
      ),
    },
    {
      header: "Actions",
      align: "right",
      accessor: (exp) => (
        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedExpense(exp)}
          >
            View
          </Button>
          {isOwner && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleOpenEditModal(exp.id)}
            >
              Edit
            </Button>
          )}
        </div>
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
        title="Operating Expenses"
        subtitle="Track daily store overhead, operational spending, and cost categories."
        actions={
          <div style={{ display: "flex", gap: "10px" }}>
            {isOwner && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setCatError("");
                  setShowCategoryModal(true);
                }}
              >
                Manage Categories
              </Button>
            )}
            {canRecord && (
              <Button
                variant="primary"
                size="md"
                onClick={handleOpenCreateModal}
              >
                + Record Expense
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
        <div style={{ flex: 1, minWidth: "200px" }}>
          <input
            type="text"
            placeholder="Search description or recorded by..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
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
          <label htmlFor="expense-cat-filter" style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
            Category:
          </label>
          <select
            id="expense-cat-filter"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
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
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {!c.is_active ? "(Inactive)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="expense-date-from" style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
            From:
          </label>
          <input
            id="expense-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            style={{
              height: "38px",
              padding: "0 10px",
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
          <label htmlFor="expense-date-to" style={{ fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>
            To:
          </label>
          <input
            id="expense-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            style={{
              height: "38px",
              padding: "0 10px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              fontSize: "13px",
              color: "var(--color-text)",
              backgroundColor: "var(--color-surface)",
              outline: "none",
            }}
          />
        </div>

        {(search || categoryFilter !== "ALL" || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={handleResetFilters}>
            Clear Filters
          </Button>
        )}
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
          {error}
        </div>
      )}

      {/* Expenses Table */}
      <DataTable
        columns={columns}
        data={expenses}
        loading={loading}
        emptyTitle="No expenses found"
        emptyMessage="There are no expense records matching your search or date criteria."
        emptyAction={
          canRecord && (
            <Button variant="primary" size="sm" onClick={handleOpenCreateModal}>
              + Record First Expense
            </Button>
          )
        }
      />

      {/* Pagination */}
      {!loading && expenses.length > 0 && pagination.pages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.pages}
          totalItems={pagination.total}
          onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
        />
      )}

      {/* Record / Edit Expense Modal */}
      <Modal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        title={modalMode === "CREATE" ? "Record Operating Expense" : "Edit Operating Expense"}
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

        <form onSubmit={handleExpenseFormSubmit}>
          <FormField label="Category" required>
            <Select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              required
            >
              <option value="">-- Select Category --</option>
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {!c.is_active ? "(Inactive)" : ""}
                </option>
              ))}
            </Select>
          </FormField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <FormField label="Amount (₱)" required>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </FormField>

            <FormField label="Expense Date" required>
              <Input
                type="date"
                max={todayStr}
                required
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label="Description (Optional)">
            <Textarea
              rows={3}
              placeholder="e.g. Monthly store rent, Meralco electricity bill..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </FormField>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowExpenseModal(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={formSubmitting}
            >
              {formSubmitting ? "Saving..." : modalMode === "CREATE" ? "Record Expense" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Category Management Modal (OWNER only) */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="Expense Categories Management"
        maxWidth="600px"
      >
        {catError && (
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
            {catError}
          </div>
        )}

        {/* Add Category Form */}
        <form onSubmit={handleCreateCategory} style={{ marginBottom: "20px", paddingBottom: "20px", borderBottom: "1px solid var(--color-border)" }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-text)", display: "block", marginBottom: "10px" }}>
            Create New Category
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
            <Input
              placeholder="Category name (e.g. Packaging)"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              required
            />
            <Input
              placeholder="Description (optional)"
              value={newCatDesc}
              onChange={(e) => setNewCatDesc(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button type="submit" variant="primary" size="sm" loading={catSubmitting}>
              + Add Category
            </Button>
          </div>
        </form>

        {/* Categories List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "320px", overflowY: "auto" }}>
          {categories.map((c) => {
            const isEditing = editingCatId === c.id;
            return (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  backgroundColor: "var(--color-bg)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border-subtle)",
                }}
              >
                {isEditing ? (
                  <div style={{ display: "flex", gap: "8px", flex: 1, marginRight: "10px" }}>
                    <Input
                      value={editCatName}
                      onChange={(e) => setEditCatName(e.target.value)}
                      style={{ height: "32px", fontSize: "12px" }}
                    />
                    <Input
                      value={editCatDesc}
                      onChange={(e) => setEditCatDesc(e.target.value)}
                      placeholder="Description"
                      style={{ height: "32px", fontSize: "12px" }}
                    />
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--color-text)" }}>
                      {c.name}
                      {!c.is_active && (
                        <span style={{ marginLeft: "6px", fontSize: "11px", color: "var(--color-danger)" }}>
                          (Inactive)
                        </span>
                      )}
                    </div>
                    {c.description && (
                      <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
                        {c.description}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", gap: "6px" }}>
                  {isEditing ? (
                    <>
                      <Button variant="primary" size="sm" onClick={() => handleSaveEditCat(c.id)}>
                        Save
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setEditingCatId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => handleStartEditCat(c)}>
                        Edit
                      </Button>
                      <Button
                        variant={c.is_active ? "danger" : "secondary"}
                        size="sm"
                        onClick={() => handleToggleCatStatus(c.id, c.is_active)}
                      >
                        {c.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
          <Button variant="secondary" size="md" onClick={() => setShowCategoryModal(false)}>
            Close
          </Button>
        </div>
      </Modal>

      {/* Expense Detail Drawer */}
      <Drawer
        isOpen={Boolean(selectedExpense)}
        onClose={() => setSelectedExpense(null)}
        title="Expense Record Details"
        subtitle={selectedExpense ? `Logged on ${selectedExpense.expense_date}` : ""}
        width="440px"
      >
        {selectedExpense && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ padding: "16px", backgroundColor: "var(--color-bg)", borderRadius: "var(--radius-md)" }}>
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Amount Spent</span>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--color-danger)", marginTop: "4px" }}>
                ₱{parseFloat(selectedExpense.amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
              <div>
                <span style={{ color: "var(--color-text-secondary)" }}>Category:</span>
                <div style={{ fontWeight: 600, color: "var(--color-text)", marginTop: "2px" }}>
                  {selectedExpense.category_name}
                </div>
              </div>

              <div>
                <span style={{ color: "var(--color-text-secondary)" }}>Date:</span>
                <div style={{ fontWeight: 600, color: "var(--color-text)", marginTop: "2px" }}>
                  {selectedExpense.expense_date}
                </div>
              </div>

              <div>
                <span style={{ color: "var(--color-text-secondary)" }}>Recorded By:</span>
                <div style={{ fontWeight: 600, color: "var(--color-text)", marginTop: "2px" }}>
                  {selectedExpense.creator?.name || selectedExpense.creator_name || selectedExpense.recorded_by?.name || "System"} ({selectedExpense.creator?.email || selectedExpense.recorded_by?.email || "—"})
                </div>
              </div>

              <div>
                <span style={{ color: "var(--color-text-secondary)" }}>Description:</span>
                <div style={{ color: "var(--color-text)", marginTop: "2px", lineHeight: 1.5 }}>
                  {selectedExpense.description || "No description provided."}
                </div>
              </div>

              {selectedExpense.created_at && (
                <div>
                  <span style={{ color: "var(--color-text-secondary)" }}>Created At:</span>
                  <div style={{ color: "var(--color-text)", marginTop: "2px" }}>
                    {new Date(selectedExpense.created_at).toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            {isOwner && (
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--color-border)" }}>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    const id = selectedExpense.id;
                    setSelectedExpense(null);
                    handleOpenEditModal(id);
                  }}
                  style={{ width: "100%" }}
                >
                  Edit This Expense
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default ExpensesPage;
