import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API_BASE } from "./api";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsg(data.error || "Login failed");
        return;
      }

      localStorage.setItem("token", data.token);
      navigate("/store");
    } catch (err) {
      setMsg("Server error");
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleLogin}>
        <h2>🌾 Farmer Store</h2>
        <p className="subtitle">Login to continue</p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit">Login</button>

        {msg && <p className="error">{msg}</p>}

        <p className="switch">
          New user? <Link to="/signup">Create account</Link>
        </p>
      </form>
    </div>
  );
}
