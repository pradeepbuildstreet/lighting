import type { Metadata } from "next";
import { ManagerTabs } from "@/components/ManagerTabs";
import { AdminUsers } from "@/components/AdminUsers";

export const metadata: Metadata = {
  title: "Admin Accounts | Luminoza",
  robots: { index: false, follow: false },
};

export default function AdminUsersPage() {
  return (
    <div className="container py-8 manager-page">
      <ManagerTabs active="admins" />
      <div className="manager-page-heading">
        <p className="wishlist-eyebrow">Access control</p>
        <h1>Admin accounts</h1>
        <p>Manage who can access store operations and customer enquiries.</p>
      </div>
      <AdminUsers />
    </div>
  );
}