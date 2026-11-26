const express = require("express");
const { get, all, run } = require("./sqlite");
const { requireAdmin } = require("./middleware");

function makeProduct(row) {
  const image = typeof row.image === "string" && /^[A-Za-z0-9._-]+$/.test(row.image) ? row.image : null;
  return { id: row.id, name: row.name, description: row.description, price: Number(row.price), location: row.location || "", image };
}
function createProductRouter({ db, auth }) {
  const router = express.Router();
  router.get("/", async (_req, res) => {
    try {
      const rows = await all(db, "SELECT id, name, description, price, image, location FROM products ORDER BY id DESC");
      return res.json(rows.map(makeProduct));
    } catch {
      return res.status(500).json({ error: "Unable to load products" });
    }
  });
  router.post("/", auth, requireAdmin, async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
    const location = typeof req.body?.location === "string" ? req.body.location.trim() : "";
    const image = req.body?.image == null ? "" : req.body.image;
    const price = Number(req.body?.price);
    if (name.length < 2 || name.length > 120) return res.status(400).json({ error: "Product name must be between 2 and 120 characters" });
    if (description.length > 4000 || location.length > 160) return res.status(400).json({ error: "Product description or location is too long" });
    if (!Number.isFinite(price) || price <= 0 || price > 10000000) return res.status(400).json({ error: "Price must be a positive amount" });
    if (typeof image !== "string" || image.length > 255 || (image && !/^[A-Za-z0-9._-]+$/.test(image))) return res.status(400).json({ error: "Image must be a local file name" });
    try {
      const inserted = await run(db, "INSERT INTO products(name, description, price, image, location) VALUES(?, ?, ?, ?, ?)", [name, description, price, image, location]);
      const row = await get(db, "SELECT id, name, description, price, image, location FROM products WHERE id = ?", [inserted.lastID]);
      return res.status(201).json({ product: makeProduct(row) });
    } catch {
      return res.status(500).json({ error: "Unable to create product" });
    }
  });
  router.get("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid product ID" });
    try {
      const row = await get(db, "SELECT id, name, description, price, image, location FROM products WHERE id = ?", [id]);
      if (!row) return res.status(404).json({ error: "Product not found" });
      return res.json({ product: makeProduct(row) });
    } catch {
      return res.status(500).json({ error: "Unable to load product" });
    }
  });
  return router;
}
module.exports = { createProductRouter, makeProduct };
