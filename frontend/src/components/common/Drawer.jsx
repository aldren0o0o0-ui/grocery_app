import { useEffect } from "react";

export const Drawer = ({
  isOpen = false,
  onClose,
  title,
  children,
  width = "480px",
  id = "common-drawer",
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (onClose) onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.4)",
        backdropFilter: "blur(2px)",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
    >
      <div
        id={id}
        style={{
          width: "100%",
          maxWidth: width,
          height: "100%",
          backgroundColor: "var(--color-surface)",
          boxShadow: "var(--shadow-modal)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "drawerSlideIn 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: "var(--space-4) var(--space-5)",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            id={`${id}-title`}
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: "700",
              color: "var(--color-text)",
              margin: 0,
            }}
          >
            {title}
          </h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-muted)",
                cursor: "pointer",
                fontSize: "1.1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "30px",
                height: "30px",
                borderRadius: "var(--radius-sm)",
              }}
              aria-label="Close drawer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Drawer Content */}
        <div
          style={{
            padding: "var(--space-5)",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default Drawer;
