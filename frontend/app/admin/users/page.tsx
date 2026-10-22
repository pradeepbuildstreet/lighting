import type { Metadata } from "next";
import { AdminShell } from "@/components/AdminShell";
import { AdminUsers } from "@/components/AdminUsers";

export const metadata: Metadata = {
  title: "Admin Accounts | Luminoza",
  robots: { index: false, follow: false },
};

export default function AdminUsersPage() {
  return (
    <AdminShell active="admins">
      <div className="manager-page-heading">
        <p className="wishlist-eyebrow">Access control</p>
        <h1>Admin accounts</h1>
        <p>Manage who can access store operations and customer enquiries.</p>
      </div>
      <AdminUsers />
    </AdminShell>
  );
}