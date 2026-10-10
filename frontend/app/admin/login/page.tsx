import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/AdminLoginForm";

export const metadata: Metadata = {
  title: "Admin Sign In | Luminoza",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className="container admin-auth-page">
      <AdminLoginForm />
    </div>
  );
}