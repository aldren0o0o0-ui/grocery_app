import { useState, useEffect, useRef, useMemo } from "react";
import useAuth from "../modules/auth/useAuth";
import { getPosProductsApi, checkoutSaleApi } from "../modules/sales/api";
import {
  Button,
  StatusBadge,
  Modal,
  Toast,
  Input,
} from "../components/common";

export const POSPage = () => {
  const { user } = useAuth();

  // Products catalog state
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");

  // Cart state: array of { product, quantity }
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState("0.00");

  // Checkout Modal state
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [amountPaid, setAmountPaid] = useState("");
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  // Receipt Modal state (completed sale response from server)
  const [completedSale, setCompletedSale] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const searchInputRef = useRef(null);

  // Load products on search change
  const fetchProducts = async (searchTerm = "") => {
    try {
      setCatalogLoading(true);
      setCatalogError("");
      const res = await getPosProductsApi({ search: searchTerm, per_page: 50 });
      setProducts(res.products || []);
    } catch (err) {
      setCatalogError(err.response?.data?.message || "Failed to load products.");
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      const q = parseFloat(item.quantity) || 0;
      const p = parseFloat(item.product.selling_price) || 0;
      return acc + Math.round(q * p * 100) / 100;
    }, 0);
  }, [cart]);

  const parsedDiscount = useMemo(() => {
    const d = parseFloat(discount) || 0;
    return d > 0 ? d : 0;
  }, [discount]);

  const cartTotal = useMemo(() => {
    const tot = cartSubtotal - parsedDiscount;
    return tot > 0 ? Math.round(tot * 100) / 100 : 0;
  }, [cartSubtotal, parsedDiscount]);

  // Add Product to Cart
  const handleAddToCart = (product, quantityToAdd = 1) => {
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const updated = [...prevCart];
        const currentQty = parseFloat(updated[existingIndex].quantity) || 0;
        const newQty = (currentQty + quantityToAdd).toFixed(3);
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty.replace(/\.?0+$/, "") || "1",
        };
        return updated;
      } else {
        return [...prevCart, { product, quantity: String(quantityToAdd) }];
      }
    });
  };

  // Barcode / SKU auto-add on Enter key
  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && search.trim()) {
      const trimmed = search.trim().toLowerCase();
      const exactMatch = products.find(
        (p) =>
          (p.barcode && p.barcode.toLowerCase() === trimmed) ||
          (p.sku && p.sku.toLowerCase() === trimmed)
      );
      if (exactMatch) {
        handleAddToCart(exactMatch, 1);
        setSearch("");
      } else if (products.length === 1) {
        handleAddToCart(products[0], 1);
        setSearch("");
      }
    }
  };

  const handleUpdateQuantity = (productId, newQtyStr) => {
    const q = parseFloat(newQtyStr);
    if (isNaN(q) || q <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.product.id === productId ? { ...item, quantity: newQtyStr } : item
      )
    );
  };

  const handleIncrement = (productId) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          const current = parseFloat(item.quantity) || 0;
          return { ...item, quantity: (current + 1).toString() };
        }
        return item;
      })
    );
  };

  const handleDecrement = (productId) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.product.id === productId) {
            const current = parseFloat(item.quantity) || 0;
            const next = current - 1;
            return next > 0 ? { ...item, quantity: next.toString() } : null;
          }
          return item;
        })
        .filter(Boolean);
    });
  };

  const handleRemoveItem = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setDiscount("0.00");
  };

  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setPaymentMethod("CASH");
    setAmountPaid(cartTotal.toFixed(2));
    setCheckoutError("");
    setIsCheckoutModalOpen(true);
  };

  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);
    if (method !== "CASH") {
      setAmountPaid(cartTotal.toFixed(2));
    }
  };

  const handleQuickCash = (amount) => {
    setAmountPaid(amount.toFixed(2));
  };

  const cashChange = useMemo(() => {
    if (paymentMethod !== "CASH") return 0;
    const paid = parseFloat(amountPaid) || 0;
    return Math.max(0, Math.round((paid - cartTotal) * 100) / 100);
  }, [paymentMethod, amountPaid, cartTotal]);

  const isCashInsufficient = useMemo(() => {
    if (paymentMethod !== "CASH") return false;
    const paid = parseFloat(amountPaid) || 0;
    return paid < cartTotal;
  }, [paymentMethod, amountPaid, cartTotal]);

  const handleCompleteCheckout = async () => {
    setCheckoutError("");
    if (isCashInsufficient) {
      setCheckoutError(`Insufficient cash. Amount paid must be at least ₱${cartTotal.toFixed(2)}.`);
      return;
    }

    setCheckoutSubmitting(true);
    try {
      const payload = {
        discount: parsedDiscount.toFixed(2),
        payment: {
          method: paymentMethod,
          amount_paid: paymentMethod === "CASH" ? parseFloat(amountPaid || 0).toFixed(2) : cartTotal.toFixed(2),
        },
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: typeof item.quantity === "number" ? item.quantity.toFixed(3) : item.quantity.toString(),
        })),
      };

      const res = await checkoutSaleApi(payload);

      if (res?.sale || res?.status === "success") {
        setCompletedSale(res.sale || res.data);
        setIsCheckoutModalOpen(false);
        setCart([]);
        setDiscount("0.00");
        fetchProducts(search);
      } else {
        setCheckoutError(res?.message || "Checkout failed.");
      }
    } catch (err) {
      setCheckoutError(err.response?.data?.error?.message || err.message || "Failed to process sale.");
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Toast */}
      {toastMessage && (
        <Toast
          type={toastMessage.type}
          message={toastMessage.text}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* POS Top Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          backgroundColor: "var(--color-surface)",
          padding: "12px 20px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "var(--color-text)", margin: 0 }}>
            🛒 Retail Checkout Terminal
          </h1>
          <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
            Cashier: <strong>{user?.first_name} {user?.last_name}</strong> • Timezone: Asia/Manila (PHT)
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              fontSize: "12px",
              padding: "4px 10px",
              backgroundColor: "var(--color-primary-soft)",
              color: "var(--color-primary)",
              borderRadius: "var(--radius-full)",
              fontWeight: 700,
            }}
          >
            ACTIVE SESSION
          </span>
        </div>
      </div>

      {/* Main POS Grid: 65% Catalog, 35% Cart */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 380px",
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* Left Panel: Search & Products Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Search Bar */}
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              padding: "14px 16px",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Scan barcode or type product name / SKU (Press Enter to quick-add)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
              style={{
                width: "100%",
                height: "44px",
                padding: "0 14px",
                fontSize: "14px",
                fontFamily: "var(--font-sans)",
                border: "2px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                outline: "none",
                transition: "border-color 0.15s ease",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
            />
          </div>

          {catalogError && (
            <div
              role="alert"
              style={{
                padding: "10px 14px",
                backgroundColor: "var(--color-danger-soft)",
                border: "1px solid var(--color-danger)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-danger)",
                fontSize: "13px",
              }}
            >
              ⚠️ {catalogError}
            </div>
          )}

          {/* Product Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "14px",
              maxHeight: "calc(100vh - 240px)",
              overflowY: "auto",
              paddingRight: "4px",
            }}
          >
            {catalogLoading && products.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", padding: "48px 0", textAlign: "center", color: "var(--color-text-secondary)" }}>
                Loading catalog products...
              </div>
            ) : products.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", padding: "48px 0", textAlign: "center", color: "var(--color-text-muted)", fontSize: "14px" }}>
                No products found matching &quot;{search}&quot;.
              </div>
            ) : (
              products.map((p) => {
                const stock = parseFloat(p.stock_quantity) || 0;
                const isOutOfStock = stock <= 0;

                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => handleAddToCart(p, 1)}
                    style={{
                      backgroundColor: isOutOfStock ? "var(--color-bg)" : "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-lg)",
                      padding: "14px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      textAlign: "left",
                      cursor: isOutOfStock ? "not-allowed" : "pointer",
                      transition: "all 0.15s ease",
                      boxShadow: "var(--shadow-sm)",
                      opacity: isOutOfStock ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isOutOfStock) {
                        e.currentTarget.style.borderColor = "var(--color-primary)";
                        e.currentTarget.style.boxShadow = "var(--shadow-md)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isOutOfStock) {
                        e.currentTarget.style.borderColor = "var(--color-border)";
                        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                      }
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginBottom: "4px" }}>
                        {p.sku}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--color-text)", lineHeight: 1.3, marginBottom: "8px" }}>
                        {p.name}
                      </div>
                    </div>

                    <div style={{ marginTop: "8px" }}>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--color-primary)", marginBottom: "6px" }}>
                        ₱{parseFloat(p.selling_price).toFixed(2)}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
                          {stock.toFixed(0)} {p.unit}
                        </span>
                        <StatusBadge
                          status={isOutOfStock ? "OUT" : "IN"}
                          variant={isOutOfStock ? "danger" : "success"}
                        />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Cart & Checkout */}
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            maxHeight: "calc(100vh - 170px)",
          }}
        >
          {/* Cart Header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--color-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
                Current Order
              </h2>
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                {cart.length} unique items
              </span>
            </div>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearCart}>
                Clear
              </Button>
            )}
          </div>

          {/* Cart Items List */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {cart.length === 0 ? (
              <div style={{ padding: "48px 0", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
                Cart is empty. Click a product or scan a barcode to begin checkout.
              </div>
            ) : (
              cart.map((item) => {
                const itemSubtotal =
                  (parseFloat(item.quantity) || 0) * (parseFloat(item.product.selling_price) || 0);

                return (
                  <div
                    key={item.product.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      backgroundColor: "var(--color-bg)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border-subtle)",
                      gap: "10px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.product.name}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
                        ₱{parseFloat(item.product.selling_price).toFixed(2)} / {item.product.unit}
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <button
                        type="button"
                        onClick={() => handleDecrement(item.product.id)}
                        style={{
                          width: "26px",
                          height: "26px",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--color-border)",
                          backgroundColor: "var(--color-surface)",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={item.quantity}
                        onChange={(e) => handleUpdateQuantity(item.product.id, e.target.value)}
                        style={{
                          width: "44px",
                          height: "26px",
                          textAlign: "center",
                          fontSize: "12px",
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                          border: "1px solid var(--color-border)",
                          borderRadius: "var(--radius-sm)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleIncrement(item.product.id)}
                        style={{
                          width: "26px",
                          height: "26px",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--color-border)",
                          backgroundColor: "var(--color-surface)",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        +
                      </button>
                    </div>

                    <div style={{ textAlign: "right", minWidth: "60px" }}>
                      <strong style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--color-text)" }}>
                        ₱{itemSubtotal.toFixed(2)}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.product.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--color-danger)",
                        cursor: "pointer",
                        padding: "2px 4px",
                        fontSize: "14px",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Cart Footer & Checkout */}
          <div
            style={{
              padding: "16px 20px",
              borderTop: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface)",
              borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px", color: "var(--color-text-secondary)" }}>
              <span>Subtotal:</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>₱{cartSubtotal.toFixed(2)}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", fontSize: "13px", color: "var(--color-text-secondary)" }}>
              <span>Discount (₱):</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0.00"
                style={{
                  width: "90px",
                  height: "30px",
                  textAlign: "right",
                  padding: "0 8px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                padding: "12px 0",
                borderTop: "1px solid var(--color-border-subtle)",
                marginBottom: "12px",
              }}
            >
              <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text)" }}>Total Due:</span>
              <span style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-primary)", fontFamily: "var(--font-mono)" }}>
                ₱{cartTotal.toFixed(2)}
              </span>
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={handleOpenCheckout}
              disabled={cart.length === 0}
              style={{ width: "100%" }}
            >
              Checkout & Pay (₱{cartTotal.toFixed(2)})
            </Button>
          </div>
        </div>
      </div>

      {/* Checkout Payment Modal */}
      <Modal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        title="Checkout Payment"
        maxWidth="480px"
      >
        {checkoutError && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              backgroundColor: "var(--color-danger-soft)",
              border: "1px solid var(--color-danger)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-danger)",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {checkoutError}
          </div>
        )}

        {/* Total Display */}
        <div
          style={{
            backgroundColor: "var(--color-primary-soft)",
            border: "1px solid var(--color-primary)",
            borderRadius: "var(--radius-md)",
            padding: "16px",
            textAlign: "center",
            marginBottom: "16px",
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--color-primary-hover)", fontWeight: 700 }}>TOTAL AMOUNT DUE</div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--color-primary)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
            ₱{cartTotal.toFixed(2)}
          </div>
        </div>

        {/* Payment Method Selector */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--color-text)", marginBottom: "6px" }}>
            Payment Method
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            {["CASH", "GCASH", "CARD"].map((method) => (
              <Button
                key={method}
                type="button"
                variant={paymentMethod === method ? "primary" : "secondary"}
                size="md"
                onClick={() => handlePaymentMethodChange(method)}
              >
                {method}
              </Button>
            ))}
          </div>
        </div>

        {/* Cash Input */}
        {paymentMethod === "CASH" && (
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--color-text)", marginBottom: "6px" }}>
              Cash Received (₱)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              style={{ fontSize: "16px", fontWeight: 700 }}
              error={isCashInsufficient}
            />

            {/* Quick Denominations */}
            <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
              <Button variant="secondary" size="sm" onClick={() => handleQuickCash(cartTotal)}>
                Exact (₱{cartTotal.toFixed(2)})
              </Button>
              {[50, 100, 200, 500, 1000].map((denom) => (
                <Button key={denom} variant="secondary" size="sm" onClick={() => handleQuickCash(denom)}>
                  ₱{denom}
                </Button>
              ))}
            </div>

            {/* Change Due Preview */}
            <div
              style={{
                marginTop: "12px",
                padding: "10px 14px",
                backgroundColor: isCashInsufficient ? "var(--color-danger-soft)" : "var(--color-primary-soft)",
                borderRadius: "var(--radius-md)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "13px",
              }}
            >
              <span style={{ fontWeight: 600, color: isCashInsufficient ? "var(--color-danger)" : "var(--color-primary-hover)" }}>
                {isCashInsufficient ? "Shortage:" : "Change Due:"}
              </span>
              <strong style={{ fontSize: "18px", fontFamily: "var(--font-mono)", color: isCashInsufficient ? "var(--color-danger)" : "var(--color-primary)" }}>
                ₱{isCashInsufficient ? (cartTotal - (parseFloat(amountPaid) || 0)).toFixed(2) : cashChange.toFixed(2)}
              </strong>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setIsCheckoutModalOpen(false)}
            disabled={checkoutSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleCompleteCheckout}
            loading={checkoutSubmitting}
            disabled={checkoutSubmitting || isCashInsufficient}
          >
            Complete Sale
          </Button>
        </div>
      </Modal>

      {/* Printable Receipt Modal */}
      <Modal
        isOpen={Boolean(completedSale)}
        onClose={() => setCompletedSale(null)}
        title="Sale Completed Successfully!"
        maxWidth="460px"
      >
        {completedSale && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div
              style={{
                border: "1px dashed var(--color-border)",
                padding: "20px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-bg)",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: "12px" }}>
                <div style={{ fontSize: "16px", fontWeight: 800 }}>GROCERY SME SYSTEM</div>
                <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>Official Sales Receipt</div>
                <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>Invoice: {completedSale.invoice_number}</div>
                <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>Date: {new Date(completedSale.created_at).toLocaleString()}</div>
              </div>

              <div style={{ borderBottom: "1px solid var(--color-border)", margin: "8px 0" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {(completedSale.items || []).map((it) => (
                  <div key={it.id} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{it.quantity}x {it.product_name}</span>
                    <span>₱{parseFloat(it.line_total).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderBottom: "1px solid var(--color-border)", margin: "8px 0" }} />

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Subtotal:</span>
                <span>₱{parseFloat(completedSale.subtotal || completedSale.total).toFixed(2)}</span>
              </div>
              {parseFloat(completedSale.discount || 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-danger)" }}>
                  <span>Discount:</span>
                  <span>-₱{parseFloat(completedSale.discount).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: 800, marginTop: "4px" }}>
                <span>TOTAL PAID:</span>
                <span>₱{parseFloat(completedSale.total).toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-text-secondary)", marginTop: "4px" }}>
                <span>Method:</span>
                <span>{completedSale.payment_method}</span>
              </div>
              {completedSale.change !== undefined && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-text-secondary)" }}>
                  <span>Change:</span>
                  <span>₱{parseFloat(completedSale.change || 0).toFixed(2)}</span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <Button
                variant="secondary"
                size="md"
                onClick={() => window.print()}
                style={{ flex: 1 }}
              >
                🖨️ Print Receipt
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => setCompletedSale(null)}
                style={{ flex: 1 }}
              >
                Start New Sale
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default POSPage;
