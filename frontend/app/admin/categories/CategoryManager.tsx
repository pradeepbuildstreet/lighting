"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Save, Trash2, X } from "lucide-react";
import { API_BASE_URL, type CategoryNode, flattenCategories } from "@/lib/categories";

type CategoryDraft = {
  name: string;
  slug: string;
  parent_id: string;
  description: string;
  sort_order: number;
};

const emptyDraft: CategoryDraft = {
  name: "",
  slug: "",
  parent_id: "",
  description: "",
  sort_order: 0,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function descendantsOf(category: CategoryNode): string[] {
  return [category.id, ...category.children.flatMap(descendantsOf)];
}

export function CategoryManager() {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadCategories = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/categories`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load categories.");
      setCategories(data.categories || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load categories.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  const beginAdd = (parentId = "") => {
    const siblings = parentId
      ? flattenCategories(categories).find((category) => category.id === parentId)?.children || []
      : categories;
    setEditingId(null);
    setDraft({ ...emptyDraft, parent_id: parentId, sort_order: siblings.length * 10 });
    setMessage("");
  };

  const beginEdit = (category: CategoryNode) => {
    setEditingId(category.id);
    setDraft({
      name: category.name,
      slug: category.slug,
      parent_id: category.parent_id || "",
      description: category.description || "",
      sort_order: category.sort_order,
    });
    setMessage("");
  };

  const saveCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/categories${editingId ? `/${editingId}` : ""}`,
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, parent_id: draft.parent_id || null }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save category.");
      await loadCategories();
      setDraft(emptyDraft);
      setEditingId(null);
      setMessage("Category saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save category.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (category: CategoryNode) => {
    if (!window.confirm(`Delete ${category.name}?`)) return;
    setMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/categories/${category.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to delete category.");
      await loadCategories();
      if (editingId === category.id) {
        setEditingId(null);
        setDraft(emptyDraft);
      }
      setMessage("Category deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete category.");
    }
  };

  const moveCategory = async (category: CategoryNode, direction: "up" | "down") => {
    setMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/categories/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: category.id, direction }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to reorder category.");
      await loadCategories();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reorder category.");
    }
  };

  const excludedParentIds = editingId
    ? new Set(descendantsOf(flattenCategories(categories).find((category) => category.id === editingId)!))
    : new Set<string>();

  const renderCategory = (
    category: CategoryNode,
    siblings: CategoryNode[],
    index: number,
    depth: number
  ): React.ReactNode => (
    <div key={category.id}>
      <div className="category-manager-row" style={{ paddingLeft: `${depth * 22 + 12}px` }}>
        <div className="category-manager-info">
          <strong>{category.name}</strong>
          <code>/{category.slug}</code>
          <span>{category.product_count} products</span>
        </div>
        <div className="category-manager-actions">
          <button type="button" aria-label={`Move ${category.name} up`} disabled={index === 0} onClick={() => void moveCategory(category, "up")}>
            <ArrowUp size={16} aria-hidden="true" />
          </button>
          <button type="button" aria-label={`Move ${category.name} down`} disabled={index === siblings.length - 1} onClick={() => void moveCategory(category, "down")}>
            <ArrowDown size={16} aria-hidden="true" />
          </button>
          <button type="button" aria-label={`Add subcategory under ${category.name}`} onClick={() => beginAdd(category.id)}>
            <Plus size={16} aria-hidden="true" />
          </button>
          <button type="button" aria-label={`Edit ${category.name}`} onClick={() => beginEdit(category)}>
            Edit
          </button>
          <button type="button" aria-label={`Delete ${category.name}`} onClick={() => void deleteCategory(category)}>
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      {category.children.map((child, childIndex) =>
        renderCategory(child, category.children, childIndex, depth + 1)
      )}
    </div>
  );

  return (
    <section className="category-manager">
      <div className="category-manager-heading">
        <div>
          <p className="category-manager-eyebrow">Store structure</p>
          <h1>Categories</h1>
        </div>
        <button type="button" className="category-manager-primary" onClick={() => beginAdd()}>
          <Plus size={17} aria-hidden="true" /> Add department
        </button>
      </div>

      <p className="category-manager-notice">
        Category changes affect storefront navigation and product filters. Products must be reassigned before their category can be deleted.
      </p>

      {message && <p className="category-manager-message" role="status">{message}</p>}

      <div className="category-manager-layout">
        <div className="category-manager-tree" aria-label="Category tree">
          {loading ? (
            <p>Loading categories...</p>
          ) : categories.length ? (
            categories.map((category, index) => renderCategory(category, categories, index, 0))
          ) : (
            <p>No categories found.</p>
          )}
        </div>

        <form className="category-manager-form" onSubmit={saveCategory}>
          <div className="category-manager-form-heading">
            <h2>{editingId ? "Edit category" : "Add category"}</h2>
            {(editingId || draft.name) && (
              <button type="button" aria-label="Reset form" onClick={() => { setEditingId(null); setDraft(emptyDraft); }}>
                <X size={17} aria-hidden="true" />
              </button>
            )}
          </div>
          <label>
            Name
            <input
              required
              value={draft.name}
              onChange={(event) => setDraft((current) => ({
                ...current,
                name: event.target.value,
                slug: editingId ? current.slug : slugify(event.target.value),
              }))}
            />
          </label>
          <label>
            Slug
            <input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))} />
          </label>
          <label>
            Parent department/category
            <select value={draft.parent_id} onChange={(event) => setDraft((current) => ({ ...current, parent_id: event.target.value }))}>
              <option value="">Top-level department</option>
              {flattenCategories(categories)
                .filter((category) => !excludedParentIds.has(category.id))
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.path.split("/").filter(Boolean).slice(1).join(" / ") || category.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Description
            <textarea rows={3} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label>
            Sort order
            <input type="number" min="0" step="1" value={draft.sort_order} onChange={(event) => setDraft((current) => ({ ...current, sort_order: Number(event.target.value) }))} />
          </label>
          <button type="submit" className="category-manager-primary" disabled={saving}>
            <Save size={16} aria-hidden="true" /> {saving ? "Saving..." : "Save category"}
          </button>
        </form>
      </div>
    </section>
  );
}