import client from "../../api/client";

/**
 * Fetches paginated list of purchases with optional filters.
 * @param {Object} params - { page, per_page, status, supplier_id, start_date, end_date, search }
 */
export const getPurchasesApi = async (params = {}) => {
  const cleanParams = {};
  if (params.page) cleanParams.page = params.page;
  if (params.per_page) cleanParams.per_page = params.per_page;
  if (params.status && params.status !== "ALL") cleanParams.status = params.status;
  if (params.supplier_id) cleanParams.supplier_id = params.supplier_id;
  if (params.start_date) cleanParams.start_date = params.start_date;
  if (params.end_date) cleanParams.end_date = params.end_date;
  if (params.search && params.search.trim()) cleanParams.search = params.search.trim();

  const response = await client.get("/purchases", { params: cleanParams });
  return response.data;
};

/**
 * Fetches full purchase details including line items.
 * @param {number|string} id - Purchase ID
 */
export const getPurchaseApi = async (id) => {
  const response = await client.get(`/purchases/${id}`);
  return response.data;
};

/**
 * Creates a new purchase in DRAFT status.
 * @param {Object} payload - { supplier_id, purchase_date, reference_number, items }
 */
export const createPurchaseApi = async (payload) => {
  const response = await client.post("/purchases", payload);
  return response.data;
};

/**
 * Adds a single line item to a draft purchase.
 * @param {number|string} purchaseId
 * @param {Object} itemPayload - { product_id, quantity, unit_cost }
 */
export const addPurchaseItemApi = async (purchaseId, itemPayload) => {
  const response = await client.post(`/purchases/${purchaseId}/items`, itemPayload);
  return response.data;
};

/**
 * Updates a line item in a draft purchase.
 * @param {number|string} purchaseId
 * @param {number|string} itemId
 * @param {Object} itemPayload - { quantity, unit_cost }
 */
export const updatePurchaseItemApi = async (purchaseId, itemId, itemPayload) => {
  const response = await client.patch(`/purchases/${purchaseId}/items/${itemId}`, itemPayload);
  return response.data;
};

/**
 * Removes a line item from a draft purchase.
 * @param {number|string} purchaseId
 * @param {number|string} itemId
 */
export const removePurchaseItemApi = async (purchaseId, itemId) => {
  const response = await client.delete(`/purchases/${purchaseId}/items/${itemId}`);
  return response.data;
};

/**
 * Atomically receives a purchase order.
 * @param {number|string} id
 */
export const receivePurchaseApi = async (id) => {
  const response = await client.post(`/purchases/${id}/receive`);
  return response.data;
};

/**
 * Cancels a draft purchase.
 * @param {number|string} id
 */
export const cancelPurchaseApi = async (id) => {
  const response = await client.post(`/purchases/${id}/cancel`);
  return response.data;
};

/**
 * Deletes a draft purchase (OWNER only).
 * @param {number|string} id
 */
export const deletePurchaseApi = async (id) => {
  const response = await client.delete(`/purchases/${id}`);
  return response.data;
};
