import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getOrders } from "./api";
export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    getOrders().then((data) => { if (active) setOrders(Array.isArray(data.orders) ? data.orders : []); })
      .catch((err) => { if (active) setError(err.message || "Unable to load your orders"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  if (loading) return <p className="page-state" role="status">Loading your orders…</p>;
  if (error) return <p className="state-error" role="alert">{error}</p>;
  if (!orders.length) return <section className="content-page"><h1>My orders</h1><p className="empty-state">You have not placed an order yet. <Link to="/store">Explore the store</Link></p></section>;
  return <section className="content-page"><h1>My orders</h1><div className="order-list">{orders.map((order) => <article className="order-card" key={order.id}>
    <div className="order-heading"><div><h2>Order #{order.id}</h2><p>{order.createdAt ? new Date(order.createdAt + (order.createdAt.endsWith("Z") ? "" : "Z")).toLocaleString() : "Date unavailable"}</p></div><span className="status-pill">{order.status}</span></div>
    <ul>{order.items.map((item, index) => <li key={`${item.productId ?? item.name}-${index}`}>{item.name} × {item.qty} — ₹{(Number(item.price) * Number(item.qty)).toFixed(2)}</li>)}</ul>
    {order.address && Object.keys(order.address).length > 0 && <p className="muted">Delivering to {order.address.name}, {order.address.street}, {order.address.city} {order.address.pincode}</p>}
    <p className="order-total">Order total: ₹{Number(order.total).toFixed(2)}</p>
  </article>)}</div></section>;
}
