const express = require("express");
const cors = require("cors");
let config;
try {
  config = require("./config");
} catch (error) {
  if (require.main === module) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
const database = require("./db");
const {
  createAuthMiddleware,
  createRateLimiter,
  safeErrorHandler
} = require("./middleware");
const {
  createAuthRouter
} = require("./authRoutes");
const {
  createProductRouter
} = require("./productRoutes");
const {
  createOrderRouter
} = require("./orderRoutes");
const {
  createReviewRouter
} = require("./reviewRoutes");
const {
  createAdminRouter
} = require("./adminRoutes");
const {
  createProfileRouter
} = require("./profileRoutes");
const { createApplicantRouter, createAdminApplicationsRouter } = require("./farmerApplicationRoutes");
function parseCookies(req, _res, next) {
  const header = req.headers.cookie || "";
  req.cookies = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    try {
      req.cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {}
  }
  next();
}
function createApp(options = {}) {
  const db = options.database || database,
    secret = options.secret || config.jwtSecret;
  if (typeof secret !== "string" || secret.length < 32) throw new Error("A strong JWT_SECRET is required");
  const origins = options.allowedOrigins || config.allowedOrigins,
    auth = createAuthMiddleware(db, secret),
    rateLimit = options.rateLimit || createRateLimiter({
      windowMs: config.authRateLimitWindowMs,
      max: config.authRateLimitMax
    }),
    app = express();
  app.disable("x-powered-by");
  app.use(cors({
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS origin denied"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-CSRF-Token"],
    maxAge: 600
  }));
  app.use(express.json({
    limit: "32kb",
    strict: true
  }));
  app.use(parseCookies);
  app.use((req, res, next) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method) && req.headers.origin && !origins.includes(req.headers.origin)) return res.status(403).json({
      error: "Origin not allowed"
    });
    next();
  });
  app.get("/health", (_req, res) => res.json({
    ok: true
  }));
  app.use("/api/auth", createAuthRouter({
    db,
    secret,
    auth,
    rateLimit,
    googleClient: options.googleClient
  }));
  app.use("/api/profile", createProfileRouter({
    db,
    auth
  }));
  app.use("/api/farmer-applications", createApplicantRouter({ db, auth }));
  app.use("/api/admin/farmer-applications", createAdminApplicationsRouter({ db, auth }));
  app.use("/api/products/:productId/reviews", createReviewRouter({
    db,
    auth
  }));
  app.use("/api/products", createProductRouter({
    db,
    auth
  }));
  app.use("/api/orders", createOrderRouter({
    db,
    auth
  }));
  app.use("/api/admin", createAdminRouter({
    db,
    auth
  }));
  app.use((_req, res) => res.status(404).json({
    error: "Route not found"
  }));
  app.use(safeErrorHandler);
  return app;
}
const app = createApp();
async function startServer() {
  await database.ready;
  return app.listen(config.port, "0.0.0.0", () => console.log(`API listening on port ${config.port}`));
}
if (require.main === module) startServer().catch(async () => {
  console.error("Startup failed: database initialization could not be completed.");
  await database.closeAsync().catch(() => {});
  process.exitCode = 1;
});
module.exports = {
  app,
  createApp,
  startServer
};
