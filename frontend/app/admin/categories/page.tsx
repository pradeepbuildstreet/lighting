import { CategoryManager } from "./CategoryManager";
import { ManagerTabs } from "@/components/ManagerTabs";

export const metadata = {
  title: "Manage Categories | Lighting House",
  robots: { index: false, follow: false },
};

export default function CategoriesAdminPage() {
  return (
    <div className="container py-8">
      <ManagerTabs active="categories" />
      <CategoryManager />
    </div>
  );
}