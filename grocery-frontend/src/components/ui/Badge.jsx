export const Badge = ({
  children,
  variant = "neutral",
  size = "md",
  dot = false,
  className = "",
  style = {},
}) => {
  const variants = {
    neutral: {
      backgroundColor: "var(--color-slate-100)",
      color: "var(--color-slate-700)",
      borderColor: "var(--color-slate-200)",
      dotColor: "var(--color-slate-400)",
    },
    success: {
      backgroundColor: "var(--color-success-bg)",
      color: "var(--color-success-text)",
      borderColor: "var(--color-success-border)",
      dotColor: "var(--color-success)",
    },
    warning: {
      backgroundColor: "var(--color-warning-bg)",
      color: "var(--color-warning-text)",
      borderColor: "var(--color-warning-border)",
      dotColor: "var(--color-warning)",
    },
    danger: {
      backgroundColor: "var(--color-danger-bg)",
      color: "var(--color-danger-text)",
      borderColor: "var(--color-danger-border)",
      dotColor: "var(--color-danger)",
    },
    info: {
      backgroundColor: "var(--color-info-bg)",
      color: "var(--color-info-text)",
      borderColor: "var(--color-info-border)",
      dotColor: "var(--color-info)",
    },
    purple: {
      backgroundColor: "#f5f3ff",
      color: "#5b21b6",
      borderColor: "#ddd6fe",
      dotColor: "#7c3aed",
    },
  };

  const sizes = {
    sm: { padding: "2px 6px", fontSize: "11px", gap: "4px" },
    md: { padding: "3px 8px", fontSize: "12px", gap: "6px" },
    lg: { padding: "4px 12px", fontSize: "13px", gap: "6px" },
  };

  const selectedVariant = variants[variant] || variants.neutral;

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontWeight: 600,
        borderRadius: "var(--radius-full)",
        border: "1px solid",
        lineHeight: 1.2,
        letterSpacing: "0.01em",
        ...sizes[size],
        backgroundColor: selectedVariant.backgroundColor,
        color: selectedVariant.color,
        borderColor: selectedVariant.borderColor,
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: selectedVariant.dotColor,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
};

export default Badge;
