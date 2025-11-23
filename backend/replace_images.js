// replace_images.js
// Updates product rows to use reliable hotlinkable images (Pixabay)
const db = require("./db");

const updates = [
  { name: "Potato", img: "https://cdn.pixabay.com/photo/2014/04/03/10/32/potatoes-309575_1280.png" },
  { name: "Onion", img: "https://cdn.pixabay.com/photo/2017/01/06/19/15/onions-1952054_1280.jpg" },
  { name: "Banana", img: "https://cdn.pixabay.com/photo/2018/08/08/23/04/banana-3595914_1280.jpg" },
  { name: "Mango", img: "https://cdn.pixabay.com/photo/2016/03/05/19/02/mango-1238249_1280.jpg" },
  { name: "Chilli", img: "https://cdn.pixabay.com/photo/2016/03/05/20/07/chili-1238201_1280.jpg" },
  { name: "Tomato", img: "https://cdn.pixabay.com/photo/2014/04/10/11/06/tomatoes-320860_1280.jpg" },
  { name: "Rice", img: "https://cdn.pixabay.com/photo/2016/11/21/15/46/rice-1842673_1280.jpg" },
  { name: "Brown rice", img: "https://cdn.pixabay.com/photo/2018/03/03/17/16/brown-rice-3196763_1280.jpg" },
  { name: "Axe", img: "https://cdn.pixabay.com/photo/2016/12/06/01/37/axe-1887627_1280.jpg" },
  { name: "Spade", img: "https://cdn.pixabay.com/photo/2013/07/12/18/20/spade-153360_1280.png" },
  { name: "Fertilizer", img: "https://cdn.pixabay.com/photo/2020/04/07/14/03/fertilizer-5010885_1280.jpg" }
];

updates.forEach(item => {
  db.run(
    UPDATE products SET image = ? WHERE name LIKE ?,
    [item.img, %${item.name}%],
    function(err) {
      if (err) {
        console.log("Error updating", item.name, err.message);
      } else {
        console.log("Updated", item.name);
      }
    }
  );
});