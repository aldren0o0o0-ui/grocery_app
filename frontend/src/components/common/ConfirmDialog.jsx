import Modal from "./Modal";
import Button from "./Button";

export const ConfirmDialog = ({
  isOpen = false,
  title = "Confirm Action",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "danger", // "primary" | "danger" | "warning"
  onConfirm,
  onCancel,
  loading = false,
  id = "confirm-dialog",
}) => {
  return (
    <Modal isOpen={isOpen} onClose={loading ? undefined : onCancel} title={title} maxWidth="440px" id={id}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ fontSize: "var(--text-base)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          {message}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "var(--space-2)",
            paddingTop: "var(--space-3)",
            borderTop: "1px solid var(--color-border-subtle)",
          }}
        >
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant === "warning" ? "primary" : confirmVariant}
            onClick={onConfirm}
            loading={loading}
            style={
              confirmVariant === "warning"
                ? { backgroundColor: "var(--color-warning)", borderColor: "var(--color-warning)" }
                : undefined
            }
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
