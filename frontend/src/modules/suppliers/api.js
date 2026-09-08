import apiClient from "../../api/client";

export const getSuppliersApi = async (params = {}) => {
  const response = await apiClient.get("/suppliers", { params });
  return response.data;
};

export const getSupplierApi = async (supplierId) => {
  const response = await apiClient.get(`/suppliers/${supplierId}`);
  return response.data;
};

export const createSupplierApi = async (data) => {
  const response = await apiClient.post("/suppliers", data);
  return response.data;
};

export const updateSupplierApi = async (supplierId, data) => {
  const response = await apiClient.patch(`/suppliers/${supplierId}`, data);
  return response.data;
};

export const setSupplierStatusApi = async (supplierId, isActive) => {
  const response = await apiClient.patch(`/suppliers/${supplierId}/status`, {
    is_active: isActive,
  });
  return response.data;
};
