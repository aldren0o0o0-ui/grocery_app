import apiClient from "./client";

export const getPosProductsApi = async (params = {}) => {
  const cleanParams = {};
  if (params.search && params.search.trim()) cleanParams.search = params.search.trim();
  if (params.category_id) cleanParams.category_id = params.category_id;
  if (params.page) cleanParams.page = params.page;
  if (params.per_page) cleanParams.per_page = params.per_page;

  const response = await apiClient.get("/sales/products", { params: cleanParams });
  return response.data;
};

export const checkoutSaleApi = async (payload) => {
  const response = await apiClient.post("/sales", payload);
  return response.data;
};

export const getSalesApi = async (params = {}) => {
  const cleanParams = {};
  if (params.page) cleanParams.page = params.page;
  if (params.per_page) cleanParams.per_page = params.per_page;
  if (params.search && params.search.trim()) cleanParams.search = params.search.trim();
  if (params.status && params.status !== "ALL") cleanParams.status = params.status;
  if (params.payment_method && params.payment_method !== "ALL") cleanParams.payment_method = params.payment_method;
  if (params.date_from) cleanParams.date_from = params.date_from;
  if (params.date_to) cleanParams.date_to = params.date_to;
  if (params.cashier_id) cleanParams.cashier_id = params.cashier_id;

  const response = await apiClient.get("/sales", { params: cleanParams });
  return response.data;
};

export const getSaleDetailApi = async (id) => {
  const response = await apiClient.get(`/sales/${id}`);
  return response.data;
};
