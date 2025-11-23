export default function ProductCard({ product }) {
  return (
    <div style={{
      width: 260,
      border: "1px solid #ddd",
      padding: 12,
      borderRadius: 8,
      background: "#fff",
      boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)"
    }}>
      
      {/* FIXED IMAGE SECTION */}
      <div style={{
        width: "100%",
        height: "180px",
        overflow: "hidden",
        borderRadius: 8,
        backgroundColor: "#f2f2f2",
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}>
        <img
          src={product.image}
          alt={product.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover"
          }}
        />
      </div>

      <h3 style={{ marginTop: 10 }}>{product.name}</h3>
      <p style={{ color: "#666", fontSize: "14px" }}>{product.description}</p>
      <p style={{ fontWeight: "bold" }}>₹{product.price}</p>
    </div>
  );
}
