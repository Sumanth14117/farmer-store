const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("node:crypto");
const {
  OAuth2Client
} = require("google-auth-library");
const config = require("./config");
const {
  get,
  run,
  transaction
} = require("./sqlite");
const S = require("./authSessions");
function encrypt(value, secret) {
  const key = crypto.createHash("sha256").update(secret).digest(),
    iv = crypto.randomBytes(12),
    c = crypto.createCipheriv("aes-256-gcm", key, iv),
    data = Buffer.concat([c.update(value, "utf8"), c.final()]);
  return [iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}
function decrypt(value, secret) {
  const [iv, tag, data] = value.split("."),
    d = crypto.createDecipheriv("aes-256-gcm", crypto.createHash("sha256").update(secret).digest(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}
function createAuthRouter({
  db,
  secret,
  auth,
  rateLimit,
  googleClient
}) {
  const router = express.Router(),
    googleReady = Boolean(googleClient || config.googleClientId && config.googleClientSecret);
  const google = googleClient || (googleReady ? new OAuth2Client(config.googleClientId, config.googleClientSecret, config.googleCallbackUrl) : null);
  const publicUser = u => S.safeUser(u);
  router.post("/password", auth, async (req, res) => {
    const current = req.body?.currentPassword,
      next = req.body?.newPassword;
    if (typeof next !== "string" || next.length < 8 || next.length > 128) return res.status(400).json({
      error: "Password must be between 8 and 128 characters"
    });
    if (req.user.password_hash) {
      if (typeof current !== "string" || !(await bcrypt.compare(current, req.user.password_hash))) return res.status(401).json({
        error: "Current password is incorrect"
      });
    } else if (!req.user.google_sub) return res.status(409).json({
      error: "No usable authentication method is available"
    });
    try {
      const hashed = await bcrypt.hash(next, 12);
      await run(db, "UPDATE users SET password=?,password_hash=? WHERE id=?", [hashed, hashed, req.user.id]);
      await run(db, "UPDATE sessions SET revoked_at=COALESCE(revoked_at,?) WHERE user_id=? AND id<>?", [new Date().toISOString(), req.user.id, req.user.session_id]);
      return res.json({
        ok: true
      });
    } catch {
      return res.status(500).json({
        error: "Unable to update password"
      });
    }
  });
  router.get("/google/status", (_req, res) => res.json({
    enabled: googleReady
  }));
  router.post("/signup", rateLimit, async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "",
      email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "",
      password = req.body?.password;
    if (name.length < 2 || name.length > 100) return res.status(400).json({
      error: "Name must be between 2 and 100 characters"
    });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({
      error: "Enter a valid email address"
    });
    if (typeof password !== "string" || password.length < 8 || password.length > 128) return res.status(400).json({
      error: "Password must be between 8 and 128 characters"
    });
    try {
      if (await get(db, "SELECT id FROM users WHERE email=? COLLATE NOCASE", [email])) return res.status(409).json({
        error: "An account with that email already exists"
      });
      const ph = await bcrypt.hash(password, 12),
        insert = await run(db, "INSERT INTO users(name,email,password,password_hash,is_admin,role,status) VALUES(?,?,?,?,0,'customer','active')", [name, email, ph, ph]),
        u = {
          id: insert.lastID,
          name,
          email,
          role: "customer",
          status: "active",
          created_at: new Date().toISOString(),
          password_hash: ph
        };
      return res.status(201).json(await S.makeSession(db, u, req, res, secret));
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT") return res.status(409).json({
        error: "An account with that email already exists"
      });
      return res.status(500).json({
        error: "Unable to create account"
      });
    }
  });
  router.post("/login", rateLimit, async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "",
      password = req.body?.password;
    if (!email || typeof password !== "string" || password.length > 128) return res.status(401).json({
      error: "Invalid email or password"
    });
    try {
      const u = await get(db, "SELECT id,name,email,password,password_hash,role,status,created_at,phone,profile_image_url,google_sub FROM users WHERE email=? COLLATE NOCASE", [email]);
      const hash = u?.password_hash !== undefined ? u.password_hash : u?.password;
      if (!u || !hash || !(await bcrypt.compare(password, hash))) return res.status(401).json({
        error: "Invalid email or password"
      });
      if (u.status !== "active") return res.status(401).json({
        error: "Invalid email or password"
      });
      return res.json(await S.makeSession(db, u, req, res, secret));
    } catch {
      return res.status(500).json({
        error: "Unable to sign in"
      });
    }
  });
  router.get("/csrf", async (req, res) => {
    const token = req.cookies?.[S.cookieName];
    if (token) {
      const row = await get(db, "SELECT s.csrf_token FROM sessions s JOIN session_refresh_tokens r ON r.session_id=s.id WHERE r.token_hash=? AND r.used_at IS NULL AND s.revoked_at IS NULL AND s.expires_at>?", [S.hash(token), new Date().toISOString()]);
      if (row) {
        S.setCsrfCookie(res, row.csrf_token);
        return res.json({
          csrfToken: row.csrf_token
        });
      }
    }
    return res.json({
      csrfToken: req.cookies?.[S.csrfCookie] || null
    });
  });
  router.post("/refresh", async (req, res) => {
    if (!(await S.ensureCsrf(req, res, db))) {
      S.clearRefreshCookie(res);
      res.clearCookie(S.csrfCookie, {
        path: "/api/auth",
        sameSite: config.cookieSameSite,
        secure: config.cookieSecure
      });
      return res.status(403).json({
        error: "CSRF validation failed"
      });
    }
    try {
      const result = await S.rotate(db, req, res, secret);
      if (!result || result.reuse) {
        S.clearRefreshCookie(res);
        return res.status(401).json({
          error: "Session expired. Sign in again."
        });
      }
      return res.json(result);
    } catch {
      return res.status(500).json({
        error: "Unable to refresh session"
      });
    }
  });
  router.post("/logout", async (req, res) => {
    if (!(await S.ensureCsrf(req, res, db))) {
      S.clearRefreshCookie(res);
      res.clearCookie(S.csrfCookie, {
        path: "/api/auth",
        sameSite: config.cookieSameSite,
        secure: config.cookieSecure
      });
      return res.status(403).json({
        error: "CSRF validation failed"
      });
    }
    try {
      const token = req.cookies?.[S.cookieName];
      if (token) await run(db, "UPDATE sessions SET revoked_at=COALESCE(revoked_at,?) WHERE refresh_token_hash=?", [new Date().toISOString(), S.hash(token)]);
      S.clearRefreshCookie(res);
      res.clearCookie(S.csrfCookie, {
        path: "/api/auth",
        sameSite: config.cookieSameSite,
        secure: config.cookieSecure
      });
      return res.json({
        ok: true
      });
    } catch {
      return res.status(500).json({
        error: "Unable to sign out"
      });
    }
  });
  router.get("/me", auth, (req, res) => res.json({
    user: publicUser(req.user)
  }));
  router.get("/profile", auth, (req, res) => res.json({
    user: publicUser(req.user)
  }));
  router.patch("/profile", auth, async (req, res) => {
    const body = req.body || {};
    const allowed = ["name", "phone", "profile_image_url"];
    if (Object.keys(body).some(k => !allowed.includes(k))) return res.status(400).json({
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
      const u = await get(db, "SELECT * FROM users WHERE id=?", [req.user.id]);
      return res.json({
        user: publicUser(u)
      });
    } catch {
      return res.status(500).json({
        error: "Unable to update profile"
      });
    }
  });
  router.post("/google/start", rateLimit, async (req, res) => {
    if (!google) return res.status(503).json({
      error: "Google sign-in is not configured"
    });
    try {
      const state = S.random(),
        nonce = S.random(),
        {
          codeVerifier,
          codeChallenge
        } = await google.generateCodeVerifierAsync();
      await run(db, "DELETE FROM oauth_flows WHERE expires_at<=?", [new Date().toISOString()]);
      await run(db, "INSERT INTO oauth_flows(state_hash,nonce_hash,code_verifier_ciphertext,intent,created_at,expires_at) VALUES(?,?,?,'login',?,?)", [S.hash(state), S.hash(nonce), encrypt(codeVerifier, secret), new Date().toISOString(), new Date(Date.now() + 10 * 60 * 1000).toISOString()]);
      res.cookie("fs_oauth_state", state, {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: "lax",
        path: "/api/auth/google",
        maxAge: 600000
      });
      return res.json({
        url: google.generateAuthUrl({
          access_type: "online",
          scope: ["openid", "email", "profile"],
          state,
          nonce,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          prompt: "select_account"
        })
      });
    } catch {
      return res.status(500).json({
        error: "Unable to start Google sign-in"
      });
    }
  });
  router.post("/google/link/start", auth, rateLimit, async (req, res) => {
    if (!google) return res.status(503).json({
      error: "Google sign-in is not configured"
    });
    try {
      const state = S.random(),
        nonce = S.random(),
        {
          codeVerifier,
          codeChallenge
        } = await google.generateCodeVerifierAsync();
      await run(db, "DELETE FROM oauth_flows WHERE expires_at<=?", [new Date().toISOString()]);
      await run(db, "INSERT INTO oauth_flows(state_hash,nonce_hash,code_verifier_ciphertext,intent,user_id,session_id,created_at,expires_at) VALUES(?,?,?,'link',?,?,?,?)", [S.hash(state), S.hash(nonce), encrypt(codeVerifier, secret), req.user.id, req.user.session_id, new Date().toISOString(), new Date(Date.now() + 10 * 60 * 1000).toISOString()]);
      res.cookie("fs_oauth_state", state, {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: "lax",
        path: "/api/auth/google",
        maxAge: 600000
      });
      return res.json({
        url: google.generateAuthUrl({
          access_type: "online",
          scope: ["openid", "email", "profile"],
          state,
          nonce,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          prompt: "select_account"
        })
      });
    } catch {
      return res.status(500).json({
        error: "Unable to start Google account linking"
      });
    }
  });
  router.get("/google/callback", async (req, res) => {
    const state = String(req.query.state || ""),
      code = String(req.query.code || "");
    res.clearCookie("fs_oauth_state", {
      path: "/api/auth/google",
      sameSite: "lax",
      secure: config.cookieSecure
    });
    if (!google || !state || !code || req.cookies?.fs_oauth_state !== state) return res.redirect(`${config.frontendBaseUrl}/auth/callback?error=invalid_state`);
    try {
      const flow = await get(db, "SELECT * FROM oauth_flows WHERE state_hash=? AND expires_at>?", [S.hash(state), new Date().toISOString()]);
      if (!flow) return res.redirect(`${config.frontendBaseUrl}/auth/callback?error=expired_flow`);
      await run(db, "DELETE FROM oauth_flows WHERE state_hash=?", [S.hash(state)]);
      const {
        tokens
      } = await google.getToken({
        code,
        codeVerifier: decrypt(flow.code_verifier_ciphertext, secret)
      });
      const ticket = await google.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.googleClientId
      });
      const p = ticket.getPayload();
      if (!p || p.nonce === undefined || S.hash(p.nonce) !== flow.nonce_hash || !p.email_verified || !p.sub || !p.email || String(p.email).length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.email))) return res.redirect(`${config.frontendBaseUrl}/auth/callback?error=identity_verification_failed`);
      if (flow.intent === "link") {
        const session = await get(db, "SELECT id FROM sessions WHERE id=? AND user_id=? AND revoked_at IS NULL AND expires_at>?", [flow.session_id, flow.user_id, new Date().toISOString()]);
        if (!session) return res.redirect(`${config.frontendBaseUrl}/auth/callback?error=session_expired`);
        const collision = await get(db, "SELECT id FROM users WHERE google_sub=? AND id<>?", [p.sub, flow.user_id]);
        if (collision) return res.redirect(`${config.frontendBaseUrl}/auth/callback?error=account_already_linked`);
        await run(db, "UPDATE users SET google_sub=? WHERE id=?", [p.sub, flow.user_id]);
        return res.redirect(`${config.frontendBaseUrl}/auth/callback?linked=1`);
      }
      const created = await transaction(db, async () => {
        let account = await get(db, "SELECT * FROM users WHERE google_sub=?", [p.sub]);
        if (account) return {
          account
        };
        const emailUser = await get(db, "SELECT id FROM users WHERE email=? COLLATE NOCASE", [String(p.email).toLowerCase()]);
        if (emailUser) return {
          emailConflict: true
        };
        const dummy = await bcrypt.hash(S.random(), 12),
          insert = await run(db, "INSERT INTO users(name,email,password,password_hash,role,status,google_sub) VALUES(?,?,?,NULL,'customer','active',?)", [String(p.name || p.email).slice(0, 100), String(p.email).toLowerCase(), dummy, p.sub]);
        account = await get(db, "SELECT * FROM users WHERE id=?", [insert.lastID]);
        return {
          account
        };
      });
      if (created.emailConflict) return res.redirect(`${config.frontendBaseUrl}/auth/callback?error=link_from_account_settings`);
      const u = created.account;
      if (u.status !== "active") return res.redirect(`${config.frontendBaseUrl}/auth/callback?error=account_suspended`);
      await S.makeSession(db, u, req, res, secret);
      return res.redirect(`${config.frontendBaseUrl}/auth/callback?google=success`);
    } catch {
      return res.redirect(`${config.frontendBaseUrl}/auth/callback?error=google_signin_failed`);
    }
  });
  router.delete("/google/link", auth, async (req, res) => {
    if (!req.user.google_sub) return res.status(404).json({
      error: "No Google account is linked"
    });
    if (!req.user.password_hash) return res.status(409).json({
      error: "Add an email password before unlinking Google"
    });
    try {
      await run(db, "UPDATE users SET google_sub=NULL WHERE id=?", [req.user.id]);
      return res.json({
        ok: true
      });
    } catch {
      return res.status(500).json({
        error: "Unable to unlink Google account"
      });
    }
  });
  return router;
}
module.exports = {
  createAuthRouter
};
