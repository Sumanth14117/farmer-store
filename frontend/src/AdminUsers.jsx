import { useEffect, useState } from "react";
import { getAdminUsers, updateAdminRole, updateAdminStatus } from "./api";
export default function AdminUsers() {
  const [data, setData] = useState({
      users: [],
      total: 0
    }),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    try {
      setData(await getAdminUsers());
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function update(id, fn, ...args) {
    try {
      await fn(id, ...args);
      await load();
    } catch (e) {
      setMessage(e.message);
      await load();
    }
  }
  return <section className="page-state"><h1>User management</h1>{message && <p role="alert">{message}</p>}{loading ? <p role="status">Loading users…</p> : data.users.length === 0 ? <p>No users found.</p> : <div style={{
      overflowX: "auto"
    }}><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>{data.users.map(u => <tr key={u.id}><td>{u.name}<br />{u.email}</td><td><select aria-label={`Role for ${u.email}`} value={u.role} onChange={e => update(u.id, updateAdminRole, e.target.value)}><option>customer</option><option>farmer</option><option>admin</option><option>delivery_partner</option></select></td><td>{u.status}</td><td><button onClick={() => update(u.id, updateAdminStatus, u.status === "active" ? "suspended" : "active")}>{u.status === "active" ? "Suspend" : "Reactivate"}</button></td></tr>)}</tbody></table></div>}<p>{data.total} users</p></section>;
}
