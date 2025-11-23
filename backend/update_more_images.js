// update_more_images.js
const db = require('./db');

// Map exact product names (as shown in your /products JSON) to image URLs
const mapping = {
  "Fresh red tomatoes - 1kg": "https://upload.wikimedia.org/wikipedia/commons/8/88/Tomato_je.jpg",
  "Fresh tomatoes": "https://upload.wikimedia.org/wikipedia/commons/8/88/Tomato_je.jpg",
  "Organic potatoes - 1kg": "https://upload.wikimedia.org/wikipedia/commons/6/66/Patates.jpg",
  "Red onions - 1kg": "https://upload.wikimedia.org/wikipedia/commons/4/49/Onion.jpg",
  "Ripe bananas - dozen": "https://upload.wikimedia.org/wikipedia/commons/8/8a/Banana-Single.jpg",
  // these two you already saw working but include anyway
  "Seasonal mangoes - 1kg": "https://upload.wikimedia.org/wikipedia/commons/9/90/Hapus_Mango.jpg",
  "Spicy red chilli - 250g": "https://upload.wikimedia.org/wikipedia/commons/5/5a/Red_chilli_peppers.jpg"
};

db.serialize(() => {
  let updated = 0;
  for (const name of Object.keys(mapping)) {
    const url = mapping[name];
    db.run("UPDATE products SET image = ? WHERE name = ?", [url, name], function(err) {
      if (err) console.error('ERR updating', name, err.message);
      else if (this.changes) {
        console.log('Updated:', name);
        updated++;
      } else {
        console.log('No match for', name);
      }
    });
  }

  // Wait a little then print final state and exit
  setTimeout(() => {
    console.log('Done, approx updated:', updated);
    db.all('SELECT id,name,image IS NOT NULL AS hasImage FROM products', (err, rows) => {
      if (err) console.error(err);
      else rows.forEach(r => console.log(r.id, r.name, r.hasImage ? 'has image' : 'NO IMAGE'));
      process.exit(0);
    });
  }, 700);
});
