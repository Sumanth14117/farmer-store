// fix_images.js
const db = require("./db");

const updates = [
  { id: 14, img: "https://cdn.pixabay.com/photo/2013/11/28/10/03/gardening-220249_1280.jpg" }, // Hoe
  { id: 13, img: "https://cdn.pixabay.com/photo/2017/03/26/21/39/compost-2178700_1280.jpg" }, // Organic fertilizer
  { id: 12, img: "https://cdn.pixabay.com/photo/2018/01/05/20/43/fertilizer-3060621_1280.jpg" }, // NPK fertilizer
  { id: 11, img: "https://cdn.pixabay.com/photo/2016/12/06/01/37/axe-1887627_1280.jpg" }, // Axe
  { id: 10, img: "https://cdn.pixabay.com/photo/2013/07/12/18/20/spade-153360_1280.png" }, // Spade
  { id: 9, img: "https://cdn.pixabay.com/photo/2018/03/03/17/16/brown-rice-3196763_1280.jpg" }, // Brown rice
  { id: 8, img: "https://cdn.pixabay.com/photo/2016/11/21/15/46/rice-1842673_1280.jpg" }, // White rice
  { id: 7, img: "https://cdn.pixabay.com/photo/2014/04/03/10/32/potatoes-309575_1280.png" }, // Potato
  { id: 6, img: "https://cdn.pixabay.com/photo/2017/01/06/19/15/onions-1952054_1280.jpg" }, // Onion
  { id: 5, img: "https://cdn.pixabay.com/photo/2018/08/08/23/04/banana-3595914_1280.jpg" }, // Banana
  { id: 4, img: "https://cdn.pixabay.com/photo/2016/03/05/19/02/mango-1238249_1280.jpg" }, // Mango
  { id: 3, img: "https://cdn.pixabay.com/photo/2016/03/05/20/07/chili-1238201_1280.jpg" }, // Chilli
  { id: 2, img: "https://cdn.pixabay.com/photo/2014/04/10/11/06/tomatoes-320860_1280.jpg" }, // Tomato red
  { id: 1, img: "https://cdn.pixabay.com/photo/2014/04/10/11/06/tomatoes-320860_1280.jpg" }  // Tomato
];

updates.forEach(item => {
  db.run("UPDATE products SET image = ? WHERE id = ?", [item.img, item.id], err => {
    if (err) console.log("Error:", err);
    else console.log("Updated product id:", item.id);
  });
});