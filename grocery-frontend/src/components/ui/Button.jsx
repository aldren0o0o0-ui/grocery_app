export const Button = ({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  disabled = false,
  className = "",
  style = {},
  type = "button",
  onClick,
  ...props
}) => {
  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontWeight: 600,
    borderRadius: "var(--radius-md)",
    transition: "all var(--transition-fast)",
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.6 : 1,
    whiteSpace: "nowrap",
    userSelect: "none",
    border: "1px solid transparent",
  };

  const sizes = {
    xs: { padding: "4px 8px", fontSize: "12px", height: "28px" },
    sm: { padding: "6px 12px", fontSize: "13px", height: "34px" },
    md: { padding: "8px 16px", fontSize: "14px", height: "40px" },
    lg: { padding: "10px 22px", fontSize: "15px", height: "46px" },
  };

  const variants = {
    primary: {
      backgroundColor: "var(--color-primary-600)",
      color: "#ffffff",
      borderColor: "var(--color-primary-700)",
      boxShadow: "0 1px 2px rgba(5, 150, 105, 0.2)",
    },
    secondary: {
      backgroundColor: "var(--color-slate-100)",
      color: "var(--color-slate-800)",
      borderColor: "var(--color-slate-200)",
    },
    outline: {
      backgroundColor: "#ffffff",
      color: "var(--color-slate-700)",
      borderColor: "var(--color-slate-300)",
      boxShadow: "var(--shadow-xs)",
    },
    ghost: {
      backgroundColor: "transparent",
      color: "var(--color-slate-600)",
      borderColor: "transparent",
    },
    danger: {
      backgroundColor: "var(--color-danger)",
      color: "#ffffff",
      borderColor: "#dc2626",
      boxShadow: "0 1px 2px rgba(239, 68, 68, 0.2)",
    },
    success: {
      backgroundColor: "var(--color-success)",
      color: "#ffffff",
      borderColor: "var(--color-primary-700)",
    },
  };

  const combinedStyle = {
    ...baseStyle,
    ...sizes[size],
    ...variants[variant],
    ...style,
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      style={combinedStyle}
      className={`btn-freshflow ${className}`}
      {...props}
    >
      {loading ? (
        <span
          style={{
            width: "16px",
            height: "16px",
            border: "2px solid currentColor",
            borderRightColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
            display: "inline-block",
          }}
        />
      ) : Icon ? (
        <Icon size={size === "xs" ? 14 : size === "sm" ? 16 : 18} />
      ) : null}

      {children}

      {!loading && IconRight && (
        <IconRight size={size === "xs" ? 14 : size === "sm" ? 16 : 18} />
      )}
    </button>
  );
};

export default Button;
