import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Clock,
  Calendar,
  LogOut,
  KeyRound,
  ShoppingCart,
  ChevronDown,
} from "lucide-react";
import useAuth from "../../context/AuthContext";
import { Badge, Modal, Input, Button, useToast } from "../ui";

export const Topbar = () => {
  const { user, logout, changePassword } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Password state
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-PH", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Manila",
        })
      );
      setCurrentDate(
        now.toLocaleDateString("en-PH", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "Asia/Manila",
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwdError("");

    if (!currentPwd || !newPwd || !confirmPwd) {
      setPwdError("All fields are required.");
      return;
    }

    if (newPwd !== confirmPwd) {
      setPwdError("New passwords do not match.");
      return;
    }

    if (newPwd.length < 6) {
      setPwdError("Password must be at least 6 characters.");
      return;
    }

    try {
      setPwdLoading(true);
      await changePassword(currentPwd, newPwd);
      showToast("Password changed successfully", "success");
      setShowPasswordModal(false);
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (err) {
      setPwdError(err.response?.data?.error?.message || "Failed to change password.");
    } finally {
      setPwdLoading(false);
    }
  };

  const roleColors = {
    OWNER: "purple",
    STAFF: "info",
    CASHIER: "success",
  };

  const initials = `${user?.first_name?.[0] || "U"}${user?.last_name?.[0] || ""}`;

  return (
    <>
      <header
        style={{
          height: "var(--topbar-height)",
          backgroundColor: "#ffffff",
          borderBottom: "1px solid var(--border-subtle)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 40,
          boxShadow: "var(--shadow-xs)",
        }}
      >
        {/* Left info: Store & Real-time clock */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>
              Lean Grocery
            </span>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 8px",
                backgroundColor: "var(--color-primary-50)",
                color: "var(--color-primary-700)",
                borderRadius: "var(--radius-full)",
                fontWeight: 600,
              }}
            >
              Branch 01
            </span>
          </div>

          <div
            style={{
              height: "18px",
              width: "1px",
              backgroundColor: "var(--border-subtle)",
            }}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              fontSize: "12.5px",
              color: "var(--text-muted)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Calendar size={14} style={{ color: "var(--color-slate-400)" }} />
              <span>{currentDate}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Clock size={14} style={{ color: "var(--color-primary-600)" }} />
              <span className="tabular-nums" style={{ fontWeight: 600, color: "var(--text-main)" }}>
                {currentTime} PHT
              </span>
            </div>
          </div>
        </div>

        {/* Right actions: Quick POS + Profile dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {["OWNER", "CASHIER"].includes(user?.role) && (
            <Link to="/pos">
              <Button
                variant="primary"
                size="sm"
                icon={ShoppingCart}
                style={{
                  backgroundColor: "var(--color-primary-600)",
                  fontWeight: 600,
                  fontSize: "13px",
                }}
              >
                Launch POS
              </Button>
            </Link>
          )}

          {/* User Profile Pill */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "4px 8px 4px 4px",
                borderRadius: "var(--radius-full)",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "var(--color-slate-50)",
                transition: "all var(--transition-fast)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-slate-100)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--color-slate-50)")}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  backgroundColor: "var(--color-primary-700)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "13px",
                }}
              >
                {initials}
              </div>

              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)", lineHeight: 1.2 }}>
                  {user?.first_name} {user?.last_name}
                </div>
                <div style={{ marginTop: "2px" }}>
                  <Badge variant={roleColors[user?.role] || "neutral"} size="sm">
                    {user?.role}
                  </Badge>
                </div>
              </div>

              <ChevronDown size={14} style={{ color: "var(--color-slate-400)", marginLeft: "4px" }} />
            </button>

            {/* Dropdown Menu */}
            {showProfileMenu && (
              <div
                className="animate-fade-in"
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  width: "220px",
                  backgroundColor: "#ffffff",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--shadow-lg)",
                  border: "1px solid var(--border-subtle)",
                  padding: "6px",
                  zIndex: 100,
                }}
              >
                <div
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--color-slate-100)",
                    marginBottom: "4px",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Signed in as</div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)", wordBreak: "break-all" }}>
                    {user?.email}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    setShowPasswordModal(true);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-md)",
                    fontSize: "13px",
                    color: "var(--color-slate-700)",
                    transition: "background var(--transition-fast)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-slate-100)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <KeyRound size={16} />
                  <span>Change Password</span>
                </button>

                <div style={{ height: "1px", backgroundColor: "var(--color-slate-100)", margin: "4px 0" }} />

                <button
                  onClick={handleLogout}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-md)",
                    fontSize: "13px",
                    color: "var(--color-danger)",
                    transition: "background var(--transition-fast)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-danger-bg)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Update Account Password"
        subtitle="Ensure your account uses a secure, non-default password."
        maxWidth="440px"
      >
        <form onSubmit={handlePasswordSubmit}>
          {pwdError && (
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
              {pwdError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Input
              label="Current Password"
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              required
            />
            <Input
              label="New Password"
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              helperText="Minimum 6 characters"
              required
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              required
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              marginTop: "24px",
            }}
          >
            <Button
              variant="secondary"
              onClick={() => setShowPasswordModal(false)}
              disabled={pwdLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pwdLoading}>
              Update Password
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default Topbar;
