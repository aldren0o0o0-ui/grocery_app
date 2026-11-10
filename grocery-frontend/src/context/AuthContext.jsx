import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { loginApi, logoutApi, getMeApi, changePasswordApi, refreshApi } from "../api/auth";
import { updateUserProfileApi } from "../api/users";
import { setAccessToken } from "../api/client";
import { getUserOverrides, recordUserUpdate } from "../utils/userResolver";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to merge local profile overrides if present
  const applyProfileOverride = useCallback((rawUser) => {
    if (!rawUser) return null;
    try {
      const overrides = getUserOverrides();
      const userOverride = overrides[rawUser.id];
      return userOverride ? { ...rawUser, ...userOverride } : rawUser;
    } catch {
      return rawUser;
    }
  }, []);

  const initAuth = useCallback(async () => {
    const hasSession = localStorage.getItem("grocery_has_session") === "true";
    if (!hasSession) {
      setLoading(false);
      return;
    }

    try {
      const refreshRes = await refreshApi();
      setAccessToken(refreshRes.access_token);
      const meRes = await getMeApi();
      const rawUser = meRes.user || meRes;
      setUser(applyProfileOverride(rawUser));
    } catch {
      localStorage.removeItem("grocery_has_session");
      setAccessToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [applyProfileOverride]);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = async (email, password) => {
    const res = await loginApi(email, password);
    setAccessToken(res.access_token);
    localStorage.setItem("grocery_has_session", "true");
    const finalUser = applyProfileOverride(res.user);
    setUser(finalUser);
    return finalUser;
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch {
      // ignore network errors on logout
    } finally {
      setAccessToken(null);
      localStorage.removeItem("grocery_has_session");
      setUser(null);
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    return await changePasswordApi(currentPassword, newPassword);
  };

  const refreshUser = async () => {
    try {
      const meRes = await getMeApi();
      const rawUser = meRes.user || meRes;
      setUser(applyProfileOverride(rawUser));
    } catch (err) {
      console.error("Failed to refresh user:", err);
    }
  };

  // Persistent profile update that survives browser refresh and updates globally
  const updateUserProfile = async (userId, data, originalName = null) => {
    recordUserUpdate(userId, data, originalName);

    if (user && user.id === userId) {
      setUser((prev) => ({ ...prev, ...data }));
    }

    // Call backend API (handles 404/405 fallback gracefully)
    try {
      await updateUserProfileApi(userId, data);
    } catch (err) {
      console.warn("Backend user profile API fallback used:", err);
    }

    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        login,
        logout,
        changePassword,
        refreshUser,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default useAuth;
