import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Checkout({ cart, setCart }) {
  const navigate = useNavigate();

  // 📦 Address state
  const [address, setAddress] = useState({
    name: "",
    phone: "",
    street: "",
    city: "",
    pincode: "",
  });

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );

  function handleChange(e) {
    setAddress({ ...address, [e.target.name]: e.target.value });
  }

  function placeOrder() {
    // 🔒 Basic validation
    if (
      !address.name ||
      !address.phone ||
      !address.street ||
      !address.city ||
      !address.pincode
    ) {
      alert("Please fill all delivery address fields");
      return;
    }

    console.log("Delivery Address:", address);

    alert("Order placed successfully 🎉");

    setCart([]);
    localStorage.removeItem("cart");

    navigate("/success");
  }

  return (
    <div style={{ padding: "20px", maxWidth: "700px", margin: "auto" }}>
      <h1>🧾 Checkout</h1>

      {/* 📦 DELIVERY ADDRESS */}
      <h3>Delivery Address</h3>

      <input
        name="name"
        placeholder="Full Name"
        value={address.name}
        onChange={handleChange}
        style={inputStyle}
      />

      <input
        name="phone"
        placeholder="Phone Number"
        value={address.phone}
        onChange={handleChange}
        style={inputStyle}
      />

      <input
        name="street"
        placeholder="Street / House No"
        value={address.street}
        onChange={handleChange}
        style={inputStyle}
      />

      <input
        name="city"
        placeholder="City"
        value={address.city}
        onChange={handleChange}
        style={inputStyle}
      />

      <input
        name="pincode"
        placeholder="Pincode"
        value={address.pincode}
        onChange={handleChange}
        style={inputStyle}
      />

      {/* 🧾 ORDER SUMMARY */}
      <h3 style={{ marginTop: "25px" }}>Order Summary</h3>

      {cart.map((item, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "10px",
          }}
        >
          <span>
            {item.name} × {item.qty}
          </span>
          <span>₹{item.price * item.qty}</span>
        </div>
      ))}

      <h2 style={{ textAlign: "right" }}>Total: ₹{total}</h2>

      <button
        onClick={placeOrder}
        style={{
          width: "100%",
          padding: "12px",
          background: "#2e7d32",
          color: "white",
          border: "none",
          borderRadius: "5px",
          fontSize: "16px",
          cursor: "pointer",
          marginTop: "20px",
        }}
      >
        Place Order
      </button>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px",
  marginBottom: "12px",
  borderRadius: "5px",
  border: "1px solid #ccc",
};
