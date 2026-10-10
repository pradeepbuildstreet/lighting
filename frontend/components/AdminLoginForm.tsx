"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/categories";

export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sign in failed.");

      const nextPath = new URLSearchParams(window.location.search).get("next");
      router.replace(nextPath?.startsWith("/admin") ? nextPath : "/admin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-auth-panel">
      <p className="admin-eyebrow">Luminoza / Secure area</p>
      <h1>Admin sign in</h1>
      <p className="admin-auth-copy">Use an active administrator account to continue.</p>
      <form className="admin-auth-form" onSubmit={signIn}>
        <label htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <p className="admin-form-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
      </form>
    </section>
  );
}