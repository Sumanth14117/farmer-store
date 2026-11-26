import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./Navbar";
import Login from "./Login";
import Signup from "./Signup";
import FarmerStore from "./FarmerStore";
import ProtectedRoute from "./ProtectedRoute";
import Cart from "./Cart";
import Checkout from "./Checkout";
import OrderSuccess from "./OrderSuccess";
import OrderHistory from "./OrderHistory";
import AuthCallback from "./AuthCallback";
import Profile from "./Profile";
import AdminUsers from "./AdminUsers";
import FarmerApplication from "./FarmerApplication";
import FarmerApplicationAdmin from "./FarmerApplicationAdmin";
const Dashboard = lazy(() => import("./Dashboard"));
import { AuthProvider } from "./AuthContext.jsx";
function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("cart") || "[]");
    return Array.isArray(saved) ? saved.filter(item => item && typeof item === "object" && Number(item.qty) > 0) : [];
  } catch {
    return [];
  }
}
function Shell({ children, cart, setCart }) {
  return <><Navbar cart={cart} setCart={setCart} /><main>{children}</main></>;
}
function StoreApp() {
  const [cart, setCart] = useState(readCart);
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);
  const page = (content, admin = false, allowedRoles) => <ProtectedRoute adminOnly={admin} allowedRoles={allowedRoles}><Shell cart={cart} setCart={setCart}>{content}</Shell></ProtectedRoute>;
  return <Routes><Route path="/" element={<Navigate to="/store" replace />} /><Route path="/login" element={<Login />} /><Route path="/signup" element={<Signup />} /><Route path="/auth/callback" element={<AuthCallback />} /><Route path="/store" element={page(<FarmerStore cart={cart} setCart={setCart} />)} /><Route path="/cart" element={page(<Cart cart={cart} setCart={setCart} />)} /><Route path="/checkout" element={page(<Checkout cart={cart} setCart={setCart} />)} /><Route path="/success" element={page(<OrderSuccess />)} /><Route path="/orders" element={page(<OrderHistory />)} /><Route path="/profile" element={page(<Profile />)} /><Route path="/farmer-application" element={page(<FarmerApplication />, false, ["customer", "farmer"])} /><Route path="/dashboard" element={page(<Suspense fallback={<p className="page-state" role="status">Loading dashboard…</p>}><Dashboard /></Suspense>, true)} /><Route path="/admin/users" element={page(<AdminUsers />, true)} /><Route path="/admin/farmer-applications" element={page(<FarmerApplicationAdmin />, true)} /><Route path="*" element={<Navigate to="/store" replace />} /></Routes>;
}
export default function App() {
  return <AuthProvider><StoreApp /></AuthProvider>;
}
