const express = require("express");
const { all, get, run, transaction } = require("./sqlite");
const { requireAdmin, requireRoles } = require("./middleware");

const fields = new Set([
  "farm_name", "full_name", "contact_phone", "farm_description", "farm_address",
  "state", "district", "city_village", "pincode", "latitude", "longitude",
  "farming_type", "primary_crops", "additional_crop_info", "farm_size",
  "farm_size_unit", "years_experience", "farming_practices"
]);
const farmingTypes = new Set(["individual_farmer", "family_owned_farm", "farmer_group", "agricultural_business"]);
const sizeUnits = new Set(["acre", "hectare"]);
const limits = { farm_name: 120, full_name: 100, contact_phone: 30, farm_description: 1200, farm_address: 300, state: 100, district: 100, city_village: 100, pincode: 6, primary_crops: 300, additional_crop_info: 1200, farming_practices: 1200 };
const required = ["farm_name", "full_name", "contact_phone", "farm_description", "farm_address", "state", "district", "city_village", "pincode", "farming_type", "primary_crops", "farm_size", "farm_size_unit", "years_experience", "farming_practices"];
function validatePatch(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return "Enter valid application information";
  for (const key of Object.keys(input)) {
    if (!fields.has(key)) return "Application contains an unsupported field";
    const value = input[key];
    if (limits[key] && (typeof value !== "string" || value.length > limits[key])) return `Check the ${key.replaceAll("_", " ")} field`;
    if (typeof value === "string" && value !== value.trim()) return `Remove extra spaces from ${key.replaceAll("_", " ")}`;
    if (["latitude", "longitude", "farm_size"].includes(key) && value !== null && (typeof value !== "number" || !Number.isFinite(value))) return `Enter a valid ${key.replaceAll("_", " ")}`;
    if (key === "years_experience" && value !== null && (!Number.isInteger(value) || value < 0 || value > 100)) return "Experience must be between 0 and 100 years";
    if (key === "farming_type" && value !== null && value !== "" && !farmingTypes.has(value)) return "Choose a valid farming type";
    if (key === "farm_size_unit" && value !== null && value !== "" && !sizeUnits.has(value)) return "Choose acres or hectares";
  }
  const next = { ...input };
  if ("latitude" in next && next.latitude === "") next.latitude = null;
  if ("longitude" in next && next.longitude === "") next.longitude = null;
  if (("latitude" in next || "longitude" in next) && (next.latitude == null) !== (next.longitude == null)) return "Enter both map coordinates or leave both blank";
  if (next.latitude != null && (next.latitude < -90 || next.latitude > 90)) return "Latitude must be between -90 and 90";
  if (next.longitude != null && (next.longitude < -180 || next.longitude > 180)) return "Longitude must be between -180 and 180";
  if (next.farm_size != null && (next.farm_size <= 0 || !next.farm_size_unit)) return "Farm size must be positive and include a unit";
  if (next.pincode != null && next.pincode !== "" && !/^\d{6}$/.test(next.pincode)) return "Enter a six-digit Indian PIN code";
  if (next.contact_phone && !/^\+?[\d ()-]{7,30}$/.test(next.contact_phone)) return "Enter a valid contact phone number";
  return null;
}
async function insertEvent(db, app, { status, type, actor, role, comments = null, snapshot = null }) {
  await run(db, "INSERT INTO farmer_application_events(application_id,revision,from_status,to_status,event_type,actor_user_id,actor_role,comments,application_snapshot_json) VALUES(?,?,?,?,?,?,?,?,?)", [app.id, app.revision, app.status, status, type, actor, role, comments, snapshot ? JSON.stringify(snapshot) : null]);
}
async function loadApplication(db, userId) {
  const app = await get(db, "SELECT * FROM farmer_applications WHERE user_id=?", [userId]);
  if (!app) return null;
  app.events = await all(db, "SELECT id,revision,from_status,to_status,event_type,actor_role,comments,application_snapshot_json,created_at FROM farmer_application_events WHERE application_id=? ORDER BY id", [app.id]);
  return app;
}
function createApplicantRouter({ db, auth }) {
  const router = express.Router();
  router.use(auth, requireRoles("customer", "farmer"));
  router.get("/me", async (req, res) => {
    try { return res.json({ application: await loadApplication(db, req.user.id) }); }
    catch { return res.status(500).json({ error: "Unable to load farmer application" }); }
  });
  router.post("/", async (req, res) => {
    try {
      const validation = validatePatch(req.body);
      if (validation) return res.status(400).json({ error: validation });
      const result = await transaction(db, async () => {
        const existing = await get(db, "SELECT * FROM farmer_applications WHERE user_id=?", [req.user.id]);
        if (!existing) {
          const columns = Object.keys(req.body);
          const values = columns.map((key) => req.body[key]);
          const created = await run(db, `INSERT INTO farmer_applications(user_id${columns.length ? `,${columns.join(",")}` : ""}) VALUES(?${columns.length ? `,${columns.map(() => "?").join(",")}` : ""})`, [req.user.id, ...values]);
          const app = await get(db, "SELECT * FROM farmer_applications WHERE id=?", [created.lastID]);
          await run(db, "INSERT INTO farmer_application_events(application_id,revision,from_status,to_status,event_type,actor_user_id,actor_role) VALUES(?,1,NULL,'draft','created',?,'customer')", [app.id, req.user.id]);
          return app;
        }
        if (existing.status !== "rejected") return { conflict: existing.status };
        const columns = Object.keys(req.body);
        await run(db, `UPDATE farmer_applications SET revision=revision+1,status='draft',submitted_at=NULL,reviewed_at=NULL,reviewer_admin_id=NULL,admin_feedback=NULL,rejection_reason=NULL,updated_at=CURRENT_TIMESTAMP${columns.length ? `,${columns.map((key) => `${key}=?`).join(",")}` : ""} WHERE id=?`, [...columns.map((key) => req.body[key]), existing.id]);
        const app = await get(db, "SELECT * FROM farmer_applications WHERE id=?", [existing.id]);
        await insertEvent(db, app, { status: "draft", type: "reopened", actor: req.user.id, role: req.user.role, comments: "Applicant started a new revision after rejection" });
        return app;
      });
      if (result.conflict) return res.status(409).json({ error: `Application is already ${result.conflict}` });
      return res.status(201).json({ application: result });
    } catch { return res.status(500).json({ error: "Unable to save farmer application" }); }
  });
  router.patch("/me", async (req, res) => {
    try {
      const validation = validatePatch(req.body);
      if (validation) return res.status(400).json({ error: validation });
      if (!Object.keys(req.body).length) return res.status(400).json({ error: "Provide at least one field to update" });
      const result = await transaction(db, async () => {
        const app = await get(db, "SELECT * FROM farmer_applications WHERE user_id=?", [req.user.id]);
        if (!app) return { missing: true };
        if (!(["draft", "needs_changes"].includes(app.status)) || req.user.role !== "customer") return { conflict: app.status };
        const cols = Object.keys(req.body);
        await run(db, `UPDATE farmer_applications SET ${cols.map((key) => `${key}=?`).join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`, [...cols.map((key) => req.body[key]), app.id]);
        const updated = await get(db, "SELECT * FROM farmer_applications WHERE id=?", [app.id]);
        await insertEvent(db, app, { status: app.status, type: "saved", actor: req.user.id, role: req.user.role });
        return updated;
      });
      if (result.missing) return res.status(404).json({ error: "Application not found" });
      if (result.conflict) return res.status(409).json({ error: `Application cannot be edited while ${result.conflict}` });
      return res.json({ application: result });
    } catch { return res.status(500).json({ error: "Unable to update farmer application" }); }
  });
  router.post("/me/submit", async (req, res) => {
    try {
      if (req.body && Object.keys(req.body).length) return res.status(400).json({ error: "Save application fields before submitting" });
      const result = await transaction(db, async () => {
        const app = await get(db, "SELECT * FROM farmer_applications WHERE user_id=?", [req.user.id]);
        if (!app) return { missing: true };
        if (req.user.role !== "customer" || !["draft", "needs_changes"].includes(app.status)) return { conflict: app.status };
        const missing = required.filter((key) => app[key] === null || app[key] === undefined || app[key] === "");
        if (missing.length) return { invalid: missing.map((key) => key.replaceAll("_", " ")) };
        const validation = validatePatch(Object.fromEntries([...required, "latitude", "longitude"].filter((key) => app[key] != null).map((key) => [key, app[key]])));
        if (validation) return { invalid: [validation] };
        const submittedAt = new Date().toISOString();
        await run(db, "UPDATE farmer_applications SET contact_email=?,status='pending',submitted_at=?,updated_at=?,reviewed_at=NULL,reviewer_admin_id=NULL WHERE id=? AND status IN ('draft','needs_changes')", [req.user.email, submittedAt, submittedAt, app.id]);
        const snapshot = Object.fromEntries([...fields, "contact_email"].map((key) => [key, key === "contact_email" ? req.user.email : app[key]]));
        await insertEvent(db, app, { status: "pending", type: "submitted", actor: req.user.id, role: req.user.role, snapshot });
        return get(db, "SELECT * FROM farmer_applications WHERE id=?", [app.id]);
      });
      if (result.missing) return res.status(404).json({ error: "Application not found" });
      if (result.conflict) return res.status(409).json({ error: `Application cannot be submitted while ${result.conflict}` });
      if (result.invalid) return res.status(400).json({ error: "Complete the required fields", fields: result.invalid });
      return res.json({ application: result });
    } catch { return res.status(500).json({ error: "Unable to submit farmer application" }); }
  });
  return router;
}
function createAdminApplicationsRouter({ db, auth }) {
  const router = express.Router();
  router.use(auth, requireAdmin);
  router.get("/", async (req, res) => {
    const validStatuses = ["draft", "pending", "needs_changes", "approved", "rejected"];
    const requestedStatus = typeof req.query.status === "string" ? req.query.status : "";
    if (requestedStatus && !validStatuses.includes(requestedStatus)) return res.status(400).json({ error: "Invalid application status filter" });
    const status = requestedStatus || null;
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const rawLimit = req.query.limit === undefined ? 25 : Number(req.query.limit);
    const rawOffset = req.query.offset === undefined ? 0 : Number(req.query.offset);
    if (!Number.isInteger(rawLimit) || !Number.isInteger(rawOffset) || rawOffset < 0 || rawOffset > 100000) return res.status(400).json({ error: "Invalid application pagination" });
    const limit = Math.min(100, Math.max(1, rawLimit));
    const offset = Math.min(100000, rawOffset);
    const where = [], params = [];
    if (status) { where.push("a.status=?"); params.push(status); }
    if (q) { const term = q.toLocaleLowerCase(); where.push("(instr(lower(a.full_name),?)>0 OR instr(lower(a.farm_name),?)>0 OR instr(lower(a.state),?)>0 OR instr(lower(a.district),?)>0 OR instr(lower(a.city_village),?)>0)"); params.push(term, term, term, term, term); }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    try {
      const applications = await all(db, `SELECT a.id,a.user_id,a.revision,a.farm_name,a.full_name,a.state,a.district,a.city_village,a.status,a.submitted_at,a.updated_at,u.status AS account_status FROM farmer_applications a JOIN users u ON u.id=a.user_id ${clause} ORDER BY CASE a.status WHEN 'pending' THEN 0 ELSE 1 END,a.updated_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
      const count = await get(db, `SELECT COUNT(*) AS total FROM farmer_applications a JOIN users u ON u.id=a.user_id ${clause}`, params);
      const summary = await all(db, "SELECT status,COUNT(*) AS count FROM farmer_applications GROUP BY status");
      return res.json({ applications, total: count.total, limit, offset, summary: Object.fromEntries(summary.map((row) => [row.status, row.count])) });
    } catch { return res.status(500).json({ error: "Unable to list farmer applications" }); }
  });
  router.get("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid application ID" });
    try {
      const application = await get(db, "SELECT a.*,u.status AS account_status,u.role AS account_role FROM farmer_applications a JOIN users u ON u.id=a.user_id WHERE a.id=?", [id]);
      if (!application) return res.status(404).json({ error: "Application not found" });
      application.events = await all(db, "SELECT id,revision,from_status,to_status,event_type,actor_role,comments,application_snapshot_json,created_at FROM farmer_application_events WHERE application_id=? ORDER BY id", [id]);
      return res.json({ application });
    } catch { return res.status(500).json({ error: "Unable to load farmer application" }); }
  });
  async function review(req, res, action) {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid application ID" });
    const feedback = typeof req.body?.feedback === "string" ? req.body.feedback.trim() : "";
    if (action !== "approve" && (feedback.length < 10 || feedback.length > 1000)) return res.status(400).json({ error: "Provide feedback of at least 10 characters" });
    if (req.body && Object.keys(req.body).some((key) => key !== "feedback")) return res.status(400).json({ error: "Unsupported review field" });
    try {
      const result = await transaction(db, async () => {
        const app = await get(db, "SELECT * FROM farmer_applications WHERE id=?", [id]);
        if (!app) return { missing: true };
        if (app.status !== "pending") return { conflict: true };
        if (app.user_id === req.user.id) return { self: true };
        const target = await get(db, "SELECT id,role,status FROM users WHERE id=?", [app.user_id]);
        if (!target || target.role !== "customer") return { conflict: true };
        if (action === "approve" && target.status !== "active") return { suspended: true };
        const now = new Date().toISOString();
        const next = action === "approve" ? "approved" : action === "reject" ? "rejected" : "needs_changes";
        const eventType = action === "approve" ? "approved" : action === "reject" ? "rejected" : "changes_requested";
        await run(db, "UPDATE farmer_applications SET status=?,updated_at=?,reviewed_at=?,reviewer_admin_id=?,admin_feedback=?,rejection_reason=? WHERE id=? AND status='pending'", [next, now, now, req.user.id, feedback || null, action === "reject" ? feedback : null, app.id]);
        if (action === "approve") {
          const roleUpdate = await run(db, "UPDATE users SET role='farmer',is_admin=0 WHERE id=? AND role='customer' AND status='active'", [app.user_id]);
          if (roleUpdate.changes !== 1) throw Object.assign(new Error("eligibility_changed"), { code: "ELIGIBILITY_CHANGED" });
          await run(db, "UPDATE sessions SET revoked_at=COALESCE(revoked_at,?) WHERE user_id=?", [now, app.user_id]);
          await run(db, "INSERT INTO admin_audit_logs(admin_user_id,target_user_id,action,old_value,new_value) VALUES(?,?, 'role_change','customer','farmer')", [req.user.id, app.user_id]);
        }
        await run(db, "INSERT INTO admin_audit_logs(admin_user_id,target_user_id,action,old_value,new_value) VALUES(?,?,?,?,?)", [req.user.id, app.user_id, `farmer_application_${action === "request-changes" ? "changes_requested" : action}`, app.status, next]);
        await insertEvent(db, app, { status: next, type: eventType, actor: req.user.id, role: "admin", comments: feedback || null });
        return get(db, "SELECT * FROM farmer_applications WHERE id=?", [id]);
      });
      if (result.missing) return res.status(404).json({ error: "Application not found" });
      if (result.conflict) return res.status(409).json({ error: "Application is no longer pending review" });
      if (result.self) return res.status(403).json({ error: "Administrators cannot review their own application" });
      if (result.suspended) return res.status(409).json({ error: "Suspended accounts cannot be approved" });
      return res.json({ application: result });
    } catch (error) { return res.status(error.code === "ELIGIBILITY_CHANGED" ? 409 : 500).json({ error: error.code === "ELIGIBILITY_CHANGED" ? "Applicant is no longer eligible for approval" : "Unable to review farmer application" }); }
  }
  router.post("/:id/approve", (req, res) => review(req, res, "approve"));
  router.post("/:id/request-changes", (req, res) => review(req, res, "request-changes"));
  router.post("/:id/reject", (req, res) => review(req, res, "reject"));
  return router;
}
module.exports = { createApplicantRouter, createAdminApplicationsRouter, validatePatch };
