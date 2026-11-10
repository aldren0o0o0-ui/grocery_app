import { useState, useEffect, useCallback } from "react";
import useAuth from "../context/AuthContext";
import {
  TrendingDown,
  Plus,
  Search,
  Tag,
  Edit2,
} from "lucide-react";
import {
  getExpensesApi,
  createExpenseApi,
  updateExpenseApi,
  getExpenseCategoriesApi,
  createExpenseCategoryApi,
} from "../api/expenses";
import {
  Button,
  Badge,
  Input,
  Select,
  Modal,
  Table,
  Card,
  useToast,
} from "../components/ui";

export const ExpensesPage = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isOwner = user?.role === "OWNER";

  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // Record Expense Modal
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    category_id: "",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    description: "",
  });
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState("");

  // Create Category Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [submittingCat, setSubmittingCat] = useState(false);
  const [catError, setCatError] = useState("");

  const fetchCategories = useCallback(async () => {
    try {
      const res = await getExpenseCategoriesApi();
      setCategories(res.categories || res || []);
    } catch (err) {
      console.error("Failed to load expense categories:", err);
    }
  }, []);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (categoryFilter !== "ALL") params.category_id = categoryFilter;

      const res = await getExpensesApi(params);
      setExpenses(res.expenses || res.items || res || []);
    } catch (err) {
      showToast(err.response?.data?.error?.message || "Failed to load expenses.", "error");
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, showToast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchExpenses();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchExpenses]);

  const handleOpenRecord = () => {
    setEditingExpense(null);
    setExpenseForm({
      category_id: categories[0]?.id || "",
      amount: "",
      expense_date: new Date().toISOString().split("T")[0],
      description: "",
    });
    setExpenseError("");
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditExpense = (exp) => {
    setEditingExpense(exp);
    setExpenseForm({
      category_id: exp.category_id || "",
      amount: String(exp.amount || ""),
      expense_date: exp.expense_date || new Date().toISOString().split("T")[0],
      description: exp.description || "",
    });
    setExpenseError("");
    setIsExpenseModalOpen(true);
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    setExpenseError("");

    if (!expenseForm.category_id || !expenseForm.amount) {
      setExpenseError("Category and valid amount are required.");
      return;
    }

    setSubmittingExpense(true);
    try {
      const payload = {
        category_id: Number(expenseForm.category_id),
        amount: parseFloat(expenseForm.amount),
        expense_date: expenseForm.expense_date,
        description: expenseForm.description.trim() || undefined,
      };

      if (editingExpense) {
        await updateExpenseApi(editingExpense.id, payload);
        showToast("Expense record updated.", "success");
      } else {
        await createExpenseApi(payload);
        showToast("Operating expense recorded.", "success");
      }

      setIsExpenseModalOpen(false);
      fetchExpenses();
    } catch (err) {
      setExpenseError(err.response?.data?.error?.message || "Failed to save expense.");
    } finally {
      setSubmittingExpense(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    setCatError("");

    if (!catName.trim()) {
      setCatError("Category name is required.");
      return;
    }

    setSubmittingCat(true);
    try {
      await createExpenseCategoryApi({
        name: catName.trim(),
        description: catDesc.trim() || undefined,
      });

      showToast("Expense category created.", "success");
      setIsCategoryModalOpen(false);
      setCatName("");
      setCatDesc("");
      fetchCategories();
    } catch (err) {
      setCatError(err.response?.data?.error?.message || "Failed to create category.");
    } finally {
      setSubmittingCat(false);
    }
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "₱0.00";
    return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalExpenseSum = expenses.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

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
            Store Operating Expenses
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Track overhead costs, store utilities, employee wages, packaging, and facility fees.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          {isOwner && (
            <Button
              variant="outline"
              icon={Tag}
              onClick={() => {
                setCatName("");
                setCatDesc("");
                setCatError("");
                setIsCategoryModalOpen(true);
              }}
            >
              Add Expense Category
            </Button>
          )}

          <Button variant="primary" icon={Plus} onClick={handleOpenRecord}>
            Record Expense
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
        }}
      >
        <Card padding="18px">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                Total Expenses (Filtered)
              </div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: "24px",
                  fontWeight: 800,
                  color: "var(--color-danger)",
                  marginTop: "4px",
                }}
              >
                {formatCurrency(totalExpenseSum)}
              </div>
            </div>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-danger-bg)",
                color: "var(--color-danger)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TrendingDown size={18} />
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
            {expenses.length} operating disbursements recorded
          </div>
        </Card>
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
            placeholder="Search expense description..."
            icon={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ width: "200px" }}>
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Table */}
      <Table
        columns={[
          {
            header: "Date",
            key: "expense_date",
            render: (val) => val || "-",
          },
          {
            header: "Category",
            key: "category_name",
            render: (val) => (
              <Badge variant="neutral" size="sm">
                {val || "General"}
              </Badge>
            ),
          },
          {
            header: "Description / Notes",
            key: "description",
            render: (val) => val || "No description",
          },
          {
            header: "Recorded By",
            key: "created_by_name",
            render: (val) => val || "Owner/Staff",
          },
          {
            header: "Amount",
            key: "amount",
            align: "right",
            render: (val) => (
              <span className="tabular-nums" style={{ fontWeight: 800, color: "var(--color-danger)" }}>
                {formatCurrency(val)}
              </span>
            ),
          },
          ...(isOwner
            ? [
                {
                  header: "Actions",
                  key: "actions",
                  align: "right",
                  render: (_, row) => (
                    <Button
                      variant="ghost"
                      size="xs"
                      icon={Edit2}
                      onClick={() => handleOpenEditExpense(row)}
                    >
                      Edit
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
        data={expenses}
        loading={loading}
        emptyMessage="No operating expenses recorded yet."
        emptyIcon={TrendingDown}
      />

      {/* Record Expense Modal */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title={editingExpense ? "Edit Expense Entry" : "Record Operating Expense"}
        subtitle="Log operational overhead, utility payments, or store maintenance."
        maxWidth="460px"
      >
        <form onSubmit={handleExpenseSubmit}>
          {expenseError && (
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
              {expenseError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Select
              label="Expense Category"
              value={expenseForm.category_id}
              onChange={(e) => setExpenseForm({ ...expenseForm, category_id: e.target.value })}
              required
            >
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>

            <Input
              label="Amount Disbursed (₱)"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              required
            />

            <Input
              label="Expense Date"
              type="date"
              value={expenseForm.expense_date}
              onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
              required
            />

            <Input
              label="Description / Purpose"
              placeholder="e.g. Meralco Electricity Bill - July"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
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
              onClick={() => setIsExpenseModalOpen(false)}
              disabled={submittingExpense}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submittingExpense}>
              {editingExpense ? "Update Expense" : "Save Record"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Category Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Add Expense Category"
        subtitle="Group store overhead for clean bookkeeping and reporting."
        maxWidth="440px"
      >
        <form onSubmit={handleCreateCategory}>
          {catError && (
            <div
              style={{
                padding: "10px 14px",
                marginBottom: "16px",
                backgroundColor: "var(--color-danger-bg)",
                color: "var(--color-danger-text)",
                borderRadius: "var(--radius-md)",
                fontSize: "13px",
              }}
            >
              {catError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Input
              label="Category Name"
              placeholder="e.g. Utilities, Wages, Store Supplies"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              required
              autoFocus
            />

            <Input
              label="Description"
              placeholder="e.g. Electric, water, internet charges"
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
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
              onClick={() => setIsCategoryModalOpen(false)}
              disabled={submittingCat}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submittingCat}>
              Create Category
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ExpensesPage;
