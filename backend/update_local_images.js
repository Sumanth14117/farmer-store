const sqlite = require("sqlite3").verbose();
const path = require("path");
const db = new sqlite.Database("./db.sqlite");

const updates = [
  { id: 1, file: "tomatoes-320860_1280.jpg" },
  { id: 2, file: "tomatoes-320860_1280.jpg" },
  { id: 3, file: "chilli.jpg" },
  { id: 4, file: "mango.jpg" },
  { id: 5, file: "banana.jpg" },
  { id: 6, file: "onion.jpg" },
  { id: 7, file: "potato.jpg" },
  { id: 8, file: "rice.jpg" },
  { id: 9, file: "brown_rice.jpg" },
  { id: 10, file: "spade.jpg" },
  { id: 11, file: "axe.jpg" },
  { id: 12, file: "npk_fertilizer.jpg" },
  { id: 13, file: "organicfertilizer.jpg" },
  { id: 14, file: "hoe.jpg" }
];

updates.forEach((u) => {
  const localPath = `/images/${u.file}`;
  db.run(
    `UPDATE products SET image=? WHERE id=?`,
    [localPath, u.id],
    (err) => {
      if (err) {
        console.log("❌ Error updating id:", u.id, err);
      } else {
        console.log(`✅ Updated id=${u.id} -> ${localPath}`);
      }
    }
  );
});

db.close();
