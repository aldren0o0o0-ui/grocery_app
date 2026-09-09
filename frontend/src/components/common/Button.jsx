export const Button = ({
  children,
  variant = "primary", // "primary" | "secondary" | "danger" | "ghost" | "icon"
  size = "md", // "sm" | "md" | "lg"
  loading = false,
  disabled = false,
  onClick,
  type = "button",
  icon,
  style = {},
  id,
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return {
          backgroundColor: "var(--color-primary)",
          color: "#FFFFFF",
          border: "1px solid var(--color-primary)",
        };
      case "secondary":
        return {
          backgroundColor: "var(--color-surface)",
          color: "var(--color-text)",
          border: "1px solid var(--color-border)",
        };
      case "danger":
        return {
          backgroundColor: "var(--color-danger)",
          color: "#FFFFFF",
          border: "1px solid var(--color-danger)",
        };
      case "ghost":
        return {
          backgroundColor: "transparent",
          color: "var(--color-text-secondary)",
          border: "1px solid transparent",
        };
      case "icon":
        return {
          backgroundColor: "transparent",
          color: "var(--color-text-secondary)",
          border: "1px solid var(--color-border)",
          padding: "6px",
        };
      default:
        return {
          backgroundColor: "var(--color-primary)",
          color: "#FFFFFF",
          border: "1px solid var(--color-primary)",
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case "sm":
        return {
          padding: variant === "icon" ? "4px" : "4px 10px",
          fontSize: "var(--text-xs)",
          borderRadius: "var(--radius-sm)",
        };
      case "lg":
        return {
          padding: variant === "icon" ? "10px" : "10px 20px",
          fontSize: "var(--text-md)",
          borderRadius: "var(--radius-md)",
        };
      default:
        return {
          padding: variant === "icon" ? "7px" : "7px 14px",
          fontSize: "var(--text-base)",
          borderRadius: "var(--radius-md)",
        };
    }
  };

  const isDisabled = disabled || loading;

  return (
    <button
      id={id}
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        fontWeight: "600",
        fontFamily: "var(--font-sans)",
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.6 : 1,
        transition: "all var(--transition-fast)",
        boxShadow: variant === "primary" ? "0 1px 2px rgba(34, 164, 93, 0.2)" : "var(--shadow-xs)",
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span>
      ) : (
        icon && <span>{icon}</span>
      )}
      {children}
    </button>
  );
};

export default Button;
