import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Frontend Returns & Refund Business Invariant Tests", () => {
  test("Returns authorization policy allows OWNER and CASHIER, strictly denies STAFF", () => {
    const canAccessReturns = (role) => {
      if (!role) return false;
      return ["OWNER", "CASHIER"].includes(role);
    };

    assert.equal(canAccessReturns("OWNER"), true);
    assert.equal(canAccessReturns("CASHIER"), true);
    assert.equal(canAccessReturns("STAFF"), false);
    assert.equal(canAccessReturns("ADMIN"), false);
    assert.equal(canAccessReturns(null), false);
    assert.equal(canAccessReturns(undefined), false);
  });

  test("Prorated discount allocation accurately computes line refunds and exact full return total", () => {
    const computeRefundPreview = (sale, requestedQtys) => {
      const saleSubtotal = parseFloat(sale.subtotal) || 0;
      const saleDiscount = parseFloat(sale.discount) || 0;
      const saleTotal = parseFloat(sale.total) || 0;
      const totalRefunded = parseFloat(sale.total_refunded) || 0;

      let totalCalc = 0;
      const lineRefunds = {};
      let isFullReturn = true;
      let hasItems = false;

      sale.items.forEach((it) => {
        const inputQty = parseFloat(requestedQtys[it.id]) || 0;
        const soldQty = parseFloat(it.quantity) || 0;
        const alreadyRet = parseFloat(it.returned_quantity) || 0;

        if (inputQty > 0) {
          hasItems = true;
          const itemSubtotal = parseFloat(it.subtotal) || 0;
          let lineRef;

          if (saleDiscount > 0 && saleSubtotal > 0 && soldQty > 0) {
            const ratio = itemSubtotal / saleSubtotal;
            const netItemSubtotal = itemSubtotal - (saleDiscount * ratio);
            lineRef = (inputQty / soldQty) * netItemSubtotal;
          } else {
            lineRef = inputQty * (parseFloat(it.unit_price) || 0);
          }

          lineRefunds[it.id] = Math.round(lineRef * 100) / 100;
          totalCalc += lineRefunds[it.id];
        }

        if (Math.abs((alreadyRet + inputQty) - soldQty) > 0.0001) {
          isFullReturn = false;
        }
      });

      if (isFullReturn && hasItems) {
        totalCalc = Math.round(Math.max(0, saleTotal - totalRefunded) * 100) / 100;
      } else {
        totalCalc = Math.min(totalCalc, Math.max(0, saleTotal - totalRefunded));
        totalCalc = Math.round(totalCalc * 100) / 100;
      }

      return { lineRefunds, totalRefund: totalCalc, isFullReturn };
    };

    // Sale: Subtotal 470, Discount 47 (10%), Total 423
    // Item 1: 2 bags @ 200 = 400 (net = 360)
    // Item 2: 1 bag @ 70 = 70 (net = 63)
    const sale = {
      subtotal: "470.00",
      discount: "47.00",
      total: "423.00",
      total_refunded: "0.00",
      items: [
        { id: 1, quantity: "2.000", returned_quantity: "0.000", returnable_quantity: "2.000", unit_price: "200.00", subtotal: "400.00" },
        { id: 2, quantity: "1.000", returned_quantity: "0.000", returnable_quantity: "1.000", unit_price: "70.00", subtotal: "70.00" },
      ],
    };

    // Partial return: 1 bag of Item 1
    const partialPreview = computeRefundPreview(sale, { 1: "1.000", 2: "0.000" });
    assert.equal(partialPreview.lineRefunds[1], 180.00);
    assert.equal(partialPreview.totalRefund, 180.00);
    assert.equal(partialPreview.isFullReturn, false);

    // Full return of everything: cumulative refund equals sale.total exactly
    const fullPreview = computeRefundPreview(sale, { 1: "2.000", 2: "1.000" });
    assert.equal(fullPreview.totalRefund, 423.00);
    assert.equal(fullPreview.isFullReturn, true);
  });

  test("Return state resolution determines NONE, PARTIAL, and FULL accurately", () => {
    const resolveReturnState = (saleStatus, totalSoldQty, totalReturnedQty) => {
      if (saleStatus === "RETURNED") return "FULL";
      if (totalSoldQty > 0 && totalReturnedQty >= totalSoldQty) return "FULL";
      if (totalReturnedQty > 0) return "PARTIAL";
      return "NONE";
    };

    assert.equal(resolveReturnState("COMPLETED", 5.0, 0.0), "NONE");
    assert.equal(resolveReturnState("COMPLETED", 5.0, 2.0), "PARTIAL");
    assert.equal(resolveReturnState("COMPLETED", 5.0, 5.0), "FULL");
    assert.equal(resolveReturnState("RETURNED", 5.0, 5.0), "FULL");
  });

  test("Return item quantity validation prevents invalid and excessive return amounts", () => {
    const validateReturnInput = (requestedQtyStr, returnableQty) => {
      const q = parseFloat(requestedQtyStr);
      if (isNaN(q) || q <= 0) return { valid: false, reason: "Quantity must be greater than zero." };
      if (q > returnableQty) return { valid: false, reason: "Quantity exceeds returnable limit." };
      return { valid: true };
    };

    assert.equal(validateReturnInput("0", 3.0).valid, false);
    assert.equal(validateReturnInput("-1.5", 3.0).valid, false);
    assert.equal(validateReturnInput("4.0", 3.0).valid, false);
    assert.equal(validateReturnInput("2.5", 3.0).valid, true);
    assert.equal(validateReturnInput("3.0", 3.0).valid, true);
  });

  test("Return item cost price is strictly hidden from CASHIER in return details", () => {
    const filterReturnItemForRole = (item, role) => {
      const copy = { ...item };
      if (role !== "OWNER") {
        delete copy.cost_price;
      }
      return copy;
    };

    const returnItem = {
      product_id: 5,
      product_name: "Cooking Oil 1L",
      quantity: "1.000",
      unit_price: "95.00",
      cost_price: "72.00",
      refund_subtotal: "95.00",
    };

    const ownerView = filterReturnItemForRole(returnItem, "OWNER");
    assert.equal(ownerView.cost_price, "72.00");

    const cashierView = filterReturnItemForRole(returnItem, "CASHIER");
    assert.equal(cashierView.cost_price, undefined);

    const staffView = filterReturnItemForRole(returnItem, "STAFF");
    assert.equal(staffView.cost_price, undefined);
  });
});
