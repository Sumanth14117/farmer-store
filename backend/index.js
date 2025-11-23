// backend/index.js
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', (req, res, next) => {
  console.log('>> incoming to /api/auth:', req.method, req.originalUrl, 'body=', req.body);
  next();
});

// Import user routes
const userRoutes = require('./userRoutes');
app.use('/api/auth', userRoutes);


// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// GET /products
app.get('/products', (req, res) => {
  db.all('SELECT id,name,description,price,image,location FROM products ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /products
app.post('/products', (req, res) => {
  const { name, description, price, image, location } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'name and price required' });
  db.run('INSERT INTO products (name,description,price,image,location) VALUES (?,?,?,?,?)',
    [name,description,price,image||'',location||''],
    function(err){
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

app.post('/test-signup', (req, res) => {
  console.log('>> /test-signup hit, body=', req.body);
  res.json({ ok: true, path: '/test-signup' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
