const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "farmer-store-m3-api-"));
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "m3-tests-use-a-random-isolated-key-123456789";
process.env.DB_FILE = path.join(root, "api.sqlite");
process.env.ENV_FILE = path.join(root, "not-present.env");
const db = require("../db");
const { createApp } = require("../index");
const { get, run } = require("../sqlite");
let server;
let base;
async function request(pathname, { token, method = "GET", body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${base}${pathname}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { response, data: await response.json() };
}
async function signup(name, email, password) {
  const result = await request("/auth/signup", { method: "POST", body: { name, email, password } });
  assert.equal(result.response.status, 201);
  return result.data;
}
async function login(email, password) {
  const result = await request("/auth/login", { method: "POST", body: { email, password } });
  assert.equal(result.response.status, 200);
  return result.data;
}
const validApplication = {
  farm_name: "Green Valley Farm", full_name: "Test Applicant", contact_phone: "+91 98765 43210",
  farm_description: "A small mixed crop farm", farm_address: "12 Example Road", state: "Karnataka",
  district: "Mysuru", city_village: "Nanjangud", pincode: "570001", latitude: 12.12, longitude: 76.68,
  farming_type: "individual_farmer", primary_crops: "Rice, vegetables", additional_crop_info: "Seasonal beans",
  farm_size: 2.5, farm_size_unit: "acre", years_experience: 8, farming_practices: "Crop rotation and composting"
};

test("M3 farmer application, review, role and session workflow is protected and transactional", async (t) => {
  await db.ready;
  const app = createApp({ database: db, secret: process.env.JWT_SECRET, allowedOrigins: ["http://localhost:5173"] });
  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await db.closeAsync().catch(() => {}); fs.rmSync(root, { recursive: true, force: true }); });

  const customer = await signup("Test Applicant", "m3-customer@example.test", "test-password-123");
  const second = await signup("Second Applicant", "m3-second@example.test", "test-password-456");
  const delivery = await signup("Test Delivery", "m3-delivery@example.test", "test-password-delivery");
  const admin = await signup("Test Admin", "m3-admin@example.test", "test-password-789");
  const secondAdmin = await signup("Second Admin", "m3-admin2@example.test", "test-password-987");
  await run(db, "UPDATE users SET role='admin',is_admin=1 WHERE id IN (?,?)", [admin.user.id, secondAdmin.user.id]);
  await run(db, "UPDATE users SET role='delivery_partner' WHERE id=?", [delivery.user.id]);
  const deliveryLogin = await login("m3-delivery@example.test", "test-password-delivery");
  const adminLogin = await login("m3-admin@example.test", "test-password-789");
  const otherAdminLogin = await login("m3-admin2@example.test", "test-password-987");

  assert.equal((await request("/farmer-applications/me")).response.status, 401);
  assert.equal((await request("/farmer-applications/me", { token: customer.accessToken })).data.application, null);
  assert.equal((await request("/admin/farmer-applications", { token: customer.accessToken })).response.status, 403);
  assert.equal((await request("/admin/farmer-applications", { token: second.accessToken })).response.status, 403);
  assert.equal((await request("/admin/farmer-applications", { token: deliveryLogin.accessToken })).response.status, 403);
  assert.equal((await request("/farmer-applications", { token: deliveryLogin.accessToken, method: "POST", body: {} })).response.status, 403);
  assert.equal((await request("/admin/farmer-applications", { token: adminLogin.accessToken })).response.status, 200);
  assert.equal((await request("/admin/farmer-applications?status=unknown", { token: adminLogin.accessToken })).response.status, 400);
  assert.equal((await request("/admin/farmer-applications?limit=1.5", { token: adminLogin.accessToken })).response.status, 400);

  const draft = await request("/farmer-applications", { token: customer.accessToken, method: "POST", body: {} });
  assert.equal(draft.response.status, 201);
  assert.equal(draft.data.application.status, "draft");
  assert.equal((await get(db, "SELECT role FROM users WHERE id=?", [customer.user.id])).role, "customer");
  assert.equal((await request("/farmer-applications/me/submit", { token: customer.accessToken, method: "POST", body: {} })).response.status, 400);
  assert.equal((await request("/farmer-applications/me", { token: second.accessToken, method: "PATCH", body: validApplication })).response.status, 404);
  assert.equal((await request("/farmer-applications/me", { token: customer.accessToken, method: "PATCH", body: { role: "farmer" } })).response.status, 400);
  assert.equal((await request("/farmer-applications", { token: customer.accessToken, method: "POST", body: {} })).response.status, 409);

  assert.equal((await request("/farmer-applications/me", { token: customer.accessToken, method: "PATCH", body: { ...validApplication, pincode: "57000X" } })).response.status, 400);
  assert.equal((await request("/farmer-applications/me", { token: customer.accessToken, method: "PATCH", body: validApplication })).response.status, 200);
  const submitted = await request("/farmer-applications/me/submit", { token: customer.accessToken, method: "POST", body: {} });
  assert.equal(submitted.response.status, 200);
  assert.equal(submitted.data.application.status, "pending");
  assert.equal(submitted.data.application.contact_email, "m3-customer@example.test");
  const submittedEvent = await get(db, "SELECT application_snapshot_json FROM farmer_application_events WHERE application_id=? AND event_type='submitted' ORDER BY id DESC LIMIT 1", [submitted.data.application.id]);
  assert.equal(JSON.parse(submittedEvent.application_snapshot_json).farm_name, "Green Valley Farm");
  assert.equal((await get(db, "SELECT role FROM users WHERE id=?", [customer.user.id])).role, "customer");
  assert.equal((await request("/farmer-applications/me/submit", { token: customer.accessToken, method: "POST", body: {} })).response.status, 409);
  const listed = await request("/admin/farmer-applications?status=pending&q=Green", { token: adminLogin.accessToken });
  assert.equal(listed.response.status, 200);
  assert.equal(listed.data.applications.length, 1);
  const detail = await request(`/admin/farmer-applications/${submitted.data.application.id}`, { token: adminLogin.accessToken });
  assert.equal(detail.response.status, 200);
  assert.equal(detail.data.application.full_name, "Test Applicant");

  assert.equal((await request(`/admin/farmer-applications/${detail.data.application.id}/request-changes`, { token: adminLogin.accessToken, method: "POST", body: { feedback: "" } })).response.status, 400);
  const changes = await request(`/admin/farmer-applications/${detail.data.application.id}/request-changes`, { token: adminLogin.accessToken, method: "POST", body: { feedback: "Please add a clearer crop summary." } });
  assert.equal(changes.response.status, 200);
  assert.equal(changes.data.application.status, "needs_changes");
  assert.equal((await get(db, "SELECT role FROM users WHERE id=?", [customer.user.id])).role, "customer");
  assert.equal((await request("/farmer-applications/me", { token: customer.accessToken })).data.application.admin_feedback, "Please add a clearer crop summary.");
  assert.equal((await request("/farmer-applications/me", { token: customer.accessToken, method: "PATCH", body: { primary_crops: "Rice, vegetables, lentils" } })).response.status, 200);
  assert.equal((await request("/farmer-applications/me/submit", { token: customer.accessToken, method: "POST", body: {} })).response.status, 200);

  const rejection = await request(`/admin/farmer-applications/${detail.data.application.id}/reject`, { token: adminLogin.accessToken, method: "POST", body: { feedback: "Please provide more detail about your farm practices." } });
  assert.equal(rejection.response.status, 200);
  assert.equal(rejection.data.application.status, "rejected");
  assert.equal(rejection.data.application.rejection_reason, "Please provide more detail about your farm practices.");
  assert.equal((await get(db, "SELECT role FROM users WHERE id=?", [customer.user.id])).role, "customer");
  const reopened = await request("/farmer-applications", { token: customer.accessToken, method: "POST", body: {} });
  assert.equal(reopened.response.status, 201);
  assert.equal(reopened.data.application.revision, 2);
  assert.equal(reopened.data.application.primary_crops, "Rice, vegetables, lentils");
  const oldRevision = await get(db, "SELECT application_snapshot_json FROM farmer_application_events WHERE application_id=? AND revision=1 AND event_type='submitted' ORDER BY id ASC LIMIT 1", [detail.data.application.id]);
  assert.equal(JSON.parse(oldRevision.application_snapshot_json).primary_crops, "Rice, vegetables");
  assert.equal((await request("/farmer-applications/me", { token: customer.accessToken })).data.application.events.filter(event => event.event_type === "rejected").length, 1);
  assert.equal((await request("/farmer-applications/me", { token: customer.accessToken, method: "PATCH", body: validApplication })).response.status, 200);
  const pendingAgain = await request("/farmer-applications/me/submit", { token: customer.accessToken, method: "POST", body: {} });
  assert.equal(pendingAgain.response.status, 200);

  await run(db, "CREATE TRIGGER m3_test_abort_approval BEFORE INSERT ON admin_audit_logs WHEN NEW.action='role_change' BEGIN SELECT RAISE(ABORT,'test rollback'); END");
  const rollback = await request(`/admin/farmer-applications/${detail.data.application.id}/approve`, { token: adminLogin.accessToken, method: "POST", body: {} });
  assert.equal(rollback.response.status, 500);
  assert.equal((await get(db, "SELECT role FROM users WHERE id=?", [customer.user.id])).role, "customer");
  assert.equal((await get(db, "SELECT status FROM farmer_applications WHERE id=?", [detail.data.application.id])).status, "pending");
  await run(db, "DROP TRIGGER m3_test_abort_approval");

  const [approvalA, approvalB] = await Promise.all([
    request(`/admin/farmer-applications/${detail.data.application.id}/approve`, { token: adminLogin.accessToken, method: "POST", body: {} }),
    request(`/admin/farmer-applications/${detail.data.application.id}/approve`, { token: otherAdminLogin.accessToken, method: "POST", body: {} })
  ]);
  assert.deepEqual([approvalA.response.status, approvalB.response.status].sort(), [200, 409]);
  assert.equal((await get(db, "SELECT role FROM users WHERE id=?", [customer.user.id])).role, "farmer");
  assert.equal((await get(db, "SELECT COUNT(*) AS count FROM admin_audit_logs WHERE target_user_id=? AND action='role_change'", [customer.user.id])).count, 1);
  assert.equal((await request("/farmer-applications/me", { token: customer.accessToken })).response.status, 401);
  const farmerLogin = await login("m3-customer@example.test", "test-password-123");
  assert.equal(farmerLogin.user.role, "farmer");
  assert.equal((await request("/farmer-applications/me", { token: farmerLogin.accessToken })).data.application.status, "approved");
  assert.equal((await request("/admin/farmer-applications", { token: farmerLogin.accessToken })).response.status, 403);
  assert.equal((await request("/farmer-applications/me", { token: farmerLogin.accessToken, method: "PATCH", body: validApplication })).response.status, 409);
  const eventCount = await get(db, "SELECT COUNT(*) AS count FROM farmer_application_events WHERE application_id=?", [detail.data.application.id]);
  assert.ok(eventCount.count >= 8);
  await assert.rejects(run(db, "UPDATE farmer_application_events SET comments='tampered' WHERE application_id=?", [detail.data.application.id]));

  const suspended = await signup("Suspended Applicant", "m3-suspended@example.test", "test-password-555");
  const suspendedDraft = await request("/farmer-applications", { token: suspended.accessToken, method: "POST", body: validApplication });
  assert.equal(suspendedDraft.response.status, 201);
  assert.equal((await request("/farmer-applications/me/submit", { token: suspended.accessToken, method: "POST", body: {} })).response.status, 200);
  const suspendedApp = suspendedDraft.data.application;
  await run(db, "UPDATE users SET status='suspended' WHERE id=?", [suspended.user.id]);
  const suspendedReview = await request(`/admin/farmer-applications/${suspendedApp.id}/approve`, { token: adminLogin.accessToken, method: "POST", body: {} });
  assert.equal(suspendedReview.response.status, 409);
  assert.equal((await get(db, "SELECT role FROM users WHERE id=?", [suspended.user.id])).role, "customer");

  const self = await run(db, "INSERT INTO farmer_applications(user_id,full_name,status,submitted_at) VALUES(?, 'Admin Applicant', 'pending',CURRENT_TIMESTAMP)", [admin.user.id]);
  assert.equal((await request(`/admin/farmer-applications/${self.lastID}/approve`, { token: adminLogin.accessToken, method: "POST", body: {} })).response.status, 403);
});
