import apiClient from "../../api/client";

export const loginApi = async (email, password) => {
  const response = await apiClient.post("/auth/login", { email, password });
  return response.data;
};

export const refreshApi = async () => {
  const response = await apiClient.post("/auth/refresh");
  return response.data;
};

export const logoutApi = async () => {
  const response = await apiClient.post("/auth/logout");
  return response.data;
};

export const getMeApi = async () => {
  const response = await apiClient.get("/users/me");
  return response.data;
};

export const changePasswordApi = async (currentPassword, newPassword) => {
  const response = await apiClient.patch("/users/me/password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return response.data;
};
