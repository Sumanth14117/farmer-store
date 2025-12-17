import { useNavigate, Link } from "react-router-dom";

export default function Navbar({ cart, setCart }) {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("cart");
    setCart([]);
    navigate("/login");
  }

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div style={styles.navbar}>
      <h2 style={styles.logo}>🌾 Farmer Store</h2>

      <div style={styles.right}>
        <Link to="/cart" style={styles.cart}>
          🛒 Cart
          {cartCount > 0 && (
            <span style={styles.badge}>{cartCount}</span>
          )}
        </Link>

        <button onClick={logout} style={styles.logout}>
          Logout
        </button>
      </div>
    </div>
  );
}

const styles = {
  navbar: {
    height: "60px",
    background: "#2e7d32",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
  },
  logo: {
    margin: 0,
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
  },
  cart: {
    color: "white",
    textDecoration: "none",
    position: "relative",
    fontSize: "16px",
  },
  badge: {
    position: "absolute",
    top: "-8px",
    right: "-12px",
    background: "red",
    borderRadius: "50%",
    padding: "2px 6px",
    fontSize: "12px",
  },
  logout: {
    background: "#1b5e20",
    color: "white",
    border: "none",
    padding: "6px 12px",
    borderRadius: "4px",
    cursor: "pointer",
  },
};
