import { useEffect, useState } from "react";
import { getProfile, startGoogleLink, unlinkGoogle, updatePassword, updateProfile } from "./api";
import { useAuth } from "./useAuth";
export default function Profile() {
  const {
      user,
      setUser
    } = useAuth(),
    [name, setName] = useState(user?.name || ""),
    [phone, setPhone] = useState(user?.phone || ""),
    [image, setImage] = useState(user?.profile_image_url || ""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [currentPassword, setCurrentPassword] = useState(""),
    [newPassword, setNewPassword] = useState("");
  useEffect(() => {
    getProfile().then(x => setUser(x.user)).catch(e => setMessage(e.message));
  }, [setUser]);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const d = await updateProfile({
        name,
        phone,
        profile_image_url: image
      });
      setUser(d.user);
      setMessage("Profile saved.");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function savePassword(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await updatePassword({
        currentPassword: currentPassword || undefined,
        newPassword
      });
      setCurrentPassword("");
      setNewPassword("");
      const d = await getProfile();
      setUser(d.user);
      setMessage("Password saved. Other sessions were signed out.");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return <section className="auth-page"><form className="auth-card" onSubmit={save}><h1>Your profile</h1><label>Name<input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={100} /></label><label>Phone<input value={phone} onChange={e => setPhone(e.target.value)} maxLength={30} /></label><label>Profile image URL (HTTPS)<input type="url" value={image} onChange={e => setImage(e.target.value)} maxLength={2048} /></label><p>Email: {user?.email}</p><p>Role: {user?.role}</p><p>Account created: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</p><button disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>{user?.google_linked ? <button type="button" onClick={async () => {
        try {
          await unlinkGoogle();
          const d = await getProfile();
          setUser(d.user);
          setMessage("Google account unlinked.");
        } catch (e) {
          setMessage(e.message);
        }
      }}>Unlink Google</button> : <button type="button" onClick={async () => {
        try {
          await startGoogleLink();
        } catch (e) {
          setMessage(e.message);
        }
      }}>Link Google</button>}{message && <p role="status">{message}</p>}</form><form className="auth-card" onSubmit={savePassword}><h2>{user?.has_password ? "Change password" : "Add an email password"}</h2>{user?.has_password && <label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required /></label>}<label>New password<input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} maxLength={128} required /></label><button disabled={busy}>{busy ? "Saving…" : "Save password"}</button></form></section>;
}
