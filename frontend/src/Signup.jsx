import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "./api";
import "./Signup.css";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  async function handleSignup(e) {
    e.preventDefault();

    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsg(data.error || "Signup failed");
        return;
      }

      setMsg("Signup successful! Redirecting...");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setMsg("Server error");
    }
  }

  return (
    <div className="signup-page">
      <form className="signup-card" onSubmit={handleSignup}>
        <h2>🌾 Farmer Store</h2>
        <p className="subtitle">Create your account</p>

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

        <button type="submit">Sign Up</button>

        {msg && <p className="message">{msg}</p>}

        <p className="switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}
