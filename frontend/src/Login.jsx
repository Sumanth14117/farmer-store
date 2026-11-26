import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getGoogleStatus, loginUser, startGoogleLogin } from "./api";
import { useAuth } from "./useAuth";
import "./Login.css";
export default function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [googleStatus, setGoogleStatus] = useState("checking"),
    navigate = useNavigate(),
    {
      login
    } = useAuth();
  useEffect(() => {
    getGoogleStatus().then(x => setGoogleStatus(x.enabled ? "enabled" : "disabled")).catch(() => setGoogleStatus("disabled"));
  }, []);
  async function submit(e) {
    e.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      const d = await loginUser({
        email,
        password
      });
      login(d.accessToken, d.user);
      navigate("/store", {
        replace: true
      });
    } catch (x) {
      setMessage(x.message || "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }
  async function googleLogin() {
    setBusy(true);
    try {
      await startGoogleLogin();
    } catch (e) {
      setMessage(e.message || "Google sign-in is unavailable");
      setBusy(false);
    }
  }
  return <div className="auth-page"><form className="auth-card" onSubmit={submit}><h1>🌾 Farmer Store</h1><p className="subtitle">Sign in to your account</p><button type="button" disabled={busy || googleStatus !== "enabled"} onClick={googleLogin}>{googleStatus === "enabled" ? "Continue with Google" : googleStatus === "checking" ? "Checking Google sign-in…" : "Google sign-in unavailable"}</button><label>Email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={128} /></label><button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>{message && <p className="form-error" role="alert">{message}</p>}<p className="switch">New to Farmer Store? <Link to="/signup">Create an account</Link></p></form></div>;
}
