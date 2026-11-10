import apiClient from "./client";

export const getExpenseCategoriesApi = async (params = {}) => {
  const cleanParams = {};
  if (params.is_active !== undefined && params.is_active !== "ALL") {
    cleanParams.is_active = params.is_active;
  }
  if (params.search && params.search.trim()) {
    cleanParams.search = params.search.trim();
  }
  const response = await apiClient.get("/expense-categories", { params: cleanParams });
  return response.data;
};

export const getExpenseCategoryApi = async (id) => {
  const response = await apiClient.get(`/expense-categories/${id}`);
  return response.data;
};

export const createExpenseCategoryApi = async (payload) => {
  const response = await apiClient.post("/expense-categories", payload);
  return response.data;
};

export const updateExpenseCategoryApi = async (id, payload) => {
  const response = await apiClient.patch(`/expense-categories/${id}`, payload);
  return response.data;
};

export const setExpenseCategoryStatusApi = async (id, isActive) => {
  const response = await apiClient.patch(`/expense-categories/${id}/status`, { is_active: isActive });
  return response.data;
};

export const getExpensesApi = async (params = {}) => {
  const cleanParams = {};
  if (params.page) cleanParams.page = params.page;
  if (params.per_page) cleanParams.per_page = params.per_page;
  if (params.search && params.search.trim()) cleanParams.search = params.search.trim();
  if (params.category_id && params.category_id !== "ALL") cleanParams.category_id = params.category_id;
  if (params.date_from) cleanParams.date_from = params.date_from;
  if (params.date_to) cleanParams.date_to = params.date_to;
  if (params.created_by) cleanParams.created_by = params.created_by;

  const response = await apiClient.get("/expenses", { params: cleanParams });
  return response.data;
};

export const getExpenseDetailApi = async (id) => {
  const response = await apiClient.get(`/expenses/${id}`);
  return response.data;
};

export const createExpenseApi = async (payload) => {
  const response = await apiClient.post("/expenses", payload);
  return response.data;
};

export const updateExpenseApi = async (id, payload) => {
  const response = await apiClient.patch(`/expenses/${id}`, payload);
  return response.data;
};
