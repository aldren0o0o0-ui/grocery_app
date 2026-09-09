import { useState } from "react";
import Button from "./Button";

export const FilterBar = ({
  search = "",
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = "Search records...",
  onReset,
  children,
  filtersActive = false,
}) => {
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-xs)",
        marginBottom: "var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      {/* Top row: Search form + Mobile filters toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          flexWrap: "wrap",
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (onSearchSubmit) onSearchSubmit(e);
          }}
          style={{ display: "flex", flex: 1, minWidth: "240px", position: "relative" }}
        >
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 32px 7px 12px",
              fontSize: "var(--text-base)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
              outline: "none",
              transition: "border-color var(--transition-fast)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-primary)";
              e.currentTarget.style.backgroundColor = "#FFFFFF";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border)";
              e.currentTarget.style.backgroundColor = "var(--color-bg)";
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange && onSearchChange("")}
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "var(--color-muted)",
                cursor: "pointer",
                padding: "2px",
                fontSize: "var(--text-xs)",
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </form>

        {/* Mobile filter toggle button (hidden on desktop via media query in inline style or class) */}
        {children && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsMobileFiltersOpen((prev) => !prev)}
              icon="⚙️"
            >
              <span>Filters</span>
              {filtersActive && (
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "var(--radius-pill)",
                    backgroundColor: "var(--color-primary)",
                  }}
                />
              )}
            </Button>

            {onReset && (
              <Button variant="ghost" size="sm" onClick={onReset}>
                Reset
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Filter items row (responsive collapsible on mobile) */}
      {children && (
        <div
          style={{
            display: isMobileFiltersOpen ? "flex" : "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--space-3)",
            paddingTop: "var(--space-2)",
            borderTop: "1px solid var(--color-border-subtle)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default FilterBar;
