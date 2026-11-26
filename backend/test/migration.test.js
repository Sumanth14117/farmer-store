const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "farmer-store-migration-test-"));
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-secret-which-is-not-a-real-key-123456";
process.env.DB_FILE = path.join(tempRoot, "test-default.sqlite");
const database = require("../db");
const { createDatabase } = database;
const { all, get } = require("../sqlite");
const backupPath = process.env.M3_BACKUP_DB || process.env.M1_BACKUP_DB;

async function snapshot(db) {
  const tables = {
    users: "id, name, email, password, created_at, is_admin",
    products: "id, name, description, price, image, location, created_at",
    orders: "id, user_id, items, total, status, created_at",
    reviews: "id, user_id, product_name, rating, review, created_at",
  };
  const data = {};
  for (const [table, columns] of Object.entries(tables)) data[table] = await all(db, `SELECT ${columns} FROM ${table} ORDER BY id`);
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

test("fresh database schema and existing backup migration are repeatable and preserve records", async (t) => {
  await database.ready;
  const freshPath = path.join(tempRoot, "fresh.sqlite");
  const fresh = createDatabase(freshPath);
  await fresh.ready;
  const freshUsers = await all(fresh, "PRAGMA table_info(users)");
  const freshOrders = await all(fresh, "PRAGMA table_info(orders)");
  assert.ok(freshUsers.some((column) => column.name === "is_admin"));
  assert.ok(freshUsers.some((column) => column.name === "role"));
  assert.ok(freshUsers.some((column) => column.name === "password_hash"));
  assert.equal((await get(fresh, "SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 2")).count, 1);
  assert.equal((await get(fresh, "SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 3")).count, 1);
  assert.ok((await all(fresh, "PRAGMA table_info(farmer_applications)")).some(column => column.name === "reviewer_admin_id"));
  assert.ok((await all(fresh, "PRAGMA table_info(farmer_application_events)")).some(column => column.name === "event_type"));
  assert.ok(freshOrders.some((column) => column.name === "address"));
  assert.equal((await get(fresh, "PRAGMA integrity_check")).integrity_check, "ok");
  await fresh.closeAsync();

  assert.ok(backupPath && fs.existsSync(backupPath), "Verified M3/M1 backup path is required for existing-database migration test");
  const legacyPath = path.join(tempRoot, "existing-copy.sqlite");
  fs.copyFileSync(backupPath, legacyPath);
  const legacy = createDatabase(legacyPath);
  await legacy.ready;
  const preservedBeforeRepeat = await snapshot(legacy);
  const counts = {};
  for (const table of ["users", "products", "orders", "reviews"]) counts[table] = (await get(legacy, `SELECT COUNT(*) AS count FROM ${table}`)).count;
  await database.migrateDatabase(legacy);
  assert.equal(await snapshot(legacy), preservedBeforeRepeat, "legacy fields and values must remain unchanged by the repeated migration");
  for (const table of Object.keys(counts)) assert.equal((await get(legacy, `SELECT COUNT(*) AS count FROM ${table}`)).count, counts[table]);
  assert.ok((await all(legacy, "PRAGMA table_info(orders)")).some((column) => column.name === "address"));
  assert.ok((await all(legacy, "PRAGMA table_info(reviews)")).some((column) => column.name === "product_id"));
  assert.ok((await all(legacy, "PRAGMA table_info(users)")).some((column) => column.name === "role"));
  assert.equal((await get(legacy, "SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 2")).count, 1);
  assert.equal((await get(legacy, "SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 3")).count, 1);
  assert.equal((await get(legacy, "SELECT COUNT(*) AS count FROM farmer_applications")).count, 0);
  assert.equal((await all(legacy, "PRAGMA foreign_key_check")).length, 0);
  assert.equal((await get(legacy, "SELECT COUNT(*) AS count FROM users WHERE is_admin = 1 AND role <> 'admin'")).count, 0);
  assert.equal((await get(legacy, "SELECT COUNT(*) AS count FROM users WHERE is_admin = 0 AND role <> 'customer'")).count, 0);
  assert.equal((await get(legacy, "PRAGMA integrity_check")).integrity_check, "ok");
  assert.equal((await get(legacy, "SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 1")).count, 1);
  await legacy.closeAsync();
  t.after(async () => {
    await database.closeAsync().catch(() => {});
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
});
