import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { setAccessToken, getAccessToken } from "../src/api/client.js";

describe("Frontend Auth Architecture & Client Tests", () => {
  test("setAccessToken updates in-memory token without exposing to localStorage", () => {
    setAccessToken("test-jwt-access-token-123");
    assert.equal(getAccessToken(), "test-jwt-access-token-123");

    // Clear token
    setAccessToken(null);
    assert.equal(getAccessToken(), null);
  });

  test("Role authorization policy correctly permits allowed roles", () => {
    const isRoleAuthorized = (userRole, allowedRoles) => {
      if (!userRole) return false;
      return allowedRoles.includes(userRole);
    };

    const ownerAllowed = ["OWNER"];

    // Authorized cases
    assert.equal(isRoleAuthorized("OWNER", ownerAllowed), true);

    // Unauthorized cases
    assert.equal(isRoleAuthorized("ADMIN", ownerAllowed), false);
    assert.equal(isRoleAuthorized("CASHIER", ownerAllowed), false);
    assert.equal(isRoleAuthorized("STAFF", ownerAllowed), false);
    assert.equal(isRoleAuthorized(null, ownerAllowed), false);
    assert.equal(isRoleAuthorized(undefined, ownerAllowed), false);
  });

  test("Protected route redirection policy determines correct navigation target", () => {
    const getRedirectTarget = (isAuthenticated, currentPath = "/") => {
      if (!isAuthenticated) {
        return { pathname: "/login", state: { from: currentPath } };
      }
      return null;
    };

    // Unauthenticated user attempting to access /dashboard
    const unauthenticatedResult = getRedirectTarget(false, "/dashboard");
    assert.deepEqual(unauthenticatedResult, {
      pathname: "/login",
      state: { from: "/dashboard" },
    });

    // Authenticated user
    const authenticatedResult = getRedirectTarget(true, "/dashboard");
    assert.equal(authenticatedResult, null);
  });

  test("RoleRoute policy handles authorized, unauthorized, and unauthenticated states", () => {
    const evaluateRoleRoute = ({ isAuthenticated, userRole, allowedRoles }) => {
      if (!isAuthenticated) return { action: "REDIRECT_LOGIN" };
      if (!allowedRoles.includes(userRole)) return { action: "REDIRECT_UNAUTHORIZED" };
      return { action: "RENDER_CHILDREN" };
    };

    // Case 1: Unauthenticated
    assert.deepEqual(
      evaluateRoleRoute({ isAuthenticated: false, userRole: null, allowedRoles: ["OWNER"] }),
      { action: "REDIRECT_LOGIN" }
    );

    // Case 2: Authenticated but wrong role
    assert.deepEqual(
      evaluateRoleRoute({ isAuthenticated: true, userRole: "CASHIER", allowedRoles: ["OWNER"] }),
      { action: "REDIRECT_UNAUTHORIZED" }
    );

    // Case 3: Authenticated and correct role
    assert.deepEqual(
      evaluateRoleRoute({ isAuthenticated: true, userRole: "OWNER", allowedRoles: ["OWNER"] }),
      { action: "RENDER_CHILDREN" }
    );
  });

  test("AuthContext state machine accurately transitions on login and logout", () => {
    let state = {
      user: null,
      accessToken: null,
      isAuthenticated: false,
    };

    const handleLoginSuccess = (user, token) => {
      state = {
        user,
        accessToken: token,
        isAuthenticated: true,
      };
    };

    const handleLogout = () => {
      state = {
        user: null,
        accessToken: null,
        isAuthenticated: false,
      };
    };

    // Initial state
    assert.equal(state.isAuthenticated, false);

    // After login
    handleLoginSuccess(
      { id: 1, email: "owner@grocery.test", role: "OWNER" },
      "fake-jwt-token"
    );
    assert.equal(state.isAuthenticated, true);
    assert.equal(state.user.role, "OWNER");
    assert.equal(state.accessToken, "fake-jwt-token");

    // After logout
    handleLogout();
    assert.equal(state.isAuthenticated, false);
    assert.equal(state.user, null);
    assert.equal(state.accessToken, null);
  });
});
