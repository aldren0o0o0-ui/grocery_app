import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "success", duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          maxWidth: "400px",
        }}
      >
        {toasts.map((t) => {
          const isSuccess = t.type === "success";
          const isError = t.type === "error";
          const isInfo = t.type === "info";

          const borderColors = {
            success: "var(--color-primary-500)",
            error: "var(--color-danger)",
            info: "var(--color-info)",
          };

          return (
            <div
              key={t.id}
              className="animate-slide-right"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                padding: "12px 16px",
                backgroundColor: "#ffffff",
                color: "var(--text-main)",
                borderRadius: "var(--radius-lg)",
                borderLeft: `4px solid ${borderColors[t.type] || "var(--color-primary-500)"}`,
                boxShadow: "var(--shadow-lg)",
                fontSize: "13.5px",
                fontWeight: 500,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {isSuccess && (
                  <CheckCircle2 size={18} style={{ color: "var(--color-primary-600)", flexShrink: 0 }} />
                )}
                {isError && (
                  <AlertCircle size={18} style={{ color: "var(--color-danger)", flexShrink: 0 }} />
                )}
                {isInfo && (
                  <Info size={18} style={{ color: "var(--color-info)", flexShrink: 0 }} />
                )}
                <span>{t.message}</span>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                style={{
                  color: "var(--color-slate-400)",
                  padding: "2px",
                  borderRadius: "var(--radius-xs)",
                }}
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export default useToast;
