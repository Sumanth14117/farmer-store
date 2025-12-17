// backend/index.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./db");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

// ============================
// 🔐 AUTH MIDDLEWARE
// ============================
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "secret123"
    );
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ============================
// 📦 STATIC IMAGES
// ============================
app.use("/images", express.static(path.join(__dirname, "images")));

// ============================
// 🔍 AUTH REQUEST LOGGER
// ============================
app.use("/api/auth", (req, res, next) => {
  console.log(
    ">> incoming to /api/auth:",
    req.method,
    req.originalUrl,
    "body=",
    req.body
  );
  next();
});

// ============================
// 🔐 AUTH ROUTES
// ============================
const userRoutes = require("./userRoutes");
app.use("/api/auth", userRoutes);

// ============================
// ❤️ HEALTH CHECK
// ============================
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// ============================
// 🛒 GET PRODUCTS (PROTECTED)
// ============================
app.get("/api/products", authMiddleware, (req, res) => {
  db.all(
    "SELECT id, name, description, price, image, location FROM products ORDER BY id DESC",
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const products = rows.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        location: p.location,
        imageUrl: `http://localhost:4000/images/${p.image}`,
      }));

      res.json(products);
    }
  );
});

// ============================
// ➕ ADD PRODUCT (OPTIONAL)
// ============================
app.post("/api/products", authMiddleware, (req, res) => {
  const { name, description, price, image, location } = req.body;

  if (!name || price == null) {
    return res.status(400).json({ error: "name and price required" });
  }

  db.run(
    "INSERT INTO products (name, description, price, image, location) VALUES (?,?,?,?,?)",
    [name, description, price, image || "", location || ""],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID });
    }
  );
});

// ============================
// 🧪 TEST ROUTE
// ============================
app.post("/test-signup", (req, res) => {
  console.log(">> /test-signup hit, body=", req.body);
  res.json({ ok: true, path: "/test-signup" });
});

// ============================
// 🚀 START SERVER
// ============================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
