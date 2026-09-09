export const DataTable = ({
  columns = [],
  data = [],
  keyField = "id",
  loading = false,
  emptyTitle,
  emptyMessage = "No records found.",
  emptyAction,
  onRowClick,
  id,
}) => {
  return (
    <div
      id={id}
      style={{
        backgroundColor: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-xs)",
        overflow: "hidden",
        width: "100%",
      }}
    >
      <div style={{ overflowX: "auto", width: "100%" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "var(--text-base)",
            fontFamily: "var(--font-sans)",
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: "var(--color-bg)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              {columns.map((col, cIdx) => (
                <th
                  key={col.key || col.field || col.id || col.header || col.label || cIdx}
                  style={{
                    padding: "10px 14px",
                    textAlign: col.align || "left",
                    fontSize: "var(--text-xs)",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "var(--color-muted)",
                    whiteSpace: "nowrap",
                    width: col.width || "auto",
                  }}
                >
                  {col.label || col.header || col.title || ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length || 1}
                  style={{
                    padding: "var(--space-10) var(--space-4)",
                    textAlign: "center",
                    color: "var(--color-muted)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    <span
                      style={{
                        width: "16px",
                        height: "16px",
                        border: "2px solid var(--color-border)",
                        borderTopColor: "var(--color-primary)",
                        borderRadius: "50%",
                        display: "inline-block",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    <span style={{ fontWeight: "500", fontSize: "14px" }}>Loading data...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length || 1}
                  style={{
                    padding: "var(--space-10) var(--space-4)",
                    textAlign: "center",
                    color: "var(--color-muted)",
                  }}
                >
                  {emptyTitle && (
                    <div style={{ fontWeight: "700", fontSize: "15px", color: "var(--color-text)", marginBottom: "4px" }}>
                      {emptyTitle}
                    </div>
                  )}
                  <div style={{ fontWeight: "500", color: "var(--color-text-secondary)", marginBottom: "4px", fontSize: "13px" }}>
                    {emptyMessage}
                  </div>
                  {emptyAction && <div style={{ marginTop: "var(--space-3)" }}>{emptyAction}</div>}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={row[keyField] ?? idx}
                  onClick={() => onRowClick && onRowClick(row)}
                  style={{
                    borderBottom: "1px solid var(--color-border-subtle)",
                    transition: "background-color var(--transition-fast)",
                    cursor: onRowClick ? "pointer" : "default",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--color-surface-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {columns.map((col, cIdx) => {
                    let val;
                    if (typeof col.render === "function") {
                      const rawVal = (col.key || col.field) ? row[col.key || col.field] : row;
                      val = col.render(rawVal, row);
                    } else if (typeof col.accessor === "function") {
                      val = col.accessor(row);
                    } else if (typeof col.accessor === "string") {
                      val = row[col.accessor];
                    } else if (col.key || col.field) {
                      val = row[col.key || col.field];
                    }

                    return (
                      <td
                        key={col.key || col.field || col.id || col.header || col.label || cIdx}
                        style={{
                          padding: "12px 14px",
                          textAlign: col.align || "left",
                          color: "var(--color-text)",
                          verticalAlign: "middle",
                        }}
                      >
                        {val ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
