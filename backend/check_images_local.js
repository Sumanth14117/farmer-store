// check_images_local.js
// Run from backend folder: node check_images_local.js

const fs = require('fs');
const path = require('path');
const sqlite = require('sqlite3').verbose();
const db = new sqlite.Database('./db.sqlite');

// main query + check
db.all("SELECT id, name, image FROM products", (err, rows) => {
  if (err) {
    console.error('DB error:', err);
    return;
  }

  // use a template string with backticks here:
  console.log(`Checking ${rows.length} products...`);

  // folder where you copied images in the frontend
  // (use the actual absolute path on your machine)
  const folder = "C:/project/farmer-store/frontend/public/images";

  rows.forEach(r => {
    // handle null/empty image gracefully
    const imageUrl = r.image || '';
    const fileName = imageUrl ? imageUrl.split('/').pop() : '';
    const localPath = fileName ? path.join(folder, fileName) : '';

    const exists = fileName ? fs.existsSync(localPath) : false;

    console.log(
      `id=${r.id} name="${r.name}" image="${imageUrl}" -> local file: ${
        exists ? 'FOUND' : 'MISSING'
      } (${localPath})`
    );
  });

  db.close();
});

