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
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("grocery_has_session", "true");
      }
    } catch {
      // ignore storage access errors
    }
  }, []);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setAxiosAccessToken(null);
    setUser(null);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem("grocery_has_session");
      }
    } catch {
      // ignore storage access errors
    }
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
    let ignore = false;

    const initAuth = async () => {
      let hasSessionHint = false;
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          hasSessionHint = window.localStorage.getItem("grocery_has_session") === "true";
        }
      } catch {
        hasSessionHint = false;
      }

      if (!hasSessionHint) {
        if (!ignore) {
          clearAuth();
          setIsLoading(false);
        }
        return;
      }

      try {
        const data = await refreshApi();
        if (!ignore) {
          applyAuthSuccess(data.access_token, data.user);
        }
      } catch {
        if (!ignore) {
          clearAuth();
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      ignore = true;
    };
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

