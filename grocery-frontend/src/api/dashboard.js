import apiClient from "./client";

export const getDashboardOverviewApi = async (params = {}) => {
  const cleanParams = {};
  if (params.date && params.date.trim()) {
    cleanParams.date = params.date.trim();
  }
  const response = await apiClient.get("/dashboard/overview", { params: cleanParams });
  return response.data;
};
