export default function FarmerStore({ cart, setCart }) {
  const products = [
    { name: "Hoe", price: 200, img: "hoe.jpg" },
    { name: "Organic Fertilizer - 1kg", price: 180, img: "organicfertilizer.jpg" },
    { name: "Fertilizer NPK 20-20-20", price: 150, img: "npk_fertilizer.jpg" },
    { name: "Axe", price: 800, img: "axe.jpg" },
    { name: "Spade / Shovel", price: 450, img: "spade.jpg" },
    { name: "Brown Rice - 5kg", price: 240, img: "brown_rice.jpg" },
    { name: "Rice - 5kg", price: 200, img: "rice.jpg" },
    { name: "Potato - 1kg", price: 30, img: "potato.jpg" },
    { name: "Onion - 1kg", price: 25, img: "onion.jpg" },
    { name: "Banana", price: 50, img: "banana.jpg" },
    { name: "Mango", price: 120, img: "mango.jpg" },
    { name: "Chilli - 250g", price: 35, img: "chilli.jpg" },
  ];

  // 🛒 ADD TO CART LOGIC
  function addToCart(product) {
    const exists = cart.find((item) => item.name === product.name);

    if (exists) {
      setCart(
        cart.map((item) =>
          item.name === product.name
            ? { ...item, qty: item.qty + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { ...product, qty: 1 }]);
    }
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>🌾 Farmer Online Store</h1>

      {/* 🛒 CART LINK */}
      <p>
        <a href="/cart">Go to Cart ({cart.length})</a>
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
        {products.map((p, i) => (
          <div
            key={i}
            style={{
              width: "200px",
              border: "1px solid #ccc",
              padding: "10px",
              borderRadius: "8px",
            }}
          >
            <img
              src={`/images/${p.img}`}
              alt={p.name}
              style={{ width: "100%", height: "140px", objectFit: "cover" }}
            />
            <h4>{p.name}</h4>
            <p>₹{p.price}</p>

            {/* 🛒 ADD TO CART BUTTON */}
            <button
              onClick={() => addToCart(p)}
              style={{
                padding: "6px 10px",
                background: "#2e7d32",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Add to Cart
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
