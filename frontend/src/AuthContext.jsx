import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentUser, initializeSession, logoutUser, setAccessToken } from "./api";
import { AuthContext } from "./authContext";
export function AuthProvider({
  children
}) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    localStorage.removeItem("token");
    initializeSession().then(async d => {
      if (!active) return;
      if (d) {
        setAccessToken(d.accessToken, {
          broadcast: false
        });
        setUser(d.user);
        try {
          const me = await getCurrentUser();
          if (active) setUser(me.user);
        } catch {
          if (active) setUser(null);
        }
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    const expire = () => {
      if (active) {
        setUser(null);
        setLoading(false);
      }
    };
    const renewed = () => {
      getCurrentUser().then(result => {
        if (active) {
          setUser(result.user);
          setLoading(false);
        }
      }).catch(() => {
        if (active) setUser(null);
      });
    };
    window.addEventListener("auth:expired", expire);
    window.addEventListener("auth:renewed", renewed);
    window.addEventListener("focus", renewed);
    return () => {
      active = false;
      window.removeEventListener("auth:expired", expire);
      window.removeEventListener("auth:renewed", renewed);
      window.removeEventListener("focus", renewed);
    };
  }, []);
  const login = useCallback((token, nextUser) => {
    setAccessToken(token);
    setUser(nextUser);
    setLoading(false);
  }, []);
  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } finally {
      setUser(null);
      localStorage.removeItem("cart");
    }
  }, []);
  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    setUser
  }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
