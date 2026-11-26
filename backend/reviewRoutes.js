const express = require("express");
const { get, all, run } = require("./sqlite");

function createReviewRouter({ db, auth }) {
  const router = express.Router({ mergeParams: true });
  router.get("/", async (req, res) => {
    const productId = Number(req.params.productId);
    if (!Number.isSafeInteger(productId) || productId <= 0) return res.status(400).json({ error: "Invalid product ID" });
    try {
      const exists = await get(db, "SELECT id FROM products WHERE id = ?", [productId]);
      if (!exists) return res.status(404).json({ error: "Product not found" });
      const reviews = await all(db, "SELECT id, rating, review, created_at AS createdAt FROM reviews WHERE product_id = ? ORDER BY created_at DESC, id DESC", [productId]);
      return res.json({ reviews });
    } catch {
      return res.status(500).json({ error: "Unable to load reviews" });
    }
  });
  router.post("/", auth, async (req, res) => {
    const productId = Number(req.params.productId);
    const rating = Number(req.body?.rating);
    const review = typeof req.body?.review === "string" ? req.body.review.trim() : "";
    if (!Number.isSafeInteger(productId) || productId <= 0) return res.status(400).json({ error: "Invalid product ID" });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: "Rating must be between 1 and 5" });
    if (review.length < 3 || review.length > 2000) return res.status(400).json({ error: "Review must be between 3 and 2000 characters" });
    try {
      const product = await get(db, "SELECT id, name FROM products WHERE id = ?", [productId]);
      if (!product) return res.status(404).json({ error: "Product not found" });
      const existing = await get(db, "SELECT id FROM reviews WHERE product_id = ? AND user_id = ?", [productId, req.user.id]);
      if (existing) return res.status(409).json({ error: "You have already reviewed this product" });
      const inserted = await run(db, "INSERT INTO reviews(user_id, product_id, product_name, rating, review) VALUES(?, ?, ?, ?, ?)", [req.user.id, productId, product.name, rating, review]);
      const created = await get(db, "SELECT id, rating, review, created_at AS createdAt FROM reviews WHERE id = ?", [inserted.lastID]);
      return res.status(201).json({ review: created });
    } catch {
      return res.status(500).json({ error: "Unable to submit review" });
    }
  });
  return router;
}
module.exports = { createReviewRouter };
