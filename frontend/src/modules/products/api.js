import apiClient from "../../api/client";

export const getProductsApi = async (params = {}) => {
  const response = await apiClient.get("/products", { params });
  return response.data;
};

export const getProductApi = async (productId) => {
  const response = await apiClient.get(`/products/${productId}`);
  return response.data;
};

export const createProductApi = async (data) => {
  const response = await apiClient.post("/products", data);
  return response.data;
};

export const updateProductApi = async (productId, data) => {
  const response = await apiClient.patch(`/products/${productId}`, data);
  return response.data;
};

export const setProductStatusApi = async (productId, isActive) => {
  const response = await apiClient.patch(`/products/${productId}/status`, {
    is_active: isActive,
  });
  return response.data;
};
