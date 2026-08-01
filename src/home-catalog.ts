export const HOME_CATALOG_ITEMS = [
  { kind: "sofa", label: "Sofa", category: "Living", tags: ["seat", "relax", "social"] },
  { kind: "table", label: "Dining table", category: "Living", tags: ["seat", "meal", "social"] },
  { kind: "bed", label: "Bed", category: "Bedroom", tags: ["sleep", "rest"] },
  { kind: "desk", label: "Desk", category: "Study", tags: ["work", "school", "storage"] },
  { kind: "bookcase", label: "Bookcase", category: "Study", tags: ["work", "reading", "storage"] },
  { kind: "fridge", label: "Fridge", category: "Kitchen", tags: ["food", "meal", "storage"] },
  { kind: "shower", label: "Shower", category: "Bathroom", tags: ["hygiene", "health"] },
  { kind: "plant", label: "Plant", category: "Decor", tags: ["green", "wellness"] }
] as const;

export type HomeCatalogKind = (typeof HOME_CATALOG_ITEMS)[number]["kind"];

export function normalizeHomeCatalogFavorites(values: unknown): HomeCatalogKind[] {
  if (!Array.isArray(values)) return [];
  const valid = new Set<HomeCatalogKind>(HOME_CATALOG_ITEMS.map(item => item.kind));
  return [...new Set(values.filter((value): value is HomeCatalogKind => typeof value === "string" && valid.has(value as HomeCatalogKind)))];
}

export function filterHomeCatalog(query: string, favorites: ReadonlySet<HomeCatalogKind>) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return HOME_CATALOG_ITEMS
    .filter(item => {
      const haystack = `${item.kind} ${item.label} ${item.category} ${item.tags.join(" ")}`.toLocaleLowerCase();
      return terms.every(term => haystack.includes(term));
    })
    .sort((first, second) =>
      Number(favorites.has(second.kind)) - Number(favorites.has(first.kind))
      || first.category.localeCompare(second.category)
      || first.label.localeCompare(second.label)
    );
}
