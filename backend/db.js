// backend/db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbFile = path.join(__dirname, 'db.sqlite');

const db = new sqlite3.Database(dbFile, (err) => {
  if (err) console.error('DB Error:', err);
  else console.log('Database connected:', dbFile);
});

db.run(`CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  description TEXT,
  price REAL,
  image TEXT,
  location TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);`);

module.exports = db;
