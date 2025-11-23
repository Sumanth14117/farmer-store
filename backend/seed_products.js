// seed_products.js
const db = require('./db');

const products = [
  { name: "Tomato", description: "Fresh red tomatoes - 1kg", price: 40, location: "Local", image: "https://upload.wikimedia.org/wikipedia/commons/8/88/Tomato_je.jpg" },
  { name: "Potato", description: "Organic potatoes - 1kg", price: 30, location: "Village", image: "https://upload.wikimedia.org/wikipedia/commons/6/66/Patates.jpg" },
  { name: "Onion", description: "Red onions - 1kg", price: 25, location: "Local", image: "https://upload.wikimedia.org/wikipedia/commons/4/49/Onion.jpg" },
  { name: "Banana", description: "Ripe bananas - dozen", price: 50, location: "Farm", image: "https://upload.wikimedia.org/wikipedia/commons/8/8a/Banana-Single.jpg" },
  { name: "Mango", description: "Seasonal mangoes - 1kg", price: 120, location: "Orchard", image: "https://upload.wikimedia.org/wikipedia/commons/9/90/Hapus_Mango.jpg" },
  { name: "Chilli", description: "Spicy red chilli - 250g", price: 35, location: "Local", image: "https://upload.wikimedia.org/wikipedia/commons/5/5a/Red_chilli_peppers.jpg" }
];

let added = 0;
products.forEach(p => {
  db.run(
    `INSERT INTO products (name, description, price, image, location) VALUES (?,?,?,?,?)`,
    [p.name, p.description, p.price, p.image, p.location],
    function(err) {
      if (err) {
        console.error('Insert error for', p.name, err.message);
      } else {
        console.log('Inserted:', p.name, 'id=', this.lastID);
      }
      added++;
      if (added === products.length) {
        console.log('Seeding complete');
        process.exit(0);
      }
    }
  );
});
