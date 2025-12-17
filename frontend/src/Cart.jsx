export default function Cart({ cart, setCart }) {
  const total = cart.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );

  // ➕ Increase quantity
  function increaseQty(name) {
    setCart(
      cart.map((item) =>
        item.name === name
          ? { ...item, qty: item.qty + 1 }
          : item
      )
    );
  }

  // ➖ Decrease quantity (auto-remove if qty = 0)
  function decreaseQty(name) {
    setCart(
      cart
        .map((item) =>
          item.name === name
            ? { ...item, qty: item.qty - 1 }
            : item
        )
        .filter((item) => item.qty > 0)
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "700px", margin: "auto" }}>
      <h1>🛒 Your Cart</h1>

      {cart.length === 0 && <p>Cart is empty</p>}

      {cart.map((item, i) => (
        <div
          key={i}
          style={{
            border: "1px solid #ddd",
            borderRadius: "8px",
            marginBottom: "15px",
            padding: "15px",
            background: "#fafafa",
          }}
        >
          <h4>{item.name}</h4>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => decreaseQty(item.name)}
              style={{
                padding: "4px 10px",
                fontSize: "16px",
                cursor: "pointer",
              }}
            >
              −
            </button>

            <span>
              ₹{item.price} × {item.qty}
            </span>

            <button
              onClick={() => increaseQty(item.name)}
              style={{
                padding: "4px 10px",
                fontSize: "16px",
                cursor: "pointer",
              }}
            >
              +
            </button>
          </div>
        </div>
      ))}

      <h2 style={{ textAlign: "right" }}>Total: ₹{total}</h2>

      {/* ✅ CHECKOUT BUTTON */}
      {cart.length > 0 && (
        <button
          onClick={() => (window.location.href = "/checkout")}
          style={{
            width: "100%",
            padding: "12px",
            background: "#2e7d32",
            color: "white",
            border: "none",
            borderRadius: "5px",
            fontSize: "16px",
            cursor: "pointer",
            marginTop: "15px",
          }}
        >
          Proceed to Checkout
        </button>
      )}

      <br />
      <br />
      <a href="/store">⬅ Back to Store</a>
    </div>
  );
}
