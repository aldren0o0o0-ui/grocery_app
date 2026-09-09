export const StatusBadge = ({ status, label }) => {
  if (!status) return null;

  const normalized = String(status).toUpperCase();
  const displayLabel = label || normalized.replace(/_/g, " ");

  const getStyle = () => {
    switch (normalized) {
      // Positive / Success
      case "ACTIVE":
      case "IN_STOCK":
      case "RECEIVED":
      case "COMPLETED":
        return {
          backgroundColor: "var(--color-success-soft)",
          color: "var(--color-success-text)",
          border: "1px solid var(--color-success-border)",
        };

      // Warning / Attention
      case "LOW_STOCK":
      case "DRAFT":
      case "PARTIAL":
      case "OWNER":
        return {
          backgroundColor: "var(--color-warning-soft)",
          color: "var(--color-warning-text)",
          border: "1px solid var(--color-warning-border)",
        };

      // Danger / Problem / Terminal
      case "OUT_OF_STOCK":
      case "CANCELLED":
      case "INACTIVE":
        return {
          backgroundColor: "var(--color-danger-soft)",
          color: "var(--color-danger-text)",
          border: "1px solid var(--color-danger-border)",
        };

      // Info / Return / Neutral
      case "RETURNED":
      case "FULL":
      case "STAFF":
        return {
          backgroundColor: "var(--color-info-soft)",
          color: "var(--color-info-text)",
          border: "1px solid var(--color-info-border)",
        };

      case "CASHIER":
        return {
          backgroundColor: "var(--color-primary-soft)",
          color: "var(--color-primary)",
          border: "1px solid var(--color-primary-border)",
        };

      default:
        return {
          backgroundColor: "var(--color-bg)",
          color: "var(--color-muted)",
          border: "1px solid var(--color-border)",
        };
    }
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: "var(--radius-pill)",
        fontSize: "var(--text-xs)",
        fontWeight: "700",
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
        ...getStyle(),
      }}
    >
      {displayLabel}
    </span>
  );
};

export default StatusBadge;
