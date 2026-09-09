import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileNav from "./MobileNav";

export const AppShell = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  return (
    <div className="app-shell" id="app-shell">
      {/* Role-Scoped Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isMobileOpen={isMobileDrawerOpen}
        onCloseMobile={() => setIsMobileDrawerOpen(false)}
      />

      {/* Main Canvas */}
      <div className={`app-main-content ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <Topbar onOpenMobile={() => setIsMobileDrawerOpen(true)} />
        <main className="page-container" id="main-content">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (< 768px) */}
      <MobileNav onOpenMore={() => setIsMobileDrawerOpen(true)} />
    </div>
  );
};

export default AppShell;
