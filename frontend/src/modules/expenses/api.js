import client from "../../api/client";

/**
 * Fetches expense categories with optional status and search filters.
 * @param {Object} params - { is_active, search }
 */
export const getExpenseCategoriesApi = async (params = {}) => {
  const cleanParams = {};
  if (params.is_active !== undefined && params.is_active !== "ALL") {
    cleanParams.is_active = params.is_active;
  }
  if (params.search && params.search.trim()) {
    cleanParams.search = params.search.trim();
  }

  const response = await client.get("/expense-categories", { params: cleanParams });
  return response.data;
};

/**
 * Fetches single expense category details.
 * @param {number|string} id
 */
export const getExpenseCategoryApi = async (id) => {
  const response = await client.get(`/expense-categories/${id}`);
  return response.data;
};

/**
 * Creates a new expense category (OWNER only).
 * @param {Object} payload - { name, description }
 */
export const createExpenseCategoryApi = async (payload) => {
  const response = await client.post("/expense-categories", payload);
  return response.data;
};

/**
 * Updates an expense category (OWNER only).
 * @param {number|string} id
 * @param {Object} payload - { name, description }
 */
export const updateExpenseCategoryApi = async (id, payload) => {
  const response = await client.patch(`/expense-categories/${id}`, payload);
  return response.data;
};

/**
 * Sets active/inactive status of an expense category (OWNER only).
 * @param {number|string} id
 * @param {boolean} isActive
 */
export const setExpenseCategoryStatusApi = async (id, isActive) => {
  const response = await client.patch(`/expense-categories/${id}/status`, { is_active: isActive });
  return response.data;
};

/**
 * Fetches paginated expenses with filters.
 * @param {Object} params - { page, per_page, search, category_id, date_from, date_to, created_by }
 */
export const getExpensesApi = async (params = {}) => {
  const cleanParams = {};
  if (params.page) cleanParams.page = params.page;
  if (params.per_page) cleanParams.per_page = params.per_page;
  if (params.search && params.search.trim()) cleanParams.search = params.search.trim();
  if (params.category_id && params.category_id !== "ALL") cleanParams.category_id = params.category_id;
  if (params.date_from) cleanParams.date_from = params.date_from;
  if (params.date_to) cleanParams.date_to = params.date_to;
  if (params.created_by) cleanParams.created_by = params.created_by;

  const response = await client.get("/expenses", { params: cleanParams });
  return response.data;
};

/**
 * Fetches full details for a single expense.
 * @param {number|string} id
 */
export const getExpenseDetailApi = async (id) => {
  const response = await client.get(`/expenses/${id}`);
  return response.data;
};

/**
 * Records a new operating expense (OWNER or STAFF).
 * @param {Object} payload - { category_id, amount, expense_date, description }
 */
export const createExpenseApi = async (payload) => {
  const response = await client.post("/expenses", payload);
  return response.data;
};

/**
 * Updates an existing operating expense (OWNER only).
 * @param {number|string} id
 * @param {Object} payload - { category_id, amount, expense_date, description }
 */
export const updateExpenseApi = async (id, payload) => {
  const response = await client.patch(`/expenses/${id}`, payload);
  return response.data;
};
