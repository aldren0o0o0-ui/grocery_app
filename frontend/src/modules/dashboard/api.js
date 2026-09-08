import client from "../../api/client";

/**
 * Fetches dashboard operational and KPI overview.
 * Backend responds with role-scoped data based on the authenticated JWT.
 * @param {Object} [params] - Optional params like { date: "YYYY-MM-DD" }
 */
export const getDashboardOverviewApi = async (params = {}) => {
  const cleanParams = {};
  if (params.date && params.date.trim()) {
    cleanParams.date = params.date.trim();
  }
  const response = await client.get("/dashboard/overview", { params: cleanParams });
  return response.data;
};
