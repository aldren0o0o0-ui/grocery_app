import { Button } from "./Button";

export const PageLoading = ({ message = "Loading data..." }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        gap: "16px",
        color: "var(--color-text-secondary)",
      }}
    >
      <div
        style={{
          width: "36px",
          height: "36px",
          border: "3px solid var(--color-border)",
          borderTopColor: "var(--color-primary)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <span style={{ fontSize: "14px", fontWeight: 500 }}>{message}</span>
    </div>
  );
};

export const EmptyState = ({
  icon,
  title = "No data found",
  message = "There are no records matching your request.",
  actionLabel,
  onAction,
  style = {},
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
        backgroundColor: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px dashed var(--color-border)",
        maxWidth: "540px",
        margin: "24px auto",
        ...style,
      }}
    >
      <div
        style={{
          width: "52px",
          height: "52px",
          borderRadius: "50%",
          backgroundColor: "var(--color-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "16px",
          color: "var(--color-text-muted)",
        }}
      >
        {icon || (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
        )}
      </div>

      <h3
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: "var(--color-text)",
          margin: "0 0 6px 0",
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontSize: "13px",
          color: "var(--color-text-secondary)",
          margin: "0 0 20px 0",
          maxWidth: "380px",
          lineHeight: 1.5,
        }}
      >
        {message}
      </p>

      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export const ErrorState = ({
  title = "Something went wrong",
  message = "Failed to load data from server.",
  onRetry,
  style = {},
}) => {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "36px 24px",
        textAlign: "center",
        backgroundColor: "var(--color-danger-soft)",
        border: "1px solid rgba(220, 38, 38, 0.2)",
        borderRadius: "var(--radius-lg)",
        maxWidth: "540px",
        margin: "24px auto",
        ...style,
      }}
    >
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          backgroundColor: "#FEE2E2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "12px",
          color: "var(--color-danger)",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>

      <h3
        style={{
          fontSize: "15px",
          fontWeight: 600,
          color: "var(--color-danger)",
          margin: "0 0 6px 0",
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontSize: "13px",
          color: "#991B1B",
          margin: "0 0 16px 0",
          maxWidth: "380px",
          lineHeight: 1.5,
        }}
      >
        {message}
      </p>

      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
};
