import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { initializeSession } from "./api";
import { useAuth } from "./useAuth";
export default function AuthCallback() {
  const [params] = useSearchParams(),
    error = params.get("error"),
    linked = params.get("linked"),
    initial = error ? error === "link_from_account_settings" ? "An account already uses that email. Sign in and link Google from your profile." : "Google sign-in could not be completed." : linked ? "Google account linked." : "Finishing sign in…",
    [message, setMessage] = useState(initial),
    navigate = useNavigate(),
    {
      login
    } = useAuth();
  useEffect(() => {
    let active = true;
    if (error) return;
    if (linked) {
      const timer = setTimeout(() => navigate("/profile", {
        replace: true
      }), 1000);
      return () => clearTimeout(timer);
    }
    initializeSession().then(data => {
      if (!active) return;
      if (data) {
        login(data.accessToken, data.user);
        navigate("/store", {
          replace: true
        });
      } else setMessage("No valid sign-in session was returned. Please try again.");
    });
    return () => {
      active = false;
    };
  }, [error, linked, navigate, login]);
  return <main className="page-state" role="status">{message}</main>;
}
