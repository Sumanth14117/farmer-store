import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getGoogleStatus, signupUser, startGoogleLogin } from "./api";
import { useAuth } from "./useAuth";
import "./Signup.css";
export default function Signup() {
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
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
    if (password !== confirm) return setMessage("Passwords do not match");
    setBusy(true);
    try {
      const d = await signupUser({
        name,
        email,
        password
      });
      login(d.accessToken, d.user);
      navigate("/store", {
        replace: true
      });
    } catch (x) {
      setMessage(x.message || "Unable to create account");
    } finally {
      setBusy(false);
    }
  }
  async function googleSignup() {
    setBusy(true);
    try {
      await startGoogleLogin();
    } catch (e) {
      setMessage(e.message || "Google sign-in is unavailable");
      setBusy(false);
    }
  }
  return <div className="auth-page"><form className="auth-card" onSubmit={submit}><h1>🌾 Farmer Store</h1><p className="subtitle">Create your customer account</p><button type="button" disabled={busy || googleStatus !== "enabled"} onClick={googleSignup}>{googleStatus === "enabled" ? "Continue with Google" : googleStatus === "checking" ? "Checking Google sign-in…" : "Google sign-in unavailable"}</button><label>Full name<input value={name} autoComplete="name" onChange={e => setName(e.target.value)} required minLength={2} maxLength={100} /></label><label>Email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} /></label><label>Password<input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} maxLength={128} /></label><label>Confirm password<input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} maxLength={128} /></label><button type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>{message && <p className="form-error" role="alert">{message}</p>}<p className="switch">Already registered? <Link to="/login">Sign in</Link></p></form></div>;
}
