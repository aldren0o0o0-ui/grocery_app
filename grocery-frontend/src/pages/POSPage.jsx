import { useState, useEffect, useRef, useMemo } from "react";
import useAuth from "../context/AuthContext";
import { getPosProductsApi, checkoutSaleApi } from "../api/sales";
import { getCategoriesApi } from "../api/categories";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Printer,
  RotateCcw,
  Sparkles,
  CreditCard,
  Banknote,
  Smartphone,
  Layers,
} from "lucide-react";
import { Button, Badge, Modal, Input, useToast } from "../components/ui";
import { resolveUserName } from "../utils/userResolver";

export const POSPage = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Catalog state
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Cart state: array of { product, quantity: number }
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState("0");

  // Checkout modal state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [amountPaid, setAmountPaid] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  // Completed receipt modal state
  const [completedSale, setCompletedSale] = useState(null);

  const searchInputRef = useRef(null);

  // Fetch categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await getCategoriesApi({ is_active: true, per_page: 100 });
        const catList = res?.items || res?.categories || (Array.isArray(res) ? res : []);
        setCategories(catList);
      } catch (err) {
        console.error("Failed to load categories:", err);
      }
    };
    loadCategories();
  }, []);

  // Fetch POS products with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = { search: search.trim(), per_page: 60 };
        if (selectedCategory !== "ALL") {
          params.category_id = selectedCategory;
        }
        const res = await getPosProductsApi(params);
        const prodList = res?.products || res?.items || (Array.isArray(res) ? res : []);
        setProducts(prodList);
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [search, selectedCategory]);

  // Cart calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const q = parseFloat(item.quantity) || 0;
      const p = parseFloat(item.product.selling_price) || 0;
      return sum + q * p;
    }, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    const d = parseFloat(discount) || 0;
    return d > 0 ? d : 0;
  }, [discount]);

  const total = useMemo(() => {
    const val = subtotal - discountAmount;
    return val > 0 ? Math.round(val * 100) / 100 : 0;
  }, [subtotal, discountAmount]);

  const changeDue = useMemo(() => {
    const paid = parseFloat(amountPaid) || 0;
    const change = paid - total;
    return change >= 0 ? Math.round(change * 100) / 100 : 0;
  }, [amountPaid, total]);

  const formatCurrency = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "₱0.00";
    return `₱${num.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Helper to extract stock quantity accurately from pos_product_schema
  const getProductStock = (prod) => {
    return parseFloat(prod.stock_quantity ?? prod.current_stock ?? prod.stock ?? 0);
  };

  // Add to cart action
  const handleAddToCart = (product) => {
    const currentStock = getProductStock(product);
    if (currentStock <= 0) {
      showToast(`${product.name} is currently out of stock (${currentStock} units).`, "error");
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const currentQty = parseFloat(existing.quantity) || 0;
        if (currentQty >= currentStock) {
          showToast(`Cannot add more than available stock (${currentStock} units).`, "warning");
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: currentQty + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId, newQty) => {
    const val = parseFloat(newQty);
    if (isNaN(val) || val <= 0) {
      handleRemoveItem(productId);
      return;
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const maxStock = getProductStock(item.product) || 9999;
          const safeQty = val > maxStock ? maxStock : val;
          if (val > maxStock) {
            showToast(`Max stock reached (${maxStock} units)`, "warning");
          }
          return { ...item, quantity: safeQty };
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (productId) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
    setDiscount("0");
  };

  // Barcode / Enter key direct auto-add
  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && search.trim()) {
      const q = search.trim().toLowerCase();
      const exact = products.find(
        (p) =>
          (p.barcode && p.barcode.toLowerCase() === q) ||
          (p.sku && p.sku.toLowerCase() === q)
      );

      if (exact) {
        handleAddToCart(exact);
        setSearch("");
      } else if (products.length === 1) {
        handleAddToCart(products[0]);
        setSearch("");
      }
    }
  };

  // Open checkout modal
  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      showToast("Cart is empty. Add products before checkout.", "error");
      return;
    }
    setAmountPaid(total.toFixed(2));
    setPaymentMethod("CASH");
    setCheckoutError("");
    setIsCheckoutOpen(true);
  };

  // Complete checkout
  const handleExecuteCheckout = async (e) => {
    e.preventDefault();
    setCheckoutError("");

    const paidVal = parseFloat(amountPaid) || 0;
    if (paidVal < total) {
      setCheckoutError(`Tender amount must be at least ${formatCurrency(total)}.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        items: cart.map((item) => ({
          product_id: Number(item.product.id),
          quantity: parseFloat(item.quantity).toFixed(3),
        })),
        discount: discountAmount.toFixed(2),
        payment: {
          method: paymentMethod,
          amount_paid: paidVal.toFixed(2),
        },
      };

      const res = await checkoutSaleApi(payload);
      const saleRecord = res.sale || res.data || res;
      setCompletedSale(saleRecord);
      setIsCheckoutOpen(false);
      handleClearCart();
      showToast("Sale completed successfully!", "success");

      // Reload products to reflect updated inventory stock immediately
      const refreshed = await getPosProductsApi({
        search: search.trim(),
        category_id: selectedCategory !== "ALL" ? selectedCategory : undefined,
        per_page: 60,
      });
      const prodList = refreshed?.products || refreshed?.items || (Array.isArray(refreshed) ? refreshed : []);
      setProducts(prodList);
    } catch (err) {
      setCheckoutError(err.response?.data?.error?.message || err.response?.data?.message || "Checkout failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickCash = (amount) => {
    if (amount === "EXACT") {
      setAmountPaid(total.toFixed(2));
    } else {
      setAmountPaid(Number(amount).toFixed(2));
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 380px",
        gap: "24px",
        height: "calc(100vh - var(--topbar-height) - 48px)",
        alignItems: "stretch",
      }}
    >
      {/* Left Column: Product Selection & Catalog */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {/* Search Bar & Barcode Scanner */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Input
              ref={searchInputRef}
              id="input-pos-search"
              placeholder="Scan barcode, enter SKU, or search item name... (Press Enter to add)"
              icon={Search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {/* Category Pills */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            paddingBottom: "4px",
            flexShrink: 0,
          }}
        >
          <button
            id="cat-pill-all"
            onClick={() => setSelectedCategory("ALL")}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--radius-full)",
              fontSize: "12.5px",
              fontWeight: 600,
              backgroundColor:
                selectedCategory === "ALL"
                  ? "var(--color-primary-600)"
                  : "var(--color-slate-100)",
              color: selectedCategory === "ALL" ? "#ffffff" : "var(--color-slate-700)",
              border: "1px solid",
              borderColor:
                selectedCategory === "ALL"
                  ? "var(--color-primary-700)"
                  : "var(--color-slate-200)",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              whiteSpace: "nowrap",
            }}
          >
            All Products
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              id={`cat-pill-${cat.id}`}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: "6px 14px",
                borderRadius: "var(--radius-full)",
                fontSize: "12.5px",
                fontWeight: 600,
                backgroundColor:
                  selectedCategory === cat.id
                    ? "var(--color-primary-600)"
                    : "var(--color-slate-100)",
                color: selectedCategory === cat.id ? "#ffffff" : "var(--color-slate-700)",
                border: "1px solid",
                borderColor:
                  selectedCategory === cat.id
                    ? "var(--color-primary-700)"
                    : "var(--color-slate-200)",
                cursor: "pointer",
                transition: "all var(--transition-fast)",
                whiteSpace: "nowrap",
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "14px",
            paddingRight: "4px",
          }}
        >
          {loading ? (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "48px 0",
                color: "var(--text-muted)",
              }}
            >
              Loading grocery items...
            </div>
          ) : products.length === 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "64px 0",
                color: "var(--text-muted)",
              }}
            >
              <Layers size={40} style={{ color: "var(--color-slate-300)", marginBottom: "8px" }} />
              <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-main)" }}>
                No matching products found
              </div>
              <div style={{ fontSize: "13px", marginTop: "4px" }}>
                Check your search keyword or selected category.
              </div>
            </div>
          ) : (
            products.map((prod) => {
              const stock = getProductStock(prod);
              const isOutOfStock = stock <= 0;
              const isLowStock = stock > 0 && stock <= 5;

              return (
                <div
                  key={prod.id}
                  id={`prod-card-${prod.id}`}
                  onClick={() => !isOutOfStock && handleAddToCart(prod)}
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-subtle)",
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    cursor: isOutOfStock ? "not-allowed" : "pointer",
                    opacity: isOutOfStock ? 0.55 : 1,
                    boxShadow: "var(--shadow-xs)",
                    transition: "all var(--transition-fast)",
                    userSelect: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isOutOfStock) {
                      e.currentTarget.style.borderColor = "var(--color-primary-500)";
                      e.currentTarget.style.boxShadow = "var(--shadow-md)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isOutOfStock) {
                      e.currentTarget.style.borderColor = "var(--border-subtle)";
                      e.currentTarget.style.boxShadow = "var(--shadow-xs)";
                    }
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--color-slate-400)",
                        }}
                      >
                        {prod.sku || "NO-SKU"}
                      </span>
                      <Badge
                        variant={isOutOfStock ? "danger" : isLowStock ? "warning" : "success"}
                        size="sm"
                      >
                        {isOutOfStock ? "Out" : `${stock} left`}
                      </Badge>
                    </div>

                    <h4
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "var(--text-main)",
                        margin: "8px 0 4px 0",
                        lineHeight: 1.3,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {prod.name}
                    </h4>

                    {prod.category_name && (
                      <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                        {prod.category_name}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "12px",
                      paddingTop: "8px",
                      borderTop: "1px solid var(--color-slate-100)",
                    }}
                  >
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: "16px",
                        fontWeight: 800,
                        color: "var(--color-primary-700)",
                      }}
                    >
                      {formatCurrency(prod.selling_price)}
                    </span>

                    <button
                      disabled={isOutOfStock}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: isOutOfStock
                          ? "var(--color-slate-100)"
                          : "var(--color-primary-50)",
                        color: isOutOfStock
                          ? "var(--color-slate-400)"
                          : "var(--color-primary-700)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Order Pad / Receipt Ticket */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-md)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Ticket Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            backgroundColor: "var(--color-slate-50)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>
              Current Ticket
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Cashier: {resolveUserName(user, "Cashier")}
            </div>
          </div>

          {cart.length > 0 && (
            <button
              onClick={handleClearCart}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-danger)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <RotateCcw size={13} />
              Clear
            </button>
          )}
        </div>

        {/* Cart Items List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {cart.length === 0 ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                textAlign: "center",
                padding: "24px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  backgroundColor: "var(--color-slate-100)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-slate-400)",
                  marginBottom: "12px",
                }}
              >
                <Sparkles size={22} />
              </div>
              <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-main)" }}>
                Ticket is empty
              </div>
              <div style={{ fontSize: "12.5px", marginTop: "4px", lineHeight: 1.4 }}>
                Scan barcodes or click grocery items from the catalog.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {cart.map((item) => {
                const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.product.selling_price) || 0);

                return (
                  <div
                    key={item.product.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--color-slate-50)",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-main)" }}>
                          {item.product.name}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                          {formatCurrency(item.product.selling_price)} / unit
                        </div>
                      </div>

                      <div className="tabular-nums" style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-main)" }}>
                        {formatCurrency(itemTotal)}
                      </div>
                    </div>

                    {/* Stepper + Delete */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          backgroundColor: "#ffffff",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--color-slate-300)",
                          overflow: "hidden",
                        }}
                      >
                        <button
                          onClick={() => handleUpdateQuantity(item.product.id, (parseFloat(item.quantity) || 1) - 1)}
                          style={{
                            padding: "4px 8px",
                            color: "var(--color-slate-600)",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <Minus size={13} />
                        </button>

                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateQuantity(item.product.id, e.target.value)}
                          style={{
                            width: "44px",
                            textAlign: "center",
                            border: "none",
                            outline: "none",
                            fontSize: "13px",
                            fontWeight: 600,
                          }}
                        />

                        <button
                          onClick={() => handleUpdateQuantity(item.product.id, (parseFloat(item.quantity) || 0) + 1)}
                          style={{
                            padding: "4px 8px",
                            color: "var(--color-slate-600)",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      <button
                        onClick={() => handleRemoveItem(item.product.id)}
                        style={{
                          color: "var(--color-slate-400)",
                          padding: "4px",
                          borderRadius: "var(--radius-xs)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-danger)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-slate-400)")}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Calculation Footer */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--border-subtle)",
            backgroundColor: "var(--color-slate-50)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--text-muted)" }}>
            <span>Subtotal:</span>
            <span className="tabular-nums" style={{ fontWeight: 600, color: "var(--text-main)" }}>
              {formatCurrency(subtotal)}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px" }}>
            <span style={{ color: "var(--text-muted)" }}>Discount (₱):</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              style={{
                width: "80px",
                textAlign: "right",
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-slate-300)",
                fontSize: "13px",
                fontWeight: 600,
                outline: "none",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: "8px",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>
              Payable Total:
            </span>
            <span
              className="tabular-nums"
              style={{
                fontSize: "22px",
                fontWeight: 800,
                color: "var(--color-primary-700)",
                letterSpacing: "-0.02em",
              }}
            >
              {formatCurrency(total)}
            </span>
          </div>

          <Button
            id="btn-pos-charge"
            variant="primary"
            size="lg"
            disabled={cart.length === 0}
            onClick={handleOpenCheckout}
            style={{
              width: "100%",
              marginTop: "6px",
              backgroundColor: "var(--color-primary-600)",
              fontSize: "15px",
              height: "44px",
            }}
          >
            Charge {formatCurrency(total)}
          </Button>
        </div>
      </div>

      {/* Checkout Payment Modal */}
      <Modal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        title="Payment & Checkout"
        subtitle={`Total amount payable: ${formatCurrency(total)}`}
        maxWidth="460px"
      >
        <form onSubmit={handleExecuteCheckout}>
          {checkoutError && (
            <div
              style={{
                padding: "10px 14px",
                marginBottom: "16px",
                backgroundColor: "var(--color-danger-bg)",
                color: "var(--color-danger-text)",
                borderRadius: "var(--radius-md)",
                fontSize: "13px",
                fontWeight: 500,
              }}
            >
              {checkoutError}
            </div>
          )}

          {/* Payment Method Selector */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)", display: "block", marginBottom: "8px" }}>
              Payment Method
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              {[
                { id: "CASH", label: "Cash", icon: Banknote },
                { id: "GCASH", label: "GCash / E-Wallet", icon: Smartphone },
                { id: "CARD", label: "Card Tender", icon: CreditCard },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(m.id);
                      if (m.id !== "CASH") setAmountPaid(total.toFixed(2));
                    }}
                    style={{
                      padding: "12px 8px",
                      borderRadius: "var(--radius-md)",
                      border: `1px solid ${isSelected ? "var(--color-primary-600)" : "var(--color-slate-200)"}`,
                      backgroundColor: isSelected ? "var(--color-primary-50)" : "#ffffff",
                      color: isSelected ? "var(--color-primary-800)" : "var(--color-slate-700)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all var(--transition-fast)",
                    }}
                  >
                    <Icon size={18} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Cash Buttons */}
          {paymentMethod === "CASH" && (
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                Quick Cash Tender:
              </label>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleQuickCash("EXACT")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--color-slate-100)",
                    border: "1px solid var(--color-slate-200)",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  Exact
                </button>
                {["50", "100", "200", "500", "1000"].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleQuickCash(val)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--color-slate-100)",
                      border: "1px solid var(--color-slate-200)",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    ₱{val}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Amount Paid Input */}
          <Input
            id="input-pos-amount-paid"
            label="Amount Paid / Tendered (₱)"
            type="number"
            step="0.01"
            min={total}
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            required
            autoFocus
          />

          {/* Change calculation box */}
          <div
            style={{
              marginTop: "16px",
              padding: "12px 16px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-slate-50)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)" }}>
              Change Due:
            </span>
            <span
              className="tabular-nums"
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: changeDue > 0 ? "var(--color-primary-600)" : "var(--text-main)",
              }}
            >
              {formatCurrency(changeDue)}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button variant="secondary" onClick={() => setIsCheckoutOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button id="btn-confirm-pos-checkout" type="submit" variant="primary" loading={submitting}>
              Confirm Payment & Print
            </Button>
          </div>
        </form>
      </Modal>

      {/* Printable Receipt Modal */}
      <Modal
        isOpen={Boolean(completedSale)}
        onClose={() => setCompletedSale(null)}
        title="Transaction Receipt"
        subtitle={`Invoice: ${completedSale?.invoice_number || completedSale?.receipt_number || `#${completedSale?.id}`}`}
        maxWidth="440px"
      >
        <div
          id="printable-receipt"
          style={{
            fontFamily: "var(--font-family-mono)",
            fontSize: "13px",
            lineHeight: 1.5,
            padding: "16px",
            backgroundColor: "var(--color-slate-50)",
            border: "1px dashed var(--color-slate-300)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "16px" }}>
            <div style={{ fontWeight: 800, fontSize: "16px" }}>FRESHFLOW GROCERY</div>
            <div style={{ fontSize: "11px", color: "var(--color-slate-500)" }}>
              123 Retail Avenue, Metro Manila
            </div>
            <div style={{ fontSize: "11px", color: "var(--color-slate-500)" }}>
              TIN: 000-123-456-789 VAT Reg.
            </div>
            <div style={{ borderBottom: "1px dashed var(--color-slate-300)", margin: "8px 0" }} />
            <div style={{ fontSize: "11.5px" }}>
              Invoice: <strong>{completedSale?.invoice_number || completedSale?.receipt_number || `#${completedSale?.id}`}</strong>
            </div>
            <div style={{ fontSize: "11.5px" }}>
              Date: {completedSale?.created_at ? new Date(completedSale.created_at).toLocaleString() : new Date().toLocaleString()}
            </div>
            <div style={{ fontSize: "11.5px" }}>
              Cashier: {resolveUserName(completedSale?.cashier || completedSale?.cashier_name || user, "Cashier")}
            </div>
          </div>

          <div style={{ borderBottom: "1px dashed var(--color-slate-300)", marginBottom: "8px" }} />

          {/* Items */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {(completedSale?.items || []).map((it, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div>{it.product_name || it.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--color-slate-500)" }}>
                    {parseFloat(it.quantity)} x {formatCurrency(it.unit_price)}
                  </div>
                </div>
                <div style={{ fontWeight: 600 }}>{formatCurrency(it.subtotal)}</div>
              </div>
            ))}
          </div>

          <div style={{ borderBottom: "1px dashed var(--color-slate-300)", margin: "10px 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Subtotal:</span>
            <span>{formatCurrency(completedSale?.subtotal || completedSale?.total || completedSale?.total_amount)}</span>
          </div>

          {parseFloat(completedSale?.discount || 0) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-danger)" }}>
              <span>Discount:</span>
              <span>-{formatCurrency(completedSale.discount)}</span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "15px", margin: "6px 0" }}>
            <span>TOTAL:</span>
            <span>{formatCurrency(completedSale?.total || completedSale?.total_amount)}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
            <span>
              Payment ({completedSale?.payments?.[0]?.payment_method || completedSale?.payment_method || "CASH"}):
            </span>
            <span>
              {formatCurrency(
                completedSale?.payments?.[0]?.amount_paid ||
                  completedSale?.payment?.amount_paid ||
                  completedSale?.amount_paid ||
                  completedSale?.total ||
                  completedSale?.total_amount
              )}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
            <span>Change:</span>
            <span>
              {formatCurrency(
                completedSale?.payments?.[0]?.change_amount ||
                  completedSale?.payment?.change ||
                  completedSale?.change_amount ||
                  0
              )}
            </span>
          </div>

          <div style={{ textAlign: "center", marginTop: "16px", fontSize: "11px", color: "var(--color-slate-500)" }}>
            Thank you for shopping at FreshFlow!
            <br />
            Please keep this receipt for returns/exchanges within 7 days.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "20px" }}>
          <Button
            variant="outline"
            icon={Printer}
            onClick={() => window.print()}
          >
            Print Receipt
          </Button>
          <Button
            variant="primary"
            icon={CheckCircle2}
            onClick={() => {
              setCompletedSale(null);
              searchInputRef.current?.focus();
            }}
          >
            New Transaction
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default POSPage;
