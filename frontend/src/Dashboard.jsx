import { useEffect, useState } from "react";
import { getAdminStats } from "./api";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    getAdminStats().then((data) => { if (active) setStats(data); })
      .catch((err) => { if (active) setError(err.message || "Unable to load dashboard"); });
    return () => { active = false; };
  }, []);
  if (error) return <section className="content-page"><h1>Admin dashboard</h1><p className="state-error" role="alert">{error}</p></section>;
  if (!stats) return <p className="page-state" role="status">Loading dashboard…</p>;
  const orderData = [{ name: "Orders", value: stats.totalOrders }, { name: "Items sold", value: stats.totalItems }];
  return <section className="content-page"><p className="eyebrow">Store operations</p><h1>Admin dashboard</h1>
    <p><Link className="button-link" to="/admin/farmer-applications">Review farmer applications</Link></p><div className="stats-grid"><article className="stat-card"><span>Total revenue</span><strong>₹{Number(stats.totalRevenue).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></article><article className="stat-card"><span>Orders</span><strong>{stats.totalOrders}</strong></article><article className="stat-card"><span>Items sold</span><strong>{stats.totalItems}</strong></article></div>
    <div className="dashboard-charts"><article className="chart-card"><h2>Revenue (₹)</h2><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={[{ name: "Lifetime", value: Number(stats.totalRevenue) }]} margin={{ top: 12, right: 12, left: 20, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis tickFormatter={(value) => `₹${value}`} /><Tooltip formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Revenue"]} /><Bar dataKey="value" fill="#377548" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer></div></article>
      <article className="chart-card"><h2>Order volume</h2><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={orderData} margin={{ top: 12, right: 12, left: 12, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#719d55" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer></div></article></div>
  </section>;
}
