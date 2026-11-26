const configuredBase = import.meta.env?.VITE_API_BASE_URL || "http://localhost:4000/api";
export const API_BASE = configuredBase.replace(/\/+$/, "");
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}
let accessToken = null;
let csrfToken = null;
let refreshPromise = null;
const authChannel = typeof window !== "undefined" && typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("farmer-store-auth") : null;
authChannel?.addEventListener("message", event => {
  if (event.data?.type === "logout") {
    accessToken = null;
    csrfToken = null;
    window.dispatchEvent(new Event("auth:expired"));
  } else if (event.data?.type === "login") window.dispatchEvent(new Event("auth:renewed"));
});
export const setAccessToken = (v, {
  broadcast = true
} = {}) => {
  accessToken = v || null;
  if (broadcast && v) authChannel?.postMessage({
    type: "login"
  });
};
export const clearAccessToken = ({
  broadcast = true
} = {}) => {
  accessToken = null;
  csrfToken = null;
  if (broadcast) authChannel?.postMessage({
    type: "logout"
  });
};
async function raw(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (csrfToken && ["POST", "PATCH", "DELETE", "PUT"].includes((options.method || "GET").toUpperCase())) headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) throw new ApiError(data.error || `Request failed (${response.status})`, response.status, data);
  return data;
}
async function refresh() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const rotate = async () => {
        const csrf = await raw("/auth/csrf", {
          method: "GET"
        });
        csrfToken = csrf.csrfToken;
        const data = await raw("/auth/refresh", {
          method: "POST",
          body: "{}"
        });
        csrfToken = data.csrfToken || csrfToken;
        accessToken = data.accessToken;
        return data;
      };
      return globalThis.navigator?.locks?.request ? globalThis.navigator.locks.request("farmer-store-session-refresh", rotate) : rotate();
    })().catch(e => {
      clearAccessToken();
      throw e;
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}
export async function initializeSession() {
  try {
    return await refresh();
  } catch {
    return null;
  }
}
export async function apiRequest(path, options = {}) {
  const {
    auth = true,
    retry = true,
    ...requestOptions
  } = options;
  try {
    return await raw(path, requestOptions);
  } catch (e) {
    if (e.status === 401 && auth && retry && !["/auth/login", "/auth/signup", "/auth/refresh", "/auth/logout", "/auth/csrf"].some(endpoint => path.startsWith(endpoint)) && typeof window !== "undefined") {
      try {
        await refresh();
        return await apiRequest(path, {
          ...options,
          retry: false
        });
      } catch {
        clearAccessToken();
      }
    }
    if (e.status === 401 && auth && typeof window !== "undefined") {
      clearAccessToken();
      window.dispatchEvent(new Event("auth:expired"));
    }
    throw e;
  }
}
const json = x => JSON.stringify(x);
export const loginUser = b => apiRequest("/auth/login", {
  method: "POST",
  auth: false,
  body: json(b)
});
export const signupUser = b => apiRequest("/auth/signup", {
  method: "POST",
  auth: false,
  body: json(b)
});
export const getCurrentUser = () => apiRequest("/auth/me");
export async function logoutUser() {
  try {
    const c = await apiRequest("/auth/csrf", {
      auth: false
    });
    csrfToken = c.csrfToken;
    return await apiRequest("/auth/logout", {
      method: "POST",
      auth: false,
      body: "{}"
    });
  } finally {
    clearAccessToken();
  }
}
export const getGoogleStatus = () => apiRequest("/auth/google/status", {
  auth: false
});
export const startGoogleLogin = async () => {
  const d = await apiRequest("/auth/google/start", {
    method: "POST",
    auth: false,
    body: "{}"
  });
  window.location.assign(d.url);
};
export const startGoogleLink = async () => {
  const d = await apiRequest("/auth/google/link/start", {
    method: "POST",
    body: "{}"
  });
  window.location.assign(d.url);
};
export const unlinkGoogle = () => apiRequest("/auth/google/link", {
  method: "DELETE"
});
export const getProfile = () => apiRequest("/profile");
export const updateProfile = b => apiRequest("/profile", {
  method: "PATCH",
  body: json(b)
});
export const updatePassword = b => apiRequest("/auth/password", {
  method: "POST",
  body: json(b)
});
export const getAdminUsers = (limit = 25, offset = 0) => apiRequest(`/admin/users?limit=${limit}&offset=${offset}`);
export const updateAdminRole = (id, role) => apiRequest(`/admin/users/${id}/role`, {
  method: "PATCH",
  body: json({
    role
  })
});
export const updateAdminStatus = (id, status) => apiRequest(`/admin/users/${id}/status`, {
  method: "PATCH",
  body: json({
    status
  })
});
export const getProducts = () => apiRequest("/products", {
  auth: false
});
export const getOrders = () => apiRequest("/orders");
export const getOrder = id => apiRequest(`/orders/${encodeURIComponent(id)}`);
export const placeOrder = (body, idempotencyKey) => apiRequest("/orders", {
  method: "POST",
  headers: {
    "Idempotency-Key": idempotencyKey
  },
  body: json(body)
});
export const getMyFarmerApplication = () => apiRequest("/farmer-applications/me");
export const createFarmerApplication = body => apiRequest("/farmer-applications", { method: "POST", body: json(body) });
export const updateFarmerApplication = body => apiRequest("/farmer-applications/me", { method: "PATCH", body: json(body) });
export const submitFarmerApplication = () => apiRequest("/farmer-applications/me/submit", { method: "POST", body: "{}" });
export const getAdminFarmerApplications = (params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ""));
  return apiRequest(`/admin/farmer-applications${query.size ? `?${query}` : ""}`);
};
export const getAdminFarmerApplication = id => apiRequest(`/admin/farmer-applications/${encodeURIComponent(id)}`);
export const reviewFarmerApplication = (id, action, feedback = "") => apiRequest(`/admin/farmer-applications/${encodeURIComponent(id)}/${action}`, { method: "POST", body: json(feedback ? { feedback } : {}) });
export const getAdminStats = () => apiRequest("/admin/stats");
export const getReviews = id => apiRequest(`/products/${encodeURIComponent(id)}/reviews`, {
  auth: false
});
export const createReview = (id, body) => apiRequest(`/products/${encodeURIComponent(id)}/reviews`, {
  method: "POST",
  body: json(body)
});
