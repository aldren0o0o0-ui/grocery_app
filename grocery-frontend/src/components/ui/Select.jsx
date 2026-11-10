import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

export const Select = forwardRef(
  (
    {
      label,
      error,
      helperText,
      options = [],
      className = "",
      style = {},
      selectStyle = {},
      required = false,
      id,
      children,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", ...style }}>
        {label && (
          <label
            htmlFor={selectId}
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text-main)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            {label}
            {required && <span style={{ color: "var(--color-danger)" }}>*</span>}
          </label>
        )}

        <div style={{ position: "relative", width: "100%", display: "flex", alignItems: "center" }}>
          <select
            ref={ref}
            id={selectId}
            style={{
              width: "100%",
              height: "40px",
              padding: "0 34px 0 12px",
              borderRadius: "var(--radius-md)",
              border: `1px solid ${error ? "var(--color-danger)" : "var(--color-slate-300)"}`,
              backgroundColor: props.disabled ? "var(--color-slate-50)" : "#ffffff",
              color: "var(--text-main)",
              fontSize: "14px",
              outline: "none",
              appearance: "none",
              transition: "border-color var(--transition-fast), box-shadow var(--transition-fast)",
              boxShadow: "var(--shadow-xs)",
              cursor: props.disabled ? "not-allowed" : "pointer",
              ...selectStyle,
            }}
            onFocus={(e) => {
              e.target.style.borderColor = error ? "var(--color-danger)" : "var(--border-focus)";
              e.target.style.boxShadow = error
                ? "0 0 0 3px rgba(239, 68, 68, 0.15)"
                : "0 0 0 3px rgba(16, 185, 129, 0.15)";
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              e.target.style.borderColor = error ? "var(--color-danger)" : "var(--color-slate-300)";
              e.target.style.boxShadow = "var(--shadow-xs)";
              props.onBlur?.(e);
            }}
            {...props}
          >
            {children
              ? children
              : options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
          </select>

          <div
            style={{
              position: "absolute",
              right: "12px",
              color: "var(--color-slate-400)",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
            }}
          >
            <ChevronDown size={16} />
          </div>
        </div>

        {error ? (
          <span style={{ fontSize: "12px", color: "var(--color-danger)", fontWeight: 500 }}>
            {error}
          </span>
        ) : helperText ? (
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {helperText}
          </span>
        ) : null}
      </div>
    );
  }
);

Select.displayName = "Select";

export default Select;
