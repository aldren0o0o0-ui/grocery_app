import { useState, useEffect, useRef, useMemo } from "react";
import Navbar from "../components/Navbar";
import useAuth from "../modules/auth/useAuth";
import { getPosProductsApi, checkoutSaleApi } from "../modules/sales/api";

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

  // Add Product to Cart (or increment quantity if already in cart)
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
      // Match exact barcode or SKU first
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

  // Cart quantity adjustment
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
    if (window.confirm("Are you sure you want to clear the cart?")) {
      setCart([]);
      setDiscount("0.00");
    }
  };

  // Checkout modal controls
  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setPaymentMethod("CASH");
    setAmountPaid(cartTotal.toFixed(2));
    setCheckoutError("");
    setIsCheckoutModalOpen(true);
  };

  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);
    if (method === "GCASH" || method === "CARD") {
      setAmountPaid(cartTotal.toFixed(2));
    }
  };

  const handleQuickCash = (amount) => {
    setAmountPaid(amount.toFixed(2));
  };

  // Submit checkout
  const handleExecuteCheckout = async () => {
    try {
      setCheckoutSubmitting(true);
      setCheckoutError("");

      const payload = {
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
        discount: parsedDiscount.toFixed(2),
        payment: {
          method: paymentMethod,
          amount_paid: parseFloat(amountPaid || "0").toFixed(2),
        },
      };

      const res = await checkoutSaleApi(payload);

      // Successfully processed: reset cart, close checkout, open receipt
      setCart([]);
      setDiscount("0.00");
      setIsCheckoutModalOpen(false);
      setCompletedSale(res.sale);
      fetchProducts(search); // Refresh catalog stock display
    } catch (err) {
      setCheckoutError(err.response?.data?.message || "Checkout failed. Please check stock or inputs.");
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const handleNewSale = () => {
    setCompletedSale(null);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Change amount calculation for preview
  const cashAmountNum = parseFloat(amountPaid) || 0;
  const changePreview = cashAmountNum >= cartTotal ? (cashAmountNum - cartTotal).toFixed(2) : "0.00";
  const isCashInsufficient = paymentMethod === "CASH" && cashAmountNum < cartTotal;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ flex: 1, padding: "1rem 1.5rem", maxWidth: "1600px", width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
            backgroundColor: "#ffffff",
            padding: "0.75rem 1.25rem",
            borderRadius: "8px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "1.25rem", color: "#111827", fontWeight: "700" }}>Point of Sale (POS)</h1>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "#6b7280" }}>
              Fast grocery checkout &bull; Cashier: <strong>{user?.first_name} {user?.last_name}</strong>
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span
              style={{
                backgroundColor: "#ecfdf5",
                color: "#065f46",
                fontSize: "0.75rem",
                fontWeight: "600",
                padding: "0.25rem 0.6rem",
                borderRadius: "9999px",
                border: "1px solid #a7f3d0",
              }}
            >
              System Online
            </span>
          </div>
        </div>

        {/* 2-Column POS Layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1.25rem", alignItems: "start" }}>
          {/* Left Column: Product Search & Grid */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              padding: "1rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              minHeight: "650px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Search Input Bar */}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ position: "relative" }}>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Scan barcode or search product by name/SKU (Press Enter to add)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    fontSize: "0.95rem",
                    border: "2px solid #2563eb",
                    borderRadius: "6px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    style={{
                      position: "absolute",
                      right: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#9ca3af",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Error or Loading */}
            {catalogError && (
              <div style={{ padding: "0.75rem", backgroundColor: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.85rem" }}>
                {catalogError}
              </div>
            )}

            {/* Product Cards Grid */}
            <div style={{ flex: 1, overflowY: "auto", maxHeight: "550px", paddingRight: "0.25rem" }}>
              {catalogLoading ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "#6b7280" }}>Loading products...</div>
              ) : products.length === 0 ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>
                  No active products match your search.
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: "0.75rem",
                  }}
                >
                  {products.map((p) => {
                    const stockNum = parseFloat(p.stock_quantity) || 0;
                    const isOutOfStock = stockNum <= 0;

                    return (
                      <div
                        key={p.id}
                        onClick={() => !isOutOfStock && handleAddToCart(p, 1)}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: "6px",
                          padding: "0.75rem",
                          backgroundColor: isOutOfStock ? "#f9fafb" : "#ffffff",
                          cursor: isOutOfStock ? "not-allowed" : "pointer",
                          transition: "border-color 0.15s, box-shadow 0.15s",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          opacity: isOutOfStock ? 0.6 : 1,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.2rem" }}>
                            {p.sku} {p.barcode && `| ${p.barcode}`}
                          </div>
                          <div
                            style={{
                              fontSize: "0.9rem",
                              fontWeight: "600",
                              color: "#111827",
                              marginBottom: "0.4rem",
                              lineHeight: "1.2",
                              minHeight: "2.2rem",
                            }}
                          >
                            {p.name}
                          </div>
                        </div>

                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "0.5rem" }}>
                            <span style={{ fontSize: "1.05rem", fontWeight: "700", color: "#2563eb" }}>
                              ₱{parseFloat(p.selling_price).toFixed(2)}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>/{p.unit}</span>
                          </div>

                          <div style={{ marginTop: "0.4rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: "600",
                                color: isOutOfStock ? "#dc2626" : stockNum <= 5 ? "#d97706" : "#059669",
                              }}
                            >
                              {isOutOfStock ? "Out of Stock" : `Stock: ${stockNum} ${p.unit}`}
                            </span>
                            <button
                              disabled={isOutOfStock}
                              style={{
                                padding: "0.2rem 0.5rem",
                                backgroundColor: isOutOfStock ? "#e5e7eb" : "#2563eb",
                                color: isOutOfStock ? "#9ca3af" : "#ffffff",
                                border: "none",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: "600",
                                cursor: isOutOfStock ? "not-allowed" : "pointer",
                              }}
                            >
                              + Add
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Cart & Summary */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              padding: "1rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              minHeight: "650px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Cart Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #e5e7eb",
                paddingBottom: "0.75rem",
                marginBottom: "0.75rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h2 style={{ margin: 0, fontSize: "1.1rem", color: "#111827", fontWeight: "700" }}>Current Sale</h2>
                <span
                  style={{
                    backgroundColor: "#e0e7ff",
                    color: "#3730a3",
                    borderRadius: "9999px",
                    padding: "0.15rem 0.5rem",
                    fontSize: "0.75rem",
                    fontWeight: "600",
                  }}
                >
                  {cart.length} {cart.length === 1 ? "item" : "items"}
                </span>
              </div>
              <button
                onClick={handleClearCart}
                disabled={cart.length === 0}
                style={{
                  padding: "0.3rem 0.6rem",
                  backgroundColor: "#fee2e2",
                  color: "#dc2626",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  cursor: cart.length === 0 ? "not-allowed" : "pointer",
                  opacity: cart.length === 0 ? 0.5 : 1,
                }}
              >
                Clear Cart
              </button>
            </div>

            {/* Cart Items List */}
            <div style={{ flex: 1, overflowY: "auto", maxHeight: "360px", marginBottom: "1rem" }}>
              {cart.length === 0 ? (
                <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#9ca3af" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🛒</div>
                  <div>Cart is empty.</div>
                  <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "0.25rem" }}>
                    Scan a barcode or click products on the left to add items.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {cart.map((item) => {
                    const price = parseFloat(item.product.selling_price) || 0;
                    const qty = parseFloat(item.quantity) || 0;
                    const lineSubtotal = (price * qty).toFixed(2);

                    return (
                      <div
                        key={item.product.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.6rem",
                          border: "1px solid #f3f4f6",
                          borderRadius: "6px",
                          backgroundColor: "#fafafa",
                        }}
                      >
                        <div style={{ flex: 1, marginRight: "0.5rem" }}>
                          <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#111827" }}>
                            {item.product.name}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                            ₱{price.toFixed(2)} / {item.product.unit}
                          </div>
                        </div>

                        {/* Quantity Controls */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginRight: "0.75rem" }}>
                          <button
                            onClick={() => handleDecrement(item.product.id)}
                            style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "4px",
                              border: "1px solid #d1d5db",
                              backgroundColor: "#ffffff",
                              cursor: "pointer",
                              fontWeight: "bold",
                            }}
                          >
                            -
                          </button>
                          <input
                            type="text"
                            value={item.quantity}
                            onChange={(e) => handleUpdateQuantity(item.product.id, e.target.value)}
                            style={{
                              width: "48px",
                              textAlign: "center",
                              padding: "0.2rem",
                              fontSize: "0.85rem",
                              border: "1px solid #d1d5db",
                              borderRadius: "4px",
                            }}
                          />
                          <button
                            onClick={() => handleIncrement(item.product.id)}
                            style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "4px",
                              border: "1px solid #d1d5db",
                              backgroundColor: "#ffffff",
                              cursor: "pointer",
                              fontWeight: "bold",
                            }}
                          >
                            +
                          </button>
                        </div>

                        {/* Line Subtotal */}
                        <div style={{ textAlign: "right", minWidth: "65px" }}>
                          <div style={{ fontSize: "0.9rem", fontWeight: "700", color: "#111827" }}>
                            ₱{lineSubtotal}
                          </div>
                        </div>

                        {/* Delete Item */}
                        <button
                          onClick={() => handleRemoveItem(item.product.id)}
                          style={{
                            marginLeft: "0.5rem",
                            background: "none",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontSize: "1rem",
                            padding: "0.2rem",
                          }}
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cart Summary & Checkout */}
            <div style={{ borderTop: "2px solid #e5e7eb", paddingTop: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem", fontSize: "0.9rem", color: "#4b5563" }}>
                <span>Subtotal:</span>
                <span>₱{cartSubtotal.toFixed(2)}</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem", fontSize: "0.9rem", color: "#4b5563" }}>
                <span>Discount (₱):</span>
                <input
                  type="text"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: "80px",
                    textAlign: "right",
                    padding: "0.2rem 0.4rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "0.75rem 0",
                  borderTop: "1px solid #e5e7eb",
                  marginBottom: "0.75rem",
                }}
              >
                <span style={{ fontSize: "1.1rem", fontWeight: "700", color: "#111827" }}>Total Due:</span>
                <span style={{ fontSize: "1.6rem", fontWeight: "800", color: "#16a34a" }}>
                  ₱{cartTotal.toFixed(2)}
                </span>
              </div>

              <button
                onClick={handleOpenCheckout}
                disabled={cart.length === 0}
                style={{
                  width: "100%",
                  padding: "0.85rem",
                  backgroundColor: cart.length === 0 ? "#9ca3af" : "#16a34a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "1.1rem",
                  fontWeight: "700",
                  cursor: cart.length === 0 ? "not-allowed" : "pointer",
                  transition: "background-color 0.15s",
                }}
              >
                Checkout & Pay (₱{cartTotal.toFixed(2)})
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Checkout Payment Modal */}
      {isCheckoutModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              padding: "1.5rem",
              width: "480px",
              maxWidth: "90%",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#111827" }}>Checkout Payment</h2>
              <button
                onClick={() => setIsCheckoutModalOpen(false)}
                disabled={checkoutSubmitting}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {checkoutError && (
              <div style={{ padding: "0.75rem", backgroundColor: "#fee2e2", color: "#b91c1c", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.85rem" }}>
                {checkoutError}
              </div>
            )}

            {/* Total Display */}
            <div
              style={{
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "6px",
                padding: "1rem",
                textAlign: "center",
                marginBottom: "1.25rem",
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "#166534", fontWeight: "600" }}>TOTAL AMOUNT DUE</div>
              <div style={{ fontSize: "2rem", fontWeight: "800", color: "#15803d" }}>₱{cartTotal.toFixed(2)}</div>
            </div>

            {/* Payment Method Tabs */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#374151", marginBottom: "0.4rem" }}>
                Select Payment Method
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                {["CASH", "GCASH", "CARD"].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => handlePaymentMethodChange(method)}
                    style={{
                      padding: "0.6rem",
                      border: paymentMethod === method ? "2px solid #2563eb" : "1px solid #d1d5db",
                      borderRadius: "6px",
                      backgroundColor: paymentMethod === method ? "#eff6ff" : "#ffffff",
                      color: paymentMethod === method ? "#1e40af" : "#374151",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Input based on Method */}
            {paymentMethod === "CASH" ? (
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#374151", marginBottom: "0.4rem" }}>
                  Cash Received (₱)
                </label>
                <input
                  type="text"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.8rem",
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    border: isCashInsufficient ? "2px solid #ef4444" : "1px solid #d1d5db",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />

                {/* Quick denomination helpers */}
                <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => handleQuickCash(cartTotal)}
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", border: "1px solid #d1d5db", borderRadius: "4px", backgroundColor: "#f9fafb", cursor: "pointer" }}
                  >
                    Exact (₱{cartTotal.toFixed(2)})
                  </button>
                  {[50, 100, 200, 500, 1000].map((denom) => (
                    <button
                      key={denom}
                      type="button"
                      onClick={() => handleQuickCash(denom)}
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", border: "1px solid #d1d5db", borderRadius: "4px", backgroundColor: "#f9fafb", cursor: "pointer" }}
                    >
                      ₱{denom}
                    </button>
                  ))}
                </div>

                {/* Change preview */}
                <div
                  style={{
                    marginTop: "0.75rem",
                    padding: "0.6rem",
                    backgroundColor: isCashInsufficient ? "#fee2e2" : "#f0fdf4",
                    borderRadius: "4px",
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.9rem",
                    fontWeight: "600",
                    color: isCashInsufficient ? "#b91c1c" : "#166534",
                  }}
                >
                  <span>{isCashInsufficient ? "Shortage:" : "Change to Return:"}</span>
                  <span>
                    ₱{isCashInsufficient ? (cartTotal - cashAmountNum).toFixed(2) : changePreview}
                  </span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: "1rem",
                  backgroundColor: "#eff6ff",
                  borderRadius: "6px",
                  color: "#1e40af",
                  fontSize: "0.85rem",
                  marginBottom: "1.25rem",
                  lineHeight: "1.5",
                }}
              >
                <div>Electronic Payment: <strong>{paymentMethod}</strong></div>
                <div>Amount to charge: <strong>₱{cartTotal.toFixed(2)}</strong></div>
                <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem" }}>
                  Payment will be recorded directly against this transaction.
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                disabled={checkoutSubmitting}
                style={{
                  padding: "0.6rem 1.25rem",
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteCheckout}
                disabled={checkoutSubmitting || isCashInsufficient}
                style={{
                  padding: "0.6rem 1.5rem",
                  backgroundColor: checkoutSubmitting || isCashInsufficient ? "#9ca3af" : "#16a34a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "700",
                  cursor: checkoutSubmitting || isCashInsufficient ? "not-allowed" : "pointer",
                }}
              >
                {checkoutSubmitting ? "Processing..." : "Confirm & Complete Sale"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {completedSale && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1100,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              padding: "2rem",
              width: "400px",
              maxWidth: "95%",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              fontFamily: "monospace",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            {/* Printable Receipt Container */}
            <div id="receipt-print-area">
              <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "bold" }}>GROCERY SME SYSTEM</h2>
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Official Sales Receipt</div>
                <div style={{ fontSize: "0.85rem", fontWeight: "bold", marginTop: "0.5rem" }}>
                  Invoice #{completedSale.invoice_number}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  {new Date(completedSale.created_at).toLocaleString()}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  Cashier: {completedSale.cashier?.name}
                </div>
              </div>

              <div style={{ borderBottom: "1px dashed #000000", marginBottom: "0.75rem" }} />

              {/* Items */}
              <div style={{ marginBottom: "0.75rem" }}>
                {completedSale.items.map((it) => (
                  <div key={it.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.3rem" }}>
                    <div style={{ flex: 1 }}>
                      <div>{it.product_name}</div>
                      <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>
                        {parseFloat(it.quantity)} {it.product_unit} x ₱{parseFloat(it.unit_price).toFixed(2)}
                      </div>
                    </div>
                    <div style={{ fontWeight: "bold" }}>₱{parseFloat(it.subtotal).toFixed(2)}</div>
                  </div>
                ))}
              </div>

              <div style={{ borderBottom: "1px dashed #000000", marginBottom: "0.75rem" }} />

              {/* Totals */}
              <div style={{ fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "0.2rem", marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Subtotal:</span>
                  <span>₱{parseFloat(completedSale.subtotal).toFixed(2)}</span>
                </div>
                {parseFloat(completedSale.discount) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#15803d" }}>
                    <span>Discount:</span>
                    <span>-₱{parseFloat(completedSale.discount).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "1rem", marginTop: "0.25rem" }}>
                  <span>TOTAL:</span>
                  <span>₱{parseFloat(completedSale.total).toFixed(2)}</span>
                </div>
              </div>

              <div style={{ borderBottom: "1px dashed #000000", marginBottom: "0.75rem" }} />

              {/* Payment info */}
              {completedSale.payments && completedSale.payments.length > 0 && (
                <div style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Payment ({completedSale.payments[0].payment_method}):</span>
                    <span>₱{parseFloat(completedSale.payments[0].amount_paid).toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Change:</span>
                    <span>₱{parseFloat(completedSale.payments[0].change_amount).toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.75rem", color: "#6b7280" }}>
                <div>Thank you for your purchase!</div>
                <div>Please keep this receipt.</div>
              </div>
            </div>

            {/* Receipt Actions */}
            <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={() => window.print()}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#f3f4f6",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  fontWeight: "600",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                🖨 Print
              </button>
              <button
                onClick={handleNewSale}
                style={{
                  padding: "0.5rem 1.25rem",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "4px",
                  fontWeight: "700",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                + New Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSPage;
