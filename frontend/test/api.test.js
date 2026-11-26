import test from "node:test";
import assert from "node:assert/strict";
import { apiRequest, initializeSession, setAccessToken, clearAccessToken } from "../src/api.js";
test("API client keeps access JWT in memory, sends it with credentials, and sets JSON type", async () => {
  const old = globalThis.fetch;
  let seen;
  setAccessToken("memory-only-test-token");
  globalThis.fetch = async (_url, options) => {
    seen = options;
    return new Response(JSON.stringify({
      ok: true
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  };
  try {
    assert.deepEqual(await apiRequest("/orders", {
      method: "POST",
      body: JSON.stringify({
        items: []
      })
    }), {
      ok: true
    });
    assert.equal(seen.headers.get("Authorization"), "Bearer memory-only-test-token");
    assert.equal(seen.headers.get("Content-Type"), "application/json");
    assert.equal(seen.credentials, "include");
  } finally {
    clearAccessToken();
    globalThis.fetch = old;
  }
});
test("API client clears memory token and emits expiry after unauthorized session", async () => {
  const oldFetch = globalThis.fetch,
    oldWindow = globalThis.window;
  const events = [];
  globalThis.window = {
    dispatchEvent: e => events.push(e.type)
  };
  setAccessToken("expired-token");
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: "Invalid or expired session"
  }), {
    status: 401,
    headers: {
      "Content-Type": "application/json"
    }
  });
  try {
    await assert.rejects(apiRequest("/orders"), {
      status: 401
    });
    assert.deepEqual(events, ["auth:expired"]);
  } finally {
    clearAccessToken();
    globalThis.fetch = oldFetch;
    globalThis.window = oldWindow;
  }
});
test("simultaneous session restoration shares one CSRF-protected refresh", async () => {
  const oldFetch = globalThis.fetch;
  let refreshCalls = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith("/auth/csrf")) return new Response(JSON.stringify({
      csrfToken: "csrf-for-tests"
    }), {
      status: 200
    });
    if (String(url).endsWith("/auth/refresh")) {
      refreshCalls += 1;
      assert.equal(options.headers.get("X-CSRF-Token"), "csrf-for-tests");
      return new Response(JSON.stringify({
        accessToken: "short-lived-test-token",
        user: {
          id: 1,
          role: "customer"
        },
        csrfToken: "csrf-for-tests"
      }), {
        status: 200
      });
    }
    throw new Error("Unexpected API request");
  };
  try {
    const [first, second] = await Promise.all([initializeSession(), initializeSession()]);
    assert.equal(first.accessToken, "short-lived-test-token");
    assert.equal(second.accessToken, "short-lived-test-token");
    assert.equal(refreshCalls, 1);
  } finally {
    clearAccessToken();
    globalThis.fetch = oldFetch;
  }
});
