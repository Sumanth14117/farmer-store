console.log("userRoutes.js loaded");

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');
const router = express.Router();

const SECRET = process.env.JWT_SECRET || 'super_secret_change_this';
const SALT_ROUNDS = 10;

// Signup
router.post('/signup', async (req, res) => {
    console.log('>> signup called, body:', req.body);

  try {
    const { name, email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
  if (err) {
    console.error('DB error (SELECT):', err);
    return res.status(500).json({ error: err.message });
  }
  if (row) return res.status(400).json({ error: 'User already exists' });

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);

  db.run(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    [name || '', email, hashed],
    function (err) {
      if (err) {
        console.error('DB error (INSERT):', err);
        return res.status(500).json({ error: err.message });
      }

      const userId = this.lastID;
      const token = jwt.sign({ id: userId, email }, SECRET, { expiresIn: '24h' });

      return res.json({
        token,
        user: { id: userId, name, email }
      });
    }
  );
});


  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    db.get(
      'SELECT id, name, email, password FROM users WHERE email = ?',
      [email],
      async (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(400).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(password, row.password);
        if (!match) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: row.id, email: row.email }, SECRET, {
          expiresIn: '24h'
        });

        return res.json({
          token,
          user: { id: row.id, name: row.name, email: row.email }
        });
      }
    );

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
