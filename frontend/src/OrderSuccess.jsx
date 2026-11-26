import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { getOrder } from "./api";
export default function OrderSuccess() {
  const { state } = useLocation();
  const [params] = useSearchParams();
  const id = params.get("id");
  const [order, setOrder] = useState(state?.order || null);
  const [loading, setLoading] = useState(Boolean(id && !state?.order));
  const [error, setError] = useState("");
  useEffect(() => {
    if (!id || state?.order) return;
    let active = true;
    getOrder(id).then((data) => { if (active) setOrder(data.order); })
      .catch((err) => { if (active) setError(err.message || "Order confirmation is unavailable"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, state]);
  return <section className="content-page success-page"><div className="success-card">
    {loading ? <p role="status">Loading order confirmation…</p> : order ? <><p className="eyebrow">Order placed</p><h1>Thank you!</h1><p>Your order has been saved successfully.</p><p><strong>Order #{order.id}</strong> · {order.status}</p><ul>{order.items.map((item, i) => <li key={`${item.productId}-${i}`}>{item.name} × {item.qty}</li>)}</ul><p>Total: <strong>₹{Number(order.total).toFixed(2)}</strong></p></> : <><h1>No recent confirmation found</h1><p>{error || "Place an order before visiting this page."}</p></>}
    <div className="button-row"><Link className="button-link" to="/orders">View my orders</Link><Link className="text-link" to="/store">Continue shopping</Link></div>
  </div></section>;
}
