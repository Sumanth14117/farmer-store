const path = require("node:path");
require("dotenv").config({ path: process.env.ENV_FILE || path.join(__dirname, ".env") });
const jwtSecret = process.env.JWT_SECRET || "";
if (jwtSecret.length < 32 || /^(replace_with|your_jwt|change_me)/i.test(jwtSecret)) {
  throw new Error("Startup blocked: configure JWT_SECRET with a random value of at least 32 characters in backend/.env or the deployment environment.");
}
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173"))
  .split(",").map((value) => value.trim()).filter(Boolean);
const sameSite = (process.env.SESSION_COOKIE_SAME_SITE || "lax").toLowerCase();
if (!["lax", "strict", "none"].includes(sameSite)) throw new Error("SESSION_COOKIE_SAME_SITE must be Lax, Strict, or None.");
const cookieSecure = process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
const refreshTokenLifetimeMs = Number(process.env.REFRESH_TOKEN_LIFETIME_MS || 30 * 24 * 60 * 60 * 1000);
if (!Number.isSafeInteger(refreshTokenLifetimeMs) || refreshTokenLifetimeMs < 60 * 60 * 1000 || refreshTokenLifetimeMs > 90 * 24 * 60 * 60 * 1000) throw new Error("REFRESH_TOKEN_LIFETIME_MS must be between 1 hour and 90 days.");
if (sameSite === "none" && !cookieSecure) throw new Error("SameSite=None cookies require COOKIE_SECURE=true.");
module.exports = Object.freeze({
  jwtSecret,
  port: Number(process.env.PORT || 4000),
  allowedOrigins,
  databaseFile: process.env.DB_FILE || path.join(__dirname, "db.sqlite"),
  nodeEnv: process.env.NODE_ENV || "development",
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),
  authRateLimitWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  accessTokenTtl: "10m",
  refreshTokenLifetimeMs,
  cookieSecure,
  cookieSameSite: sameSite,
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  frontendBaseUrl: (process.env.FRONTEND_BASE_URL || "http://localhost:5173").replace(/\/$/, ""),
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || `http://localhost:${Number(process.env.PORT || 4000)}/api/auth/google/callback`,
});
