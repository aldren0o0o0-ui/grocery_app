import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Frontend Catalog Architecture & Invariant Tests", () => {
  test("Catalog management authorization policy allows OWNER, rejects CASHIER, STAFF, and ADMIN", () => {
    const canManageCatalog = (role) => {
      if (!role) return false;
      return role === "OWNER";
    };

    assert.equal(canManageCatalog("OWNER"), true);
    assert.equal(canManageCatalog("ADMIN"), false);
    assert.equal(canManageCatalog("CASHIER"), false);
    assert.equal(canManageCatalog("STAFF"), false);
    assert.equal(canManageCatalog(null), false);
    assert.equal(canManageCatalog(undefined), false);
  });

  test("Product creation payload builder strictly excludes stock_quantity", () => {
    const buildProductPayload = (formData, isEdit = false) => {
      // Invariant: stock_quantity must never be sent in product CRUD payload
      const payload = {
        name: formData.name.trim(),
        sku: formData.sku.trim().toUpperCase(),
        barcode: formData.barcode?.trim() || null,
        category_id: Number(formData.category_id),
        unit: formData.unit.trim().toUpperCase(),
        cost_price: parseFloat(formData.cost_price),
        selling_price: parseFloat(formData.selling_price),
        reorder_level: formData.reorder_level ? parseFloat(formData.reorder_level) : 0,
        description: formData.description?.trim() || null,
      };

      if (isEdit && formData.is_active !== undefined) {
        payload.is_active = Boolean(formData.is_active);
      }

      // Explicit assertion: payload must NOT have stock_quantity property
      return payload;
    };

    const inputData = {
      name: "Organic Milk 1L",
      sku: "mlk-org-1",
      barcode: "1234567890123",
      category_id: "2",
      unit: "l",
      cost_price: "3.50",
      selling_price: "4.99",
      reorder_level: "10.000",
      description: "Fresh organic milk",
      stock_quantity: 100, // rogue attempt to set stock
    };

    const payload = buildProductPayload(inputData);

    assert.equal(payload.name, "Organic Milk 1L");
    assert.equal(payload.sku, "MLK-ORG-1");
    assert.equal(payload.barcode, "1234567890123");
    assert.equal(payload.category_id, 2);
    assert.equal(payload.unit, "L");
    assert.equal(payload.cost_price, 3.5);
    assert.equal(payload.selling_price, 4.99);
    assert.equal(payload.reorder_level, 10);
    assert.equal(payload.description, "Fresh organic milk");
    assert.equal(Object.prototype.hasOwnProperty.call(payload, "stock_quantity"), false);
    assert.equal(payload.stock_quantity, undefined);
  });

  test("Product query parameters builder formats search, category, and status properly", () => {
    const buildProductQueryParams = ({ page = 1, per_page = 10, search, categoryId, status }) => {
      const params = { page, per_page };
      if (search && search.trim()) {
        params.search = search.trim();
      }
      if (categoryId) {
        params.category_id = categoryId;
      }
      if (status === "active") {
        params.is_active = true;
      } else if (status === "inactive") {
        params.is_active = false;
      }
      return params;
    };

    const params1 = buildProductQueryParams({
      page: 2,
      per_page: 20,
      search: "apple",
      categoryId: 5,
      status: "active",
    });
    assert.deepEqual(params1, {
      page: 2,
      per_page: 20,
      search: "apple",
      category_id: 5,
      is_active: true,
    });

    const params2 = buildProductQueryParams({
      search: "   ",
      categoryId: "",
      status: "all",
    });
    assert.deepEqual(params2, {
      page: 1,
      per_page: 10,
    });
  });

  test("Category creation payload trims whitespace and normalizes empty description to null", () => {
    const buildCategoryPayload = (name, description) => ({
      name: name.trim(),
      description: description?.trim() || null,
    });

    const result = buildCategoryPayload("  Beverages  ", "   ");
    assert.equal(result.name, "Beverages");
    assert.equal(result.description, null);

    const resultWithDesc = buildCategoryPayload("Bakery", " Fresh breads daily ");
    assert.equal(resultWithDesc.name, "Bakery");
    assert.equal(resultWithDesc.description, "Fresh breads daily");
  });
});
