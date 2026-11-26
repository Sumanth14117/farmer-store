const path = require("node:path");
const sqlite3 = require("sqlite3").verbose();

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) reject(error);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}
function all(db, sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}

async function migrateDatabase(db) {
  await run(db, "PRAGMA foreign_keys = ON");
  await run(db, "PRAGMA busy_timeout = 5000");
  await run(db, "BEGIN IMMEDIATE");
  try {
    await run(db, `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const applied = await all(db, "SELECT version FROM schema_migrations");
    const versions = new Set(applied.map((row) => Number(row.version)));

    if (!versions.has(1)) {
      await run(db, `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
        is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      await run(db, `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
        price REAL NOT NULL CHECK (price > 0), image TEXT, location TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      await run(db, `CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), items TEXT NOT NULL,
        total REAL NOT NULL CHECK (total >= 0), status TEXT NOT NULL DEFAULT 'Placed', address TEXT NOT NULL DEFAULT '{}',
        idempotency_key TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      await run(db, `CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
        product_id INTEGER REFERENCES products(id), product_name TEXT NOT NULL DEFAULT '',
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5), review TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      const userColumns = new Set((await all(db, "PRAGMA table_info(users)")).map((row) => row.name));
      if (!userColumns.has("is_admin")) await run(db, "ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1))");
      const orderColumns = new Set((await all(db, "PRAGMA table_info(orders)")).map((row) => row.name));
      if (!orderColumns.has("address")) await run(db, "ALTER TABLE orders ADD COLUMN address TEXT NOT NULL DEFAULT '{}'");
      if (!orderColumns.has("idempotency_key")) await run(db, "ALTER TABLE orders ADD COLUMN idempotency_key TEXT");
      const reviewColumns = new Set((await all(db, "PRAGMA table_info(reviews)")).map((row) => row.name));
      if (!reviewColumns.has("product_id")) await run(db, "ALTER TABLE reviews ADD COLUMN product_id INTEGER");
      await run(db, `UPDATE reviews SET product_id = (
        SELECT p.id FROM products p WHERE lower(trim(p.name)) = lower(trim(reviews.product_name)) ORDER BY p.id LIMIT 1
      ) WHERE product_id IS NULL`);
      await run(db, "CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC)");
      await run(db, "CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)");
      await run(db, "CREATE INDEX IF NOT EXISTS idx_reviews_product_created ON reviews(product_id, created_at DESC)");
      await run(db, "CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL");
      await run(db, "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_nocase ON users(email COLLATE NOCASE)");
      await run(db, "INSERT INTO schema_migrations(version, name) VALUES(1, 'reconcile-marketplace-baseline')");
    }

    if (!versions.has(2)) {
      const userColumns = new Set((await all(db, "PRAGMA table_info(users)")).map((row) => row.name));
      const additions = [
        ["password_hash", "TEXT"],
        ["role", "TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','farmer','admin','delivery_partner'))"],
        ["status", "TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended'))"],
        ["google_sub", "TEXT"],
        ["phone", "TEXT"],
        ["profile_image_url", "TEXT"],
      ];
      for (const [name, definition] of additions) {
        if (!userColumns.has(name)) await run(db, `ALTER TABLE users ADD COLUMN ${name} ${definition}`);
      }
      await run(db, "UPDATE users SET password_hash = password WHERE password_hash IS NULL AND password IS NOT NULL");
      await run(db, "UPDATE users SET role = CASE WHEN is_admin = 1 THEN 'admin' ELSE 'customer' END");
      await run(db, "UPDATE users SET status = 'active' WHERE status IS NULL OR status = ''");
      await run(db, "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL");
      await run(db, "CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status)");
      await run(db, `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        refresh_token_hash TEXT NOT NULL UNIQUE,
        csrf_token TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        user_agent TEXT
      )`);
      await run(db, `CREATE TABLE IF NOT EXISTS session_refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT
      )`);
      await run(db, "CREATE INDEX IF NOT EXISTS idx_sessions_user_revoked ON sessions(user_id, revoked_at)");
      await run(db, "CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session ON session_refresh_tokens(session_id, used_at)");
      await run(db, `CREATE TABLE IF NOT EXISTS oauth_flows (
        state_hash TEXT PRIMARY KEY,
        nonce_hash TEXT NOT NULL,
        code_verifier_ciphertext TEXT NOT NULL,
        intent TEXT NOT NULL CHECK (intent IN ('login','link')),
        user_id INTEGER REFERENCES users(id),
        session_id TEXT REFERENCES sessions(id),
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )`);
      await run(db, "CREATE INDEX IF NOT EXISTS idx_oauth_flows_expiry ON oauth_flows(expires_at)");
      await run(db, `CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_user_id INTEGER NOT NULL REFERENCES users(id),
        target_user_id INTEGER NOT NULL REFERENCES users(id),
        action TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      await run(db, "CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC)");
      await run(db, "INSERT INTO schema_migrations(version, name) VALUES(2, 'roles-profiles-google-and-server-sessions')");
    }

    if (!versions.has(3)) {
      await run(db, `CREATE TABLE IF NOT EXISTS farmer_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
        farm_name TEXT NOT NULL DEFAULT '',
        full_name TEXT NOT NULL DEFAULT '',
        contact_phone TEXT NOT NULL DEFAULT '',
        contact_email TEXT,
        farm_description TEXT NOT NULL DEFAULT '',
        farm_address TEXT NOT NULL DEFAULT '',
        state TEXT NOT NULL DEFAULT '',
        district TEXT NOT NULL DEFAULT '',
        city_village TEXT NOT NULL DEFAULT '',
        pincode TEXT NOT NULL DEFAULT '',
        latitude REAL CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
        longitude REAL CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
        farming_type TEXT CHECK (farming_type IS NULL OR farming_type IN ('individual_farmer','family_owned_farm','farmer_group','agricultural_business')),
        primary_crops TEXT NOT NULL DEFAULT '',
        additional_crop_info TEXT NOT NULL DEFAULT '',
        farm_size REAL CHECK (farm_size IS NULL OR farm_size > 0),
        farm_size_unit TEXT CHECK (farm_size_unit IS NULL OR farm_size_unit IN ('acre','hectare')),
        years_experience INTEGER CHECK (years_experience IS NULL OR years_experience BETWEEN 0 AND 100),
        farming_practices TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','needs_changes','approved','rejected')),
        submitted_at TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TEXT,
        reviewer_admin_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
        admin_feedback TEXT,
        rejection_reason TEXT,
        CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)),
        CHECK (farm_size IS NULL OR farm_size_unit IS NOT NULL)
      )`);
      await run(db, `CREATE TABLE IF NOT EXISTS farmer_application_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER NOT NULL REFERENCES farmer_applications(id) ON DELETE RESTRICT,
        revision INTEGER NOT NULL CHECK (revision >= 1),
        from_status TEXT CHECK (from_status IS NULL OR from_status IN ('draft','pending','needs_changes','approved','rejected')),
        to_status TEXT NOT NULL CHECK (to_status IN ('draft','pending','needs_changes','approved','rejected')),
        event_type TEXT NOT NULL CHECK (event_type IN ('created','saved','submitted','reopened','approved','changes_requested','rejected')),
        actor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        actor_role TEXT NOT NULL CHECK (actor_role IN ('customer','farmer','admin','delivery_partner')),
        comments TEXT,
        application_snapshot_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      await run(db, "CREATE INDEX IF NOT EXISTS idx_farmer_applications_status_updated ON farmer_applications(status, updated_at DESC)");
      await run(db, "CREATE INDEX IF NOT EXISTS idx_farmer_applications_location ON farmer_applications(state, district, city_village)");
      await run(db, "CREATE INDEX IF NOT EXISTS idx_farmer_application_events_app_created ON farmer_application_events(application_id, created_at DESC, id DESC)");
      await run(db, `CREATE TRIGGER IF NOT EXISTS farmer_application_events_no_update
        BEFORE UPDATE ON farmer_application_events BEGIN
          SELECT RAISE(ABORT, 'farmer application history is immutable');
        END`);
      await run(db, `CREATE TRIGGER IF NOT EXISTS farmer_application_events_no_delete
        BEFORE DELETE ON farmer_application_events BEGIN
          SELECT RAISE(ABORT, 'farmer application history is immutable');
        END`);
      await run(db, "INSERT INTO schema_migrations(version, name) VALUES(3, 'farmer-onboarding-and-verification')");
    }

    await run(db, "COMMIT");
  } catch (error) {
    await run(db, "ROLLBACK").catch(() => {});
    throw error;
  }
}

function createDatabase(filePath = process.env.DB_FILE || path.join(__dirname, "db.sqlite")) {
  const resolved = filePath === ":memory:" ? filePath : path.isAbsolute(filePath) ? filePath : path.resolve(__dirname, filePath);
  const db = new sqlite3.Database(resolved);
  db.configure("busyTimeout", 5000);
  db.ready = migrateDatabase(db);
  db.filePath = resolved;
  db.closeAsync = () => new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve()));
  return db;
}
const database = createDatabase();
database.runAsync = run;
database.allAsync = all;
database.createDatabase = createDatabase;
database.migrateDatabase = migrateDatabase;
module.exports = database;
