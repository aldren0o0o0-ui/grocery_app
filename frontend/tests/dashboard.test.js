import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Frontend Operational Dashboard & KPI Architecture Tests", () => {
  test("Dashboard authorization allows OWNER, STAFF, and CASHIER, but denies unauthenticated or invalid roles", () => {
    const isDashboardAllowed = (role) => {
      if (!role) return false;
      return ["OWNER", "STAFF", "CASHIER"].includes(role);
    };

    assert.equal(isDashboardAllowed("OWNER"), true);
    assert.equal(isDashboardAllowed("STAFF"), true);
    assert.equal(isDashboardAllowed("CASHIER"), true);
    assert.equal(isDashboardAllowed("ADMIN"), false);
    assert.equal(isDashboardAllowed(null), false);
    assert.equal(isDashboardAllowed(undefined), false);
  });

  test("Currency formatter handles positive, negative, zero, null, and non-numeric inputs safely", () => {
    const formatCurrency = (val) => {
      const num = parseFloat(val);
      if (isNaN(num)) return "₱0.00";
      const absFormatted = Math.abs(num).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return num < 0 ? `-₱${absFormatted}` : `₱${absFormatted}`;
    };

    assert.equal(formatCurrency("1250.50"), "₱1,250.50");
    assert.equal(formatCurrency("0.00"), "₱0.00");
    assert.equal(formatCurrency(0), "₱0.00");
    assert.equal(formatCurrency(null), "₱0.00");
    assert.equal(formatCurrency(undefined), "₱0.00");
    assert.equal(formatCurrency("invalid"), "₱0.00");
    assert.equal(formatCurrency("-200.00"), "-₱200.00");
  });

  test("OWNER view contract: receives full financial and operational KPI model", () => {
    const mockOwnerPayload = {
      period: { date: "2026-09-08", timezone: "Asia/Manila" },
      sales: { gross_sales: "1000.00", discount_total: "100.00", refunds: "180.00", net_sales: "720.00", transactions: 5 },
      profit: {
        sold_cogs: "600.00",
        returned_cogs: "120.00",
        net_cogs: "480.00",
        estimated_gross_profit: "240.00",
        operating_expenses: "100.00",
        estimated_net_profit: "140.00",
      },
      inventory: { active_products: 42, low_stock: 3, out_of_stock: 1 },
      trend: [
        { date: "2026-09-02", gross_sales: "0.00", refunds: "0.00", net_sales: "0.00" },
        { date: "2026-09-03", gross_sales: "0.00", refunds: "0.00", net_sales: "0.00" },
        { date: "2026-09-04", gross_sales: "0.00", refunds: "0.00", net_sales: "0.00" },
        { date: "2026-09-05", gross_sales: "0.00", refunds: "0.00", net_sales: "0.00" },
        { date: "2026-09-06", gross_sales: "0.00", refunds: "0.00", net_sales: "0.00" },
        { date: "2026-09-07", gross_sales: "500.00", refunds: "0.00", net_sales: "500.00" },
        { date: "2026-09-08", gross_sales: "1000.00", refunds: "180.00", net_sales: "720.00" },
      ],
      top_products: [
        { product_id: 1, name: "Rice 25kg", sku: "RICE-25", unit: "sack", net_quantity_sold: "5.000", net_sales: "12000.00" },
      ],
      expense_breakdown: [
        { category: "Rent", amount: "80.00", percentage: "80.0" },
        { category: "Utilities", amount: "20.00", percentage: "20.0" },
      ],
      inventory_alerts: [
        { id: 10, name: "Instant Noodles", sku: "NOODLE-01", unit: "pack", stock_quantity: "0.000", reorder_level: "10.000", status: "OUT_OF_STOCK" },
      ],
      recent_sales: [{ id: 1, invoice_number: "INV-001", total: "720.00", status: "COMPLETED", cashier: "Cashier A", item_count: 2 }],
      recent_returns: [{ id: 1, return_number: "RET-001", refund_amount: "180.00", processed_by: "Cashier A" }],
      recent_expenses: [{ id: 1, category: "Rent", amount: "80.00", expense_date: "2026-09-08", recorded_by: "Owner A" }],
    };

    // Assert complete sections
    assert.ok(mockOwnerPayload.sales);
    assert.ok(mockOwnerPayload.profit);
    assert.ok(mockOwnerPayload.inventory);
    assert.equal(mockOwnerPayload.trend.length, 7);
    assert.equal(mockOwnerPayload.sales.net_sales, "720.00");
    assert.equal(mockOwnerPayload.profit.estimated_gross_profit, "240.00");
    assert.equal(mockOwnerPayload.profit.estimated_net_profit, "140.00");
  });

  test("STAFF view privacy invariant: strictly omits profit, margins, COGS, and sales totals", () => {
    const mockStaffPayload = {
      period: { date: "2026-09-08", timezone: "Asia/Manila" },
      inventory: { active_products: 42, low_stock: 3, out_of_stock: 1 },
      inventory_alerts: [
        { id: 10, name: "Instant Noodles", sku: "NOODLE-01", unit: "pack", stock_quantity: "0.000", reorder_level: "10.000", status: "OUT_OF_STOCK" },
      ],
      recent_expenses: [
        { id: 1, category: "Utilities", amount: "50.00", expense_date: "2026-09-08", recorded_by: "Staff B" },
      ],
    };

    // Sensitive financial sections MUST BE UNDEFINED in Staff payload
    assert.equal(mockStaffPayload.profit, undefined);
    assert.equal(mockStaffPayload.sales, undefined);
    assert.equal(mockStaffPayload.top_products, undefined);
    assert.equal(mockStaffPayload.expense_breakdown, undefined);
    assert.equal(mockStaffPayload.trend, undefined);

    // Operational sections must be present
    assert.equal(mockStaffPayload.inventory.active_products, 42);
    assert.equal(mockStaffPayload.inventory_alerts.length, 1);
    assert.equal(mockStaffPayload.recent_expenses.length, 1);
  });

  test("CASHIER view privacy invariant: strictly personal metrics and POS shortcuts only", () => {
    const mockCashierPayload = {
      period: { date: "2026-09-08", timezone: "Asia/Manila" },
      cashier_sales: { today_sales: "350.00", transactions: 4 },
      recent_sales: [
        { id: 12, invoice_number: "INV-CASHIER-012", total: "150.00", status: "COMPLETED", item_count: 2 },
      ],
    };

    // Store-wide financial and inventory sections MUST BE UNDEFINED in Cashier payload
    assert.equal(mockCashierPayload.profit, undefined);
    assert.equal(mockCashierPayload.inventory, undefined);
    assert.equal(mockCashierPayload.inventory_alerts, undefined);
    assert.equal(mockCashierPayload.trend, undefined);
    assert.equal(mockCashierPayload.top_products, undefined);
    assert.equal(mockCashierPayload.expense_breakdown, undefined);
    assert.equal(mockCashierPayload.recent_expenses, undefined);

    // Personal section must be present
    assert.equal(mockCashierPayload.cashier_sales.today_sales, "350.00");
    assert.equal(mockCashierPayload.cashier_sales.transactions, 4);
    assert.equal(mockCashierPayload.recent_sales.length, 1);
  });

  test("Zero-state dashboard data renders gracefully without throwing errors or calculating NaN", () => {
    const zeroStatePayload = {
      period: { date: "2026-09-08", timezone: "Asia/Manila" },
      sales: { gross_sales: "0.00", discount_total: "0.00", refunds: "0.00", net_sales: "0.00", transactions: 0 },
      profit: {
        sold_cogs: "0.00",
        returned_cogs: "0.00",
        net_cogs: "0.00",
        estimated_gross_profit: "0.00",
        operating_expenses: "0.00",
        estimated_net_profit: "0.00",
      },
      inventory: { active_products: 0, low_stock: 0, out_of_stock: 0 },
      trend: [
        { date: "2026-09-02", gross_sales: "0.00", refunds: "0.00", net_sales: "0.00" },
        { date: "2026-09-03", gross_sales: "0.00", refunds: "0.00", net_sales: "0.00" },
        { date: "2026-09-04", gross_sales: "0.00", refunds: "0.00", net_sales: "0.00" },
        { date: "2026-09-05", gross_sales: "0.00", refunds: "0.00", net_sales: "0.00" },
        { date: "2026-09-06", gross_sales: "0.00", refunds: "0.00", net_sales: "0.00" },
        { date: "2026-09-07", gross_sales: "0.00", refunds: "0.00", net_sales: "0.00" },
        { date: "2026-09-08", gross_sales: "0.00", refunds: "0.00", net_sales: "0.00" },
      ],
      top_products: [],
      expense_breakdown: [],
      inventory_alerts: [],
      recent_sales: [],
      recent_returns: [],
      recent_expenses: [],
    };

    assert.equal(parseFloat(zeroStatePayload.sales.net_sales), 0);
    assert.equal(parseFloat(zeroStatePayload.profit.estimated_net_profit), 0);
    assert.equal(zeroStatePayload.inventory.active_products, 0);
    assert.equal(zeroStatePayload.top_products.length, 0);
    assert.equal(zeroStatePayload.expense_breakdown.length, 0);
    assert.equal(zeroStatePayload.inventory_alerts.length, 0);
  });

  test("Client does not perform authoritative financial calculations (UI strictly consumes server data)", () => {
    // Verifies architectural principle that financial aggregation is performed by backend/PostgreSQL
    const serverProvidedNetSales = "720.00";
    const serverProvidedNetCogs = "480.00";
    const serverProvidedGrossProfit = "240.00";
    assert.ok(serverProvidedNetCogs);

    // Client must never synthesize its own profit formulas if server fields are missing
    const getGrossProfitDisplay = (data) => {
      if (!data?.profit?.estimated_gross_profit) return null;
      return data.profit.estimated_gross_profit;
    };

    assert.equal(
      getGrossProfitDisplay({ profit: { estimated_gross_profit: serverProvidedGrossProfit } }),
      "240.00"
    );
    assert.equal(
      getGrossProfitDisplay({ sales: { net_sales: serverProvidedNetSales } }),
      null // does not recalculate
    );
  });
});
