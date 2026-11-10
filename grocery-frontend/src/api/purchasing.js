import apiClient from "./client";

export const getPurchasesApi = async (params = {}) => {
  const cleanParams = {};
  if (params.page) cleanParams.page = params.page;
  if (params.per_page) cleanParams.per_page = params.per_page;
  if (params.status && params.status !== "ALL") cleanParams.status = params.status;
  if (params.supplier_id) cleanParams.supplier_id = params.supplier_id;
  if (params.start_date) cleanParams.start_date = params.start_date;
  if (params.end_date) cleanParams.end_date = params.end_date;
  if (params.search && params.search.trim()) cleanParams.search = params.search.trim();

  const response = await apiClient.get("/purchases", { params: cleanParams });
  return response.data;
};

export const getPurchaseApi = async (id) => {
  const response = await apiClient.get(`/purchases/${id}`);
  return response.data;
};

export const createPurchaseApi = async (payload) => {
  const response = await apiClient.post("/purchases", payload);
  return response.data;
};

export const addPurchaseItemApi = async (purchaseId, itemPayload) => {
  const response = await apiClient.post(`/purchases/${purchaseId}/items`, itemPayload);
  return response.data;
};

export const updatePurchaseItemApi = async (purchaseId, itemId, itemPayload) => {
  const response = await apiClient.patch(`/purchases/${purchaseId}/items/${itemId}`, itemPayload);
  return response.data;
};

export const removePurchaseItemApi = async (purchaseId, itemId) => {
  const response = await apiClient.delete(`/purchases/${purchaseId}/items/${itemId}`);
  return response.data;
};

export const receivePurchaseApi = async (id) => {
  const response = await apiClient.post(`/purchases/${id}/receive`);
  return response.data;
};

export const cancelPurchaseApi = async (id) => {
  const response = await apiClient.post(`/purchases/${id}/cancel`);
  return response.data;
};

export const deletePurchaseApi = async (id) => {
  const response = await apiClient.delete(`/purchases/${id}`);
  return response.data;
};
