const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  {
    spawnSync
  } = require("node:child_process");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "fs-m2-auth-"));
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "m2-test-secret-not-a-real-credential-123456";
process.env.DB_FILE = path.join(temp, "test.sqlite");
process.env.ENV_FILE = path.join(temp, "missing-env");
const db = require("../db"),
  {
    createApp
  } = require("../index"),
  {
    run,
    get
  } = require("../sqlite"),
  bcrypt = require("bcrypt"),
  secret = process.env.JWT_SECRET;
let server, base;
function jar() {
  return {
    values: {},
    header() {
      return Object.entries(this.values).map(([k, v]) => `${k}=${v}`).join("; ");
    },
    capture(h) {
      for (const m of h.matchAll(/(?:^|,\s*)([^=;,\s]+)=([^;,]*)/g)) if (m[1].startsWith("fs_")) this.values[m[1]] = m[2];
    }
  };
}
async function request(p, {
  method = "GET",
  body,
  token,
  cookies,
  headers = {},
  redirect
} = {}) {
  const h = {
    ...headers
  };
  if (body !== undefined) h["Content-Type"] = "application/json";
  if (token) h.Authorization = `Bearer ${token}`;
  if (cookies?.header()) h.Cookie = cookies.header();
  if (cookies?.values.fs_csrf) h["X-CSRF-Token"] = decodeURIComponent(cookies.values.fs_csrf);
  const response = await fetch(base + p, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect
  });
  const set = response.headers.get("set-cookie");
  if (set && cookies) cookies.capture(set);
  let data = {};
  try {
    data = await response.json();
  } catch {}
  return {
    response,
    data,
    set
  };
}
test("M2 session auth, role controls, profile, rotation, suspension, and Google unavailable behavior", async t => {
  await db.ready;
  server = createApp({
    database: db,
    secret: process.env.JWT_SECRET,
    allowedOrigins: ["http://localhost:5173"]
  }).listen(0, "127.0.0.1");
  await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(async () => {
    await new Promise(r => server.close(r));
    await db.closeAsync().catch(() => {});
    fs.rmSync(temp, {
      recursive: true,
      force: true
    });
  });
  const userCookies = jar(),
    signup = await request("/auth/signup", {
      method: "POST",
      body: {
        name: "Test Customer",
        email: "customer@example.test",
        password: "password-123",
        role: "admin"
      },
      cookies: userCookies
    });
  assert.equal(signup.response.status, 201);
  assert.equal(signup.data.user.role, "customer");
  assert.ok(signup.data.accessToken);
  assert.equal(signup.data.token, undefined);
  assert.match(signup.set, /HttpOnly/i);
  let userToken = signup.data.accessToken;
  const me = await request("/auth/me", {
    token: userToken
  });
  assert.equal(me.response.status, 200);
  assert.equal(me.data.user.role, "customer");
  assert.equal((await request("/admin/users", {
    token: userToken
  })).response.status, 403);
  assert.equal((await request("/auth/profile", {
    token: userToken,
    method: "PATCH",
    body: {
      role: "admin"
    }
  })).response.status, 400);
  const profile = await request("/auth/profile", {
    token: userToken,
    method: "PATCH",
    body: {
      name: "Updated Customer",
      phone: "555-0100"
    }
  });
  assert.equal(profile.data.user.name, "Updated Customer");
  assert.equal(profile.data.user.phone, "555-0100");
  const existing = await request("/auth/signup", {
    method: "POST",
    body: {
      name: "Admin User",
      email: "admin@example.test",
      password: "admin-password"
    }
  });
  await run(db, "UPDATE users SET role='admin',is_admin=1 WHERE id=?", [existing.data.user.id]);
  const login = await request("/auth/login", {
    method: "POST",
    body: {
      email: "admin@example.test",
      password: "admin-password"
    }
  });
  const adminToken = login.data.accessToken;
  assert.equal((await request("/admin/users", {
    token: adminToken
  })).response.status, 200);
  assert.equal((await request(`/admin/users/${signup.data.user.id}/role`, {
    method: "PATCH",
    token: adminToken,
    body: {
      role: "farmer"
    }
  })).data.user.role, "farmer");
  assert.equal((await get(db, "SELECT COUNT(*) AS count FROM admin_audit_logs WHERE action='role_change'")).count, 1);
  assert.equal((await request(`/admin/users/${existing.data.user.id}/role`, {
    method: "PATCH",
    token: adminToken,
    body: {
      role: "customer"
    }
  })).response.status, 409);
  assert.equal((await request("/profile", {
    token: userToken
  })).data.user.created_at !== null, true);
  assert.equal((await request("/auth/google/status")).data.enabled, false);
  assert.equal((await request("/auth/google/start", {
    method: "POST",
    body: {}
  })).response.status, 503);
  const oldRefresh = userCookies.values.fs_refresh,
    oldCsrf = userCookies.values.fs_csrf;
  assert.ok(oldRefresh && oldCsrf);
  const badCsrf = jar();
  badCsrf.values.fs_refresh = oldRefresh;
  badCsrf.values.fs_csrf = "forged-csrf";
  assert.equal((await request("/auth/refresh", {
    method: "POST",
    cookies: badCsrf,
    body: {}
  })).response.status, 403);
  const rotated = await request("/auth/refresh", {
    method: "POST",
    cookies: userCookies,
    body: {}
  });
  assert.equal(rotated.response.status, 200);
  userToken = rotated.data.accessToken;
  assert.notEqual(userCookies.values.fs_refresh, oldRefresh);
  const replayJar = jar();
  replayJar.values.fs_refresh = oldRefresh;
  replayJar.values.fs_csrf = oldCsrf;
  assert.equal((await request("/auth/refresh", {
    method: "POST",
    cookies: replayJar,
    body: {}
  })).response.status, 401);
  assert.equal((await request("/auth/me", {
    token: userToken
  })).response.status, 401);
  const logoutCookies = jar(),
    logoutSignup = await request("/auth/signup", {
      method: "POST",
      body: {
        name: "Logout User",
        email: "logout@example.test",
        password: "logout-password"
      },
      cookies: logoutCookies
    }),
    noCsrf = jar();
  noCsrf.values.fs_refresh = logoutCookies.values.fs_refresh;
  assert.equal((await request("/auth/logout", {
    method: "POST",
    body: {},
    cookies: noCsrf
  })).response.status, 403);
  assert.equal((await request("/auth/logout", {
    method: "POST",
    body: {},
    cookies: logoutCookies
  })).response.status, 200);
  assert.equal((await request("/auth/me", {
    token: logoutSignup.data.accessToken
  })).response.status, 401);
  const suspended = await request("/auth/signup", {
    method: "POST",
    body: {
      name: "Suspended User",
      email: "suspended@example.test",
      password: "suspended-password"
    }
  });
  assert.equal((await request(`/admin/users/${suspended.data.user.id}/status`, {
    method: "PATCH",
    token: adminToken,
    body: {
      status: "suspended"
    }
  })).response.status, 200);
  assert.equal((await request("/auth/login", {
    method: "POST",
    body: {
      email: "suspended@example.test",
      password: "suspended-password"
    }
  })).response.status, 401);
  assert.equal((await request("/auth/me", {
    token: suspended.data.accessToken
  })).response.status, 401);
  assert.equal((await request(`/admin/users/${existing.data.user.id}/status`, {
    method: "PATCH",
    token: adminToken,
    body: {
      status: "suspended"
    }
  })).response.status, 409);
});
test("server refuses to start without configured JWT secret", () => {
  const env = {
    ...process.env,
    DB_FILE: path.join(temp, "missing.sqlite"),
    ENV_FILE: path.join(temp, "absent.env")
  };
  delete env.JWT_SECRET;
  const child = spawnSync(process.execPath, [path.join(__dirname, "..", "index.js")], {
    cwd: path.join(__dirname, ".."),
    env,
    encoding: "utf8",
    timeout: 10000
  });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /JWT_SECRET/);
  assert.doesNotMatch(child.stderr, /m2-test-secret/);
});
test("Google OAuth flow validates state, nonce, verified email, linking, and first-time identity", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fs-m2-google-"));
  const gdb = db.createDatabase(path.join(root, "google.sqlite"));
  await gdb.ready;
  let options,
    payload,
    tokenMode = "valid";
  const googleClient = {
    async generateCodeVerifierAsync() {
      return {
        codeVerifier: "verifier-for-tests",
        codeChallenge: "s256-challenge"
      };
    },
    generateAuthUrl(value) {
      options = value;
      return "https://accounts.google.test/oauth";
    },
    async getToken(value) {
      assert.equal(value.codeVerifier, "verifier-for-tests");
      return {
        tokens: {
          id_token: "mock-id-token"
        }
      };
    },
    async verifyIdToken() {
      if (tokenMode === "invalid") throw new Error("mock invalid token");
      return {
        getPayload: () => payload
      };
    }
  };
  const app = createApp({
    database: gdb,
    secret,
    allowedOrigins: ["http://localhost:5173"],
    rateLimit: (req, res, next) => next(),
    googleClient
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(async () => {
    await new Promise(r => server.close(r));
    await gdb.closeAsync().catch(() => {});
    fs.rmSync(root, {
      recursive: true,
      force: true
    });
  });
  async function begin(pathname = "/auth/google/start", token) {
    const cookies = jar(),
      start = await request(pathname, {
        method: "POST",
        body: {},
        cookies,
        token
      });
    assert.equal(start.response.status, 200);
    return {
      cookies,
      state: options.state,
      nonce: options.nonce
    };
  }
  async function callback(flow, {
    state = flow.state,
    code = "mock-code",
    identity = payload
  } = {}) {
    payload = identity;
    return request(`/auth/google/callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent(code)}`, {
      cookies: flow.cookies,
      redirect: "manual"
    });
  }
  assert.equal((await request("/auth/google/status")).data.enabled, true);
  let flow = await begin();
  let result = await callback(flow, {
    state: "forged-state",
    identity: {}
  });
  assert.equal(result.response.status, 302);
  assert.match(result.response.headers.get("location"), /invalid_state/);
  flow = await begin();
  result = await callback(flow, {
    identity: {
      nonce: "wrong",
      email_verified: true,
      email: "nonce@example.test",
      sub: "sub-nonce",
      name: "Nonce"
    }
  });
  assert.match(result.response.headers.get("location"), /identity_verification_failed/);
  flow = await begin();
  result = await callback(flow, {
    identity: {
      nonce: flow.nonce,
      email_verified: false,
      email: "unverified@example.test",
      sub: "sub-unverified",
      name: "Unverified"
    }
  });
  assert.match(result.response.headers.get("location"), /identity_verification_failed/);
  flow = await begin();
  tokenMode = "invalid";
  result = await callback(flow, {
    identity: {
      nonce: flow.nonce,
      email_verified: true,
      email: "invalid@example.test",
      sub: "sub-invalid",
      name: "Invalid"
    }
  });
  assert.match(result.response.headers.get("location"), /google_signin_failed/);
  tokenMode = "valid";
  flow = await begin();
  result = await callback(flow, {
    identity: {
      nonce: flow.nonce,
      email_verified: true,
      email: "google@example.test",
      sub: "google-sub-1",
      name: "Google User"
    }
  });
  assert.match(result.response.headers.get("location"), /google=success/);
  const created = await get(gdb, "SELECT id,role,status,google_sub,password_hash FROM users WHERE google_sub=?", ["google-sub-1"]);
  assert.equal(created.role, "customer");
  assert.equal(created.status, "active");
  assert.equal(created.password_hash, null);
  const googleSession = await request("/auth/refresh", {
    method: "POST",
    body: {},
    cookies: flow.cookies
  });
  assert.equal(googleSession.response.status, 200);
  assert.equal((await request("/auth/google/link", {
    method: "DELETE",
    token: googleSession.data.accessToken
  })).response.status, 409);
  assert.equal((await request("/auth/password", {
    method: "POST",
    token: googleSession.data.accessToken,
    body: {
      newPassword: "google-password"
    }
  })).response.status, 200);
  assert.equal((await request("/auth/google/link", {
    method: "DELETE",
    token: googleSession.data.accessToken
  })).response.status, 200);
  assert.equal((await request("/auth/login", {
    method: "POST",
    body: {
      email: "google@example.test",
      password: "google-password"
    }
  })).response.status, 200);
  const owner = await request("/auth/signup", {
    method: "POST",
    body: {
      name: "Link Owner",
      email: "owner@example.test",
      password: "owner-password"
    }
  });
  const link = await begin("/auth/google/link/start", owner.data.accessToken);
  result = await callback(link, {
    identity: {
      nonce: link.nonce,
      email_verified: true,
      email: "owner-google@example.test",
      sub: "google-sub-owner",
      name: "Owner Google"
    }
  });
  assert.match(result.response.headers.get("location"), /linked=1/);
  assert.equal((await get(gdb, "SELECT google_sub FROM users WHERE email='owner@example.test'")).google_sub, "google-sub-owner");
  const other = await request("/auth/signup", {
    method: "POST",
    body: {
      name: "Other Owner",
      email: "other-owner@example.test",
      password: "other-password"
    }
  });
  const collision = await begin("/auth/google/link/start", other.data.accessToken);
  result = await callback(collision, {
    identity: {
      nonce: collision.nonce,
      email_verified: true,
      email: "someone@example.test",
      sub: "google-sub-owner",
      name: "Collision"
    }
  });
  assert.match(result.response.headers.get("location"), /account_already_linked/);
  const existing = await request("/auth/signup", {
      method: "POST",
      body: {
        name: "Email Owner",
        email: "existing@example.test",
        password: "preserve-this-password"
      }
    }),
    before = await get(gdb, "SELECT password_hash FROM users WHERE email='existing@example.test'");
  const duplicateEmail = await begin();
  result = await callback(duplicateEmail, {
    identity: {
      nonce: duplicateEmail.nonce,
      email_verified: true,
      email: "existing@example.test",
      sub: "new-google-sub",
      name: "Existing Email"
    }
  });
  assert.match(result.response.headers.get("location"), /link_from_account_settings/);
  assert.equal((await get(gdb, "SELECT password_hash FROM users WHERE email='existing@example.test'")).password_hash, before.password_hash);
  assert.ok(existing.data.user.id);
});
