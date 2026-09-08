import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { AuthProvider } from "./modules/auth/AuthContext";
import useAuth from "./modules/auth/useAuth";
import ProtectedRoute from "./modules/auth/ProtectedRoute";
import RoleRoute from "./modules/auth/RoleRoute";

import LoginPage from "./pages/LoginPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import CategoriesPage from "./pages/CategoriesPage";
import ProductsPage from "./pages/ProductsPage";
import InventoryPage from "./pages/InventoryPage";
import SuppliersPage from "./pages/SuppliersPage";
import UsersPage from "./pages/UsersPage";
import PurchasesPage from "./pages/PurchasesPage";
import PurchaseDetailPage from "./pages/PurchaseDetailPage";
import POSPage from "./pages/POSPage";
import SalesHistoryPage from "./pages/SalesHistoryPage";
import ReturnsPage from "./pages/ReturnsPage";
import ExpensesPage from "./pages/ExpensesPage";
import DashboardPage from "./pages/DashboardPage";

export const HomePage = () => {
  const { user, logout } = useAuth();

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f9fafb",
        padding: "2rem",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <header
        style={{
          maxWidth: "800px",
          margin: "0 auto 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: "1rem",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#111827" }}>Grocery SME System</h1>
        <button
          onClick={logout}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#ef4444",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          Sign Out
        </button>
      </header>

      <main
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          borderRadius: "8px",
          padding: "2rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", color: "#1f2937", marginTop: 0 }}>
          Welcome, {user?.first_name} {user?.last_name}!
        </h2>
        <div style={{ marginTop: "1rem", lineHeight: "1.8", color: "#374151" }}>
          <p>
            <strong>Email:</strong> {user?.email}
          </p>
          <p>
            <strong>Role:</strong>{" "}
            <span
              style={{
                display: "inline-block",
                padding: "0.2rem 0.6rem",
                borderRadius: "9999px",
                backgroundColor: "#e0e7ff",
                color: "#3730a3",
                fontWeight: "600",
                fontSize: "0.875rem",
              }}
            >
              {user?.role}
            </span>
          </p>
          <p>
            <strong>Account Status:</strong>{" "}
            <span style={{ color: user?.is_active ? "#16a34a" : "#dc2626", fontWeight: "600" }}>
              {user?.is_active ? "Active" : "Inactive"}
            </span>
          </p>
        </div>

        <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid #f3f4f6", display: "flex", gap: "1rem" }}>
          <Link
            to="/products"
            style={{
              padding: "0.6rem 1.25rem",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              borderRadius: "6px",
              fontWeight: "600",
              textDecoration: "none",
            }}
          >
            Go to Products Catalog &rarr;
          </Link>
          <Link
            to="/categories"
            style={{
              padding: "0.6rem 1.25rem",
              backgroundColor: "#f1f5f9",
              border: "1px solid #cbd5e1",
              color: "#334155",
              borderRadius: "6px",
              fontWeight: "600",
              textDecoration: "none",
            }}
          >
            Manage Categories
          </Link>
          {["OWNER", "CASHIER"].includes(user?.role) && (
            <Link
              to="/pos"
              style={{
                padding: "0.6rem 1.25rem",
                backgroundColor: "#16a34a",
                color: "#ffffff",
                borderRadius: "6px",
                fontWeight: "600",
                textDecoration: "none",
              }}
            >
              Open POS &rarr;
            </Link>
          )}
          {["OWNER", "CASHIER"].includes(user?.role) && (
            <Link
              to="/sales"
              style={{
                padding: "0.6rem 1.25rem",
                backgroundColor: "#0284c7",
                color: "#ffffff",
                borderRadius: "6px",
                fontWeight: "600",
                textDecoration: "none",
              }}
            >
              Sales History
            </Link>
          )}
          {["OWNER", "STAFF"].includes(user?.role) && (
            <Link
              to="/purchases"
              style={{
                padding: "0.6rem 1.25rem",
                backgroundColor: "#0d9488",
                color: "#ffffff",
                borderRadius: "6px",
                fontWeight: "600",
                textDecoration: "none",
              }}
            >
              Purchases & Stock In &rarr;
            </Link>
          )}
          {user?.role === "OWNER" && (
            <Link
              to="/users"
              style={{
                padding: "0.6rem 1.25rem",
                backgroundColor: "#4f46e5",
                color: "#ffffff",
                borderRadius: "6px",
                fontWeight: "600",
                textDecoration: "none",
              }}
            >
              Manage Team & Users
            </Link>
          )}
        </div>
      </main>
    </div>
  );
};

const AdminPreviewPage = () => {
  const { user } = useAuth();
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: "800px", margin: "0 auto" }}>
      <h2>Admin-Only Management Preview</h2>
      <p>
        Verified access granted to <strong>{user?.email}</strong> (Role: <strong>{user?.role}</strong>).
      </p>
      <Link to="/" style={{ color: "#2563eb", textDecoration: "underline" }}>
        &larr; Back to Home
      </Link>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Standard Authenticated Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <ProductsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute>
                <InventoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <ProtectedRoute>
                <CategoriesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/suppliers"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OWNER", "STAFF"]}>
                  <SuppliersPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/purchases"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OWNER", "STAFF"]}>
                  <PurchasesPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/purchases/:id"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OWNER", "STAFF"]}>
                  <PurchaseDetailPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pos"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OWNER", "CASHIER"]}>
                  <POSPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OWNER", "CASHIER"]}>
                  <SalesHistoryPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/returns"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OWNER", "CASHIER"]}>
                  <ReturnsPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OWNER", "STAFF"]}>
                  <ExpensesPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OWNER"]}>
                  <UsersPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Role-Protected Route Example */}
          <Route
            path="/admin-preview"
            element={
              <ProtectedRoute>
                <RoleRoute allowedRoles={["OWNER"]}>
                  <AdminPreviewPage />
                </RoleRoute>
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;