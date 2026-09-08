import { createContext, useEffect, useState, useCallback } from "react";

import { loginApi, logoutApi, refreshApi, getMeApi } from "./api";
import { setAccessToken as setAxiosAccessToken } from "../../api/client";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyAuthSuccess = useCallback((token, userData) => {
    setAccessToken(token);
    setAxiosAccessToken(token);
    setUser(userData);
  }, []);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setAxiosAccessToken(null);
    setUser(null);
  }, []);

  const login = async (email, password) => {
    const data = await loginApi(email, password);
    applyAuthSuccess(data.access_token, data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await logoutApi();
    } finally {
      clearAuth();
    }
  };

  const refresh = async () => {
    try {
      const data = await refreshApi();
      applyAuthSuccess(data.access_token, data.user);
      return data;
    } catch (err) {
      clearAuth();
      throw err;
    }
  };

  const loadCurrentUser = async () => {
    try {
      const data = await getMeApi();
      setUser(data.user);
      return data.user;
    } catch (err) {
      clearAuth();
      throw err;
    }
  };

  // Silent session restore on initial page load via HttpOnly cookie
  useEffect(() => {
    const initAuth = async () => {
      try {
        const data = await refreshApi();
        applyAuthSuccess(data.access_token, data.user);
      } catch {
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [applyAuthSuccess, clearAuth]);

  const value = {
    user,
    accessToken,
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    login,
    logout,
    refresh,
    loadCurrentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;

