import apiClient from "./client";

export const createReturnApi = async (payload) => {
  const response = await apiClient.post("/returns", payload);
  return response.data;
};

export const getReturnsApi = async (params = {}) => {
  const cleanParams = {};
  if (params.page) cleanParams.page = params.page;
  if (params.per_page) cleanParams.per_page = params.per_page;
  if (params.search && params.search.trim()) cleanParams.search = params.search.trim();
  if (params.refund_method && params.refund_method !== "ALL") cleanParams.refund_method = params.refund_method;
  if (params.date_from) cleanParams.date_from = params.date_from;
  if (params.date_to) cleanParams.date_to = params.date_to;
  if (params.processed_by) cleanParams.processed_by = params.processed_by;

  const response = await apiClient.get("/returns", { params: cleanParams });
  return response.data;
};

export const getReturnDetailApi = async (id) => {
  const response = await apiClient.get(`/returns/${id}`);
  return response.data;
};
