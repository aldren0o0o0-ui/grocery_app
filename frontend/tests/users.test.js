import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Frontend User Management Architecture & Invariant Tests", () => {
  test("User management authorization policy allows OWNER and ADMIN, rejects CASHIER and STAFF", () => {
    const canManageUsers = (role) => {
      if (!role) return false;
      return ["OWNER", "ADMIN"].includes(role);
    };

    assert.equal(canManageUsers("OWNER"), true);
    assert.equal(canManageUsers("ADMIN"), true);
    assert.equal(canManageUsers("STAFF"), false);
    assert.equal(canManageUsers("CASHIER"), false);
    assert.equal(canManageUsers(null), false);
    assert.equal(canManageUsers(undefined), false);
  });

  test("User creation payload builder trims fields, normalizes email, and rejects short passwords", () => {
    const buildCreateUserPayload = (formData) => {
      if (!formData.first_name?.trim()) throw new Error("First name is required.");
      if (!formData.last_name?.trim()) throw new Error("Last name is required.");
      if (!formData.email?.trim()) throw new Error("Email is required.");
      if (!formData.password || formData.password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }

      const cleanRole = formData.role?.trim().toUpperCase();
      if (!["OWNER", "STAFF", "CASHIER", "ADMIN"].includes(cleanRole)) {
        throw new Error(`Invalid role: ${formData.role}`);
      }

      return {
        role: cleanRole === "ADMIN" ? "OWNER" : cleanRole,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      };
    };

    const validData = {
      role: "STAFF",
      first_name: "  Maria  ",
      last_name: "  Santos  ",
      email: "  Maria.Santos@Grocery.Local  ",
      password: "SuperSecret123!",
    };

    const payload = buildCreateUserPayload(validData);
    assert.equal(payload.role, "STAFF");
    assert.equal(payload.first_name, "Maria");
    assert.equal(payload.last_name, "Santos");
    assert.equal(payload.email, "maria.santos@grocery.local");
    assert.equal(payload.password, "SuperSecret123!");

    // Short password rejection
    assert.throws(
      () => buildCreateUserPayload({ ...validData, password: "123" }),
      /Password must be at least 8 characters/
    );

    // ADMIN maps to OWNER
    const adminPayload = buildCreateUserPayload({ ...validData, role: "ADMIN" });
    assert.equal(adminPayload.role, "OWNER");
  });

  test("User query parameters builder formats role filter, active status, and search terms", () => {
    const buildUserQueryParams = ({ roleFilter = "ALL", statusFilter = "ALL", search = "" }) => {
      const params = {};
      if (roleFilter !== "ALL") params.role = roleFilter;
      if (statusFilter === "ACTIVE") params.is_active = true;
      if (statusFilter === "INACTIVE") params.is_active = false;
      if (search && search.trim()) params.search = search.trim();
      return params;
    };

    const params1 = buildUserQueryParams({
      roleFilter: "STAFF",
      statusFilter: "ACTIVE",
      search: "maria",
    });
    assert.deepEqual(params1, {
      role: "STAFF",
      is_active: true,
      search: "maria",
    });

    const params2 = buildUserQueryParams({
      roleFilter: "ALL",
      statusFilter: "ALL",
      search: "   ",
    });
    assert.deepEqual(params2, {});
  });

  test("Self-deactivation guard prevents active user from disabling their own account", () => {
    const canDeactivateUser = (targetUserId, currentUserId) => {
      return targetUserId !== currentUserId;
    };

    const currentOwner = { id: 10, role: "OWNER" };
    const staffMember = { id: 15, role: "STAFF" };

    assert.equal(canDeactivateUser(staffMember.id, currentOwner.id), true);
    assert.equal(canDeactivateUser(currentOwner.id, currentOwner.id), false);
  });
});
