const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const config = require("./config");
const {
  run,
  get,
  transaction
} = require("./sqlite");
const cookieName = "fs_refresh";
const csrfCookie = "fs_csrf";
const random = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: "/api/auth",
    ...(config.cookieDomain ? {
      domain: config.cookieDomain
    } : {}),
    ...(maxAge ? {
      maxAge
    } : {})
  };
}
function setRefreshCookie(res, token) {
  res.cookie(cookieName, token, cookieOptions(config.refreshTokenLifetimeMs));
}
function clearRefreshCookie(res) {
  res.clearCookie(cookieName, cookieOptions());
}
function setCsrfCookie(res, value) {
  res.cookie(csrfCookie, value, {
    ...cookieOptions(),
    httpOnly: false
  });
}
function issueAccess(user, sessionId, secret) {
  return jwt.sign({
    sub: String(user.id),
    sid: sessionId
  }, secret, {
    algorithm: "HS256",
    expiresIn: config.accessTokenTtl,
    issuer: "farmer-store",
    audience: "farmer-store-api"
  });
}
async function makeSession(db, user, req, res, secret) {
  const now = new Date();
  const expires = new Date(now.getTime() + config.refreshTokenLifetimeMs).toISOString();
  const sid = random(24),
    refresh = random(),
    csrf = random();
  await transaction(db, async () => {
    await run(db, "INSERT INTO sessions(id,user_id,refresh_token_hash,csrf_token,created_at,last_used_at,expires_at,user_agent) VALUES(?,?,?,?,?,?,?,?)", [sid, user.id, hash(refresh), csrf, now.toISOString(), now.toISOString(), expires, String(req.get("user-agent") || "").slice(0, 500)]);
    await run(db, "INSERT INTO session_refresh_tokens(session_id,token_hash,created_at,expires_at) VALUES(?,?,?,?)", [sid, hash(refresh), now.toISOString(), expires]);
  });
  setRefreshCookie(res, refresh);
  setCsrfCookie(res, csrf);
  return {
    accessToken: issueAccess(user, sid, secret),
    user: safeUser(user),
    csrfToken: csrf
  };
}
function safeUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    is_admin: u.role === "admin",
    status: u.status || "active",
    created_at: u.created_at || null,
    phone: u.phone || null,
    profile_image_url: u.profile_image_url || null,
    google_linked: Boolean(u.google_sub),
    has_password: Boolean(u.password_hash)
  };
}
async function ensureCsrf(req, _res, db) {
  const origin = req.get("origin");
  if (origin && !config.allowedOrigins.includes(origin)) return false;
  const c = req.cookies?.[csrfCookie],
    h = req.get("x-csrf-token"),
    refresh = req.cookies?.[cookieName];
  if (!c || !h || !refresh || Buffer.byteLength(c) !== Buffer.byteLength(h) || !crypto.timingSafeEqual(Buffer.from(c), Buffer.from(h))) return false;
  const row = await get(db, "SELECT s.csrf_token FROM sessions s JOIN session_refresh_tokens r ON r.session_id=s.id WHERE r.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>?", [hash(refresh), new Date().toISOString()]);
  return Boolean(row && row.csrf_token === c);
}
async function rotate(db, req, res, secret) {
  const token = req.cookies?.[cookieName];
  if (!token) return null;
  const digest = hash(token),
    now = new Date().toISOString();
  return transaction(db, async () => {
    const old = await get(db, "SELECT rt.session_id,rt.used_at,s.user_id,s.csrf_token,s.created_at,s.expires_at,s.revoked_at,u.id,u.name,u.email,u.role,u.status,u.phone,u.profile_image_url,u.google_sub,u.password_hash FROM session_refresh_tokens rt JOIN sessions s ON s.id=rt.session_id JOIN users u ON u.id=s.user_id WHERE rt.token_hash=?", [digest]);
    if (!old) return null;
    if (old.used_at || old.revoked_at || old.status !== "active" || old.expires_at <= now) {
      await run(db, "UPDATE sessions SET revoked_at=COALESCE(revoked_at,?) WHERE id=?", [now, old.session_id]);
      return {
        reuse: true
      };
    }
    await run(db, "UPDATE session_refresh_tokens SET used_at=? WHERE token_hash=? AND used_at IS NULL", [now, digest]);
    const next = random(),
      expires = new Date(Date.parse(old.created_at) + config.refreshTokenLifetimeMs).toISOString();
    await run(db, "UPDATE sessions SET refresh_token_hash=?,last_used_at=? WHERE id=?", [hash(next), now, old.session_id]);
    const csrf = (await get(db, "SELECT csrf_token FROM sessions WHERE id=?", [old.session_id])).csrf_token;
    await run(db, "INSERT INTO session_refresh_tokens(session_id,token_hash,created_at,expires_at) VALUES(?,?,?,?)", [old.session_id, hash(next), now, expires]);
    setRefreshCookie(res, next);
    setCsrfCookie(res, csrf);
    return {
      accessToken: issueAccess(old, old.session_id, secret),
      user: safeUser(old),
      csrfToken: csrf
    };
  });
}
module.exports = {
  cookieName,
  csrfCookie,
  hash,
  random,
  setRefreshCookie,
  clearRefreshCookie,
  setCsrfCookie,
  issueAccess,
  makeSession,
  safeUser,
  ensureCsrf,
  rotate
};
