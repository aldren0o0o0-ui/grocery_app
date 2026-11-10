/**
 * Centralized User Profile & Name Resolver
 * Ensures that when a user's name/profile is updated in Team & Staff,
 * the updated identity is globally reflected across Sales History, Returns & Refunds,
 * Dashboard, POS, and Receipts without code duplication or state desync.
 */

const OVERRIDES_STORAGE_KEY = "ff_user_profile_overrides";
const ALIASES_STORAGE_KEY = "ff_user_name_aliases";

export const getUserOverrides = () => {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDES_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

export const getNameAliases = () => {
  try {
    return JSON.parse(localStorage.getItem(ALIASES_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

/**
 * Persistently records a user profile update and registers name aliases.
 */
export const recordUserUpdate = (userId, updatedFields, originalName = null) => {
  if (!userId) return;

  const overrides = getUserOverrides();
  const existing = overrides[userId] || {};

  const firstName = updatedFields.first_name ?? existing.first_name ?? "";
  const lastName = updatedFields.last_name ?? existing.last_name ?? "";
  const newFullName = `${firstName} ${lastName}`.trim();

  // If originalName is passed, or exists in existing record
  const oldName = originalName || existing.oldName || null;

  overrides[userId] = {
    ...existing,
    ...updatedFields,
    first_name: firstName,
    last_name: lastName,
    fullName: newFullName,
    oldName: oldName,
  };

  try {
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.error("Failed to persist user overrides:", e);
  }

  // Update name aliases mapping so string name references resolve to the updated name
  const aliases = getNameAliases();
  if (newFullName) {
    aliases[String(userId)] = newFullName;
  }
  if (oldName && oldName.trim() && newFullName) {
    aliases[oldName.trim().toLowerCase()] = newFullName;
  }
  if (existing.fullName && existing.fullName.trim() && newFullName) {
    aliases[existing.fullName.trim().toLowerCase()] = newFullName;
  }

  try {
    localStorage.setItem(ALIASES_STORAGE_KEY, JSON.stringify(aliases));
  } catch (e) {
    console.error("Failed to persist name aliases:", e);
  }

  // Dispatch custom window event so any listening components can re-render if needed
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ff_user_profile_updated", { detail: { userId, newFullName } }));
  }
};

/**
 * Registers baseline users from backend API to ensure accurate ID <-> Name correlation.
 */
export const registerBaseUsers = (usersList = []) => {
  if (!Array.isArray(usersList)) return;
  const overrides = getUserOverrides();
  const aliases = getNameAliases();
  let updated = false;

  usersList.forEach((u) => {
    if (!u || !u.id) return;
    const baseFullName = `${u.first_name || ""} ${u.last_name || ""}`.trim();
    const ov = overrides[u.id];

    if (ov) {
      const newFullName = `${ov.first_name || ""} ${ov.last_name || ""}`.trim();
      if (baseFullName && newFullName && baseFullName.toLowerCase() !== newFullName.toLowerCase()) {
        aliases[baseFullName.toLowerCase()] = newFullName;
        aliases[String(u.id)] = newFullName;
        if (!ov.oldName) {
          ov.oldName = baseFullName;
          updated = true;
        }
      }
    }
  });

  if (updated) {
    try {
      localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
    } catch {}
  }
  try {
    localStorage.setItem(ALIASES_STORAGE_KEY, JSON.stringify(aliases));
  } catch {}
};

/**
 * Universally resolves a cashier or staff member's display name.
 * Accepts user ID, user object, or legacy string name.
 */
export const resolveUserName = (target, fallback = "Staff") => {
  if (!target && target !== 0) return fallback;

  const overrides = getUserOverrides();
  const aliases = getNameAliases();

  // Case 1: Target is an object with user info (e.g. { id, name, cashier_id, ... })
  if (typeof target === "object") {
    const uid = target.id || target.user_id || target.cashier_id || target.processor_id;
    if (uid && overrides[uid]) {
      const ov = overrides[uid];
      const name = `${ov.first_name || ""} ${ov.last_name || ""}`.trim();
      if (name) return name;
    }

    const directName =
      target.name ||
      (target.first_name ? `${target.first_name} ${target.last_name || ""}`.trim() : null) ||
      target.cashier_name ||
      target.processor_name;

    if (directName) {
      return resolveUserName(directName, fallback);
    }
    return fallback;
  }

  // Case 2: Target is a user ID (number or numeric string)
  if (typeof target === "number" || (typeof target === "string" && /^\d+$/.test(target))) {
    const uid = Number(target);
    if (overrides[uid]) {
      const ov = overrides[uid];
      const name = `${ov.first_name || ""} ${ov.last_name || ""}`.trim();
      if (name) return name;
    }
    if (aliases[String(uid)]) {
      return aliases[String(uid)];
    }
  }

  // Case 3: Target is a string name (e.g. "John Miller")
  const targetStr = String(target).trim();
  const lower = targetStr.toLowerCase();

  if (aliases[lower]) {
    return aliases[lower];
  }

  // Check in overrides for matching oldName
  for (const uid in overrides) {
    const ov = overrides[uid];
    if (ov.oldName && ov.oldName.trim().toLowerCase() === lower) {
      const name = `${ov.first_name || ""} ${ov.last_name || ""}`.trim();
      if (name) return name;
    }
    if (ov.fullName && ov.fullName.trim().toLowerCase() === lower) {
      return ov.fullName;
    }
  }

  return targetStr || fallback;
};
