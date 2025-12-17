import { Link } from "react-router-dom";

export default function OrderSuccess() {
  return (
    <div style={fullPage}>
      <div style={card}>
        <h1 style={{ fontSize: "32px", marginBottom: "10px" }}>
          🎉 Order Successful!
        </h1>

        <p style={{ color: "#555", marginBottom: "25px" }}>
          Your order has been placed successfully.
        </p>

        <Link to="/store" style={button}>
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

/* ✅ FULL PAGE BACKGROUND */
const fullPage = {
  width: "100vw",
  minHeight: "calc(100vh - 64px)", // height after navbar
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: "linear-gradient(135deg, #e8f5e9, #f1f8e9)",
};

/* ✅ CENTER CARD */
const card = {
  background: "#fff",
  padding: "40px",
  borderRadius: "14px",
  textAlign: "center",
  width: "100%",
  maxWidth: "420px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
};

/* ✅ BUTTON */
const button = {
  display: "inline-block",
  padding: "12px 26px",
  background: "#2e7d32",
  color: "#fff",
  borderRadius: "6px",
  textDecoration: "none",
  fontSize: "16px",
};
