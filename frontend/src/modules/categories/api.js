import apiClient from "../../api/client";

export const getCategoriesApi = async (params = {}) => {
  const response = await apiClient.get("/categories", { params });
  return response.data;
};

export const getCategoryApi = async (categoryId) => {
  const response = await apiClient.get(`/categories/${categoryId}`);
  return response.data;
};

export const createCategoryApi = async (data) => {
  const response = await apiClient.post("/categories", data);
  return response.data;
};

export const updateCategoryApi = async (categoryId, data) => {
  const response = await apiClient.patch(`/categories/${categoryId}`, data);
  return response.data;
};

export const setCategoryStatusApi = async (categoryId, isActive) => {
  const response = await apiClient.patch(`/categories/${categoryId}/status`, {
    is_active: isActive,
  });
  return response.data;
};
