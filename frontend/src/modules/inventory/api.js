import apiClient from "../../api/client";

export const getInventoryApi = async (params = {}) => {
  const response = await apiClient.get("/inventory", { params });
  return response.data;
};

export const getInventoryItemApi = async (productId) => {
  const response = await apiClient.get(`/inventory/${productId}`);
  return response.data;
};

export const getLowStockApi = async (params = {}) => {
  const response = await apiClient.get("/inventory/low-stock", { params });
  return response.data;
};

export const getStockMovementsApi = async (productId, params = {}) => {
  const response = await apiClient.get(`/inventory/${productId}/movements`, { params });
  return response.data;
};

export const createStockAdjustmentApi = async (payload) => {
  const response = await apiClient.post("/inventory/adjustments", payload);
  return response.data;
};
