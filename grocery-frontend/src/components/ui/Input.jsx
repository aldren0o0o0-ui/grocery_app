import { forwardRef } from "react";

export const Input = forwardRef(
  (
    {
      label,
      error,
      helperText,
      icon: Icon,
      suffix,
      className = "",
      style = {},
      inputStyle = {},
      required = false,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", ...style }}>
        {label && (
          <label
            htmlFor={inputId}
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

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            width: "100%",
          }}
        >
          {Icon && (
            <div
              style={{
                position: "absolute",
                left: "12px",
                color: "var(--color-slate-400)",
                display: "flex",
                alignItems: "center",
                pointerEvents: "none",
              }}
            >
              <Icon size={16} />
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            style={{
              width: "100%",
              height: "40px",
              padding: `0 12px 0 ${Icon ? "38px" : "12px"}`,
              paddingRight: suffix ? "40px" : "12px",
              borderRadius: "var(--radius-md)",
              border: `1px solid ${error ? "var(--color-danger)" : "var(--color-slate-300)"}`,
              backgroundColor: props.disabled ? "var(--color-slate-50)" : "#ffffff",
              color: "var(--text-main)",
              fontSize: "14px",
              outline: "none",
              transition: "border-color var(--transition-fast), box-shadow var(--transition-fast)",
              boxShadow: "var(--shadow-xs)",
              ...inputStyle,
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
          />

          {suffix && (
            <div
              style={{
                position: "absolute",
                right: "12px",
                display: "flex",
                alignItems: "center",
              }}
            >
              {suffix}
            </div>
          )}
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

Input.displayName = "Input";

export default Input;
