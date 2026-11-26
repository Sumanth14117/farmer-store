import { useEffect, useState } from "react";
import { getProducts } from "./api";
import { localProductImage } from "./productImages";
import ReviewBox from "./ReviewBox";

export default function FarmerStore({ cart, setCart }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    getProducts().then((data) => { if (active) setProducts(data); })
      .catch((err) => { if (active) setError(err.message || "Unable to load products"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  function addToCart(product) {
    setCart((current) => {
      const found = current.find((item) => Number(item.productId ?? item.id) === product.id);
      if (found) return current.map((item) => Number(item.productId ?? item.id) === product.id ? { ...item, productId: product.id, qty: (Number(item.qty) || 0) + 1 } : item);
      return [...current, { productId: product.id, name: product.name, price: product.price, image: product.image, qty: 1 }];
    });
  }
  return <section className="store-page">
    <div className="store-heading"><div><p className="eyebrow">Fresh from local farms</p><h1>Farmer marketplace</h1><p>Browse the products currently available in the store.</p></div><a className="button-link" href="/cart">View cart ({cart.reduce((n, item) => n + (Number(item.qty) || 0), 0)})</a></div>
    {loading && <p className="page-state" role="status">Loading products…</p>}
    {error && <p className="state-error" role="alert">{error} <button onClick={() => window.location.reload()}>Retry</button></p>}
    {!loading && !error && products.length === 0 && <p className="empty-state">No products are available right now. Please check back soon.</p>}
    {!loading && !error && products.length > 0 && <div className="product-grid">
      {products.map((product) => <article className="product-card" key={product.id}>
        <img className="product-image" src={localProductImage(product)} alt={product.name} loading="lazy" onError={(event) => { event.currentTarget.src = "/images/fallback.svg"; }} />
        <div className="product-content"><h2>{product.name}</h2><p className="product-description">{product.description || ""}</p>{product.location && <p className="product-location">{product.location}</p>}<p className="product-price">₹{Number(product.price).toFixed(2)}</p>
          <button className="primary-button" onClick={() => addToCart(product)}>Add to cart</button>
          <ReviewBox productId={product.id} productName={product.name} />
        </div>
      </article>)}
    </div>}
  </section>;
}
