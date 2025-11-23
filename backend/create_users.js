// create_users.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db.sqlite');

db.run(
  'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
  (err) => {
    if (err) {
      console.error('Create users table error:', err);
    } else {
      console.log('Users table created successfully');
    }
    db.close();
  }
);
