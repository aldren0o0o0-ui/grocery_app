import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui";

export const UnauthorizedPage = () => {
  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          backgroundColor: "var(--color-danger-bg)",
          color: "var(--color-danger)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "20px",
        }}
      >
        <ShieldAlert size={28} />
      </div>

      <h1
        style={{
          fontSize: "24px",
          fontWeight: 800,
          color: "var(--text-main)",
          margin: "0 0 8px 0",
        }}
      >
        Access Restricted
      </h1>

      <p
        style={{
          fontSize: "14px",
          color: "var(--text-muted)",
          maxWidth: "400px",
          lineHeight: 1.6,
          marginBottom: "24px",
        }}
      >
        You do not have permission to access this administrative module. Please contact your
        store owner if you require elevated privileges.
      </p>

      <Link to="/dashboard">
        <Button variant="secondary" icon={ArrowLeft}>
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
};

export default UnauthorizedPage;
