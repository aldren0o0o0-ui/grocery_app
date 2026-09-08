import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Frontend Inventory Architecture & Calculation Tests", () => {
  test("Inventory adjustment authorization permits OWNER and ADMIN, rejects CASHIER and STAFF", () => {
    const canAdjustInventory = (role) => {
      if (!role) return false;
      return ["OWNER", "ADMIN"].includes(role);
    };

    assert.equal(canAdjustInventory("OWNER"), true);
    assert.equal(canAdjustInventory("ADMIN"), true);
    assert.equal(canAdjustInventory("CASHIER"), false);
    assert.equal(canAdjustInventory("STAFF"), false);
    assert.equal(canAdjustInventory(null), false);
    assert.equal(canAdjustInventory(undefined), false);
  });

  test("Stock status classification logic correctly identifies OUT_OF_STOCK, LOW_STOCK, and IN_STOCK", () => {
    const computeStockStatus = (stockQuantityStr, reorderLevelStr) => {
      const stock = parseFloat(stockQuantityStr);
      const reorder = parseFloat(reorderLevelStr);

      if (stock === 0) {
        return "OUT_OF_STOCK";
      }
      if (reorder > 0 && stock <= reorder) {
        return "LOW_STOCK";
      }
      return "IN_STOCK";
    };

    // Out of stock
    assert.equal(computeStockStatus("0.000", "10.000"), "OUT_OF_STOCK");
    assert.equal(computeStockStatus("0.000", "0.000"), "OUT_OF_STOCK");

    // Low stock
    assert.equal(computeStockStatus("5.000", "10.000"), "LOW_STOCK");
    assert.equal(computeStockStatus("10.000", "10.000"), "LOW_STOCK");

    // In stock
    assert.equal(computeStockStatus("15.000", "10.000"), "IN_STOCK");

    // Reorder level 0 edge case: positive stock must NOT be classified as low stock
    assert.equal(computeStockStatus("15.000", "0.000"), "IN_STOCK");
    assert.equal(computeStockStatus("0.500", "0.000"), "IN_STOCK");
  });

  test("Projected stock balance calculation accurately simulates IN and OUT adjustments", () => {
    const calculateProjectedStock = (currentStock, direction, adjustmentQty) => {
      const current = parseFloat(currentStock);
      const qty = parseFloat(adjustmentQty);
      if (isNaN(qty) || qty <= 0) return null;

      if (direction === "IN") {
        return (current + qty).toFixed(3);
      } else if (direction === "OUT") {
        return (current - qty).toFixed(3);
      }
      return null;
    };

    // Add stock
    assert.equal(calculateProjectedStock("25.000", "IN", "10.500"), "35.500");

    // Deduct stock valid
    assert.equal(calculateProjectedStock("25.000", "OUT", "5.250"), "19.750");

    // Deduct exact balance
    assert.equal(calculateProjectedStock("10.000", "OUT", "10.000"), "0.000");

    // Negative projected balance
    const overDeduction = calculateProjectedStock("5.000", "OUT", "8.000");
    assert.equal(overDeduction, "-3.000");
    assert.equal(parseFloat(overDeduction) < 0, true);
  });

  test("Stock adjustment payload serializer formats positive decimals and excludes forbidden fields", () => {
    const buildAdjustmentPayload = (productId, direction, quantity, reason, remarks) => {
      const qty = parseFloat(quantity);
      if (isNaN(qty) || qty <= 0) {
        throw new Error("Invalid quantity");
      }

      return {
        product_id: Number(productId),
        direction: direction.trim().toUpperCase(),
        quantity: qty.toFixed(3),
        reason: reason.trim().toUpperCase(),
        remarks: remarks?.trim() || null,
      };
    };

    const payload = buildAdjustmentPayload("15", "out", "2.75", "damaged", " Torn outer carton ");
    assert.deepEqual(payload, {
      product_id: 15,
      direction: "OUT",
      quantity: "2.750",
      reason: "DAMAGED",
      remarks: "Torn outer carton",
    });

    assert.throws(() => buildAdjustmentPayload("15", "OUT", "-5.000", "DAMAGED"), /Invalid quantity/);
    assert.throws(() => buildAdjustmentPayload("15", "OUT", "0", "DAMAGED"), /Invalid quantity/);
  });

  test("Movement ledger signed quantity display formatter computes correct display strings", () => {
    const formatSignedQuantity = (movementType, quantityStr) => {
      const isPositive = ["ADJUSTMENT_IN", "PURCHASE", "RETURN"].includes(movementType);
      return isPositive ? `+${quantityStr}` : `-${quantityStr}`;
    };

    assert.equal(formatSignedQuantity("ADJUSTMENT_IN", "10.000"), "+10.000");
    assert.equal(formatSignedQuantity("PURCHASE", "50.000"), "+50.000");
    assert.equal(formatSignedQuantity("RETURN", "2.000"), "+2.000");
    assert.equal(formatSignedQuantity("ADJUSTMENT_OUT", "3.500"), "-3.500");
    assert.equal(formatSignedQuantity("DAMAGED", "1.000"), "-1.000");
    assert.equal(formatSignedQuantity("EXPIRED", "0.750"), "-0.750");
    assert.equal(formatSignedQuantity("SALE", "4.000"), "-4.000");
  });
});
