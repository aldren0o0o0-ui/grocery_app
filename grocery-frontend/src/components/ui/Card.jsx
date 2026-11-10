export const Card = ({
  children,
  title,
  subtitle,
  action,
  icon: Icon,
  className = "",
  style = {},
  bodyStyle = {},
  hoverable = false,
  padding = "20px",
  ...props
}) => {
  return (
    <div
      className={className}
      style={{
        backgroundColor: "var(--bg-card)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-sm)",
        transition: "all var(--transition-normal)",
        overflow: "hidden",
        ...(hoverable
          ? {
              cursor: "pointer",
              ":hover": {
                boxShadow: "var(--shadow-md)",
                borderColor: "var(--color-slate-300)",
              },
            }
          : {}),
        ...style,
      }}
      {...props}
    >
      {(title || subtitle || action) && (
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {Icon && (
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-primary-50)",
                  color: "var(--color-primary-700)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={18} />
              </div>
            )}
            <div>
              {title && (
                <h3
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "var(--text-main)",
                    margin: 0,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {title}
                </h3>
              )}
              {subtitle && (
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    margin: "2px 0 0 0",
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div style={{ padding, ...bodyStyle }}>{children}</div>
    </div>
  );
};

export default Card;
