export const Skeleton = ({
  width = "100%",
  height = "20px",
  borderRadius = "var(--radius-sm)",
  style = {},
}) => {
  return (
    <div
      className="animate-pulse"
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: "var(--color-slate-200)",
        ...style,
      }}
    />
  );
};

export const TableSkeleton = ({ rows = 5, cols = 4 }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px" }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: "flex", gap: "16px" }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height="28px" style={{ flex: c === 0 ? 2 : 1 }} />
          ))}
        </div>
      ))}
    </div>
  );
};

export default Skeleton;
