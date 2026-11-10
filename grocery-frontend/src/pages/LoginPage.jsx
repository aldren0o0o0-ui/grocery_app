import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import useAuth from "../context/AuthContext";
import { Sparkles, ShieldCheck, ShoppingCart, ArrowRight } from "lucide-react";
import { Button, Input } from "../components/ui";

export const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/dashboard";

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setErrorMsg("");

    if (!email.trim() || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const serverMessage = err.response?.data?.error?.message;
      setErrorMsg(serverMessage || "Invalid email or password. Please verify credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (userEmail, userPass) => {
    setEmail(userEmail);
    setPassword(userPass);
    setErrorMsg("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        backgroundColor: "var(--color-slate-900)",
      }}
    >
      {/* Left Brand Showcase (Desktop) */}
      <div
        style={{
          flex: 1,
          backgroundColor: "#064e3b",
          backgroundImage:
            "radial-gradient(at 0% 0%, #047857 0px, transparent 50%), radial-gradient(at 100% 100%, #022c22 0px, transparent 60%)",
          color: "#ffffff",
          padding: "48px 60px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-primary-500)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
            }}
          >
            <Sparkles size={24} />
          </div>
          <div>
            <div style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>
              FreshFlow ERP
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-primary-200)" }}>
              Modern Grocery Retail & Operations
            </div>
          </div>
        </div>

        <div style={{ maxWidth: "480px" }}>
          <h2
            style={{
              fontSize: "36px",
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              marginBottom: "16px",
              color: "#ffffff",
            }}
          >
            Intelligent retail operations for modern grocery stores.
          </h2>
          <p
            style={{
              fontSize: "15px",
              color: "var(--color-primary-100)",
              lineHeight: 1.6,
              marginBottom: "32px",
            }}
          >
            Unified point-of-sale, real-time inventory management, procurement stock-in, and
            operating expense tracking designed specifically for high-efficiency SME retail.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShoppingCart size={15} />
              </div>
              <span style={{ fontSize: "14px", fontWeight: 500 }}>
                High-speed POS with barcode lookup & instant receipting
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShieldCheck size={15} />
              </div>
              <span style={{ fontSize: "14px", fontWeight: 500 }}>
                Role-scoped security for Owner, Cashier, and Staff
              </span>
            </div>
          </div>
        </div>

        <div style={{ fontSize: "12px", color: "var(--color-primary-300)" }}>
          © 2026 FreshFlow SME Systems. All rights reserved.
        </div>
      </div>

      {/* Right Login Form */}
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          backgroundColor: "#ffffff",
          padding: "48px 40px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div style={{ maxWidth: "400px", width: "100%", margin: "0 auto" }}>
          <div style={{ marginBottom: "32px" }}>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: 800,
                color: "var(--text-main)",
                letterSpacing: "-0.02em",
                margin: "0 0 6px 0",
              }}
            >
              Welcome back
            </h1>
            <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0 }}>
              Sign in to your FreshFlow account to begin your shift.
            </p>
          </div>

          {errorMsg && (
            <div
              style={{
                padding: "12px 14px",
                backgroundColor: "var(--color-danger-bg)",
                border: "1px solid var(--color-danger-border)",
                color: "var(--color-danger-text)",
                borderRadius: "var(--radius-md)",
                fontSize: "13px",
                fontWeight: 500,
                marginBottom: "20px",
              }}
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Input
              id="input-login-email"
              label="Email Address"
              type="email"
              placeholder="e.g. owner@grocery.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />

            <Input
              id="input-login-password"
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              id="btn-login-submit"
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              iconRight={ArrowRight}
              style={{
                width: "100%",
                marginTop: "8px",
                height: "44px",
                fontSize: "14px",
                backgroundColor: "var(--color-primary-600)",
              }}
            >
              Sign In to FreshFlow
            </Button>
          </form>

          {/* Quick Demo Credentials Switcher */}
          <div
            style={{
              marginTop: "32px",
              padding: "16px",
              borderRadius: "var(--radius-lg)",
              backgroundColor: "var(--color-slate-50)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--color-slate-700)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "10px",
              }}
            >
              Quick Test Credentials:
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => handleQuickFill("owner@grocery.com", "owner123")}
                style={{
                  padding: "6px 10px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "#ffffff",
                  border: "1px solid var(--color-slate-200)",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--color-slate-800)",
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                Owner
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("cashier@grocery.com", "cashier123")}
                style={{
                  padding: "6px 10px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "#ffffff",
                  border: "1px solid var(--color-slate-200)",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--color-slate-800)",
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                Cashier
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("staff@grocery.com", "staff123")}
                style={{
                  padding: "6px 10px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "#ffffff",
                  border: "1px solid var(--color-slate-200)",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--color-slate-800)",
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                Staff
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
