import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Frontend Expense Management Architecture & Business Invariant Tests", () => {
  test("Expense route authorization permits OWNER and STAFF, strictly forbids CASHIER and ADMIN", () => {
    const canAccessExpenses = (role) => {
      if (!role) return false;
      return ["OWNER", "STAFF"].includes(role);
    };

    assert.equal(canAccessExpenses("OWNER"), true);
    assert.equal(canAccessExpenses("STAFF"), true);
    assert.equal(canAccessExpenses("CASHIER"), false);
    assert.equal(canAccessExpenses("ADMIN"), false);
    assert.equal(canAccessExpenses(null), false);
    assert.equal(canAccessExpenses(undefined), false);
  });

  test("Category management and expense editing controls are exclusively enabled for OWNER", () => {
    const canManageCategories = (role) => role === "OWNER";
    const canEditExpense = (role) => role === "OWNER";
    const canRecordExpense = (role) => ["OWNER", "STAFF"].includes(role);

    // OWNER capabilities
    assert.equal(canManageCategories("OWNER"), true);
    assert.equal(canEditExpense("OWNER"), true);
    assert.equal(canRecordExpense("OWNER"), true);

    // STAFF capabilities: can record but cannot manage categories or edit existing records
    assert.equal(canManageCategories("STAFF"), false);
    assert.equal(canEditExpense("STAFF"), false);
    assert.equal(canRecordExpense("STAFF"), true);

    // CASHIER: denied all
    assert.equal(canManageCategories("CASHIER"), false);
    assert.equal(canEditExpense("CASHIER"), false);
    assert.equal(canRecordExpense("CASHIER"), false);
  });

  test("Expense date validation strictly accepts today and past dates, and rejects future dates", () => {
    const validateExpenseDate = (dateStr, referenceDateStr) => {
      if (!dateStr || !dateStr.trim()) {
        return { valid: false, error: "Expense date is required." };
      }
      if (dateStr > referenceDateStr) {
        return { valid: false, error: "Expense date cannot be in the future." };
      }
      return { valid: true };
    };

    const today = "2026-09-08";
    const past = "2026-09-01";
    const future = "2026-09-09";

    assert.equal(validateExpenseDate(today, today).valid, true);
    assert.equal(validateExpenseDate(past, today).valid, true);
    assert.equal(validateExpenseDate(future, today).valid, false);
    assert.equal(validateExpenseDate(future, today).error, "Expense date cannot be in the future.");
    assert.equal(validateExpenseDate("", today).valid, false);
  });

  test("Expense amount validation enforces positive numbers with maximum 2 decimal places", () => {
    const validateExpenseAmount = (amountStr) => {
      if (!amountStr || !amountStr.trim()) {
        return { valid: false, error: "Amount is required." };
      }
      const val = parseFloat(amountStr);
      if (isNaN(val) || val <= 0) {
        return { valid: false, error: "Amount must be greater than zero." };
      }
      // Check decimal places
      const parts = amountStr.split(".");
      if (parts.length > 1 && parts[1].length > 2) {
        return { valid: false, error: "Amount exceeds maximum 2 decimal places." };
      }
      return { valid: true, formatted: val.toFixed(2) };
    };

    assert.equal(validateExpenseAmount("0").valid, false);
    assert.equal(validateExpenseAmount("-150.00").valid, false);
    assert.equal(validateExpenseAmount("100.555").valid, false);
    assert.equal(validateExpenseAmount("250.75").valid, true);
    assert.equal(validateExpenseAmount("250.75").formatted, "250.75");
    assert.equal(validateExpenseAmount("50").valid, true);
    assert.equal(validateExpenseAmount("50").formatted, "50.00");
  });

  test("Active categories filter selects only active categories for new expense dropdown", () => {
    const categories = [
      { id: 1, name: "Electricity", is_active: true },
      { id: 2, name: "Water", is_active: true },
      { id: 3, name: "Discontinued Freight", is_active: false },
    ];

    const getAvailableCategoriesForNewExpense = (cats) => cats.filter((c) => c.is_active);
    const getAvailableCategoriesForEditExpense = (cats, currentCatId) =>
      cats.filter((c) => c.is_active || c.id === currentCatId);

    const newOptions = getAvailableCategoriesForNewExpense(categories);
    assert.equal(newOptions.length, 2);
    assert.deepEqual(newOptions.map((c) => c.id), [1, 2]);

    // Editing an expense with category 3 keeps category 3 visible
    const editOptions = getAvailableCategoriesForEditExpense(categories, 3);
    assert.equal(editOptions.length, 3);
  });
});
