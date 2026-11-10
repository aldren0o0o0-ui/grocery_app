import { Modal } from "./Modal";
import { Button } from "./Button";
import { AlertTriangle } from "lucide-react";

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed with this action?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  loading = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="420px" showClose={!loading}>
      <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            backgroundColor:
              variant === "danger" ? "var(--color-danger-bg)" : "var(--color-warning-bg)",
            color: variant === "danger" ? "var(--color-danger)" : "var(--color-warning)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "16px",
          }}
        >
          <AlertTriangle size={24} />
        </div>
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: "17px",
            fontWeight: 700,
            color: "var(--text-main)",
          }}
        >
          {title}
        </h3>
        <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.5 }}>
          {message}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: "10px",
          justifyContent: "center",
          marginTop: "16px",
        }}
      >
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelText}
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
