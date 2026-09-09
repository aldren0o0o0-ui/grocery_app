import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useAuth from "../modules/auth/useAuth";
import { getReturnsApi, getReturnDetailApi } from "../modules/returns/api";
import {
  PageHeader,
  DataTable,
  Pagination,
  Drawer,
  Button,
  FilterBar,
  StatusBadge,
  Input,
  Select,
} from "../components/common";

export const ReturnsPage = () => {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";

  const [returns, setReturns] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 1 });
  const [search, setSearch] = useState("");
  const [refundMethod, setRefundMethod] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Return detail drawer
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    let ignore = false;
    const fetchReturns = async () => {
      try {
        setLoading(true);
        setError("");
        const params = {
          page: pagination.page,
          per_page: 20,
          search,
          refund_method: refundMethod,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        };

        const res = await getReturnsApi(params);
        if (!ignore) {
          const items = res?.returns || res?.data?.items || res?.items || (Array.isArray(res) ? res : []);
          const pag = res?.pagination || res?.data?.pagination || { page: 1, per_page: 20, total: items.length, pages: 1 };
          setReturns(items);
          setPagination(pag);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error?.message || err.response?.data?.message || "Failed to load returns history.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchReturns();
    return () => {
      ignore = true;
    };
  }, [pagination.page, search, refundMethod, dateFrom, dateTo]);

  const handleOpenDetail = async (returnId) => {
    try {
      setDetailLoading(true);
      setDetailError("");
      const res = await getReturnDetailApi(returnId);
      setSelectedReturn(res.return);
    } catch (err) {
      setDetailError(err.response?.data?.error?.message || err.response?.data?.message || "Failed to load return details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setRefundMethod("ALL");
    setDateFrom("");
    setDateTo("");
  };

  const columns = [
    {
      header: "Return #",
      field: "return_number",
      render: (val) => (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "600",
            fontSize: "12px",
            color: "var(--color-danger)",
          }}
        >
          {val}
        </span>
      ),
    },
    {
      header: "Invoice #",
      field: "sale_invoice_number",
      render: (val) => (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "500",
            color: "var(--color-brand)",
          }}
        >
          {val}
        </span>
      ),
    },
    {
      header: "Date & Time",
      field: "created_at",
      render: (val) => (
        <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
          {new Date(val).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Processed By",
      field: "processor_name",
      render: (val) => (
        <span style={{ fontSize: "13px", fontWeight: "500" }}>{val || "—"}</span>
      ),
    },
    {
      header: "Method",
      field: "refund_method",
      render: (val) => {
        let badgeVariant = "default";
        if (val === "CASH") badgeVariant = "success";
        if (val === "GCASH") badgeVariant = "info";
        if (val === "CARD") badgeVariant = "warning";
        return <StatusBadge status={val} variant={badgeVariant} />;
      },
    },
    {
      header: "Refund Amount",
      field: "refund_amount",
      align: "right",
      render: (val) => (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "700",
            color: "var(--color-danger)",
            fontSize: "13px",
          }}
        >
          ₱{parseFloat(val || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: "Reason",
      field: "reason",
      render: (val) => (
        <span
          title={val}
          style={{
            display: "inline-block",
            maxWidth: "180px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "var(--color-text-secondary)",
            fontSize: "12px",
          }}
        >
          {val || "—"}
        </span>
      ),
    },
    {
      header: "Action",
      align: "center",
      render: (_, row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleOpenDetail(row.id)}
        >
          View Items
        </Button>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 20px" }}>
      <PageHeader
        title="Sales Returns & Refunds"
        subtitle={
          isOwner
            ? "Audit trail of returned merchandise, restored stock, and customer refunds"
            : "Returns processed at your register"
        }
        actions={
          <Link to="/sales" style={{ textDecoration: "none" }}>
            <Button variant="secondary" size="sm">
              ← Back to Sales History
            </Button>
          </Link>
        }
      />

      {/* Metric Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            padding: "16px 20px",
            boxShadow: "var(--shadow-xs)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
            Total Returns Logged
          </div>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "var(--color-text)", marginTop: "4px" }}>
            {pagination.total}
          </div>
          <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
            Audit-tracked returns across all dates
          </div>
        </div>

        <div
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            padding: "16px 20px",
            boxShadow: "var(--shadow-xs)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
            Inventory Status
          </div>
          <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--color-brand)", marginTop: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>✓</span> Stock Auto-Restored
          </div>
          <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginTop: "4px" }}>
            Ledger audited by InventoryService
          </div>
        </div>

        <div
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            padding: "16px 20px",
            boxShadow: "var(--shadow-xs)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
            Active Records
          </div>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "var(--color-text)", marginTop: "4px" }}>
            {returns.length}
          </div>
          <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
            Matching active filters on this page
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar>
        <div style={{ flex: "1 1 220px" }}>
          <Input
            label="Search"
            placeholder="Return #, invoice, or reason..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          />
        </div>

        <div style={{ width: "160px" }}>
          <Select
            label="Refund Method"
            value={refundMethod}
            onChange={(e) => {
              setRefundMethod(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            options={[
              { value: "ALL", label: "All Methods" },
              { value: "CASH", label: "Cash" },
              { value: "GCASH", label: "GCash" },
              { value: "CARD", label: "Card" },
            ]}
          />
        </div>

        <div style={{ width: "150px" }}>
          <Input
            type="date"
            label="Date From"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          />
        </div>

        <div style={{ width: "150px" }}>
          <Input
            type="date"
            label="Date To"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          />
        </div>

        <div style={{ paddingBottom: "1px" }}>
          <Button variant="secondary" size="md" onClick={handleResetFilters}>
            Reset
          </Button>
        </div>
      </FilterBar>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            backgroundColor: "var(--color-danger-soft)",
            border: "1px solid var(--color-danger)",
            borderRadius: "var(--radius-md)",
            color: "var(--color-danger)",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      {/* Modern Returns DataTable */}
      <DataTable
        columns={columns}
        data={returns}
        loading={loading}
        emptyMessage="No return records found matching your filters."
      />

      {/* Pagination */}
      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.pages}
        onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
        totalItems={pagination.total}
        pageSize={pagination.per_page}
      />

      {/* Return Detail Drawer */}
      <Drawer
        isOpen={Boolean(selectedReturn)}
        onClose={() => setSelectedReturn(null)}
        title={selectedReturn ? `Return ${selectedReturn.return_number}` : "Return Details"}
        width="540px"
      >
        {detailError && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              backgroundColor: "var(--color-danger-soft)",
              border: "1px solid var(--color-danger)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-danger)",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {detailError}
          </div>
        )}

        {detailLoading ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--color-text-secondary)" }}>
            Loading return details...
          </div>
        ) : selectedReturn ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Meta Information Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                padding: "14px",
                backgroundColor: "var(--color-bg)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                fontSize: "12px",
              }}
            >
              <div>
                <span style={{ color: "var(--color-text-muted)", display: "block" }}>Original Invoice</span>
                <span style={{ fontWeight: "600", fontFamily: "var(--font-mono)", color: "var(--color-brand)" }}>
                  {selectedReturn.sale?.invoice_number || selectedReturn.sale_invoice_number}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--color-text-muted)", display: "block" }}>Processed Date</span>
                <span style={{ fontWeight: "500", color: "var(--color-text)" }}>
                  {new Date(selectedReturn.created_at).toLocaleString()}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--color-text-muted)", display: "block" }}>Processed By</span>
                <span style={{ fontWeight: "500", color: "var(--color-text)" }}>
                  {selectedReturn.processor?.name || selectedReturn.processor_name || "—"}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--color-text-muted)", display: "block" }}>Refund Method</span>
                <span style={{ fontWeight: "600", color: "var(--color-text)" }}>
                  {selectedReturn.refund_method}
                </span>
              </div>
              <div style={{ gridColumn: "1 / -1", borderTop: "1px solid var(--color-border)", paddingTop: "8px", marginTop: "4px" }}>
                <span style={{ color: "var(--color-text-muted)", display: "block" }}>Reason</span>
                <span style={{ fontStyle: "italic", color: "var(--color-text)" }}>
                  {selectedReturn.reason || "None specified"}
                </span>
              </div>
            </div>

            {/* Restored Items Breakdown */}
            <div>
              <h3
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--color-text-muted)",
                  margin: "0 0 8px",
                }}
              >
                Restored Stock & Refund Breakdown
              </h3>
              <div
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  overflow: "hidden",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ backgroundColor: "var(--color-bg)", borderBottom: "1px solid var(--color-border)" }}>
                      <th style={{ padding: "8px 12px" }}>Product</th>
                      <th style={{ padding: "8px 12px", textAlign: "center" }}>Qty Returned</th>
                      <th style={{ padding: "8px 12px", textAlign: "right" }}>Unit Price</th>
                      {isOwner && (
                        <th style={{ padding: "8px 12px", textAlign: "right", color: "var(--color-text-muted)" }}>
                          Cost
                        </th>
                      )}
                      <th style={{ padding: "8px 12px", textAlign: "right" }}>Refund Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReturn.items?.map((it) => (
                      <tr key={it.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <td style={{ padding: "8px 12px" }}>
                          <div style={{ fontWeight: "600", color: "var(--color-text)" }}>{it.product_name}</div>
                          <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>
                            {it.product_sku}
                          </div>
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: "600", color: "var(--color-brand)" }}>
                          +{parseFloat(it.quantity)} {it.product_unit}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                          ₱{parseFloat(it.unit_price).toFixed(2)}
                        </td>
                        {isOwner && (
                          <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>
                            ₱{it.cost_price ? parseFloat(it.cost_price).toFixed(2) : "0.00"}
                          </td>
                        )}
                        <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: "700", fontFamily: "var(--font-mono)", color: "var(--color-danger)" }}>
                          ₱{parseFloat(it.refund_subtotal).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Refund Banner */}
            <div
              style={{
                padding: "14px 16px",
                backgroundColor: "var(--color-danger-soft)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-danger)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--color-danger)" }}>
                Total Refund Issued:
              </span>
              <span style={{ fontSize: "20px", fontWeight: "700", fontFamily: "var(--font-mono)", color: "var(--color-danger)" }}>
                ₱{parseFloat(selectedReturn.refund_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div
              style={{
                fontSize: "11px",
                color: "var(--color-text-secondary)",
                backgroundColor: "var(--color-bg)",
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ color: "var(--color-brand)", fontSize: "14px" }}>✓</span>
              <span>Inventory levels were automatically replenished to active stock upon return authorization.</span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
              <Button variant="secondary" size="md" onClick={() => setSelectedReturn(null)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
};

export default ReturnsPage;
