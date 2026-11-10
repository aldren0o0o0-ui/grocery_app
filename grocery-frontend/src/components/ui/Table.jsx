export const Table = ({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = "No records found",
  emptyIcon: EmptyIcon,
  onRowClick,
  className = "",
  style = {},
}) => {
  return (
    <div
      style={{
        width: "100%",
        overflowX: "auto",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        backgroundColor: "#ffffff",
        boxShadow: "var(--shadow-xs)",
        ...style,
      }}
      className={className}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          textAlign: "left",
          fontSize: "13.5px",
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: "var(--color-slate-50)",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                style={{
                  padding: "12px 16px",
                  fontWeight: 600,
                  fontSize: "12px",
                  color: "var(--color-slate-500)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  textAlign: col.align || "left",
                  width: col.width,
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: "48px 16px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    width: "28px",
                    height: "28px",
                    border: "3px solid var(--color-slate-200)",
                    borderTopColor: "var(--color-primary-600)",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                <div style={{ marginTop: "12px", fontSize: "13px" }}>Loading data...</div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: "54px 16px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                }}
              >
                {EmptyIcon && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      color: "var(--color-slate-300)",
                      marginBottom: "12px",
                    }}
                  >
                    <EmptyIcon size={36} />
                  </div>
                )}
                <p style={{ fontSize: "14px", fontWeight: 500 }}>{emptyMessage}</p>
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr
                key={row.id || rowIdx}
                onClick={() => onRowClick?.(row)}
                style={{
                  borderBottom:
                    rowIdx === data.length - 1 ? "none" : "1px solid var(--color-slate-100)",
                  backgroundColor: "#ffffff",
                  cursor: onRowClick ? "pointer" : "default",
                  transition: "background-color var(--transition-fast)",
                }}
                onMouseEnter={(e) => {
                  if (onRowClick) e.currentTarget.style.backgroundColor = "var(--color-slate-50)";
                }}
                onMouseLeave={(e) => {
                  if (onRowClick) e.currentTarget.style.backgroundColor = "#ffffff";
                }}
              >
                {columns.map((col, colIdx) => (
                  <td
                    key={col.key || colIdx}
                    style={{
                      padding: "14px 16px",
                      color: "var(--text-main)",
                      textAlign: col.align || "left",
                    }}
                  >
                    {col.render ? col.render(row[col.key], row, rowIdx) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
