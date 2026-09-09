import { useEffect } from "react";

export const Toast = ({
  message,
  type = "info", // "success" | "error" | "info" | "warning"
  onClose,
  duration = 4000,
  action,
}) => {
  useEffect(() => {
    if (duration && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getColors = () => {
    switch (type) {
      case "success":
        return {
          bg: "#ECFDF5",
          border: "#10B981",
          text: "#065F46",
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ),
        };
      case "error":
        return {
          bg: "#FEF2F2",
          border: "#EF4444",
          text: "#991B1B",
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          ),
        };
      case "warning":
        return {
          bg: "#FFFBEB",
          border: "#F59E0B",
          text: "#92400E",
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          ),
        };
      default: // info
        return {
          bg: "#EFF6FF",
          border: "#3B82F6",
          text: "#1E40AF",
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          ),
        };
    }
  };

  const colors = getColors();

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 14px",
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: "var(--radius-md)",
        color: colors.text,
        fontSize: "13px",
        fontWeight: 500,
        boxShadow: "var(--shadow-md)",
        animation: "toastSlide 0.2s ease-out",
      }}
    >
      <style>{`
        @keyframes toastSlide {
          from { transform: translateY(-8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <span style={{ display: "flex", flexShrink: 0 }}>{colors.icon}</span>
      <span style={{ flex: 1 }}>{message}</span>
      {action && <span>{action}</span>}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          style={{
            background: "none",
            border: "none",
            color: colors.text,
            cursor: "pointer",
            padding: "2px",
            display: "flex",
            alignItems: "center",
            opacity: 0.7,
            borderRadius: "4px",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      )}
    </div>
  );
};
