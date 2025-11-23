import React, { useEffect, useState } from "react";
import ProductCard from "./components/ProductCard";

export default function App() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch("http://localhost:4000/products")
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.log("API error:", err));
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Farmer Store Products</h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {products.length === 0 ? (
          <div>Loading or no products — make sure backend is running</div>
        ) : (
          products.map((item) => <ProductCard key={item.id} product={item} />)
        )}
      </div>
    </div>
  );
}
