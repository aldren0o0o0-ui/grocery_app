import { useEffect, useRef } from "react";

export const Modal = ({
  isOpen = false,
  onClose,
  title,
  children,
  maxWidth = "540px",
  id = "common-modal",
}) => {
  const modalRef = useRef(null);

  // Close on Escape key press
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
        backgroundColor: "rgba(15, 23, 42, 0.5)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4)",
        zIndex: 100,
        boxSizing: "border-box",
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
        ref={modalRef}
        id={id}
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-modal)",
          border: "1px solid var(--color-border)",
          width: "100%",
          maxWidth,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          animation: "modalPop 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "var(--space-4) var(--space-5)",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "var(--color-surface)",
          }}
        >
          <h2
            id={`${id}-title`}
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: "700",
              color: "var(--color-text)",
              margin: 0,
              letterSpacing: "-0.01em",
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
                width: "28px",
                height: "28px",
                borderRadius: "var(--radius-sm)",
                transition: "background-color var(--transition-fast)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              aria-label="Close dialog"
            >
              ✕
            </button>
          )}
        </div>

        {/* Modal Body */}
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

export default Modal;
