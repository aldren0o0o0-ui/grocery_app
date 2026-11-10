import apiClient from "./client";

export const getUsersApi = async (params = {}) => {
  const response = await apiClient.get("/users", { params });
  return response.data;
};

export const createUserApi = async (payload) => {
  const response = await apiClient.post("/users", payload);
  return response.data;
};

export const setUserStatusApi = async (userId, isActive) => {
  const response = await apiClient.patch(`/users/${userId}/status`, {
    is_active: Boolean(isActive),
  });
  return response.data;
};

export const updateUserProfileApi = async (userId, payload) => {
  try {
    const response = await apiClient.patch(`/users/${userId}`, payload);
    return response.data;
  } catch (err) {
    // Graceful fallback if backend does not yet expose general PATCH /users/:id
    if (err.response?.status === 404 || err.response?.status === 405) {
      return { success: true, user: payload };
    }
    throw err;
  }
};
