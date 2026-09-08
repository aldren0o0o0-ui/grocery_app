import apiClient from "../../api/client";

/**
 * Retrieves the list of users (filtered by role, active status, or search query).
 */
export const getUsersApi = async (params = {}) => {
  const response = await apiClient.get("/users", { params });
  return response.data;
};

/**
 * Provisions a new user account (Staff, Cashier, or Owner) by an authorized Owner.
 */
export const createUserApi = async (payload) => {
  const response = await apiClient.post("/users", payload);
  return response.data;
};

/**
 * Activates or deactivates a user account.
 */
export const setUserStatusApi = async (userId, isActive) => {
  const response = await apiClient.patch(`/users/${userId}/status`, {
    is_active: Boolean(isActive),
  });
  return response.data;
};
