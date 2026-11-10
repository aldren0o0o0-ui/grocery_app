import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import RoleRoute from "./components/auth/RoleRoute";
import AppShell from "./components/layout/AppShell";

// Feature Pages
import LoginPage from "./pages/LoginPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import DashboardPage from "./pages/DashboardPage";
import POSPage from "./pages/POSPage";
import SalesHistoryPage from "./pages/SalesHistoryPage";
import ReturnsPage from "./pages/ReturnsPage";
import ProductsPage from "./pages/ProductsPage";
import CategoriesPage from "./pages/CategoriesPage";
import InventoryPage from "./pages/InventoryPage";
import PurchasesPage from "./pages/PurchasesPage";
import PurchaseDetailPage from "./pages/PurchaseDetailPage";
import SuppliersPage from "./pages/SuppliersPage";
import ExpensesPage from "./pages/ExpensesPage";
import UsersPage from "./pages/UsersPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Protected Enterprise ERP Routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell>
                  <Outlet />
                </AppShell>
              </ProtectedRoute>
            }
          >
            {/* Overview Dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* Retail POS & Sales Operations */}
            <Route
              path="/pos"
              element={
                <RoleRoute allowedRoles={["OWNER", "CASHIER"]}>
                  <POSPage />
                </RoleRoute>
              }
            />
            <Route
              path="/sales"
              element={
                <RoleRoute allowedRoles={["OWNER", "CASHIER"]}>
                  <SalesHistoryPage />
                </RoleRoute>
              }
            />
            <Route
              path="/returns"
              element={
                <RoleRoute allowedRoles={["OWNER", "CASHIER"]}>
                  <ReturnsPage />
                </RoleRoute>
              }
            />

            {/* Catalog & Inventory Management */}
            <Route
              path="/products"
              element={
                <RoleRoute allowedRoles={["OWNER", "STAFF"]}>
                  <ProductsPage />
                </RoleRoute>
              }
            />
            <Route
              path="/categories"
              element={
                <RoleRoute allowedRoles={["OWNER", "STAFF"]}>
                  <CategoriesPage />
                </RoleRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <RoleRoute allowedRoles={["OWNER", "STAFF"]}>
                  <InventoryPage />
                </RoleRoute>
              }
            />

            {/* Procurement & Suppliers */}
            <Route
              path="/purchases"
              element={
                <RoleRoute allowedRoles={["OWNER", "STAFF"]}>
                  <PurchasesPage />
                </RoleRoute>
              }
            />
            <Route
              path="/purchases/:id"
              element={
                <RoleRoute allowedRoles={["OWNER", "STAFF"]}>
                  <PurchaseDetailPage />
                </RoleRoute>
              }
            />
            <Route
              path="/suppliers"
              element={
                <RoleRoute allowedRoles={["OWNER", "STAFF"]}>
                  <SuppliersPage />
                </RoleRoute>
              }
            />

            {/* Finance & Expenses */}
            <Route
              path="/expenses"
              element={
                <RoleRoute allowedRoles={["OWNER", "STAFF"]}>
                  <ExpensesPage />
                </RoleRoute>
              }
            />

            {/* Team & Staff (Owner Only) */}
            <Route
              path="/users"
              element={
                <RoleRoute allowedRoles={["OWNER"]}>
                  <UsersPage />
                </RoleRoute>
              }
            />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
