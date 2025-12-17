import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Navbar from "./Navbar";
import Login from "./Login";
import Signup from "./Signup";
import FarmerStore from "./FarmerStore";
import ProtectedRoute from "./ProtectedRoute";
import Cart from "./Cart";
import Checkout from "./Checkout";
import OrderSuccess from "./OrderSuccess";

function App() {
  // 🛒 CART STATE
  const [cart, setCart] = useState(
    JSON.parse(localStorage.getItem("cart")) || []
  );

  // 💾 SAVE CART TO LOCAL STORAGE
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  return (
    <Routes>
      {/* ✅ DEFAULT ROUTE */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* 🔐 AUTH ROUTES */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* 🌾 STORE PAGE */}
      <Route
        path="/store"
        element={
          <ProtectedRoute>
            <div>
              <Navbar cart={cart} setCart={setCart} />
              <FarmerStore cart={cart} setCart={setCart} />
            </div>
          </ProtectedRoute>
        }
      />

      {/* 🛒 CART PAGE */}
      <Route
        path="/cart"
        element={
          <ProtectedRoute>
            <div>
              <Navbar cart={cart} setCart={setCart} />
              <Cart cart={cart} setCart={setCart} />
            </div>
          </ProtectedRoute>
        }
      />

      {/* 🧾 CHECKOUT PAGE */}
      <Route
        path="/checkout"
        element={
          <ProtectedRoute>
            <div>
              <Navbar cart={cart} setCart={setCart} />
              <Checkout cart={cart} setCart={setCart} />
            </div>
          </ProtectedRoute>
        }
      />

      {/* 🎉 ORDER SUCCESS PAGE */}
      <Route
        path="/success"
        element={
          <ProtectedRoute>
            <div>
              <Navbar cart={cart} setCart={setCart} />
              <OrderSuccess />
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
