import { Link, useNavigate } from "react-router-dom";
export default function Cart({ cart, setCart }) {
  const navigate = useNavigate();
  const total = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
  function change(id, delta) {
    setCart((current) => current.map((item) => Number(item.productId ?? item.id) === id ? { ...item, qty: Number(item.qty) + delta } : item).filter((item) => item.qty > 0));
  }
  return <section className="content-page"><h1>Your cart</h1>
    {cart.length === 0 ? <div className="empty-state">Your cart is empty. <Link to="/store">Browse products</Link></div> : <>
      <div className="cart-list">{cart.map((item, index) => {
        const id = Number(item.productId ?? item.id);
        return <article className="cart-row" key={id > 0 ? id : `${item.name}-${index}`}>
          <div><h2>{item.name}</h2><p>₹{Number(item.price || 0).toFixed(2)} each</p>{!Number.isSafeInteger(id) && <p className="form-error">This saved item is no longer linked to a product. Remove it and add the current listing again.</p>}</div>
          <div className="quantity-control"><button aria-label={`Decrease ${item.name}`} onClick={() => change(id, -1)}>−</button><span>{item.qty}</span><button aria-label={`Increase ${item.name}`} onClick={() => change(id, 1)}>+</button></div>
          <strong>₹{(Number(item.price || 0) * Number(item.qty || 0)).toFixed(2)}</strong>
        </article>;
      })}</div>
      <div className="cart-total"><span>Estimated total</span><strong>₹{total.toFixed(2)}</strong></div>
      <button className="primary-button" onClick={() => navigate("/checkout")}>Continue to checkout</button>
    </>}
  </section>;
}
