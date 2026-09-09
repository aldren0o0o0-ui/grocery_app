import Button from "./Button";

export const Pagination = ({
  page = 1,
  pages = 1,
  total = 0,
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  disabled = false,
  id,
}) => {
  const activePage = currentPage ?? page;
  const activePages = totalPages ?? pages;
  const activeTotal = totalItems ?? total;

  if (activePages <= 1 && activeTotal === 0) return null;

  return (
    <div
      id={id}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "var(--space-2)",
        marginTop: "var(--space-4)",
        padding: "0 var(--space-2)",
        fontSize: "var(--text-sm)",
        color: "var(--color-muted)",
      }}
    >
      <div>
        Showing Page <strong style={{ color: "var(--color-text)" }}>{activePage}</strong> of{" "}
        <strong style={{ color: "var(--color-text)" }}>{activePages || 1}</strong>
        {activeTotal > 0 && <span> ({activeTotal.toLocaleString()} total)</span>}
      </div>

      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || activePage <= 1}
          onClick={() => onPageChange && onPageChange(activePage - 1)}
        >
          &larr; Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || activePage >= activePages}
          onClick={() => onPageChange && onPageChange(activePage + 1)}
        >
          Next &rarr;
        </Button>
      </div>
    </div>
  );
};

export default Pagination;
