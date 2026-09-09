export const PageHeader = ({ title, subtitle, action, children }) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: "var(--space-3)",
        marginBottom: "var(--space-5)",
      }}
    >
      <div>
        <h1
          style={{
            fontSize: "var(--text-3xl)",
            fontWeight: "700",
            color: "var(--color-text)",
            margin: 0,
            letterSpacing: "-0.02em",
            lineHeight: 1.25,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-muted)",
              margin: "var(--space-1) 0 0 0",
              fontWeight: "400",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {(action || children) && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          {action}
          {children}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
