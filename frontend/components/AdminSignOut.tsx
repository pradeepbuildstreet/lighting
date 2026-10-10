"use client";

import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/categories";

export function AdminSignOut() {
  const router = useRouter();

  async function signOut() {
    await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" });
    router.replace("/admin/login");
    router.refresh();
  }

  return <button className="admin-signout" type="button" onClick={() => void signOut()}>Sign out</button>;
}