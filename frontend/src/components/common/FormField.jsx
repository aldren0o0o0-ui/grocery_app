import React, { useId } from "react";

export const FormField = ({
  label,
  children,
  error,
  helperText,
  required = false,
  id: explicitId,
  style = {},
  ...props
}) => {
  const generatedId = useId();
  const fieldId = explicitId || (children && React.isValidElement(children) && children.props.id ? children.props.id : generatedId);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        marginBottom: "16px",
        width: "100%",
        ...style,
      }}
      {...props}
    >
      {label && (
        <label
          htmlFor={fieldId}
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--color-text)",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {label}
          {required && (
            <span style={{ color: "var(--color-danger)", fontSize: "14px" }} aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {React.isValidElement(children)
        ? React.cloneElement(children, {
            id: fieldId,
            ...(error ? { "aria-invalid": "true", "aria-describedby": `${fieldId}-error` } : {}),
          })
        : children}

      {error ? (
        <span
          id={`${fieldId}-error`}
          role="alert"
          style={{
            fontSize: "12px",
            color: "var(--color-danger)",
            fontWeight: 500,
            marginTop: "2px",
          }}
        >
          {error}
        </span>
      ) : helperText ? (
        <span
          style={{
            fontSize: "12px",
            color: "var(--color-text-muted)",
            marginTop: "2px",
          }}
        >
          {helperText}
        </span>
      ) : null}
    </div>
  );
};

export const Input = ({
  error = false,
  disabled = false,
  style = {},
  type = "text",
  ...props
}) => {
  return (
    <input
      type={type}
      disabled={disabled}
      style={{
        width: "100%",
        height: "40px",
        padding: "8px 12px",
        fontSize: "14px",
        fontFamily: "var(--font-sans)",
        color: "var(--color-text)",
        backgroundColor: disabled ? "var(--color-bg)" : "var(--color-surface)",
        border: `1px solid ${error ? "var(--color-danger)" : "var(--color-border)"}`,
        borderRadius: "var(--radius-md)",
        outline: "none",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        boxSizing: "border-box",
        cursor: disabled ? "not-allowed" : "text",
        ...style,
      }}
      onFocus={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = error
            ? "var(--color-danger)"
            : "var(--color-primary)";
          e.currentTarget.style.boxShadow = error
            ? "0 0 0 3px var(--color-danger-soft)"
            : "0 0 0 3px var(--color-primary-soft)";
        }
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = error
          ? "var(--color-danger)"
          : "var(--color-border)";
        e.currentTarget.style.boxShadow = "none";
      }}
      {...props}
    />
  );
};

export const Select = ({
  error = false,
  disabled = false,
  children,
  style = {},
  ...props
}) => {
  return (
    <select
      disabled={disabled}
      style={{
        width: "100%",
        height: "40px",
        padding: "8px 12px",
        fontSize: "14px",
        fontFamily: "var(--font-sans)",
        color: "var(--color-text)",
        backgroundColor: disabled ? "var(--color-bg)" : "var(--color-surface)",
        border: `1px solid ${error ? "var(--color-danger)" : "var(--color-border)"}`,
        borderRadius: "var(--radius-md)",
        outline: "none",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        boxSizing: "border-box",
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
      onFocus={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = error
            ? "var(--color-danger)"
            : "var(--color-primary)";
          e.currentTarget.style.boxShadow = error
            ? "0 0 0 3px var(--color-danger-soft)"
            : "0 0 0 3px var(--color-primary-soft)";
        }
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = error
          ? "var(--color-danger)"
          : "var(--color-border)";
        e.currentTarget.style.boxShadow = "none";
      }}
      {...props}
    >
      {children}
    </select>
  );
};

export const Textarea = ({
  error = false,
  disabled = false,
  rows = 3,
  style = {},
  ...props
}) => {
  return (
    <textarea
      rows={rows}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "8px 12px",
        fontSize: "14px",
        fontFamily: "var(--font-sans)",
        color: "var(--color-text)",
        backgroundColor: disabled ? "var(--color-bg)" : "var(--color-surface)",
        border: `1px solid ${error ? "var(--color-danger)" : "var(--color-border)"}`,
        borderRadius: "var(--radius-md)",
        outline: "none",
        resize: "vertical",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        boxSizing: "border-box",
        cursor: disabled ? "not-allowed" : "text",
        ...style,
      }}
      onFocus={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = error
            ? "var(--color-danger)"
            : "var(--color-primary)";
          e.currentTarget.style.boxShadow = error
            ? "0 0 0 3px var(--color-danger-soft)"
            : "0 0 0 3px var(--color-primary-soft)";
        }
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = error
          ? "var(--color-danger)"
          : "var(--color-border)";
        e.currentTarget.style.boxShadow = "none";
      }}
      {...props}
    />
  );
};
