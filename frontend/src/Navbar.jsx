import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth";
export default function Navbar({
  cart,
  setCart
}) {
  const navigate = useNavigate();
  const {
    user,
    logout
  } = useAuth();
  const cartCount = cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  function handleLogout() {
    logout();
    setCart([]);
    navigate("/login", {
      replace: true
    });
  }
  return <header className="navbar">
    <Link className="brand" to="/store">🌾 Farmer Store</Link>
    <nav className="nav-links" aria-label="Main navigation">
      <Link to="/store">Store</Link><Link to="/orders">My orders</Link><Link to="/profile">Profile</Link>
      {user?.role === "customer" && <Link to="/farmer-application">Become a Farmer</Link>}
      {user?.role === "farmer" && <Link to="/farmer-application">Farmer status</Link>}
      {user?.role === "admin" && <><Link to="/dashboard">Admin dashboard</Link><Link to="/admin/users">Users</Link><Link to="/admin/farmer-applications">Farmer applications</Link></>}
      <Link to="/cart">Cart <span className="cart-count">{cartCount}</span></Link>
      <button type="button" className="nav-logout" onClick={handleLogout}>Sign out</button>
    </nav>
  </header>;
}
