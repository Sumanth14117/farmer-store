// seed.js
const db = require('./db');

db.run(
  "INSERT INTO products (name,description,price,location) VALUES ('Tomato','Fresh tomatoes',40,'Local')",
  function(err) {
    if (err) {
      console.error('Insert error:', err.message);
      process.exit(1);
    }
    console.log('sample added');
    process.exit(0);
  }
);
