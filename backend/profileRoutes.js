const express = require("express");
const {
  get,
  run
} = require("./sqlite");
const {
  safeUser
} = require("./authSessions");
function createProfileRouter({
  db,
  auth
}) {
  const router = express.Router();
  router.get("/", auth, (req, res) => res.json({
    user: safeUser(req.user)
  }));
  router.patch("/", auth, async (req, res) => {
    const body = req.body || {};
    const fields = Object.keys(body);
    if (fields.some(k => !["name", "phone", "profile_image_url"].includes(k))) return res.status(400).json({
      error: "Only name, phone, and profile image can be updated"
    });
    if (body.name !== undefined && typeof body.name !== "string" || body.phone !== undefined && body.phone !== null && typeof body.phone !== "string" || body.profile_image_url !== undefined && body.profile_image_url !== null && typeof body.profile_image_url !== "string") return res.status(400).json({
      error: "Invalid profile fields"
    });
    const name = body.name === undefined ? req.user.name : body.name.trim(),
      phone = body.phone === undefined ? req.user.phone : (body.phone || "").trim(),
      image = body.profile_image_url === undefined ? req.user.profile_image_url : (body.profile_image_url || "").trim();
    if (name.length < 2 || name.length > 100 || String(phone || "").length > 30 || String(image || "").length > 2048) return res.status(400).json({
      error: "Invalid profile fields"
    });
    if (image) {
      try {
        const url = new URL(image);
        if (url.protocol !== "https:" || !url.hostname || url.username || url.password) throw new Error("invalid image URL");
      } catch {
        return res.status(400).json({
          error: "Profile image must use a valid HTTPS URL"
        });
      }
    }
    try {
      await run(db, "UPDATE users SET name=?,phone=?,profile_image_url=? WHERE id=?", [name, phone || null, image || null, req.user.id]);
      const user = await get(db, "SELECT id,name,email,role,status,created_at,phone,profile_image_url,google_sub,password_hash FROM users WHERE id=?", [req.user.id]);
      return res.json({
        user: safeUser(user)
      });
    } catch {
      return res.status(500).json({
        error: "Unable to update profile"
      });
    }
  });
  return router;
}
module.exports = {
  createProfileRouter
};
