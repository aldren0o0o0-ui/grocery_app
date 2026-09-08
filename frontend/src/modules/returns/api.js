import client from "../../api/client";

/**
 * Creates a sales return and records refund with inventory restoration.
 * @param {Object} payload - { sale_id, reason, refund_method, items: [{ sale_item_id, quantity }] }
 */
export const createReturnApi = async (payload) => {
  const response = await client.post("/returns", payload);
  return response.data;
};

/**
 * Fetches paginated sales returns list.
 * @param {Object} params - { page, per_page, search, refund_method, date_from, date_to, processed_by }
 */
export const getReturnsApi = async (params = {}) => {
  const cleanParams = {};
  if (params.page) cleanParams.page = params.page;
  if (params.per_page) cleanParams.per_page = params.per_page;
  if (params.search && params.search.trim()) cleanParams.search = params.search.trim();
  if (params.refund_method && params.refund_method !== "ALL") cleanParams.refund_method = params.refund_method;
  if (params.date_from) cleanParams.date_from = params.date_from;
  if (params.date_to) cleanParams.date_to = params.date_to;
  if (params.processed_by) cleanParams.processed_by = params.processed_by;

  const response = await client.get("/returns", { params: cleanParams });
  return response.data;
};

/**
 * Fetches return details with line items and original sale context.
 * @param {number|string} id
 */
export const getReturnDetailApi = async (id) => {
  const response = await client.get(`/returns/${id}`);
  return response.data;
};
