const express = require("express");
const { all, get, run, transaction } = require("./sqlite");

function parseJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}
function decodeOrder(row) {
  const stored = parseJson(row.items, []);
  const rawItems = Array.isArray(stored) ? stored : Array.isArray(stored?.items) ? stored.items : [];
  const items = rawItems.filter((item) => item && typeof item === "object").map((item) => ({
    productId: Number.isSafeInteger(Number(item.productId ?? item.id)) ? Number(item.productId ?? item.id) : null,
    name: String(item.name || "Item"),
    price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
    qty: Number.isSafeInteger(Number(item.qty ?? item.quantity)) && Number(item.qty ?? item.quantity) > 0 ? Number(item.qty ?? item.quantity) : 1,
  }));
  return {
    id: row.id,
    total: Number(row.total),
    status: row.status,
    createdAt: row.created_at,
    address: parseJson(row.address, {}),
    items,
  };
}
function validateAddress(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const address = {};
  for (const key of ["name", "phone", "street", "city", "pincode"]) {
    if (typeof value[key] !== "string") return null;
    address[key] = value[key].trim();
  }
  if (address.name.length < 2 || address.name.length > 100) return null;
  if (!/^\+?[0-9 ()-]{8,20}$/.test(address.phone)) return null;
  if (address.street.length < 3 || address.street.length > 240) return null;
  if (address.city.length < 2 || address.city.length > 100) return null;
  if (!/^[A-Za-z0-9 -]{4,12}$/.test(address.pincode)) return null;
  return address;
}

function createOrderRouter({ db, auth }) {
  const router = express.Router();
  router.post("/", auth, async (req, res) => {
    const address = validateAddress(req.body?.address);
    if (!address) return res.status(400).json({ error: "A valid delivery address is required" });
    const input = req.body?.items;
    if (!Array.isArray(input) || input.length < 1 || input.length > 50) return res.status(400).json({ error: "Order must contain between 1 and 50 items" });
    const items = [];
    const seen = new Set();
    for (const item of input) {
      const productId = Number(item?.productId ?? item?.id);
      const quantity = Number(item?.quantity ?? item?.qty);
      if (!Number.isSafeInteger(productId) || productId <= 0) return res.status(400).json({ error: "Each item must have a valid product ID" });
      if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 10000) return res.status(400).json({ error: "Each item quantity must be a positive integer" });
      if (seen.has(productId)) return res.status(400).json({ error: "Each product may appear only once in an order" });
      seen.add(productId);
      items.push({ productId, quantity });
    }
    const idempotencyKey = req.get("Idempotency-Key") || req.body?.idempotencyKey || null;
    if (idempotencyKey !== null && (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey))) return res.status(400).json({ error: "Invalid idempotency key" });

    try {
      const result = await transaction(db, async () => {
        if (idempotencyKey) {
          const existing = await get(db, "SELECT * FROM orders WHERE user_id = ? AND idempotency_key = ?", [req.user.id, idempotencyKey]);
          if (existing) return { order: decodeOrder(existing), replayed: true };
        }
        const marks = items.map(() => "?").join(",");
        const rows = await all(db, `SELECT id, name, price FROM products WHERE id IN (${marks})`, items.map((item) => item.productId));
        const byId = new Map(rows.map((row) => [Number(row.id), row]));
        if (byId.size !== items.length) throw Object.assign(new Error("unavailable"), { status: 400, publicMessage: "One or more products are unavailable" });
        let totalPaise = 0;
        const orderItems = items.map(({ productId, quantity }) => {
          const product = byId.get(productId);
          const pricePaise = Math.round(Number(product.price) * 100);
          if (!Number.isSafeInteger(pricePaise) || pricePaise <= 0 || pricePaise * quantity > Number.MAX_SAFE_INTEGER) throw Object.assign(new Error("price"), { status: 400, publicMessage: "A product has an invalid price" });
          totalPaise += pricePaise * quantity;
          if (!Number.isSafeInteger(totalPaise)) throw Object.assign(new Error("total"), { status: 400, publicMessage: "Order total is too large" });
          return { productId, name: product.name, price: pricePaise / 100, qty: quantity };
        });
        const total = totalPaise / 100;
        const inserted = await run(db, "INSERT INTO orders(user_id, items, total, status, address, idempotency_key) VALUES(?, ?, ?, 'Placed', ?, ?)", [req.user.id, JSON.stringify(orderItems), total, JSON.stringify(address), idempotencyKey]);
        const row = await get(db, "SELECT * FROM orders WHERE id = ? AND user_id = ?", [inserted.lastID, req.user.id]);
        return { order: decodeOrder(row), replayed: false };
      });
      return res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.publicMessage });
      return res.status(500).json({ error: "Unable to place order" });
    }
  });

  router.get("/", auth, async (req, res) => {
    try {
      const rows = await all(db, "SELECT id, user_id, items, total, status, address, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC", [req.user.id]);
      return res.json({ orders: rows.map(decodeOrder) });
    } catch {
      return res.status(500).json({ error: "Unable to load order history" });
    }
  });

  router.get("/:id", auth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid order ID" });
    try {
      const row = await get(db, "SELECT id, user_id, items, total, status, address, created_at FROM orders WHERE id = ? AND user_id = ?", [id, req.user.id]);
      if (!row) return res.status(404).json({ error: "Order not found" });
      return res.json({ order: decodeOrder(row) });
    } catch {
      return res.status(500).json({ error: "Unable to load order" });
    }
  });
  return router;
}
module.exports = { createOrderRouter, decodeOrder, validateAddress };
