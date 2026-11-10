import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { ToastProvider } from "../ui";

export const AppShell = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <ToastProvider>
      <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-app)" }}>
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Topbar />
          <main style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
            <div style={{ maxWidth: "1400px", margin: "0 auto" }}>{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
};

export default AppShell;
