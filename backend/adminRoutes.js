const express = require("express");
const {
  all,
  get,
  run,
  transaction
} = require("./sqlite");
const {
  requireAdmin
} = require("./middleware");
function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    created_at: u.created_at,
    phone: u.phone || null,
    profile_image_url: u.profile_image_url || null,
    google_linked: Boolean(u.google_sub),
    has_password: Boolean(u.password_hash)
  };
}
function createAdminRouter({
  db,
  auth
}) {
  const router = express.Router();
  router.get("/stats", auth, requireAdmin, async (_req, res) => {
    try {
      const rows = await all(db, "SELECT id,items,total FROM orders");
      let totalItems = 0;
      for (const row of rows) totalItems += require("./orderRoutes").decodeOrder(row).items.reduce((sum, item) => sum + item.qty, 0);
      return res.json({
        totalRevenue: rows.reduce((sum, row) => sum + Number(row.total || 0), 0),
        totalOrders: rows.length,
        totalItems
      });
    } catch {
      return res.status(500).json({
        error: "Unable to load dashboard statistics"
      });
    }
  });
  router.get("/users", auth, requireAdmin, async (req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25)),
      offset = Math.max(0, Number(req.query.offset) || 0);
    try {
      const rows = await all(db, "SELECT id,name,email,role,status,created_at,phone,profile_image_url,google_sub,password_hash FROM users ORDER BY id LIMIT ? OFFSET ?", [limit, offset]),
        count = await get(db, "SELECT COUNT(*) AS total FROM users");
      return res.json({
        users: rows.map(publicUser),
        total: count.total,
        limit,
        offset
      });
    } catch {
      return res.status(500).json({
        error: "Unable to list users"
      });
    }
  });
  router.patch("/users/:id/role", auth, requireAdmin, async (req, res) => {
    const id = Number(req.params.id),
      role = req.body?.role;
    if (!Number.isSafeInteger(id) || !['customer', 'farmer', 'admin', 'delivery_partner'].includes(role)) return res.status(400).json({
      error: "Invalid user or role"
    });
    if (id === req.user.id && role !== "admin") return res.status(409).json({
      error: "You cannot remove your own administrator role"
    });
    try {
      const result = await transaction(db, async () => {
        const target = await get(db, "SELECT id,role,status FROM users WHERE id=?", [id]);
        if (!target) return null;
        if (target.role === "admin" && role !== "admin" && target.status === "active") {
          const n = await get(db, "SELECT COUNT(*) AS count FROM users WHERE role='admin' AND status='active'");
          if (n.count <= 1) throw Object.assign(new Error("last_admin"), {
            code: "LAST_ADMIN"
          });
        }
        await run(db, "UPDATE users SET role=?,is_admin=? WHERE id=?", [role, role === "admin" ? 1 : 0, id]);
        await run(db, "INSERT INTO admin_audit_logs(admin_user_id,target_user_id,action,old_value,new_value) VALUES(?,?, 'role_change',?,?)", [req.user.id, id, target.role, role]);
        return get(db, "SELECT id,name,email,role,status,created_at,phone,profile_image_url,google_sub,password_hash FROM users WHERE id=?", [id]);
      });
      if (!result) return res.status(404).json({
        error: "User not found"
      });
      return res.json({
        user: publicUser(result)
      });
    } catch (e) {
      return res.status(e.code === "LAST_ADMIN" ? 409 : 500).json({
        error: e.code === "LAST_ADMIN" ? "At least one active administrator must remain" : "Unable to change role"
      });
    }
  });
  router.patch("/users/:id/status", auth, requireAdmin, async (req, res) => {
    const id = Number(req.params.id),
      status = req.body?.status;
    if (!Number.isSafeInteger(id) || !['active', 'suspended'].includes(status)) return res.status(400).json({
      error: "Invalid user or status"
    });
    if (id === req.user.id && status !== "active") return res.status(409).json({
      error: "You cannot suspend your own account"
    });
    try {
      const result = await transaction(db, async () => {
        const target = await get(db, "SELECT id,role,status FROM users WHERE id=?", [id]);
        if (!target) return null;
        if (target.role === "admin" && target.status === "active" && status !== "active") {
          const n = await get(db, "SELECT COUNT(*) AS count FROM users WHERE role='admin' AND status='active'");
          if (n.count <= 1) throw Object.assign(new Error("last_admin"), {
            code: "LAST_ADMIN"
          });
        }
        await run(db, "UPDATE users SET status=? WHERE id=?", [status, id]);
        if (status === "suspended") await run(db, "UPDATE sessions SET revoked_at=COALESCE(revoked_at,?) WHERE user_id=?", [new Date().toISOString(), id]);
        await run(db, "INSERT INTO admin_audit_logs(admin_user_id,target_user_id,action,old_value,new_value) VALUES(?,?, 'status_change',?,?)", [req.user.id, id, target.status, status]);
        return get(db, "SELECT id,name,email,role,status,created_at,phone,profile_image_url,google_sub,password_hash FROM users WHERE id=?", [id]);
      });
      if (!result) return res.status(404).json({
        error: "User not found"
      });
      return res.json({
        user: publicUser(result)
      });
    } catch (e) {
      return res.status(e.code === "LAST_ADMIN" ? 409 : 500).json({
        error: e.code === "LAST_ADMIN" ? "At least one active administrator must remain" : "Unable to change account status"
      });
    }
  });
  return router;
}
module.exports = {
  createAdminRouter
};
