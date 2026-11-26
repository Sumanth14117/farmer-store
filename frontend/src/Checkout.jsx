import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { placeOrder } from "./api";

const emptyAddress = { name: "", phone: "", street: "", city: "", pincode: "" };
function newKey() { return globalThis.crypto?.randomUUID?.() || `order-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
export default function Checkout({ cart, setCart }) {
  const navigate = useNavigate();
  const [address, setAddress] = useState(emptyAddress);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [idempotencyKey] = useState(newKey);
  const estimate = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
  function handleChange(event) { setAddress((current) => ({ ...current, [event.target.name]: event.target.value })); }
  async function submit(event) {
    event.preventDefault(); setError("");
    if (!cart.length) { setError("Your cart is empty."); return; }
    const items = cart.map((item) => ({ productId: Number(item.productId ?? item.id), quantity: Number(item.qty) }));
    if (items.some((item) => !Number.isSafeInteger(item.productId) || item.productId <= 0)) { setError("Remove outdated saved items and add them again from the catalogue."); return; }
    setBusy(true);
    try {
      const result = await placeOrder({ items, address }, idempotencyKey);
      setCart([]); localStorage.removeItem("cart");
      navigate(`/success?id=${result.order.id}`, { replace: true, state: { order: result.order } });
    } catch (err) { setError(err.message || "Unable to place order. Please try again."); }
    finally { setBusy(false); }
  }
  if (!cart.length) return <section className="content-page"><h1>Checkout</h1><p className="empty-state">Your cart is empty.</p></section>;
  return <section className="content-page checkout-page"><h1>Checkout</h1>
    <form onSubmit={submit}>
      <fieldset className="address-form"><legend>Delivery address</legend>
        <label>Full name<input name="name" autoComplete="name" value={address.name} onChange={handleChange} required maxLength={100} /></label>
        <label>Phone number<input name="phone" autoComplete="tel" inputMode="tel" value={address.phone} onChange={handleChange} required maxLength={20} /></label>
        <label>Street and house number<input name="street" autoComplete="street-address" value={address.street} onChange={handleChange} required maxLength={240} /></label>
        <label>City<input name="city" autoComplete="address-level2" value={address.city} onChange={handleChange} required maxLength={100} /></label>
        <label>Postal code<input name="pincode" autoComplete="postal-code" value={address.pincode} onChange={handleChange} required maxLength={12} /></label>
      </fieldset>
      <div className="order-summary"><h2>Order summary</h2>{cart.map((item, index) => <div className="summary-line" key={`${item.productId ?? item.id ?? item.name}-${index}`}><span>{item.name} × {item.qty}</span><span>₹{(Number(item.price || 0) * Number(item.qty || 0)).toFixed(2)}</span></div>)}<div className="summary-line summary-total"><span>Estimated total</span><strong>₹{estimate.toFixed(2)}</strong></div><p className="muted">Final prices are confirmed by the server when your order is placed.</p></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "Placing order…" : "Place order"}</button>
    </form>
  </section>;
}
