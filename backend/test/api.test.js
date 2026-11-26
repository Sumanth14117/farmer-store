const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "farmer-store-api-test-"));
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-secret-which-is-not-a-real-key-123456";
process.env.DB_FILE = path.join(tempRoot, "api.sqlite");
process.env.ENV_FILE = path.join(tempRoot, "no-env-file");
const db = require("../db");
const { createApp } = require("../index");
const { run, get } = require("../sqlite");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const secret = process.env.JWT_SECRET;
const address = { name: "Test Customer", phone: "+91 98765 43210", street: "12 Test Road", city: "Mysuru", pincode: "570001" };
let server;
let base;
let userToken;
let adminToken;
let userId;
let adminId;
let productId;

async function request(pathname, { token, method = "GET", body, headers = {}, origin } = {}) {
  const requestHeaders = { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (origin) requestHeaders.Origin = origin;
  const response = await fetch(`${base}${pathname}`, { method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body) });
  return { response, data: await response.json() };
}

test("auth, authorization, product, checkout, ownership, and review API integration", async (t) => {
  await db.ready;
  const app = createApp({ database: db, secret, allowedOrigins: ["http://localhost:5173"] });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.closeAsync().catch(() => {});
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const noName = await request("/auth/signup", { method: "POST", body: { email: "missing@example.test", password: "password-123" } });
  assert.equal(noName.response.status, 400);
  const signup = await request("/auth/signup", { method: "POST", body: { name: "Test Customer", email: "customer@example.test", password: "password-123" } });
  assert.equal(signup.response.status, 201);
  userToken = signup.data.accessToken; userId = signup.data.user.id;
  const duplicate = await request("/auth/signup", { method: "POST", body: { name: "Other Customer", email: "CUSTOMER@example.test", password: "password-123" } });
  assert.equal(duplicate.response.status, 409);
  const login = await request("/auth/login", { method: "POST", body: { email: "customer@example.test", password: "password-123" } });
  assert.equal(login.response.status, 200);
  assert.equal(login.data.user.id, userId);
  assert.equal((await request("/auth/login", { method: "POST", body: { email: "customer@example.test", password: "wrong-password" } })).response.status, 401);
  assert.equal((await request("/orders")).response.status, 401);
  assert.equal((await request("/orders", { token: "not-a-bearer-token" })).response.status, 401);
  const expired = jwt.sign({ sub: String(userId) }, secret, { algorithm: "HS256", expiresIn: -1 });
  assert.equal((await request("/orders", { token: expired })).response.status, 401);
  const me = await request("/auth/me", { token: userToken });
  assert.equal(me.response.status, 200);
  assert.equal(me.data.user.role, "customer");

  assert.equal((await request("/admin/stats", { token: userToken })).response.status, 403);
  assert.equal((await request("/products", { method: "POST", token: userToken, body: { name: "Blocked Product", price: 10 } })).response.status, 403);
  const adminHash = await bcrypt.hash("test-admin-password", 4);
  const adminInsert = await run(db, "INSERT INTO users(name,email,password,password_hash,is_admin,role,status) VALUES(?,?,?,?,1,'admin','active')", ["Test Admin", "admin@example.test", adminHash, adminHash]);
  adminId = adminInsert.lastID;
  adminToken = (await request("/auth/login", { method: "POST", body: { email: "admin@example.test", password: "test-admin-password" } })).data.accessToken;
  const adminProduct = await request("/products", { method: "POST", token: adminToken, body: { name: "Test Apples", description: "Integration fixture", price: 55.5, location: "Test farm", image: "apple.jpg" } });
  assert.equal(adminProduct.response.status, 201);
  productId = adminProduct.data.product.id;
  assert.equal((await request("/admin/stats", { token: adminToken })).response.status, 200);
  const catalogue = await request("/products");
  assert.ok(catalogue.data.some((product) => product.id === productId));
  assert.equal((await request("/products/invalid")).response.status, 400);

  const missingAddress = await request("/orders", { method: "POST", token: userToken, body: { items: [{ productId, quantity: 1 }] } });
  assert.equal(missingAddress.response.status, 400);
  const badProduct = await request("/orders", { method: "POST", token: userToken, body: { items: [{ productId: 999999, quantity: 1 }], address } });
  assert.equal(badProduct.response.status, 400);
  for (const quantity of [0, -1]) assert.equal((await request("/orders", { method: "POST", token: userToken, body: { items: [{ productId, quantity }], address } })).response.status, 400);
  const orderBody = { items: [{ productId, quantity: 2, price: 0.01 }], total: 0.01, address };
  const placed = await request("/orders", { method: "POST", token: userToken, headers: { "Idempotency-Key": "test-order-key-0001" }, body: orderBody });
  assert.equal(placed.response.status, 201);
  assert.equal(placed.data.order.total, 111);
  assert.equal(placed.data.order.address.city, address.city);
  assert.equal(placed.data.order.items[0].price, 55.5);
  const replay = await request("/orders", { method: "POST", token: userToken, headers: { "Idempotency-Key": "test-order-key-0001" }, body: orderBody });
  assert.equal(replay.response.status, 200);
  assert.equal(replay.data.replayed, true);
  assert.equal(replay.data.order.id, placed.data.order.id);
  const history = await request("/orders", { token: userToken });
  assert.equal(history.data.orders.length, 1);
  const secondSignup = await request("/auth/signup", { method: "POST", body: { name: "Second Customer", email: "second@example.test", password: "password-456" } });
  assert.equal((await request(`/orders/${placed.data.order.id}`, { token: secondSignup.data.accessToken })).response.status, 404);
  assert.equal((await request("/orders", { token: secondSignup.data.accessToken })).data.orders.length, 0);

  assert.equal((await request(`/products/${productId}/reviews`, { token: userToken, method: "POST", body: { rating: 9, review: "Too high" } })).response.status, 400);
  assert.equal((await request("/products/999999/reviews", { token: userToken, method: "POST", body: { rating: 5, review: "Unknown item" } })).response.status, 404);
  const review = await request(`/products/${productId}/reviews`, { token: userToken, method: "POST", body: { rating: 5, review: "Excellent quality" } });
  assert.equal(review.response.status, 201);
  const reviews = await request(`/products/${productId}/reviews`);
  assert.equal(reviews.data.reviews.length, 1);
  assert.equal((await request(`/products/${productId}/reviews`, { token: userToken, method: "POST", body: { rating: 4, review: "Another review" } })).response.status, 409);
  const deniedOrigin = await request("/products", { origin: "https://not-allowed.example" });
  assert.equal(deniedOrigin.response.status, 403);
});

test("startup refuses to run without JWT_SECRET", () => {
  const env = { ...process.env, DB_FILE: path.join(tempRoot, "missing-secret.sqlite"), ENV_FILE: path.join(tempRoot, "absent-env") };
  delete env.JWT_SECRET;
  const child = spawnSync(process.execPath, [path.join(__dirname, "..", "index.js")], { cwd: path.join(__dirname, ".."), env, encoding: "utf8", timeout: 10000 });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /JWT_SECRET/);
  assert.doesNotMatch(child.stderr, /test-only-secret/);
});
