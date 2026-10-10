"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/categories";

type AdminUser = { id: string; email: string; is_active: boolean; created_at: string };

export function AdminUsers() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadAdmins = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/auth/admins`, { credentials: "include", cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load administrator accounts.");
    setAdmins(data.admins || []);
  }, []);

  useEffect(() => {
    void loadAdmins().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load administrator accounts."));
  }, [loadAdmins]);

  async function addAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/admins`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add administrator.");
      setEmail("");
      setPassword("");
      setMessage(`Administrator added: ${data.admin.email}`);
      await loadAdmins();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add administrator.");
    } finally {
      setBusy(false);
    }
  }

  async function setActive(admin: AdminUser) {
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/admins/${admin.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !admin.is_active }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update administrator.");
      setMessage(`${data.admin.email} ${data.admin.is_active ? "enabled" : "disabled"}.`);
      await loadAdmins();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update administrator.");
    }
  }

  return (
    <section className="admin-users">
      <form className="admin-user-form" onSubmit={addAdmin}>
        <div>
          <p className="admin-eyebrow">New account</p>
          <h2>Add administrator</h2>
        </div>
        <label>Email<input type="email" autoComplete="off" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Temporary password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <p className="admin-auth-copy">Share the password with the new administrator through a secure channel.</p>
        <button className="category-manager-primary" type="submit" disabled={busy}>{busy ? "Adding..." : "Add admin"}</button>
      </form>

      {message && <p className="category-manager-message" role="status">{message}</p>}
      {error && <p className="manager-error" role="alert">{error}</p>}
      <div className="admin-user-list">
        <h2>Current administrators</h2>
        {admins.map((admin) => (
          <div className="admin-user-row" key={admin.id}>
            <div><strong>{admin.email}</strong><small>Added {new Date(admin.created_at).toLocaleDateString()}</small></div>
            <span className={admin.is_active ? "admin-account-status is-active" : "admin-account-status"}>{admin.is_active ? "Active" : "Disabled"}</span>
            <button type="button" onClick={() => void setActive(admin)}>{admin.is_active ? "Disable" : "Enable"}</button>
          </div>
        ))}
        {!admins.length && <p className="manager-empty">No admin accounts found.</p>}
      </div>
    </section>
  );
}