import { useEffect, useState } from "react";
import { createReview, getReviews } from "./api";
export default function ReviewBox({ productId, productName }) {
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState("5");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function refresh() {
    const result = await getReviews(productId);
    setReviews(Array.isArray(result.reviews) ? result.reviews : []);
  }
  useEffect(() => {
    let active = true;
    getReviews(productId).then((result) => { if (active) setReviews(Array.isArray(result.reviews) ? result.reviews : []); })
      .catch((err) => { if (active) setError(err.message || "Unable to load reviews"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId]);
  async function submit(event) {
    event.preventDefault(); setError(""); setBusy(true);
    try { await createReview(productId, { rating: Number(rating), review: text }); setText(""); setRating("5"); await refresh(); }
    catch (err) { setError(err.message || "Unable to submit review"); }
    finally { setBusy(false); }
  }
  return <section className="review-box" aria-label={`Reviews for ${productName}`}>
    <h3>Customer reviews</h3>
    {loading ? <p className="muted">Loading reviews…</p> : reviews.length === 0 ? <p className="muted">No reviews yet. Be the first to share your experience.</p> : reviews.map((review) => <article className="review-item" key={review.id}><p aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p><p>{review.review}</p></article>)}
    {error && <p className="form-error" role="alert">{error}</p>}
    <form onSubmit={submit} className="review-form"><label>Rating<select value={rating} onChange={(e) => setRating(e.target.value)}>{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value} star{value === 1 ? "" : "s"}</option>)}</select></label><label>Your review<textarea value={text} onChange={(e) => setText(e.target.value)} required minLength={3} maxLength={2000} rows={3} /></label><button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit review"}</button></form>
  </section>;
}
