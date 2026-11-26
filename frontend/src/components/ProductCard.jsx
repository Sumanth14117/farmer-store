import { localProductImage } from "../productImages";
export default function ProductCard({ product, onAdd }) {
  return <article className="product-card"><img className="product-image" src={localProductImage(product)} alt={product.name} loading="lazy" onError={(event) => { event.currentTarget.src = "/images/fallback.svg"; }} /><div className="product-content"><h2>{product.name}</h2><p className="product-description">{product.description}</p><p className="product-price">₹{Number(product.price).toFixed(2)}</p>{onAdd && <button className="primary-button" onClick={() => onAdd(product)}>Add to cart</button>}</div></article>;
}
