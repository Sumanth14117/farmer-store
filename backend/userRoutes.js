// Compatibility exports for integrations that historically imported userRoutes.js.
// The application mounts the dedicated route factories from index.js.
const { createAuthRouter } = require("./authRoutes");
const { createOrderRouter } = require("./orderRoutes");
const { createAdminRouter } = require("./adminRoutes");
module.exports = { createAuthRouter, createOrderRouter, createAdminRouter };
