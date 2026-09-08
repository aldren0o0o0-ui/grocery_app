import client from "../../api/client";

/**
 * Fetches active products for POS lookup and barcode scanning.
 * @param {Object} params - { search, category_id, page, per_page }
 */
export const getPosProductsApi = async (params = {}) => {
  const cleanParams = {};
  if (params.search && params.search.trim()) cleanParams.search = params.search.trim();
  if (params.category_id) cleanParams.category_id = params.category_id;
  if (params.page) cleanParams.page = params.page;
  if (params.per_page) cleanParams.per_page = params.per_page;

  const response = await client.get("/sales/products", { params: cleanParams });
  return response.data;
};

/**
 * Executes atomic checkout for a sale.
 * @param {Object} payload - { items: [{ product_id, quantity }], discount, payment: { method, amount_paid } }
 */
export const checkoutSaleApi = async (payload) => {
  const response = await client.post("/sales", payload);
  return response.data;
};

/**
 * Fetches paginated sales history.
 * @param {Object} params - { page, per_page, search, status, payment_method, date_from, date_to, cashier_id }
 */
export const getSalesApi = async (params = {}) => {
  const cleanParams = {};
  if (params.page) cleanParams.page = params.page;
  if (params.per_page) cleanParams.per_page = params.per_page;
  if (params.search && params.search.trim()) cleanParams.search = params.search.trim();
  if (params.status && params.status !== "ALL") cleanParams.status = params.status;
  if (params.payment_method && params.payment_method !== "ALL") cleanParams.payment_method = params.payment_method;
  if (params.date_from) cleanParams.date_from = params.date_from;
  if (params.date_to) cleanParams.date_to = params.date_to;
  if (params.cashier_id) cleanParams.cashier_id = params.cashier_id;

  const response = await client.get("/sales", { params: cleanParams });
  return response.data;
};

/**
 * Fetches full sale details with receipt items and payment.
 * @param {number|string} id
 */
export const getSaleDetailApi = async (id) => {
  const response = await client.get(`/sales/${id}`);
  return response.data;
};
