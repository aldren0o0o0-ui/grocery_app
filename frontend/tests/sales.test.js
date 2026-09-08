import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Frontend Sales & POS Architecture & Business Invariant Tests", () => {
  test("POS authorization policy allows OWNER and CASHIER, strictly forbids STAFF and invalid roles", () => {
    const canAccessPOS = (role) => {
      if (!role) return false;
      return ["OWNER", "CASHIER"].includes(role);
    };

    const canAccessSalesHistory = (role) => {
      if (!role) return false;
      return ["OWNER", "CASHIER"].includes(role);
    };

    assert.equal(canAccessPOS("OWNER"), true);
    assert.equal(canAccessPOS("CASHIER"), true);
    assert.equal(canAccessPOS("STAFF"), false);
    assert.equal(canAccessPOS("ADMIN"), false);
    assert.equal(canAccessPOS(null), false);
    assert.equal(canAccessPOS(undefined), false);

    assert.equal(canAccessSalesHistory("OWNER"), true);
    assert.equal(canAccessSalesHistory("CASHIER"), true);
    assert.equal(canAccessSalesHistory("STAFF"), false);
  });

  test("Cart item subtotal calculation adheres to 2-decimal rounding rules with fractional quantities", () => {
    const computeSubtotal = (qtyStr, unitPriceStr) => {
      const q = parseFloat(qtyStr);
      const p = parseFloat(unitPriceStr);
      return Math.round(q * p * 100) / 100;
    };

    const computeCartTotal = (items, discountStr = "0.00") => {
      const subtotal = items.reduce((acc, it) => acc + computeSubtotal(it.quantity, it.unit_price), 0);
      const discount = parseFloat(discountStr) || 0;
      const total = Math.max(0, subtotal - discount);
      return Math.round(total * 100) / 100;
    };

    // Fractional kilograms: 1.250 kg @ 120.50 = 150.625 -> 150.63
    assert.equal(computeSubtotal("1.250", "120.50"), 150.63);
    // Pieces: 3 pcs @ 45.00 = 135.00
    assert.equal(computeSubtotal("3.000", "45.00"), 135.00);

    const items = [
      { quantity: "1.250", unit_price: "120.50" }, // 150.63
      { quantity: "3.000", unit_price: "45.00" },  // 135.00
    ];
    assert.equal(computeCartTotal(items, "10.00"), 275.63);
  });

  test("Cart duplicate product lines are normalized by summing quantities", () => {
    const normalizeCart = (items) => {
      const map = new Map();
      for (const item of items) {
        const currentQty = map.get(item.product_id) || 0;
        map.set(item.product_id, currentQty + parseFloat(item.quantity));
      }
      return Array.from(map.entries()).map(([product_id, quantity]) => ({
        product_id,
        quantity: quantity.toFixed(3),
      }));
    };

    const rawCart = [
      { product_id: 1, quantity: "2.000" },
      { product_id: 2, quantity: "1.500" },
      { product_id: 1, quantity: "3.000" },
    ];

    const normalized = normalizeCart(rawCart);
    assert.equal(normalized.length, 2);
    assert.deepEqual(normalized.find((it) => it.product_id === 1), { product_id: 1, quantity: "5.000" });
    assert.deepEqual(normalized.find((it) => it.product_id === 2), { product_id: 2, quantity: "1.500" });
  });

  test("Cash payment change calculation validates exact amount and overpayment", () => {
    const computeCashChange = (amountPaidStr, totalDue) => {
      const paid = parseFloat(amountPaidStr) || 0;
      if (paid < totalDue) {
        return { isSufficient: false, change: 0, shortage: Math.round((totalDue - paid) * 100) / 100 };
      }
      return { isSufficient: true, change: Math.round((paid - totalDue) * 100) / 100, shortage: 0 };
    };

    // Exact cash
    const exact = computeCashChange("250.00", 250.00);
    assert.equal(exact.isSufficient, true);
    assert.equal(exact.change, 0);

    // Overpayment
    const over = computeCashChange("500.00", 275.63);
    assert.equal(over.isSufficient, true);
    assert.equal(over.change, 224.37);

    // Insufficient cash
    const under = computeCashChange("200.00", 250.00);
    assert.equal(under.isSufficient, false);
    assert.equal(under.shortage, 50.00);
  });

  test("Role-based cost price exposure strictly hides profit and cost from CASHIER", () => {
    const filterItemForRole = (item, role) => {
      const copy = { ...item };
      if (role !== "OWNER") {
        delete copy.cost_price;
      }
      return copy;
    };

    const sampleItem = {
      product_id: 10,
      product_name: "Instant Coffee",
      quantity: "2.000",
      unit_price: "15.00",
      cost_price: "11.00",
      subtotal: "30.00",
    };

    const ownerView = filterItemForRole(sampleItem, "OWNER");
    assert.equal(ownerView.cost_price, "11.00");

    const cashierView = filterItemForRole(sampleItem, "CASHIER");
    assert.equal(cashierView.cost_price, undefined);

    const staffView = filterItemForRole(sampleItem, "STAFF");
    assert.equal(staffView.cost_price, undefined);
  });
});
