import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Frontend Purchasing Architecture & Business Invariant Tests", () => {
  test("Purchasing authorization policy allows OWNER and STAFF, strictly forbids CASHIER and invalid roles", () => {
    const canAccessPurchasing = (role) => {
      if (!role) return false;
      return ["OWNER", "STAFF"].includes(role);
    };

    const canDeleteDraftPurchase = (role) => {
      if (!role) return false;
      return role === "OWNER";
    };

    // Access to list, detail, create, receive, cancel
    assert.equal(canAccessPurchasing("OWNER"), true);
    assert.equal(canAccessPurchasing("STAFF"), true);
    assert.equal(canAccessPurchasing("CASHIER"), false);
    assert.equal(canAccessPurchasing("ADMIN"), false);
    assert.equal(canAccessPurchasing(null), false);
    assert.equal(canAccessPurchasing(undefined), false);

    // Only OWNER can hard-delete draft purchases
    assert.equal(canDeleteDraftPurchase("OWNER"), true);
    assert.equal(canDeleteDraftPurchase("STAFF"), false);
    assert.equal(canDeleteDraftPurchase("CASHIER"), false);
  });

  test("Purchase status transition rules enforce DRAFT as only mutable state and RECEIVED/CANCELLED as terminal", () => {
    const isPurchaseActionable = (status) => status === "DRAFT";
    const isTerminalStatus = (status) => ["RECEIVED", "CANCELLED"].includes(status);

    assert.equal(isPurchaseActionable("DRAFT"), true);
    assert.equal(isPurchaseActionable("RECEIVED"), false);
    assert.equal(isPurchaseActionable("CANCELLED"), false);

    assert.equal(isTerminalStatus("DRAFT"), false);
    assert.equal(isTerminalStatus("RECEIVED"), true);
    assert.equal(isTerminalStatus("CANCELLED"), true);
  });

  test("Order total and item subtotal calculation adheres to 2-decimal rounding rules", () => {
    const computeSubtotal = (qtyStr, unitCostStr) => {
      const q = parseFloat(qtyStr);
      const c = parseFloat(unitCostStr);
      return Math.round(q * c * 100) / 100;
    };

    const computeOrderTotal = (items) => {
      return items.reduce((acc, it) => acc + computeSubtotal(it.quantity, it.unit_cost), 0);
    };

    const sampleItems = [
      { product_id: 1, quantity: "1.250", unit_cost: "1050.00" }, // 1312.50
      { product_id: 2, quantity: "3.000", unit_cost: "45.75" },   // 137.25
      { product_id: 3, quantity: "10.000", unit_cost: "20.00" },  // 200.00
    ];

    assert.equal(computeSubtotal("1.250", "1050.00"), 1312.5);
    assert.equal(computeSubtotal("3.000", "45.75"), 137.25);
    assert.equal(computeOrderTotal(sampleItems), 1649.75);
  });

  test("Purchase creation payload validator rejects duplicate products and non-positive quantities", () => {
    const buildPurchasePayload = (form) => {
      if (!form.supplier_id) throw new Error("Supplier is required.");
      if (!form.purchase_date) throw new Error("Purchase date is required.");

      const productIds = new Set();
      const cleanItems = (form.items || []).map((it, idx) => {
        if (!it.product_id) throw new Error(`Item ${idx + 1}: Product is required.`);
        if (productIds.has(it.product_id)) {
          throw new Error(`Item ${idx + 1}: Duplicate product detected.`);
        }
        productIds.add(it.product_id);

        const qty = parseFloat(it.quantity);
        if (isNaN(qty) || qty <= 0) {
          throw new Error(`Item ${idx + 1}: Quantity must be greater than 0.`);
        }

        const cost = parseFloat(it.unit_cost);
        if (isNaN(cost) || cost < 0) {
          throw new Error(`Item ${idx + 1}: Unit cost cannot be negative.`);
        }

        return {
          product_id: parseInt(it.product_id, 10),
          quantity: it.quantity,
          unit_cost: it.unit_cost,
        };
      });

      const payload = {
        supplier_id: parseInt(form.supplier_id, 10),
        purchase_date: form.purchase_date,
        items: cleanItems,
      };
      if (form.reference_number?.trim()) {
        payload.reference_number = form.reference_number.trim().toUpperCase();
      }
      return payload;
    };

    // Valid payload
    const valid = buildPurchasePayload({
      supplier_id: "5",
      purchase_date: "2026-09-08",
      reference_number: " pur-manual-01 ",
      items: [
        { product_id: "101", quantity: "5.000", unit_cost: "120.00" },
        { product_id: "102", quantity: "2.000", unit_cost: "50.00" },
      ],
    });
    assert.equal(valid.supplier_id, 5);
    assert.equal(valid.reference_number, "PUR-MANUAL-01");
    assert.equal(valid.items.length, 2);

    // Duplicate product rejection
    assert.throws(
      () =>
        buildPurchasePayload({
          supplier_id: "5",
          purchase_date: "2026-09-08",
          items: [
            { product_id: "101", quantity: "1.000", unit_cost: "10.00" },
            { product_id: "101", quantity: "2.000", unit_cost: "10.00" },
          ],
        }),
      /Duplicate product detected/
    );

    // Non-positive quantity rejection
    assert.throws(
      () =>
        buildPurchasePayload({
          supplier_id: "5",
          purchase_date: "2026-09-08",
          items: [{ product_id: "101", quantity: "0.000", unit_cost: "10.00" }],
        }),
      /Quantity must be greater than 0/
    );
  });

  test("Purchasing query parameters builder formats search, status filter, and dates correctly", () => {
    const buildPurchaseQueryParams = ({ page = 1, per_page = 20, status = "ALL", search = "", startDate = "", endDate = "" }) => {
      const params = { page, per_page };
      if (status && status !== "ALL") params.status = status;
      if (search?.trim()) params.search = search.trim();
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      return params;
    };

    const qp1 = buildPurchaseQueryParams({ status: "DRAFT", search: "  PUR-2026  " });
    assert.equal(qp1.status, "DRAFT");
    assert.equal(qp1.search, "PUR-2026");
    assert.equal(qp1.page, 1);
    assert.equal(qp1.per_page, 20);

    const qpAll = buildPurchaseQueryParams({ status: "ALL", search: "" });
    assert.equal(qpAll.status, undefined);
    assert.equal(qpAll.search, undefined);
  });
});
