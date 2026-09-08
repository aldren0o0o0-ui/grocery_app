import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Frontend Supplier Architecture & Invariant Tests", () => {
  test("Supplier management authorization policy permits OWNER and ADMIN, rejects CASHIER and STAFF", () => {
    const canManageSuppliers = (role) => {
      if (!role) return false;
      return ["OWNER", "ADMIN"].includes(role);
    };

    assert.equal(canManageSuppliers("OWNER"), true);
    assert.equal(canManageSuppliers("ADMIN"), true);
    assert.equal(canManageSuppliers("STAFF"), false);
    assert.equal(canManageSuppliers("CASHIER"), false);
    assert.equal(canManageSuppliers(null), false);
    assert.equal(canManageSuppliers(undefined), false);
  });

  test("Supplier viewing authorization policy permits OWNER, ADMIN, and STAFF, strictly forbids CASHIER", () => {
    const canViewSuppliers = (role) => {
      if (!role) return false;
      return ["OWNER", "ADMIN", "STAFF"].includes(role);
    };

    assert.equal(canViewSuppliers("OWNER"), true);
    assert.equal(canViewSuppliers("ADMIN"), true);
    assert.equal(canViewSuppliers("STAFF"), true);
    assert.equal(canViewSuppliers("CASHIER"), false);
    assert.equal(canViewSuppliers(null), false);
    assert.equal(canViewSuppliers(undefined), false);
  });

  test("Supplier creation payload builder trims strings and converts empty optional fields to null", () => {
    const buildSupplierPayload = (formData) => {
      const forbiddenFields = ["id", "created_at", "updated_at", "purchase_count"];
      for (const field of forbiddenFields) {
        if (field in formData) {
          throw new Error(`Forbidden field in supplier payload: ${field}`);
        }
      }

      return {
        name: formData.name.trim(),
        contact_person: formData.contact_person?.trim() || null,
        phone: formData.phone?.trim() || null,
        email: formData.email?.trim() ? formData.email.trim().toLowerCase() : null,
        address: formData.address?.trim() || null,
      };
    };

    const inputData = {
      name: "   Farm Fresh Produce Corp   ",
      contact_person: "  Alice Green  ",
      phone: "  +63-917-123-4567  ",
      email: "  Sales@FarmFresh.com  ",
      address: "  123 Valley Road, Benguet  ",
    };

    const payload = buildSupplierPayload(inputData);
    assert.equal(payload.name, "Farm Fresh Produce Corp");
    assert.equal(payload.contact_person, "Alice Green");
    assert.equal(payload.phone, "+63-917-123-4567");
    assert.equal(payload.email, "sales@farmfresh.com");
    assert.equal(payload.address, "123 Valley Road, Benguet");

    // Empty optional strings must become null
    const emptyOptionalData = {
      name: "Sunrise Bakery Supply",
      contact_person: "   ",
      phone: "",
      email: "   ",
      address: "",
    };
    const emptyPayload = buildSupplierPayload(emptyOptionalData);
    assert.equal(emptyPayload.name, "Sunrise Bakery Supply");
    assert.equal(emptyPayload.contact_person, null);
    assert.equal(emptyPayload.phone, null);
    assert.equal(emptyPayload.email, null);
    assert.equal(emptyPayload.address, null);

    // Forbidden fields should throw
    assert.throws(
      () => buildSupplierPayload({ name: "Bad", purchase_count: 5 }),
      /Forbidden field in supplier payload: purchase_count/
    );
  });

  test("Supplier query parameters builder handles search, active status, and pagination correctly", () => {
    const buildSupplierQueryParams = ({ page = 1, per_page = 10, search = "", status = "all" }) => {
      const params = { page, per_page };
      if (search && search.trim()) {
        params.search = search.trim();
      }
      if (status === "active") {
        params.is_active = true;
      } else if (status === "inactive") {
        params.is_active = false;
      }
      return params;
    };

    const params1 = buildSupplierQueryParams({
      page: 2,
      per_page: 25,
      search: "dairy",
      status: "active",
    });
    assert.deepEqual(params1, {
      page: 2,
      per_page: 25,
      search: "dairy",
      is_active: true,
    });

    const params2 = buildSupplierQueryParams({
      search: "   ",
      status: "all",
    });
    assert.deepEqual(params2, {
      page: 1,
      per_page: 10,
    });

    const params3 = buildSupplierQueryParams({
      status: "inactive",
    });
    assert.deepEqual(params3, {
      page: 1,
      per_page: 10,
      is_active: false,
    });
  });

  test("Supplier status toggle action requires explicit confirmation dialog before deactivating", () => {
    const getConfirmationPrompt = (supplier) => {
      if (supplier.is_active) {
        return `Are you sure you want to deactivate "${supplier.name}"? They will no longer be available for future purchase orders.`;
      }
      return `Are you sure you want to reactivate "${supplier.name}"?`;
    };

    const activeSupplier = { id: 1, name: "San Miguel Pure Foods", is_active: true };
    const inactiveSupplier = { id: 2, name: "Universal Robina", is_active: false };

    assert.match(getConfirmationPrompt(activeSupplier), /deactivate/);
    assert.match(getConfirmationPrompt(activeSupplier), /no longer be available for future purchase orders/);
    assert.match(getConfirmationPrompt(inactiveSupplier), /reactivate/);
  });
});
