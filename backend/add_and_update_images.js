// add_and_update_images.js
const db = require('./db');

const productsToAdd = [
  { name: "Rice - 5kg", description: "White rice, good for daily cooking", price: 200, location: "Village", image: "https://upload.wikimedia.org/wikipedia/commons/6/6f/Rice.jpg" },
  { name: "Brown rice - 5kg", description: "Brown rice, healthier whole grain", price: 240, location: "Village", image: "https://upload.wikimedia.org/wikipedia/commons/5/5f/Brown_rice.jpg" },
  { name: "Fertilizer - NPK 20-20-20 (1kg)", description: "Balanced NPK fertilizer", price: 150, location: "Store", image: "https://upload.wikimedia.org/wikipedia/commons/7/73/Fertilizer_bags.jpg" },
  { name: "Organic fertilizer - 1kg", description: "Organic compost for vegetables", price: 180, location: "Farm", image: "https://upload.wikimedia.org/wikipedia/commons/0/04/Compost_pile.jpg" },
  { name: "Axe - farmer tool", description: "Strong axe for small farm use", price: 800, location: "Toolshed", image: "https://upload.wikimedia.org/wikipedia/commons/7/77/Axe.jpg" },
  { name: "Spade / Shovel", description: "Heavy duty spade for digging", price: 450, location: "Toolshed", image: "https://upload.wikimedia.org/wikipedia/commons/4/4b/Shovel.jpg" },
  { name: "Hoe", description: "Hand hoe for weeding", price: 200, location: "Toolshed", image: "https://upload.wikimedia.org/wikipedia/commons/2/2b/Hoe.jpg" }
];

function insertIfNotExists(p, cb) {
  db.get("SELECT id FROM products WHERE name = ?", [p.name], (err, row) => {
    if (err) return cb(err);
    if (row) return cb(null, 'exists');
    db.run("INSERT INTO products (name, description, price, location, image) VALUES (?,?,?,?,?)",
      [p.name, p.description, p.price, p.location, p.image], function(err2) {
        if (err2) return cb(err2);
        cb(null, 'inserted');
      });
  });
}

db.serialize(() => {
  let done = 0;
  productsToAdd.forEach(p => {
    insertIfNotExists(p, (err, status) => {
      if (err) console.error('ERR', p.name, err.message);
      else console.log(p.name, status);
      done++;
      if (done === productsToAdd.length) {
        db.all("SELECT id,name FROM products WHERE image IS NULL OR image = ''", (err2, rows) => {
          if (err2) { console.error(err2); process.exit(0); }
          if (!rows || rows.length === 0) {
            console.log('No products with null image.');
            process.exit(0);
          }
          console.log('Will try to set images for', rows.length, 'items');
          const mapping = {
            "Tomato": "https://upload.wikimedia.org/wikipedia/commons/8/88/Tomato_je.jpg",
            "Potato": "https://upload.wikimedia.org/wikipedia/commons/6/66/Patates.jpg",
            "Onion": "https://upload.wikimedia.org/wikipedia/commons/4/49/Onion.jpg",
            "Banana": "https://upload.wikimedia.org/wikipedia/commons/8/8a/Banana-Single.jpg",
            "Mango": "https://upload.wikimedia.org/wikipedia/commons/9/90/Hapus_Mango.jpg",
            "Chilli": "https://upload.wikimedia.org/wikipedia/commons/5/5a/Red_chilli_peppers.jpg"
          };
          let updDone = 0;
          rows.forEach(r => {
            let chosen = null;
            for (let k in mapping) {
              if (r.name.toLowerCase().includes(k.toLowerCase())) { chosen = mapping[k]; break; }
            }
            if (!chosen) {
              console.log('No match for', r.name);
              updDone++;
              if (updDone === rows.length) process.exit(0);
            } else {
              db.run("UPDATE products SET image = ? WHERE id = ?", [chosen, r.id], function(err3) {
                if (err3) console.error('ERR upd', r.name, err3.message);
                else console.log('Updated', r.name);
                updDone++;
                if (updDone === rows.length) {
                  console.log('Image update finished');
                  process.exit(0);
                }
              });
            }
          });
        });
      }
    });
  });
});
